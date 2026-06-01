---
id: T-0143
title: api.md §5 LLM endpoint doc-sync — GET /api/llm/providers/:id 단건 행 추가 (T-0142 merged reality 반영)
phase: P4
status: DONE
completedAt: 2026-06-01T22:58:41+09:00
commitMode: direct
coversReq: [REQ-051, REQ-096, REQ-099, REQ-100, REQ-101, REQ-102, REQ-103]
estimatedDiff: 20
estimatedFiles: 1
created: 2026-06-01
plannerNote: "P4 — T-0142 Follow-up #1 해소. api.md §5 에 GET /api/llm/providers/:id 단건 행 추가(404 변환 + apiKey redaction). doc-only direct inline-amend ×0.64. 외부 dep 0 HITL 미발화."
---

# T-0143 — api.md §5 LLM endpoint doc-sync — GET /api/llm/providers/:id 단건 행 추가

## Why

직전 머지된 [T-0142](T-0142-llm-provider-config-get-by-id-endpoint.md) (PR #137) 가 `LlmProviderConfigController` 에 **`GET /api/llm/providers/:id` 단건 조회 endpoint** 를 박제했다 (`findById` null → 404 변환 + 기존 `sanitize` 헬퍼 재사용으로 apiKey 비노출, Admin+ RBAC). 그러나 [docs/architecture/api.md](../architecture/api.md) §5 의 **UC-05 LLM 설정 (`/api/llm`)** 섹션 (현재 L108–114) 에는 아직 이 단건 행이 **없다** — `GET /api/llm/providers` (목록, L109) 행만 있고 그 바로 다음은 `POST` (L110) 이다. merged reality 와 doc 가 어긋난다.

[T-0141](T-0141-api-doc-sync-llm-endpoints.md) 이 직전 doc-sync 에서 difficulty-mappings + providers 목록 행을 정정했으나, 당시 단건 endpoint 가 아직 미존재라 **`GET /api/llm/providers/:id` (단건) endpoint 신설** 을 명시적으로 Out of Scope (T-0140 Follow-up #2) 로 deferral 했다. 이제 T-0142 머지로 단건 endpoint 가 실재하므로, 그 deferral 을 본 task 가 해소한다. 동시에 T-0142 Follow-ups #1 ("api.md §5 GET `/api/llm/providers` 행에 `:id` 단건 행 추가 doc-sync (direct, T-0141 패턴 mirror)") 의 직접 이행이다.

api.md §3 intro 의 **living document** 원칙 ("endpoint 가 새로 식별되거나 기존 endpoint 가 분리·통합되면 본 표를 갱신") 에 따른 mid-phase doc-sync 다 — 동일 패턴이 [T-0124](T-0124-api-doc-rbac-sync.md) (RBAC chain doc-sync) / [T-0141](T-0141-api-doc-sync-llm-endpoints.md) (difficulty-mappings + providers 목록 doc-sync) 등 5+ 회 박제된 documented mid-phase doc-shift 다.

**핵심 보안 invariant (T-0140/T-0142 mirror)**: `LlmProviderConfig.apiKey` 는 secret (평문 String 저장, encryption-at-rest 는 ADR-0006 follow-up). 단건 응답에도 `apiKey` 를 절대 포함하지 않는다 — 본 doc 행 description 에 redaction note 를 명시한다.

본 task 는 **외부 dependency 0 / `pnpm add` 0 / 외부 자격증명 0 / schema 변경 0 / auth-flow 변경 0** — merged 된 코드 reality 의 사후 doc 박제만이다. 따라서 [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 미발화. (P4 의 주요 잔여 milestone — provider HTTP client / config write CRUD — 는 §5 HITL BLOCKED 게이트 대상이며 본 task 범위 밖, 행동 0.)

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) §5 의 **UC-05 LLM 설정 (`/api/llm`)** 섹션 (L108–114) — 수정 대상. 특히 `GET /api/llm/providers` (목록, L109) 행 바로 **아래에** 새 단건 행을 추가할 위치 + 그 행이 mirror 할 description 톤 (T-0140 박제 + apiKey redaction note). + §1 / §3 intro 의 living-document 갱신 원칙 (수정 톤 source). + L124 합계 줄 (endpoint 약 46 + 단건 1 추가 시 합계 본문 동기 여부 판단) + L156 §7 cross-reference 의 UC-05 행 (path group `/api/llm/providers` 에 단건 path 가 이미 포함되는지 점검 — 별도 행 추가 불요면 변경 0).
- [docs/tasks/T-0142-llm-provider-config-get-by-id-endpoint.md](T-0142-llm-provider-config-get-by-id-endpoint.md) — frontmatter `mergedAs` / `prNumber` (PR #137) + Why §2 (apiKey redaction sanitize 재사용 보안 invariant) + Acceptance Criteria (`@Get(":id")` + `findById` null → `NotFoundException` (404) 변환 + Admin+ RBAC `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`). 새 행에 박제할 description 본문 source. (frontmatter 의 정확한 merge SHA / PR 번호 를 본 행 reference 에 사용 — PR #137 이 확인값.)
- [docs/architecture/api.md](../architecture/api.md) §6 표준 status code policy (L128–144) — 404 Not Found (모든 `:id` path) / 200 OK 가 단건 endpoint 의 정상·부재 status code source. 새 행 description 의 404 변환 표기가 §6 정책과 align 하는지 점검 (§6 본문 자체 변경 0 — 이미 일반 정책 박제).

## Acceptance Criteria

- [ ] api.md §5 의 `GET /api/llm/providers` (목록, L109) 행 **바로 아래에** 새 행 **`GET /api/llm/providers/:id`** 1 줄 추가 — METHOD=`GET`, path=`/api/llm/providers/:id`, UC=`UC-05 §5` (또는 목록 행과 동일 UC reference), description 에 다음 4 요소 박제: (1) "단일 LLM provider config 단건 조회", (2) **404 변환** — "row 부재 시 `findById` null → `NotFoundException` (404)" (§6 정책 align), (3) **apiKey redaction** — "기존 `sanitize` view 재사용 (id/provider/endpointUrl/modelId/createdAt/updatedAt — `apiKey` (secret) 응답 누출 차단, 목록/단건 동일 allow-list)", (4) `T-0142 박제 (PR #137)` reference. auth tier 컬럼 = **Admin+** (목록 행과 동일 tier).
- [ ] 기존 `GET /api/llm/providers` (목록, L109) 행 / `POST`·`PATCH`·`DELETE` providers 행 (L110–112) / difficulty-mappings 행 (L113–114) **변경 0** — 본 task 는 단건 행 1 줄 **추가** 만. (기존 행 정정은 T-0141 에서 완료됨.)
- [ ] §5 합계 줄 (L124) 의 "약 46 endpoint" 본문이 단건 행 1 추가로 부정확해지면 동기 (예: "약 46 → 약 47" 또는 "약 46+" 표기, 또는 합계가 "약" 근사라 변동 불요면 변경 0 으로 두되 본 항목에서 판단 결과 명시). resource prefix 수 (11) 는 불변 (기존 `/api/llm/providers` prefix 내 행 추가이므로).
- [ ] §7 cross-reference 표 (L156) 의 UC-05 행 endpoint group 이 이미 `/api/llm/providers` 를 포함 (path group 단위) 하면 **변경 0** — 단건 path 는 group 안에 포함됨. 별도 행 추가 불요 (점검만, 변경 0 이면 그대로).
- [ ] 다른 §5 행 (auth / users / persons / groups / parts / assessments / contributions / summaries / admin / me / difficulty-mappings) **변경 0** — 본 task 는 LLM providers 단건 행 추가 + (필요 시) 합계 줄 본문만.
- [ ] §12 언어 정책 준수 — description 본문 한국어, path / METHOD / DTO 명 / status code / `NotFoundException` / T-NNNN / PR # / REQ-NNN 영어 유지.
- [ ] 본 task 는 `commitMode: direct` — api.md 1 파일만 변경 (doc-only). production code 0 / src 변경 0 / schema 변경 0 / package.json 변경 0. main 브랜치 direct commit (PR / reviewer 없음, [CLAUDE.md §3.1](../../CLAUDE.md) direct 컬럼: `docs/architecture/*` 의 기존 doc inline-amend — 단 신규 architecture doc 신설이 아닌 기존 doc 갱신이므로 direct).

## Out of Scope

- **`GET /api/llm/providers/:id` 의 코드 변경** — endpoint 는 T-0142 에서 이미 머지 완료. 본 task 는 그 reality 의 사후 doc 박제만 — src/ 변경 0 / spec 변경 0.
- **POST/PATCH/DELETE `/api/llm/providers` (config write CRUD) 의 실제 구현** — config write endpoint (apiKey secret body 처리 + encryption-at-rest) 는 [CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 + ADR-0006 deferred. 본 task 는 그 3 행을 건드리지 않는다 (T-0141 이 이미 deferred 표기 완료).
- **provider HTTP client / `LlmGateway` 구현** — provider SDK `pnpm add` + LLM API key 자격증명 동반, [CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 대상. 본 task 행동 0.
- **modules.md / data-model.md / p4-implementation-plan.md 의 LLM entity·module 상세 갱신** — 다른 doc-sync task. 본 task 는 **api.md §5 (+ 필요 시 §5 합계 줄 본문) 1 파일** 만.
- **PLAN.md P4 bullet status 표기 갱신** — 별도 follow-up direct task. 본 task 는 api.md 1 파일만.
- **OpenAPI / Swagger annotation 도입** — api.md §8 Out of scope 의 별도 ADR 책임. 본 task 는 markdown 표 1 줄 추가만.
- **STATE.json / journal / counters 변경** — driver single-writer 책임 ([CLAUDE.md §9](../../CLAUDE.md)). 본 task 는 doc 1 파일만 (planner 가 STATE.nextTask 만 박제).
- **§6 status code policy 본문 변경** — 404 / 200 일반 정책은 이미 박제됨. 본 task 는 단건 행 description 에서 §6 정책을 reference 만, §6 표 자체 변경 0.

## Suggested Sub-agents

`implementer → tester` 불요 — **doc-only direct**, driver 가 Edit 도구로 api.md §5 LLM 섹션에 단건 행 1 줄 직접 inline-amend ([T-0124](T-0124-api-doc-rbac-sync.md) / [T-0141](T-0141-api-doc-sync-llm-endpoints.md) 패턴 mirror — Suggested Sub-agents 미호출, Edit 직접). architect 불요 (신규 architecture 결정 0 — merged reality 의 사후 박제만). R-112 4 카테고리 미적용 (production code 0, 새 symbol 0, 분기 0). tester 도 코드 무변경이라 호출 선택 (호출 시 회귀 0 확인만 — direct doc-only 는 R-110 면제 대상이나 main CI 가 push 자체로 lint/build/test 자동 실행).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)

후보 (planner 예약, 본 task 범위 밖):
- POST/PATCH/DELETE config write CRUD — **[CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 (apiKey secret body 처리) + ADR-0006 동반** — 사용자 승인 필요.
- LLM provider HTTP client / `LlmGateway` 구현 — **[CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 (provider SDK `pnpm add` + LLM API key 자격증명)** — P4 의 다음 주요 milestone, 사용자 승인 필요.
- PLAN.md P4 bullet status 표기 갱신 (LLM read-only endpoint chain 박제 반영, direct).
