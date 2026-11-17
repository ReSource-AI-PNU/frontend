/**
 * 소개·가입 화면에 쓰는 실제 산업 현장 사진. 모두 Unsplash 라이선스(무료 사용)로 받은 것이고,
 * 저희 고객사나 시연 회사의 사진이 아니다. 화면 아래에 찍은 사람을 적는다.
 */
export type Photo = { src: string; alt: string; by: string; href: string };

export const PHOTOS = {
  moldingHall: {
    src: "/landing/molding-hall.webp",
    alt: "사출 성형기가 줄지어 선 공장 통로. 바닥에 노란 안전선이 그어져 있다",
    by: "RPWORLD",
    href: "https://unsplash.com/photos/IWJNXtezL2I",
  },
  bales: {
    src: "/landing/bales.webp",
    alt: "여러 색 플라스틱이 뒤섞인 채 압축된 더미",
    by: "engin akyurt",
    href: "https://unsplash.com/photos/S2bfx5RJm6I",
  },
  granules: {
    src: "/landing/regrind.webp",
    alt: "푸른빛 알갱이를 가까이서 찍은 사진",
    by: "Alexander Grey",
    href: "https://unsplash.com/photos/ooxMySOfRRU",
  },
  complexDusk: {
    src: "/landing/complex-dusk.webp",
    alt: "푸른 저녁 하늘 아래 공장 건물이 줄지어 선 산업단지",
    by: "Mustafa Fatemi",
    href: "https://unsplash.com/photos/5HF_v4W4s6g",
  },
  plantFloor: {
    src: "/landing/plant-floor.webp",
    alt: "성형 설비와 작업대가 놓인 공장 바닥. 통로에 노란 선이 그어져 있다",
    by: "MGR P",
    href: "https://unsplash.com/photos/HNLlzPGbTBM",
  },
  line: {
    src: "/landing/line.webp",
    alt: "긴 생산 라인이 놓인 넓은 공장 내부",
    by: "Homa Appliances",
    href: "https://unsplash.com/photos/pWUyHVJgLhg",
  },
} satisfies Record<string, Photo>;
