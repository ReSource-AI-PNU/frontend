const dateFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(fmt: Intl.DateTimeFormat, iso: string) {
  return Object.fromEntries(fmt.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
}

/** 2026.11.09 (숫자만 있으므로 num 서체로 쓸 수 있다) */
export function formatDate(iso: string) {
  const p = parts(dateFmt, iso);
  return `${p.year}.${p.month}.${p.day}`;
}

/** 11.09 14:20 */
export function formatDateTime(iso: string) {
  const p = parts(dateTimeFmt, iso);
  return `${p.month}.${p.day} ${p.hour}:${p.minute}`;
}

/** 11.09 */
export function formatMonthDay(iso: string) {
  const p = parts(dateTimeFmt, iso);
  return `${p.month}.${p.day}`;
}
