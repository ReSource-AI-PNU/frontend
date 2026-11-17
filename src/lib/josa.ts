/**
 * 한국어 조사. 화면 문장에서 이름 뒤 조사를 받침에 맞게 붙인다. 백엔드 app/v3/textutil.py의 josa와 같은 규칙이다
 * (tests/josa.test.ts가 같은 예를 본다).
 *
 *   josa("(주)미소환경", "와/과")   -> "(주)미소환경과"
 *   josa("(주)QA정밀2202", "을/를") -> "(주)QA정밀2202를"   (2는 "이"로 읽는다)
 *   josa("PP", "은/는")             -> "PP는"
 *   josa("출처(PIR·PCR)", "이/가")  -> "출처(PIR·PCR)가"
 *
 * 마지막 글자를 읽는 규칙:
 * - 한글: 받침이 있는지와 그 받침이 ㄹ인지(으로/로)를 글자 코드에서 읽는다.
 * - 닫는 괄호로 끝나면 괄호 앞의 말을 본다. 말 전체가 괄호나 따옴표에 싸여 있으면 안쪽을 본다. 따옴표, 마침표 같은 기호는 건너뛴다.
 * - 숫자: 우리말로 읽은 끝소리(0 영·십·백·천·만, 1 일, 3 삼, 6 육, 7 칠, 8 팔은 받침이 있다).
 * - 단위: kg 킬로그램, % 퍼센트, t 톤 등 읽는 소리로 본다. "kg/월"은 "월"을 본다.
 * - 영문: 대문자로 끝나면 글자 이름으로 읽는다(L 엘, M 엠, N 엔, R 알은 받침이 있다). 소문자로 끝나는 낱말은 l, m, n, ng로
 *   끝날 때만 받침이 있다고 본다(어림 규칙).
 * - 읽을 수 없으면 받침이 없는 것으로 본다.
 */

/** 조사 쌍: [받침 있을 때, 받침 없을 때]. 으로/로는 ㄹ 받침일 때도 "로"다 */
const PAIRS: Record<string, [string, string]> = {
  은는: ["은", "는"],
  이가: ["이", "가"],
  을를: ["을", "를"],
  와과: ["과", "와"],
  으로: ["으로", "로"],
  이라: ["이라", "라"],
  이나: ["이나", "나"],
  아야: ["아", "야"],
};
const ALIASES: Record<string, string> = {
  는: "은는",
  은: "은는",
  가: "이가",
  이: "이가",
  를: "을를",
  을: "을를",
  과: "와과",
  와: "와과",
  과와: "와과",
  로: "으로",
  으로로: "으로",
  는은: "은는",
  가이: "이가",
  를을: "을를",
};

const OPEN = "([{<〈《「『【";
const CLOSE = ")]}>〉》」』】";
const SKIP = "'\"`‘’“”·.,!?:; \t\n*_~";
const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
const RIEUL = 8;

/** 숫자 한 자리를 읽은 끝소리: [받침 있음, ㄹ 받침] */
const DIGITS: Record<string, [boolean, boolean]> = {
  "0": [true, false],
  "1": [true, true],
  "2": [false, false],
  "3": [true, false],
  "4": [false, false],
  "5": [false, false],
  "6": [true, false],
  "7": [true, true],
  "8": [true, true],
  "9": [false, false],
};
const LETTER_FINAL: Record<string, [boolean, boolean]> = { L: [true, true], M: [true, false], N: [true, false], R: [true, true] };
/** 단위를 읽은 끝 글자. "/" 뒤의 마지막 단위만 본다 */
const UNIT_READING: Record<string, string> = { kg: "램", t: "톤", "%": "트", km: "터", m: "터", m3: "터", tco2e: "톤", kgco2e: "램" };

function rstrip(text: string, chars: string): string {
  let end = text.length;
  while (end > 0 && chars.includes(text[end - 1])) end -= 1;
  return text.slice(0, end);
}

/** 끝의 기호를 걷어 내고, 끝의 괄호 덩어리는 그 앞의 말로 바꾼다 */
function strip(word: string): string {
  let text = String(word ?? "");
  for (let round = 0; round < 8; round += 1) {
    text = rstrip(text, SKIP);
    if (!text || !CLOSE.includes(text[text.length - 1])) break;
    let depth = 0;
    let start = -1;
    for (let index = text.length - 1; index >= 0; index -= 1) {
      if (CLOSE.includes(text[index])) depth += 1;
      else if (OPEN.includes(text[index])) {
        depth -= 1;
        if (depth === 0) {
          start = index;
          break;
        }
      }
    }
    if (start < 0) {
      text = text.slice(0, -1); // 짝이 없는 닫는 괄호
      continue;
    }
    const before = rstrip(text.slice(0, start), SKIP);
    // 괄호 앞에 말이 있으면 그 말을, 없으면(말 전체가 괄호 안이면) 안쪽을 본다
    text = before || text.slice(start + 1, -1);
  }
  return rstrip(text, SKIP);
}

/** [받침이 있는가, 그 받침이 ㄹ인가] */
export function finalSound(word: string): [boolean, boolean] {
  const text = strip(word);
  if (!text) return [false, false];
  const last = text[text.length - 1];
  const code = last.charCodeAt(0);
  if (code >= HANGUL_FIRST && code <= HANGUL_LAST) {
    const jong = (code - HANGUL_FIRST) % 28;
    return [jong !== 0, jong === RIEUL];
  }
  const afterSlash = text.split("/").pop() ?? "";
  const tail = (afterSlash.split(" ").pop() ?? "").replace(/^[0-9.,+\-−]+/, "").toLowerCase();
  if (UNIT_READING[tail]) return finalSound(UNIT_READING[tail]);
  if (/[0-9]/.test(last)) return DIGITS[last];
  if (/[A-Za-z]/.test(last)) {
    if (last === last.toUpperCase()) return LETTER_FINAL[last] ?? [false, false];
    const lowered = text.toLowerCase();
    if (lowered.endsWith("ng") || last === "m" || last === "n") return [true, false];
    if (last === "l") return [true, true];
  }
  return [false, false];
}

/** word 뒤에 올 조사만. pair는 "이/가", "은/는", "을/를", "와/과", "으로/로"(또는 "이가", "로" 같은 꼴) */
export function particle(word: string, pair: string): string {
  const compact = [...pair].filter((ch) => !"/() ".includes(ch)).join("");
  const key = ALIASES[compact] ?? compact;
  const found = PAIRS[key];
  if (!found) throw new Error(`모르는 조사: ${pair}`);
  const [closed, opened] = found;
  const [hasFinal, rieul] = finalSound(word);
  if (key === "으로") return hasFinal && !rieul ? closed : opened;
  return hasFinal ? closed : opened;
}

/** word에 조사를 붙인 글. josa("수분", "이/가") -> "수분이" */
export function josa(word: string, pair: string): string {
  return `${word}${particle(word, pair)}`;
}
