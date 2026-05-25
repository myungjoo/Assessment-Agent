---
id: T-0030
title: P2 API contract 초안 — docs/architecture/api.md (HTTP endpoint 표 + 8 UC 매핑)
phase: P2
status: PENDING
commitMode: pr
coversReq: [REQ-026, REQ-027, REQ-028, REQ-030, REQ-032, REQ-037, REQ-038, REQ-040, REQ-041, REQ-043, REQ-044, REQ-045, REQ-049, REQ-050]
estimatedDiff: 170
estimatedFiles: 4
created: 2026-05-25
plannerNote: P2 넷째 bullet (api.md). 8 UC §5 sequence 기반 HTTP endpoint 표 + resource model + auth tier. data-model.md 의 prerequisite.
dependsOn: [T-0019, T-0028, T-0029]
blocks: []
hqOrigin: null
---

# T-0030 — P2 API contract 초안 (`docs/architecture/api.md` 신설)

## Why

[docs/PLAN.md](../PLAN.md) Phase P2 (Use case decomposition) 의 5 entry artifact 중 **넷째 — "API contract 초안"** ([PLAN.md](../PLAN.md) L37) 을 본 task 가 cover 한다. P2 의 직전 task [T-0029](T-0029-uc-inventory-audit.md) (PR-28 merged cd61232) 가 **66 REQ × UC coverage audit** 을 박제하고 UC backbone 이 functional REQ 의 superset 임을 검증 완료 (uc-covered 48 / cross-cutting 4 / infrastructure 13 / gap 1 = 66, gap 1 건 = REQ-004 은 후속 task 책임). UC-01~UC-08 본문 8/8 closure ([T-0020](T-0020-uc-01-evaluation-execution.md) ~ [T-0028](T-0028-uc-08-permission-denied.md)) + audit 박제로 본 task 의 frontend (use case 흐름 + REQ coverage) 가 안전하게 확정됨.

본 task 의 본질: **8 UC 의 §5 sequence diagram 이 호명하는 HTTP endpoint 를 수집·정규화하여 단일 api.md 표로 박제**. 본 표는 P3 의 Backend API component ([components.md](../architecture/components.md) "Backend API") 구현 task 들의 contract source. 본 task 가 없으면 P3 의 NestJS controller 구현 task 들이 endpoint 명세를 매 task 마다 재추론해야 하므로 (a) 중복 노력 (b) endpoint 명세 일관성 깨질 위험 (c) UC 흐름과의 정합 점검 시점 분산.

본 task 는 **data-model.md 의 prerequisite** — api.md 의 resource model (`/api/persons`, `/api/assessments`, `/api/groups`, `/api/parts`, `/api/auth`, `/api/llm-config`, `/api/admin/*` 등) 이 data-model.md 의 entity 이름과 1:1 align 하도록 먼저 박제. 본 task 후속 task 가 data-model.md 를 작성할 때 본 표의 resource path 를 entity 이름 source 로 사용한다.

