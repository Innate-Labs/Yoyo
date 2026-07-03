"use client";

import { useState } from "react";
import type { Pet, Sex } from "@/lib/client";

const SPECIES = ["雪貂", "仓鼠", "龙猫", "蜜袋鼯", "其他"];

export interface PetFormValue {
  name: string;
  species: string;
  ageMonths: number | null;
  sex: Sex;
}

export function PetForm({
  initial,
  submitLabel = "保存",
  onSubmit,
  onCancel,
}: {
  initial?: Partial<Pet>;
  submitLabel?: string;
  onSubmit: (v: PetFormValue) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [species, setSpecies] = useState(initial?.species ?? "雪貂");
  const [customSpecies, setCustomSpecies] = useState(
    initial && !SPECIES.includes(initial.species ?? "") ? initial.species ?? "" : ""
  );
  const [ageYears, setAgeYears] = useState(
    initial?.ageMonths != null ? String(Math.floor(initial.ageMonths / 12)) : ""
  );
  const [ageMonthsPart, setAgeMonthsPart] = useState(
    initial?.ageMonths != null ? String(initial.ageMonths % 12) : ""
  );
  const [sex, setSex] = useState<Sex>(initial?.sex ?? "UNKNOWN");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const speciesIsOther = species === "其他";

  async function handleSubmit() {
    setErr("");
    const finalSpecies = speciesIsOther ? customSpecies.trim() : species;
    if (!name.trim()) return setErr("请填写昵称");
    if (!finalSpecies) return setErr("请填写品种");

    const y = parseInt(ageYears || "0", 10);
    const m = parseInt(ageMonthsPart || "0", 10);
    const total = y * 12 + m;
    const ageMonths = ageYears === "" && ageMonthsPart === "" ? null : total;

    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), species: finalSpecies, ageMonths, sex });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-gray-600">昵称</label>
        <input
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand"
          placeholder="如：小雪"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="text-sm text-gray-600">品种</label>
        <div className="mt-1 flex flex-wrap gap-2">
          {SPECIES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpecies(s)}
              className={`rounded-full border px-3 py-1 text-sm ${
                species === s
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {speciesIsOther && (
          <input
            className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand"
            placeholder="请填写品种"
            value={customSpecies}
            onChange={(e) => setCustomSpecies(e.target.value)}
          />
        )}
      </div>

      <div>
        <label className="text-sm text-gray-600">年龄（可留空）</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            className="w-20 rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand"
            placeholder="0"
            inputMode="numeric"
            value={ageYears}
            onChange={(e) => setAgeYears(e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
          <span className="text-sm text-gray-500">岁</span>
          <input
            className="w-20 rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-brand"
            placeholder="0"
            inputMode="numeric"
            value={ageMonthsPart}
            onChange={(e) =>
              setAgeMonthsPart(e.target.value.replace(/\D/g, "").slice(0, 2))
            }
          />
          <span className="text-sm text-gray-500">个月</span>
        </div>
      </div>

      <div>
        <label className="text-sm text-gray-600">性别</label>
        <div className="mt-1 flex gap-2">
          {([
            ["MALE", "公"],
            ["FEMALE", "母"],
            ["UNKNOWN", "未知"],
          ] as [Sex, string][]).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setSex(val)}
              className={`rounded-full border px-4 py-1 text-sm ${
                sex === val
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-gray-200 text-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {err && <p className="text-xs text-danger">{err}</p>}

      <div className="flex gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-gray-600"
            onClick={onCancel}
          >
            取消
          </button>
        )}
        <button
          type="button"
          className="flex-1 rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-50"
          onClick={handleSubmit}
          disabled={busy}
        >
          {busy ? "保存中…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
