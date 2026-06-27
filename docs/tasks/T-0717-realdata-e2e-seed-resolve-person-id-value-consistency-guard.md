---
id: T-0717
title: realdata-e2e seed-resolve-person-id 치환 결과 ↔ (입력 args · email→id map) single-source 재유도 정합 가드 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-058, REQ-059, REQ-024]
estimatedDiff: 270
estimatedFiles: 2
created: 2026-06-27
plannerNote: "P5 build-time consistency sweep — resolveRealDataPersonId 의 placeholder→실 person.id 치환을 입력 args·map 만으로 독립 재유도하는 값-정합 가드 신설(NO-GUARD leaf 신규 stream, T-0715 mirror)"
independentStream: realdata-e2e-seed-resolve-person-id-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-seed-resolve-person-id-consistency.ts
  - test/helpers/realdata-e2e-seed-resolve-person-id-consistency.spec.ts
---

# T-0717 — realdata-e2e seed-resolve-person-id 치환 결과 ↔ (입력 args · email→id map) single-source 재유도 정합 가드 신설

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ① seed 입력 계약 surface 의 build-time consistency-guard sweep 의 일환이다. NO-GUARD leaf 컴포저 `resolveRealDataPersonId`(T-0575, `test/helpers/realdata-e2e-seed-resolve-person-id.ts`)는 `buildRealDataUpsertArgs` 산출 `RealDataUpsertArgs[]` 의 ServiceIdentity upsert where 에 박힌 `PERSON_ID_PLACEHOLDER` 를 `email → 실 person.id` map 으로 치환한 **새 객체 트리**를 반환하는 순수 매퍼다. issue-still-relevant 확인: origin/main(57d76485) 의 `*-seed-resolve-person-id-consistency.ts` 파일·`assertRealData*PersonId*Consistent` 심볼은 **grep 0 부재** — 치환된 `identityUpsertsByEmail[*].where.personId_service.personId` 가 정확히 그 Person 의 email 로 map 에서 조회한 실 person.id 인지, 그리고 personUpsert / service / create / update 슬롯이 입력 args 그대로 보존됐는지를 검증하는 값-정합 가드층이 전혀 없다.

T-0715(seed-upsert) 의 seed-side mirror 로, 입력 `RealDataUpsertArgs[]` 와 `email→id` map 만으로 expected 치환 결과 트리를 **컴포저(`resolveRealDataPersonId`) 재호출 없이** 독립 재유도해 deep-equal 대조하는 가드를 신설한다. 매퍼의 치환 로직(어느 슬롯이 바뀌고 어느 슬롯이 보존되는지, email→id 조회 규칙)이 잘못 바뀌어도 재호출 산출이 같은 잘못된 값을 내어 상쇄 통과하는 gap 을 닫는다. REQ-058(재수집 중복 방지: idempotent upsert 의 실 compound-unique key 정합) + REQ-059(raw 미보유: 치환은 personId 만, 새 raw 필드 추가 0) + REQ-024(1 Person 당 1 primary identity invariant: 동일 email → 동일 person.id 공유로 compound-unique 정합) 의 build-time 가드층을 보강한다. T-0715 Follow-up 이 본 컴포저를 잔여 seed-side NO-GUARD leaf 로 명시 식별한 직후의 후속 task 다.

## Required Reading

- `test/helpers/realdata-e2e-seed-resolve-person-id.ts` — 가드 대상 leaf 매퍼 `resolveRealDataPersonId(upsertArgsList, emailToPersonId)`. 치환 규칙: 각 `args.personUpsert.where.email` 로 map(`ReadonlyMap | Record`)에서 person.id 조회 → 그 Person 의 모든 `identityUpsertsByEmail[*].where.personId_service.personId` 를 실값으로 교체한 **새 트리** 반환. `personUpsert`(where/create/update)·identity 의 `service`/`create`/`update` 는 그대로 보존(깊은 복사, 입력 mutate 0). email 키 미존재 → throw, 빈/공백 값 → throw. 빈 입력 배열 → 빈 배열. `PersonIdMap` union(ReadonlyMap | Record) 조회 규칙(own-property 만 인정)도 본 가드가 미러링해야 한다.
- `test/helpers/realdata-e2e-seed-upsert.ts` — `RealDataUpsertArgs` / `ServiceIdentityUpsertArgs` 타입 single source + `PERSON_ID_PLACEHOLDER` 상수. 가드는 입력 args 가 치환 전 placeholder 였음을 전제로 expected 트리를 재유도한다(입력 args 의 placeholder → map 조회값 치환).
- `test/helpers/realdata-e2e-seed-fixture.ts` — `RealDataSeedDescriptor` 등 happy-path 합성용 타입. happy-path fixture 는 `buildRealDataUpsertArgs(buildRealDataE2eSeed())` 출력 + 두 email 에 대한 person.id map 으로 구성한다.
- `test/helpers/realdata-e2e-seed-upsert-consistency.ts` 와 그 colocated spec — **mirror 선례**(T-0715). 컴포저 재호출 없이 입력만으로 독립 재유도 → deep-equal 대조, 구조결손 TypeError↔값정합 RangeError 분리 패턴을 그대로 따른다.
- `test/helpers/realdata-e2e-seed-resolve-person-id.spec.ts` — 기존 컴포저 spec(치환 정상/throw 경계 케이스 참고). 본 task 의 신규 spec 은 가드 colocated spec(`*-consistency.spec.ts`) 로 별도 신설하며 이 파일은 수정하지 않는다.

