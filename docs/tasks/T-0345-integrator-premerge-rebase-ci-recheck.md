---
id: T-0345
title: integrator merge-전 rebase + CI green 재확인 의무 박제 (ADR-0036 §Decision 8 (c))
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-057, REQ-058]
estimatedDiff: 40
estimatedFiles: 1
created: 2026-06-11
independentStream: stage5-default-on-safeguards
dependsOn: []
touchesFiles: [.claude/agents/integrator.md]
plannerNote: "P5 / ADR-0036 §Decision 8 (c) 구현 — integrator squash 직전 rebase+CI 재확인 의무, direct .claude/ 메타 1파일, (a)(b)와 독립"
---

# T-0345 — integrator merge-전 rebase + CI green 재확인 의무 박제 (ADR-0036 §Decision 8 (c))

## Why

ADR-0036 §Decision 8 (c) 는 stage 5 기본-ON 안전장치 5종 중 하나로 "integrator 가 4-게이트(§3.3) 통과 후 squash 직전 PR head 가 최신 main 을 포함하는지 확인하고, 뒤처졌으면 update-branch/rebase 후 CI green 을 재확인한다"를 박제한다. 파일-disjoint 인코딩이 틀렸거나 파일은 disjoint 인데 의미가 충돌(semantic conflict)하는 경우를 main 진입 직전에 CI 로 잡는 마지막 그물이다. 현재 [concurrency.md §7 (c)](../architecture/concurrency.md) 는 "실 구현은 `.claude/agents/integrator.md` 후속 task" 로 유보돼 있고, integrator.md 의 "3. Merge 수행" 절에는 이 rebase 재확인 단계가 아직 없다. 본 task 가 그 절차를 integrator agent 정의에 박제한다. §Decision 8 (a)(b) 와 독립이며 direct(.claude/ 메타 — §3.1 direct 컬럼)라 작고 1 turn 완결이다.

## Required Reading

- `docs/decisions/ADR-0036-fine-grained-concurrency.md` §Decision 8 (c) (L104) + §rollout stage 5 (L118)
- `docs/architecture/concurrency.md` §7 (c) (L158~161)
- `.claude/agents/integrator.md` 의 "Workflow B. After a review" → "3. Merge 수행" 절 (L76~79) + Hard rules (L190~197)
- `docs/LOOP.md` §4 (충돌 흡수 / rebase 경계 — rebase 실패 시 `merge-conflict-code` BLOCKED 흡수 정합 확인용. 해당 섹션만)

## Acceptance Criteria

- [ ] `.claude/agents/integrator.md` 의 "3. Merge 수행" 절에 squash 직전 단계로 다음을 추가: 4-게이트 모두 true 확인 후 squash 호출 **직전**, PR head 가 최신 origin/main 을 포함하는지 확인 (`gh pr view <num> --json mergeStateStatus` / `mcp__github__get_pull_request` 의 mergeable 상태, 또는 head_sha 가 origin/main 을 ancestor 로 포함하는지 비교).
- [ ] 뒤처진(behind) 경우의 액션 박제: `gh pr update-branch <num>` ↔ `mcp__github__update_pull_request_branch` (또는 동등) 로 rebase/update 후, CI 재시작을 기다려 `gh pr checks <num>` ↔ `mcp__github__list_check_runs(ref=새 head_sha)` 의 conclusion == success 를 **재확인**한 뒤에만 squash 진행. 재확인 전 squash 금지.
- [ ] rebase/update 후 CI 가 red 이거나 conflict 로 update 가 실패하면 squash 하지 않고 §4 분기 (CI fail → ANOTHER_ROUND/`ci-repeat-fail`, conflict → `merge-conflict-code` BLOCKED) 로 흡수 — LOOP.md §4 graceful 종료와 정합한다는 한 줄 명시.
- [ ] 본 재확인 단계가 ADR-0036 §Decision 8 (c) 의 구현임을 cross-ref (예: "(ADR-0036 §Decision 8 (c))") 1회 박제.
- [ ] 토글-gated 라는 점 명시: `flags.fineGrainedConcurrency` OFF(현 기본값) 시에도 본 rebase 재확인은 무해(단일-driver 환경에서도 정상 동작 — PR head 가 이미 최신이면 noop)하며, ON 시 semantic-conflict 마지막 그물로 기능한다는 1 줄.
- [ ] Hard rules 의 "Never force-push" (L197) 와 정합: update-branch/rebase 는 GitHub 의 update-branch API 또는 정상 rebase 이고 `git push --force` 가 아님을 본문이 위배하지 않음 (inspect: 새 절에 force-push 지시가 없을 것).
- [ ] commitMode direct (.claude/ 메타 변경) — R-112 test 면제. 변경 검증은 파일 inspection 으로 충분.

## Out of Scope

- §Decision 8 (a)(b) select/pickup 런타임 재검증 (scripts/, pr-mode — 별도 task).
- `concurrencyIncidents` incrementing 로직 (언제 어느 유형 +1 — §Decision 8 (d) 후속).
- 5a 진입 (`maxConcurrentClaims=1` 필드 + 토글 ON — §Decision 8 (a)~(d) 전부 구현 후).
- `flags.fineGrainedConcurrency` 값 변경 (OFF 유지 — driver 동작 변화 0).
- LOOP.md / CLAUDE.md / concurrency.md 본문 변경 (본 task 는 `.claude/agents/integrator.md` 1 파일만; concurrency.md §7 (c) 의 "후속 task" 유보 문구 갱신은 따로 필요 시 별도 doc-sync — 본 task 에서 건드리지 않음).
- 실제 PR 에 대한 rebase 수행 (절차 박제만).

## Suggested Sub-agents

`implementer` (실 구현 코드/test 없음 — `.claude/agents/integrator.md` doc 편집만이라 driver/executor 가 직접 편집 가능. architect 불요 — ADR 결정은 §Decision 8 (c) 에 이미 박제됨).

## Follow-ups

(작성 시점 비어있음)
