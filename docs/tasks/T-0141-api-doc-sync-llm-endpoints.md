---
id: T-0141
title: api.md §5 LLM endpoint doc-sync — difficulty-mappings(T-0139) + providers apiKey-redaction(T-0140) reality 반영
phase: P4
status: PENDING
commitMode: direct
coversReq: [REQ-049, REQ-050, REQ-051, REQ-096, REQ-099, REQ-100, REQ-101, REQ-102, REQ-103]
estimatedDiff: 45
estimatedFiles: 1
created: 2026-06-01
plannerNote: P4 — T-0139/T-0140 누적 MINOR follow-up 해소. api.md §5 LLM 행을 merged reality(difficulty-mappings 복수+:difficulty, providers apiKey-redact)로 동기. doc-only direct ×0.64.
---

# T-0141 — api.md §5 LLM endpoint doc-sync — difficulty-mappings(T-0139) + providers apiKey-redaction(T-0140) reality 반영

## Why

직전 두 task ([T-0139](T-0139-difficulty-mapping-admin-endpoint.md) PR-135 머지 `1dff484` + [T-0140](T-0140-llm-provider-config-list-endpoint.md) PR-136 머지 `ace005f`) 가 LlmModule 에 실제 HTTP endpoint 를 박제했으나, [docs/architecture/api.md](../architecture/api.md) §5 의 **UC-05 LLM 설정 (`/api/llm`)** 섹션 (현재 L108–114) 은 여전히 P2 entry artifact ([T-0030](T-0030-p2-api-contract.md)) 의 **placeholder 행** 이다 — merged reality 와 어긋난다. 두 task 의 Out of Scope / Follow-up 에서 명시 deferral 한 "api.md endpoint 박제" 누적 MINOR follow-up 을 본 task 가 해소한다.

api.md §3 intro 가 명문화한 **living document** 원칙 ("endpoint 가 새로 식별되거나 기존 endpoint 가 분리·통합되면 본 표를 갱신") 에 따른 mid-phase doc-sync 다. 동일 패턴이 [T-0124](T-0124-api-doc-rbac-sync.md) (controller RBAC chain 3/3 closure 의 api.md §5 RBAC enforced 박제) 등 5+ 회 박제된 documented mid-phase doc-shift 다.

**현재 api.md §5 LLM 행의 reality 어긋남 (수정 대상)**:

1. `GET /api/llm/difficulty-mapping` (L113, **단수** path) → 실제는 `GET /api/llm/difficulty-mappings` (**복수**, T-0139 박제). description 에 슬롯 배열 / T-0139·PR-135 reference 누락.
2. `PATCH /api/llm/difficulty-mapping` (L114, **단수, path param 없음**) → 실제는 `PATCH /api/llm/difficulty-mappings/:difficulty` (T-0139 — slot 별 path param). `AssignDifficultyMappingDto.llmProviderConfigId` + service 4xx (400/404) mapping reference 누락.
3. `GET /api/llm/providers` (L109) → T-0140·PR-136 reference + **apiKey 응답 비노출 (redaction) note** 누락 (핵심 보안 invariant — GET 응답에 `apiKey` 절대 미포함, sanitize service 박제).
4. POST/PATCH/DELETE `/api/llm/providers` (L110–112) → **아직 미구현**. config write endpoint 는 `apiKey` (secret) 를 body 로 받으므로 [CLAUDE.md §5](../../CLAUDE.md) "secret 처리" + encryption-at-rest (ADR-0006 deferred) HITL 게이트 대상 — **deferred 표기** 필요.

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) §5 의 **UC-05 LLM 설정 (`/api/llm`)** 섹션 (L108–114) — 수정 대상 6 행. + §1 / §3 intro 의 living-document 갱신 원칙 (수정 톤 source). + L124 합계 줄 / L156 §7 cross-reference 의 LLM 행 (path 변경 시 동기 필요 여부 판단).
- [docs/tasks/T-0139-difficulty-mapping-admin-endpoint.md](T-0139-difficulty-mapping-admin-endpoint.md) — frontmatter `mergedAs: 1dff484` / `prNumber: 135` + Acceptance Criteria (GET `/api/llm/difficulty-mappings` 복수 + PATCH `/api/llm/difficulty-mappings/:difficulty` + `AssignDifficultyMappingDto` + Admin+ RBAC + service 4xx 400/404). 박제할 description 본문 source.
- [docs/tasks/T-0140-llm-provider-config-list-endpoint.md](T-0140-llm-provider-config-list-endpoint.md) — frontmatter `mergedAs: ace005f` / `prNumber: 136` + Acceptance Criteria + Why §2 의 **apiKey redaction 보안 invariant** (GET 응답 apiKey 절대 미포함, `LlmProviderConfigService.findAll()` sanitize view shape). GET providers 행에 박제할 redaction note source.
- [docs/architecture/p4-implementation-plan.md](../architecture/p4-implementation-plan.md) §2 표 T-0139 row + §4 inventory (LLM write endpoint = provider SDK / apiKey 자격증명 HITL 게이트 발화 시점) — POST/PATCH/DELETE providers deferred 사유 source.

