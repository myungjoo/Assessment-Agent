---
id: T-0180
title: GithubInstanceClient — instance key resolve + token JIT decrypt + adapter dispatch 배선
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-044]
estimatedDiff: 170
estimatedFiles: 3
created: 2026-06-03
plannerNote: P4 milestone-3 ADR-0017 chain — config(resolveGithubInstances)+token JIT decrypt+adapter dispatch 를 instance key 단위로 배선. dep-free(내장 fetch/기존 cipher), §5 미발화.
---

# T-0180 — GithubInstanceClient: instance key resolve + token JIT decrypt + adapter dispatch 배선

## Why

P4 milestone-3 (Q-0017 승인, GitHub adapter) 의 마지막 dependency-free slice 다. 지금까지 박제된 3 primitive — 환경설정 parser (`resolveGithubInstances`, T-0178), token JIT decrypt helper (`decryptGithubInstanceConfigToken`, T-0179), adapter dispatch (`GithubAdapter.request` / `requestAllPages`, T-0175/T-0176) — 는 모두 **고립된 조각**이라 "instance key 하나로 실제 인증 요청을 보내는" 경로가 아직 없다. 본 task 는 이 셋을 잇는 얇은 orchestrator (`GithubInstanceClient`) 를 추가해, configured instance 가 자기 암호화 token 을 JIT 복호화해 auth header 로 실어 단일/다중 page REST 요청을 dispatch 할 수 있게 한다. ADR-0017 Decision §3 (token JIT decrypt → adapter wire) 의 이미 결정된 설계를 구현만 하므로 새 §5 게이트가 아니다 (REQ-005~008 GitHub 수집 backbone, REQ-044 권한 가시화).

## Required Reading

- `docs/decisions/ADR-0017-github-instance-config-source.md` — env 기반 config source + token encrypted-at-rest + JIT decrypt chain (본 task 가 구현하는 wire 단계)
- `src/github/github-instance-config.ts` — `resolveGithubInstances(env)` / `GithubInstanceConfig` / `GithubInstanceResolution` (key→config 해석)
- `src/github/github-token-decrypt.ts` — `decryptGithubInstanceConfigToken(cipher, instance)` / `decryptGithubInstanceToken` (config→평문 token)
- `src/github/github-adapter.service.ts` — `GithubAdapter.request` / `requestAllPages` / `GithubRequestInput` 소비, `GithubDomainError` 위상
- `src/github/github-request.builder.ts` — `GithubRequestInput` 형태 (host/token/path/query)
- `src/github/github.module.ts` — provider/export 패턴 (본 client 등록 위치)
- `src/llm/llm-apikey-cipher.service.ts` — `LlmApiKeyCipher` (@Injectable, no-arg constructor, `decrypt` JIT) — 주입 대상
- `src/github/github-token-decrypt.spec.ts` — cipher mock 패턴 참조 (colocated spec 작성 시)

## Acceptance Criteria

