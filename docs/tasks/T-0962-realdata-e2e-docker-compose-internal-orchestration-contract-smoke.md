---
id: T-0962
title: docker-compose.yml 내부 오케스트레이션 계약(app.depends_on.postgres.condition=service_healthy 기동-순서 게이트 + 양 서비스 restart=unless-stopped 정책 + postgres healthcheck bounded polling(interval/timeout/retries) + postgres-data named volume 영속 + app.env_file=.env single-source secret 주입) 정적 smoke
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 420
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0961(systemd unit 내부 directive, 420 LOC)·T-0960(docker-entrypoint 내부 부팅 시퀀스, 400 LOC)·T-0958(redeploy 내부 시퀀스, 420 LOC) 동형. R-112 4종 cover 위한 다수 assert(depends_on service_healthy 게이트·restart 정책 ×2 서비스·healthcheck bounded polling 3필드·named volume 영속·env_file single-source·negative mutant a~f 6종) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·docker-compose.yml 미변경."
independentStream: realdata-e2e-docker-compose-internal-orchestration-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-docker-compose-internal-orchestration-depends-on-service-healthy-restart-unless-stopped-healthcheck-bounded-polling-named-volume-env-file-single-source-contract.smoke-spec.ts]
created: 2026-07-14
plannerNote: "P5 §109 재배포 runner chain 의 런타임-스택 leg — docker-compose.yml 내부 오케스트레이션 계약 미봉. 기존 T-0795 parity 는 build.dockerfile·PORT 4중·image 상수·DATABASE_URL host:port cross-artifact wiring 만 봉함(depends_on/restart/healthcheck-timing/volume/env_file 미봉, grep 확인). entrypoint/systemd 의 parity(T-0797)→internal(T-0960/T-0961) split 과 동형."
---

# T-0962 — docker-compose.yml 내부 오케스트레이션 계약(depends_on service_healthy 기동-순서 게이트 + restart unless-stopped 정책 + healthcheck bounded polling + named volume 영속 + env_file single-source secret 주입) 정적 smoke

## Why

무인 nightly 재배포 runner 의 계약 표면을 봉해온 chain(daily-test.sh: T-0944~T-0957, redeploy.sh 내부 시퀀스: T-0958, seed-llm-config.sh env-gating: T-0959, docker-entrypoint.sh 내부 부팅: T-0960, systemd unit 내부 directive: T-0961)에서, 그 재배포가 실제로 **스택을 기동시키는 대상**인 `docker-compose.yml` 의 **내부 오케스트레이션 계약**은 아직 미봉이다. `redeploy.sh`(T-0958 봉함)의 핵심 동작은 `docker compose up -d --build` 로 이 compose 파일을 구동하는 것이므로, compose 의 내부 오케스트레이션 semantic 이 재배포 runner chain 의 런타임-스택 leg 다. 기존 compose smoke 는 상보적 다른 표면만 봉했다 — `realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts`(T-0795)는 compose 와 실 build/runtime artifact 사이의 **cross-artifact wiring parity** 만 봉했다: `app.build.dockerfile` 경로 실존·`${PORT:-3000}` 4중 byte-identical(compose/Dockerfile EXPOSE/parse-port DEFAULT_PORT/env.prod.example)·`postgres.image` 상수 + healthcheck `pg_isready -U X -d Y` 가 참조하는 **env 이름**·`DATABASE_URL` host(`postgres`)==서비스명·port(`5432`)==ports 매핑. 그러나 compose 자신의 **내부 오케스트레이션 semantic 계약**(app 이 postgres healthy 이후에만 기동하는 `depends_on.postgres.condition: service_healthy` 순서 게이트·양 서비스 `restart: unless-stopped` 자동재기동 정책·postgres `healthcheck` 의 bounded polling 값 `interval`/`timeout`/`retries`·`postgres-data` named volume 의 데이터 영속·app `env_file: .env` single-source secret 주입)은 어느 smoke 도 assert 하지 않았다(origin/main grep 확인 — parity smoke 는 이들 토큰에 `expect` NONE, `depends_on` 은 주석 1회 언급뿐). 이 관계는 redeploy.sh 가 T-0795/T-0797(outer artifact parity) 봉함 뒤에도 T-0958(내부 ordered 시퀀스·strict-mode)이 별도로 필요했던 것, docker-entrypoint.sh 가 parity 뒤에도 T-0960(내부 부팅 시퀀스)이, systemd unit 이 parity 뒤에도 T-0961(내부 directive)이 필요했던 것과 정확히 동형이다. 이 내부 오케스트레이션이 변질되면 — `depends_on.condition: service_healthy` 소실 시 app 이 postgres 미준비 상태에서 부팅 → `prisma migrate deploy` 가 DB 미연결로 실패(docker-entrypoint 의 migration-before-boot 전제 붕괴) / `restart: unless-stopped` 소실 시 컨테이너 crash 후 자동 복구 안 됨(무인 야간 배포 후 조용히 down) / `healthcheck` retries/interval 이탈 시 DB ready 판정 window 가 무한/0 으로 붕괴해 depends_on 게이트가 오작동 / `postgres-data` named volume 소실 시 컨테이너 재생성마다 DB 데이터 소멸(평가 결과 영영 유실) / `env_file: .env` 소실 시 `DATABASE_URL`/`AUTH_JWT_SECRET` 미주입으로 app 부팅 실패 — 무인 배포 스택이 조용히 미기동 또는 데이터 유실로 진행된다. 본 task 는 그 런타임-스택 leg 의 내부 오케스트레이션을 정적 앵커로 봉해 재배포 runner chain 을 완결에 한 걸음 더 붙인다(PLAN.md 109행 재배포 runner chain).

