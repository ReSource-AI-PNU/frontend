/**
 * 가입하지 않은 처리 업체 후보(공공데이터 허가 명부)의 화면 문구와 묶음. 순수 함수만 둔다(tests/outside.test.ts).
 * 후보는 AI가 대화하지 않았고 손익 계산에도 넣지 않았다는 사실을 화면에 그대로 적는다.
 */
import type { OutsideCandidate, OutsideChange, OutsideVendors, QuoteFact, QuoteRequest } from "./types.ts";

export type OutsideGroup = {
  streamIds: string[];
  candidates: OutsideCandidate[];
  total: number;
  reason: string | null;
};

/** 후보 목록이 같은 폐기물끼리 묶는다(재질이 같으면 같은 업체가 나온다). 순서는 처음 나온 폐기물 순이다 */
export function groupOutside(outside: OutsideVendors): OutsideGroup[] {
  const groups: OutsideGroup[] = [];
  const byKey = new Map<string, OutsideGroup>();
  for (const stream of outside.streams) {
    const key = stream.candidates.length > 0 ? stream.candidates.map((item) => item.id).join("|") : `none:${stream.streamId}`;
    const found = byKey.get(key);
    if (found) {
      found.streamIds.push(stream.streamId);
      continue;
    }
    const group = {
      streamIds: [stream.streamId],
      candidates: stream.candidates,
      total: stream.total,
      reason: stream.reason,
    };
    byKey.set(key, group);
    groups.push(group);
  }
  return groups;
}

export function uniqueCandidates(outside: OutsideVendors): number {
  return new Set(outside.streams.flatMap((stream) => stream.candidates.map((item) => item.id))).size;
}

export function outsideHeadline(count: number): string {
  return count > 0 ? `가입하지 않은 업체 ${count}곳도 찾았습니다` : "가입하지 않은 업체 가운데 맞는 곳을 찾지 못했습니다";
}

export const OUTSIDE_LEAD =
  "공공데이터에 공개된 폐기물처리업 허가 정보로 찾은 곳입니다. 아직 가입하지 않아 AI가 대화하지 않았고 한 달 차이 계산에도 넣지 않았습니다. 견적 요청서를 만들어 직접 물어볼 수 있습니다.";

export function matchLabel(candidate: OutsideCandidate): string {
  return candidate.match === "confirmed" ? "허가 품목 맞음" : "처리 품목 확인 필요";
}

export function phoneText(candidate: Pick<OutsideCandidate, "phone" | "agency">): string {
  if (candidate.phone) return candidate.phone;
  return candidate.agency ? `전화번호 없음 · ${candidate.agency}에 문의` : "전화번호 없음";
}

export function sourceLine(outside: OutsideVendors): string {
  const range = outside.source.asOfRange;
  const when = range && range.length === 2 ? `, 기준일 ${range[0]}~${range[1]}` : "";
  return `출처: ${outside.source.name}${when}. 지자체가 올린 정보라 명부에 없는 업체도 있고, 처리 품목이 바뀌었을 수 있습니다.`;
}

/** 시연 회사(가상 자료)의 요청서 표시. 서버(outreach.DEMO_MARK)가 본문 첫 줄에 넣고, 복사한 글 끝에도 한 번 더 붙인다 */
export const DEMO_MARK = "※ 시연용 가상 자료입니다. 실제 업체에 보내지 마세요.";

/** 견적 요청서가 업체에 하지 않는 일. 시트 아래에 적는다 */
export const QUOTE_SAFE_NOTE = "복사해도 업체에 연락하거나 견적을 확정하지 않고, 한 달 손익도 바뀌지 않습니다.";

/** 이 업체가 문의 후보인 폐기물 ID(후보 목록에 나온 순서). 다른 폐기물은 고를 수 없다 */
export function vendorStreamIds(outside: OutsideVendors, vendorId: string): string[] {
  return outside.streams.filter((stream) => stream.candidates.some((item) => item.id === vendorId)).map((stream) => stream.streamId);
}

/** 후보를 찾은 뒤 바뀐 칸(화면에서 고를 때 미리 알린다) */
export function streamChanges(outside: OutsideVendors, streamId: string): { changed: OutsideChange[]; removed: boolean } {
  const entry = outside.streams.find((stream) => stream.streamId === streamId);
  return { changed: entry?.changed ?? [], removed: entry?.removed ?? false };
}

/** "재질 PP → 알루미늄, 품목 폐플라스틱 → 금속 스크랩" */
export function changesText(changes: OutsideChange[]): string {
  return changes.map((item) => `${item.label} ${item.before} → ${item.after}`).join(", ");
}

/** 고른 업체·폐기물 하나를 가리키는 열쇠. 응답과 복사 상태는 이 열쇠가 지금 것과 같을 때만 쓴다 */
export function quoteKey(vendorId: string, streamId: string): string {
  return `${vendorId}\u0000${streamId}`;
}

/** 응답이 지금 고른 업체·폐기물의 것인지(늦게 도착한 이전 응답을 버린다) */
export function isQuoteFor(letter: QuoteRequest, vendorId: string, streamId: string): boolean {
  return letter.recipient.id === vendorId && letter.streamId === streamId && (letter.vendorId ?? vendorId) === vendorId;
}

function contactLine(contact: string): string {
  return contact.trim() ? `연락처: ${contact.trim()}` : "연락처: (보내기 전에 적어 주세요)";
}

