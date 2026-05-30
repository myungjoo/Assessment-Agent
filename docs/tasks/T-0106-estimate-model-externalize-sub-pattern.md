---
id: T-0106
title: estimate-model.md 에 doc-only externalize sub-pattern 박제 (T-0104 + T-0105 2 회차 데이터)
phase: P3
status: PENDING
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 90
estimatedFiles: 3
created: 2026-05-30
dependsOn: []
plannerNote: "cron fire — T-0104 ×3.9 (JSON-fenced) vs T-0105 ×0.67 (compact markdown) 2 회차 externalize 데이터로 §3.7 신규 sub-pattern 박제. cron-safe doc-only direct inline-amend ×0.4, 1-turn."
---

# T-0106 — estimate-model.md 에 doc-only externalize sub-pattern 박제 (T-0104 + T-0105 2 회차 데이터)

## Why

[직전 T-0104](T-0104-humanquestions-archive-externalize.md) (humanQuestions 12 entry externalize, JSON-fenced lossless preservation) 가 planner estimate 의 **×3.9 over** (+349/-245) 를, [직전 T-0105](T-0105-reviewrounds-archive-externalize.md) (reviewRounds 68 entry externalize, compact markdown 표) 가 **×0.67 under** (+87/-71) 를 기록 — 같은 "STATE-trim externalize" 카테고리인데도 **포맷 선택 차이로 LOC inflation 이 약 6 배** 벌어졌다. 두 회차 모두 `docs/tasks/T-0104` / `T-0105` 의 §Follow-ups 가 "estimate-model.md 의 doc-only externalize sub-pattern 박제" 를 명시 박제했다 — 본 task 가 2 회차 데이터를 묶어 [docs/architecture/estimate-model.md](../architecture/estimate-model.md) 에 박제한다.

**박제 가치 3 종**:

1. **포맷별 LOC inflation 측정 데이터** — JSON-fenced lossless preservation 은 entry 당 ~27 LOC (332 라인 / 12 entry), compact markdown 표는 entry 당 ~1.2 LOC (83 라인 / 68 entry, 헤더 ~15 LOC 제외) — **약 22 배 LOC 효율 차이**. 향후 externalize task 가 default 로 compact markdown 표 채택하도록 가이드.
2. **inline-amend sub-multiplier (×0.4) 와의 구분** — T-0104 / T-0105 둘 다 inline-amend 가 아니다 (신규 archive 파일 create + JSON trim 의 조합) — 별도 sub-pattern 분류 필요. inline-amend 누적 11 회차 평균 -55% under (T-0070~T-0102) 와는 별개 패턴.
3. **estimate-model.md §3.x sub-pattern slot 정합** — §3.5 (single-file-create 1 회차) / §3.6 (cleanup-only 1 회차) sibling 으로 §3.7 (externalize 2 회차) 신설. 2 회차 누적 박제 + 포맷 선택 가이드 동반.

본 task 는 **doc-only `direct`** ([CLAUDE.md §3.1](../../CLAUDE.md)) — 변경 대상이 `docs/architecture/estimate-model.md` (inline-amend 6 곳) + `docs/STATE.json` (bookkeeping) + `docs/progress/journal-2026-05-30.md` (append) 로 전부 `direct` 컬럼. src/ test/ 코드 변경 0, ADR 신설 0, CI workflow 변경 0 → reviewer / integrator / 4-게이트 / CI green 면제. **cron-safe** — single-turn direct commit, PR mid-flight collision 위험 0. [race-patterns.md §7 (cron-vs-manual /loop overlap)](../architecture/race-patterns.md) 의 lesson 정합.

## Required Reading

