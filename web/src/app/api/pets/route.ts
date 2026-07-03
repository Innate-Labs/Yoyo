import { prisma } from "@/lib/db";
import { ok, handleError } from "@/lib/api";
import { requireUserId } from "@/lib/session";
import { petCreateSchema } from "@/lib/validators";
import { track } from "@/lib/events";

// 列出当前用户的所有宠物（多只）
export async function GET() {
  try {
    const uid = await requireUserId();
    const pets = await prisma.pet.findMany({
      where: { userId: uid },
      orderBy: { createdAt: "asc" },
    });
    return ok({ pets });
  } catch (e) {
    return handleError(e);
  }
}

// 新增一只宠物
export async function POST(req: Request) {
  try {
    const uid = await requireUserId();
    const petCount = await prisma.pet.count({ where: { userId: uid } });
    if (petCount >= 5) {
      const err = new Error("目前仅支持添加 5 只宠物") as Error & { status?: number };
      err.status = 409;
      throw err;
    }
    const body = await req.json();
    const data = petCreateSchema.parse(body);
    const pet = await prisma.pet.create({
      data: {
        userId: uid,
        name: data.name,
        species: data.species,
        ageMonths: data.ageMonths ?? null,
        sex: data.sex ?? "UNKNOWN",
        photoUrl: data.photoUrl ?? null,
      },
    });
    await track("宠物档案_完成", uid, { species: pet.species, petId: pet.id });
    return ok({ pet });
  } catch (e) {
    return handleError(e);
  }
}
