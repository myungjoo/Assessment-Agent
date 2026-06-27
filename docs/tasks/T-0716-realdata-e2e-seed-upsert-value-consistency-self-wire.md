---
id: T-0716
title: realdata-e2e seed-upsert 값-정합 가드 컴포저 self-wire 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-059, REQ-058, REQ-024]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-06-27
plannerNote: "P5 consistency sweep — assertRealDataUpsertArgsConsistentWithDescriptors 를 buildRealDataUpsertArgs 단일 return 직전 self-assert 배선(T-0715 가드 짝 닫기, 가드가 컴포저의 PERSON_ID_PLACEHOLDER value import → 순환 의존 위험 시 lazy require T-0712 mirror)"
independentStream: realdata-e2e-seed-upsert-guard
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-seed-upsert.ts
  - test/helpers/realdata-e2e-seed-upsert.spec.ts
  - test/helpers/realdata-e2e-seed-upsert-consistency.spec.ts
---

# T-0716 — realdata-e2e seed-upsert 값-정합 가드 컴포저 self-wire 배선

## Why

PLAN.md Phase P5(Evaluation pipeline) 109행 step ①(seed descriptor → Prisma upsert-args) surface 의 build-time consistency-guard sweep 의 일환으로, T-0715 가 신설한 값-정합 가드 `assertRealDataUpsertArgsConsistentWithDescriptors`(`test/helpers/realdata-e2e-seed-upsert-consistency.ts`)는 현재 **컴포저에서 호출되지 않는다**(self-wire 미배선). 가드가 존재하지만 `buildRealDataUpsertArgs` 의 실 변환 경로에 self-assert 로 묶이지 않아, 매퍼의 슬롯 값 매핑(where/create/update · compound-unique key · personId placeholder)이 잘못 바뀌면 가드를 따로 호출하지 않는 한 build-time 에 잡히지 않는 gap 이 남는다.

issue-still-relevant 확인: origin/main(ddcb794f) 의 `test/helpers/realdata-e2e-seed-upsert.ts` 본문에 `assertRealDataUpsertArgsConsistentWithDescriptors` self-assert 호출이 **grep 0 부재** — self-wire 가 진짜로 안 됐음을 확인했다. 단, T-0714(top-level import) 와 달리 **본 가드 모듈은 컴포저로부터 value 를 import** 한다(`PERSON_ID_PLACEHOLDER` 상수 + 타입들, `realdata-e2e-seed-upsert-consistency.ts` line 57–62) — 즉 컴포저가 가드를 top-level import 하면 컴포저 → 가드 → 컴포저(value) CommonJS 순환 edge 가 생긴다. 따라서 **lazy `require`**(T-0712/T-0708 mirror) 채택이 예상 경로다.

T-0711→T-0712 / T-0709→T-0710 / T-0713→T-0714 패턴의 seed-side mirror 로, `buildRealDataUpsertArgs` 단일 return 직전에 본 가드를 self-assert 로 배선해 args 트리 값 drift 를 컴포저 호출 경로 자체에서 fail-fast 차단한다. REQ-059(seed 가 raw 미보유) + REQ-058(재수집 중복 방지 upsert 정합) + REQ-024(평가 입력 무결성) 의 build-time 가드층을 닫는다.

## Required Reading

- `test/helpers/realdata-e2e-seed-upsert.ts` — self-wire 대상 leaf 컴포저 `buildRealDataUpsertArgs(descriptors)`. 현재 단일 return(`return descriptors.map(...)`). 그 결과를 `const upsertArgsList = descriptors.map(...)` 로 묶고, return 직전에 가드 self-assert 후 `upsertArgsList` 를 그대로 return 하도록 배선한다. 매퍼 출력 구조·args 트리 byte 변경 금지.
- `test/helpers/realdata-e2e-seed-upsert-consistency.ts` — self-wire 할 가드 `assertRealDataUpsertArgsConsistentWithDescriptors(upsertArgsList, descriptors)`. **import 그래프 확인 의무**: 본 가드 모듈은 line 57–62 에서 컴포저(`./realdata-e2e-seed-upsert`)로부터 `PERSON_ID_PLACEHOLDER`(value) + 타입들을 import 한다 → 컴포저가 가드를 **top-level import** 하면 순환 의존 edge 발생. 따라서 컴포저 안에서 **lazy `require("./realdata-e2e-seed-upsert-consistency")`** 로 가드를 가져온다(T-0712/T-0708 mirror — value-import 순환 회피). implementer 가 import 그래프 재확인 후 lazy require 채택하되, 만약 예상과 달리 순환 edge 가 없다고 확인되면 top-level import(T-0710/T-0714 mirror) 로 전환하고 그 사유를 trail notes 에 1 줄 박제.
- `test/helpers/realdata-e2e-result-summary-line.ts` 와 그 컴포저(T-0712, lazy require 선례) / `test/helpers/realdata-e2e-result-summary-markdown.ts`(T-0714, top-level import 선례) — 두 패턴 중 import 그래프에 맞는 쪽 채택 참고.
- `test/helpers/realdata-e2e-seed-upsert-consistency.spec.ts` — T-0715 가드 spec(무회귀 대상). self-wire 호출 배선 검증 test 는 컴포저 spec(`realdata-e2e-seed-upsert.spec.ts`)에 추가하는 것이 colocated 정합(가드 자체 단위 test 는 consistency.spec 유지).

