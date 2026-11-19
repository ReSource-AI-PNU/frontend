/**
 * 재활용·탄소 실적 리포트(GET /orgs/{orgId}/report)의 기간, 문구, CSV. 순수 함수만 둔다(tests/report.test.ts).
 * 2026-11-19 배출 사업장 설문에서 원하는 기능으로 "원청에 낼 재활용·탄소 감축 실적 리포트 만들어 주기"를 골랐고,
 * 같은 응답자는 "따로 남기는 기록이 없다"고 답했다. 이 서비스에서 확정하고 검수한 거래가 그대로 실적이 된다.
 * 화면의 숫자는 근거가 붙은 값(ClaimValue)으로 그린다. CSV는 그 값을 그대로 옮긴다.
 * 실제 무게·단가·등급은 업체가 검수 뒤 계량·기록한 값이고, 탄소 변화는 그 무게에 배출계수를 적용한 추정값이다.
 * 탄소 기준(비교한 현행 처리, 적용한 처리 방식, 배출계수 값·판, 계산 범위)은 검수를 기록할 때 고정되어(carbonBasis)
 * 지금 자료를 고쳐도 지난 기록의 값은 바뀌지 않는다.
 */
import { josa } from "../josa.ts";
import type { CarbonBasis, Claim, Report, ReportRecord } from "./types.ts";

export type PeriodKey = "all" | "this_month" | "last_month" | "this_year" | "last_year";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "this_month", label: "이번 달" },
  { key: "last_month", label: "지난달" },
  { key: "this_year", label: "올해" },
  { key: "last_year", label: "작년" },
];

const pad = (value: number) => String(value).padStart(2, "0");
const lastDay = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** 기간 버튼의 시작·끝 날짜(YYYY-MM-DD). today는 서버가 정한 오늘이다. 전체는 둘 다 null */
export function periodRange(key: PeriodKey, today: string): { from: string | null; to: string | null } {
  const [year, month] = today.split("-").map(Number);
  if (key === "this_month") return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay(year, month))}` };
  if (key === "last_month") {
    const y = month === 1 ? year - 1 : year;
    const m = month === 1 ? 12 : month - 1;
    return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(lastDay(y, m))}` };
  }
  if (key === "this_year") return { from: `${year}-01-01`, to: `${year}-12-31` };
  if (key === "last_year") return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
  return { from: null, to: null };
}

/** 기간 한 줄. 예: "2026-11-01 ~ 2026-11-30", "전체 기간" */
export function periodText(period: Report["period"]): string {
  if (!period.from && !period.to) return "전체 기간";
  return `${period.from ?? "처음"} ~ ${period.to ?? "오늘"}`;
}

export function reportHeadline(report: Report): string {
  const count = report.totals?.count ?? 0;
  if (count === 0) {
    return report.planned.length > 0
      ? "이 기간에 기록된 검수가 아직 없습니다"
      : "아직 실적이 없습니다";
  }
  return `검수 기록 ${count}건을 모았습니다`;
}

export const REPORT_LEAD =
  "처리 업체가 반입 검수 뒤 기록한 실제 무게와 단가로 만든 실적입니다. 탄소 변화는 그 무게에 배출계수를 적용한 추정값이고, 검수를 기록할 때의 기준으로 고정됩니다. 숫자를 누르면 근거(업체 기록과 계산)가 열립니다. 원청이나 고객사에 그대로 낼 수 있게 인쇄하거나 CSV로 내려받을 수 있습니다.";

export const EMPTY_LEAD =
  "찾기 화면에서 받아 줄 곳을 찾고 양쪽이 승인하면, 업체가 검수 결과를 기록할 때마다 여기에 실적이 쌓입니다.";

export const PLANNED_LEAD =
  "양쪽이 확정한 합의의 한 달 예상입니다. 검수 기록이 아니므로 위 합계에는 넣지 않았습니다.";

/** 기록할 때 계수나 처리 방식이 없어 탄소를 계산하지 못한 실적이 있을 때 합계 아래에 붙이는 한 줄 */
export function carbonGapNote(records: ReportRecord[]): string | null {
  // 당시 기준을 확인할 수 없는 지난 기록(unverified)은 배출계수 문제가 아니므로 unverifiedNote가 따로 밝힌다
  const missing = records.filter((item) => item.carbon === null && item.kg !== null && item.carbonBasis.status === "not_computed");
  if (missing.length === 0) return null;
  const ways = [...new Set(missing.map((item) => item.process ?? "처리 방식을 모르는 곳"))].join(", ");
  return `${josa(ways, "으로/로")} 보낸 ${missing.length}건은 공인된 배출계수가 없어 탄소 합계에 넣지 않았습니다.`;
}

