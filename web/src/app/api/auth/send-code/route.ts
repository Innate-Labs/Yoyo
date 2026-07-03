import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { phoneSchema } from "@/lib/validators";
import { generateCode, sendSms, smsProviderName } from "@/lib/sms";

export async function POST(req: Request) {
  try {
    const { phone } = await req.json();
    const p = phoneSchema.parse(phone);

    // 简单限频：60 秒内不重复下发
    const recent = await prisma.smsCode.findFirst({
      where: { phone: p, createdAt: { gt: new Date(Date.now() - 60 * 1000) } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) return fail("验证码发送过于频繁，请稍后再试", 429);

    const code = generateCode();
    await prisma.smsCode.create({
      data: { phone: p, code, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });

    const sent = await sendSms(p, code);
    if (!sent) return fail("验证码发送失败，请稍后重试", 502);

    // mock 模式把提示带回前端，方便开发；真实模式不回传验证码
    return ok({
      sent: true,
      mock: smsProviderName() === "mock",
      hint: smsProviderName() === "mock" ? "开发模式：验证码为 000000" : undefined,
    });
  } catch (e) {
    return handleError(e);
  }
}
