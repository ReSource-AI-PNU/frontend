"use client";

import { Fragment, useState } from "react";
import { Button } from "@/components/ui/button";
import { CORRECTION_FIELD_LABEL, basisNote, fieldLabel } from "@/lib/v3/format";
import type { Claim, Correction, CorrectionField, CorrectionInput, DiagnosisView, ViewStream } from "@/lib/v3/types";
import { ClaimValue } from "./claim";
import { useV3 } from "./context";

/** 이 표에서 고칠 수 있는 항목. 탐지 박스(box)는 사진 위에서 고치는 것이라 여기에 두지 않는다 */
const CORRECTABLE: CorrectionField[] = [
  "material",
  "origin",
  "form",
  "contaminant",
  "grade",
  "contaminationPct",
  "moisturePct",
];
const NUMERIC = new Set<CorrectionField>(["contaminationPct", "moisturePct"]);
const input = "min-h-[34px] rounded-md border border-line-strong bg-surface px-2 text-sm";

/** 지금 화면에 보이는 값(고치기 전 값으로 함께 보낸다) */
function currentValue(stream: ViewStream, field: CorrectionField): string | number | null {
  switch (field) {
    case "material":
      return stream.material;
    case "origin":
      return stream.origin;
    case "form":
      return stream.form;
    case "contaminant":
      return stream.contaminants.length > 0 ? stream.contaminants.join(", ") : null;
    case "grade":
      return stream.grade.value;
    case "contaminationPct":
      return (stream.contamination ?? stream.photoContamination)?.value ?? null;
    case "moisturePct":
      return stream.moisture?.value ?? null;
    default:
      return null;
  }
}

/**
 * 사람 교정 폼. 담당자가 고친 값은 재학습 데이터로 기록만 남고 이 진단의 흐름 값은 바뀌지 않는다
 * (값을 바꾸려면 자료 올리기에서 고친다). 그 사실을 폼에 적는다.
 */
