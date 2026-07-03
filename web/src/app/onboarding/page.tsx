"use client";

import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { PetForm, type PetFormValue } from "@/components/PetForm";

export default function OnboardingPage() {
  const router = useRouter();

  async function create(v: PetFormValue) {
    await api("/api/pets", { method: "POST", body: JSON.stringify(v) });
    router.push("/chat");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-lg font-bold">填写宠物档案</h1>
        <p className="mt-1 text-sm text-gray-500">
          填一次，之后每次提问都会自动带上它的背景，无需重复介绍。可先填一只，之后还能再加。
        </p>
        <div className="mt-6">
          <PetForm
            submitLabel="完成，开始提问"
            onSubmit={create}
            onCancel={() => router.push("/chat")}
          />
        </div>
        <button
          className="mt-3 w-full text-center text-xs text-gray-400"
          onClick={() => router.push("/chat")}
        >
          暂时跳过
        </button>
      </div>
    </main>
  );
}
