---
id: T-1938
title: REQ-004 좌표 종합 코멘트 arc doc-sync — api.md §5 route 행 + 합계 재집계 + REQ-004 재판정 1 회
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-004]
estimatedDiff: 55
estimatedFiles: 2
created: 2026-09-07
independentStream: p5-summary-aggregate-http
dependsOn: [T-1936, T-1937]
touchesFiles:
  - docs/architecture/api.md
  - docs/requirements.md
plannerNote: "P5 REQ-004 arc closeout — T-1936·T-1937 머지로 HTTP 진입점이 닫혀 api.md route 행 + 23 행 재판정 1 회 (doc-only, PLAN 183 행 once-rule)"
---

# T-1938 — REQ-004 좌표 종합 코멘트 arc doc-sync — api.md §5 route 행 + 합계 재집계 + REQ-004 재판정 1 회

## Why

[T-1936](T-1936-summary-aggregate-request-dto.md) (요청 DTO, PR #1519) → [T-1937](T-1937-summary-aggregate-endpoint.md) (`@Post("summary")` endpoint, PR #1520) 2 단이 모두 main 에 머지돼 REQ-004 의 잔여 축 "좌표 종합 코멘트의 HTTP 진입점 부재" 가 실제로 닫혔다. 그러나 **문서 두 곳이 코드보다 뒤처져 있다** — 계약 정본인 [api.md](../architecture/api.md) `§ 5` 에 신규 route 행이 없고, [requirements.md](../requirements.md) `23 행` REQ-004 의 판정 본문은 여전히 "좌표 종합 코멘트의 HTTP 진입점 **부재**" / "좌표 종합 코멘트는 HTTP 진입점이 **0** 이라 … API 로 도달하지 않고" 라는 **이제 거짓인 서술** 을 담고 있다. 본 slice 가 두 문서를 코드 실측으로 동기해 arc 를 종결한다. T-1937 `Follow-ups (a)` + `(b)` 를 한 task 로 묶은 것이며, 직전 동형 선례 [T-1935](T-1935-req036-relative-comparison-doc-sync-rejudge.md) (REQ-036 arc doc-sync, main `6cb486e9`, 코드 0 LOC) 와 절차가 같다.

**issue-still-relevant pre-check (origin/main `e277c0ec` 실측)**:

1. `git grep -n 'assessment-evaluation/summary' origin/main -- docs/architecture/api.md` 히트 **0 행** — `§ 5` 표에 종합 코멘트 route 행이 아직 없다 (재큐잉 아님). 현 합계는 `170 행` 의 `85 endpoint / shipped 80 / 18 prefix`, 집계 규칙 `172 행` 의 `(현재 85)` · `(현재 표 85 / shipped 80)` 이고 `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 실측도 **85** 라 표와 표기가 일치한 상태다 (즉 본 task 가 더할 것은 정확히 1).
2. `docs/requirements.md` `23 행` 은 `IN_PROGRESS` 이며 status 괄호 머리가 "… / 프런트 노출 축 · 기간 종료 경계 · **좌표 종합 코멘트의 HTTP 진입점 부재**" 로, 말미 "한계" 절이 "**좌표 종합 코멘트는 HTTP 진입점이 0 이라** '지정 기간의 주요 활동 요약' 이 API 로 도달하지 않고 단위별 평가문만 노출된다" 로 끝난다 — T-1936 · T-1937 머지 전 사실이라 현재는 거짓. 재판정 미수행 상태 확인 (REQ-004 재판정 task 는 본 task 가 처음이자 1 회).
3. 반대로 **코드 2 단은 전부 main 에 안착**: 요청 DTO `src/assessment-evaluation/dto/summary-aggregate-request.dto.ts` `60 행` `SummaryAggregateUnitResultDto` · `93 행` `SummaryAggregateRequestDto`, endpoint `src/assessment-evaluation/assessment-evaluation.controller.ts` `861~864 행` `@Post("summary")` + `@HttpCode(200)` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`, 핸들러 `865 행` `async summarize(...)`, 도메인 변환 helper `903 행` `toEvaluationResult` · `929 행` `toPersistMode`. 즉 문서만 미착수 잔여 구간이다.
4. `docs/PLAN.md` 의 P5 evaluation pipeline bullet 은 이미 `- [x]` 라 PLAN checkbox 변경은 불요 (§Out of Scope).

**오너 지시 게이트** — PLAN `157 행` R-91 · `158 행` R-92 는 **미접촉** (`test/perf/` · `package.json` · 워크플로 변경 0 파일). `182 행` 소비처 동반 의무는 코드 변경 0 인 doc-only slice 라 해당 없음 (helper · 어댑터 신설 0). `183 행` REQ 재판정 once-rule 은 본 task 가 **구현 2 단 머지 뒤 REQ-004 에 대해 처음이자 유일한 재판정** 이라 정면 준수 — 구현 전 사전 재판정 task 를 만들지 않았다.

## Required Reading

- `docs/architecture/api.md` `115 행` (그룹 헤더 `**평가 manual trigger (/api/assessment-evaluation) — T-0293 박제**`) · `116~118 행` (같은 그룹의 기존 3 행 — `POST /evaluate` · `POST /period` · `GET /relative-comparison`; 본 task 의 신규 행은 `118 행` **바로 뒤** 에 붙는다). 특히 `118 행` 은 직전 arc (T-1935) 가 쓴 행이라 셀 5 개 구성 · UC 호명 0 표기 · RBAC 사유 서술 밀도의 **직접 형식 기준** 이다.
- `docs/architecture/api.md` `170 행` (합계 문장 — `85 endpoint` / `shipped 80` / `18 prefix` / `9 UC cover` + 누계 서술 끝의 T-1935 절) · `172 행` (집계 규칙 3 항 — `(현재 85)` · `헤더 14 / prefix 18` · `(현재 표 85 / shipped 80)`).
- `docs/requirements.md` `23 행` REQ-004 행 전체 (status 셀의 괄호 머리 축 열거 + 말미 "한계" 절).
- `src/assessment-evaluation/assessment-evaluation.controller.ts` `830~900 행` — `@Post("summary")` route 주석 + decorator stack + `summarize` 본문 (skip `{ evaluated: false }` 를 200 그대로 통과 · service reject raw 전파 · 형식/literal 검증 분담 · RunStatus 전이 · 매핑 실패 400 은 begin 이전). 표 셀 서술의 **사실 source**.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` `903~940 행` — `toEvaluationResult` / `toPersistMode` (미허용 literal → `BadRequestException` 400 의 근거).
- `src/assessment-evaluation/dto/summary-aggregate-request.dto.ts` `60~92 행` (`SummaryAggregateUnitResultDto` 5 필드) · `93~138 행` (`SummaryAggregateRequestDto` 6 필드 — `@IsIn` 0 개, `periodStart` ISO 문자열).
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` `59~127 행` — 위임 대상 `evaluateAndPersist` 5 인자 + 반환 `SummaryAggregateResult` (`{ evaluated, result? }`).
- `docs/tasks/T-1935-req036-relative-comparison-doc-sync-rejudge.md` 의 Acceptance Criteria — 동형 doc-sync 의 검증 항목 구성 기준.

## Acceptance Criteria

- [ ] `docs/architecture/api.md` `§ 5` 의 `/api/assessment-evaluation` 그룹 (`118 행` 뒤) 에 `POST /api/assessment-evaluation/summary` 행 **1 개** 를 추가한다 — 셀 5 개 (METHOD / path / UC / description / auth tier), UC 컬럼은 9 UC `§5` sequence 호명 0 이므로 `118 행` 과 동형으로 `— (9 UC §5 sequence 호명 0)` 표기, auth tier 는 `Admin+`.
- [ ] 그 description 셀이 **코드 실측** 만 담는다 (추정 금지): 요청 본문 `SummaryAggregateRequestDto` 6 필드 + nested `SummaryAggregateUnitResultDto` 5 필드 / 허용 literal 검증은 DTO 가 아니라 domain type-guard (`isDifficulty` · `isContributionLevel`) 와 `toPersistMode` 소관이라 미허용 값은 **400** / 성공 **200** (`@HttpCode(200)`) + `SummaryAggregateResult` `{ evaluated, result? }` / **`{ evaluated: false }` skip 은 404 · 409 가 아니라 200 본문 그대로** / error 매핑 (400 형식·literal 위반 · 401 미인증 · 403 tier 미달 · service reject 는 raw 전파) / RBAC 가 `Admin+` 인 사유 (LLM round-trip + 영속 write 라 인접 `evaluate` · `reset` stack mirror) / 박제 slice `T-1936` (PR #1519) · `T-1937` (PR #1520).
- [ ] `docs/architecture/api.md` `170 행` 합계를 `85 → 86 endpoint` / `shipped 80 → 81` 로 재집계하고, 누계 서술 끝에 T-1938 절 1 개를 T-1935 절과 동형으로 덧붙인다 — **prefix 는 18 불변** (기존 `/api/assessment-evaluation` prefix 안의 정적 sub-path 라 새 최상위 prefix 아님, `PUT /api/llm/providers/default` T-1865 절 · `GET .../relative-comparison` T-1935 절과 동형) · **그룹 헤더 14 불변** (헤더 신설 0) · **UC cover 9 불변** 임을 명시.
- [ ] `docs/architecture/api.md` `172 행` 집계 규칙의 두 수 `(현재 85)` → `(현재 86)`, `(현재 표 85 / shipped 80)` → `(현재 표 86 / shipped 81)` 동기. 헤더 · prefix 수 표기 (`헤더 14 / prefix 18`) 는 건드리지 않는다.
- [ ] 재집계 검증: `grep -cE '^\| (GET|POST|PATCH|PUT|DELETE) \|' docs/architecture/api.md` 결과가 **86** 이고, 그 값이 `170 행` · `172 행` 표기와 일치.
- [ ] `docs/requirements.md` `23 행` REQ-004 을 **1 회 재판정** 한다 — status 괄호 머리의 축 열거에서 "좌표 종합 코멘트의 HTTP 진입점 부재" 를 제거하고 실재 축으로 옮기며, 말미 "한계" 절의 "좌표 종합 코멘트는 HTTP 진입점이 0 이라 … API 로 도달하지 않고" 서술을 T-1937 실측 좌표 (`assessment-evaluation.controller.ts` `861 행` `@Post("summary")`) 로 교체한다. 거짓 서술이 1 건도 남지 않아야 한다.
- [ ] REQ-004 의 `IN_PROGRESS` → `DONE` 승격 여부는 **실측 판단** 한다 — 잔여로 지목된 (a) 프런트 기간 지정 UI 부재 (`web/src` 의 `assessment-evaluation` 참조 0) · (b) 기간 종료 경계 입력 부재 두 축을 `git grep` 으로 재확인해, 하나라도 실재하면 `IN_PROGRESS` 를 유지하고 그 근거 좌표를 본문에 남긴다 (근거 없는 승격 금지, 근거 없는 유지도 금지).
- [ ] 본문에 인용하는 모든 행 번호가 origin/main 실측값이다 (인용 좌표를 하나라도 바꿨다면 그 파일을 다시 열어 확인). 행 범위 표기는 CLAUDE.md `§ 12` 규칙 (`~` 구분자, `23 행`, `L` prefix 금지) 을 따른다.
- [ ] 변경 파일이 `docs/architecture/api.md` + `docs/requirements.md` **2 개뿐** 이고 코드 · 테스트 변경 **0 LOC** (task 파일 status · journal · STATE 는 executor · driver 의 bookkeeping 몫).
- [ ] doc-only direct commit 이라 CLAUDE.md `§ 3.2` R-110 tester 면제 구간 — 대신 위 재집계 grep 실측 + "HTTP 진입점 부재/0" 문자열 잔존 히트 0 을 실측으로 확인한다.

## Out of Scope

- `src/` · `test/` · `web/` 어떤 코드 변경도 금지 (본 task 는 doc-sync 전용).
- REQ-004 **외** 다른 REQ 행 재판정 · status 변경 (PLAN `183 행` once-rule — REQ 당 1 회, 본 task 는 REQ-004 만).
- `docs/PLAN.md` checkbox · bullet 본문 변경 (해당 P5 bullet 은 이미 `[x]`).
- `docs/use-cases/UC-09-user-defined-period-evaluation.md` · `REQ-COVERAGE-AUDIT.md` 갱신 — UC 귀속 · 분류 재판정은 별도 축이며 본 route 는 UC `§5` 호명이 0 이라 UC cover 9 가 불변이다.
- api.md `§ 7` UC ↔ route 매핑 표에 행 추가 — 위와 같은 사유 (UC sequence 호명 0).
- 새 ADR 신설 · 기존 ADR 결정 내용 변경 (새 결정 0 — 있었다면 `commitMode: pr` 이어야 한다).
- e2e / smoke / perf spec 추가 (PLAN `158 행` R-92 신규 per-route perf-spec 금지 포함).
- T-1937 `Follow-ups (c)` 좌표 자동 산출 축 (서버가 `results` 를 구성하는 변형) — 별도 정책 결정 대상.
- 직전 fire 가 남긴 drift 후보 (`@Controller` 좌표가 `requirements.md` REQ-037 행에 `145 행` 으로 stale 인용된 건) — 다른 REQ 행이라 본 task 소관 아님.

## Suggested Sub-agents

`implementer`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
