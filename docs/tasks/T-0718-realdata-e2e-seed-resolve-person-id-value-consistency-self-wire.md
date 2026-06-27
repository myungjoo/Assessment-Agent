---
id: T-0718
title: realdata-e2e seed-resolve-person-id 값-정합 가드 컴포저 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-058, REQ-059, REQ-024]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-06-27
plannerNote: "P5 consistency sweep — assertRealDataResolvePersonIdConsistentWithInputs 를 resolveRealDataPersonId 단일 return 직전 self-assert 배선(T-0717 가드 짝 닫기, 가드가 컴포저 type-only import 라 top-level import 순환 0 — T-0714 mirror)"
independentStream: realdata-e2e-seed-resolve-person-id-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-seed-resolve-person-id.ts
  - test/helpers/realdata-e2e-seed-resolve-person-id.spec.ts
  - test/helpers/realdata-e2e-seed-resolve-person-id-consistency.spec.ts
---

# T-0718 — realdata-e2e seed-resolve-person-id 값-정합 가드 컴포저 self-wire 배선

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ①(seed 입력 계약 surface) 의 build-time consistency-guard sweep 일환으로, T-0717 이 신설한 값-정합 가드 `assertRealDataResolvePersonIdConsistentWithInputs`(`test/helpers/realdata-e2e-seed-resolve-person-id-consistency.ts`)는 현재 **컴포저에서 호출되지 않는다**(self-wire 미배선). 가드가 존재하지만 `resolveRealDataPersonId` 의 실 치환 경로(placeholder `personId` → email→id map 으로 조회한 실 person.id 치환, personUpsert/service/create/update 슬롯 보존)에 self-assert 로 묶이지 않아, 매퍼의 치환 로직이 잘못 바뀌면 가드를 따로 호출하지 않는 한 build-time 에 잡히지 않는 gap 이 남는다.

issue-still-relevant 확인(origin/main b37941ff): (1) 가드 심볼 `assertRealDataResolvePersonIdConsistentWithInputs` 가 consistency.ts line 263 에 존재(T-0717 머지 확인). (2) 컴포저 `test/helpers/realdata-e2e-seed-resolve-person-id.ts` 본문에 가드 self-assert 호출이 **grep 0 부재** — self-wire 가 진짜로 안 됐음을 확인. (3) 가드 모듈 import 그래프 확인: 가드는 컴포저로부터 `import type { PersonIdMap }`(consistency.ts line 54) **타입만** import 한다 — value import 0. 따라서 컴포저가 가드를 **top-level import** 해도 type-only edge 는 컴파일 시 소거되어 CommonJS 순환 의존이 생기지 않는다. 즉 **T-0710/T-0714 mirror(top-level import)** 가 예상 경로이며 T-0716 의 lazy require 는 불요다.

