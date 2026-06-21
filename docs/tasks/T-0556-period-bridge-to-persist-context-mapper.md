---
id: T-0556
title: PeriodBridgeDto → EvaluationPersistContext 순수 좌표 매퍼 추가
phase: P5
status: DONE
completedAt: 2026-06-21T07:20:00Z
mergedAt: 2026-06-21T07:18:00Z
mergeCommit: 376563f
prNumber: 471
commitMode: pr
coversReq: [REQ-037, REQ-038]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-21
hqOrigin: Q-0045
independentStream: unevaluated-fill-run
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/dto/period-bridge-to-persist-context.mapper.ts
  - src/assessment-evaluation/dto/period-bridge-to-persist-context.mapper.spec.ts
plannerNote: "P5 bullet 106 / R-64 — Q-0045 옵션1 run-side chain 재개 첫 slice. ADR 불요(기존 ADR-0037/영속 타입 재사용, 새 경계 0) 순수 좌표 매퍼."
---

# T-0556 — PeriodBridgeDto → EvaluationPersistContext 순수 좌표 매퍼 추가

## Why

PLAN.md P5 bullet 106 (R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038) 의 미평가 fill flow 는 plan→execute 양방향 compose 진입점까지 완결됐다 (입력-side `composeUnevaluatedFillBridgeRequests` T-0554, 출력-side `composeUnevaluatedFillRunResponse` T-0555). Q-0045 가 옵션1 (impure run orchestrator + POST /unevaluated-fill-run chain) 으로 RESOLVED 되어 run-side 사슬을 재개한다.

향후 impure run orchestrator 는 중복 제거된 `PeriodBridgeDto[]` 각 좌표를 기존 per-좌표 영속 진입점 `PeriodBridgeAdminPersistService.generateAndPersist(person, period, options, context, reevaluate)` 로 흘려보낸다. 그 호출의 `context` 인자 타입 `EvaluationPersistContext` 는 `periodStart` 를 `Date` 로 받지만 (`src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts:47`), `PeriodBridgeDto.periodStart` 는 ISO `string` 이다. 본 task 는 그 좌표 1 개를 영속 context shape 으로 결정적으로 변환하는 **dependency-free 순수 매퍼** 1 조각을 추가한다 — orchestrator 가 매 좌표마다 이 변환을 inline 재구현 (Invalid Date silent 진입 risk) 하는 대신 single source 로 박제한다. T-0549..T-0555 의 small-slice 패턴 (순수 조각 → 후속 compose/wiring) 을 그대로 이어간다.

기존 ADR-0037 period→collection→evaluate bridge + 기존 영속 타입 (`EvaluationPersistContext`) 을 재사용하며 새 persistence/REQ-032/auth/dependency 경계를 도입하지 않으므로 (CLAUDE.md §3.1 rule4 / §5) **ADR 불요** — 바로 구현 slice 다.

## Required Reading

