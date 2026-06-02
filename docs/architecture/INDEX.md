# Architecture documents — INDEX

본 디렉토리는 Assessment-Agent 의 architecture document 들을 모은 곳이다. P1 (Architecture) phase 의 각 task 가 본 디렉토리에 문서를 신설·갱신한다. 모두 living document — 이후 phase 진행 중 architect agent 가 ADR 와 함께 갱신.

## 문서 목록

| 문서 | 책임 | 생성 task | 상태 |
| --- | --- | --- | --- |
| [requirements.md](../requirements.md) | FR/NFR/Constraint 분리된 REQ-NNN 매핑 표 | T-A1 (P1) | 부분 (P1-Entry 가 kind 채움) |
| [deployment.md](deployment.md) | Deployment view — monolith vs worker / DB / secrets / scheduler / 네트워크 boundary | T-A2 (P1) | 완료 (T-0014 + T-0015) |
| [components.md](components.md) | Component view — 시스템을 component 단위 + 외부 시스템 + 상호 contract | T-A3 (P1) | 완료 (T-0016) |
| [modules.md](modules.md) | Module view — NestJS module 구조 + 의존성 방향 (acyclic) | T-A4 (P1) | 완료 (T-0017) |
| [api.md](api.md) | API contract — HTTP endpoint 목록 + schema | T-0030 (P2) | 완료 (T-0030) |
| [data-model.md](data-model.md) | Conceptual data model — entity + 관계 (구체 schema 는 P3) | T-0031 (P2) | 완료 (T-0031) |
| [directory.md](directory.md) | 디렉토리 구조 정의 — NestJS 표준 + module view mapping | P2 (T-0021) | 완료 (T-0021) |
| [p3-implementation-plan.md](p3-implementation-plan.md) | P3 task 시퀀스 매핑 — 10 PLAN bullet ↔ T-NNNN task 8 row + ADR 후보 + 의존성 graph + 인간 승인 게이트 | T-0032 (P3-Entry) | 완료 (T-0032) |
| [p3-to-p4-transition.md](p3-to-p4-transition.md) | P3 → P4 전이 checkpoint — 진척 status quo (entity 5/11 / module 2/5 / ADR 1/4 / test-quality 4/4 9-cell closure) + 3 trigger option (eager / strict / hybrid) + 권장 hybrid-parallel | T-0063 (P3 → P4 transition) | 완료 (T-0063) |
| [estimate-model.md](estimate-model.md) | planner estimate calibration — 7 회차 cap-bend case study (T-0055/56/57/58/61/62/63) + 4 카테고리 multiplier (× 1.5 / × 1.6 / × 1.3 / × 1.0) + planner 적용 절차 | T-0064 (estimate model 박제) | 완료 (T-0064) |
| [race-patterns.md](race-patterns.md) | race pattern 7+7=14 회차 누적 박제 — gh pr merge worktree race (T-0048~T-0062) + reviewer-gate race-fix (T-0036~T-0047 + T-0061 `gh run rerun` SUCCESS) + integrator race-aware 평가 절차 cross-ref | T-0065 (race lessons doc) | 완료 (T-0065) |

## 갱신 룰

- 각 문서는 architect agent 가 책임. ADR 신설 시 관련 view 문서 동시 갱신 (architect.md 참조).
- 큰 변경 (예: monolith → worker 분리 전환) 은 새 ADR 로 박제 + 기존 view 문서 갱신. 이전 결정은 SUPERSEDED ADR 로 보존.
- view 문서 자체는 한 commit 안에서 너무 커지면 split (예: components.md 가 비대해지면 components/overview.md + components/<name>.md 로 분리). 단 INDEX.md 는 항상 동기.

## ADR 매핑

