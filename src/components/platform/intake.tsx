"use client";
import { useState } from "react";
import type { components } from "@/lib/platform/generated";

type Input = components["schemas"]["CreateSession"];
type Draft = {
  name: string;
  process: string;
  material: string;
  origin: "PIR" | "PCR";
  kg: number;
  url: string;
};
const fresh = (): Draft => ({
  name: "",
  process: "",
  material: "LDPE",
  origin: "PCR",
  kg: 300,
  url: "",
});
const input =
  "min-h-11 w-full rounded border border-line-strong bg-surface px-3 py-2";
export function Intake({
  company,
  busy,
  onCreate,
}: {
  company: string;
  busy: boolean;
  onCreate: (input: Input) => void;
}) {
  const [title, setTitle] = useState("공장 폐플라스틱 흐름 진단");
  const [rows, setRows] = useState<Draft[]>([fresh()]);
  function edit(i: number, key: keyof Draft, value: string | number) {
    setRows((old) => old.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  }
  return (
    <form
      className="my-6 space-y-4 border-y border-line py-6"
      onSubmit={(e) => {
        e.preventDefault();
        onCreate({
          companyId: company,
          title,
          streams: rows.map((r, i) => ({
            id: `stream-${i + 1}`,
            name: r.name,
            process: r.process,
            origin: r.origin,
            originSource: "human",
            monthlyKg: r.kg,
            monthlyKgConfirmed: false,
            media: r.url
              ? [
                  {
                    id: `media-${i + 1}`,
                    kind: "image",
                    name: r.name,
                    url: r.url,
                  },
                ]
              : [],
            classify: {
              item: "폐플라스틱",
              detail: r.name,
              material: r.material,
              singleMaterial: !r.material.includes("+"),
              confidence: 1,
              estimatedKg: r.kg,
              frames: 0,
              detections: [],
              model: { name: "human-input", version: "1" },
              durationMs: 0,
            },
          })),
        });
      }}
    >
      <h2 className="text-xl font-semibold">흐름 등록</h2>
      <p className="text-sm text-muted">
        공정별로 최대 8개를 등록하세요. 직접 입력한 재질은 식별 단계에서
        검토하고, 월 물량은 별도로 확인합니다.
      </p>
      <label className="grid gap-1">
        진단 이름
        <input
          className={input}
          value={title}
          required
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      {rows.map((r, i) => (
        <fieldset
          key={i}
          className="grid gap-3 border border-line p-4 sm:grid-cols-2"
        >
          <legend>흐름 {i + 1}</legend>
          <label>
            흐름 이름
            <input
              aria-label={`흐름 ${i + 1} 이름`}
              className={input}
              required
              maxLength={100}
              value={r.name}
              onChange={(e) => edit(i, "name", e.target.value)}
            />
          </label>
          <label>
            발생 공정
            <input
              className={input}
              required
              maxLength={100}
              value={r.process}
              onChange={(e) => edit(i, "process", e.target.value)}
            />
          </label>
          <label>
            재질
            <input
              className={input}
              required
              maxLength={30}
              value={r.material}
              onChange={(e) =>
                edit(i, "material", e.target.value.toUpperCase())
              }
            />
          </label>
          <label>
            출처
            <select
              className={input}
              value={r.origin}
              onChange={(e) => edit(i, "origin", e.target.value)}
            >
              <option value="PIR">PIR · 공정 부산물</option>
              <option value="PCR">PCR · 사용 후 폐기물</option>
            </select>
          </label>
          <label>
            월 발생량(kg)
            <input
              className={input}
              type="number"
              required
              min={1}
              max={1000000}
              value={r.kg}
              onChange={(e) => edit(i, "kg", Number(e.target.value))}
            />
          </label>
          <label>
            현장 이미지 주소(선택)
            <input
              className={input}
              type="url"
              pattern="https://.*"
              placeholder="https://…"
              value={r.url}
              onChange={(e) => edit(i, "url", e.target.value)}
            />
          </label>
          {rows.length > 1 && (
            <button
              type="button"
              className="min-h-11 text-left text-sm underline"
              onClick={() => setRows((old) => old.filter((_, j) => j !== i))}
            >
              흐름 {i + 1} 삭제
            </button>
          )}
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-11 rounded border px-4"
          disabled={rows.length >= 8 || busy}
          onClick={() => setRows((old) => [...old, fresh()])}
        >
          흐름 추가
        </button>
        <button
          disabled={busy || !company}
          className="min-h-11 rounded bg-ink px-4 text-bg"
        >
          입력한 흐름으로 진단 시작
        </button>
      </div>
    </form>
  );
}
