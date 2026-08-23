---
id: T-1658
title: 133 로그인 seed 의 얇은 실행 entrypoint + pnpm 스크립트 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047, REQ-023, REQ-024]
estimatedDiff: 160
estimatedFiles: 3
created: 2026-08-23
createdAt: 2026-08-23T05:20:00Z
independentStream: load-r91
dependsOn: [T-1657]
touchesFiles:
  - scripts/seed-devset-logins.ts
  - scripts/seed-devset-logins.spec.ts
  - package.json
plannerNote: R-91 chain 39/N — seed 실행 경로 8 번째 slice: 분기 0 entrypoint + pnpm 스크립트만, 워크플로 배선은 다음 slice.
---

# T-1658 — 133 로그인 seed 의 얇은 실행 entrypoint + pnpm 스크립트 신설

## Why

오너 지시 (PLAN.md `144 행` "R-91 k6 최우선·즉시 착수") chain 의 39 번째 slice 다. 직전 slice T-1657 (main `1e44f562`, PR #1325) 가 `createDevsetSeedClient(databaseUrl)` 팩토리를 박제해 **seed 실행에 필요한 부품이 전부 갖춰졌다** — 기술자 (T-1651) · upsert 인자 (T-1652) · 두 leg runner (T-1653/T-1654) · 조립층 `runDevsetSeed` (T-1655) · exit code 본체 `runDevsetSeedCli` (T-1656) · 실 client 팩토리 (T-1657).

그러나 이 부품들을 실제로 **실행할 주체가 아직 없다**. 지금 `runDevsetSeedCli` 를 호출하는 곳은 spec 뿐이고, `process.env.DATABASE_URL` 을 읽어 팩토리에 넘기는 코드도 없다. `.github/workflows/load-k6.yml` 이 seed 를 태우려면 셸에서 한 줄로 부를 수 있는 실행 진입점이 필요하다.

본 slice 는 그 마지막 한 칸만 박는다 — `scripts/encrypt-token.ts` (분기 0 · `require.main` 가드 · 실 process io 주입만) 패턴을 그대로 mirror 한 **얇은 entrypoint** 와 이를 부르는 `package.json` 스크립트 1 개. 검증 분기는 이미 T-1657 팩토리가 가져갔으므로 entrypoint 는 분기 0 을 유지한다 (CLAUDE.md `§3.2` R-112 entrypoint 규약). 워크플로 배선 · 실 dataset 교체는 다음 slice 다. 잔여 좌표는 [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 의 ①.

## Required Reading

- [`scripts/encrypt-token.ts`](../../scripts/encrypt-token.ts) — 본 task 가 mirror 할 **정본 패턴**: 분기 0 · 실 process io 주입 · `require.main === module` 가드 · 본체 위임.
- [`scripts/encrypt-token.spec.ts`](../../scripts/encrypt-token.spec.ts) — entrypoint 최소 spec 의 서술·구성 선례 (`scripts/` 는 `collectCoverageFrom` 밖이라 coverage 대상이 아니고, spec 의 목적은 spec-presence 충족 + 위임/무-side-effect 계약 검증).
- [`test/helpers/realdata-devset-seed-cli.ts`](../../test/helpers/realdata-devset-seed-cli.ts) `19~31 행` — 위임 대상 `runDevsetSeedCli(deps)` 와 주입 계약 `DevsetSeedCliDeps` (`client` · 선택 `count` · `log` · `logError`).
- [`test/helpers/realdata-devset-seed-client.ts`](../../test/helpers/realdata-devset-seed-client.ts) `56 행` 이후 — `createDevsetSeedClient(databaseUrl)` 시그니처와 fail-fast `TypeError` 정책 (메시지에 connection string 을 echo 하지 않는다).
- [`package.json`](../../package.json) 의 `scripts` 객체 — 신규 키를 추가할 위치. `test:load*` 4 종 키집합은 [`test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts`](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) `1936~1938 행` 이 정확히 단언하므로 **그 4 종을 건드리지 않는 새 키** 여야 한다.

## Acceptance Criteria

- [ ] `scripts/seed-devset-logins.ts` 신설. 실행 시 `process.env.DATABASE_URL` 로 `createDevsetSeedClient` 를 호출해 얻은 client 를 `runDevsetSeedCli` 에 넘기고, 반환된 exit code 를 그대로 `process.exit` 에 전달한다.
- [ ] **분기 0** — 파일 안에 `if` · 삼항 연산자 · `&&` / `||` / `??` 단축 평가 · `switch` · 반복문이 없다. 유일한 예외는 `require.main === module` 가드 1 개 (`encrypt-token.ts` 와 동형) 와 최상위 실패 흡수용 `.catch` 콜백 1 개이며, 그 콜백 안에서도 분기 0 이어야 한다 (예: `String(error)` 로 무조건 문자열화 후 stderr 출력 + exit code `1`).
- [ ] **로직 재구현 0** — seed 절차 · upsert · `DATABASE_URL` 검증 · 요약 로깅 · `$disconnect` 를 본 파일에서 다시 구현하지 않는다. `createDevsetSeedClient` 1 회 + `runDevsetSeedCli` 1 회 호출만 한다. 새 dependency 0 (`ts-node` · `@prisma/client` 는 기존 의존).
- [ ] **import 만으로 side effect 0** — `require.main === module` 가드 덕에 test 에서 import 해도 seed 실행 · `process.exit` · DB 접속이 일어나지 않는다.
- [ ] **`§9` 자격증명 보호** — 파일에 hard-coded connection string · 토큰 · 비밀값 리터럴이 없고, 로그·에러 출력에 `DATABASE_URL` 값을 그대로 찍지 않는다.
- [ ] `package.json` 의 `scripts` 에 실행 키 1 개 추가 (예: `"seed:devset-logins": "ts-node scripts/seed-devset-logins.ts"`). 기존 키는 **하나도 수정·삭제하지 않는다** — 특히 `test:load` · `test:load:s1` · `test:load:s2` · `test:load:s3` 4 종 불변 (위 drift smoke 단언).
- [ ] colocated spec `scripts/seed-devset-logins.spec.ts` 신설 (실 DB 접속 0 · 실 seed 실행 0). R-112 4 종 전량 cover:
  - **happy-path** — (a) entrypoint 를 dynamic `import()` 해도 throw · `process.exit` 없이 resolve 하고, (b) 위임 대상 `createDevsetSeedClient` · `runDevsetSeedCli` 가 각각 함수로 존재하며, (c) `package.json` 의 새 스크립트 키 값이 실존하는 entrypoint 파일 경로를 가리킨다 — 각 1+ test.
  - **error path** — entrypoint 소스를 정적으로 읽어 (a) 최상위 실패 흡수 경로 (`.catch` 또는 동등) 가 존재하고 exit code `1` 로 귀결하며, (b) 그 경로가 `DATABASE_URL` 값을 출력 문자열에 삽입하지 않음을 단언 — 각 1+ test.
  - **분기 cover** — 정적 소스 단언으로 (a) `require.main === module` 가드 1 개 존재, (b) 그 외 조건 분기 토큰 (`if (` · `? :` · `switch` · `for (` · `while (`) 0 — 각 1+ test. (entrypoint 는 설계상 분기 0 이므로 실행 분기 test 대신 본 정적 단언으로 대체한다.)
  - **negative cases 충분 cover** — (a) seed 로직 재구현 금지 (`upsert` · `resolveDevsetSeedUpsertArgs` · `runDevsetSeed` 직접 호출 문자열 0), (b) `@prisma/client` 값 import 0, (c) hard-coded connection string / `postgres://` 리터럴 0, (d) `package.json` 의 `test:load*` 키집합이 정확히 기존 4 종, (e) 신규 스크립트 키가 기존 키를 덮어쓰지 않음 (키 중복 0), (f) entrypoint 가 `process.env` 를 `DATABASE_URL` 외 다른 이름으로 읽지 않음 — **각 1+ test**.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm test:smoke` green — 특히 `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 와 `ci-workflow-verification-chain-contract-scripts-parity-drift.smoke-spec.ts` 가 `package.json` 변경으로 깨지지 않음을 확인.

## Out of Scope

- `.github/workflows/load-k6.yml` 에 seed step 배선 · 그에 동반되는 drift smoke spec 갱신 — 다음 slice.
- `test/load/s1-batch.js` `setup()` 의 실 dataset 교체 — 그 다음 slice.
- `scripts/daily-test.sh` leg 추가 (drift-guard smoke spec 3 종 T-0791/T-0944/T-0947 동반 갱신 필요 → 5 파일 cap 초과, T-1122 BLOCKED / Q-0054 선례).
- argv 로 `count` 를 받는 파싱 (숫자 검증이 **분기** 라 entrypoint 규약 위반 — 필요해지면 별도 helper slice). 본 slice 는 `runDevsetSeedCli` 의 기본 경로 (133 건 전량) 만 쓴다.
- 기존 `test/helpers/realdata-devset-seed-*.ts` 본문 수정 · `src/` 변경 · Prisma schema/migration 변경.
- 실 DB 를 띄우는 smoke/e2e 추가 · 적재 데이터 teardown · 재시도 · connection pool 튜닝.
- `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` 진척 doc-sync (별도 direct doc-sync slice).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
