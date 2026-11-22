"use client";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { useV3 } from "@/components/v3/context";
import { useRemote } from "@/components/v3/use-remote";
import { loadVendorProfile } from "@/components/v3/materials-view";
import { api } from "@/lib/v3/api";
import {
  FACT_LABELS,
  monthInSeoul,
  narrower,
  rangeText,
  type RangeQuote,
  type SharedPhoto,
  type SurveyData,
} from "@/lib/v3/survey";
import type { StreamRecord, VendorProfile } from "@/lib/v3/types";
import { navSpot } from "@/components/agent/nav-spot";

const field =
  "min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-[15px] tabular-nums";
const label = "flex flex-col gap-1.5 text-[13px] font-medium text-ink-2";
const section = "space-y-4 border-t border-line py-7";
// 파일 고르기는 브라우저 기본 칸 대신 다른 화면과 같은 단추로 보인다(화면 규칙)
const pick = `${buttonClass("secondary", "sm")} w-fit cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent`;

function VendorRanges({
  profile,
  refresh,
}: {
  profile: VendorProfile;
  refresh: () => void;
}) {
  const { org } = useV3();
  const [criteria, setCriteria] = useState(profile.criteria);
  const [policy, setPolicy] = useState(profile.collectionPolicy ?? "combined");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await api.putVendor(org.id, {
        ...profile,
        criteria,
        collectionPolicy: policy,
      });
      setMessage(
        "공개할 조건을 저장했습니다. 내부 협상 한도는 업체 정보에서 별도로 정합니다.",
      );
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  function set(index: number, key: string, value: string) {
    setCriteria(
      criteria.map((c, i) =>
        i === index
          ? {
              ...c,
              [key]: ["priceLow", "priceHigh", "unitPriceKrwPerKg"].includes(
                key,
              )
                ? value.trim()
                  ? Number(value)
                  : null
                : value,
            }
          : c,
      ),
    );
  }
  return (
    <section {...navSpot("public-terms", "공개할 매입 조건", "이 화면")} className={section}>
      <h2 className="text-xl font-semibold">공개할 매입 조건</h2>
      <p className="text-sm text-muted">
        범위로 등록하면 상대에게 범위만 보이고 확정 손익에는 쓰지 않습니다.
        거래마다 자료를 확인하며 좁혀 주세요. 범위는 배출 기업이 받는 돈
        기준이고, 처리비는 음수로 적습니다.
      </p>
      <label className={label}>
        수거 판단 기준
        <select
          className={field}
          value={policy}
          onChange={(e) => setPolicy(e.target.value as typeof policy)}
        >
          <option value="quantity">최소 물량 중심</option>
          <option value="distance_vehicle">
            거리·차량 중심 (최소 물량 기준 없음)
          </option>
          <option value="combined">물량과 거리·차량 병행</option>
        </select>
      </label>
      <p className="text-sm text-muted">
        거리·차량 중심이어도 업체 정보에 적은 수거 가능 지역·거리·적재 용량은
        계속 확인합니다.
      </p>
      {criteria.map((c, i) => (
        <fieldset
          key={c.id}
          className="grid gap-3 border border-line p-4 sm:grid-cols-3"
        >
          <legend className="px-1 text-sm">
            {c.material || "새 기준"} · {c.grade || "등급 미지정"}
          </legend>
          <label className={label}>
            재질
            <input
              className={field}
              value={c.material}
              onChange={(e) => set(i, "material", e.target.value.toUpperCase())}
              placeholder="PP"
            />
          </label>
          <label className={label}>
            등급
            <input
              className={field}
              value={c.grade ?? ""}
              onChange={(e) => set(i, "grade", e.target.value)}
              placeholder="A"
            />
          </label>
          <label className={label}>
            형태
            <input
              className={field}
              value={c.form ?? ""}
              onChange={(e) => set(i, "form", e.target.value)}
              placeholder="분쇄"
            />
          </label>
          <label className={label}>
            공개 범위 하한 (원/kg)
            <input
              className={field}
              inputMode="decimal"
              value={c.priceLow ?? ""}
              onChange={(e) => set(i, "priceLow", e.target.value)}
            />
          </label>
          <label className={label}>
            공개 범위 상한 (원/kg)
            <input
              className={field}
              inputMode="decimal"
              value={c.priceHigh ?? ""}
              onChange={(e) => set(i, "priceHigh", e.target.value)}
            />
          </label>
          <p className="self-end text-sm text-muted">
            {c.priceLow != null
              ? "거래 단가는 문의별로 확인합니다."
              : "범위를 비우면 기존 단일 단가를 유지합니다."}
          </p>
        </fieldset>
      ))}
      <Button
        variant="ghost"
        onClick={() =>
          setCriteria([
            ...criteria,
            {
              id: `pc_${crypto.randomUUID()}`,
              material: "PP",
              grade: "",
              form: null,
              priceLow: null,
              priceHigh: null,
              unitPriceKrwPerKg: null,
              minMonthlyKg: null,
              maxContaminationPct: null,
              maxMoisturePct: null,
              evidence: [],
            },
          ])
        }
      >
        품목 추가
      </Button>
      <Button variant="secondary" disabled={busy} onClick={save}>
        {busy ? "저장 중" : "공개 조건 저장"}
      </Button>
      {message && (
        <p role="status" className="text-sm text-ink-2">
          {message}
        </p>
      )}
    </section>
  );
}

