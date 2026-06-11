---
id: T-0342
title: ADR-0036 §Decision 8 doc-sync — CLAUDE.md / LOOP.md / concurrency.md 가 stage5 안전장치 5종 + 5a/5b/5c 인지
phase: P5
status: PENDING
commitMode: direct
coversReq: [TBD]
estimatedDiff: 60
estimatedFiles: 3
created: 2026-06-11
independentStream: stage5-default-on-safeguards
dependsOn: [T-0341]
touchesFiles: [CLAUDE.md, docs/LOOP.md, docs/architecture/concurrency.md]
plannerNote: "T-0341(ADR-0036 §Decision 8 박제, 사용자 직접 commit 9fde830) Follow-ups 의 doc-sync slice — 토글 OFF 유지 동작 변화 0, direct(사용자 turn 지시 doc=direct)."
---

# T-0342 — ADR-0036 §Decision 8 doc-sync (CLAUDE.md / LOOP.md / concurrency.md)

## Why

T-0341 (9fde830, 사용자 직접 commit) 이 ADR-0036 에 **§Decision 8 "stage 5 기본-ON 안전장치"** 5종(fail-safe 강등 / 런타임 재검증 / merge 직전 rebase / `concurrencyIncidents` 회로 차단기 / 5a-5b-5c 3단계 이행)과 **§rollout stage 5 세분**을 박제했다. 그러나 그 amend 는 의도적으로 "설계 박제만 — 토글 OFF 유지, 동작 변화 0" 으로 좁혀져 있어, 운영 doc 4종(CLAUDE.md §10 / docs/LOOP.md §1[2]·§4 / docs/architecture/concurrency.md) 어디에도 §Decision 8 의 5종이 인지되어 있지 않다 (grep 0). 그 결과:

- CLAUDE.md §10 의 "토글-gated N-driver 경로" 단락은 §Decision 8 안전장치 5종을 모르고 stage5 진입 조건만 "30일 dogfood" 로 서술한다.
- LOOP.md §1[2] claim-pickup 분기는 토글 ON 시 driver 가 수행할 (a) fail-safe 강등 / (b) 런타임 재검증(`touchesFiles` 교집합 + `dependsOn` 머지) / (d) 회로 차단기 hook 을 인지하지 못한다.
- LOOP.md §4 충돌 경계는 (c) integrator merge 직전 rebase 의무를 cross-ref 하지 않는다.
- docs/architecture/concurrency.md 의 stage blockquote 는 stage 5 가 5a/5b/5c 로 세분된 사실을 모른다.

본 task 는 4 doc 을 inline-amend 만으로 동기해 — 향후 stage5 진입(또는 incident 발생) 시 사람/driver 모두 §Decision 8 안전장치 5종을 doc 안에서 찾을 수 있게 만든다. **여전히 토글 OFF — driver 동작 변화 0**. 사용자 turn 지시(2026-06-11) "문서나 코멘트 변경에 대해서는 PR/리뷰 우회 direct commit merge" 정합으로 commitMode: direct.

## Required Reading

- docs/decisions/ADR-0036-fine-grained-concurrency.md §Decision 8(L98~108) + §rollout stage 5(L118)
- CLAUDE.md §10 "토글-gated N-driver 경로" 단락(L341~342 부근)
- docs/LOOP.md §1 [2] claim-pickup 분기(L47~69) + §4 충돌 경계(L420~)
- docs/architecture/concurrency.md 도입부 + 현 stage blockquote(L1~16)

## Acceptance Criteria

- [ ] CLAUDE.md §10 "토글-gated N-driver 경로" 단락 끝(또는 적절한 위치)에 1~3 줄 인라인 추가: ADR-0036 §Decision 8 amend(2026-06-10, T-0341) — 토글 ON 의 안전장치 5종(fail-safe 강등 / 런타임 재검증 / merge-전 rebase / `concurrencyIncidents` 회로 차단기 / 5a-5b-5c 3단계) cross-ref. 토글 OFF 동안 driver 동작 변화 0 명시 보존.
- [ ] docs/LOOP.md §1 [2] claim-pickup 분기에 1~2 줄 인라인 추가: 토글 ON 시 driver 의 의무 = (b) `touchesFiles` 교집합 + `dependsOn` 머지 재검증, 판정 불확실 시 (a) fail-safe 강등(단일-task fallback), incident 누적 시 (d) lock-하 `flags.fineGrainedConcurrency` 자동 OFF + notifier. ADR-0036 §Decision 8 cross-ref.
- [ ] docs/LOOP.md §4 충돌 경계 (또는 integrator 동작 단락) 에 1줄 추가: 토글 ON 시 integrator 는 squash 전 main rebase + CI 재확인 의무 (§Decision 8 (c)). [.claude/agents/integrator.md] 본 의무 박제는 별도 후속 task(T-0341 Follow-ups 참조).
- [ ] docs/architecture/concurrency.md 도입부 또는 새 § 로 §Decision 8 5종 + 5a/5b/5c 인지 박제. 현 stage blockquote 는 사실 그대로 유지(stage 2 slice 2 = 현 실 상태, stage 3~5 미shipped 표기 보존) — stage 5 가 5a/5b/5c 로 세분된다는 forward-looking 언급만 추가. 결정 본문은 ADR-0036 권위 유지(cross-ref 만).
- [ ] STATE.json `concurrencyIncidents` schema 박제, [.claude/agents/integrator.md] rebase 의무, [scripts/select-claim.sh] 재검증 로직 등 **구현 일체는 본 task Out of Scope** — 본 task 는 인지 박제만. 후속 분해는 본 파일 Follow-ups + T-0341 Follow-ups 흡수.
- [ ] (lint/build) `pnpm lint && pnpm build && pnpm test` green — 순수 doc-only 라 통상 trivially green. tester 호출 의무는 §3.2 R-110 doc-only direct 예외에 해당하므로 driver 가 명령만 확인.
- [ ] 어느 doc 도 `flags.fineGrainedConcurrency` 토글 값을 바꾸지 않는다(여전히 `false`). 어느 doc 도 driver 동작을 바꾸지 않는다(forward-looking spec only).

## Out of Scope

- ADR-0036 §Decision 8 본문 추가 amend — T-0341 이 이미 완결.
- STATE.json schema 의 `concurrencyIncidents: { "double-claim": 0, "merge-conflict-code": 0, "reclaim-misfire": 0, "ci-cost-overrun": 0 }` 자리 박제 — 별도 direct task.
- [.claude/agents/integrator.md] 에 merge-전 rebase 의무 추가 — 별도 direct task.
- [scripts/select-claim.sh] 또는 LOOP claim-pickup 절차의 재검증 로직 구현 — 별도 pr task.
- 5a 진입(=`maxConcurrentClaims` 필드 도입 + 토글 ON 첫 단계) — 별도 direct task, stage5 진입 의사결정 후.
- `flags.fineGrainedConcurrency` 토글 값 변경.

## Suggested Sub-agents

- `implementer` 만 — 4 doc 의 정확한 위치에 inline-amend. 새 코드 0 이라 architect 불요, tester 는 doc-only direct 라 §3.2 R-110 예외(driver 가 lint/build/test 명령만 확인).

## Follow-ups

(생성 시 비움. 구현 sub-agent 가 추가 분해 발견 시 append. 기대 후속: T-0341 Follow-ups 4종 중 (d) `concurrencyIncidents` STATE schema, (c) integrator.md rebase, (b)(a) select-claim 재검증, 5a 진입 — 본 doc-sync 가 그 후속들의 doc anchor 가 된다.)
