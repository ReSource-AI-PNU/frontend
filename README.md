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

## v3 화면 (진단·연결, 자료 올리기, 승인, 관리자)

설계안 v3의 화면은 `/v3` 아래에 있고 주 메뉴가 이 네 화면을 가리킨다. v2 화면은 주소만 남아 있다.

| 경로 | 화면 |
|---|---|
| `/v3` | 진단·연결: 6단계 진행 막대, 담당자 질문, 흐름 표(사람 교정 폼), 대화 타임라인, 판단 그래프, 결과 한 장 |
| `/v3/materials` | 자료 올리기: 배출 기업(사진·영상, 측정값 CSV, 문서, 현행 처리), 업체(허가증·매입 기준표, 가드레일, 모델 설정) |
| `/v3/approval` | 승인: 양쪽 담당자 승인, 요청서와 이행 계획서, 확정 뒤 업체의 실제 결과 기록 |
| `/v3/admin` | 관리자: 백엔드 연결, 기준값·법령 색인 상태, 외부 서비스 연결, 사례 시험(사례 세트 50건), 재학습 표와 배포 게이트, 내보내기 |

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
- `/v3`도 로그인과 온보딩을 거쳐야 보인다(시연용 계정으로 들어가면 된다). 요청하는 조직은 화면 오른쪽 위 "관점 (시연용)"에서 고르고, `X-Org-Id` 헤더로 나간다.
- 시연 순서: 관점을 배출 기업 (주)한빛정밀로 → 진단 시작 → 실행 → 질문에 답하기(모름도 답) → 이어서 실행 → 승인 화면에서 배출 기업으로 승인 → 관점을 업체로 바꿔 승인 → 요청서와 이행 계획서 확인. 처음으로 되돌리려면 관리자 화면의 "시연 데이터 처음 상태로"를 누른다.

### 화면에 보이는 표시의 뜻

- **백엔드 연결됨 / 예시 데이터 띠:** 화면을 열 때 `GET /health`와 `GET /orgs`가 통하면 "백엔드 연결됨"이고, 이때는 예시 데이터를 전혀 쓰지 않는다. 연결하지 못하면 노란 "예시 데이터" 띠가 뜨고 저장해 둔 진단 한 건을 보여 준다. 이 예시는 손으로 쓴 값이 아니라, 백엔드 로컬 서버가 시연용 가상 데이터로 실제로 낸 승인 전 진단을 그대로 받아 둔 것이다(`src/lib/v3/fixture-data/`). 회사·단가·물량은 모두 가상이고, 대화는 모델이 아니라 "규칙 정책(모델 미연결)"로 만든 결과다. 예시 데이터에서는 실행·답변·승인·업로드·저장을 보내지 않고, 관리자 화면은 예시 값을 만들지 않는다. 받아 둔 관점((주)한빛정밀) 밖의 관점에는 진단 예시가 없다.
- **업체 측 답변 / 설정:** 대화마다 실제로 답을 쓴 구현을 보여 준다. 모델이 연결되지 않은 서버에서는 "규칙 정책(모델 미연결)"이라고 그대로 적고, 업체가 고른 모델(Foundry gpt-5-mini, Ollama …)은 "설정"으로 따로 적는다. 호출하지 않은 모델을 답한 것처럼 보이지 않게 하기 위해서다.
- **매입 / 처리비:** 단가는 배출 기업 기준이다. 양수는 "매입"(업체에서 받는 돈), 음수는 "처리비"(업체에 내는 돈)로 풀어 적는다.
- **확인 필요 / 가정값:** 근거가 없는 값은 숫자를 지어내지 않고 "확인 필요"로 남긴다. 팀 가정값으로 계산한 값에는 "가정값" 꼬리표가 붙는다. 점선 밑줄이 있는 숫자는 누르면 근거 패널(원문, 출처, 기준일, 버전, 계산 사슬)이 열린다.

