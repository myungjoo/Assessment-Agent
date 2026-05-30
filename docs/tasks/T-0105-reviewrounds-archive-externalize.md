---
id: T-0105
title: STATE.json 의 reviewRounds block (~70 entry) 을 docs/progress/ archive 로 externalize
phase: P3
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 130
estimatedFiles: 3
created: 2026-05-30
completedAt: 2026-05-30T13:48:00+09:00
actualDiff: 87
actualFiles: 4
diffNote: "+87/-71 gross (archive +83 라인 compact markdown 표 = STATE.json -71 라인 의 1:1 relocation). planner estimate 130 의 ×0.67 — compact markdown 채택으로 T-0104 의 JSON-fenced ×3.9 verbosity inflation 회피 입증 (archive 83 라인 vs T-0104 332 라인, 68 vs 12 entry 인데도 1/4). externalize sub-pattern 포맷별 LOC 차이 박제."
dependsOn: []
plannerNote: "loop session #28 — STATE.json reviewRounds (~70 entry) externalize. cron-safe doc-only direct, 1-turn, PR cycle 0. 다음 cron ~14:00 collision 회피. T-0104 패턴 1:1 mirror."
---

# T-0105 — STATE.json 의 reviewRounds block (~70 entry) 을 docs/progress/ archive 로 externalize

## Why

[docs/STATE.json](../STATE.json) 의 `reviewRounds` block (L33-102, 약 70 task entry — `T-0005` ~ `T-0095`) 은 각 task 가 PR merge 까지 거친 reviewer round 수를 기록한 **historical 데이터**다. driver / planner / cron 이 **매 turn STATE.json 을 읽는데** ([CLAUDE.md §2 step 1](../../CLAUDE.md)), 이 block 은 이미 DONE 된 task 들의 과거 round 수를 담고 있어 **hot-read 가치가 0** — 진행 중 의사결정에는 쓰이지 않고 cold-start tax 로만 매 turn 재로드된다.

[직전 T-0104](T-0104-humanquestions-archive-externalize.md) 가 12 resolved humanQuestions 를 `docs/progress/humanQuestions-archive.md` 로 externalize 하면서 STATE.json 을 32.5k → 2.5k chars 로 trim 했고, 그 §Follow-ups 가 본 task 를 명시 박제했다 ("STATE.json `reviewRounds` block trim — 현재 ~70 task entry 누적. P3 진행 중 reviewRounds 가 hot-read 가치 낮은 historical 데이터 — 별도 doc-only direct externalize 후보 (본 humanQuestions archive 패턴 1:1 mirror)"). [PLAN.md 운영 정책 review backlog](../PLAN.md) 의 "STATE.json hot-read 절감" 정신 + [CLAUDE.md §7](../../CLAUDE.md) (context 절약 규칙) 에 정합.

**externalize 후에도 정보 손실 0** — reviewRounds entry 를 `docs/progress/reviewRounds-archive.md` 로 1:1 이전 (durable audit trail 보존). STATE.json 의 `reviewRounds` 는 빈 객체 `{}` 로 남기되 archive 경로를 가리키는 `reviewRoundsArchive: "docs/progress/reviewRounds-archive.md"` 포인터 필드 + `reviewRoundsArchivedCount: <N>` 을 추가해 추적성 유지. 향후 신규 task 의 round 수는 다시 `reviewRounds` 객체에 active 로 쌓이고, 일정 누적 시 다시 archive 로 이전하는 패턴의 2 회차 박제 (T-0104 humanQuestions 가 1 회차).

본 task 는 **doc-only `direct`** ([CLAUDE.md §3.1](../../CLAUDE.md)) — 변경 대상이 `docs/STATE.json` (reviewRounds trim) + 신규 `docs/progress/reviewRounds-archive.md` + `docs/progress/journal-2026-05-30.md` (append) 로 전부 `direct` 컬럼. src/ test/ 코드 변경 0, ADR 신설 0, CI workflow 변경 0 → reviewer / integrator / 4-게이트 / CI green 면제. **cron-safe** — 다음 cron 발화 (~14:00 KST) 와의 PR mid-flight collision 위험 0 (single-turn direct commit). [docs/architecture/race-patterns.md §7 (cron-vs-manual /loop overlap)](../architecture/race-patterns.md) 의 lesson 정합 — cron 활성 시간대 manual /loop 은 cron-safe doc-only direct 선호.

## Required Reading

