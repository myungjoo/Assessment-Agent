---
id: T-1918
title: 평가 partial-reset route e2e 실 삭제 왕복 · 좌표 격리 (REQ-037 e2e 2/2)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-037]
estimatedDiff: 260
estimatedFiles: 1
created: 2026-09-06
independentStream: req-037-explicit-reset-endpoint
dependsOn: [T-1915, T-1916, T-1917]
touchesFiles:
  - test/e2e/assessment-evaluation-reset.e2e-spec.ts
plannerNote: P5 PLAN 106 행 R-64 — T-1917 Follow-up (a) e2e 2/2(실 삭제 왕복). main 의 reset e2e 는 seed 0 계약만 실측, REQ-037 재판정은 본 slice 뒤 1 회
---

# T-1918 — 평가 partial-reset route e2e 실 삭제 왕복 · 좌표 격리 (REQ-037 e2e 2/2)

## Why

**축 선택 근거.** 직전 fire 의 [T-1917](T-1917-reset-route-e2e-rbac-contract.md) 이 `Follow-ups (a)` 에 "실 삭제 왕복 — Assessment + Summary row seed → reset → 해당 좌표만 삭제되고 다른 period row 는 보존됨을 단언" 을 **본 slice 머지 후** 로 명시했고, 그 선행 조건(e2e 1/2 머지)이 충족됐다. [docs/requirements.md](../requirements.md) `56 행` 의 REQ-037 은 검증 수단 열이 **`e2e`** 이므로, 삭제가 실제로 일어나고 좌표 밖 row 를 건드리지 않는다는 사실이 실 DB 왕복으로 증명돼야 재판정 근거가 갖춰진다. 같은 Follow-up 의 (b) REQ-037 재판정은 본 task 가 닫힌 **뒤 1 회만** 수행해야 [CLAUDE.md](../../CLAUDE.md) `§3.1` 의 "REQ 재판정은 구현 slice 머지 후 REQ 당 1 회" 와 [docs/PLAN.md](../PLAN.md) `183 행` 오너 지시(왕복 제거)를 동시에 지킨다. 경쟁 축은 자율 집행 불가다 — PLAN `157 행` R-91 은 배포기기 자격증명 주입이 필요해 [CLAUDE.md](../../CLAUDE.md) `§5` 게이트, `158 행` R-92 는 오너가 신규 per-route slice 큐잉을 금지한다.

**issue-still-relevant pre-check (origin/main `39b40a1c` 실측).** 본 slice 의 변경 의도가 아직 main 에 없음을 확인했다 — `test/e2e/assessment-evaluation-reset.e2e-spec.ts` 는 252 행 · `it` 10 개로 실재하지만 `git grep -cE "person\.create|assessment\.create|summary\.create" origin/main -- <그 파일>` 이 **hit 0**(exit 1) 이라 seed 된 row 가 하나도 없고, happy-path 는 `expect(await prisma.assessment.count()).toBe(0)` 전제의 **0/0 계약**뿐이다. 즉 "삭제가 실제로 일어난다" 와 "좌표 밖 row 가 보존된다" 는 아직 어떤 e2e 도 증명하지 않는다. `git grep -n "assessment-evaluation/reset" origin/main -- test/` 의 hit 도 그 한 파일(1 · 46 · 59 행)뿐이라 route 를 때리는 다른 spec 도 0 이다. 반대로 선행 산출물은 전부 안착했다 — controller `@Post("reset")`, `ResetByPeriodRequestDto`, 두 service 의 `resetByPeriod`. 따라서 본 task 는 재큐잉이 아니다.

**cap · 소비처 판정.** production `src/` 변경 0 LOC · 새 helper 신설 0 이라 [CLAUDE.md](../../CLAUDE.md) `§3` 소비처 동반 의무는 해당 없다(소비처인 route 는 T-1916 에서 이미 머지). 기존 spec 1 파일 증축이라 `testRegex` 자동 수집으로 등록 파일 수정도 0 (Q-0054 동형 parity 사고 회피). 새 dependency 0 · 새 결정 0(따라서 새 ADR 0).

## Required Reading

