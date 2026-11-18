import { test } from "node:test";
import assert from "node:assert/strict";
import { bandPath, gradeKey, layoutFlow, MIN_BAND, NODE_W, type FlowInput } from "../src/lib/v3/flow.ts";

const items: FlowInput[] = [
  {
    id: "st_sprue",
    name: "스프루·런너",
    kg: 600,
    grade: "A",
    route: "sell",
    receiver: "(주)새길자원",
  },
  {
    id: "st_film",
    name: "포장 필름",
    kg: 400,
    grade: "B",
    route: "sell",
    receiver: "(주)새길자원",
  },
  {
    id: "st_purge",
    name: "퍼지 덩어리",
    kg: 300,
    grade: "등외",
    route: "treat",
    receiver: "(주)남해열분해",
  },
  {
    id: "st_defect",
    name: "불량 사출품",
    kg: null,
    grade: null,
    route: "keep",
    receiver: null,
  },
];

test("네 열에 노드를 세우고, 같은 받는 곳은 하나로 합친다", () => {
  const flow = layoutFlow(items, 680, 300);
  const by = (column: number) => flow.nodes.filter((node) => node.column === column).map((node) => node.label);
  assert.equal(by(0).length, 4);
  assert.deepEqual(by(1), ["A등급", "B등급", "등외", "등급 확인 필요"]);
  assert.deepEqual(by(2), ["매각", "위탁 처리", "지금 방식 그대로"]);
  assert.deepEqual(by(3), ["(주)새길자원", "(주)남해열분해", "지금 처리하는 곳"]);
  assert.deepEqual(flow.unknownKg, ["st_defect"]);
});

test("띠 굵기는 발생량에 비례하고, 모르는 발생량은 가는 띠다", () => {
  const flow = layoutFlow(items, 680, 300);
  const first = (id: string) => flow.bands.find((band) => band.streamId === id && band.column === 0)!;
  const ratio = first("st_sprue").h / first("st_film").h;
  assert.ok(Math.abs(ratio - 600 / 400) < 0.01, String(ratio));
  assert.equal(first("st_defect").h, MIN_BAND);
  // 노드 높이 = 들어오는 띠의 합
  const seller = flow.nodes.find((node) => node.label === "(주)새길자원")!;
  assert.ok(Math.abs(seller.h - (first("st_sprue").h + first("st_film").h)) < 0.01);
  // 모든 노드가 그림 안에 있다
  for (const node of flow.nodes) assert.ok(node.y >= 0 && node.y + node.h <= 300 + 0.01, node.label);
  assert.equal(flow.bands.length, items.length * 3);
});

test("띠는 노드 오른쪽 가장자리에서 다음 노드 왼쪽 가장자리로 간다", () => {
  const flow = layoutFlow(items, 680, 300);
  for (const band of flow.bands) {
    const from = flow.nodes.find(
      (node) => node.column === band.column && band.y0 >= node.y - 0.01 && band.y0 + band.h <= node.y + node.h + 0.01,
    );
    assert.ok(from, `띠 ${band.streamId} ${band.column}`);
    assert.equal(band.x0, from.x + NODE_W);
  }
  assert.match(bandPath(flow.bands[0]), /^M[\d.]+,[\d.]+ C/);
  assert.equal(gradeKey("Z"), "확인 필요");
});
