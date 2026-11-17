# Re:Source AI — Frontend

Next.js(App Router) + TypeScript + Tailwind CSS 기반 웹 앱. 사진·영상·성분표 업로드, 판정 결과 카드, 처리 방식별 비용·탄소 비교표, 산업단지 3D 지도 화면을 담당한다. 설계 문서는 [ReSource-AI](https://github.com/ReSource-AI-PNU/ReSource-AI) 저장소의 `docs/`를 참고한다.

## 실행

```bash
npm ci
AUTH_SECRET="$(openssl rand -base64 33)" AUTH_DEV_LOGIN=true AUTH_TRUST_HOST=true npm run dev
```

http://localhost:3000 에서 확인한다. `AUTH_DEV_LOGIN=true`이면 이름·이메일만으로 들어가는 시연용 계정으로 가입할 수 있다. 백엔드([backend](https://github.com/ReSource-AI-PNU/backend))는 8000번 포트에서 함께 띄운다.

경로 판정은 백엔드 PR #40의 `feat/feasibility-session-integration` 브랜치에서
`uv sync --extra dev` 후 `uv run uvicorn app.main:app --reload`로 실행한 미리보기 API를
사용한다. 프런트의 `NEXT_PUBLIC_API_BASE_URL` 기본값은 `http://localhost:8000/api/v1`이며,
다른 주소를 쓰면 `NEXT_PUBLIC_API_BASE_URL`을 빌드 시 설정한다. 브라우저 주소에
맞게 백엔드 `CORS_ORIGINS`도 설정해야 한다. 로컬의 `AUTH_TRUST_HOST=true`는
호스트 헤더를 신뢰할 수 있는 경우에만 사용하며, 운영 환경은 프록시가 호스트 헤더를
안전하게 설정하도록 구성한다.

샘플 공장 진단에서 흐름을 확인하고 경로 판정으로 이동한 뒤, 발생량·확인 여부·경로를
입력하고 **경제 효과 계산**을 누른다. 결과는 가상 시연이며 저장되지 않고 다른 모의
단계에 전달되지 않는다. 백엔드가 꺼져 있으면 오류가 표시된다.

## 화면 (소개, 찾기, 자료, 승인·서류, 운영)

소개 화면은 `/`, 설계안 v3의 앱 화면은 `/app` 아래에 있다. 앱은 왼쪽 사이드바와 가운데 대화 한 줄로 된 채팅형 화면이고, 예전 주소 `/v3`는 `/app`으로 넘어간다. v2 화면은 주소만 남아 있다.

| 경로 | 화면 |
|---|---|
| `/` | 소개: 실제 산업 현장 사진(Unsplash 라이선스, `src/lib/photos.ts`에 출처)과 문제·방법·양쪽 사용자 설명 |
| `/app` | 찾기: 폐기물 추가 → "받아 줄 곳 찾기" → 담당자 질문 → 결과 표(폐기물, 받는 곳, 조건, 한 달 차이) → 승인이 한 화면에서 이어진다. 화면 아래 "AI끼리 나눈 대화 보기"를 누르면 업체별 전체 대화와 실행 기록이 오른쪽 패널로 열린다. 6단계 진행과 자료 표·판단 그래프·계산표는 접혀 있다 |
| `/app/materials` | 자료 올리기: 배출 기업(사진·영상, 측정값 CSV, 문서, 현행 처리), 업체(허가증·매입 기준표, 가드레일, 모델 설정) |
| `/app/approval` | 승인: 양쪽 담당자 승인, 요청서와 이행 계획서, 확정 뒤 업체의 실제 결과 기록 |
| `/app/admin` | 관리자: 백엔드 연결, 기준값·법령 색인 상태, 외부 서비스 연결, 사례 시험(사례 세트 50건), 재학습 표와 배포 게이트, 내보내기 |

### 실행

```bash
# 1) 백엔드 로컬 서버 (backend 저장소, 표준 라이브러리만 쓴다. 시작할 때 시연 데이터를 올린다)
python3 -m app.v3.devserver --port 8000

# 2) 프런트 (.env.example 참고)
NEXT_PUBLIC_API_BASE=http://localhost:8000/api/v3 \
AUTH_SECRET="$(openssl rand -base64 33)" AUTH_DEV_LOGIN=true AUTH_TRUST_HOST=true npm run dev
```

- 백엔드 주소는 `NEXT_PUBLIC_API_BASE`(접두어 `/api/v3` 포함)로 준다. 기본값은 `http://localhost:8000/api/v3`이다. 빌드할 때 번들에 박히므로 바꾸면 다시 빌드한다.
- devserver의 CORS는 `http://localhost:3000`과 `http://127.0.0.1:3000`만 허용한다. 프런트를 다른 포트로 띄우면 연결되지 않는다.
- `/app`은 로그인과 회사 등록을 거쳐야 보인다(시연용 계정으로 들어가면 된다). 처음 등록은 회사 이름, 하는 일, 산업단지 세 가지만 묻고, 사업자등록번호와 품목별 배출량은 설정에서 나중에 채운다. 요청하는 조직은 사이드바 아래 "시연 회사"에서 고르고, `X-Org-Id` 헤더로 나간다.
- 시연 순서: 시연 회사를 (주)한빛정밀로 → "받아 줄 곳 찾기" → 질문에 답하기(모름도 답, 마지막 답을 내면 이어서 실행된다) → 결과 표 아래 "승인하고 진행" → 시연 회사를 업체로 바꿔 승인 → 요청서와 이행 계획서 확인. 처음으로 되돌리려면 관리자 화면의 "시연 데이터 처음 상태로"를 누른다.

### 화면에 보이는 표시의 뜻

- **백엔드 연결됨 / 예시 데이터 띠:** 화면을 열 때 `GET /health`와 `GET /orgs`가 통하면 "백엔드 연결됨"이고, 이때는 예시 데이터를 전혀 쓰지 않는다. 연결하지 못하면 노란 "예시 데이터" 띠가 뜨고 저장해 둔 진단 한 건을 보여 준다. 이 예시는 손으로 쓴 값이 아니라, 백엔드 로컬 서버가 시연용 가상 데이터로 실제로 낸 승인 전 진단을 그대로 받아 둔 것이다(`src/lib/v3/fixture-data/`). 회사·단가·물량은 모두 가상이고, 대화는 모델이 아니라 "규칙 정책(모델 미연결)"로 만든 결과다. 예시 데이터에서는 실행·답변·승인·업로드·저장을 보내지 않고, 관리자 화면은 예시 값을 만들지 않는다. 받아 둔 관점((주)한빛정밀) 밖의 관점에는 진단 예시가 없다.
- **업체 측 답변 / 설정:** 대화마다 실제로 답을 쓴 구현을 보여 준다. 모델이 연결되지 않은 서버에서는 "규칙 정책(모델 미연결)"이라고 그대로 적고, 업체가 고른 모델(Foundry gpt-5-mini, Ollama …)은 "설정"으로 따로 적는다. 호출하지 않은 모델을 답한 것처럼 보이지 않게 하기 위해서다.
- **매입 / 처리비:** 단가는 배출 기업 기준이다. 양수는 "매입"(업체에서 받는 돈), 음수는 "처리비"(업체에 내는 돈)로 풀어 적는다.
- **확인 필요 / 가정값:** 근거가 없는 값은 숫자를 지어내지 않고 "확인 필요"로 남긴다. 팀 가정값으로 계산한 값에는 "가정값" 꼬리표가 붙는다. 점선 밑줄이 있는 숫자는 누르면 근거 패널(원문, 출처, 기준일, 버전, 계산 사슬)이 열린다.

- **관리자 관점:** 관리자 화면은 관점이 운영 조직("관리자 · Re:Source AI 운영")일 때만 `/admin/*`을 부른다. 다른 관점에서는 부르지 않고 "관리자 관점으로 바꾸세요" 안내와 바꾸기 버튼을 보여 준다.
- **탐지 모델이 연결되지 않았습니다:** 사진·영상을 올렸는데 서버에 탐지 모델이 연결돼 있지 않으면 서버가 준 이 문장을 그대로 보여 준다. 탐지 결과를 만들어 그리지 않는다.
- **담당자 교정 / 실제 결과:** 흐름 표의 "고치기"로 적은 교정과 업체가 확정 뒤 적은 실제 등급·단가·중량은 사람이 적은 값이라 먹색 점으로 표시한다. 교정은 기록만 남고 그 진단의 값과 계산은 바뀌지 않는다.
- **상대 조직의 근거 N건은 보이지 않습니다:** 실행 기록에서 보는 조직이 열 수 없는 근거는 개수만 적는다.
- **승인 막힘:** 합의한 뒤에 자료나 업체 조건이 바뀌면 승인이 막힌다. 사유는 `approvals[].blockedCodes`(코드 배열)로 읽고 코드마다 설명을 적는다. `VENDOR_TERMS_CHANGED`면 "업체가 조건을 바꿨습니다. 다시 실행하면 새 조건으로 이어 갑니다"와 "다시 실행" 버튼(배출 기업 관점)을 보여 주고, 누르면 같은 대화에서 재협상한다. `STREAM_CHANGED`·`EVIDENCE_CHANGED`면 "자료가 바뀌었습니다. 새 진단이 필요합니다"를 보여 준다. 진단·연결 화면 위쪽에도 같은 안내가 뜬다.
- **매입 기준표 단가:** 업체 관점의 자료 올리기에서 매입 기준표의 단가를 고치고 "매입 기준표 저장"을 누르면 `PUT /vendors/{orgId}`로 나간다. 합의한 뒤에 합의 조건에 쓰인 단가를 고치면 위의 승인 막힘(`VENDOR_TERMS_CHANGED`)이 걸린다.
- **진행기(코드):** 모델이나 규칙 정책이 아니라 코드가 정해 둔 문장으로 쓴 메시지(담당자 인계, 허가 품목 거절, 일부 흐름만 뺀 답·질문, 합의 뒤 조건 변경으로 다시 여는 역제안)에는 "진행기(코드)" 꼬리표가 붙는다. 숫자와 인용이 없다.
- **거부된 초안:** 근거 검증기나 가드레일이 거부한 초안은 코드와 코드별 일반 설명만 보인다(`UNBACKED_TERM` 등). 거부된 초안에 있던 숫자·조항은 서버가 싣지 않으므로 화면에도 없다.
- **시연용 인증 띠:** 관리자 화면은 서버의 인증 모드(`GET /admin/status`의 `auth.mode`)가 `header`면 "시연용 인증(X-Org-Id 신뢰). 공개 주소에 그대로 두면 조직 경계가 지켜지지 않습니다" 경고 띠를 보여 준다. 이 화면은 `X-Org-Id`만 보내므로 token 모드 서버에는 아직 붙지 않는다.
- **열람 범위:** 근거 패널의 열람 범위에는 보는 조직과 소유 조직만 나온다(전체 공개는 "모든 조직"). 서버가 그 밖의 조직을 알려 주지 않는다.
- **판단 그래프:** 업체 관점에서는 자기 매입 기준 노드와 흐름 대조·최적안 배정 선만 나온다(규정과 다른 업체의 기준은 없다). 실선은 충족, 점선은 조건부, 가는 점선과 ✕는 불충족, 굵은 선은 최적안 배정이다. 노드가 많으면 근거 문서 열은 접혀 있고 노드를 누르면 그 노드의 근거 문서만 펴진다.

### 타입과 예시 데이터

- 화면 타입의 정본은 `src/lib/v3/schema.ts`(zod)이고 `types.ts`가 여기서 타입을 끌어낸다. 백엔드 `docs/v3/CONTRACT.md` 6~8장과 devserver의 실제 응답에 맞춘다.
- `node --test tests/v3-view.test.ts`: 백엔드가 실제로 낸 진단 뷰 아홉 건(승인 전, 확정 뒤, 업체가 본 뷰, 자동 거절, 승인 막힘, 업체 조건 변경으로 막힘, 재합의, 재합의를 업체가 본 뷰, 담당자 인계)이 스키마에 맞는지 검사한다. 모르는 필드가 오면 실패하므로 백엔드 뷰가 바뀌면 여기서 먼저 드러난다. `V3_API_BASE=http://localhost:8000/api/v3`를 주면 돌고 있는 서버의 근거 응답도, `V3_VIEW_FILES=경로1,경로2`를 주면 저장소 밖에 받아 둔 뷰 파일도 검사한다.
- `node scripts/v3-capture-fixture.mjs [백엔드 주소]`: 돌고 있는 devserver에서 예시 데이터를 다시 받는다(시연 데이터를 처음 상태로 되돌리고 승인 전까지 돌린다). 이어서 교정 한 건, 양쪽 승인, 실제 결과 한 건을 보내 확정 뒤 뷰 두 건도 `tests/fixtures/`에 다시 받는다.
- `node scripts/v3-capture-states.mjs [백엔드 주소]`: 자동 거절, 승인 막힘, 업체 조건 변경으로 막힌 뒤 다시 실행해 재합의한 상태의 뷰를 공개된 API만으로 만들어 받는다. 담당자 인계 뷰를 받은 방법은 `tests/fixtures/README.md`에 있다.

### 배포 이미지

`next.config.ts`의 `output: "standalone"`과 `Dockerfile`로 이미지를 만든다. `NEXT_PUBLIC_API_BASE`는 빌드 인자로 넘긴다. 백엔드 주소를 직접 적으면 브라우저가 백엔드를 바로 부르고(시연용, `X-Org-Id`만 간다), `/api/v3`로 적으면 프런트 서버의 통로(`src/app/api/v3`)를 거친다. 통로는 로그인한 사용자만 지나가고, 실행 환경의 `V3_BACKEND_URL`로 넘기며, `V3_ORG_TOKENS`가 있으면 조직 토큰을 서버가 붙인다(백엔드 `V3_AUTH=token`). 계정과 조직을 묶는 일은 아직 없다: 로그인한 사람은 표에 있는 어느 조직으로든 볼 수 있다(시연 회사 고르기). standalone 출력과 `server.js` 기동까지는 로컬에서 확인했고, docker 이미지 빌드는 아직 해 보지 않았다(파일 머리의 "미실행" 참고).

```bash
docker build --build-arg NEXT_PUBLIC_API_BASE=https://<백엔드 주소>/api/v3 -t resource-ai-frontend .
docker run -p 3000:3000 -e AUTH_SECRET=... -e AUTH_URL=https://<프런트 주소> -e AUTH_TRUST_HOST=true resource-ai-frontend
```

## 검사

```bash
npm run lint
npm run build
node --test tests/v3-view.test.ts   # 진단 뷰가 화면 타입(스키마)에 맞는지
BACKEND_DIR=../backend npm run test:e2e   # 브라우저로 끝까지: 찾기 → 결과 → 양쪽 승인 → 서류, 업체에 안 보여야 할 값
```

E2E(`e2e/find.spec.ts`, Playwright)는 백엔드의 표준 라이브러리 서버(`app.v3.devserver`, 규칙 정책, 가상 시연 데이터)와 이 프런트를 띄워 돈다. 모델과 Azure는 부르지 않는다. 처음 한 번 `npx playwright install chromium`이 필요하다. 이미 떠 있는 서버로 돌리려면 `E2E_BASE_URL`과 `E2E_API`를 준다.

CI(`.github/workflows/ci.yml`)의 E2E 작업은 backend 저장소를 받아야 해서 저장소 비밀 `BACKEND_READ_TOKEN`(backend 저장소 Contents 읽기 전용 토큰)이 있을 때만 돈다. 없으면 건너뛰고 알림만 남긴다. 이 작업은 아직 GitHub에서 돌려 보지 않았다(작성한 환경에서는 브라우저를 띄울 수 없어, 같은 순서를 손으로 따라 해 확인했다).

## 인증

- [Auth.js v5](https://authjs.dev) + Microsoft Entra External ID. `AUTH_MICROSOFT_ENTRA_ID_*` 세 값을 넣으면 "Microsoft 계정으로 로그인" 버튼이 켜진다. 가입 버튼은 `prompt=create`로 Entra 가입 화면을 연다.
- Entra 앱 등록의 리디렉션 URI: `{AUTH_URL}/api/auth/callback/microsoft-entra-id`
- 세션은 암호화된 JWT 쿠키다. `src/proxy.ts`가 보호 경로(`/app`, `/settings`, `/onboarding`)를 쿠키로 먼저 거르고, 실제 확인은 `src/lib/server/session.ts`에서 한다.
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
| `/login` · `/signup` · `/onboarding` | 로그인, 회원가입, 회사 등록(이름, 하는 일, 산업단지) |
| `/app` | 찾기: 폐기물 목록 → 질문 → 결과(받는 곳, 조건, 한 달 차이, 순비용 내역, 재투입 후보) → 승인. 업체로 보면 받은 문의 |
| `/app/materials` | 자료: 현행 처리, 사진·영상, 측정값 CSV, 비용(전처리 작업 시간, 재투입 값), 문서. 업체는 매입 기준과 허가 품목 |
| `/app/approval` | 승인·서류: 양쪽 승인, 요청서와 이행 계획서, 업체의 실제 결과 기록 |
| `/app/admin` | 운영(운영 조직만): 연결 상태, 기준값, 사례 시험, 시연 데이터 되돌리기 |
| `/settings` · `/settings/members` · `/settings/account` | 회사 정보, 멤버·역할, 데이터 내보내기, 탈퇴 |
| `/passport/[id]` · `/passport-label/[id]` | 자원 여권과 라벨(이전 버전 화면) |

예전 주소(`/v3`, `/upload`, `/session`, `/dashboard`, `/vendor`, `/complex`, `/knowledge`, `/neighbor`, `/c`, `/admin`)는 `/app`으로 보낸다(`next.config.ts`). 그 화면들이 쓰던 부품(`src/components/{session,vendor,dashboard,complex,knowledge,learning,...}`)은 아직 저장소에 남아 있고 어디에서도 불러 쓰지 않는다.

## 디자인

색, 서체, 간격, 컴포넌트 규칙은 [ReSource-AI 저장소의 DESIGN.md](https://github.com/ReSource-AI-PNU/ReSource-AI/blob/main/DESIGN.md)를 따른다. Tailwind 기본 색 팔레트는 끄고 디자인 토큰만 쓴다 (`bg-surface`, `text-muted`, `text-gain` 등). 금액·중량·탄소 숫자에는 `num` 유틸리티를 쓴다. 화면 모드는 `?theme=light` 또는 `?theme=dark`로 강제 지정할 수 있다.

## 3D 지도

MapLibre GL 6으로 배경 지도 타일 없이 건물 외곽선만 높이대로 세운다. MapLibre 6은 워커 경로를 런타임에 계산해 번들러가 찾지 못하므로, `predev`·`prebuild`에서 워커를 `public/vendor/`로 복사하고 `setWorkerUrl`로 지정한다.
