import type { ComponentProps } from "react";
import type { IndustrialComplex } from "@/lib/domain";

/**
 * 지역(산업단지) 고르기. 회사 등록, 회사 정보 고치기, 업체의 차고지 고르기에서 함께 쓴다.
 * 값은 산업단지 ID이고 ""는 산업단지 밖이다. keep을 주면 맨 위에 "지금 값 그대로"(값 keep.value)를 둔다:
 * 저장된 지역이 목록의 산업단지와 맞지 않을 때 그 값을 지우지 않고 남기기 위함이다. outsideLabel이 null이면 "" 항목을 두지 않는다.
 */
export function ComplexSelect({
  complexes,
  keep,
  outsideLabel = "산업단지 밖",
  ...props
}: {
  complexes: Pick<IndustrialComplex, "id" | "name" | "region">[];
  keep?: { value: string; label: string } | null;
  outsideLabel?: string | null;
} & Omit<ComponentProps<"select">, "children">) {
  return (
    <select {...props}>
      {keep ? <option value={keep.value}>{keep.label}</option> : null}
      {complexes.map((complex) => (
        <option key={complex.id} value={complex.id}>
          {complex.region} · {complex.name}
        </option>
      ))}
      {outsideLabel !== null ? <option value="">{outsideLabel}</option> : null}
    </select>
  );
}