## Required Reading

- `docker-compose.yml` 전체(57행 — `postgres` 서비스: `restart: unless-stopped`(16행)·`ports "5432:5432"`(22행)·`volumes postgres-data:/var/lib/postgresql/data`(24행)·`healthcheck.test pg_isready`(27~31행)·`interval: 5s`(32행)·`timeout: 5s`(33행)·`retries: 10`(34행) / `app` 서비스: `restart: unless-stopped`(42행)·`depends_on.postgres.condition: service_healthy`(43~45행)·`env_file: - .env`(47~48행)·`environment.PORT`(50행)·`ports`(52행) / `volumes.postgres-data.name: assessment-agent-postgres-data`(54~56행) 포함).
- `test/smoke/realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts` — 기존 compose parity smoke(T-0795: build.dockerfile 경로·PORT 4중 byte-identical·postgres image 상수·healthcheck env **이름**·DATABASE_URL host:port cross-artifact 대조). 본 task 는 그와 상보(compose 내부 오케스트레이션 semantic vs outer wiring parity) — 재구현/변경 0, 중복 assert 금지. 특히 이 smoke 가 이미 잡는 `app.build.dockerfile` 경로·`${PORT:-3000}` 값·`postgres.image` 상수·healthcheck `pg_isready -U/-d` 가 참조하는 **env 이름**·`DATABASE_URL` host/port 는 본 task 에서 재검증하지 않는다.
- `test/smoke/realdata-e2e-redeploy-systemd-unit-internal-directive-oneshot-persistent-catchup-wantedby-enable-ordering-after-docker-networkonline-jitter-bounded-timer-service-pairing-contract.smoke-spec.ts` — 형제 T-0961 내부 directive smoke 패턴(readFileSync 정적 추출·repo-root `__dirname` 해석·선언적 파일 토큰 존재/값 assert·합성 mutant drift-detection·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 compose 파일에 적용 — 재구현이 아니라 패턴 참조.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-docker-compose-internal-orchestration-depends-on-service-healthy-restart-unless-stopped-healthcheck-bounded-polling-named-volume-env-file-single-source-contract.smoke-spec.ts` 신설. `docker-compose.yml` 을 `readFileSync` 로 읽어 내부 오케스트레이션 토큰을 정적 추출한다(실 `docker compose up`/실 docker build/실 컨테이너 부팅/실 postgres healthcheck/실 DB/실 HTTP 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0961 패턴). `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만.
- [ ] **Happy-path**: compose 내부 오케스트레이션 계약 불변식 각각에 대해 성공 assert 1+ —
  - `app` 서비스의 `depends_on.postgres.condition: service_healthy` 존재(app 은 postgres healthy 이후에만 기동 — startup ordering 게이트, migration-before-boot 전제),
  - `postgres` 와 `app` 두 서비스 **모두** `restart: unless-stopped` 존재(crash/재부팅 후 자동 복구 — restart 정책 ×2),
  - `postgres.healthcheck` 에 `interval`·`timeout`·`retries` 세 값 모두 존재하고 각각 **정수+단위(초) 또는 정수**로 유한·bounded(예: `interval: 5s`·`timeout: 5s`·`retries: 10` — DB ready 판정 window 가 유한; retries 는 양의 정수, interval/timeout 은 양의 시간값),
  - `postgres.volumes` 가 `postgres-data:/var/lib/postgresql/data` 로 named volume 을 `/var/lib/postgresql/data`(postgres 데이터 디렉토리)에 마운트 AND top-level `volumes.postgres-data` 선언 존재(named volume 데이터 영속 — 컨테이너 재생성 간 DB 데이터 생존),
  - `app` 서비스의 `env_file` 에 `.env` 존재(secret single-source 주입 — DATABASE_URL/AUTH_JWT_SECRET 등이 .env 한 곳에서 주입, §9 commit 금지 대상).
- [ ] **healthcheck↔depends_on 연결 계약**: `postgres.healthcheck` 가 존재해야 `app.depends_on.postgres.condition: service_healthy` 게이트가 유효함을 단언하는 assert 1+ (healthcheck 부재 시 service_healthy condition 이 영원히 충족 불가 → app 무한 대기 — 두 토큰의 상호 의존을 명시적으로 봉함).
- [ ] **named-volume 영속 정합 계약**: postgres 서비스가 마운트하는 volume 이름(`postgres-data`)이 top-level `volumes:` 블록에 선언된 이름과 동일함을 단언하는 assert 1+ (서비스가 미선언 volume 을 참조하면 anonymous volume 으로 격하돼 영속성 상실 — 이름 불일치 검출).
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match/실패 단언 각 1+ (최소 a~f 6종):
  - (a) `app.depends_on` 의 `condition: service_healthy` 를 `condition: service_started` 로 바꾼 mutant → healthy-gate 계약 위반 검출(DB ready 전 app 기동 → migration 실패 위험),
  - (b) `app` 의 `restart: unless-stopped` 라인을 제거한 mutant → app restart 정책 소실 검출,
  - (c) `postgres.healthcheck` 의 `retries: 10` 을 제거(또는 `retries: 0`)한 mutant → bounded polling 계약 소실/붕괴 검출,
  - (d) top-level `volumes.postgres-data` 선언을 제거한 mutant → named volume 미선언(영속성 상실) 검출,
  - (e) `app.env_file` 의 `.env` 를 제거한 mutant → secret single-source 주입 계약 소실 검출,
  - (f) postgres 서비스의 volume 참조 이름을 top-level 선언과 다르게(예: `postgres-data` → `pg-data`) 만든 mutant → named-volume 이름 불일치(영속성 격하) 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 compose 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 secret/password/실 DATABASE_URL/실 AUTH_JWT_SECRET/실 endpoint 가 등장하지 않음(오케스트레이션 키·`condition`/`restart`/`interval`/`timeout`/`retries` 값·volume 이름·`.env` 파일명·서비스명만)을 단언하는 test 1+. compose 의 `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change_me_in_env}` 는 env-substitution placeholder(실값 아님)일 뿐 — 필요 시 존재 확인만, `change_me_in_env` 는 의도적 placeholder 라 secret 표면 아님. `process.env` 읽기 0.
- [ ] **Flow/branch cover**: service_healthy 있음/없음 mutant 분기·restart 있음/없음 분기·retries 있음/없음 분기·named volume 선언 있음/없음 분기·env_file 있음/없음 분기·volume 이름 일치/불일치 분기를 각 test 로 분리. docker-compose.yml 은 조건 분기 없는 선언적 orchestration 파일 — "런타임 분기 없음(선언적 orchestration) — happy/negative mutant 로 대체 cover" 명시.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 `docker compose`/실 docker build/실 컨테이너 부팅/실 healthcheck/실 postgres/실 HTTP 0, `docker-compose.yml` 변경 0(readFileSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `docker-compose.yml` 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- 기존 `realdata-e2e-docker-compose-orchestration-contract-artifact-parity-drift.smoke-spec.ts`(T-0795: build.dockerfile 경로·PORT 4중 byte-identical·postgres image 상수·healthcheck `pg_isready -U/-d` env **이름**·DATABASE_URL host:port cross-artifact parity) 재구현/변경 0 — outer wiring parity vs 본 task 의 compose 내부 오케스트레이션 semantic 은 distinct 상보 표면. 본 task 는 build.dockerfile 경로·`${PORT:-3000}` 값·postgres image 상수·healthcheck env 이름·DATABASE_URL host/port 를 재검증하지 않는다(중복 금지).
- `healthcheck.test` 의 `pg_isready -U X -d Y` 가 참조하는 **env 이름** 재단언 0 — 그 이름 parity 는 T-0795 소관. 본 task 는 healthcheck 의 `interval`/`timeout`/`retries` **bounded polling 타이밍 semantic** 만.
- `${PORT:-3000}` 포트 매핑·`app.build`·`app.image` 재단언 0 — T-0795 소관.
- T-0958(redeploy.sh 내부 시퀀스)·T-0960(docker-entrypoint.sh 내부 부팅)·T-0961(systemd unit 내부 directive) smoke 재구현/변경 0 — script/unit 내부 orchestration vs 본 task 의 compose 내부 orchestration 은 distinct.
- 실 YAML 파서 라이브러리 도입 0 — node 내장 `fs`/`path` 만. 필요한 오케스트레이션 토큰만 정규식/섹션 슬라이스 추출(전체 YAML 파싱 아님).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
