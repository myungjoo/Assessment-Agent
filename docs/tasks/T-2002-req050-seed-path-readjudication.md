---
id: T-2002
title: REQ-050 "3 row seed 경로 부재" 자인 정정 — 난이도 슬롯 seed 경로 좌표 재판정 (once-rule 1 회)
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-050]
estimatedDiff: 32
estimatedFiles: 1
created: 2026-09-09
independentStream: req050-seed-path-readjudication
dependsOn: [T-1998, T-1999, T-2000, T-2001]
touchesFiles:
  - docs/requirements.md
plannerNote: "P7 REQ-050 — T-1998~T-2001 seed chain 머지 후 요구표의 \"3 row seed 경로 부재\" 자인을 실 좌표로 1 회 재판정 (doc-only direct)"
---

# T-2002 — REQ-050 "3 row seed 경로 부재" 자인 정정 (난이도 슬롯 seed 경로 좌표 재판정)

## Why

[docs/requirements.md](../requirements.md) `69 행` REQ-050 상태 칸은 지금도 **"Decision §1 · §3 운영 함의가 전제한 3 row seed 경로는 여전히 부재하다 (`prisma/` 는 `migrations/` · `schema.prisma` 뿐이라 seed script 0)"** 라고 단언한다. 그러나 이 자인은 [T-1998](T-1998-difficulty-slot-seed-endpoint.md) 이 `POST /api/llm/difficulty-mappings/seed` 를 박제한 시점(main `c8c7c5cc`)에 **거짓이 됐고**, 이어 [T-1999](T-1999-adminview-difficulty-slot-seed-wiring.md)(web 소비처) · [T-2000](T-2000-difficulty-unassigned-slot-notice.md)(미지정 슬롯 안내) · [T-2001](T-2001-difficulty-slot-seed-contract-guard.md)(계약 drift guard) 로 chain 이 마감됐는데도 요구표는 그 전 상태에 멈춰 있다. 요구표는 REQ 충족 판정의 정본이므로 거짓 자인은 이후 planner 의 issue-still-relevant 판단을 오염시킨다.

**issue-still-relevant pre-check (origin/main `8549c79f` 기준, 2026-09-09 실측)** — (1) `git log origin/main -8 -- docs/requirements.md` 의 REQ-050 최신 touch 는 `ce6ab9d3`([T-1962](T-1962-req050-e2e-readjudication-doc-sync.md), e2e 좌표 축)이고 이는 T-1998 머지 commit `c8c7c5cc` **이전**이다. (2) `grep -c "T-1998\|T-1999\|T-2000\|T-2001" docs/requirements.md` = **0** — seed chain 4 slice 중 어느 것도 요구표에 반영되지 않았다. (3) `awk 'NR==69' docs/requirements.md | grep "3 row seed 경로는 여전히 부재하다"` 가 여전히 매치한다. 즉 본 task 의 의도는 main 에 **미박제** 이며 중복 task 가 아니다.

본 task 는 CLAUDE.md §3.1 의 **"REQ status 재판정 task 는 그 REQ 를 구현하는 slice 가 머지된 뒤 REQ 당 1 회만"** 규칙과 오너 지시 [docs/PLAN.md](../PLAN.md) `183 행`(구현 전 재판정 금지 · 구현 후 1 회) 에 정확히 부합한다 — seed 구현 arc 는 이미 전량 머지됐고, 이 arc 에 대한 재판정은 아직 0 회다.

## Required Reading

- [docs/requirements.md](../requirements.md) `69 행` — REQ-050 행. 정정 대상은 상태 칸 안의 **"또한 Decision §1 · §3 운영 함의가 전제한 3 row seed 경로는 여전히 부재하다 …"** 문장 1 개.
- [src/llm/difficulty-mapping.controller.ts](../../src/llm/difficulty-mapping.controller.ts) `111~122 행` — `@Post("seed")` · `@HttpCode(200)` · `@UseGuards(JwtAuthGuard, RolesGuard)` · `@Roles("Admin")` · `async seed()`.
- [src/llm/difficulty-mapping.service.ts](../../src/llm/difficulty-mapping.service.ts) `67~72 행`(`SeededDifficultySlots` payload) · `195~234 행`(`seedDifficultySlots` — 생성 슬롯 `llmProviderConfigId: null` 고정 + P2002 멱등 흡수 분기).
- [web/src/views/adminLlmProviderMutationRunners.ts](../../web/src/views/adminLlmProviderMutationRunners.ts) `437 행`(`SeedSlotsDeps`) · `463 행`(`runSeedSlots`).
- [web/src/views/useAdminLlmProviders.ts](../../web/src/views/useAdminLlmProviders.ts) `377~390 행` — `runSeedSlots` 조립처(재조회 nonce 캡슐화 지점).
- [web/src/components/DifficultyModelSelector.tsx](../../web/src/components/DifficultyModelSelector.tsx) `38 행`(`UNASSIGNED_NOTICE_TEXT`) · `128 행`(`<div role="note">`).
- [web/src/views/AdminView.difficulty-mapping-seed-contract.test.ts](../../web/src/views/AdminView.difficulty-mapping-seed-contract.test.ts) — web↔backend 계약 drift guard (T-2001).
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) `60~64 행` — §3 fail-fast 및 `64 행` 의 3 row seed 운영 전제.
- [CLAUDE.md](../../CLAUDE.md) §3.1 — REQ 재판정 once-rule / direct 판정 근거.
- [docs/PLAN.md](../PLAN.md) `183 행` — 오너 지시(구현 후 1 회 재판정).