- [ ] `src/github/github-instance-client.service.ts` 신설 — `@Injectable() GithubInstanceClient` 가 생성자로 `GithubAdapter` + `LlmApiKeyCipher` 를 주입받는다 (NestJS DI; cipher 는 ADR-0014 기존 것 재사용, 새 master key 신설 금지).
- [ ] env 를 읽어 instance config 를 해석하는 경로 — `resolveGithubInstances(process.env)` 의 결과(또는 주입된 env map; unit testability 위해 env 를 주입 가능하게 둘 것)에서 주어진 `key` 에 해당하는 `GithubInstanceConfig` 를 찾는다. 미존재 key → 명확한 도메인 Error throw (token 평문 미포함).
- [ ] 단일 요청 메서드 (예: `requestForInstance(key, path, query?)`) — 해당 instance config 의 `tokenEnc` 를 `decryptGithubInstanceConfigToken(cipher, config)` 로 **호출 직전 JIT 복호화** → `GithubRequestInput { host, token, path, query }` 조립 → `GithubAdapter.request` 위임 → 반환.
- [ ] 다중 page 수집 메서드 (예: `requestAllPagesForInstance(key, path, query?)`) — 동일 JIT decrypt + input 조립 후 `GithubAdapter.requestAllPages` 위임 → `unknown[]` 반환.
- [ ] 평문 token never-read-back 보장 — 복호화된 token 은 `GithubRequestInput.token` 으로만 흘려보내고, 로그 / 직렬화 / error message / 반환값 어디에도 평문 token 을 싣지 않는다 (CLAUDE.md §9, ADR-0014 §3).
- [ ] `src/github/github.module.ts` 에 `GithubInstanceClient` 를 provider 등록 + export. `LlmApiKeyCipher` 를 inject 가능하도록 provider 로 추가하거나 import (LlmModule export 여부 확인 후 적절히 — 새 외부 dependency 0).
- [ ] **Happy-path unit test** — colocated `src/github/github-instance-client.service.spec.ts`: 유효 key 로 `requestForInstance` 호출 시 (a) cipher.decrypt 가 해당 instance 의 tokenEnc 로 1회 호출되고 (b) GithubAdapter.request 가 올바른 `{ host, token(복호 결과), path, query }` 로 1회 호출되며 (c) adapter 반환값이 그대로 전파됨을 검증 (fetch / cipher 는 mock).
- [ ] **Happy-path** — `requestAllPagesForInstance` 가 GithubAdapter.requestAllPages 위임 + flatten 배열 반환을 검증.
- [ ] **Error path unit test** — (a) 미존재/비활성 key → throw, (b) cipher.decrypt 가 throw (깨진 envelope) 시 swallow 없이 전파, (c) GithubAdapter 가 `GithubDomainError` (permission-denied/not-found 등) throw 시 그대로 전파됨을 각각 1+ test.
- [ ] **Flow / branch coverage** — key 존재/부재 분기, query 유무 분기 등 각 분기 1+ test.
- [ ] **Negative cases 충분 cover** — 빈/공백 key, 빈 GITHUB_INSTANCES (활성 instance 0), tokenEnc 부재 instance (resolveGithubInstances 가 reject 한 key), decrypt 실패, adapter 각 도메인 error 위상 — 예외 분기마다 1+ test (단일 negative 금지).
- [ ] **never-read-back 검증** — 복호된 평문 token 이 throw 되는 Error message / 반환 객체에 등장하지 않음을 assert 하는 test 1+.
- [ ] `pnpm test:cov` 통과 — 신규 파일 포함 전체 line ≥ 80% AND function ≥ 80% (jest `coverageThreshold` 강제).
- [ ] `pnpm lint && pnpm build && pnpm test` green. tester 가 R-110 (코드검토+test작성+test수행) 결과 확인.

## Out of Scope

- **PermissionDeniedRecord entity 의 실 persistence / schema** — §5 게이트 (DB schema). 본 client 는 GithubAdapter 의 기존 `PermissionDeniedEmitter` port (default no-op) 를 바꾸지 않는다. emit 실 영속화는 별도 §5 task.
- **live-run (실 GitHub token + 실 네트워크)** — §5 credential 게이트 (ADR-0017 chain row 3 live 단계). 본 task 는 mocked fetch + fake-encrypted-token fixture 만. 실 token 으로 block 하지 않는다.
- **새 외부 dependency 추가** — octokit/axios/node-fetch 금지. Node 내장 fetch (GithubAdapter 가 이미 @Optional 주입) + 기존 `LlmApiKeyCipher` (ADR-0014) 재사용.
- **GitHub token 전용 master key (GITHUB_TOKEN_ENC_KEY) 신설** — 기존 `LLM_APIKEY_ENC_KEY` 를 쓰는 cipher 를 as-is 재사용 (T-0179 결정 그대로).
- **상위 평가 파이프라인 orchestration** — instance/repo 단위 skip-and-continue loop, 다중 instance 순회, since 증분 수집 등은 상위 책임. 본 task 는 단일 instance key 의 단일 endpoint 요청까지만.
- **rate-limit backoff / Retry-After 구현** — adapter 의 429→rate-limited 매핑은 본 client 가 그대로 전파만 (backoff 미구현).
- **ConfluenceAdapter 관련 일체** — 별도 adapter, 별도 task.
- **GithubModule 의 AppModule 등록 여부 변경** — 기존 등록 상태 유지 (필요 시 Follow-up).
- **doc-sync** (modules.md / api.md 의 instance client 반영) — 별도 direct doc task 로 분리 가능 (cap 보호).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0017 가 이미 config source + JIT decrypt + adapter wire 설계를 박제했고 본 task 는 그 구현 orchestration 일 뿐).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 추가)
