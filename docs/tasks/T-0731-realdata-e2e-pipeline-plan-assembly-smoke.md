---
id: T-0731
title: realdata-e2e pipeline-plan 조립 체인 non-gated build-time smoke 신설 (seeds+modelId→{collectCallArgs,modelId})
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-032, REQ-059]
dependsOn: []
touchesFiles:
  - test/smoke/realdata-e2e-pipeline-plan-assembly.smoke-spec.ts
independentStream: realdata-e2e-pipeline-plan-assembly-smoke
estimatedDiff: 135
estimatedFiles: 1
created: 2026-06-28
plannerNote: "P5 §109 seed-side 진입 plan — buildRealDataPipelinePlan(seeds+modelId→{collectCallArgs,modelId}) 조립 체인 non-gated smoke. issue-still-relevant: origin/main test/smoke 에 pipeline-plan 참조 0 확인. T-0728/T-0729/T-0730 와 file-disjoint."
---

# T-0731 — realdata-e2e pipeline-plan 조립 체인 non-gated build-time smoke 신설

## Why

PLAN.md 109행(🟢 실 평가 e2e, P5) 의 step ②(수집) 진입 경계는 seed-side 진입 plan 컴포저 `buildRealDataPipelinePlan(seeds, modelId)`(T-0592, `test/helpers/realdata-e2e-pipeline-plan.ts`) 가 닫는다 — seed descriptor 배열을 `buildRealDataCollectCallArgs`(T-0577)에 위임해 collect 호출-args 묶음을 만들고, 평가 정책 `modelId` 를 guard 검증 후 보존해 `{ collectCallArgs, modelId }`(step ② live runner 가 들고 갈 "어떤 인원을 어떤 modelId 정책으로 수집→평가할지" 한 묶음)을 합성한다. 이 컴포저는 컴포저 단위 unit spec(`realdata-e2e-pipeline-plan.spec.ts`)으로는 닫혀 있으나, **여러 link 를 묶은 조립 체인 단위의 non-gated build-time smoke** 는 부재다 — 즉 seed→collect-call-args 위임 + modelId 보존의 조립 surface 회귀(modelId guard 순서 뒤집힘, collect 위임 산출 변형/누락, modelId 다른 값으로 바꿔치기, externalId throw 전파 끊김)는 컴포저 unit spec 밖의 조립 레벨에서는 CI 그물이 없다. 본 task 는 T-0728(seed→run-plan→step-args)·T-0729(result-issue publish)·T-0730(evaluation-plan) 의 병렬 sibling 으로, pipeline-plan 조립 체인을 결정론 seed fixture + modelId 로부터 끝까지 조립해 `{ collectCallArgs, modelId }` 산출을 build-time(live-LLM 0·네트워크 0·DB 0)으로 검증하는 smoke 를 박제한다. raw 미저장(REQ-032/REQ-059) 불변과 정합한 수집 진입 plan 조립 회귀를 CI 단계에서 잡는 그물이다.

## Required Reading