## Acceptance Criteria

- [ ] `docs/requirements.md` `69 행` 에서 seed 경로 **부재** 자인이 사라진다 — `grep -c "3 row seed 경로는 여전히 부재" docs/requirements.md` 가 `0` 을 출력한다.
- [ ] 같은 행에 seed 경로 **4 축 좌표** 를 박제한다. 각 좌표는 파일을 직접 열어 실측한 값이어야 한다(추정 금지): ① route 축 `src/llm/difficulty-mapping.controller.ts` `116~122 행` `@Post("seed")` + `@HttpCode(200)` + `@Roles("Admin")` ② service 축 `src/llm/difficulty-mapping.service.ts` `203~234 행` `seedDifficultySlots` (생성 슬롯 FK `null` 고정 → §3 fail-fast 계약 유지 · P2002 멱등 흡수) ③ web 소비처 축 `web/src/views/adminLlmProviderMutationRunners.ts` `463 행` `runSeedSlots` + `web/src/views/useAdminLlmProviders.ts` `382 행` 조립 ④ 계약 guard 축 `web/src/views/AdminView.difficulty-mapping-seed-contract.test.ts`.
- [ ] 근거 task ID 4 개(T-1998 · T-1999 · T-2000 · T-2001)와 머지 commit `c8c7c5cc`(T-1998)를 상태 칸에 명시한다 — `grep -c "T-1998" docs/requirements.md` 가 `1` 이상.
- [ ] REQ-050 의 status 값은 **`IN_PROGRESS` 유지**. seed 축 충족이 REQ 전체 충족을 뜻하지 않는다 — 잔여 미충족 축 2 개(**항목→난이도 결정 규칙 축 부재**: `src/assessment-evaluation/domain/evaluation-prompt.ts` `155 행` `classifyNarrative` 가 규칙이 아니라 LLM marker 파싱 / **`options.difficulty` 미주입 한계**: `src/assessment-evaluation/evaluation-scoring.service.ts` `99~101 행`) 서술은 **삭제·완화 없이 그대로 보존** 한다.
- [ ] seed route 의 **e2e 부재는 사실대로 자인** 한다 — `grep -c "difficulty-mappings/seed" test/e2e/difficulty-mappings.e2e-spec.ts` 로 `0` 을 확인한 뒤 "POST /seed 는 e2e describe 0" 취지를 상태 칸에 남긴다(없는 근거를 만들지 않는다).
- [ ] 표 구조 무변경 — `grep -cE "^\| REQ-" docs/requirements.md` 가 `84` 를 유지하고, REQ-050 행의 파이프(`|`) 개수가 편집 전과 같다.
- [ ] `git status --short` 가 `docs/requirements.md` · `docs/tasks/T-2002-*.md` · `docs/STATE.json` · `docs/progress/journal-2026-09-09.md` 외 파일을 보이지 않는다(임시 파일 0).
- [ ] **R-112 4 종 판정** — 본 task 는 `commitMode: direct` doc-only 이며 production symbol 변경 **0 LOC** 이라 (1) happy-path unit test (2) error path test (3) 분기별 test (4) negative case test **4 항목 모두 해당 없음**(추가/수정되는 public symbol 0 · 분기 0). CLAUDE.md §3.2 R-110 의 "direct doc-only commit 만 면제" 조항을 근거로 tester 를 호출하지 않는다. 대신 위 grep 항목들이 기계 검증을 대신한다.
- [ ] `docs/requirements.md` 이외의 파일에 REQ-050 관련 서술을 **추가하지 않는다**(정본 1 곳 유지).

## Out of Scope

- `src/` · `web/` · `test/` 코드 변경 일체 — 본 task 는 doc-only 다. 코드가 필요해지면 즉시 중단하고 `Follow-ups` 에 적는다.
- 잔여 미충족 축(항목→난이도 결정 규칙 · `options.difficulty` 주입)의 **구현**. 이는 ADR 급 결정(난이도 사전 판정 vs 사후 분류 순서)이 필요하므로 본 task 에서 착수 금지.
- `POST /api/llm/difficulty-mappings/seed` 의 e2e spec 신설 — 별도 `pr` task 로 분리(아래 Follow-ups).
- REQ-050 외 다른 REQ 행의 재판정 · 좌표 갱신(오너 [PLAN.md](../PLAN.md) `183 행` 의 왕복 억제 취지).
- `docs/architecture/*` · ADR-0011 본문 갱신.
- REQ-050 status 를 `DONE` 으로 승격하는 판단.

## Suggested Sub-agents

`implementer` (doc-only 단일 행 편집 — architect · tester 미호출)

## Follow-ups

(생성 시 비어 있음)
