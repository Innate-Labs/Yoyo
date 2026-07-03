# Yoyo API Integration Contract

本文档描述前端原型期望的后端接口。路径可以按现有后端调整，但字段语义应保持一致，并同步修改 `js/api.js`。

## 通用约定

- API 前缀：`/api`
- 数据格式：JSON，图片上传除外
- 身份认证：推荐 HTTP-only Session Cookie
- 时间格式：ISO 8601 UTC 字符串
- 错误格式：

```json
{
  "code": "PET_LIMIT_REACHED",
  "message": "目前仅支持添加 5 只宠物",
  "requestId": "req_xxx"
}
```

建议状态码：

- `400` 参数错误
- `401` 未登录
- `403` 无权限
- `404` 资源不存在
- `409` 状态冲突或宠物数量已满
- `413` 文件过大
- `422` 文件类型或业务校验失败
- `429` 请求过于频繁
- `500` 服务异常

## 1. 登录与会话

### `POST /api/auth/send-code`

请求：

```json
{ "phone": "18800000000" }
```

响应：

```json
{ "sent": true, "expiresIn": 60 }
```

### `POST /api/auth/login`

请求：

```json
{ "phone": "18800000000", "code": "123456" }
```

响应：

```json
{
  "user": {
    "id": "usr_01",
    "name": "异宠用户",
    "phoneMasked": "188****0000"
  }
}
```

### `POST /api/auth/logout`

成功返回 `204 No Content`。

## 2. 当前用户

### `GET /api/me`

```json
{
  "id": "usr_01",
  "name": "异宠用户",
  "phone": "18800000000",
  "settings": {
    "highRiskAlert": true,
    "locationEnabled": true
  }
}
```

### `PATCH /api/me`

```json
{
  "name": "Yoyo 用户",
  "phone": "18800000000",
  "settings": {
    "highRiskAlert": true,
    "locationEnabled": false
  }
}
```

## 3. 宠物

宠物最多 5 只。该约束必须由后端校验。

宠物对象：

```json
{
  "id": "pet_01",
  "name": "十一",
  "species": "雪貂",
  "ageLabel": "8 个月",
  "sex": "公",
  "photoUrl": "https://cdn.example.com/pets/pet_01.webp",
  "createdAt": "2026-07-02T12:00:00Z",
  "updatedAt": "2026-07-02T12:00:00Z"
}
```

接口：

- `GET /api/pets`
- `POST /api/pets`
- `PATCH /api/pets/:petId`
- `DELETE /api/pets/:petId`

创建与更新请求不应接受客户端传入的 `userId`。

## 4. 图片上传

### `POST /api/uploads/pet-photo`

- Content-Type：`multipart/form-data`
- 字段：`photo`
- 类型：JPEG、PNG、WebP
- 最大：10MB

响应：

```json
{
  "url": "https://cdn.example.com/pets/upload_xxx.webp",
  "width": 1200,
  "height": 1200,
  "mimeType": "image/webp"
}
```

### `POST /api/uploads/chat-image`

- 字段：`image`
- 其余规则同上

生产环境应进行 MIME 检测、病毒扫描、重新编码和 EXIF 清理。

## 5. 会话与消息

### `GET /api/conversations`

```json
{
  "items": [
    {
      "id": "conv_01",
      "title": "最近老掉毛",
      "updatedAt": "2026-07-02T12:00:00Z"
    }
  ]
}
```

### `POST /api/conversations`

```json
{ "title": "关于十一的问题" }
```

### `GET /api/conversations/:conversationId`

返回会话和完整消息列表。

### `POST /api/conversations/:conversationId/messages`

一次只能关联一只宠物。

```json
{
  "content": "最近老掉毛，还爱咬东西",
  "petId": "pet_01",
  "imageUrl": null
}
```

普通 JSON 响应示例：

```json
{
  "userMessage": {
    "id": "msg_user_01",
    "role": "user",
    "content": "最近老掉毛，还爱咬东西",
    "petId": "pet_01"
  },
  "assistantMessage": {
    "id": "msg_ai_01",
    "role": "assistant",
    "content": "这些变化值得留意……",
    "riskLevel": "medium",
    "isHighRisk": false
  }
}
```

若使用流式响应，推荐 SSE：

```text
event: delta
data: {"content":"这些变化"}

event: metadata
data: {"riskLevel":"medium","isHighRisk":false}

event: done
data: {"messageId":"msg_ai_01"}
```

风险等级建议：

- `low`：日常养护
- `medium`：行为或身体异常，建议观察或预约
- `high`：明确紧急信号，立即就医

### `DELETE /api/conversations/:conversationId`

成功返回 `204 No Content`。

## 6. 附近医院

### `GET /api/vets/nearby?lat=31.2304&lng=121.4737&limit=10`

```json
{
  "items": [
    {
      "id": "vet_01",
      "name": "毛球动物医院 · 中心店",
      "distanceMeters": 800,
      "address": "示例市元气路 18 号",
      "phone": "010-00000000",
      "supportsExoticPets": null
    }
  ]
}
```

前端必须继续展示“出发前电话确认能否接诊异宠”的提示。

## 7. 前端状态映射

后端数据接入后，建议保留以下前端状态语义：

```text
state.user        当前用户
state.pets        当前用户的宠物列表
state.selected    当前选择的宠物索引或改为 selectedPetId
state.chats       会话摘要
state.active      当前会话 ID
state.streaming   AI 是否正在输出
```

建议把 `state.selected` 改为 `selectedPetId`，避免列表排序后关联错误。
