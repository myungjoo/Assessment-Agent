---
id: T-0960
title: docker-entrypoint.sh 내부 부팅 시퀀스(set -e strict-mode + prisma migrate deploy → exec node dist/src/main ordered + exec PID-1 replacement + #!/bin/sh POSIX 인터프리터 + echo 진단 관측성) 계약 정적 smoke
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061, REQ-062]
estimatedDiff: 400
estimatedFiles: 1
sizeExempt: true
exemptReason: "test-only 단일 smoke-spec 1파일. sibling T-0958(redeploy 내부 시퀀스, 420 LOC)·T-0959(seed-llm-config env-gating, 400 LOC)·T-0956(daily-test bootstrap, 544 LOC) 동형. R-112 4종 cover 위한 다수 assert(strict-mode·ordered 2-step·exec PID-1·POSIX 인터프리터·echo 진단·negative mutant a~e) 불가피로 300 LOC 초과 예상이나 accepted sibling 패턴 그대로 — production 0 LOC·docker-entrypoint.sh 미변경."
independentStream: realdata-e2e-docker-entrypoint-internal-sequence-contract
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-docker-entrypoint-internal-step-sequence-strict-mode-exec-pid1-migration-before-boot-posix-sh-contract.smoke-spec.ts]
created: 2026-07-13
plannerNote: "P5 §109 step①/③ — 재배포 runner chain(daily-test T-0944~T-0957 · redeploy 내부 T-0958 · seed-llm-config env-gating T-0959) 하류인 docker-entrypoint.sh 의 미봉 표면 = 내부 부팅 시퀀스. 기존 docker-entrypoint smoke 는 artifact-parity 만(T-0958 앞의 T-0797 redeploy parity 와 동형) — set -e·migrate<boot ordered·exec PID-1·POSIX sh 는 미봉."
---

# T-0960 — docker-entrypoint.sh 내부 부팅 시퀀스 + strict-mode + exec PID-1 + migration-before-boot + POSIX sh 계약 정적 smoke

## Why

무인 nightly 재배포 runner 의 계약 표면을 하류로 한 단계씩 봉해온 chain(daily-test.sh: T-0944~T-0957, redeploy.sh 내부 시퀀스: T-0958, seed-llm-config.sh env-gating: T-0959)에서, redeploy.sh 가 `docker compose up -d --build`(23행, T-0958 로 봉함)로 재기동한 컨테이너가 실제로 실행하는 부팅 스크립트 `deploy/docker-entrypoint.sh`(20행)의 **내부 부팅 시퀀스 계약**은 아직 미봉이다. 기존 entrypoint smoke 는 상보적 다른 표면만 봉했다 — `realdata-e2e-docker-entrypoint-runtime-contract-build-artifact-parity-drift.smoke-spec.ts`(기존)는 두 런타임 계약(`./node_modules/.bin/prisma migrate deploy` 바이너리 경로·서브커맨드 ↔ package.json prisma dependency 배치·`exec node dist/src/main` 빌드-산출물 경로 ↔ tsconfig outDir·Dockerfile ENTRYPOINT/COPY)의 **artifact parity** 만 봉했다. docker-entrypoint.sh 자신의 **내부 부팅 orchestration**(`#!/bin/sh` POSIX 인터프리터 → `set -e` errexit-ON strict-mode → `echo` 진단 → `prisma migrate deploy`(migration 적용) → `echo` 진단 → `exec node dist/src/main`(PID-1 치환 앱 기동))은 어느 smoke 도 봉하지 않았다(origin/main 확인 — ordered 시퀀스·exec·set-e assert NONE). 이 관계는 redeploy.sh 가 T-0797(outer artifact parity) 봉함 뒤에도 T-0958(내부 ordered 시퀀스·strict-mode)이 별도로 필요했던 것과 정확히 동형이다. 이 부팅 시퀀스가 변질되면 — `set -e` 소실로 migration 실패가 조용히 무시된 채 앱이 미적용 스키마 위에서 부팅 / migration 과 앱 기동 순서 뒤집힘으로 앱이 마이그레이션 전 스키마에 붙음 / `exec` 소실로 node 가 PID 1 이 아닌 자식으로 떠 `docker stop`/SIGTERM 이 전파 안 돼 graceful shutdown 실패·컨테이너 강제 kill / `#!/bin/sh` → bashism 도입 시 alpine `sh`(busybox ash) 에서 부팅 실패 — 무인 야간 재배포가 crash-loop 또는 조용한 stale/broken 배포로 진행된다. 본 task 는 그 내부 부팅 시퀀스를 정적 앵커로 봉해 재배포 runner 의 컨테이너-부팅 leg 을 완결한다(PLAN.md 109행 재배포 runner chain).

