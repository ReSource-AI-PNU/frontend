"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { api } from "@/lib/v3/api";
import { activityOf, collectDeals, documentsOf, headlineOf, tasksOf, type Side, type Task } from "@/lib/v3/overview";
import type { DiagnosisView } from "@/lib/v3/types";
import { useV3 } from "./context";
import { useRemote } from "./use-remote";

/** 홈과 업체 대화 화면이 함께 읽는 찾기 수. 최근 것부터 */
const MAX_SESSIONS = 6;

/**
 * 내가 당사자인 최근 찾기(진단 뷰)를 모아 거래·확인할 것·최근 바뀐 것으로 바꾼다(src/lib/v3/overview.ts).
 * 열지 못한 찾기는 건너뛴다(목록에서 빼고 다음 것을 본다).
 */
export function useWorkspace() {
  const { mode, org, orgs, failedSessions, setSessionId, basePath } = useV3();
  const router = useRouter();
  // 홈·거래·업체 대화 화면이 같은 찾기 뷰를 쓴다. 화면을 옮겨도 받아 둔 것을 먼저 보이고 뒤에서 새로 읽는다(keep).
  // 체험하기와 로그인 화면은 같은 회사라도 보이는 범위가 달라 basePath로 키를 가른다
  const remote = useRemote(`workspace:${basePath}:${org.id}`, mode === "live", async () => {
    const list = await api.listSessions(org.id);
    const ids = list
      .filter((item) => !failedSessions.includes(item.id))
      .slice(0, MAX_SESSIONS)
      .map((item) => item.id);
    const settled = await Promise.allSettled(ids.map((id) => api.getView(id, org.id)));
    return settled.flatMap((item) => (item.status === "fulfilled" ? [item.value] : [])) as DiagnosisView[];
  }, { keep: true });
  const views = useMemo(() => remote.data ?? [], [remote.data]);
  const side: Side = org.role === "vendor" ? "vendor" : "emitter";
  const deals = useMemo(() => collectDeals(views), [views]);
  const nameOf = useCallback((orgId: string) => orgs.find((item) => item.id === orgId)?.name ?? "배출 기업", [orgs]);
  const tasks = useMemo(() => tasksOf(views, side, nameOf), [views, side, nameOf]);
  const headline = useMemo(() => headlineOf(views, deals), [views, deals]);
  const activity = useMemo(() => activityOf(views), [views]);
  const documents = useMemo(() => documentsOf(deals), [deals]);

  /** 확인할 것을 누르면 그 찾기를 열어 두고 해당 화면으로 간다 */
  const go = useCallback(
    (task: Pick<Task, "sessionId" | "target" | "dealKey">) => {
      setSessionId(task.sessionId);
      if (task.target === "deals") router.push(`${basePath}/deals${task.dealKey ? `?deal=${encodeURIComponent(task.dealKey)}` : ""}`);
      else router.push(`${basePath}/${task.target}`);
    },
    [basePath, router, setSessionId],
  );

  return {
    // 서버와 이어지기 전(mode loading)에도 불러오는 중으로 본다. 그때 빈 목록을 "찾기 없음"으로 읽지 않게 한다
    loading: mode === "loading" || remote.loading,
    /** 목록을 실제로 받았는지 */
    ready: mode === "live" && remote.data !== null,
    error: remote.error,
    reload: remote.reload,
    views,
    side,
    deals,
    tasks,
    headline,
    activity,
    documents,
    nameOf,
    go,
  };
}