- [docs/tasks/T-1917-reset-route-e2e-rbac-contract.md](T-1917-reset-route-e2e-rbac-contract.md) `Follow-ups` 절 — 본 task 가 이행하는 (a) 의 명세와, (b) 재판정이 본 task 뒤라는 순서.
- `test/e2e/assessment-evaluation-reset.e2e-spec.ts` 전체 252 행 — 증축 대상. 특히 `1 행` ~ `29 행` 머리 주석(책임 목록 · Out of Scope 문장), `46 행` ~ `57 행` (`ROUTE` · `TARGET_PERSON_ID` · `VALID_PERIOD` · `validBody()` 상수), `59 행` ~ `96 행` (`beforeAll` / `afterAll` / `afterEach(truncateAll + reseedAuthenticatedActors)`), `98 행` ~ `128 행` (기존 0/0 happy-path 와의 중복 회피 경계).
- `src/assessment-evaluation/evaluation-result-persist.service.ts` `140 행` ~ `152 행` — `deleteMany({ where: { personId, period } })` 로 **scope · periodStart 를 조건에 넣지 않는다**는 사실(같은 period 의 서로 다른 scope 가 모두 지워지는 근거)과 `274 행` ~ `282 행` 의 `assertValidPeriod`(plain `Error`).
- `src/assessment-evaluation/summary-persist.service.ts` `140 행` ~ `150 행` 및 `205 행` ~ `213 행` — 둘째 위임 대상의 동형 계약.
- `src/assessment-evaluation/assessment-evaluation.controller.ts` `739 행` ~ `760 행` — 두 service 를 Assessment → Summary 순차 위임하고 4 필드로 응답하는 handler.
- `src/user/assessment.service.ts` `40 행` — `VALID_PERIODS = ["day","week","month"]`(다른 period 보존 케이스가 쓸 두 번째 유효 literal 의 정본).
- `prisma/schema.prisma` `294 행` ~ `317 행`(`Assessment` 필수 컬럼 + `@@unique([personId, period, scope, periodStart])`) 및 `361 행` ~ `380 행`(`Summary` 필수 컬럼 + `@@unique([personId, period, periodStart])`) — seed 시 중복 좌표 P2002 를 피하기 위한 축 설계 근거.
- `prisma/schema.prisma` `55 행` ~ `62 행` — `Person` 필수 컬럼(`fullName` · `email @unique`). Assessment · Summary 는 Person FK 이므로 seed 순서가 Person 먼저다.
- `test/e2e/assessments.e2e-spec.ts` `126 행` ~ `153 행` — Person → Assessment seed helper 관행(필드 기본값 · email 충돌 회피).
- `test/e2e/summaries.e2e-spec.ts` `137 행` ~ `157 행` — Person → Summary seed helper 관행.
- `test/helpers/db-truncate.ts` (전체) — `truncateAll` 의 CASCADE 범위(Person 삭제가 하위 row 를 동반 정리하므로 case 간 격리는 이미 보장된다는 근거).

## Acceptance Criteria

