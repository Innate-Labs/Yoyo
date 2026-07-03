import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "epa_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 天

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET 未配置或过短，请在 .env 中设置一段长随机字符串");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secretKey());

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSession() {
  cookies().delete(COOKIE_NAME);
}

/** 读取当前登录用户 id；未登录返回 null。 */
export async function getUserId(): Promise<string | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return (payload.uid as string) ?? null;
  } catch {
    return null;
  }
}

/** 在需要登录的接口中调用；未登录抛出 401 语义错误。 */
export async function requireUserId(): Promise<string> {
  const uid = await getUserId();
  if (!uid) {
    const err = new Error("未登录") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return uid;
}
