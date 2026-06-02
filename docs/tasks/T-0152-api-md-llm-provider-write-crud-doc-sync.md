---
id: T-0152
title: api.md §5 LLM provider write CRUD doc-sync — POST/PATCH/DELETE /api/llm/providers merged reality 반영
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-051, REQ-052, REQ-053, REQ-054, REQ-055, REQ-043]
estimatedDiff: 28
estimatedFiles: 1
created: 2026-06-02
plannerNote: P4 milestone-2 chain 4/4 (Q-0013) — POST(T-0149)/DELETE(T-0150)/PATCH(T-0151) merge 후 api.md 3 row "미구현"→merged reality doc-sync. doc-only inline-amend ×0.64.
---

# T-0152 — api.md §5 LLM provider write CRUD doc-sync (POST/PATCH/DELETE /api/llm/providers)

## Why

Q-0013 가 승인한 **milestone-2 (LLM provider config write CRUD)** 의 chain 4/4 (마지막 항목) 인 **api.md doc-sync** 다. helper (T-0147) + POST (T-0149, merge 506bf9e) + DELETE (T-0150, merge 4656194) + PATCH (T-0151, merge 004e705) 코드 slice 가 모두 merge 됐으나, `docs/architecture/api.md` §5 의 해당 3 row (현재 L111~113) 는 여전히 **"미구현"** + 이미 해소된 HITL 게이트 / deferred ADR-0006 를 가리키고 있다. living document (§5 도입부 박제) 인 api.md 를 merged reality 와 정합시켜 contract source-of-truth 를 갱신한다.

이는 T-0151 reviewer 가 tracked MINOR deferral 로 명시한 잔여 작업이며, 코드를 0 LOC 도 건드리지 않는 doc-only `direct`-mode task 다 (§3.1 — `docs/architecture/api.md` 단일 파일의 기존 row inline-amend). T-0141 (LLM endpoint doc-sync) / T-0143 (GET-by-id row 추가) 의 doc-sync 패턴을 mirror 한다. milestone-1 (LLM provider HTTP client) / milestone-3 (GitHub·Confluence adapters) 는 Q-0013 에서 **미승인** 이므로 본 task 와 무관 — 새 dependency / credential / schema migration / auth 변경 0.

## Required Reading

- `docs/architecture/api.md` (L108~115 — "UC-05 LLM 설정 (`/api/llm`)" 블록) — 본 task 가 amend 할 3 row (POST L111 / PATCH L112 / DELETE L113). GET providers (L109) / GET providers/:id (L110, T-0142 박제 포맷) row 가 merged endpoint 의 doc 포맷 reference (어떤 status code / sanitize view / 박제 task 표기를 쓰는지). §6 status code policy (L129~145) 의 201/204/409 row 도 본 endpoint 들이 발화 조건에 포함되는지 확인용
- `docs/tasks/T-0149-llm-provider-config-create-endpoint.md` — POST 의 merged contract: 201 + sanitize view (apiKey omit) / `isLlmProvider` false → 400 / `@IsNotEmpty`·`@IsString`·`forbidNonWhitelisted` 위반 → 400 / Admin+ RBAC / apiKey AES-256-GCM encrypt-at-rest never-read-back (ADR-0014)
- `docs/tasks/T-0150-llm-provider-config-delete-endpoint.md` — DELETE 의 merged contract: 204 No Content (body 0) / P2025 → 404 / P2003 (DifficultyMapping in-use, onDelete:Restrict) → 409 / Admin+ RBAC
- `docs/tasks/T-0151-llm-provider-config-update-endpoint.md` — PATCH 의 merged contract: 200 + sanitize view / 부분 갱신 (apiKey 부재=기존 ciphertext 유지·재암호화 0 / 명시=AES-256-GCM 재암호화 교체) / `isLlmProvider` false → 400 / P2025 → 404 / `@unique` 부재라 P2002·409 분기 0 / Admin+ RBAC / never-read-back 유지
- `docs/STATE.json` (Q-0013 decision, L69) — 승인 scope 확인 (POST/PATCH/DELETE만 — milestone-1·3 미승인이 본 doc-sync 범위에 영향 없음 확인용)

## Acceptance Criteria

