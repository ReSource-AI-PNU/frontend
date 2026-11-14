/** 숫자만 남긴다. */
export function normalizeBizNo(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

/** 000-00-00000 형식으로 표시한다. */
export function formatBizNo(value: string) {
  const d = normalizeBizNo(value);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 국세청 사업자등록번호 검증 숫자 규칙. 실제 등록 여부는 국세청 상태조회 API로 따로 확인해야 한다. */
export function isValidBizNo(value: string) {
  const d = normalizeBizNo(value);
  if (d.length !== 10) return false;
  const digits = d.split("").map(Number);
  const weights = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = weights.reduce((acc, w, i) => acc + digits[i] * w, 0);
  sum += Math.floor((digits[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === digits[9];
}
