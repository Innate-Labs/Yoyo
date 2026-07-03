import type { ChatRequest, ChatTurn, LLMProvider } from "../types";
import { coerceAgentResult } from "../parse";
import { retry, RetryableError, isRetryableStatus } from "../retry";

// 通义千问 Qwen-VL，走 DashScope 的 OpenAI 兼容端点。
// 文档：https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope

function baseUrl() {
  return (
    process.env.DASHSCOPE_BASE_URL?.replace(/\/$/, "") ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1"
  );
}
function apiKey() {
  const k = process.env.DASHSCOPE_API_KEY;
  if (!k) throw new Error("DASHSCOPE_API_KEY 未配置");
  return k;
}
function model() {
  return process.env.QWEN_VL_MODEL || "qwen-vl-max";
}

// 将图片路径转成模型可访问的形式。
// 本地上传文件存于 /public/uploads，模型无法访问 localhost；MVP 阶段读成 data URL 传入。
async function imageToContentPart(imageUrl: string) {
  if (/^https?:\/\//i.test(imageUrl)) {
    return { type: "image_url", image_url: { url: imageUrl } };
  }
  // 本地相对路径 -> 读文件转 base64 data url
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const rel = imageUrl.replace(/^\//, "");
  const abs = path.join(process.cwd(), "public", rel);
  const buf = await fs.readFile(abs);
  const ext = path.extname(abs).slice(1).toLowerCase() || "jpeg";
  const mime = ext === "jpg" ? "jpeg" : ext;
  return {
    type: "image_url",
    image_url: { url: `data:image/${mime};base64,${buf.toString("base64")}` },
  };
}

async function turnToMessage(turn: ChatTurn) {
  if (turn.role === "user" && turn.imageUrl) {
    return {
      role: "user",
      content: [
        { type: "text", text: turn.content },
        await imageToContentPart(turn.imageUrl),
      ],
    };
  }
  return { role: turn.role, content: turn.content };
}

async function buildMessages(req: ChatRequest) {
  const messages: unknown[] = [{ role: "system", content: req.systemPrompt }];
  for (const t of req.history) messages.push(await turnToMessage(t));
  messages.push(
    await turnToMessage({
      role: "user",
      content: req.userText,
      imageUrl: req.userImageUrl,
    })
  );
  return messages;
}

export const qwenProvider: LLMProvider = {
  name: "qwen",

  async *streamAnswer(req: ChatRequest) {
    const messages = await buildMessages(req);
    const body = JSON.stringify({
      model: model(),
      messages,
      stream: true,
      temperature: 0.3,
      // Qwen3.x 为推理模型，默认思考会让首字延迟 ~20s；关闭思考后 TTFT<1s、总时长约 3s，
      // 满足 PRD ≤10s。我们的 Skill 提示词已编码判断结构，无需模型额外链式思考。
      enable_thinking: false,
    });

    // 连接阶段（fetch + 校验响应）带指数退避重试；一旦开始吐字则不再重试（避免重复输出）。
    // 单次尝试 30s 超时，失败/超时/5xx/429 重试，共 3 次尝试。
    const resp = await retry(
      async (signal) => {
        let r: Response;
        try {
          r = await fetch(`${baseUrl()}/chat/completions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey()}`,
              "Content-Type": "application/json",
            },
            body,
            signal,
          });
        } catch (e) {
          // 网络层错误（含超时 abort）→ 可重试
          throw new RetryableError("连接大模型失败", e);
        }
        if (!r.ok || !r.body) {
          const detail = await r.text().catch(() => "");
          const msg = `Qwen 请求失败 ${r.status}: ${detail.slice(0, 300)}`;
          if (isRetryableStatus(r.status)) throw new RetryableError(msg);
          throw new Error(msg); // 4xx（如鉴权/参数错误）不重试
        }
        return r;
      },
      {
        retries: 2,
        baseDelayMs: 600,
        timeoutMs: 30000,
        onRetry: (attempt, err, delay) =>
          console.warn(`[QWEN RETRY] 第 ${attempt} 次重试，${delay}ms 后，因：${(err as Error).message}`),
      },
      req.signal
    );

    // 累积完整原始文本（是一个 JSON 对象）；同时增量提取 answer 字段用于流式展示。
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    let emitted = 0; // 已经 yield 出去的 answer 字符数
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        try {
          const json = JSON.parse(data);
          const delta: string = json.choices?.[0]?.delta?.content ?? "";
          if (!delta) continue;
          raw += delta;

          // 尝试从当前累积 raw 中提取 answer 字段的已生成部分，做增量流式
          const nextEmit = extractAnswerSoFar(raw);
          if (nextEmit.length > emitted) {
            yield nextEmit.slice(emitted);
            emitted = nextEmit.length;
          }
        } catch {
          // 忽略非 JSON 的 keep-alive 行
        }
      }
    }

    const result = coerceAgentResult(raw);
    // 若流式提取与最终 answer 不一致（例如结尾补齐），把剩余部分补吐出去
    if (result.answer.length > emitted) {
      // 仅当前缀一致时补差量，否则不重复输出（避免串味）
      if (result.answer.startsWith(stripToEmitted(raw, emitted))) {
        // 无法可靠对齐，交由前端以最终结果为准，这里不再补吐
      }
    }
    return result;
  },

  async embed(text: string) {
    const key = process.env.DASHSCOPE_API_KEY;
    if (!key) return null;
    const embModel = process.env.QWEN_EMBEDDING_MODEL || "text-embedding-v3";
    try {
      const resp = await fetch(`${baseUrl()}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: embModel, input: text }),
      });
      if (!resp.ok) return null;
      const json = await resp.json();
      return (json.data?.[0]?.embedding as number[]) ?? null;
    } catch {
      return null;
    }
  },
};

// 从累积的原始 JSON 文本中提取 "answer": "..." 已经生成的内容（处理未闭合的字符串）。
function extractAnswerSoFar(raw: string): string {
  const key = raw.indexOf('"answer"');
  if (key === -1) return "";
  const colon = raw.indexOf(":", key);
  if (colon === -1) return "";
  const q = raw.indexOf('"', colon);
  if (q === -1) return "";
  let out = "";
  let i = q + 1;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === "\\") {
      const next = raw[i + 1];
      if (next === undefined) break; // 转义未完成
      switch (next) {
        case "n": out += "\n"; break;
        case "t": out += "\t"; break;
        case "r": out += "\r"; break;
        case '"': out += '"'; break;
        case "\\": out += "\\"; break;
        case "/": out += "/"; break;
        default: out += next;
      }
      i += 2;
      continue;
    }
    if (ch === '"') break; // 字符串结束
    out += ch;
    i += 1;
  }
  return out;
}

function stripToEmitted(raw: string, _emitted: number) {
  return extractAnswerSoFar(raw);
}