| ADR | 영향받는 view 문서 | 상태 |
| --- | --- | --- |
| ADR-0001 stack (NestJS / TS / pnpm / Jest / GHA) | modules.md (NestJS choice 반영) | ACCEPTED (T-0002, 8c6defe) |
| ADR-0002 DB (PostgreSQL + Prisma) | deployment.md + data-model.md | ACCEPTED (T-0014) |
| ADR-0003 Deployment (monolith vs worker, secret, scheduler, network) | deployment.md + components.md | ACCEPTED (T-0015) |
| [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) 3 난이도 모델 할당 정책 (3 row 고정 + FK 참조 + fail-fast fallback) | data-model.md (DifficultyMapping) | ACCEPTED (T-0136) |
| [ADR-0012](../decisions/ADR-0012-cross-cutting-field-policy.md) Cross-cutting field policy (UTC 저장 / mutable-only updatedAt / Person-only soft delete / createdBy = AuditLog event-stream) | data-model.md (§5 cross-cutting field) | ACCEPTED (T-0144) |
| [ADR-0013](../decisions/ADR-0013-confluence-space-traversal-policy.md) Confluence SPACE 탐색 정책 (page List 기반 탐색 / SPACE allowlist 순회 + (page, version) raw-transient / 4xx skip-and-continue) | modules.md (ConfluenceModule) | ACCEPTED (T-0145) |
| [ADR-0014](../decisions/ADR-0014-llm-api-key-encryption-at-rest.md) LLM API key encryption-at-rest 정책 (application-layer AES-256-GCM envelope / `LLM_APIKEY_ENC_KEY` env / write-only never-read-back / KMS 전환 친화) | data-model.md (LlmProviderConfig apiKey) | ACCEPTED (T-0146) |
| [ADR-0016](../decisions/ADR-0016-github-adapter-http-transport-contract.md) GithubAdapter HTTP transport 계약 (내장 fetch + injectable `FetchLike` / 3 host variant base URL 라우팅 (public `api.github.com` vs Enterprise `/api/v3`) / `Authorization: Bearer` + `X-GitHub-Api-Version` / non-2xx 도메인 매핑 + 4xx→PermissionDeniedEvent / Link rel=next pagination) | modules.md (GithubModule) | ACCEPTED (T-0173) |
| [ADR-0017](../decisions/ADR-0017-github-instance-config-source.md) GithubModule instance sub-config source (env 기반 — `process.env` instance-keyed config `GITHUB_INSTANCES` + per-key `GITHUB_<KEY>_HOST`/`_ORG`/`_TOKEN_ENC` / DB table·`@nestjs/config` 미채택 / token encrypted-at-rest + JIT decrypt / env→config 순수 함수 변환) | modules.md (GithubModule) | ACCEPTED (T-0177) |
| [ADR-0018](../decisions/ADR-0018-confluence-adapter-http-transport-contract.md) ConfluenceAdapter HTTP transport 계약 (내장 fetch + injectable `ConfluenceFetchLike` / Cloud `/wiki/rest/api` vs Server `/rest/api` 풀 base URL 박제 / Cloud Basic `email:api_token` vs Server `Bearer <pat>` (AUTH_USER 존재 여부로 분기) / non-2xx 도메인 매핑 + 4xx→PermissionDeniedEvent (adapter throw / service skip-and-continue) / `_links.next` body cursor pagination + `CONFLUENCE_MAX_PAGES` cap / 4 단 경계: builder→adapter.request→requestAllPages→SpaceTraversalService) | modules.md (ConfluenceModule) | PROPOSED (T-0183) |

## MVA 원칙

본 디렉토리의 문서는 **Minimum Viable Architecture** 수준 — over-design 회피.

- 구체적 schema 컬럼 / API endpoint signature / service 메서드 시그니처는 본 문서 범위 밖. P3+ 의 task 에서 구체화.
- "어떤 component 가 있고 어떤 boundary 로 분리되어 있는가" + "deployment 구조" + "NFR 충족 계획" 까지만 P1 에서.
- 나머지는 ADR + 코드와 함께 진화.
