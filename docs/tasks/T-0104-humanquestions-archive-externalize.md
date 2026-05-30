---
id: T-0104
title: STATE.json 의 12 resolved humanQuestions 를 docs/progress/ archive 로 externalize
phase: P3
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 90
estimatedFiles: 3
estimatedLoc: 90
created: 2026-05-30
completedAt: 2026-05-30T13:33:00+09:00
actualDiff: 349
actualFiles: 4
diffNote: "+349/-245 gross (archive +332 라인 = STATE.json -245 라인 의 1:1 mechanical relocation, net 정보 변화 0). planner estimate 90 의 ×3.9 over — externalize/JSON-fenced 1:1 preservation 의 verbosity 미반영. doc-only direct 라 executor task-too-large hard-stop 미적용. estimate-model.md externalize sub-pattern 박제 source (T-0104 Follow-up)."
driverNote: "loop session #28 turn 3 — driver inline (executor dispatch 0, single-writer STATE 룰 준수). 12 resolved HQ → docs/progress/humanQuestions-archive.md (33.9k chars, 12 ## HQ- heading + lossless json fenced). STATE.humanQuestions=[] + humanQuestionsArchive 포인터 + humanQuestionsArchivedCount=12, STATE.json 32.5k→2.5k chars. node 생성기로 1:1 정보 보존."
dependsOn: []
sizeExempt: false
plannerNote: "loop session #28 — STATE.json hot-read bloat 제거 (12 resolved HQ ~28k chars → archive). cron-safe doc-only direct, 1-turn, PR cycle 0. 다음 cron ~14:00 collision 회피."
---

# T-0104 — STATE.json 의 12 resolved humanQuestions 를 docs/progress/ archive 로 externalize

## Why

[docs/STATE.json](../STATE.json) 의 `humanQuestions` 배열은 현재 **12 개 전부 resolved** (HQ-0001 ~ HQ-0012, 모두 `resolvedAt` set + `decision` 박제) 인데 약 28k chars 를 차지한다. driver / planner / cron 이 **매 turn STATE.json 을 읽는다** ([CLAUDE.md §2 step 1](../../CLAUDE.md)) — resolved HQ 는 이미 outcome 이 task 로 소비되어 (split → T-0002~T-0005 / patch → T-0006 / dep-install 승인 → T-0033/T-0036/T-0081/T-0082 / unblock 결정 → 각 task DONE) hot-read 가치가 0 인데도 매 turn cold-start tax 로 재로드된다.

[직전 T-0103](T-0103-race-patterns-amend-4-new-patterns.md) 의 driverNote 가 "잔여 28k 는 humanQuestions 12 resolved — structured 결정 기록, 별도 externalize follow-up 후보" 로 본 task 를 명시 박제했다. [CLAUDE.md §7](../../CLAUDE.md) (context 절약 규칙) 의 "광범위 read 금지" 정신 + STATE.json 을 머신리더블 hot state 로 유지하는 정책 (REQ-057/REQ-058 운영 기반) 에 정합.

**externalize 후에도 정보 손실 0** — resolved HQ 는 `docs/progress/humanQuestions-archive.md` 로 1:1 이전 (durable audit trail 보존). STATE.json 의 `humanQuestions` 는 빈 배열 `[]` 로 남기되 archive 경로를 가리키는 `humanQuestionsArchive: "docs/progress/humanQuestions-archive.md"` 포인터 필드 + `humanQuestionsArchivedCount: 12` 를 추가해 추적성 유지. 향후 신규 HQ 는 다시 `humanQuestions` 배열에 active 로 쌓이고, resolve 후 일정 누적 시 다시 archive 로 이전하는 패턴의 첫 박제.

본 task 는 **doc-only `direct`** ([CLAUDE.md §3.1](../../CLAUDE.md)) — 변경 대상이 `docs/STATE.json` (resolved HQ trim) + 신규 `docs/progress/humanQuestions-archive.md` + `docs/progress/journal-2026-05-30.md` (append) 로 전부 `direct` 컬럼. src/ test/ 코드 변경 0, ADR 신설 0, CI workflow 변경 0 → reviewer / integrator / 4-게이트 / CI green 면제. **cron-safe** — 다음 cron 발화 (~14:00 KST) 와의 PR mid-flight collision 위험 0 (single-turn direct commit). [docs/architecture/race-patterns.md §7 (cron-vs-manual /loop overlap)](../architecture/race-patterns.md) 의 lesson 정합.

