# P4 Implementation plan

> **본 문서는 Phase P4 (External integrations) 의 entry artifact ([T-0134](../tasks/T-0134-p4-entry-implementation-plan.md)) 의 산출물이다.** [docs/PLAN.md](../PLAN.md) Phase P4 의 **7 bullet (L81–88) 을 후속 T-NNNN task 후보 (T-0135+ 잠정 placeholder) 시퀀스로 사전 매핑**한다. P2 → P3 전이 시 [p3-implementation-plan.md](p3-implementation-plan.md) ([T-0032](../tasks/T-0032-p3-entry-implementation-plan.md)) 가 P3 의 PLAN bullet 을 task 시퀀스로 매핑해 후속 task 들의 누적 의존성 / ADR 신설 시점 / 인간 승인 게이트 발화 시점을 self-contained 하게 만든 것처럼, **P4 도 동일한 entry artifact 로 시퀀스를 사전 고정**한다. P4 의 모든 후속 task 는 본 문서를 reference 하여 (a) 누적 의존성 (b) ADR 신설 필요 시점 (c) 인간 승인 게이트 발화 시점 (d) entity / module 책임 분배의 일관성을 확보한다. **본 문서는 doc-only planning artifact** — 실제 코드 / `pnpm add` / 외부 client 구현 / Prisma schema 작성 / 외부 자격증명 처리는 본 task 에서 하지 **않으며**, 후속 코드 task 의 책임이다. 본 task 머지로 **Phase P3 → P4 phase 진입 entry marker** 박제 (STATE.phase 는 [T-0133](../tasks/T-0133-p3-to-p4-binding-decision.md) 에서 이미 P4-in-progress 전환 — option (c) hybrid-parallel binding).

## 1. 개요

