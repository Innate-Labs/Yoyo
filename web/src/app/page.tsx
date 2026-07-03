import { redirect } from "next/navigation";
import { getUserId } from "@/lib/session";
import { prisma } from "@/lib/db";

export default async function Home() {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const petCount = await prisma.pet.count({ where: { userId: uid } });
  redirect(petCount > 0 ? "/chat" : "/onboarding");
}
