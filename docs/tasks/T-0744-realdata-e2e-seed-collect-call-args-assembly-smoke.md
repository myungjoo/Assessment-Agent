---
id: T-0744
title: realdata-e2e seed-collect-call-args 조립 체인 non-gated build-time smoke 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009]
estimatedDiff: 220
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 실 평가 e2e step① seed-collect-side 조립 buildRealDataE2eSeed→buildRealDataCollectInput→buildRealDataCollectCallArgs smoke. issue-still-relevant: git grep buildRealDataCollectInput origin/main test/smoke/ = pipeline-plan 의 위임 언급 1회뿐(직접 chain 단언 0, 컴포저 unit+consistency spec 만) 확인. test-only pr, dependsOn [] file-disjoint stage5b 병렬."
independentStream: realdata-e2e-seed-collect-call-args-assembly-smoke
dependsOn: []
touchesFiles: [test/smoke/realdata-e2e-seed-collect-call-args-assembly.smoke-spec.ts]
---

# T-0744 — realdata-e2e seed-collect-call-args 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행 (🟢 실 평가 e2e, P5) 의 **step① → step②(수집)** 경계의 build-time 순수 layer 는 두 컴포저가 직렬로 닫는다 — (1) `buildRealDataCollectInput(seeds)` (T-0576) 가 `buildRealDataE2eSeed()` (T-0573) 산출 `RealDataSeedDescriptor[]` 의 각 descriptor `serviceIdentities` 에서 `service`/`externalId` 만 추려 수집 경계 입력 contract `CollectForPersonInput[]` 로 변환하고(`isPrimary` 등 수집에 불필요한 필드 제외), (2) `buildRealDataCollectCallArgs(seeds)` (T-0577) 가 그 위에 `collectForPerson(person, since, assessmentId)` 의 완전한 호출-args 묶음 `RealDataCollectCallArgs[]`(`{person, since: undefined, assessmentId: ASSESSMENT_ID_PLACEHOLDER}`) 을 얹는다 (신규 seed 인원 → `since=undefined` full collection, `assessmentId` 는 DB write 후 치환 placeholder).

이 두 컴포저는 각각 unit (`realdata-e2e-seed-collect-input.spec.ts` / `realdata-e2e-seed-collect-call-args.spec.ts`) + consistency (`...-consistency.spec.ts`) spec 으로 닫혀 있으나, **seed→collect-input→collect-call-args 를 묶은 조립 체인 단위의 non-gated build-time smoke 는 부재**다. `buildRealDataCollectInput` 은 `test/smoke/realdata-e2e-pipeline-plan-assembly.smoke-spec.ts` 에 **위임 throw 전파 주석으로만 언급**되고, 그 smoke 는 `buildRealDataPipelinePlan`(= `buildRealDataCollectCallArgs` + modelId 를 감싼 aggregator) 의 `collectCallArgs` 수준에서만 단언할 뿐 — `descriptor → CollectForPersonInput` 중간 변환(`service`/`externalId` 만 추리고 `isPrimary` 드롭) 과 그 위 call-args 합성을 **직접 chain 으로 묶은 단언은 0** 이다 (`git grep buildRealDataCollectInput origin/main test/smoke/` = pipeline-plan 의 위임 언급 1회뿐, collect-side assembly smoke 파일 부재 확인). 즉 descriptor→CollectForPersonInput shape drift(불필요 필드 누출 / service·externalId 누락)·call-args 묶음 shape drift(`since`/`assessmentId` placeholder)·externalId 빈/공백 throw 전파·빈/단일/다수 descriptor 분기는 public CI 에서 직접 발화되지 않고 pipeline-plan aggregator 또는 DB-gated step② runner set-up 시에만 잡힌다.

본 task 는 그 gap 을 메운다 — seed-side upsert 조립 smoke (T-0743, `seed→upsert-args→resolve`, step①② DB-prep 경로) 의 **collect-side(step① 수집 입력 경로) 대칭 sibling** 으로, seed→collect-input→collect-call-args 종단 조립 surface 회귀를 public CI 그물로 박제한다.

## Required Reading

