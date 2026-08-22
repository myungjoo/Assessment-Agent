---
id: T-1653
title: 133 로그인 upsert-args 의 Person leg 실행 runner (client 주입형) 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047, REQ-023, REQ-024]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-08-22
independentStream: load-r91
dependsOn: [T-1652]
touchesFiles:
  - test/helpers/realdata-devset-seed-person-upsert-runner.ts
  - test/helpers/realdata-devset-seed-person-upsert-runner.spec.ts
prNumber: 1321
completed: 2026-08-22
plannerNote: R-91 chain 34/N — seed 실행 경로 3 번째 slice: upsert-args 의 Person leg 실행 + email→id map 회수만 (identity leg · 워크플로 0).
---

# T-1653 — 133 로그인 upsert-args 의 Person leg 실행 runner (client 주입형) 신설

## Why

오너 지시 (PLAN.md `144 행` "R-91 k6 최우선·즉시 착수") chain 의 34 번째 slice 다. 직전 slice T-1652 (`bcce5516` / PR #1320) 가 133 로그인을 `RealDataUpsertArgs[]` 까지 밀어 올리는 순수 조립 helper 를 박았고, 남은 잔여는 그 args 를 **실제로 DB 에 적재하는 실행 경로** 다 ([`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 의 ① seed 실행 경로).

실행 경로 전체 (Person upsert → `email → person.id` map 회수 → `resolveRealDataPersonId` 치환 → ServiceIdentity upsert → 워크플로 step 배선) 를 한 task 로 하면 300 LOC / 5 파일 cap 을 확실히 깬다. 본 slice 는 그 중 **Person leg 하나** 만 가져간다 — 주입된 client 로 `person.upsert` 를 순차 실행하고 다음 leg 가 쓸 `email → person.id` map 을 회수하는 함수 1 개 + colocated spec. client 는 구조적 interface 로 **주입** 받으므로 `@prisma/client` 값 import 0 · 새 dependency 0 · 실 DB 접속 0 이고, unit test 는 mock client 로 전부 cover 된다.

## Required Reading

- [`test/helpers/realdata-devset-seed-upsert-args.ts`](../../test/helpers/realdata-devset-seed-upsert-args.ts) — 본 runner 의 입력 (`RealDataUpsertArgs[]`) 을 만드는 직전 slice helper.
- [`test/helpers/realdata-e2e-seed-upsert.ts`](../../test/helpers/realdata-e2e-seed-upsert.ts) — `RealDataUpsertArgs` / `PersonUpsertArgs` 타입 정본 + `PERSON_ID_PLACEHOLDER` 의도.
- [`test/helpers/realdata-e2e-seed-resolve-person-id.ts`](../../test/helpers/realdata-e2e-seed-resolve-person-id.ts) — 본 runner 가 회수하는 map (`PersonIdMap`) 의 소비처. map 형태를 그대로 맞춘다.
- [`test/helpers/realdata-devset-seed-descriptors.ts`](../../test/helpers/realdata-devset-seed-descriptors.ts) — 같은 chain 의 에러 정책 (구조 결손 `TypeError` / 값 정합 위반 `RangeError`) 선례.
- [`test/helpers/prisma-mock.ts`](../../test/helpers/prisma-mock.ts) — spec 에서 client 를 mock 할 때 재사용 가능한지 먼저 확인 (재사용 가능하면 재사용, 아니면 spec 안에 지역 mock 을 둔다 — 새 공용 helper 파일 신설 금지).

## Acceptance Criteria

- [x] `test/helpers/realdata-devset-seed-person-upsert-runner.ts` 를 신설하고 public symbol 을 정확히 다음으로 한정한다 — 타입 `DevsetSeedPersonClient` (구조적 client interface: `person.upsert(args) => Promise<{ id: string }>`), 함수 `upsertDevsetSeedPersons(client, upsertArgsList)` (Promise<Map<string, string>> 반환, key = `personUpsert.where.email`, value = 실 `person.id`).
- [x] 실행은 **입력 순서대로 순차 await** — 동시 실행 금지 (`email @unique` 경합 회피 + 결정론 보장). 각 호출은 `args.personUpsert` 객체를 **그대로** 전달하고 새 필드를 만들지 않는다 (R-59 raw 데이터 미포함 유지).
- [x] `@prisma/client` 값 import 0 · 새 dependency 0 · env 읽기 0 · 실 네트워크/DB 접속 0. `src/` · `prisma/` · `.github/workflows/` · `package.json` 무변경.
- [x] colocated spec `test/helpers/realdata-devset-seed-person-upsert-runner.spec.ts` 를 신설하고, 아래 R-112 4 종을 모두 cover 한다.
- [x] **happy path 1+**: mock client 로 2~3 건 args 를 넣어 (a) `person.upsert` 가 args 개수만큼 입력 순서대로 호출되고 (b) 반환 Map 이 `email → id` 로 정확히 맺어지는지 검증. `resolveDevsetSeedUpsertArgs(3)` 산출물을 그대로 넣는 통합 happy 케이스 1+ 포함.
- [x] **error path 1+**: client 결손 (`undefined` · `person` 없음 · `person.upsert` 가 함수 아님) 각각 `TypeError`, upsert 결과가 객체 아님 / `id` 필드 없음 / `id` 가 빈 문자열·공백뿐인 경우 각각 명시적 throw (메시지에 해당 email 포함) 를 검증.
- [x] **분기 cover**: 빈 배열 입력 → 빈 Map 반환 + client 호출 0 회 (throw 0) 분기, 정상 1 건 분기, 다건 분기를 각각 별도 test 로 분리. 각 분기 1+ test.
- [x] **negative cases 충분 cover**: 입력이 배열 아님 → `TypeError`, `personUpsert`/`where`/`email` 구조 결손 → `TypeError`, 같은 email 이 두 번 들어옴 → `RangeError` (map 이 조용히 덮어쓰기 되는 일 차단), client 가 reject 하는 경우 → 그 rejection 을 그대로 전파하고 후속 호출을 하지 않음 (fail-fast), 반환 Map 이 caller mutate 로부터 무공유 — 각 1+ test.
- [x] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- ServiceIdentity leg 실행 (`resolveRealDataPersonId` 치환 + `serviceIdentity.upsert` 호출) — 다음 slice.
- 두 leg 를 합쳐 133 명을 한 번에 적재하는 top-level seed 진입점 / CLI script — 다음 slice.
- `.github/workflows/load-k6.yml` seed step 배선 및 `test/load/s1-batch.js` `setup()` 의 실 dataset 교체.
- 실 DB / 실 `PrismaClient` 를 붙이는 e2e·smoke 실행 (본 slice 는 mock client unit test 로 완결).
- [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 · PLAN `141 행` 진척 doc-sync (direct-mode 별도 slice).
- 기존 `realdata-e2e-seed-*` helper 본문 수정 (읽기·재사용만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음)

## 결과 요약 (2026-08-22 완료)

- PR [#1321](https://github.com/myungjoo/Assessment-Agent/pull/1321) squash 머지 (`26a9e8f9`), reviewer round 1 APPROVE + CI green 으로 4-게이트 충족.
- `test/helpers/realdata-devset-seed-person-upsert-runner.ts` 신설 — public symbol 2 개 (`DevsetSeedPersonClient` 구조적 interface + `upsertDevsetSeedPersons`). 입력 `RealDataUpsertArgs[]` 순서대로 **순차 await** 로 `person.upsert` 호출 (email `@unique` 경합 회피) 하고 `email → person.id` Map 을 회수한다. `args.personUpsert` 는 동일 참조 그대로 client 에 전달 (R-59 유지), `@prisma/client` 값 import 0 · 새 dependency 0.
- colocated spec 26 test 추가 (happy 2 / 분기 3 / error 10 / negative 11) — 전체 448 suite · 12869 test green, `test:cov` line·function 80% threshold 통과.

