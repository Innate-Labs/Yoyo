import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const uid = await getUserId();
    if (!uid) return ok({ user: null });
    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: { id: true, phone: true, pets: true },
    });
    return ok({ user });
  } catch (e) {
    return handleError(e);
  }
}
