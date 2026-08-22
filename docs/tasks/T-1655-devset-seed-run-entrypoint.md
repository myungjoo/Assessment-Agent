---
id: T-1655
title: 133 로그인 seed 두 leg 를 묶는 top-level 진입점 (client 주입형) 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047, REQ-023, REQ-024]
estimatedDiff: 265
estimatedFiles: 2
created: 2026-08-22
createdAt: 2026-08-22T23:40:00Z
independentStream: load-r91
dependsOn: [T-1653, T-1654]
touchesFiles:
  - test/helpers/realdata-devset-seed-run.ts
  - test/helpers/realdata-devset-seed-run.spec.ts
plannerNote: R-91 chain 36/N — seed 실행 경로 5 번째 slice: 두 leg + placeholder 치환을 잇는 진입점만 (워크플로 · daily-test 0).
---

# T-1655 — 133 로그인 seed 두 leg 를 묶는 top-level 진입점 (client 주입형) 신설

## Why

오너 지시 (PLAN.md `144 행` "R-91 k6 최우선·즉시 착수") chain 의 36 번째 slice 다. 직전 네 slice 가 seed 실행 경로의 조각을 하나씩 박았다 — T-1651 (descriptor 계약) → T-1652 (`resolveDevsetSeedUpsertArgs` upsert-args 조립) → T-1653 (`upsertDevsetSeedPersons` Person leg 실행 + `email → person.id` map 회수) → T-1654 (`upsertDevsetSeedServiceIdentities` ServiceIdentity leg 실행). main 에는 그 사이를 잇는 치환 순수 함수 `resolveRealDataPersonId` (T-0575) 도 이미 있다.

