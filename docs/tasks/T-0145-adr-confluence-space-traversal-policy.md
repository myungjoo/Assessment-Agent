---
id: T-0145
title: ADR-0013 신설 — Confluence SPACE 탐색 정책 (crawling vs page List / Hierarchy)
phase: P4
status: DONE
completedAt: 2026-06-01T23:39:38+09:00
prNumber: 139
mergedAs: 5222925
reviewRounds: 1
commitMode: pr
coversReq: [REQ-015, REQ-017]
estimatedDiff: 140
estimatedFiles: 2
created: 2026-06-01
plannerNote: P4 L84 "ADR로 결정"(R-34/REQ-017) 의무 박제 — Confluence SPACE crawling vs page List/Hierarchy 택일. dependency-free 결정 doc, ConfluenceAdapter(HITL) 선행 ADR. 외부 dep/credential/migration/auth 0.
---

# T-0145 — ADR-0013 신설: Confluence SPACE 탐색 정책

## Why

[docs/PLAN.md L84](../PLAN.md) Phase P4 bullet — **"Confluence SPACE 탐색 정책 (R-34) — Crawling 또는 page List/Hierarchy 기반 탐색 중 택. ADR 로 결정."** 이 본 task 의 single source of truth 트리거다. [docs/requirements.md](../requirements.md) 의 **REQ-017** (Confluence SPACE crawling vs hierarchy 탐색 정책, kind = Constraint, phase = "P4 (ADR 필수)", status = PLANNED) 도 동일 결정을 명시 요구한다. [README.md L34](../../README.md) 가 결정 대상을 verbatim 박제한다: *"지정된 SPACE 내 Crawling을 해야 할 수 있다. 단, 지정된 SPACE 내 페이지 List나 Hierarchy (directory) 구조를 기반으로 탐색하여도 된다."*

[docs/architecture/modules.md](../architecture/modules.md) 의 ConfluenceModule row 가 **"crawling vs hierarchy 정책은 P4 ADR"** 으로 본 ADR 을 명시 가리키며, [docs/architecture/p4-implementation-plan.md §3 ADR 후보 (a)](../architecture/p4-implementation-plan.md) 도 본 결정을 ADR 후보로 박제했다. [CLAUDE.md §1](../../CLAUDE.md) ("코드보다 ADR이 먼저다") 에 따라, ConfluenceAdapter 의 page 수집 메커니즘을 구현하기 **전에** 탐색 전략을 ADR 로 확정해 후속 adapter 코드가 일관된 contract 위에서 구현되게 한다.

본 task 는 **순수 결정 문서** 다 — 외부 dependency 추가 / 외부 자격증명 처리 / DB schema 변경 / auth-flow 변경을 **하지 않는다**. ConfluenceAdapter 의 실제 코드 (Confluence client SDK 또는 `fetch` + Confluence token) 는 후속 HITL 게이트 task 의 책임이며, 본 ADR 은 그 게이트가 발화하기 전 dependency-free 로 선행 박제 가능한 결정만 다룬다. 다음 free ADR 번호 **ADR-0013** 사용 (ADR-0001 ~ ADR-0012 점유).

## Required Reading

