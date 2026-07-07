---
id: T-0812
title: PLAN.md P5 단위 commit/document 평가 bullet(96) implemented-on-main checkbox 정합
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-032]
estimatedDiff: 4
estimatedFiles: 1
created: 2026-07-08
independentStream: plan-drift-reconciliation
dependsOn: []
touchesFiles: [docs/PLAN.md]
plannerNote: P5 bullet96(단위 난이도·기여도·양 평가)이 shipped(evaluation-scoring.service+volume+ADR-0032)인데 `[ ]` stale drift — T-0809 패턴 mirror, direct doc-only.
---

# T-0812 — PLAN.md P5 단위 commit/document 평가 bullet(96) implemented-on-main checkbox 정합

## Why

PLAN.md P5 phase 의 bullet 96 "단위 commit/document 평가 (난이도·기여도·양)" 는 checkbox 가 `[ ]` (미완료) 로 남아 있으나, 실제로는 `evaluation-scoring.service.ts` 가 LLM narrative → difficulty/contribution 분류(`classifyNarrative`, ADR-0032 §2) + metadata 기반 결정적 volume 산출(`calculateEvaluationVolume`, ADR-0032 §3) 로 `EvaluationResult`(unitId/narrative/difficulty/contribution/volume 5 필드) 를 조립·반환하는 경로가 origin/main 에 전량 shipped 다(REQ-032). 이는 T-0809(P5 detection/adjustment bullet 6종)·T-0811(P7 scheduling bullet 4종) 이 교정한 **PLAN↔shipped-code checkbox drift** 와 동형이다. bullet 96 만 남은 stale `[ ]` 를 `[x]` + implemented-on-main 절로 정합해, 미래 planner 가 done-work 를 다시 큐잉하는 make-work risk 를 차단한다.

## Required Reading

- `docs/PLAN.md` (line 96 — 교정 대상 bullet; line 99~105 = T-0809 이 남긴 implemented-on-main 절 형식 precedent; line 102 = 링크+symbol+ADR 참조 style mirror 대상)
- `src/assessment-evaluation/evaluation-scoring.service.ts` (difficulty/contribution/volume 5필드 조립 경로 실존 확인 — 링크 대상)
- `src/assessment-evaluation/domain/evaluation-volume.ts` (`calculateEvaluationVolume` — metadata 기반 결정적 volume, 링크 대상)
- `src/assessment-evaluation/domain/evaluation-prompt.ts` (`classifyNarrative` — narrative→difficulty/contribution 분류, line 155)
- `src/assessment-evaluation/domain/evaluation-result.ts` (`EvaluationResult` 5필드 계약, REQ-032)
- `docs/decisions/ADR-0032-p5-evaluation-contract.md` (§2 LLM scoring 입력 shape + §3 난이도·기여도·양 output 산출 — 링크 대상 ADR)

## Acceptance Criteria

- [ ] `docs/PLAN.md` line 96 의 `- [ ] 단위 commit/document 평가 (난이도·기여도·양)` 를 `- [x]` 로 flip.
- [ ] 같은 bullet 에 **implemented-on-main** 절을 append (line 99~105 형식 mirror): `evaluation-scoring.service.ts` 가 LLM narrative → `classifyNarrative`(difficulty/contribution 분류) + `calculateEvaluationVolume`(metadata 기반 결정적 volume) → `EvaluationResult` 5필드 조립 경로를 shipped 로 명시. 각 참조 파일 링크는 `../src/assessment-evaluation/...` 상대경로로, ADR 은 `decisions/ADR-0032-p5-evaluation-contract.md` 링크로 박제.
- [ ] append 하는 각 링크 경로/symbol(`evaluation-scoring.service.ts`·`evaluation-volume.ts` `calculateEvaluationVolume`·`evaluation-prompt.ts` `classifyNarrative`·`evaluation-result.ts` `EvaluationResult`·ADR-0032)이 origin/main 에 실존함을 `git grep`/`git ls-tree` 로 재확인한 뒤 박제(존재하지 않는 경로 링크 금지 — 위 Required Reading 의 실측 결과 재사용).
- [ ] 변경은 append-only + checkbox 1자 flip 성격 — bullet 97~110(요약 평가·R-9·재실행·overwrite·live-LLM·실 e2e·timezone)은 **무손상 보존**(본 task 범위 밖).
- [ ] `docs/PLAN.md` 가 markdown 으로 정상 렌더(bullet 구조·링크 문법 깨짐 없음) — 육안 확인.
- [ ] 분기 없음 — 이 항목(flow/branch coverage) 생략(doc-only, 코드 변경 0).

## Out of Scope

- bullet 97(일/주/월 요약 평가, R-61 자정 룰)·98(사용자 지정 기간 R-9) checkbox 판정 — timezone(bullet 110, out-of-scope)·R-61 자정 경계와 얽혀 별도 실측 필요. 본 task 는 bullet 96 단독.
- bullet 106(재실행·부분 reset)·107(overwrite DEFERRED)·108(live-LLM)·109(실 github e2e)·110(timezone) — 각각 credential/ops/DEFERRED 게이트라 본 task 무관.
- `src/`·`test/` 코드 변경(이미 shipped — doc 정합만).
- api.md / requirements.md 등 다른 문서 동기 — 본 task 는 PLAN.md 단일 파일. 필요 시 Follow-up.
- ADR-0032 본문 수정.

## Suggested Sub-agents

없음 — direct doc-only single-file edit 이라 driver 가 executor 없이 직접 처리하거나, executor 단독(implementer/tester 불요, 코드·test 변경 0).

## Follow-ups

(생성 시 비어 있음)