/** 비교 기준이 된 현행 처리. 검수를 기록할 때 담당자가 적지 않았으면 가정임을 밝힌다 */
export function baselineNote(records: ReportRecord[]): string | null {
  const assumed = records.filter((item) => item.currentMethodAssumed && item.currentMethod);
  if (assumed.length === 0) return null;
  const method = assumed[0].currentMethod ?? "혼합 소각";
  return `탄소 변화는 검수를 기록할 때의 현행 처리와 견준 값입니다. 그때 처리 방식을 적지 않은 ${assumed.length}건은 ${josa(method, "으로/로")} 가정했습니다. 자료 화면에서 처리 방식을 고치면 그 뒤에 기록하는 검수부터 반영됩니다.`;
}

/** 이 기능 전에 기록되어 합의 당시 기준으로 재구성한 실적 */
export function reconstructedNote(records: ReportRecord[]): string | null {
  const count = records.filter((item) => item.carbonBasis.status === "reconstructed").length;
  if (count === 0) return null;
  return `${count}건은 기록할 때의 탄소 기준이 남아 있지 않아, 확정한 합의의 계산에서 현행 처리·처리 방식·배출계수를 되살려 견줬습니다(합의 당시 기준).`;
}

/** 당시 기준을 확인할 수 없어 탄소를 계산하지 않은 실적. 오늘 기준을 소급하지 않는다 */
export function unverifiedNote(records: ReportRecord[]): string | null {
  const count = records.filter((item) => item.carbonBasis.status === "unverified").length;
  if (count === 0) return null;
  return `${count}건은 기록할 때의 탄소 기준을 확인할 수 없어 오늘 기준으로 다시 계산하지 않았고, 탄소 합계에 넣지 않았습니다.`;
}

/** 탄소 변화의 계산 범위 한 줄. 화면과 인쇄, CSV에 같은 문장을 쓴다 */
export function scopeNote(report: Report): string {
  return `계산 범위: ${report.carbonScope.text}`;
}

/** 표의 탄소 칸 아래에 붙이는 기준 상태 */
export function basisTag(basis: CarbonBasis): string {
  if (basis.status === "recorded") return "기록 당시 기준";
  if (basis.status === "reconstructed") return "합의 당시 기준";
  return basis.statusLabel;
}

/** 배출계수 한 줄. 예: "3.412554 kgCO2e/kg · 환경성적표지 평가계수 · 혼합폐플라스틱 소각 · 기준일 2024-09-06 · 판 1" */
export function factorText(factor: CarbonBasis["factors"]["baseline"]): string {
  if (!factor) return "확인 불가";
  return `${round6(factor.value)} ${factor.unit} · ${factor.label} · 기준일 ${factor.asOf} · 판 ${factor.version}`;
}

/** 비교한 현행 처리와 그 출처. 예: "소각(기록 당시 폐기물 자료)" */
export function baselineText(basis: CarbonBasis): string {
  if (!basis.baseline.method) return "확인 불가";
  return basis.baseline.sourceLabel ? `${basis.baseline.method}(${basis.baseline.sourceLabel})` : basis.baseline.method;
}

/** 적용한 처리 방식과 그 출처. 예: "재활용(업체가 검수 기록에 적음)" */
export function appliedText(basis: CarbonBasis): string {
  if (!basis.applied.process) return "확인 불가";
  return basis.applied.sourceLabel ? `${basis.applied.process}(${basis.applied.sourceLabel})` : basis.applied.process;
}

const round6 = (value: number) => String(Math.round(value * 1e6) / 1e6);

function numberOf(claim: Claim | null): string {
  return claim && typeof claim.value === "number" ? String(Math.round(claim.value * 1e6) / 1e6) : "";
}

