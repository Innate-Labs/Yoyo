import { access, readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const requiredFiles = [
  "index.html",
  "styles/styles.css",
  "js/config.js",
  "js/api.js",
  "js/app.js",
  "assets/video/hero-yoyo.mp4",
  "source/yoyo-prototype-final.html",
  "README.md",
  "CLAUDE.md",
  "API-INTEGRATION.md",
  "MOCK-DATA.md",
  "INTEGRATION_CHECKLIST.md",
  "manifest.json",
];

for (const relativePath of requiredFiles) {
  await access(path.join(rootDir, relativePath));
}

const indexHtml = await readFile(path.join(rootDir, "index.html"), "utf8");
const configScript = await readFile(path.join(rootDir, "js/config.js"), "utf8");
const apiScript = await readFile(path.join(rootDir, "js/api.js"), "utf8");
const appScript = await readFile(path.join(rootDir, "js/app.js"), "utf8");
const css = await readFile(path.join(rootDir, "styles/styles.css"), "utf8");
const video = await stat(path.join(rootDir, "assets/video/hero-yoyo.mp4"));

new Function(configScript);
new Function(apiScript);
new Function(appScript);

const assertions = {
  cssLinked: indexHtml.includes("./styles/styles.css"),
  configLinked: indexHtml.includes("./js/config.js"),
  apiLinked: indexHtml.includes("./js/api.js"),
  appLinked: indexHtml.includes("./js/app.js"),
  videoLinked: indexHtml.includes("./assets/video/hero-yoyo.mp4"),
  noChineseRuntimeVideoPath: !indexHtml.includes("最新版视频.mp4"),
  yoyoBrandPresent: indexHtml.includes("Hi, I'm Yoyo"),
  finalPromptPresent: indexHtml.includes("今天想问<span>什么小问题？</span>"),
  petHoverActionsPresent:
    appScript.includes("App.editPet") && appScript.includes("App.askPet"),
  petLimitPresent: appScript.includes("state.pets.length>=5"),
  apiBoundaryPresent: apiScript.includes("window.YoyoAPI"),
  cssPresent: css.length > 5000,
  videoPresent: video.size > 1_000_000,
};

const failures = Object.entries(assertions)
  .filter(([, passed]) => !passed)
  .map(([name]) => name);

if (failures.length) {
  console.error("Validation failed:", failures.join(", "));
  process.exit(1);
}

console.log("Yoyo handoff validation passed.");
console.log(`Checked ${requiredFiles.length} required files.`);
console.log(`Video size: ${(video.size / 1024 / 1024).toFixed(2)} MB.`);
