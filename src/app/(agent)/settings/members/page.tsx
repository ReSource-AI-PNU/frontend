import type { Metadata } from "next";
import { InviteLink } from "@/components/settings/invite-link";
import { MemberList } from "@/components/settings/member-list";
import { SettingsSection } from "@/components/settings/section";
import { capabilities } from "@/lib/server/capabilities";
import { listMembers } from "@/lib/server/company-data";
import { requireWorkspace } from "@/lib/server/workspace";

export const metadata: Metadata = { title: "설정 · 구성원" };

export default async function MembersSettingsPage() {
  const workspace = await requireWorkspace();
  const { active, user } = workspace;
  const [members, can] = await Promise.all([listMembers(workspace), capabilities()]);
  const owner = active.memberRole === "owner";

  return (
    <SettingsSection
      id="members"
      title="구성원"
      description={
        members
          ? `${active.orgName}에서 함께 일하는 사람 ${members.length}명입니다.`
          : `${active.orgName}에서 함께 일하는 사람입니다.`
      }
    >
      {owner ? (
        <InviteLink />
      ) : (
        <p className="rounded-md bg-sunken px-3.5 py-3 text-sm text-ink-2">구성원 초대는 회사 소유자가 합니다.</p>
      )}

      {members === null ? (
        <p role="alert" className="text-sm text-ink-2">
          잠시 연결이 원활하지 않아 구성원 목록을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.
        </p>
      ) : (
        <MemberList
          key={active.orgId}
          orgId={active.orgId}
          orgName={active.orgName}
          selfId={user.id}
          owner={owner}
          members={members}
          canRemove={can.memberRemove}
          canGrant={can.ownerGrant}
        />
      )}
    </SettingsSection>
  );
}
