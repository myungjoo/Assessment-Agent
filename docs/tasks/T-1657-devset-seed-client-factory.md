---
id: T-1657
title: 133 로그인 seed 의 실 PrismaClient 팩토리 (DATABASE_URL 검증) 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047, REQ-023, REQ-024]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-08-23
createdAt: 2026-08-23T03:20:00Z
independentStream: load-r91
dependsOn: [T-1656]
touchesFiles:
  - test/helpers/realdata-devset-seed-client.ts
  - test/helpers/realdata-devset-seed-client.spec.ts
completedAt: 2026-08-23T04:52:26Z
prNumber: 1325
mergeCommit: 1e44f562
plannerNote: R-91 chain 38/N — seed 실행 경로 7 번째 slice: 실 PrismaClient 팩토리(URL 검증 분기)만, entrypoint 는 다음 slice.
---

# T-1657 — 133 로그인 seed 의 실 PrismaClient 팩토리 (DATABASE_URL 검증) 신설

## Why

오너 지시 (PLAN.md `144 행` "R-91 k6 최우선·즉시 착수") chain 의 38 번째 slice 다. 직전 slice T-1656 (main `1a7ace68`, PR #1324) 가 `runDevsetSeedCli(deps)` 본체를 박제해 **분기·exit code·연결 종료 정책은 완성**됐다. 그러나 그 본체가 요구하는 `deps.client` 를 실제로 만들어 주는 주체가 아직 없다 — 지금 `DevsetSeedCliClient` 를 만족하는 값은 spec 의 mock 뿐이다.

`.github/workflows/load-k6.yml` 이 seed 를 태우려면 실 `PrismaClient` (Prisma 7.x driver-only 모델이라 `PrismaPg` adapter 동반) 인스턴스가 필요하고, `DATABASE_URL` 미설정이면 **첫 query 의 모호한 connection 실패가 아니라 명확한 메시지로 fail-fast** 해야 한다 ([`test/helpers/jest-smoke-setup.ts`](../../test/helpers/jest-smoke-setup.ts) 가 이미 증명한 정책). 이 검증은 **분기** 이므로 CLAUDE.md `§3.2` R-112 "entrypoint 안에 분기 두지 말고 unit-testable helper 로 분리" 룰에 따라 entrypoint 가 아니라 본 slice 의 helper 가 가져간다.

따라서 본 slice 는 **팩토리 함수 하나만** 박제한다. 실 `process.env` 읽기 · `process.exit` 호출 · `package.json` 스크립트 추가는 분기 0 인 다음 slice 의 얇은 entrypoint (`scripts/seed-devset-logins.ts`, [`scripts/encrypt-token.ts`](../../scripts/encrypt-token.ts) 패턴 mirror) 몫이다. 잔여 좌표는 [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 의 ① — "133 로그인을 소비해 `Person` + 각자 github `ServiceIdentity` 를 적재하는 seed 실행 경로".

## Required Reading

- [`test/helpers/realdata-devset-seed-cli.ts`](../../test/helpers/realdata-devset-seed-cli.ts) — 본 팩토리의 **유일한 소비자**. 반환 타입이 만족해야 하는 `DevsetSeedCliClient` (= `DevsetSeedClient & { $disconnect(): Promise<void> }`) 교차 타입과 `DevsetSeedCliDeps` 주입 계약.
- [`test/helpers/realdata-devset-seed-run.ts`](../../test/helpers/realdata-devset-seed-run.ts) `28~31 행` — `DevsetSeedClient` 가 두 leg runner 의 구조적 계약 교차이며 실 `PrismaClient` 가 상위집합이라는 전제.
- [`src/persistence/prisma.service.ts`](../../src/persistence/prisma.service.ts) `24~35 행` — `buildPrismaAdapter()` + `new PrismaClient({ adapter })` 의 정본 조립 형태 (Prisma 7.x driver-only 요건).
- [`test/helpers/jest-smoke-setup.ts`](../../test/helpers/jest-smoke-setup.ts) — `DATABASE_URL` 미설정 시 fail-fast throw 의 메시지 형식 선례 (본 task 가 승계할 정책).
- [`test/helpers/realdata-devset-seed-cli.spec.ts`](../../test/helpers/realdata-devset-seed-cli.spec.ts) — colocated spec 의 서술 형식 선례. 본 task 의 spec 도 같은 형식을 따른다.

## Acceptance Criteria

- [x] `test/helpers/realdata-devset-seed-client.ts` 신설. public symbol 은 정확히 1 개:
  - `createDevsetSeedClient(databaseUrl: string | undefined): DevsetSeedCliClient` — 검증 통과 시 `PrismaPg` adapter 를 물린 실 `PrismaClient` 를 `DevsetSeedCliClient` 로 반환하는 팩토리.
- [x] **connection string 은 인자 주입** — 본 파일에서 `process.env` · `process.argv` · `console.*` 를 읽지 않는다 (entrypoint 몫). 새 dependency 0 (`@prisma/client` · `@prisma/adapter-pg` 는 기존 의존).
- [x] **호출 시점 실 접속 0** — 팩토리는 인스턴스 생성만 하고 `$connect()` · query · 마이그레이션을 호출하지 않는다 (Prisma 의 lazy connection 전제). seed 로직 재구현 0 — `runDevsetSeed` · upsert · 치환을 본 파일에서 부르지 않는다.
- [x] **검증 분기** — `databaseUrl` 이 `undefined` / 비-string / 공백만 있는 문자열이면 `TypeError` 를 throw 하며, 그 메시지는 (a) 원인과 조치 (`DATABASE_URL` 설정 필요) 를 담고 (b) **입력 문자열 자체를 절대 포함하지 않는다** (CLAUDE.md `§9` — connection string 은 자격증명이라 로그·에러에 echo 금지).
- [x] **타입 경계** — 반환값이 `DevsetSeedCliClient` 로 그대로 대입돼 `runDevsetSeedCli({ client, ... })` 에 넘어간다 (spec 에서 타입 수준 대입으로 확인). 구조적 불일치로 cast 가 불가피하면 **최소 범위 1 회** 로 제한하고 근거를 주석에 남긴다.
- [x] colocated spec `test/helpers/realdata-devset-seed-client.spec.ts` 신설 (실 DB 접속 0 — 더미 connection string 만 사용). R-112 4 종 전량 cover:
  - **happy-path** — 유효한 더미 URL 로 호출 시 (a) 객체 반환, (b) `person.upsert` · `serviceIdentity.upsert` · `$disconnect` 가 모두 함수, (c) throw 0. public symbol `createDevsetSeedClient` 에 happy-path 1+.
  - **error path** — `undefined` · 빈 문자열 · 공백만("   ") 각각에 대해 `TypeError` throw 를 단언 (각 1+ test).
  - **분기 cover** — 검증 통과 경로 vs 각 실패 경로, 그리고 공백 trim 후 판정 (앞뒤 공백이 붙은 유효 URL 은 통과) 각 1+ test.
  - **negative cases 충분 cover** — `null` · 숫자 · 객체 · 배열 등 비-string 입력, 두 번 호출 시 **서로 다른 인스턴스** 반환(싱글턴 캐싱 없음), 에러 메시지에 입력 URL 의 credential 부분 문자열(예: `postgres:secret`)이 포함되지 않음 — **각 1+ test**.
- [x] `pnpm lint && pnpm build && pnpm test` 전량 green.
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- 얇은 entrypoint (`scripts/seed-devset-logins.ts`) 신설 · `package.json` 스크립트 추가 · `process.env.DATABASE_URL` 읽기 · `process.exit` 호출 — 다음 slice.
- `.github/workflows/load-k6.yml` 의 seed step 배선, `test/load/s1-batch.js` `setup()` 의 실 dataset 교체 — 그 다음 slice.
- `scripts/daily-test.sh` leg 추가 (drift-guard smoke spec 3 종 T-0791/T-0944/T-0947 동반 갱신이 필요해 5 파일 cap 초과 — T-1122 BLOCKED / Q-0054 선례).
- 기존 `realdata-devset-seed-*.ts` · `src/persistence/prisma.service.ts` 본문 수정 (읽기 전용 재사용 — `buildPrismaAdapter` 를 그대로 쓸지 자체 조립할지는 구현 재량이나 기존 파일은 건드리지 않는다).
- 실 DB 를 띄우는 smoke/e2e spec 추가 · teardown(적재 데이터 정리) · 재시도 · connection pool 튜닝.
- `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` 진척 doc-sync (별도 direct doc-sync slice).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 요약 (2026-08-23 DONE)

PR #1325 → main `1e44f562` squash merge. `test/helpers/realdata-devset-seed-client.ts` 신설 (+231/-0, 2 파일) — public symbol 정확히 1 개 `createDevsetSeedClient(databaseUrl)`. trim 후 검증 통과 시 `PrismaPg` adapter 를 물린 `PrismaClient` 를 **매 호출 새 인스턴스** 로 반환하며, `process.env` · `process.argv` · `console.*` 접근 0 · 호출 시점 실 접속 0 · 새 dependency 0. `undefined` · 비-string · 공백만 입력은 `TypeError` 로 fail-fast 하고 에러 메시지에 입력 connection string 을 echo 하지 않는다 (`§9` 자격증명 보호). 실 `PrismaClient` 의 generic upsert 시그니처가 단형 `DevsetSeedCliClient` 계약과 겹치지 않아 cast 를 **최소 범위 1 회** 만 쓰고 근거를 주석에 박제했다.

colocated spec 22 test (happy 4 · error 4 · 분기 3 · negative 11) 로 R-112 4 종 전량 cover, 실 DB 접속 0. 전체 452 suite / 12967 test green, `test:cov` line 99.95% · function 100% (임계 80/80 상회). reviewer round 1 APPROVE + PR comment 외부 post + CI green 으로 4-게이트 충족.

잔여 (Out of Scope 그대로): ① 얇은 entrypoint `scripts/seed-devset-logins.ts` + `package.json` 스크립트, ② `load-k6.yml` seed step 배선 + `s1-batch.js` `setup()` 실 dataset 교체, ③ 부하계획 `§5` item 5 진척 doc-sync.

