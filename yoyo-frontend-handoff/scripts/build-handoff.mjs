import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const sourcePath = path.join(rootDir, "source", "yoyo-prototype-final.html");

const source = await readFile(sourcePath, "utf8");
const styleMatch = source.match(/<style>([\s\S]*?)<\/style>/);
const scriptMatch = source.match(/<script>([\s\S]*?)<\/script>/);

if (!styleMatch || !scriptMatch) {
  throw new Error("Cannot find inline <style> or <script> in prototype source.");
}

function formatCss(css) {
  let output = "";
  let indent = 0;
  let quote = null;

  for (let index = 0; index < css.length; index += 1) {
    const character = css[index];
    const previous = css[index - 1];

    if (quote) {
      output += character;
      if (character === quote && previous !== "\\") quote = null;
      continue;
    }

    if (character === "'" || character === '"') {
      quote = character;
      output += character;
      continue;
    }

    if (character === "{") {
      indent += 1;
      output += " {\n" + "  ".repeat(indent);
      continue;
    }

    if (character === "}") {
      indent = Math.max(0, indent - 1);
      output = output.trimEnd();
      output += "\n" + "  ".repeat(indent) + "}\n" + "  ".repeat(indent);
      continue;
    }

    if (character === ";") {
      output += ";\n" + "  ".repeat(indent);
      continue;
    }

    output += character;
  }

  return output
    .replace(/^[ \t]+/gm, (spaces) => spaces)
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

function prepareAppScript(script) {
  const withoutMockConstants = script
    .replace(/^\s*const SPECIES=.*$/m, "")
    .replace(/^\s*const EMERGENCY=.*$/m, "")
    .replace(/^\s*const VETS=.*$/m, "")
    .replace(/^\s*function answerFor\(text\).*$/m, "");

  return `/**
 * Yoyo UI controller.
 *
 * Integration rule:
 * - Keep DOM structure and visual behavior stable.
 * - Replace data access through js/api.js.
 * - Do not place secrets or production URLs in this file.
 */
const { SPECIES, SUGGEST, VETS, answerFor } = window.YoyoAPI.mock;

${withoutMockConstants.trim()}
`;
}

const indexHtml = source
  .replace(
    /<style>[\s\S]*?<\/style>/,
    '<link rel="stylesheet" href="./styles/styles.css">'
  )
  .replace(
    /<script>[\s\S]*?<\/script>/,
    [
      '<script src="./js/config.js"></script>',
      '<script src="./js/api.js"></script>',
      '<script src="./js/app.js"></script>',
    ].join("\n  ")
  )
  .replace("./最新版视频.mp4", "./assets/video/hero-yoyo.mp4")
  .replace(
    "<head>",
    "<head>\n  <!-- Integration-ready split build. Source snapshot: source/yoyo-prototype-final.html -->"
  );

await writeFile(path.join(rootDir, "index.html"), indexHtml, "utf8");
await writeFile(
  path.join(rootDir, "styles", "styles.css"),
  `/* Yoyo final visual baseline. Do not redesign during backend integration. */\n${formatCss(styleMatch[1])}`,
  "utf8"
);
await writeFile(
  path.join(rootDir, "js", "app.js"),
  prepareAppScript(scriptMatch[1]),
  "utf8"
);

console.log("Built index.html, styles/styles.css, and js/app.js");