## Acceptance Criteria

신규 파일 `test/helpers/realdata-e2e-seed-resolve-person-id-consistency.ts` 에 순수 함수 가드 `assertRealDataResolvePersonIdConsistentWithInputs(resolved: RealDataUpsertArgs[], upsertArgsList: RealDataUpsertArgs[], emailToPersonId: PersonIdMap): void` (또는 동등한 명명) 를 신설하고, colocated spec `test/helpers/realdata-e2e-seed-resolve-person-id-consistency.spec.ts` 를 작성한다.

- [ ] 가드는 `resolveRealDataPersonId` 를 **재호출하지 않고** 입력 `upsertArgsList` + `emailToPersonId` map 만으로 expected 치환 결과 트리를 독립 재유도(각 args 의 `personUpsert.where.email` 로 map own-property/`ReadonlyMap.get` 조회 → 그 person.id 를 모든 identity 의 `where.personId_service.personId` 에 치환, 나머지 슬롯은 입력 그대로 보존)한 뒤, 실제 `resolved` 와 **deep-equal** 대조한다. 정합이면 void(무회귀·입력 비변형), 불일치면 `RangeError`(값 정합 위반).
- [ ] 가드는 map 의 union 형태(`ReadonlyMap<string,string> | Record<string,string>`)를 컴포저와 동일 규칙으로 조회한다 — `ReadonlyMap` 은 `.get`, `Record` 는 own-property(`Object.prototype.hasOwnProperty.call`)만 인정. 두 map 형태 각각에 대해 happy-path test 를 둔다(분기 cover).
- [ ] 구조 결손(`resolved`/`upsertArgsList` 가 배열 아님·null/undefined, 두 배열 길이 불일치, 각 원소가 객체 아님·null, `personUpsert` 또는 `identityUpsertsByEmail` 누락, 하위 `where`/`create`/`update` 또는 `personId_service` 슬롯 부재, `emailToPersonId` 가 null/undefined/지원 형태 아님)은 `TypeError` 로 분리해 던진다(값정합 `RangeError` 와 구분).
- [ ] **Happy-path test 1+** — `buildRealDataUpsertArgs(buildRealDataE2eSeed())` 출력 + 두 email(myungjoo/leemgs)에 대한 실 person.id map 으로 `resolveRealDataPersonId` 를 호출해 얻은 `resolved` 에 대해 가드가 throw 0 으로 통과(Map 형태 1 + Record 형태 1). 추가로 (a) 빈 배열 쌍(`[], []` + 빈 map), (b) identity 가 0 개 / 1 개 / N 개 인 합성 args 케이스 각 1+(내층 map 분기 cover).
- [ ] **호출 격리 검증 test 1+** — 가드가 `resolveRealDataPersonId` 를 내부에서 재호출하지 않음을 jest spy/mock 으로 증명(컴포저 모듈을 mock 한 뒤 가드 호출 → 컴포저 mock 이 0 회 호출됐음을 단언). re-호출 의존 시 양방향 drift 상쇄 gap 이 다시 열리므로 본 분리 검증이 가드 가치의 핵심.
- [ ] **Error path / negative cases 충분 cover** — 각 예외 분기마다 1+ test:
  - ① 치환된 `personId` drift(`resolved` 의 identity personId 가 그 Person email 로 map 에서 조회한 실값과 불일치) → RangeError,
  - ② 치환 누락(`resolved` 의 identity personId 가 여전히 `PERSON_ID_PLACEHOLDER` 인데 map 에는 실값이 있음) → RangeError,
  - ③ `service` 슬롯 보존 위반(`resolved` 의 `where.personId_service.service` 가 입력과 불일치) → RangeError,
  - ④ `personUpsert` 슬롯 보존 위반(where.email/create/update 중 하나가 입력과 불일치) → RangeError,
  - ⑤ identity `create`/`update` 슬롯 보존 위반(입력 그대로여야 하는데 값 drift) → RangeError,
  - ⑥ identity 순서/개수 drift(`resolved` 의 identity 순서·개수가 입력과 어긋남) → RangeError,
  - ⑦ `resolved` 길이 ↔ `upsertArgsList` 길이 불일치 → TypeError,
  - ⑧ `resolved`/`upsertArgsList` 가 null/undefined/비배열 → TypeError,
  - ⑨ 각 원소가 객체 아님 / `personUpsert` · `identityUpsertsByEmail` 슬롯 누락 / 하위 `where`/`personId_service`/`create`/`update` 키 부재 → TypeError,
  - ⑩ `emailToPersonId` 가 null/undefined/지원 형태(ReadonlyMap|Record) 아님 → TypeError,
  - ⑪ 입력 args 의 email 이 map 에 없거나 빈/공백 값 → 가드가 재유도 단계에서 명확히 throw(컴포저 throw 규칙과 동형; TypeError 또는 전용 에러 — 단일 negative 금지, 누락·빈값 각 1+).
  (단일 negative 금지 — 예외 분기마다 각 1+. 슬롯 보존 위반과 구조 결손은 RangeError↔TypeError 로 분리.)