/** 복사할 글. 회신 연락처는 담당자가 적은 것을 끝에 붙인다(앱은 담당자 전화번호를 저장하지 않는다) */
export function copyText(rendered: string, contact: string, demo = false): string {
  const head = demo && !rendered.startsWith(DEMO_MARK) ? `${DEMO_MARK}\n\n` : "";
  const tail = demo ? `\n\n${DEMO_MARK}` : "";
  return `${head}${rendered.trimEnd()}\n${contactLine(contact)}${tail}\n`;
}

/** 견적 요청서의 복사할 글. 미리보기(quotePreview)를 이은 글과 같다 */
export function quoteCopy(letter: QuoteRequest, contact: string): string {
  return copyText(letter.rendered, contact, letter.demo);
}

export type PreviewPiece = { kind: "text"; text: string } | { kind: "claim"; claimId: string; display: string; evidence: string[] };

/**
 * 미리보기 조각. 글자 조각과 값 조각(누르면 근거)의 글을 이으면 quoteCopy와 글자 하나까지 같다.
 * 서버 조각이 rendered와 다르면(옛 서버) 값 조각 없이 rendered 글 하나로 그린다.
 */
export function quotePreview(letter: QuoteRequest, contact: string): PreviewPiece[] {
  const copy = quoteCopy(letter, contact);
  const body = letter.rendered.trimEnd();
  const parts: PreviewPiece[] = (letter.parts ?? []).map((part) =>
    part.type === "text"
      ? { kind: "text", text: part.text }
      : { kind: "claim", claimId: part.claimId, display: part.display, evidence: part.evidence ?? [] },
  );
  const joined = parts.map((piece) => (piece.kind === "text" ? piece.text : piece.display)).join("");
  const pieces: PreviewPiece[] = joined === letter.rendered ? parts : [{ kind: "text", text: letter.rendered }];
  // 본문 끝 공백을 덜어 낸다(복사할 글도 trimEnd로 잇는다)
  let extra = letter.rendered.length - body.length;
  while (extra > 0 && pieces.length > 0) {
    const last = pieces[pieces.length - 1];
    if (last.kind !== "text") break;
    const cut = Math.min(extra, last.text.length);
    last.text = last.text.slice(0, last.text.length - cut);
    extra -= cut;
    if (!last.text) pieces.pop();
  }
  const start = copy.indexOf(body);
  const head = copy.slice(0, start);
  const tail = copy.slice(start + body.length);
  return [...(head ? [{ kind: "text" as const, text: head }] : []), ...pieces, { kind: "text", text: tail }];
}

/** 조각을 이은 글(시험과 화면 낭독용) */
export function previewText(pieces: PreviewPiece[]): string {
  return pieces.map((piece) => (piece.kind === "text" ? piece.text : piece.display)).join("");
}

export type FactCounts = { known: number; estimated: number; unknown: number };

export function factCounts(facts: QuoteFact[]): FactCounts {
  const counts: FactCounts = { known: 0, estimated: 0, unknown: 0 };
  for (const fact of facts) counts[fact.status] += 1;
  return counts;
}

/** 폐기물 고르기 줄의 설명: "PP · 가공 전". 비어 있으면 무엇을 모르는지 적는다 */
export function itemMeta(stream: { material: string | null; form: string | null } | undefined): string {
  return [stream?.material || "재질 확인 필요", stream?.form || "형태 확인 필요"].join(" · ");
}

export function groupTitle(names: string[]): string {
  if (names.length === 0) return "폐기물";
  return names.length > 2 ? `${names.slice(0, 2).join(" · ")} 외 ${names.length - 2}가지` : names.join(" · ");
}

// ── 메일로 보내기 (2026-11-22) ──────────────────────────────────────────────
// 앱은 메일을 보내지 않는다. 담당자가 확인·수정한 글로 담당자의 메일 프로그램(또는 Gmail 쓰기 창)을 열 뿐이다.
// 공공 허가 명부에는 메일 주소가 없으므로 받는 주소는 담당자가 확인해 적고, 앱은 그 주소를 저장하지 않는다.

/** 메일 제목. 시연 회사의 글이면 앞에 시연 표시를 붙인다 */
export function mailSubject(letter: Pick<QuoteRequest, "demo" | "item">): string {
  return `${letter.demo ? "[시연용] " : ""}[견적 문의] ${letter.item.name} 처리 조건을 여쭙니다`;
}

/** 받는 주소 하나인지(여러 주소·이름 붙은 주소·공백은 받지 않는다) */
export function isEmail(value: string): boolean {
  return /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()".]+$/.test(value.trim());
}

/** 보낼 본문. 시연 회사의 글은 담당자가 시연 표시를 지워도 처음과 끝에 다시 붙인다 */
export function mailBody(body: string, demo: boolean): string {
  let text = body.trim();
  if (demo) {
    if (!text.startsWith(DEMO_MARK)) text = `${DEMO_MARK}\n\n${text}`;
    if (!text.endsWith(DEMO_MARK)) text = `${text}\n\n${DEMO_MARK}`;
  }
  return `${text}\n`;
}

function encodeAddress(to: string): string {
  return to
    .trim()
    .split("@")
    .map((part) => encodeURIComponent(part))
    .join("@");
}

/** 기본 메일 프로그램을 여는 주소(RFC 6068. 줄바꿈은 CRLF로 적는다) */
export function mailtoUrl(to: string, subject: string, body: string): string {
  const crlf = body.replace(/\r?\n/g, "\r\n");
  return `mailto:${encodeAddress(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(crlf)}`;
}

/** 기본 메일 프로그램이 없을 때 쓰는 Gmail 쓰기 창 주소 */
export function gmailUrl(to: string, subject: string, body: string): string {
  const query = new URLSearchParams({ view: "cm", fs: "1", to: to.trim(), su: subject, body });
  return `https://mail.google.com/mail/?${query.toString()}`;
}
