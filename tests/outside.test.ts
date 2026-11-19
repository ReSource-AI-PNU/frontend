import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  changesText,
  copyText,
  DEMO_MARK,
  factCounts,
  groupOutside,
  groupTitle,
  matchLabel,
  OUTSIDE_LEAD,
  outsideHeadline,
  isQuoteFor,
  itemMeta,
  phoneText,
  previewText,
  QUOTE_SAFE_NOTE,
  quoteCopy,
  quoteKey,
  quotePreview,
  sourceLine,
  streamChanges,
  uniqueCandidates,
  vendorStreamIds,
} from "../src/lib/v3/outside.ts";
import type { OutsideCandidate, OutsideVendors, QuoteRequest } from "../src/lib/v3/types.ts";

/** 백엔드가 시연 회사(한빛정밀)로 만든 실제 응답: 같은 업체에 불량 사출품 400kg과 스프루·러너 600kg */
const LETTERS = JSON.parse(readFileSync(new URL("./fixtures/quote-requests.json", import.meta.url), "utf8")) as {
  defect: QuoteRequest;
  sprue: QuoteRequest;
};

const JARGON = /env|API|백엔드|Foundry|Ollama|data\.go\.kr|51-03|규칙 정책|연결되지 않았습니다|예시 데이터/;

function candidate(id: string, extra: Partial<OutsideCandidate> = {}): OutsideCandidate {
  return {
    id,
    name: `업체 ${id}`,
    address: "부산광역시 강서구",
    business: "폐기물중간재활용업",
    match: "confirmed",
    distance: null,
    matchedCodes: [],
    codes: [],
    permitDate: null,
    phone: null,
    agency: "부산광역시 강서구",
    asOf: "2026-09-09",
    evidence: [`ref:허가업체명부:${id}@2026-09-09`],
    note: null,
    ...extra,
  };
}

const outside: OutsideVendors = {
  source: {
    name: "공공데이터포털 전국폐기물처리업소표준데이터",
    url: "https://www.data.go.kr/data/15114147/standard.do",
    asOfRange: ["2023-07-14", "2026-10-22"],
    note: "",
    radiusKm: 60,
  },
  streams: [
    {
      streamId: "st_a",
      codes: [],
      candidates: [candidate("a"), candidate("b")],
      total: 2,
      confirmedTotal: 2,
      reason: null,
    },
    {
      streamId: "st_b",
      codes: [],
      candidates: [candidate("a"), candidate("b")],
      total: 2,
      confirmedTotal: 2,
      reason: null,
    },
    {
      streamId: "st_c",
      codes: [],
      candidates: [candidate("c", { match: "check" })],
      total: 1,
      confirmedTotal: 0,
      reason: null,
    },
    {
      streamId: "st_d",
      codes: [],
      candidates: [],
      total: 0,
      confirmedTotal: 0,
      reason: "재질이 확인되지 않아 찾지 않았습니다.",
    },
  ],
};

test("같은 후보 목록을 가진 폐기물끼리 묶고, 후보 없는 폐기물은 따로 둔다", () => {
  const groups = groupOutside(outside);
  assert.deepEqual(
    groups.map((g) => g.streamIds),
    [["st_a", "st_b"], ["st_c"], ["st_d"]],
  );
  assert.equal(groups[2].reason, "재질이 확인되지 않아 찾지 않았습니다.");
  assert.equal(uniqueCandidates(outside), 3);
});

test("문구에 개발자 말이 없다", () => {
  const texts = [
    OUTSIDE_LEAD,
    outsideHeadline(3),
    outsideHeadline(0),
    matchLabel(candidate("a")),
    matchLabel(candidate("c", { match: "check" })),
    phoneText(candidate("a")),
    phoneText(candidate("a", { agency: null })),
    sourceLine(outside),
    groupTitle(["PP 사출 불량품", "LDPE 포장 필름", "PP 스프루"]),
  ];
  for (const text of texts) assert.doesNotMatch(text, JARGON, text);
  assert.equal(groupTitle(["가", "나", "다"]), "가 · 나 외 1가지");
  assert.match(sourceLine(outside), /기준일 2023-07-14~2026-10-22/);
});