## Required Reading

- [docs/STATE.json](../STATE.json) — `humanQuestions` 배열 (L104-340, HQ-0001 ~ HQ-0012 12 개 entry) + 그 직후 `counters` block. 본 task 가 trim 대상. 단일 writer 룰 ([CLAUDE.md §9](../../CLAUDE.md)) — planner 는 STATE write 가능하나 본 task 는 **driver 가 실행** (executor sub-agent 없이 driver inline 권장 — T-0093/T-0096/T-0097/T-0100/T-0102/T-0103 driver inline 패턴 1:1 mirror). driver 가 `lock` / `loopSession` / `counters` / `mostRecentTasks` 본인 책임 필드는 본 task commit 안에서 함께 갱신.
- [docs/tasks/T-0103-race-patterns-amend-4-new-patterns.md](T-0103-race-patterns-amend-4-new-patterns.md) — driverNote 의 "잔여 28k 는 humanQuestions 12 resolved — 별도 externalize follow-up 후보" 박제 (본 task 의 source).
- [docs/progress/journal-2026-05-30.md](../progress/journal-2026-05-30.md) — 본 task 완료 라인 append 대상 (1~5 줄, [CLAUDE.md §7 point 4](../../CLAUDE.md)).
- [CLAUDE.md §3.1 commitMode 정책 + §7 context 절약 + §9 STATE 단일 writer + counters read-modify-write](../../CLAUDE.md) — 본 task 가 doc-only direct 인 근거 + STATE write 규칙.

## Acceptance Criteria

본 task 는 **direct doc-only** 이므로 [CLAUDE.md §3.2 R-110~R-114](../../CLAUDE.md) 의 unit test / R-112 4 카테고리 / coverage 의무 **면제** (코드 변경 0). 분기 있는 코드 0 — R-112 4번 항목 적용 대상 없음. 검증은 파일 inspect + grep 으로 수행.

### A. `docs/progress/humanQuestions-archive.md` 신설

