---
id: T-1654
title: 133 로그인 upsert-args 의 ServiceIdentity leg 실행 runner (client 주입형) 신설
phase: P5
status: DONE
commitMode: pr
prNumber: 1322
coversReq: [REQ-047, REQ-023, REQ-024]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-08-22
completedAt: 2026-08-22T23:15:46Z
independentStream: load-r91
dependsOn: [T-1653]
touchesFiles:
  - test/helpers/realdata-devset-seed-identity-upsert-runner.ts
  - test/helpers/realdata-devset-seed-identity-upsert-runner.spec.ts
plannerNote: R-91 chain 35/N — seed 실행 경로 4 번째 slice: ServiceIdentity leg 실행 + placeholder 미치환 차단만 (진입점 · 워크플로 0).
---

# T-1654 — 133 로그인 upsert-args 의 ServiceIdentity leg 실행 runner (client 주입형) 신설

## Why

오너 지시 (PLAN.md `144 행` "R-91 k6 최우선·즉시 착수") chain 의 35 번째 slice 다. 직전 slice T-1653 (`26a9e8f9` / PR #1321) 이 `RealDataUpsertArgs[]` 의 **Person leg** 를 주입 client 로 실행하고 `email → person.id` map 을 회수하는 runner 를 박았다. 그 map 을 main 의 `resolveRealDataPersonId` (T-0575) 에 넣으면 identity args 의 `PERSON_ID_PLACEHOLDER` 가 실 person.id 로 치환되므로, 남은 잔여는 **치환된 identity args 를 실제로 upsert 하는 두 번째 leg** 다 ([`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 의 ① seed 실행 경로).

본 slice 는 그 **ServiceIdentity leg 하나만** 가져간다 — 주입된 구조적 client 로 `serviceIdentity.upsert` 를 순차 호출하고, `PERSON_ID_PLACEHOLDER` 가 남아 있는(= T-0575 치환을 건너뛴) 입력을 첫 write 이전에 차단한다. 두 leg 를 묶는 top-level 진입점 · 워크플로 step 배선은 다음 slice 로 남겨 300 LOC / 5 파일 cap 을 지킨다 (T-1122 leg-추가 BLOCKED 선례 회피).

## Required Reading

- [`test/helpers/realdata-devset-seed-person-upsert-runner.ts`](../../test/helpers/realdata-devset-seed-person-upsert-runner.ts) — 직전 slice 의 Person leg runner. 본 task 는 그 **구조·에러 정책·주석 밀도를 mirror** 한다 (구조 결손 `TypeError` / 값 정합 위반 `RangeError`, 순차 await, 검증 선행).
- [`test/helpers/realdata-devset-seed-person-upsert-runner.spec.ts`](../../test/helpers/realdata-devset-seed-person-upsert-runner.spec.ts) — colocated spec 의 서술 형식과 mock client 패턴 선례.
- [`test/helpers/realdata-e2e-seed-upsert.ts`](../../test/helpers/realdata-e2e-seed-upsert.ts) — `ServiceIdentityUpsertArgs` · `RealDataUpsertArgs` · `PERSON_ID_PLACEHOLDER` 정의 (`40~72 행` 부근).
- [`test/helpers/realdata-e2e-seed-resolve-person-id.ts`](../../test/helpers/realdata-e2e-seed-resolve-person-id.ts) — `resolveRealDataPersonId` 의 치환 계약 (본 runner 의 **입력 전제**: 이미 치환된 args 를 받는다).
- [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 — seed 실행 경로 잔여 항목.

## Acceptance Criteria

- [ ] `test/helpers/realdata-devset-seed-identity-upsert-runner.ts` 신설. public symbol 은 정확히 2 개:
  - `DevsetSeedIdentityClient` — 최소 구조적 client interface (`serviceIdentity.upsert(args: ServiceIdentityUpsertArgs): Promise<{ id: string }>`). 실 `PrismaClient` 가 상위집합이 되도록 구조적 타입만 요구한다.
  - `upsertDevsetSeedServiceIdentities(client, resolvedUpsertArgsList): Promise<Map<string, string>>` — 입력 순서대로 각 `RealDataUpsertArgs.identityUpsertsByEmail` 을 평탄화해 **순차 await** 하고, `` `${personId}::${service}` `` compound 키 → 생성/갱신된 identity `id` map 을 회수한다.
- [ ] 순차 실행 강제 — `Promise.all` 사용 0. 근거 주석 1 줄 (`@@unique([personId, service])` write 경합 회피 + 호출 순서 결정론).
- [ ] **placeholder 미치환 차단** — identity args 의 `where.personId_service.personId` 가 `PERSON_ID_PLACEHOLDER` 와 같으면 `RangeError` 로 첫 upsert **이전에** throw (T-0575 치환 단계를 건너뛴 입력이 DB 로 새는 경로 차단). 메시지에 해당 email 또는 index 포함.
- [ ] compound 키 중복 (같은 `(personId, service)` 쌍이 2 회 등장) 은 `RangeError`. map 이 조용히 덮어써 적재 건수가 줄어드는 결손 차단.
- [ ] `args` 무변형 (R-59) — `identityUpsertsByEmail` 의 각 원소를 **동일 참조 그대로** client 에 전달하고 새 필드를 만들지 않는다. raw 활동 데이터 0.
- [ ] `@prisma/client` **값 import 0** (타입은 자체 interface), 새 dependency 0, env 읽기 0, 실 DB/네트워크 접속 0. unit spec 은 mock client 로만 검증.
- [ ] colocated spec `test/helpers/realdata-devset-seed-identity-upsert-runner.spec.ts` 신설. R-112 4 종 전량 cover:
  - **happy-path** — 133 형태의 다건 입력에서 (a) 호출 횟수 = identity 총 개수, (b) 호출 인자가 입력과 동일 참조, (c) 호출 순서가 입력 순서와 일치, (d) 반환 map 의 키/값 정합. public symbol 2 개 모두 1+ test.
  - **error path** — client rejection 이 그대로 전파되고 후속 원소가 호출되지 않는 fail-fast, upsert 결과에 `id` 결손/빈 값일 때 명시 throw.
  - **분기 cover** — 빈 배열 입력 (client 호출 0 · 빈 Map · throw 0), `identityUpsertsByEmail` 이 빈 Person (건너뜀), identity 2+ 를 가진 Person, 검증 실패 시 upsert 호출 0 회 (부분 적재 0) 각각 1+ test.
  - **negative cases 충분 cover** — client `undefined`/`null`, `serviceIdentity` 결손, `upsert` 비-함수, 입력이 배열 아님, 원소 비-객체, `identityUpsertsByEmail` 비-배열, `where.personId_service` 결손, `personId` 빈/공백, `service` 빈/비문자열, placeholder 잔존, compound 키 중복 — **각 1+ test** 로 에러 타입 (`TypeError` / `RangeError` / `Error`) 과 메시지 키워드까지 단언.
- [ ] `pnpm lint && pnpm build && pnpm test` 전량 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- 두 leg (Person + ServiceIdentity) 를 묶고 `resolveRealDataPersonId` 를 호출하는 **top-level seed 진입점** — 다음 slice.
- `.github/workflows/load-k6.yml` 의 seed step 배선, `test/load/s1-batch.js` `setup()` 의 실 dataset 교체.
- `scripts/daily-test.sh` leg 추가 (drift-guard smoke spec 3 개 동반 갱신이 필요해 파일 cap 초과 — T-1122 선례).
- 실 `PrismaClient` 인스턴스화 · 실 DB 접속 · 마이그레이션 · e2e/smoke spec 신설.
- `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` 등 문서 갱신 (별도 direct doc-sync slice).
- 기존 `realdata-e2e-seed-upsert.ts` · `realdata-e2e-seed-resolve-person-id.ts` 본문 수정 (읽기 전용 재사용).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
