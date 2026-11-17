# Re:Source AI — Frontend

Next.js(App Router) + TypeScript + Tailwind CSS 기반 웹 앱. 사진·영상·성분표 업로드, 판정 결과 카드, 처리 방식별 비용·탄소 비교표, 산업단지 3D 지도 화면을 담당한다. 설계 문서는 [ReSource-AI](https://github.com/ReSource-AI-PNU/ReSource-AI) 저장소의 `docs/`를 참고한다.


## 실행

```bash
npm ci
# 1) 백엔드 로컬 서버(backend 저장소, 표준 라이브러리만 쓴다. 시작할 때 시연 데이터를 올린다)
python3 -m app.v3.devserver --port 8000
# 2) 프런트: 브라우저는 통로(/api/v3)를 부르고, 통로가 백엔드(header 모드)를 부른다
NEXT_PUBLIC_API_BASE=/api/v3 V3_BACKEND_URL=http://localhost:8000/api/v3 V3_AUTH=header \
AUTH_SECRET="$(openssl rand -base64 33)" AUTH_DEV_LOGIN=true AUTH_TRUST_HOST=true npm run dev
```

http://localhost:3000 에서 확인한다. 로그인 화면의 "개발용 빠른 로그인"(이름·이메일)으로 들어가면 시연 데이터의 모든 회사에 속한 것으로 보고, 사이드바 아래 "회사"에서 바꿔 가며 배출 기업과 처리 업체 양쪽을 시험할 수 있다. 개발용 로그인은 `AUTH_DEV_LOGIN=true`이고 `V3_AUTH`가 `bff`가 아닐 때만 켜진다. 환경 변수는 `.env.example`에 있다.

## 계정과 회사

- **가입·로그인:** 이메일과 비밀번호. 프런트 서버가 백엔드 `POST /accounts/signup`, `POST /accounts/login`을 서버 키로 부르고, 세션 JWT(Auth.js)에 사용자 ID·이름·이메일·소속 회사(멤버십)·활성 회사를 담는다. Microsoft 로그인은 `AUTH_MICROSOFT_ENTRA_ID_*` 세 값이 다 있을 때만 버튼이 나온다.
- **회사 등록·초대:** 가입한 뒤 `/onboarding`에서 회사를 등록하거나(배출 기업/처리 업체, 이름, 지역, 주소·사업자등록번호는 선택 → `POST /orgs`) 받은 초대 링크(`/invite/<토큰>` → `POST /invites/{token}/accept`)로 들어간다. 소유자는 설정의 멤버 화면에서 초대 링크를 만든다(`POST /orgs/{orgId}/invites`).
- **활성 회사:** 화면과 통로는 세션의 활성 회사로만 일한다. 소속이 둘 이상이면 사이드바 아래에서 바꾼다(서버 액션이 세션을 고치고, 소속은 백엔드 `GET /accounts/me`에서 다시 읽는다).
- **체험하기(`/demo`):** 로그인 없이 시연 회사(백엔드 `GET /demo/orgs`의 배출 기업)를 읽기 전용으로 둘러본다. 화면 위에 "체험 중 · 시연 회사의 가상 데이터입니다"와 가입하기가 있고, 저장·찾기·승인·업로드는 숨기거나 끈다.
- 세션을 읽는 컴포넌트는 Cache Components 때문에 반드시 `<Suspense>` 안에 둔다. `src/proxy.ts`는 `/app`, `/settings`, `/onboarding`을 쿠키로 먼저 거른다.

## 백엔드 통로

브라우저는 백엔드를 직접 부르지 않는다. `src/app/api/v3/[...path]`(로그인한 사람)와 `src/app/api/v3-demo/[...path]`(체험하기, GET만)가 넘기고, 넘길지 막을지와 머리글은 `src/lib/v3/backend-plan.ts`가 정한다.

| `V3_AUTH` | 프런트 서버가 붙이는 것 | 쓰는 곳 |
|---|---|---|
| `bff` | `Authorization: Bearer ${V3_BFF_KEY}`, `X-User-Id`, `X-Org-Id`(활성 회사). 체험하기는 `X-Demo-View: 1`과 시연 회사의 `X-Org-Id`만 | 운영 |
| `header` | `X-Org-Id`만 | 백엔드 로컬 서버로 개발·E2E |
| `token` | 회사별 토큰(`V3_ORG_TOKENS`) | 예전 방식 |

- 회사는 세션에서만 정한다. 브라우저가 보낸 `X-Org-Id`는 버리고, 주소의 회사(`/orgs/{id}/…`, 쓰기 `/vendors/{id}`)가 활성 회사와 다르면 403 `ORG_MISMATCH`.
- 체험하기의 쓰기는 백엔드에 닿기 전에 403 `DEMO_READ_ONLY`. 계정·초대 경로는 서버 액션만 부른다(통로로는 403).
- 사용자에게는 "잠시 연결이 원활하지 않습니다…" 같은 말만 보이고, 원인 코드(`BACKEND_NOT_SET`, `BACKEND_UNREACHABLE` 등)는 응답의 `error.code`와 서버 기록에 남는다. 백엔드 오류 문구는 `src/lib/v3/errors.ts`가 사용자 말로 바꾼다.
- 서버에 닿지 못하면 예시 데이터를 보여 주지 않고 "다시 시도" 화면을 보인다. 백엔드가 낸 진단 뷰(`src/lib/v3/fixture-data/`, `tests/fixtures/`)는 타입 검사에만 쓴다.

## 화면

| 경로 | 화면 |
|---|---|
| `/` · `/terms` · `/privacy` | 소개(체험하기 링크), 이용약관, 개인정보처리방침(초안, 법률 검토 전) |
| `/login` · `/signup` | 이메일·비밀번호 로그인과 가입. 맨 아래 "체험하기 (가입 없이 시연 회사 둘러보기)" |
| `/onboarding` · `/invite/[token]` | 회사 등록과 초대 링크 열기, 초대 수락 |
| `/app` | 배출 기업: 폐기물 등록 → 받아 줄 곳 찾기 → 질문 → 결과 → 승인. 처리 업체: 받은 문의의 대화와 승인 |
| `/app/inquiries` | 처리 업체의 받은 문의 목록 |
| `/app/materials` | 배출 기업의 자료(현행 처리, 사진·영상, 측정값, 비용, 문서), 처리 업체의 업체 정보(허가 품목, 매입 기준표, 가드레일, 차량, 문서 올리기) |
| `/app/approval` | 승인·서류: 양쪽 승인, 요청서와 이행 계획서, 업체의 실제 결과 기록 |
| `/app/admin` | 운영(운영 회사 소속만): 서버 연결, 기준값, 외부 서비스, 사례 시험, 재학습. 모델·구현 이름은 이 화면에만 나온다 |
| `/demo` · `/demo/materials` · `/demo/approval` | 체험하기(시연 회사 읽기 전용) |
| `/settings` · `/settings/members` · `/settings/account` | 회사 정보와 내가 속한 회사, 멤버와 초대 링크, 내 계정 |

예전 주소(`/v3`, `/upload`, `/session`, `/dashboard`, `/vendor`, `/complex`, `/knowledge`, `/neighbor`, `/c`, `/admin`)는 `/app`으로 보낸다(`next.config.ts`).

### 화면에 보이는 표시의 뜻

- **매입 / 처리비:** 단가는 배출 기업 기준이다. 양수는 "매입"(업체에서 받는 돈), 음수는 "처리비"(업체에 내는 돈)로 풀어 적는다.
- **확인 필요 / 가정값:** 근거가 없는 값은 숫자를 지어내지 않고 "확인 필요"로 남긴다. 팀 가정값으로 계산한 값에는 "가정값" 꼬리표가 붙는다. 점선 밑줄이 있는 숫자는 누르면 근거 패널이 열린다.
- **승인 막힘:** 합의한 뒤에 자료나 업체 조건이 바뀌면 승인이 막힌다. 사유는 `approvals[].blockedCodes`로 읽어 풀이만 적는다(코드는 화면에 쓰지 않는다).
- **분석하지 못한 파일:** 사진·영상을 분석하지 못하면 "이 파일은 분석하지 못했습니다"와 다음 행동(다른 사진, 수치 직접 입력)만 적는다. 어떤 서비스가 빠졌는지는 운영 화면에만 나온다.

### 타입과 받아 둔 뷰

- 화면 타입의 정본은 `src/lib/v3/schema.ts`(zod)이고 `types.ts`가 여기서 타입을 끌어낸다. 백엔드 `docs/v3/CONTRACT.md` 6~8장과 devserver의 실제 응답에 맞춘다.
- `node scripts/v3-capture-fixture.mjs [백엔드 주소]`, `node scripts/v3-capture-states.mjs [백엔드 주소]`: 돌고 있는 devserver에서 진단 뷰를 다시 받는다(`tests/fixtures/README.md`).

### 배포 이미지

`next.config.ts`의 `output: "standalone"`과 `Dockerfile`로 이미지를 만든다. `NEXT_PUBLIC_API_BASE=/api/v3`는 빌드 인자로, 나머지는 실행 환경 변수로 준다.

```bash
docker build --build-arg NEXT_PUBLIC_API_BASE=/api/v3 -t resource-ai-frontend .
docker run -p 3000:3000 -e AUTH_SECRET=... -e AUTH_URL=https://<프런트 주소> -e AUTH_TRUST_HOST=true \
  -e V3_BACKEND_URL=https://<백엔드 주소>/api/v3 -e V3_AUTH=bff -e V3_BFF_KEY=... resource-ai-frontend
```

## 검사

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm run test:c-questions
node --test tests/v3-view.test.ts tests/backend-plan.test.ts tests/auth-account.test.ts tests/v3-errors.test.ts
CI=true npm run build
BACKEND_DIR=../backend npm run test:e2e   # 브라우저로 끝까지: 찾기 → 결과 → 양쪽 승인 → 서류, 통로 묶기, 체험하기
```

- `tests/backend-plan.test.ts`: 통로의 회사 묶기(세션 회사만, 주소의 다른 회사 403), 체험하기 읽기 전용, bff 머리글, 사용자 문구.
- `tests/auth-account.test.ts`: 로그인 응답과 소속 읽기, 활성 회사 고르기, 돌아갈 주소, 실패 문구, 초대 링크.
- `tests/v3-errors.test.ts`: 오류 문구에 코드·환경 변수·서비스 이름이 섞이지 않는지.
- E2E(`e2e/find.spec.ts`, Playwright)는 백엔드 로컬 서버(header 모드, 가상 시연 데이터)와 이 프런트를 띄워 돈다. 처음 한 번 `npx playwright install chromium`이 필요하다. 이미 떠 있는 서버로 돌리려면 `E2E_BASE_URL`과 `E2E_API`를 준다. 이메일 가입 검사는 백엔드 계정 API가 있을 때만 돈다(`E2E_ACCOUNTS=1`).
- CI(`.github/workflows/ci.yml`)의 E2E 작업은 저장소 비밀 `BACKEND_READ_TOKEN`이 있을 때만 돈다.

## 모의 API

예전(v2) 화면의 부품이 쓰던 모의 저장소다. 지금 화면(`/app`, `/demo`, 설정)은 쓰지 않는다. 데이터는 `.mock-db/<컬렉션>.json`(git 제외)에 저장한다.

- 세션 데이터 계약: `src/lib/session/types.ts` (백엔드 be#1 `app/schemas.py`와 같은 모양으로 맞춘다)
- 6단계 결과: `src/lib/server/mock/pipeline.ts`가 품목별 설정표로 결정적으로 만든다. 폐플라스틱 월 800kg 기준 값은 설계안 시나리오와 같다.
- 서버 액션: `src/lib/server/session-actions.ts` (세션 생성, 단계 이동, 박스 수정, 질문 답변, 승인·발송, 실제 결과, 현장 지식 카드)
- 학습 루프: `src/lib/server/mock/learning.ts`, `learning-actions.ts` (데이터셋, 재학습, 모델 비교, 배포 게이트)
- 산업단지·건물·기업: `data/complexes.json`, `public/data/buildings/*.geojson`(OpenStreetMap), `public/data/companies/*.json`(가상 기업). 출처와 재생성 방법은 [data/README.md](data/README.md)에 있다.
- 업로드는 서버 액션으로 받는다(최대 60MB). 운영에서는 Azure Blob SAS 직접 업로드로 바꾼다.

## 디자인

색, 서체, 간격, 컴포넌트 규칙은 [ReSource-AI 저장소의 DESIGN.md](https://github.com/ReSource-AI-PNU/ReSource-AI/blob/main/DESIGN.md)를 따른다. Tailwind 기본 색 팔레트는 끄고 디자인 토큰만 쓴다 (`bg-surface`, `text-muted`, `text-gain` 등). 금액·중량·탄소 숫자에는 `num` 유틸리티를 쓴다. 화면 모드는 `?theme=light` 또는 `?theme=dark`로 강제 지정할 수 있다.

## 3D 지도

MapLibre GL 6으로 배경 지도 타일 없이 건물 외곽선만 높이대로 세운다. MapLibre 6은 워커 경로를 런타임에 계산해 번들러가 찾지 못하므로, `predev`·`prebuild`에서 워커를 `public/vendor/`로 복사하고 `setWorkerUrl`로 지정한다.
