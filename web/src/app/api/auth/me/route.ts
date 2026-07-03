import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const uid = await getUserId();
    if (!uid) return ok({ user: null });
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, phone: true, name: true, pets: true },
    });
    return ok({ user });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const uid = await getUserId();
    if (!uid) return fail("未登录", 401);
    const body = await req.json();
    const name = String(body.name ?? "").trim().slice(0, 30);
    if (!name) return fail("昵称不能为空", 400);
    const user = await prisma.user.update({
      where: { id: uid },
      data: { name },
      select: { id: true, phone: true, name: true },
    });
    return ok({ user });
  } catch (e) {
    return handleError(e);
  }
}