본 문서의 범위는 [docs/architecture/INDEX.md](INDEX.md) 의 **MVA (Minimum Viable Architecture)** 원칙에 따라 **task 시퀀스 매핑만** 박제한다 — task ID(잠정) / 책임 / 대응 PLAN bullet / dependsOn / ADR 필요 여부 / 인간 승인 게이트 / estimated LOC / 책임 module 의 8 컬럼 표 + P3-deferred carryover 흡수 + ADR 신설 후보 list + 인간 승인 게이트 박제 + Out of scope + References 까지. **구체 외부 client 코드 · `pnpm add` 실행 · API contract 상세 · migration SQL 은 본 문서의 범위 밖** ([§5](#5-out-of-scope) 참조). 그 구체화는 후속 P4 코드 task 의 책임이다.

본 문서의 기반:

- [docs/PLAN.md](../PLAN.md) Phase P4 단락 (L81–88) — **본 문서의 1차 source**. 7 bullet 의 매핑 대상 (GitHub 3-instance 통합 + GitHub Issue 평가 R-30 + Confluence 통합 + Confluence SPACE 탐색 정책 R-34 + LLM provider 추상화 R-99~103 + 3 난이도 모델 할당 R-97 + Admin LLM 지정 UI R-96 + 자격증명 관리·권한 부족 감지 R-20/R-33).
- [docs/architecture/modules.md](modules.md) — GithubModule / ConfluenceModule / LlmModule 의 이름 / 책임 / 의존성. 본 표 "책임 module" 컬럼 값의 source (3 module 모두 외부 adapter leaf, 외부 HTTPS 만 호출).
- [docs/architecture/data-model.md](data-model.md) — LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord entity 정의. P4 entity scope source (LlmProviderConfig 다중 row 모델 / DifficultyMapping 3 row 고정 / PermissionDeniedRecord 외부 4xx event 영속화).
- [docs/architecture/api.md](api.md) §2 (Auth credential — ADR-0008 JWT cookie ACCEPTED) + LLM / 외부 통합 endpoint prefix — 외부 통합 endpoint contract source.
- [docs/architecture/p3-to-p4-transition.md](p3-to-p4-transition.md) §7 (binding decision option (c) hybrid-parallel) + §7.2 (P4 와 병행 deferred 6 항목) — P4 시퀀스에 흡수할 P3-deferred carryover 목록의 source.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode 정책) / §3.2 (Test·CI R-110~R-114) / §5 (HITL — 새 외부 dependency 추가는 BLOCKED) — 본 표 "인간 승인 게이트" 컬럼의 source.

## 2. P4 task 시퀀스 표

PLAN.md P4 **7 bullet (L81–88)** 을 후속 T-NNNN task 후보로 매핑한다. **task ID 는 `T-0135+` 형태의 잠정 placeholder** — 실 할당은 각 planner dispatch 의 책임이며, P3 진행 중 원안 8 task 가 실제 25 task 로 expand 한 precedent ([p3-implementation-plan.md §2](p3-implementation-plan.md)) 처럼 본 표도 진행 중 자연 split / 한 자리 shift 가능. 각 row 의 estimated LOC ≤ 300 / 변경 파일 ≤ 5 ([CLAUDE.md §3](../../CLAUDE.md) cap discipline) 검산 — 초과 예상 row 는 **"split 필요"** marker.

| task ID(잠정) | 책임 | 대응 PLAN bullet ([PLAN.md](../PLAN.md)) | dependsOn | ADR 필요 여부 | 인간 승인 게이트 | est LOC | 책임 module |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **T-0135** | LlmModule scaffold — provider abstraction interface (`LlmGateway` interface + 5 provider enum) + LlmProviderConfig entity Prisma model + LlmProviderConfigRepository. 실제 5 provider HTTP client 0 (interface 만). | LLM provider 추상화 (L85, R-99~103) + P3-deferred carryover (LlmProviderConfig entity) | T-0133 | **ADR-0006 (LLM API key encryption-at-rest)** 동반 후보 — LlmProviderConfig.apiKey 컬럼 encryption mechanism | **있음 — 외부 dependency 미추가 (interface scaffold 만) 이면 게이트 없음. provider SDK 추가 row 에서 발화 (T-0137+)** | ~290 (split 필요 가능) | LlmModule |
| **T-0136** | DifficultyMapping entity Prisma model + DifficultyMappingRepository + LlmProviderConfig ↔ DifficultyMapping 1:N (3 난이도 슬롯 easy/medium/hard 고정) + 난이도↔model 매핑 service backbone | 3 난이도 모델 할당 (L86, R-97) + P3-deferred carryover (DifficultyMapping entity) | T-0135 | **ADR — 3 난이도 모델 할당 정책** (R-97, PLAN.md L86 "ADR 로 박제" 명시) | 없음 (entity + 매핑만, 외부 dependency 0) | ~240 | LlmModule |
| **T-0137** | LLM provider HTTP client 구현 #1 (custom — OpenAI 호환 / 내부 자체 서버 / proxy) + LlmGateway routing. custom 이 3 model 슬롯 모두 차지 가능 (REQ-051). | LLM provider 추상화 (L85, R-99/R-103) | T-0135 + T-0136 | 없음 (T-0135 의 ADR-0006 위에서) | **있음 — custom provider 가 OpenAI 호환 SDK (`openai` 등) 또는 native `fetch` 택일. SDK 추가 시 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트 + LLM API key 자격증명** | ~280 (split 필요 가능) | LlmModule |
| **T-0138** | LLM provider HTTP client 구현 #2~5 (Azure OpenAI / Anthropic / Google Gemini / OpenAI) — 각 provider SDK 또는 HTTP adapter. provider 당 자연 split 가능 (4 provider → 2~4 task). | LLM provider 추상화 (L85, R-99~103) | T-0137 | 없음 | **있음 — 각 provider SDK (`@azure/openai` / `@anthropic-ai/sdk` / `@google/generative-ai` / `openai`) 추가 시 BLOCKED 게이트 + LLM API key 자격증명** | ~300 × N (split 필요) | LlmModule |
| **T-0139** | Admin LLM 모델 지정 endpoint (POST/PATCH `/api/llm/providers` + `/api/llm/difficulty-mappings`) + DTO + RBAC (Admin+) — UI 는 P6 책임, 본 task 는 backend endpoint 만. | Admin 이 LLM 모델 지정 UI (L87, R-96 — backend 부분) | T-0136 | 없음 | 없음 (내부 endpoint, 외부 dependency 0) | ~280 | LlmModule |
| **T-0140** | GithubModule scaffold — `GithubAdapter` service (3 instance github.com / github.sec.samsung.net / github.ecodesamsung.com 단일 service + instance key sub-config) + instance 별 URL/org/token 설정 분리. | GitHub 통합 3-instance (L81) | T-0133 | 없음 (modules.md GithubModule row 기반) | **있음 — `@octokit/rest` 또는 유사 GitHub client 추가 + 3 instance GitHub token 자격증명 ([CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트)** | ~290 (split 필요 가능) | GithubModule |
| **T-0141** | GitHub Issue 평가 (R-30) — Repo 내 Issue 작성을 문서 기여로 평가. **본인이 본인 follow-up 을 남기고 본인이 소비하는 경우 카운트 제외** invariant service-level 강제. | GitHub Issue 평가 (L82, R-30) | T-0140 | 없음 | 없음 (GithubAdapter 위에서) | ~240 | GithubModule |
| **T-0142** | ConfluenceModule scaffold — `ConfluenceAdapter` service (지정 주소 Confluence Service 내 지정 SPACE 다중 관리) + SPACE list / page list / page version 조회 + 4xx catch → PermissionDeniedEvent emit. | Confluence 통합 다중 SPACE (L83) | T-0133 | 없음 (탐색 정책은 T-0143 ADR) | **있음 — Confluence client (REST API SDK 또는 `fetch`) 추가 + Confluence token 자격증명 ([CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트)** | ~280 (split 필요 가능) | ConfluenceModule |
| **T-0143** | Confluence SPACE 탐색 정책 (R-34) — Crawling 또는 page List/Hierarchy 기반 탐색 중 택일 + ConfluenceAdapter 탐색 구현. | Confluence SPACE 탐색 정책 (L84, R-34) | T-0142 | **ADR — Confluence SPACE 탐색 정책** (R-34, PLAN.md L84 "ADR 로 결정" 명시 — crawling vs hierarchy 택일) | 없음 (ConfluenceAdapter 위에서, 외부 dependency 0) | ~220 | ConfluenceModule |
| **T-0144** | 자격증명 관리 + 권한 부족 감지·통지 (R-20/R-33) — PermissionDeniedRecord entity Prisma model + PermissionDeniedRecordRepository + GithubAdapter / ConfluenceAdapter 의 4xx → PermissionDeniedEvent → DB 영속화 + user/admin audience 분리 ([data-model.md](data-model.md) PermissionDeniedRecord row). | 자격증명 관리 + 권한 부족 감지·통지 (L88, R-20/R-33) + P3-deferred carryover (PermissionDeniedRecord entity) | T-0140 + T-0142 | **ADR-0007 (audit log entity schema)** 동반 후보 — PermissionDeniedRecord schema 박제 | 없음 (entity + event 영속화, 외부 dependency 0 — token 처리는 T-0140/T-0142 게이트에서 선행) | ~290 (split 필요 가능) | AssessmentModule |

**합계**: **10 task 후보 (T-0135 ~ T-0144) / 3 외부 adapter module (GithubModule / ConfluenceModule / LlmModule) + AssessmentModule (PermissionDeniedRecord) / PLAN.md P4 7 bullet 전부 1+ row cover**. bullet ↔ row 매핑: L81 (T-0140) / L82 (T-0141) / L83 (T-0142) / L84 (T-0143) / L85 (T-0135/T-0137/T-0138) / L86 (T-0136) / L87 (T-0139) / L88 (T-0144) — 7 bullet 모두 cover (L85 LLM 추상화는 scaffold + custom + 4 provider 의 3+ task 로 자연 split).

**Cap discipline 검산**: 10 row 중 **임계 row (T-0135 / T-0137 / T-0138 / T-0140 / T-0142 / T-0144, ~280–300+ LOC)** 는 실제 진입 시 architect 가 **첫 read 직후 split 의무 평가** 수행 — "split 필요" marker 부착 row. 특히 **T-0138 (4 provider HTTP client)** 은 provider 당 자연 split 으로 2~4 task expand 예상 (각 provider SDK + adapter + R-112 4 카테고리 spec). P3 의 cap-bend 5 회차 평균 +58% over ([p3-to-p4-transition.md §2.5](p3-to-p4-transition.md)) precedent 으로 service/controller-with-spec backbone 은 systematic underestimate — estimate 보수적 해석.

### 2.1 P3-deferred carryover 흡수 (option (c) hybrid-parallel)

[p3-to-p4-transition.md §7.2](p3-to-p4-transition.md) 의 option (c) hybrid-parallel 정의상 **P4 와 병행 진행 6 항목** 을 본 P4 시퀀스 표에 흡수 박제:

| P3-deferred 항목 (transition §7.2) | P4 흡수 위치 | 비고 |
| --- | --- | --- |
| **LlmProviderConfig entity** | §2 표 T-0135 (LlmModule scaffold 동반 entity) | LlmModule scope, P4 LLM gateway task 와 병행 박제 |
| **DifficultyMapping entity** | §2 표 T-0136 | LlmModule scope, 3 난이도 슬롯 매핑 |
| **PermissionDeniedRecord entity** | §2 표 T-0144 | audit log, ADR-0007 동반 후보. 외부 통합 권한 부족 감지 R-20/R-33 task 와 동반 ([data-model.md](data-model.md) 책임 module = AssessmentModule) |
| **ADR-0005 cross-cutting field policy** | §3 ADR 후보 list (별도 doc-only direct task) | timezone / soft delete / createdBy audit-source schema-level 격상 — 본 P4 코드 task chain 외 |
| **ADR-0007 audit log schema** | §3 ADR 후보 list + §2 표 T-0144 동반 | PermissionDeniedRecord schema 박제 |
| **AssessmentModule 추출** | §5 Out of scope (별도 pr-mode refactor task) | 현 Assessment/Contribution/Summary 가 UserModule 안 통합 wiring — P4 와 병행 가능 refactor, 본 P4 외부 통합 시퀀스 외 |

(주: [ADR-0008 (auth credential type)](../decisions/ADR-0008-auth-credential-type.md) 은 P3 진행 중 이미 ACCEPTED (T-0079) — transition §7.2 의 deferred 목록에서 제외. [api.md §2](api.md) 가 JWT cookie ACCEPTED 박제.)

## 3. ADR 신설 후보 list

본 task 는 ADR 을 신설하지 **않는다** — 후속 P4 task 가 신설할 ADR 의 candidate list 만 박제. 각 후보는 (a) 어느 task 가 책임 (트리거 시점) (b) 신설 사유 (c) source 명시.

| 후보 ADR | 책임 task (트리거 시점) | 신설 사유 | source |
| --- | --- | --- | --- |
| **(a) Confluence SPACE 탐색 정책** | T-0143 (ConfluenceAdapter 탐색 구현 진입 직전) | Crawling vs page List/Hierarchy 기반 탐색 중 택일. [PLAN.md L84](../PLAN.md) 가 "ADR 로 결정" 명시. ConfluenceModule 의 page 수집 메커니즘 결정. | [PLAN.md L84](../PLAN.md) (R-34) / [modules.md ConfluenceModule row](modules.md) (crawling vs hierarchy 정책은 P4 ADR) |
| **(b) LLM provider 추상화 / 3 난이도 모델 할당** | T-0136 (DifficultyMapping entity + 매핑 backbone 진입 시) | 평가 항목별 난이도 분류 + 어떤 항목이 어떤 난이도 모델로 처리될지 결정. [PLAN.md L86](../PLAN.md) 가 "ADR 로 박제" 명시. LlmGateway 의 provider 추상화 contract + 3 난이도 슬롯 routing 정책. | [PLAN.md L85–86](../PLAN.md) (R-97/R-99~103) |
| **(c) ADR-0006 — LLM API key encryption-at-rest** | T-0135 (LlmProviderConfig entity 진입 task 동반, P3-deferred) | LlmProviderConfig.apiKey 컬럼의 encryption mechanism (PostgreSQL `pgcrypto` / KMS / application-layer envelope encryption 등) 결정. | [data-model.md §7](data-model.md) ("LLM API key 의 encryption-at-rest 구체 mechanism — 별도 보안 ADR") / [p3-to-p4-transition.md §7.2](p3-to-p4-transition.md) |
| **(d) ADR-0007 — Audit log entity schema** | T-0144 (PermissionDeniedRecord entity 진입 task 동반, P3-deferred) | [data-model.md §2](data-model.md) conceptual AuditLog 의 구체 schema 박제. User mutation event (등급 변경 / 평가 삭제 / Import-Export) + 외부 4xx 권한 부족 record 의 영속화 정책. PermissionDeniedRecord 와의 분리/통합 결정. | [data-model.md §2](data-model.md) (conceptual mention) / [p3-to-p4-transition.md §7.2](p3-to-p4-transition.md) |
| **(추가) ADR-0005 — Cross-cutting field policy** | P4 와 병행 별도 doc-only direct task | timezone (UTC vs KST) / soft delete entity 별 적용 표 / `createdBy` audit-source schema-level 격상. P4 신규 entity (LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord) cross-cutting field ad-hoc 적용 방지. | [data-model.md §5](data-model.md) / [p3-to-p4-transition.md §7.2](p3-to-p4-transition.md) |

**합계**: 5 후보 ADR — P4 진행 중 신설 예상. 모두 후속 task 책임이며 본 task 는 후보 list + 트리거 시점 박제만. 각 ADR 의 실제 작성은 각 책임 task 의 권한 (§5 Out of scope).

## 4. 인간 승인 게이트 (CLAUDE.md §5)

P4 는 **새 외부 dependency 추가 (외부 client SDK) + 외부 자격증명 (token / API key) 처리** 가 빈발하는 phase 다. [CLAUDE.md §5](../../CLAUDE.md) 의 "새 외부 dependency 추가 BLOCKED 게이트" 와 "외부 자격증명 필요 BLOCKED 게이트" 가 P4 task chain 중 다음 시점에 **의도적으로 발화** 됨을 사전 박제한다. **본 task 자체는 `pnpm add` 를 실행하지 않으며 게이트 박제만** 한다.

**게이트 발화 시점 inventory** (각 시점은 notifier → STATE.json.humanQuestion → 사용자 결정 의 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED cycle 발화):

1. **GitHub adapter dependency (T-0140)** — `@octokit/rest` 또는 유사 GitHub client 추가. 새 외부 패키지 1+ 종 → BLOCKED 게이트. 동반: **3 GitHub instance token 자격증명** (github.com / github.sec.samsung.net / github.ecodesamsung.com 각 token) 처리 — 외부 자격증명 필요 BLOCKED.
2. **Confluence client dependency (T-0142)** — Confluence REST API SDK 또는 native `fetch` 택일. SDK 추가 시 BLOCKED 게이트. 동반: **Confluence token 자격증명** 처리 — 외부 자격증명 필요 BLOCKED.
3. **LLM provider SDK dependency (T-0137 / T-0138)** — 각 provider SDK (custom = `openai` 호환 / Azure = `@azure/openai` / Anthropic = `@anthropic-ai/sdk` / Gemini = `@google/generative-ai` / OpenAI = `openai`). provider 당 새 외부 패키지 → 각각 BLOCKED 게이트. 동반: **각 LLM API key 자격증명** 처리 (LlmProviderConfig.apiKey encryption-at-rest ADR-0006 동반) — 외부 자격증명 필요 BLOCKED.

**게이트 발화 절차** (각 dependency-추가 task 의 책임, 본 task 는 절차만 박제):

1. 해당 task 의 executor 가 implementer 호출 직전, dependency 추가 + 자격증명 처리의 정당성을 STATE.json.humanQuestions 에 1 entry 로 박제 (정당성: PLAN.md P4 bullet + modules.md adapter leaf 책임 = 외부 통합 필수).
2. STATUS=BLOCKED 반환 → notifier 호출 → 사용자 승인 대기.
3. 사용자 승인 후 다음 turn 의 driver 가 해당 task 재진입 → architect 가 동반 ADR 신설 (필요 시) → implementer 가 `pnpm add` 실행 + adapter / client 구현.
4. tester 가 `pnpm install` 후 `pnpm lint && pnpm build && pnpm test` 정합성 확인.

**게이트 미발화 task** (외부 dependency 0): T-0136 (DifficultyMapping entity) / T-0139 (Admin LLM 지정 endpoint) / T-0141 (GitHub Issue 평가 service) / T-0143 (Confluence 탐색 정책 — ConfluenceAdapter 위에서) / T-0144 (PermissionDeniedRecord entity — token 은 선행 task 게이트에서 처리). T-0135 (LlmModule scaffold) 는 interface 만이면 게이트 없음 — provider SDK 는 T-0137+ 에서 추가.

## 5. Out of scope

본 task 는 **하지 않는다** — 다음 항목은 후속 P4 task 의 책임 ([CLAUDE.md §3](../../CLAUDE.md) cap discipline + over-design 회피, [p3-implementation-plan.md §7](p3-implementation-plan.md) 패턴 mirror):

- **외부 client 코드 작성** — `GithubAdapter` / `ConfluenceAdapter` / 5 provider `LlmGateway` 구현 class 는 각 후속 코드 task (T-0135+) 책임. 본 task 는 task 시퀀스 매핑만.
- **`pnpm add` 실행** — GitHub / Confluence / LLM provider SDK 추가는 각각 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트 발화 대상 (§4). 본 task 는 게이트 시점 박제만, 패키지 추가 0.
- **실 ADR 작성** — §3 은 ADR 후보 list + 트리거 시점 박제만. Confluence 탐색 / LLM 난이도 / ADR-0006 LLM key / ADR-0007 audit log / ADR-0005 cross-cutting 의 실제 작성은 각 후속 pr-mode task.
- **외부 자격증명 처리** — 3 GitHub token / Confluence token / LLM API key 의 실제 secret 처리·encryption 구현은 후속 task + 인간 승인 동반. 본 task 는 secret 0 기재.
- **API endpoint contract 상세** — 각 module 의 controller 시그니처 / DTO shape / status code envelope 는 각 코드 task 가 자체 박제. 본 doc 는 [api.md](api.md) reference 만.
- **migration SQL 작성** — `prisma/migrations/*.sql` (LlmProviderConfig / DifficultyMapping / PermissionDeniedRecord entity) 은 후속 코드 task 책임 (`prisma migrate dev` 자동 생성).
- **AssessmentModule 추출 refactor** — [p3-to-p4-transition.md §7.2](p3-to-p4-transition.md) deferred 항목. 본 doc §2.1 carryover 표에 박제만, 실 refactor 는 별도 pr-mode task (P4 와 병행 가능).
- **Admin LLM 지정 UI (frontend)** — R-96 의 UI 부분은 P6 (Frontend) 책임. 본 doc §2 T-0139 는 backend endpoint 만 mapping.
- **modules.md / api.md / data-model.md 의 P4 entity·module 상세 갱신** — 다른 task. 본 doc 는 기존 architecture doc 을 reference 만.
- **PLAN.md P4 bullet status 표기 갱신** — 별도 follow-up direct task (§Follow-ups). 본 task 는 신규 doc 1 파일만.
- **STATE.phase 변경 / counters 갱신** — driver single-writer 책임 ([CLAUDE.md §9](../../CLAUDE.md)). 본 task 는 doc 신설만 (STATE.phase 는 T-0133 에서 이미 P4-in-progress).

## 6. References

- [docs/PLAN.md](../PLAN.md) Phase P4 단락 (L79–88) — 본 문서의 1차 source. 7 bullet 의 매핑 대상.
- [docs/architecture/INDEX.md](INDEX.md) — architecture document 목록 + MVA 원칙. 본 문서가 row 신규 추가 대상.
- [docs/architecture/modules.md](modules.md) — T-A4 산출물. GithubModule / ConfluenceModule / LlmModule (외부 adapter leaf) + AssessmentModule. 본 표 "책임 module" 컬럼 source.
- [docs/architecture/data-model.md](data-model.md) — T-0031 산출물. LlmProviderConfig (다중 row) / DifficultyMapping (3 row 고정) / PermissionDeniedRecord (외부 4xx event) entity scope source.
- [docs/architecture/api.md](api.md) — T-0030 산출물. §2 Auth credential (ADR-0008 JWT cookie ACCEPTED) + 외부 통합 endpoint contract source.
- [docs/architecture/p3-implementation-plan.md](p3-implementation-plan.md) — P3 entry artifact (T-0032). 본 문서가 mirror 한 8 컬럼 표 + ADR 후보 + 인간 승인 게이트 + Out of scope 구조 템플릿.
- [docs/architecture/p3-to-p4-transition.md](p3-to-p4-transition.md) §7 (binding decision option (c) hybrid-parallel) + §7.2 (P4 와 병행 deferred 6 항목) — P4 carryover source.
- [docs/decisions/ADR-0002-db.md](../decisions/ADR-0002-db.md) — PostgreSQL + Prisma ACCEPTED. P4 entity Prisma model 의 persistence 기반.
- [docs/decisions/ADR-0003-deployment.md](../decisions/ADR-0003-deployment.md) §4 — 외부 adapter module 의 direct egress. GithubModule / ConfluenceModule / LlmModule 의 외부 HTTPS 호출 정책.
- [docs/decisions/ADR-0008-auth-credential-type.md](../decisions/ADR-0008-auth-credential-type.md) — JWT cookie ACCEPTED (T-0079). 외부 통합 endpoint 의 RBAC 보호 기반.
- [CLAUDE.md](../../CLAUDE.md) §3.1 (commitMode) / §3.2 (R-110~R-114) / §5 (HITL 새 dependency·자격증명 BLOCKED) — 본 표 "인간 승인 게이트" 컬럼 source.
- [docs/requirements.md](../requirements.md) — REQ-NNN source of truth. 본 task frontmatter coversReq 11 REQ source (R-30/R-33/R-34/R-96/R-97/R-99~103/R-20).
- 본 doc 머지 commit SHA — T-0134 머지 후 driver bookkeeping 단계에서 갱신 (placeholder).

Refs: T-0134, T-0133, T-0032, ADR-0002, ADR-0003, ADR-0006, ADR-0007, ADR-0008, REQ-020, REQ-030, REQ-033, REQ-034, REQ-096, REQ-097, REQ-099, REQ-100, REQ-101, REQ-102, REQ-103
