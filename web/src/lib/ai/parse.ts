import type { AgentResult, QuestionTypeStr, Urgency } from "./types";

const QT: QuestionTypeStr[] = ["daily_care", "behavior_anomaly", "symptom_disease"];
const URG: Urgency[] = ["none", "observe", "see_vet", "emergency"];

/** 从模型原始文本中提取 JSON 对象（容忍代码块围栏 / 前后噪声）。 */
export function extractJsonObject(raw: string): unknown | null {
  let s = raw.trim();
  // 去掉 ```json ... ``` 围栏
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = s.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * 把模型输出规整为 AgentResult。安全兜底：
 * - 解析失败时，把原始文本当作 answer，类型按未知处理但从严（不误标高危）。
 * - is_high_risk 与 urgency 做一致性对齐：宁可误报，emergency 一律置高危。
 */
export function coerceAgentResult(raw: string): AgentResult {
  const obj = extractJsonObject(raw) as Partial<AgentResult> | null;

  if (!obj || typeof obj.answer !== "string") {
    // 兜底：无法解析结构，直接把文本给用户，类型标记为症状类以从严（不主动判高危）
    return {
      question_type: "symptom_disease",
      urgency: "see_vet",
      is_high_risk: false,
      answer: raw.trim() || "抱歉，我这次没能正确生成回答，请重试。",
    };
  }

  const question_type: QuestionTypeStr = QT.includes(obj.question_type as QuestionTypeStr)
    ? (obj.question_type as QuestionTypeStr)
    : "symptom_disease";

  let urgency: Urgency = URG.includes(obj.urgency as Urgency)
    ? (obj.urgency as Urgency)
    : "none";

  // 非症状类不应带就医紧急度
  if (question_type !== "symptom_disease") urgency = "none";

  // 一致性：emergency ⇒ 高危；反之若模型标了高危也升级 urgency
  let is_high_risk = obj.is_high_risk === true || urgency === "emergency";
  if (is_high_risk && question_type === "symptom_disease") urgency = "emergency";

  return { question_type, urgency, is_high_risk, answer: obj.answer };
}

/** 把 daily_care 等字符串映射到 Prisma enum。 */
export function toPrismaQuestionType(q: QuestionTypeStr) {
  switch (q) {
    case "daily_care":
      return "DAILY_CARE" as const;
    case "behavior_anomaly":
      return "BEHAVIOR_ANOMALY" as const;
    case "symptom_disease":
      return "SYMPTOM_DISEASE" as const;
  }
}
