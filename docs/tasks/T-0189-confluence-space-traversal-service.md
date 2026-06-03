---
id: T-0189
title: ConfluenceSpaceTraversalService — SPACE allowlist 순회 + 4xx skip-and-continue
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-015, REQ-016, REQ-017, REQ-044]
dependsOn: [T-0188, T-0185, T-0184]
estimatedDiff: 180
estimatedFiles: 3
created: 2026-06-03
completedAt: 2026-06-03T14:10:08+09:00
prNumber: 171
reviewRounds: 2
mergedAs: f2090ef
plannerNote: P4 milestone-3 Confluence chain row5(ADR-0018 §6 4단 경계 4번) — SPACE allowlist 순회 service. dep 없음(row5), schema 0(persistence=row8), §5 미발화.
---

# T-0189 — ConfluenceSpaceTraversalService — SPACE allowlist 순회 + 4xx skip-and-continue

## Why

[ADR-0018 §6](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) 4단 경계의 **4번 = `ConfluenceSpaceTraversalService`** 를 구현한다. 지금까지 row1~4(request-builder / token JIT decrypt / adapter dispatch / `_links.next` pagination)가 main 에 박제됐고, 그 위에 [ADR-0013 §2/§3](../decisions/ADR-0013-confluence-space-traversal-policy.md) 의 **SPACE allowlist 순회 control flow + 4xx skip-and-continue** 를 얹는 service layer 만 남았다. 한 SPACE 의 권한 부족(4xx)이 전체 Confluence 수집을 abort 시키지 않고 나머지 SPACE 수집을 계속하는 부분 가용성(REQ-016/044) 을 service 책임으로 완결한다(REQ-015 지정 SPACE 평가, REQ-017 page List 탐색 정책 정합). adapter(transport)는 4xx 를 throw 까지만 — skip-and-continue 의 try/catch 흡수는 본 service 책임이다.

본 task 는 dependency-free 다(ADR-0018 §6 row5 dependency=없음). 새 외부 dependency 0 / DB schema 0 / 외부 credential 0 — 이미 머지된 primitive(`ConfluenceAdapter.requestAllPages`, `decryptConfluenceInstanceConfigToken`, `resolveConfluenceInstances`, `LlmApiKeyCipher`)만 조립한다. CLAUDE.md §5 게이트 미발화.

## Required Reading

- `docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` — §6 4단 경계(특히 4번 service 위상) + Decision §4 skip-and-continue 책임 분리(adapter throw / service catch).
- `docs/decisions/ADR-0013-confluence-space-traversal-policy.md` — Decision §2(SPACE allowlist 순회 + 전수 발견 금지) + Decision §3(SPACE 단위 skip-and-continue + PermissionDeniedEvent emit 위상).
- `src/confluence/confluence-adapter.service.ts` — `ConfluenceAdapter.requestAllPages` 시그니처 + `ConfluenceDomainError`(kind: permission-denied/not-found/rate-limited/transient/domain-error) + `PermissionDeniedEmitter` / `NO_OP_PERMISSION_DENIED_EMITTER` port.
- `src/confluence/confluence-instance-config.ts` — `ConfluenceInstanceConfig`(특히 `spaceAllowlist: string[]`, `baseUrl`, `authUser`, `tokenEnc`) + `resolveConfluenceInstances`.
- `src/confluence/confluence-request.builder.ts` — `ConfluenceRequestInput` 조립 입력 shape(baseUrl / authUser / token / path / query).
- `src/confluence/confluence-token-decrypt.ts` — `decryptConfluenceInstanceConfigToken(cipher, instance)` JIT decrypt overload.
- `src/confluence/confluence.module.ts` — provider/exports 등록 위치(본 service provider 추가 대상).
- `src/github/github-instance-client.service.ts` — `@Injectable` config-consuming orchestrator 구조 mirror 레퍼런스(단 본 service 는 단일 instance 가 아니라 SPACE allowlist 순회 + skip-and-continue 추가). **colocated spec 위치**: `src/confluence/confluence-space-traversal.service.spec.ts`.
- `test/helpers/prisma-mock.ts` 인근의 기존 mock 패턴(필요 시 adapter/cipher mock 은 colocated spec 안에서 직접 구성 — 새 helper 추출은 2+ spec 공유 시에만).

## Acceptance Criteria

핵심 deliverable:

- [ ] `src/confluence/confluence-space-traversal.service.ts` 에 `@Injectable` `ConfluenceSpaceTraversalService` 추가. 생성자로 `ConfluenceAdapter` + `LlmApiKeyCipher`(JIT decrypt 용) + `@Optional` `PermissionDeniedEmitter`(default `NO_OP_PERMISSION_DENIED_EMITTER`) 를 주입(GithubInstanceClient 의 @Optional env 패턴 mirror).
- [ ] 한 `ConfluenceInstanceConfig` 를 받아 그 `spaceAllowlist` 의 각 SPACE key 마다 `ConfluenceRequestInput` 을 조립(`decryptConfluenceInstanceConfigToken` 으로 token JIT 복호 → SPACE-scoped path/query 구성) → `ConfluenceAdapter.requestAllPages` 호출 → 결과를 in-memory 로 aggregate 하는 public 메서드 1개(예: `traverseInstance(config): Promise<unknown[]>` 또는 SPACE별 결과를 식별 가능한 형태로 반환 — 반환 shape 은 ADR-0013 §2 (page, version) raw-transient 경계 정합하게 설계서에 명시).
- [ ] **4xx skip-and-continue**: 한 SPACE 의 `requestAllPages` 가 `ConfluenceDomainError`(permission-denied / not-found) 를 throw 하면 try/catch 로 흡수 → `PermissionDeniedEmitter.emit` 후 **다음 SPACE 계속 진행**(전체 traversal abort 금지, ADR-0013 §3). 권한 있는 나머지 SPACE 결과는 정상 aggregate.
- [ ] 비-권한 error(transient / rate-limited / domain-error) 처리 정책을 설계서에 명시하고 그대로 구현(ADR-0018 §4 정합 — 본 slice 는 SPACE 단위 skip 또는 전파 중 ADR 정합 선택을 코드 주석으로 박제).
- [ ] **token never-read-back**: 복호된 평문 token 은 `ConfluenceRequestInput.token` 으로만 흘려보내고 로그 / 직렬화 / error message / 반환값 어디에도 노출 금지(CLAUDE.md §9, GithubInstanceClient invariant mirror).
- [ ] `src/confluence/confluence.module.ts` 의 providers/exports 에 `ConfluenceSpaceTraversalService` 등록. `LlmApiKeyCipher` 가 module context 에서 주입 가능하도록 wiring(필요 시 import).

