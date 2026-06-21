---
id: T-0562
title: run-request modelId → ScoringOptions 도출 순수 factory 추가
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037, REQ-038]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-21
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/dto/build-fill-run-scoring-options.ts
  - src/assessment-evaluation/dto/build-fill-run-scoring-options.spec.ts
independentStream: q0045-run-side-chain
hqOrigin: none
plannerNote: "P5 bullet 106(R-64/REQ-037·038) Q-0045 옵션1 run-side chain slice(1''-pre): batch driver 의 마지막 순수 입력(ScoringOptions 도출) 분리 — @Injectable orchestrator 전 dependency-free 조각"
---

# T-0562 — run-request modelId → ScoringOptions 도출 순수 factory 추가

## Why

P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038) Q-0045 옵션1 run-side 사슬에서, 직전 T-0561(merge 9abf380)까지 dependency-free 순수/순수-ish 조각이 좌표 변환·실행·집계·person 해석까지 전부 닫혔다. 남은 후속 slice 의 loop-level `@Injectable` orchestrator(1'')는 `runUnevaluatedFillBatch(bridges, resolvePerson, options, persist)`(T-0560)를 호출하는데, 그 4 인자 중 `bridges`(dedup T-0551)·`resolvePerson`(T-0561 `buildResolvePersonFn`)·`persist`(generateAndPersist 바인딩)는 이미 닫혔거나 호출자 바인딩이고, 마지막 남은 입력이 `options: ScoringOptions` 의 도출이다. 본 task 는 그 마지막 순수 입력을 — run-request 가 넘긴 선택적 `modelId` 와 default `modelId` 를 받아 검증된 `ScoringOptions` 를 조립하는 dependency-free 순수 factory 로 — 분리해, 후속 `@Injectable` orchestrator 가 modelId 도출/검증 정책을 inline 재구현(빈 문자열/non-string 흘림 / default 분산 risk)하는 대신 본 factory 1 회 호출로 닫게 한다. 이로써 orchestrator slice 는 순수 입력 조립이 0 으로 줄어 DB/DI 배선에만 집중한다.

## Required Reading

- `src/assessment-evaluation/evaluation-scoring.service.ts` (46–49행 `ScoringOptions` interface — `modelId: string` 단일 필드, 그리고 38–48행 modelId 가 평가 정책 차원 선택이라는 주석)
- `src/assessment-evaluation/dto/run-unevaluated-fill-batch.ts` (140–145행 `runUnevaluatedFillBatch` 시그니처 — 본 factory 산출 `ScoringOptions` 가 4번째가 아닌 3번째 인자 `options` 로 흘러감)
- `src/assessment-evaluation/dto/build-resolve-person-fn.ts` (107–148행 — 같은 사슬의 직전 순수 factory 패턴: callable/값 fail-fast 한국어 `TypeError` + 비변형 + `@Injectable` 0 + Prisma/LLM import 0 — 본 factory 가 mirror 할 패턴)
- `src/assessment-evaluation/dto/dedupe-period-bridge-requests.ts` (82–91행 — non-array/null fail-fast 한국어 `TypeError` 메시지 패턴 mirror)

## Acceptance Criteria

본 factory 의 책임: 선택적 run-request `modelId`(string | undefined | null)와 default `modelId`(string)를 받아, 검증된 `ScoringOptions`(= `{ modelId }`, 새 객체)를 반환하는 순수 factory. request 가 비어있으면(undefined/null/빈 문자열/whitespace-only) default 로 fallback, request 가 유효 non-empty string 이면 그것을 trim 하여 채택. default 자체가 비어있으면(빈/whitespace) fail-fast 한국어 `TypeError`(orchestrator 가 modelId 없이 LLM 호출을 흘리지 않도록). 함수명/파일명은 `buildFillRunScoringOptions` / `build-fill-run-scoring-options.ts` 로 한다.

