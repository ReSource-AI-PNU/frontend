"use client";

import { useActionState } from "react";
import { FactoryIcon, TruckIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import type { IndustrialComplex } from "@/lib/domain";
import { saveQuickOrganization } from "@/lib/server/organization-actions";

const input =
  "min-h-12 w-full rounded-[10px] border border-line-strong bg-surface px-3.5 text-[15px] placeholder:text-muted aria-invalid:border-loss";

const ROLES = [
  { value: "배출", title: "공장에서 내보냅니다", body: "폐플라스틱을 받아 줄 곳을 찾습니다", icon: FactoryIcon },
  { value: "처리업체", title: "받아서 처리합니다", body: "조건에 맞는 물량 문의를 받습니다", icon: TruckIcon },
] as const;

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="mt-1.5 text-[13px] text-loss">
      {message}
    </p>
  ) : null;
}

/** 처음 한 번만 하는 등록. 세 가지만 묻고 바로 에이전트 화면으로 간다. */
export function QuickOnboarding({ complexes }: { complexes: IndustrialComplex[] }) {
  const [state, action, pending] = useActionState(saveQuickOrganization, undefined);
  const errors = state?.errors ?? {};
  const values = state?.values ?? {};
  return (
    <form action={action} className="grid gap-6">
      <div>
        <label htmlFor="name" className="text-sm font-medium">
          회사 이름
        </label>
        <input
          id="name"
          name="name"
          autoFocus
          autoComplete="organization"
          defaultValue={values.name ?? ""}
          aria-invalid={errors.name ? true : undefined}
          placeholder="예: (주)한빛정밀"
          className={`${input} mt-2`}
        />
        <FieldError message={errors.name} />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">하는 일</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ROLES.map((role, index) => (
            <label
              key={role.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong bg-surface p-4 transition-colors hover:border-ink has-[:checked]:border-ink has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-ink)]"
            >
              <input
                type="radio"
                name="role"
                value={role.value}
                defaultChecked={values.role ? values.role === role.value : index === 0}
                className="sr-only"
              />
              <role.icon className="mt-0.5 size-5 text-ink-2" />
              <span>
                <span className="block font-medium">{role.title}</span>
                <span className="block text-[13px] text-ink-2">{role.body}</span>
              </span>
            </label>
          ))}
        </div>
        <FieldError message={errors.role} />
      </fieldset>

      <div>
        <label htmlFor="complexId" className="text-sm font-medium">
          산업단지
        </label>
        <select
          id="complexId"
          name="complexId"
          defaultValue={values.complexId ?? complexes[0]?.id ?? ""}
          aria-invalid={errors.complexId ? true : undefined}
          className={`${input} mt-2`}
        >
          {complexes.map((complex) => (
            <option key={complex.id} value={complex.id}>
              {complex.region} · {complex.name}
            </option>
          ))}
        </select>
        <FieldError message={errors.complexId} />
      </div>

      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "!min-h-12 w-full")}>
        {pending ? "등록하는 중" : "등록하고 시작하기"}
      </button>
      <p className="-mt-2 text-[13px] text-muted">사업자등록번호와 품목별 배출량은 나중에 설정에서 채울 수 있습니다.</p>
    </form>
  );
}
