---
id: T-0557
title: PeriodBridgeAdminPersistResult + 좌표 → UnevaluatedFillRunOutcome 순수 매퍼 추가
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-06-21
hqOrigin: Q-0045
independentStream: unevaluated-fill-run
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/dto/persist-result-to-run-outcome.mapper.ts
  - src/assessment-evaluation/dto/persist-result-to-run-outcome.mapper.spec.ts
plannerNote: "P5 bullet 106 / R-64 — Q-0045 옵션1 run-side chain 다음 slice. 영속 결과 + 좌표 → UnevaluatedFillRunOutcome 순수 매퍼. ADR 불요(기존 타입 재사용). live-LLM 게이트 무관."
---

# T-0557 — PeriodBridgeAdminPersistResult + 좌표 → UnevaluatedFillRunOutcome 순수 매퍼 추가

## Why

PLAN.md P5 bullet 106 (R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038) 의 미평가 fill flow 는 Q-0045 옵션1 (impure run orchestrator + POST /unevaluated-fill-run chain) 으로 RESOLVED 되어 run-side 사슬을 재개했다. 직전 T-0556 (merge 376563f) 이 `PeriodBridgeDto → EvaluationPersistContext` 좌표 매퍼를 닫아, orchestrator 가 각 좌표를 영속 진입점 `PeriodBridgeAdminPersistService.generateAndPersist(person, period, options, context, reevaluate)` 로 흘려보낼 `context` 인자를 결정적으로 산출하는 조각을 박제했다.

그 영속 호출은 `PeriodBridgeAdminPersistResult` (`{ assessment: Assessment, created: boolean }`, `src/assessment-evaluation/period-bridge-admin-persist.service.ts:68`) 를 반환한다. 한편 출력-side 집계 조각 T-0552 `aggregateUnevaluatedFillRunResult` 는 `UnevaluatedFillRunOutcome[]` (좌표 4 축 echo + 결정적 `status: "evaluated" | "skipped" | "failed"` + 선택 `evaluatedCount`) 를 입력으로 받는다. 즉 영속 반환 shape 과 집계 입력 shape 사이에 **per-좌표 변환 조각이 빠져 있다** — orchestrator 가 매 좌표마다 이 변환 (created → status 매핑, 좌표 echo) 을 inline 재구현하면 status 도출 규칙이 분산되어 회귀 risk 가 생긴다.

본 task 는 그 결손 조각을 채우는 **dependency-free 순수 매퍼** `toUnevaluatedFillRunOutcome(bridge: PeriodBridgeDto, result: PeriodBridgeAdminPersistResult): UnevaluatedFillRunOutcome` 를 추가한다. 좌표 4 축은 source `PeriodBridgeDto` 에서 그대로 echo 하고, status 는 `result.created` 에서 결정적으로 도출한다 (`created === true` → `"evaluated"` — 본 호출이 새 평가를 영속, `created === false` → `"skipped"` — first-write-wins read-through 로 기존 저장본 반환, write 0). 이는 T-0549..T-0556 의 small-slice 패턴 (순수 조각 → 후속 compose/wiring) 을 그대로 이어가며, single source 로 status 매핑을 박제해 후속 impure orchestrator 가 좌표별 outcome 을 1 회 호출로 산출하게 한다.

`"failed"` status 도출은 본 매퍼의 책임이 아니다 — 그것은 `generateAndPersist` 가 reject (예외) 한 좌표를 orchestrator 가 try/catch 로 잡아 산출할 outcome 이며 (영속 결과가 존재하지 않으므로), 본 매퍼는 **영속이 성공해 결과가 반환된 좌표만** evaluated/skipped 로 매핑한다. failed 경로의 outcome 합성은 후속 orchestrator wiring slice 가 책임진다.

