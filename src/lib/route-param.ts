/** 주소의 동적 조각(업체 대화 번호, 폐기물 번호)을 원래 값으로 되돌린다. 잘못 적힌 주소는 그대로 둔다 */
export function routeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
