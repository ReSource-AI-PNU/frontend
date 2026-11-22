<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 화면(UI) 규칙

새 화면이나 기능을 넣을 때 아래를 지킨다. `tests/ui-rules.test.ts`가 기계로 볼 수 있는 것을 확인한다(CI의 단위 테스트에 포함).

- **이름**: 서비스 이름은 BYPRO(바이프로)다. 화면 문구에 "Re:Source AI"를 쓰지 않는다. 로고는 `BrandMark`(글자 로고)를 쓴다.
- **화면 구성**: 홈(`/app`)은 할 일과 진행 중인 거래, 찾기는 `/app/find`, 거래는 `/app/deals`다. 체험하기도 같다(`/demo`, `/demo/find`).
- **접기**: 화면에는 숫자·결론·해야 할 일만 두고, 설명·표·목록은 `Fold`(결과 아래 묶음)나 `MoreDetails`("자세히 보기") 안에 넣는다. 승인을 막는 이유는 접지 않는다.
- **글자**: 색 글자와 회색 글자로 뜻을 가르지 않는다(전역에서 먹색 하나로 덮는다. `globals.css` 맨 아래 묶음). 화면 글자는 12px 이상이다(인쇄용 `print:`는 예외).
- **상자**: 회색으로 채운 상자를 만들지 않는다. 상자 안에 상자를 넣지 않고 구분선(`border-t border-line`)으로 가른다.
- **모서리**: `rounded-sm`(4) · `md`(8) · `lg`(12) · `xl`(16) · `2xl`(20) · `3xl`(24)만 쓴다. 이름표는 `rounded-[6px]`, 막대는 `rounded-[2px]`. 그 밖의 `rounded-[Npx]`는 쓰지 않는다.
- **색**: 상태 색은 `gain`(좋음) · `loss`(나쁨) · `warn`(주의) · `accent`(강조) 네 가지다(`text-gain`, `bg-gain-bg` 꼴). `text-good`처럼 `globals.css`에 없는 이름은 색이 들어가지 않는다.
- **이름표**: 상태 이름표는 `inline-flex h-6 items-center rounded-[6px] px-2 text-[13px] font-medium` 한 모양이다(`Badge`, `StatusChip`). 누르는 칩(걸러 보기, 근거 열기)만 알약 모양(`rounded-full`)이다.
- **단추**: `components/ui/button`의 `Button`·`ButtonLink`·`buttonClass`를 쓴다. 한 화면에 채운 단추(primary)는 하나다.
- **E2E**: 로그인 뒤 첫 화면은 홈이다. 찾기 화면의 검사는 `/app/find`(체험하기는 `/demo/find`)로 가서 한다. 접힌 칸은 제목을 눌러 편 뒤 확인한다.

## 설문 후속 구현

2026-11-22 사용자 승인 범위: 공개 범위 단가와 거래별 좁히기, 수거 기준 선택, 기록 없는 공장 입력, 계량 CSV, 선택한 문의 상대에게 사진 공유, 확정 방문 대비 추가 노선비.

- S1: 공개 범위와 내부 협상 한도를 구분하고, 담당자가 확인한 단일 제안을 상대가 수락한 뒤 기존 승인으로 연결한다.
- S2: 처음 등록할 때 모르는 재질·형태·물량·발생 유형을 임의로 채우지 않는다.
- S3: 계량 CSV는 선택한 월만 합산하며 재업로드 결과를 표시한다. 품질 측정값을 요구하지 않는다.
- S4: 사진 공유는 직접 선택한 문의 상대에 한정하고 취소할 수 있다.
- S5: 업체 수거 기준과 업체에게만 보이는 추가 노선비를 지원한다. 예상 금액의 계산 근거와 가정을 표시한다.

검증: `node --test tests/*.test.ts`, `npx tsc --noEmit`, `npm run lint`, `NEXT_PUBLIC_API_BASE=/api/v3 npm run build`, 로컬 가상 서버 대상 `npm run test:e2e`. 결과는 `docs/verification.md`에 기록한다. 실제 설문 응답자 연락처는 저장소에 넣지 않는다.
