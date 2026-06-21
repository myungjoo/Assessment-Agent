---
id: T-0563
title: run-unevaluated-fill-run 순수 orchestration core 추가 (dedup → options → batch)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-06-21
plannerNote: "P5 bullet 106(R-64/REQ-037·038) Q-0045 옵션1 run-side chain slice(1)을 split — @Injectable 전 단계의 dependency-free orchestration core(dedup+options+batch 조립)"
independentStream: q0045-run-side-chain
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts
  - src/assessment-evaluation/dto/run-unevaluated-fill-run-core.spec.ts
---

# T-0563 — run-unevaluated-fill-run 순수 orchestration core 추가 (dedup → options → batch)

## Why

P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038) Q-0045 옵션1 run-side 사슬의 다음 슬라이스인 loop-level `@Injectable` orchestrator(slice 1)는 DB 조회 배선 + `generateAndPersist` 바인딩 + module provider 등록 + RBAC 입력 등이 한꺼번에 들어와 size cap(≤300 LOC / ≤5 파일)을 넘기기 쉽고 mock-unit 격리도 약해진다. 본 task 는 그 orchestrator 의 **dependency-free 순수 core** — 이미 바인딩된 callable 들(`resolvePerson`, `persist`)과 raw 좌표 배열·modelId 입력을 받아 dedup(T-0551) → `buildFillRunScoringOptions`(T-0562) → `runUnevaluatedFillBatch`(T-0560)로 닫는 단일 순수 함수 — 만 분리해 먼저 박제한다. 후속 `@Injectable` slice 는 DI 의존성을 바인딩한 뒤 본 core 1 회 호출로 위임하면 되어 inline 재구현(dedup 누락 / options 도출 분산 / 순서 분실 risk)을 막는다. 이는 T-0558~T-0562 와 동형의 "순수 조각 먼저, @Injectable 배선 나중" 분할 패턴이다.

## Required Reading

- `src/assessment-evaluation/dto/run-unevaluated-fill-batch.ts` — `runUnevaluatedFillBatch(bridges, resolvePerson, options, persist)` 시그니처 + `ResolvePersonFn` 타입 (본 core 가 호출).
- `src/assessment-evaluation/dto/build-fill-run-scoring-options.ts` — `buildFillRunScoringOptions(requestModelId, defaultModelId)` 시그니처 (본 core 가 options 도출에 호출).
- `src/assessment-evaluation/dto/dedupe-period-bridge-requests.ts` — `dedupePeriodBridgeRequests(requests)` 시그니처 (본 core 가 dedup 에 호출).
- `src/assessment-evaluation/dto/build-unevaluated-fill-coordinate-runner.ts` (라인 59–72) — `GenerateAndPersistFn` 타입 (본 core 의 `persist` 인자 타입).
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — `PeriodBridgeDto` 타입 (raw 좌표 배열 입력 타입).
- `src/assessment-evaluation/dto/unevaluated-fill-run-result.ts` — `UnevaluatedFillRunResult` 반환 타입.
- `src/assessment-evaluation/dto/run-unevaluated-fill-batch.spec.ts` — mock callable(jest.fn) 기반 unit 패턴 참고용.

## Acceptance Criteria

