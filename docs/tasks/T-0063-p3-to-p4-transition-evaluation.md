---
id: T-0063
title: P3→P4 전이 평가 doc 박제 (P3 진척도 검산 + P4 진입 조건 + 첫 task 후보)
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 220
estimatedFiles: 2
created: 2026-05-27
plannerNote: P3 9-cell closure 박제 후 P4 진입 조건 + 첫 task 후보 doc-only 박제; PLAN.md 동기 1 줄 추가.
---

# T-0063 — P3→P4 전이 평가 doc 박제 (P3 진척도 검산 + P4 진입 조건 + 첫 task 후보)

## Why

직전 turn (T-0062 PR-58 round 1 single-shot merge sha 3398ad9) 으로 **P3 test-quality 9-cell closure** (backbone 3 도메인 persons/parts/groups × 3 layer unit/smoke/e2e) 가 박제됐다. 그러나 [PLAN.md](../PLAN.md) Phase P3 의 13 bullet 중 4 개 (test-quality 4/4) 만 명시적으로 closure 표기 됐고, 나머지 9 개 (인원 CRUD / 서비스별 ID / PK 역할 / Group 정책 / 평가 결과 저장 모델 / Raw 미저장 / 상대 비교 / Persistence / Auth-RBAC / User read-only) 의 진척도는 task graph 추적 필요. P4 진입은 (a) P3 acceptance criteria 가 모두 met 됐는지 (b) 미완 bullet 이 P4 와 병행 가능한지 ([PLAN.md](../PLAN.md) §의존성 "P3, P4 병행" 명시) (c) P4 의 첫 task 가 무엇이 되어야 하는지 — 3 가지 객관적 평가 없이 즉흥 결정할 사항이 아니다. 본 task 는 평가 결과 문서를 박제해 다음 planner 호출이 evidence-based 로 P4 entry task 를 결정할 수 있게 한다.

본 task 는 **doc-only direct** — ADR 신설 0, 코드 변경 0, PLAN.md 의 P3 closure 진척 1 줄 + 본 평가 doc 신설 2 파일. 평가에 따라 도출되는 follow-up (Auth/RBAC ADR / Person CRUD service expansion / GitHub integration ADR 등) 은 본 task 의 Follow-ups 섹션에 후속 task 로 queue.

## Required Reading

- [docs/PLAN.md](../PLAN.md) — Phase P3 (47-66 행) 13 bullet 의 closure 상태 점검 대상.
- [docs/architecture/p3-implementation-plan.md](../architecture/p3-implementation-plan.md) — P3 entry plan 의 10 bullet ↔ task 매핑 (T-0033 ~ T-0040 시퀀스). T-0058 가 본 doc 을 T-0045~T-0057 까지 sync 했으므로 본 task 는 T-0058~T-0062 추가 박제 + 잔여 bullet 분석.
- [docs/architecture/modules.md](../architecture/modules.md) — module view 현황 (persistence / persons / groups / parts entity·service·controller).
- [docs/STATE.json](../STATE.json) — counters.tasksCompleted=61, mostRecentTasks 5 건 (T-0058~T-0062), reviewRounds streak.
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — 8 UC backbone 의 P3 coverage 확인용 (UC-03 Person CRUD / UC-04 Account/Auth 가 P3 phase 중 어디까지 cover 됐는가).
- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — REQ ↔ UC 매핑 표.
- [docs/PLAN.md](../PLAN.md) Phase P4 (70-79 행) — P4 의 8 bullet 검토 (P4 entry task 후보 도출용).

## Acceptance Criteria

본 task 는 doc-only direct — 코드 변경 0, R-110~R-114 test 적용 면제 (CLAUDE.md §3.2 — direct-mode doc-only commit 만 본 규칙 면제).