- [docs/STATE.json](../STATE.json) — `reviewRounds` block (L33-102, 약 70 entry `"T-NNNN": N`). 본 task 가 trim 대상. 단일 writer 룰 ([CLAUDE.md §9](../../CLAUDE.md)) — planner 는 STATE write 가능하나 본 task 는 **driver 가 실행** (executor sub-agent 없이 driver inline 권장 — T-0093/T-0096/T-0097/T-0100/T-0102/T-0103/T-0104 driver inline 패턴 1:1 mirror, 특히 T-0104 가 STATE write 라 implementer 불가 → driver inline 선택한 근거 동일 적용). driver 가 `lock` / `loopSession` / `counters` / `mostRecentTasks` 본인 책임 필드는 본 task commit 안에서 함께 갱신.
- [docs/tasks/T-0104-humanquestions-archive-externalize.md](T-0104-humanquestions-archive-externalize.md) — 본 task 의 source (§Follow-ups 박제) + externalize 패턴 1:1 mirror 대상. 단 T-0104 의 JSON-fenced lossless preservation 이 estimate 의 ×3.9 over (+349/-245) 를 낳았으므로, 본 task 는 **더 compact 한 archive 포맷** (markdown 표) 을 채택해 verbosity inflation 회피 (아래 Acceptance Criteria A).
- [docs/progress/journal-2026-05-30.md](../progress/journal-2026-05-30.md) — 본 task 완료 라인 append 대상 (1~5 줄, [CLAUDE.md §7 point 4](../../CLAUDE.md)).
- [CLAUDE.md §3.1 commitMode 정책 + §7 context 절약 + §9 STATE 단일 writer + counters read-modify-write](../../CLAUDE.md) — 본 task 가 doc-only direct 인 근거 + STATE write 규칙.

## Acceptance Criteria

본 task 는 **direct doc-only** 이므로 [CLAUDE.md §3.2 R-110~R-114](../../CLAUDE.md) 의 unit test / R-112 4 카테고리 / coverage 의무 **면제** (코드 변경 0). 분기 있는 코드 0 — R-112 4번 항목 적용 대상 없음 (분기 없음 — 이 항목 생략). 검증은 파일 inspect + grep 으로 수행.

### A. `docs/progress/reviewRounds-archive.md` 신설

- [ ] 신규 파일 `docs/progress/reviewRounds-archive.md` 생성. 한국어 헤더 + 본 archive 의 목적 (STATE.json hot-read 절감을 위한 reviewRounds 외화) + 원본 source (STATE.json `reviewRounds`) + archive 시점 (2026-05-30) + 본 task ID (T-0105) cross-ref 박제.
- [ ] STATE.json 의 약 70 reviewRounds entry (`"T-NNNN": N`) 를 **정보 손실 0** 으로 1:1 이전 — 각 task ID 와 round 수 보존. **포맷은 compact markdown 표 권장** (예: `| task | rounds |` 2 컬럼 표, 또는 1 task 1 줄 `- T-NNNN: N`) — T-0104 의 JSON-fenced block 보다 verbosity 적게 (1:1 lossless preservation 유지하되 라인 inflation 최소화). archive 의 task ID 순서는 STATE.json 의 기존 순서 그대로 보존 (재정렬 0).
- [ ] grep 검증: archive 의 task entry 수가 STATE.json 의 기존 reviewRounds entry 수와 정확히 일치 (정보 손실 0). 예: `grep -c "T-0" docs/progress/reviewRounds-archive.md` 결과가 STATE.json 의 기존 reviewRounds entry 수 (약 70) 와 일치.

### B. `docs/STATE.json` 의 reviewRounds trim

- [ ] STATE.json 의 `reviewRounds` 객체를 빈 객체 `{}` 로 교체 (약 70 entry 제거 — archive 로 이전 완료).
- [ ] STATE.json 에 archive 포인터 필드 추가: `"reviewRoundsArchive": "docs/progress/reviewRounds-archive.md"` + `"reviewRoundsArchivedCount": <N>` (N = 이전한 entry 수, 실제 카운트로 박제). 위치는 `reviewRounds` 직전 또는 직후 (schema 정합 유지, JSON valid). `humanQuestionsArchive` / `humanQuestionsArchivedCount` 의 배치 패턴 (T-0104) 1:1 mirror.
- [ ] `counters` block 의 기존 필드 (`tasksCompleted` / `tasksBlocked` / `tasksSuperseded` / `tasksAccidentalMerge`) 변경 0 — 본 task 는 doc-only direct, `tasksCompleted` bump 은 driver 의 task DONE bookkeeping 단계에서 read-modify-write (103→104, [CLAUDE.md §9](../../CLAUDE.md)).
- [ ] `node -e "JSON.parse(require('fs').readFileSync('docs/STATE.json','utf8'))"` (또는 `python -c "import json; json.load(open('docs/STATE.json'))"`) 로 JSON valid 검증 — trim 후 parse error 0.
- [ ] STATE.json char count 가 trim 전 대비 유의미 감소 (reviewRounds ~70 entry 제거 — `reviewRounds: {}` + 2 포인터 필드만 남음). 검증: `wc -c docs/STATE.json` 가 trim 전 대비 감소 확인 (현재 ~2.5k chars 에서 reviewRounds ~1.5k chars 제거 → ~1k chars 수준).