- [ ] 새 파일 `src/assessment-evaluation/dto/run-unevaluated-fill-run-core.ts` 에 dependency-free 순수 함수 `runUnevaluatedFillRunCore` 추가. 시그니처(권장): `runUnevaluatedFillRunCore(rawBridges: PeriodBridgeDto[], resolvePerson: ResolvePersonFn, persist: GenerateAndPersistFn, requestModelId: string | undefined | null, defaultModelId: string): Promise<UnevaluatedFillRunResult>`.
- [ ] 본문 동작: (a) `options = buildFillRunScoringOptions(requestModelId, defaultModelId)` 로 options 도출, (b) `deduped = dedupePeriodBridgeRequests(rawBridges)` 로 좌표 중복 제거, (c) `return runUnevaluatedFillBatch(deduped, resolvePerson, options, persist)` 로 위임. dedup·options·집계 재구현 0 — 전부 기존 helper 위임.
- [ ] **순서 고정(load-bearing)**: options 도출과 dedup 중 어느 것이든 throw 가능하므로(예: default·request modelId 모두 빈 값 → `buildFillRunScoringOptions` 한국어 `TypeError`; rawBridges non-array → `dedupePeriodBridgeRequests` 한국어 `TypeError`) — 본 core 는 이들의 fail-fast throw 를 흡수하지 않고 그대로 전파한다(좌표를 흘리기 전 차단 — 영속 부수효과 0). 좌표 1 개 단위 person/persist reject 흡수(REQ-037)는 `runUnevaluatedFillBatch` 가 이미 책임지므로 본 core 는 그 결과를 pass-through 만 한다.
- [ ] 순수성: `@Injectable` 0, NestJS / Prisma / LLM / class-validator / repository 인스턴스 import 0 — 타입만 `import type`, value import 은 `dedupePeriodBridgeRequests` / `buildFillRunScoringOptions` / `runUnevaluatedFillBatch` 3 개만. 새 외부 dependency 0(package.json 변경 0).
- [ ] 파일 상단에 기존 조각들(run-unevaluated-fill-batch.ts 등)과 동형의 한국어 doc comment 헤더(책임 / 위임 구조 / 경계 / 패턴 mirror) 작성. `@Injectable` 배선·DB 조회·module 등록·RBAC·controller route 는 후속 slice(Out of Scope)임을 명시.
- [ ] **Happy-path unit test 1+**: mock `resolvePerson`(jest.fn) + mock `persist`(jest.fn) + 좌표 배열(중복 포함)을 넘겨, dedup 후 batch 결과가 반환되고 `persist` 가 dedup 된 좌표 수만큼만 호출됨을 검증.
- [ ] **Error path unit test 1+**: (a) `requestModelId`·`defaultModelId` 둘 다 빈 값 → `buildFillRunScoringOptions` 한국어 `TypeError` 전파 검증, (b) `rawBridges` non-array(null 등) → `dedupePeriodBridgeRequests` 한국어 `TypeError` 전파 검증.
- [ ] **Flow / 분기 cover**: request modelId 채택 분기 vs default fallback 분기 각각에 대해, 실제 `runUnevaluatedFillBatch` 에 넘어간 `options.modelId` 가 기대값임을 검증(예: spy 또는 mock persist 의 options 인자 확인).
- [ ] **Negative cases 충분 cover**: (a) 빈 좌표 배열 입력 → 빈 결과(persist 0 회) 정상 반환, (b) 좌표 1 개의 `resolvePerson` reject → 그 좌표만 failed outcome 으로 흡수되고 나머지 정상(batch 위임이 흡수함을 pass-through 로 확인), (c) `persist` 가 비-function → `runUnevaluatedFillBatch` 의 한국어 `TypeError` 전파. 각 1+ test.
- [ ] colocated spec 위치: `src/assessment-evaluation/dto/run-unevaluated-fill-run-core.spec.ts`.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 100% 목표). 신규 파일은 위 helper 들이 모두 mock 없이 실제 호출되거나 mock callable 로 닫혀 DB/LLM 네트워크 0.

## Out of Scope

- `@Injectable` orchestrator service 화 / DI 등록 / `assessment-evaluation.module.ts` provider 등록 — 후속 slice(1 의 다음 sub-slice).
- personId → ServiceIdentity DB 조회 실배선 / `buildResolvePersonFn`(T-0561) 의 lookup 을 실제 `PersonRepository.findByIdWithIdentities` 로 바인딩 — 후속 `@Injectable` slice.
- `generateAndPersist` 를 실제 `PeriodBridgeAdminPersistService` 에 바인딩 — 후속 slice. 본 core 는 `persist` callable 을 인자로 받기만 한다.
- POST /unevaluated-fill-run controller route / RBAC(self-only · Admin) / run-request DTO 신설 — 후속 slice(2).
- e2e / 실 PostgreSQL / 실 LLM round-trip — 후속 slice(3). 본 task 의 빌드/unit 은 mock callable 로 완결.
- 상류 mapper(T-0549/T-0550)·dedup(T-0551)·batch(T-0560)·options(T-0562) 로직 수정 — 본 core 는 이들을 호출만 한다(재구현 / 변경 0).
- retry / batch abort / 동시성 정책 — 본 core 는 위임 조립만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
