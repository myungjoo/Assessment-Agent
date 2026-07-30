---
id: T-1313
title: P6 deferred 잔여 목록 정합 — shipped 2 항목 (GroupMember add·remove mutation / import 결과 상세) 제거
phase: P6
status: DONE
commitMode: direct
coversReq: [REQ-049, REQ-038, REQ-045]
estimatedDiff: 20
estimatedFiles: 3
created: 2026-07-30
independentStream: p6-doc-drift-deferred-list
dependsOn: []
touchesFiles:
  - docs/PLAN.md
  - docs/architecture/modules.md
  - docs/architecture/directory.md
plannerNote: "P6 deferred 잔여 3 곳이 이미 shipped 된 2 항목을 defer 로 박제 중 — doc-only inline-amend x0.64 = 약 20 LOC / 3 파일"
completedAt: 2026-07-30T04:45:00Z
commit: b3ce7d69
resultSummary: "P6 deferred 잔여 목록 3 곳(PLAN.md 123 · modules.md 239 · directory.md 164)에서 shipped 2 항목(GroupMember add·remove mutation / import 결과 상세) 제거 + modules.md 에 shipped 근거(squash 340d50a2 · 36cdbaa7) 2 bullet 박제. 잔여 유효 2 항목(재평가·스케줄 패널 / polling)은 글자 그대로 유지. direct 1 commit, 3 파일 +6/-3."
---

# T-1313 — P6 deferred 잔여 목록 정합 (shipped 2 항목 제거)

## Why

[docs/PLAN.md](../PLAN.md) 123 행 · [modules.md](../architecture/modules.md) 239 행 · [directory.md](../architecture/directory.md) 164 행이 **같은 "P6 deferred 잔여" 목록 4 항목** 을 각각 박제하고 있는데, 그중 **2 항목은 이미 main 에 shipped** 다:

