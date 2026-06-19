---
id: ADR-0047
title: "export full-record DB-read 범위 + REQ-032 raw-미저장/secret 제외 경계 확정 (entity 별 컬럼 allow/deny-list + projection-only 강제)"
status: ACCEPTED
date: 2026-06-19
relatedTask: T-0513
relatedReq: [REQ-030, REQ-032]
supersedes: null
---

# ADR-0047 — export full-record DB-read 범위 + REQ-032 raw-미저장/secret 제외 경계

> 본 ADR 은 사용자가 [Q-0043](../STATE.json) 을 **옵션1 (게이트1 service-layer 배선 code chain 승인)** 으로 결정한 직후, 그 chain 의 **ADR-우선 첫 step** 이다. [ADR-0046](ADR-0046-export-dump-materialization-storage.md) 이 (1) materialization 전략 (in-process Node `Readable` streaming) 과 (2) artifact 저장 위치 (응답 본문 직접 streaming, 영속 저장 0) 를 박제했고 §Decision3 이 "materialization 입력 envelope 가 **이미 raw-free**" 라고 **전제** 했으나, 그 envelope 를 채우는 **신규 full-record repository query 가 entity 별로 정확히 어떤 컬럼을 read 하고 어떤 컬럼 (raw / secret) 을 제외하는지** 는 닫지 않았다. 본 ADR 이 그 미확정 잔여 — full-record DB-read 의 **컬럼-수준 allow/deny 경계** 와 **REQ-032 raw-미저장 경계** — 를 닫는다.
>
> **ADR-0046 의 sequel 임 (충돌 아니라 보완)**: 본 ADR 은 ADR-0046 의 어떤 결정도 뒤집지 않는다. ADR-0046 §Decision3 의 4 invariant (새 dep 0 · in-process · descriptor single-source · raw 미저장) 를 **보존** 한 채, 그 §Decision3 이 "전제" 로만 남긴 "envelope 가 raw-free" 를 **entity 별 컬럼 경계로 실증** 한다. 즉 ADR-0046 이 "byte → 다운로드 / 어디에 두나" 를 닫았다면, 본 ADR 은 그 byte 의 **입력 record 가 DB 에서 어떤 컬럼으로 채워지는가** 를 닫는다.
>
> **Status `ACCEPTED` 의 근거와 한계**: 사용자 Q-0043 옵션1 승인이 service-layer 배선 chain 진입을 허가했고, 본 ADR 은 그 chain 의 첫 결정으로서 **새 외부 dependency 0 옵션** (기존 Prisma 의 projection-only `select` 만 사용) 을 채택하므로 `ACCEPTED` 다. 외부 object-storage 채택은 본 ADR 이 내리지 않으며 — 그것은 새 외부 dependency 이므로 [CLAUDE.md §5](../../CLAUDE.md) 에 따라 [ADR-0046 §Alternatives A](ADR-0046-export-dump-materialization-storage.md) 그대로 **별도 사용자 게이트** (Q-NNNN + 새 ADR) 로 분리한다. 본 ADR 은 어떤 새 dependency / credential 도 추가하지 않는다.

## Context

[UC-07](../use-cases/UC-07-export-import.md) 의 Export 흐름 ([REQ-030](../requirements.md)) 은 Admin 이 평가 자료를 read-only 로 dump 해 다운로드한다. 현 [export-job.service.ts](../../src/export/export-job.service.ts) 의 `previewSelection`/`collectExportRecords` 는 의도적으로 5 entity 에서 **`{instant}` projection 1 컬럼만** Prisma `select` 로 read 한다 (`EXPORT_ENTITY_SOURCES` 의 `instantColumn`) — preview 는 selected/excluded count 요약만 필요하므로 전체 record 본문이 불요하고, 이 projection-only 가 REQ-032 를 자연 보존했다.

그러나 실 다운로드 materialization 은 [export-dump.ts](../../src/export/export-dump.ts) 의 `buildExportDump` 가 채우는 `ExportDump.records` payload 를 **전체 record 본문** 으로 채워야 한다 ([export-scope-select.ts](../../src/export/export-scope-select.ts) 의 `ExportRecord` 가 현재 `{entity, instant}` 만 보유하므로, full-record 확장이 후속 코드 task 의 대상). 이 full-record read 는 **새 query 표면** 을 연다 — preview 의 1-컬럼 projection 과 달리, master/평가 record 의 여러 컬럼을 read 한다. 이때 **어떤 컬럼을 allow 하고 어떤 컬럼을 deny 하는지** 가 미확정이면 두 위험이 생긴다:

