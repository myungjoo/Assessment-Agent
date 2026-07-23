---
id: T-1138
title: AdminView LLM provider 생성·수정 폼의 provider 입력을 5-provider select 로 constrain
phase: P6
status: DONE
mergedAs: 5fc39f33
prNumber: 1030
reviewRounds: 1
commitMode: pr
coversReq: [REQ-096, REQ-099, REQ-100, REQ-101, REQ-102, REQ-103]
estimatedDiff: 150
estimatedFiles: 2
created: 2026-07-23
independentStream: web-admin-llm
dependsOn: []
touchesFiles:
  - web/src/views/AdminView.tsx
  - web/src/views/AdminView.test.tsx
plannerNote: P6 R-96 후속 — provider free-text input 을 5-provider select 로 constrain(서비스 allowlist 정합, invalid 400 사전 차단), T-1136/T-1137 후속
---

# T-1138 — AdminView LLM provider 생성·수정 폼의 provider 입력을 5-provider select 로 constrain

## Why

T-1136/T-1137 로 AdminView 의 LLM provider CRUD(생성 POST / 수정 PATCH)가 완결됐으나,
두 폼의 `provider` 필드는 자유 입력 text input 이다. 그러나 backend 는 provider 값을
5-provider allowlist(`custom` / `azure_openai` / `anthropic` / `google_gemini` / `openai`,
`src/llm/llm-gateway.interface.ts` 의 `LlmProvider` enum, R-99~103)로 service 계층에서
검증하며(`LlmHttpGatewayService` line 138 "미지원 provider 입니다"), 허용 외 문자열은 런타임
호출 실패로 이어진다. 사용자가 오타·미지원 값을 입력해 잘못된 provider 설정을 저장하는 것을
막기 위해, 생성·수정 폼의 `provider` 입력을 5 개 지원 provider 만 선택 가능한 `<select>` 로
constrain 한다. PLAN.md P6(line 87 R-96 "Admin 이 LLM 모델 지정 UI") + P4(line 84 5-provider
추상화 R-99~103)의 UI 정합 slice.

## Required Reading

- `web/src/views/AdminView.tsx` — 생성 폼(`providerInput`/`setProviderInput`, T-1136 line 1543~1546 부근)과 인라인 수정 폼(T-1137, line 453/474 `provider:` draft)의 provider 입력 컨트롤 위치.
- `web/src/views/AdminView.test.tsx` — 기존 provider 입력 관련 vitest(생성·수정 흐름) 위치 — 본 변경이 깨는 기존 test 를 select 상호작용으로 갱신.
- `src/llm/llm-gateway.interface.ts` (line 20~26) — canonical `LlmProvider` enum 5 멤버(값 그대로 body 에 전송해야 하므로 식별자 정확성 확보용, **읽기 전용 참조** — web 은 별도 SPA 빌드라 server 코드 import 금지, web 안에 상수 배열을 새로 정의한다).
- `web/src/components/LlmProviderConfigList.tsx` — (참조만) 목록 렌더가 provider 값을 어떻게 표시하는지 확인(라벨 일관성).

## Acceptance Criteria

- [ ] AdminView 생성 폼의 `provider` text input 을 `<select>` 로 교체 — option 은 5 개 지원 provider(`custom` / `azure_openai` / `anthropic` / `google_gemini` / `openai`)만. 각 option 은 사람-친화 한국어/영문 라벨(예: `custom (OpenAI 호환)`) + value 는 canonical snake_case 식별자 그대로. placeholder(빈 value) option 1 개 선두 배치(미선택 시 생성 버튼 가드에 걸림).
- [ ] AdminView 인라인 수정 폼의 `provider` 입력도 동일 `<select>` 로 교체 — 기존 row 의 provider 값이 초기 선택값으로 반영(해당 값이 5 개 중 하나면 선택, 아니면 placeholder).
- [ ] web 안에 5-provider option 상수(예: `LLM_PROVIDER_OPTIONS`)를 새로 정의(server enum import 금지) + 주석에 canonical source(`src/llm/llm-gateway.interface.ts LlmProvider`, R-99~103) 명시.
- [ ] 기존 POST/PATCH body 조립 로직(`provider` 필드 전송)·nonce 재조회·in-flight 가드·error state 는 수정 0 — 입력 컨트롤 형태만 text→select 전환.
- [ ] apiClient/useApiResource/backend/LlmProviderConfigList 수정 0.
- [ ] happy-path test 1+ — 생성 폼 select 에서 지원 provider 선택 시 그 값이 POST body 의 `provider` 로 전달됨을 검증. 수정 폼도 동일(선택 → PATCH body 반영).
- [ ] error path test 1+ — placeholder(빈 provider) 상태로 생성 버튼 클릭 시 기존 빈/공백 가드가 그대로 발화(POST 미호출)함을 검증.
- [ ] 분기 test — (a) 수정 폼 초기값이 5 개 중 하나인 row → 그 provider 가 선택된 상태로 렌더, (b) provider 값이 목록에 없는(레거시/비정상) row → placeholder fallback. 두 분기 각 1+ test.
- [ ] negative cases 충분 cover — 지원 외 값을 select 로는 제출 불가함(option 에 없음) 검증 1+, 빈 선택 가드 1+, 수정 폼 provider 미변경 시 기존 값 유지 1+ (예외 분기마다 1+).
- [ ] `pnpm --dir web test` (vitest) 전부 pass + `pnpm --dir web build`(tsc + vite) green.
- [ ] web coverage 기존 임계 유지(회귀 없음).

## Out of Scope

- backend DTO 에 provider `@IsIn` enum 검증 추가(현 계약은 service-layer 검증 — 별도 task/Follow-up, 본 task 는 web-only).
- LlmProviderConfigList 의 provider 표시 라벨 변경(목록 렌더는 그대로).
- provider 별 필드 조건부 표시(예: azure 만 apiVersion 노출) 등 provider-specific 폼 분기 — 별도 slice.
- 새 endpoint·apiClient·backend 변경 일절 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(없음 — 생성 시 비움)
