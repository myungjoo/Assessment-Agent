---
id: ADR-0043
title: "LAN 기기 일일 Docker 배포·자동 테스트 (black-box 스모크 · 단일 이슈 보고 · 로컬 루틴 트리거)"
status: ACCEPTED
date: 2026-06-17
relatedTask: T-0447
supersedes: null
---

# ADR-0043 — LAN 기기 일일 Docker 배포·자동 테스트

## Context

LAN 의 arm64 기기(Raspberry Pi 5, Debian 12, `192.168.0.7`)에서 매일 **02:00** 에
최신 `main` 기준으로 Docker 스택을 재배포하고, 기동된 앱을 자동 테스트해 **항상 살아있는
사용자 테스트 인스턴스**를 유지하려 한다. 이미 [`deploy/redeploy.sh`](../../deploy/redeploy.sh)
(origin/main 동기화 → 재빌드 → 컨테이너 교체) 와 [`Dockerfile`](../../Dockerfile) ·
[`docker-compose.yml`](../../docker-compose.yml) · CI `deploy-artifacts` job(매 PR 마다
amd64·ephemeral 에서 boot+serve 스모크)이 존재한다. 빠진 것은 **재배포 후 검증 러너 + 결과
보고 + 02:00 트리거** 세 가지다.

세 가지 제약이 설계를 규정한다:

- **운영 이미지는 슬림** — [Dockerfile](../../Dockerfile) 이 `pnpm prune --prod` 로
  devDependency(jest·ts-node 등)를 제거한다. 따라서 컨테이너 안에서 `pnpm test:smoke` /
  `test:e2e`(jest)를 **돌릴 수 없다**.
- **LAN 사설 IP** — `192.168.0.7` 은 클라우드 cron(Anthropic 인프라)에서 **도달 불가**다.
  같은 LAN 에 있는 로컬 PC 만 SSH 로 접근할 수 있다.
- **무인 자동화** — 사람이 매 02:00 에 개입하지 않는다. 실패가 수주간 방치돼도 잡음이
  누적되면 안 된다.

## Decision

### 1. 검증은 black-box HTTP 스모크

슬림 이미지라 jest 불가 → 기동된 컨테이너를 `:3000` 으로 두드리는 **black-box HTTP 스모크**로
검증한다([`deploy/daily-test.sh`](../../deploy/daily-test.sh)). 4 step:

1. **redeploy** — `deploy/redeploy.sh` 호출(재구현 0).
2. **health** — `GET /api` 가 `APP_STATUS_MESSAGE("Assessment-Agent",
   [src/app.service.ts](../../src/app.service.ts))` 될 때까지 폴링(기본 180s — Pi5 빌드·부팅 여유).
3. **liveness** — `GET /api` 문자열 일치 + `GET /` 200 + SPA HTML 마커([ADR-0040](ADR-0040-frontend-stack.md)).
4. **auth round-trip** — `POST /api/users`(201|409 멱등) → `POST /api/auth/login`(200) →
   `GET /api/auth/me`(200). DB write/read + bcrypt + JWT 까지 **실 arm64 + 영속 DB** 에서 검증.

**CI deploy-artifacts 와의 차별점**: CI 는 amd64·ephemeral·매 PR 의 boot+serve 만 본다. daily 는
**arm64 실기 + 영속 DB(누적 마이그레이션) + main HEAD(머지 후)** 를 검증한다 — 겹치지 않는 축이다.

### 2. 결과는 단일 GitHub issue 상태 토글

label `daily-test` 이슈를 **open/closed 통틀어 항상 ≤1 개** 재사용한다(방치 시 누적 0):

- **PASS** → 열린 이슈가 있으면 body 를 최신 상태로 edit 후 `close`. 없으면 noop.
- **FAIL** → 이슈를 open 상태로 보장(있으면 edit, 없으면 create, 필요 시 reopen). body 에
  상태표 + 로그 tail + 기기 전체 로그 경로.

### 3. 보고만 — 자동 수정 PR 없음

실패 시 루틴은 이슈에 진단만 기록한다. **자동 수정 PR 을 열지 않는다**. 무인 환경에서 불확실한
수정이 `main` 으로 향하는 위험을 차단하고, 수정 판단은 사람/driver 에게 남긴다.

### 4. 트리거는 로컬 PC 의 Claude Desktop 로컬 루틴

LAN 도달성 제약 때문에 트리거는 **같은 LAN 의 로컬 PC**여야 한다. Claude Desktop 의 **로컬 루틴**
(매 발화 fresh session·로컬 실행이라 LAN·SSH 접근 가능)을 Daily 02:00 으로 둔다. 루틴은 얇게 —
[`docs/ops/daily-deploy-test.md`](../ops/daily-deploy-test.md) 플레이북을 그대로 실행만 한다(로직은
저장소에 버전관리·리뷰됨). 루틴은 **driver lock 을 잡지 않는다**(PLAN task 진행이 아니라 기기 검증 +
이슈 1 개 관리뿐).

### 5. 기기 systemd 타이머 미사용

[deploy/README.md](../../deploy/README.md) §5 의 systemd 03:00 타이머는 **설치하지 않는다**.
트리거 주체가 로컬 루틴이라, 기기 타이머까지 켜면 하루 2 회 재배포된다.

## Consequences

- **이점**: jest 불가 환경에서도 실 사용 경로(배포→마이그레이션→인증)를 매일 검증. 단일 이슈라
  inbox 깔끔. 로컬 루틴이 cron@cloud 의 LAN 미도달을 우회. 로직이 저장소에 있어 PR 리뷰 대상.
- **비용/한계**:
  - 로컬 PC 가 02:00 에 **켜져 있고 깨어 있어야** 한다(로컬 루틴 제약). 꺼져 있으면 그날 누락
    (깨어날 때 1 회 보충).
  - 스모크는 기기 `localhost` 에서 curl 로 친다. **다른 LAN 기기의 브라우저**는 `secure: true`
    쿠키([auth.controller.ts](../../src/auth/auth.controller.ts) `COOKIE_OPTIONS`)를 http 로
    안 보내므로, 타 기기 브라우저 인증 사용자 테스트는 **TLS(리버스 프록시)** 가 필요하다. 본 ADR 범위
    밖이며 별도 결정 대상(보안/auth 변경은 [CLAUDE.md](../../CLAUDE.md) §5 BLOCKED 게이트).
  - 고정 테스트 계정(`daily-smoke@local.test`) 1 개가 기기 DB 에 상주한다(첫 user 면 SuperAdmin).
    테스트 전용 기기라 무해.

## Alternatives

- **컨테이너 안 jest 실행** — 슬림 이미지에 devDep 부재라 불가. dev 이미지 별도 빌드는 운영 이미지와
  괴리 + Pi5 빌드 비용 2 배. 기각.
- **클라우드 cron / GitHub Actions self-hosted runner 트리거** — cron@cloud 는 LAN 미도달. self-hosted
  runner 는 기기에 상시 데몬·토큰 표면 추가. 로컬 루틴이 더 단순하고 격리적. 기각.
- **매 실행 새 이슈 생성** — 방치 시 이슈 누적. 단일 이슈 상태 토글이 사용자 요구("누적 막아라")에 정합.
- **자동 수정 PR** — 무인 환경에서 불확실한 수정의 main 유입 위험. 보고-only 채택.
