---
id: T-0312
title: ADR-0035 status PROPOSED→ACCEPTED flip + relatedTask/relatedPR backreferences
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-064]
estimatedDiff: 10
estimatedFiles: 1
created: 2026-06-10
plannerNote: P5 ADR-0035 구현 chain(T-0305~T-0311) 전부 머지·CI-green → ADR §Follow-ups 첫 항목 'ACCEPTED flip' 미실행 잔여. doc-only지만 docs/decisions/* 는 check-doc-only-pr.sh allowlist 제외라 pr-mode(T-0303 mirror).
---

# T-0312 — ADR-0035 status PROPOSED→ACCEPTED flip + relatedTask/relatedPR backreferences

## Why

[ADR-0035](../decisions/ADR-0035-aggregate-summary-evaluation.md) 의 dependency-free 구현 chain (T-0305 schema/migration → T-0306 aggregate/시점판정 → T-0307 narrative → T-0309 persist → T-0310 orchestrator → T-0311 doc-sync) 이 전부 머지·reviewer-APPROVE·CI-green 됐으나, ADR-0035 frontmatter 의 `status:` 는 여전히 `PROPOSED` 다. ADR 자신의 §Follow-ups 첫 항목 `[ ] ADR-0035 ACCEPTED flip — reviewer 통과 후 1 줄 status 전환` 이 미실행 잔여 — 이는 ADR-0033 chain 종결 후 T-0303 이 수행한 ACCEPTED flip 과 정확히 동형이다 (PLAN P5 / [ADR-0035 §Follow-ups](../decisions/ADR-0035-aggregate-summary-evaluation.md)). 본 task 가 그 잔여를 닫아 ADR-0035 의 batch/aggregate 평가 + Summary 영속화 설계를 공식 ACCEPTED 로 종결한다.

## Required Reading

- `docs/decisions/ADR-0035-aggregate-summary-evaluation.md` — 본 task 의 유일 편집 대상. frontmatter `status` / `relatedTask` + 본문 status 문장 + §Follow-ups 첫 체크박스.
- `docs/tasks/T-0303-adr-0033-accepted-flip.md` (있으면) 또는 `docs/decisions/ADR-0033-evaluation-result-persistence.md` frontmatter — ACCEPTED flip 의 정확한 형태 precedent (`status: ACCEPTED` + `relatedTask: [...]` + `relatedPR: [...]`).
- `scripts/check-doc-only-pr.sh` — `docs/decisions/` 가 doc-only allowlist 에서 제외(pr-mode)임을 확인 (commitMode 판정 근거).

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0035-aggregate-summary-evaluation.md` frontmatter 의 `status: PROPOSED` → `status: ACCEPTED` 로 1 줄 전환.
- [ ] frontmatter 의 `relatedTask: T-0304` 를 구현 chain 을 포함한 배열로 확장: `relatedTask: [T-0304, T-0305, T-0306, T-0307, T-0309, T-0310, T-0311]` (T-0308 은 ADR-0036 라 제외).
- [ ] frontmatter 에 `relatedPR: [256, 257, 259, 260, 261]` 추가 (T-0311 은 direct 라 PR 없음 — T-0303 이 T-0302 direct 를 relatedPR 에서 제외한 것과 동형).
- [ ] 본문 첫 단락(L13 부근)의 `**status `PROPOSED`** — ACCEPTED flip 은 …` 문장을 ACCEPTED reality 로 1~2 줄 reality-sync (예: "구현 chain (T-0305~T-0311) 전부 머지·CI-green 으로 **status `ACCEPTED`**").
- [ ] §Follow-ups 의 `- [ ] **ADR-0035 ACCEPTED flip** …` 체크박스를 `- [x]` 로 전환하고, 이미 머지된 후속 항목(@@unique slice / aggregate 매핑·시점판정 / write service / orchestrator service 부분 / doc-sync)도 reality 에 맞게 `[x]` 로 갱신 (controller/endpoint 미배선·timezone·scheduler·live-LLM 항목은 `[ ]` 유지 — Q-0030/Q-0026/§5 게이트).
- [ ] 변경이 **ADR-0035 단일 파일에 한정**됨을 확인 (`git diff --name-only` 출력이 그 1 파일뿐).
- [ ] tester 가 `pnpm lint && pnpm build && pnpm test` 실행 결과 확인 (R-110 — pr-mode 코드 변경 0 LOC 이어도 tester 호출 의무). doc-only ADR 편집이라 신규 spec 불요 — 분기 없는 단순 문서 status 전환, 본 task 는 R-112 1~4 항목 및 coverage 항목 적용 외(prod code 0 LOC). 이 면제 사유를 PR 본문에 명시.

## Out of Scope

- ADR-0035 외 어떤 파일도 건드리지 않는다 (STATE/PLAN/journal 은 driver bookkeeping 의 몫 — 본 task 는 ADR 파일만).
- 새 production code / spec / migration / dependency 추가 금지 — 순수 ADR status·backreference·체크박스 doc 갱신.
- Summary controller/endpoint 배선, period→collection bridge, RBAC, timezone(Q-0026), live-LLM 검증은 전부 OUT — Q-0030/Q-0026/§5 게이트 (별도 HITL/ADR 결정 대기).
- ADR-0035 의 Decision/Consequences/Alternatives 본문 재작성 금지 — status 문장 1~2 줄 reality-sync 외 내용 변경 0.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 설계 결정 0, 기존 ADR 의 status reality-sync 만).

## Follow-ups

(없음 — 본 task 머지로 ADR-0035 의 dependency-free §Follow-ups 가 모두 종결. 잔여 P5 항목[controller/endpoint·period→collection bridge = Q-0030 ADR-gate / timezone = Q-0026 / live-LLM = §5 credential / scheduler = P7 새 dep]은 전부 HITL/ADR 게이트라 본 task 머지 후 다음 planner 호출이 escalate.)
