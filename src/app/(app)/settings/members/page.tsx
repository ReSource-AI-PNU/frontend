import { PlatformRoute } from "@/components/platform/route";
import type { Metadata } from "next";
import { CheckIcon, InfoIcon } from "@/components/icons";
import { InviteForm } from "@/components/settings/invite-form";
import { MemberRow, type MemberView } from "@/components/settings/member-row";
import { MEMBER_ROLES, PERMISSIONS, ROLE_SUMMARY } from "@/components/settings/roles";
import { SettingsSection } from "@/components/settings/section";
import { ensureOwnerMember, findMemberForUser, listMembers } from "@/lib/server/mock/members";
import { requireOrganization } from "@/lib/server/organization";
import { getCurrentUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "설정 · 멤버" };

export default async function MembersSettingsPage() {
  if (process.env.PLATFORM_API_URL) return <PlatformRoute view="members" />;
  const user = await getCurrentUser();
  const org = await requireOrganization();
  await ensureOwnerMember(org, user);
  const [rows, me] = await Promise.all([listMembers(org.id), findMemberForUser(org.id, user.id)]);
  const canManage = me?.role === "관리자" && me.status === "active";

  const view: MemberView[] = rows.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    status: m.status,
    owner: Boolean(m.owner),
    isMe: m.userId === user.id,
    invitedAt: m.invitedAt,
  }));
  const invited = view.filter((m) => m.status === "invited").length;

  return (
    <>
      <SettingsSection
        id="members"
        title="멤버"
        description={
          <>
            {org.name}에서 함께 일하는 사람입니다. 활성 {view.length - invited}명, 초대 수락 대기 {invited}명입니다.
          </>
        }
      >
        {canManage ? (
          <>
            <InviteForm />
            <p className="flex items-start gap-2 rounded-md bg-sunken px-3.5 py-3 text-sm text-ink-2 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0">
              <InfoIcon />
              <span>
                초대 메일은 아직 보내지 않습니다. 초대한 뒤 표의 &lsquo;초대 링크 복사&rsquo;로 링크를 복사해 메신저나 메일로 직접 전달해 주세요.
                초대 수락과 회사 연결은 백엔드 연동 후 동작합니다.
              </span>
            </p>
          </>
        ) : (
          <p className="rounded-md bg-sunken px-3.5 py-3 text-sm text-ink-2">멤버 초대와 역할 변경은 관리자만 할 수 있습니다.</p>
        )}

        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
            <caption className="sr-only">멤버 목록</caption>
            <thead>
              <tr className="border-b border-line text-label text-muted">
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  이름
                </th>
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  이메일
                </th>
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  역할
                </th>
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  상태
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  <span className="sr-only">관리</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {view.map((m) => (
                <MemberRow key={m.id} member={m} canManage={canManage} />
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <SettingsSection
        id="permissions"
        title="역할별 권한"
        description="외부로 나가는 견적 요청서는 승인권자 이상만 발송할 수 있습니다. 소유자는 항상 관리자이며 바꿀 수 없습니다."
      >
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[600px] border-collapse text-left text-[15px]">
            <caption className="sr-only">역할별 권한</caption>
            <thead>
              <tr className="border-b border-line align-bottom">
                <th scope="col" className="px-5 py-3 text-label font-semibold text-muted">
                  할 수 있는 일
                </th>
                {MEMBER_ROLES.map((r) => (
                  <th key={r} scope="col" className="w-[120px] px-5 py-3 text-center">
                    <span className="block text-sm font-semibold">{r}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.label} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-5 py-3 font-normal text-ink-2">
                    {p.label}
                  </th>
                  {MEMBER_ROLES.map((r) => {
                    const allowed = p.roles.includes(r);
                    return (
                      <td key={r} className="px-5 py-3 text-center">
                        {allowed ? (
                          <span className="inline-flex items-center gap-1 text-sm text-ink [&_svg]:size-4">
                            <CheckIcon />
                            {p.ownerOnly ? "소유자만" : "가능"}
                          </span>
                        ) : (
                          <span className="text-sm text-muted">
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">불가</span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[96px_minmax(0,1fr)]">
          {MEMBER_ROLES.map((r) => (
            <div key={r} className="contents">
              <dt className="font-semibold">{r}</dt>
              <dd className="text-ink-2">{ROLE_SUMMARY[r]}</dd>
            </div>
          ))}
        </dl>
      </SettingsSection>
    </>
  );
}