- **`GroupMember` add·remove mutation** — remove 는 [T-1130](T-1130-adminview-member-remove.md) (`runRemove` + `handleRemove`, PR #1022 squash `340d50a2`), add 는 [T-1131](T-1131-adminview-member-add.md) (`runAdd` 러너) + [T-1238](T-1238-group-member-add-container-wire.md) (컨테이너 `handleAdd` · `onAdd` 배선) 으로 완결. pre-check: `git grep -n "runAdd\|runRemove" -- web/src/views/AdminView.tsx` 가 다수 hit.
- **import 결과 상세** — [T-1132](T-1132-adminview-import-result-detail.md) (`formatImportJobDetail` 로 id·status·mode 표면화) + [T-1296](T-1296-import-response-restore-summary.md) (backend `restoreSummary` additive) + [T-1310](T-1310-import-result-restore-summary-detail.md) (web 소비, PR #1195 squash `36cdbaa7`) 로 완결. pre-check: `git grep -ln restoreSummary -- web/` 가 `AdminView.tsx` · `AdminView.test.tsx` 2 hit.

modules.md 239 행은 자기 목적을 **"본 doc 에 defer 사실을 박제해 다음 planner 가 미배선을 결함으로 재발견하지 않도록 한다"** 라고 적어 두었는데, 지금은 그 문장이 **반대로 작동** 한다 — 이미 shipped 된 표면을 "미배선" 으로 읽게 만들어 다음 planner 가 (a) 이미 있는 배선을 중복 task 로 큐잉하거나 (b) shipped 를 defer 로 오판할 위험을 만든다. 본 task 는 그 2 항목을 목록에서 빼고 **shipped 사실 + 근거 task/commit** 으로 대체한다.

**잔여 2 항목은 여전히 유효하므로 0 수정** — pre-check 로 재확인했다: (i) `/run` · bulk DELETE · `/reeval` · `/reset` 은 `git grep -nE '@(Post|Delete)\("(reeval|reset|run)' -- "src/**/*.controller.ts"` 가 **0 hit** (미구현 유지) → `ReEvaluationTriggerPanel` defer 유효, `SchedulePanel` 은 P7 + `@nestjs/schedule` 게이트 유효. (ii) `prisma/schema.prisma` 의 `model Assessment` 에 `status` 필드 **부재** → `EvaluationGuardBanner` 자동 polling defer 유효.

§3.1 상 세 파일 모두 **기존 문서의 inline 수정** 이라 direct 1 commit 이 맞다 (architecture doc 은 *신설* 만 pr — [T-1306](T-1306-api-doc-endpoint-total-recount.md) · [T-1311](T-1311-uc07-sequence-preview-step-sync.md) · [T-1312](T-1312-uc07-residual-step-ref-realign.md) 가 api.md · ADR-0046 inline amend 를 direct 로 처리한 선례와 동형).

## Required Reading

- [docs/PLAN.md](../PLAN.md) 123 행 — P6 `composition-wiring 전환` bullet 아래의 `**deferred 잔여 (backend 계약 확정 후 배선)**` 줄. 현재 4 항목을 `/` 로 나열: `ReEvaluationTriggerPanel·SchedulePanel 미마운트(...)` / `EvaluationGuardBanner 자동 polling(assessments rows status 필드 부재)` / `GroupMember add·remove mutation` / `import 결과 상세`. **수정 대상 1**.
- [docs/architecture/modules.md](../architecture/modules.md) 239 행 — `**의도적 defer (make-work 아님 — backend 계약 확정 후 배선)**` 단락. 같은 4 항목 + 근거 (`api.md` 94~97 / SchedulerModule P7) + 목적 문장. **수정 대상 2** (canonical 서술이라 shipped 근거를 여기에 가장 구체적으로 적는다).
- [docs/architecture/directory.md](../architecture/directory.md) 164 행 — `backend endpoint 미shipped 로 의도적 defer 된 잔여 (... , auto-polling, GroupMember mutation, import 결과 상세) 는 modules.md ... 이미 박제` 줄. modules.md 로 위임하는 요약 참조라 **목록 부분만 정합** 한다. **수정 대상 3**.
- [docs/PLAN.md](../PLAN.md) 120 행 — P6 `Admin 패널` bullet (`④a~④h ... 조립 완료`). **0 수정 대상** — 재평가·스케줄 defer 언급은 여전히 참이며, 멤버 mutation shipped 사실은 123 행에서만 박는다 (중복 박제 회피 판정 근거로 읽는다).
- [docs/tasks/T-1310-import-result-restore-summary-detail.md](T-1310-import-result-restore-summary-detail.md) 의 `## 결과` 절 — import 결과 상세 종결 근거 (PR #1195 / squash `36cdbaa7` / `formatRestoreTotalsPhrase`).
- [docs/tasks/T-1238-group-member-add-container-wire.md](T-1238-group-member-add-container-wire.md) frontmatter + `## 결과` 절 — 멤버 add 배선 종결 근거 (`handleAdd` · `onAdd` · `addCandidates`).

## Acceptance Criteria

- [ ] **PLAN.md 123 행 정합** — deferred 잔여 나열에서 `GroupMember add·remove mutation` 과 `import 결과 상세` 2 항목을 **제거** 하고, 남은 2 항목 (`ReEvaluationTriggerPanel`·`SchedulePanel` 미마운트 / `EvaluationGuardBanner` 자동 polling) 과 그 근거 괄호는 **글자 그대로 유지**. 같은 줄 끝에 shipped 사실 한 조각을 덧붙인다: 멤버 add·remove mutation ([T-1130](T-1130-adminview-member-remove.md) · [T-1131](T-1131-adminview-member-add.md) · [T-1238](T-1238-group-member-add-container-wire.md)) 과 import 결과 상세 ([T-1132](T-1132-adminview-import-result-detail.md) · [T-1296](T-1296-import-response-restore-summary.md) · [T-1310](T-1310-import-result-restore-summary-detail.md)) 는 **배선 완료로 목록에서 내렸다** 는 취지. **최대 2 줄** — bullet 을 새로 신설하지 않고 기존 줄 안에서 끝낸다.
- [ ] **modules.md 239 행 정합** — 같은 2 항목 제거 + shipped 근거 명시 (task ID 병기, squash SHA 는 `340d50a2` · `36cdbaa7` 2 개까지만). 단락의 **목적 문장** (`다음 planner 가 미배선을 결함으로 재발견하지 않도록 한다`) 은 유지하되, 그 취지가 이제 **양방향** (미배선을 결함으로 오판 금지 + shipped 를 미배선으로 오판 금지) 임을 한 절로 보강한다. 근거 참조 (`api.md` 94~97 / SchedulerModule P7 / `@nestjs/schedule` 새 dep) 는 0 수정. 단락 길이 증가는 **최대 3 줄**.
- [ ] **directory.md 164 행 정합** — 괄호 안 목록에서 `GroupMember mutation` · `import 결과 상세` 제거. `modules.md` 로 위임한다는 문장 구조와 링크는 0 수정 (**중복 박제 금지 규율 유지** — 여기에 shipped task ID 를 다시 나열하지 않는다).
- [ ] **잔여 유효 항목 생존 확인 (검증 명령)** — `git grep -c "ReEvaluationTriggerPanel" -- docs/PLAN.md docs/architecture/modules.md docs/architecture/directory.md` 가 **세 파일 각 1+ hit** 이고, `git grep -n "자동 polling\|auto-polling" -- docs/PLAN.md docs/architecture/modules.md docs/architecture/directory.md` 도 **세 파일 각 1+ hit**.
- [ ] **shipped 항목 잔존 0 확인 (검증 명령)** — `git grep -n "import 결과 상세" -- docs/PLAN.md docs/architecture/modules.md docs/architecture/directory.md` 가 **0 hit 이거나, hit 이 전부 "완료/배선됨" 문맥** (defer 나열이 아님) 이다. 같은 판정을 `git grep -n "GroupMember" -- docs/PLAN.md docs/architecture/modules.md docs/architecture/directory.md` 에도 적용 — `GroupMemberList 조회` (PLAN.md 120 행) 같은 무관 hit 는 살아있어야 한다 (과잉 치환 오탐 차단).
- [ ] **R-112 4 항목 — direct doc-only (production code 0 LOC, `src/` · `web/` · `test/` 0 수정) 라 §3.2 상 unit test 의무 면제.** 대신 동형 검증 4 종을 실행해 통과시키고 결과를 commit body 에 남긴다: (a) *happy path* — 위 두 검증 명령 (잔여 생존 / shipped 잔존 0) 통과, (b) *error path* — shipped 판정의 근거가 실재함을 재확인: `git grep -c "runAdd" -- web/src/views/AdminView.tsx` ≥ 1 **AND** `git grep -c "runRemove" -- web/src/views/AdminView.tsx` ≥ 1 **AND** `git grep -ln restoreSummary -- web/` 가 2 파일, (c) *branch* — 잔여로 남긴 2 항목이 **여전히 미shipped** 임을 대조: `git grep -nE '@(Post|Delete)\("(reeval|reset|run)' -- "src/**/*.controller.ts"` 가 **0 hit** + `model Assessment` 에 `status` 필드 부재 (`prisma/schema.prisma`), (d) *negative* — 과잉 치환 0: PLAN.md 120 행의 `GroupMemberList 조회` 와 modules.md 의 다른 `GroupMember`/`import` 문맥 (예: module import 서술) 이 **훼손 0**, 링크 상대경로 오타 0 (새로 추가한 task 링크가 `../tasks/` 또는 `T-NNNN-*.md` 로 실제 파일을 가리킴).
- [ ] **범위 밖 0 수정 확인** — `git diff --stat` 이 정확히 3 파일 (`docs/PLAN.md`, `docs/architecture/modules.md`, `docs/architecture/directory.md`) 이고 합계 diff ≤ 300 LOC (목표 ≤ 30 LOC).
- [ ] **언어 규율 (§12)** — 서술은 한국어, task ID · squash SHA · 컴포넌트명 (`ReEvaluationTriggerPanel` 등) · endpoint path 는 영어/식별자 그대로.

## Out of Scope

- **`src/**` · `web/**` · `test/**` 0 수정** — 본 task 는 문서 정합만. 코드 동작 변화 0.
- **`docs/progress/journal-*.md` 0 수정** — 과거 journal 의 "import 결과 상세 defer" 언급은 **그 시점의 사실** 이라 정정 대상이 아니다 (history 보존, §12 "과거와의 호환").
- **PLAN.md 120 행 (Admin 패널 bullet) 0 수정** — 재평가·스케줄 defer 언급은 여전히 참. 멤버 mutation shipped 는 123 행에서만 박아 중복 박제를 피한다.
- **잔여 2 항목 (`ReEvaluationTriggerPanel`·`SchedulePanel` / polling) 의 배선 착수 0** — 각각 `/reeval`·`/reset` backend 계약 + P7 `@nestjs/schedule` 새 dep + `Assessment.status` schema 게이트 대상이다.
- **`docs/architecture/api.md` 0 수정** — 94~97 행 미구현 annotation 은 현재도 정확하다 (본 task 의 branch 검증이 그 사실을 확인만 한다). [T-1306](T-1306-api-doc-endpoint-total-recount.md)/[T-1311](T-1311-uc07-sequence-preview-step-sync.md) 가 최근 손댄 파일이라 재수정 시 이중 변경 위험.
- **`src/export/**` · `src/import/**` 코드 주석의 UC-07 §5 step 참조 재정렬 0** — [T-1312](T-1312-uc07-residual-step-ref-realign.md) Follow-ups 의 41 곳 / 26 파일 sweep 은 별건 (5 파일 cap 초과 + 선행 drift 혼재).
- **P6 잔여 목록을 단일 canonical 파일로 통합하는 리팩터 0** — 3 곳 중복 자체의 구조 개선은 본 slice 범위를 넘는다 (Follow-ups 에 박제).
- **`deploy/daily-test.sh` leg 추가 0** — leg 추가는 drift-guard smoke spec 3 종 동반 수정으로 cap 이 깨진 Q-0054 선례가 있다.

## Suggested Sub-agents

`implementer`

## Follow-ups

- (본 slice 관측) P6 deferred 잔여 목록이 **3 곳에 중복 박제** (PLAN.md 123 · modules.md 239 · directory.md 164) — 한 곳이 canonical 이고 나머지는 참조만 하도록 정리하는 slice 후보. 본 task 는 directory.md 의 위임 구조만 유지했다.
- (T-1312 이월) `src/export/**` · `src/import/**` 코드 주석 41 곳 / 26 파일의 UC-07 §5 step 참조 재정렬 — 대응표 확정 slice 선행 또는 주석-only cap-bend 단일 slice 중 선택.
- (T-1312 이월) UC-07 103 행 `step 수: 약 13` 이 실제 arrow 17 과 불일치 — 다음 문서 slice 후보.
- (T-1310 이월) `perEntity` breakdown 표시 slice — 확인 단계 · 결과 문구 중 어디에 붙일지 제품 판단 선행.
- (T-1306 이월) `conceptual placeholder` 2 행 (`GET /api/me/permission-denied` · `GET /api/admin/permission-denied`) 처분 — 제품 판단 대상.
- (T-1305 이월) export preview 2 종 (`describe-scope` · `preview-selection`) 의 잘못된 scope 조합이 **500** 으로 나가는 현재 동작의 4xx 매핑 여부 판단.
- (유지) **부분 dump + REPLACE 의 비선별 entity 삭제** — 차단 / 경고 정책 자체는 제품 결정 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. supertest 의 multer mid-stream abort 표면화 확인 후 flaky 하면 포기 선택지 보고.
- (미해결 정책, T-1287 이월) `LlmProviderConfig` 왕복 불가 — export 가 `apiKey` 를 제외하는데 schema 는 not-null. **§5 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) Export / Import Audit log row 영속화 0 — schema migration 이라 §5 사람 결정 대상.
- (PLAN 게이트 backlog) `web/package.json` vitest `coverageThreshold` 도입 — 새 dep 필요라 §5 승인 게이트.
