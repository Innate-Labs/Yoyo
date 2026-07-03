import type { AgentResult, ChatRequest, LLMProvider } from "../types";
import { heuristicType } from "../classify";
import { hitsMedicalRedLine } from "../skills";

// 无 Key 时的降级实现：复用共享的 Skill 路由逻辑（heuristicType + 红线预检）做分类，
// 与真实链路的路由保持一致，保证主流程可跑通、可演示。生产请配置真实 provider（qwen）。

// 真正的急症词（→ emergency/高危）；其余医疗红线词按 see_vet 处理。
const EMERGENCY_KW = [
  "抽搐", "痉挛", "出血", "流血", "难产", "无法进食", "不吃不喝", "呼吸困难", "张嘴呼吸",
  "喘不上气", "昏迷", "瘫", "中毒", "严重脱水", "持续呕吐", "大量呕吐", "休克",
  "倒地", "站不稳", "误食", "中暑", "尿不出",
];

function buildAnswer(text: string): AgentResult {
  // 分类与真实路由一致：红线 → symptom_disease；否则按启发式
  const type = hitsMedicalRedLine(text) ? "symptom_disease" : heuristicType(text);
  const emergency = EMERGENCY_KW.some((k) => text.includes(k));

  if (type === "daily_care") {
    return {
      question_type: "daily_care",
      urgency: "none",
      is_high_risk: false,
      answer:
        "【日常养护参考｜MOCK 模式】\n" +
        "关于你的养护问题，通用建议如下：保持环境清洁与适宜温湿度，提供符合品种需求的高蛋白食物与清洁饮水，" +
        "每天保证一定的活动与互动时间。\n\n" +
        "（当前为无大模型 Key 的演示回答。配置 DASHSCOPE_API_KEY 后将由通义千问真实作答。）",
    };
  }

  if (type === "behavior_anomaly") {
    return {
      question_type: "behavior_anomaly",
      urgency: "none",
      is_high_risk: false,
      answer:
        "【值得留意｜MOCK 模式】\n" +
        "你描述的这些变化，对雪貂等哺乳异宠来说有时可能是早期健康信号（例如掉毛/亢奋需警惕肾上腺相关问题）。" +
        "建议先观察记录变化的频率和程度，若持续或加重，择期咨询能看异宠的兽医。\n\n" +
        "（当前为演示回答，真实判断以配置大模型后为准。）",
    };
  }

  return {
    question_type: "symptom_disease",
    urgency: emergency ? "emergency" : "see_vet",
    is_high_risk: emergency,
    answer:
      (emergency
        ? "**请立即就医**\n\n你描述的情况可能属于紧急状况，建议尽快带它去能看异宠的宠物医院。你可以使用页面下方的「资源地图」查找附近医院。\n\n"
        : "【安全参考｜MOCK 模式】\n你描述的症状建议尽快就医评估。\n\n") +
      "可能性参考（不构成确诊）：需结合更多信息判断。\n" +
      "家庭可做：保持安静、注意保暖与补水，避免自行用药。\n\n" +
      "本回答为 AI 辅助参考，不替代执业兽医诊断。\n" +
      "（当前为无大模型 Key 的演示回答。）",
  };
}

export const mockProvider: LLMProvider = {
  name: "mock",
  async *streamAnswer(req: ChatRequest): AsyncGenerator<string, AgentResult, void> {
    const result = buildAnswer(req.userText);
    // 按标点切块，模拟打字机流式
    const chunks = result.answer.match(/[\s\S]{1,12}/g) ?? [result.answer];
    for (const c of chunks) {
      yield c;
    }
    return result;
  },
  async embed() {
    return null; // mock 不产生向量，RAG 自动跳过
  },
};
