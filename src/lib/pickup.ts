import type { WasteItem } from "./domain";

/**
 * 품목별 업체 출장 최소 물량과 수거 차량 적재량(kg). 서버(모의 파이프라인)와 화면이 함께 쓴다.
 * 공개된 업체 기준은 0.1~1톤(고철 300kg, 폐목재 0.5~1톤)이고, 폐플라스틱·필름은 확인하지 못해 1톤 트럭 기준으로 가정했다.
 */
export const MIN_KG: Record<WasteItem, { minKg: number; truckKg: number }> = {
  폐플라스틱: { minKg: 1000, truckKg: 1000 },
  포장재: { minKg: 1000, truckKg: 1000 },
  "금속 스크랩": { minKg: 300, truckKg: 2500 },
  폐목재: { minKg: 500, truckKg: 1000 },
};
