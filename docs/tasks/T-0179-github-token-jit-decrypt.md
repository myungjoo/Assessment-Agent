---
id: T-0179
title: GitHub instance token JIT decrypt — _TOKEN_ENC envelope 를 호출 직전 평문화하는 helper 박제
phase: P4
status: PENDING
commitMode: pr
coversReq: [REQ-005, REQ-006, REQ-007, REQ-008, REQ-044]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-06-03
plannerNote: P4 milestone-3 / ADR-0017 chain row2(token JIT decrypt) — 기존 ADR-0014 cipher 재사용, dep0/schema0/credential0, §5 미발화(이미 결정된 사항 구현)
---

# T-0179 — GitHub instance token JIT decrypt helper

## Why

[ADR-0017](../decisions/ADR-0017-github-instance-config-source.md) 의 "후속 task chain" 표 row 2 (token JIT decrypt) 를 구현한다. T-0178 이 박제한 `resolveGithubInstances` 는 각 instance 의 `tokenEnc` 를 **encrypted-at-rest envelope 문자열 그대로** 보관한다([github-instance-config.ts](../../src/github/github-instance-config.ts) L42–43). GithubAdapter 는 평문 token 을 `GithubRequestInput.token` 인자로만 받는다([github-adapter.service.ts](../../src/github/github-adapter.service.ts) L22–23). 이 둘 사이의 **JIT decrypt 경계** — HTTP 호출 직전에만 envelope 을 [ADR-0014](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) cipher 로 복호화해 평문 token 을 공급하고, 복호 결과는 응답/로그/직렬화 어디에도 노출하지 않는(never-read-back, in-memory transient) — 순수 helper 를 박제한다. README L7–18 (GitHub 3 instance 활동 평가, REQ-005~008) + L19–22 (instance 권한 분리, REQ-044) 의 token 공급 경로를 완성한다.

본 slice 가 dependency-free / §5 미발화인 근거 (CLAUDE.md §5 "ADR-NN로 이미 결정된 사항의 구현"):
- **새 외부 dependency 0** — 기존 [LlmApiKeyCipher](../../src/llm/llm-apikey-cipher.service.ts) (Node 내장 `crypto`) 를 그대로 재사용. `pnpm add` 0.
- **DB schema 변경 0** — token 은 env (`GITHUB_<KEY>_TOKEN_ENC`) 에서 오며 DB 영속 없음.
- **새 credential / 새 secret·auth 모델 0** — master key 는 기존 `LLM_APIKEY_ENC_KEY` 를 재사용한다 (cipher 는 평문 내용과 무관하게 AES-256-GCM envelope 을 복호화하므로 GitHub token envelope 도 동일 키로 복호 가능 — ADR-0017 Decision §3 의 "master key 재사용 여부" 를 본 task 가 **재사용 채택** 으로 확정). 새 env key 신설 없음 → ADR-0014 amendment 불요. 실 token (실 암호문) 주입은 본 task 가 다루지 않으며 후속 live-run task (§5 credential 게이트) 로 deferred.

## Required Reading

- [docs/decisions/ADR-0017-github-instance-config-source.md](../decisions/ADR-0017-github-instance-config-source.md) — 특히 Decision §3 (token-at-rest 위상 + JIT decrypt + master key 재사용 결정 deferral) + "후속 task chain" 표 row 2.
- [docs/decisions/ADR-0014-llm-api-key-encryption-at-rest.md](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) — §1 AES-256-GCM envelope / §3 never-read-back (본 helper 가 재사용하는 cipher 계약).
- [src/llm/llm-apikey-cipher.service.ts](../../src/llm/llm-apikey-cipher.service.ts) — `LlmApiKeyCipher.decrypt(envelope)` + `resolveKey()` (재사용 대상 — `ENC_KEY_ENV = "LLM_APIKEY_ENC_KEY"` 하드코드, 키 부재/길이미달/깨진 envelope fail-fast).
- [src/github/github-instance-config.ts](../../src/github/github-instance-config.ts) — `GithubInstanceConfig` (특히 `tokenEnc` 필드) — 본 helper 의 입력 source.
- [src/github/github-request.builder.ts](../../src/github/github-request.builder.ts) L31–49 — `GithubRequestInput.token` (평문 token 인자 — 본 helper 의 출력 소비처).
- [src/github/github-adapter.service.ts](../../src/github/github-adapter.service.ts) L21–25 — 책임 경계 주석 (token JIT decrypt 가 본 slice 밖이라 명시된 부분 — 본 task 가 채운다).
- [src/llm/llm-apikey-cipher.service.spec.ts](../../src/llm/llm-apikey-cipher.service.spec.ts) — cipher spec 의 env 주입 / fail-fast 패턴 (colocated spec 작성 참조).

