export type QuestionTypeStr = "daily_care" | "behavior_anomaly" | "symptom_disease";
export type Urgency = "none" | "observe" | "see_vet" | "emergency";

// Agent 结构化输出
export interface AgentResult {
  question_type: QuestionTypeStr;
  urgency: Urgency;
  is_high_risk: boolean;
  answer: string;
}

// 传给 LLM 的对话历史条目
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null; // 仅 user 可带图（本地路径或 http url）
}

export interface ChatRequest {
  systemPrompt: string;
  history: ChatTurn[]; // 不含最新一条
  userText: string;
  userImageUrl?: string | null;
  signal?: AbortSignal; // 客户端断开信号，用于取消上游请求与终止重试
}

export interface LLMProvider {
  name: string;
  /**
   * 生成 Agent 回答。以异步生成器逐块吐出「回答正文」增量（供 SSE 流式展示），
   * 最终 return 完整的结构化 AgentResult。
   */
  streamAnswer(req: ChatRequest): AsyncGenerator<string, AgentResult, void>;

  /** 生成 embedding（RAG 用）。无能力时返回 null。 */
  embed?(text: string): Promise<number[] | null>;
}
