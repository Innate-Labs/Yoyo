"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [hint, setHint] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    setErr("");
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setErr("请输入有效的手机号");
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ mock: boolean; hint?: string }>(
        "/api/auth/send-code",
        { method: "POST", body: JSON.stringify({ phone }) }
      );
      setSent(true);
      setHint(data.hint || "验证码已发送");
      let c = 60;
      setCooldown(c);
      const t = setInterval(() => {
        c -= 1;
        setCooldown(c);
        if (c <= 0) clearInterval(t);
      }, 1000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setErr("");
    setLoading(true);
    try {
      const data = await api<{ hasPet: boolean }>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      });
      router.push(data.hasPet ? "/chat" : "/onboarding");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold">异宠AI问答</h1>
        <p className="mt-1 text-sm text-gray-500">
          哺乳异宠（雪貂为主）的养护问答助手
        </p>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:border-brand"
            placeholder="手机号"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
          />

          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 outline-none focus:border-brand"
              placeholder="6 位验证码"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <button
              className="whitespace-nowrap rounded-lg border border-brand px-3 text-sm text-brand disabled:opacity-50"
              onClick={sendCode}
              disabled={loading || cooldown > 0}
            >
              {cooldown > 0 ? `${cooldown}s` : sent ? "重新发送" : "获取验证码"}
            </button>
          </div>

          {hint && <p className="text-xs text-brand">{hint}</p>}
          {err && <p className="text-xs text-danger">{err}</p>}

          <button
            className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-50"
            onClick={verify}
            disabled={loading || code.length !== 6}
          >
            {loading ? "处理中…" : "登录 / 注册"}
          </button>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400">
          登录即表示同意，本产品 AI 回答为辅助参考，不替代执业兽医诊断。
        </p>
      </div>
    </main>
  );
}
