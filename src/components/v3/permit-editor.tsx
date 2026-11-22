"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/v3/api";
import type { ManualPermitInput, PermitCatalogItem } from "@/lib/v3/types";
import { useV3 } from "./context";
import { useRemote } from "./use-remote";

const field = "min-h-11 w-full rounded-[10px] border border-line-strong bg-surface px-3";

export function PermitEditor({ canAct, onSave, children }: {
  canAct: boolean;
  onSave: (rows: ManualPermitInput[]) => Promise<void>;
  children: ReactNode;
}) {
  const { org } = useV3();
  const [mode, setMode] = useState<"catalog" | "manual" | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PermitCatalogItem[]>([]);
  const [scopes, setScopes] = useState<Record<string, string>>({});
  const [wasteItem, setWasteItem] = useState("");
  const [manualMaterials, setManualMaterials] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const catalog = useRemote(`permit-catalog:${org.id}`, mode === "catalog" && canAct, () => api.permitCatalog(org.id));
  const term = query.trim().toLowerCase().replace(/\s+/g, "");
  const matches = (catalog.data ?? []).filter(({ code, name }) =>
    `${code} ${name}`.toLowerCase().replace(/\s+/g, "").includes(term) ||
    code.replace(/-/g, "").includes(term.replace(/-/g, "")),
  );
  const materials = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canAct || saving) return;
    const rows = mode === "catalog"
      ? selected.map(({ code }) => ({ code, materials: materials(scopes[code] ?? "") }))
      : [{ wasteItem: wasteItem.trim(), materials: materials(manualMaterials) }];
    setSaving(true);
    setError("");
    try {
      await onSave(rows);
      setMode(null);
      setSelected([]);
      setScopes({});
      setWasteItem("");
      setManualMaterials("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "허가 품목을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-start gap-2">
        <Button size="sm" variant="secondary" disabled={!canAct || saving} aria-expanded={mode === "catalog"}
          onClick={() => { setError(""); setMode(mode === "catalog" ? null : "catalog"); }}>
          목록에서 선택
        </Button>
        <Button size="sm" variant="secondary" disabled={!canAct || saving} aria-expanded={mode === "manual"}
          onClick={() => { setError(""); setMode(mode === "manual" ? null : "manual"); }}>
          직접 입력
        </Button>
        {children}
      </div>
      {mode ? (
        <form onSubmit={save} className="space-y-3 rounded-xl bg-ground p-4 text-sm">
          <p>담당자 입력 · 허가증 원본 확인 필요</p>
          <p className="text-muted">재질은 쉼표로 구분해 주세요. 재질을 비워 두면 물량의 허가 범위를 판정할 때 이 품목을 사용하지 않습니다.</p>
          <fieldset disabled={saving || !canAct} className="space-y-3">
            {mode === "catalog" ? (
              <>
                <label className="block">품목명 또는 분류코드 검색
                  <input type="search" className={field} value={query} onChange={(event) => setQuery(event.target.value)} />
                </label>
                {catalog.error ? (
                  <div role="alert">
                    {catalog.error} <Button size="sm" variant="secondary" onClick={catalog.reload}>다시 불러오기</Button>
                  </div>
                ) : catalog.loading ? <p>분류 목록을 불러오는 중입니다.</p>
                  : matches.length === 0 ? <p>검색 결과가 없습니다. 직접 입력해 주세요.</p> : (
                    <ul className="max-h-56 divide-y divide-line overflow-auto">
                      {matches.map((item) => (
                        <li key={item.code} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          {item.wasteItem ? (
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={selected.some(({ code }) => code === item.code)}
                                onChange={(event) => setSelected(event.target.checked
                                  ? [...selected, item] : selected.filter(({ code }) => code !== item.code))} />
                              {item.code} {item.name}
                            </label>
                          ) : (
                            <>
                              <span>{item.code} {item.name}</span>
                              <Button variant="ghost" size="sm" onClick={() => {
                                setWasteItem(item.name);
                                setMode("manual");
                              }}>이 품목 직접 입력</Button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                {selected.map(({ code, name, wasteItem }) => (
                  <label key={code} className="block">
                    {code} {name} ({wasteItem}) 재질
                    <input className={field} value={scopes[code] ?? ""} placeholder="예: PP, PE"
                      onChange={(event) => setScopes({ ...scopes, [code]: event.target.value })} />
                  </label>
                ))}
              </>
            ) : (
              <>
                <label className="block">허가 품목명
                  <input className={field} maxLength={120} required value={wasteItem}
                    onChange={(event) => setWasteItem(event.target.value)} />
                </label>
                <label className="block">허가 재질
                  <input className={field} value={manualMaterials} placeholder="예: PP, PE"
                    onChange={(event) => setManualMaterials(event.target.value)} />
                </label>
              </>
            )}
            <Button type="submit" size="sm" variant="secondary"
              disabled={mode === "catalog" ? selected.length === 0 : !wasteItem.trim()}>
              {saving ? "저장 중" : "허가 품목 저장"}
            </Button>
          </fieldset>
          {error ? <p role="alert" className="text-loss">{error}</p> : null}
        </form>
      ) : null}
    </>
  );
}
