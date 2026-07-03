import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { petUpdateSchema } from "@/lib/validators";

async function ensureOwned(uid: string, id: string) {
  const pet = await prisma.pet.findUnique({ where: { id } });
  if (!pet || pet.userId !== uid) return null;
  return pet;
}

// 更新宠物档案
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const uid = await requireUserId();
    const owned = await ensureOwned(uid, params.id);
    if (!owned) return fail("宠物不存在", 404);

    const data = petUpdateSchema.parse(await req.json());
    const pet = await prisma.pet.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.species !== undefined ? { species: data.species } : {}),
        ...(data.ageMonths !== undefined ? { ageMonths: data.ageMonths } : {}),
        ...(data.sex !== undefined ? { sex: data.sex } : {}),
        ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
      },
    });
    return ok({ pet });
  } catch (e) {
    return handleError(e);
  }
}

// 删除宠物（关联会话的 petId 置空，历史对话不丢）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const uid = await requireUserId();
    const owned = await ensureOwned(uid, params.id);
    if (!owned) return fail("宠物不存在", 404);
    await prisma.pet.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
