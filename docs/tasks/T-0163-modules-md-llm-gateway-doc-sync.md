---
id: T-0163
title: modules.md LlmModule 행 milestone-1 gateway/adapter 구현 doc-sync (P4 milestone-1 backbone 박제)
phase: P4
status: DONE
completedAt: 2026-06-02T13:21:00+09:00
commitMode: direct
coversReq: [REQ-099, REQ-101, REQ-102, REQ-103]
estimatedDiff: 18
estimatedFiles: 1
created: 2026-06-02
plannerNote: "P4 milestone-1 종결 후 doc-sync (T-0162 Follow-up chain #4). modules.md LlmModule 행이 P2 추상화 수준 stale — LlmHttpGateway service + 5 adapter + interface 미박제. direct doc-only dep0. issue-still-relevant: origin/main modules.md grep 0 확인 (stale 실재)."
---

# T-0163 — modules.md LlmModule 행 milestone-1 gateway/adapter 구현 doc-sync

## Why

P4 milestone-1 (LLM provider HTTP gateway) 의 adapter+gateway+routing backbone 이 전부 merged 됐다 — `LlmApiKeyCipher`(T-0147) + write CRUD(POST T-0149 / PATCH T-0151 / DELETE T-0150) + `LlmGateway` interface(T-0135) + `LlmHttpGateway` orchestration service(T-0156) + 5 provider adapter 순수 함수(azure_openai T-0155 / openai-compatible custom·openai T-0157 / anthropic T-0159 / google_gemini T-0161) + 5-provider routing dispatch(T-0158 azure/custom/openai + T-0160 anthropic + T-0162 google_gemini). 그러나 [modules.md](../architecture/modules.md) L37 의 **LlmModule 행은 여전히 P2 시절의 추상 추상화 수준**("5 provider 의 단일 추상화 gateway … provider 별 HTTP client 로 라우팅") 에 머물러 있어, 구현된 구체 class(`LlmHttpGateway` service / `src/llm/providers/*.adapter.ts` 5 adapter / `LlmGateway` interface / `LlmApiKeyCipher` / write CRUD controller)가 미박제다. 같은 표의 UserModule 행(L34)은 구현 service/controller/DTO class 를 task ID 와 함께 상세 박제한 것과 대조적이다. 이 doc-sync 는 T-0162 Follow-up chain #4 ("api.md / modules.md gateway doc-sync, direct, 순수 문서 정합 — §5 미발화")가 명시적으로 예고한 작업이다. **make-work 아님** — issue-still-relevant pre-check 결과 origin/main 의 modules.md 에 `LlmHttpGateway`/adapter 언급 0 (grep -c empty) 으로 stale 이 실재함을 확인했다. api.md 는 이미 `/api/llm/*` HTTP endpoint(GET/POST/PATCH/DELETE providers, difficulty-mappings)를 박제하고 있으나, `LlmHttpGateway` 는 HTTP endpoint 가 아닌 **평가 파이프라인이 호출할 내부 gateway service** 라 REST endpoint 문서(api.md)가 아닌 module 책임 문서(modules.md)가 정확한 박제 위치다.

## Required Reading

- `D:\Assessment-Agent\docs\architecture\modules.md` — **본 task 가 수정할 파일**. L30~40 의 8-module 표에서 L37 LlmModule 행 1줄만 갱신 대상. L34 UserModule 행이 구현 class 를 task ID 와 함께 박제한 형식이 본 갱신의 mirror 기준(서술 밀도·task ID 인용 방식). L174 "LLM Gateway | LlmModule | 1:1. 5 provider 추상화 service 1 개." 행도 milestone-1 구현 반영 여부 확인(필요 시 동일 commit 1줄 보강 — gateway service class 명 박제).
- `D:\Assessment-Agent\src\llm\llm-http-gateway.service.ts` — 박제할 gateway service 의 실제 책임(repository.findById raw row → cipher.decrypt → provider 별 build/parse dispatch → 주입 fetch → LlmGenerateResult). 정확한 클래스명·메서드명 인용용.
- `D:\Assessment-Agent\src\llm\llm-gateway.interface.ts` — `LlmGateway` interface + `LlmProvider` enum(azure_openai/custom/openai/anthropic/google_gemini) + `LlmGenerateResult` 타입 박제. 5 provider enum 값 정확히 인용.
- `D:\Assessment-Agent\src\llm\providers` 디렉토리 — 5 adapter 파일명(azure-openai.adapter.ts / openai-compatible.adapter.ts / anthropic.adapter.ts / google-gemini.adapter.ts) 확인. 박제 시 파일명 정확히.

## Acceptance Criteria

변경 파일 1(`docs/architecture/modules.md` 만). 순수 문서 정합 — production code / test / config 변경 0.