- **(위험1) raw 외부 본문 read** — REQ-032 (🔥 "Raw data 저장 금지 — 평가 결과만 보유") 위반. 단 본 5 entity 의 schema 는 이미 raw 본문 컬럼을 두지 않는다 (Contribution 의 `sourceUrl`/`sourceRef` pointer 패턴, PermissionDeniedRecord 의 token-없는 audit 컬럼). 따라서 위험1 은 entity 별로 "raw 컬럼 부재" 를 실증하면 닫힌다.
- **(위험2) secret 컬럼 dump 포함** — export 대상 5 entity 중 `LlmConfig` (→ Prisma [`LlmProviderConfig`](../../prisma/schema.prisma)) 는 **`apiKey` (LLM provider API key — 암호화 secret)** 컬럼을 보유한다. full-record read 가 이 컬럼을 dump 에 포함하면 secret 이 Admin 다운로드 파일로 유출된다. 이는 [CLAUDE.md §5](../../CLAUDE.md) (Security/auth · secret 처리) 경계를 직접 건드린다.

핵심 외력:

- **[Q-0043 decision](../STATE.json)** — 사용자가 옵션1 (service-layer 배선 chain) 으로 resolve. 그 decision 의 명시된 첫 step 이 "ADR-0046 §Decision3 invariant 하에서 DB-read 범위·REQ-032 raw-미저장 경계 확정" — 본 ADR 이 정확히 그 산출물.
- **[ADR-0046 §Decision3](ADR-0046-export-dump-materialization-storage.md)** — materialization 4 invariant (새 dep 0 · in-process · descriptor single-source · raw 미저장). 본 ADR 이 이를 보존하며 컬럼 경계로 보완.
- **[ADR-0044 §2](ADR-0044-export-import-job-persistence.md)** — ExportJob 의 raw 미저장 invariant + `artifactRef` 는 pointer (본문 아님). 본 ADR 의 조부.
- **[ADR-0006](ADR-0006-assessment-data-model.md) / [ADR-0022](ADR-0022-permission-denied-record-data-model.md)** — Contribution / PermissionDeniedRecord 의 raw 미저장 schema-level 강제 동형 기법 (raw 컬럼 부재 = 저장 불가). full-record read 가 끌어올 raw 컬럼이 애초에 schema 에 없다는 실증의 근거.
- **[ADR-0033](ADR-0033-evaluation-result-persistence.md)** — "새 dependency 0 / 새 credential 0" 선례. 본 ADR 도 동일 invariant (Node 내장 + 기존 Prisma 만).
- **[ADR-0003 §1](ADR-0003-deployment.md)** — monolithic in-process. full-record read 도 같은 process 의 Prisma query.
- **[REQ-032](../requirements.md)** — raw 미저장 source of truth.

## Decision

### Decision §1 — full-record DB-read 범위 (entity 별 컬럼 allow-list)

**채택: materialization 이 `ExportDump.records` 를 채우기 위해 read 하는 컬럼은 entity 별로 아래 표의 allow-list 로 한정한다. allow-list 외 컬럼 (특히 secret) 은 Prisma `select` 에 명시하지 않아 query 단계에서 애초에 read 되지 않는다 (deny = select 부재). preview 의 `{instant}` 1-컬럼 projection 이 full-record read 로 확장될 때, 그 확장은 "전체 row read (`findMany()` 무인자)" 가 아니라 "본 allow-list 컬럼만 명시 `select`" 여야 한다 — query 표면 확대는 컬럼 단위로 통제된다.**

5 entity 별 컬럼 경계 ([prisma/schema.prisma](../../prisma/schema.prisma) 정의 기준):