function QuoteCard({
  quote: q,
  refresh,
}: {
  quote: RangeQuote;
  refresh: () => void;
}) {
  const { org, openEvidence, basePath } = useV3();
  const mine = q.vendorOrgId === org.id;
  const [low, setLow] = useState(String(q.low));
  const [high, setHigh] = useState(String(q.high));
  const [confirmed, setConfirmed] = useState(q.confirmed);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(accept = false) {
    setBusy(true);
    setMessage("");
    try {
      await api.survey(
        org.id,
        `/quotes/${q.id}/${accept ? "accept" : "narrow"}`,
        {
          revision: q.revision,
          low: Number(low),
          high: Number(high),
          confirmed,
          reason,
        },
      );
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "변경하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="space-y-3 border border-line p-4">
      <h3 className="font-semibold">
        {q.streamName} · {q.vendorName}
      </h3>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg tabular-nums">{rangeText(q.low, q.high)}</span>
        <span className="text-sm text-muted">
          {q.stale
            ? "자료 변경 · 새 문의 필요"
            : q.status === "accepted"
              ? "제안 수락 · 거래 확정 전"
              : q.status === "offered"
                ? "단일 단가 제안 · 상대 확인 대기"
                : "범위 확인 중"}
        </span>
        <button
          className="min-h-11 text-sm underline"
          onClick={() => openEvidence(q.evidence, "단가 범위의 근거")}
        >
          근거
        </button>
      </div>
      <p className="text-sm text-muted">
        {String(q.facts.material ?? "재질 미확인")} ·{" "}
        {String(q.facts.form ?? "형태 미확인")} · 월{" "}
        {q.facts.monthlyKg == null
          ? "물량 미확인"
          : `${String(q.facts.monthlyKg)} kg (${q.facts.monthlyKgBasis === "measured" ? "계량" : "추정"})`}
      </p>
      <p className="text-sm text-muted">
        오염도{" "}
        {q.quality.contaminationPct == null
          ? "미확인"
          : `${String(q.quality.contaminationPct)}% (${String(q.quality.contaminationBasis) === "measured" ? "측정" : "추정·담당자 답"})`}{" "}
        · 수분{" "}
        {q.quality.moisturePct == null
          ? "미확인"
          : `${String(q.quality.moisturePct)}%`}
      </p>
      {q.history.length > 0 && (
        <details>
          <summary className="min-h-11 cursor-pointer text-sm">
            범위를 좁힌 이유와 이전 값
          </summary>
          <ol className="space-y-2 text-sm text-ink-2">
            {q.history.map((h, i) => (
              <li key={i}>
                {rangeText(h.low, h.high)} → {h.reason}
              </li>
            ))}
          </ol>
        </details>
      )}
      {q.route && (
        <details>
          <summary className="min-h-11 cursor-pointer text-sm">
            기존 확정 방문에 추가했을 때
          </summary>
          <p className="text-sm text-muted">{q.route.note}</p>
          <dl className="my-3 grid grid-cols-2 gap-2 text-sm">
            {[
              ...Object.entries(q.route.cost).filter(([k]) =>
                ["extraKm", "extraCost", "trips"].includes(k),
              ),
              ...Object.entries(q.route.loading).filter(([k]) =>
                [
                  "perPickupKg",
                  "capacityKg",
                  "perPickupM3",
                  "capacityM3",
                  "remainingKg",
                ].includes(k),
              ),
            ].map(([k, c]) => (
              <div key={k}>
                <dt>
                  {
                    (
                      {
                        extraKm: "추가 거리",
                        extraCost: "추가 운행비",
                        trips: "운행 횟수",
                        perPickupKg: "회당 무게",
                        capacityKg: "차량 적재 중량",
                        perPickupM3: "회당 부피",
                        capacityM3: "차량 적재 부피",
                        remainingKg: "추가 적재 후 여유 (같은 회차 가정)",
                      } as Record<string, string>
                    )[k]
                  }
                </dt>
                <dd>
                  <button
                    className="min-h-11 tabular-nums underline decoration-dotted"
                    onClick={() => openEvidence(c.evidence, "노선·적재 계산")}
                  >
                    {c.value.toLocaleString()} {c.unit}
                  </button>
                </dd>
              </div>
            ))}
          </dl>
          {q.route.checks
            .filter((c) => c.status !== "met")
            .map((c, i) => (
              <p key={i} className="text-sm text-warn">
                {c.text}
              </p>
            ))}
        </details>
      )}
      {mine && !q.stale && q.status !== "accepted" && (
        <div className="space-y-3 border-t border-line pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              새 하한 (원/kg)
              <input
                className={field}
                value={low}
                onChange={(e) => setLow(e.target.value)}
              />
            </label>
            <label className={label}>
              새 상한 (원/kg)
              <input
                className={field}
                value={high}
                onChange={(e) => setHigh(e.target.value)}
              />
            </label>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm">
              담당자가 실제로 확인한 항목
            </legend>
            {Object.entries(FACT_LABELS).map(([k, title]) => (
              <label
                key={k}
                className="flex min-h-11 items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={confirmed.includes(k)}
                  onChange={(e) =>
                    setConfirmed(
                      e.target.checked
                        ? [...confirmed, k]
                        : confirmed.filter((x) => x !== k),
                    )
                  }
                />
                {title}
              </label>
            ))}
          </fieldset>
          <label className={label}>
            확인 내용·범위를 좁힌 이유
            <textarea
              className={`${field} py-2`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </label>
          <p className="text-sm text-muted">
            AI의 확인으로 표시하지 않습니다. 담당자가 확인한 사실과 사유가
            상대에게 전달됩니다. 상·하한이 같으면 단일 단가 제안입니다.
          </p>
          <Button
            variant="secondary"
            disabled={
              busy || !reason.trim() || !narrower(Number(low), Number(high), q)
            }
            onClick={() => act()}
          >
            확인한 범위 제안
          </Button>
        </div>
      )}
      {!mine && !q.stale && q.status === "offered" && (
        <Button variant="secondary" disabled={busy} onClick={() => act(true)}>
          이 단가 제안 수락
        </Button>
      )}
      {q.status === "accepted" && (
        <p className="text-sm text-ink-2">
          단가 제안을 수락했습니다.{" "}
          <Link className="underline" href={`${basePath}/find`}>
            다시 찾기
          </Link>
          에서 허가·수거·검수 조건을 대조한 뒤 양쪽이 승인해야 거래가
          확정됩니다.
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm text-loss">
          {message}
        </p>
      )}
    </article>
  );
}

function PhotoCard({
  photo,
  quotes,
  recipients,
  refresh,
}: {
  photo: SharedPhoto;
  recipients?: SurveyData["recipients"];
  quotes: RangeQuote[];
  refresh: () => void;
}) {
  const { org } = useV3();
  const own = !org.role || org.role !== "vendor";
  const [src, setSrc] = useState<string | null>(null);
  const [targets, setTargets] = useState(photo.sharedWith);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const vendors = Array.from(
    new Map(
      [...quotes, ...(recipients ?? [])]
        .filter((q) => q.streamId === photo.streamId)
        .map((q) => [q.vendorOrgId, q.vendorName]),
    ).entries(),
  );
  async function run(share: boolean) {
    setBusy(true);
    try {
      const p = await api.survey<{ data: string }>(
        org.id,
        `/photos/${photo.id}`,
        share ? { sharedWith: targets } : undefined,
      );
      setSrc(p.data);
      if (share) refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 border border-line p-3">
      <p className="text-sm">
        {photo.streamName ?? "폐기물 사진"} ·{" "}
        {new Date(photo.createdAt).toLocaleDateString("ko-KR", {
          timeZone: "Asia/Seoul",
        })}
      </p>
      <Button variant="ghost" disabled={busy} onClick={() => run(false)}>
        사진 보기
      </Button>
      {src && (
        <picture>
          <img
            src={src}
            alt="수거 전 확인을 위해 공유한 폐기물 사진"
            className="max-h-72 max-w-full object-contain"
          />
        </picture>
      )}
      {own && (
        <>
          <p className="text-sm text-muted">
            선택한 문의 업체만 원본 사진을 볼 수 있습니다. 선택을 해제하고
            저장하면 접근이 취소됩니다.
          </p>
          {vendors.map(([id, name]) => (
            <label
              className="flex min-h-11 items-center gap-2 text-sm"
              key={id}
            >
              <input
                type="checkbox"
                checked={targets.includes(id)}
                onChange={(e) =>
                  setTargets(
                    e.target.checked
                      ? [...targets, id]
                      : targets.filter((t) => t !== id),
                  )
                }
              />
              {name}
            </label>
          ))}
          <Button variant="secondary" disabled={busy} onClick={() => run(true)}>
            사진 공유 대상 저장
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
    </div>
  );
}

export function SurveyWorkspace() {
  const { org, mode, canWrite, openEvidence } = useV3();
  const remote = useRemote(`survey:${org.id}`, mode === "live", () =>
    api.survey<SurveyData>(org.id),
  );
  const streams = useRemote(
    `survey-streams:${org.id}`,
    mode === "live" && org.role === "emitter",
    () => api.listStreams(org.id),
  );
  const profile = useRemote(
    `survey-vendor:${org.id}`,
    mode === "live" && org.role === "vendor",
    () => loadVendorProfile(org.id, org.name),
  );
  const [month, setMonth] = useState(monthInSeoul());
  const [streamId, setStreamId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    remote.reload();
    streams.reload();
  };
  async function action(fn: () => Promise<unknown>, done = "저장했습니다.") {
    setBusy(true);
    setMessage("");
    try {
      const result = await fn();
      setMessage(typeof result === "string" ? result : done);
      refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  const data = remote.data;
  if (!canWrite)
    return (
      <p className="p-6 text-sm">
        로그인한 회사에서 사전 문의를 이용할 수 있습니다.
      </p>
    );
  return (
    <main className="mx-auto w-full max-w-[960px] px-5 pt-8 pb-16">
      <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.03em]">단가·사전 문의</h1>
      <p className="mt-2 text-[15px] text-ink-2">
        가격 범위에서 시작해 자료를 확인하고, 상대와 거래 조건을 좁힙니다.
      </p>
      {remote.loading && (
        <p className="py-6 text-sm text-muted">
          문의 자료를 불러오는 중입니다.
        </p>
      )}
      {remote.error && (
        <div role="alert" className="my-4 text-loss">
          {remote.error}
          <Button variant="ghost" onClick={remote.reload}>
            다시 시도
          </Button>
        </div>
      )}
      {org.role === "vendor" && profile.data && (
        <VendorRanges
          key={org.id}
          profile={profile.data}
          refresh={() => {
            profile.reload();
            refresh();
          }}
        />
      )}
      {profile.error && (
        <p role="alert" className="text-loss">
          {profile.error}
        </p>
      )}
      {org.role === "emitter" && (
        <section {...navSpot("weigh-csv", "계량 기록으로 물량 채우기", "이 화면")} className={`${section} mt-6`}>
          <h2 className="text-xl font-semibold">
            기존 계량 기록으로 월 물량 채우기
          </h2>
          <p className="text-sm text-muted">
            CSV 열: 폐기물 이름, 계량일, 중량(kg), 계량번호(선택). 등록한 폐기물
            이름을 사용해 주세요. 선택한 월만 합산하고, 같은 기록을 다시 올려도
            중복 합산하지 않습니다. 오염도·수분은 없어도 됩니다.
          </p>
          <label className={label}>
            합산할 월
            <input
              type="month"
              className={field}
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <label className={pick}>
            계량 CSV 고르기
            <input
              type="file"
              aria-label="계량 CSV"
              className="sr-only"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  void action(async () => {
                    const r = await api.surveyUpload<{
                      accepted: number;
                      duplicates: number;
                    }>(org.id, "weights", f, { month });
                    return `새 기록 ${r.accepted}건, 이미 등록된 기록 ${r.duplicates}건입니다. 선택한 월의 발생량을 갱신했습니다.`;
                  }, "선택한 월의 발생량을 갱신했습니다.");
                e.target.value = "";
              }}
            />
          </label>
        </section>
      )}
      {data && org.role === "emitter" && (
        <section {...navSpot("range-vendors", "범위 단가를 공개한 업체", "이 화면")} className={section}>
          <h2 className="text-xl font-semibold">범위 단가를 공개한 업체</h2>
          {data.candidates.length === 0 && (
            <p className="text-sm text-muted">
              지금 자료와 허가 품목이 맞는 범위 단가 업체가 없습니다. 자료를
              보완하거나 업체에 매입 조건 등록을 요청해 주세요.
            </p>
          )}
          {data.candidates.map((c) => (
            <article
              className="space-y-2 border-b border-line pb-4"
              key={`${c.streamId}:${c.vendorOrgId}:${c.criterionId}`}
            >
              <h3 className="font-medium">
                {c.streamName} → {c.vendorName} · {c.material} {c.form}
              </h3>
              <button
                className="min-h-11 tabular-nums underline decoration-dotted"
                onClick={() => openEvidence(c.evidence, "공개 단가 범위")}
              >
                {rangeText(c.low, c.high)}
              </button>
              <p className="text-sm tabular-nums">
                {c.monthlyLow == null
                  ? "월 물량을 알면 예상 정산액 범위를 계산합니다."
                  : `예상 정산액 ${c.monthlyLow.toLocaleString()}~${c.monthlyHigh?.toLocaleString()}원/월`}
              </p>
              {c.differenceLow != null && c.differenceHigh != null && (
                <p className="text-sm tabular-nums">
                  현행 대비 차이 {c.differenceLow.toLocaleString()}~
                  {c.differenceHigh.toLocaleString()}원/월 (운반비·작업비 반영
                  전)
                </p>
              )}
              {Boolean(c.moneyEvidence?.length) && (
                <button
                  className="min-h-11 text-sm underline"
                  onClick={() =>
                    openEvidence(
                      c.moneyEvidence ?? [],
                      "예상 정산액과 현행 대비 차이 계산",
                    )
                  }
                >
                  금액 계산 근거
                </button>
              )}
              <p className="text-sm text-muted">{c.note}</p>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  action(
                    () => api.survey(org.id, "/quotes", c),
                    "사전 문의를 만들었습니다. 공유할 사진을 선택해 주세요.",
                  )
                }
              >
                이 조건으로 사전 문의
              </Button>
            </article>
          ))}
        </section>
      )}
      {data && (
        <section {...navSpot("quotes", "거래별 단가 확인", "이 화면")} className={section}>
          <h2 className="text-xl font-semibold">거래별 단가 확인</h2>
          {data.quotes.length === 0 && (
            <p className="text-sm text-muted">아직 사전 문의가 없습니다.</p>
          )}
          {data.quotes.map((q) => (
            <QuoteCard
              key={`${q.id}:${q.revision}`}
              quote={q}
              refresh={refresh}
            />
          ))}
        </section>
      )}
      {data && (
        <section {...navSpot("pickup-photos", "수거 전 확인 사진", "이 화면")} className={section}>
          <h2 className="text-xl font-semibold">수거 전 확인 사진</h2>
          {org.role === "emitter" && (
            <>
              <label className={label}>
                사진을 올릴 폐기물
                <select
                  className={field}
                  value={streamId}
                  onChange={(e) => setStreamId(e.target.value)}
                >
                  <option value="">폐기물 선택</option>
                  {(streams.data ?? []).map((s: StreamRecord) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={pick}>
                사진 고르기
                <input
                  type="file"
                  aria-label="사진 올리기"
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={!streamId || busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      void action(
                        () =>
                          api.surveyUpload(org.id, "photos", f, { streamId }),
                        "사진을 비공개로 보관했습니다. 공유할 문의 업체를 선택해 주세요.",
                      );
                    e.target.value = "";
                  }}
                />
              </label>
            </>
          )}
          {[...data.photos, ...data.sharedPhotos].map((p) => (
            <PhotoCard
              key={`${p.id}:${p.sharedWith.join()}`}
              photo={p}
              quotes={data.quotes}
              recipients={data.recipients}
              refresh={refresh}
            />
          ))}
          {data.photos.length + data.sharedPhotos.length === 0 && (
            <p className="text-sm text-muted">
              아직 보관하거나 공유받은 사진이 없습니다.
            </p>
          )}
        </section>
      )}
      {message && (
        <p
          role="status"
          className="sticky bottom-4 border border-line-strong bg-surface p-4 text-sm"
        >
          {message}
        </p>
      )}
    </main>
  );
}
