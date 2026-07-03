# Mock 数据与替换位置

## 当前 Mock 范围

### 登录

- 演示验证码固定为 `000000`
- 位置：`js/app.js` 中的 `App.sendCode`、`App.login`
- 目标：替换为 `YoyoAPI.services.auth`

### 用户

- 用户信息保存在内存 `state.user`
- 位置：`App.renderUser`、`App.saveProfile`
- 目标：页面进入时请求 `/api/me`，保存时调用 `PATCH /api/me`

### 宠物

- 宠物保存在内存 `state.pets`
- 刷新页面即丢失
- 宠物照片使用 `URL.createObjectURL`
- 目标：先上传照片，再保存后端返回的 `photoUrl`

### 会话

- 历史会话保存在内存 `state.chats`
- 目标：替换为会话列表、详情和消息接口

### AI 回答

- 位置：`YoyoAPI.mock.answerFor`
- 当前仅通过关键词生成固定回答
- 目标：替换为后端 AI 接口或 SSE 流
- 高危判断必须由后端执行，不能信任前端结果

### 医院

- 位置：`YoyoAPI.mock.VETS`
- 当前为示例名称、地址和电话
- 目标：替换为真实附近医院服务

## Mock 开关

`js/config.js` 中：

```js
window.__YOYO_CONFIG__ = {
  apiBaseUrl: "",
  useMocks: true,
  requestTimeoutMs: 15000,
};
```

后端接入期间可以逐模块替换，不要求一次全部关闭 Mock。建议每完成一个模块，就从 `app.js` 中移除相应的本地校验或固定数据。

## 禁止进入生产环境的内容

- 固定验证码 `000000`
- 示例医院信息
- 前端关键词医疗判断
- Object URL 作为持久化图片地址
- 明文模型密钥或后端密钥
- 仅靠前端执行的宠物数量限制
