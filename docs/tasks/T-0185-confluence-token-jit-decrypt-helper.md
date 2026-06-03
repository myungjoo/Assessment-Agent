---
id: T-0185
title: Confluence instance token JIT decrypt helper 추가 (ADR-0018 chain row 2)
phase: P4
status: DONE
commitMode: pr
coversReq: [REQ-009, REQ-010, REQ-015, REQ-016]
dependsOn: [T-0184]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-03
plannerNote: P4 milestone-3 ADR-0018 chain row2 — Confluence token JIT decrypt helper(github-token-decrypt mirror), dep0/schema0/credential0/§5 미발화
prNumber: 167
mergedAs: 575b4ff
reviewRounds: 1
completedAt: 2026-06-03T11:20:54+09:00
---

# T-0185 — Confluence instance token JIT decrypt helper 추가

## Why

[ADR-0018](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) 의 "후속 task chain" 표 **row 2 (Confluence token JIT decrypt helper)** 를 구현한다. T-0184 (chain row 1) 가 `resolveConfluenceInstances` 순수 parser 를 박제하면서 `ConfluenceInstanceConfig.tokenEnc` 를 **암호문 그대로** 보관(decrypt 안 함)했고, 본 task 가 그 암호문 envelope 을 HTTP 호출 직전에만 평문 token 으로 JIT decrypt 하는 helper 를 추가한다 — [ADR-0018 Decision §6 token JIT decrypt 위상](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) + [ADR-0014](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) cipher(`LlmApiKeyCipher` + `LLM_APIKEY_ENC_KEY`) 재사용. milestone-3 GitHub 측 동형 helper [src/github/github-token-decrypt.ts](../../src/github/github-token-decrypt.ts) (T-0179) 의 **직접 mirror** 다. 이는 REQ-009/010/015 (지정 Confluence Service 내 다중 SPACE 활동 평가) 의 transport-층 auth 선행 primitive 이자, REQ-016 (권한 가시화) 의 token-무효 분기 입력이다.

본 task 는 ADR-0017/0018 가 이미 결정한 사항의 **구현**이므로 [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 미발화 — 새 외부 dependency 0 (`pnpm add` 0, Node 내장 crypto 를 쓰는 기존 cipher 재사용), DB schema migration 0, 실 credential 0 (mocked cipher unit test).

## Required Reading

- `docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` — Decision §6 (token JIT decrypt 위상 + never-read-back) + "후속 task chain" 표 row 2. (본 task 의 결정 source)
- `src/github/github-token-decrypt.ts` — **직접 mirror 대상** (T-0179). `decryptGithubInstanceToken(cipher, tokenEnc)` + `decryptGithubInstanceConfigToken(cipher, instance)` overload 구조 / 빈·공백 fail-fast / cipher.decrypt 위임 / never-read-back 주석을 Confluence 도메인으로 그대로 옮긴다.
- `src/github/github-token-decrypt.spec.ts` — **mirror 대상 spec** (happy / error / 방어 분기 / never-read-back 케이스 구성을 그대로 따라간다).
- `src/confluence/confluence-instance-config.ts` — `ConfluenceInstanceConfig` interface (`tokenEnc: string` 필드) — overload helper 의 인자 타입 source. (이미 main 박제, 수정 금지)
- `src/llm/llm-apikey-cipher.service.ts` — `LlmApiKeyCipher.decrypt(envelope: string): string` 시그니처 + `LLM_APIKEY_ENC_KEY` env. (재사용 cipher — 수정 금지)

## Acceptance Criteria

- [ ] `src/confluence/confluence-token-decrypt.ts` 신설 — 다음 2 함수를 export:
  - `decryptConfluenceInstanceToken(cipher: LlmApiKeyCipher, tokenEnc: string | undefined): string` — 빈/공백-only/undefined tokenEnc 면 평문/빈 fallback 없이 fail-fast throw (cipher 호출 전 차단, 진단 메시지에 token 평문 미포함), 유효 envelope 면 `cipher.decrypt(tokenEnc)` 위임. cipher 의 throw 는 swallow 하지 않고 그대로 전파.
  - `decryptConfluenceInstanceConfigToken(cipher: LlmApiKeyCipher, instance: ConfluenceInstanceConfig): string` — 편의 overload, `instance.tokenEnc` 를 위 함수로 위임.
- [ ] 복호된 평문 token 은 **반환값으로만** 노출 — 로그 / 직렬화 / error message 어디에도 평문을 싣지 않는다 (never-read-back, [ADR-0014 §3](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) / [CLAUDE.md §9](../../CLAUDE.md)). 파일 상단 주석에 보안 invariant 명시.
- [ ] cipher 는 **함수 인자로 주입**받아 unit 에서 mock 가능 (DI / 함수 인자 둘 다 수용 — github-token-decrypt mirror). 본 helper 는 `LlmApiKeyCipher` 를 직접 new 하지 않는다.
- [ ] `src/confluence/confluence-token-decrypt.spec.ts` colocated spec 신설 (NestJS convention + R-112 colocated ordering). 다음 R-112 4 종 + negative cases 충분 cover:
  - happy-path 1+ — 유효 envelope 을 mock cipher 가 평문으로 복호화해 반환값이 평문과 일치 (overload 두 함수 각각).
  - error path 1+ — cipher.decrypt 가 throw (env 부재 / 키 길이 미달 / 깨진 base64 / auth tag mismatch 시뮬레이션) 하면 helper 가 swallow 하지 않고 전파.
  - branch cover — fail-fast 분기 vs 정상 decrypt 분기 각 1+.
  - **negative cases 충분 cover (예외 상황 분기마다 1+)**: `tokenEnc` 가 (a) `undefined`, (b) 빈 문자열 `""`, (c) 공백-only `"   "` 각각에 대해 fail-fast throw 검증 + (d) overload 의 `instance.tokenEnc` 가 위 비정상값일 때도 동일 throw 검증.
  - never-read-back 검증 1+ — throw 시 error message 에 token 평문/envelope 평문이 누출되지 않음을 단언 (mock 평문 문자열이 message 에 미포함).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 helper 파일은 line/branch/function 100% 목표 (github-token-decrypt 와 동형 단순 helper 라 달성 가능).

## Out of Scope

- **ConfluenceAdapter / ConfluenceModule 으로의 실 wire** (instance config 순회 → decrypt → request-builder 의 auth header 주입) — chain row 3+ (request-builder + service dispatch) 책임. 본 task 는 helper 단독.
- **request-builder (`buildConfluenceRequest`) / Cloud Basic vs Server Bearer header 조립** — ADR-0018 Decision §3/§6 chain row 3. 본 helper 는 평문 token 을 반환만 하고 header 조립은 안 함.
- **token 전용 master key (`CONFLUENCE_TOKEN_ENC_KEY`) 신설** — ADR-0018 Decision §6 verbatim: 기존 `LLM_APIKEY_ENC_KEY` cipher 를 as-is 재사용 (ADR-0014 amendment 불요). 새 env key 도입 금지.
- **`LlmApiKeyCipher` 의 일반화/리네이밍** — cipher 는 평문 내용과 무관하게 envelope 을 복호화하므로 그대로 재사용 (cipher 파일 미수정).
- **`confluence-instance-config.ts` / `confluence.module.ts` 수정** — 이미 main 박제. 본 task 는 신규 helper 2 파일(helper + spec)만 추가.
- **PermissionDeniedRecord entity / pagination / SpaceTraversalService / live-run** — 각각 별도 chain row (row 4/5/8/9), 일부 §5 게이트.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시점)
