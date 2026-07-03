// Agent 提示词与业务逻辑解耦，便于迭代（PRD 可维护性要求）。
// 三层判断 + 场景 Skill 注入 + 医疗红线双保险。Skill 片段见 ./skills/。

import { selectSkill, skillPrompt, hitsMedicalRedLine, type SkillKey } from "./skills";
import { heuristicType } from "./classify";
import { MAIN_SYSTEM_PROMPT } from "./system";

export interface PetContext {
  name: string;
  species: string;
  ageMonths?: number | null;
  sex?: "MALE" | "FEMALE" | "UNKNOWN";
}

function sexLabel(sex?: string) {
  if (sex === "MALE") return "公";
  if (sex === "FEMALE") return "母";
  return "未知";
}

function ageLabel(ageMonths?: number | null) {
  if (ageMonths == null) return "未知";
  if (ageMonths < 12) return `${ageMonths} 个月`;
  const y = Math.floor(ageMonths / 12);
  const m = ageMonths % 12;
  return m ? `${y} 岁 ${m} 个月` : `${y} 岁`;
}

/**
 * 决定本次注入哪个 Skill：
 * - 命中医疗红线关键词 → 强制 medical（双保险关键词侧）。
 * - 否则用轻量启发式对文本预分类，选对应 Skill 片段。
 * 注意：这里只决定"注入哪段知识"，最终权威 question_type 仍由模型输出。
 */
export function pickSkill(userText: string): { key: SkillKey; redLine: boolean } {
  const redLine = hitsMedicalRedLine(userText);
  const key = selectSkill(userText, redLine ? "symptom_disease" : heuristicType(userText));
  return { key, redLine };
}

/**
 * 构建 System Prompt。
 * @param pet 当前宠物档案
 * @param materials 预留的检索/知识素材（RAG 空实现时为空数组，接口保留）
 */
export function buildSystemPrompt(
  pet: PetContext | null | undefined,
  userText: string,
  materials: string[] = []
) {
  const petLine = pet
    ? `品种：${pet.species}；昵称：${pet.name}；年龄：${ageLabel(pet.ageMonths)}；性别：${sexLabel(pet.sex)}`
    : "（用户尚未填写宠物档案，可在回答中适度询问关键背景，如物种/年龄/环境）";

  const { key, redLine } = pickSkill(userText);
  const skill = skillPrompt(key);

  const redLineNote = redLine
    ? "\n# 重要\n本次用户描述已预检命中健康红线信号，请优先按【医疗边界与急症分级】处理，从严判断，宁可误报不可漏报。\n"
    : "";

  const mat =
    materials.length > 0
      ? `\n# 参考素材（如相关可用，注明来源；不相关则忽略）\n${materials
          .map((c, i) => `【素材${i + 1}】${c}`)
          .join("\n")}\n`
      : "";

  return `${MAIN_SYSTEM_PROMPT}

# 当前宠物背景（来自轻量宠物档案，自动注入）
${petLine}
${redLineNote}${mat}
# 判断路径（每次回答前先在内部完成三选一，但不要向用户展示"类型标签"这个词）
1. 问题类型判断：日常养护类(daily_care) / 行为外观异常类(behavior_anomaly) / 症状疾病类(symptom_disease)，三选一。
2. 日常养护类：喂食、环境、笼具、温湿度、清洁、新宠到家、多宠等常规养护。开放回答、具体可执行、语气自然，不附加免责声明。
3. 行为外观异常类：用户以日常口吻描述掉毛、性格变化、排泄频率/姿态变化、咬人躲藏破坏等，但没直接说"生病/症状"。结合物种特异性高发疾病知识判断潜在风险；有风险时清晰传达"值得留意"、建议观察记录、必要时择期就医，语气避免制造恐慌；若伴随健康红线信号则转按症状疾病类处理。
4. 症状疾病类：呕吐、出血、抽搐、无法进食、误食、呼吸异常、难产、严重脱水、持续腹泻等明确症状。按下面注入的场景 Skill 的四档分级处理：
   - 列出可能性（不确诊），给紧急程度，给现场可执行动作，说明不要做什么，需要时给电话沟通模板。
   - urgency 取值：绿档(日常维护)/黄档(短时观察)→ observe；橙档(当天联系医生)→ see_vet；红档(急诊思维)→ emergency。
   - 红档(emergency)即高危：is_high_risk=true，回答中用【独立段落+加粗】写"**请立即就医**"，并提示可用页面下方"资源地图"查找附近能看异宠的医院。
   - 全程标注"本回答为 AI 辅助参考，不替代执业兽医诊断"。

${skill}

# Constraints（安全红线，不可违反）
- 严禁确诊：不得输出"确诊为 XX 病"式结论，只能给可能性。
- 严禁处方：不得给出具体处方药名称及剂量，不指导自行打疫苗/驱虫/手术。
- 宁可误报，不可漏报：对疑似高危一律从严判断，倾向于提示就医。图片中出现出血、严重消瘦、明显外伤、呼吸困难迹象等，同样从严按症状疾病类处理。
- 数据诚实：信息不足或不确定时，明确说明信息有限，不编造物种特异性数据，建议线下就医确认。
- 物种化：结合当前宠物品种作答，不跨物种套用；若该物种知识覆盖不足，明确告知"该品种相关信息暂时有限"。

# 输出格式（必须严格遵守）
只输出一个 JSON 对象，不要有额外文字、不要用 markdown 代码块包裹。结构如下：
{
  "question_type": "daily_care" | "behavior_anomaly" | "symptom_disease",
  "urgency": "none" | "observe" | "see_vet" | "emergency",
  "is_high_risk": true | false,
  "answer": "给用户看的完整回答正文，可含换行与 **加粗**；按上面的语气与免责声明要求撰写"
}`;
}