- [ ] modules.md L37 LlmModule 행의 "책임" 칸을 milestone-1 구현 반영으로 갱신 — 다음을 task ID 인용과 함께 박제(UserModule 행 L34 의 서술 밀도 mirror): `LlmHttpGateway` orchestration service(`implements LlmGateway`, T-0156 — config lookup → `LlmApiKeyCipher` decrypt → provider 별 adapter build/parse dispatch → 주입 fetch → `LlmGenerateResult`) + `LlmGateway` interface + `LlmProvider` enum 5 값(azure_openai/custom/openai/anthropic/google_gemini, T-0135) + 5 provider adapter 순수 함수(`src/llm/providers/{azure-openai,openai-compatible,anthropic,google-gemini}.adapter.ts`, T-0155/T-0157/T-0159/T-0161) + routing dispatch(T-0158/T-0160/T-0162) + `LlmApiKeyCipher`(AES-256-GCM envelope encrypt-at-rest, T-0147) + write CRUD controller(POST/PATCH/DELETE /api/llm/providers, Admin+ RBAC, T-0149/T-0151/T-0150). 기존 추상 서술(provider API 차이 은닉 / 평가 파이프라인은 본 module 만 호출)은 보존.
- [ ] **실 LLM 통합 미완 명시** — 본 행 갱신 시 "실 endpoint 호출의 평가 파이프라인 연결(실 credential·env 주입·실 HTTP)은 §5 HITL 게이트로 미착수" 한 줄을 박제(현 상태가 unit-level dispatch 까지임을 doc reader 에게 명확히 — 과대 박제 방지).
- [ ] L174 component-module 매핑 행("LLM Gateway | LlmModule | 1:1.")이 milestone-1 구현과 정합하는지 확인 — gateway service class 명(`LlmHttpGateway`) 1줄 보강이 가치 있으면 동일 commit 에서 처리, 불요면 그대로 둠(판단을 task 본문에 명시).
- [ ] L37 의 "관련 REQ" 칸이 REQ-099/REQ-101~103(5 provider 추상화 + Admin 모델 지정) 와 정합하는지 확인 — 기존 REQ-049/REQ-051~055 표기가 docs/requirements.md 의 현 REQ ID 와 어긋나면 align(단순 표기 정합, 새 REQ 신설 금지).
- [ ] 변경은 modules.md 1파일 내 표 행 inline 수정에 한정 — 새 섹션 신설 0, mermaid diagram 변경 0(L37 1행 + 선택적 L174 1행만).

## Out of Scope

- **production code / test / config 변경** — 본 task 는 doc-only direct. `src/llm/*` 어떤 파일도 수정 0. tester 미호출(R-110/R-112 doc-only 비적용).
- **api.md 변경** — `/api/llm/*` HTTP endpoint 는 api.md 에 이미 박제됨(GET/POST/PATCH/DELETE providers + difficulty-mappings, T-0140/T-0142/T-0149/T-0151/T-0150/T-0139). `LlmHttpGateway` 는 HTTP endpoint 가 아닌 내부 gateway service 라 api.md 대상 아님. api.md 추가 변경 0.
- **새 architecture 문서 신설 / components.md·overview.md 변경** — modules.md 1파일만. gateway 의 sequence/components 상세는 P5 평가 파이프라인 진입 시 별도 task.
- **실 LLM 통합 / DifficultyMapping ↔ provider routing 문서화** — 미구현 기능이라 doc-sync 대상 아님(§5 게이트 통과 후 구현되면 그때 박제). 본 task 는 현재 merged reality 만 정합.
- **mermaid dependency graph 갱신** — LlmModule 의 import 관계(leaf, 외부 LLM HTTPS 만)는 milestone-1 으로 변하지 않음(adapter/gateway 모두 module 내부). diagram 변경 0.

## Suggested Sub-agents

`implementer` (doc-only — modules.md 표 행 inline 수정. architect 불요: milestone-1 구현이 이미 merged 박제 완료, 본 task 는 그 reality 를 doc 에 반영하는 순수 정합. tester 불요: doc-only direct, 실행 가능 코드 0.)

## Follow-ups

(생성 시 비어 있음. sub-agent 가 발견 시 append:)

- (chain — §5 게이트) milestone-1 실 LLM 통합 — `LLM_APIKEY_ENC_KEY` env 주입 + 실 endpoint 호출을 평가 파이프라인(AssessmentModule)에 연결 + smoke/e2e. 사용자 승인 필수(새 credential·실 HTTP). **본 doc-sync merge 후 milestone-1 dependency-free 작업은 완전 소진** — 이후 진척은 본 chain 의 §5 승인 선행 필요(driver 가 다음 planner dispatch 에서 escalate 예상).