- `test/helpers/realdata-e2e-seed-collect-input.ts` — 위임 (1) `buildRealDataCollectInput(seeds)` → `CollectForPersonInput[]`. 각 descriptor 의 `serviceIdentities` 에서 `service`/`externalId` 만 추려 매핑(`isPrimary` 등 제외)·externalId 빈/공백 throw 규칙·매 호출 새 트리 반환(무공유) 규칙. 출력 element type `CollectForPersonInput` 은 production `src/assessment-collection/collection-entry.service` 에서 import 재사용
- `test/helpers/realdata-e2e-seed-collect-call-args.ts` — 위임 (2) `buildRealDataCollectCallArgs(seeds)` → `RealDataCollectCallArgs[]`. `RealDataCollectCallArgs`(`{person: CollectForPersonInput, since: string | undefined, assessmentId: string}`) interface + `ASSESSMENT_ID_PLACEHOLDER`(`"ASSESSMENT_ID_PLACEHOLDER"`) 상수 + `since=undefined`(신규-인원 full collection)·`person` 은 `buildRealDataCollectInput` 결과 1:1 wrap(중복 매핑 0)·externalId 빈/공백 하위 throw 전파 규칙
- `test/helpers/realdata-e2e-seed-fixture.ts` — `buildRealDataE2eSeed()` → `RealDataSeedDescriptor[]` + `RealDataSeedDescriptor`(`{person:{fullName,email,active}, serviceIdentities}`)·`RealDataServiceIdentitySeed`(`{service,externalId,isPrimary}`) interface — fixture / synthetic descriptor literal 구성에 필요
- `test/smoke/realdata-e2e-seed-upsert-resolve-assembly.smoke-spec.ts` — 구조·문서주석·non-gated describe·Out of Scope·deep-equal 단일 source 대조·throw 전파·결정론·무공유·no-mutation 패턴의 mirror 템플릿 (T-0743, seed-side 형제 조립 smoke)
- `test/jest-smoke.json` — smoke jest config (testRegex 가 본 신규 `*.smoke-spec.ts` 파일을 잡는지 확인용)

## Acceptance Criteria

