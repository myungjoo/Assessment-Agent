---
id: T-1651
title: 133 로그인 fixture → Person + github ServiceIdentity seed descriptor 순수 빌더 신설
phase: P5
status: DONE
commitMode: pr
prNumber: 1319
completedAt: 2026-08-22T16:55:58Z
coversReq: [REQ-047, REQ-023, REQ-024]
estimatedDiff: 280
estimatedFiles: 2
created: 2026-08-23
independentStream: load-r91
dependsOn: [T-1648]
touchesFiles:
  - test/helpers/realdata-devset-seed-descriptors.ts
  - test/helpers/realdata-devset-seed-descriptors.spec.ts
plannerNote: R-91 chain 32/N — seed 실행 경로의 첫 slice: 133 로그인을 seed descriptor 로 옮기는 순수 빌더만 (DB write · 워크플로 배선 0).
---

# T-1651 — 133 로그인 fixture → Person + github ServiceIdentity seed descriptor 순수 빌더 신설

## Why

오너 지시 (PLAN.md `144 행` "R-91 k6 최우선·즉시 착수") 로 진행 중인 부하 테스트 chain 의 32 번째 slice 다. 직전 3 slice (T-1648 fixture + 로더, T-1649 정본 표 ↔ fixture drift guard, T-1650 정본 3 곳 doc-sync) 로 **133 명 실 dataset 의 github login 을 기계 판독 가능한 형태로 읽는 축은 닫혔다**. 남은 잔여는 [`docs/ops/load-resilience-test-plan.md`](../ops/load-resilience-test-plan.md) `§5` item 5 의 **① seed 실행 경로** — 그 133 로그인을 실제 `Person` + github `ServiceIdentity` 행으로 부하 대상 DB 에 넣는 일이다.

그 잔여를 한 번에 하면 (순수 변환 + prisma write runner + 워크플로 step + drift guard) 300 LOC / 5 파일 cap 을 확실히 깬다. 본 slice 는 그중 **DB 도 워크플로도 건드리지 않는 첫 조각** 만 가져간다 — 로그인 배열을 기존 seed descriptor 계약 (`RealDataSeedDescriptor`, T-0573 박제) 으로 옮기는 **순수 함수 2 개 + colocated spec**. 이 계약을 쓰면 다음 slice 는 이미 main 에 있는 `buildRealDataUpsertArgs` (T-0716 박제) 를 그대로 재사용해 prisma upsert args 를 얻을 수 있어, 변환 로직 재구현이 0 이 된다.

## Required Reading

- [`test/helpers/realdata-devset-logins.ts`](../../test/helpers/realdata-devset-logins.ts) — T-1648 로더. `resolveRealdataDevsetLogins(count?)` 가 합집합 앞에서부터 `count` 개 login 을 돌려주고, `count` 범위 위반 시 `RangeError` 를 던진다. 본 task 의 입력 source.
- [`test/helpers/realdata-e2e-seed-fixture.ts`](../../test/helpers/realdata-e2e-seed-fixture.ts) — 재사용할 **타입 계약**: `RealDataSeedDescriptor` / `RealDataPersonSeed` / `RealDataServiceIdentitySeed` 와 `buildRealDataE2eSeed()` 의 descriptor 모양 (`service: "github.com"`, `isPrimary: true`, `active: true`, `email` 은 login 파생 distinct 값).
- [`test/helpers/realdata-e2e-seed-upsert.ts`](../../test/helpers/realdata-e2e-seed-upsert.ts) — 다음 slice 의 소비자. 본 task 의 산출이 이 함수의 입력 (`RealDataSeedDescriptor[]`) 과 그대로 맞아야 한다는 사실만 확인 (본 task 에서 이 파일은 **수정하지 않는다**).
- [`prisma/schema.prisma`](../../prisma/schema.prisma) `55~81 행` (`model Person`) · `257~274 행` (`model ServiceIdentity`) — `email @unique`, `@@unique([personId, service])` 두 제약. descriptor 가 이 제약을 위반할 수 없게 만드는 근거.
- [`test/helpers/realdata-devset-logins-doc-consistency.spec.ts`](../../test/helpers/realdata-devset-logins-doc-consistency.spec.ts) — 직전 slice 의 colocated spec 구성 (describe 분할 · 에러 종류별 단언) 을 본 task spec 의 형태 참고용으로만.

## Acceptance Criteria

