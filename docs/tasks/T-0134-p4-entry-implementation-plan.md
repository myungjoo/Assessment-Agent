---
id: T-0134
title: P4-Entry — docs/architecture/p4-implementation-plan.md 신설 (P4 PLAN bullet ↔ task 시퀀스 매핑)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-030, REQ-033, REQ-034, REQ-096, REQ-097, REQ-099, REQ-100, REQ-101, REQ-102, REQ-103, REQ-020]
estimatedDiff: 230
estimatedFiles: 1
created: 2026-06-01T17:20:00+09:00
dependsOn: [T-0133]
hqOrigin: null
plannerNote: "P4 첫 task — External integrations 의 7 PLAN bullet(L81-88) 을 T-NNNN task 시퀀스로 매핑 + ADR 후보(GitHub/Confluence/LLM) + 의존성 + 인간 승인 게이트(외부 dep BLOCKED) 박제. 신규 docs/architecture/* 파일 → §3.1 컬럼 + T-0032 precedent 로 pr-mode."
---

# T-0134 — P4-Entry: docs/architecture/p4-implementation-plan.md 신설

## Why

[docs/PLAN.md](../PLAN.md) Phase P4 (External integrations, L79–88) 진입이 T-0133 머지로 binding 박제됐다 (option (c) hybrid-parallel, STATE.phase P4-in-progress). P2 → P3 전이 시 [p3-implementation-plan.md](../architecture/p3-implementation-plan.md) ([T-0032](T-0032-p3-entry-implementation-plan.md)) 가 P3 의 PLAN bullet 을 T-NNNN task 시퀀스로 사전 매핑해 후속 task 들의 의존성 / ADR 신설 시점 / 인간 승인 게이트를 self-contained 하게 만든 것처럼, **P4 도 동일한 entry artifact 가 필요**하다.

본 task 는 그 패턴을 reuse 해 P4 의 7 bullet (GitHub 3-instance 통합 + GitHub Issue 평가 R-30 + Confluence 통합 + Confluence SPACE 탐색 정책 R-34 + LLM provider 추상화 R-99~103 + 3 난이도 모델 할당 R-97 + Admin LLM 지정 UI R-96 + 자격증명 관리·권한 부족 감지 R-20/R-33) 를 task 시퀀스로 매핑한다. P4 는 **새 외부 dependency 추가 (`@octokit/rest` 등) 의 HITL BLOCKED 게이트 ([CLAUDE.md §5](../../CLAUDE.md))** 가 빈발하는 phase 이므로, 그 게이트 발화 시점을 사전에 박제해 두는 것이 de-risk 의 핵심이다. 본 doc 는 large pr-mode 코드 task (LlmModule scaffold / GithubModule 등) 진입 **전에** 시퀀스를 고정하는 low-risk opener 다.

## Required Reading

- `docs/PLAN.md` Phase P4 단락 (L79–88) — **1차 source**. 7 bullet 의 매핑 대상.
- `docs/architecture/p3-implementation-plan.md` (특히 헤더 + §1 개요 + §2 task 시퀀스 표 + §7 Out of scope + References) — **본 task 가 mirror 할 구조 템플릿**. 8 컬럼 표 (task ID / 책임 / 대응 PLAN bullet / dependsOn / ADR 필요 / 인간 승인 게이트 / est LOC / 책임 module) + 의존성 graph + ADR 후보 list + Out of scope 형식.
- `docs/architecture/p3-to-p4-transition.md` §7 (binding decision option (c) hybrid-parallel) + §7.2 (P4 와 병행 deferred 항목 — LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord / ADR-0005 / ADR-0007 / AssessmentModule 추출) — P4 시퀀스에 흡수해야 할 P3-deferred carryover 목록의 source.
- `docs/architecture/modules.md` — GithubModule / ConfluenceModule / LlmModule (P4 책임 module) 의 이름 / 책임 / 의존성. 표의 "책임 module" 컬럼 값 source.
- `docs/architecture/api.md` (§2 Auth credential 행 + LLM / 외부 통합 관련 endpoint prefix 가 있다면 해당 부분만) — 외부 통합 endpoint contract source.
- `docs/architecture/data-model.md` (LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord entity 정의 부분) — P4 entity scope source.
- `docs/architecture/INDEX.md` — MVA (Minimum Viable Architecture) 원칙 — 본 doc 가 "task 시퀀스 매핑만, 구체 코드 / `pnpm add` 실행 제외" scope 를 따르는 근거.
- `CLAUDE.md` §3.1 (commitMode) / §3.2 (Test·CI R-110~R-114) / §5 (HITL — 새 외부 dependency 추가는 BLOCKED) — "인간 승인 게이트" 컬럼 source.
- `README.md` 의 GitHub 3-instance / Confluence / LLM 5-provider / 난이도 모델 관련 요구 (R-30/R-33/R-34/R-96/R-97/R-99~103/R-20) 해당 행만 — bullet ↔ REQ 매핑 검증.

