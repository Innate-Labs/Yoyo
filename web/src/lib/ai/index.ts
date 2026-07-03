import type { LLMProvider } from "./types";
import { mockProvider } from "./providers/mock";
import { qwenProvider } from "./providers/qwen";

// 选择 provider：优先环境变量，其次按是否配置了 Key 自动降级。
export function getProvider(): LLMProvider {
  const explicit = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (explicit === "mock") return mockProvider;
  if (explicit === "qwen") {
    return process.env.DASHSCOPE_API_KEY ? qwenProvider : mockProvider;
  }
  // 未显式指定：有 Key 用 qwen，否则 mock
  return process.env.DASHSCOPE_API_KEY ? qwenProvider : mockProvider;
}

export * from "./types";