test("복사할 글 끝에 회신 연락처를 붙인다", () => {
  assert.equal(copyText("견적 요청서\n본문\n", " 010-1234-5678 "), "견적 요청서\n본문\n연락처: 010-1234-5678\n");
  assert.match(copyText("본문", ""), /보내기 전에 적어 주세요/);
});

test("업체마다 그 업체가 후보인 폐기물만 고를 수 있다", () => {
  const more: OutsideVendors = {
    ...outside,
    streams: [...outside.streams, { streamId: "st_e", codes: [], candidates: [candidate("b")], total: 1, confirmedTotal: 1, reason: null }],
  };
  assert.deepEqual(vendorStreamIds(more, "a"), ["st_a", "st_b"]);
  assert.deepEqual(vendorStreamIds(more, "b"), ["st_a", "st_b", "st_e"]);
  assert.deepEqual(vendorStreamIds(more, "c"), ["st_c"]);
  assert.deepEqual(vendorStreamIds(more, "zz"), []);
  assert.equal(itemMeta({ material: "PP", form: "가공 전" }), "PP · 가공 전");
  assert.equal(itemMeta({ material: null, form: null }), "재질 확인 필요 · 형태 확인 필요");
});

test("같은 업체에서 불량 사출품과 스프루·러너를 번갈아 고르면 미리보기와 복사할 글이 각각 그 폐기물이다", () => {
  const { defect, sprue } = LETTERS;
  assert.equal(defect.recipient.id, sprue.recipient.id, "같은 업체");
  const vendor = defect.recipient.id;
  const seen: Record<string, string> = {};
  for (const [streamId, letter] of [
    ["st_defect", defect],
    ["st_sprue", sprue],
    ["st_defect", defect],
    ["st_sprue", sprue],
  ] as const) {
    assert.ok(isQuoteFor(letter, vendor, streamId));
    for (const contact of ["", "010-1234-5678"]) {
      const copy = quoteCopy(letter, contact);
      // 미리보기 조각을 이은 글이 복사할 글과 글자 하나까지 같다
      assert.equal(previewText(quotePreview(letter, contact)), copy);
      if (contact) assert.match(copy, /\n연락처: 010-1234-5678\n/);
    }
    const copy = quoteCopy(letter, "");
    if (seen[streamId]) assert.equal(copy, seen[streamId], "다시 골라도 같은 글");
    seen[streamId] = copy;
  }
  assert.match(seen.st_defect, /- 품목: PP 사출 불량품\n/);
  assert.match(seen.st_defect, /- 한 달 발생량: 400 kg\/월 \(계량값\)/);
  assert.match(seen.st_sprue, /- 품목: PP 스프루·러너\n/);
  assert.match(seen.st_sprue, /- 한 달 발생량: 600 kg\/월 \(계량값\)/);
  assert.doesNotMatch(seen.st_defect, /600|스프루/);
  assert.doesNotMatch(seen.st_sprue, /400|불량품/);
});

test("다른 업체나 폐기물의 응답은 지금 고른 것으로 받지 않는다", () => {
  const { defect, sprue } = LETTERS;
  const vendor = defect.recipient.id;
  assert.ok(!isQuoteFor(defect, vendor, "st_sprue"), "불량 사출품 응답이 스프루를 고른 뒤 늦게 와도 버린다");
  assert.ok(!isQuoteFor(sprue, vendor, "st_defect"));
  assert.ok(!isQuoteFor(defect, "pv_other", "st_defect"), "업체를 바꾼 뒤 온 이전 업체의 응답도 버린다");
  assert.notEqual(quoteKey(vendor, "st_defect"), quoteKey(vendor, "st_sprue"));
  assert.notEqual(quoteKey("pv_a", "st_x"), quoteKey("pv_b", "st_x"));
});