## Required Reading

- `deploy/docker-entrypoint.sh` 전체(1~20행 — `#!/bin/sh`(1행)·`set -e`(11행)·`echo "[entrypoint] prisma migrate deploy 실행..."`(13행)·`./node_modules/.bin/prisma migrate deploy`(14행)·`echo "[entrypoint] NestJS 앱 기동 (node dist/src/main)..."`(19행)·`exec node dist/src/main`(20행) 포함).
- `test/smoke/realdata-e2e-docker-entrypoint-runtime-contract-build-artifact-parity-drift.smoke-spec.ts` — 기존 entrypoint artifact-parity smoke(prisma 바이너리 경로·`migrate deploy` 서브커맨드 ↔ package.json/tsconfig/Dockerfile parity). 본 task 는 그와 상보(내부 부팅 시퀀스·strict-mode·exec vs outer artifact parity) — 재구현/변경 0, 중복 assert 금지.
- `test/smoke/realdata-e2e-redeploy-internal-step-sequence-strict-mode-reset-hard-mirror-idempotency-nonfatal-seed-continuation-contract.smoke-spec.ts` — 형제 T-0958 redeploy 내부 시퀀스 smoke 패턴(readFileSync 정적 추출·repo-root `__dirname` 해석·ordered 토큰 index 단조성 assert·합성 mutant drift-detection·§9 credential 누출 0 구조). 본 task 는 동일 패턴을 docker-entrypoint.sh 에 적용 — 재구현이 아니라 패턴 참조.
- `test/smoke/realdata-e2e-daily-test-shell-strictness-uo-pipefail-errexit-absence-env-override-default-resolution-contract.smoke-spec.ts` — T-0956 shell-strictness 모델링 참조. 단 **세 스크립트의 strict-mode 계약이 다름**에 주의: daily-test.sh = `set -uo pipefail`(errexit **OFF**), redeploy.sh = `set -euo pipefail`(errexit **ON**), docker-entrypoint.sh = `set -e`(errexit **ON**, nounset·pipefail 미설정 — 최소 POSIX). 대조 모델링만, 재구현 0.

## Acceptance Criteria

- [ ] `test/smoke/realdata-e2e-docker-entrypoint-internal-step-sequence-strict-mode-exec-pid1-migration-before-boot-posix-sh-contract.smoke-spec.ts` 신설. `deploy/docker-entrypoint.sh` 를 `readFileSync` 로 읽어 부팅 시퀀스 토큰을 정적 추출한다(실행/source/실 docker/prisma/node 0). repo-root 경로는 `__dirname` 기준으로 cwd-robust 하게 해석(sibling T-0958 패턴).
- [ ] **Happy-path**: docker-entrypoint.sh 내부 부팅 계약 불변식 각각에 대해 성공 assert 1+ —
  - `#!/bin/sh` shebang 존재(POSIX sh 인터프리터 — bash 아님, alpine busybox ash 호환),
  - `set -e` 존재(errexit **ON** — 첫 명령 실패 시 즉시 종료 → crash-loop 신호. nounset·pipefail 은 미설정 = daily-test/redeploy 와 구별되는 최소 strict-mode),
  - **ordered 2-step 단조성**: `prisma migrate deploy`(14행) 소스 내 index < `exec node dist/src/main`(20행) 소스 내 index — migration 이 앱 기동 **앞**에 옴(미적용 스키마 위 부팅 방지),
  - **exec PID-1 치환**: 최종 앱 기동 라인이 `exec node ...`(단순 `node ...` 아님) — node 가 PID 1 을 치환해 SIGTERM/graceful shutdown 전파(`docker stop` hang 방지),
  - **echo 진단 관측성**: 두 step(migrate·boot) 각각 앞에 `echo "[entrypoint] ..."` 진단 라인이 옴(crash-loop 진단 시 stdout 로그 앵커 — 주석 8~9행이 이 로그를 진단 가이드로 명시).
