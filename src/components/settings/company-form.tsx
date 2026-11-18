"use client";

import { useActionState, useState, type ReactNode } from "react";
import { ComplexSelect } from "@/components/onboarding/complex-select";
import { buttonClass } from "@/components/ui/button";
import { formatBizNo } from "@/lib/bizno";
import type { IndustrialComplex } from "@/lib/domain";
import { bizNoError, KEEP_REGION, type CompanyInput } from "@/lib/auth/manage";
import { updateCompany } from "@/lib/server/manage-actions";
import { FieldError, FormNote, inputClass } from "./form-parts";

/**
 * 회사 정보 고치기(소유자). 하는 일은 회사를 등록할 때 정해서 여기서 바꾸지 않는다.
 * 백엔드가 아직 고치기를 받지 않으면(unsupported) 폼을 거두고 readOnly(읽기 표)를 보인다.
 */
export function CompanyEditForm({
  orgId,
  kindLabel,
  initial,
  keepRegion,
  complexes,
  readOnly,
}: {
  orgId: string;
  kindLabel: string;
  initial: CompanyInput;
  /** 저장된 지역이 산업단지 목록에 없을 때 그 글(고르기 맨 위에 "지금 값 그대로"로 둔다) */
  keepRegion: string | null;
  complexes: Pick<IndustrialComplex, "id" | "name" | "region">[];
  readOnly: ReactNode;
}) {
  const [state, action, pending] = useActionState(updateCompany, undefined);
  const [bizNoHint, setBizNoHint] = useState<string | null>(null);
  const values = state?.values ?? initial;
  const errors = state?.errors ?? {};
  const bizNoMessage = bizNoHint ?? errors.bizNo;

  if (state?.unsupported) {
    return (
      <>
        <FormNote tone="error">지금은 회사 정보를 고칠 수 없습니다. 잠시 후 다시 시도해 주세요.</FormNote>
        {readOnly}
      </>
    );
  }

  return (
    <form action={action} className="grid gap-6 rounded-lg border border-line bg-surface p-5 sm:p-6" noValidate>
      <input type="hidden" name="orgId" value={orgId} />
      {state?.error ? (
        <p role="alert" className="rounded-md bg-loss-bg px-3.5 py-3 text-sm text-ink">
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="org-name" className="text-sm font-medium">
          회사 이름
        </label>
        <input
          id="org-name"
          name="name"
          autoComplete="organization"
          defaultValue={values.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "org-name-error" : undefined}
          className={`${inputClass} mt-2`}
        />
        <FieldError id="org-name-error" message={errors.name} />
      </div>

      <div>
        <p className="text-sm font-medium">하는 일</p>
        <p className="mt-1.5 text-[15px]">{kindLabel}</p>
        <p className="mt-1 text-[13px] text-muted">하는 일은 회사를 등록할 때 정합니다. 다른 일을 하려면 회사를 하나 더 등록해 주세요.</p>
      </div>

      <div>
        <label htmlFor="org-complex" className="text-sm font-medium">
          지역
        </label>
        <ComplexSelect
          id="org-complex"
          name="complexId"
          complexes={complexes}
          keep={keepRegion ? { value: KEEP_REGION, label: `지금 값 그대로 (${keepRegion})` } : null}
          defaultValue={values.complexId}
          className={`${inputClass} mt-2`}
        />
        <p className="mt-1.5 text-[13px] text-muted">가까운 업체를 고르는 데 씁니다.</p>
      </div>

      <div>
        <label htmlFor="org-address" className="text-sm font-medium">
          주소 <span className="font-normal text-muted">(선택)</span>
        </label>
        <input
          id="org-address"
          name="address"
          autoComplete="street-address"
          defaultValue={values.address}
          aria-invalid={errors.address ? true : undefined}
          aria-describedby={errors.address ? "org-address-error" : undefined}
          placeholder="예: 부산 강서구 녹산산단로 00"
          className={`${inputClass} mt-2`}
        />
        <FieldError id="org-address-error" message={errors.address} />
      </div>

      <div>
        <label htmlFor="org-bizno" className="text-sm font-medium">
          사업자등록번호 <span className="font-normal text-muted">(선택)</span>
        </label>
        <input
          id="org-bizno"
          name="bizNo"
          inputMode="numeric"
          defaultValue={errors.bizNo ? values.bizNo : values.bizNo ? formatBizNo(values.bizNo) : ""}
          aria-invalid={bizNoMessage ? true : undefined}
          aria-describedby={bizNoMessage ? "org-bizno-error" : "org-bizno-hint"}
          placeholder="000-00-00000"
          onBlur={(event) => setBizNoHint(bizNoError(event.target.value))}
          onChange={() => setBizNoHint(null)}
          className={`${inputClass} mt-2 tabular-nums`}
        />
        {bizNoMessage ? (
          <FieldError id="org-bizno-error" message={bizNoMessage} />
        ) : (
          <p id="org-bizno-hint" className="mt-1.5 text-[13px] text-muted">
            숫자 10자리입니다. 비워 두면 지웁니다.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "저장하는 중" : "저장"}
        </button>
        {state?.saved && !pending ? <FormNote>저장했습니다.</FormNote> : null}
      </div>
    </form>
  );
}
