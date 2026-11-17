import type { Metadata } from "next";
import { DefinitionTable, SettingsSection } from "@/components/settings/section";
import { ButtonLink } from "@/components/ui/button";
import { KIND_LABEL, MEMBER_ROLE_LABEL } from "@/lib/auth/account";
import { formatBizNo } from "@/lib/bizno";
import { companyDetail } from "@/lib/server/company-data";
import { requireWorkspace } from "@/lib/server/workspace";

export const metadata: Metadata = { title: "설정 · 회사 정보" };

const EMPTY = <span className="text-muted">등록하지 않았습니다</span>;

export default async function CompanySettingsPage() {
  const workspace = await requireWorkspace();
  const { active, memberships } = workspace;
  const detail = await companyDetail(workspace);

  return (
    <>
      <SettingsSection id="company" title="회사 정보" description="회사를 등록할 때 적은 정보입니다.">
        <DefinitionTable
          rows={[
            { label: "회사 이름", value: active.orgName },
            { label: "하는 일", value: KIND_LABEL[active.kind] },
            { label: "내 역할", value: MEMBER_ROLE_LABEL[active.memberRole] },
            { label: "지역", value: detail.region ?? EMPTY },
            { label: "주소", value: detail.address ?? EMPTY },
            {
              label: "사업자등록번호",
              value: detail.bizNo ? formatBizNo(detail.bizNo) : EMPTY,
              numeric: Boolean(detail.bizNo),
            },
          ]}
        />
      </SettingsSection>

      <SettingsSection
        id="companies"
        title="내가 속한 회사"
        description="여러 회사에 속해 있으면 왼쪽 아래 회사 이름에서 바꿔 볼 수 있습니다."
        aside={
          <ButtonLink href="/onboarding" variant="secondary">
            회사 추가
          </ButtonLink>
        }
      >
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {memberships.map((item) => (
            <li key={item.orgId} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-5 py-3.5">
              <span className="min-w-0 flex-1 font-medium">
                {item.orgName}
                {item.orgId === active.orgId ? <span className="ml-2 text-[13px] font-normal text-muted">지금 보는 회사</span> : null}
              </span>
              <span className="text-sm text-ink-2">
                {KIND_LABEL[item.kind]} · {MEMBER_ROLE_LABEL[item.memberRole]}
              </span>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </>
  );
}
