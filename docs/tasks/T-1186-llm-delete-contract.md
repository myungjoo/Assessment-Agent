---
id: T-1186
title: LLM provider 삭제 endpoint web↔backend 계약 drift-guard spec 추가
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, REQ-096]
estimatedDiff: 220
estimatedFiles: 1
created: 2026-07-24
independentStream: web-contract-guard
dependsOn: []
touchesFiles: [web/src/views/AdminView.llm-provider-delete-contract.test.ts]
plannerNote: "P6 contract-guard arc FINAL slice — LLM provider DELETE. T-1183 part-delete + T-1184 llm-create mirror. LLM CRUD guard arc 완결."
---

# T-1186 — LLM provider 삭제 endpoint web↔backend 계약 drift-guard spec 추가

## Why

T-1185 (PR #1077 머지) 의 Out of Scope 가 예약한 LLM provider CRUD 계약 drift-guard arc 의 **마지막 slice** 다. web `runDeleteProvider` 발사가 backend `LlmProviderConfigController.delete` (`@Delete(":id")`, DELETE /api/llm/providers/:id, 204 No Content, body 부재) 계약과 drift 없이 일치함을 test-only 로 고정한다. 이 task 로 LLM provider 의 GET/POST/PATCH/DELETE 4-CRUD 계약 guard 가 모두 완결된다 (REQ-096 Admin 가시성 + REQ-051~055 config CRUD).

## Required Reading

- `web/src/views/AdminView.part-delete-contract.test.ts` — **1차 패턴 선례** (T-1183). 3-세그먼트 base 없는 `api/parts` + `@Delete(":id")` path param 합성, DELETE method, `@Body` 부재 대조, `@HttpCode` 사이 decorator 무시, 주석 false-positive 방어 (negative h) — 추출기/대조기/negative 구조를 그대로 차용.
- `web/src/views/AdminView.llm-provider-create-contract.test.ts` — **2차 패턴 선례** (T-1184). 3-세그먼트 base `api/llm/providers` 파싱 축을 차용 (본 task 의 base 와 동일).
- `web/src/views/AdminView.tsx` — `runDeleteProvider` (L1267~) + `DeleteProviderDeps` interface (L1246~). 둘 다 파일 하단에서 export 됨 (L4775 / L4817). id 는 `encodeURIComponent` 안전 인코딩, 빈/공백 id 미발사, `deleting` 가드, body 부재.
- `src/llm/llm-provider-config.controller.ts` — 대조 대상 backend. `@Controller("api/llm/providers")` (L73), `@Delete(":id")` + `@HttpCode(204)` + 핸들러 `delete(@Param("id") id: string): Promise<void>` (L164-170). `@Body` decorator **부재** (body-less). 같은 소스의 `update` 핸들러는 `@Body` 를 가짐 (대조군).

## Acceptance Criteria

신규 파일 `web/src/views/AdminView.llm-provider-delete-contract.test.ts` **1개만** 추가. 실 controller 소스를 `readFileSync` 로 로드하고, `runDeleteProvider` 를 mock deps 로 직접 호출해 실 발사 인자를 캡처 (ADR-0040 §5 — RTL/jsdom 없음). 아래 R-112 4종 + negative a~h 를 모두 cover.

- [ ] **happy-path**: `runDeleteProvider('lp-1', deps)` 발사가 `/api/llm/providers/lp-1` + DELETE method 로 backend `delete` 계약과 완전 일치 (`diffContract` 가 `[]`).
- [ ] **happy-path (body/헤더 부재)**: DELETE 발사 init 에 body 키 부재 + Content-Type 헤더 부재 검증 (T-1183/T-1174 body-less 대조 축 mirror).
- [ ] **error path (추출기 무력화 방어)**: `ROUTE`/`method` 추출이 하나도 비어있지 않음 + `subPath === ':id'` 검증. 추출 실패도 통과가 아니라 `'backend 계약 추출 실패'` 사유 1건 반환.
- [ ] **분기 — base 파싱**: `@Controller("api/llm/providers")` 를 `/api/llm/providers` 로 정규화.
- [ ] **분기 — :id 합성**: `@Delete(":id")` 세그먼트를 base 와 합성해 `/api/llm/providers/:id` template, path param 정확히 1개(`:id`) 검증. `expectedPath` 가 `/api/llm/providers/lp-1`.
- [ ] **분기 — @Body 부재 판정**: `delete` 핸들러가 body-less (`hasBody === false`) 이고, 대조군 `update` 핸들러는 `hasBody === true` (추출기가 실제로 구분함 입증).
- [ ] **분기 — id 인코딩**: 비정상 문자 id (`'lp 1/x?a'`) 가 `encodeURIComponent` 로 안전 인코딩돼 path 가 안 깨짐.
- [ ] **분기 — options → 매핑**: `options.body` 부재 시 `JSON.parse` SyntaxError 없이 빈 키 집합 + `hasContentType=false` 로 매핑.
- [ ] **negative (a) base 오타**: backend base 를 `api/llm/provider`(오타) / `api/llm/providers-x` 로 바꾸면 path 불일치로 잡힘 (404 예방).
- [ ] **negative (b) 세그먼트 추가**: `@Delete(":id/archive")` (param 2) 로 drift 시 path 불일치.
- [ ] **negative (c) bare 세그먼트 0**: `@Delete()` (세그먼트 0) 로 drift 시 path 불일치.
- [ ] **negative (d) method drift**: backend 가 `@Patch`/`@Post` 로 바뀌었는데 web 은 DELETE 발사 → method 불일치.
- [ ] **negative (e) @Body 추가 drift**: backend 가 `@Body() dto` 를 추가했는데 web 은 body 미발사 → body-less 정합 위반.
- [ ] **negative (f) 초과 body/헤더**: web 이 불필요한 body/Content-Type 을 붙이면 body-less 대조 fail (400/415 예방).
- [ ] **negative (g) encode 누락**: web 이 id 를 `encodeURIComponent` 없이 raw 삽입하면 path 불일치.
- [ ] **negative (h) 주석 false-positive**: 주석 줄의 `@Delete(":id")`/`@Controller(...)` 를 실 decorator 로 오인하지 않음 (`stripComments` 방어).
- [ ] **negative (소스 유실)**: 빈 소스 입력 시 추출기가 null/`{}` 반환하고 대조가 통과하지 않음.
- [ ] `pnpm --dir web test` (또는 web workspace vitest) 실측 통과 확인 — 위 모든 케이스 green.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). test-only 파일이라 커버리지 회귀 없음 확인.
- [ ] size gate: diff ≤ 300 LOC, 변경 파일 정확히 1개.

