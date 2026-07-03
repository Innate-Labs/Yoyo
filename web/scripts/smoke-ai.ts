// 无需数据库的 AI 冒烟测试：Skill 路由 + 医疗红线双保险 + mock 三层判断/高危。
// 用法：npx tsx scripts/smoke-ai.ts
import { mockProvider } from "../src/lib/ai/providers/mock";
import { buildSystemPrompt, pickSkill } from "../src/lib/ai/prompt";
import { hitsMedicalRedLine } from "../src/lib/ai/skills";

const PET = { name: "小雪", species: "雪貂", ageMonths: 24, sex: "MALE" as const };

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, extra = "") {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "✓" : "✗"} ${label}${ok ? "" : "  " + extra}`);
}

// ---------- 1. Skill 路由 ----------
console.log("== Skill 路由 ==");
const routeCases: { q: string; skill: string; redLine: boolean }[] = [
  { q: "雪貂一天喂几次比较好？", skill: "feeding", redLine: false },
  { q: "笼子多大合适，垫材用什么？", skill: "feeding", redLine: false },
  { q: "室温多少度合适？夏天怕不怕热", skill: "feeding", redLine: false },
  { q: "我家貂最近特别爱咬人，还老躲着不亲人", skill: "behavior", redLine: false },
  { q: "它咬笼子、乱拉乱尿怎么办", skill: "behavior", redLine: false },
  { q: "它一直在呕吐，还拉稀了", skill: "medical", redLine: true },
  { q: "我家貂突然抽搐，叫不醒", skill: "medical", redLine: true },
  { q: "难产了，好几个小时生不出来", skill: "medical", redLine: true },
  { q: "误食了一小块海绵怎么办", skill: "medical", redLine: true },
  // 行为词 + 健康红线 → 红线优先，强制 medical
  { q: "它突然攻击变重，还不吃不喝了", skill: "medical", redLine: true },
];
for (const c of routeCases) {
  const { key, redLine } = pickSkill(c.q);
  check(
    `[${key}/${redLine ? "红线" : "常规"}] ${c.q}`,
    key === c.skill && redLine === c.redLine,
    `期望 ${c.skill}/${c.redLine}`
  );
}

// ---------- 2. 医疗红线关键词覆盖 ----------
console.log("\n== 医疗红线关键词 ==");
const redOn = ["呕吐", "出血", "抽搐", "不吃不喝", "误食", "呼吸困难", "中暑", "难产"];
const redOff = ["喂食", "笼子", "垫料", "沙浴", "跑轮", "怎么养"];
for (const w of redOn) check(`命中: ${w}`, hitsMedicalRedLine(`我家宠物${w}了`), "应命中");
for (const w of redOff) check(`不命中: ${w}`, !hitsMedicalRedLine(`关于${w}的问题`), "不应命中");

// ---------- 3. system prompt 注入了对应 Skill ----------
console.log("\n== Skill 注入 system prompt ==");
const spFeeding = buildSystemPrompt(PET, "雪貂吃什么粮好？");
check("饲养场景注入饲养顾问", spFeeding.includes("当前场景：饲养顾问"));
const spBehavior = buildSystemPrompt(PET, "它老咬人不亲人");
check("行为场景注入行为分析", spBehavior.includes("当前场景：行为分析"));
const spMedical = buildSystemPrompt(PET, "它呕吐了好几次");
check("症状场景注入医疗边界", spMedical.includes("当前场景：医疗边界与急症分级"));
check("红线在 prompt 中提示", spMedical.includes("预检命中健康红线"));

// ---------- 4. mock 三层判断 + 高危（回归）----------
async function run(q: string) {
  const sys = buildSystemPrompt(PET, q);
  const gen = mockProvider.streamAnswer({ systemPrompt: sys, history: [], userText: q, userImageUrl: null });
  let r: any;
  while (true) {
    const { value, done } = await gen.next();
    if (done) { r = value; break; }
  }
  return r;
}
const mockCases = [
  { q: "雪貂一天喂几次比较好？", type: "daily_care", risk: false },
  { q: "我家貂最近老掉毛，还特别爱咬东西", type: "behavior_anomaly", risk: false },
  { q: "它一直在呕吐，还拉稀了", type: "symptom_disease", risk: false },
  { q: "我家貂突然抽搐，叫不醒", type: "symptom_disease", risk: true },
  { q: "难产了，好几个小时生不出来", type: "symptom_disease", risk: true },
];

(async () => {
  console.log("\n== mock 分类与高危（回归）==");
  for (const c of mockCases) {
    const r = await run(c.q);
    check(
      `[${r.question_type}/${r.is_high_risk ? "高危" : "普通"}] ${c.q}`,
      r.question_type === c.type && r.is_high_risk === c.risk,
      `期望 ${c.type}/${c.risk}`
    );
  }
  console.log(`\n通过 ${pass}，失败 ${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})();