| entity (ExportEntity → Prisma model) | dump 포함 컬럼 (allow-list) | 제외 컬럼 (deny-list) | 근거 |
| --- | --- | --- | --- |
| `Assessment` → `Assessment` | `id`, `personId`, `period`, `scope`, `periodStart`, `difficulty`, `contributionScore`, `volume`, `narrative`, `createdAt` | (없음 — 전 컬럼이 derived 평가 결과) | 평가 결과 record. raw 외부 본문 컬럼 0 (ADR-0006 §4 — Contribution 측이 pointer 만 보유). `narrative` 는 LLM 산출 derived 텍스트 (raw 아님). |
| `Person` → `Person` | `id`, `fullName`, `email`, `active`, `partId`, `createdAt`, `updatedAt` | (없음 — master record 식별 컬럼) | 인원 master record. relation 배열 (`serviceIdentities`/`groups`/`assessments`/`summaries`) 은 scalar 아님 → 본 record-level dump 에 미포함 (entity 별 분리 dump). secret 0. |
| `Group` → `Group` | `id`, `name`, `createdAt`, `updatedAt` | (없음) | grouping master record. secret / raw 0. |
| `LlmConfig` → `LlmProviderConfig` | `id`, `provider`, `endpointUrl`, `modelId`, `createdAt`, `updatedAt` | **`apiKey` (🔥 암호화 LLM API key — secret, 명시 deny)** | LLM provider 설정 master. `apiKey` 는 외부 LLM 호출 자격증명 → dump 유출 시 보안 사고. `endpointUrl`/`provider`/`modelId` 는 비-secret 설정값. |
| `AuditLog` → `PermissionDeniedRecord` | `id`, `provider`, `instanceRef`, `resourceRef`, `principal`, `httpStatus`, `reason`, `createdAt` | (없음 — schema 가 token/본문 컬럼 미정의, ADR-0022) | append-only audit row. `instanceRef`/`resourceRef` 는 참조 식별자 (token 미포함, ADR-0022 §1), 응답 본문 컬럼 schema 부재 → raw read 자리 0. |

**query 표면 변화 박제**: preview 는 `delegate.findMany({ select: { [instantColumn]: true } })` (1 컬럼). full-record read 는 `delegate.findMany({ select: { <allow-list 컬럼>: true, ... } })` 로 확장하되 **deny 컬럼 (`LlmProviderConfig.apiKey`) 의 key 를 `select` 객체에 절대 넣지 않는다**. `EXPORT_ENTITY_SOURCES` 매핑표 ([export-job.service.ts](../../src/export/export-job.service.ts)) 가 instant 컬럼 single-source 였듯, full-record allow-list 도 동일하게 매핑표 (또는 entity 별 select 상수) 로 single-source 화해 drift 0 으로 둔다 (구체 코드 형태는 후속 task — 본 ADR 은 컬럼 경계만 박제).

### Decision §2 — REQ-032 raw-미저장 + secret 제외 경계

**채택: 본 ADR 은 (a) full-record read 가 raw 외부 본문을 포함하지 않음을 entity 별로 논증하고, (b) `LlmProviderConfig.apiKey` (및 향후 추가될 임의 secret 컬럼) 를 dump allow-list 에서 명시 제외 (deny-list) 하며, (c) deny 컬럼이 query 단계에서 애초에 read 되지 않도록 projection-only (`select` 명시) 방식을 강제한다.**

- **(a) raw-미저장 논증 (entity 별)**: 5 entity 의 schema 는 raw 외부 본문 (commit body / diff / PR body / page 본문 / 외부 응답 body) 컬럼을 **하나도 정의하지 않는다** — 이는 ADR-0006 §4 (Contribution 이 `sourceUrl`/`sourceRef` pointer 만 보유) · ADR-0022 (PermissionDeniedRecord 가 token/응답본문 컬럼 미정의) · ADR-0044 §2 (ExportJob 이 `artifactRef` pointer + `error` 요약만) 의 "raw 컬럼 부재 = 저장 불가" 동형 기법의 귀결이다. allow-list 의 모든 컬럼은 derived 평가 결과 (`Assessment.contributionScore`/`narrative` 등) 이거나 master 식별/설정 scalar (`Person.email`, `Group.name`, `LlmProviderConfig.endpointUrl` 등) 이거나 참조 식별자 (`PermissionDeniedRecord.resourceRef`) 다 — raw 본문 0. 따라서 full-record read 가 raw 를 새로 끌어올 **자리 자체가 없다** (REQ-032 정합).
- **(b) secret deny-list**: `LlmProviderConfig.apiKey` 는 dump allow-list 에서 **명시 제외** 한다. 이 컬럼은 외부 LLM 호출 자격증명 (암호화 저장) 이며 평가 결과 / master 설정의 "사람이 다운로드해 보관할 자료" 범위 밖이다. 향후 어떤 entity 든 secret / 자격증명 / token 컬럼이 추가되면 동일하게 deny-list 에 박제한다 (allow-list 는 명시적 opt-in — 새 컬럼은 default deny).
- **(c) projection-only 강제 (deny 의 강제 메커니즘)**: deny 는 "read 후 application-layer 에서 strip" 이 아니라 **"Prisma `select` 에 deny 컬럼 key 를 넣지 않음"** 으로 강제한다. 이로써 secret 은 query 결과 객체에 **애초에 담기지 않아** 메모리/로그/직렬화 어느 단계에도 노출되지 않는다 (전체 row read 후 strip 하는 방식은 secret 이 메모리에 잠시라도 올라오므로 미채택 — §Alternatives A). 이는 preview 의 `{instant}` projection-only (REQ-032 안전 선례) 와 동일 기법의 full-record 확장이다.