- [docs/PLAN.md](../PLAN.md) Phase P4 L83–84 (Confluence 통합 + SPACE 탐색 정책 bullet) — 본 ADR 의 1차 source ("ADR 로 결정" 의무)
- [docs/requirements.md](../requirements.md) REQ-015 (Confluence 지정 SPACE 평가) / REQ-016 (권한 통지) / REQ-017 (crawling vs hierarchy 탐색 정책 — Constraint, "P4 ADR 필수") — REQ source of truth
- [README.md](../../README.md) L31–34 (Confluence 지정 SPACE 문서 활동 + crawling/List/Hierarchy 탐색 허용 문구) — 결정 대상 verbatim
- [docs/architecture/modules.md](../architecture/modules.md) ConfluenceModule row ("crawling vs hierarchy 정책은 P4 ADR" + SPACE list / page list / page version 조회 adapter 책임) — 책임 module + 트리거 source
- [docs/architecture/p4-implementation-plan.md](../architecture/p4-implementation-plan.md) §3 ADR 후보 (a) (Confluence SPACE 탐색 정책, 책임 트리거 시점) + §2 표 (ConfluenceModule row) — ADR 후보 + 트리거 박제
- [docs/decisions/ADR-0011-difficulty-model-assignment.md](../decisions/ADR-0011-difficulty-model-assignment.md) — ADR 템플릿 mirror (frontmatter `id`/`title`/`status`/`date`/`relatedTask`/`supersedes` 형식 + Context / Decision / Consequences / Alternatives 구조)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — ADR 목록 row 추가 대상 (신규 ADR-0013 row)

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0013-confluence-space-traversal-policy.md` 신설. frontmatter (`id: ADR-0013` / `title` / `status: ACCEPTED` / `date` / `relatedTask: T-0145` / `supersedes: null`) 가 ADR-0011 형식과 일치.
- [ ] ADR 본문이 **택일 결정** 을 명시 + 사유 박제 — 다음 3 축을 각각 결정:
  - **축 (1) 탐색 메커니즘 택일** — (a) full crawling (link 따라가며 재귀 수집) vs (b) page List 기반 (SPACE 의 content list API 순회) vs (c) page Hierarchy / directory 기반 (parent-child tree 순회) 중 하나를 default 로 확정 + 사유. README L34 가 셋 다 허용하므로 **본 ADR 이 구현 default 1 개를 명시 선택**.
  - **축 (2) 지정 SPACE 다중 관리 + page 단위 수집 경계** — 지정된 SPACE 들 (다중) 을 어떻게 enumerate 하는지 + page 단위 (page + version) 수집의 단위 경계. raw 미저장 invariant ([ADR-0006](../decisions/ADR-0006-assessment-data-model.md) / REQ-059) 와의 정합 — page 본문 raw 는 저장하지 않고 평가 결과만.
  - **축 (3) 권한 부족 (4xx) 처리 위상** — 지정 SPACE 일부에 접근 권한 부재 시 4xx → PermissionDeniedEvent emit 의 위상 (REQ-016). 단, PermissionDeniedRecord entity 의 실 schema 는 본 ADR scope 외 (후속 task) — 본 ADR 은 탐색 중 4xx 가 탐색을 abort 하는지 / skip 하고 계속하는지의 **탐색-제어 정책** 만 박제.
- [ ] ADR 본문에 `Alternatives` 섹션 — 축 (1) 의 기각된 대안 (선택 안 한 탐색 메커니즘 2 개) 의 기각 사유 + 향후 재검토 조건 1+ 박제.
- [ ] ADR 본문이 **modules.md ConfluenceModule row 와 모순되지 않는지** 1+ 줄로 대조 명시 (adapter leaf / 외부 Confluence HTTPS 만 호출 / 4xx catch → PermissionDeniedEvent emit 책임과 align).
- [ ] ADR 본문에 **HITL 경계 명시** 1+ 줄 — 본 ADR 은 결정만, ConfluenceAdapter 실 코드 (Confluence client SDK 또는 `fetch` + Confluence token) 는 후속 task 의 [CLAUDE.md §5](../../CLAUDE.md) "새 외부 dependency / 자격증명" BLOCKED 게이트 대상임을 박제.
- [ ] `docs/architecture/INDEX.md` 의 ADR 목록에 ADR-0013 row 1 줄 추가 (ADR-0011 / ADR-0012 row 형식 mirror).
- [ ] `Refs:` 줄에 T-0145 + 관련 REQ (REQ-015 / REQ-016 / REQ-017) + PLAN.md / modules.md / p4-implementation-plan.md 참조 박제.
- [ ] **R-112 4-항목 test 미적용** — 본 task 는 production code 0 LOC (doc-only ADR + INDEX 1 row). 새 public symbol / 분기 0 → unit test 추가 대상 없음. 분기 없음 — happy / error / branch / negative test 항목은 이 task 에 적용 대상이 없어 생략. tester 는 **R-110 으로 `pnpm lint && pnpm build && pnpm test` green 유지** 만 확인 (코드 변경 0 이므로 기존 suite 가 그대로 통과해야 함).
- [ ] reviewer 가 §12 언어 정책 (ADR 본문 한국어, 식별자 / enum / REQ-ID / 경로 영어) + ADR 템플릿 정합성 + 결정의 modules.md 대조를 점검 (pr-mode).

## Out of Scope

- **ConfluenceAdapter 실 코드 작성** — `ConfluenceAdapter` service / SPACE list / page list / page version 조회 구현은 후속 코드 task 책임. Confluence client SDK 추가 또는 native `fetch` 사용 + **Confluence token 자격증명** 처리는 [CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 대상 ([p4-implementation-plan.md §4](../architecture/p4-implementation-plan.md) inventory). 본 task 는 결정만, `pnpm add` 0 / 외부 호출 0 / secret 0 기재.
- **PermissionDeniedRecord entity 구현** — 4xx event 영속화 entity (Prisma model + repository) 는 GithubAdapter / ConfluenceAdapter (HITL 게이트) 선행 의존이 있어 본 ADR 과 분리. 본 ADR 은 탐색 중 4xx 의 탐색-제어 정책 (abort vs skip-continue) 만 박제, entity schema 0.
- **Confluence client dependency 추가 (`pnpm add`)** — REST API SDK 또는 `fetch` 택일의 실 패키지 추가는 후속 HITL 게이트 task. 본 ADR 은 탐색 메커니즘 (crawling vs List vs Hierarchy) 결정만, client 라이브러리 선택은 별도 결정.
- **GitHub 통합 ADR** — GithubModule 의 3-instance 통합 / Issue 평가 (R-30) 는 별도 P4 bullet / 별도 task. 본 ADR 은 Confluence 탐색만.
- **prisma/schema.prisma 변경 / migration** — DB schema 변경 0 (본 ADR 은 정책 doc only).
- **STATE.json / counters / PLAN.md status 갱신** — driver single-writer 책임 ([CLAUDE.md §9](../../CLAUDE.md)). 본 task 는 ADR + INDEX 만.

## Suggested Sub-agents

`architect → tester` — architect 가 ADR-0013 작성 + INDEX row 추가 (3 축 결정 + modules.md 대조 + HITL 경계 박제). production code 변경 0 이므로 implementer 불요. tester 는 R-110 (lint / build / test green 유지) 만 확인.

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 추가.)
