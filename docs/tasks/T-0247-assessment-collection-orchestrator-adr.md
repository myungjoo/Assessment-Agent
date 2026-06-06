---
id: T-0247
title: Assessment collection orchestrator 설계 ADR (ADR-0029)
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-009, REQ-010, REQ-015, REQ-031, REQ-032, REQ-059]
estimatedDiff: 220
estimatedFiles: 2
created: 2026-06-06
plannerNote: P4 collection orchestrator multi-task effort 의 첫 slice — Q-0025 승인 후 수집 설계 ADR 결정 (impl 0 LOC)
---

# T-0247 — Assessment collection orchestrator 설계 ADR (ADR-0029)

## Why

GitHub adapter (`src/github/`) + Confluence adapter (`src/confluence/`) 는 transport·instance routing·permission-denied emit 까지 모두 박제됐으나 **자기 test 외 caller 가 0** 이다 — 활동을 실제로 수집해 `Contribution` 으로 영속화하는 orchestrator 가 없다. modules.md row 9 `AssessmentModule` 의 orchestration 의도(commit/문서/Confluence page → 평가 파이프라인)는 미구현이고 `app.module.ts` 에도 미배선이다. 본 effort 는 그 공백의 **수집(collection) 책임**을 채운다(평가/scoring 은 P5, scheduler 는 P7 별개). 사용자가 Q-0025 를 승인하며 "기존 adapter 를 사용하는 수집 orchestrator 구축 + live 테스트는 UI 이후로 deferred, mocked unit test 는 R-112 대로 필수"로 결정했다. 본 task 는 그 effort 의 **첫 slice = 설계 결정 ADR** 로, 구현 없이 design 만 박제한다(CLAUDE.md §3.1 rule 4 — 새 ADR 은 `pr`).

## Required Reading

- `docs/architecture/modules.md` (특히 row 9 AssessmentModule orchestration 의도 + GithubModule/ConfluenceModule/PersistenceModule row)
- `docs/architecture/data-model.md` (Assessment / Contribution / Summary entity 필드 + REQ-031/032 raw-not-stored 불변)
- `docs/architecture/components.md` (GitHub Adapter / Confluence Adapter / Worker component 경계)
- `docs/decisions/ADR-0016-github-adapter-http-transport-contract.md` (GitHub transport 계약 — request()/requestAllPages() 반환 raw unknown[])
- `docs/decisions/ADR-0017-github-instance-config-source.md` (instance config env source = com/sec/ecode 키)
- `docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` (Confluence transport + `_links.next` cursor)
- `src/github/github-instance-client.service.ts` (single-instance wrapper: config resolve + JIT decrypt + delegate)
- `src/confluence/confluence-space-traversal.service.ts` (single-instance SPACE allowlist 순회 + skip-and-continue)
- `src/user/assessment.service.ts` (현 CRUD-only Assessment service — orchestration 미포함)
- `docs/PLAN.md` (P4/P5 섹션 — 수집 vs 평가 phase 경계)
- `docs/requirements.md` (REQ-005..010, REQ-015, REQ-031, REQ-032, REQ-059)

## Acceptance Criteria

본 task 는 **결정 전용 ADR 1개**(`docs/decisions/ADR-0029-assessment-collection-orchestrator.md`) + INDEX row 추가만 산출한다. production LOC 0. ADR 은 다음 7 결정을 **결정(decide)** 하되 구현하지 않는다(구현은 Follow-ups 의 후속 slice).

