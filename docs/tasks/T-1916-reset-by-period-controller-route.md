---
id: T-1916
title: 평가 partial-reset controller route 배선 (REQ-037 명시적 Reset endpoint 배선 2/2)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-09-06
independentStream: req-037-explicit-reset-endpoint
dependsOn: [T-1915]
touchesFiles:
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
plannerNote: P5 PLAN 106 행 R-64 — T-1915 DTO 의 소비처 slice 2/2(§3 소비처 동반 의무 명시 후속). reset route 0 을 main 실측 확인
---

# T-1916 — 평가 partial-reset controller route 배선 (REQ-037 명시적 Reset endpoint 배선 2/2)

## Why

**축 선택 근거.** 직전 fire 의 [T-1915](T-1915-reset-by-period-request-dto.md) 가 `ResetByPeriodRequestDto` 만 담고 소비처(controller route)를 `Follow-ups (a)` 에 **파일 · 배선 단위로 명시**한 채 닫혔다. [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무는 그 예외를 "cap 초과가 수치로 제시된 경우" 로만 허용하고 그때 명시한 소비처 slice 를 후속으로 요구하므로, 본 task 가 그 명시된 후속이며 최우선이다. 경쟁 축은 전부 자율 집행 불가다 — [docs/PLAN.md](../PLAN.md) `157 행` R-91 은 잔여 축이 실 수집 왕복 하나인데 배포기기 자격증명 주입이 필요해 [CLAUDE.md](../../CLAUDE.md) `§5` 게이트, `158 행` R-92 는 오너가 신규 slice 큐잉을 금지, `183 행` 오너 지시는 구현 전 REQ 재판정을 금지한다.

**issue-still-relevant pre-check (origin/main `5c4de47d` 실측).** 본 task 가 붙일 route 가 main 에 **아직 없음**을 grep 으로 확인했다 — `git grep -n "@Post(" origin/main -- src/assessment-evaluation/assessment-evaluation.controller.ts` 결과는 `218 행` `@Post("evaluate")` · `371 행` `@Post("period")` · `585 행` `@Post("unevaluated-fill-plan")` · `646 행` `@Post("unevaluated-fill-run")` 4 개뿐이고 `reset` route 는 0 이다. 반대로 선행 slice 산출물은 이미 안착했다 — `git ls-tree origin/main src/assessment-evaluation/dto/` 에 `reset-by-period-request.dto.ts`(45 행) + colocated spec 이 존재하고, `ResetByPeriodRequestDto` 는 `personId` · `period` 2 필드에 `@IsString` + `@IsNotEmpty` 만 적용한 상태다. 소비처 부재도 여전하다 — `git grep -n resetByPeriod origin/main -- src test` 의 참조는 두 service 본문(`summary-persist.service.ts` `144 행` · `evaluation-result-persist.service.ts` `145 행`)과 각자 spec, 그리고 T-1915 DTO 의 주석뿐이라 실 호출자가 0 이다. 즉 본 task 는 main 에 이미 안착한 일의 재큐잉이 아니다.

**설계 근거는 기존 ADR 로 충분 (새 ADR 0).** partial-reset 의미론은 [ADR-0033](../decisions/ADR-0033-evaluation-result-persistence.md) `§Decision §3`, summary 쪽 prefix delete 는 [ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) `98 행` 에 이미 박제돼 있고, 본 task 는 그 두 service 메서드를 HTTP 로 노출만 한다(새 결정 0 · 새 dependency 0 · schema 변경 0).

**cap 산정.** 실측 기반: route handler + 11 번째 생성자 주입 + 주석 ~95 LOC, spec 은 기존 4 개 builder 의 `new AssessmentEvaluationController(...)` 호출부(`158` · `274` · `400` · `3002 행`)에 throw mock 인자 1 개씩 추가 ~40 LOC + `makeResetController` 신설 ~45 LOC + reset describe 케이스 ~105 LOC = 약 190 LOC. estimate model R-112 backbone base 190 × 1.5 = 285 → `estimatedDiff: 285` / 2 파일로 [CLAUDE.md](../../CLAUDE.md) `§3` cap(300 LOC / 5 파일) 안이다. 여유가 좁으므로 신규 주석은 기존 route 대비 압축한다(아래 Out of Scope 의 주석 분량 항목).

## Required Reading

- [docs/tasks/T-1915-reset-by-period-request-dto.md](T-1915-reset-by-period-request-dto.md) `65 행` — Follow-up (a) 가 지정한 배선 명세(본 task 의 계약 정본).
- `src/assessment-evaluation/dto/reset-by-period-request.dto.ts` (전체 45 행) — 소비할 DTO 의 필드 · 검증 경계(허용 literal 은 service 책임).
- `src/assessment-evaluation/assessment-evaluation.controller.ts` `126 행` ~ `175 행` — controller-scope `ValidationPipe` 설정과 생성자 10 param 의 현재 순서.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` `645 행` ~ `705 행` — `@Post("unevaluated-fill-run")` route 의 decorator stack · thin delegate · error 전파 관행(mirror 대상).
- `src/assessment-evaluation/summary-persist.service.ts` `140 행` ~ `152 행` — `resetByPeriod(personId, period): Promise<number>` 시그니처와 `assertValidPeriod` 의 literal 게이트 위치.
- `src/assessment-evaluation/evaluation-result-persist.service.ts` `141 행` ~ `152 행` — 동명 메서드(동형 시그니처).
- `src/assessment-evaluation/assessment-evaluation.module.ts` `88 행` ~ `105 행`, `179 행` ~ `183 행` — 두 persist service 가 이미 provider·export 라 module 배선 변경이 0 이라는 근거.
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` `100 행` ~ `175 행` — builder 관행(미사용 의존은 throw mock 주입)과 생성자 위치 인자 호출부.

## Acceptance Criteria

- [ ] `assessment-evaluation.controller.ts` 에 `@Post("reset")` + `@HttpCode(200)` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` handler 를 추가한다(기존 `unevaluated-fill-run` route 의 decorator stack mirror, 새 auth 결정 0).
- [ ] 생성자 **맨 끝**에 `private readonly summaryPersistService: SummaryPersistService` 를 추가한다(기존 10 param 의 위치·순서 불변). `EvaluationResultPersistService` 는 이미 주입돼 있으므로 재주입하지 않고, `assessment-evaluation.module.ts` 는 **무수정**이다(두 service 모두 기존 provider).
- [ ] handler 는 `@Body() dto: ResetByPeriodRequestDto` 를 받아 `evaluationResultPersist.resetByPeriod(dto.personId, dto.period)` 를 **먼저**, `summaryPersist.resetByPeriod(dto.personId, dto.period)` 를 **다음**으로 호출하고 `{ personId, period, deletedAssessments, deletedSummaries }` 를 반환한다(호출 순서는 spec 이 단언하는 계약). service error 는 swallow 0 으로 raw 전파한다.
- [ ] **happy-path** — 유효한 body 로 두 service 가 각각 1 회 호출되고 삭제 건수가 응답에 그대로 실리는 케이스 1+ (위임 인자 · 호출 횟수 단언 포함).
- [ ] **error path** — (1) `evaluationResultPersist.resetByPeriod` reject 시 error 가 raw 전파되고 `summaryPersist.resetByPeriod` 가 **미호출**인 케이스 (2) `summaryPersist.resetByPeriod` reject 시 error raw 전파 케이스 각 1+.
- [ ] **분기별 cover** — 위 순차 위임의 두 실패 분기 + 성공 분기를 서로 다른 케이스로 분리한다(한 케이스가 두 분기를 겹쳐 덮지 않게 한다).
- [ ] **negative case** — 예외 분기마다 1+: (1) 허용 외 period literal 을 service 가 거부(`assertValidPeriod` throw)할 때 controller 가 자체 매핑 없이 전파 (2) 삭제 건수 0 인 좌표에서도 200 + 0/0 반환(부재를 오류로 만들지 않음) (3) reset route 가 `orchestrator` · `persistService.persist` · `runStatus` 등 무관 의존을 **호출하지 않음**(builder 의 throw mock 으로 격리 검증) (4) DTO 정의 외 필드는 controller-scope `ValidationPipe` 의 `forbidNonWhitelisted` 소관임을 확인(unit 에서 pipe 를 재구현하지 말고 기존 관행대로 위임 검증만).
- [ ] spec 은 colocated `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` 에 `describe("POST /reset ...")` 로 추가하고, 전용 builder(`makeResetController`)를 기존 builder 관행대로 신설한다(무관 의존은 throw mock). 기존 4 개 builder 의 생성자 호출부(`158` · `274` · `400` · `3002 행`)에 새 param 인자를 추가한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` `coverageThreshold.global`).