- [ ] api.md §5 의 POST `/api/llm/providers` row (현 L111) amend — "미구현" 및 "[CLAUDE.md §5] HITL 게이트 + encryption-at-rest (ADR-0006 deferred)" 문구 제거. merged contract 반영: 201 + sanitize view (6 필드 id/provider/endpointUrl/modelId/createdAt/updatedAt, apiKey 응답 누출 차단) / apiKey AES-256-GCM envelope encrypt-at-rest never-read-back (ADR-0014) / 실패 400 (`isLlmProvider` false 미지원 provider · DTO `@IsNotEmpty`/`@IsString`/`@MaxLength` 위반 · forbidNonWhitelisted extra 키) / `T-0149 박제 (PR #142)` 표기. auth tier Admin+ 유지.
- [ ] api.md §5 의 PATCH `/api/llm/providers/:id` row (현 L112) amend — "미구현" 및 ADR-0006 deferred 문구 제거. merged contract 반영: 200 + sanitize view / 부분 갱신 시멘틱 (apiKey 부재=기존 ciphertext 유지·재암호화 0·never-read-back / 명시=AES-256-GCM 재암호화 교체) / 실패 400 (`isLlmProvider` false · DTO 위반) · 404 (P2025 부재 id) / `@unique` 부재로 409 분기 0 명시 / `T-0151 박제 (PR #144)` 표기. auth tier Admin+ 유지.
- [ ] api.md §5 의 DELETE `/api/llm/providers/:id` row (현 L113) amend — "미구현" 및 ADR-0006 deferred 문구 제거. merged contract 반영: 204 No Content (body 0) / 실패 404 (P2025 부재 id) · 409 (P2003 DifficultyMapping in-use — `onDelete: Restrict`, 먼저 슬롯 재지정 후 삭제) / `T-0150 박제 (PR #143)` 표기. auth tier Admin+ 유지. 기존 "difficulty-mapping 의 reference 없을 때만" description 의도를 409 in-use 설명으로 정합.
- [ ] api.md §6 status code policy 표 점검 — 201 Created row (L136) 의 적용 범위에 `POST /api/llm/providers` 가 이미 포함됨 확인 (이미 있음 — 변경 불요 시 그대로 둠). 204·409 row 가 본 endpoint 들의 발화를 포괄하면 추가 amend 불요 (현 generic 정책이 cover — endpoint 별 특수 status 는 §8 out-of-scope 정합). 불일치 발견 시에만 1 줄 보강.
- [ ] §5 도입부 / "합계" 줄 (L125) / Auth·RBAC chain 줄 (L127) 의 endpoint 총수·표현은 본 task 가 endpoint 를 신설하지 않으므로 (이미 표에 3 row 존재, status 표현만 갱신) 숫자 변경 불요 — 단 "합계" 문구가 LLM write CRUD 를 미구현으로 암시하면 1 줄만 정합.
- [ ] 변경은 `docs/architecture/api.md` 단일 파일에 한정 (doc-only). 코드 / spec / 다른 doc 파일 수정 0.
- [ ] 분기 없음 (doc-only direct task — test/coverage 항목 비적용). lint/build/test 불요 (production code 0 LOC). R-112 4 종 + coverage 항목은 본 doc-only task 에 해당 없음 — 명시 생략.

## Out of Scope

- **코드 / spec 수정** — POST/PATCH/DELETE 구현은 T-0149/T-0150/T-0151 에서 이미 merge. 본 task 는 api.md 문서만.
- **milestone-1 (LLM provider HTTP client) / milestone-3 (GitHub·Confluence adapters) 관련 row** — Q-0013 미승인. `/api/admin/*`·미래 webhook row 등은 손대지 않음.
- **§8 out-of-scope 정책 변경** — endpoint 별 특수 status code 의 §8 deferred 원칙 유지. 본 task 는 merged 3 endpoint 의 실제 status 를 row description 에 박제할 뿐, §8 의 "구체 status 는 P3 책임" 원칙을 뒤집지 않음.
- **OpenAPI / Swagger annotation** — §8 + ADR hook 그대로 deferred. 본 task 와 무관.
- **다른 stale 문구 대량 sweep** — 본 task 가 직접 손대는 LLM write CRUD 3 row + (필요 시) §6 1 줄 외 다른 "미구현"·deferred 문구 일괄 정정 금지. 발견 시 Follow-ups 에 기록.
- **`prisma/schema.prisma` / migration / ADR 신설** — 0. doc-only.

## Suggested Sub-agents

`implementer`  (doc-only direct task — architect/tester 불요. 단일 파일 inline-amend. executor 가 직접 또는 implementer 1 회로 처리)

## Follow-ups

(빈 상태로 생성 — sub-agent 가 관련 작업 발견 시 추가)