- `docs/tasks/T-0731-realdata-e2e-pipeline-plan-assembly-smoke.md` (본 파일)
- `test/helpers/realdata-e2e-pipeline-plan.ts` — `buildRealDataPipelinePlan(seeds, modelId)` 종단 진입점. 반환 shape `RealDataPipelinePlan { collectCallArgs: RealDataCollectCallArgs[]; modelId: string }`(L73~76), guard 순서(modelId guard 가 collect 위임보다 **먼저** — L109~113)·빈 seeds 분기(throw 0, `{ collectCallArgs: [], modelId }` — L88)·modelId 빈/공백 명시 throw·externalId 빈/공백 seed 의 위임 throw 전파(L91)·결정론·무공유(매 호출 새 plan + 새 collectCallArgs 배열, modelId 는 원시값 보존 — L97~101).
- `test/helpers/realdata-e2e-seed-collect-call-args.ts` — `buildRealDataCollectCallArgs(seeds)` 위임 대상. 반환 `RealDataCollectCallArgs { person, since, assessmentId }`(L58~), `since=undefined`(신규 인원 full collection)·`assessmentId=ASSESSMENT_ID_PLACEHOLDER`(L50). collectCallArgs 산출 검증에 사용.
- `test/helpers/realdata-e2e-seed-fixture.ts` — `buildRealDataE2eSeed(): RealDataSeedDescriptor[]`(L78, 무인자 결정론 상수 빌더) + `RealDataSeedDescriptor { person, serviceIdentities }`(L58~60) + `RealDataServiceIdentitySeed`(L37). happy-path seed 입력 합성에 사용(결정론 fixture 재사용 — 직접 literal 합성보다 single-source 보존). 빈 seeds 분기용 `[]` 직접 전달.
- `test/smoke/realdata-e2e-assembly.smoke-spec.ts` — 기존 non-gated 조립 smoke(T-0728). 파일 머리 주석 스타일·non-gated 일반 `describe`·결정론 fixture·import 경로 규약·`expect(...).toThrow()` negative 패턴 mirror(단 본 task 는 seed-side 진입 plan 조립만 — run-plan/step-args 미사용).
- `test/jest-smoke.json` 및 `package.json` 의 `test:smoke` script — smoke suite 수집·실행 규약(rootDir `test/smoke/`, 파일명 `*.smoke-spec.ts` 패턴).

## Acceptance Criteria

신규 파일 `test/smoke/realdata-e2e-pipeline-plan-assembly.smoke-spec.ts` **1 개** 만 추가한다. **`describe.skip` / gating 없이 항상 실행되는 일반 `describe`** 로 작성한다(public CI 기본 green 경로에서 발화하는 것이 본 task 의 핵심 — gating 으로 감싸면 안 됨). 파일 상단에 한국어 헤더 주석(목적·non-gated·live-LLM 0·네트워크 0·DB 0·pipeline-plan(seed-side 진입) 조립 체인 범위·기존 unit spec 와 직교한 조립 레벨 그물 의도) 작성.

