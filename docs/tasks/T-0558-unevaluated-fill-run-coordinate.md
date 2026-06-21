---
id: T-0558
title: 좌표 1개 미평가 fill 실행 helper (generateAndPersist 호출 + failed try/catch outcome 합성)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-037, REQ-038]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-21
hqOrigin: Q-0045
independentStream: unevaluated-fill-run
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/dto/run-unevaluated-fill-coordinate.ts
  - src/assessment-evaluation/dto/run-unevaluated-fill-coordinate.spec.ts
plannerNote: "P5 bullet 106 / R-64 — Q-0045 옵션1 run-side chain 다음 slice. 좌표 1개 impure 실행 helper(영속 runner 호출 + 성공→T-0557 매퍼, reject→failed try/catch 합성). 영속 runner 를 param 으로 받아 build-time dependency-free, mock-unit. live-LLM 게이트 무관(빌드/unit 은 mock). pr-mode 단독 claim(stage5b)."
---

# T-0558 — 좌표 1개 미평가 fill 실행 helper (generateAndPersist 호출 + failed try/catch outcome 합성)

## Why

PLAN.md P5 bullet 106 (R-64 / REQ-037 "평가 없는 부분 일괄 평가" / REQ-038) 의 미평가 fill flow 는 Q-0045 옵션1 (impure run orchestrator + POST /unevaluated-fill-run chain) 으로 RESOLVED 되어 run-side 사슬을 재개했다. dependency-free 순수 입력/출력 조각 (T-0549..T-0557) 은 전부 닫혔다 — 입력-side (batch plan → `UnevaluatedFillRequest[]` → `PeriodBridgeDto[]` → dedup → compose), run-side 좌표 변환 (T-0556 `toEvaluationPersistContext`, T-0557 `toUnevaluatedFillRunOutcome`), 출력-side 집계/직렬화 (T-0552/T-0553/T-0555).

남은 것은 **impure run orchestrator 실배선**이다. 그 전체 wiring (중복 제거된 `PeriodBridgeDto[]` → per-좌표 person 해석 → `generateAndPersist` 순회 호출 → try/catch failed 합성 → `aggregateUnevaluatedFillRunResult`) 은 새 `@Injectable` service + person 해석 + 좌표 순회 loop + module 등록 + spec 까지 묶이면 cap (300 LOC / 5 파일) 을 넘는다. 따라서 가장 작은 impure 단위 — **좌표 1 개 실행 + outcome 합성** — 을 먼저 박제한다.

본 task 는 좌표 1 개를 영속 진입점 `PeriodBridgeAdminPersistService.generateAndPersist` 로 흘려보내고 그 결과(또는 reject)를 `UnevaluatedFillRunOutcome` 1 개로 합성하는 helper `runUnevaluatedFillCoordinate(bridge, runner)` 를 추가한다. 핵심은 **failed status 합성을 단일 source 로 박제**하는 것이다 — T-0557 매퍼는 영속이 **성공해 결과가 반환된** 좌표만 evaluated/skipped 로 매핑하고, `generateAndPersist` 가 reject (수집 0 / LLM 오류 / persist 실패) 한 좌표의 `failed` outcome 합성은 명시적으로 그 매퍼의 Out of Scope 였다 (T-0557 §Out of Scope). 본 helper 가 그 try/catch failed 경로를 채워, 후속 loop-level orchestrator 가 좌표마다 inline try/catch 를 재구현 (failed 좌표 echo 누락 / reason 분산 risk) 하는 대신 본 helper 1 회 호출로 좌표 1 개 → outcome 1 개를 닫게 한다.

**build-time dependency-free 보장**: 본 helper 는 `@Injectable` 이 아니라, 영속 호출을 추상화한 **`runner` 함수를 인자로 받는** 순수-ish 함수다. `runner: () => Promise<PeriodBridgeAdminPersistResult>` shape 으로 좌표 1 개의 영속 호출을 캡슐화해 넘기면 (person 해석 / `ScoringOptions` / `period.since` / `reevaluate` 인자 조립은 호출자 = 후속 orchestrator 책임), 본 helper 는 그 runner 를 await 하고 성공 시 T-0557 매퍼 위임, reject 시 failed outcome 합성만 한다. 이 의존성 주입(runner-as-param) 패턴으로 본 helper 는 `PeriodBridgeAdminPersistService` 인스턴스를 import 하지 않아 **빌드/unit 이 mock runner 로 완결**되고 — `generateAndPersist` 가 내부적으로 LLM 을 호출하더라도 본 helper 의 unit test 는 mock runner 라 LLM 네트워크 0 이다. live-LLM standing 게이트 (ADR-0045) 와 무관하다.

기존 ADR-0037 (bridge) + ADR-0038 (reevaluate) + 기존 타입 (`PeriodBridgeDto` / `PeriodBridgeAdminPersistResult` / `UnevaluatedFillRunOutcome`) 과 T-0557 매퍼만 재사용하며 새 persistence/REQ-032/auth/dependency 경계를 도입하지 않으므로 (CLAUDE.md §3.1 rule4 / §5) **ADR 불요** — 바로 구현 slice 다.