## Acceptance Criteria

`test/helpers/realdata-e2e-seed-upsert.ts` 의 `buildRealDataUpsertArgs` 단일 return 직전에 `assertRealDataUpsertArgsConsistentWithDescriptors` 를 self-assert 로 배선한다(require/import 1 줄 + self-assert 1 줄, 가드 본체·args 트리 출력 byte 무변경).

- [ ] 컴포저는 최종 args 트리를 `const upsertArgsList = descriptors.map(...)` 로 묶은 뒤, return 직전 `assertRealDataUpsertArgsConsistentWithDescriptors(upsertArgsList, descriptors)` 를 호출하고 `upsertArgsList` 를 그대로 return 한다. args 트리 출력 byte·구조 무변경(기존 happy-path test 무회귀).
- [ ] import 는 **lazy `require`**(가드가 컴포저 value `PERSON_ID_PLACEHOLDER` 를 import → 순환 의존 회피, T-0712 mirror) 채택. 만약 import 그래프 재확인에서 순환 edge 가 없다고 판정되면 top-level import(T-0714 mirror) 로 전환하고 그 사유를 trail notes 에 1 줄 박제.
- [ ] **Happy-path test 1+**(`realdata-e2e-seed-upsert.spec.ts`) — 컴포저가 정상 descriptor 배열에 대해 가드 self-assert 통과 후 정상 args 트리를 return 함을 검증(기존 산출과 deep-equal, 무회귀). 빈 배열 입력 → 빈 배열 반환(throw 0) 경계도 cover.
- [ ] **호출 배선 검증 test 1+** — `buildRealDataUpsertArgs` 호출 시 `assertRealDataUpsertArgsConsistentWithDescriptors` 가 실제 호출됨을 spy/mock 으로 검증(self-wire 배선 자체가 dead 가 아님을 증명 — lazy require 의 경우 module 경로 spy 또는 jest.spyOn 으로 호출 확인).
- [ ] **Error path / negative cases 충분 cover** — 각 예외 분기마다 1+ test:
  - ① 가드가 RangeError 를 throw 하는 시나리오(예: 가드 spy 가 RangeError throw, 또는 args 트리 슬롯 값 매핑을 의도적으로 깨는 mock)에서 그 throw 가 컴포저 밖으로 **전파**됨을 검증.
  - ② 가드가 TypeError 를 throw 하는 구조 결손 시나리오에서 그 throw 가 컴포저 밖으로 전파됨을 검증.
  - ③ 가드 호출 전 단계에서 컴포저 매핑 자체가 throw 하는 경우(있다면) 값-정합 가드가 **호출되지 않음** negative 검증 — 분기 순서 보장. (현재 컴포저 매핑은 throw 분기가 없으면 본 항목은 "분기 없음 — 생략" 으로 명시 가능.)
  (단일 negative 금지 — 예외 전파 분기 각 1+.)
- [ ] **Flow / branch coverage** — self-assert 통과 경로(정상 return)와 self-assert throw 전파 경로 양 분기를 test 로 cover.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 — 컴포저 파일 line ≥ 80% / function ≥ 80%(jest `coverageThreshold.global`), 가능하면 100%.
- [ ] 전체 unit suite green(기존 test·T-0715 가드 spec 무회귀).

## Out of Scope

- T-0715 가드 본체(`realdata-e2e-seed-upsert-consistency.ts`) 로직 수정/대체 금지 — 본 task 는 self-wire 배선만(import 그래프 확인 위해 read 만).
- `buildRealDataUpsertArgs` 매퍼의 args 트리 출력 byte/구조 변경 금지(self-assert 삽입 외 동작 변화 0). `PERSON_ID_PLACEHOLDER`·`RealDataSeedDescriptor` 등 single-source 상수/타입 수정 금지.
- 다른 NO-GUARD leaf 컴포저(seed-fixture / seed-resolve-person-id / parse-shape 등) self-wire 는 별도 task.
- `src/` 변경 0(test-only). 슬롯 배열·타입 재정의 금지.

## Suggested Sub-agents

`implementer → tester` (test-only self-wire 배선 — 아키텍처 결정 없음, import 그래프(value-import 순환) 판정은 implementer 가 read 로 확정, T-0712/T-0714 mirror 라 architect 불요).

## Follow-ups

- 잔여 NO-GUARD leaf 후보 재survey(가드 신설 + self-wire 짝): seed-side(`seed-fixture`·`seed-resolve-person-id`) / parse-shape(`result-issue-output-parse`·`result-issue-search-parse`·`result-issue-outcome-parse-shape`) 류 — 형태 검증 위주는 값-정합 가드 적용 여부 case-by-case.
