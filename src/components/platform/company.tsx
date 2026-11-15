"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { platform, type Context } from "@/lib/platform/client";
import type { components } from "@/lib/platform/generated";
type Profile = components["schemas"]["CompanyProfile"];
const input = "min-h-11 rounded border border-line-strong bg-surface px-3 py-2";
const timeOfDay = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const minutesOfDay = (value: string) => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
export function CompanySettings({ context }: { context: Context }) {
  const [profile, setProfile] = useState<Profile>({
    id: context.company,
    name: "",
    complexId: "noksan",
    role: "배출",
    location: [0, 0],
    supplies: [],
    visibility: "complex",
    isDemo: false,
  });
  const [lon, setLon] = useState("");
  const [lat, setLat] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    let active = true;
    void platform<Profile>(context, "companies/me")
      .then((p) => {
        if (active) {
          setProfile(p);
          setLon(String(p.location[0]));
          setLat(String(p.location[1]));
        }
      })
      .catch((e) => {
        if (active)
          setMessage(
            String(e).includes("404")
              ? "회사 위치와 처리 조건을 등록하세요."
              : String(e),
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [context]);
  const p = profile;
  function policy(key: string, value: unknown) {
    setProfile((old) => ({
      ...old,
      collector: { ...old.collector!, [key]: value },
    }));
  }
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const saved = await platform<Profile>(
            context,
            `companies/${context.company}`,
            { ...p, id: context.company, location: [Number(lon), Number(lat)] },
            "PUT",
          );
          setProfile(saved);
          setMessage(
            "회사 프로필을 저장했습니다. 허가 증빙은 별도 검증이 필요합니다.",
          );
        } catch (e) {
          setMessage(String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-semibold">회사 프로필</h2>
      <p role="status" className="text-sm">
        {message}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1">
          회사 이름
          <input
            className={input}
            required
            value={p.name}
            onChange={(e) => setProfile({ ...p, name: e.target.value })}
          />
        </label>
        <label className="grid gap-1">
          단지 ID
          <input
            className={input}
            required
            value={p.complexId}
            onChange={(e) => setProfile({ ...p, complexId: e.target.value })}
          />
        </label>
        <label className="grid gap-1">
          사업장 경도
          <input
            className={input}
            type="number"
            step="any"
            required
            min={-180}
            max={180}
            value={lon}
            onChange={(e) => setLon(e.target.value)}
          />
        </label>
        <label className="grid gap-1">
          사업장 위도
          <input
            className={input}
            type="number"
            step="any"
            required
            min={-90}
            max={90}
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
        </label>
        <label className="grid gap-1">
          역할
          <select
            className={input}
            value={p.role}
            onChange={(e) =>
              setProfile({ ...p, role: e.target.value as Profile["role"] })
            }
          >
            {["배출", "처리업체", "수요처"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          참여 후보 공개
          <select
            className={input}
            value={p.visibility}
            onChange={(e) =>
              setProfile({
                ...p,
                visibility: e.target.value as Profile["visibility"],
              })
            }
          >
            <option value="complex">단지 내 공개 · 개별 물량 비공개</option>
            <option value="private">비공개</option>
          </select>
        </label>
        <label className="grid gap-1">
          수거 가능 시작
          <input
            className={input}
            type="time"
            required
            value={timeOfDay(p.pickupWindow?.start ?? 480)}
            onChange={(e) =>
              setProfile({
                ...p,
                pickupWindow: {
                  start: minutesOfDay(e.target.value),
                  end: p.pickupWindow?.end ?? 1080,
                  serviceMinutes: p.pickupWindow?.serviceMinutes ?? 15,
                },
              })
            }
          />
        </label>
        <label className="grid gap-1">
          수거 가능 종료
          <input
            className={input}
            type="time"
            required
            value={timeOfDay(p.pickupWindow?.end ?? 1080)}
            onChange={(e) =>
              setProfile({
                ...p,
                pickupWindow: {
                  start: p.pickupWindow?.start ?? 480,
                  end: minutesOfDay(e.target.value),
                  serviceMinutes: p.pickupWindow?.serviceMinutes ?? 15,
                },
              })
            }
          />
        </label>
      </div>
      <h3 className="font-semibold">참여 가능한 폐기물 흐름</h3>
      {(p.supplies ?? []).map((s, i) => (
        <fieldset
          key={i}
          className="flex flex-wrap gap-3 border border-line p-3"
        >
          <legend>흐름 {i + 1}</legend>
          <label>
            재질{" "}
            <input
              aria-label={`공급 재질 ${i + 1}`}
              className={input}
              required
              value={s.material}
              onChange={(e) =>
                setProfile({
                  ...p,
                  supplies: p.supplies!.map((r, j) =>
                    i === j
                      ? { ...r, material: e.target.value.toUpperCase() }
                      : r,
                  ),
                })
              }
            />
          </label>
          <label>
            성상{" "}
            <select
              className={input}
              value={s.form}
              onChange={(e) =>
                setProfile({
                  ...p,
                  supplies: p.supplies!.map((r, j) =>
                    i === j
                      ? { ...r, form: e.target.value as typeof s.form }
                      : r,
                  ),
                })
              }
            >
              {["film", "rigid", "paper", "other"].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label>
            출처{" "}
            <select
              className={input}
              value={s.origin}
              onChange={(e) =>
                setProfile({
                  ...p,
                  supplies: p.supplies!.map((r, j) =>
                    i === j
                      ? { ...r, origin: e.target.value as typeof s.origin }
                      : r,
                  ),
                })
              }
            >
              <option>PIR</option>
              <option>PCR</option>
            </select>
          </label>
          <label>
            월 kg{" "}
            <input
              className={input}
              type="number"
              required
              min={1}
              max={1000000}
              value={s.monthlyKg}
              onChange={(e) =>
                setProfile({
                  ...p,
                  supplies: p.supplies!.map((r, j) =>
                    i === j ? { ...r, monthlyKg: Number(e.target.value) } : r,
                  ),
                })
              }
            />
          </label>
          <button
            type="button"
            className={input}
            onClick={() =>
              setProfile({
                ...p,
                supplies: p.supplies!.filter((_, j) => j !== i),
              })
            }
          >
            삭제
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className={input}
        onClick={() =>
          setProfile({
            ...p,
            supplies: [
              ...(p.supplies ?? []),
              {
                item: "폐플라스틱",
                material: "LDPE",
                form: "film",
                origin: "PCR",
                monthlyKg: 300,
              },
            ],
          })
        }
      >
        참여 흐름 추가
      </button>
      {p.role !== "배출" && (
        <section className="space-y-3">
          <h3 className="font-semibold">업체 수거 조건</h3>
          {!p.collector ? (
            <button
              type="button"
              className={input}
              onClick={() =>
                setProfile({
                  ...p,
                  collector: {
                    permits: ["폐플라스틱"],
                    materials: ["LDPE"],
                    forms: ["film"],
                    routes: ["sell", "bundle"],
                    minKg: 1000,
                    truckKg: 1000,
                    days: ["목"],
                    maxPerKg: 140,
                    maxPerMonth: 2,
                    evidence: "",
                    minimumBasis: "pickup",
                    permitVerified: false,
                  },
                })
              }
            >
              수거 조건 입력
            </button>
          ) : (
            <>
              <p className="text-sm">
                허가 상태:{" "}
                {p.collector.permitVerified ? "검증됨" : "운영자 검증 필요"}.
                조건을 바꾸면 다시 검증해야 합니다.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["minKg", "최소 수거량(kg)"],
                    ["truckKg", "차량 적재량(kg)"],
                    ["maxPerKg", "최대 매입 단가(원/kg)"],
                    ["maxPerMonth", "월 최대 횟수"],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="grid gap-1">
                    {label}
                    <input
                      className={input}
                      type="number"
                      required
                      min={k === "maxPerKg" ? 0 : 1}
                      value={p.collector![k]}
                      onChange={(e) => policy(k, Number(e.target.value))}
                    />
                  </label>
                ))}
                <label className="grid gap-1">
                  최소 물량 기준
                  <select
                    className={input}
                    value={p.collector.minimumBasis}
                    onChange={(e) => policy("minimumBasis", e.target.value)}
                  >
                    <option value="pickup">수거 1회</option>
                    <option value="month">월 합계</option>
                  </select>
                </label>
                <label className="grid gap-1">
                  수지(쉼표 구분)
                  <input
                    className={input}
                    value={p.collector.materials.join(",")}
                    onChange={(e) =>
                      policy(
                        "materials",
                        e.target.value
                          .toUpperCase()
                          .split(",")
                          .map((v) => v.trim()),
                      )
                    }
                  />
                </label>
                <label className="grid gap-1">
                  수거 요일(쉼표 구분)
                  <input
                    className={input}
                    value={p.collector.days.join(",")}
                    onChange={(e) =>
                      policy(
                        "days",
                        e.target.value.split(",").map((v) => v.trim()),
                      )
                    }
                  />
                </label>
                <label className="grid gap-1">
                  허가 증빙
                  <input
                    className={input}
                    required
                    maxLength={1000}
                    value={p.collector.evidence}
                    onChange={(e) => policy("evidence", e.target.value)}
                  />
                </label>
              </div>
              {(
                [
                  ["forms", ["film", "rigid", "paper", "other"], "성상"],
                  ["routes", ["sell", "bundle", "pyrolysis"], "처리 경로"],
                  [
                    "permits",
                    ["폐플라스틱", "금속 스크랩", "폐목재", "포장재"],
                    "허가 품목",
                  ],
                ] as const
              ).map(([k, values, label]) => (
                <fieldset key={k} className="flex flex-wrap gap-3">
                  <legend>{label}</legend>
                  {values.map((v) => (
                    <label key={v} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={((p.collector![k] ?? []) as string[]).includes(
                          v,
                        )}
                        onChange={(e) =>
                          policy(
                            k,
                            e.target.checked
                              ? [...(p.collector![k] ?? []), v]
                              : (p.collector![k] ?? []).filter((x) => x !== v),
                          )
                        }
                      />
                      {v}
                    </label>
                  ))}
                </fieldset>
              ))}
            </>
          )}
        </section>
      )}
      <button className={`${input} bg-ink text-bg`} disabled={busy}>
        회사 프로필 저장
      </button>
    </form>
  );
}

type Member = {
  id: string;
  email: string;
  role: string;
  status: string;
  owner?: boolean;
};
export function Members({
  context,
  demo,
}: {
  context: Context;
  demo: boolean;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("담당자");
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const path = `organizations/${context.company}/members`;
  useEffect(() => {
    let active = true;
    if (!demo)
      void platform<Member[]>(context, path)
        .then((rows) => {
          if (active) setMembers(rows);
        })
        .catch((e) => {
          if (active) setMessage(String(e));
        });
    return () => {
      active = false;
    };
  }, [context, path, demo]);
  async function change(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMembers(await platform<Member[]>(context, path));
    } catch (e) {
      setMessage(String(e));
    } finally {
      setBusy(false);
    }
  }
  if (demo)
    return (
      <p>
        멤버 관리는 실제 로그인 계정의 회사에서 사용할 수 있습니다. 로컬 가상
        기업은 역할 선택으로 권한을 검사하세요.
      </p>
    );
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">회사 멤버</h2>
      <p role="status">{message}</p>
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void change(async () => {
            const r = await platform<{ token: string }>(context, path, {
              email,
              role,
            });
            setToken(r.token);
          });
        }}
      >
        <input
          className={input}
          aria-label="초대 이메일"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className={input}
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          {["담당자", "승인권자", "관리자"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <button className={input} disabled={busy}>
          초대 만들기
        </button>
      </form>
      {token && (
        <div className="space-y-2 border border-line p-4">
          <p>
            이 토큰을 초대할 사람에게 직접 전달하세요. 7일 동안 유효하며, 초대한
            이메일로 로그인한 뒤 /join에서 수락합니다.
          </p>
          <code className="break-all">{token}</code>
        </div>
      )}
      {members.map((m) => (
        <div
          className="flex flex-wrap items-center gap-3 border-b border-line py-3"
          key={m.id}
        >
          <span>
            {m.email} · {m.status === "active" ? "가입 완료" : "초대 중"}
          </span>
          <select
            aria-label={`${m.email} 역할`}
            className={input}
            disabled={busy || m.owner}
            value={m.role}
            onChange={(e) =>
              change(() =>
                platform(
                  context,
                  `${path}/${m.id}`,
                  { role: e.target.value },
                  "PATCH",
                ),
              )
            }
          >
            {["담당자", "승인권자", "관리자"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button
            className={input}
            disabled={busy || m.owner}
            onClick={() => {
              if (window.confirm(`${m.email} 멤버를 제거할까요?`))
                void change(() =>
                  platform(context, `${path}/${m.id}`, undefined, "DELETE"),
                );
            }}
          >
            멤버 제거
          </button>
        </div>
      ))}
    </section>
  );
}

export function AcceptMembership() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mx-auto max-w-xl space-y-4 p-8"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await platform({ company: "", role: "member" }, "membership/accept", {
            token,
          });
          setMessage("초대를 수락했습니다. 진단 목록에서 회사를 선택하세요.");
        } catch (e) {
          setMessage(String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="text-2xl font-bold">회사 초대 수락</h1>
      <p>초대받은 이메일로 먼저 로그인하세요.</p>
      <Link href="/login" className="underline">
        로그인
      </Link>
      <label className="grid gap-2">
        초대 토큰
        <input
          className={input}
          required
          minLength={32}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      <button className={input} disabled={busy}>
        초대 수락
      </button>
      <p role="status">{message}</p>
      <Link href="/session" className="underline">
        진단 목록
      </Link>
    </form>
  );
}