산출물: (1) [docs/architecture/api.md](../architecture/api.md) 신설 — METHOD | path | UC | description | auth tier 5-컬럼 endpoint 표 + resource model 단락 + 표준 status code policy + UC §5 sequence step cross-reference + References + OpenAPI/Swagger 도입 hook 박제, (2) [docs/architecture/INDEX.md](../architecture/INDEX.md) 의 api.md row 갱신 (`미작성` → `완료 (T-0030)`), (3) [docs/PLAN.md](../PLAN.md) P2 단락 넷째 bullet 의 `[ ]` → `[x]` + closure marker inline append, (4) (선택적) [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 의 References 단락에 api.md 백링크 1 줄 추가.

본 task 는 architecture document 신설이므로 **`commitMode: pr`** (CLAUDE.md §3.1 — 새 docs/architecture/* 추가는 reviewer 점검 대상).

**Scope discipline (architect 결정 박제)**:

- **DO**: HTTP method + path + UC reference + brief description + auth tier (User / Admin / SuperAdmin) 표 작성. 표준 status code policy (200/400/401/403/404/500) 박제. Resource model (`/api/<resource>`) 의 conceptual 분리 박제. UC §5 sequence step 의 endpoint 호명 위치 1:1 cross-reference.
- **DO NOT**: 구체 JSON request/response schema 명세 (P3 implementation 책임). 구체 validation rule. 예시 payload. status code 의 endpoint 별 특수 케이스 (예: "이 endpoint 는 409 도 반환"). NestJS controller code. OpenAPI YAML 생성 (References 의 future hook 으로만 박제).
- **DO NOT**: WebSocket / SSE / streaming endpoint (현재 8 UC 어디에도 없음). 외부 webhook receiver (P4 책임).

## Required Reading

본 task 의 sub-agent (architect / implementer) 는 다음 파일만 읽으면 self-contained 하게 작업 가능하다. 광범위 read 금지 (§7).

- [docs/PLAN.md](../PLAN.md) Phase P2 단락 (본 task 는 넷째 bullet "API contract 초안" 의 cover. L37)
- [docs/architecture/INDEX.md](../architecture/INDEX.md) — architecture document 목록 (api.md row 갱신 대상) + MVA 원칙
- [docs/use-cases/INDEX.md](../use-cases/INDEX.md) — 8 UC backbone 표 (각 UC 의 actor / 책임 component 빠르게 파악)
- [docs/use-cases/UC-01-evaluation-execution.md](../use-cases/UC-01-evaluation-execution.md) ~ [docs/use-cases/UC-08-permission-denied.md](../use-cases/UC-08-permission-denied.md) — **본 task 의 핵심 source**. 각 UC 의 **§5 sequence diagram** 에서 호명되는 HTTP endpoint 가 본 표의 row source. §9 component/module mapping 도 cross-reference.
- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) — T-0029 산출물. uc-covered 48 REQ 의 분류 — 각 endpoint 가 어떤 REQ 를 직접 cover 하는지 박제 시 사용
- [docs/architecture/components.md](../architecture/components.md) — **Backend API component** 단락 (본 task 의 component scope). Web UI ↔ Backend API contract 박제 위치
- [docs/architecture/modules.md](../architecture/modules.md) — 9 NestJS module 의 domain 분리 (각 endpoint 가 어느 module 의 controller 책임인지 결정 source)
- [docs/architecture/directory.md](../architecture/directory.md) — `src/<module>/<module>.controller.ts` layout (api.md 의 endpoint 가 directory 어디에 박제될지 conceptual 정렬)
- [docs/requirements.md](../requirements.md) — REQ-026/027/028 (인원 CRUD) / REQ-030/032 (export/import) / REQ-037/041 (평가 삭제·재수집) / REQ-038 (조회) / REQ-040 (평가 manual trigger) / REQ-043/044 (auth) / REQ-045 (Admin/SuperAdmin gate) / REQ-049/050 (LLM 설정) 등 functional REQ 매핑
- [README.md](../../README.md) L36-103 — functional REQ 의 source (ambiguity fallback)
- [docs/decisions/ADR-0001-stack.md](../decisions/ADR-0001-stack.md) — NestJS / REST 결정 (본 task 의 protocol 선택 source)
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) — Monolith / single backend process (api.md 의 endpoint host model 박제 시 참조)
- [docs/tasks/T-0029-uc-inventory-audit.md](T-0029-uc-inventory-audit.md) — 직전 task (template / Acceptance Criteria pattern / Out of Scope 분리 style 참고)

## Acceptance Criteria

본 task 는 doc-only 이지만 새 파일 신설 + commitMode: pr 이므로 R-110 (lint/build/test 확인) 의무가 적용된다. R-112 의 4 항목 (happy-path test / error path / 분기 / negative test) 은 **production code 가 0 LOC 이므로 분기 없음 — 이 항목 생략**, R-111/113 는 markdown 변경이므로 자동 통과.

### A. `docs/architecture/api.md` 신설 (핵심 산출물)

- [ ] `docs/architecture/api.md` 파일 신설. 최소 다음 9 section 포함:
  - § 1. 개요 (api.md 의 scope + ADR-0001 REST 결정 reference + MVA 원칙 reference)
  - § 2. Protocol / host model (HTTPS / single host `:443` / `/api/<resource>` prefix / JSON content-type / Cookie 또는 Bearer token auth 박제 — 구체 mechanism 은 P4 의 AuthModule 책임)
  - § 3. Auth tier (User / Admin / SuperAdmin 3 등급 + 각 등급의 default behavior. REQ-043/044/045/046 cross-reference)
  - § 4. Resource model (resource path prefix list: `/api/persons`, `/api/groups`, `/api/parts`, `/api/assessments`, `/api/auth`, `/api/llm-config`, `/api/admin/backup`, `/api/admin/export`, `/api/admin/import` 등 — 각 resource 의 책임 module ↔ [modules.md](../architecture/modules.md) cross-reference)
  - § 5. **Endpoint 표** (핵심 산출물. METHOD | path | UC | description | auth tier 5-컬럼. 8 UC §5 sequence 의 호명 위치를 모두 수집)
  - § 6. 표준 status code policy (200 OK / 201 Created / 204 No Content / 400 Bad Request / 401 Unauthorized / 403 Forbidden / 404 Not Found / 409 Conflict / 500 Internal Server Error — endpoint 별 특수 코드는 P3 implementation 책임 박제)
  - § 7. UC §5 sequence step ↔ endpoint cross-reference (각 UC 마다 어느 step 이 어느 endpoint 를 호출하는지 1:1 reference)
  - § 8. Out of scope (구체 JSON schema / validation rule / 예시 payload / OpenAPI YAML — 모두 P3 책임 박제)
  - § 9. References (PLAN.md / INDEX.md / 8 UC body / REQ-COVERAGE-AUDIT.md / components.md / modules.md / directory.md / requirements.md / ADR-0001 / ADR-0003 / future OpenAPI/Swagger 도입 hook)
- [ ] **§ 5 endpoint 표** 의 row 가 다음 8 UC §5 sequence 의 endpoint 호명을 빠짐없이 수집:
  - UC-01 평가 실행: manual trigger endpoint (예: `POST /api/assessments/run`) — REQ-040
  - UC-02 평가 결과 조회: 조회 endpoint group (예: `GET /api/assessments?filter=&sort=&page=`, `GET /api/assessments/:id`) — REQ-038
  - UC-03 인원 CRUD: `GET /api/persons`, `POST /api/persons`, `PATCH /api/persons/:id`, `DELETE /api/persons/:id` (또는 `PATCH /api/persons/:id { active: false }`), Group/Part 관련 endpoint — REQ-026/027/028
  - UC-04 권한·계정: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/users/:id/role` (SuperAdmin gate) — REQ-043/044/045
  - UC-05 LLM 설정: `GET /api/llm-config`, `PUT /api/llm-config` (또는 PATCH), `POST /api/llm-config/health-check` — REQ-049/050
  - UC-06 평가 삭제·재수집: `DELETE /api/assessments/:id` (또는 range delete) — REQ-037/041
  - UC-07 Export/Import/Backup: `GET /api/admin/export`, `POST /api/admin/import`, `POST /api/admin/backup`, `POST /api/admin/restore` — REQ-030/032
  - UC-08 권한 부족 통지: System actor (외부 trigger 없음) — read endpoint 만 박제 (예: `GET /api/permission-denied-events`) 또는 UC-02 의 조회와 통합. REQ-008/016 의 표시 path
- [ ] 표의 각 row 가 **UC §5 sequence step 1:1 cross-reference** 를 명시 (예: "UC-01 §5 step 3" 또는 anchor link `[UC-01 §5](../use-cases/UC-01-evaluation-execution.md#5-sequence-diagram)`)
- [ ] 표의 각 row 가 **auth tier** 명시 (User / Admin / SuperAdmin / Public). REQ-046 (User read-only) 의 의미가 표에서 자명해야 함 — User 는 GET endpoint 중 일부만 access, mutation endpoint 는 Admin+
- [ ] § 4 resource model 의 각 resource 가 **책임 module** 과 cross-reference ([modules.md](../architecture/modules.md) 의 9 module 이름 그대로 사용 — 신규 module 만들지 않음)
- [ ] § 8 Out of scope 가 본 task scope discipline 의 5 항목 (구체 JSON schema / validation rule / 예시 payload / OpenAPI YAML / WebSocket·SSE) 을 명시
- [ ] frontmatter 필요 없음 (architecture document 는 frontmatter 안 씀 — components.md / modules.md / directory.md style 따름)
- [ ] 본문 길이 약 130-160 LOC 안에서 작성 (over-design 회피, MVA 원칙). 표가 큰 경우 description 컬럼 ≤ 1 줄로 압축.

### B. [docs/architecture/INDEX.md](../architecture/INDEX.md) 갱신

- [ ] api.md row 의 "상태" 컬럼: `미작성` → `완료 (T-0030)`
- [ ] api.md row 의 "생성 task" 컬럼: `P2 use case decomposition 후` → `T-0030 (P2)`

### C. [docs/PLAN.md](../PLAN.md) 갱신

- [ ] P2 단락 넷째 bullet (L37, "API contract 초안") 의 `[ ]` → `[x]` 전환
- [ ] 같은 bullet 끝에 closure marker inline append: `T-0030 으로 박제 완료 — [api.md](architecture/api.md)`

### D. (선택적) [docs/use-cases/INDEX.md](../use-cases/INDEX.md) 갱신

- [ ] References 단락 또는 갱신 룰 단락의 끝에 api.md 백링크 1 줄 추가 (예: "API contract: [architecture/api.md](../architecture/api.md) (T-0030)"). 생략해도 무방 — INDEX 가 비대해지면 trade-off. architect 판단.

### E. R-110 (lint/build/test) 의무 (CLAUDE.md §3.2)

- [ ] `pnpm lint` 실행 — markdown 변경이므로 baseline 변동 0 expected. baseline 초과 시 BLOCKED.
- [ ] `pnpm build` 실행 — production code 변경 0 LOC 이므로 통과 expected.
- [ ] `pnpm test` 실행 — production code 변경 0 LOC 이므로 통과 expected.
- [ ] R-112 의 4 항목 (happy-path / error path / 분기 / negative) 은 production code 0 LOC 이므로 **분기 없음 — 이 항목 생략**. PR body 에 "doc-only task, R-112 자동 통과" 명시.

### F. PR body + agent-trail

- [ ] PR body 에 본 task 파일 링크 + Acceptance Criteria 체크리스트 + 산출물 요약 (api.md endpoint count / resource group count / UC §5 step cross-reference count) 명시
- [ ] commit message 에 agent-trail blob 포함 (CLAUDE.md §11 표준 포맷). 본 task 는 architect → implementer → tester 3 sub-agent dispatch (reviewer / integrator 는 driver loop 책임).

## Out of Scope

본 task 에서 **하지 않는다** (executor 가 다른 주제로 빠지는 것 방지 — CLAUDE.md §3 cap discipline):

- 구체 JSON request/response schema 명세 (P3 implementation 책임 — `src/<module>/<module>.controller.ts` + DTO + class-validator).
- 구체 validation rule (NestJS class-validator decorator, Joi schema 등 — P3 책임).
- 예시 payload / sample request·response (P3 의 e2e test fixture 책임).
- OpenAPI / Swagger YAML 자동 생성 (References 의 "future hook" 단락에서만 박제. NestJS `@nestjs/swagger` 도입은 P3+ 별도 ADR 필요).
- status code 의 endpoint 별 특수 케이스 (예: "이 endpoint 는 409 도 반환") — § 6 의 표준 policy 만 박제, 특수 코드는 P3 책임.
- WebSocket / SSE / streaming endpoint (현재 8 UC §5 sequence 에 호명되지 않음. P5+ realtime feature 가 들어올 때 별도 ADR + api.md 갱신).
- 외부 webhook receiver endpoint (GitHub webhook / Confluence webhook — 현재 8 UC §5 sequence 에 호명되지 않음. P4 외부 통합 task 책임).
- NestJS controller / service / module 의 실제 코드 (P3+ 책임).
- 새 module 신설 (modules.md 의 9 module 안에서 endpoint 분류). 새 module 필요 시 별도 ADR + modules.md 갱신 task.
- API versioning policy (예: `/api/v1/*`). 현재는 unversioned 박제. 필요 시 별도 ADR.
- Rate limiting / throttling / quota policy (P4+ 책임).
- gap REQ-004 (사용자 지정 기간 임의 평가문) 의 endpoint — T-0029 audit 가 gap follow-up 으로 박제. 본 task 는 8 UC 흐름만 cover, REQ-004 은 후속 task (UC-09 신설 또는 UC-01 확장) 책임.

## Suggested Sub-agents

`architect → implementer → tester`

- **architect** (1순위): 8 UC §5 sequence diagram 을 1차 source 로 endpoint inventory 수집 → resource model 결정 (어느 path prefix 가 어느 module 의 책임) → auth tier 매핑 → § 8 Out of scope 의 trade-off 박제. ADR 신설 미필요 (api.md 자체가 reference document, ADR 수준 결정은 ADR-0001/0003 에 이미 박제됨).
- **implementer**: architect 의 결정 박제 → api.md 작성 + INDEX.md/PLAN.md 갱신. (선택적) use-cases/INDEX.md 의 References 백링크 추가.
- **tester**: `pnpm lint && pnpm build && pnpm test` 실행 확인 — markdown 변경이므로 baseline 변동 0 expected. R-110 R-112 검증 의무.

## Follow-ups

(empty — 빈 상태로 시작. sub-agent 가 본 task 수행 중 인접 작업 발견 시 본 단락 또는 STATE.json.humanQuestions 에 박제. 본 task 직후 자연 후속은 **data-model.md 신설 task (T-0031)** — api.md 의 resource path 가 data-model.md 의 entity 이름 source.)
