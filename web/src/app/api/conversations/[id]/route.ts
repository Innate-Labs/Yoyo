import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { requireUserId } from "@/lib/session";

async function ensureOwned(uid: string, id: string) {
  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv || conv.userId !== uid) return null;
  return conv;
}

// 获取单个会话（含全部消息，用于回顾历史）
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const uid = await requireUserId();
    const conv = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        pet: { select: { id: true, name: true, species: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { feedbacks: { where: { userId: uid }, select: { kind: true } } },
        },
      },
    });
    if (!conv || conv.userId !== uid) return fail("会话不存在", 404);
    return ok({ conversation: conv });
  } catch (e) {
    return handleError(e);
  }
}

// 重命名会话
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const uid = await requireUserId();
    if (!(await ensureOwned(uid, params.id))) return fail("会话不存在", 404);
    const { title } = await req.json();
    const t = String(title ?? "").trim().slice(0, 40);
    if (!t) return fail("标题不能为空", 400);
    const conv = await prisma.conversation.update({
      where: { id: params.id },
      data: { title: t },
      select: { id: true, title: true },
    });
    return ok({ conversation: conv });
  } catch (e) {
    return handleError(e);
  }
}

// 删除会话
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const uid = await requireUserId();
    if (!(await ensureOwned(uid, params.id))) return fail("会话不存在", 404);
    await prisma.conversation.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