기존 ADR-0037 period→collection→evaluate bridge + 기존 타입 (`PeriodBridgeDto` / `PeriodBridgeAdminPersistResult` / `UnevaluatedFillRunOutcome`) 만 재사용하며 새 persistence/REQ-032/auth/dependency 경계를 도입하지 않으므로 (CLAUDE.md §3.1 rule4 / §5) **ADR 불요** — 바로 구현 slice 다. LLM 네트워크 호출이 0 이라 live-LLM standing 게이트 (ADR-0045) 와도 무관하다.

## Required Reading

- `docs/tasks/T-0556-period-bridge-to-persist-context-mapper.md` — 직전 좌표 매퍼 slice 의 책임/방어/colocated spec 패턴 (본 매퍼와 동형의 순수-조각 작성 관행).
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 입력 `PeriodBridgeDto` 의 4 좌표 축 (personId/period/scope/periodStart:string) + 선택 reevaluate. 본 매퍼는 이 4 축을 outcome 으로 echo (`periodStart` 는 이미 string 축이라 추가 직렬화 불요).
- `src/assessment-evaluation/dto/unevaluated-fill-run-result.ts` (36–81행) — 출력 타입 `UnevaluatedFillRunOutcome` (좌표 4 축 + status union + 선택 evaluatedCount/reason) + status union `UnevaluatedFillRunStatus` + type-guard `isUnevaluatedFillRunStatus`. 본 매퍼는 이 타입을 `import type` 으로 재사용 (새 타입 발명 0).
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` (60–71행) — 입력 `PeriodBridgeAdminPersistResult` 정의 (`assessment: Assessment` + `created: boolean`) 와 분기별 `created` semantics (default fill: 새 create 면 true / read-through 면 false; reeval: 항상 true). 본 매퍼는 `created` → status 도출의 근거로 이 doc 을 따른다. 본 매퍼는 이 타입을 `import type` 으로만 재사용 (service 인스턴스/메서드 호출 0).
- `src/assessment-evaluation/dto/dedupe-period-bridge-requests.ts` — null/undefined fail-fast 한국어 `TypeError` + 비변형 + `@Injectable` 0 + Prisma/LLM import 0 의 순수-조각 작성 관행 mirror.
- `src/assessment-evaluation/dto/period-bridge-to-persist-context.mapper.spec.ts` — colocated spec 의 happy/error/branch/negative/regression 구조 mirror.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/persist-result-to-run-outcome.mapper.ts` 신설 — `toUnevaluatedFillRunOutcome(bridge: PeriodBridgeDto, result: PeriodBridgeAdminPersistResult): UnevaluatedFillRunOutcome` 순수 함수 export.
  - 좌표 4 축 (personId/period/scope/periodStart) 은 `bridge` 에서 변형 없이 그대로 echo (pass-through).
  - status 는 `result.created` 에서 결정적으로 도출: `created === true` → `"evaluated"`, `created === false` → `"skipped"`. (boolean 외 값 방어는 아래 error path 참조.)
  - 입력 `bridge` / `result` 객체를 mutate 하지 않는다 (새 outcome 객체 반환).
  - `evaluatedCount` 처리: 본 v1 에서는 영속 결과로부터 정확한 생성 건수를 안전하게 도출할 단일 신뢰 source 가 없으므로 (Assessment row 에는 contributionCount 컬럼이 없고 service 반환 result 에도 미노출) **evaluatedCount 를 outcome 에 설정하지 않는다** (미설정 → T-0552 집계에서 0 으로 취급). 이 결정을 코드 주석과 spec 에 명시 고정한다 (후속 slice 가 정확 건수 노출 시 채움 — Follow-ups).
  - `reason` 은 evaluated/skipped echo 에 불필요하므로 설정하지 않는다 (failed 경로의 사유는 orchestrator 책임 — Out of Scope).
  - `@Injectable` 0, NestJS/Prisma/LLM/class-validator 런타임 호출·repository import 0 — `PeriodBridgeDto` / `PeriodBridgeAdminPersistResult` / `UnevaluatedFillRunOutcome` 타입만 `import type` (새 외부 dependency 0).
