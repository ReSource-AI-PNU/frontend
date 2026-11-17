"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";
import type { Membership } from "@/lib/auth/account";
import { switchCompany } from "@/lib/server/company-actions";
import { ApiError, api } from "@/lib/v3/api";
import type { Org } from "@/lib/v3/types";
import { EvidencePanel } from "./evidence-panel";

/** live: 서버와 이어짐. offline: 서버에 닿지 못함(다시 시도 화면을 보인다). */
export type DataMode = "loading" | "live" | "offline";

type Ctx = {
  mode: DataMode;
  /** 서버에 다시 닿아 본다 */
  reconnect: () => void;
  /** 체험하기(시연 회사 읽기 전용) */
  readOnly: boolean;
  /** 저장·실행·승인·업로드를 보낼 수 있는지(서버와 이어졌고 체험이 아님) */
  canWrite: boolean;
  /** 화면 주소의 머리. 로그인한 화면은 /app, 체험하기는 /demo */
  basePath: "/app" | "/demo";
  /** 이름을 찾는 데 쓰는 조직 목록(서버가 보여 주는 만큼) */
  orgs: Org[];
  /** 지금 보는 회사. 세션(또는 체험 회사)이 정하고 화면에서 임의로 바꿀 수 없다 */
  org: Org;
  /** 이 사람이 속한 회사들. 둘 이상이면 사이드바에서 바꾼다 */
  memberships: Membership[];
  /** 소속 회사 가운데 하나로 바꾼다(세션을 고친 뒤 화면을 다시 그린다) */
  setOrgId: (id: string) => void;
  switching: boolean;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  openEvidence: (ids: string[], title?: string) => void;
};

const V3Context = createContext<Ctx | null>(null);

const EVENT = "rsai-v3-store";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key),
    () => null,
  );
}

function setStored(key: string, value: string | null) {
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
  window.dispatchEvent(new Event(EVENT));
}

export function V3Provider({
  org,
  memberships = [],
  demo = false,
  children,
}: {
  org: Org;
  memberships?: Membership[];
  demo?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [remote, setRemote] = useState<{ mode: DataMode; orgs: Org[] }>({ mode: "loading", orgs: [] });
  const [attempt, setAttempt] = useState(0);
  const [switching, startSwitch] = useTransition();
  // 마지막으로 본 찾기 번호는 회사마다 따로 적어 둔다(회사를 바꾸면 그 회사의 것을 연다)
  const sessionKey = `${demo ? "rsai-v3-demo-session" : "rsai-v3-session"}:${org.id}`;
  const sessionId = useStored(sessionKey);
  const [panel, setPanel] = useState<{ ids: string[]; title?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listOrgs()
      .then((orgs) => {
        if (alive) setRemote({ mode: "live", orgs });
      })
      .catch((error: unknown) => {
        if (!alive) return;
        // 서버에는 닿았지만 목록을 주지 않은 경우(권한 등)는 이어진 것으로 본다. 이름은 각 화면의 값으로 찾는다
        const reached = error instanceof ApiError && error.status < 500;
        setRemote({ mode: reached ? "live" : "offline", orgs: [] });
      });
    return () => {
      alive = false;
    };
  }, [attempt, org.id]);

  const orgs = useMemo(
    () => (remote.orgs.some((item) => item.id === org.id) ? remote.orgs : [org, ...remote.orgs]),
    [remote.orgs, org],
  );

  const reconnect = useCallback(() => {
    setRemote({ mode: "loading", orgs: [] });
    setAttempt((before) => before + 1);
  }, []);
  const setOrgId = useCallback(
    (id: string) => {
      if (demo || id === org.id) return;
      startSwitch(async () => {
        await switchCompany(id);
        setPanel(null);
        router.refresh();
      });
    },
    [demo, org.id, router],
  );
  const setSessionId = useCallback((id: string | null) => setStored(sessionKey, id), [sessionKey]);
  const openEvidence = useCallback((ids: string[], title?: string) => {
    // 한 판단에 같은 근거가 여러 번 실려 올 수 있다. 한 번만 연다
    if (ids.length > 0) setPanel({ ids: [...new Set(ids)], title });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      mode: remote.mode,
      reconnect,
      readOnly: demo,
      canWrite: remote.mode === "live" && !demo,
      basePath: demo ? "/demo" : "/app",
      orgs,
      org,
      memberships,
      setOrgId,
      switching,
      sessionId,
      setSessionId,
      openEvidence,
    }),
    [remote.mode, reconnect, demo, orgs, org, memberships, setOrgId, switching, sessionId, setSessionId, openEvidence],
  );

  return (
    <V3Context.Provider value={value}>
      {children}
      {panel && org.id ? (
        <EvidencePanel
          key={panel.ids.join("|")}
          ids={panel.ids}
          title={panel.title}
          orgId={org.id}
          orgName={(id) => orgs.find((item) => item.id === id)?.name ?? id}
          live={remote.mode === "live"}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </V3Context.Provider>
  );
}

export function useV3(): Ctx {
  const ctx = useContext(V3Context);
  if (!ctx) throw new Error("V3Provider 안에서만 쓸 수 있습니다");
  return ctx;
}

