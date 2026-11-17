# syntax=docker/dockerfile:1
#
# 미실행: 이 파일로 docker 이미지를 빌드하거나 띄워 보지 못했다(작성한 환경에 docker가 없다).
# 확인한 것은 여기까지다: 같은 소스로 `next build --webpack`(WASM SWC)이 통과했고, 만들어진
# .next/standalone의 server.js에 .next/static과 public을 아래와 같은 배치로 붙여 띄웠을 때
# /login 200, /v3 로그인 전 307이 나왔다. 기본 빌드(`npm run build`, 네이티브 SWC)와 이미지
# 빌드·기동은 처음 쓸 때 확인한다.
#
# Next.js standalone 출력으로 만드는 프런트 이미지.
#   docker build \
#     --build-arg NEXT_PUBLIC_API_BASE=https://<백엔드 주소>/api/v3 \
#     --build-arg NEXT_PUBLIC_API_BASE_URL=https://<백엔드 주소>/api/v1 \
#     -t resource-ai-frontend:<커밋 SHA> .
#   (Azure: az acr build --registry <ACR> --image frontend:<커밋 SHA> --build-arg NEXT_PUBLIC_API_BASE=... .)
#
# NEXT_PUBLIC_* 값은 빌드할 때 번들에 박힌다. 백엔드 주소가 바뀌면 이미지를 다시 빌드해야 한다.
# 비밀값(AUTH_SECRET, Entra 값)은 이미지에 넣지 않고 실행할 때 환경 변수로 준다(.env.example 참고).

ARG NODE_VERSION=26

FROM node:${NODE_VERSION}-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# v3 화면이 부르는 백엔드(계약 8장, 접두어 /api/v3)
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
# v2 화면의 경제 미리보기가 부르는 백엔드(/api/v1). 주지 않으면 코드의 기본값을 쓴다
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 빌드가 Auth.js 설정을 읽으므로 넣는 빌드 전용 값이다. 실제 비밀값이 아니고 실행 이미지에는 남지 않는다.
RUN test -n "$NEXT_PUBLIC_API_BASE" || (echo "NEXT_PUBLIC_API_BASE 빌드 인자가 필요합니다" >&2; exit 1)
RUN AUTH_SECRET=build-only-not-a-secret AUTH_TRUST_HOST=true npm run build

FROM node:${NODE_VERSION}-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# standalone 출력에는 public과 .next/static이 들어 있지 않아 따로 옮긴다
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# v2 화면의 모의 저장소(.mock-db)를 실행 중에 쓴다
RUN mkdir -p /app/.mock-db && chown node:node /app /app/.mock-db
USER node
EXPOSE 3000
CMD ["node", "server.js"]
