"use client";

import { useActionState, useState } from "react";
import { formatBizNo, isValidBizNo, normalizeBizNo } from "@/lib/bizno";
import { COMPANY_ROLES, STORAGE_TYPES, WASTE_ITEMS, type IndustrialComplex, type Organization } from "@/lib/domain";
import { saveOrganization } from "@/lib/server/organization-actions";
import { CheckIcon } from "../icons";
import { buttonClass } from "../ui/button";

const INDUSTRIES = [
  "플라스틱 제품 제조업",
  "1차 금속 제조업",
  "금속 가공제품 제조업",
  "기계 및 장비 제조업",
  "자동차 및 트레일러 제조업",
  "기타 운송장비 제조업 (조선 기자재)",
  "전기장비 제조업",
  "목재 및 나무제품 제조업",
  "펄프·종이 및 종이제품 제조업",
  "화학물질 및 화학제품 제조업",
  "식료품 제조업",
  "폐기물 수집·운반·처리 및 원료 재생업",
  "기타",
];

const inputClass =
  "h-11 w-full rounded-md border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted focus:border-ink focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-marker)_70%,transparent)] focus:outline-none aria-invalid:border-loss";

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-[13px] text-loss">
      {message}
    </p>
  ) : null;
}

function Section({ no, title, description, children }: { no: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-t border-line py-10 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div>
        <p className="num text-[13px] text-muted">{no}</p>
        <h2 className="mt-1 text-h2">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  );
}