function CorrectionForm({
  stream,
  onSubmit,
  onClose,
}: {
  stream: ViewStream;
  onSubmit: (body: CorrectionInput) => Promise<void>;
  onClose: () => void;
}) {
  const [field, setField] = useState<CorrectionField>("material");
  const [after, setAfter] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<{ busy: boolean; error: string | null; done: boolean }>({
    busy: false,
    error: null,
    done: false,
  });
  const before = currentValue(stream, field);
  const numeric = NUMERIC.has(field);
  const parsed = numeric ? Number(after) : after.trim();
  const valid = after.trim() !== "" && (!numeric || Number.isFinite(parsed as number));
  const send = async () => {
    setState({ busy: true, error: null, done: false });
    try {
      await onSubmit({ streamId: stream.id, field, before, after: parsed, note: note.trim() || undefined });
      setAfter("");
      setNote("");
      setState({ busy: false, error: null, done: true });
    } catch (error) {
      setState({
        busy: false,
        error: error instanceof Error ? error.message : "기록하지 못했습니다.",
        done: false,
      });
    }
  };
  return (
    <div className="rounded-md border border-ink p-3">
      <div className="flex flex-wrap items-end gap-3 text-[13px]">
        <label className="flex flex-col gap-1 font-semibold">
          고칠 항목
          <select
            value={field}
            onChange={(event) => {
              setField(event.target.value as CorrectionField);
              setAfter("");
            }}
            className={input}
          >
            {CORRECTABLE.map((item) => (
              <option key={item} value={item}>
                {CORRECTION_FIELD_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <p className="flex flex-col gap-1">
          <span className="font-semibold">지금 값</span>
          <span className="flex min-h-[34px] items-center tabular-nums text-ink-2">
            {before === null ? <span className="text-warn">확인 필요</span> : `${before}${numeric ? "%" : ""}`}
          </span>
        </p>
        <label className="flex flex-col gap-1 font-semibold">
          고친 값{numeric ? " (%)" : ""}
          <input
            value={after}
            onChange={(event) => setAfter(event.target.value)}
            inputMode={numeric ? "decimal" : undefined}
            className={`${input} ${numeric ? "w-28 tabular-nums" : "w-40"}`}
          />
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 font-semibold">
          메모 (선택)
          <input value={note} onChange={(event) => setNote(event.target.value)} className={input} />
        </label>
        <Button size="sm" variant="secondary" disabled={!valid || state.busy} onClick={send}>
          {state.busy ? "기록 중" : "교정 기록"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
      <p className="mt-2 text-[13px] text-muted">
        고친 값은 사람 확인 근거로 기록되어 AI 판정을 고치는 데 쓰입니다. 이 찾기의 폐기물 값과 계산은 바뀌지 않습니다. 값을
        바꿔 다시 찾으려면 자료 화면에서 고친 뒤 새로 찾아 주세요.
      </p>
      {state.error ? (
        <p role="alert" className="mt-2 text-sm text-loss">
          {state.error}
        </p>
      ) : null}
      {state.done ? <p className="mt-2 text-[13px] font-semibold">교정을 기록했습니다.</p> : null}
    </div>
  );
}

/** 값의 출처 한 줄(측정 · 담당자 답 · 사진 추정). 값 아래 12px로 적는다(DESIGN.md 폐기물 표) */
function Basis({ basis, claim }: { basis: ViewStream["contaminationBasis"]; claim: Claim | null }) {
  const note = basisNote(basis, claim);
  return note ? <p className="text-[12px] text-muted">{note}</p> : null;
}

const REFERENCE_BASIS: Record<string, string> = {
  measured: "측정값",
  answered: "담당자 답",
  photo_estimate: "사진 추정",
  photo_unverified: "검증 안 된 사진 추정",
};

/**
 * 참고 등급. 업체 매입 기준이 없을 때 "이 정도면 보통 어느 수준인가"를 알려 준다. 팀이 정한 기준값(가정값)으로 낸
 * 것이라 판정과 배정에는 쓰지 않고, 값 옆에 "가정값" 꼬리표를 붙인다.
 */
function ReferenceGrade({
  name,
  reference,
}: {
  name: string;
  reference: NonNullable<ViewStream["grade"]["reference"]>;
}) {
  const { openEvidence } = useV3();
  return (
    <div className="mt-1.5 text-[12px] text-muted">
      <p>
        참고{" "}
        <button
          type="button"
          disabled={reference.evidence.length === 0}
          onClick={() => openEvidence(reference.evidence, `${name} 참고 등급`)}
          className="font-mono font-semibold text-ink-2 underline decoration-line-strong decoration-dotted underline-offset-4 hover:decoration-ink"
        >
          {reference.grade}
        </button>{" "}
        <span className="text-warn">가정값</span>
        {reference.basis ? ` · ${REFERENCE_BASIS[reference.basis] ?? reference.basis}` : ""}
      </p>
      {reference.meaning ? <p>{reference.meaning}</p> : null}
      <p>판정과 배정에는 쓰지 않습니다.</p>
    </div>
  );
}

/** ① 식별·분류 결과: 흐름마다 물량, 오염도, 수분, 등급, 현행 처리. 값마다 근거가 열린다. */
export function StreamTable({
  streams,
  unresolved,
  corrections = [],
  onCorrect,
}: {
  streams: ViewStream[];
  unresolved: DiagnosisView["unresolved"];
  /** 이 진단에 쌓인 사람 교정(배출 기업에게만 온다) */
  corrections?: Correction[];
  /** 교정을 보낼 수 있을 때만 준다(배출 기업 관점, 백엔드 연결됨) */
  onCorrect?: (body: CorrectionInput) => Promise<void>;
}) {
  const { openEvidence } = useV3();
  const [editing, setEditing] = useState<string | null>(null);
  if (streams.length === 0) {
    return <p className="p-5 text-sm text-muted">이 관점에서 볼 수 있는 폐기물이 없습니다.</p>;
  }
  const showCurrent = streams.some((stream) => stream.currentTreatment);
  return (
    <div className="overflow-x-auto px-5 py-3">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line-strong text-left text-label text-muted">
            <th className="py-2 pr-3 font-semibold">폐기물</th>
            <th className="py-2 pr-3 text-right font-semibold">월 발생량</th>
            <th className="py-2 pr-3 text-right font-semibold">오염도</th>
            <th className="py-2 pr-3 text-right font-semibold">수분</th>
            <th className="py-2 pr-3 font-semibold">등급</th>
            {showCurrent ? <th className="py-2 pr-3 font-semibold">현행 처리</th> : null}
            {onCorrect ? <th className="py-2 text-right font-semibold">사람 교정</th> : null}
          </tr>
        </thead>
        <tbody>
          {streams.map((stream) => {
            const unknown = new Set([
              ...stream.unknownFields,
              ...unresolved.filter((item) => item.streamId === stream.id).map((item) => item.field),
            ]);
            const fixed = corrections.filter((item) => item.streamId === stream.id);
            const open = editing === stream.id && onCorrect;
            const columns = 5 + (showCurrent ? 1 : 0) + (onCorrect ? 1 : 0);
            return (
              <Fragment key={stream.id}>
              <tr className={`align-top ${open || fixed.length > 0 ? "" : "border-b border-line last:border-b-0"}`}>
                <td className="py-2.5 pr-3">
                  <p className="font-semibold">{stream.name}</p>
                  <p className="text-[13px] text-muted">
                    {[stream.process, stream.material, stream.origin, stream.form].filter(Boolean).join(" · ")}
                  </p>
                  {stream.contaminants.length > 0 ? (
                    <p className="text-[12px] text-muted">혼입물: {stream.contaminants.join(", ")}</p>
                  ) : null}
                  {stream.materialBasis === "label" ? (
                    <p className="text-[12px] text-muted">
                      재질 출처:{" "}
                      <button
                        type="button"
                        disabled={(stream.materialEvidence ?? []).length === 0}
                        onClick={() => openEvidence(stream.materialEvidence ?? [], `${stream.name} 재질 표기`)}
                        className="underline decoration-line-strong decoration-dotted underline-offset-4 hover:decoration-ink"
                      >
                        포장 표기
                      </button>
                    </p>
                  ) : null}
                </td>
                <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                  <ClaimValue claim={stream.monthlyKg} />
                  {stream.monthlyKgBasis === "estimated" ? (
                    <p className="text-[12px] text-warn">추정</p>
                  ) : null}
                </td>
                <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                  {stream.contamination ? (
                    <>
                      <ClaimValue claim={stream.contamination} />
                      <Basis basis={stream.contaminationBasis} claim={stream.contamination} />
                    </>
                  ) : stream.photoContamination ? (
                    <>
                      <ClaimValue claim={stream.photoContamination} />
                      {stream.photoReliable === false ? (
                        <p className="text-[12px] text-warn">사진 추정 · 검증 안 됨</p>
                      ) : (
                        <p className="text-[12px] text-muted">사진 추정</p>
                      )}
                    </>
                  ) : (
                    <ClaimValue claim={null} />
                  )}
                </td>
                <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                  <ClaimValue claim={stream.moisture} />
                  {stream.moisture ? <Basis basis={stream.moistureBasis} claim={stream.moisture} /> : null}
                  {unknown.has("moisturePct") ? <p className="text-[12px] text-muted">담당자 답: 모름</p> : null}
                </td>
                <td className="py-2.5 pr-3">
                  {stream.grade.value ? (
                    <button
                      type="button"
                      disabled={stream.grade.evidence.length === 0}
                      onClick={() => openEvidence(stream.grade.evidence, `${stream.name} 등급`)}
                      className="font-semibold underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                    >
                      {stream.grade.value}
                    </button>
                  ) : (
                    <ClaimValue claim={null} />
                  )}
                  {stream.grade.value ? <p className="text-[12px] text-muted">{stream.grade.label}</p> : null}
                  {!stream.grade.value && stream.grade.reference ? (
                    <ReferenceGrade name={stream.name} reference={stream.grade.reference} />
                  ) : null}
                  {[...unknown].filter((item) => item !== "moisturePct").length > 0 ? (
                    <p className="text-[12px] text-muted">
                      모르는 값:{" "}
                      {[...unknown]
                        .filter((item) => item !== "moisturePct")
                        .map((item) => fieldLabel(item))
                        .join(", ")}
                    </p>
                  ) : null}
                </td>
                {showCurrent ? (
                  <td className="py-2.5 pr-3">
                    {stream.currentTreatment ? (
                      <>
                        {stream.currentTreatment.method}{" "}
                        {stream.currentTreatment.assumed ? (
                          <span className="rounded-sm bg-warn-bg px-1 py-px text-[11px] font-semibold text-warn">
                            가정값
                          </span>
                        ) : null}
                        {stream.currentTreatment.sale ? (
                          // 지금 재활용 업체에 팔고 받는 돈(현행 판매 단가)
                          <p className="text-[13px] whitespace-nowrap text-muted">
                            받는 돈 <ClaimValue claim={stream.currentTreatment.unitPrice ?? null} price={false} />
                          </p>
                        ) : (
                          <p className="text-[13px] whitespace-nowrap text-muted">
                            내는 돈 <ClaimValue claim={stream.currentTreatment.unitCost} price={false} />
                          </p>
                        )}
                        {stream.currentTreatment.billing?.text ? (
                          // 회당·월 정액 계약을 한 달 발생량으로 나눠 kg당으로 바꾼 값이다
                          <p className="text-[12px] text-muted">계약: {stream.currentTreatment.billing.text}</p>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                ) : null}
                {onCorrect ? (
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      aria-expanded={Boolean(open)}
                      className="text-[13px] font-semibold underline underline-offset-4"
                      onClick={() => setEditing(open ? null : stream.id)}
                    >
                      {open ? "닫기" : "고치기"}
                    </button>
                  </td>
                ) : null}
              </tr>
              {open || fixed.length > 0 ? (
                <tr className="border-b border-line last:border-b-0">
                  <td colSpan={columns} className="pb-3">
                    {fixed.length > 0 ? (
                      <ul className="space-y-0.5 text-[13px]">
                        {fixed.map((item) => (
                          <li key={item.id} className="flex flex-wrap items-center gap-x-2">
                            {/* 사람이 고친 것은 먹색 점, 원래 값은 취소선으로 남긴다 */}
                            <span aria-hidden="true" className="size-2 rounded-full bg-ink" />
                            <span className="font-semibold">
                              담당자 교정 · {CORRECTION_FIELD_LABEL[item.field] ?? item.field}
                            </span>
                            <span>
                              <s className="text-muted">{item.before ?? "값 없음"}</s> →{" "}
                              <button
                                type="button"
                                title="근거 보기"
                                className="font-semibold underline decoration-line-strong underline-offset-4"
                                onClick={() => openEvidence([item.id], "담당자 교정")}
                              >
                                {item.after ?? "값 없음"}
                              </button>
                            </span>
                            {item.note ? <span className="text-muted">{item.note}</span> : null}
                            <span className="tabular-nums text-[12px] text-muted">{item.recordedOn}</span>
                            <span className="text-[12px] text-muted">
                              {item.target === "detector" ? "사진 판정을 고치는 데 쓰임" : "등급 판정을 고치는 데 쓰임"} · 기록만
                              남고 위 값은 그대로입니다
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {open ? (
                      <div className={fixed.length > 0 ? "mt-2" : ""}>
                        <CorrectionForm stream={stream} onSubmit={onCorrect} onClose={() => setEditing(null)} />
                      </div>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
