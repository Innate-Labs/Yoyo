import { prisma } from "@/lib/db";
import { fail, handleError } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { track } from "@/lib/events";
import { getProvider } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { retrieveChunks } from "@/lib/ai/rag";
import { coerceAgentResult, toPrismaQuestionType } from "@/lib/ai/parse";
import type { ChatTurn } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// SSE 事件编码
function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  try {
    const uid = await requireUserId();
    const body = await req.json();
    const conversationId: string = body.conversationId;
    const text: string = (body.text ?? "").toString().trim();
    const imageUrl: string | null = body.imageUrl || null;

    if (!conversationId) return fail("缺少 conversationId", 400);
    if (!text && !imageUrl) return fail("请输入问题或上传图片", 400);

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { pet: true, messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conv || conv.userId !== uid) return fail("会话不存在", 404);

    // 保存用户消息
    const userMsg = await prisma.message.create({
      data: { conversationId, role: "USER", content: text, imageUrl },
    });

    // 首条消息用问题前 20 字作为标题
    if (conv.messages.length === 0 && text) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title: text.slice(0, 20) },
      });
    }

    await track("问答_发起", uid, {
      conversationId,
      hasImage: !!imageUrl,
    });

    // 组装历史（不含刚存的这条）
    const history: ChatTurn[] = conv.messages.map((m) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
      imageUrl: m.imageUrl,
    }));

    // 预留检索接口（RAG 当前为空实现，返回空数组）
    const materials = await retrieveChunks(text, conv.pet?.species);

    // 按意图路由场景 Skill：buildSystemPrompt 内部据 userText 选注对应 Skill（含医疗红线双保险）
    const systemPrompt = buildSystemPrompt(
      conv.pet
        ? {
            name: conv.pet.name,
            species: conv.pet.species,
            ageMonths: conv.pet.ageMonths,
            sex: conv.pet.sex,
          }
        : null,
      text,
      materials
    );

    const provider = getProvider();
    const encoder = new TextEncoder();

    // 客户端断开检测：断开后停止推流与二次 enqueue，避免 "Controller is already closed"
    const abort = req.signal;

    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        // 安全 enqueue：控制器已关闭或客户端已断开则静默跳过
        const safeEnqueue = (chunk: string) => {
          if (closed || abort.aborted) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            closed = true;
          }
        };
        const safeClose = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        };

        safeEnqueue(sse("start", { userMessageId: userMsg.id }));
        let full = "";
        try {
          const gen = provider.streamAnswer({
            systemPrompt,
            history,
            userText: text,
            userImageUrl: imageUrl,
            signal: abort, // 客户端断开时取消上游请求与重试
          });

          let result = null as Awaited<ReturnType<typeof coerceAgentResult>> | null;
          while (true) {
            if (abort.aborted) return; // 客户端断开，停止生成
            const { value, done } = await gen.next();
            if (done) {
              result = value; // AgentResult
              break;
            }
            full += value;
            safeEnqueue(sse("delta", { text: value }));
          }

          const agent = result ?? coerceAgentResult(full);

          // 落库 assistant 消息
          const assistantMsg = await prisma.message.create({
            data: {
              conversationId,
              role: "ASSISTANT",
              content: agent.answer,
              questionType: toPrismaQuestionType(agent.question_type),
              isHighRisk: agent.is_high_risk,
            },
          });
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });

          await track("问答_类型判定", uid, {
            conversationId,
            questionType: agent.question_type,
            urgency: agent.urgency,
          });
          if (agent.is_high_risk) {
            await track("高危提示_触发", uid, {
              conversationId,
              species: conv.pet?.species,
            });
          }

          safeEnqueue(
            sse("done", {
              messageId: assistantMsg.id,
              questionType: agent.question_type,
              urgency: agent.urgency,
              isHighRisk: agent.is_high_risk,
              answer: agent.answer, // 以最终结果为准，前端据此校正流式文本
            })
          );
        } catch (e) {
          // 客户端主动断开导致的中断不算错误
          if (!abort.aborted) {
            console.error("[CHAT ERROR]", e);
            safeEnqueue(sse("error", { message: "分析超时或失败，请稍后重试" }));
          }
        } finally {
          safeClose();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
