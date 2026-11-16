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
import { FIXTURE_ORGS } from "@/lib/v3/fixture";
import type { Org } from "@/lib/v3/types";
import { EvidencePanel } from "./evidence-panel";

/** live: 백엔드 연결됨. fixture: 연결 실패, 예시 데이터를 보여 준다. */
export type DataMode = "loading" | "live" | "fixture";

type Ctx = {
  mode: DataMode;
  orgs: Org[];
  org: Org;
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
  const [remote, setRemote] = useState<{ mode: DataMode; orgs: Org[] }>({
    mode: "loading",
    orgs: [],
  });
  const storedOrg = useStored(ORG_KEY);
  const sessionId = useStored(SESSION_KEY);
  const [panel, setPanel] = useState<{ ids: string[]; title?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listOrgs()
      .then((orgs) => {
        if (alive) setRemote({ mode: "live", orgs });
      })
      .catch(() => {
        if (alive) setRemote({ mode: "fixture", orgs: FIXTURE_ORGS });
      });
    return () => {
      alive = false;
    };
  }, []);

  const orgs = remote.orgs.length > 0 ? remote.orgs : FIXTURE_ORGS;
  const org = orgs.find((item) => item.id === storedOrg) ?? orgs[0];

  const setOrgId = useCallback((id: string) => setStored(ORG_KEY, id), []);
  const setSessionId = useCallback((id: string | null) => setStored(SESSION_KEY, id), []);
  const openEvidence = useCallback((ids: string[], title?: string) => {
    if (ids.length > 0) setPanel({ ids, title });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ mode: remote.mode, orgs, org, setOrgId, sessionId, setSessionId, openEvidence }),
    [remote.mode, orgs, org, setOrgId, sessionId, setSessionId, openEvidence],
  );

  return (
    <V3Context.Provider value={value}>
      {children}
      {panel ? (
        <EvidencePanel
          key={panel.ids.join("|")}
          ids={panel.ids}
          title={panel.title}
          orgId={org.id}
          mode={remote.mode}
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