test("요청서는 거래 방식·단가·방문 수거·최소 수거량·운반비 부담·공장이 낼 비용과 예상 정산을 묻는다", () => {
  const copy = quoteCopy(LETTERS.defect, "");
  for (const ask of [
    "□ 매입(귀사가 값을 치름) □ 무상 인수 □ 유상 처리(저희가 처리비를 냄)",
    "단가: kg당 ____원",
    "방문 수거: □ 가능",
    "최소 수거량: 한 번에 ____kg 이상",
    "운반비: □ 단가에 포함 □ 별도(한 번에 ____원, 부담: □ 귀사 □ 저희)",
    "그 밖에 저희가 낼 비용",
    "예상 정산(한 달 발생량 400 kg/월 기준)",
    "□ 받는 돈 □ 내는 돈",
  ]) {
    assert.ok(copy.includes(ask), ask);
  }
  // 알린 값과 사진 추정·미확인을 가른다
  assert.match(copy, /- 오염도: 6% \(사진 추정\)/);
  assert.match(copy, /- 수분: 미확인/);
  assert.deepEqual(factCounts(LETTERS.defect.facts), { known: 5, estimated: 1, unknown: 1 });
  assert.deepEqual(factCounts(LETTERS.sprue.facts), { known: 7, estimated: 0, unknown: 0 });
});

test("시연 자료는 복사한 글의 처음과 끝에 시연 표시가 남고, 실제 자료에는 없다", () => {
  const copy = quoteCopy(LETTERS.sprue, "담당 메일");
  assert.ok(LETTERS.sprue.demo);
  assert.ok(copy.startsWith(DEMO_MARK));
  assert.ok(copy.endsWith(`연락처: 담당 메일\n\n${DEMO_MARK}\n`));
  assert.equal(copy.split(DEMO_MARK).length - 1, 2);
  assert.equal(previewText(quotePreview(LETTERS.sprue, "담당 메일")), copy);
  // 서버가 첫 줄을 빠뜨린 시연 응답도 복사할 때 붙인다
  const bare = { ...LETTERS.sprue, rendered: LETTERS.sprue.rendered.replace(`${DEMO_MARK}\n\n`, ""), parts: [] };
  assert.ok(quoteCopy(bare, "").startsWith(DEMO_MARK));
  assert.equal(previewText(quotePreview(bare, "")), quoteCopy(bare, ""));
  const real = { ...bare, demo: false };
  assert.ok(!quoteCopy(real, "").includes(DEMO_MARK));
  assert.ok(quoteCopy(real, "").startsWith("견적 요청서"));
});

test("후보를 찾은 뒤 바뀐 칸을 미리 알리고, 견적 요청서가 하지 않는 일을 적는다", () => {
  const changed: OutsideVendors = {
    ...outside,
    streams: outside.streams.map((stream) =>
      stream.streamId === "st_a"
        ? {
            ...stream,
            changed: [
              { field: "material", label: "재질", before: "PP", after: "알루미늄" },
              { field: "wasteItem", label: "품목", before: "폐플라스틱", after: "금속 스크랩" },
            ],
            removed: false,
          }
        : stream,
    ),
  };
  assert.equal(changesText(streamChanges(changed, "st_a").changed), "재질 PP → 알루미늄, 품목 폐플라스틱 → 금속 스크랩");
  assert.deepEqual(streamChanges(changed, "st_b"), { changed: [], removed: false });
  assert.match(QUOTE_SAFE_NOTE, /업체에 연락하거나 견적을 확정하지 않고, 한 달 손익도 바뀌지 않습니다/);
  for (const text of [QUOTE_SAFE_NOTE, DEMO_MARK, quoteCopy(LETTERS.defect, "")]) {
    assert.doesNotMatch(text, JARGON, text);
  }
});
