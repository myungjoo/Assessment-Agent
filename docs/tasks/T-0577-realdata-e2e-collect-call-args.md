---
id: T-0577
title: 실 평가 e2e collectForPerson 호출-args descriptor 순수 빌더
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-031]
estimatedDiff: 110
estimatedFiles: 2
created: 2026-06-23
independentStream: realdata-e2e
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-seed-collect-call-args.ts
  - test/helpers/realdata-e2e-seed-collect-call-args.spec.ts
hqOrigin:
plannerNote: "P5 PLAN 109행 실 평가 e2e step②(수집) 경계 — seed descriptor→collectForPerson {person,since,assessmentId} 호출-args 순수 빌더. cloud-safe·dependency-free."
---

# T-0577 — 실 평가 e2e collectForPerson 호출-args descriptor 순수 빌더

## Why

PLAN.md 109행(P5 "🟢 실 평가 e2e 테스트 데이터 = github.com `myungjoo` + `leemgs` 공개 활동", 사용자 지정 2026-06-22)의 **step ②(수집) 경계**를 순수 함수로 분해하는 chain 의 다음 slice 다. 직전 slice(T-0576 `buildRealDataCollectInput`)는 seed descriptor 를 `CollectForPersonInput`(= `collectForPerson` 의 첫 인자 `person`)로 매핑했다. 그러나 `CollectionEntryService.collectForPerson(person, since, assessmentId)` 는 **3 개 인자**를 받는다 — `person` 외에 `since`(incremental 하한)와 `assessmentId`(영속화 대상 FK)도 필요하다.

본 task 는 그 **완전한 호출-args 묶음**을 build-time 결정론적으로 산출하는 순수 함수 `buildRealDataCollectCallArgs()` 를 추가한다. 실 seed Person 은 직전 Assessment 가 없는 신규 인원이므로 `since` 는 `undefined`(= full collection, `SinceDerivationService` §4 의 신규-인원 계약과 정합)이고, `assessmentId` 는 DB write 시점에 결정되므로 placeholder(`ASSESSMENT_ID_PLACEHOLDER`, T-0575 의 personId placeholder 치환 패턴과 동형)로 둔다. 이렇게 step ② live 수집 runner 가 받을 호출-args 형태를 미리 고정해 build-time 에 검증 가능하게 만든다. 실 github.com fetch·Ollama 실 LLM·DB write·credential 은 전부 deferred(LAN/credential gate, ADR-0045) 그대로 — 본 slice 는 네트워크/DB/LLM/env 접근 0 의 순수 매퍼라 cloud cron 에서 자율 실행 가능하다.

## Required Reading

- `docs/tasks/T-0576-realdata-e2e-collect-input.md` — 직전 chain slice(`buildRealDataCollectInput`)의 패턴·범위 경계.
- `test/helpers/realdata-e2e-seed-collect-input.ts` — 본 task 가 재사용할 `buildRealDataCollectInput()` 와 `CollectForPersonInput` import 경로(중복 정의 금지 — 기존 매퍼 위에 조립).
- `src/assessment-collection/collection-entry.service.ts` (L21~L59) — `CollectForPersonInput` interface 와 `collectForPerson(person, since, assessmentId)` 시그니처(3 인자 형태).
- `src/assessment-collection/since-derivation.service.ts` — `deriveSince` 의 신규-인원 계약(직전 Assessment 부재 → `undefined` = full collection). 본 빌더의 `since=undefined` 결정 근거.
- `test/helpers/realdata-e2e-seed-resolve-person-id.ts` (L30~L60) — placeholder + 치환 분리 패턴(`ASSESSMENT_ID_PLACEHOLDER` 명명·export 컨벤션 참고). colocated spec 의 구조·네이밍도 동일 스타일로.

## Acceptance Criteria

