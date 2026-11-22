"use client";

import { useActionState } from "react";
import { FactoryIcon, TruckIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import type { IndustrialComplex } from "@/lib/domain";
import { createCompany, openInviteLink, openNegotiationTest } from "@/lib/server/company-actions";
import { ComplexSelect } from "./complex-select";

const input =
  "min-h-12 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-3.5 text-[15px] placeholder:text-muted aria-invalid:border-loss";

const KINDS = [
  { value: "emitter", title: "배출 기업", body: "공장에서 나오는 폐기물을 받아 줄 곳을 찾습니다", icon: FactoryIcon },
  { value: "vendor", title: "처리 업체", body: "파일 없이 허가 품목이나 매입 기준을 등록하고 물량 문의를 받을 수 있습니다", icon: TruckIcon },
] as const;

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="mt-1.5 text-[13px] text-loss">
      {message}
    </p>
  ) : null;
}

/** 회사 등록. 하는 일, 회사 이름, 지역만 받으면 시작하고, 사업자등록번호와 주소는 비워도 된다. */
export function CompanyForm({ complexes }: { complexes: IndustrialComplex[] }) {
  const [state, action, pending] = useActionState(createCompany, undefined);
  const errors = state?.errors ?? {};
  const values = state?.values ?? {};
  return (
    <form action={action} className="grid gap-6">
      {state?.error ? (
        <p role="alert" className="rounded-md bg-loss-bg px-3.5 py-3 text-sm text-ink">
          {state.error}
        </p>
      ) : null}
      <fieldset>
        <legend className="text-sm font-medium">하는 일</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {KINDS.map((kind, index) => (
            <label
              key={kind.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong bg-surface p-4 transition-colors hover:border-ink has-[:checked]:border-ink has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-ink)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
            >
              <input
                type="radio"
                name="kind"
                value={kind.value}
                defaultChecked={values.kind ? values.kind === kind.value : index === 0}
                className="sr-only"
              />
              <kind.icon className="mt-0.5 size-5 shrink-0 text-ink-2" />
              <span className="min-w-0">
                <span className="block font-medium">{kind.title}</span>
                <span className="block text-[13px] text-ink-2">{kind.body}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError message={errors.kind} />
      </fieldset>

      <div>
        <label htmlFor="company-name" className="text-sm font-medium">
          회사 이름
        </label>
        <input
          id="company-name"
          name="name"
          autoComplete="organization"
          defaultValue={values.name ?? ""}
          aria-invalid={errors.name ? true : undefined}
          placeholder="예: (주)가나정밀"
          className={`${input} mt-2`}
        />
        <FieldError message={errors.name} />
      </div>

      <div>
        <label htmlFor="company-complex" className="text-sm font-medium">
          지역
        </label>
        <ComplexSelect
          id="company-complex"
          name="complexId"
          complexes={complexes}
          defaultValue={values.complexId ?? complexes[0]?.id ?? ""}
          className={`${input} mt-2`}
        />
        <p className="mt-1.5 text-[13px] text-muted">가까운 업체를 고르는 데 씁니다.</p>
      </div>

      <div>
        <label htmlFor="company-address" className="text-sm font-medium">
          주소 <span className="font-normal text-muted">(선택)</span>
        </label>
        <input
          id="company-address"
          name="address"
          autoComplete="street-address"
          defaultValue={values.address ?? ""}
          aria-invalid={errors.address ? true : undefined}
          placeholder="예: 부산 강서구 녹산산단로 00"
          className={`${input} mt-2`}
        />
        <FieldError message={errors.address} />
      </div>

      <div>
        <label htmlFor="company-bizno" className="text-sm font-medium">
          사업자등록번호 <span className="font-normal text-muted">(선택)</span>
        </label>
        <input
          id="company-bizno"
          name="bizNo"
          inputMode="numeric"
          defaultValue={values.bizNo ?? ""}
          aria-invalid={errors.bizNo ? true : undefined}
          placeholder="000-00-00000"
          className={`${input} mt-2 tabular-nums`}
        />
        <FieldError message={errors.bizNo} />
      </div>

      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "!min-h-12 w-full")}>
        {pending ? "등록하는 중" : "등록하고 시작하기"}
      </button>
    </form>
  );
}

/** 이미 있는 회사에 들어가려면 받은 초대 링크를 붙여 넣는다. */
export function InviteLinkForm() {
  const [state, action, pending] = useActionState(openInviteLink, undefined);
  return (
    <form action={action} className="grid gap-2">
      <label htmlFor="invite-link" className="text-sm font-medium">
        초대를 받으셨나요?
      </label>
      <p className="text-[13px] text-muted">회사에 계신 분이 보낸 초대 링크를 붙여 넣으면 그 회사로 들어갑니다.</p>
      <div className="flex gap-2">
        <input id="invite-link" name="invite" placeholder="초대 링크" className={`${input} !min-h-11 flex-1`} />
        <button type="submit" disabled={pending} className={buttonClass("secondary", "md", "shrink-0")}>
          열기
        </button>
      </div>
      {state?.error ? (
        <p role="alert" className="text-[13px] text-loss">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function NegotiationTestForm() {
  const [state, action, pending] = useActionState(openNegotiationTest, {});
  return (
    <form action={action} className="grid gap-2">
      <p className="text-sm text-ink-2">폐기물을 직접 등록하고 가상 업체 세 곳의 견적과 협상을 비교합니다.</p>
      <details className="text-[13px] text-muted">
        <summary className="min-h-8 cursor-pointer py-1.5">테스트 조건의 참고 자료</summary>
        <p className="mt-1 leading-relaxed">
          한국환경공단의 2026년 10월 경남 중간가공품 판매가와 재활용 업계의 필름 품질 기준을 참고했습니다.
          인수 단가·최소 물량·운반비는 테스트 조건입니다.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3">
          <a href="https://www.data.go.kr/data/3076421/fileData.do" className="underline underline-offset-4">한국환경공단 가격조사</a>
          <a href="https://www.isrispecs.org/wp-content/uploads/2026/01/2026-January-ReMA_ISRI_Specifications.pdf" className="underline underline-offset-4">ReMA 품질 기준</a>
        </p>
      </details>
      <button type="submit" disabled={pending} className={buttonClass("secondary", "md", "w-fit")}>
        {pending ? "테스트 회사 여는 중" : "협상 테스트 회사 열기"}
      </button>
      <FieldError message={state.error} />
    </form>
  );
}