- [ ] happy-path unit test: (a) `created === true` 인 result + 유효 `PeriodBridgeDto` → status `"evaluated"` + 좌표 4 축 echo 정확 1+; (b) `created === false` → status `"skipped"` + 좌표 echo 정확 1+.
- [ ] error path unit test: `bridge` 가 null/undefined 일 때 한국어 `TypeError` 1+; `result` 가 null/undefined 일 때 한국어 `TypeError` 1+; `result.created` 가 boolean 이 아닐 때 (예: undefined / "true" / 1) 한국어 `TypeError` 각 1+ (status 가 union 밖 값으로 silent 진입하는 것 차단).
- [ ] flow / branch coverage: `created === true` 분기 + `created === false` 분기 각 1+ test (분기마다 cover). 입력 방어 분기 (bridge null / result null / created 비-boolean) 각 1+.
- [ ] negative cases 충분 cover: null/undefined bridge, null/undefined result, result.created 비-boolean (undefined·string·number 각 1+), 입력 비변형 (반환 후 bridge·result 객체 unchanged 단언), 반환 outcome 이 입력과 별개 객체 단언 — 예외/경계 상황마다 각 1+ test (단일 negative 만 작성 금지).
- [ ] regression test (hqOrigin Q-0045): `result.created` 가 boolean 이 아닌데도 status 가 silent 으로 union 밖 값이 되면 fail 하는 test 1+, 그리고 status 도출이 created 와 역전 (true→skipped / false→evaluated) 되면 fail 하는 test 1+ (Q-0045 run-side chain 의 outcome 무결성 회귀 방지).
- [ ] colocated spec 위치: `src/assessment-evaluation/dto/persist-result-to-run-outcome.mapper.spec.ts` (mapper 와 같은 디렉토리). describe/it 라벨 한국어 명확화 (§12). `Assessment` 의존 부분은 plain 객체 stub 으로 충족 (실 Prisma/DB 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 분기 단순하므로 100% 목표).

## Out of Scope

- impure run orchestrator 실배선 (중복 제거된 `PeriodBridgeDto[]` → per-좌표 person 해석 → `generateAndPersist` 호출 → outcome 산출 → `aggregateUnevaluatedFillRunResult`) — 후속 slice. 본 매퍼는 좌표 1 개 + 영속 결과 1 개 → outcome 1 개 변환까지만.
- `"failed"` status outcome 합성 — `generateAndPersist` 가 reject 한 좌표를 orchestrator 가 try/catch 로 잡아 산출하는 경로 (영속 결과 부재). 본 매퍼는 **영속 성공 결과가 반환된 좌표만** evaluated/skipped 로 매핑.
- `generateAndPersist` 호출·person 해석·`ScoringOptions`/`period.since` 도출·`PeriodBridgeAdminPersistService` 인스턴스 사용 — 본 매퍼는 이미 반환된 `result` 객체만 읽는다.
- `evaluatedCount` 정확 건수 도출 — 본 v1 미설정 (안전 source 부재). 후속 slice 가 service 반환에 건수 노출 시 채움.
- POST /unevaluated-fill-run controller route / RBAC / run-request DTO 신설 — 후속 slice.
- `EvaluationResult` 타입 직접 import / 평가문 본문 보유 (REQ-032 raw-not-stored 정합) — 0.
- `Assessment` 의 contributionScore/narrative 등 평가 본문 필드 읽기 — 0. 본 매퍼는 좌표 echo + created→status 만.
- LLM 네트워크 호출 / live-LLM 검증 (standing 게이트 ADR-0045) — 건드리지 않음.
- 배열 단위 처리 — 본 매퍼는 좌표 1 개 단위. 배열 map 은 호출자 (후속 orchestrator) 책임.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append. 특히: 후속 orchestrator slice 가 `generateAndPersist` 반환에 생성 평가 건수를 노출하면 본 매퍼의 `evaluatedCount` 미설정을 채우는 follow-up 박제.)