### Decision §3 — 후속 구현 invariant 박제

**채택: 본 ADR 을 따르는 후속 materialization service 함수 / repository query / controller 는 다음 invariant 를 강제한다.**

- **(i) ADR-0046 §Decision3 의 4 invariant 보존**: (1) 새 외부 dependency 0, (2) in-process 완결 (별도 worker/broker/외부 storage hop 0), (3) descriptor single-source ([buildExportArtifactDescriptor](../../src/export/export-artifact-descriptor.ts) 산출물 그대로 직렬화), (4) raw 미저장 — 본 ADR 이 이를 컬럼 경계로 보강.
- **(ii) allow-list 컬럼만 `select` (deny 컬럼 read 금지)**: 후속 full-record repository query 는 §Decision1 표의 allow-list 컬럼만 `select` 에 명시한다. `LlmProviderConfig` read 시 `apiKey` 를 `select` 에 **절대 포함하지 않는다**. 전체 row read (`findMany()` 무인자 / `select` 생략) 금지 — 명시 projection 만.
- **(iii) 새 외부 dependency / 새 credential 0**: full-record read 는 Node 내장 + 기존 Prisma/PostgreSQL 만 사용한다 (preview 의 projection-only 패턴 확장). 새 dependency / credential 이 필요해지면 그 task 는 [CLAUDE.md §5](../../CLAUDE.md) BLOCKED → 별도 사용자 게이트.

## Consequences

### 긍정