R-112 test 의무(colocated `src/confluence/confluence-space-traversal.service.spec.ts`):

- [ ] **Happy multi-SPACE**: allowlist 2+ SPACE 전부 성공 시 각 SPACE 의 `requestAllPages` 가 호출되고 결과가 aggregate 됨을 검증(happy-path 1+).
- [ ] **Happy single-SPACE**: allowlist 1 SPACE 만 있을 때 정상 수집 검증.
- [ ] **Error path**: cipher.decrypt throw(깨진 envelope) 가 swallow 되지 않고 전파됨(또는 ADR 정합 처리) 검증 1+.
- [ ] **분기 cover**: skip-and-continue try/catch 분기(권한 거부 SPACE catch 분기 vs 정상 SPACE 통과 분기) 각 1+ test.
- [ ] **negative cases 충분 cover(각 1+)**:
  - 4xx-skip-and-continue: allowlist 중 1 SPACE 가 permission-denied(403) throw → 그 SPACE skip + `PermissionDeniedEmitter.emit` 호출 + 나머지 SPACE 결과 정상 aggregate.
  - not-found(404) SPACE 도 skip-and-continue 됨.
  - **빈 allowlist**: `spaceAllowlist === []` → adapter 호출 0회 + 빈 결과 반환(throw 0).
  - **all-SPACEs-fail**: allowlist 전 SPACE 가 4xx → 전부 skip + 각 emit 호출 + 빈/부분 결과 반환(전체 abort 금지 검증).
  - emit port 미주입(no-op default) 시에도 catch 분기가 crash 없이 진행됨.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 — 본 service line ≥ 80% AND function ≥ 80%(package.json `coverageThreshold.global`).

## Out of Scope

- **PermissionDeniedRecord entity 의 실 persistence (Prisma model + migration + repository)** — chain row8, CLAUDE.md §5 DB schema 게이트. 본 task 의 emit 은 기존 in-memory `PermissionDeniedEmitter` port(no-op default)까지만. **DO NOT** add Prisma model / migration.
- **roundtrip smoke (local stub HTTP 서버)** — chain row6. 본 task 는 mocked adapter unit 만.
- **doc-sync (modules.md / api.md / p4-implementation-plan.md 정합)** — chain row7. 별도 direct doc task.
- **live-run (실 Confluence token + 실 네트워크)** — chain row9, §5 credential 게이트. 본 task 는 mocked adapter + fake-encrypted-token fixture 만.
- **다중 instance 순회(resolveConfluenceInstances 결과 전체 loop)** — 본 task 는 단일 `ConfluenceInstanceConfig` 의 SPACE allowlist 순회까지. 다중 instance enumerate 는 상위 orchestrator(후속) 책임. 단 단일 instance traverse 메서드만 박제하면 충분.
- `ConfluenceAdapter` / `confluence-request.builder` / `confluence-token-decrypt` 의 기존 시그니처 변경 금지(이미 머지된 contract 보존). 새 외부 dependency `pnpm add` 금지.

## Suggested Sub-agents

`implementer → tester` (설계가 ADR-0018 §6 + ADR-0013 §2/§3 로 충분히 박제돼 architect 불요. 단 비-권한 error 처리 정책에 ADR 해석 모호가 있으면 implementer 가 ADR 정합 선택을 코드 주석으로 박제).

## Follow-ups

- (row6) ConfluenceAdapter roundtrip smoke — local stub HTTP 서버(Node 내장 http.createServer)로 실 fetch round-trip 검증.
- (row7) doc-sync — modules.md ConfluenceModule row + p4-implementation-plan.md 에 SpaceTraversalService 박제 + ADR-0018 §6 4단 경계 완결 반영(direct).
- (row8) PermissionDeniedRecord entity — Prisma model + migration + repository + 4xx event 영속화 + user/admin audience 분리(REQ-016). §5 DB schema 게이트.
- (row9) live-run — 실 Confluence token + 실 네트워크로 traversal 1회 검증. §5 credential 게이트.
- **SECURITY 후보(STATE loopSession 기록, T-0188 PR-170 reviewer MINOR)**: cross-host auth-leak — adapter 가 절대 `_links.next` / Link rel=next 를 instance base host 와 무관하게 따라가면 Authorization 헤더가 외부 host 로 유출 가능. GitHub+Confluence 양 adapter 공통 → 별도 ADR(same-host 제약 박제) + 양 adapter 가드 task 후보. 본 task scope 밖.
