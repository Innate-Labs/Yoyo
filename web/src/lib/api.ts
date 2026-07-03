import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** 统一异常转换：Zod 校验错误 / 带 status 的错误 / 其他。 */
export function handleError(e: unknown) {
  if (e instanceof ZodError) {
    const msg = e.errors.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ");
    return fail(`参数错误：${msg}`, 422);
  }
  const err = e as Error & { status?: number };
  if (err?.status) return fail(err.message, err.status);
  console.error("[API ERROR]", e);
  return fail("服务器开小差了，请稍后重试", 500);
}