- [x] `test/helpers/realdata-devset-seed-descriptors.ts` 신설. public symbol 은 **정확히 2 개**:
  - `buildDevsetSeedDescriptors(logins: string[]): RealDataSeedDescriptor[]` — 순수 함수. login 마다 descriptor 1 개를 만든다: `person = { fullName: <login>, email: "<login>@load.devset.test", active: true }`, `serviceIdentities = [{ service: "github.com", externalId: <login>, isPrimary: true }]`. 입력 순서를 보존하고, 매 호출 **새 객체 트리** 를 반환한다 (caller 가 mutate 해도 다음 호출에 전파 0).
  - `resolveDevsetSeedDescriptors(count?: number): RealDataSeedDescriptor[]` — T-1648 의 `resolveRealdataDevsetLogins(count)` 로 로그인을 얻어 위 빌더에 통과시킨다. 무인자 호출은 133 개 descriptor.
- [x] 타입은 `realdata-e2e-seed-fixture` 에서 **`import type` 으로만** 가져온다 (value import 0 → CommonJS 순환 의존 0). 새 dependency 0 — `node:*` 내장과 기존 helper 재사용만.
- [x] 이메일 도메인은 실 e2e seed (`@e2e.realdata.test`) 와 **다른** `@load.devset.test` 를 쓴다. 한 DB 에 두 seed 가 공존해도 `email @unique` 충돌 0 임을 spec 으로 못 박는다.
- [x] 에러 정책: 구조 결손 (배열 아님 · 원소가 문자열 아님 · github login 형식 위반) 은 `TypeError`, 값 정합 위반 (빈 배열 · 파생 email 중복 = 대소문자 무시 중복 login) 은 `RangeError`. 두 메시지 모두 한국어 사유 + 위반 index / 값 포함 (§12).
- [x] colocated spec `test/helpers/realdata-devset-seed-descriptors.spec.ts` 를 같은 commit 에 추가하고, R-112 4 종을 모두 cover:
  - [x] **happy-path**: public symbol 2 개 각각 1+ — 3 개 로그인 입력의 descriptor shape 전량 검증, 무인자 `resolveDevsetSeedDescriptors()` 가 133 개 · 각 `serviceIdentities` 길이 1 · `isPrimary` 전량 true.
  - [x] **error path**: 사유별 1+ — 배열 아님 (`null` · 객체 · `undefined`), 원소가 문자열 아님, login 형식 위반 (`"has space"` · `"-leading"`), `count` 범위 위반이 T-1648 의 `RangeError` 로 전파.
  - [x] **branch cover**: 분기마다 1+ — 기본값 133 경로 vs 명시 `count` 경로, 정상 매핑 경로 vs 각 throw 분기.
  - [x] **negative cases 충분 cover**: 빈 배열, 대소문자만 다른 중복 로그인 (`"Foo"` + `"foo"` → email 충돌 `RangeError`), 완전 동일 로그인 중복, 반환값 mutate 후 재호출이 오염되지 않음, `count` 0 · 134 · 1.5 · `NaN` 각 1+.
- [x] `pnpm lint && pnpm build && pnpm test` 통과. `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — `src/` 무변경이라 전역 coverage 는 불변이어야 한다.
- [x] `src/` · `prisma/` · `test/load/` · `.github/workflows/` · `package.json` 변경 0 임을 diff 로 확인.

## Out of Scope

- **DB write 실행** — prisma upsert 를 실제로 호출하는 runner / 스크립트. 다음 slice 가 기존 `buildRealDataUpsertArgs` 를 재사용해 처리한다.
- `.github/workflows/load-k6.yml` 에 seed step 추가, `test/load/s1-batch.js` 의 `setup()` 을 실 dataset 으로 교체하는 배선.
- `scripts/daily-test.sh` leg 추가 (drift guard spec 3 개 동반 갱신을 강제해 5 파일 cap 을 깬다 — T-1122 선례).
- 정본 문서 (`docs/ops/realdata-scale-devset.md` · `docs/ops/load-resilience-test-plan.md`) · `docs/PLAN.md` doc-sync — 본 slice 는 코드만, doc-sync 는 별도 direct task.
- `RealDataSeedDescriptor` 계약 자체의 변경, `realdata-e2e-seed-*` 기존 helper 수정, 새 consistency guard 모듈 신설.
- fixture JSON (`test/load/realdata-devset-logins.json`) 의 값 · 순서 변경.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 요약 (2026-08-22)

PR [#1319](https://github.com/myungjoo/Assessment-Agent/pull/1319) squash merge (`4e0697c6`). 신설 2 파일 +300 LOC — `buildDevsetSeedDescriptors` · `resolveDevsetSeedDescriptors` 순수 빌더 2 심볼 + colocated spec 31 test (happy / error / branch / negative 4 종 전량). 타입은 `import type` 전용이라 순환 의존 0, 새 dependency 0. 에러 정책은 구조 결손 = `TypeError` / 값 정합 위반 = `RangeError` 로 분리. reviewer VERDICT=APPROVE (round 1, finding 0), CI green, `src/` 무변경이라 전역 coverage 불변 (line 99.95% / function 100%).