## Acceptance Criteria

- [ ] `docs/architecture/p4-implementation-plan.md` 신규 파일 1개 생성. 헤더 단락에 "Phase P4 entry artifact (T-0134)" + "본 문서는 doc-only planning artifact — 실제 코드 / `pnpm add` / 외부 client 구현은 본 task 에서 하지 않으며 후속 코드 task 의 책임" 명시 (p3-implementation-plan.md 헤더 패턴 mirror).
- [ ] **§1 개요** — MVA 원칙에 따라 task 시퀀스 매핑만 박제함을 명시 + 본 문서의 기반 (PLAN.md L79–88 / modules.md / data-model.md / api.md / p3-to-p4-transition.md §7 / CLAUDE.md §3.1/§3.2/§5) bullet list.
- [ ] **§2 P4 task 시퀀스 표** — PLAN.md P4 7 bullet 을 후속 T-NNNN task 후보 (ID 는 `T-0135+` 형태의 잠정 placeholder 로 표기, 실 할당은 각 planner dispatch 책임) 로 매핑하는 8 컬럼 표: `task ID(잠정) | 책임 | 대응 PLAN bullet | dependsOn | ADR 필요 여부 | 인간 승인 게이트 | est LOC | 책임 module`. 최소 7 bullet 전부 1+ row cover.
- [ ] §2 표에 **P3-deferred carryover 흡수** — p3-to-p4-transition.md §7.2 의 6 항목 (LlmProviderConfig entity / DifficultyMapping entity / PermissionDeniedRecord entity / ADR-0005 cross-cutting / ADR-0007 audit log / AssessmentModule 추출) 을 P4 시퀀스 표 또는 별도 subsection 으로 박제 (option (c) hybrid-parallel 의 P4 병행 진행 정의 반영).
- [ ] **§3 ADR 신설 후보 list** — P4 진행 중 신설 예상 ADR 박제: 최소 (a) Confluence SPACE 탐색 정책 (R-34 — crawling vs page List/Hierarchy 택일, PLAN.md L84 가 "ADR 로 결정" 명시), (b) LLM provider 추상화 / 3 난이도 모델 할당 (R-97 — PLAN.md L86 "ADR 로 박제" 명시), (c) ADR-0006 LLM key encryption-at-rest (P3-deferred), (d) ADR-0007 audit log schema (P3-deferred). 각 ADR 의 트리거 task 시점 한 줄.
- [ ] **§4 인간 승인 게이트 (HITL BLOCKED) 박제** — P4 의 새 외부 dependency 추가 시점을 사전 박제: GitHub adapter (`@octokit/rest` 또는 유사) / Confluence client / 각 LLM provider SDK (OpenAI / Azure / Anthropic / Gemini) / 외부 자격증명 (GitHub token / Confluence token / LLM API key) 처리 — 각 항목이 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트 (notifier → humanQuestion → 사용자 결정) 를 의도적으로 발화하는 시점임을 명시. **본 task 자체는 `pnpm add` 를 실행하지 않는다** (게이트 박제만).
- [ ] **§5 Out of scope** — 구체 외부 client 코드 / `pnpm add` 실행 / API contract 상세 / migration SQL 은 후속 코드 task 책임임을 명시 (p3-implementation-plan.md §7 패턴 mirror).
- [ ] **§6 References** — PLAN.md / modules.md / data-model.md / api.md / p3-to-p4-transition.md §7 / 관련 ADR + 본 doc 머지 SHA placeholder 줄 (T-0134 머지 후 driver bookkeeping 갱신).
- [ ] 각 §2 표 row 의 est LOC ≤ 300 / 변경 파일 ≤ 5 ([CLAUDE.md §3](../../CLAUDE.md) cap discipline) 검산 — 초과 예상 row 는 "split 필요" marker.
- [ ] 신규 파일 1개 (`docs/architecture/p4-implementation-plan.md`) 만 생성. src/ 변경 0, schema 변경 0, ADR 신설 0, PLAN.md 변경 0, package.json 변경 0, `pnpm add` 실행 0.
- [ ] 추가된 diff ≤ 300 LOC (cap 안전 — 신규 doc 1 파일).
- [ ] 본 task 는 `commitMode: pr` — feature branch (`claude/T-0134-<slug>`) → PR open → reviewer dispatch → 4-게이트 → integrator merge ([CLAUDE.md §3.1](../../CLAUDE.md) 신규 `docs/architecture/*` 는 pr 컬럼, T-0032 precedent).
- [ ] **R-110 (pr-mode tester 의무)** — production code 0 LOC 이어도 tester 가 `pnpm lint && pnpm build && pnpm test` 실행 결과를 확인 (doc-only PR 이지만 pr-mode 이므로 면제 안 됨). R-112 4-item test 요구는 **production code 변경 0 이라 미적용** — 본 task 는 doc 신설만이므로 새 public symbol 0, 분기 0. PR 본문에 "doc-only artifact — 새 코드 symbol 0, R-112 unit/error/branch/negative test 미적용, lint/build/test green 으로 회귀 0 검증" 명시.

