import type { Metadata } from "next";
import { DefinitionTable, SettingsSection } from "@/components/settings/section";
import { buttonClass } from "@/components/ui/button";
import { signOutAction } from "@/lib/server/auth-actions";
import { requireWorkspace } from "@/lib/server/workspace";

export const metadata: Metadata = { title: "설정 · 계정" };

export default async function AccountSettingsPage() {
  const { user, memberships } = await requireWorkspace();
  return (
    <SettingsSection id="account" title="내 계정" description="가입할 때 적은 정보입니다.">
      <DefinitionTable
        rows={[
          { label: "이름", value: user.name },
          { label: "이메일", value: user.email ?? <span className="text-muted">등록하지 않았습니다</span> },
          { label: "로그인 방법", value: user.id.startsWith("dev:") ? "개발용 계정" : "이메일과 비밀번호" },
          { label: "속한 회사", value: `${memberships.length}곳`, numeric: true },
        ]}
      />
      <form action={signOutAction}>
        <button type="submit" className={buttonClass("secondary")}>
          로그아웃
        </button>
      </form>
    </SettingsSection>
  );
}
