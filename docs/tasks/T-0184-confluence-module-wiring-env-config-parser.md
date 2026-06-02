---
id: T-0184
title: ConfluenceModule wiring + env→instance config 순수 함수 parser
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-010, REQ-015, REQ-016, REQ-044]
dependsOn: [T-0183]
estimatedDiff: 285
estimatedFiles: 5
created: 2026-06-03
plannerNote: P4 milestone-3 — ADR-0018 후속 chain row1 (ConfluenceModule wiring + env config parser, dep0/schema0/§5 미발화, T-0178 mirror)
---

# T-0184 — ConfluenceModule wiring + env→instance config 순수 함수 parser

## Why

P4 milestone-3 (Confluence adapter, [Q-0017](../STATE.json) 승인) 의 다음 dependency-free slice 다. 현재 `src/confluence/` 디렉토리 자체가 존재하지 않는다 — milestone-1 LlmModule 및 milestone-3 GithubModule 가 `src/llm/` / `src/github/` 으로 박제된 패턴을 mirror 해서 ConfluenceModule scaffold 의 출발점을 만든다. [ADR-0018](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) 후속 chain row 1 (ConfluenceModule wiring + env config parser) 이 본 task 다.

본 task 는 [ADR-0018](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) Decision §2 의 env shape ([ADR-0017](../decisions/ADR-0017-github-instance-config-source.md) enumerable key 패턴 차용 — `CONFLUENCE_INSTANCES` + per-key `_BASE_URL` / `_AUTH_USER` / `_TOKEN_ENC` / `_SPACE_ALLOWLIST`) 를 순수 함수 parser 로 코드 박제하고, `ConfluenceModule` NestJS module 을 만들어 후속 chain (token JIT decrypt → request builder → service dispatch → pagination → SpaceTraversalService → roundtrip smoke) 의 wiring 골격을 둔다. README L9~22 의 Confluence 지정 Service / 다중 SPACE 활동 평가 (REQ-009 / REQ-010 / REQ-015) 와 권한 부족 가시화 (REQ-016 / REQ-044) 의 설정 경로가 코드 레벨에서 활성화된다.

