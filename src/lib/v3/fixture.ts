/**
 * 예시 데이터. 백엔드에 연결하지 못했을 때만 불러오고(동적 import), 화면에는 "예시 데이터" 띠를 함께 보여 준다.
 *
 * 손으로 쓴 값이 아니다. 백엔드 로컬 서버(app.v3.devserver)가 시연용 가상 데이터로 실제로 낸 응답을
 * scripts/v3-capture-fixture.mjs로 받아 fixture-data/에 그대로 저장한 것이다(승인 전 상태).
 * 회사·단가·물량은 모두 가상이고, 대화는 모델이 아니라 "규칙 정책(모델 미연결)"이 썼다.
 * 뷰가 화면 타입에 맞는지는 tests/v3-view.test.ts가 검사한다.
 */
import { modelLabel } from "./format";
import evidenceJson from "./fixture-data/evidence.json";
import metaJson from "./fixture-data/meta.json";
import recordsJson from "./fixture-data/records.json";
import viewJson from "./fixture-data/view.json";
import type { DiagnosisView, Evidence, EvidenceDetail, Org, StreamRecord, VendorProfile } from "./types";

const VIEW = viewJson as unknown as DiagnosisView;
const EVIDENCE = evidenceJson as unknown as Record<string, Evidence>;

export const FIXTURE_ORGS = recordsJson.orgs as unknown as Org[];
export const FIXTURE_STREAMS = recordsJson.streams as unknown as StreamRecord[];
export const FIXTURE_VENDORS = recordsJson.vendors as unknown as Record<string, VendorProfile>;

export const FIXTURE_META = {
  /** 백엔드가 이 결과를 낸 날 */
  capturedOn: metaJson.capturedOn,
  capturedFrom: metaJson.capturedFrom,
  /** 예시 뷰는 이 배출 기업의 관점 하나만 담고 있다 */
  emitterOrgId: metaJson.emitterOrgId,
  sessionStatus: VIEW.session.status,
  /** 대화를 실제로 쓴 구현. 규칙 정책이면 모델 호출은 없었다 */
  writers: [
    ...new Set(
      VIEW.threads.flatMap((thread) => [
        modelLabel(thread.vendorModel),
        ...thread.messages.map((message) => modelLabel(message.model ?? thread.vendorModel)),
      ]),
    ),
  ],
};

/** 예시 뷰. 받아 둔 관점(배출 기업 한 곳)이 아니면 null이다. 다른 관점의 뷰를 지어내지 않는다. */
export function fixtureView(orgId: string): DiagnosisView | null {
  return orgId === FIXTURE_META.emitterOrgId ? VIEW : null;
}

/** 예시 근거와 계산 사슬. 사슬은 받아 둔 근거 안에서만 따라간다. */
export function fixtureEvidence(id: string): EvidenceDetail | null {
  const evidence = EVIDENCE[id];
  if (!evidence) return null;
  const chain: Evidence[] = [];
  const seen = new Set<string>([id]);
  const walk = (item: Evidence, depth: number) => {
    const inputs = Array.isArray(item.meta.inputEvidence) ? (item.meta.inputEvidence as string[]) : [];
    for (const next of inputs) {
      const found = EVIDENCE[next];
      if (!found || seen.has(next)) continue;
      seen.add(next);
      chain.push({ ...found, depth });
      walk(found, depth + 1);
    }
  };
  walk(evidence, 1);
  return { evidence, chain };
}

export type Fixture = {
  orgs: Org[];
  streams: StreamRecord[];
  vendors: Record<string, VendorProfile>;
  meta: typeof FIXTURE_META;
  view: typeof fixtureView;
  evidence: typeof fixtureEvidence;
};

export const FIXTURE: Fixture = {
  orgs: FIXTURE_ORGS,
  streams: FIXTURE_STREAMS,
  vendors: FIXTURE_VENDORS,
  meta: FIXTURE_META,
  view: fixtureView,
  evidence: fixtureEvidence,
};
