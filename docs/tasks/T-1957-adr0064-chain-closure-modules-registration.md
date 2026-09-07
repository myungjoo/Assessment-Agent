---
id: T-1957
title: ADR-0064 chain 종결 doc-sync + modules.md 알고리즘·연구 축 등재
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-019, REQ-032]
estimatedDiff: 45
estimatedFiles: 2
created: 2026-09-07
independentStream: p5-algorithm-research-uplift
dependsOn: [T-1955, T-1956]
touchesFiles:
  - docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md
  - docs/architecture/modules.md
plannerNote: "P5 — T-1956 머지로 ADR-0064 §Status 18 행·(c) 의 '관측 로그 미착수' 서술이 거짓이 됨 + modules 표에 알고리즘·연구 축 미등재"
---

# T-1957 — ADR-0064 chain 종결 doc-sync + modules.md 알고리즘·연구 축 등재

## Why

두 문서가 **현 main 과 어긋난 상태로 남아 있다**. 둘 다 [ADR-0064](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) chain (T-1949~T-1956) 이 종결되면서 생긴 잔여이고, 정본 문서를 읽는 후속 agent 가 사실과 다른 서술을 근거로 판단하는 것을 막는 것이 본 task 의 목적이다.

1. **ADR-0064 자기 서술의 staleness** — `§ Status` `18 행` 은 "**잔여 항목은 (c) 의 상향 건수 관측 로그 1 건뿐** 이다 — `evaluation-adjustments-pipeline.ts` · `evaluation-algorithm-research-adjust.ts` 전수에 `Logger` · `console` 참조가 0" 이라고 단언하고, `§ Follow-ups` `112 행` (c) 도 "**부분 완료**" · "**관측 로그 축은 미착수**" 로 남아 있다. 그러나 [T-1956](T-1956-algorithm-research-uplift-count-log.md) (PR #1536 → merge `e0a0dff0`) 이 그 로그를 배선해 [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `98 행` 이 `Logger` import, `130 행` 이 logger 인스턴스, `374~385 행` 이 상향 건수 산출 + 조건부 로그다 — 즉 인용된 실측 근거가 **반증됐다**. ADR-0064 는 이제 (a)~(d) 전부 완료로 chain 이 닫혔다.
2. **modules.md 미등재** — CLAUDE.md `§ 7` 은 agent 가 `src/` 전수 grep 대신 [modules.md](../architecture/modules.md) 를 먼저 읽게 하는데, 그 정본 표의 `40 행` (AssessmentCollectionModule) · `41 행` (AssessmentEvaluationModule) 어디에도 R-38 상향 축이 없다. 실측: `grep -n -i "algorithm" docs/architecture/modules.md` → **매칭 0**, `grep -o "ADR-00[0-9][0-9]" docs/architecture/modules.md | sort -u` 에 **ADR-0064 부재**. 따라서 main 에 실재하는 production 파일 4 종 (수집 경계 파생 신호 1 + 평가 detection 1 + uplift adjuster 1 + pipeline step (9) 배선) 이 module 인덱스에서 보이지 않는다.

**issue-still-relevant pre-check (origin/main `e91d3e0c` 실측 — 안착 0)**:

- `grep -n -i "algorithm" docs/architecture/modules.md` → **0 hit** (등재 전무).
- `grep -rn "algorithm-research\|algorithmResearch" docs/use-cases/REQ-COVERAGE-AUDIT.md` → **0 hit** (본 task 범위 밖 — 아래 Out of Scope).
- ADR-0064 `18 행` · `112 행` 의 "미착수" 문구가 그대로 잔존 (위 1 의 인용 그대로).
- 동일 의도 task 0 — ADR-0064 후속 doc task 로 `status: PENDING` 인 것이 없고 `T-1957` ID 미사용.

**오너 게이트 판정 — 셋 다 미침범**:

- PLAN `157 행` (R-91 k6 최우선): 본 task 는 `package.json` · `.github/workflows/load-k6.yml` · `test/load/` 무변경이라 자원 경합 0. k6 harness 는 도입 · S1/S2/S3 script · CI job · 133 명 seed step 까지 안착했고 ([load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 1 · 3 · 4 · 5), 잔여 축인 "실 dataset 수집 왕복 (50~100 repo)" 은 배포기기 PAT · LLM 자격증명 게이트라 planner 가 dependency-free 로 큐잉할 수 없다 (PLAN `161 행` 이 `LOAD_TEST_STUB=1` stub · 자격증명 0 으로 미발화 명시).
- PLAN `158 행` (per-route perf baseline 신규 slice 금지): `test/perf/` 무변경 · 신규 perf-spec 0 으로 비해당.
- PLAN `183 행` (REQ 재판정 구현 후 1 회): REQ-019 재판정은 [T-1955](T-1955-adr0064-algorithm-research-doc-sync-req019-rejudge.md) 가 **이미 1 회** 수행했다. 본 task 는 [docs/requirements.md](../requirements.md) 를 **건드리지 않는다** (Out of Scope 명시). modules.md 의 REQ 열은 module ↔ REQ mapping 표기이지 REQ status 재판정이 아니다.

**CLAUDE.md `§ 3` 소비처 동반 의무 판정: 비해당** — helper · factory · 어댑터 신설이 0 인 doc-only 변경이다. 두 문서를 한 commit 으로 묶는 이유는 PLAN `182 행` (슬라이스 과분할 차단) 의 취지대로 같은 chain 종결 서술을 두 fire 로 왕복시키지 않기 위함이며, 합계가 cap 안 (2 파일 / ~45 LOC) 이다.

**commitMode 판정: `direct`** — CLAUDE.md `§ 3.1` 의 "기존 ADR · architecture 문서의 비-결정 수정 (pointer · 표기)". ADR 의 `§ Decision 1~5` 는 1 자도 바꾸지 않고 `§ Status` · `§ Follow-ups` 의 진척 서술만 사실로 맞춘다 (선례 T-1955 도 같은 성격의 direct). `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/` 변경 0.

## Required Reading

- [docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) — `6 행` frontmatter `relatedTask`, `14 행` `## Status` 와 `18 행` 잔여 문단, `106 행` `## Follow-ups` 와 `112 행` (c) bullet · `113 행` (d) bullet
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) — `98 행` `Logger` import · `130 행` logger 인스턴스 · `374~385 행` 상향 건수 산출 + 조건부 로그 (T-1956 이 박제한 반증 좌표, **읽기 전용**)
- [docs/architecture/modules.md](../architecture/modules.md) — `40 행` AssessmentCollectionModule row · `41 행` AssessmentEvaluationModule row (각 row 는 module / 설명 / 의존 / component / REQ / ADR 6 열), `45 행` "위 12 module" 산문 (row 수 불변 확인용)
- [docs/tasks/T-1956-algorithm-research-uplift-count-log.md](T-1956-algorithm-research-uplift-count-log.md) — frontmatter + `## Why` (머지 사실 · PR 번호 확인용)

## Acceptance Criteria

- [ ] ADR-0064 `§ Status` `18 행` 문단이 **T-1956 머지 사실** 로 교체된다 — "관측 로그 미착수" 서술을 남기지 않고, 근거 좌표 (T-1956 · PR #1536 · merge `e0a0dff0` · `evaluation-adjustments-pipeline.ts` `130 행` · `374~385 행`) 를 박제한다. 검증: `grep -n "미착수" docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md` 결과에 `§ Status` · (c) 관련 hit 이 없다 (확장 지점 bullet 의 미착수 표기는 후속 ADR 대상임이 문장에 명시된 경우에만 유지).
- [ ] ADR-0064 `§ Follow-ups` `112 행` (c) 가 "**부분 완료**" → "**완료**" 로 바뀌고 3 번째 slice (T-1956, PR #1536, merge `e0a0dff0`) 가 나열된다. 검증: `grep -n "T-1956" docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md` 가 2 곳 이상에서 hit.
- [ ] ADR-0064 frontmatter `6 행` `relatedTask` 배열에 `T-1956` (필요 시 `T-1957`) 이 추가된다. 검증: `sed -n '6p' docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md` 에 `T-1956` 포함.
- [ ] modules.md `40 행` AssessmentCollectionModule row 의 설명 열에 수집 경계 파생 신호 [algorithm-research-signal.ts](../../src/assessment-collection/domain/algorithm-research-signal.ts) (`computeAlgorithmResearchHits` · `metadata.algorithmResearchHits` 산출 · github/confluence 두 mapper 배선) 가 1~2 문장으로 등재되고, ADR 열에 ADR-0064 링크가 추가된다.
- [ ] modules.md `41 행` AssessmentEvaluationModule row 의 설명 열에 평가 축 3 좌표 — [evaluation-algorithm-research-signal.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts) (`computeAlgorithmResearchSignal`) · [evaluation-algorithm-research-adjust.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts) (`applyAlgorithmResearchUplift`) · [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) step (9) 배선 + 상향 건수 로그 — 가 등재되고, REQ 열에 REQ-019, ADR 열에 ADR-0064 링크가 추가된다.
- [ ] 표 구조 불변 — 두 row 모두 pipe 개수가 편집 전과 같고 신규 row 0. 검증: 편집 전후로 `awk 'NR==40 || NR==41' docs/architecture/modules.md` 의 `|` 개수가 동일하고, `45 행` 의 "위 12 module" 산문은 무변경.
- [ ] `grep -c -i "algorithm" docs/architecture/modules.md` 가 **2 이상** (편집 전 0).
- [ ] 문서 본문은 한국어, 경로 · 심볼 · ADR/REQ/T-NNNN 식별자는 영어 (CLAUDE.md `§ 12`). 행 범위 표기는 `~` 구분자 · `L` prefix 금지.
- [ ] **R-110 tester 면제 근거**: `src/` · `web/` · `test/` · `prisma/` · `package.json` · `.github/` 변경 **0** 인 direct doc-only commit 이다. 검증: commit 직전 `git status --porcelain` 이 위 2 파일 + 본 task 파일 + `docs/STATE.json` + `docs/progress/journal-2026-09-07.md` 외 항목 0. 코드 변경 0 이라 R-112 4 축 (happy-path / error path / 분기별 / 예외 분기마다 negative) 과 coverage 임계 (line ≥ 80% / function ≥ 80%) 는 **비해당** — 신규 public symbol 0 · 신규 분기 0.

## Out of Scope

- [docs/requirements.md](../requirements.md) 수정 금지 — REQ-019 재판정은 T-1955 가 once-rule 대로 이미 1 회 수행 (PLAN `183 행`).
- [docs/PLAN.md](../PLAN.md) `103 행` 품질 분류 bullet 재편집 금지 — T-1955 가 이미 R-38 상향 축을 등재.
- [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 알고리즘·연구 좌표 등재 — 8,000 행 규모 감사 정본이라 별도 slice (아래 Follow-ups (1)).
- ADR-0064 `§ Decision 1~5` · `§ Context` · `§ Consequences` 의 결정 내용 변경 금지 (변경 시 `pr` 전환 대상 — CLAUDE.md `§ 3.1`).
- `src/assessment-evaluation/domain/evaluation-quality-signal.ts` · `evaluation-quality-adjust.ts` 주석의 REQ 오기 정정 — `src/` 를 건드려 `pr` 이므로 본 direct task 와 섞지 않는다 (Follow-ups (2)).
- ADR-0063 (내용 지문 dedup) 축의 modules.md 등재 — 다른 chain (Follow-ups (3)).
- modules.md 의 다른 10 module row · mermaid 그래프 · `47~48 행` T-1425 각주 수정 금지.

## Suggested Sub-agents

`implementer` (doc-only 편집 — 신규 결정 0 이라 architect 불필요, 코드 변경 0 이라 tester 불필요)

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 인접 작업 발견 시 여기에 추가한다.)

- (planner 사전 인지, 본 task 범위 밖) (1) REQ-COVERAGE-AUDIT 알고리즘·연구 좌표 등재 (direct), (2) `evaluation-quality-signal.ts` · `evaluation-quality-adjust.ts` `2~3 행` REQ 오기 정정 (pr), (3) ADR-0063 지문 dedup 축의 modules.md 등재 (direct).
