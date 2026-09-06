---
id: T-1915
title: 평가 partial-reset 요청 DTO 신설 (REQ-037 명시적 Reset endpoint 배선 1/2)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037]
estimatedDiff: 250
estimatedFiles: 2
independentStream: req-037-explicit-reset-endpoint
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/dto/reset-by-period-request.dto.ts
  - src/assessment-evaluation/dto/reset-by-period-request.dto.spec.ts
created: 2026-09-05
plannerNote: P5 PLAN 106 행 R-64 — REQ-037 유일 잔여축(명시적 Reset endpoint 0) 배선 1/2. 단일 slice 실측 355 LOC 로 cap 초과라 DTO 축 선행
---

# T-1915 — 평가 partial-reset 요청 DTO 신설 (REQ-037 명시적 Reset endpoint 배선 1/2)

## Why

**축 선택 근거 (문서 축이 아니라 코드 축을 고른 이유).** 직전 두 fire (T-1913 · T-1914) 가 연속으로 requirements 재판정 doc slice 였다. [docs/PLAN.md](../PLAN.md) `183 행` 오너 지시가 "REQ 재판정은 구현 후 1 회만" 을 못박고, [CLAUDE.md](../../CLAUDE.md) `§3.1` 판정 규칙도 구현 전 재판정을 금지하므로 T-1914 가 남긴 Follow-up (a)(REQ-004 동형 재판정)·(b)(smoke 통계 stale) 는 **지금 큐잉할 대상이 아니다** — 해당 REQ 의 구현 slice 가 머지된 뒤 1 회만 판정한다. PLAN 최상위 🔴🔴 bullet 인 `157 행` R-91 k6 부하검증은 잔여 축이 "실 수집 왕복" 하나인데 그 집행에 배포기기 github read PAT 주입이 필요해 [CLAUDE.md](../../CLAUDE.md) `§5` 자격증명 게이트에 걸린다 ([T-1706](T-1706-real-collection-roundtrip-closure-decision.md) 판정, `161 행` bullet 의 "LLM stub · 자격증명 0 이라 미발화" 서술과 동일). `158 행` R-92 per-route slice 는 오너가 신규 큐잉을 금지했다. 따라서 자율 집행 가능한 최상위 미충족 코드 축은 P5 `106 행` R-64(평가 재실행·부분 reset, checkbox `[ ]`) 다.

**issue-still-relevant pre-check (head `56a1cae7` 실측).** [docs/requirements.md](../requirements.md) `56 행` REQ-037 이 지목하는 유일 잔여 축("디버깅용 명시적 Reset 은 외부에서 호출 불가")이 main 에서 **여전히 유효**함을 확인했다 — `src/assessment-evaluation/assessment-evaluation.controller.ts` 의 route 는 `218 행` `@Post("evaluate")` · `371 행` `@Post("period")` · `585 행` `@Post("unevaluated-fill-plan")` · `646 행` `@Post("unevaluated-fill-run")` 4 개뿐이고 reset route 는 0 이다. 구현체 `summary-persist.service.ts` `144 행` 과 `evaluation-result-persist.service.ts` `145 행` 의 `resetByPeriod(personId, period)` 는 실재하나 `git grep resetByPeriod -- src test` 결과 참조가 **자기 service 와 자기 spec 뿐**이라 소비처가 0 이다. 즉 [CLAUDE.md](../../CLAUDE.md) `§3` "소비처 동반 의무" 가 지적하는 helper-without-consumer 상태가 main 에 남아 있고, 본 stream 이 그 소비처를 붙인다. 설계 근거는 이미 박제돼 있어 새 ADR 이 필요 없다 — [ADR-0033](../decisions/ADR-0033-evaluation-result-persistence.md) `§Decision §3` (재평가/partial-reset semantics) + [ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) `98 행` (partial reset = `personId`+`period` prefix delete).

**2 slice 분할 근거 (§3 소비처 동반 의무의 수치 예외).** 소비처(controller route)까지 한 PR 에 넣으면 cap 초과다. 실측 기반 산정: 신규 DTO ~50 LOC + colocated DTO spec ~130 LOC + controller route·주입 ~65 LOC + controller spec 케이스 ~110 LOC = **약 355 LOC / 4 파일** (precedent 실측 — 같은 디렉토리 `unevaluated-fill-plan-request.dto.ts` 75 행 · 같은 이름 `.spec.ts` 213 행, controller 는 route 1 개가 주석 포함 60 행대). §3 상한 300 LOC 를 넘으므로 본 task 는 DTO 축만 담고, 소비처 slice 를 아래 `Follow-ups (a)` 에 **파일 · 배선 단위로 명시**한다. estimate model: R-112 backbone 카테고리 base 165 × 1.5 = 248 → `estimatedDiff: 250`.

## Required Reading

