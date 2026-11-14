/** 대회 공지의 네 품목 */
export const WASTE_ITEMS = ["폐플라스틱", "금속 스크랩", "폐목재", "포장재"] as const;
export type WasteItem = (typeof WASTE_ITEMS)[number];

export const STORAGE_TYPES = ["실내", "야외·지붕", "야외·노출"] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];

export const COMPANY_ROLES = ["배출", "처리업체", "수요처"] as const;
export type CompanyRole = (typeof COMPANY_ROLES)[number];

export type LngLat = [number, number];
export type BBox = [number, number, number, number];

export type IndustrialComplex = {
  id: string;
  name: string;
  shortName: string;
  region: "부산" | "경남";
  type: string;
  center: LngLat;
  bbox: BBox;
  areaKm2: number | null;
  source?: string;
  approximate?: boolean;
  note?: string;
};

export type WasteStream = {
  item: WasteItem;
  detail?: string;
  monthlyKg: number;
  storage?: StorageType;
};

export type Company = {
  id: string;
  name: string;
  buildingOsmId: number;
  location: LngLat;
  industry: string;
  role: CompanyRole;
  wasteStreams: WasteStream[];
  permits?: WasteItem[];
  employees?: string;
  isDemo?: boolean;
};

/** 우리 서비스에 가입한 회사. 백엔드 be#23(기업 프로필 API)의 계약과 맞춘다. */
export type Organization = {
  id: string;
  ownerId: string;
  name: string;
  bizNo: string;
  industry: string;
  complexId: string;
  role: CompanyRole;
  contactTitle: string;
  wasteStreams: WasteStream[];
  createdAt: string;
  updatedAt: string;
};
