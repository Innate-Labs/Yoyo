import type { QuestionTypeStr } from "./types";
import { hitsMedicalRedLine } from "./skills";

// 轻量启发式分类：仅用于「注入哪个 Skill 片段」的预判（单次调用、省 token）。
// 权威 question_type 仍由模型输出。医疗红线优先级最高。

const BEHAVIOR_KW = [
  "咬人", "咬笼", "爱咬", "躲", "不亲人", "不让抱", "不上手", "翻找", "破坏",
  "乱拉", "乱尿", "扒笼", "叫", "尖叫", "亢奋", "兴奋", "打架", "冲突",
  "性格", "脾气", "不听话", "故意", "报复", "不喜欢", "掉毛", "脱毛", "自舔",
  "训练", "作息", "夜行", "合笼", "社交", "应激", "压力", "行为",
];

const FEEDING_KW = [
  "喂", "吃什么", "能吃", "不能吃", "饮食", "粮", "零食", "食物", "喝水", "饮水",
  "笼", "笼子", "垫料", "跑轮", "窝", "空间", "环境", "温度", "湿度", "闷热", "空调",
  "洗澡", "沙浴", "清洁", "打扫", "气味", "臭", "到家", "新宠", "多宠", "养",
  "怎么养", "护理", "丰富化", "玩具",
];

/**
 * 预判问题类型（供 Skill 注入用）。
 * 优先级：医疗红线 > 行为词 > 饲养词 > 默认日常养护。
 */
export function heuristicType(text: string): QuestionTypeStr {
  if (!text) return "daily_care";
  if (hitsMedicalRedLine(text)) return "symptom_disease";
  if (BEHAVIOR_KW.some((k) => text.includes(k))) return "behavior_anomaly";
  if (FEEDING_KW.some((k) => text.includes(k))) return "daily_care";
  return "daily_care";
}
