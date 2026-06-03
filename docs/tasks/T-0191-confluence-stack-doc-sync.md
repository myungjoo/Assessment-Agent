---
id: T-0191
title: Confluence transport stack 박제 반영 doc-sync (modules.md + p4-implementation-plan.md)
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-015, REQ-016, REQ-017]
dependsOn: []
estimatedDiff: 50
estimatedFiles: 2
created: 2026-06-03
plannerNote: P4 milestone-3 chain row7 — 머지된 Confluence transport stack(T-0183~T-0190)을 architecture doc 에 반영. 순수 docs → direct. doc-only inline-amend ×0.64.
---

# T-0191 — Confluence transport stack 박제 반영 doc-sync (modules.md + p4-implementation-plan.md)

## Why

P4 milestone-3 Confluence chain 의 코드/test task(ADR-0018 PROPOSED → T-0183 + T-0184~T-0190 의 ConfluenceModule scaffold / request-builder / adapter dispatch / `_links.next` pagination / SpaceTraversalService / roundtrip smoke)가 모두 main 에 머지됐다(`7612c10` 외). 그러나 `docs/architecture/modules.md` 의 ConfluenceModule row 는 여전히 P1 placeholder("crawling vs hierarchy 정책은 P4 ADR")이고, `docs/architecture/p4-implementation-plan.md` §2 표의 T-0142/T-0143 row 는 Q-0017 이 supersede 한 "Confluence client SDK 추가 + token 자격증명 BLOCKED 게이트" 표기를 그대로 들고 있다. 이 둘을 merged reality 로 정합한다(README L33–41 REQ-015~017 Confluence 통합). 본 task 는 T-0190 task 파일 Follow-ups 가 "row7 doc-sync, T-0190 merge 후 우선 후보(direct)"로 명시한 항목이다. 순수 architecture 문서 갱신이므로 §3.1 에 따라 `direct`.

## Required Reading

- `docs/architecture/modules.md` — line 36 의 ConfluenceModule row(갱신 대상). line 35 의 GithubModule row 는 post-merge 작성 패턴의 precedent(서비스 list + ADR 참조 형식 mirror).
- `docs/architecture/p4-implementation-plan.md` — §2 표(line 22~35) 의 T-0142/T-0143 row + line 75 의 게이트 발화 inventory 2번(Confluence client dependency) + line 85 게이트 미발화 list(정합 대상).
- `docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` — frontmatter status(현재 `PROPOSED`) + 섹션 구조(Context/Decision/Consequences/Alternatives/References — **§6 은 없음**). 본 doc-sync 가 참조할 transport 계약 6 축의 출처.
- main 의 `src/confluence/` 파일 목록(참조용, 수정 금지): `confluence.module.ts` / `confluence-adapter.service.ts` / `confluence-request.builder.ts` / `confluence-space-traversal.service.ts` / `confluence-token-decrypt.ts` / `confluence-instance-config.ts` + 각 colocated spec + `test/smoke/confluence-adapter-roundtrip.smoke-spec.ts`.

## Acceptance Criteria

`commitMode: direct` 순수 doc task 이므로 test 의무 없음(코드 변경 0). 아래 doc delta 를 정확히 반영한다.

- [ ] **modules.md ConfluenceModule row(line 36) 갱신** — GithubModule row(line 35) 의 post-merge 작성 패턴을 mirror 하여, "milestone-3 구현 박제" 내용을 추가한다. 최소 다음을 명시:
  - 단일 `ConfluenceAdapter` service(주입 `ConfluenceFetchLike` = Node 내장 `globalThis.fetch`, 새 외부 dependency 0) + 4xx → PermissionDeniedEvent emit / 404 no-emit / 5xx transient / malformed → domain-error 매핑.
  - `ConfluenceRequestBuilder`(풀 base URL + relative path concat, Cloud `/wiki/rest/api` vs Server `/rest/api` 비대칭은 instance config 의 풀 URL 로 흡수), `ConfluenceSpaceTraversalService`(SPACE allowlist 순회 + `_links.next` body cursor pagination flatten + 4xx skip-and-continue), `confluence-token-decrypt`(ADR-0014 cipher JIT 복호화), `confluence-instance-config`(ADR-0017 동형 enumerable instance-keyed env shape).
  - 로컬 stub round-trip smoke(`test/smoke/confluence-adapter-roundtrip.smoke-spec.ts`, T-0190 — 실 `globalThis.fetch` end-to-end closeout) 까지 완료, **잔여 = 실 Confluence token + live endpoint 통합만 §5 HITL 게이트로 deferred**(Q-0017).
  - 관련 ADR 컬럼에 [ADR-0018](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md)(transport 계약) 추가([ADR-0013](../decisions/ADR-0013-confluence-space-traversal-policy.md) SPACE 탐색은 기존 유지).
