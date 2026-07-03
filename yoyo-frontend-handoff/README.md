# Yoyo 前端交付包

这是 Yoyo 异宠 AI 项目的最终前端原型交付包，供后端团队集成使用。

本目录同时包含：

- 可直接运行的拆分版前端；
- 最终原型的只读基线快照；
- 最新首页视频与设计参考；
- API 协议、Mock 说明、Claude Code 指南和集成检查清单。

## 快速预览

可以直接打开 `index.html`。推荐使用本地静态服务器：

```bash
cd yoyo-frontend-handoff
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`。

演示手机号已预填，验证码为：

```text
000000
```

## 目录结构

```text
yoyo-frontend-handoff/
├── index.html                         # 拆分版入口
├── styles/
│   └── styles.css                    # 最终视觉样式
├── js/
│   ├── config.js                     # API 地址与 Mock 开关
│   ├── api.js                        # 后端适配边界
│   └── app.js                        # UI 与交互控制
├── assets/
│   ├── video/
│   │   └── hero-yoyo.mp4             # 首页运行素材
│   └── reference/
│       └── design-reference.jpg      # 非运行依赖，仅供视觉对照
├── source/
│   └── yoyo-prototype-final.html     # 最终单文件原型快照
├── scripts/
│   ├── build-handoff.mjs             # 从快照重建拆分版
│   └── validate-handoff.mjs          # 交付包检查
├── API-INTEGRATION.md
├── CLAUDE.md
├── INTEGRATION_CHECKLIST.md
├── MOCK-DATA.md
├── manifest.json
└── package.json
```

## 当前状态

视觉和交互已经定稿，但以下内容仍是 Mock：

- 短信验证码与登录；
- 用户资料持久化；
- 宠物资料与宠物照片存储；
- 会话历史；
- AI 回答与风险判断；
- 附近医院数据。

刷新页面后，内存中的用户、宠物和会话数据会重置。

## 集成原则

1. 后端接入集中通过 `js/api.js` 完成。
2. 不要在 `app.js` 中写死生产地址、令牌或密钥。
3. 不要为了接接口重做页面结构、配色或交互动效。
4. 前后端共同遵守 `API-INTEGRATION.md` 中的数据结构。
5. 宠物最多 5 只的限制必须由后端再次校验。
6. AI 高危判断不能只依赖前端关键词。

## 构建与检查

```bash
npm run build
npm run check
```

`build` 会从最终快照重新提取 HTML、CSS 和 UI 脚本。`check` 会验证文件、语法、视频路径和关键交互是否完整。

## 文件职责

- `source/yoyo-prototype-final.html` 是视觉基线，不应直接加入业务逻辑。
- `index.html` 是后端集成时使用的页面入口。
- `styles/styles.css` 原则上只修复兼容问题，不做视觉重设计。
- `js/app.js` 负责界面状态与 DOM 更新。
- `js/api.js` 负责 HTTP、上传和后端数据适配。
- `js/config.js` 负责运行环境配置。

完整集成步骤参见 `INTEGRATION_CHECKLIST.md`。