## Out of Scope

- `summary-persist.service.ts` · `evaluation-result-persist.service.ts` 본문 수정(`resetByPeriod` 는 있는 그대로 소비).
- `assessment-evaluation.module.ts` 수정 — 두 service 는 이미 provider·export 라 배선 변경 0.
- `RunStatusService` 의 `begin`/`end` 전이 추가 — reset 은 평가 **실행** 이 아니라 삭제라 ADR-0060 §Decision 4 카운터 대상이 아니다(필요하면 별도 결정).
- e2e spec 신설 · Admin UI(web) 노출 · RBAC 정책 변경(Admin+ 는 기존 route mirror 로 고정) — `Follow-ups` 소관.
- `docs/requirements.md` REQ-037 재판정 · PLAN `106 행` checkbox 변경 — 본 slice 머지 후 1 회만([CLAUDE.md](../../CLAUDE.md) `§3.1`).
- 전체 초기화(person/period 축 위의 광역 reset) · dry-run 옵션 · 삭제 감사 로그 — 새 결정이 필요한 범위.
- 신규 주석은 인접 route 의 30 행대 주석 블록을 그대로 복제하지 말고 요지 위주로 압축(cap 여유가 15 LOC 뿐).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) e2e — `test/e2e/` 에 reset route 의 RBAC(401/403) + 실 삭제 왕복 spec(본 slice 머지 후).
- (b) REQ-037 재판정 1 회 — 본 slice 머지 후 `docs/requirements.md` `56 행` 상태 문자열 · PLAN `106 행` checkbox 재판정(구현 전 판정 금지).