- [docs/architecture/estimate-model.md](../architecture/estimate-model.md) — 본 task 가 amend 대상. 특히 §2.5 (16 회차 case study) + §2.6 (31 회차 누적 평균) + §3.5 (single-file-create) + §3.6 (cleanup-only) + §4 (multiplier 산출) + §7 (References) 6 곳. 새 §3.7 신설 + §2.5 / §2.6 / §4 / §7 갱신.
- [docs/tasks/T-0104-humanquestions-archive-externalize.md](T-0104-humanquestions-archive-externalize.md) — 1 회차 externalize 데이터 source. frontmatter `actualDiff: 349` / `actualFiles: 3` / `diffNote` 박제 + driverNote (×3.9 over 박제 근거 — JSON-fenced lossless preservation 의 verbosity 본질).
- [docs/tasks/T-0105-reviewrounds-archive-externalize.md](T-0105-reviewrounds-archive-externalize.md) — 2 회차 externalize 데이터 source. frontmatter `actualDiff: 87` / `actualFiles: 4` / `diffNote` 박제 + driverNote (×0.67 under 박제 근거 — compact markdown 표 채택의 verbosity 회피).
- [docs/progress/journal-2026-05-30.md](../progress/journal-2026-05-30.md) — 본 task 완료 라인 append 대상 (1~5 줄, [CLAUDE.md §7 point 4](../../CLAUDE.md)). 13:42 planner + 13:48 driver entry 가 T-0105 externalize 박제 데이터 reference source.
- [CLAUDE.md §3.1 commitMode 정책 + §7 context 절약 + §9 STATE 단일 writer + counters read-modify-write](../../CLAUDE.md) — 본 task 가 doc-only direct 인 근거 + STATE write 규칙.

## Acceptance Criteria

본 task 는 **direct doc-only** 이므로 [CLAUDE.md §3.2 R-110~R-114](../../CLAUDE.md) 의 unit test / R-112 4 카테고리 / coverage 의무 **면제** (코드 변경 0). 분기 있는 코드 0 — R-112 4번 항목 적용 대상 없음 (분기 없음 — 이 항목 생략). 검증은 파일 inspect + grep 으로 수행.

### A. estimate-model.md §3.7 신규 sub-pattern 신설

- [ ] `### 3.7 doc-only externalize (신규 sub-pattern 후보, 2 회차 박제)` 신설 — 기존 §3.6 (cleanup-only) 직후 배치. 본문은 §3.5 / §3.6 의 1 회차 박제 패턴 구조 1:1 mirror — 정의 + 박제 데이터 표 + 포맷별 LOC inflation 측정.
- [ ] sub-pattern 정의 박제: "STATE.json 의 누적 block (resolved-HQ / reviewRounds / 향후 blockers etc) 을 별도 `docs/progress/*-archive.md` 파일로 1:1 이전 + STATE 에 archive 포인터 필드 추가. **신규 archive 파일 create + JSON trim 의 조합**, inline-amend 와는 다른 별개 패턴".
- [ ] 박제 데이터 표 (2 회차):

  | task | entry 수 | archive LOC | entry/LOC | 포맷 | planner estimate | actualDiff | variance |
  |---|---|---|---|---|---|---|---|
  | T-0104 | 12 | 332 | ~27 | JSON-fenced lossless | 130 | 349 | ×2.68 over |
  | T-0105 | 68 | 83 | ~1.2 | compact markdown 표 | 130 | 87 | ×0.67 under |

  (entry/LOC 컬럼은 archive LOC / entry 수, 헤더 ~15 LOC 포함 raw 수치.)

- [ ] 포맷별 LOC inflation 측정 박제 (1 줄): "compact markdown 표가 JSON-fenced 대비 entry 당 약 22 배 LOC 효율 (1.2 vs 27 LOC/entry) — 향후 externalize task default 로 compact markdown 표 채택 권장. JSON-fenced 는 schema 보존 의무 (외부 도구 parse 요구) 시에만 채택."
- [ ] inline-amend (§3.2.2 ×0.4) 와의 구분 박제 (1 줄): "본 sub-pattern 은 기존 doc section 단위 수정 (inline-amend) 이 아니라 **신규 archive 파일 create + JSON trim 의 조합** — sub-multiplier 별도. inline-amend 누적 11 회차 평균 -55% under 와는 별개 데이터."

### B. estimate-model.md §2.5 (case study) 갱신

- [ ] §2.5 case study 표에 T-0104 + T-0105 2 row 추가 (또는 §2.5 가 16 회차로 닫혀있으면 새 sub-section §2.5.x 박제). 컬럼은 기존 표 정합 유지 (task / category / planner estimate / actualDiff / variance).
- [ ] T-0104 row: category=`doc-only externalize (JSON-fenced)`, estimate=130, actual=349, variance=×2.68. T-0105 row: category=`doc-only externalize (compact markdown)`, estimate=130, actual=87, variance=×0.67.