- [ ] 신규 파일 `test/smoke/realdata-e2e-seed-collect-call-args-assembly.smoke-spec.ts` 1개만 추가 (test-only, production `src/`·기존 컴포저·helper 수정 0).
- [ ] **Happy-path test** — `buildRealDataE2eSeed()`(또는 synthetic descriptor literal) → `buildRealDataCollectInput(seeds)` → `buildRealDataCollectCallArgs(seeds)` 종단 체인을 한 번에 실행. (a) `buildRealDataCollectCallArgs` 산출이 배열·길이 = descriptor 수·각 원소 `person`/`since`/`assessmentId` 필드 보유 1+ test. (b) 각 원소 `person.serviceIdentities[*]` 가 원본 descriptor 의 `service`/`externalId` 만 보유하고 `isPrimary` 등 불필요 필드 미누출 1+ test. (c) 각 원소 `since === undefined`·`assessmentId === ASSESSMENT_ID_PLACEHOLDER` 1+ test.
- [ ] **단일 source 조립 단언** — 동일 `seeds` 에 대해 `buildRealDataCollectCallArgs(seeds)[*].person` 이 `buildRealDataCollectInput(seeds)` 산출과 deep-equal(중복 매핑 없이 동일 변환 위임) 1+ test. `buildRealDataCollectCallArgs` 산출 원소 수 = `buildRealDataCollectInput` 산출 원소 수 = descriptor 수(1:1 wrap) 1+ test. descriptor 의 `person.email`/`fullName` 등 collect 입력에 불필요한 필드가 `CollectForPersonInput` shape 에 누출되지 않음(또는 contract 상 포함 필드만 보유) 1+ test.
- [ ] **Error/negative path test** — (a) descriptor 의 어느 serviceIdentity `externalId` 가 빈 문자열 → `buildRealDataCollectInput`(및 이를 감싼 `buildRealDataCollectCallArgs`) 의 throw 를 자체 try/catch 없이 조립 경로로 그대로 전파 (`expect(() => buildRealDataCollectCallArgs([...])).toThrow`) 1+ test. (b) `externalId` 가 공백만 → throw 전파 1+ test. (c) (해당 helper 가 `service` blank 도 guard 하면) `service` 빈/공백 → throw 전파 1+ test (helper 가 guard 하지 않으면 본 항목 생략 + 그 사실 본문 명시).
- [ ] **Flow / branch coverage** — 빈 `seeds` → `buildRealDataCollectInput([])` = `[]` → `buildRealDataCollectCallArgs([])` = `[]`(throw 0) 1+ test. `serviceIdentities` 0개 descriptor → `person.serviceIdentities` 빈 배열로 통과(throw 0) 1+ test. 단일·다수 descriptor 각 1+ test. 분기마다 test 분리.
- [ ] **Negative cases 충분 cover** — (a) externalId 빈 → throw, (b) externalId 공백 → throw, (c) **결정론·무공유**: 동일 `seeds` 두 번 호출 시 deep-equal 산출 + 매 호출 새 객체 트리(참조 비동일 — 종단 산출 배열·중첩 `person`·`person.serviceIdentities` 배열 모두 참조 비동일), (d) **no-mutation**: 입력 `seeds`(및 그 중첩 `serviceIdentities`) 객체가 호출 전후 deep-equal(mutate 0) — 각 1+ test. (`ASSESSMENT_ID_PLACEHOLDER` 는 string 원시값이라 공유돼도 mutate 불가 — 본문 메모.)
- [ ] **non-gated 항상 실행** — gating env 없이 항상 도는 일반 `describe` (env-gated `describe.skip` 금지 — public CI always green, R-113). `process.env` 읽기 0 (fixture 객체·descriptor literal 직접 주입).
- [ ] live leg (실 github.com 네트워크 fetch / 실 활동 수집 / `collectForPerson` 실 호출 / 실 SinceDerivationService.deriveSince / 실 assessment.id 생성 / DB 접근 / 실 LLM / Ollama / 실 jest spawn) 복제 0 — seed→collect-input→collect-call-args 조립 surface 만 검증 (synthetic descriptor literal 직접 주입).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — smoke spec 은 컴포저 import 재사용만이라 coverage 영향 중립이나 전체 threshold green 확인.
- [ ] `pnpm lint && pnpm build && pnpm test:smoke`(또는 jest-smoke config) green — 신규 smoke spec 이 smoke testRegex 에 잡혀 실행되고 전부 pass.

## Out of Scope

- 기존 `realdata-e2e-pipeline-plan-assembly.smoke-spec.ts` (T-0592, `seeds+modelId → buildRealDataPipelinePlan → {collectCallArgs, modelId}` aggregator 진입) 의 재검증 — 본 task 는 그 aggregator 아래 **collect-input→collect-call-args 직접 chain(modelId 무관)** 만 책임 (중복·재검증 0).
- 기존 `realdata-e2e-seed-upsert-resolve-assembly.smoke-spec.ts` (T-0743, seed→upsert-args→resolve DB-prep 경로) — 본 task 는 collect 입력 경로만, 별개 절단면.
- `ASSESSMENT_ID_PLACEHOLDER` → 실 assessment.id 치환 runner / `since=undefined` 외 실 `deriveSince` 산출 (DB 접근) — 본 task 는 build-time placeholder·`undefined` 만 검증.
- 실 수집 호출 / 실 github 수집 / 실 LLM round-trip / Ollama / DB 접근 / 실 jest spawn.
- 컴포저 소스(`realdata-e2e-seed-collect-input.ts` / `realdata-e2e-seed-collect-call-args.ts` / `realdata-e2e-seed-fixture.ts`) / 위임 helper / consistency 가드 수정 — test-only (신규 smoke spec 1 파일).
- 새 컴포저 / 가드 / helper / consistency-guard 신설 — 기존 import 재사용만 (consistency-guard sweep 종결, T-0726).
- production `src/` 코드 / `package.json` / `test/jest-smoke.json` 변경.
- T-0728~T-0743 의 기존 조립 smoke 파일 수정 — file-disjoint 병렬 stream (본 task 는 신규 파일 추가만).

## Follow-ups

(없음 — 생성 시점)
