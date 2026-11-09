# Re:Source AI — Frontend

Next.js(App Router) + TypeScript + Tailwind CSS 기반 웹 앱. 사진·영상·성분표 업로드, 판정 결과 카드, 처리 방식별 비용·탄소 비교표, 산업단지 3D 지도 화면을 담당한다. 설계 문서는 [ReSource-AI](https://github.com/ReSource-AI-PNU/ReSource-AI) 저장소의 `docs/`를 참고한다.

## 실행

```bash
cp .env.example .env.local   # AUTH_SECRET 채우기: openssl rand -base64 33
npm install
npm run dev
```

http://localhost:3000 에서 확인한다. `AUTH_DEV_LOGIN=true`이면 이름·이메일만으로 들어가는 시연용 계정으로 가입할 수 있다. 백엔드([backend](https://github.com/ReSource-AI-PNU/backend))는 8000번 포트에서 함께 띄운다.

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

백엔드 API(be#23 기업 프로필, be#13 기업 DB)가 생기기 전까지 다음을 쓴다.

- 회사 정보(온보딩): `.mock-db/db.json` (git 제외). 단일 개발 서버 기준이다.
- 산업단지·건물·기업: `data/complexes.json`, `public/data/buildings/*.geojson`(OpenStreetMap), `public/data/companies/*.json`(가상 기업). 자세한 출처와 재생성 방법은 [data/README.md](data/README.md)에 있다.

## 구조

```
src/app/(marketing)/  # 로그인 전 소개 화면 (/)
src/app/(focus)/      # 로그인, 회원가입, 온보딩
src/app/(app)/        # 로그인 후 앱: /upload, /session, /complex/[id], /dashboard
src/app/globals.css   # 디자인 토큰 (Tailwind 4 @theme, 라이트·다크), 지도 핀 스타일
src/app/fonts/        # Wanted Sans 가변 글꼴 (SIL OFL 1.1)
src/auth.ts           # Auth.js 설정과 보호 경로
src/proxy.ts          # 낙관적 로그인 검사 (Next 16의 middleware)
src/components/       # 헤더, 단계 메뉴, 3D 지도(complex/), 시세 카드(verdict/), ui/
src/lib/              # 도메인 타입, 숫자 포맷, 사업자번호 검증, 세션 8단계
src/lib/server/       # 서버 전용: 세션, 모의 저장소, 서버 액션
scripts/              # 건물·기업 시드 생성, MapLibre 워커 복사
```

## 디자인

색, 서체, 간격, 컴포넌트 규칙은 [ReSource-AI 저장소의 DESIGN.md](https://github.com/ReSource-AI-PNU/ReSource-AI/blob/main/DESIGN.md)를 따른다. Tailwind 기본 색 팔레트는 끄고 디자인 토큰만 쓴다 (`bg-surface`, `text-muted`, `text-gain` 등). 금액·중량·탄소 숫자에는 `num` 유틸리티를 쓴다. 화면 모드는 `?theme=light` 또는 `?theme=dark`로 강제 지정할 수 있다.

## 3D 지도

MapLibre GL 6으로 배경 지도 타일 없이 건물 외곽선만 높이대로 세운다. MapLibre 6은 워커 경로를 런타임에 계산해 번들러가 찾지 못하므로, `predev`·`prebuild`에서 워커를 `public/vendor/`로 복사하고 `setWorkerUrl`로 지정한다.
