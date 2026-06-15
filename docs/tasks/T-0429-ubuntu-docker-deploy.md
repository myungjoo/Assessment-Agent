---
id: T-0429
title: Ubuntu Docker Compose 배포 + 야간 자동 재배포 인프라
phase: P7
status: DONE
commitMode: pr
estimatedDiff: 290
estimatedFiles: 11
created: 2026-06-16
userDirected: true
sizeException: "배포 인프라 1 단위(Dockerfile/compose/entrypoint/redeploy/systemd/CI 검증)라 §3 5-파일 cap 초과. 무관 변경 0 — 전부 단일 deploy 기능 응집. reviewer check 3 justification 경로."
touchesFiles:
  - Dockerfile
  - .dockerignore
  - docker-compose.yml
  - deploy/docker-entrypoint.sh
  - deploy/redeploy.sh
  - deploy/env.prod.example
  - deploy/assessment-agent-redeploy.service
  - deploy/assessment-agent-redeploy.timer
  - deploy/README.md
  - .github/workflows/ci.yml
plannerNote: "사용자 지시 — 이 서비스를 Ubuntu 머신에 Docker Compose 로 배포하고 매일 밤 main 기준 자동 재배포. CI 에서 Docker 빌드까지 검증 후 PR."
---

# T-0429 — Ubuntu Docker Compose 배포 + 야간 자동 재배포 인프라

## Why

사용자가 본 서비스를 자신의 Ubuntu 머신에 배포하고, **매일 밤 main 브랜치 기준으로 새로 재배포**하기를 원한다. 현재 repo 에는 dev 용 PostgreSQL `docker-compose.yml` skeleton 만 있고 운영 배포 산출물(앱 Dockerfile / 재배포 자동화)이 없다 — [docs/architecture/deployment.md](../architecture/deployment.md) 가 "구체 manifest 는 P7 운영 task 책임"으로 미뤄둔 부분이다.

본 task 는 그 빈자리를 채운다. deployment.md 의 결정([ADR-0003](../decisions/ADR-0003-deployment.md) monolithic 단일 process + [ADR-0040](../decisions/ADR-0040-frontend-stack.md) web/dist 정적 serve + [ADR-0002](../decisions/ADR-0002-db.md) Prisma migrate deploy)을 그대로 운영 manifest 로 구현하며, 새 결정/새 dependency 를 도입하지 않는다(기존 ADR 구현이라 §5 자동 진행 범위).

## Required Reading

- [docs/architecture/deployment.md](../architecture/deployment.md) — monolith 운영 토폴로지 / migration 정책 / secret 주입 / 외부 네트워크 boundary(NODE_EXTRA_CA_CERTS·HTTPS_PROXY). 본 manifest 가 따르는 source.
- [package.json](../../package.json) — build/start script, `prisma` CLI 가 prod dependency 인 점(migrate deploy 가 런타임에서 가능), Node ≥20.11 / pnpm 9.12.
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — 기존 CI 빌드 순서(install → build → web build → prisma migrate deploy). docker-build job 을 추가할 대상.
- [src/web/web.module.ts](../../src/web/web.module.ts) — `WEB_DIST_PATH = process.cwd()/web/dist`. 컨테이너 WORKDIR 와 web/dist 배치 제약.
- [.env.example](../../.env.example) — dev env 변수 schema. 운영 template 의 base.

## Acceptance Criteria