- `docs/tasks/T-0551-dedupe-period-bridge-requests.md` — 본 매퍼의 입력 `PeriodBridgeDto[]` 를 산출하는 직전 조각의 책임/방어 패턴.
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 입력 `PeriodBridgeDto` 의 4 좌표 축 (personId/period/scope/periodStart:string) + reevaluate.
- `src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts` (47–52행) — 출력 타입 `EvaluationPersistContext` 정의 (personId/period/scope/periodStart:**Date**). 본 매퍼는 이 타입을 `import type` 재사용 (새 타입 발명 0).
- `src/assessment-evaluation/domain/evaluation-persisted-period-coordinates.ts` (67–72행) — Invalid Date 방어 관용구 `!(value instanceof Date) || Number.isNaN(value.getTime())` + 한국어 `TypeError` 패턴 (본 매퍼는 string→Date 변환 후 동형 방어로 Invalid Date 좌표를 명시 거부).
- `src/assessment-evaluation/dto/dedupe-period-bridge-requests.ts` — null/undefined·non-array fail-fast 한국어 `TypeError`(인덱스 포함) + 비변형 + @Injectable 0 + Prisma/LLM import 0 의 순수-조각 작성 관행 mirror.
- `src/assessment-evaluation/dto/dedupe-period-bridge-requests.spec.ts` — colocated spec 의 happy/error/branch/negative 구조 mirror.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/period-bridge-to-persist-context.mapper.ts` 신설 — `toEvaluationPersistContext(bridge: PeriodBridgeDto): EvaluationPersistContext` 순수 함수 export.
  - personId/period/scope 는 변형 없이 그대로 전사한다 (pass-through).
  - periodStart (ISO string) 는 `new Date(...)` 로 변환하되, 결과가 Invalid Date (`Number.isNaN(getTime())`) 면 한국어 메시지 `TypeError` 로 명시 거부 (silent Invalid Date 진입 차단). 비-string / 빈 string 도 동형 거부.
  - 입력 `bridge` 객체를 mutate 하지 않는다 (새 객체 반환). `reevaluate` flag 는 영속 context 축이 아니므로 출력에 포함하지 않는다 (Out of Scope).
  - `@Injectable` 0, NestJS/Prisma/LLM/class-validator 런타임 호출·repository import 0 — `PeriodBridgeDto` / `EvaluationPersistContext` 타입만 import (새 외부 dependency 0).
- [ ] happy-path unit test: 유효한 4 좌표 `PeriodBridgeDto` → `EvaluationPersistContext` 변환 (personId/period/scope 전사, periodStart 가 올바른 Date 인스턴스로 변환, getTime() 일치) 1+.
- [ ] error path unit test: `bridge` 가 null/undefined 일 때 한국어 `TypeError` 1+; periodStart 가 Invalid Date 를 만드는 string (예: "not-a-date") / 빈 string / 비-string 일 때 한국어 `TypeError` 각 1+.
- [ ] flow / branch coverage: 유효 변환 분기 + Invalid Date 거부 분기 각 1+ test (분기마다 cover).
- [ ] negative cases 충분 cover: null/undefined bridge, Invalid Date periodStart, 빈 string periodStart, 비-string periodStart, 입력 비변형 (반환 후 입력 객체 unchanged 단언), reevaluate 가 출력에 누락됐는지 단언 — 예외/경계 상황마다 각 1+ test (단일 negative 만 작성 금지).
- [ ] regression test (hqOrigin Q-0045): periodStart string→Date 변환이 Invalid Date 를 silent 통과시키면 fail 하는 test 1+ (Q-0045 run-side chain 의 좌표 무결성 회귀 방지).
- [ ] colocated spec 위치: `src/assessment-evaluation/dto/period-bridge-to-persist-context.mapper.spec.ts` (mapper 와 같은 디렉토리).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 분기 단순하므로 100% 목표).

## Out of Scope

- impure run orchestrator 실배선 (중복 제거된 `PeriodBridgeDto[]` → per-좌표 person 해석 → fresh-collect → LLM 평가 → 영속 → outcome 산출) — 후속 slice. 본 매퍼는 좌표 1 개 → context shape 변환까지만.
- POST /unevaluated-fill-run controller route / RBAC / run-request DTO 신설 — 후속 slice.
- `PeriodBridgeAdminPersistService.generateAndPersist` 호출·person 해석·`ScoringOptions`/`period.since` 도출 — 본 매퍼는 `context` 인자 1 개만 만든다.
- `reevaluate` flag 처리 — 영속 context 축이 아니므로 출력에서 제외 (orchestrator 가 별도 인자로 전달).
- `EvaluationResult` 타입 직접 import / 평가문 본문 보유 (REQ-032 raw-not-stored 정합) — 0.
- LLM 네트워크 호출 / live-LLM 검증 (standing 게이트 ADR-0045) — 건드리지 않음.
- 배열 단위 처리 — 본 매퍼는 좌표 1 개 단위. 배열 map 은 호출자 (후속 orchestrator) 책임.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