export function OnboardingForm({ complexes, initial }: { complexes: IndustrialComplex[]; initial: Organization | null }) {
  const [state, action, pending] = useActionState(saveOrganization, undefined);
  const errors = state?.errors ?? {};
  const submitted = state?.values ?? {};
  const [bizNo, setBizNo] = useState(initial ? formatBizNo(initial.bizNo) : "");
  const [complexId, setComplexId] = useState(initial?.complexId ?? "");
  const [role, setRole] = useState<string>(initial?.role ?? "배출");
  const initialStreams = new Map(initial?.wasteStreams.map((w) => [w.item, w]) ?? []);
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(initial ? initial.wasteStreams.map((w) => w.item) : ["폐플라스틱"]),
  );
  const bizDigits = normalizeBizNo(bizNo);
  const bizOk = bizDigits.length === 10 && isValidBizNo(bizDigits);

  return (
    <form action={action} noValidate>
      <Section no="01" title="회사 정보" description="견적 요청서와 인계서 초안에 그대로 들어갑니다.">
        <div className="grid gap-1.5">
          <label htmlFor="name" className="text-sm font-semibold">
            회사명
          </label>
          <input id="name" name="name" defaultValue={submitted.name ?? initial?.name} required placeholder="(주)한빛정밀" aria-invalid={Boolean(errors.name)} className={inputClass} />
          <FieldError message={errors.name} />
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="bizNo" className="text-sm font-semibold">
            사업자등록번호
          </label>
          <div className="relative">
            <input
              id="bizNo"
              name="bizNo"
              inputMode="numeric"
              value={bizNo}
              onChange={(e) => setBizNo(formatBizNo(e.target.value))}
              placeholder="000-00-00000"
              aria-invalid={Boolean(errors.bizNo) || (bizDigits.length === 10 && !bizOk)}
              aria-describedby="bizNo-help"
              className={`${inputClass} num pr-28`}
            />
            {bizDigits.length === 10 ? (
              <span className={`absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1 text-[13px] font-semibold [&_svg]:size-3.5 ${bizOk ? "text-gain" : "text-loss"}`}>
                {bizOk ? (
                  <>
                    <CheckIcon />
                    형식 확인
                  </>
                ) : (
                  "번호 오류"
                )}
              </span>
            ) : null}
          </div>
          <p id="bizNo-help" className="text-[13px] text-muted">
            검증 숫자로 형식만 확인합니다. 휴·폐업 여부는 국세청 조회 연동 후 확인합니다.
          </p>
          <FieldError message={errors.bizNo} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="industry" className="text-sm font-semibold">
              업종
            </label>
            <select id="industry" name="industry" defaultValue={submitted.industry ?? initial?.industry ?? ""} aria-invalid={Boolean(errors.industry)} className={inputClass}>
              <option value="" disabled>
                업종 선택
              </option>
              {INDUSTRIES.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
            <FieldError message={errors.industry} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="contactTitle" className="text-sm font-semibold">
              담당자 직책 <span className="font-normal text-muted">(선택)</span>
            </label>
            <input id="contactTitle" name="contactTitle" defaultValue={submitted.contactTitle ?? initial?.contactTitle} placeholder="환경안전팀 대리" className={inputClass} />
          </div>
        </div>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-sm font-semibold">이 서비스에서 하는 역할</legend>
          <div className="inline-flex w-fit rounded-md bg-sunken p-[3px]">
            {COMPANY_ROLES.map((r) => (
              <label
                key={r}
                className="flex h-9 cursor-pointer items-center rounded-sm px-4 text-sm text-muted has-checked:bg-surface has-checked:font-semibold has-checked:text-ink has-checked:shadow-[0_1px_0_var(--color-line-strong)] has-focus-visible:outline-2 has-focus-visible:outline-ink"
              >
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                {r === "배출" ? "폐기물 배출" : r === "처리업체" ? "수거·처리업체" : "재생원료 수요처"}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section no="02" title="산업단지" description="같은 단지 안에서 묶어 수거할 기업과 처리업체를 찾습니다.">
        <fieldset>
          <legend className="sr-only">산업단지 선택</legend>
          {(["부산", "경남"] as const).map((region) => (
            <div key={region} className="mb-5 last:mb-0">
              <p className="mb-2 text-label text-muted">{region}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {complexes
                  .filter((c) => c.region === region)
                  .map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-start justify-between gap-3 rounded-md border border-line-strong bg-surface px-4 py-3 transition-colors hover:border-ink has-checked:border-ink has-checked:shadow-[inset_3px_0_0_var(--color-ink)] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
                    >
                      <input type="radio" name="complexId" value={c.id} checked={complexId === c.id} onChange={() => setComplexId(c.id)} className="sr-only" />
                      <span>
                        <span className="block font-semibold">{c.shortName}</span>
                        <span className="block text-[13px] text-muted">{c.name}</span>
                      </span>
                      <span className="shrink-0 text-right text-[13px] text-muted">
                        {c.type}
                        {c.areaKm2 ? <span className="num block">{c.areaKm2} km²</span> : null}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </fieldset>
        <FieldError message={errors.complexId} />
      </Section>

      <Section no="03" title="배출 품목" description="매달 나오는 양을 대략 적어 주세요. 묶음 수거 후보를 고르는 기준이 됩니다.">
        <div className="overflow-hidden rounded-lg border border-line">
          {WASTE_ITEMS.map((item) => {
            const on = enabled.has(item);
            const init = initialStreams.get(item);
            return (
              <div key={item} className="grid items-center gap-3 border-b border-line bg-surface px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_160px_150px]">
                <label className="flex cursor-pointer items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    name={`waste.${item}.on`}
                    checked={on}
                    onChange={(e) => {
                      const next = new Set(enabled);
                      if (e.target.checked) next.add(item);
                      else next.delete(item);
                      setEnabled(next);
                    }}
                    className="size-[18px] accent-ink"
                  />
                  {item}
                </label>
                <div className="relative">
                  <input
                    name={`waste.${item}.kg`}
                    inputMode="numeric"
                    defaultValue={submitted[`waste.${item}.kg`] ?? init?.monthlyKg ?? (item === "폐플라스틱" ? 800 : "")}
                    disabled={!on}
                    aria-label={`${item} 월 배출량`}
                    placeholder="0"
                    className={`${inputClass} num h-10 pr-16 text-right disabled:bg-sunken disabled:text-muted`}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-muted">kg/월</span>
                </div>
                <select
                  name={`waste.${item}.storage`}
                  defaultValue={submitted[`waste.${item}.storage`] ?? init?.storage ?? "야외·지붕"}
                  disabled={!on}
                  aria-label={`${item} 보관 장소`}
                  className={`${inputClass} h-10 disabled:bg-sunken disabled:text-muted`}
                >
                  {STORAGE_TYPES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
        <FieldError message={errors.wasteStreams} />
      </Section>

      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-4 border-t border-line bg-bg/95 px-6 py-4 backdrop-blur lg:-mx-8 lg:px-8">
        <p className="text-sm text-muted">언제든 사용자 메뉴의 &lsquo;회사 정보 수정&rsquo;에서 바꿀 수 있습니다.</p>
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? "저장 중…" : initial ? "저장" : "저장하고 산업단지 보기"}
        </button>
      </div>
    </form>
  );
}
