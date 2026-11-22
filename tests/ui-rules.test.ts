/**
 * 화면(UI) 규칙 가운데 기계로 볼 수 있는 것(AGENTS.md "화면(UI) 규칙").
 * 새 화면이 들어올 때 모서리·글자 크기·이름이 흩어지지 않게 한다. 실패하면 메시지에 적힌 대로 바꾸면 된다.
 * 실행: node --test tests/ui-rules.test.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function files(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full, ext);
    return ext.test(name) ? [full] : [];
  });
}

type Hit = { file: string; line: number; found: string };

function scan(list: string[], pattern: RegExp, skip?: (match: RegExpExecArray, line: string) => boolean): Hit[] {
  const hits: Hit[] = [];
  for (const file of list) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const re = new RegExp(pattern.source, "g");
        for (let match = re.exec(line); match; match = re.exec(line)) {
          if (skip?.(match, line)) continue;
          hits.push({ file: path.relative(root, file), line: index + 1, found: match[0] });
        }
      });
  }
  return hits;
}

const report = (hits: Hit[]) => hits.map((hit) => `  ${hit.file}:${hit.line}  ${hit.found}`).join("\n");
const tsx = files(path.join(root, "src"), /\.tsx$/);

test("모서리는 정한 단계만 쓴다: rounded-sm·md·lg·xl·2xl·3xl, 이름표 [6px], 막대 [2px]", () => {
  const hits = scan(tsx, /rounded(?:-[trbl]{1,2})?-\[(\d+(?:\.\d+)?)px\]/, (match) => match[1] === "6" || match[1] === "2");
  assert.equal(
    hits.length,
    0,
    `임의 모서리 값이 있습니다. 4→rounded-sm, 8·10→rounded-md, 12·14→rounded-lg, 16·18→rounded-xl, 20→rounded-2xl, 24→rounded-3xl 로 바꿔 주세요.\n${report(hits)}`,
  );
});

test("화면 글자는 12px 이상이다(인쇄용 print: 는 예외)", () => {
  const hits = scan(tsx, /(?:[a-z-]+:)*text-\[(\d+(?:\.\d+)?)px\]/, (match) => Number(match[1]) >= 12 || match[0].includes("print:"));
  assert.equal(hits.length, 0, `12px보다 작은 글자가 있습니다. text-[12px] 이상으로 바꿔 주세요.\n${report(hits)}`);
});

test("화면 문구의 서비스 이름은 BYPRO다", () => {
  const code = files(path.join(root, "src"), /\.(tsx|ts)$/).filter((file) => !file.includes(`${path.sep}fixture-data${path.sep}`));
  const hits = scan(code, /Re:Source AI/);
  assert.equal(hits.length, 0, `옛 이름이 남아 있습니다. BYPRO로 바꿔 주세요.\n${report(hits)}`);
});