- [README.md](../../README.md) `64 행` — REQ-037 원문 ("Reset & Reeval" 지시).
- [docs/requirements.md](../requirements.md) `56 행` — REQ-037 row 의 현재 상태 문자열 · `한계 —` 절이 정의한 잔여 축.
- [docs/PLAN.md](../PLAN.md) `106 행` — P5 R-64 bullet (checkbox `[ ]` 유지 근거).
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](../decisions/ADR-0033-evaluation-result-persistence.md) `§Decision §3` — partial-reset semantics.
- `src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.ts` (전체 75 행) — 같은 module DTO 관행: class-validator 형식 검증만, 허용 literal 은 `@IsIn` 미적용.
- `src/assessment-evaluation/dto/unevaluated-fill-plan-request.dto.spec.ts` (전체 213 행) — colocated DTO spec 의 케이스 구성 · `validate` 호출 관행.
- `src/assessment-evaluation/summary-persist.service.ts` `140 행` ~ `152 행` — `resetByPeriod` 시그니처와 `assertValidPeriod` 가 period literal 검증을 소유한다는 사실 (DTO 가 중복 검증하지 않을 근거).

## Acceptance Criteria

- [ ] 신규 파일 `src/assessment-evaluation/dto/reset-by-period-request.dto.ts` 에 `ResetByPeriodRequestDto` 를 export 한다. 필드는 `personId: string` · `period: string` 2 개뿐이고 각각 `@IsString()` + `@IsNotEmpty()` 만 적용한다 (`@IsIn` 미적용 — 허용 literal 판정은 service 의 `assertValidPeriod` 책임, 같은 디렉토리 DTO 관행 정합). 새 외부 dependency 0 (`class-validator` 는 기존 의존).
- [ ] colocated spec `src/assessment-evaluation/dto/reset-by-period-request.dto.spec.ts` 를 신설한다 (helper 디렉토리가 아닌 DTO 옆).
- [ ] **happy-path** — 두 필드가 유효한 문자열일 때 `validate` 오류 0 건인 케이스 1+.
- [ ] **error path** — 필드 누락(undefined) · 빈 문자열 · 비-string(number/object) 각각에 대해 해당 필드 이름의 오류가 나오는 케이스 1+ (필드 2 개 각각).
- [ ] **분기별 cover** — `@IsString` 위반 분기와 `@IsNotEmpty` 위반 분기를 서로 다른 케이스로 분리해 각각 1+ (한 케이스가 두 분기를 동시에 덮지 않게 한다).
- [ ] **negative case** — 예외 분기마다 1+: (1) 정의 외 필드 포함 시 `forbidNonWhitelisted` 로 거부 (2) `whitelist` 적용 시 정의 외 필드 strip (3) 공백-only 문자열 취급 (4) `null` 입력 (5) 두 필드 모두 무효일 때 오류 2 건 수집.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` `coverageThreshold.global`).
- [ ] `bash scripts/check-spec-presence.sh` 통과 (신규 src 파일의 colocated spec 존재 검증).

## Out of Scope

- `assessment-evaluation.controller.ts` 에 `@Post("reset")` route 추가 · constructor 주입 변경 — `Follow-ups (a)` 의 slice 2/2 소관 (본 PR 에서 controller 파일 무수정).
- `summary-persist.service.ts` · `evaluation-result-persist.service.ts` 본문 수정 (`resetByPeriod` 는 있는 그대로 소비한다).
- e2e spec 신설, Admin UI(web) 노출, RBAC 정책 변경.
- `docs/requirements.md` REQ-037 재판정 · PLAN `106 행` checkbox 변경 — 구현 slice 머지 후 1 회만 ([CLAUDE.md](../../CLAUDE.md) `§3.1`).
- period literal 을 DTO 에서 `@IsIn` 으로 강제하는 정책 변경 (기존 module 관행 이탈이라 별도 결정 필요).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) **소비처 slice 2/2 (§3 소비처 동반 의무 명시)** — `src/assessment-evaluation/assessment-evaluation.controller.ts` 에 `@Post("reset")` + `@HttpCode(200)` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` handler 를 추가하고, constructor(`148 행` ~)에 `SummaryPersistService` 를 주입한다 (`EvaluationResultPersistService` 는 `150 행` 에 이미 주입, 두 service 모두 `assessment-evaluation.module.ts` 의 provider·export 라 token 추가 0). handler 는 `ResetByPeriodRequestDto` 를 받아 `evaluationResultPersist.resetByPeriod` 와 `summaryPersist.resetByPeriod` 를 호출하고 삭제 건수를 반환한다. spec 은 `assessment-evaluation.controller.spec.ts` 에 케이스 추가.
- (b) e2e — `test/e2e/` 에 reset route 의 RBAC(401/403) + 실 삭제 왕복 spec (slice 2/2 머지 후).
- (c) REQ-037 재판정 1 회 — slice 2/2 머지 후 `docs/requirements.md` `56 행` 상태 · PLAN `106 행` checkbox 재판정 (구현 전 판정 금지).