## Acceptance Criteria

구현 위치 (colocated spec ordering — colocated 우선):
- 신규 helper 모듈 `src/github/github-token-decrypt.ts` — `LlmApiKeyCipher` 를 인자/주입으로 받아 `GithubInstanceConfig.tokenEnc` 를 평문 token 으로 복호화하는 순수/얇은 helper. 함수형 또는 `@Injectable` 둘 중 기존 milestone-3 패턴 (예: github-request.builder 는 순수 함수, github-adapter 는 service) 과 정합하게 선택하되, **decrypt 호출은 HTTP 호출 직전에만 일어나도록** 설계 (eager 전체 복호화 금지 — never-read-back 정합). cipher 는 생성자/인자 주입으로 받아 unit 에서 mock 가능하게 한다.
- colocated spec `src/github/github-token-decrypt.spec.ts`.

검증 항목:
- [ ] `pnpm lint` 통과.
- [ ] `pnpm build` 통과.
- [ ] **Happy-path unit test 1+** — 유효 envelope (cipher.encrypt 로 만든 round-trip 값) 를 helper 에 넣으면 평문 token 이 반환됨. cipher 를 mock (또는 실 cipher + test 키) 으로 주입.
- [ ] **Error path unit test 1+** — cipher.decrypt 가 throw (변조 envelope / 잘못된 키 / 깨진 base64) 하면 helper 가 swallow 하지 않고 그대로 전파함을 검증. token 평문이 error message 에 노출되지 않음도 함께 검증.
- [ ] **Flow / branch cover** — helper 안 분기마다 test 분리 (예: 빈/공백 `tokenEnc` 입력 방어 분기를 둔다면 그 분기 1+ test; 분기를 두지 않으면 본 항목은 "분기 없음 — 생략" 으로 명시).
- [ ] **Negative cases 충분 cover (예외 상황 분기마다 1+)** — (a) `tokenEnc` 가 빈 문자열/공백-only/undefined 인 입력, (b) `LLM_APIKEY_ENC_KEY` env 부재로 `resolveKey()` 가 throw 하는 경로, (c) envelope 길이 미달 (깨진/잘린 base64), (d) auth tag mismatch (변조) — 각 1+ test. 단일 negative 만 작성 금지.
- [ ] **never-read-back / secret 비노출 검증** — 복호된 평문 token 이 helper 의 반환값 외에 로그/직렬화/error message 어디에도 실리지 않음을 test 로 확인 (token 평문 문자열이 error.message 에 포함되지 않음을 assert).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). 신규 helper 파일은 가급적 100% cover.
- [ ] **token 실값 0** — 코드/spec/주석 어디에도 실 GitHub token 또는 실 암호문을 적지 않는다 (CLAUDE.md §9). test 는 cipher.encrypt 로 생성한 test fixture envelope 또는 mock 만 사용.

## Out of Scope

- **GithubAdapter / GithubModule 으로의 실 wire** — 본 task 는 helper + spec 박제까지만. helper 를 adapter 호출 path (instance config 순회 → decrypt → `GithubRequestInput.token` 주입) 에 실제로 배선하는 것은 상위 orchestrator / 평가 파이프라인 slice 책임 (후속 task). 본 task 는 GithubModule provider 배선을 바꾸지 않는다.
- **token 전용 master key (`GITHUB_TOKEN_ENC_KEY`) 신설** — 본 task 는 기존 `LLM_APIKEY_ENC_KEY` 재사용으로 확정. 전용 키 분리는 ADR-0014 amendment 가 필요한 별도 결정 (ADR-0017 Decision §3 / ADR-0014 "향후 재검토 조건" iii) — 본 task 에서 하지 않는다.
- **`LlmApiKeyCipher` 의 일반화/리네이밍** — cipher 는 평문 내용과 무관하게 envelope 을 복호화하므로 as-is 재사용 가능. cipher 파일 자체를 수정하지 않는다 (GitHub 용 일반화는 불요 — 만약 cipher 를 `src/llm/` 밖으로 옮기거나 rename 하고 싶으면 그것은 별도 refactor task 의 Follow-up).
- **실 token 주입 / live smoke·e2e** — 실 GitHub token 을 암호화한 `_TOKEN_ENC` env 주입 + 실 네트워크 검증은 §5 credential 게이트 (ADR-0017 chain row 3 GitHub live-run). 본 task 는 mock/fixture envelope 만.
- **PermissionDeniedRecord entity persistence** — §5 schema 게이트, 별도 task.
- **ConfluenceAdapter token decrypt** — 별도 adapter, 별도 task.

## Suggested Sub-agents

`implementer → tester` (새 ADR 결정 없음 — ADR-0014/0017 이 이미 박제. architect 불요).

## Follow-ups

(비어있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