/** 표 계산기에서 수식으로 읽히지 않게 막고, 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const CSV_HEADER = [
  "검수일",
  "폐기물",
  "받은 곳",
  "적용한 처리 방식",
  "실제 등급(업체 검수)",
  "실제 중량(kg · 업체 계량)",
  "실제 단가(원/kg · +매입 −처리비)",
  "금액(원 · +받은 돈 −낸 돈)",
  "추정 탄소 변화(tCO2e · −는 감축 · 배출계수 적용)",
  "탄소 기준",
  "비교한 현행 처리",
  "현행 처리 배출계수",
  "적용 처리 배출계수",
  "계산 범위",
  "검수 ID",
  "계량표 번호",
  "정정 이력",
];

const STATUS_COUNT: [keyof NonNullable<Report["totals"]>["carbonStatus"], string][] = [
  ["recorded", "기록 당시 기준"],
  ["reconstructed", "합의 당시 기준으로 재구성"],
  ["not_computed", "계산하지 않음"],
  ["unverified", "당시 기준 확인 불가"],
];

/** 정정한 검수의 이력 한 칸. 정정하지 않았으면 빈 칸. 예: "2판(정정 1회). 1판 중량 200kg · 단가 300원/kg. 최근 사유: 계량표 재확인" */
export function correctionText(item: ReportRecord): string {
  if (item.revision <= 1 || item.history.length === 0) return "";
  const before = item.history.map((entry) => {
    const parts = [
      entry.kg === null ? null : `중량 ${entry.kg}kg`,
      entry.unitPrice === null ? null : `단가 ${entry.unitPrice}원/kg`,
      entry.grade === null ? null : `등급 ${entry.grade}`,
    ].filter(Boolean);
    return `${entry.revision}판 ${parts.join(" · ") || "값 기록 없음"}`;
  });
  const reason = item.correctionReason ? `. 최근 사유: ${item.correctionReason}` : "";
  return `${item.revision}판(정정 ${item.revision - 1}회). ${before.join("; ")}${reason}`;
}

/** 정정한 검수가 있으면 합계 아래에 붙이는 한 줄 */
export function correctionNote(records: ReportRecord[]): string | null {
  const corrected = records.filter((item) => item.revision > 1).length;
  if (corrected === 0) return null;
  return `정정한 검수 ${corrected}건은 고친 값만 합계에 넣었습니다. 정정 전 값과 사유는 업체 기록 근거와 CSV의 "정정 이력" 칸에 남아 있습니다.`;
}

/** 실적 CSV. 엑셀에서 한글이 깨지지 않게 BOM을 붙인다. 합계 줄(건수·무게·탄소, 매각 수익, 처리비)을 맨 아래에 둔다 */
export function reportCsv(report: Report): string {
  const rows = [CSV_HEADER];
  for (const item of report.records) {
    const basis = item.carbonBasis;
    rows.push([
      item.inspectedOn,
      item.streamName ?? item.streamLabel,
      item.vendorName,
      basis.applied.process ? appliedText(basis) : "",
      item.grade ?? "",
      numberOf(item.kg),
      numberOf(item.unitPrice),
      numberOf(item.amount),
      numberOf(item.carbon),
      basis.reason && basis.status !== "recorded" && basis.status !== "reconstructed"
        ? `${basis.statusLabel}: ${basis.reason}`
        : `${basis.statusLabel}(${basis.capturedOn ?? ""} 고정)`,
      baselineText(basis),
      factorText(basis.factors.baseline),
      factorText(basis.factors.applied),
      basis.scope.label,
      item.inspectionId,
      item.weighTicket ?? "",
      correctionText(item),
    ]);
  }
  if (report.totals) {
    // 칸 번호는 CSV_HEADER의 순서다(1 폐기물, 5 중량, 7 금액, 8 탄소, 9 탄소 기준, 13 계산 범위)
    const line = (label: string, cells: Record<number, string>) =>
      CSV_HEADER.map((_, index) => (index === 0 ? label : (cells[index] ?? "")));
    const counts = STATUS_COUNT.filter(([key]) => (report.totals?.carbonStatus[key] ?? 0) > 0)
      .map(([key, text]) => `${text} ${report.totals?.carbonStatus[key]}건`)
      .join(" · ");
    rows.push(
      line("합계", {
        1: `${report.totals.count}건`,
        5: numberOf(report.totals.kg),
        8: numberOf(report.totals.carbon),
        9: counts,
        13: scopeNote(report),
      }),
    );
    if (report.totals.revenue) rows.push(line("매각 수익 합계", { 7: numberOf(report.totals.revenue) }));
    if (report.totals.fee && typeof report.totals.fee.value === "number") {
      // 처리비 합계는 낸 금액의 크기로 오므로 표의 부호(−는 낸 돈)에 맞춰 적는다
      rows.push(line("처리비 합계", { 7: numberOf({ ...report.totals.fee, value: -report.totals.fee.value }) }));
    }
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function csvName(orgName: string, period: Report["period"]): string {
  const span = period.from || period.to ? `${period.from ?? "처음"}_${period.to ?? "오늘"}` : "전체";
  return `${orgName} 재활용 실적 ${span}.csv`.replace(/[\\/:*?"<>|]/g, "");
}