새 외부 dependency 0 (`process.env` 는 Node 표준 — `pnpm add` 0), schema 변경 0, 실 token / credential 0 (env 이름·shape 만 다룸 — 실값 미기재, [CLAUDE.md §9](../../CLAUDE.md)) → [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 미발화. 본 task 는 [T-0178](T-0178-github-module-wiring-env-config-parser.md) (GithubModule wiring) 의 직접 mirror — GitHub 측 5 파일 / +285 LOC / PR-162 1-round APPROVE precedent 의 Confluence reframe.

## Required Reading

- `docs/decisions/ADR-0018-confluence-adapter-http-transport-contract.md` — Decision §1 (내장 fetch transport) / **Decision §2 (env shape: `CONFLUENCE_INSTANCES` + per-key `_BASE_URL` / `_AUTH_USER` / `_TOKEN_ENC` / `_SPACE_ALLOWLIST` — 본 task 가 코드로 박제할 5 env 변수)** / Decision §3 (`AUTH_USER` 존재 여부로 Cloud Basic / Server Bearer 분기 — 본 task 는 변수 shape 만, 실 분기 builder 는 후속 task) / Decision §6 4 단 경계 ("module 위치 `src/confluence/`, adapter leaf") / "후속 task chain" 표 row 1 (본 task = ConfluenceModule wiring + env config parser, token JIT decrypt 는 row 2 = 별도 task)
- `docs/decisions/ADR-0017-github-instance-config-source.md` — Decision §1 (env source) / §2 (enumerable key + per-key suffix 명명 규약) / §3 (순수 함수 parser 경계 + fail-fast + missing/malformed 방어). 본 ADR 이 Confluence 측에서 차용할 reference (ADR-0018 Decision §2 가 verbatim 정합)
- `src/github/github-instance-config.ts` (146 LOC) — `resolveGithubInstances(env: NodeJS.ProcessEnv): GithubInstanceConfig[]` 순수 함수 + 부수효과 0 + fail-fast + missing/malformed 진단 + `GITHUB_INSTANCES_ENV` 상수 + per-key suffix 조립 helper. **본 task 의 `resolveConfluenceInstances` 가 직접 mirror 할 reference 구현.**
- `src/github/github-instance-config.spec.ts` (328 LOC) — 위 순수 함수의 R-112 happy/error/branch/negative 4 종 cover spec. **본 task 의 colocated spec 이 직접 mirror 할 reference test.**
- `src/github/github.module.ts` (43 LOC) — `@Module` 로 `GithubAdapter` 를 provide + export 하는 NestJS module 의 최소 형태. **본 task 의 `ConfluenceModule` 이 mirror 할 reference (단 ConfluenceAdapter 는 후속 task 라 아직 provide 불가 — 대신 parser 결과를 module-level provider 로 노출하거나 module shell 만 두고 후속 task 가 provider 추가).**
- `src/github/github.module.spec.ts` (72 LOC) — module compile + provider resolve + export 정합 검증. **본 task 의 colocated module spec 이 mirror 할 reference.**
- `src/llm/llm-live-test-gating.ts` — `resolveLiveTestGating(env: NodeJS.ProcessEnv)` 순수 함수 + `isPresent` guard + missing 진단 reason 패턴 (Github 측이 차용한 milestone-1 의 원형 reference, 참고만)
- `src/auth/auth.module.ts` — `@Module` + `process.env` 직접 read NestJS module env-source 선례 (참고만)
- `src/app.module.ts` — `imports: [PersistenceModule, UserModule, AuthModule, LlmModule, GithubModule]` 배열에 `ConfluenceModule` 을 추가할 정확한 위치. 주석 1 줄 (T-0184 / REQ-009 / ADR-0018) 추가.
- `scripts/check-spec-presence.sh` — 신규 production `.ts` 의 colocated spec 동반 의무 (CI 강제) 확인

## Acceptance Criteria

구현 산출물 (≤ 5 파일, ≤ ~300 LOC):

1. **`src/confluence/confluence-instance-config.ts` (신규)** — [ADR-0018 Decision §2](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) 의 env→instance config 변환 순수 함수.
   - env 키 이름 상수 박제: `CONFLUENCE_INSTANCES_ENV` (= `"CONFLUENCE_INSTANCES"`) + per-key suffix 상수 (`_BASE_URL` / `_AUTH_USER` / `_TOKEN_ENC` / `_SPACE_ALLOWLIST`) 또는 key 별 변수 이름 조립 helper. **실값 0 — 이름 상수만** ([CLAUDE.md §9](../../CLAUDE.md)).
   - `ConfluenceInstanceConfig` interface (export): `{ key: string; baseUrl: string; authUser: string | null; tokenEnc: string; spaceAllowlist: string[] }`. 필드 의미:
     - `baseUrl` — Cloud (`https://<workspace>.atlassian.net/wiki/rest/api`) 또는 Server (`https://<host>/rest/api`) 의 풀 URL (ADR-0018 Decision §2 풀 URL 박제).
     - `authUser` — Cloud Basic 의 email/계정명 (env non-empty 시), Server Bearer 의 경우 `null` 또는 빈 문자열 (env 미정의·빈/공백 시) — ADR-0018 Decision §3 scheme 분기 입력. parser 가 빈/공백 normalization 후 `null` 로 통일 (또는 일관된 sentinel — 구현이 결정하되 spec 으로 검증).
     - `tokenEnc` — encrypted-at-rest envelope 문자열 ([ADR-0014](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md)). 본 task 는 decrypt 안 함, 그대로 보관 (chain row 2 책임).
     - `spaceAllowlist` — comma-separated SPACE key 목록을 split + trim 한 배열 ([ADR-0013 §2](../decisions/ADR-0013-confluence-space-traversal-policy.md) allowlist 정합). 빈 배열 허용 여부는 ADR-0018 정합으로 구현 결정 후 그 분기 spec 으로 cover.
   - `resolveConfluenceInstances(env: NodeJS.ProcessEnv): ConfluenceInstanceConfig[]` — `CONFLUENCE_INSTANCES` comma-separated key list 를 파싱 → 각 key 마다 `CONFLUENCE_<KEY 대문자>_BASE_URL` / `_AUTH_USER` / `_TOKEN_ENC` / `_SPACE_ALLOWLIST` 를 read → config 객체 배열로 변환. 부수효과 0 / 외부 의존 0 ([github-instance-config.ts](../../src/github/github-instance-config.ts) 의 `resolveGithubInstances` 직접 mirror).
   - **fail-fast / malformed 방어** ([ADR-0017 Decision §3](../decisions/ADR-0017-github-instance-config-source.md) verbatim 차용):
     - `CONFLUENCE_INSTANCES` 부재 / 빈 / 공백-only → 빈 배열 반환 (또는 명확한 처리 — 구현이 선택하되 일관, spec 으로 검증).
     - 열거된 key 의 `_BASE_URL` 또는 `_TOKEN_ENC` 부재 / 빈 / 공백 → 해당 instance reject (throw 또는 skip + 진단 — `github-instance-config.ts` 와 동일 방침 채택). 평문 fallback / 빈 URL fallback 금지.
     - `_SPACE_ALLOWLIST` 다중 값은 comma-separated split + trim, 빈 entry 제거.
     - `_AUTH_USER` 부재 / 빈 / 공백-only → `null` 또는 빈 문자열로 normalize (Server Bearer 분기를 위한 sentinel — ADR-0018 Decision §3 입력).
     - 진단 메시지 / throw 메시지에는 **어느 env 변수가 부재했는지 이름만** 박제 (실값 / decrypted token / Authorization header 직렬화 금지, [CLAUDE.md §9](../../CLAUDE.md)).

2. **`src/confluence/confluence-instance-config.spec.ts` (신규, colocated)** — 위 순수 함수의 R-112 4 종 cover (아래 test 요구 항목 참조). [github-instance-config.spec.ts](../../src/github/github-instance-config.spec.ts) 의 describe/it 구조를 Confluence 변수명으로 reframe.

3. **`src/confluence/confluence.module.ts` (신규)** — `@Module` 로 ConfluenceModule shell 박제.
   - 본 task 에서는 ConfluenceAdapter 가 아직 존재하지 않으므로 (chain row 3 책임), module 의 providers / exports 는 **본 task 범위에서 의미 있는 단위만** 박제: 예를 들어 `resolveConfluenceInstances` 결과를 NestJS `Provider` (예: `ConfluenceInstancesProvider` token + `useFactory` 로 `process.env` 기반 instantiate) 로 노출 + export, 또는 module shell 만 두고 후속 task 가 ConfluenceAdapter / SpaceTraversalService provider 를 추가하도록 design.
   - **token JIT decrypt 호출은 본 task 에 넣지 않는다** (ADR-0018 chain row 2 = 별도 task).
   - **`ConfluenceAdapter` provider 도 본 task 에 넣지 않는다** (ADR-0018 chain row 3 = 별도 task).
   - `PersistenceModule` dep 불요 (Confluence adapter 계층은 Prisma 미사용 — ADR-0018 Decision §6 adapter leaf).

4. **`src/confluence/confluence.module.spec.ts` (신규, colocated)** — [llm.module.spec.ts](../../src/llm/llm.module.spec.ts) / [github.module.spec.ts](../../src/github/github.module.spec.ts) mirror — module compile happy-path + 본 module 이 export 하는 provider (instances provider 가 있다면 그것, 없으면 module 컴파일 자체) resolve + export 정합 검증.

5. **`src/app.module.ts` (수정)** — `imports` 배열에 `ConfluenceModule` 추가 + 주석 1 줄 (T-0184 / REQ-009 / ADR-0018). 기존 `GithubModule` 주석 패턴과 일관 (한국어, ≤ 2 줄).

테스트 요구 (R-112 — `commitMode: pr` 코드 task 의무, [CLAUDE.md §3.2](../../CLAUDE.md)):

- [ ] **Happy-path unit test**: `resolveConfluenceInstances` 가 정상 env (예: `CONFLUENCE_INSTANCES=cloud,internal` + 각 key 의 4 변수 set) 를 받아 2 개 config 객체 배열을 정확히 반환 (`baseUrl` / `authUser` / `tokenEnc` / `spaceAllowlist` 매핑 정확). `ConfluenceModule` compile happy-path 1+ — provider 가 있다면 resolve + 없다면 module 자체 compile 검증.
- [ ] **Error path unit test**: 열거된 key 의 `_BASE_URL` 부재 / `_TOKEN_ENC` 부재 시 reject (throw 또는 skip + 진단) — 평문/빈/공백 fallback 안 함을 검증. `_BASE_URL` 이 빈 문자열인 경우와 정의 자체가 없는 경우를 각각 cover.
- [ ] **Flow / branch coverage**: parser 의 각 분기 cover —
  1. `CONFLUENCE_INSTANCES` 부재 분기 (undefined 입력 → 빈 배열)
  2. `CONFLUENCE_INSTANCES` 빈/공백-only 분기
  3. `_SPACE_ALLOWLIST` 다중 값 comma split 분기 (예: `"DEV,DOCS,RND"`)
  4. `_SPACE_ALLOWLIST` 단일 값 분기 (예: `"DEV"`)
  5. `_SPACE_ALLOWLIST` 빈/미정의 분기 (빈 배열 또는 spec 으로 박제한 일관된 처리)
  6. `_AUTH_USER` non-empty 분기 (Cloud Basic 의도) — `authUser` 가 그 값으로 박제
  7. `_AUTH_USER` 빈/공백/미정의 분기 (Server Bearer 의도) — `authUser` 가 `null` 또는 sentinel
  8. 부분-set (일부 key 만 완전 — 나머지는 missing) 분기
  각 1+ test.
- [ ] **Negative cases 충분 cover** (예외 상황 분기마다 1+):
  (a) `CONFLUENCE_INSTANCES` undefined / 빈 문자열 / 공백-only 각각,
  (b) 열거된 key 의 `_BASE_URL` 빈/공백/미정의 각각,
  (c) `_TOKEN_ENC` 빈/공백/미정의 각각,
  (d) `_SPACE_ALLOWLIST` 빈 (SPACE 0 개 허용 여부는 ADR-0018 / ADR-0013 정합으로 구현 결정 후 그 분기 cover),
  (e) key list 의 trailing comma / 중복 key / 대소문자 변형,
  (f) 열거된 key 인데 4 변수 전부 부재 (부분-set 의 극단),
  (g) `_AUTH_USER` 공백-only (Cloud Basic 의도가 아니라 Server Bearer 의도로 normalize 되는지 검증),
  (h) 진단 메시지에 실값 / token 평문 / Authorization base64 가 포함되지 않음 (`§9` 정합 가드).
  단일 negative 만 작성 금지 — 위 각각 1+ test.
- [ ] **Coverage**: `pnpm test:cov` 통과 (line ≥ 80% AND function ≥ 80%, [package.json](../../package.json) `coverageThreshold.global`). 신규 production 파일은 colocated spec 으로 high cover (parser 의 line/branch ~100% 목표 — github-instance-config.ts precedent 와 동일).
- [ ] `pnpm lint && pnpm build && pnpm test` green (tester 가 R-110 확인).
- [ ] `scripts/check-spec-presence.sh` green — 신규 production `.ts` (config + module) 가 colocated `.spec.ts` 동반.

## Out of Scope

- **token JIT decrypt** — `CONFLUENCE_<KEY>_TOKEN_ENC` 를 [ADR-0014](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) cipher 로 decrypt 해 Authorization header 에 평문 공급하는 wiring 은 **본 task 밖** ([ADR-0018](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) chain row 2 = 별도 task, [github-token-decrypt.ts](../../src/github/github-token-decrypt.ts) Confluence mirror).
- **ConfluenceAdapter request-builder / service dispatch / `_links.next` pagination / SpaceTraversalService** — ADR-0018 chain row 3~5 (별도 task 들). 본 task 는 module shell + env parser 만.
- **실 token / credential 주입** — `_TOKEN_ENC` 의 실 암호문 (실 Cloud API token / Server PAT 의 암호화 값) 주입 + 실 네트워크 live smoke 는 ADR-0018 chain row 9 = §5 credential 게이트 task. 본 task 는 env 이름·shape 만 (실값 0, [§9](../../CLAUDE.md)).
- **PermissionDeniedRecord entity / persistence** — DB schema 변경 ([§5](../../CLAUDE.md) 게이트). 본 task 밖, GitHub/Confluence 공통 후속 task.
- **token 전용 master key (`CONFLUENCE_TOKEN_ENC_KEY`) 신설 결정** — ADR-0018 Decision §6 가 `LLM_APIKEY_ENC_KEY` 재사용으로 박제. 본 task 는 새 env key 도입 0.
- **rate-limit backoff / since 증분 / orchestrator loop** — adapter 후속 slice. 본 task 밖.
- **ADR-0018 PROPOSED → ACCEPTED status 갱신** — 본 chain 완결 후 별도 direct task (ADR-0018 chain row 10).
- **`docs/architecture/modules.md` ConfluenceModule row / `p4-implementation-plan` T-0142 dependency 게이트 supersede 정합 doc-sync** — 별도 direct doc-only task (ADR-0018 chain row 7).
- **GithubModule 측 후속 슬라이스 / GitHub live-run / milestone-1 live-run** — 본 task 와 직교한 별도 chain.

## Suggested Sub-agents

`implementer → tester` (architecture 결정은 [ADR-0018](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) Decision §2/§6 이 이미 박제 — architect 불요. T-0178 GitHub 측 mirror task 도 동일한 sub-agent chain 으로 1-round APPROVE 완결한 precedent).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
