/**
 * 사이드바 둘째 칸(소메뉴)에 보일 화면 안 구역의 이름표.
 * 화면이 구역에 `{...navSpot("summary", "요약", "재활용 실적")}`을 붙이면, 사이드바가 지금 화면에 실제로 그려진
 * 구역만 읽어 소메뉴로 보인다(shell.tsx usePageSpots). 그리지 않은 구역은 소메뉴에도 없다.
 * group이 같으면 한 묶음으로 모이고, meta는 이름 오른쪽에 붙는 한 줄 값(예: "한 달 600 kg")이다.
 */
export function navSpot(id: string, label: string, group?: string, meta?: string) {
  return {
    id,
    "data-nav-label": label,
    ...(group ? { "data-nav-group": group } : {}),
    ...(meta ? { "data-nav-meta": meta } : {}),
  };
}

/** 찾기 화면의 "AI끼리 나눈 대화" 소메뉴. 이 주소 조각(#talk)으로 오면 대화 패널을 연다 */
export const TALK_HASH = "talk";