## Out of Scope

- **외부 client 코드 / `pnpm add` 실행** — GitHub / Confluence / LLM SDK 추가는 각각 별도 HITL BLOCKED 게이트 후 후속 코드 task 책임. 본 task 는 게이트 시점 박제만.
- **실 ADR 작성** — §3 은 ADR 후보 list 박제만. ADR-0006 / ADR-0007 / Confluence 탐색 / LLM 난이도 ADR 의 실제 작성은 각 후속 pr-mode task.
- **AssessmentModule 추출 refactor** — p3-to-p4-transition.md §7.2 deferred 항목. 본 doc §2 표에 task row 로 박제만, 실 refactor 는 별도 pr-mode task.
- **PLAN.md P4 bullet status 표기 갱신** — 별도 follow-up direct task. 본 task 는 신규 doc 1 파일만.
- **modules.md / api.md / data-model.md 의 P4 entity·module 상세 갱신** — 다른 task. 본 doc 는 기존 architecture doc 을 reference 만.
- **STATE.phase 변경 / counters 갱신** — driver single-writer 책임. 본 task 는 doc 신설만.
- **LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord entity 의 실 Prisma schema 작성** — 후속 코드 task. 본 doc §2 표에 task row 로만 박제.

## Suggested Sub-agents

`architect → tester`. architect 가 PLAN.md P4 bullet ↔ task 시퀀스 매핑 + ADR 후보 + 인간 승인 게이트 박제 (modules.md / data-model.md / p3-to-p4-transition.md §7 reference). implementer 는 코드 변경 0 이라 미호출 — architect 가 doc 작성 담당. tester 는 R-110 충족 위해 `pnpm lint && pnpm build && pnpm test` green 확인 (doc-only 이므로 새 spec 추가 없음, 회귀 0 검증만).

## Follow-ups

- (Planner 예약 후보) PLAN.md P4 bullet 에 task 시퀀스 reference 줄 추가 동기 (direct, ~20 LOC).
- (Planner 예약 후보) §2 표의 첫 P4 코드 task — LlmModule scaffold 또는 GithubModule 진입 (pr-mode, 새 외부 dependency HITL BLOCKED 게이트 동반).
