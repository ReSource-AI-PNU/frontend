/**
 * 처리 업체에게 아직 문의가 없을 때의 빈 화면 글(대화 첫 화면, 받은 문의). 업체 프로필로 정한다:
 * 허가 품목이나 매입 기준이 하나라도 있으면 올리기를 권하지 않고 "아직 들어온 문의가 없습니다"만 적는다.
 * 네트워크도 React도 부르지 않는 순수 함수다(tests/vendor-empty.test.ts).
 */

import { vendorReady } from "./onboarding.ts";
export { vendorReady } from "./onboarding.ts";

/** 업체 프로필 가운데 빈 화면이 보는 것. null은 프로필이 없음(아직 아무것도 올리지 않음), undefined는 읽지 못함 */
export type VendorProfileLike = { permits?: unknown[] | null; criteria?: unknown[] | null } | null | undefined;

export type VendorEmptyCopy = {
  /** 허가 품목이나 매입 기준이 있다(문의를 받을 준비가 됐다) */
  ready: boolean;
  title: string;
  description: string;
  /** 자료 화면으로 가는 단추. upload면 올리기를 권하는 주 행동이다 */
  action: { label: string; upload: boolean };
};

/**
 * 빈 화면 글. 프로필을 읽지 못했으면(undefined) 올리기를 권하지 않는다: 이미 올린 업체에게 다시 올리라고 하지 않기 위함이다.
 * where는 문장만 바꾼다(대화 첫 화면은 "여기에 나타납니다", 받은 문의는 "이곳에 모입니다").
 */
export function vendorEmptyCopy(profile: VendorProfileLike, where: "home" | "inquiries"): VendorEmptyCopy {
  const ready = vendorReady(profile);
  if (ready || profile === undefined) {
    return {
      ready,
      title: "아직 들어온 문의가 없습니다",
      description:
        where === "home"
          ? "등록한 품목과 조건에 맞는 문의가 여기에 나타납니다. 거래를 확정하려면 허가증 원본에서 품목과 처리 방식을 대조하고 양쪽 담당자가 승인해야 합니다."
          : "배출 기업이 찾기를 시작하면 등록한 품목과 조건에 맞는 물량 문의가 이곳에 모입니다.",
      action: { label: "업체 정보 보기", upload: false },
    };
  }
  return {
    ready,
    title: "허가 품목 또는 매입 기준을 추가해 주세요",
    description:
      "둘 중 하나를 등록하면 문의 후보군에 포함됩니다. 공공 명부에 없어도 품목을 선택하거나 직접 입력할 수 있고, 기준표가 없어도 매입 기준을 추가할 수 있습니다.",
    action: { label: "업체 정보 등록", upload: true },
  };
}
