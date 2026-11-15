import { PlatformRoute } from "@/components/platform/route";
import type { Metadata } from "next";
import { DefinitionTable, formatDate, SettingsSection } from "@/components/settings/section";
import { ButtonLink } from "@/components/ui/button";
import { formatBizNo } from "@/lib/bizno";
import { findComplex } from "@/lib/complexes";
import { formatNumber } from "@/lib/format";
import { requireOrganization } from "@/lib/server/organization";

export const metadata: Metadata = { title: "설정 · 회사 정보" };

const ROLE_LABEL = { 배출: "폐기물 배출", 처리업체: "수거·처리업체", 수요처: "재생원료 수요처" } as const;

export default async function CompanySettingsPage() {
  if (process.env.PLATFORM_API_URL) return <PlatformRoute view="profile" />;
  const org = await requireOrganization();
  const complex = findComplex(org.complexId);
  const totalKg = org.wasteStreams.reduce((sum, w) => sum + w.monthlyKg, 0);

  return (
    <>
      <SettingsSection
        id="company"
        title="회사 정보"
        description="견적 요청서와 인계서 초안에 그대로 들어가는 정보입니다. 고치면 이후 만드는 문서부터 반영되며, 이미 발송한 문서는 바뀌지 않습니다."
        aside={<ButtonLink href="/onboarding">회사 정보 수정</ButtonLink>}
      >
        <DefinitionTable
          rows={[
            { label: "회사명", value: org.name },
            { label: "사업자등록번호", value: formatBizNo(org.bizNo), numeric: true },
            { label: "업종", value: org.industry },
            { label: "서비스에서 하는 역할", value: ROLE_LABEL[org.role] },
            { label: "담당자 직책", value: org.contactTitle || <span className="text-muted">입력하지 않았습니다</span> },
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
      </SettingsSection>
    </>
  );
}
