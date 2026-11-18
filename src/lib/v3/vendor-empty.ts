/**
 * 처리 업체에게 아직 문의가 없을 때의 빈 화면 글(대화 첫 화면, 받은 문의). 업체 프로필로 정한다:
 * 허가 품목이나 매입 기준이 하나라도 있으면 올리기를 권하지 않고 "아직 들어온 문의가 없습니다"만 적는다.
 * 네트워크도 React도 부르지 않는 순수 함수다(tests/vendor-empty.test.ts).
 */

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

export function vendorReady(profile: VendorProfileLike): boolean {
  return Boolean(profile && ((profile.permits?.length ?? 0) > 0 || (profile.criteria?.length ?? 0) > 0));
}

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
          ? "배출 기업이 찾기를 시작하면, 허가 품목과 매입 기준에 맞는 물량이 여기에 나타납니다. AI가 매입 기준표의 조건으로 먼저 답하고, 확정은 담당자가 합니다."
          : "배출 기업이 찾기를 시작하면, 허가 품목과 매입 기준에 맞는 물량 문의가 이곳에 모입니다.",
      action: { label: "업체 정보 보기", upload: false },
    };
  }
  return {
    ready,
    title: "허가증과 매입 기준표를 올려 주세요",
    description:
      "허가 품목과 매입 기준이 있어야 맞는 물량 문의가 들어옵니다. 문서를 올리면 값을 뽑아 드리고, 담당자가 확인한 값만 씁니다.",
    action: { label: "허가증·매입 기준표 올리기", upload: true },
  };
}