- **관리자 관점:** 관리자 화면은 관점이 운영 조직("관리자 · Re:Source AI 운영")일 때만 `/admin/*`을 부른다. 다른 관점에서는 부르지 않고 "관리자 관점으로 바꾸세요" 안내와 바꾸기 버튼을 보여 준다.
- **탐지 모델이 연결되지 않았습니다:** 사진·영상을 올렸는데 서버에 탐지 모델이 연결돼 있지 않으면 서버가 준 이 문장을 그대로 보여 준다. 탐지 결과를 만들어 그리지 않는다.
- **담당자 교정 / 실제 결과:** 흐름 표의 "고치기"로 적은 교정과 업체가 확정 뒤 적은 실제 등급·단가·중량은 사람이 적은 값이라 먹색 점으로 표시한다. 교정은 기록만 남고 그 진단의 값과 계산은 바뀌지 않는다.
- **상대 조직의 근거 N건은 보이지 않습니다:** 실행 기록에서 보는 조직이 열 수 없는 근거는 개수만 적는다.
- **판단 그래프:** 실선은 충족, 점선은 조건부, 가는 점선과 ✕는 불충족, 굵은 선은 최적안 배정이다. 노드가 많으면 근거 문서 열은 접혀 있고 노드를 누르면 그 노드의 근거 문서만 펴진다.

### 타입과 예시 데이터

- 화면 타입의 정본은 `src/lib/v3/schema.ts`(zod)이고 `types.ts`가 여기서 타입을 끌어낸다. 백엔드 `docs/v3/CONTRACT.md` 6~8장과 devserver의 실제 응답에 맞춘다.
- `node --test tests/v3-view.test.ts`: 백엔드가 실제로 낸 진단 뷰 여섯 건(승인 전, 확정 뒤, 업체가 본 뷰, 자동 거절, 승인 막힘, 담당자 인계)이 스키마에 맞는지 검사한다. 모르는 필드가 오면 실패하므로 백엔드 뷰가 바뀌면 여기서 먼저 드러난다. `V3_API_BASE=http://localhost:8000/api/v3`를 주면 돌고 있는 서버의 근거 응답도, `V3_VIEW_FILES=경로1,경로2`를 주면 저장소 밖에 받아 둔 뷰 파일도 검사한다.
- `node scripts/v3-capture-fixture.mjs [백엔드 주소]`: 돌고 있는 devserver에서 예시 데이터를 다시 받는다(시연 데이터를 처음 상태로 되돌리고 승인 전까지 돌린다). 이어서 교정 한 건, 양쪽 승인, 실제 결과 한 건을 보내 확정 뒤 뷰 두 건도 `tests/fixtures/`에 다시 받는다.
- `node scripts/v3-capture-states.mjs [백엔드 주소]`: 자동 거절과 승인 막힘 상태의 뷰를 공개된 API만으로 만들어 받는다. 담당자 인계 뷰를 받은 방법은 `tests/fixtures/README.md`에 있다.

### 배포 이미지

`next.config.ts`의 `output: "standalone"`과 `Dockerfile`로 이미지를 만든다. `NEXT_PUBLIC_API_BASE`는 빌드 인자로 넘긴다. standalone 출력과 `server.js` 기동까지는 로컬에서 확인했고, docker 이미지 빌드는 아직 해 보지 않았다(파일 머리의 "미실행" 참고).

```bash
docker build --build-arg NEXT_PUBLIC_API_BASE=https://<백엔드 주소>/api/v3 -t resource-ai-frontend .
docker run -p 3000:3000 -e AUTH_SECRET=... -e AUTH_URL=https://<프런트 주소> -e AUTH_TRUST_HOST=true resource-ai-frontend
```

## 검사

```bash
npm run lint
npm run build
node --test tests/v3-view.test.ts   # v3 진단 뷰가 화면 타입(스키마)에 맞는지
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