T-0713→T-0714 / T-0715→T-0716 패턴의 seed-side mirror 로, `resolveRealDataPersonId` 단일 return 직전에 본 가드를 self-assert 로 배선해 치환 결과 값 drift 를 컴포저 호출 경로 자체에서 fail-fast 차단한다. REQ-058(재수집 중복 방지: idempotent upsert 의 실 compound-unique key 정합) + REQ-059(seed 가 raw 미보유: 치환은 personId 만) + REQ-024(1 Person 당 1 primary identity invariant) 의 build-time 가드층을 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-seed-resolve-person-id.ts` — self-wire 대상 leaf 컴포저 `resolveRealDataPersonId(upsertArgsList, emailToPersonId)`. 현재 단일 return(`return upsertArgsList.map((args) => { ... })`). 그 결과를 `const resolved = upsertArgsList.map(...)` 로 묶고, return 직전에 가드 self-assert 후 `resolved` 를 그대로 return 하도록 배선한다. 치환 결과 트리 구조·byte 변경 금지. 주의: 내부 `.map` 은 email 매핑 누락/빈값 시 `throw new Error(...)` 한다 — 그 throw 는 mapping 단계에서 발생하므로 가드 self-assert 는 호출되지 않는다(분기 순서 보장 — negative test 대상).
- `test/helpers/realdata-e2e-seed-resolve-person-id-consistency.ts` — self-wire 할 가드 `assertRealDataResolvePersonIdConsistentWithInputs(resolved, upsertArgsList, emailToPersonId)`(line 263). **import 그래프 확인 의무**: 본 가드 모듈은 line 54–55 에서 컴포저(`./realdata-e2e-seed-resolve-person-id`)로부터 `import type { PersonIdMap }`(타입만) + `./realdata-e2e-seed-upsert` 로부터 `import type { RealDataUpsertArgs }`(타입만) 를 import 한다 → value import 0. 따라서 컴포저가 가드를 **top-level import** 해도 type-only edge 는 소거되어 순환 의존이 없다. **top-level import**(T-0714 mirror) 채택. implementer 가 import 그래프 재확인 후 top-level import 채택하되, 만약 예상과 달리 value 순환 edge 가 발견되면 lazy require(T-0716 mirror) 로 전환하고 그 사유를 trail notes 에 1 줄 박제.
- `test/helpers/realdata-e2e-seed-upsert.ts` — 직전 seed-side self-wire 선례(T-0716, lazy require — value-import 순환 회피) 와의 **대조**. 본 task 는 type-only import 라 top-level 채택 — 두 선례 차이를 import 그래프로 판정.
- `test/helpers/realdata-e2e-result-summary-markdown.ts`(T-0714, top-level import 선례) — 본 task 와 동형(가드가 컴포저를 미import 또는 type-only import → 순환 0 → top-level). self-wire 배선 형태 참고.
- `test/helpers/realdata-e2e-seed-resolve-person-id-consistency.spec.ts` — T-0717 가드 spec(무회귀 대상). self-wire 호출 배선 검증 test 는 컴포저 spec(`realdata-e2e-seed-resolve-person-id.spec.ts`)에 추가하는 것이 colocated 정합(가드 자체 단위 test 는 consistency.spec 유지).

## Acceptance Criteria

`test/helpers/realdata-e2e-seed-resolve-person-id.ts` 의 `resolveRealDataPersonId` 단일 return 직전에 `assertRealDataResolvePersonIdConsistentWithInputs` 를 self-assert 로 배선한다(import 1 줄 + self-assert 1 줄, 가드 본체·치환 결과 트리 출력 byte 무변경).

- [ ] 컴포저는 최종 치환 결과를 `const resolved = upsertArgsList.map((args) => { ... })` 로 묶은 뒤, return 직전 `assertRealDataResolvePersonIdConsistentWithInputs(resolved, upsertArgsList, emailToPersonId)` 를 호출하고 `resolved` 를 그대로 return 한다. 치환 결과 트리 출력 byte·구조 무변경(기존 happy-path test 무회귀).
- [ ] import 는 **top-level import**(가드가 컴포저로부터 type-only import 만 → 순환 의존 0, T-0714 mirror) 채택. 만약 import 그래프 재확인에서 value 순환 edge 가 발견되면 lazy `require`(T-0716 mirror) 로 전환하고 그 사유를 trail notes 에 1 줄 박제.
- [ ] **Happy-path test 1+**(`realdata-e2e-seed-resolve-person-id.spec.ts`) — 컴포저가 정상 `upsertArgsList` + email→id map(Map 형태 1 + Record 형태 1)에 대해 가드 self-assert 통과 후 정상 치환 결과 트리를 return 함을 검증(기존 산출과 deep-equal, 무회귀). 빈 입력 배열 → 빈 배열 반환(throw 0) 경계도 cover.
- [ ] **호출 배선 검증 test 1+** — `resolveRealDataPersonId` 호출 시 `assertRealDataResolvePersonIdConsistentWithInputs` 가 실제 호출됨을 spy/mock 으로 검증(self-wire 배선 자체가 dead 가 아님을 증명 — jest.spyOn 또는 module mock 으로 호출 확인 + 인자가 `(resolved, upsertArgsList, emailToPersonId)` 임을 단언).
- [ ] **Error path / negative cases 충분 cover** — 각 예외 분기마다 1+ test:
  - ① 가드가 RangeError 를 throw 하는 시나리오(가드 spy 가 RangeError throw, 또는 치환 결과 슬롯 값을 의도적으로 깨는 mock)에서 그 throw 가 컴포저 밖으로 **전파**됨을 검증.
  - ② 가드가 TypeError 를 throw 하는 구조 결손 시나리오에서 그 throw 가 컴포저 밖으로 전파됨을 검증.
  - ③ 컴포저 매핑 단계가 먼저 throw 하는 경우(email 매핑 누락 / 빈·공백 person.id) **값-정합 가드가 호출되지 않음** negative 검증 — 분기 순서 보장(mapping throw → 가드 self-assert 도달 전). 누락·빈값 각 1+(단일 negative 금지).
  (단일 negative 금지 — 예외 전파 분기 각 1+, mapping 선throw 분기 각 1+.)
- [ ] **Flow / branch coverage** — self-assert 통과 경로(정상 return)와 self-assert throw 전파 경로, 그리고 mapping 선throw 로 가드 미호출 경로 각 분기를 test 로 cover.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 컴포저 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), 가능하면 100%.
- [ ] 전체 unit suite green(기존 test·T-0717 가드 spec 무회귀).

## Out of Scope

- T-0717 가드 본체(`realdata-e2e-seed-resolve-person-id-consistency.ts`) 로직 수정/대체 금지 — 본 task 는 self-wire 배선만(import 그래프 확인 위해 read 만).
- `resolveRealDataPersonId` 매퍼의 치환 결과 트리 출력 byte/구조·throw 규칙(email 매핑 누락/빈값) 변경 금지(self-assert 삽입 외 동작 변화 0). `PersonIdMap`·`RealDataUpsertArgs`·`PERSON_ID_PLACEHOLDER` 등 single-source 타입/상수 수정 금지.
- 다른 NO-GUARD leaf 컴포저(seed-fixture / parse-shape 류) self-wire·가드 신설은 별도 task.
- `src/` 변경 0(test-only). prisma `schema.prisma` 변경 0.

## Suggested Sub-agents

`implementer → tester` (test-only self-wire 배선 — 아키텍처 결정 없음, import 그래프(type-only → 순환 0) 판정은 implementer 가 read 로 확정, T-0714/T-0716 mirror 라 architect 불요).

## Follow-ups

- 잔여 seed-side NO-GUARD leaf 후보 재survey: `buildRealDataE2eSeed`(T-0573 — 무인자 결정론 상수 빌더). 값-정합 가드(입력 없음 → 재유도 surface 빈약)보다 결정성(매 호출 새 트리·동일 shape)·invariant(email distinct · github.com 1 primary) 가드가 적합한지 case-by-case 판정 후 별도 task.
- parse-shape 류(`result-issue-output-parse`·`result-issue-search-parse`·`result-issue-outcome-parse-shape`) — 형태 검증 위주는 값-정합 가드 적용 여부 case-by-case.
