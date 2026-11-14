# Re:Source AI — Frontend

Next.js(App Router) + TypeScript + Tailwind CSS 기반 웹 앱. 사진·영상·성분표 업로드, 판정 결과 카드, 처리 방식별 비용·탄소 비교표, 산업단지 3D 지도 화면을 담당한다. 설계 문서는 [ReSource-AI](https://github.com/ReSource-AI-PNU/ReSource-AI) 저장소의 `docs/`를 참고한다.

## 실행

```bash
npm ci
AUTH_SECRET="$(openssl rand -base64 33)" AUTH_DEV_LOGIN=true npm run dev
```

http://localhost:3000 에서 확인한다. `AUTH_DEV_LOGIN=true`이면 이름·이메일만으로 들어가는 시연용 계정으로 가입할 수 있다. 백엔드([backend](https://github.com/ReSource-AI-PNU/backend))는 8000번 포트에서 함께 띄운다.

경로 판정은 백엔드 PR #40의 `feat/feasibility-session-integration` 브랜치에서
`uv sync --extra dev` 후 `uv run uvicorn app.main:app --reload`로 실행한 미리보기 API를
사용한다. 프런트의 `NEXT_PUBLIC_API_BASE_URL` 기본값은 `http://localhost:8000/api/v1`이며,
다른 주소를 쓰면 `.env.local`에 설정하고 프런트 서버를 다시 시작한다. 브라우저 주소에
맞게 백엔드 CORS도 설정해야 한다.

샘플 공장 진단에서 흐름을 확인하고 경로 판정으로 이동한 뒤, 발생량·확인 여부·경로를
입력하고 **경제 효과 계산**을 누른다. 결과는 가상 시연이며 저장되지 않고 다른 모의
단계에 전달되지 않는다. 백엔드가 꺼져 있으면 오류가 표시된다.

## 검사

```bash
npm run lint
npm run build
```

## 인증

- [Auth.js v5](https://authjs.dev) + Microsoft Entra External ID. `AUTH_MICROSOFT_ENTRA_ID_*` 세 값을 넣으면 "Microsoft 계정으로 로그인" 버튼이 켜진다. 가입 버튼은 `prompt=create`로 Entra 가입 화면을 연다.
- Entra 앱 등록의 리디렉션 URI: `{AUTH_URL}/api/auth/callback/microsoft-entra-id`
- 세션은 암호화된 JWT 쿠키다. `src/proxy.ts`가 보호 경로(`/upload`, `/session`, `/complex`, `/dashboard`, `/onboarding`)를 쿠키로 먼저 거르고, 실제 확인은 `src/lib/server/session.ts`에서 한다.
- Cache Components가 켜져 있으므로 세션을 읽는 컴포넌트는 반드시 `<Suspense>` 안에 둔다. 밖에 두면 빌드가 실패한다.
- 운영 배포에서는 `AUTH_DEV_LOGIN=false`, `AUTH_URL=https://실제도메인`으로 둔다.

## 모의 API

백엔드가 생기기 전까지 모든 데이터는 `.mock-db/<컬렉션>.json`(git 제외)에 저장한다. 단일 개발 서버 기준이다. 지우면 처음 상태로 돌아간다.

- 세션 데이터 계약: `src/lib/session/types.ts` (백엔드 be#1 `app/schemas.py`와 같은 모양으로 맞춘다)
- 6단계 결과: `src/lib/server/mock/pipeline.ts`가 품목별 설정표로 결정적으로 만든다. 폐플라스틱 월 800kg 기준 값은 설계안 시나리오와 같다.
- 서버 액션: `src/lib/server/session-actions.ts` (세션 생성, 단계 이동, 박스 수정, 질문 답변, 승인·발송, 실제 결과, 현장 지식 카드)
- 학습 루프: `src/lib/server/mock/learning.ts`, `learning-actions.ts` (데이터셋, 재학습, 모델 비교, 배포 게이트)
- 멤버·탈퇴: `src/lib/server/mock/members.ts`, `member-actions.ts`, `account-actions.ts`
- 산업단지·건물·기업: `data/complexes.json`, `public/data/buildings/*.geojson`(OpenStreetMap), `public/data/companies/*.json`(가상 기업). 출처와 재생성 방법은 [data/README.md](data/README.md)에 있다.
- 업로드는 서버 액션으로 받는다(최대 60MB). 운영에서는 Azure Blob SAS 직접 업로드로 바꾼다.

## 화면

| 경로 | 화면 |
|---|---|
| `/` · `/terms` · `/privacy` | 소개, 이용약관, 개인정보처리방침 (초안, 법률 검토 전) |
| `/login` · `/signup` · `/onboarding` | 로그인, 회원가입, 회사·단지·배출 품목 등록 |
| `/upload` | 사진·영상·PDF 업로드, 샘플 사진으로 체험 |
| `/session/[id]/analyzing` → `classify` → `feasibility` → `regulation` → `matching` → `cost-carbon` → `proposal` | 판정 흐름 6단계 (박스 수정, 되묻기, 손익 전환, 규정 영수증, 묶음 3D 지도, 경로 비교, 서류·승인·실제 결과) |
| `/session` · `/dashboard` | 세션 이력, 절감 비용·탄소·예측 정확도 |
| `/complex` · `/complex/[id]` | 산업단지 목록, 건물 3D 지도와 입주 기업 |
| `/knowledge` | 현장 지식 카드 (암묵지: 조건 → 판단 → 근거, 동의, 채택) |
| `/vendor` | 처리업체 시점: 받은 요청, 단지 묶음, 실제 매입 결과 기록 |
| `/admin/learning` | 라벨 검수 → 데이터셋 → 재학습 → 모델 비교 → 배포 게이트 |
| `/settings` · `/settings/members` · `/settings/account` | 회사 정보, 멤버·역할, 데이터 내보내기, 탈퇴 |

## 디자인

색, 서체, 간격, 컴포넌트 규칙은 [ReSource-AI 저장소의 DESIGN.md](https://github.com/ReSource-AI-PNU/ReSource-AI/blob/main/DESIGN.md)를 따른다. Tailwind 기본 색 팔레트는 끄고 디자인 토큰만 쓴다 (`bg-surface`, `text-muted`, `text-gain` 등). 금액·중량·탄소 숫자에는 `num` 유틸리티를 쓴다. 화면 모드는 `?theme=light` 또는 `?theme=dark`로 강제 지정할 수 있다.

## 3D 지도

MapLibre GL 6으로 배경 지도 타일 없이 건물 외곽선만 높이대로 세운다. MapLibre 6은 워커 경로를 런타임에 계산해 번들러가 찾지 못하므로, `predev`·`prebuild`에서 워커를 `public/vendor/`로 복사하고 `setWorkerUrl`로 지정한다.
