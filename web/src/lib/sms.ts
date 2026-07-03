// 短信发送适配层。默认 mock：验证码固定 000000，且不真的发短信（开发期可直接用）。
// 配置 SMS_PROVIDER=aliyun 且填齐阿里云参数后走真实发送。

export const MOCK_CODE = "000000";

export function smsProviderName() {
  const p = (process.env.SMS_PROVIDER || "mock").toLowerCase();
  if (p === "aliyun" && process.env.ALIYUN_SMS_ACCESS_KEY_ID) return "aliyun";
  return "mock";
}

/** 生成验证码：mock 模式返回固定码，真实模式返回随机 6 位。 */
export function generateCode(): string {
  if (smsProviderName() === "mock") return MOCK_CODE;
  // 真实模式随机码（避免 Math.random 的可复现问题在服务端无影响）
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 发送短信。mock 模式仅打印到日志。返回是否成功。 */
export async function sendSms(phone: string, code: string): Promise<boolean> {
  if (smsProviderName() === "mock") {
    console.log(`[SMS MOCK] 向 ${phone} 发送验证码：${code}（开发期请直接输入 ${MOCK_CODE}）`);
    return true;
  }
  return sendAliyun(phone, code);
}

// 阿里云短信最简实现（RPC 风格签名）。生产可替换为官方 SDK。
async function sendAliyun(phone: string, code: string): Promise<boolean> {
  const crypto = await import("node:crypto");
  const AccessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID!;
  const AccessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET!;
  const SignName = process.env.ALIYUN_SMS_SIGN_NAME!;
  const TemplateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE!;

  const params: Record<string, string> = {
    AccessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: phone,
    RegionId: "cn-hangzhou",
    SignName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    TemplateCode,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25",
  };

  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${encode(k)}=${encode(params[k])}`)
    .join("&");
  const stringToSign = `GET&${encode("/")}&${encode(sorted)}`;
  const signature = crypto
    .createHmac("sha1", `${AccessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");

  const url = `https://dysmsapi.aliyuncs.com/?Signature=${encode(signature)}&${sorted}`;
  try {
    const resp = await fetch(url);
    const json = await resp.json();
    if (json.Code !== "OK") {
      console.error("[SMS ALIYUN] 发送失败：", json.Code, json.Message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[SMS ALIYUN] 异常：", e);
    return false;
  }
}

function encode(s: string) {
  return encodeURIComponent(s)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}
