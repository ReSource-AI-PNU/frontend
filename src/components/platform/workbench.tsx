"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Intake } from "./intake";
import { Stages } from "./stages";
import { CompanySettings, Members } from "./company";
import type { PlatformView } from "./route";
import {
  demoInput,
  platform,
  type Bundle,
  type Company,
  type Context,
  type InboxItem,
  type State,
} from "@/lib/platform/client";

const button =
  "min-h-11 rounded-md border border-line-strong px-4 py-2 text-sm font-semibold disabled:opacity-40";
const input =
  "min-h-11 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm";
const kg = (value: number | null) =>
  value === null ? "비공개" : `${value.toLocaleString("ko-KR")}kg`;

function BundleView({ bundle }: { bundle: Bundle }) {
  return (
    <div className="border-y border-line py-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h3 className="font-semibold">
          {bundle.material} · {bundle.origin} · {bundle.collectorName}
        </h3>
        <span className="text-sm">
          {bundle.ready ? "수거 조건 충족" : "회신 또는 물량 확인 필요"}
        </span>
      </div>
      <div className="my-4 grid gap-4 sm:grid-cols-3">
        <p>
          후보 물량{" "}
          <b className="block text-2xl tabular-nums">
            {kg(bundle.candidateKg)}
          </b>
        </p>
        <p>
          동의한 물량{" "}
          <b className="block text-2xl tabular-nums">
            {kg(bundle.confirmedKg)}
          </b>
        </p>
        <p>
          최소 수거 물량{" "}
          <b className="block text-2xl tabular-nums">{kg(bundle.minKg)}</b>
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="확정 물량 충족률"
        aria-valuemin={0}
        aria-valuemax={
          bundle.minKg *
          (bundle.minimumBasis === "pickup" ? bundle.pickupsPerMonth! : 1)
        }
        aria-valuenow={Math.min(
          bundle.confirmedKg,
          bundle.minKg *
            (bundle.minimumBasis === "pickup" ? bundle.pickupsPerMonth! : 1),
        )}
        className="h-3 w-full bg-sunken"
      >
        <div
          className="h-full bg-ink"
          style={{
            width: `${Math.min(100, (bundle.confirmedKg / (bundle.minKg * (bundle.minimumBasis === "pickup" ? bundle.pickupsPerMonth! : 1))) * 100)}%`,
          }}
        />
      </div>
      <table className="mt-4 w-full text-left text-sm">
        <caption className="sr-only">기업별 참여 상태</caption>
        <thead>
          <tr>
            <th className="py-2">기업</th>
            <th>참여</th>
            <th>공개 물량</th>
          </tr>
        </thead>
        <tbody>
          {bundle.members.map((m) => (
            <tr key={m.companyId} className="border-t border-line">
              <td className="py-2">{m.name}</td>
              <td>
                {
                  {
                    self: "우리 회사",
                    "not-sent": "제안 전",
                    pending: "회신 대기",
                    accepted: "동의",
                    declined: "불참",
                  }[m.state]
                }
              </td>
              <td>{kg(m.kg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-sm">일정: {bundle.schedule}</p>
      <p className="mt-2 text-xs text-muted">
        월 {bundle.pickupsPerMonth}회 · 최소 물량 기준:{" "}
        {bundle.minimumBasis === "pickup" ? "회차별" : "월 합계"} · 경로
        적재량은 1회차 기준입니다.
      </p>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer">
          상세 보기 · 경로와 허가 대조
        </summary>
        <p className="my-2 text-muted">
          {bundle.distanceBasis} · 차량 한 대 {kg(bundle.truckKg)} · 공동 보관
          없이 사업장별 수거
        </p>
        {bundle.trips.length ? (
          bundle.trips.map((t, i) => (
            <p key={i}>
              차량 {i + 1}: {t.visits.map((v) => v.companyId).join(" → ")} →
              업체 복귀 · {kg(t.kg)} · {(t.distanceM / 1000).toFixed(2)}km
            </p>
          ))
        ) : (
          <p>동의와 최소 물량을 충족하면 순회 경로를 계산합니다.</p>
        )}
        <ul className="mt-3">
          {bundle.excluded.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function PlatformWorkbench({
  demo,
  sessionId,
  view = "workspace",
  step,
}: {
  demo: boolean;
  sessionId?: string;
  view?: PlatformView;
  step?: string;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [organizations, setOrganizations] = useState<
    { id: string; name: string; complexId: string }[]
  >([]);
  const [selectedStream, setSelectedStream] = useState("");
  const [origin, setOrigin] = useState<"PIR" | "PCR" | null>(null);
  const [form, setForm] = useState("film");
  const [deliveryConfirm, setDeliveryConfirm] = useState(false);
  const [deliveryRows, setDeliveryRows] = useState<
    { id: string; title: string; to: string; status: string; note: string }[]
  >([]);
  const [context, setContext] = useState<Context>({
    company: demo ? "noksan-001" : "",
    role: "admin",
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sessions, setSessions] = useState<State[]>([]);
  const [state, setState] = useState<State | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [command, setCommand] = useState("현재 상황 요약");
  const [volume, setVolume] = useState<number | null>(null);
  const [floor, setFloor] = useState(140);
  const [days, setDays] = useState("화,목");
  const [frequency, setFrequency] = useState(2);
  const [rounds, setRounds] = useState(6);
  const [slot, setSlot] = useState("오전");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const identity = useRef(demo ? "noksan-001:admin" : ":admin");
  function changeContext(next: Context) {
    identity.current = `${next.company}:${next.role}`;
    setState(null);
    setInbox([]);
    setSessions([]);
    setConfirmed(false);
    setError("");
    setSelectedStream("");
    setVolume(null);
    setOrigin(null);
    setDeliveryRows([]);
    if (demo) sessionStorage.setItem("track-d-company", next.company);
    setContext(next);
  }

  useEffect(() => {
    let active = true;
    const saved = demo ? sessionStorage.getItem("track-d-company") : null;
    const initial = {
      company: saved ?? (demo ? "noksan-001" : ""),
      role: "admin" as const,
    };
    void platform<{
      companyId: string;
      role: string;
      organizations: typeof organizations;
    }>(initial, "context")
      .then((c) => {
        if (!active) return;
        const next = {
          company: c.companyId,
          role: (c.role === "member" ? "member" : "admin") as Context["role"],
        };
        identity.current = `${next.company}:${next.role}`;
        setContext(next);
        setOrganizations(c.organizations);
        setReady(true);
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [demo]);
  const reload = useCallback(async () => {
    if (!ready || !context.company) return;
    const [cs, ss, box] = await Promise.all([
      platform<Company[]>(
        context,
        `companies?complex_id=${encodeURIComponent(organizations.find((o) => o.id === context.company)?.complexId ?? "noksan")}`,
      ),
      platform<State[]>(context, "sessions"),
      platform<InboxItem[]>(context, "inbox"),
    ]);
    if (identity.current !== `${context.company}:${context.role}`) return;
    setCompanies(cs);
    setSessions(ss);
    setInbox(box);
    if (sessionId && !ss.some((s) => s.session.id === sessionId))
      throw new Error("이 회사에서 해당 진단을 찾을 수 없습니다.");
    setState(
      (previous) =>
        ss.find((s) => s.session.id === (sessionId ?? previous?.session.id)) ??
        ss.at(-1) ??
        null,
    );
  }, [context, ready, sessionId, organizations]);
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        if (active) await reload();
      } catch (e) {
        if (active) setError(String(e));
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [reload]);

  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setConfirmed(false);
    }
  }
  async function mutate(path: string, body: object) {
    if (!state) return;
    const result = await platform<{ reason?: string; state?: State }>(
      context,
      `sessions/${state.session.id}/${path}`,
      { version: state.version, ...body },
    );
    if (result.reason) setMessage(result.reason);
  }
  const stream =
    state?.session.streams.find((s) => s.id === selectedStream) ??
    state?.session.streams[0];
  const bundle = state?.bundles?.find((b) => b.streamId === stream?.id);
  const negotiation = state?.session.negotiations?.find(
    (n) => n.streamId === stream?.id,
  );
  return (
    <main className="mx-auto w-full max-w-6xl p-6 sm:p-10">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Re:Source AI · D 트랙 검토</p>
          <h1 className="mt-2 text-2xl font-bold">
            {
              {
                workspace: "폐플라스틱 흐름 진단",
                upload: "새 진단",
                sessions: "진단 목록",
                neighbor: "이웃 기업 수신함",
                vendor: "수거 업체 수신함",
                profile: "회사 설정",
                members: "회사 멤버",
              }[view]
            }
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-muted">
            {demo
              ? "가상 기업과 모의 상대 에이전트로 API·DB 연결을 확인합니다. 외부 메일 발송과 실제 계약은 하지 않습니다."
              : "등록한 기업의 세션과 받은 참여 제안을 확인합니다."}
          </p>
        </div>
        <Link href="/" className={button}>
          기존 화면으로
        </Link>
      </header>
      <nav aria-label="주 메뉴" className="mb-6 flex flex-wrap gap-3">
        {[
          ["/upload", "새 진단"],
          ["/session", "진단 목록"],
          ["/neighbor", "이웃 기업"],
          ["/vendor", "수거 업체"],
          ["/settings", "회사 설정"],
          ["/settings/members", "회사 멤버"],
        ].map(([url, label]) => (
          <Link key={url} href={url} className={button}>
            {label}
          </Link>
        ))}
      </nav>
      {!demo && ready && (
        <label className="mb-6 block">
          소속 회사{" "}
          <select
            className={input}
            value={context.company}
            onChange={(e) =>
              changeContext({ ...context, company: e.target.value })
            }
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {!context.company && (
            <Link className="ml-3 underline" href="/onboarding">
              회사 등록
            </Link>
          )}
        </label>
      )}
      {demo && (
        <section
          className="mb-6 flex flex-wrap items-center gap-3 border-y border-line py-4"
          aria-label="가상 역할 선택"
        >
          <label>
            기업{" "}
            <select
              aria-label="가상 기업"
              className={input}
              value={context.company}
              disabled={busy}
              onChange={(e) =>
                changeContext({ ...context, company: e.target.value })
              }
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.name} ({c.role})
                </option>
              ))}
            </select>
          </label>
          <label>
            권한{" "}
            <select
              aria-label="권한"
              className={input}
              value={context.role}
              disabled={busy}
              onChange={(e) =>
                changeContext({
                  ...context,
                  role: e.target.value as Context["role"],
                })
              }
            >
              <option value="admin">관리자·승인권자</option>
              <option value="member">담당자</option>
            </select>
          </label>
        </section>
      )}
      <div aria-live="polite">
        {error && (
          <p
            role="alert"
            className="mb-4 border-l-2 border-loss px-4 py-2 text-loss"
          >
            {error}
          </p>
        )}
        {message && (
          <p className="mb-4 border-l-2 border-ink px-4 py-2">{message}</p>
        )}
      </div>
      {ready && view === "profile" && (
        <CompanySettings key={context.company} context={context} />
      )}
      {ready && view === "members" && (
        <Members key={context.company} context={context} demo={demo} />
      )}
      {ready && view === "upload" && (
        <Intake
          company={context.company}
          busy={busy}
          onCreate={(data) =>
            void act(async () => {
              const created = await platform<State>(context, "sessions", data);
              router.push(`/session/${created.session.id}/classify`);
            })
          }
        />
      )}
      {view === "sessions" && (
        <ul className="my-6 space-y-3">
          {sessions.map((s) => (
            <li className="border-b border-line py-3" key={s.session.id}>
              <Link
                href={`/session/${s.session.id}/${s.session.step}`}
                className="font-semibold underline"
              >
                {s.session.title}
              </Link>
              <p className="text-sm text-muted">
                흐름 {s.session.streams.length}개 ·{" "}
                {s.session.createdAt.slice(0, 10)} ·{" "}
                {s.session.approval ? "승인 완료" : "검토 중"}
              </p>
            </li>
          ))}
          {!sessions.length && <li>등록한 진단이 없습니다.</li>}
        </ul>
      )}
      {(view === "workspace" || view === "sessions") && (
        <div className="mb-6 flex flex-wrap gap-3">
          {demo && (
            <button
              className={`${button} bg-ink text-bg`}
              disabled={busy}
              onClick={() =>
                act(async () => {
                  const s = await platform<State>(
                    context,
                    "sessions",
                    demoInput(context.company),
                  );
                  setState(s);
                  setVolume(null);
                  setOrigin(null);
                  if (sessionId)
                    router.push(`/session/${s.session.id}/classify`);
                })
              }
            >
              가상 흐름으로 진단 시작
            </button>
          )}
          <button
            className={button}
            disabled={busy}
            onClick={() => act(reload)}
          >
            새로고침
          </button>
          <select
            aria-label="진단 선택"
            className={input}
            value={state?.session.id ?? ""}
            onChange={(e) => {
              setState(
                sessions.find((s) => s.session.id === e.target.value) ?? null,
              );
              setConfirmed(false);
              setSelectedStream("");
              setVolume(null);
              setOrigin(null);
              if (sessionId) router.push(`/session/${e.target.value}`);
            }}
          >
            <option value="">진단 선택</option>
            {sessions.map((s) => (
              <option key={s.session.id} value={s.session.id}>
                {s.session.title} · {s.session.id.slice(-6)}
              </option>
            ))}
          </select>
        </div>
      )}
      {view === "workspace" && state && stream && (
        <section aria-label="진단 작업" className="mb-10">
          <h2 className="text-xl font-semibold">{state.session.title}</h2>
          <p className="mt-1 text-sm text-muted">
            저장 버전 {state.version} · {state.session.id}
          </p>
          <Stages
            key={state.session.id}
            state={state}
            step={step}
            busy={busy}
            act={act}
            mutate={mutate}
          />
          <label className="my-4 block">
            작업 흐름{" "}
            <select
              aria-label="작업 흐름"
              className={input}
              value={stream.id}
              onChange={(e) => {
                setSelectedStream(e.target.value);
                setVolume(null);
                setOrigin(null);
                setConfirmed(false);
              }}
            >
              {state.session.streams.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="my-5 flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm">
              월 발생량(kg)
              <input
                aria-label="월 발생량"
                className={input}
                type="number"
                min="1"
                max="1000000"
                value={volume ?? stream.monthlyKg}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              출처
              <select
                aria-label="흐름 출처"
                className={input}
                value={origin ?? stream.origin}
                onChange={(e) => setOrigin(e.target.value as "PIR" | "PCR")}
              >
                <option>PIR</option>
                <option>PCR</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm">
              성상
              <select
                aria-label="흐름 성상"
                className={input}
                value={form}
                onChange={(e) => setForm(e.target.value)}
              >
                <option value="film">필름</option>
                <option value="rigid">경질</option>
                <option value="paper">종이</option>
                <option value="other">기타</option>
              </select>
            </label>
            <button
              className={button}
              disabled={busy || Boolean(state.session.approval)}
              onClick={() =>
                act(() =>
                  mutate("answers", {
                    streamId: stream.id,
                    monthlyKg: volume ?? stream.monthlyKg,
                    origin: origin ?? stream.origin,
                  }),
                )
              }
            >
              물량·출처 확인
            </button>
            <button
              className={button}
              disabled={busy || Boolean(state.session.approval)}
              onClick={() =>
                act(() =>
                  mutate("matching", {
                    streamId: stream.id,
                    form,
                    route: "bundle",
                  }),
                )
              }
            >
              묶음 계산
            </button>
          </div>
          {bundle && (
            <>
              <BundleView bundle={bundle} />
              {!bundle.ready &&
                bundle.members.some((m) => m.state === "declined") && (
                  <button
                    className={`${button} mt-3`}
                    disabled={busy}
                    onClick={() =>
                      act(() => mutate(`bundles/${bundle.id}/replace`, {}))
                    }
                  >
                    불참 기업 대체 후보 찾기
                  </button>
                )}
              <label className="my-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                대상 기업과 조건을 확인했습니다.
              </label>
              <button
                className={button}
                disabled={busy || !confirmed}
                onClick={() =>
                  act(() =>
                    mutate("invites", { bundleId: bundle.id, confirm: true }),
                  )
                }
              >
                참여 제안 승인
              </button>
              <div className="my-6 flex flex-wrap items-end gap-3">
                <label className="grid gap-1 text-sm">
                  하한 단가(원/kg)
                  <input
                    aria-label="하한 단가"
                    className={input}
                    type="number"
                    value={floor}
                    onChange={(e) => setFloor(Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  가능 요일(쉼표 구분)
                  <input
                    aria-label="가능 요일"
                    className={input}
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  월 최소 횟수
                  <input
                    aria-label="월 최소 횟수"
                    className={input}
                    type="number"
                    min={1}
                    max={31}
                    value={frequency}
                    onChange={(e) => setFrequency(Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  최대 협상 라운드
                  <input
                    aria-label="최대 협상 라운드"
                    className={input}
                    type="number"
                    min={1}
                    max={12}
                    value={rounds}
                    onChange={(e) => setRounds(Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  수거 시간대
                  <select
                    aria-label="수거 시간대"
                    className={input}
                    value={slot}
                    onChange={(e) => setSlot(e.target.value)}
                  >
                    <option>오전</option>
                    <option>오후</option>
                  </select>
                </label>
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    act(async () => {
                      await mutate("negotiations", {
                        bundleId: bundle.id,
                        guardrails: {
                          minPerKg: floor,
                          days: days.split(",").map((s) => s.trim()),
                          minPerMonth: frequency,
                          maxRounds: rounds,
                        },
                        requested: {
                          day: days.split(",")[0].trim(),
                          slot,
                          perKg: Math.max(150, floor),
                          perMonth: frequency,
                        },
                      });
                    })
                  }
                >
                  {demo ? "모의 협상 시작" : "상대 에이전트 협상 시작"}
                </button>
              </div>
              {negotiation && (
                <div className="border-y border-line py-4">
                  <h3 className="font-semibold">
                    협상:{" "}
                    {negotiation.status === "agreed"
                      ? "합의안 · 사람 승인 대기"
                      : negotiation.status === "approved"
                        ? "승인 완료"
                        : "사람 확인 필요"}
                  </h3>
                  <p className="my-2 text-sm">{negotiation.note}</p>
                  <ol className="space-y-2 text-sm">
                    {negotiation.rounds.map((r, i) => (
                      <li key={i}>
                        {i + 1}.{" "}
                        {r.by === "ours"
                          ? "우리"
                          : demo
                            ? "모의 업체"
                            : "상대 업체"}{" "}
                        · {r.terms.day}요일 · {r.terms.perKg}원/kg · 월{" "}
                        {r.terms.perMonth}회 ·{" "}
                        {r.within ? "가드레일 안" : "가드레일 밖"}
                      </li>
                    ))}
                  </ol>
                  {negotiation.status === "agreed" && (
                    <button
                      className={`${button} mt-3`}
                      disabled={busy || !confirmed}
                      onClick={() =>
                        act(() =>
                          mutate(`negotiations/${negotiation.id}/approve`, {
                            confirm: true,
                          }),
                        )
                      }
                    >
                      합의안 승인
                    </button>
                  )}
                </div>
              )}
            </>
          )}
          {state.session.approval && (
            <section className="my-6 space-y-3" aria-label="문서 발송함">
              <h3 className="font-semibold">문서 발송함</h3>
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  act(async () =>
                    setDeliveryRows(
                      await platform(
                        context,
                        `sessions/${state.session.id}/deliveries`,
                      ),
                    ),
                  )
                }
              >
                발송 상태 조회
              </button>
              {deliveryRows.map((d) => (
                <p key={d.id}>
                  {d.title} → {d.to} · {d.status} {d.note}
                </p>
              ))}
              {!demo && (
                <>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={deliveryConfirm}
                      onChange={(e) => setDeliveryConfirm(e.target.checked)}
                    />
                    승인한 문서를 표시된 수신인에게 외부 발송합니다.
                  </label>
                  <button
                    className={button}
                    disabled={busy || !deliveryConfirm}
                    onClick={() =>
                      act(async () => {
                        setDeliveryRows(
                          await platform(
                            context,
                            `sessions/${state.session.id}/deliveries`,
                            { version: state.version, confirm: true },
                          ),
                        );
                        setDeliveryConfirm(false);
                      })
                    }
                  >
                    승인 문서 외부 발송·재확인
                  </button>
                </>
              )}
            </section>
          )}
          <form
            className="mt-6 flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                const r = await platform<{ message: string }>(
                  context,
                  `sessions/${state.session.id}/commands`,
                  { version: state.version, text: command },
                );
                setMessage(r.message);
              });
            }}
          >
            <input
              aria-label="실행 명령"
              className={`${input} min-w-0 flex-1`}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
            />
            <button className={button} disabled={busy}>
              명령 실행
            </button>
          </form>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm">실행 기록 보기</summary>
            <ol className="mt-3 space-y-2 text-sm">
              {state.session.runLog?.map((e) => (
                <li key={e.id}>{e.title}</li>
              ))}
            </ol>
          </details>
        </section>
      )}
      {["workspace", "neighbor", "vendor"].includes(view) && (
        <section
          aria-label="받은 참여 제안"
          className="border-t border-line pt-6"
        >
          <h2 className="text-xl font-semibold">이웃 기업 · 업체 수신함</h2>
          <p className="mt-2 text-sm text-muted">
            수신 기업으로 등록된 제안만 보입니다. 다른 기업의 물량은
            비공개입니다.
          </p>
          {!inbox.length && (
            <p className="my-6 text-sm">받은 제안이 없습니다.</p>
          )}
          {inbox.map((item) => (
            <article key={item.bundle.id} className="my-5">
              <BundleView bundle={item.bundle} />
              {item.bundle.members.some(
                (m) => m.companyId === context.company && m.state === "pending",
              ) && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <input
                    aria-label="불참 사유"
                    className={input}
                    placeholder="불참 시 사유 입력"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  {(["accepted", "declined"] as const).map((decision) => (
                    <button
                      key={decision}
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        act(async () => {
                          await platform(
                            context,
                            `sessions/${item.sessionId}/bundles/${item.bundle.id}/reply`,
                            {
                              version: item.version,
                              decision,
                              reason: decision === "declined" ? reason : "",
                            },
                          );
                        })
                      }
                    >
                      {decision === "accepted" ? "참여 동의" : "불참 회신"}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