- [ ] 신규 파일 `docs/architecture/p3-to-p4-transition-evaluation.md` 박제. 다음 5 섹션 포함:
  1. **P3 진척 검산 표** — [PLAN.md](../PLAN.md) Phase P3 의 13 bullet 각각에 대해 (a) 어떤 T-NNNN task 가 cover 했는가 (없으면 "미커버") (b) closure 정도 (DONE / 부분 / 미착수) (c) 본 bullet 이 P4 진입 차단 요소인가 (Y/N + 사유 한 줄).
  2. **P3 ↔ P4 의존성 검사** — [PLAN.md](../PLAN.md) §의존성 의 "P3, P4 병행" 정책 검토. P4 의 8 bullet 각각이 P3 의 어떤 bullet 에 dependsOn 인지 매핑 (예: P4 의 LLM provider 추상화는 P3 의 Persistence layer 박제 후 가능 — 이미 DONE). 병행 가능 여부 판정.
  3. **P4 entry task 후보 3 ~ 5 개** — 각 후보에 대해 (a) 어떤 P4 bullet 을 cover 하는가 (b) coversReq 목록 (c) commitMode 예상 (d) estimatedDiff / estimatedFiles (e) dependsOn (P3 미완 bullet) (f) 새 외부 dependency 필요 여부 (BLOCKED 게이트 §5 발화 후보) (g) ADR 신설 필요 여부. 예: GitHub integration / LLM provider 추상화 / Auth-RBAC 구현 / Confluence integration / 자격증명 관리.
  4. **권장 P4 첫 task** — 위 후보 중 가장 적합한 1 개를 선정 + 선정 사유 3 줄 (의존성 최소 / cap-safe / 외부 dependency 게이트 가용성 / ADR 박제 우선순위 등).
  5. **P3 잔여 bullet 후속 task queue 후보** — P3 미커버 bullet 을 P4 와 병행으로 진행할 후보 task 목록 (예: Auth-RBAC SuperAdmin 지정 first-login flow / User read-only 권한 enforcement / 평가 결과 저장 모델 entity 신설 등). 각 후보에 대해 한 줄 요약.

- [ ] [docs/PLAN.md](../PLAN.md) Phase P3 entry 영역에 **1 줄 진척 박제 추가** — "P3 test-quality 9-cell closure (T-0053 ~ T-0062, persons/parts/groups × unit/smoke/e2e). 잔여 P3 bullet 9 개의 P4 병행 가능 여부 평가는 [p3-to-p4-transition-evaluation.md](architecture/p3-to-p4-transition-evaluation.md) (T-0063) 참조." 정도. P3 → P4 전이 박제 안 함 (그건 별도 task 의 결정 — 본 task 는 평가만).

- [ ] doc 본문은 한국어 (§12). 식별자 (T-NNNN / REQ-NNN / commitMode / status enum / 파일 경로) 는 영어. 표 헤더 (예: Bullet / Cover Task / Status / P4 Block) 는 한국어 또는 영어 자유 (consistency 만 유지).

- [ ] doc 본문 LOC ≤ 250 (cap-safe). 표 + bullet 위주, 장황한 narrative 회피.

- [ ] commit message 표준 trail blob 포함 (§11), `PLANNER:` 1 줄 + `ACCEPTANCE:` 항목별 status.

## Out of Scope

- ADR 신설 0 — 본 task 는 평가 doc 만. 평가 결과 도출되는 정책 결정 (예: P4 entry task 선정 박제 / Auth-RBAC 모델 결정 / GitHub integration scope) 은 별도 ADR task 로 분리.
- 코드 변경 0 — `src/` / `test/` / `.github/workflows/` / `package.json` 미접근.
- humanQuestion 신설 0 — 평가가 새 외부 dependency 후보를 식별해도 본 task 는 BLOCKED 발화 안 함 (후속 task 가 그것을 raise). 평가 doc 의 §3 P4 entry task 후보 표에 "BLOCKED 후보 (사유)" 컬럼만 명시.
- STATE.json `nextTask` 외 다른 필드 갱신 0 — driver 가 [6] bookkeeping 에서 처리.
- 신규 use case 신설 0 — UC-09 (REQ-004 gap) 박제는 별도 후속 task (이미 T-0029 follow-up 으로 queue 됨).
- T-0058 (P3 plan sync) 의 갱신 — 본 task 는 T-0058~T-0062 까지 sync 하지 않음 (별도 후속 task 가 필요 시).

## Suggested Sub-agents

`implementer → tester` — implementer 가 doc 2 파일 작성, tester 는 doc-only direct mode 이므로 lint/build/test 실행 면제 (CLAUDE.md §3.2). 단 tester 는 doc 본문의 (a) Required Reading 파일 인용이 실제 경로와 일치하는지 (b) 한국어 정책 (§12) 위반 0 (c) LOC ≤ 250 cap 준수 — 3 항목만 검토 후 SUMMARY 반환.

## Follow-ups

(생성 시점 비어있음. implementer / tester 가 평가 doc 작성 중 발견한 후속 task 후보를 본 섹션에 append. 예상 follow-up 예: estimate model 갱신 doc / src/user spec migration / AuthGuard ADR / GitHub integration ADR / Confluence integration ADR / Auth-RBAC SuperAdmin first-login flow / 평가 결과 저장 모델 entity 신설 / Raw 미저장 invariant ADR.)