- [ ] `Dockerfile` — 멀티스테이지. builder 가 pnpm(corepack) 으로 의존성 설치 + `pnpm build`(backend) + `pnpm --filter web build`(web/dist) + `pnpm prune --prod`, runtime 이 비루트(`node`)로 dist/web/dist/node_modules/prisma 만 복사. bcrypt native 빌드용 python3/make/g++ 는 builder 에만. `ENTRYPOINT` = `deploy/docker-entrypoint.sh`.
- [ ] `deploy/docker-entrypoint.sh` — 부팅 시 `prisma migrate deploy`(idempotent, deployment.md 정책) 후 `exec node dist/src/main`(빌드 rootDir 추론으로 entry 가 dist/src/main.js). `set -e`.
- [ ] `docker-compose.yml` — 기존 `postgres`(healthcheck 추가) + 신규 `app` 서비스(build context `.`, `depends_on: postgres healthy`, `env_file: .env`, port `${PORT:-3000}`). `docker compose up -d --build` 한 번으로 기동. dev 는 여전히 `up -d postgres` 로 DB 만 띄울 수 있어야 함(regression 0).
- [ ] `.dockerignore` — node_modules/dist/web/dist/.git/.env*/.claude 등 build context 제외(secret 미반입 — §9).
- [ ] `deploy/env.prod.example` — 운영 `.env` template. `DATABASE_URL` 호스트가 compose 서비스명 `postgres`(localhost 아님), `AUTH_JWT_SECRET` 필수 경고, NODE_EXTRA_CA_CERTS/HTTPS_PROXY 선택 주석. `.gitignore` 의 `.env.*` 매칭을 피하려 leading-dot 없는 이름.
- [ ] `deploy/redeploy.sh` — `git fetch` + `git reset --hard origin/main` + `docker compose up -d --build` + `docker image prune -f`. `REPO_DIR`/`DEPLOY_BRANCH` override. `set -euo pipefail`.
- [ ] `deploy/assessment-agent-redeploy.{service,timer}` — systemd oneshot + 매일 03:00 timer(`Persistent=true`). 야간 자동 재배포.
- [ ] `deploy/README.md` — Docker 설치 → 클론 → `.env` → `up -d --build` → systemd timer 설치까지 한국어 단계별 절차 + 롤백/백업/사내인증서 메모.
- [ ] `.github/workflows/ci.yml` — 신규 job `deploy-artifacts`: (1) `sh -n`/`bash -n` 로 deploy 스크립트 문법 검사, (2) `docker build` 로 Dockerfile end-to-end 빌드 검증(push 없음). PR CI 에서 자동 실행되어 Docker 빌드 실패가 merge 를 차단(R-111).

### Test / 검증 (R-110~R-114)

- 본 변경은 TS production symbol 추가 0 — jest spec 신설 불요(reviewer check 4 의 "로직 있는 .ts" 없음). 대신:
  - **Docker 빌드 검증**: CI `deploy-artifacts` job 의 `docker build` 가 Dockerfile 전체(install/build/web build/prune)를 실제 빌드 — 실패 시 CI red.
  - **스크립트 문법 검증**: `sh -n` / `bash -n` 가 entrypoint/redeploy 문법 오류를 CI 에서 catch.
- 기존 lint/build/test/smoke/e2e 는 src/test 미변경이라 무영향(green 유지). R-110: tester 역할은 CI 의 deploy-artifacts job 이 겸한다(production code 0 LOC).

## Out of Scope

- 실제 Ubuntu 머신에서의 1 회성 설치 수행(사용자 환경 — 문서로 안내).
- TLS termination / reverse proxy(nginx) / 도메인·HTTPS 인증서 — 필요 시 별도 ADR.
- managed DB(RDS 등) 이전 — `DATABASE_URL` 교체만으로 동작하도록 환경변수화는 이미 충족.
- 자동 DB backup cron — deployment.md 가 P7 별도 task 로 둠.
- multi-host / HA / k8s — deployment.md worker 분리 전환 시점 조건 미충족.

## Follow-ups

- (선택) deploy 스크립트에 `shellcheck` 도입 — 현재는 `bash -n` 문법 검사만.
- (선택) GitHub Actions 기반 push-deploy(self-hosted runner) — 현재는 서버측 pull 방식(redeploy.sh).

## Result

DONE — PR #345 squash merge `a26bd2f` (origin/main). Dockerfile(멀티스테이지 비루트 runtime) + docker-entrypoint.sh(prisma migrate deploy → node dist/src/main) + docker-compose.yml(postgres healthcheck + app 서비스) + .dockerignore + deploy/{env.prod.example,redeploy.sh,assessment-agent-redeploy.{service,timer},README.md} + CI `deploy-artifacts` job(스크립트 `bash -n`/`sh -n` 문법 검사 + `docker build` end-to-end) 추가. production TS symbol 0 LOC라 jest spec 신설 불요 — R-110 tester 역할은 CI deploy-artifacts job 이 겸함(AC §Test 정합). 머지 후 main push CI run 27583332490(headSha a26bd2f) conclusion=success 확인.

본 closeout 은 후속 fire(cron@cloud-aalocal, server-time 2026-06-15T23:39:10Z)의 bookkeeping — PR #345 는 userDirected 경로로 머지됐으나 task status/STATE/journal closeout 이 누락돼 있어 driver 가 정합 복원. 코드 변경 0(direct doc-only).
