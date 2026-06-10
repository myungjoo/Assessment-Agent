---
id: T-0338
title: ADR-0038 chain doc-sync — api.md L102 reevaluate 동기 + ADR-0038 slice 5→4 표기 정정
phase: P5
status: DONE
completedAt: 2026-06-11T02:55:00+09:00
commitMode: direct
coversReq: [REQ-009, REQ-040, REQ-045]
estimatedDiff: 25
estimatedFiles: 2
created: 2026-06-11
plannerNote: "P5 ADR-0038 chain 완결 후 doc-sync — api.md L102(mode→reevaluate) + ADR-0038 L107/L137(slice 5→4). 순수 문서 정정, 운영지시상 direct."
---

# T-0338 — ADR-0038 chain doc-sync (api.md reevaluate 동기 + slice 표기 정정)

## Why

[ADR-0038](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md) overwrite/재평가 impl chain(slice 1 T-0333 → 2a T-0334 → 2b T-0335 → 3 T-0336 → 4 T-0337, 전부 머지·round1 APPROVE·CI green)이 완결되며 두 건의 **사실 불일치 잔존 문서**가 남았다. (1) [api.md](../architecture/api.md) L102 `/api/assessment-evaluation/period` 행은 [T-0334](T-0334-vestigial-mode-removal-adr0038-amend.md) 가 [PeriodBridgeDto](../../src/assessment-evaluation/dto/period-bridge.dto.ts) 에서 **제거한 vestigial `mode?` field 를 여전히 서술**(이제 whitelist+forbidNonWhitelisted 로 정의 외 필드 400 거부)하고, T-0333 이 추가한 `reevaluate?: boolean` opt-in 을 **미기재**한다(T-0334 §Follow-ups reviewer MINOR-1 박제). (2) [ADR-0038](../decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md) L107·L137 이 동시성 수렴 실측 책임 slice 를 "impl slice 5 e2e" 로 표기하나, 실제 e2e 는 **slice 4(T-0337)** 이며 L108 amendment 가 이미 "T-0337 slice 4 실측" 으로 박제했다(T-0337 reviewer MINOR pre-existing finding). 두 정정을 한 task 로 묶어 chain doc-sync 를 닫는다. 순수 문서 정정(동작 변경 0)이며 본 cron 운영 지시에 따라 `commitMode: direct`.

## Required Reading

- `docs/architecture/api.md` — L102(`/api/assessment-evaluation/period` 행)만 수정 대상. 같은 행의 `mode?` 서술 제거 + `reevaluate?: boolean` opt-in 추가. **L101(`/evaluate` 의 `EvaluateActivitiesDto.mode` 는 wired 정상) · L95/L96/L167(별도 `/api/assessments/reeval` batch endpoint) 는 무관 — 무변경.**
- `docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md` — L107(§Decision5 동시 reevaluate 직렬화 bullet) + L137(§부정/trade-off 의 reeval 동시성 수렴 bullet)만 수정 대상. "impl slice 5 e2e" → "impl slice 4 e2e". **L108 amendment(이미 slice 4 박제)는 무변경 — 본 정정의 근거.**
- `docs/tasks/T-0334-vestigial-mode-removal-adr0038-amend.md` — §Follow-ups reviewer MINOR-1(api.md L102 doc-sync flag) — 본 task 의 (1) source.
- `src/assessment-evaluation/dto/period-bridge.dto.ts` — 현 실제 DTO contract(`personId`/`period`/`scope`/`periodStart`/`reevaluate?` 5 키, `mode` 제거됨)를 api.md 서술이 반영하도록 확인용 read.

## Acceptance Criteria

- [ ] `docs/architecture/api.md` L102 의 `/api/assessment-evaluation/period` 행에서 vestigial `mode?` 서술(`mode?`(선택, `@IsIn(["fill","reeval"])` ... 무시)) 제거 → 현 DTO contract(`personId`/`period`/`scope`/`periodStart` 4 좌표 + `reevaluate?: boolean`(선택, default false — Admin 분기에서만 reeval persist mode 발화, User ephemeral 은 N/A))를 반영. "overwrite/재평가는 DEFERRED" 문구는 ADR-0038 chain 완결을 반영해 갱신(더 이상 DEFERRED 아님 — reevaluate opt-in shipped). T-0333~T-0337 박제 cross-ref 추가.
- [ ] `docs/decisions/ADR-0038...md` L107 의 "impl slice 5 e2e 가 실 PostgreSQL 로 실측해 박제한다" → "impl slice 4 e2e ..." 로 정정.
- [ ] `docs/decisions/ADR-0038...md` L137 의 "impl slice 5 e2e 가 실 PostgreSQL 로 실측·박제해야 한다" → "impl slice 4 e2e ..." 로 정정.
- [ ] 수정 후 `grep "slice 5" docs/decisions/ADR-0038-overwrite-reevaluate-persisted-assessment.md` 매칭 0 (L107/L137 외 slice 5 잔존 없음 확인).
- [ ] 수정 후 `grep "mode?" docs/architecture/api.md` 매칭이 `/period` 행(L102)에서 사라짐 — L101 `/evaluate` 행의 wired `mode?` 는 무변경 보존(매칭 잔존 정상).
- [ ] 변경 파일 정확히 2 개(api.md, ADR-0038), src/·test/ 무변경(순수 문서 정정).

## Out of Scope

- `src/`·`test/` 어떤 코드도 변경 금지 — 순수 문서 정정(동작 변경 0). DTO contract 는 이미 T-0334 가 정정 완료, 본 task 는 문서만 동기.
- api.md L101(`/evaluate` 의 `EvaluateActivitiesDto.mode`, wired 정상) · L95/L96/L167(별도 `/api/assessments/reeval` batch) 무변경.
- ADR-0038 L108 amendment(이미 slice 4 박제) 무변경 — 정정의 근거.
- ADR-0038 §Status flip / 다른 §Decision 본문 변경 — 본 task 는 slice 표기 오타 2 곳 + api.md 1 행만.
- 다른 architecture doc(modules.md / data-model.md) 동기 — 본 task 범위 밖(별도 필요 시 follow-up).

## Suggested Sub-agents

`implementer` (단일 doc 정정 — architect 불요, ADR 본문 결정 변경 0 / 오타·동기만. tester 불요 — direct doc-only, 코드 변경 0이라 R-110 면제).

본 task 는 direct doc-only 라 reviewer/tester 플로우 없이 driver 가 직접 정정·commit 한다(운영 지시: 문서·코멘트 변경은 PR/리뷰 없이 direct).

## Follow-ups

- (planner) live-LLM bridge 검증(PLAN P5, 만료 2026-06-30) — 2026-06-25 전 미착수 시 우선순위 격상(backlogNote 트리거 유지). §5 credential 게이트라 사용자 승인 선결.
- (planner) timezone(Q-0026 Asia/Seoul vs UTC) ADR — 사용자 확정 선결, ADR-first.
- (planner) 외부 PR #277(ADR-0036 stage5 안전장치 amend) disposition — 사용자 결정 대기.
