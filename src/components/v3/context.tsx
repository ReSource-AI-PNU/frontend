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
  /** 지금 보는 관점. 조직 목록을 받기 전(mode가 loading)에는 id가 빈 자리표시 조직이다 */
  org: Org;
  setOrgId: (id: string) => void;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  openEvidence: (ids: string[], title?: string) => void;
};

const V3Context = createContext<Ctx | null>(null);

/** 조직 목록을 받기 전에 쓰는 자리표시. 이 상태에서는 어떤 화면도 서버를 부르지 않는다. */
const PENDING_ORG: Org = { id: "", name: "", role: "emitter" };

const ORG_KEY = "rsai-v3-org";
const SESSION_KEY = "rsai-v3-session";
const EVENT = "rsai-v3-store";

/** GET /orgs의 order 순(시연 주인공이 맨 앞, 운영 조직이 맨 뒤). order가 없는 조직은 받은 순서대로 뒤에 둔다. */
function byOrder(orgs: Org[]): Org[] {
  return orgs
    .map((org, index) => ({ org, index }))
    .sort((a, b) => (a.org.order ?? Infinity) - (b.org.order ?? Infinity) || a.index - b.index)
    .map((item) => item.org);
}

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
        if (alive) setRemote({ mode: "live", orgs: byOrder(orgs), fixture: null });
      })
      .catch(async () => {
        // 연결하지 못했을 때만 예시 데이터를 불러온다
        const { FIXTURE } = await import("@/lib/v3/fixture");
        if (alive) setRemote({ mode: "fixture", orgs: byOrder(FIXTURE.orgs), fixture: FIXTURE });
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
    PENDING_ORG;

  const reconnect = useCallback(() => {
    setRemote({ mode: "loading", orgs: [], fixture: null });
    setAttempt((before) => before + 1);
  }, []);
  const setOrgId = useCallback((id: string) => setStored(ORG_KEY, id), []);
  const setSessionId = useCallback((id: string | null) => setStored(SESSION_KEY, id), []);
  const openEvidence = useCallback((ids: string[], title?: string) => {
    // 한 판단에 같은 근거가 여러 번 실려 올 수 있다. 한 번만 연다
    if (ids.length > 0) setPanel({ ids: [...new Set(ids)], title });
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
      {panel && org.id ? (
        <EvidencePanel
          key={panel.ids.join("|")}
          ids={panel.ids}
          title={panel.title}
          orgId={org.id}
          orgName={(id) => orgs.find((item) => item.id === id)?.name ?? id}
          mode={remote.mode}
          fixture={remote.fixture}
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
