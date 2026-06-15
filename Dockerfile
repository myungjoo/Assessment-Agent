# syntax=docker/dockerfile:1
# Assessment-Agent — 운영 배포용 멀티스테이지 이미지.
# monolithic 단일 NestJS process (ADR-0003) 가 /api/* 와 web/dist SPA 정적 serve
# (ADR-0040, src/web WebModule) 를 함께 담당한다. WEB_DIST_PATH 는 process.cwd()
# 기준이라 WORKDIR(/app)에서 실행하고 web/dist 를 /app/web/dist 에 둔다.
# 자세한 운영 절차는 deploy/README.md 참조.

############################
# 1) Builder — 의존성 설치 + backend/web 빌드
############################
FROM node:20-bookworm-slim AS builder

# bcrypt 는 native addon — node-gyp 빌드에 python3 / make / g++ 가 필요.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# pnpm 은 corepack 으로 활성화 — package.json 의 packageManager(pnpm@9.12.0) 고정.
RUN corepack enable

WORKDIR /app

# 의존성 메타만 먼저 복사해 install layer 캐시를 극대화한다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
COPY web/package.json ./web/package.json

# workspace 전체 의존성 설치 (frozen — lockfile 과 정확히 일치 강제).
# postinstall 의 `prisma generate` 가 schema 기준 PrismaClient 를 생성한다.
RUN pnpm install --frozen-lockfile

# 소스 전체 복사 후 빌드.
COPY . .

# backend(dist/) + web SPA(web/dist/) 빌드 — CI(.github/workflows/ci.yml) 와 동일 순서.
RUN pnpm build \
  && pnpm --filter web build

# 운영 의존성만 남기고 devDependency 제거 → 런타임 이미지 축소.
# prisma CLI / @prisma/client / bcrypt 등은 dependencies 라 그대로 남는다.
RUN pnpm prune --prod

############################
# 2) Runtime — 빌드 산출물 + 운영 의존성만 담은 슬림 이미지
############################
FROM node:20-bookworm-slim AS runtime

# openssl: prisma migrate engine 이 libssl 을 요구(미설치 시 "may not work" 경고).
# ca-certificates: 앱의 외부 HTTPS outbound(GitHub/Confluence/LLM, deployment.md)용 root CA.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# 빌드 산출물 / 운영 의존성 / prisma 자산만 선별 복사 (node 이미지 내장 uid 1000).
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/web/dist ./web/dist
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --chown=node:node deploy/docker-entrypoint.sh ./deploy/docker-entrypoint.sh

RUN chmod +x ./deploy/docker-entrypoint.sh

# 비루트 실행 (보안 표면 축소).
USER node
EXPOSE 3000

# 컨테이너 부팅 시: DB 마이그레이션 적용 → 앱 기동.
ENTRYPOINT ["./deploy/docker-entrypoint.sh"]
