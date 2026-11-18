import { test } from "node:test";
import assert from "node:assert/strict";
import {
  copyText,
  groupOutside,
  groupTitle,
  matchLabel,
  OUTSIDE_LEAD,
  outsideHeadline,
  phoneText,
  sourceLine,
  uniqueCandidates,
} from "../src/lib/v3/outside.ts";
import type { OutsideCandidate, OutsideVendors } from "../src/lib/v3/types.ts";

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
