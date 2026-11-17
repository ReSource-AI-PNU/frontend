import type { Metadata } from "next";
import { InviteLink } from "@/components/settings/invite-link";
import { SettingsSection } from "@/components/settings/section";
import { MEMBER_ROLE_LABEL } from "@/lib/auth/account";
import { listMembers } from "@/lib/server/company-data";
import { requireWorkspace } from "@/lib/server/workspace";

export const metadata: Metadata = { title: "설정 · 멤버" };

export default async function MembersSettingsPage() {
  const workspace = await requireWorkspace();
  const { active, user } = workspace;
  const members = await listMembers(workspace);
  const owner = active.memberRole === "owner";

  return (
    <SettingsSection
      id="members"
      title="멤버"
      description={
        members
          ? `${active.orgName}에서 함께 일하는 사람 ${members.length}명입니다.`
          : `${active.orgName}에서 함께 일하는 사람입니다.`
      }
    >
      {owner ? (
        <InviteLink />
      ) : (
        <p className="rounded-md bg-sunken px-3.5 py-3 text-sm text-ink-2">멤버 초대는 회사 소유자만 할 수 있습니다.</p>
      )}

      {members === null ? (
        <p role="alert" className="text-sm text-ink-2">
          잠시 연결이 원활하지 않아 멤버 목록을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {members.map((member) => (
            <li key={member.userId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {member.name}
                  {member.userId === user.id ? <span className="ml-2 text-[13px] font-normal text-muted">나</span> : null}
                </span>
                <span className="block truncate text-sm text-muted">{member.email}</span>
              </span>
              <span className="shrink-0 text-sm text-ink-2">{MEMBER_ROLE_LABEL[member.memberRole]}</span>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}
