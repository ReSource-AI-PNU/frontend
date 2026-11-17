import type { Metadata } from "next";
import { DefinitionTable, SettingsSection } from "@/components/settings/section";
import { WithdrawForm } from "@/components/settings/withdraw-form";
import { buttonClass } from "@/components/ui/button";
import { summarizeOrgData } from "@/lib/server/account-data";
import { ensureOwnerMember, findMemberForUser } from "@/lib/server/mock/members";
import { requireOrganization } from "@/lib/server/organization";
import { getCurrentUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "설정 · 계정" };

function loginMethod(userId: string) {
  return userId.startsWith("dev:") ? "시연용 계정 (비밀번호 없음, 개발·시연 전용)" : "Microsoft 계정 (Microsoft Entra External ID)";
}

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();
  const org = await requireOrganization();
  await ensureOwnerMember(org, user);
  const [me, counts] = await Promise.all([findMemberForUser(org.id, user.id), summarizeOrgData(org)]);
  const isOwner = Boolean(me?.owner);

  const targets: { label: string; count: number | null; unit: string }[] = [
    { label: "회사 정보 (회사명, 사업자등록번호, 산업단지, 배출 품목)", count: null, unit: "" },
    { label: "멤버와 초대 기록", count: counts.members, unit: "명" },
    { label: "세션 (판정, 규정 검토, 묶음 수거, 비용·탄소 결과, 수정 기록)", count: counts.sessions, unit: "건" },
    { label: "업로드한 사진·영상·PDF", count: counts.uploads, unit: "개" },
    { label: "견적 요청서·묶음 제안 발송 기록", count: counts.outbox, unit: "건" },
    { label: "회사가 작성한 현장 지식 카드", count: counts.knowledgeCards, unit: "장" },
    { label: "세션에서 나온 학습 데이터(라벨 검수 대기 항목)", count: counts.labelTasks, unit: "건" },
  ];

  return (
    <>
      <SettingsSection id="account" title="내 계정" description="로그인한 계정의 정보입니다. 이름과 이메일은 로그인 수단에서 가져옵니다.">
        <DefinitionTable
          rows={[
            { label: "이름", value: user.name },
            { label: "이메일", value: user.email ?? <span className="text-muted">로그인 수단에서 받지 못했습니다</span> },
            { label: "로그인 수단", value: loginMethod(user.id) },
            { label: "소속 회사", value: org.name },
            { label: "역할", value: isOwner ? "소유자 · 관리자" : (me?.role ?? "담당자") },
          ]}
        />
      </SettingsSection>

      <SettingsSection
        id="export"
        title="데이터 내보내기"
        description="회사 정보, 멤버, 세션, 현장 지식 카드, 발송 기록을 JSON 파일 하나로 내려받습니다. 업로드 원본 파일은 목록만 들어갑니다."
      >
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-surface px-5 py-4">
          <p className="text-sm text-ink-2">
            세션 {counts.sessions}건, 발송 기록 {counts.outbox}건, 카드 {counts.knowledgeCards}장이 들어갑니다.
          </p>
          <a href="/api/export" download className={buttonClass("secondary")}>
            JSON 내려받기
          </a>
        </div>
      </SettingsSection>

      <section
        id="withdraw"
        aria-labelledby="withdraw-title"
        className="grid gap-5 rounded-lg border border-loss bg-surface p-6"
      >
        <div>
          <p className="text-label text-loss">위험 영역</p>
          <h2 id="withdraw-title" className="mt-1 text-h2">
            회원 탈퇴
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            탈퇴하면 {org.name}의 데이터가 즉시 지워지고 로그아웃됩니다. 지운 데이터는 되돌릴 수 없으니, 필요하면 먼저 위에서 내려받아 두세요.
          </p>
        </div>

        {isOwner ? (
          <>
            <div>
              <p className="mb-2 text-sm font-semibold">삭제 대상</p>
              <ul className="overflow-hidden rounded-md border border-line">
                {targets.map((t) => (
                  <li key={t.label} className="flex items-baseline justify-between gap-4 border-b border-line px-4 py-2.5 text-sm last:border-b-0">
                    <span className="text-ink-2">{t.label}</span>
                    {t.count !== null ? (
                      <span className="shrink-0 tabular-nums">
                        {t.count}
                        {t.unit}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              <ul className="mt-3 grid gap-1 text-[13px] text-muted">
                <li>이미 처리업체나 다른 기업에 보낸 견적 요청서는 받은 쪽에 남아 있어 지울 수 없습니다.</li>
                <li>접속 기록은 통신비밀보호법에 따라 3개월 보관한 뒤 지웁니다.</li>
                <li>Microsoft 계정 자체는 지워지지 않습니다. Microsoft 계정 설정에서 따로 관리해 주세요.</li>
              </ul>
            </div>
            <WithdrawForm orgName={org.name} />
          </>
        ) : (
          <p className="text-sm text-ink-2">회사 소유자만 탈퇴로 회사 데이터를 지울 수 있습니다. 이 회사에서 나가려면 관리자에게 제거를 요청해 주세요.</p>
        )}
      </section>
    </>
  );
}
