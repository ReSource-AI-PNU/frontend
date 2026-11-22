/**
 * 같은 산업단지의 자원순환 후보(src/lib/v3/complex.ts). 실제 백엔드가 시연 회사(한빛정밀, 녹산)로 낸 결과의
 * complexPartners(tests/fixtures/v3-complex.json)로 본다.
 * 실행: node --test tests/complex.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  candidateLine,
  COMPLEX_LEAD,
  complexHeadline,
  complexSourceLine,
  complexStatsLead,
  complexStreamIds,
  groupComplex,
  moreLine,
  permitChip,
  quoteVendorId,
  resinChip,
  UNLISTED_NOTE,
  USES_NOTE,
} from "../src/lib/v3/complex.ts";
import { complexPartnersSchema, outsideVendorsSchema } from "../src/lib/v3/schema.ts";
import type { ComplexCandidate, ComplexPartners } from "../src/lib/v3/types.ts";

const JARGON = /env|API|백엔드|Foundry|Ollama|규칙 정책|연결되지 않았습니다|예시 데이터|null|undefined/;
const fixture = JSON.parse(readFileSync(new URL("./fixtures/v3-complex.json", import.meta.url), "utf8")) as {
  complexPartners: unknown;
  outsideVendors: unknown;
};
// 화면 스키마(엄격)로 읽힌다
const partners = complexPartnersSchema.parse(fixture.complexPartners);
const outside = outsideVendorsSchema.parse(fixture.outsideVendors);
const takes = partners.streams.flatMap((stream) => stream.takes);
const uses = partners.streams.flatMap((stream) => stream.uses);

test("시연 회사는 녹산 단지로 찾고, 폐기물마다 받는 곳과 쓰는 곳이 온다", () => {
  assert.equal(partners.complex?.id, "noksan");
  assert.ok(takes.length > 0 && uses.length > 0);
  assert.ok(takes.every((item) => item.role === "takes" && item.permit));
  assert.ok(uses.every((item) => item.role === "uses" && !item.permit));
  assert.ok([...takes, ...uses].every((item) => item.evidence.length > 0));
});

test("재질이 같은 폐기물은 한 묶음이 되고, 필름은 따로 묶인다", () => {
  const groups = groupComplex(partners);
  assert.ok(groups.length < partners.streams.length);
  assert.deepEqual(groups.flatMap((group) => group.streamIds).sort(), partners.streams.map((stream) => stream.streamId).sort());
  const film = groups.find((group) => group.streamIds.includes("st_film"));
  assert.deepEqual(film?.streamIds, ["st_film"]);
});

test("명부 제목은 제한된 목록의 개수를 표시하지 않는다", () => {
  assert.equal(complexHeadline(partners), "녹산국가산업단지 공개 명부 참고");
  const none: ComplexPartners = { ...partners, complex: null, reason: "회사가 산업단지에 등록되어 있지 않아 찾지 않았습니다.", streams: [] };
  assert.equal(complexHeadline(none), "같은 산업단지 공개 명부 참고");
});

test("허가 칩: 처리 품목까지 맞을 때만 무채색이고, 명부에 없으면 허가 확인 필요다", () => {
  const base = takes[0];
  const of = (status: "listed" | "listed_check" | "unlisted"): ComplexCandidate => ({
    ...base,
    permit: { ...base.permit!, status, vendorId: status === "unlisted" ? null : "pv_x" },
  });
  assert.deepEqual(permitChip(of("listed")), { tone: "neutral", label: "허가 품목 맞음" });
  assert.deepEqual(permitChip(of("listed_check")), { tone: "warn", label: "재활용업 허가 · 처리 품목 확인 필요" });
  assert.deepEqual(permitChip(of("unlisted")), { tone: "warn", label: "재활용 허가 확인 필요" });
  assert.equal(quoteVendorId(of("unlisted")), null);
  assert.equal(quoteVendorId(of("listed_check")), "pv_x");
  // 시연 결과에는 허가 명부에 없는 곳도, 명부에 있어 요청서를 만들 수 있는 곳도 있다
  assert.ok(takes.some((item) => item.permit?.status !== "unlisted" && quoteVendorId(item)));
});

test("재질 칩과 설명 줄은 생산품 원문을 그대로 옮긴다", () => {
  const named = [...takes, ...uses].find((item) => item.resinMatch === "named");
  assert.ok(named);
  assert.equal(resinChip(named).tone, "neutral");
  assert.match(resinChip(named).label, /생산품$/);
  const unstated = takes.find((item) => item.resinMatch === "unstated" && item.product);
  assert.ok(unstated);
  assert.deepEqual(resinChip(unstated), { tone: "warn", label: "재질 확인 필요" });
  assert.ok(candidateLine(unstated).startsWith(`생산품 “${unstated.product}”`));
});

test("견적 요청서는 그 업체가 받는 곳인 폐기물만 고를 수 있다", () => {
  const vendorId = takes.map(quoteVendorId).find(Boolean)!;
  const ids = complexStreamIds(partners, vendorId);
  assert.ok(ids.length > 0);
  for (const id of ids) {
    const stream = partners.streams.find((item) => item.streamId === id)!;
    assert.ok(stream.takes.some((item) => item.permit?.vendorId === vendorId));
  }
});

test("가입하지 않은 업체 후보에 같은 단지 표시가 온다", () => {
  const candidates = outside.streams.flatMap((stream) => stream.candidates);
  assert.ok(candidates.some((item) => item.sameComplex === true));
  assert.ok(candidates.some((item) => item.sameComplex === false));
});

test("화면 문구에 개발자 말과 숫자를 지어낸 말이 없다", () => {
  for (const text of [COMPLEX_LEAD, USES_NOTE, UNLISTED_NOTE, complexSourceLine(partners), complexHeadline(partners)]) {
    assert.doesNotMatch(text, JARGON);
  }
  assert.match(complexSourceLine(partners), /한국산업단지공단/);
  assert.equal(moreLine(18, 5), "그 밖에 13곳이 더 있습니다.");
  assert.equal(moreLine(5, 5), null);
});


test("단지 집계: 단지 전체 합계라고 밝히고 출처 줄에 통계 이름과 연도를 더한다", () => {
  const claim = (id: string, value: number) => ({ id, kind: "number" as const, value, unit: "톤/년", evidence: [`ref:${id}`] });
  const stats = {
    sheetName: "(국가)부산 명지녹산국가산업단지",
    waste: "폐합성수지류",
    dataYear: "2024",
    values: {
      generated: claim("g", 8029.59),
      recycled: claim("r", 6554.13),
      incinerated: claim("i", 1435.27),
      landfilled: claim("l", 0),
    },
    note: "단지 전체 합계",
    source: { name: "전국 폐기물 발생 및 처리현황", url: "https://example.com", publishedOn: "2025-12-31" },
  };
  const base = partners as ComplexPartners;
  const withStats = complexPartnersSchema.parse({ ...(fixture.complexPartners as object), stats }) as ComplexPartners;
  assert.match(complexStatsLead(withStats.stats!), /2024년.*단지 전체 합계/);
  assert.match(complexSourceLine(withStats), /전국 폐기물 발생 및 처리현황\(2024년 실적, 공표 2025-12-31\)/);
  assert.doesNotMatch(complexSourceLine(base), /단지 집계/);
});
