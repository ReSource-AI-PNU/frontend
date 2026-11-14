/**
 * 이름 뒤에 붙는 조사를 받침에 맞춘다. "(주)"처럼 괄호로 끝나면 괄호 안의 마지막 한글로 판단한다.
 * 한글이 없으면 "이(가)"처럼 둘 다 적는다.
 */
export function josa(word: string, pair: "이/가" | "은/는" | "을/를" | "와/과" | "으로/로") {
  const [withBatchim, without] = pair.split("/");
  const last = [...word].reverse().find((ch) => ch >= "가" && ch <= "힣");
  if (!last) return `${word}${withBatchim}(${without})`;
  const jong = (last.charCodeAt(0) - 0xac00) % 28;
  if (pair === "으로/로") return `${word}${jong === 0 || jong === 8 ? "로" : "으로"}`;
  return `${word}${jong === 0 ? without : withBatchim}`;
}
