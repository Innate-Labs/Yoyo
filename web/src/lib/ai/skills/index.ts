import type { QuestionTypeStr } from "../types";
import { MEDICAL_SKILL, MEDICAL_RED_KEYWORDS } from "./medical";
import { BEHAVIOR_SKILL } from "./behavior";
import { FEEDING_SKILL } from "./feeding";

// 场景 Skill 路由：按意图（问题类型）选择性注入对应 Skill 片段，而非全塞。
// 医疗红线用「关键词预检 + 模型判断」双保险：命中红线关键词一律强制走医疗 Skill（宁可误报）。

export type SkillKey = "feeding" | "behavior" | "medical";

const SKILL_TEXT: Record<SkillKey, string> = {
  feeding: FEEDING_SKILL,
  behavior: BEHAVIOR_SKILL,
  medical: MEDICAL_SKILL,
};

/** 关键词预检：用户文本是否命中医疗红线（触发强制走医疗 Skill）。 */
export function hitsMedicalRedLine(text: string): boolean {
  if (!text) return false;
  return MEDICAL_RED_KEYWORDS.some((k) => text.includes(k));
}

/** 问题类型 → 默认 Skill。 */
function skillForType(qt: QuestionTypeStr): SkillKey {
  switch (qt) {
    case "daily_care":
      return "feeding";
    case "behavior_anomaly":
      return "behavior";
    case "symptom_disease":
      return "medical";
  }
}

/**
 * 选择要注入的 Skill。
 * - 命中医疗红线关键词 → 强制 medical（双保险的关键词侧）。
 * - 否则按问题类型路由。
 * questionType 传 null 表示尚未分类（例如首轮预路由），仅按红线判断。
 */
export function selectSkill(
  text: string,
  questionType: QuestionTypeStr | null
): SkillKey {
  if (hitsMedicalRedLine(text)) return "medical";
  if (questionType) return skillForType(questionType);
  return "feeding"; // 无分类且无红线时的保守默认（日常养护）
}

/** 取 Skill 片段文本。 */
export function skillPrompt(key: SkillKey): string {
  return SKILL_TEXT[key];
}

export { MEDICAL_RED_KEYWORDS };