- [ ] **migration-before-boot 순서 계약**: `prisma migrate deploy`(14행)가 `exec node dist/src/main`(20행) **앞**에 옴을 단언하는 assert 1+ (순서 뒤집히면 앱이 마이그레이션 전 스키마에 붙는 위험 — 순서 뒤집힘 검출). ordered-index 단조성으로 검출.
- [ ] **exec PID-1 secret-무관 signal 계약**: 최종 라인이 `exec` 로 시작(node 가 자식이 아닌 PID 1)임을 단언하는 assert 1+ (`exec` 소실 시 SIGTERM 미전파 → `docker stop` hang / 강제 kill 회귀 검출).
- [ ] **Error/negative path 충분 cover** — 예외 상황 분기마다 mutant 합성 소스로 not-match 단언 각 1+ (최소 a~e 5종):
  - (a) `set -e` 를 제거한 mutant → strict-mode(errexit ON) 계약 위반 검출(migration 실패 silent-무시 방지),
  - (b) `exec node dist/src/main` 을 `prisma migrate deploy` **앞**으로 옮긴 mutant → ordered-index 단조성 false(migration-before-boot 순서 뒤집힘 검출),
  - (c) `exec node dist/src/main` 을 `node dist/src/main`(exec 제거)로 바꾼 mutant → PID-1 치환/signal 전파 계약 위반 검출,
  - (d) `#!/bin/sh` 를 `#!/bin/bash` 로 바꾼 mutant → POSIX-sh 인터프리터 계약 위반 검출(bashism 위험),
  - (e) migrate 또는 boot 앞의 `echo "[entrypoint] ..."` 진단 라인을 제거한 mutant → stdout 관측성(crash-loop 진단 앵커) 계약 소실 검출.
- [ ] **원본 read-only 입증**: 합성 mutate 후에도 원본 추출 결과가 불변(원본 텍스트 미변조)임을 단언하는 test 1+.
- [ ] **§9 secret-safety**: 추출/합성하는 어떤 토큰에도 실 토큰/secret/password/실 endpoint 가 등장하지 않음(shebang·shell flag·prisma/node 명령 토큰·echo 진단 문자열만)을 단언하는 test 1+. `process.env` 읽기 0 — fixture 는 정적 파일 텍스트만.
- [ ] **Flow/branch cover**: strict-mode 있음/없음 mutant 분기·exec 있음/없음 분기·순서 정상/뒤집힘 분기·shebang sh/bash 분기를 각 test 로 분리. docker-entrypoint.sh 는 조건 분기 없는 선형 스크립트 — "런타임 분기 없음(선형 시퀀스) — happy/negative mutant 로 대체 cover" 명시.
- [ ] non-gated 항상 실행(describe.skip / gating 분기 0), 실 docker/prisma/node/migration/컨테이너/네트워크 0, `deploy/docker-entrypoint.sh` 변경 0(readFileSync 읽기만).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 본 spec 은 production 0 LOC 라 coverageThreshold 무회귀 — 기존 임계 유지 확인.

## Out of Scope

- `deploy/docker-entrypoint.sh` 수정 금지(drift 실제 발견 시 별도 fix task — 본 task 는 검증 smoke 신설만).
- 기존 `realdata-e2e-docker-entrypoint-runtime-contract-build-artifact-parity-drift.smoke-spec.ts`(prisma 바이너리 경로·`migrate deploy` 서브커맨드 ↔ package.json dependency 배치·tsconfig outDir·Dockerfile ENTRYPOINT/COPY parity) 재구현/변경 0 — artifact parity vs 본 task 의 내부 부팅 시퀀스는 distinct 상보 표면. 본 task 는 prisma dependency 배치·outDir·Dockerfile parity 를 재검증하지 않는다(중복 금지).
- T-0958(redeploy.sh 내부 재배포 시퀀스) smoke 재구현/변경 0 — redeploy 가 컨테이너를 재기동하는 상위 orchestration vs 본 task 의 컨테이너-내부 부팅은 distinct.
- `Dockerfile`·`docker-compose.yml`·`deploy/env.prod.example` 내부 계약 재검증 0(각 기존 compose/entrypoint parity smoke 소관).
- 실 prisma migration SQL·`dist/src/main` NestJS 부트스트랩 로직 재검증 0(기존 unit/e2e 소관) — 본 task 는 entrypoint 가 이들을 **호출·순서·exec** 하는 부팅 계약만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음)