### C. estimate-model.md §2.6 (누적 평균) 갱신

- [ ] §2.6 의 "31 회차 누적 평균" → "33 회차 누적 평균" 으로 갱신 (T-0104 + T-0105 2 회차 추가). 평균 variance 재산출은 필요시만 (간단 +0.x% 차이라면 생략 OK — 본 task 의 박제 무게중심은 §3.7 신규 sub-pattern).

### D. estimate-model.md §4 (multiplier 산출) 의 후속 marker 추가

- [ ] §4 끝에 footnote/note 1 줄: "externalize sub-pattern (§3.7) 은 2 회차 데이터 (T-0104 ×2.68 + T-0105 ×0.67) 박제 — 3+ 회차 누적 후 sub-multiplier 산출 (포맷 분리 후 각각 산출 권장)."

### E. estimate-model.md §7 (References) 갱신

- [ ] T-0104 + T-0105 + T-0106 (본 task) 3 신규 reference 추가. 형식: 기존 entry 1:1 mirror — `T-0104 — humanQuestions externalize (JSON-fenced ×2.68 over)`, `T-0105 — reviewRounds externalize (compact markdown ×0.67 under)`, `T-0106 — externalize sub-pattern §3.7 박제 (본 task)`.

### F. STATE bookkeeping + journal (driver 책임)

- [ ] STATE.json: `nextTask` = null (본 task 완료 시 — planner 가 set 한 nextTask=T-0106 를 driver 가 currentTask 로 옮긴 뒤 DONE 후 null), `lastActivity` 갱신, `lastCommit` = 본 commit SHA, `mostRecentTasks` prepend T-0106 (cap 5), `counters.tasksCompleted` 104→105 (read-modify-write, [CLAUDE.md §9](../../CLAUDE.md)), `lock` release.
- [ ] [docs/progress/journal-2026-05-30.md](../progress/journal-2026-05-30.md) 에 `driver: T-0106 DONE — estimate-model.md §3.7 externalize sub-pattern 신설 (T-0104 ×2.68 + T-0105 ×0.67 2 회차 데이터 박제)` 형태 1~5 줄 append.
- [ ] 본 task 파일 frontmatter `status: PENDING` → `DONE` + `completedAt` + `actualDiff` + `actualFiles` + `driverNote` 박제.

## Out of Scope

- **코드 / src / test / ADR / CI workflow 변경** — 본 task 는 doc-only direct. 코드 한 줄도 건드리지 않는다.
- **3+ 회차 누적 후 sub-multiplier 정식 산출** — 본 task 는 **2 회차 데이터 박제** + 포맷 분리 marker 만. 정식 sub-multiplier (예: ×0.7 / ×2.7 등 숫자값 fix) 는 3+ 회차 발생 후 별도 task.
- **resolved-HQ + reviewRounds 자동 archive 메커니즘 ADR** — T-0104 + T-0105 §Follow-ups 가 명시한 별도 follow-up. 본 task scope 0.
- **다른 STATE block (blockers / counters 등) externalize** — 현재 hot-read 가치 있는 active 데이터. 본 task 는 이미 externalize 된 2 block (humanQuestions + reviewRounds) 의 회고 박제만.
- **JSON-fenced 와 compact markdown 표의 다른 포맷 후보 (YAML / TOML / CSV) 박제** — 2 회차 데이터 박제로 충분. 다른 포맷 비교는 실 사용 시점 별도 박제.

## Suggested Sub-agents

`driver inline` — T-0093 / T-0096 / T-0097 / T-0100 / T-0102 / T-0103 / T-0104 / T-0105 driver inline 패턴 1:1 mirror (8 회차 누적). 특히 T-0105 가 doc-only direct externalize 의 1:1 mirror 패턴. executor sub-agent 0 — doc-only inline-amend 6 곳 + STATE bookkeeping 만, executor 호출 overhead 가 작업량보다 큼.

## Follow-ups

(empty — driver inline 진행 후 spot 시 append)
