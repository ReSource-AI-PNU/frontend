"use client";

import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { api } from "@/lib/v3/api";
import { formatNumber, priceSide } from "@/lib/v3/format";
import type {
  CsvUploadResult,
  DocumentKind,
  DocumentUploadResult,
  ExtractedField,
  StreamRecord,
  VendorProfile,
} from "@/lib/v3/types";
import { useV3 } from "./context";
import { useRemote } from "./use-remote";

const input =
  "min-h-[34px] rounded-md border border-line-strong bg-surface px-3 text-sm disabled:bg-sunken disabled:text-muted";

type UploadState<T> = { busy: boolean; result: T | null; error: string | null };

function useUpload<T>(canAct: boolean) {
  const [state, setState] = useState<UploadState<T>>({ busy: false, result: null, error: null });
  const send = async (call: () => Promise<T>) => {
    if (!canAct) return;
    setState({ busy: true, result: null, error: null });
    try {
      setState({ busy: false, result: await call(), error: null });
    } catch (error) {
      setState({
        busy: false,
        result: null,
        error: error instanceof Error ? error.message : "올리지 못했습니다.",
      });
    }
  };
  return { state, send };
}

function UploadStatus({ state }: { state: UploadState<unknown> }) {
  if (state.busy) return <p className="mt-2 text-sm text-muted">올리는 중입니다.</p>;
  if (state.error) {
    return (
      <p role="alert" className="mt-2 rounded-md bg-loss-bg px-3 py-2 text-sm text-loss">
        {state.error}
      </p>
    );
  }
  return null;
}

