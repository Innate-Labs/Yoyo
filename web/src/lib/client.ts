"use client";

// 前端统一请求封装
export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...opts.headers,
    },
  });
  const json = await res.json().catch(() => ({ ok: false, error: "响应解析失败" }));
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `请求失败 (${res.status})`);
  }
  return json.data as T;
}

export type Sex = "MALE" | "FEMALE" | "UNKNOWN";

export interface Pet {
  id: string;
  name: string;
  species: string;
  ageMonths: number | null;
  sex: Sex;
}

export interface ConvListItem {
  id: string;
  title: string;
  updatedAt: string;
  pet?: { id: string; name: string; species: string } | null;
}

export interface Msg {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  imageUrl: string | null;
  isHighRisk: boolean;
  questionType?: string;
  feedbacks?: { kind: "UP" | "DOWN" }[];
}
