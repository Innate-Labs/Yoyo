# 异宠AI问答（Web）

聚焦哺乳异宠（雪貂为主）的 AI 问答工具。核心：AI 问答（三层判断 + 安全话术 + 高危提示）+ 资源地图。
技术栈：Next.js 14（App Router，全栈）+ PostgreSQL + Prisma + Tailwind。

前端已替换为 Yoyo 静态交付版，运行文件位于 `public/yoyo/`；Next.js 继续承载 API、鉴权、数据库和 AI Agent。

> AI 回答为辅助参考，不替代执业兽医诊断。

## 功能概览

- 手机号验证码注册登录（短信可 mock，开发期验证码固定 `000000`）
- 多只宠物档案（品种/年龄/性别），对话自动注入上下文
- AI 问答：类 ChatGPT 对话、连续追问、SSE 流式、图片上传辅助描述
- 三层判断（日常养护 / 行为外观异常 / 症状疾病）+ 安全话术 + 高危"请立即就医"醒目提示
- **场景 Skill 增强**：按意图路由到「饲养顾问 / 行为分析 / 医疗边界急症分级」三个 Skill，医疗红线关键词预检+模型判断双保险，医疗四档（绿/黄/橙/红）映射 urgency
- 高危场景弹出资源地图（高德检索附近宠物医院；无 Key 降级为示例数据 + 手动检索）
- 历史会话列表（可回顾 / 重命名 / 删除）
- 点赞点踩反馈；PRD 4.3 埋点事件落库
- RAG：保留接口、当前为空实现（不依赖向量库；未来可重启）

## 快速开始（本地）

### 1. 准备 PostgreSQL

macOS + Homebrew（本项目采用）：

```bash
brew install postgresql@16
brew services start postgresql@16
createdb exotic_pet_ai          # 超级用户默认=你的 mac 用户名，无密码
```

（不再需要 pgvector——RAG 已改为场景 Skill。）

### 2. 配置环境变量

```bash
cp .env.example .env
```

确认 `DATABASE_URL`（形如 `postgresql://<你的用户名>@localhost:5432/exotic_pet_ai?schema=public`）与 `AUTH_SECRET`。其余 Key 留空即自动降级为 mock（主流程仍可跑通）。

### 3. 建表

```bash
npm install
npm run prisma:generate
npm run prisma:push      # 建表
npm run db:seed          # 占位（RAG 为空实现，无需预置数据）
```

### 4. 启动

```bash
npm run dev
# 打开 http://localhost:3000（自动进入 /yoyo/index.html）
```

开发期登录：任意手机号 → 点"获取验证码" → 输入 `000000` → 登录。

## 真实接入（拿到 Key 后填 `.env` 即切换）

| 能力 | 变量 | 说明 |
|---|---|---|
| 大模型 | `LLM_PROVIDER=qwen` + `DASHSCOPE_API_KEY` | 通义千问 Qwen-VL（多模态看图），OpenAI 兼容端点。当前 .env 默认 `mock`，拿到 Key 后改 `qwen` 并填 Key |
| 短信 | `SMS_PROVIDER=aliyun` + 阿里云四项 | 真实下发验证码 |
| 地图 | `AMAP_WEB_SERVICE_KEY` / `NEXT_PUBLIC_AMAP_JS_KEY` | 高德地点检索 |

模型层是可切换适配层（`src/lib/ai/providers/`），以后可加豆包/GLM 等。

## 场景 Skill（AI 增强的核心）

按用户意图路由到三个 Skill 之一（不全塞，省 token）：
- **饲养顾问** → 日常养护类；**行为分析** → 行为外观异常类；**医疗边界急症分级** → 症状疾病类
- 医疗红线双保险：`skills/index.ts` 的关键词预检 + prompt 内模型判断；命中一律强制走医疗 Skill
- 医疗四档 绿/黄/橙/红 → urgency：绿黄=observe、橙=see_vet、红=emergency（触发高危+资源地图）
- 浓缩片段：`src/lib/ai/skills/{feeding,behavior,medical}.ts`；原文归档在项目根 `skills/`

## 冒烟测试

Skill 路由 + 红线双保险 + 三层判断/高危，离线自检（无需数据库，33 项）：

```bash
npm run smoke:ai
```

## 目录结构

```
src/
  app/
    page.tsx                      跳转到 Yoyo 前端
    api/                          路由：auth / pets / conversations / chat / upload / messages / vets
  lib/
    ai/                           主体 System Prompt + provider + 三层解析 + skills + rag(空实现)
    db.ts session.ts sms.ts events.ts validators.ts api.ts
public/yoyo/                      Yoyo HTML / CSS / JS / 视频前端
prisma/  schema.prisma / seed.ts
```

## 注意与后续（继承 PRD TBD）

- 安全层评测集阈值/漏报率：TBD，待与兽医专家共建。
- Skill 片段是原文的提炼，可随时按 `skills/` 原文迭代。
- 上线前需补：隐私政策/用户协议、备案、图片内容审核。
- 高德 POI 无"异宠友好"标签，MVP 只搜宠物医院并附致电确认提示。