/** 측정값 CSV를 올린 결과: 받은 행 수, 행과 열을 짚은 오류, 이름이 맞는 흐름이 없는 행 */
function CsvResult({ result }: { result: CsvUploadResult }) {
  const { openEvidence } = useV3();
  return (
    <div className="mt-2 space-y-2 text-[13px]">
      <p>
        <span className="font-mono">{result.filename}</span> ({result.encoding}) · 받은 행{" "}
        <span className="font-mono font-semibold">{result.accepted}</span> · 오류{" "}
        <span className="font-mono font-semibold">{result.errors.length}</span> · 흐름을 찾지 못한 행{" "}
        <span className="font-mono font-semibold">{result.unmatched.length}</span>
        {result.evidence.length > 0 ? (
          <>
            {" · "}
            <button
              type="button"
              className="font-semibold underline decoration-dotted underline-offset-4"
              onClick={() => openEvidence(result.evidence, "등록된 측정값 근거")}
            >
              등록된 측정값 근거 {result.evidence.length}건
            </button>
          </>
        ) : null}
      </p>
      {result.errors.length > 0 ? (
        <table className="w-full">
          <thead>
            <tr className="border-b border-ink text-left text-muted">
              <th className="py-1 pr-3">행</th>
              <th className="py-1 pr-3">열</th>
              <th className="py-1">오류</th>
            </tr>
          </thead>
          <tbody>
            {result.errors.map((error, index) => (
              <tr key={index} className="border-b border-line text-loss">
                <td className="py-1 pr-3 font-mono">{error.row ?? "-"}</td>
                <td className="py-1 pr-3 font-mono">{error.column ?? "-"}</td>
                <td className="py-1">{error.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {result.unmatched.length > 0 ? (
        <p className="text-warn">
          이름이 맞는 흐름이 없어 붙이지 못한 행:{" "}
          <span className="font-mono">{result.unmatched.map((row) => JSON.stringify(row)).join(", ")}</span>
        </p>
      ) : null}
    </div>
  );
}

const DOC_KIND_LABEL: Record<DocumentKind, string> = {
  permit: "허가증",
  purchase_criteria: "매입 기준표",
  material_spec: "원자재 명세",
  msds: "MSDS",
  contract: "위탁 계약서",
};

/**
 * 문서 올리기와 추출값 확인. 뽑은 값은 담당자가 표시한 것만 doc 근거로 등록된다.
 * 주입 검사나 문서 추출 서비스가 연결되지 않았으면 서버가 알려 준 그대로 보여 준다.
 */
function DocumentUpload({ kinds, canAct, label }: { kinds: DocumentKind[]; canAct: boolean; label: string }) {
  const { org, openEvidence } = useV3();
  const upload = useUpload<DocumentUploadResult>(canAct);
  const [kind, setKind] = useState<DocumentKind>(kinds[0]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [confirm, setConfirm] = useState<{ busy: boolean; evidence: string[] | null; error: string | null }>({
    busy: false,
    evidence: null,
    error: null,
  });
  const result = upload.state.result;
  const picked = result?.fields.filter((item) => checked[item.field]) ?? [];

  const register = async () => {
    if (!result) return;
    setConfirm({ busy: true, evidence: null, error: null });
    try {
      const fields: ExtractedField[] = result.fields.map((item) => ({
        ...item,
        confirmed: Boolean(checked[item.field]),
      }));
      const done = await api.confirmDocument(org.id, result.filename, fields);
      setConfirm({ busy: false, evidence: done.evidence, error: null });
    } catch (error) {
      setConfirm({
        busy: false,
        evidence: null,
        error: error instanceof Error ? error.message : "등록하지 못했습니다.",
      });
    }
  };

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as DocumentKind)}
          className={input}
          aria-label="문서 종류"
        >
          {kinds.map((item) => (
            <option key={item} value={item}>
              {DOC_KIND_LABEL[item]}
            </option>
          ))}
        </select>
        <input
          type="file"
          disabled={!canAct || upload.state.busy}
          aria-label={label}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setChecked({});
            setConfirm({ busy: false, evidence: null, error: null });
            void upload.send(() => api.uploadDocument(org.id, file, kind));
          }}
          className="text-sm"
        />
      </div>
      <UploadStatus state={upload.state} />
      {result ? (
        <div className="space-y-2 rounded-md border border-line p-3">
          <p className="text-[13px]">
            <span className="font-mono">{result.filename}</span> · {DOC_KIND_LABEL[result.kind] ?? result.kind}
          </p>
          {result.blocked || result.handoff ? (
            <p role="alert" className="rounded-md bg-loss-bg px-3 py-2 text-sm font-semibold text-loss">
              문서에서 지시문 주입이 탐지되어 이 문서를 쓰지 않습니다.
              {result.threadIds.length > 0
                ? ` 진행 중인 대화 ${result.threadIds.length}건을 담당자에게 넘겼습니다.`
                : ""}
            </p>
          ) : null}
          {result.shieldUnavailable ? (
            <p className="rounded-md bg-warn-bg px-3 py-2 text-[13px] font-semibold text-warn">
              주입 검사 안 함 · {result.shield?.note ?? "Prompt Shields가 설정되지 않았습니다."}
            </p>
          ) : (
            <p className="text-[13px] text-muted">주입 검사(Prompt Shields)를 거쳤습니다.</p>
          )}
          {result.extraction === "text_only" ? (
            <p className="text-[13px] text-muted">
              문서 추출 서비스(Document Intelligence)가 연결되지 않아 글 파일의 내용만 읽었습니다.
            </p>
          ) : null}
          {result.fields.length === 0 ? (
            <p className="text-[13px] text-muted">이 문서에서 뽑은 값이 없습니다.</p>
          ) : (
            <>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-ink text-left text-muted">
                    <th className="py-1 pr-3">확인</th>
                    <th className="py-1 pr-3">항목</th>
                    <th className="py-1 pr-3">뽑은 값</th>
                    <th className="py-1">문서의 표기</th>
                  </tr>
                </thead>
                <tbody>
                  {result.fields.map((item) => (
                    <tr key={item.field} className="border-b border-line align-top">
                      <td className="py-1.5 pr-3">
                        <input
                          type="checkbox"
                          aria-label={`${item.label} 확인`}
                          checked={Boolean(checked[item.field])}
                          disabled={result.blocked || confirm.busy}
                          onChange={(event) =>
                            setChecked((before) => ({ ...before, [item.field]: event.target.checked }))
                          }
                        />
                      </td>
                      <td className="py-1.5 pr-3 font-semibold">{item.label}</td>
                      <td className="py-1.5 pr-3 font-mono">
                        {item.value === null ? (
                          <span className="font-sans text-warn">확인 필요</span>
                        ) : (
                          `${typeof item.value === "number" ? formatNumber(item.value) : item.value}${item.unit ? ` ${item.unit}` : ""}`
                        )}
                        {item.needsReview ? (
                          <span className="ml-2 font-sans text-[12px] text-warn">
                            다시 볼 것{item.reviewReasons?.length ? `: ${item.reviewReasons.join(", ")}` : ""}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-1.5 text-muted">{item.raw ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canAct || result.blocked || confirm.busy || picked.length === 0}
                  onClick={register}
                >
                  {confirm.busy ? "등록 중" : `확인한 값 ${picked.length}개를 근거로 등록`}
                </Button>
                <span className="text-[13px] text-muted">
                  {result.note ?? "표시한 값만 근거로 등록됩니다."}
                </span>
              </div>
            </>
          )}
          {confirm.error ? (
            <p role="alert" className="rounded-md bg-loss-bg px-3 py-2 text-sm text-loss">
              {confirm.error}
            </p>
          ) : null}
          {confirm.evidence ? (
            <p className="text-[13px]">
              {confirm.evidence.length === 0 ? (
                "등록된 근거가 없습니다."
              ) : (
                <>
                  문서 근거 {confirm.evidence.length}건을 등록했습니다.{" "}
                  <button
                    type="button"
                    className="font-semibold underline decoration-dotted underline-offset-4"
                    onClick={() => openEvidence(confirm.evidence ?? [], "등록한 문서 근거")}
                  >
                    근거 보기
                  </button>
                </>
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const STREAM_TABS = ["사진·영상", "CSV", "문서"] as const;

function StreamCard({
  stream,
  canAct,
  onSave,
  onChanged,
}: {
  stream: StreamRecord;
  canAct: boolean;
  onSave: (stream: StreamRecord) => Promise<void>;
  /** 올린 자료로 흐름이 바뀌었을 때 다시 읽는다 */
  onChanged: () => void;
}) {
  const { org } = useV3();
  const [tab, setTab] = useState<(typeof STREAM_TABS)[number]>("CSV");
  const [method, setMethod] = useState(stream.currentTreatment?.method ?? "");
  const [cost, setCost] = useState(
    stream.currentTreatment?.unitCostKrwPerKg != null
      ? String(stream.currentTreatment.unitCostKrwPerKg)
      : "",
  );
  const [saved, setSaved] = useState<string | null>(null);
  const csv = useUpload<CsvUploadResult>(canAct);

  const save = async () => {
    const parsed = cost.trim() === "" ? null : Number(cost);
    if (parsed !== null && !Number.isFinite(parsed)) {
      setSaved("단가는 숫자로 입력하세요.");
      return;
    }
    try {
      await onSave({
        ...stream,
        currentTreatment: method.trim()
          ? {
              method: method.trim(),
              unitCostKrwPerKg: parsed,
              evidence: stream.currentTreatment?.evidence ?? [],
            }
          : null,
      });
      setSaved("저장했습니다.");
    } catch (error) {
      setSaved(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  };

  return (
    <article className="rounded-lg border border-line">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-5 py-4">
        <h3 className="text-h2">{stream.name}</h3>
        <p className="text-sm text-muted">
          {stream.material}
          {stream.origin ? ` · ${stream.origin}` : ""}
          {stream.form ? ` · ${stream.form}` : ""}
          {stream.monthlyKg != null
            ? ` · 월 ${formatNumber(stream.monthlyKg)} kg${stream.monthlyKgBasis === "estimated" ? " (추정)" : ""}`
            : " · 월 발생량 확인 필요"}
          {stream.contaminants && stream.contaminants.length > 0
            ? ` · 혼입물 ${stream.contaminants.map((item) => item.name).join(", ")}`
            : ""}
        </p>
        <span className="ml-auto font-mono text-[12px] text-muted">{stream.id}</span>
      </header>

      <div role="tablist" className="flex gap-1 border-b border-line px-3">
        {STREAM_TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`px-3 py-2.5 text-sm ${tab === name ? "font-semibold shadow-[inset_0_-2px_0_var(--color-ink)]" : "text-muted hover:text-ink"}`}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="px-5 py-4">
        {tab === "사진·영상" ? (
          <p className="text-sm text-muted">
            사진·영상 업로드는 v3 API 계약에 아직 경로가 없어 이 화면에서 보낼 수 없습니다. 탐지
            모델 결과가 등록되면 흐름의 재질과 사진 추정 오염 비율이 여기에 나옵니다.{" "}
            {stream.photo?.contaminationPct != null ? (
              <span className="text-ink">
                등록된 사진 추정 오염 비율: <span className="font-mono">{stream.photo.contaminationPct}%</span>
              </span>
            ) : (
              "등록된 사진 추정값이 없습니다."
            )}
          </p>
        ) : null}
        {tab === "CSV" ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted">
              필수 열: 흐름 이름, 공정, 재질, 오염도(%), 수분(%), 측정일. 선택 열: 출처, 형태, 로트,
              월 발생량. UTF-8과 CP949를 모두 받습니다. 파일 안의 행은 흐름 이름이 같은 흐름에 붙습니다.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {canAct ? (
                <a href={api.csvTemplateUrl()} className={buttonClass("secondary", "sm")}>
                  양식 내려받기
                </a>
              ) : null}
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={!canAct || csv.state.busy}
                aria-label={`${stream.name} 측정값 CSV`}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void csv.send(async () => {
                      const result = await api.uploadCsv(org.id, file);
                      if (result.accepted > 0) onChanged();
                      return result;
                    });
                  }
                }}
                className="text-sm"
              />
            </div>
            {stream.measure ? (
              <p className="text-[13px]">
                등록된 측정값: 오염도 {stream.measure.contaminationPct ?? "확인 필요"}% · 수분{" "}
                {stream.measure.moisturePct ?? "확인 필요"}% ·{" "}
                <span className="font-mono">{stream.measure.measuredOn}</span>
              </p>
            ) : (
              <p className="text-[13px] text-muted">등록된 측정값이 없습니다.</p>
            )}
            <UploadStatus state={csv.state} />
            {csv.state.result ? <CsvResult result={csv.state.result} /> : null}
          </div>
        ) : null}
        {tab === "문서" ? (
          <div className="space-y-2 text-sm">
            <p className="text-muted">
              올린 문서는 근거로만 쓰고 지시로 해석하지 않습니다. 추출한 값은 사람이 확인한 뒤에
              근거로 등록됩니다.
            </p>
            <DocumentUpload
              kinds={["material_spec", "msds", "contract"]}
              canAct={canAct}
              label={`${stream.name} 문서`}
            />
          </div>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-end gap-3 border-t border-line bg-sunken px-5 py-4">
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          현행 처리 방법
          <input
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            placeholder="예: 혼합 소각, 위탁 재활용"
            className={input}
            disabled={!canAct}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-semibold">
          현행 단가 (원/kg, 내는 돈)
          <input
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            inputMode="decimal"
            className={`${input} w-32 font-mono`}
            disabled={!canAct}
          />
        </label>
        <Button size="sm" variant="secondary" disabled={!canAct} onClick={save}>
          저장
        </Button>
        <p className="basis-full text-[13px] text-muted">
          {saved ?? "비워 두면 혼합 소각을 가정값으로 쓰고, 결과에 \"가정값\"으로 표시합니다."}
        </p>
      </footer>
    </article>
  );
}

function EmitterMaterials() {
  const { mode, fixture, org } = useV3();
  const live = mode === "live";
  const remote = useRemote(`streams:${org.id}`, live, () => api.listStreams(org.id));
  const streams = live ? remote.data : (fixture?.streams.filter((item) => item.orgId === org.id) ?? []);
  if (remote.loading) return <p className="text-sm text-muted">흐름을 불러오는 중입니다.</p>;
  if (remote.error) return <p className="rounded-md bg-loss-bg px-4 py-3 text-sm text-loss">{remote.error}</p>;
  if (!streams || streams.length === 0) {
    return (
      <p className="text-sm text-muted">
        {live
          ? "등록된 흐름이 없습니다."
          : "예시 데이터에 이 조직의 흐름이 없습니다. 예시 데이터는 배출 기업 한 곳의 자료만 담고 있습니다."}
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {streams.map((stream) => (
        <StreamCard
          key={stream.id}
          stream={stream}
          canAct={live}
          onChanged={remote.reload}
          onSave={async (next) => {
            await api.putStream(org.id, next);
            remote.reload();
          }}
        />
      ))}
    </div>
  );
}

function VendorForm({
  profile,
  canAct,
  onSave,
}: {
  profile: VendorProfile;
  canAct: boolean;
  onSave: (profile: VendorProfile) => Promise<void>;
}) {
  const { openEvidence } = useV3();
  const [floor, setFloor] = useState(
    profile.guardrails.floorPriceKrwPerKg != null ? String(profile.guardrails.floorPriceKrwPerKg) : "",
  );
  const [days, setDays] = useState(profile.guardrails.days.join(", "));
  const [pickups, setPickups] = useState(
    profile.guardrails.minPickupsPerMonth != null ? String(profile.guardrails.minPickupsPerMonth) : "",
  );
  const [decline, setDecline] = useState(profile.guardrails.autoDecline.join(", "));
  const [ceiling, setCeiling] = useState(
    profile.guardrails.ceilingPriceKrwPerKg != null ? String(profile.guardrails.ceilingPriceKrwPerKg) : "",
  );
  const [provider, setProvider] = useState(profile.model.provider);
  const [modelName, setModelName] = useState(profile.model.name);
  const [note, setNote] = useState<string | null>(null);
  const list = (text: string) =>
    text
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const num = (text: string) => (text.trim() === "" ? null : Number(text));

  const save = async () => {
    const floorValue = num(floor);
    const pickupValue = num(pickups);
    const ceilingValue = num(ceiling);
    if ([floorValue, pickupValue, ceilingValue].some((value) => value !== null && !Number.isFinite(value))) {
      setNote("숫자 칸에는 숫자만 입력하세요.");
      return;
    }
    try {
      await onSave({
        ...profile,
        guardrails: {
          ...profile.guardrails,
          floorPriceKrwPerKg: floorValue,
          ceilingPriceKrwPerKg: ceilingValue,
          days: list(days),
          minPickupsPerMonth: pickupValue,
          autoDecline: list(decline),
        },
        model: { provider, name: modelName.trim() || profile.model.name },
      });
      setNote("저장했습니다.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "저장하지 못했습니다.");
    }
  };
  const EvidenceLink = ({ ids }: { ids: string[] }) =>
    ids.length > 0 ? (
      <button
        type="button"
        className="underline decoration-dotted underline-offset-4"
        onClick={() => openEvidence(ids, "추출값의 근거")}
      >
        근거
      </button>
    ) : (
      <span className="text-warn">확인 필요</span>
    );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line p-5">
        <h3 className="text-h2">문서 올리기</h3>
        <p className="mt-1 text-sm text-muted">
          허가증과 매입 기준표에서 뽑은 값은 아래 표에 나오고, 담당자가 확인한 뒤에 근거로 씁니다.
        </p>
        <div className="mt-3">
          <DocumentUpload kinds={["permit", "purchase_criteria"]} canAct={canAct} label="업체 문서" />
        </div>
      </section>

      <section className="rounded-lg border border-line p-5">
        <h3 className="text-h2">허가 품목</h3>
        {profile.permits.length === 0 ? (
          <p className="mt-2 text-sm text-muted">등록된 허가 품목이 없습니다. 허가 품목이 맞지 않는 흐름과는 대화를 열지 않습니다.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {profile.permits.map((permit, index) => (
              <li key={index}>
                <span className="font-semibold">{permit.wasteItem}</span> · {permit.materials.join(", ")} ·{" "}
                <EvidenceLink ids={permit.evidence} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-line p-5">
        <h3 className="text-h2">매입 기준표</h3>
        {profile.criteria.length === 0 ? (
          <p className="mt-2 text-sm text-muted">등록된 매입 기준이 없습니다.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink text-left text-label text-muted">
                  <th className="py-2 pr-3">재질</th>
                  <th className="py-2 pr-3">등급</th>
                  <th className="py-2 pr-3">형태</th>
                  <th className="py-2 pr-3 text-right">오염도 상한</th>
                  <th className="py-2 pr-3 text-right">수분 상한</th>
                  <th className="py-2 pr-3 text-right">단가 (원/kg)</th>
                  <th className="py-2 pr-3 text-right">최소 물량 (kg/월)</th>
                  <th className="py-2">근거</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {profile.criteria.map((row) => (
                  <tr key={row.id} className="border-b border-line">
                    <td className="py-2 pr-3 font-sans font-semibold">{row.material}</td>
                    <td className="py-2 pr-3">{row.grade}</td>
                    <td className="py-2 pr-3 font-sans">{row.form ?? "-"}</td>
                    <td className="py-2 pr-3 text-right">{row.maxContaminationPct != null ? `${row.maxContaminationPct}%` : "-"}</td>
                    <td className="py-2 pr-3 text-right">{row.maxMoisturePct != null ? `${row.maxMoisturePct}%` : "-"}</td>
                    <td className="py-2 pr-3 text-right">
                      {row.unitPriceKrwPerKg != null ? (
                        <>
                          <span className="font-sans">{priceSide(row.unitPriceKrwPerKg)}</span>{" "}
                          {formatNumber(Math.abs(row.unitPriceKrwPerKg))}
                        </>
                      ) : (
                        <span className="font-sans text-warn">확인 필요</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">{row.minMonthlyKg != null ? formatNumber(row.minMonthlyKg) : "-"}</td>
                    <td className="py-2 font-sans">
                      <EvidenceLink ids={row.evidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line p-5">
        <h3 className="text-h2">노선·차량</h3>
        {profile.fleet ? (
          <dl className="mt-2 grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
            <dt className="text-muted">차고지 (경도, 위도)</dt>
            <dd className="font-mono">{profile.fleet.depot.join(", ")}</dd>
            <dt className="text-muted">적재 무게</dt>
            <dd className="font-mono">{formatNumber(profile.fleet.capacityKg)} kg</dd>
            <dt className="text-muted">적재 부피</dt>
            <dd className="font-mono">{formatNumber(profile.fleet.capacityM3)} m3</dd>
            <dt className="text-muted">km당 운송비</dt>
            <dd className="font-mono">{formatNumber(profile.fleet.costPerKm)} 원</dd>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-muted">등록된 노선·차량 정보가 없습니다.</p>
        )}
      </section>

      <section className="rounded-lg border border-ink p-5">
        <h3 className="text-h2">가드레일과 모델</h3>
        <p className="mt-1 text-sm text-muted">업체 측 에이전트는 여기서 정한 범위 밖으로 나가지 않습니다.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            하한 단가 (원/kg, 배출 기업 기준. 음수는 처리비)
            <input value={floor} onChange={(event) => setFloor(event.target.value)} inputMode="decimal" className={`${input} font-mono`} disabled={!canAct} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            상한 단가 (원/kg, 선택)
            <input value={ceiling} onChange={(event) => setCeiling(event.target.value)} inputMode="decimal" className={`${input} font-mono`} disabled={!canAct} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            월 최소 수거 횟수
            <input value={pickups} onChange={(event) => setPickups(event.target.value)} inputMode="numeric" className={`${input} font-mono`} disabled={!canAct} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            가능 요일 (쉼표로 구분)
            <input value={days} onChange={(event) => setDays(event.target.value)} className={input} disabled={!canAct} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            자동 거절 조건 (쉼표로 구분)
            <input value={decline} onChange={(event) => setDecline(event.target.value)} className={input} disabled={!canAct} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            에이전트 모델
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as VendorProfile["model"]["provider"])}
              className={input}
              disabled={!canAct}
            >
              <option value="foundry">Foundry (기본)</option>
              <option value="ollama">Ollama 오픈 모델</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            모델 이름
            <input value={modelName} onChange={(event) => setModelName(event.target.value)} className={`${input} font-mono`} disabled={!canAct} />
          </label>
        </div>
        <p className="mt-2 text-[13px] text-muted">
          모델은 설정입니다. 실제로 어떤 구현이 답했는지는 진단·연결 화면의 대화마다 따로 표시됩니다(모델이
          연결되지 않은 서버에서는 &ldquo;규칙 정책(모델 미연결)&rdquo;로 답합니다).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" disabled={!canAct} onClick={save}>
            저장
          </Button>
          <span className="text-[13px] text-muted">
            {note ?? (canAct ? "" : "예시 데이터에서는 저장할 수 없습니다.")}
          </span>
        </div>
      </section>
    </div>
  );
}

function VendorMaterials() {
  const { mode, fixture, org } = useV3();
  const live = mode === "live";
  const remote = useRemote(`vendor:${org.id}`, live, () => api.getVendor(org.id));
  const profile = live ? remote.data : (fixture?.vendors[org.id] ?? null);
  if (remote.loading) return <p className="text-sm text-muted">업체 정보를 불러오는 중입니다.</p>;
  if (remote.error) return <p className="rounded-md bg-loss-bg px-4 py-3 text-sm text-loss">{remote.error}</p>;
  if (!profile) return <p className="text-sm text-muted">등록된 업체 정보가 없습니다.</p>;
  return (
    <VendorForm
      key={profile.orgId}
      profile={profile}
      canAct={live}
      onSave={async (next) => {
        remote.set(await api.putVendor(org.id, next));
      }}
    />
  );
}

export function MaterialsView() {
  const { org, mode } = useV3();
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-h1">자료 올리기</h1>
        <p className="mt-1 text-sm text-muted">
          {org.name} ·{" "}
          {org.role === "emitter"
            ? "흐름마다 측정값과 문서, 현행 처리를 넣습니다."
            : org.role === "vendor"
              ? "허가증, 매입 기준표, 노선·차량, 가드레일을 넣습니다."
              : "자료는 배출 기업이나 처리 업체 관점에서 올립니다."}
        </p>
      </header>
      {mode === "loading" ? <p className="text-sm text-muted">불러오는 중입니다.</p> : null}
      {mode !== "loading" && org.role === "emitter" ? <EmitterMaterials /> : null}
      {mode !== "loading" && org.role === "vendor" ? <VendorMaterials /> : null}
      {mode !== "loading" && org.role === "admin" ? (
        <p className="text-sm text-muted">위쪽 관점 선택에서 배출 기업이나 처리 업체를 고르세요.</p>
      ) : null}
    </div>
  );
}
