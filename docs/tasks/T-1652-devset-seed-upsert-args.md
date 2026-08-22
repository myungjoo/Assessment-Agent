---
id: T-1652
title: 133 로그인 seed descriptor → Prisma upsert-args 순수 조립 helper 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-047, REQ-023, REQ-024]
estimatedDiff: 260
estimatedFiles: 2
created: 2026-08-23
independentStream: load-r91
dependsOn: [T-1651]
touchesFiles:
  - test/helpers/realdata-devset-seed-upsert-args.ts
  - test/helpers/realdata-devset-seed-upsert-args.spec.ts
plannerNote: R-91 chain 33/N — seed 실행 경로 2 번째 slice: descriptor → upsert-args 조립만 (변환 재구현 0, DB write · 워크플로 0).
---

# T-1652 — 133 로그인 seed descriptor → Prisma upsert-args 순수 조립 helper 신설

## Why

오너 지시 (PLAN.md `144 행` "R-91 k6 최우선·즉시 착수") 로 진행 중인 부하 테스트 chain 의 33 번째 slice 다. 직전 slice T-1651 (`4e0697c6` / PR #1319) 이 133 로그인을 `RealDataSeedDescriptor[]` 계약으로 옮기는 순수 빌더를 박았고, main 에는 이미 그 계약을 Prisma upsert args 로 바꾸는 `buildRealDataUpsertArgs` (T-0716 박제) 가 있다. 남은 잔여는 [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 의 **① seed 실행 경로** 다.

그 잔여 전체 (조립 + prisma write runner + 워크플로 step + doc-sync) 를 한 task 로 하면 300 LOC / 5 파일 cap 을 확실히 깬다. 본 slice 는 **DB 도 워크플로도 건드리지 않는 두 번째 조각** 만 가져간다 — 133 로그인을 `RealDataUpsertArgs[]` 까지 밀어 올리는 **순수 조립 함수 2 개 + colocated spec**. 변환 로직은 T-1651 빌더와 T-0716 매퍼를 **호출만** 하므로 재구현이 0 이고, 산출물은 다음 slice 의 runner 가 `resolveRealDataPersonId` (T-0575) 로 personId placeholder 만 치환하면 바로 `prisma.upsert` 에 넣을 수 있는 형태가 된다.

## Required Reading

- [`test/helpers/realdata-devset-seed-descriptors.ts`](../../test/helpers/realdata-devset-seed-descriptors.ts) — T-1651 산출. `buildDevsetSeedDescriptors(logins)` / `resolveDevsetSeedDescriptors(count?)` 두 심볼과 descriptor 불변식 (`email = "<login>@load.devset.test"`, `service: "github.com"`, `isPrimary: true`, `active: true`). 본 task 의 입력 source.
- [`test/helpers/realdata-e2e-seed-upsert.ts`](../../test/helpers/realdata-e2e-seed-upsert.ts) — 재사용할 매퍼 `buildRealDataUpsertArgs(descriptors)` 와 산출 타입 `RealDataUpsertArgs` / `PersonUpsertArgs` / `ServiceIdentityUpsertArgs`, 그리고 `PERSON_ID_PLACEHOLDER` 의 의미 (personId 는 런타임 치환 대상). 본 task 에서 이 파일은 **수정하지 않는다**.
- [`test/helpers/realdata-devset-logins.ts`](../../test/helpers/realdata-devset-logins.ts) — `resolveRealdataDevsetLogins(count?)` 의 기본값 (133) 과 `count` 범위 위반 시 `RangeError` 정책. 본 task 는 이 에러를 **전파만** 한다.
- [`test/helpers/realdata-e2e-seed-resolve-person-id.ts`](../../test/helpers/realdata-e2e-seed-resolve-person-id.ts) — 다음 slice 의 소비자. 본 task 산출이 `resolveRealDataPersonId` 의 입력 (`RealDataUpsertArgs[]`) 과 그대로 맞는다는 사실 확인용 (수정 금지).
- [`test/helpers/realdata-devset-seed-descriptors.spec.ts`](../../test/helpers/realdata-devset-seed-descriptors.spec.ts) — 직전 slice colocated spec 의 describe 분할 · 에러 종류별 단언 형태 참고용.

## Acceptance Criteria

- [ ] `test/helpers/realdata-devset-seed-upsert-args.ts` 신설. public symbol 은 **정확히 2 개**:
  - `buildDevsetSeedUpsertArgs(logins: string[]): RealDataUpsertArgs[]` — 순수 함수. 내부적으로 `buildDevsetSeedDescriptors(logins)` → `buildRealDataUpsertArgs(descriptors)` 를 **호출만** 한다 (upsert args 조립 로직 재구현 0). 입력 순서를 보존하고 매 호출 새 객체 트리를 반환한다.
  - `resolveDevsetSeedUpsertArgs(count?: number): RealDataUpsertArgs[]` — `resolveDevsetSeedDescriptors(count)` 를 거쳐 같은 매퍼에 통과시킨다. 무인자 호출은 133 개 args.
- [ ] `RealDataUpsertArgs` 등 타입은 `import type` 으로만 가져오고, 값 import 는 재사용 대상 함수 (`buildDevsetSeedDescriptors` · `resolveDevsetSeedDescriptors` · `buildRealDataUpsertArgs`) 로 한정한다. 새 dependency 0, 새 타입 정의 0, 순환 의존 0.
- [ ] 에러 정책은 **재정의하지 않는다** — 구조 결손 `TypeError` / 값 정합 위반 `RangeError` 를 T-1651 · T-1648 에서 그대로 전파한다. 본 모듈이 새 throw 를 추가하면 안 된다.
- [ ] colocated spec `test/helpers/realdata-devset-seed-upsert-args.spec.ts` 를 같은 commit 에 추가하고, R-112 4 종을 모두 cover:
  - [ ] **happy-path**: public symbol 2 개 각각 1+ — 로그인 3 개 입력의 args 트리 전량 검증 (`personUpsert.where.email` · `create {fullName,email,active}` · `update {fullName,active}` · `identityUpsertsByEmail` 길이 1 · `where.personId_service` = `{ personId: PERSON_ID_PLACEHOLDER, service: "github.com" }` · `create {service,externalId,isPrimary}` · `update {isPrimary}`), 무인자 `resolveDevsetSeedUpsertArgs()` 가 133 개 · email 133 개 전량 distinct · 입력 로그인 순서 보존.
  - [ ] **error path**: 사유별 1+ — 배열 아님 (`null` · 객체), 원소가 문자열 아님, github login 형식 위반이 `TypeError` 로 전파되고, 빈 배열 · 파생 email 중복 (`"Foo"` + `"foo"`) 이 `RangeError` 로 전파.
  - [ ] **branch cover**: 분기마다 1+ — `count` 무인자 (133) 경로 vs 명시 `count` 경로, 정상 조립 경로 vs 각 throw 전파 경로.
  - [ ] **negative cases 충분 cover**: `count` 0 · 134 · 1.5 · `NaN` 각 1+ (`RangeError` 전파), 반환 args 트리를 mutate 한 뒤 재호출해도 오염 0, 동일 로그인 완전 중복, 도메인이 실 e2e seed (`@e2e.realdata.test`) 와 달라 한 DB 공존 시 `email @unique` 충돌 0.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `src/` 무변경이라 전역 coverage 는 불변이어야 한다.
- [ ] `src/` · `prisma/` · `test/load/` · `.github/workflows/` · `package.json` · 기존 helper 파일 변경 0 임을 diff 로 확인 (신설 2 파일만).

## Out of Scope

- **DB write 실행** — `prisma.person.upsert` / `prisma.serviceIdentity.upsert` 를 실제 호출하는 runner · 스크립트. 다음 slice 가 `resolveRealDataPersonId` (T-0575) 와 함께 처리한다.
- personId placeholder 치환 로직 신설 — 이미 main 에 있는 `resolveRealDataPersonId` 를 다음 slice 에서 재사용한다 (본 slice 에서 호출도 하지 않는다).
- `.github/workflows/load-k6.yml` seed step 배선, `test/load/s1-batch.js` `setup()` 의 실 dataset 교체.
- `scripts/daily-test.sh` leg 추가 — drift guard spec 3 종 동반 갱신을 강제해 5 파일 cap 을 깬다 (T-1122 BLOCKED 선례).
- 정본 문서 (`docs/ops/realdata-scale-devset.md` · `docs/ops/load-resilience-test-plan.md`) · `docs/PLAN.md` doc-sync — 별도 direct task.
- 새 consistency guard 모듈 신설, 기존 `realdata-e2e-seed-*` · `realdata-devset-*` helper 수정, fixture JSON 값 · 순서 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
