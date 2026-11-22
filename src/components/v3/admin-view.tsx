"use client";

import { useState, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { particle } from "@/lib/josa";
import { api, API_BASE } from "@/lib/v3/api";
import { MoreDetails } from "@/components/ui/more-details";
import {
  CORRECTION_FIELD_LABEL,
  MESSAGE_LABEL,
  STATUS_LABEL,
  THREAD_LABEL,
  formatNumber,
  modelLabel,
} from "@/lib/v3/format";
import type { AdminStatus, EvalResult, RetrainExport, RetrainTable } from "@/lib/v3/types";
import { ClaimValue } from "./claim";
import { useV3 } from "./context";
import { useRemote } from "./use-remote";

const KIND_LABEL: Record<string, string> = {
  law: "법령",
  ref: "기준값",
  doc: "문서",
  measure: "측정값",
  model: "모델 판정",
  human: "사람 확인",
  calc: "계산",
  assumption: "가정값",
};
const SESSION_LABEL: Record<string, string> = {
  idle: "합의 없이 끝남",
  running: "실행 중",
  awaiting_answers: "담당자 답변 대기",
  awaiting_approval: "승인 대기",
  confirmed: "확정",
};

function Connected({ on, name }: { on: boolean; name: string }) {
  return (
    <span className={on ? "font-semibold text-ink" : "font-semibold text-warn"}>
      {on ? `${name} 연결됨` : `${name} 미연결`}
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function StatusBody({ status }: { status: AdminStatus }) {
  const { openEvidence } = useV3();
  const kinds = Object.entries(status.evidence.byKind);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5 text-sm">
        <Row label="기준일">
          <span className="tabular-nums">{status.today}</span>
        </Row>
        {status.auth ? (
          <Row label="인증 모드">
            {status.auth.mode === "header" ? (
              <span className="font-semibold text-warn">
                X-Org-Id 머리글을 그대로 믿음{status.auth.demoOnly ? " (시연 전용)" : ""}
              </span>
            ) : status.auth.mode === "bff" ? (
              <span className="font-semibold">프런트 서버 키와 로그인한 사용자·회사 머리글</span>
            ) : status.auth.mode === "token" ? (
              <span className="font-semibold">회사별 서비스 토큰</span>
            ) : (
              <span className="font-semibold">확인 필요</span>
            )}{" "}
            <span className="tabular-nums text-[12px] text-muted">{status.auth.mode}</span>
          </Row>
        ) : null}
        <Row label="회사 측 AI">
          <span className={status.models.company.provider === "rule" ? "font-semibold text-warn" : "font-semibold"}>
            {modelLabel(status.models.company)}
          </span>
          {status.models.llmFactory ? "" : " · 이 서버에는 모델이 연결되지 않았습니다"}
        </Row>
        <Row label="법령 조항">
          <span className="tabular-nums">{status.laws.count}</span>건 · 최신 기준일{" "}
          <span className="tabular-nums">{status.laws.latestAsOf ?? "확인 필요"}</span>
        </Row>
        <Row label="볼 수 있는 근거">
          <span className="tabular-nums">{status.evidence.visible}</span>건 (
          {kinds.map(([kind, count]) => `${KIND_LABEL[kind] ?? kind} ${count}`).join(" · ")})
        </Row>
        <Row label="근거가 없는 기준">
          {status.missingBasis.length === 0 ? (
            "없음"
          ) : (
            <span className="text-warn">
              <span className="tabular-nums">{status.missingBasis.join(", ")}</span> · 이 값이 필요한 계산은
              &ldquo;확인 필요&rdquo;로 남습니다
            </span>
          )}
        </Row>
        <Row label="외부 서비스">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <Connected on={status.promptShields.configured} name="Prompt Shields" />
            <Connected on={status.documentIntelligence.configured} name="Document Intelligence" />
            <Connected on={status.gradeEndpoint.configured} name="등급 모델 엔드포인트" />
            <Connected on={Boolean(status.detector?.configured)} name="탐지 모델(Azure ML)" />
            <Connected on={status.distance.provider} name="도로 거리(Azure Maps)" />
          </span>
        </Row>
        {status.detector?.configured ? null : (
          <Row label="탐지 모델">
            <span className="text-warn">
              미연결. 사용자가 올린 사진·영상은 분석하지 않고 &ldquo;이 파일은 분석하지 못했습니다&rdquo;로 안내합니다.
            </span>
          </Row>
        )}
        <Row label="실행 구성">
          <span className="tabular-nums text-[13px]">
            {status.vendorGateway} · {status.store}
          </span>
        </Row>
      </dl>
      <div>
        <h3 className="text-label text-muted">기준값 스냅숏 ({status.references.length}건)</h3>
        {status.references.length === 0 ? (
          <p className="mt-1 text-sm text-muted">등록된 기준값이 없습니다.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line text-sm">
            {status.references.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-x-4 py-1.5">
                <button
                  type="button"
                  className="text-left underline underline-offset-4"
                  onClick={() => openEvidence([item.id], item.label)}
                >
                  {item.label}
                </button>
                <span className="text-[13px] text-muted">기준일 <span className="tabular-nums">{item.asOf}</span></span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const rate = (value: number | null | undefined) => (value == null ? "확인 필요" : `${(value * 100).toFixed(1)}%`);

/** 사례 세트(50건)의 결과: 판정 일치율, 검증기 통과율, 금지 위반, 사례별 표 */
function CaseSet({ cases }: { cases: NonNullable<EvalResult["cases"]> }) {
  const { summary, results } = cases;
  const bad = results.filter(
    (item) => !item.verdictMatch || item.forbiddenViolations.length > 0 || item.error || item.open,
  );
  return (
    <div className="space-y-3">
      <h3 className="text-label text-muted">사례 세트 {summary.caseCount}건</h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="text-[13px] text-muted">판정 일치율</dt>
          <dd className="tabular-nums text-xl font-semibold tabular-nums">{rate(summary.verdictMatchRate)}</dd>
          <dd className="tabular-nums text-[13px] text-muted">
            {summary.verdictMatched}/{summary.caseCount}건
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">근거 검증기 통과율</dt>
          <dd className="tabular-nums text-xl font-semibold tabular-nums">{rate(summary.validatorPassRate)}</dd>
          <dd className="tabular-nums text-[13px] text-muted">
            {summary.validatorPassed}/{summary.validatorChecked}건
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">금지 위반</dt>
          <dd
            className={`tabular-nums text-xl font-semibold tabular-nums ${summary.forbiddenViolationCount > 0 ? "text-loss" : ""}`}
          >
            {summary.forbiddenViolationCount}건
          </dd>
          <dd className="text-[13px] text-muted">가드레일·허가 품목·승인 전 확정·조직 경계 등</dd>
        </div>
        <div>
          <dt className="text-[13px] text-muted">설계 판단이 남은 사례</dt>
          <dd className="text-xl font-semibold tabular-nums"><span className="tabular-nums">{summary.openCount}</span>건</dd>
          <dd className="text-[13px] text-muted">
            다시 쓴 횟수 {summary.rewritten ?? 0} · 담당자 인계 {summary.handedOff ?? 0}
          </dd>
        </div>
      </dl>
      <p className="text-[13px] text-muted">
        사례의 수치는 모두 가상이고 검토 상태는{" "}
        {Object.entries(summary.reviewCounts)
          .map(([name, count]) => `${name} ${count}건`)
          .join(", ")}
        입니다(전문가 검토 전). 대화를 쓴 구현:{" "}
        <span className={cases.model.provider === "rule" ? "font-semibold text-warn" : "font-semibold"}>
          {modelLabel(cases.model)}
        </span>
        .
      </p>
      {bad.length > 0 ? (
        <p className="text-sm text-loss">
          기대와 다르거나 오류가 난 사례 {bad.length}건: {bad.map((item) => item.id).join(", ")}
        </p>
      ) : null}
      <MoreDetails label="사례별 표 보기" closeLabel="사례별 표 접기" hint={`${results.length}건`}>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-line-strong text-left text-muted">
                <th className="py-1 pr-3">사례</th>
                <th className="py-1 pr-3">내용</th>
                <th className="py-1 pr-3">검토 상태</th>
                <th className="py-1 pr-3">판정</th>
                <th className="py-1 pr-3 text-right">검증기 통과</th>
                <th className="py-1 text-right">금지 위반</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item) => (
                <tr key={item.id} className="border-b border-line align-top">
                  <td className="py-1.5 pr-3 font-medium tabular-nums">{item.id}</td>
                  <td className="py-1.5 pr-3">
                    {item.title}
                    {item.error ? <span className="block text-loss">오류: {item.error}</span> : null}
                    {item.open ? (
                      <span className="block text-warn">설계 판단 필요{item.openNote ? `: ${item.openNote}` : ""}</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-3 text-muted">{item.review}</td>
                  <td className={`py-1.5 pr-3 font-semibold ${item.verdictMatch ? "" : "text-loss"}`}>
                    {item.verdictMatch ? "✓ 일치" : `✕ 불일치 ${item.mismatches.length}건`}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    {item.validator.passed}/{item.validator.checked}
                  </td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${item.forbiddenViolations.length > 0 ? "font-semibold text-loss" : ""}`}
                  >
                    {item.forbiddenViolations.length}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </MoreDetails>
    </div>
  );
}

function EvalBody({ result }: { result: EvalResult }) {
  const { orgs } = useV3();
  const passRate = result.validatorPassRate;
  return (
    <div className="space-y-5 text-sm">
      {result.cases ? <CaseSet cases={result.cases} /> : null}
      <div className="space-y-3">
      <h3 className="text-label text-muted">시연 시나리오 한 건</h3>
      <p className="text-ink-2">{result.scenario}</p>
      <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1.5">
        <Row label="대화를 쓴 구현">
          <span className={result.model.provider === "rule" ? "font-semibold text-warn" : "font-semibold"}>
            {modelLabel(result.model)}
          </span>
          {result.model.provider === "rule" ? " · 모델 호출 없이 돈 결과입니다" : ""}
        </Row>
        <Row label="근거 검증기 통과">
          <span className="font-medium tabular-nums">
            {result.passed}/{result.checked}
          </span>
          {passRate != null ? <span className="tabular-nums"> ({rate(passRate)})</span> : null} · 다시 쓴 횟수{" "}
          <span className="tabular-nums">{result.rewritten}</span>
        </Row>
        <Row label="끝난 상태">
          {SESSION_LABEL[result.sessionStatus] ?? result.sessionStatus} · 결과{" "}
          {result.resultStatus ? STATUS_LABEL[result.resultStatus] : "확인 필요"}
        </Row>
      </dl>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line-strong text-left text-muted">
            <th className="py-1 pr-3">업체</th>
            <th className="py-1 pr-3">대화 상태</th>
            <th className="py-1 pr-3">답한 구현 (설정)</th>
            <th className="py-1">오간 메시지 종류</th>
          </tr>
        </thead>
        <tbody>
          {result.threads.map((thread, index) => (
            <tr key={index} className="border-b border-line align-top">
              <td className="py-1.5 pr-3 font-semibold">
                {orgs.find((item) => item.id === thread.vendorOrgId)?.name ?? thread.vendorOrgId}
              </td>
              <td className="py-1.5 pr-3">{THREAD_LABEL[thread.status] ?? thread.status}</td>
              <td className="py-1.5 pr-3">
                {modelLabel(thread.vendorModel)}
                {thread.vendorModel.configured ? (
                  <span className="text-muted"> (설정: {modelLabel(thread.vendorModel.configured)})</span>
                ) : null}
              </td>
              <td className="py-1.5">
                {thread.types.length === 0
                  ? "-"
                  : thread.types.map((type) => MESSAGE_LABEL[type] ?? type).join(" → ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * 재학습 표: 쌓인 실제 등급 라벨과 교정, 배포 게이트 판정, 실제 단가와 기준표의 차이, 모델 버전.
 * 서버가 준 건수와 판정만 적는다. 쌓인 것이 없으면 빈 상태 그대로 보여 준다.
 */
function RetrainBody({ retrain, orgId, today }: { retrain: RetrainTable; orgId: string; today: string }) {
  const { orgs } = useV3();
  const [exported, setExported] = useState<{ busy: boolean; data: RetrainExport | null; error: string | null }>({
    busy: false,
    data: null,
    error: null,
  });
  const { gate } = retrain;
  const empty = retrain.gradeLabels.count === 0 && retrain.outcomes.count === 0 && retrain.corrections.count === 0;
  const byField = Object.entries(retrain.corrections.byField);
  const orgName = (id: string) => orgs.find((item) => item.id === id)?.name ?? id;
  const runExport = async () => {
    setExported({ busy: true, data: null, error: null });
    try {
      const data = await api.retrainExport(orgId);
      download(`retrain-export-${today}.json`, data);
      setExported({ busy: false, data, error: null });
    } catch (error) {
      setExported({
        busy: false,
        data: null,
        error: error instanceof Error ? error.message : "내보내지 못했습니다.",
      });
    }
  };
  return (
    <div className="space-y-5 text-sm">
      {empty ? (
        <p className="rounded-md border border-dashed border-line-strong px-4 py-3 text-muted">
          아직 쌓인 재학습 데이터가 없습니다. 진단 화면의 사람 교정과, 업체가 확정 뒤 기록한 실제 결과가 쌓이면 아래
          표에 나옵니다.
        </p>
      ) : null}
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line-strong text-left text-muted">
            <th className="py-1 pr-3">쌓인 데이터</th>
            <th className="py-1 pr-3 text-right">건수</th>
            <th className="py-1">내용</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-line align-top">
            <td className="py-1.5 pr-3 font-semibold">실제 결과 기록</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{retrain.outcomes.count}</td>
            <td className="py-1.5 text-muted">업체가 확정 뒤 기록한 실제 등급·단가·중량</td>
          </tr>
          <tr className="border-b border-line align-top">
            <td className="py-1.5 pr-3 font-semibold">실제 등급 라벨</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{retrain.gradeLabels.count}</td>
            <td className="py-1.5">
              학습에 쓸 수 있는 행 <span className="font-medium tabular-nums">{retrain.gradeLabels.usable}</span> · 값이
              빠진 행 <span className="font-medium tabular-nums">{retrain.gradeLabels.incomplete}</span>
              <span className="block text-muted">{retrain.gradeLabels.note}</span>
            </td>
          </tr>
          <tr className={`align-top ${retrain.demo ? "border-b border-line" : ""}`}>
            <td className="py-1.5 pr-3 font-semibold">사람 교정</td>
            <td className="py-1.5 pr-3 text-right tabular-nums">{retrain.corrections.count}</td>
            <td className="py-1.5">
              탐지 모델 재학습 후보{" "}
              <span className="font-medium tabular-nums">{retrain.corrections.detectorCandidates}</span>
              {byField.length > 0 ? (
                <span className="block text-muted">
                  {byField.map(([name, count]) => `${CORRECTION_FIELD_LABEL[name] ?? name} ${count}`).join(" · ")}
                </span>
              ) : null}
            </td>
          </tr>
          {retrain.demo ? (
            <tr className="align-top text-muted">
              <td className="py-1.5 pr-3 font-semibold">시연 기록</td>
              <td className="py-1.5 pr-3 text-right tabular-nums">{retrain.demo.outcomes + retrain.demo.corrections}</td>
              <td className="py-1.5">
                실제 결과 <span className="tabular-nums">{retrain.demo.outcomes}</span> · 등급 행{" "}
                <span className="tabular-nums">{retrain.demo.gradeLabels}</span> · 교정{" "}
                <span className="tabular-nums">{retrain.demo.corrections}</span>
                <span className="block">{retrain.demo.note}</span>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="rounded-md border border-ink p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-label text-muted">배포 게이트</h3>
          <span
            className={`inline-flex h-[26px] items-center rounded-full px-2.5 text-[13px] font-semibold ${gate.allowed ? "bg-ink text-on-ink" : "bg-warn-bg text-warn"}`}
          >
            {gate.allowed ? "배포 가능" : "배포 보류"}
          </span>
        </div>
        <p className="mt-2">{gate.reason}</p>
        <dl className="mt-2 grid grid-cols-[11rem_1fr] gap-x-4 gap-y-1 text-[13px]">
          <dt className="text-muted">실제 등급 기록</dt>
          <dd>
            {gate.realLabelCount === 0 ? (
              "아직 없습니다"
            ) : (
              <><span className="tabular-nums">{gate.realLabelCount}</span>건</>
            )}{" "}
            <span>(기준 <span className="tabular-nums">{gate.minRealLabels}</span>건 이상)</span>
          </dd>
          {gate.demoLabelCount ? (
            <>
              <dt className="text-muted">시연 등급 행</dt>
              <dd>
                <span className="tabular-nums">{gate.demoLabelCount}</span>건 <span className="text-muted">(가상 회사 기록이라 세지 않음)</span>
              </dd>
            </>
          ) : null}
          <dt className="text-muted">평가한 것</dt>
          <dd>
            {gate.evaluated ? (
              <>
                {gate.evaluated.model} · {gate.evaluated.label} <span className="tabular-nums">{gate.evaluated.n}</span>건
                · 정확도{" "}
                <span className="font-medium tabular-nums">
                  {gate.evaluated.accuracy == null ? "확인 필요" : rate(gate.evaluated.accuracy)}
                </span>{" "}
                <span className="text-muted">(기준 {rate(gate.minAccuracy)} 이상)</span>
              </>
            ) : (
              <span className="text-warn">평가한 것이 없습니다 · 확인 필요</span>
            )}
          </dd>
        </dl>
      </div>

      <div>
        <h3 className="text-label text-muted">실제 단가와 매입 기준표의 차이 ({retrain.calibration.count}건)</h3>
        <p className="mt-1 text-[13px] text-muted">
          {retrain.calibration.note}
        </p>
        {retrain.calibration.groups.length === 0 ? (
          <p className="mt-1 text-muted">기록된 실제 단가가 없습니다.</p>
        ) : (
          <table className="mt-2 w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-muted">
                <th className="py-1 pr-3">폐기물 · 업체 · 기준</th>
                <th className="py-1 pr-3">검수일</th>
                <th className="py-1 pr-3 text-right">기준표 단가</th>
                <th className="py-1 pr-3 text-right">실제 단가</th>
                <th className="py-1 text-right">차이</th>
              </tr>
            </thead>
            <tbody>
              {retrain.calibration.groups.flatMap((group) =>
                group.items.map((item, index) => (
                  <tr key={`${group.streamId}-${group.vendorOrgId}-${index}`} className="border-b border-line">
                    <td className="py-1.5 pr-3">
                      <span className="tabular-nums">{group.streamId}</span> · {orgName(group.vendorOrgId)}
                      {group.criterionId ? <span className="tabular-nums text-muted"> · {group.criterionId}</span> : null}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">{item.inspectedOn}</td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                      <ClaimValue claim={item.tablePrice} price />
                    </td>
                    <td className="py-1.5 pr-3 text-right whitespace-nowrap">
                      <ClaimValue claim={item.actualPrice} price />
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <ClaimValue claim={item.difference} signed />
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h3 className="text-label text-muted">모델 버전 ({retrain.modelVersions.length}건)</h3>
        {retrain.modelVersions.length === 0 ? (
          <p className="mt-1 text-muted">
            등록된 재학습 실행이 없습니다. Azure ML 재학습 작업이 결과를 등록하면 여기에 나옵니다. 점수를 만들어 채우지
            않습니다.
          </p>
        ) : (
          <table className="mt-2 w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-strong text-left text-muted">
                <th className="py-1 pr-3">모델 · 버전</th>
                <th className="py-1 pr-3">학습일</th>
                <th className="py-1 pr-3">학습 데이터</th>
                <th className="py-1 pr-3">지표</th>
                <th className="py-1 pr-3">게이트</th>
                <th className="py-1">배포</th>
              </tr>
            </thead>
            <tbody>
              {retrain.modelVersions.map((item, index) => (
                <tr key={`${item.model}-${item.version}-${index}`} className="border-b border-line align-top">
                  <td className="py-1.5 pr-3">
                    <span className="font-semibold">{item.model}</span>{" "}
                    <span className="tabular-nums">{item.version}</span>
                    {item.runId ? <span className="block tabular-nums text-[12px] text-muted">{item.runId}</span> : null}
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums">{item.trainedOn ?? "확인 필요"}</td>
                  <td className="py-1.5 pr-3">
                    {item.dataBasis ?? "확인 필요"}
                    <span className="block tabular-nums text-[12px] text-muted">
                      실제 {item.realLabelCount ?? "?"} · 합성 {item.syntheticCount ?? "?"}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 tabular-nums text-[12px]">
                    {Object.entries(item.metrics ?? {}).length === 0
                      ? "-"
                      : Object.entries(item.metrics ?? {})
                          .map(([name, value]) => `${name} ${typeof value === "number" ? formatNumber(value) : String(value)}`)
                          .join(" · ")}
                  </td>
                  <td className="py-1.5 pr-3">
                    {item.gate ? (
                      <>
                        <span className={`font-semibold ${item.gate.allowed ? "" : "text-warn"}`}>
                          {item.gate.allowed ? "통과" : "보류"}
                        </span>
                        <span className="block text-muted">{item.gate.reason}</span>
                      </>
                    ) : (
                      "확인 필요"
                    )}
                  </td>
                  <td className="py-1.5">{item.deployed ? "배포됨" : "배포 안 함"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button size="sm" variant="secondary" disabled={exported.busy} onClick={runExport}>
          {exported.busy ? "내보내는 중" : "재학습 데이터 내보내기"}
        </Button>
        <span className="text-[13px] text-muted">
          {exported.error ? (
            <span className="text-loss">{exported.error}</span>
          ) : exported.data ? (
            <>
              JSON 파일로 받았습니다: 실제 등급 학습 행{" "}
              <span className="font-medium tabular-nums text-ink">{exported.data.gradeLabels.length}</span> · 탐지 교정{" "}
              <span className="font-medium tabular-nums text-ink">{exported.data.detectionCorrections.length}</span>
              {exported.data.demo ? (
                <>
                  {" "}
                  · 시연 행 <span className="tabular-nums">{exported.data.demo.gradeLabels.length}</span>(따로 표시, 학습 제외)
                </>
              ) : null}
            </>
          ) : (
            "실제 등급 학습 행과 탐지 교정을 JSON 파일로 받습니다(GET /admin/retrain/export). 여러 조직의 기록이 들어 있습니다."
          )}
        </span>
      </div>
    </div>
  );
}

export function AdminView() {
  const { mode, org, memberships, setOrgId, switching, setSessionId, reconnect } = useV3();
  const live = mode === "live";
  // 운영 주소(/admin/*)는 운영 회사로만 부른다. 다른 회사로 보고 있으면 부르지 않고 운영 회사로 바꾸라고 안내한다
  const isAdmin = org.role === "admin";
  const adminOrg = memberships.find((item) => item.kind === "admin");
  const health = useRemote("health", live, () => api.health());
  const status = useRemote(`admin:${org.id}`, live && isAdmin, () => api.adminStatus(org.id));
  const [evalState, setEvalState] = useState<{ busy: boolean; result: EvalResult | null; error: string | null }>({
    busy: false,
    result: null,
    error: null,
  });
  const [reset, setReset] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });

  const runEval = async () => {
    setEvalState({ busy: true, result: null, error: null });
    try {
      setEvalState({ busy: false, result: await api.adminEval(org.id), error: null });
    } catch (error) {
      setEvalState({
        busy: false,
        result: null,
        error: error instanceof Error ? error.message : "사례 시험을 실행하지 못했습니다.",
      });
    }
  };

  const resetDemo = async () => {
    setReset({ busy: true, note: null });
    try {
      await api.resetDemo(org.id);
      setSessionId(null);
      status.reload();
      setReset({ busy: false, note: "시연 데이터를 처음 상태로 되돌렸습니다. 진행하던 진단과 쌓인 교정·실제 결과는 지워졌습니다." });
    } catch (error) {
      setReset({ busy: false, note: error instanceof Error ? error.message : "되돌리지 못했습니다." });
    }
  };

  const unavailable =
    mode === "loading" ? (
      <p className="text-sm text-muted">불러오는 중입니다.</p>
    ) : !live ? (
      <p className="text-sm text-muted">서버에 닿지 못해 상태를 읽을 수 없습니다.</p>
    ) : status.loading ? (
      <p className="text-sm text-muted">불러오는 중입니다.</p>
    ) : status.error ? (
      <p className="text-sm text-loss">{status.error}</p>
    ) : null;

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-h1">운영</h1>
        <p className="mt-1 text-sm text-muted">
          기준값과 법령 색인 상태, 외부 서비스 연결, 사례 시험, 재학습 데이터와 배포 게이트를 봅니다.
        </p>
      </header>

      {live && isAdmin && status.data?.auth?.mode === "header" ? (
        <div role="alert" className="rounded-md border border-warn bg-warn-bg px-4 py-3 text-sm font-semibold text-warn">
          시연용 인증 모드(X-Org-Id 머리글을 그대로 믿음)입니다. 공개 주소에 그대로 두면 회사 경계가 지켜지지 않습니다
        </div>
      ) : null}

      <section className="rounded-xl border border-line p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-h2">서버 연결</h2>
            <p className="mt-1 text-sm">
              <span className="tabular-nums text-[13px] break-all">{API_BASE}</span> ·{" "}
              {mode === "loading" ? (
                "연결하는 중"
              ) : !live ? (
                <span className="font-semibold text-warn">연결 안 됨</span>
              ) : health.loading ? (
                "확인 중"
              ) : health.error ? (
                <span className="font-semibold text-loss">상태 확인 실패: {health.error}</span>
              ) : (
                <span className="font-semibold">상태 확인 통과 (GET /health)</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={live ? health.reload : reconnect}>
              {live ? "다시 확인" : "다시 연결"}
            </Button>
            {isAdmin ? (
              <Button size="sm" variant="secondary" disabled={!live || reset.busy} onClick={resetDemo}>
                시연 데이터 처음 상태로
              </Button>
            ) : null}
          </div>
        </div>
        {reset.note ? <p className="mt-2 text-[13px] text-ink-2">{reset.note}</p> : null}
      </section>

      {live && !isAdmin ? (
        <section role="status" className="rounded-xl border border-ink p-5">
          <h2 className="text-h2">운영 계정으로 들어와 주세요</h2>
          <p className="mt-1 text-sm text-ink-2">
            지금은 <span className="font-semibold">{org.name}</span>
            {particle(org.name, "으로/로")} 보고 있습니다. 운영 화면에는 여러 회사의 기록이 섞여 있어
            운영 회사의 구성원만 볼 수 있습니다.
          </p>
          <div className="mt-4">
            {adminOrg ? (
              <Button disabled={switching} onClick={() => setOrgId(adminOrg.orgId)}>
                운영 회사로 바꾸기 ({adminOrg.orgName})
              </Button>
            ) : (
              <ButtonLink href="/app/find">찾기 화면으로</ButtonLink>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-line p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-h2">기준값·법령 색인 상태</h2>
              <Button size="sm" variant="secondary" disabled={!live} onClick={status.reload}>
                다시 읽기
              </Button>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              운영 조직이 볼 수 있는 근거(법령·기준값·가정값)를 셉니다. 조직별 문서와 측정값은 그 조직과 대화 상대만
              보므로 여기에 세지 않습니다. 색인 다시 만들기는 이 화면에서 하지 않고 상태만 봅니다.
            </p>
            <div className="mt-3">{unavailable ?? (status.data ? <StatusBody status={status.data} /> : null)}</div>
          </section>

          <section className="rounded-xl border border-line p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-h2">사례 시험</h2>
                <p className="mt-1 text-sm text-muted">
                  평가 사례 세트와 시연 시나리오를 따로 만든 저장소에서 처음부터 끝까지 돌리고, 판정 일치율과 근거
                  검증기 통과율을 냅니다. 진행 중인 진단은 바뀌지 않습니다.
                </p>
              </div>
              <Button size="sm" variant="secondary" disabled={!live || evalState.busy} onClick={runEval}>
                {evalState.busy ? "실행 중" : "사례 시험 실행"}
              </Button>
            </div>
            <div className="mt-3">
              {evalState.error ? (
                <p className="text-sm text-loss">{evalState.error}</p>
              ) : evalState.result ? (
                <EvalBody result={evalState.result} />
              ) : (
                <p className="text-sm text-muted">아직 실행한 결과가 없습니다.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-line p-5">
            <h2 className="text-h2">재학습</h2>
            <p className="mt-1 text-[13px] text-muted">
              사람이 고친 값과 업체가 기록한 실제 결과가 재학습 데이터로 쌓입니다. 아래 숫자는 서버가 센 건수와
              판정이고, 재학습한 모델의 점수는 등록된 실행에서만 나옵니다.
            </p>
            <div className="mt-3">
              {unavailable ??
                (status.data?.retrain ? (
                  <RetrainBody retrain={status.data.retrain} orgId={org.id} today={status.data.today} />
                ) : (
                  <p className="text-sm text-muted">이 서버는 재학습 표를 주지 않았습니다.</p>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
