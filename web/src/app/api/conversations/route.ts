import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { requireUserId } from "@/lib/session";

// 历史会话列表（侧边栏，按更新时间倒序）
export async function GET() {
  try {
    const uid = await requireUserId();
    const conversations = await prisma.conversation.findMany({
      where: { userId: uid },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        pet: { select: { id: true, name: true, species: true } },
      },
    });
    return ok({ conversations });
  } catch (e) {
    return handleError(e);
  }
}

// 新建会话（可选绑定当前宠物）
export async function POST(req: Request) {
  try {
    const uid = await requireUserId();
    const body = await req.json().catch(() => ({}));
    const petId: string | undefined = body.petId || undefined;

    // 校验 petId 归属
    if (petId) {
      const pet = await prisma.pet.findUnique({ where: { id: petId } });
      if (!pet || pet.userId !== uid) {
        return ok({ conversation: await createConv(uid, undefined) });
      }
    }
    return ok({ conversation: await createConv(uid, petId) });
  } catch (e) {
    return handleError(e);
  }
}

async function createConv(userId: string, petId?: string) {
  return prisma.conversation.create({
    data: { userId, petId: petId ?? null },
    select: { id: true, title: true, petId: true, updatedAt: true },
  });
}
