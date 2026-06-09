---
id: T-0303
title: ADR-0033 status PROPOSED→ACCEPTED flip + relatedTask/relatedPR backreferences
phase: P5
status: DONE
commitMode: pr
prNumber: 254
completedAt: 2026-06-09T20:00:00+09:00
result: DONE — PR #254 squash db674d9 머지. reviewer round1 APPROVE(0 finding) + 4-게이트 PASS + CI green(run 27199384570). ADR-0033 status PROPOSED→ACCEPTED + relatedTask[T-0297~T-0302]/relatedPR[250~253] + 본문 status 문장 reality-sync. tasksCompleted 299→300. ADR-0033 평가 영속화 feature 완전 종결. 이후 planner final survey → dependency-free backlog 소진 → Q-0030 escalation.
coversReq: [REQ-029]
estimatedDiff: 8
estimatedFiles: 1
created: 2026-06-09
plannerNote: P5 ADR-0033 chain(T-0298~T-0302) 전부 머지·CI-green → status flip. doc-only지만 docs/decisions/* 는 check-doc-only-pr.sh allowlist 제외라 pr-mode.
---

# T-0303 — ADR-0033 status PROPOSED→ACCEPTED flip

## Why

ADR-0033 (평가 결과 영속화) 의 구현 chain 이 모두 main 에 안착했다 — schema(T-0298) → 매핑 함수(T-0299) → write service(T-0300) → controller persist-return(T-0301) → doc-sync(T-0302, direct e6ce338) 까지 5 slice 가 전부 머지·CI-green. ADR 본문(L12, L149)이 명시한 "PROPOSED → 별도 edit 으로 ACCEPTED 전이" 조건이 충족됐으므로, ADR-0033 의 header `status:` 를 `PROPOSED` → `ACCEPTED` 로 전환하고 구현 chain back-reference 를 박제한다. 이는 T-0296 (ADR-0032 PROPOSED→ACCEPTED flip) 의 precedent 구조를 mirror 한다.

## Required Reading

- `docs/decisions/ADR-0033-evaluation-result-persistence.md` (frontmatter L1–8 의 `status:`·`relatedTask:` + 본문 L12 / L147–157 §Follow-ups)
- `docs/decisions/ADR-0032-p5-evaluation-contract.md` (T-0296 이 flip 한 결과물 — ACCEPTED header + relatedTask/relatedPR back-reference 구조 mirror 대상; frontmatter 와 본문 first-paragraph status 문장만)
- `scripts/check-doc-only-pr.sh` (L27–30 allowlist — docs/decisions/* 가 pr-mode 게이트 대상임을 재확인)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0033-*.md` frontmatter L4 `status: PROPOSED` → `status: ACCEPTED` 로 1 줄 변경.
- [ ] frontmatter 에 구현 chain back-reference 추가 (T-0296 mirror) — 예: `relatedTask: T-0297` 를 구현 slice 들(T-0298~T-0302)을 포함하도록 확장하거나 별도 `relatedTasks:` / `relatedPRs:` 키 추가. T-0296 이 ADR-0032 에 적용한 형식을 그대로 따른다.
- [ ] 본문 L12 의 "**status `PROPOSED`** — 별도 direct one-line edit 으로 ACCEPTED 전이" 문장을 현실 반영하도록 갱신 (예: "**status `ACCEPTED`** — 구현 chain T-0298~T-0302 머지 완료로 전환"). 본문에 "구현 분리"/"deferred" 류 status 문장이 더 있으면 함께 reality-sync.
- [ ] §Follow-ups 의 dependency-free chain 5 slice (schema / 매핑 / write service / persist-return / doc-sync) 가 모두 완료됐음을 본문에서 표시 (체크 또는 "완료(T-NNNN)" 주석). deferred Summary 영속화 slice 는 미완료로 유지.
- [ ] doc-only ADR edit 이므로 R-112 코드 test 요구(happy/error/branch/negative/coverage)는 **적용 대상 없음** — production code·spec 변경 0. PR 본문에 "doc-only ADR status flip — 코드 변경 0, R-112 미적용" 명시.
- [ ] PR 이 CI green (lint/build/test 가 기존 코드 기준 통과, doc 변경이 CI 를 깨지 않음) + reviewer APPROVE (docs/decisions/* 는 check-doc-only-pr.sh allowlist 제외라 reviewer-approval 게이트 발동) 충족.

## Out of Scope

- ADR 본문의 §Decision / §Consequences / §Alternatives 내용 재작성 (status flip + back-reference + status 문장 reality-sync 외 본문 의미 변경 금지).
- 다른 ADR (ADR-0032 등) 의 status 또는 본문 변경.
- 코드·spec·schema·migration 변경 (이 task 는 순수 doc).
- deferred Summary 영속화 slice 착수 (별도 milestone).
- `docs/STATE.json` / journal / counter 변경 (driver 책임).

## Suggested Sub-agents

`implementer → tester` (tester 는 R-110 에 따라 코드 변경 0 이어도 `pnpm lint && pnpm build && pnpm test` 가 doc 변경에 영향받지 않음을 확인).

## Follow-ups

(생성 시 비어있음 — sub-agent 가 관련 작업 발견 시 append)
