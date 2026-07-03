import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { phoneSchema, codeSchema } from "@/lib/validators";
import { createSession } from "@/lib/session";
import { track } from "@/lib/events";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const phone = phoneSchema.parse(body.phone);
    const code = codeSchema.parse(body.code);

    const record = await prisma.smsCode.findFirst({
      where: { phone, consumed: false },
      orderBy: { createdAt: "desc" },
    });
    if (!record) return fail("请先获取验证码", 400);
    if (record.expiresAt < new Date()) return fail("验证码已过期，请重新获取", 400);
    if (record.code !== code) return fail("验证码不正确", 400);

    await prisma.smsCode.update({ where: { id: record.id }, data: { consumed: true } });

    // 找到或创建用户
    const existing = await prisma.user.findUnique({ where: { phone } });
    const isNew = !existing;
    const user = existing ?? (await prisma.user.create({ data: { phone } }));

    await createSession(user.id);
    if (isNew) await track("注册_完成", user.id, { source: "web" });

    const petCount = await prisma.pet.count({ where: { userId: user.id } });
    return ok({ userId: user.id, isNew, hasPet: petCount > 0 });
  } catch (e) {
    return handleError(e);
  }
}