## Acceptance Criteria

- [ ] api.md §5 의 **GET `/api/llm/difficulty-mapping`** 행을 **`GET /api/llm/difficulty-mappings`** (복수) 로 정정 + description 에 T-0139·PR-135 reference + "3 슬롯 (easy/medium/hard) 배열 조회, 빈 배열 정상" + auth tier **Admin+** (이미 정확하면 변경 0). `:difficulty` 무. `findAllMappings` 매핑.
- [ ] api.md §5 의 **PATCH `/api/llm/difficulty-mapping`** 행을 **`PATCH /api/llm/difficulty-mappings/:difficulty`** 로 정정 + description 에 T-0139·PR-135 reference + "`:difficulty` slot 별 `AssignDifficultyMappingDto.llmProviderConfigId` 재지정 (REQ-049/050), service 4xx mapping — 미지원 난이도 400 / config 부재·슬롯 부재 P2025 404" + auth tier **Admin+**.
- [ ] api.md §5 의 **GET `/api/llm/providers`** 행 description 에 T-0140·PR-136 reference + **apiKey 응답 비노출 (redaction) note** 박제 — "`LlmProviderConfigService.findAll()` sanitize view 반환 (id/provider/endpointUrl/modelId/createdAt/updatedAt — `apiKey` (secret) 응답 누출 차단), 다중 row / 빈 배열 정상" + auth tier **Admin+** (이미 정확하면 변경 0).
- [ ] api.md §5 의 **POST/PATCH/DELETE `/api/llm/providers`** 3 행 (L110–112) description 에 **미구현 deferred 표기** — "**미구현** — config write 는 `apiKey` (secret) body 처리 → [CLAUDE.md §5](../../CLAUDE.md) HITL 게이트 + encryption-at-rest ADR-0006 deferred (p4-impl-plan §4 inventory)" 박제. auth tier Admin+ 유지 (의도값).
- [ ] §5 합계 줄 (L124) 의 endpoint 합계 / §7 cross-reference 표 (L156) 의 UC-05 행 path 가 정정된 path (`/api/llm/difficulty-mappings`) 와 align 되도록 점검 — 합계 숫자 변동 없으면 (행 수 동일) 본문만 동기, 변동 있으면 갱신. (path 표기 1 곳만 바뀌면 §7 행 동기 1 줄.)
- [ ] 다른 §5 행 (auth / users / persons / groups / parts / assessments / contributions / summaries / admin / me) **변경 0** — 본 task 는 LLM 섹션 + 그 cross-reference 만. auth tier 컬럼은 이미 의도값으로 정확하므로 변경 최소.
- [ ] §12 언어 정책 준수 — description 본문 한국어, path / METHOD / DTO 명 / status code / T-NNNN / REQ-NNN 영어 유지.

## Out of Scope

- **POST/PATCH/DELETE `/api/llm/providers` 의 실제 구현** — config write endpoint (apiKey secret body 처리 + encryption-at-rest) 는 [CLAUDE.md §5](../../CLAUDE.md) HITL BLOCKED 게이트 + ADR-0006 deferred. 본 task 는 그 endpoint 를 **doc 에 deferred 로 표기** 만 — 코드 0 / src 변경 0 / schema 변경 0.
- **`GET /api/llm/providers/:id` (단건) endpoint 신설** — T-0140 Follow-up #2. api.md 에 새 행 추가 0 (미구현이므로). 본 task 는 기존 placeholder 행 정정 + reality reference 박제만.
- **modules.md / data-model.md / p4-implementation-plan.md 의 LLM entity·module 상세 갱신** — 다른 doc-sync task. 본 task 는 **api.md §5 (+ §7 cross-reference path 동기) 1 파일** 만.
- **PLAN.md P4 bullet status 표기 갱신** — 별도 follow-up direct task. 본 task 는 api.md 1 파일만.
- **OpenAPI / Swagger annotation 도입** — api.md §8 Out of scope 의 별도 ADR 책임. 본 task 는 markdown 표 갱신만.
- **STATE.json / journal / counters 변경** — driver single-writer 책임 ([CLAUDE.md §9](../../CLAUDE.md)). 본 task 는 doc 1 파일만.
- **production code / spec 변경** — doc-only direct. R-112 4 카테고리 미적용 (production code 0). tester 는 R-110 으로 `pnpm lint && pnpm build && pnpm test` green 유지만 확인 (코드 무변경이므로 회귀 0 검증).

## Suggested Sub-agents

`implementer → tester` 불요 — **doc-only direct**, driver 가 Edit 도구로 api.md §5 LLM 섹션 직접 inline-amend (T-0124 패턴 mirror — Suggested Sub-agents 미호출, Edit 직접). architect 불요 (신규 architecture 결정 0 — merged reality 의 사후 박제만). tester 는 코드 무변경이라 호출 선택 (호출 시 R-110 lint/build/test green 확인만, 회귀 0).

## Follow-ups

(생성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
