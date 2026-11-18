import type { Metadata } from "next";
import { DeleteAccount, PasswordForm } from "@/components/settings/account-forms";
import { DefinitionTable, SettingsSection } from "@/components/settings/section";
import { buttonClass } from "@/components/ui/button";
import { signOutAction } from "@/lib/server/auth-actions";
import { capabilities } from "@/lib/server/capabilities";
import { requireWorkspace } from "@/lib/server/workspace";

export const metadata: Metadata = { title: "설정 · 계정" };

export default async function AccountSettingsPage() {
  const [{ user, memberships }, can] = await Promise.all([requireWorkspace(), capabilities()]);
  // 개발용 계정(로컬 개발·E2E)은 백엔드 계정이 없어 비밀번호와 계정 지우기를 두지 않는다
  const devAccount = user.id.startsWith("dev:");
  const owned = memberships.filter((item) => item.memberRole === "owner").length;

  return (
    <>
      <SettingsSection id="account" title="내 계정" description="가입할 때 적은 정보입니다.">
        <DefinitionTable
          rows={[
            { label: "이름", value: user.name },
            { label: "이메일", value: user.email ?? <span className="text-muted">등록하지 않았습니다</span> },
            { label: "로그인 방법", value: devAccount ? "개발용 계정" : "이메일과 비밀번호" },
            { label: "속한 회사", value: `${memberships.length}곳`, numeric: true },
          ]}
        />
        <form action={signOutAction}>
          <button type="submit" className={buttonClass("secondary")}>
            로그아웃
          </button>
        </form>
      </SettingsSection>

      {!devAccount && can.passwordChange ? (
        <SettingsSection id="password" title="비밀번호 바꾸기" description="지금 쓰는 비밀번호를 확인한 뒤 바꿉니다.">
          <PasswordForm />
        </SettingsSection>
      ) : null}

      {!devAccount && can.accountDelete ? (
        <SettingsSection id="delete" title="계정 지우기" description="계정을 지우면 되돌릴 수 없습니다.">
          <DeleteAccount email={user.email} companies={memberships.length} ownedCount={owned} canGrant={can.ownerGrant} />
        </SettingsSection>
      ) : null}
    </>
  );
}