- [ ] **Happy-path test 1+**: 결정론 seed fixture(`buildRealDataE2eSeed()`, 1+ 건) + 유효 `modelId`(비공백)을 `buildRealDataPipelinePlan` 에 넘겨 `{ collectCallArgs, modelId }` 두 필드가 모두 산출되고, `collectCallArgs.length === seeds.length`, `plan.modelId === modelId`(원시값 동형 보존), 각 `collectCallArgs[i].since === undefined`·`collectCallArgs[i].assessmentId === ASSESSMENT_ID_PLACEHOLDER`(위임 helper 산출 정합) 임을 단언하는 test 1+. (live LLM·DB·네트워크 호출 0 — collect service/orchestrator/gateway 미사용.)
- [ ] **Error path test 1+**: 빈/공백 `modelId` 로 호출 시 `buildRealDataPipelinePlan` 이 throw(L109 guard, collect 위임 전 차단)함을 `expect(...).toThrow(...)` 으로 단언. 빈 문자열·공백 문자열 각 케이스 1+ test.
- [ ] **Flow / branch 분기 cover**: (i) 빈 `seeds` 배열(`[]`) + 유효 modelId → throw 0 + `collectCallArgs` 빈 배열 + `plan.modelId === modelId`(L88 빈-배열 분기), (ii) 단일 seed, (iii) 다수 seed 경로를 각각 1+ test 로 분리(위임 helper 의 빈-배열/단일/다수 매핑이 조립 경로로도 1:1 도달함을 확인). 다수 seed 분기는 fixture 가 1 건만 산출하면 fixture 복제/추가 합성으로 2+ 건 구성.
- [ ] **negative cases 충분 cover**: 예외 상황을 분기마다 cover — (1) modelId 빈 문자열 throw, (2) modelId 공백 문자열 throw, (3) externalId 빈/공백 seed → 위임 `buildRealDataCollectInput` throw 전파(modelId 는 유효하게 둔 채 seed 측 결함만 주입)를 `expect(...).toThrow()` 으로 단언, (4) 빈 seeds + 유효 modelId → 빈 plan(throw 0) 경계 test 각 1+. 단일 negative 만 작성 금지.
- [ ] **guard 순서 test 1+**: 빈 seeds(`[]`) + 빈/공백 modelId 를 동시에 넘겨도 modelId guard 가 우선 throw 함(L93~95 의 "빈 seeds 경계에서도 modelId guard 우선" 계약)을 `expect(...).toThrow()` 으로 단언하는 test 1+.
- [ ] **결정론·무공유 test 1+**: 같은 (seeds, modelId) 으로 두 번 호출한 두 plan 이 deep-equal 이면서 `plan`·`plan.collectCallArgs` 참조가 공유되지 않음(`not.toBe`)을, 그리고 입력 `seeds` 배열·원소가 호출 전후로 mutate 되지 않음을 검증.
- [ ] live-LLM·네트워크·DB·credential 사용 0 — 파일 내 fetch/gateway/Ollama/collect service/orchestrator/env-gating/describe.skip/process.env 읽기 배선 일절 없음(순수 build-time in-memory 검증만). 신규 컴포저/가드/helper 신설 0(consistency-guard sweep 종결, T-0726 — T-0727 doc §5 준수).
- [ ] 신규 spec 의 `describe`/`it` 문자열은 한국어(§12). 파일 머리 주석에 live-LLM·실 네트워크·DB 0 인 이유와 "컴포저 unit spec 가 닫지 못하는 조립 레벨 회귀를 non-gated 로 cover" 의도 명시.
- [ ] `pnpm lint && pnpm build && pnpm test:smoke` 통과(신규 smoke suite green, gating 없이 발화). 전체 unit suite 무회귀(`pnpm test`).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 본 task 는 test-only 파일 추가라 production 커버리지 영향 0, 기존 임계 유지 확인.

## Out of Scope

- T-0728 의 seed→run-plan→step-args 조립 smoke(`test/smoke/realdata-e2e-assembly.smoke-spec.ts`)·T-0729 의 result-issue publish 조립 smoke(`test/smoke/realdata-e2e-result-issue-publish-assembly.smoke-spec.ts`)·T-0730 의 evaluation-plan 조립 smoke(`test/smoke/realdata-e2e-evaluation-plan-assembly.smoke-spec.ts`) 은 절대 건드리지 않는다(file-disjoint 병렬 stream 보장).
- 실 `CollectionEntryService.collectForPerson` 호출 / 실 github 네트워크 수집 / `gh` 실행 / 실 deriveSince(DB 접근) — 본 task 는 collect 호출-args **조립 surface** 만 검증(실 수집 실행 0). live leg 검증은 기존 `realdata-e2e-live.smoke-spec.ts` 책임.
- 실 `EvaluationScoringService.scoreUnit` 호출 / 실 LLM round-trip / Ollama / orchestrator / LlmHttpGateway. evaluate-side 실행은 본 컴포저 범위 밖(seed-side 진입 plan 만 — pipeline-plan.ts L20~24 참조).
- `ASSESSMENT_ID_PLACEHOLDER` → 실 assessment.id 치환 runner / 실 DB write.
- 새 컴포저·consistency 가드 helper 신설 0(sweep 종결 T-0726, T-0727 doc §5 "추가 value-consistency 가드 신설 금지" 준수). 기존 `build*` 컴포저 import 재사용만.
- `test/helpers/realdata-e2e-pipeline-plan.ts` 등 기존 컴포저 소스 수정(본 task 는 smoke spec 추가만 — 컴포저는 read-only 검증 대상).
- `src/`·`package.json`·lockfile·`.github/workflows/`·schema.prisma 변경 0. 새 외부 dependency 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
