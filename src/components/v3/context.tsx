"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { api } from "@/lib/v3/api";
import type { Fixture } from "@/lib/v3/fixture";
import type { Org } from "@/lib/v3/types";
import { EvidencePanel } from "./evidence-panel";

/** live: 백엔드 연결됨(예시 데이터를 쓰지 않는다). fixture: 연결 실패, 저장해 둔 예시 데이터를 보여 준다. */
export type DataMode = "loading" | "live" | "fixture";

type Ctx = {
  mode: DataMode;
  /** 예시 데이터. 백엔드에 연결하지 못했을 때만 불러온다 */
  fixture: Fixture | null;
  /** 백엔드에 다시 연결해 본다 */
  reconnect: () => void;
  orgs: Org[];
  /** 지금 보는 관점. 조직 목록을 받기 전에는 null이다 */
  org: Org | null;
  setOrgId: (id: string) => void;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  openEvidence: (ids: string[], title?: string) => void;
};

const V3Context = createContext<Ctx | null>(null);

const ORG_KEY = "rsai-v3-org";
const SESSION_KEY = "rsai-v3-session";
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

export function V3Provider({ children }: { children: ReactNode }) {
  const [remote, setRemote] = useState<{ mode: DataMode; orgs: Org[]; fixture: Fixture | null }>({
    mode: "loading",
    orgs: [],
    fixture: null,
  });
  const [attempt, setAttempt] = useState(0);
  const storedOrg = useStored(ORG_KEY);
  const sessionId = useStored(SESSION_KEY);
  const [panel, setPanel] = useState<{ ids: string[]; title?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then(() => api.listOrgs())
      .then((orgs) => {
        if (alive) setRemote({ mode: "live", orgs, fixture: null });
      })
      .catch(async () => {
        // 연결하지 못했을 때만 예시 데이터를 불러온다
        const { FIXTURE } = await import("@/lib/v3/fixture");
        if (alive) setRemote({ mode: "fixture", orgs: FIXTURE.orgs, fixture: FIXTURE });
      });
    return () => {
      alive = false;
    };
  }, [attempt]);

  const orgs = remote.orgs;
  const org =
    orgs.find((item) => item.id === storedOrg) ??
    // 예시 데이터는 받아 둔 관점부터 보여 준다
    orgs.find((item) => item.id === remote.fixture?.meta.emitterOrgId) ??
    orgs[0] ??
    null;

  const reconnect = useCallback(() => {
    setRemote({ mode: "loading", orgs: [], fixture: null });
    setAttempt((before) => before + 1);
  }, []);
  const setOrgId = useCallback((id: string) => setStored(ORG_KEY, id), []);
  const setSessionId = useCallback((id: string | null) => setStored(SESSION_KEY, id), []);
  const openEvidence = useCallback((ids: string[], title?: string) => {
    if (ids.length > 0) setPanel({ ids, title });
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      mode: remote.mode,
      fixture: remote.fixture,
      reconnect,
      orgs,
      org,
      setOrgId,
      sessionId,
      setSessionId,
      openEvidence,
    }),
    [remote.mode, remote.fixture, reconnect, orgs, org, setOrgId, sessionId, setSessionId, openEvidence],
  );

  return (
    <V3Context.Provider value={value}>
      {children}
      {panel && org ? (
        <EvidencePanel
          key={panel.ids.join("|")}
          ids={panel.ids}
          title={panel.title}
          orgId={org.id}
          mode={remote.mode}
          fixture={remote.fixture}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </V3Context.Provider>
  );
}

export function useV3Base(): Ctx {
  const ctx = useContext(V3Context);
  if (!ctx) throw new Error("V3Provider 안에서만 쓸 수 있습니다");
  return ctx;
}

/** 조직 목록을 받은 뒤(V3Shell 안쪽)의 화면이 쓴다. 관점(org)이 반드시 있다. */
export function useV3(): Ctx & { org: Org } {
  const ctx = useV3Base();
  if (!ctx.org) throw new Error("관점을 정하기 전에는 쓸 수 없습니다");
  return ctx as Ctx & { org: Org };
}