- [ ] `test/e2e/assessment-evaluation-reset.e2e-spec.ts` **1 파일만** 수정한다(production `src/` 변경 0 LOC, 다른 spec · `test/helpers/*` · `test/jest-e2e.json` 수정 0, 신규 파일 0). 기존 `it` 10 개는 삭제 · 개작하지 않고 그대로 둔다.
- [ ] 파일 안에 좌표 seed helper 1 개를 둔다 — Person 1 건을 만들고 그 id 로 Assessment · Summary 를 지정 좌표(`period` · `scope` · `periodStart`)에 생성한다. `@@unique` 충돌을 피하도록 좌표 축을 case 마다 달리 준다.
- [ ] **happy-path (실 삭제 왕복)** — 대상 Person 의 `week` 좌표에 Assessment 2 건 + Summary 1 건, 같은 Person 의 `month` 좌표에 Assessment 1 건 + Summary 1 건을 seed 한 뒤 Admin 쿠키로 `period="week"` reset → 200 이고 `deletedAssessments === 2` · `deletedSummaries === 1`, 그리고 삭제 후 실 DB 조회로 `month` row 가 그대로 남아 있음을 단언(응답 숫자만이 아니라 잔존 row 로 확인).
- [ ] **분기별 cover — scope 무관 전삭제** — 같은 `personId` · 같은 `period` 이지만 `scope` 가 서로 다른 Assessment 2 건(예: `commit` / `document`)이 **한 번의 reset 으로 모두** 지워짐을 단언(`deleteMany` where 에 scope 가 없다는 계약).
- [ ] **분기별 cover — 비대칭 존재** — (1) Assessment 만 있고 Summary 가 없는 좌표 → `deletedAssessments >= 1` · `deletedSummaries === 0` (2) 그 역방향 → `deletedAssessments === 0` · `deletedSummaries >= 1`. 두 위임 중 한쪽이 0 이어도 나머지가 정상 진행함을 각각 별도 `it` 으로.
- [ ] **negative — 다른 person 격리** — 대상 Person 과 별개 Person 의 같은 `week` 좌표 row 를 함께 seed 한 뒤 대상 Person 만 reset → 다른 Person 의 Assessment · Summary 가 건수 그대로 보존됨을 실 DB 조회로 단언.
- [ ] **negative — 오삭제 방지(허용 외 period)** — row 를 seed 한 상태에서 허용 외 period(예: `"quarter"`) 로 요청하면 500 이고, **seed 한 row 가 한 건도 지워지지 않았음**을 실 DB count 로 단언(검증 실패가 부분 삭제를 남기지 않는다는 회귀).
- [ ] **negative — 권한 실패가 파괴를 막음** — row 를 seed 한 상태에서 User tier 쿠키로 요청하면 403 이고 seed row 가 전부 보존됨을 단언(RBAC 가 삭제 전에 차단).
- [ ] **멱등 (error path 겸 재호출)** — 같은 body 로 1 회차 reset 이 N 건을 지운 뒤 2 회차는 200 + `0/0` 이고, 그 사이 다른 좌표 row 가 추가로 줄지 않음을 단언.
- [ ] 새로 추가하는 `it` 은 **7 개 이내**로 유지한다. cap 압박 시 "scope 무관 전삭제" 항목을 `Follow-ups` 로 미루고 나머지를 우선한다(전체 diff ≤ 300 LOC · 파일 1 개 유지).
- [ ] 머리 주석은 **12 행 이내**로만 증보한다 — 2/2 책임(실 삭제 왕복 · 좌표 격리)을 추가하고, 기존 `Out of Scope` 문장에서 "실 삭제 왕복은 2/2" 라고 적힌 부분을 본 task 로 닫혔다고 정정한다.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%, `package.json` `coverageThreshold.global`). e2e 는 unit coverage 집계 대상이 아니고 신규 production symbol 이 0 이므로 게이트는 기존 unit 으로 유지된다.
- [ ] 로컬에 `DATABASE_URL` 이 없어 e2e 를 돌릴 수 없으면 CI 의 `test:e2e` step 결과로 검증을 위임하고 그 사실을 tester trail 에 명시한다(실행하지 않은 것을 통과로 적지 않는다).

## Out of Scope

- `src/` 변경 일체 — controller · 두 persist service · DTO · module 을 있는 그대로 소비한다. 허용 외 period 의 500 을 400 으로 바꾸고 싶어도 본 task 에서 고치지 않고 `Follow-ups` 에 적는다.
- `docs/requirements.md` REQ-037 재판정 · PLAN `106 행` checkbox 변경 — 본 slice 머지 후 **1 회만** 별도 task 로([CLAUDE.md](../../CLAUDE.md) `§3.1`, PLAN `183 행`).
- Contribution cascade 검증(Assessment 삭제 시 하위 Contribution 동반 삭제) — Contribution seed 컬럼이 추가로 필요해 cap 을 밀어낸다. `Follow-ups` 로.
- 기존 e2e spec · `test/helpers/*` · `test/jest-e2e.json` · `deploy/daily-test*` 수정 — 파생 drift-guard smoke spec 을 건드리면 파일 수 cap 이 깨진다(Q-0054 선례).
- Admin UI(web) 의 reset 노출 · 광역 reset · dry-run · 삭제 감사 로그 — 새 결정이 필요한 범위.
- 성능 · 대량 row(수백 건) 삭제 측정 — 계약 검증이 목적이지 부하 측정이 아니다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) REQ-037 재판정 1 회 — 본 slice 머지 후 `docs/requirements.md` `56 행` 상태 문자열 · PLAN `106 행` checkbox 를 **한 번에** 재판정(중간 재판정 금지).
- (b) Contribution cascade e2e — Assessment 삭제 시 `onDelete: Cascade` 로 하위 Contribution 이 함께 지워짐을 실 DB 로 확인(별도 slice).
