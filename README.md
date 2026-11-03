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
src/app/        # 라우트와 레이아웃 (App Router)
src/components/ # 화면 공통 컴포넌트 (추가 예정)
src/lib/        # API 클라이언트, 타입 (추가 예정)
```