- [ ] **(1) Module placement 결정** — 신규 `AssessmentCollectionModule` 신설 vs 기존 `AssessmentModule` 확장 중 택1 + 근거. GithubModule / ConfluenceModule / PersistenceModule 대비 위치(import 방향)와 `app.module.ts` 배선 지점 명시. modules.md row 9 `AssessmentModule`(평가 orchestration) 의도와의 관계 reconcile — 수집(P4)과 평가(P5)가 같은 module 인지 분리인지 명문화.
- [ ] **(2) Activity 도메인 모델 결정** — typed `Activity` (base) + `GithubActivity` / `ConfluenceActivity` 의 필드 set 결정(`externalId`, `sourceType`, `timestamp`, `instanceKey`, repo/space ref, `author`, `metadata`). raw `unknown` → `Activity` 매퍼 경계(어느 layer 가 매핑 책임) 결정 + REQ-059/REQ-032 raw-not-stored 불변 보존 방법(raw 응답은 매핑 후 폐기, 영속화 대상은 typed 필드만) 명시.
- [ ] **(3) Orchestration 계약 결정** — instance(com/sec/ecode) × org × repo (GitHub) loop + instance × SPACE allowlist (Confluence) loop 구조 + `GithubInstanceClient` / `ConfluenceSpaceTraversalService` 재사용 방식. per-source skip-and-continue(기존 permission-denied emit 재사용) 결정.
- [ ] **(4) Dedup 전략 결정** — commit 은 SHA 기준(REQ-031/REQ-009 earliest-timestamp wins), Confluence page 는 page-id + version 기준(latest version) 결정.
- [ ] **(5) Incremental "since" 전략 결정** — 직전 Assessment 로부터 since 도출 → adapter query 전달. **결정만**(구현이 크면 별도 후속 slice 로 deferred 명시).
- [ ] **(6) Activity → Contribution 영속화 매핑 결정** — 기존 `Contribution` entity 필드(data-model.md 박제)와 `Activity` 의 1:1 매핑 명시.
- [ ] **(7) Testing posture 결정** — mocked adapter unit test 필수(R-112) + live/e2e 수집 테스트는 사용자 결정대로 **UI 이후로 deferred** 를 ADR Consequences 와 Out of Scope 양쪽에 명시.
- [ ] ADR frontmatter status = PROPOSED, INDEX.md(또는 docs/decisions 의 ADR 목록 문서)에 ADR-0029 row 추가.
- [ ] `pnpm lint && pnpm build` 통과(doc/ADR-only 변경이라 production test 영향 0이나 R-110 대로 tester 가 lint/build 확인). 분기 있는 production 코드 0 → R-112 happy/error/branch/negative/coverage 항목은 본 ADR-only task 에 **해당 없음**(아래 명시).

> **분기 없음·production 코드 0 — R-112 4종 + coverage 항목 생략**: 본 task 는 ADR 문서 + INDEX row 만 변경하므로 새 public symbol·분기·실행 코드가 없다. happy/error/branch/negative unit test 및 `pnpm test:cov` coverage 게이트는 본 task 에 적용되지 않는다(R-110 lint/build 검증만 tester 가 수행). 실 코드와 R-112 full set 은 Follow-ups 의 구현 slice 들에서 강제된다.

## Out of Scope

- production 코드 작성(service / module / mapper / DTO 등) — 본 task 는 **결정만**. 모든 구현은 Follow-ups 의 후속 task.
- LLM 평가 / scoring 파이프라인(P5) — 본 effort 는 **수집(collection)** 만. orchestrator 는 평가 파이프라인에 feeding 하되 실행하지 않는다.
- Scheduler / cron trigger(P7).
- **live / credentialed 수집 테스트** — 사용자 결정대로 UI 이후로 deferred. 실 GitHub/Confluence token 주입·실 endpoint round-trip e2e 는 본 effort 범위 밖(ADR Consequences 에 박제만).
- 기존 adapter / instance-client / space-traversal service 의 동작 변경 — orchestrator 는 그들을 **사용**만 한다.
- modules.md / data-model.md 등 다른 architecture doc 의 동기 갱신 — 별도 direct doc-sync task(Follow-up).

## Suggested Sub-agents

`architect → tester` (ADR 결정 작성은 architect, lint/build 검증은 tester). implementer 불요(production 코드 0).

## Follow-ups

본 effort 의 후속 구현 slice (각각 별도 future task, ≤300 LOC / ≤5 파일, 각 mocked unit test 포함 — live 테스트는 UI 이후 deferred):

- (i) **Activity 도메인 모델 + 매퍼** — `Activity` base + `GithubActivity` / `ConfluenceActivity` typed 모델 + raw unknown → Activity 매퍼 (+ mocked unit test, REQ-059/032 raw-not-stored 검증).
- (ii) **GitHub 다중 repo 수집 service** — instance(com/sec/ecode) × org × repo enumerate → commits/PRs/issues 수집 + SHA dedup, `GithubInstanceClient` 재사용 (+ mocked adapter unit test, skip-and-continue 분기 cover).
- (iii) **Confluence 다중 instance 수집 service** — instance × SPACE allowlist 순회 + page-id+version dedup, `ConfluenceSpaceTraversalService` 재사용 (+ mocked unit test).
- (iv) **AssessmentCollectionModule 배선** — module 정의 + `app.module.ts` import (+ module unit test).
- (v) **Orchestrator entry service + Contribution 영속화** — 수집 결과 → Activity → Contribution row persist, 기존 Contribution repository 재사용 (+ mocked unit test).
- (vi) **Incremental "since"** — 직전 Assessment 기반 since 도출 → adapter query 전달 (+ mocked unit test, since 경계값 negative case).
- (vii) **doc-sync (direct)** — modules.md row 9 + data-model.md 에 collection orchestrator 설계 반영.