### C. STATE bookkeeping + journal (driver 책임)

- [ ] STATE.json: `nextTask` = null (본 task 완료 시 — planner 가 set 한 nextTask=T-0105 를 driver 가 currentTask 로 옮긴 뒤 DONE 후 null), `lastActivity` 갱신, `lastCommit` = 본 commit SHA, `loopSession.turnCount` +1, `mostRecentTasks` prepend T-0105 (cap 5), `counters.tasksCompleted` 103→104 (read-modify-write), `lock` release.
- [ ] [docs/progress/journal-2026-05-30.md](../progress/journal-2026-05-30.md) 에 `driver: T-0105 DONE — reviewRounds block (~70 entry) externalize to reviewRounds-archive.md (STATE.json ~1.5k chars trim)` 형태 1~5 줄 append.
- [ ] 본 task 파일 frontmatter `status: PENDING` → `DONE` + `completedAt` + `actualDiff` + `actualFiles` + `driverNote` 박제.

## Out of Scope

- **코드 / src / test / ADR / CI workflow 변경** — 본 task 는 doc-only direct. 코드 한 줄도 건드리지 않는다.
- **STATE.json schema 의 다른 필드 재구조화** — `blockers` (현재 빈 배열) / `ci.note` / `loopSession.note` 등 다른 필드 trim 은 별도 follow-up (또는 이미 직전 task 들에서 trim 완료). 본 task 는 `reviewRounds` 만.
- **archive 파일의 향후 재이전 자동화 hook** — reviewRounds entry 가 N 개 누적 시 자동 archive 하는 메커니즘은 별도 ADR / task. 본 task 는 1 회성 reactive externalize.
- **reviewRounds 데이터 자체의 요약 / 통계 가공** — archive 는 1:1 정보 보존이 원칙. round 수 합산 / 평균 / 분석 0 (원시 entry 만 이전).
- **`reviewRounds` 객체를 STATE.json 에서 완전 제거** — 향후 신규 task 의 round 수가 다시 쌓일 자리이므로 빈 객체 `{}` 로 남긴다 (필드 자체 삭제 금지 — schema 정합, T-0104 의 `humanQuestions: []` 패턴 1:1 mirror).
- **resolved-HQ / reviewRounds 자동 archive 메커니즘 ADR** — 2 회차 reactive externalize (T-0104 humanQuestions + 본 T-0105 reviewRounds) 누적 후 abstraction 결정. 본 task scope 0 (별도 follow-up).

## Suggested Sub-agents

driver inline (executor sub-agent dispatch 0 권장 — doc-only direct main commit 은 reviewer / integrator / 4-게이트 / CI green 모두 불요. T-0093 / T-0096 / T-0097 / T-0100 / T-0102 / T-0103 / **T-0104** driver inline 패턴 1:1 mirror. 특히 T-0104 처럼 STATE write 가 필요해 implementer 가 할 수 없으므로 driver 가 archive 생성 + STATE trim 둘 다 직접 수행). cron env 에서 진입해도 gh CLI 불요 — graceful 진행 (race-safe).

## Follow-ups

- **resolved-HQ + reviewRounds 자동 archive 메커니즘 ADR** — T-0104 (humanQuestions) + 본 T-0105 (reviewRounds) 2 회차 reactive externalize 누적 — N 개 누적 시 자동으로 archive 로 이전하는 정책 + 메커니즘 (hook 또는 driver bookkeeping step) 을 ADR 로 추상화. 2 회차 데이터 박제 완료 후 적기.
- **estimate-model.md 의 doc-only externalize sub-pattern 박제** — T-0104 (JSON-fenced ×3.9 over) vs 본 T-0105 (compact markdown 표 — verbosity 회피 효과 측정) 2 회차 데이터로 externalize sub-pattern 의 포맷별 LOC inflation 차이 박제 (T-0104 §Follow-ups 가 1 회차 박제 source 명시).
