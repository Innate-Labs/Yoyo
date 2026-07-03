"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

interface Vet {
  name: string;
  address: string;
  tel?: string;
  distanceMeters?: number;
}

// 资源地图（高危场景配套出口）。默认弹出面板，自动尝试定位；失败降级为手动城市检索。
export function VetMap({ onClose }: { onClose: () => void }) {
  const [vets, setVets] = useState<Vet[]>([]);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");
  const [city, setCity] = useState("");
  const [locating, setLocating] = useState(true);

  async function search(params: Record<string, string>) {
    setLoading(true);
    setNote("");
    try {
      const q = new URLSearchParams(params).toString();
      const data = await api<{ vets: Vet[]; note?: string; mock?: boolean }>(
        `/api/vets?${q}`
      );
      setVets(data.vets);
      if (data.note) setNote(data.note);
      if (data.mock) setNote((n) => n || "当前展示示例数据（未配置地图 Key）");
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocating(false);
      setNote("浏览器不支持定位，请手动输入城市检索");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        search({
          lng: String(pos.coords.longitude),
          lat: String(pos.coords.latitude),
          source: "high_risk",
        });
      },
      () => {
        setLocating(false);
        setNote("定位失败，可手动输入城市检索");
      },
      { timeout: 8000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold">附近宠物医院 / 急诊</h3>
          <button className="text-gray-400" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="flex gap-2 border-b px-4 py-2">
          <input
            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-brand"
            placeholder="输入城市，如 上海"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <button
            className="rounded-lg bg-brand px-3 text-sm text-white"
            onClick={() => search({ city, source: "manual" })}
          >
            搜索
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-4 py-2">
          <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            提示：以下为宠物医院搜索结果，是否能诊治异宠请务必先致电确认。
          </p>

          {locating && <p className="py-4 text-center text-sm text-gray-400">正在定位…</p>}
          {loading && <p className="py-4 text-center text-sm text-gray-400">检索中…</p>}
          {note && <p className="py-2 text-center text-xs text-gray-500">{note}</p>}

          <ul className="space-y-2">
            {vets.map((v, i) => (
              <li key={i} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{v.name}</span>
                  {v.distanceMeters != null && (
                    <span className="whitespace-nowrap text-xs text-gray-400">
                      {v.distanceMeters < 1000
                        ? `${v.distanceMeters}m`
                        : `${(v.distanceMeters / 1000).toFixed(1)}km`}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">{v.address}</p>
                {v.tel && (
                  <a
                    href={`tel:${v.tel.split(";")[0]}`}
                    className="mt-1 inline-block text-xs text-brand"
                  >
                    致电 {v.tel.split(";")[0]}
                  </a>
                )}
              </li>
            ))}
          </ul>

          {!locating && !loading && vets.length === 0 && !note && (
            <p className="py-6 text-center text-sm text-gray-400">暂无结果</p>
          )}
        </div>
      </div>
    </div>
  );
}
