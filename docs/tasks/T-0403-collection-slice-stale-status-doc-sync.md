---
id: T-0403
title: ADR-0029 collection slice 5건(T-0253~T-0257) frontmatter 중복 stale status 정합 doc-sync
phase: P4
status: DONE
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 15
estimatedFiles: 5
created: 2026-06-14
plannerNote: T-0402 follow-up — 머지된 collection slice 5건 frontmatter line 5 stale PENDING 중복 키 제거(line 11 DONE 정규화)
independentStream: doc-sync-stale-status
dependsOn: []
touchesFiles: [docs/tasks/T-0253-collection-orchestrator-aggregate.md, docs/tasks/T-0254-collection-contribution-persistence.md, docs/tasks/T-0255-modules-md-collection-module-reconcile-doc-sync.md, docs/tasks/T-0256-assessment-collection-enumerate-adr.md, docs/tasks/T-0257-github-instance-repos-env-parser.md]
---

# T-0403 — ADR-0029 collection slice 5건 frontmatter 중복 stale status 정합

## Why

T-0402 fire 가 머지된 P6 presentational task 5건의 stale frontmatter 를 doc-sync 하면서 추가 후보를 Follow-up 으로 남겼다. 그중 ADR-0029 collection slice 5건(T-0253/T-0254/T-0255/T-0256/T-0257)은 **frontmatter 에 `status:` 키가 두 번** 나온다 — 큐잉 시점 `status: PENDING`(line 5)이 남은 채, 완료 박제 시 `status: DONE`(line 11)이 별도로 append 됐다. 5건 모두 main 에 머지 완료(PR-217/218/219/220 + direct f766837)됐으므로 line 5 의 stale 중복 키를 제거해 단일 `status: DONE` 으로 정규화한다. 이는 CLAUDE.md §3.1 direct 컬럼(task status 업데이트) doc-only 정합으로, grep 기반 도구가 task 를 PENDING 으로 오인하는 것을 막는다.

## Required Reading

- `docs/tasks/T-0253-collection-orchestrator-aggregate.md` (line 5 PENDING + line 11 DONE 중복 확인)
- `docs/tasks/T-0254-collection-contribution-persistence.md`
- `docs/tasks/T-0255-modules-md-collection-module-reconcile-doc-sync.md`
- `docs/tasks/T-0256-assessment-collection-enumerate-adr.md`
- `docs/tasks/T-0257-github-instance-repos-env-parser.md`
- 판정 근거 명령: `git log --oneline --all | grep -iE "\bT-025[3-7]\b"` — 각 slice 의 머지 commit(PR-217 0e72bb6 / PR-218 259bdd5 / direct f766837 / PR-219 9907ac8 / PR-220 d445db5) 확인

## Acceptance Criteria

각 파일의 frontmatter 에서 **중복된 `status:` 키 하나만 남긴다**. 구체적으로: line 5 의 stale `status: PENDING` 라인을 **삭제**하고, 완료 메타(`completedAt`, `prNumber` 등)와 함께 있는 `status: DONE` 을 유일한 status 로 둔다. 결과적으로 각 파일 frontmatter 에 `status:` 키가 정확히 1개(`DONE`)만 존재해야 한다.

- [ ] `T-0253` frontmatter: 중복 `status: PENDING`(line 5) 제거 → `status: DONE` 단일.
- [ ] `T-0254` frontmatter: 중복 `status: PENDING` 제거 → `status: DONE` 단일.
- [ ] `T-0255` frontmatter: 중복 `status: PENDING` 제거 → `status: DONE` 단일.
- [ ] `T-0256` frontmatter: 중복 `status: PENDING` 제거 → `status: DONE` 단일.
- [ ] `T-0257` frontmatter: 중복 `status: PENDING` 제거 → `status: DONE` 단일.
- [ ] 검증: `grep -cE "^status:" docs/tasks/T-025[3-7]-*.md` 가 각 파일당 1 을 반환(중복 0).
- [ ] 5개 파일 외 변경 없음(본문·다른 frontmatter 키 불변, 머지 메타 보존).

## Out of Scope

- **코드/spec 변경 금지** — 순수 frontmatter doc-only 정합. commitMode: direct.
- T-0253~T-0257 의 본문(Why/Acceptance/Follow-ups) 수정 금지 — frontmatter status 중복만 정리.
- **T-0355 는 손대지 않는다** — `onHold: credential-workflow-scope` 는 의도적 보류(b89e1a1)이며 stale 아님. WIND-DOWN 게이트 항목으로 유지.
- 아래 Follow-ups 의 단일-status stale 3건(T-0037/T-0244/T-0284)은 본 task 범위 밖(cap ≤ 5 파일 — 본 task 가 이미 5파일).

## Follow-ups

- **T-0037** (`status: PENDING`): PR-36(f63f94e) 머지 + driver DONE(87c1bd6) 박제됨. frontmatter 단일 `status:` 라인을 `PENDING` → `DONE` 으로 교체하는 별도 direct doc-only task 필요. 본문에 DONE 박제 없으므로 `completedAt` 보강 고려.
- **T-0244** (`status: PENDING`): 작업 산출물(T-0154 SUPERSEDED bookkeeping)이 main 에 안착(3be8260, T-0154 frontmatter = SUPERSEDED 확인됨). 자기 frontmatter status 만 누락 → `PENDING` → `DONE` 교체 필요.
- **T-0284** (`status: IN_PROGRESS`): PR-237(0d44570 Merge) 머지됨. `IN_PROGRESS` → `DONE` 교체 필요.
- 위 3건은 T-0403 머지 후 다음 planner fire 가 direct doc-only task 1개(3파일 ≤ cap)로 묶어 처리 가능.

## Suggested Sub-agents

`implementer`(doc-only frontmatter edit) — direct commit 이라 tester 불요(코드 0, R-110 doc-only 면제).
