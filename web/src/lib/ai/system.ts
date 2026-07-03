import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * 主体 Agent 的基础控制 Prompt。
 *
 * Markdown 作为唯一事实源放在 prompts/main-system.md，避免把长提示词混入业务代码。
 * chat API 使用 Node.js runtime，因此可在服务端安全读取；内容不会下发给浏览器。
 */
const promptPath = path.join(
  process.cwd(),
  "src",
  "lib",
  "ai",
  "prompts",
  "main-system.md"
);

export const MAIN_SYSTEM_PROMPT = readFileSync(promptPath, "utf8").trim();
