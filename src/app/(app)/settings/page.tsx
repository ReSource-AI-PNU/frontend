import type { Metadata } from "next";
import Link from "next/link";
import { DefinitionTable, formatDate, SettingsSection } from "@/components/settings/section";
import { ButtonLink } from "@/components/ui/button";
import { formatBizNo } from "@/lib/bizno";
import { findComplex } from "@/lib/complexes";
import { formatNumber } from "@/lib/format";
import { requireOrganization } from "@/lib/server/organization";

export const metadata: Metadata = { title: "설정 · 회사 정보" };

const ROLE_LABEL = { 배출: "폐기물 배출", 처리업체: "수거·처리업체", 수요처: "재생원료 수요처" } as const;

const EMPTY = <span className="text-muted">아직 입력하지 않았습니다</span>;

export default async function CompanySettingsPage() {
  const org = await requireOrganization();
  const complex = findComplex(org.complexId);
  const totalKg = org.wasteStreams.reduce((sum, w) => sum + w.monthlyKg, 0);

  return (
    <>
      <SettingsSection
        id="company"
        title="회사 정보"
        description="가입할 때는 회사 이름, 하는 일, 산업단지만 받았습니다. 사업자등록번호와 업종은 여기서 채울 수 있습니다."
        aside={<ButtonLink href="/onboarding" variant="secondary">회사 정보 {org.bizNo ? "수정" : "채우기"}</ButtonLink>}
      >
        <DefinitionTable
          rows={[
            { label: "회사명", value: org.name },
            { label: "사업자등록번호", value: org.bizNo ? formatBizNo(org.bizNo) : EMPTY, numeric: Boolean(org.bizNo) },
            { label: "업종", value: org.industry || EMPTY },
            { label: "서비스에서 하는 역할", value: ROLE_LABEL[org.role] ?? org.role },
            { label: "담당자 직책", value: org.contactTitle || EMPTY },
            {
              label: "산업단지",
              value: complex ? (
                <>
                  {complex.shortName}
                  <span className="ml-2 text-sm text-muted">{complex.name}</span>
                </>
              ) : (
                <span className="text-muted">등록된 단지를 찾을 수 없습니다</span>
              ),
            },
            { label: "등록일", value: formatDate(org.createdAt), numeric: true },
            { label: "최근 수정", value: formatDate(org.updatedAt), numeric: true },
          ]}
        />
      </SettingsSection>

      <SettingsSection
        id="streams"
        title="배출 품목"
        description="묶음 수거 후보를 고르는 기준입니다. 물량이 크게 바뀌었으면 회사 정보 수정에서 함께 고쳐 주세요."
      >
        {org.wasteStreams.length === 0 ? (
          <p className="text-[15px] text-ink-2">
            아직 등록한 품목이 없습니다. 받아 줄 곳을 찾을 폐기물은{" "}
            <Link href="/app" className="font-medium text-ink underline underline-offset-4">
              찾기 화면
            </Link>
            에서 추가합니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[480px] border-collapse text-left text-[15px]">
              <caption className="sr-only">배출 품목과 월 배출량</caption>
              <thead>
                <tr className="border-b border-line text-label text-muted">
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    품목
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                    월 배출량 (kg)
                  </th>
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    보관 장소
                  </th>
                </tr>
              </thead>
              <tbody>
                {org.wasteStreams.map((w) => (
                  <tr key={w.item} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-5 py-3 font-semibold">
                      {w.item}
                    </th>
                    <td className="num px-5 py-3 text-right">{formatNumber(w.monthlyKg)}</td>
                    <td className="px-5 py-3 text-ink-2">{w.storage ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line-strong">
                  <th scope="row" className="px-5 py-3 text-sm font-semibold text-muted">
                    합계
                  </th>
                  <td className="num px-5 py-3 text-right font-semibold">{formatNumber(totalKg)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SettingsSection>
    </>
  );
}
