---
id: T-1028
title: daily-step command-args-body-marker 가드 주석의 stale 개명 참조 정정
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-032]
estimatedDiff: 2
estimatedFiles: 1
created: 2026-07-16
dependsOn: []
touchesFiles:
  - test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker.ts
independentStream: realdata-e2e-daily-report-issue-descriptor
plannerNote: "P5 test-hardening — cmdargs-body-marker 가드 주석 29행이 개명 전 stage명(issue-descriptor-consistency) 참조, body-consistency 로 정정. T-1026 Follow-up ②."
---

# T-1028 — daily-step command-args-body-marker 가드 주석의 stale 개명 참조 정정

## Why

T-1026 이 daily-step issue descriptor combined 가드를 body/identity 2-가드로 분리하고 T-1027 이 body 축을 `-body-consistency` 로 개명하면서, full body 재유도를 담당하는 stage 명이 `issue-descriptor-consistency` → `issue-descriptor-body-consistency` 로 바뀌었다. 그런데 sibling 가드인 `realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker.ts` 의 29행 주석은 여전히 개명 전 stage명 `issue-descriptor-consistency` 를 cross-reference 한다. origin/main 확인 결과 이 주석 1건만 stale 이며(다른 `body-focus` 표현은 가드 역할을 서술하는 형용사 용법으로 정상), 실재하는 문서-정합 gap 이다. T-1026 Follow-up ② (cross-axis prose-audit) 를 완결한다.

## Required Reading

- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker.ts` — 29행 stale 참조가 있는 대상 파일 (25~33행 주석 블록 맥락 확인).
- `test/helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-body-consistency.ts` — full body 재유도를 실제 담당하는 현행 body 축 가드 (정정 후 참조 대상의 정확한 명칭 확인).

## Acceptance Criteria

- [ ] `realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker.ts` 29행의 `descriptor 단계(issue-descriptor-consistency)가 이미 cover.` 를 `descriptor 단계(issue-descriptor-body-consistency)가 이미 cover.` 로 정정 (full body 재유도를 담당하는 현행 body 축 가드 명칭으로 일치).
- [ ] 정정 후 `git grep -n "issue-descriptor-consistency" -- 'test/**' | grep -vE "body-|identity-"` 결과가 0건 (다른 stale 잔존 없음 확인).
- [ ] 주석 외 코드/로직/공개 심볼 변경 0 — behavior 변경 없음. 신규 public symbol 없음 → R-112 신규 test 불요 (분기 없음 — 기능/예외/flow/negative test 항목은 본 comment-only fix 에 해당 심볼이 없어 생략).
- [ ] `pnpm lint && pnpm build && pnpm test` green — 기존 가드 spec(daily-step 및 command-args-body-marker) 전부 통과, 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 주석 변경이라 coverage 영향 0, 기존 임계 유지.

## Out of Scope

- 정상 형용사 용법의 `body-focus` / `BodyFocus` 표현 변경 (개명 참조가 아니라 가드 역할 서술 — 손대지 않는다).
- 가드 로직·비교 순서·throw 정책·spec 구조 변경.
- summary 축 helper 파일 감사 (본 task 는 daily-step 축 1건 stale 참조만).
- 새 가드 신설 또는 identity/body 축 구조 변경.

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음)

## Result (DONE 2026-07-16)

PR #922 squash 머지(b29fd5e0). 29행 가드 주석의 개명 전 stage명 참조
(`issue-descriptor-consistency`)를 현행 body 축 명칭(`issue-descriptor-body-consistency`)
으로 정정 — comment-only 1줄(+1/-1), 코드·로직·공개 심볼·behavior 변경 0.
전체 unit 403 suite/10927 test green, 전역 cov line≥80 AND function≥80 무회귀.
reviewer round1 APPROVE(0/0/0) 4-게이트 PASS, 머지-커밋 main CI(29481254744) success.