- **REQ-032 raw-미저장 + secret 유출 표면 0** — allow-list 가 명시 opt-in 이라 새 컬럼은 default deny, secret (`apiKey`) 은 projection-only 로 query 단계에서 read 자체가 안 된다. raw 본문은 schema 에 자리가 없어 끌어올 곳이 없다.
- **새 외부 dependency 0 / 새 credential 0** — 기존 Prisma `select` projection 만 확장 ([ADR-0033](ADR-0033-evaluation-result-persistence.md) 선례 정합). [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 게이트 미발화.
- **ADR-0046 §Decision3 의 "envelope 가 raw-free" 전제가 실증됨** — 후속 materialization 코드 task 가 컬럼 경계를 contract 로 받아 바로 배선 가능. preview 의 projection-only 선례와 동일 기법이라 학습 비용 0.
- **single-source allow-list 로 drift 0** — `EXPORT_ENTITY_SOURCES` 의 instant single-source 패턴을 full-record allow-list 로 확장해, entity 추가/컬럼 변경 시 한 곳만 갱신.

### 부정 / trade-off

- **schema 변경 시 allow-list 동기 의무** — entity 에 새 컬럼이 추가되면 allow-list 를 명시 갱신해야 dump 에 포함된다 (default deny 이므로). 이는 의도된 trade-off — secret 의 실수 포함보다 derived 컬럼의 실수 누락이 안전하다 (회귀 test 가 allow-list 멤버십을 단언하면 누락도 catch).
- **relation/nested 컬럼 미포함** — 본 ADR 은 scalar 컬럼 allow-list 만 박제한다. Person 의 `assessments[]` 등 relation 배열은 entity 별 분리 dump 로 표현되며, nested include 의 깊이/순환 정책은 후속 materialization task 가 별도 결정 (본 ADR 범위 밖 — §Out of scope).
- **암호화 secret 의 복호화 정책 미결** — `apiKey` 는 deny 라 dump 무관이나, 만약 향후 "재구성 가능한 export" 요구로 secret 의 안전한 재배포가 필요해지면 별도 보안 ADR + 사용자 게이트 (현 ADR 은 deny 만).

### Cross-Module Impact

본 결정은 기존 export contract 를 바꾸지 않고 **추가** 한다 (full-record allow-list 는 후속 repository query 의 select 표면 — 기존 `previewSelection`/`collectExportRecords` 의 instant projection 은 보존, 변경 0). 영향 module 은 **AssessmentModule 1 개로 한정** ([ADR-0044](ADR-0044-export-import-job-persistence.md) Decision §1 — `/api/admin` = AssessmentModule controller / [ADR-0046 §Consequences](ADR-0046-export-dump-materialization-storage.md) 정합) — full-record read 를 호출하는 inbound caller 는 후속 materialization service/controller 뿐이고 Prisma delegate 접근은 기존 `EXPORT_ENTITY_SOURCES` 경로 그대로다. ≥3 module spread 아님 → [CLAUDE.md §5](../../CLAUDE.md) BLOCKED 미해당.

## Alternatives considered

### A. 전체 row read 후 application-layer 에서 secret strip (미채택)

각 entity 를 `findMany()` (또는 `select` 생략) 으로 전체 row read 한 뒤 application 코드에서 `apiKey` 등 secret 필드를 삭제 (`delete row.apiKey`) 해 dump 에 담는 안. 장점: query 가 단순 (컬럼 열거 불요). 미채택 — secret 이 **query 결과 객체에 잠시라도 메모리에 올라오므로** (직렬화 직전까지 잔류 / 로그·에러·디버거 노출 risk) projection-only deny 보다 표면이 넓다. REQ-032/보안 정신상 "애초에 read 하지 않음" 이 "read 후 지움" 보다 강한 보장이다. preview 가 이미 projection-only 선례를 박제했으므로 본 안과 일관성도 깨진다.

### B. full-record DB-read 범위 확정을 별도 게이트로 추가 미루기 (미채택)

본 ADR 을 작성하지 않고 컬럼 경계 결정을 후속 materialization 코드 task 안으로 흡수하거나 또 다른 사용자 게이트로 미루는 안. 미채택 — 사용자 Q-0043 옵션1 이 **이미 service-layer 배선 chain 방향을 승인** 했고, 그 decision 이 "DB-read 범위·REQ-032 경계 확정" 을 chain 의 명시된 첫 step 으로 지정했다. 컬럼 경계 (특히 secret deny) 는 persistence/security 결정 ([CLAUDE.md §1](../../CLAUDE.md) "코드보다 ADR 이 먼저") 이라 코드 task 안에 묻으면 reviewer 점검 표면이 흐려진다. 별도 ADR 로 박제해 후속 코드 task 의 contract source 로 두는 편이 안전하다.

## Out of scope

본 ADR 은 **컬럼-수준 DB-read 경계 결정만** 한다 — 다음은 후속 task / 별도 ADR 책임:

- **실 service-layer materialization 함수 구현** (`ExportDump` → Node `Readable` → 응답) — 후속 task (`commitMode: pr`, ADR-0046 §Decision1 기반).
- **`GET /api/admin/export/:id/download` streaming controller 배선** — 후속 task.
- **full-record 를 read 하는 신규 repository query 의 실 코드** (본 allow-list 를 `select` 로 옮기는 구현) — 후속 task.
- **`ExportRecord` 타입의 full-record 확장 실 코드** (`{entity, instant}` → 전체 record) — 후속 task (본 ADR 은 확장 방향·컬럼만 결정).
- **relation/nested include 의 깊이·순환 정책** — 후속 materialization task (본 ADR 은 scalar allow-list 만).
- **chunk 단위 직렬화 / 로컬 임시 dir retention/cleanup** — 후속 task ([ADR-0046 §Out of scope](ADR-0046-export-dump-materialization-storage.md) 정합).
- **외부 object-storage 도입** — 새 외부 dependency 이므로 별도 사용자 게이트 (Q-NNNN) + 새 ADR ([ADR-0046 §Alternatives A](ADR-0046-export-dump-materialization-storage.md)).
- **import / restore 측 역직렬화** — 별도 chain.
- 코드 변경 일절 (`src/` / `test/` / `prisma/` 수정 0) — 본 ADR 은 결정 전용 0 LOC.

## Follow-ups

(ADR ACCEPTED 후 planner 가 dependency-free chain 으로 분해 — 각 ≤300 LOC / ≤5 파일 + R-112.)

- (후속) T-NNNN: `ExportRecord` full-record 확장 + entity 별 allow-list `select` 상수 single-source 화 (deny 컬럼 미포함 + R-112 negative — `apiKey` 가 select 결과에 부재함을 단언하는 test) — `commitMode: pr`, Decision §1·§2 기반.
- (후속) T-NNNN: 실 service-layer materialization 함수 (`ExportDump` → Node `Readable` stream, allow-list full-record read + descriptor 메타) — Decision §3 기반.
- (후속) T-NNNN: AssessmentModule `GET /api/admin/export/:id/download` streaming controller 배선 (descriptor 헤더 직렬화 + Readable pipe) — Decision §3 기반.
- (후속) T-NNNN: chunk-plan 기반 chunk 단위 직렬화 + chunk helper (`export-chunk-*`) 실 byte slice 배선 — ADR-0046 §Decision1 맞물림 절 기반.
- (후속, 별도 게이트) 외부 object-storage 가 실측으로 요구되면 Q-NNNN 사용자 게이트 + 새 ADR — 본 ADR 이 직접 발급하지 않음.

## References

- [docs/decisions/ADR-0046-export-dump-materialization-storage.md](ADR-0046-export-dump-materialization-storage.md) — §Decision1·2·3 (materialization·저장·4 invariant) — 본 ADR 의 직접 상류 (sequel)
- [docs/decisions/ADR-0044-export-import-job-persistence.md](ADR-0044-export-import-job-persistence.md) — ExportJob entity + `artifactRef` pointer + §2 raw 미저장 invariant (조부)
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](ADR-0033-evaluation-result-persistence.md) — "새 dep 0 / 새 credential 0" 선례 + ADR template
- [docs/decisions/ADR-0022-permission-denied-record-data-model.md](ADR-0022-permission-denied-record-data-model.md) — PermissionDeniedRecord 의 token/본문 컬럼 미정의 (raw 미저장 schema-level 강제)
- [docs/decisions/ADR-0006-assessment-data-model.md](ADR-0006-assessment-data-model.md) — Contribution 의 pointer(`sourceUrl`/`sourceRef`)-only / raw 본문 컬럼 0 선례
- [docs/decisions/ADR-0003-deployment.md](ADR-0003-deployment.md) — §1 monolithic in-process (full-record read 도 같은 process Prisma query)
- [docs/decisions/ADR-0002-db.md](ADR-0002-db.md) — PostgreSQL + Prisma stack (projection-only select source)
- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) — `previewSelection`/`collectExportRecords` 의 `{instant}` projection-only (REQ-032 안전 선례) + `EXPORT_ENTITY_SOURCES` 5 entity 매핑
- [src/export/export-dump.ts](../../src/export/export-dump.ts) — `ExportDump` envelope + `ExportRecord` (materialization 입력 contract)
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) — `ExportEntity` 5 union + `ExportRecord` 타입 (full-record 확장 대상)
- [prisma/schema.prisma](../../prisma/schema.prisma) — 5 export entity 컬럼 정의 (특히 `LlmProviderConfig.apiKey` secret deny source)
- [docs/architecture/data-model.md](../architecture/data-model.md) — L171 artifact 저장소 deferred (ADR-0046 이 닫은 부분 + 본 ADR 이 닫는 DB-read 부분)
- [docs/STATE.json](../STATE.json) — Q-0043 decision (옵션1 — 본 ADR 의 외력)
- [README.md](../../README.md) — REQ-030 (Export) / REQ-032 (raw 미저장)
- [CLAUDE.md §3.1 / §5 / §12](../../CLAUDE.md) — commitMode / BLOCKED 게이트 / 언어 정책

Refs: T-0513, ADR-0047, ADR-0046, ADR-0044, ADR-0033, ADR-0022, ADR-0006, ADR-0003, ADR-0002, REQ-030, REQ-032, Q-0043