남은 잔여는 **네 조각을 정해진 순서로 호출하는 top-level 진입점 하나** 다 ([`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 의 ① seed 실행 경로 마무리). 본 slice 는 그 조립 층만 가져간다 — 변환·검증 로직은 전부 하위 helper 호출이라 재구현 0 이고, 워크플로 배선 · `s1-batch.js` dataset 교체 · `scripts/daily-test.sh` leg 추가는 다음 slice 로 남겨 300 LOC / 5 파일 cap 을 지킨다 (T-1122 leg-추가 BLOCKED 선례 회피).

## Required Reading

- [`test/helpers/realdata-devset-seed-upsert-args.ts`](../../test/helpers/realdata-devset-seed-upsert-args.ts) — `resolveDevsetSeedUpsertArgs(count?)` (무인자 시 133 개) 계약. 본 진입점의 **1 단계 입력원**.
- [`test/helpers/realdata-devset-seed-person-upsert-runner.ts`](../../test/helpers/realdata-devset-seed-person-upsert-runner.ts) — `DevsetSeedPersonClient` · `upsertDevsetSeedPersons` 시그니처와 에러 정책 (구조 결손 `TypeError` / 값 정합 위반 `RangeError`, 순차 await, 검증 선행). 본 task 는 이 **주석 밀도와 계약 서술 형식을 mirror** 한다.
- [`test/helpers/realdata-devset-seed-identity-upsert-runner.ts`](../../test/helpers/realdata-devset-seed-identity-upsert-runner.ts) — `DevsetSeedIdentityClient` · `upsertDevsetSeedServiceIdentities` 시그니처, compound 키 `` `${personId}::${service}` `` 반환 계약.
- [`test/helpers/realdata-e2e-seed-resolve-person-id.ts`](../../test/helpers/realdata-e2e-seed-resolve-person-id.ts) — `resolveRealDataPersonId(upsertArgsList, emailToPersonId)` 의 치환 계약 (`PersonIdMap` 은 `ReadonlyMap` 도 수용 → Person leg 의 반환 Map 을 그대로 넘길 수 있다). 매핑 누락 · 빈 person.id 는 이 함수가 `Error` 로 차단한다.
- [`test/helpers/realdata-devset-seed-person-upsert-runner.spec.ts`](../../test/helpers/realdata-devset-seed-person-upsert-runner.spec.ts) — colocated spec 의 서술 형식과 mock client 패턴 선례.
- [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 — seed 실행 경로 잔여 항목.

## Acceptance Criteria

- [ ] `test/helpers/realdata-devset-seed-run.ts` 신설. public symbol 은 정확히 3 개:
  - `DevsetSeedClient` — `DevsetSeedPersonClient & DevsetSeedIdentityClient` 교차 타입 (실 `PrismaClient` 가 상위집합이 되도록 구조적 타입만 요구, 자체 필드 재선언 0).
  - `DevsetSeedRunResult` — `{ personCount: number; identityCount: number; emailToPersonId: Map<string, string>; identityKeyToId: Map<string, string> }` 결과 요약 interface.
  - `runDevsetSeed(client: DevsetSeedClient, count?: number): Promise<DevsetSeedRunResult>` — 아래 4 단계를 **이 순서대로** 호출하는 조립 함수.
- [ ] 실행 순서 고정 — ① `resolveDevsetSeedUpsertArgs(count)` (무인자 시 133) → ② `upsertDevsetSeedPersons` → ③ `resolveRealDataPersonId(args, emailToPersonId)` → ④ `upsertDevsetSeedServiceIdentities(resolved)`. 순서 근거 주석 1 줄 (identity 의 `personId` 는 Person leg 결과 없이는 실값이 될 수 없음).
- [ ] **변환·검증 재구현 0** — 4 단계는 전부 기존 helper 호출이며, 본 파일에서 upsert args 를 새로 만들거나 placeholder 를 직접 치환하지 않는다. 하위 helper 의 `TypeError` / `RangeError` / `Error` 는 **가공 없이 그대로 전파** 한다 (감싸서 타입을 바꾸지 않는다).
- [ ] `personCount` = ② 반환 Map 의 size, `identityCount` = ④ 반환 Map 의 size 로 산출하고, 두 Map 은 하위 helper 가 돌려준 **그 객체를 그대로** 실어 보낸다 (재복사 0 · 새 필드 0, R-59 raw 활동 데이터 0).
- [ ] fail-fast — 어느 단계가 throw/reject 하면 그 이후 단계는 호출되지 않는다 (예: Person leg 실패 시 `serviceIdentity.upsert` 호출 0 회).
- [ ] `@prisma/client` **값 import 0** (타입은 하위 helper 의 구조적 interface 재사용, `import type` 전용), 새 dependency 0, env 읽기 0, 실 DB/네트워크 접속 0. unit spec 은 mock client 로만 검증.
- [ ] colocated spec `test/helpers/realdata-devset-seed-run.spec.ts` 신설. R-112 4 종 전량 cover:
  - **happy-path** — (a) 소량 `count` 로 personCount/identityCount 가 실제 호출 횟수와 일치, (b) `person.upsert` 호출이 전부 `serviceIdentity.upsert` 첫 호출 **이전** 에 끝남 (호출 순서 기록으로 단언), (c) identity args 에 `PERSON_ID_PLACEHOLDER` 가 하나도 남지 않고 mock 이 돌려준 실 person.id 로 치환돼 있음, (d) 반환 두 Map 의 키/값 정합 (email 키 · `` `${personId}::${service}` `` 키). public symbol `runDevsetSeed` 에 happy-path 1+.
  - **error path** — `person.upsert` rejection 전파 + identity 단계 미진입, `serviceIdentity.upsert` rejection 전파, Person leg 결과에 `id` 결손일 때 하위 helper 의 throw 가 그대로 노출 각각 1+ test.
  - **분기 cover** — `count` 무인자 (133 기본값 경로: 호출 횟수 133 단언) vs 명시 `count`, identity 0 개인 Person 만 있는 입력 (identity 단계 호출 0 · 빈 Map · throw 0), `count = 0` (양 leg 호출 0 · 두 Map 모두 빈) 각각 1+ test.
  - **negative cases 충분 cover** — client `undefined` / `null`, `person` 결손, `serviceIdentity` 결손, `upsert` 비-함수, `count` 가 음수 / 소수 / 비-숫자 / `NaN`, 133 초과 `count`, Person leg 가 email 매핑을 빠뜨려 치환 단계가 실패하는 경우 — **각 1+ test** 로 에러 타입 (`TypeError` / `RangeError` / `Error`) 과 메시지 키워드까지 단언. 검증 실패 시 client 호출 0 회 (부분 적재 0) 도 함께 단언.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- `.github/workflows/load-k6.yml` 의 seed step 배선, `test/load/s1-batch.js` `setup()` 의 실 dataset 교체 — 다음 slice.
- `scripts/daily-test.sh` leg 추가 (drift-guard smoke spec 3 종 T-0791/T-0944/T-0947 동반 갱신이 필요해 5 파일 cap 초과 — T-1122 선례).
- 실 `PrismaClient` 인스턴스화 · 실 DB 접속 · 마이그레이션 · e2e/smoke spec 신설 · teardown(정리) 경로.
- 기존 `realdata-devset-seed-*.ts` · `realdata-e2e-seed-*.ts` 본문 수정 (읽기 전용 재사용).
- `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` 진척 doc-sync (별도 direct doc-sync slice).
- 재시도 · 트랜잭션 래핑 · 배치 크기 튜닝 등 성능 최적화 (현 단계는 결정론적 순차 실행 유지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