## Required Reading

- `docs/tasks/T-0557-persist-result-to-run-outcome-mapper.md` — 직전 성공-path outcome 매퍼 slice 의 책임/방어/colocated spec 패턴 + 그 §Out of Scope 가 본 task 로 넘긴 `failed` 경로 책임 명시 (본 helper 가 그 결손을 채운다).
- `src/assessment-evaluation/dto/persist-result-to-run-outcome.mapper.ts` — 본 helper 가 **성공 path 에서 위임**할 `toUnevaluatedFillRunOutcome(bridge, result)` (좌표 echo + created→evaluated/skipped). 본 helper 는 이 매퍼를 재구현하지 않고 호출한다.
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 입력 `PeriodBridgeDto` 의 4 좌표 축 (personId/period/scope/periodStart:string). failed outcome 도 이 4 축을 echo 해야 한다.
- `src/assessment-evaluation/dto/unevaluated-fill-run-result.ts` (36–81행) — 출력 타입 `UnevaluatedFillRunOutcome` (좌표 4 축 + status union + 선택 evaluatedCount/reason) + `UnevaluatedFillRunStatus`. failed outcome 은 status `"failed"` + 좌표 echo + reason(에러 메시지)으로 합성. 본 helper 는 이 타입을 `import type` 재사용.
- `src/assessment-evaluation/period-bridge-admin-persist.service.ts` (60–136행) — 영속 진입점 `generateAndPersist` 의 반환 `PeriodBridgeAdminPersistResult` (`{ assessment, created }`) shape 과 실패 전파 정책 (buildCollectionSpec/evaluateActivities reject 전파, reeval 경로 모든 error 전파). 본 helper 의 `runner` 는 이 메서드 1 회 호출을 캡슐화한 thunk 이며, 본 helper 는 그 타입만 `import type` 재사용 (service 인스턴스/메서드 직접 호출 0 — runner 가 추상화).
- `src/assessment-evaluation/dto/dedupe-period-bridge-requests.ts` — null/undefined fail-fast 한국어 `TypeError` + 비변형 + `@Injectable` 0 + Prisma/LLM import 0 의 순수-조각 작성 관행 mirror.
- `src/assessment-evaluation/dto/period-bridge-to-persist-context.mapper.spec.ts` — colocated spec 의 happy/error/branch/negative/regression 구조 mirror (async 매퍼이므로 async test 형태로 변형).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/dto/run-unevaluated-fill-coordinate.ts` 신설 — `async function runUnevaluatedFillCoordinate(bridge: PeriodBridgeDto, runner: () => Promise<PeriodBridgeAdminPersistResult>): Promise<UnevaluatedFillRunOutcome>` export.
  - 성공 path: `runner()` 가 `PeriodBridgeAdminPersistResult` 로 resolve → `toUnevaluatedFillRunOutcome(bridge, result)` (T-0557) 를 호출해 evaluated/skipped outcome 반환 (재구현 0 — 위임).
  - failed path: `runner()` 가 reject (throw) → try/catch 로 잡아 `{ ...좌표 4 축 echo, status: "failed", reason: <에러 메시지> }` outcome 합성 반환. 에러를 caller 로 재던지지 않는다 (좌표 1 개 실패가 batch-run 전체를 중단시키지 않도록 — REQ-037 일괄 평가의 부분 실패 흡수).
  - reason 합성: catch 한 에러가 `Error` 인스턴스면 `error.message`, 아니면 `String(error)` 를 reason 으로 (안전 직렬화). reason 은 사람-친화 echo 로만 쓰이며 집계 카운트에는 영향 0 (T-0552 는 reason 미사용).
  - failed outcome 의 좌표 4 축 (personId/period/scope/periodStart) 은 `bridge` 에서 변형 없이 echo. `evaluatedCount` 는 failed 에 설정하지 않는다 (T-0552 가 evaluated status 만 합산).
  - 입력 `bridge` 객체를 mutate 하지 않는다.
  - `@Injectable` 0, NestJS/Prisma/LLM/class-validator 런타임 호출·repository import 0 — `PeriodBridgeDto` / `PeriodBridgeAdminPersistResult` / `UnevaluatedFillRunOutcome` 타입만 `import type`, `toUnevaluatedFillRunOutcome` 만 value import (새 외부 dependency 0).
- [ ] happy-path unit test: (a) `runner` 가 `created === true` result 로 resolve → status `"evaluated"` + 좌표 echo 정확 1+; (b) `runner` 가 `created === false` result 로 resolve → status `"skipped"` + 좌표 echo 정확 1+; (c) `runner` 가 reject → status `"failed"` + 좌표 echo + reason 정확 1+ (성공 2 분기 + 실패 1 분기 happy 흐름 각 1+).
- [ ] error path unit test: `bridge` 가 null/undefined 일 때 한국어 `TypeError` 1+ (runner 호출 전 fail-fast — bridge 좌표 echo 불가); `runner` 가 함수가 아닐 때 (null/undefined/비-function) 한국어 `TypeError` 1+ (호출 전 방어).
- [ ] flow / branch coverage: 성공 분기 (resolve) + 실패 분기 (reject→failed) 각 1+ test (try/catch 양 분기 cover). 입력 방어 분기 (bridge null / runner 비-function) 각 1+. reason 합성 분기 (`Error` 인스턴스 vs 비-Error throw 값) 각 1+ test.
- [ ] negative cases 충분 cover: null/undefined bridge, 비-function runner, runner 가 `Error` 객체 reject, runner 가 string/숫자/null 같은 비-Error 값 reject (각 reason 합성이 안전 직렬화되는지), 입력 비변형 (반환 후 bridge 객체 unchanged 단언), failed outcome 이 입력과 별개 객체 단언 — 예외/경계 상황마다 각 1+ test (단일 negative 만 작성 금지).
- [ ] regression test (hqOrigin Q-0045): runner reject 시 helper 가 에러를 **재던지지 않고** failed outcome 으로 흡수하는지 (재던지면 fail 하는 test) 1+; failed outcome 의 좌표 4 축이 bridge echo 와 어긋나면 fail 하는 test 1+ (Q-0045 run-side chain 의 부분 실패 흡수 + 좌표 무결성 회귀 방지).
- [ ] colocated spec 위치: `src/assessment-evaluation/dto/run-unevaluated-fill-coordinate.spec.ts` (helper 와 같은 디렉토리). describe/it 라벨 한국어 명확화 (§12). `runner` 는 jest mock 함수 (`jest.fn().mockResolvedValue(...)` / `.mockRejectedValue(...)`) 로 충족 (실 service/LLM/DB 0). `PeriodBridgeAdminPersistResult.assessment` 는 plain 객체 stub.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80% — 신규 파일은 분기 단순하므로 100% 목표).

## Out of Scope

- loop-level impure orchestrator 실배선 (중복 제거된 `PeriodBridgeDto[]` → per-좌표 person 해석 → `generateAndPersist` 인자 조립 → 본 helper 순회 호출 → `aggregateUnevaluatedFillRunResult`) — 후속 slice. 본 helper 는 좌표 1 개 + runner 1 개 → outcome 1 개까지만. 배열 map / 좌표 순회는 호출자 책임.
- person 해석 (personId → resolved `PeriodBridgePersonInput`) / `ScoringOptions` 도출 / `period.since` 도출 / `reevaluate` flag 결정 / `EvaluationPersistContext` 조립 (T-0556 매퍼 호출) — 전부 `runner` thunk 안에 캡슐화되어 호출자 책임. 본 helper 는 runner 를 await 만 한다.
- `PeriodBridgeAdminPersistService` 인스턴스 import / `@Injectable` service 화 / DI 등록 — 본 helper 는 순수 함수 (runner-as-param). module 등록은 후속 orchestrator slice 가 service 화될 때.
- POST /unevaluated-fill-run controller route / RBAC (Admin 임의 personId / User self-only) / run-request DTO 신설 — 후속 slice.
- e2e / 실 PostgreSQL / 실 LLM round-trip — 후속 slice (live-LLM 배선검증은 ADR-0045 standing 게이트, LAN 수동 1 회, 만료 2026-06-30). 본 task 의 빌드/unit 은 mock runner 라 LLM 0.
- `evaluatedCount` 정확 건수 도출 — 본 helper 는 성공 path 를 T-0557 매퍼에 위임하므로 그 매퍼의 v1 미설정 정책을 그대로 계승 (failed 에도 미설정).
- `EvaluationResult` 타입 직접 import / 평가문 본문 보유 (REQ-032 raw-not-stored 정합) — 0.
- 좌표 1 개 실패 시 batch 전체 abort / retry / 재시도 정책 — 본 helper 는 단순 failed 흡수만. retry 는 (필요 시) 후속 orchestrator 정책.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 append.)

남은 chain slice (참고 — 본 task 완료 후 planner 가 순차 큐잉):
1. loop-level impure orchestrator (`@Injectable` service): dedup 된 `PeriodBridgeDto[]` → per-좌표 person 해석 + `ScoringOptions`/`period.since`/`reevaluate`/`context`(T-0556) 조립 → 본 helper(T-0558) 순회 호출 → `aggregateUnevaluatedFillRunResult`(T-0552). + module 등록. (live-LLM 배선검증 동반 가능 — 단 빌드/unit 은 mock.)
2. POST /unevaluated-fill-run controller route + RBAC + run-request DTO.
3. e2e (실 PostgreSQL; LLM 은 mock 또는 LAN 수동 1 회 배선검증).
