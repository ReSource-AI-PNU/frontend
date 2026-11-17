/**
 * 화면에 보이는 이름을 한곳에서 정한다(DESIGN.md "제품 문구 원칙"). 네트워크도 React도 부르지 않는 순수 함수다
 * (tests/labels.test.ts).
 *  - 판단 도구 이름(judge_route 같은 내부 ID)은 일반 사용자에게 보이지 않는다. 백엔드는 근거의 source를 화면 이름으로,
 *    toolLabel(근거)·detail.toolLabel(실행 기록)을 도구 이름으로 준다(계약 2장). 그것을 쓰고, 예전 서버처럼 ID가 오면
 *    아래 표(백엔드 app/v3/names.py TOOL_LABELS와 같은 낱말)로 바꾸고, 표에도 없으면 "판단 도구"로만 적는다.
 *  - 두 AI의 이름은 백엔드의 작성자 표시(author.label)와 같은 낱말을 쓴다.
 */

/** 두 AI의 이름. 백엔드 작성자 표시(author.label)와 같다. 화면 문구도 이것만 쓴다 */
export const AI_NAME = { company: "회사 측 AI", vendor: "업체 측 AI" } as const;

/** 판단 도구 ID → 하는 일. 백엔드가 이름을 주지 않을 때만 쓴다(백엔드 names.TOOL_LABELS와 같은 낱말) */
export const TOOL_LABEL: Record<string, string> = {
  identify_stream: "폐기물 식별·등급",
  judge_route: "경로 판정·매입 기준 대조",
  judge_reuse: "공정 재투입 검토",
  check_loading: "최소 물량·적재 검사",
  search_clauses: "법령 조항 찾기",
  check_requirements: "규정 확인 항목",
  match_permit: "허가 품목 대조",
  find_vendors: "업체 찾기",
  cost_carbon: "비용·탄소 계산",
  route_extra_cost: "노선 추가 비용 계산",
  optimize_assignment: "최적 배정 계산",
  grade_stream: "등급 판정",
};

/** 판단 도구가 낸 판정 */
const TOOL_STATUS: Record<string, string> = {
  calculated: "확인됨",
  conditional: "조건부",
  needs_information: "확인 필요",
  error: "실패",
};

/** 판단 도구 호출 기록의 검사 결과 */
const CHECK_STATUS: Record<string, string> = {
  met: "충족",
  conditional: "조건부",
  unmet: "맞지 않음",
  needs_information: "확인 필요",
};

/** 사용자 화면에 쓰지 않는 서비스 이름 → 하는 일 */
const SERVICE_WORDS: [RegExp, string][] = [
  [/Document Intelligence\s*추출/g, "문서에서 뽑음"],
  [/Document Intelligence/g, "문서 읽기"],
  [/Prompt Shields/g, "입력 공격 탐지기"],
  [/Azure AI Search/g, "검색"],
];

/** 소문자 낱말을 밑줄로 이은 내부 ID(judge_route, org_hanbit, st_purge 등) */
const SNAKE_ID = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;

/** 판단 도구 ID 하나의 이름. 모르는 ID면 null */
export function toolLabel(id: unknown): string | null {
  return typeof id === "string" ? (TOOL_LABEL[id] ?? null) : null;
}

/**
 * 글 안의 판단 도구 ID를 이름으로 바꾼다. 표에 없는 내부 ID는 fallback으로 바꾼다(기본: 지운다).
 * 예: "판단 도구 optimize_assignment" → "판단 도구 · 최적 배정 계산", "judge_route · conditional" → "경로 판정·매입 기준 대조 · 조건부"
 */
export function plainIds(text: string, fallback = ""): string {
  let out = text.replace(/판단 도구\s+([a-z][a-z0-9]*(?:_[a-z0-9]+)+)/g, (_, id: string) => {
    const label = TOOL_LABEL[id];
    return label ? `판단 도구 · ${label}` : "판단 도구";
  });
  out = out.replace(/(·\s*)(calculated|conditional|needs_information|error)\b/g, (_, sep: string, status: string) => `${sep}${TOOL_STATUS[status]}`);
  out = out.replace(SNAKE_ID, (id) => TOOL_LABEL[id] ?? fallback);
  for (const [pattern, word] of SERVICE_WORDS) out = out.replace(pattern, word);
  return out
    .replace(/\(\s*\)/g, "")
    .replace(/\s*·\s*(?=·|$)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type EvidenceLike = {
  id: string;
  kind: string;
  kindLabel?: string;
  label: string;
  source: string;
  excerpt: string;
  meta: Record<string, unknown>;
  /** 근거를 만든 판단 도구의 기계 ID와 화면 이름(백엔드가 준다) */
  tool?: string | null;
  toolLabel?: string | null;
};

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/** 근거를 만든 판단 도구의 이름. 백엔드가 준 toolLabel이 먼저다. 판단 도구가 아니면 null */
export function evidenceTool(item: EvidenceLike): string | null {
  const given = text(item.toolLabel);
  if (given) return given;
  const id = text(item.tool) ?? text(item.meta.tool);
  if (!id) return null;
  return TOOL_LABEL[id] ?? "판단 도구";
}

/**
 * 근거의 출처 한 줄. 백엔드는 source를 화면 이름으로 준다(저장된 글은 sourceRaw). 예전 서버가 "판단 도구 judge_route"처럼
 * 주면 이름으로 바꾼다. 내부 ID와 서비스 이름은 쓰지 않는다. 비면 null(화면은 "확인 필요")
 */
export function evidenceSource(item: EvidenceLike): string | null {
  const source = text(item.source);
  if (!source) return null;
  return plainIds(source, "판단 도구") || null;
}

/** 근거 이름. 이름이 없으면 종류 이름으로 적고 ID로 대신하지 않는다 */
export function evidenceTitle(item: EvidenceLike): string {
  return plainIds(item.label) || item.kindLabel || "근거";
}

/**
 * 근거의 원문 발췌. 판단 도구 호출 기록("판정 conditional. 검사: permit=met")은 판정과 검사 결과를 낱말로 풀어 쓴다.
 * 그 밖의 발췌는 그대로 두되 내부 ID만 이름으로 바꾼다.
 */
export function evidenceExcerpt(item: EvidenceLike, checkLabel: (key: string) => string | undefined = () => undefined): string {
  if (item.meta.call === true) {
    const status = text(item.meta.status);
    const checks = Array.isArray(item.meta.checks) ? item.meta.checks : [];
    const parts = checks.flatMap((check) => {
      const key = text((check as { key?: unknown })?.key);
      const value = text((check as { status?: unknown })?.status);
      if (!key || !value) return [];
      return [`${checkLabel(key) ?? "확인 항목"} ${CHECK_STATUS[value] ?? TOOL_STATUS[value] ?? "확인 필요"}`];
    });
    const head = status ? `판정: ${TOOL_STATUS[status] ?? CHECK_STATUS[status] ?? "확인 필요"}` : "";
    return [head, parts.length > 0 ? `검사: ${parts.join(", ")}` : ""].filter(Boolean).join(" · ");
  }
  return plainIds(item.excerpt, "판단 도구");
}

/**
 * 실행 기록 한 줄의 요약. 도구 호출이면 백엔드가 준 이름(detail.toolLabel)으로 도구 ID(detail.tool)를 바꾸고,
 * 남은 ID와 판정 낱말을 풀어 쓴다.
 */
export function eventSummary(summary: string, detail: Record<string, unknown> = {}): string {
  const id = text(detail.tool);
  const label = text(detail.toolLabel);
  const named = id && label ? summary.split(id).join(label) : summary;
  return plainIds(named, "판단 도구");
}
