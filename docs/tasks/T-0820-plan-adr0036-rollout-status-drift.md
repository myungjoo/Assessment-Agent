---
id: T-0820
title: PLAN.md ADR-0036 fine-grained concurrency rollout bullet(160) implemented-on-main 정합
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057, REQ-058]
independentStream: doc-drift-reconciliation
dependsOn: []
touchesFiles: [docs/PLAN.md]
estimatedDiff: 8
estimatedFiles: 1
created: 2026-07-08
plannerNote: P5-in-progress; 운영 backlog bullet160 ADR-0036 rollout 이 'PROPOSED/stage1/토글OFF' stale — 실상 ACCEPTED+stage5b ON. T-0809~0818 drift 패턴 mirror, direct doc-only.
---

# T-0820 — PLAN.md ADR-0036 fine-grained concurrency rollout bullet(160) implemented-on-main 정합

## Why

docs/PLAN.md 운영 정책 review backlog 의 bullet 160 (ADR-0036 fine-grained concurrency staged rollout 추적) 이 ADR-0036 을 **(PROPOSED)** 으로, rollout 을 **"stage 1 진행 중 (T-0326)... stage 2~5 보류... 토글 OFF 인 동안 driver 동작 불변"** 으로 서술하나, 이는 실제 origin/main 상태와 어긋난 stale drift 다. 실상: ADR-0036 은 **ACCEPTED (2026-06-10)**, stage 2~5 인프라(claim registry·select+claim·loop 재작성·per-PR CI group·안전장치 5종)가 전부 shipped 됐고, 현 `STATE.json.flags.fineGrainedConcurrency=true` + `maxConcurrentClaims=2` = **stage 5b ON** (T-0348 5a → T-0349 → T-0350 5b). CLAUDE.md §10 (line 341~343) 및 docs/architecture/concurrency.md 가 이 상태를 이미 문서화했다. 본 task 는 최근 T-0809~T-0818 이 반복해 온 PLAN↔shipped-code checkbox drift 교정 패턴을 이 남은 미정합 bullet 에 mirror 해, 미래 planner 가 "아직 PROPOSED/보류 상태"로 오독하고 이미 완료된 rollout 을 재큐잉하는 make-work risk 를 차단한다.

## Required Reading

- `docs/PLAN.md` line 152~160 (운영 정책 review backlog 절, 특히 bullet 160 — 교정 대상). bullet 156/158 이 완료 항목 서술 포맷의 precedent.
- `docs/decisions/ADR-0036-fine-grained-concurrency.md` frontmatter (상단 3줄 + 2026-06-10 ACCEPTED blockquote + T-0341 amend 줄) — status/근거 인용용.
- `CLAUDE.md` line 341~343 (§10 토글-gated N-driver 경로 + stage 5b ON 서술 + 안전장치 5종) — 정합 대상 사실 source.
- `docs/architecture/concurrency.md` (존재 확인 — 운영 면 참조 링크 유효성).

## Acceptance Criteria

- [ ] `docs/PLAN.md` bullet 160 의 "ADR-0036 ... (PROPOSED)" → **ACCEPTED (2026-06-10)** 로 정합.
- [ ] "stage 1 진행 중 (T-0326)... stage 2~5 보류" 서술을 실제 완료 상태로 갱신 — stage 2~5 인프라 머지 완료 + 현 **stage 5b ON** (`flags.fineGrainedConcurrency=true` + `maxConcurrentClaims=2`, T-0348 5a → T-0349 → T-0350 5b) 반영. 근거 task/ADR (T-0326/T-0341/T-0348/T-0349/T-0350, ADR-0036 §Decision 8 안전장치 5종) 및 CLAUDE.md §10 / concurrency.md 참조 명시.
- [ ] "토글 OFF 인 동안 driver 동작 불변 (forward-looking spec)" 잔여 서술 정합 — 현재는 토글 ON(stage 5b), §D8 (d) 회로 차단기 강등 시에만 OFF 복귀임을 반영. break-even gate (한 시점 독립 task ≥ 2) 는 2026-06-10 사용자 결정으로 build-through 승인됐고 stage 5b 활성됐음을 반영.
- [ ] append-only 정합 — 인접 bullet 159(PLAN.md 단계별 분리 검토, 미완 유지) 및 절 헤더 line 152~154 무손상. checkbox `[ ]`→`[x]` flip 여부는 executor 판단(rollout 이 stage 5b 로 실효 완료됐으므로 `[x]` 권장하되, staged rollout 추적 항목 성격상 5c/dogfood 잔여가 있으면 근거 절만 정합하고 `[ ]` 유지 가능 — 본문에 그 판단 근거 1줄 명시).
- [ ] 인용하는 모든 task 파일(T-0326/T-0341/T-0348/T-0349/T-0350) 및 concurrency.md 경로가 origin/main 에 실존함을 `git ls-tree`/`grep` 으로 재확인(false-positive 정합 0). 이미 확인됨 — 재검증만.
- [ ] `node -e "JSON.parse(...)"` 는 STATE.json 미변경이므로 불요. PLAN.md 는 마크다운이라 파싱 검증 불요.

분기 없음 — 단일 doc 파일 section 정합. R-112 test 항목은 direct doc-only 라 면제(코드/test 0, R-110 doc-only commit 면제 조항).

## Out of Scope

- ADR-0036 파일 자체 수정 금지 (이미 ACCEPTED — status flip 불요). 본 task 는 PLAN.md 한 bullet 정합만.
- CLAUDE.md §10 / concurrency.md 수정 금지 (이미 stage 5b 반영 완료 — PLAN.md 만 drift).
- STATE.json.flags 변경 금지 (현 stage 5b 상태 유지 — 본 task 는 문서 서술만 정합).
- stage 5c 진입·dogfood 착수·회로 차단기 정책 변경 등 어떤 rollout 진행 action 도 금지 — 순수 서술 drift 교정.
- 인접 bullet 159 (PLAN.md 단계별 분리 검토) 상태 변경 금지 (트리거 미달로 미완 유지).

## Suggested Sub-agents

없음 — direct doc-only tiny task. driver 가 직접 Edit (code/test 0 이라 executor/tester 불요, R-110 doc-only 면제). fineGrainedConcurrency ON 경로에서 select-claim 또는 coarse lock fail-safe(§D8 (a)) 중 driver 판단.

## Follow-ups

(없음 — 생성 시)