- [ ] `src/assessment-evaluation/dto/build-fill-run-scoring-options.ts` 신설 — `@Injectable` 0, NestJS/Prisma/LLM/class-validator/repository import 0, value import 0(타입만 `import type { ScoringOptions }`), 새 외부 dependency 0. `ScoringOptions`(새 객체) 반환, 입력 비변형.
- [ ] **Happy-path test 1+**: (1) request modelId 가 유효 non-empty string → 그 값(trim)으로 `ScoringOptions` 반환, (2) request 가 undefined → default 로 fallback, 두 경로 모두 검증.
- [ ] **Error path test 1+**: default 가 빈 문자열/whitespace-only → 한국어 메시지 `TypeError` throw 검증(request 도 비어있어 fallback 불가한 상황). request·default 가 string 이 아닌 type(number/object 등) → 한국어 `TypeError` 검증.
- [ ] **Flow / branch test**: request 채택 분기 vs default fallback 분기 vs default 무효 throw 분기 — 각 분기 1+ test 로 분리(분기 3 종).
- [ ] **Negative cases 충분 cover**: request modelId 가 null / 빈 문자열 "" / whitespace-only "  " 각각 → default fallback 으로 수렴(각 1+ test). request 가 유효하지만 default 도 무효인 경우 default 무관하게 채택(request 우선) 검증. request·default 모두 비어 throw. trim 으로 앞뒤 공백 제거 후 채택 검증. 예외 처리 분기마다 cover — 단일 negative 금지.
- [ ] **Coverage**: `pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80%) — 신규 파일은 100% 목표.
- [ ] colocated spec: `src/assessment-evaluation/dto/build-fill-run-scoring-options.spec.ts`(신규 factory 와 같은 디렉토리). NestJS convention + discoverability.
- [ ] `pnpm lint && pnpm build && pnpm test:cov` 전부 clean(전체 test suite green).
- [ ] tester 가 `pnpm lint && pnpm build && pnpm test:cov` 실행 결과를 TESTER trail 에 박제(R-110).

## Out of Scope

- `@Injectable` orchestrator service 화 / DI 등록 / module provider 등록 — 후속 slice(1''). 본 factory 는 순수 값 변환만.
- personId → ServiceIdentity DB 조회 실배선(`buildResolvePersonFn` 의 lookup 을 `PersonRepository.findByIdWithIdentities` 에 바인딩) — 후속 slice.
- `runUnevaluatedFillBatch` 호출 / persist=generateAndPersist 바인딩 / dedup(T-0551) 호출 결합 — 후속 orchestrator slice.
- POST /unevaluated-fill-run controller route / RBAC(self-only + Admin 임의 personId) / run-request DTO(class-validator) — 후속 slice. 본 factory 는 modelId 도출만, request body 검증 decorator 0.
- `temperature` 등 modelId 외 scoring 파라미터 — `ScoringOptions` 는 현재 `modelId` 단일 필드(evaluation-scoring.service.ts 47–48행). 필드 확장 0.
- default modelId 의 source(env / config / 상수) 결정 — 본 factory 는 default 를 인자로 받기만 한다(source 결정은 호출자 책임).
- e2e / 실 PostgreSQL / 실 LLM round-trip — 후속 slice. 본 task 의 빌드/unit 은 mock 없이도 순수(외부 의존 0).

## Suggested Sub-agents

implementer → tester

## Follow-ups

- (1'') loop-level `@Injectable` orchestrator slice — dedup(T-0551) → `buildResolvePersonFn(repo.findByIdWithIdentities 바인딩)`(T-0561) → `buildFillRunScoringOptions`(본 task) → `runUnevaluatedFillBatch`(T-0560, persist=generateAndPersist 바인딩) 결합 + module provider 등록. PersonRepository/PeriodBridgeAdminPersistService DI 라 `commitMode: pr`, R-112 + coverage ≥80%, live-LLM 배선검증(ADR-0045, LAN 수동) 동반 가능하나 빌드/unit 은 mock.
- (2) POST /unevaluated-fill-run controller route + RBAC(self-only + Admin 임의 personId) + run-request DTO(class-validator, modelId optional) + response 매핑.
- (3) e2e — supertest 로 라우트 → 영속 → response 경로(mock LLM 또는 LAN live-LLM).
