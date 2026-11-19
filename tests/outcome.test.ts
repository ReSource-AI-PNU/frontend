/**
 * 실제 결과(검수 한 건)의 화면 규칙(src/lib/v3/outcome.ts). 실제 백엔드가 낸 확정 뒤 뷰(tests/fixtures/v3-view-vendor-confirmed.json:
 * 같은 날 반입 두 건, 두 번째 건 정정)로 본다.
 * 실행: node --test tests/outcome.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALREADY_SAVED,
  CORRECTED_MEANWHILE,
  REPLAYED,
  changesBetween,
  inspectionLabel,
  latestChanges,
  newRequestId,
  sameDayOrder,
} from "../src/lib/v3/outcome.ts";
import type { DiagnosisView } from "../src/lib/v3/types.ts";

const JARGON = /requestId|inspectionId|revision|API|409|422|PUT|POST|백엔드|null/;
const view = JSON.parse(
  readFileSync(new URL("./fixtures/v3-view-vendor-confirmed.json", import.meta.url), "utf8"),
) as DiagnosisView;
const outcomes = view.feedback.outcomes;

test("예시 뷰는 같은 날 같은 폐기물의 반입 두 건을 따로 싣고, 정정한 건은 최신 판과 이력을 싣는다", () => {
  assert.equal(outcomes.length, 2);
  assert.equal(new Set(outcomes.map((item) => item.inspectionId)).size, 2);
  assert.equal(outcomes[0].streamId, outcomes[1].streamId);
  assert.equal(outcomes[0].inspectedOn, outcomes[1].inspectedOn);
  const fixed = outcomes.find((item) => item.revision === 2);
  assert.ok(fixed);
  assert.equal(fixed.history.length, 1);
  assert.equal(fixed.history[0].actualKg, 120);
  assert.equal(fixed.actualKg, 110);
  assert.notEqual(fixed.history[0].evidence.kg, fixed.evidence.kg); // 앞 판 근거는 따로 남는다
});

test("요청 번호는 보낼 때마다 새로 만들고 서버가 받는 꼴이다", () => {
  const made = new Set(Array.from({ length: 50 }, () => newRequestId()));
  assert.equal(made.size, 50);
  for (const id of made) assert.match(id, /^[A-Za-z0-9_.:-]{8,100}$/);
});

test("검수 번호는 계량표 번호를 먼저 쓰고, 없으면 검수 ID 앞 6자리, 예전 기록은 이전 기록이다", () => {
  assert.equal(inspectionLabel({ inspectionId: "insp-81dfc85b52bb", weighTicket: null, legacy: false }), "검수 81dfc8");
  assert.equal(inspectionLabel({ inspectionId: "insp-81dfc85b52bb", weighTicket: "T-0002", legacy: false }), "계량표 T-0002");
  assert.equal(inspectionLabel({ inspectionId: "실제결과-x-st-2026-11-15", weighTicket: null, legacy: true }), "이전 기록");
});

test("같은 날 같은 폐기물을 여러 번 받았으면 몇 번째인지 적고, 한 건뿐이면 적지 않는다", () => {
  const order = sameDayOrder(outcomes);
  assert.deepEqual([...order.values()], ["같은 날 2건 중 1번째", "같은 날 2건 중 2번째"]);
  const single = sameDayOrder([outcomes[0], { ...outcomes[1], inspectedOn: "2026-11-18" }]);
  assert.equal(single.size, 0);
});

test("정정 줄은 바뀐 값만 앞 값 → 고친 값으로 적고, 근거가 있는 값은 어느 근거를 열지 안다", () => {
  const fixed = outcomes.find((item) => item.revision === 2);
  assert.ok(fixed);
  const changes = latestChanges(fixed);
  assert.deepEqual(changes, [{ label: "실제 중량", before: "120 kg", after: "110 kg", part: "kg" }]);
  assert.deepEqual(latestChanges(outcomes.find((item) => item.revision === 1) ?? fixed), []);
  const base = fixed.history[0];
  const moved = changesBetween(base, { ...base, inspectedOn: "2026-11-18", actualUnitPriceKrwPerKg: 300, weighTicket: "T-9" });
  assert.deepEqual(
    moved.map((item) => [item.label, item.part]),
    [
      ["검수일", null],
      ["실제 단가", "unitPrice"],
      ["계량표 번호", null],
    ],
  );
});

test("안내 문구에 개발자 말이 없다", () => {
  for (const text of [ALREADY_SAVED, CORRECTED_MEANWHILE, REPLAYED]) assert.doesNotMatch(text, JARGON, text);
});