## Out of Scope

- production 코드 (`AdminView.tsx`, `llm-provider-config.controller.ts`) 및 기존 guard 파일 수정 **금지** — 신규 test 파일 1개만 추가.
- 신규 devDependency 추가 금지 (정규식 추출기만 — 기존 vitest 사용).
- 본 task 는 **LLM provider CRUD 계약 guard arc 를 완결**한다 (GET T-113x + POST T-1184 create + PATCH T-1185 update + DELETE 본 task). 추가 LLM CRUD guard task 는 없음.
- **shared-helper 추출 refactor 는 여전히 Out of Scope** — `stripComments`/`extractControllerRoute`/`extractHandlerMethods`/`composeRoute`/`diffContract` 등이 17+ contract-guard test 파일에 중복됐지만, 공용 helper 추출은 별도 refactor slice (아래 Follow-up 후보 유지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (carry-forward) contract-guard test 17+ 파일이 공유하는 정규식 추출기/대조기 (`stripComments`, `extractControllerRoute`, `extractHandlerMethods`, `composeRoute`, `diffContract`, `toFire`) 를 `web/src/views/__contract-guard__/` 공용 helper 로 추출하는 refactor slice — 중복 제거 + 단일 유지보수 지점. LLM CRUD arc 완결 시점이 추출 ROI 재평가 적기.