- [ ] 신규 파일 `docs/progress/humanQuestions-archive.md` 생성. 한국어 헤더 + 본 archive 의 목적 (STATE.json hot-read 절감을 위한 resolved humanQuestion 외화) + 원본 source (STATE.json `humanQuestions`) + archive 시점 (2026-05-30) + 본 task ID (T-0104) cross-ref 박제.
- [ ] STATE.json 의 12 resolved HQ entry (HQ-0001 ~ HQ-0012) 를 **정보 손실 0** 으로 1:1 이전 — 각 HQ 의 `id` / `taskId` (또는 `task`) / `reason` (있으면) / `summary` (또는 `question`) / `options` / `decision` / `decisionNote` / `resolvedAt` / `resolvedBy` 등 모든 필드 보존. JSON 원형 그대로 (```json fenced block) 또는 사람-친화 markdown 표/섹션 형태 중 택 1 — durable audit trail 로서 `git log` / 사람 추적 가능하면 무방. **권장: HQ 별 `## HQ-NNNN — <한 줄 요약>` 섹션 + 핵심 필드 markdown + decision 본문 한국어 보존.**
- [ ] grep 검증: `grep -c "HQ-00" docs/progress/humanQuestions-archive.md` 결과 12 개 HQ ID 모두 존재 (HQ-0001 ~ HQ-0012).

### B. `docs/STATE.json` 의 humanQuestions trim

- [ ] STATE.json 의 `humanQuestions` 배열을 빈 배열 `[]` 로 교체 (12 resolved entry 제거 — archive 로 이전 완료).
- [ ] STATE.json 에 archive 포인터 필드 추가: `"humanQuestionsArchive": "docs/progress/humanQuestions-archive.md"` + `"humanQuestionsArchivedCount": 12`. 위치는 `humanQuestions` 직전 또는 직후 (schema 정합 유지, JSON valid).
- [ ] `counters` block 의 기존 필드 (`tasksCompleted` / `tasksBlocked` / `tasksSuperseded` / `tasksAccidentalMerge`) 변경 0 — 본 task 는 doc-only direct, tasksCompleted bump 은 driver 의 task DONE bookkeeping 단계에서 read-modify-write (102→103, [CLAUDE.md §9](../../CLAUDE.md)).
- [ ] `node -e "JSON.parse(require('fs').readFileSync('docs/STATE.json','utf8'))"` (또는 `python -c "import json; json.load(open('docs/STATE.json'))"`) 로 JSON valid 검증 — trim 후 parse error 0.
- [ ] STATE.json char count 가 trim 전 대비 유의미 감소 (~28k chars 제거 — `humanQuestions: []` + 2 포인터 필드만 남음). 검증: `wc -c docs/STATE.json` 가 ~5k chars 이하 (loopSession/ci note 는 직전 T-0103 에서 이미 trim 됨).

### C. STATE bookkeeping + journal (driver 책임)

- [ ] STATE.json: `nextTask` = null (본 task 완료 시 — planner 가 set 한 nextTask=T-0104 를 driver 가 currentTask 로 옮긴 뒤 DONE 후 null), `lastActivity` 갱신, `lastCommit` = 본 commit SHA, `loopSession.turnCount` +1, `mostRecentTasks` prepend T-0104 (cap 5), `counters.tasksCompleted` 102→103 (read-modify-write), `lock` release.
- [ ] [docs/progress/journal-2026-05-30.md](../progress/journal-2026-05-30.md) 에 `driver: T-0104 DONE — 12 resolved humanQuestions externalize to humanQuestions-archive.md (STATE.json ~28k chars trim)` 형태 1~5 줄 append.
- [ ] 본 task 파일 frontmatter `status: PENDING` → `DONE` + `completedAt` + `actualDiff` + `actualFiles` + `driverNote` 박제.

## Out of Scope

- **코드 / src / test / ADR / CI workflow 변경** — 본 task 는 doc-only direct. 코드 한 줄도 건드리지 않는다.
- **STATE.json schema 의 다른 필드 재구조화** — `reviewRounds` (현재 ~70 entry) / `blockers` 등 다른 bloat 후보 trim 은 별도 follow-up task. 본 task 는 `humanQuestions` 만.
- **archive 파일의 향후 재이전 자동화 hook** — resolved HQ 가 N 개 누적 시 자동 archive 하는 메커니즘은 별도 ADR / task. 본 task 는 1 회성 reactive externalize.
- **HQ 내용 자체의 요약 / 재작성** — archive 는 1:1 정보 보존이 원칙. 내용 압축 / 의역 0.
- **`humanQuestions` 배열을 STATE.json 에서 완전 제거** — 향후 신규 active HQ 가 다시 쌓일 자리이므로 빈 배열 `[]` 로 남긴다 (필드 자체 삭제 금지 — schema 정합).
- **cron env permanent fix ADR / race-patterns 추가 amend / api.md UC-04 row** — 별도 follow-up (T-0101 / T-0103 follow-up 박제).

## Suggested Sub-agents

driver inline (executor sub-agent dispatch 0 권장 — doc-only direct main commit 은 reviewer / integrator / 4-게이트 / CI green 모두 불요. T-0093 / T-0096 / T-0097 / T-0100 / T-0102 / T-0103 driver inline 패턴 1:1 mirror). cron env 에서 진입해도 gh CLI 불요 — graceful 진행 (race-safe).

## Follow-ups

- **STATE.json `reviewRounds` block trim** — 현재 ~70 task entry 누적. P3 진행 중 reviewRounds 가 hot-read 가치 낮은 historical 데이터 — 별도 doc-only direct externalize 후보 (본 humanQuestions archive 패턴 1:1 mirror).
- **resolved-HQ 자동 archive 메커니즘 ADR** — resolved HQ 가 N 개 누적 시 자동으로 archive 로 이전하는 정책 + 메커니즘 (hook 또는 driver bookkeeping step). 본 task 의 1 회성 reactive externalize 패턴 누적 2+ 회차 박제 후 abstraction.
- **estimate-model.md 의 doc-only externalize sub-pattern 박제** — 본 task 의 STATE-trim externalize 가 inline-amend (×0.4) 와 다른 sub-pattern 인지 (신규 archive 파일 create + JSON trim) — 1 회차 데이터 박제 후 분류 결정.
