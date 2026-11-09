# Re:Source AI — Frontend

Next.js(App Router) + TypeScript + Tailwind CSS 기반 웹 앱. 사진·영상·성분표 업로드, 판정 결과 카드, 처리 방식별 비용·탄소 비교표 화면을 담당한다. 설계 문서는 [ReSource-AI](https://github.com/ReSource-AI-PNU/ReSource-AI) 저장소의 `docs/`를 참고한다.

## 실행

```bash
cp .env.example .env.local   # 백엔드 주소 설정
npm install
npm run dev
```

http://localhost:3000 에서 확인한다. 백엔드([backend](https://github.com/ReSource-AI-PNU/backend))는 8000번 포트에서 함께 띄운다.

## 검사

```bash
npm run lint
npm run build
```

## 구조

```
src/app/            # 라우트와 레이아웃 (App Router): / 업로드, /session, /dashboard
src/app/globals.css # 디자인 토큰 (Tailwind 4 @theme, 라이트·다크)
src/app/fonts/      # Wanted Sans 가변 글꼴 (SIL OFL 1.1)
src/components/     # 화면 공통 컴포넌트 (헤더, 단계 메뉴, ui/)
src/lib/            # 설정, 숫자 포맷, 세션 8단계 정의 (API 클라이언트는 #2)
```

## 디자인

색, 서체, 간격, 컴포넌트 규칙은 [ReSource-AI 저장소의 DESIGN.md](https://github.com/ReSource-AI-PNU/ReSource-AI/blob/main/DESIGN.md)를 따른다. Tailwind 기본 색 팔레트는 끄고 디자인 토큰만 쓴다 (`bg-surface`, `text-muted`, `text-gain` 등). 금액·중량·탄소 숫자에는 `num` 유틸리티를 쓴다. 화면 모드는 `?theme=light` 또는 `?theme=dark`로 강제 지정할 수 있다.