- [ ] `test/helpers/realdata-e2e-seed-collect-call-args.ts` 에 순수 함수 `buildRealDataCollectCallArgs(seeds: RealDataSeedDescriptor[]): RealDataCollectCallArgs[]` 추가. 각 seed descriptor 에 대해 `{ person: CollectForPersonInput, since: string | undefined, assessmentId: string }` 형태(= `collectForPerson` 인자 묶음)를 산출한다. `person` 은 기존 `buildRealDataCollectInput()` 결과를 재사용(중복 매핑 금지), `since` 는 신규 seed 인원이므로 `undefined`, `assessmentId` 는 export 된 상수 `ASSESSMENT_ID_PLACEHOLDER` 로 둔다. `RealDataCollectCallArgs` type 과 placeholder 상수를 export 한다.
- [ ] **타입 재사용** — `CollectForPersonInput` 은 `collection-entry.service.ts` 에서, `buildRealDataCollectInput` / `RealDataSeedDescriptor` 는 기존 helper 에서 import 재사용(새 중복 정의 0).
- [ ] **입력 mutate 0 / 무공유 보장** — 매 호출이 새 객체 트리(배열·중첩 `person`)를 반환하고 입력 seed 배열·중첩 객체를 변형하지 않는다(호출 측이 반환값을 mutate 해도 입력·다음 호출 결과 불변). spec 으로 검증.
- [ ] **Happy-path unit test 1+** — `buildRealDataE2eSeed()` 결과(또는 동등 fixture)를 입력으로 2 Person 각각 `{ person, since: undefined, assessmentId: ASSESSMENT_ID_PLACEHOLDER }` 정확 산출 + 순서 보존 검증. `person.serviceIdentities` 가 `{ service, externalId }` 만 담아 `buildRealDataCollectInput` 결과와 일치하는지 확인.
- [ ] **Error/negative path test 1+** — 빈 입력 배열(`[]` → `[]` 반환), `serviceIdentities` 가 빈 배열인 descriptor(→ 빈 `serviceIdentities` 보존), 그리고 기반 `buildRealDataCollectInput` 의 throw 가드(빈/공백 `externalId`)가 본 빌더를 통해서도 전파되는지 각 1+ test. 단일 negative 만으로 부족 — 예외 분기마다 cover.
- [ ] **Flow / branch coverage** — 함수 내 분기(빈 입력·빈 identity·하위 매퍼 throw 전파 등) 각 분기 1+ test.
- [ ] **무공유 회귀 test** — 반환값(중첩 `person` 포함) mutate 후 동일 입력으로 재호출 시 결과 불변(공유 mutable 상수 노출 0) 검증.
- [ ] **placeholder 일관성 test** — 모든 호출-args 의 `assessmentId` 가 동일 `ASSESSMENT_ID_PLACEHOLDER` 상수이고 `since` 가 `undefined` 임을 검증(신규-인원 full-collection 계약 박제).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(production `src/` 변경 0 — test helper + colocated spec 만).
- [ ] `pnpm test:cov` 통과 — 신규 helper line ≥ 80% AND function ≥ 80%(jest `coverageThreshold` 강제). 순수 매퍼이므로 100% 지향.

## Out of Scope

- 실 github.com 네트워크 fetch / `assessment-collection` 의 실 활동 수집 호출(step ② 의 live 부분 — LAN/credential gate).
- 실 `SinceDerivationService.deriveSince` 호출(DB 접근 — 본 빌더는 신규-인원 `since=undefined` 만 build-time 산출).
- `ASSESSMENT_ID_PLACEHOLDER` → 실 assessment.id 치환 runner(step ② DB write 후 — T-0575 의 personId 치환과 동형이나 별도 후속 slice).
- Ollama 실 LLM round-trip(step ③, ADR-0045 LAN=AKIHA 192.168.0.5, cloud cron 무경로).
- `deploy/daily-test.sh` 의 `step_eval` wiring(step ④).
- `CollectionEntryService` / `SinceDerivationService` / production `src/` 코드 변경 — 본 task 는 test helper 단독(타입 import 재사용만).
- 새 외부 dependency / schema migration / env·secret 접근.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
