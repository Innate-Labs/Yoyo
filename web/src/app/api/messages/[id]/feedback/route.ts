import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { track } from "@/lib/events";

// 对某条 AI 回答点赞/点踩（可覆盖，可取消）
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const uid = await requireUserId();
    const { kind } = await req.json(); // "UP" | "DOWN" | null(取消)

    const msg = await prisma.message.findUnique({
      where: { id: params.id },
      include: { conversation: true },
    });
    if (!msg || msg.conversation.userId !== uid) return fail("消息不存在", 404);
    if (msg.role !== "ASSISTANT") return fail("只能对 AI 回答反馈", 400);

    if (kind === null || kind === undefined) {
      await prisma.feedback.deleteMany({ where: { messageId: params.id, userId: uid } });
      return ok({ kind: null });
    }
    if (kind !== "UP" && kind !== "DOWN") return fail("反馈类型错误", 400);

    await prisma.feedback.upsert({
      where: { messageId_userId: { messageId: params.id, userId: uid } },
      create: { messageId: params.id, userId: uid, kind },
      update: { kind },
    });

    await track("问答_反馈", uid, {
      conversationId: msg.conversationId,
      feedback: kind,
    });
    return ok({ kind });
  } catch (e) {
    return handleError(e);
  }
}