- [ ] **p4-implementation-plan.md §2 표 T-0142 row 정합** — "Confluence client(REST API SDK 또는 `fetch`) 추가 + Confluence token 자격증명 BLOCKED 게이트" 표기를 Q-0017 결정(내장 fetch, 새 dependency 0 → §5 의존성 게이트 미발화)으로 정정. token credential 게이트만 live-run row 로 잔류함을 명시. row 의 실제 split(T-0183~T-0190)을 짧게 참조.
- [ ] **p4-implementation-plan.md §2 표 T-0143 row 정합** — ADR-0013(SPACE 탐색 정책) ACCEPTED + SpaceTraversalService 박제 완료를 반영.
- [ ] **p4-implementation-plan.md line 75(게이트 발화 inventory 2번) + line 85(게이트 미발화 list) 정합** — Confluence client dependency 게이트가 내장 fetch 채택으로 미발화임을 명시(ADR-0018 Decision §1 이 supersede). 실 token live-run 만 §5 credential 게이트 잔류.
- [ ] **stale 참조 정정** — 문서 어디에도 "ADR-0018 §6" 를 새로 만들지 않는다(ADR-0018 은 Context/Decision/Consequences/Alternatives/References 5 섹션, §6 없음). 4단 경계는 ADR-0018 Decision §6(adapter↔service 경계 축) 또는 본문 서술로 참조.
- [ ] 두 문서의 기존 표 구조 / mermaid / acyclic 검증 섹션은 건드리지 않는다(ConfluenceModule 은 leaf 라 의존성 그래프 불변).
- [ ] 변경 후 `docs/architecture/p4-implementation-plan.md` 의 References / Refs 라인에 ADR-0018 / T-0183 등 신규 참조가 필요하면 1 줄 보강(선택).

## Out of Scope

- **ADR-0018 status flip(PROPOSED → ACCEPTED)** — chain row10 의 별도 direct doc task. 본 task 는 modules.md / p4-implementation-plan.md 내용 정합만. ADR-0018 의 frontmatter status 는 건드리지 않는다.
- **PLAN.md P4 bullet 체크박스 갱신** — 별도 follow-up direct task(필요 시).
- **새 ADR 작성 / ADR-0018 본문 수정** — 본 task 는 ADR 을 reference 만.
- **src/confluence/* 코드·spec·smoke 수정** — 코드 변경 0(direct doc task).
- **PermissionDeniedRecord entity(row8, §5 schema 게이트) / live-run(row9, §5 credential 게이트)** — 둘 다 HITL gated, queue 금지.
- **data-model.md / api.md / INDEX.md 의 Confluence 상세 갱신** — 본 task scope 밖(필요 시 별도 task).

## Suggested Sub-agents

`implementer`(doc-only edit). production code 무변경 + direct doc task 이므로 tester 불필요. driver 가 직접 edit 후 direct commit 해도 무방.

## Follow-ups

- (row10) ADR-0018 status `PROPOSED → ACCEPTED` flip — 1 줄 frontmatter 수정 direct doc task. 본 doc-sync 머지 후 우선 후보. 동시에 ADR-0018 References 에 박제된 코드 task(T-0183~T-0190) 머지 SHA 반영 여부 검토.
- (row8) PermissionDeniedRecord entity Prisma model + migration — §5 DB schema 게이트, 사용자 승인 전까지 BLOCKED(queue 금지).
- (row9) Confluence live-run(실 token + live endpoint) — §5 credential 게이트, 사용자 승인 전까지 BLOCKED(queue 금지).
- (SECURITY 후보) cross-host auth-leak — GitHub+Confluence adapter 가 `_links.next` / `Link rel=next` 를 base host 무관 추종 시 Authorization 외부 host 유출 가능. 별도 ADR(same-host 제약) + 양 adapter 가드 task 후보(T-0188 reviewer MINOR 기원).