- [ ] **Flow / branch coverage** — TypeError 분기와 RangeError 분기, 재유도 순회(outer `upsertArgsList.map` + inner `identityUpsertsByEmail.map`) 각 분기, map union 두 arm(Map·Record) 각각을 test 로 cover. 빈 배열(외층/내층 각각) 경계도 1+ cover.
- [ ] 가드가 입력 `resolved`·`upsertArgsList`(하위 personUpsert · identity · where/create/update 객체 포함)·`emailToPersonId` 를 비변형(읽기 전용)함을 검증하는 test 1+(호출 전후 deep-equal + 참조 동등성 검증).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 신규 가드 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), 가능하면 100%.
- [ ] 전체 unit suite green(기존 test·`realdata-e2e-seed-resolve-person-id.spec.ts` 무회귀).

## Out of Scope

- 컴포저 `realdata-e2e-seed-resolve-person-id.ts` 의 self-wire 배선(반환 직전 본 신규 가드 self-assert 삽입)은 **본 task 에서 하지 않는다** — 후속 짝 task(T-0715→T-0716 패턴)로 분리. 본 task 는 가드 신설만.
- `resolveRealDataPersonId` 매퍼 본문·치환 로직·throw 규칙 변경 금지(가드는 읽기만).
- `buildRealDataUpsertArgs` / `RealDataUpsertArgs` 타입 / `PERSON_ID_PLACEHOLDER` 상수 / `PersonIdMap` 타입 수정·재정의 금지(import 재사용만).
- 다른 seed-side NO-GUARD leaf(`buildRealDataE2eSeed` — 무인자 결정론 상수 빌더, 값-정합보다 결정성·shape 가드가 적합한지 case-by-case) 는 별도 task.
- `src/` 변경 0(test-only). prisma `schema.prisma` 변경 0(가드는 schema 를 직접 읽지 않음 — 매퍼 치환 규칙 미러링만).

## Suggested Sub-agents

`implementer → tester` (test-only 가드 신설 — 아키텍처 결정 없음, T-0715 mirror 라 architect 불요).

## Follow-ups

- (예정) seed-resolve-person-id 컴포저 self-wire 짝 — `resolveRealDataPersonId` 반환 직전 본 신규 가드 self-assert + import(T-0716 self-wire mirror). 가드가 컴포저의 `RealDataUpsertArgs`/`PersonIdMap` 타입을 type-only import 하면 순환 의존 없이 top-level import 가능한지(T-0710/T-0714 type-only mirror), 아니면 lazy require(T-0712 mirror) 필요한지 self-wire task 에서 import 그래프 확인 필요.
- 잔여 seed-side NO-GUARD leaf 후보: `buildRealDataE2eSeed`(T-0573 — 무인자 결정론 상수 빌더). 값-정합 가드(입력 없음 → 재유도 surface 빈약)보다는 결정성(매 호출 새 트리·동일 shape)·invariant(email distinct · github.com 1 primary) 가드가 적합한지 case-by-case 판정 후 별도 task.

## Result (DONE)

- 완료: 2026-06-27 (cron@aa-anthropic-69e656d2 fire).
- PR #633 squash-merge `b37941ff`. reviewer round1 APPROVE finding 0, 4-게이트 PASS, CI green.
- `assertRealDataResolvePersonIdConsistentWithInputs` 순수 가드 신설 — 입력 `RealDataUpsertArgs[]` + `email→id` map 만으로 치환 트리(컴포저 재호출 0) 독립 재유도 후 deep-equal, 구조결손 TypeError ↔ 값정합 RangeError 분리, map union(ReadonlyMap·Record) 조회 규칙 미러링, 입력 비변형.
- test-only +1037/-0 2 파일(가드 + colocated spec). 신규 가드 line/branch/func/stmt 100%. 전체 unit 350 suite/8737 test green.
- Follow-up: T-0718 (컴포저 self-wire 짝, type-only import top-level — T-0714 mirror).
