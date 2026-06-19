---
id: T-0513
title: export full-record DB-read 범위 + REQ-032 raw-미저장 경계 확정 ADR (ADR-0047)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 0
estimatedFiles: 1
created: 2026-06-19
independentStream: export-download-materialization
dependsOn: []
touchesFiles:
  - docs/decisions/ADR-0047-export-dump-db-read-scope.md
plannerNote: "Q-0043 옵션1 chain 첫 step — ADR-0046 §Decision3 미확정 잔여(full-record DB-read 컬럼 경계·REQ-032 raw 제외)를 닫는 새 ADR. §3.1 rule4 새 ADR=pr."
---

# T-0513 — export full-record DB-read 범위 + REQ-032 raw-미저장 경계 확정 ADR (ADR-0047)

## Why

사용자가 [Q-0043](../STATE.json) 을 **옵션1 (게이트1 service-layer 배선 code chain 승인)** 으로 resolve 했다. 그 decision 이 명시한 첫 step 은 "driver/planner 가 ADR-0046 §Decision3 invariant 하에서 **DB-read 범위·REQ-032 raw-미저장 경계를 확정**" 하는 것이다.

[ADR-0046](../decisions/ADR-0046-export-dump-materialization-storage.md) 은 (1) materialization 전략 (in-process Node `Readable` streaming) 과 (2) artifact 저장 위치 (응답 본문 직접 streaming, 영속 저장 0) 를 박제했고, §Decision3 은 "materialization 입력 envelope 가 **이미 raw-free**" 라고 **전제**한다. 그러나 ADR-0046 은 그 envelope 를 채우는 **신규 full-record repository query 가 entity 별로 정확히 어떤 컬럼을 read 하고 어떤 컬럼 (raw / secret) 을 제외하는지** 는 닫지 않았다. 현 [export-job.service.ts](../../src/export/export-job.service.ts) 의 `previewSelection` 은 의도적으로 `{instant}` projection 1 컬럼만 read 하지만 (REQ-032 안전), 실 다운로드 materialization 은 `buildExportDump` 의 `records` payload 를 채우기 위해 **전체 record 본문을 read 하는 새 query 표면** 을 연다.

이는 [REQ-032](../requirements.md) ("🔥 Raw data 저장 금지 — 평가 결과만 보유") 경계를 직접 건드리는 persistence/security 결정이다 — 특히 export 대상 5 entity 중 `LlmConfig`(→ Prisma `LlmProviderConfig`) 는 **암호화된 LLM API key** 를 보유하므로, full-record read 가 그 secret 컬럼을 dump 에 포함하면 안 된다. [CLAUDE.md §3.1 rule4](../../CLAUDE.md) (새 ADR = pr) + [§5](../../CLAUDE.md) (persistence/security 경계) 에 따라 이 chain 의 첫 산출물은 **이 컬럼-수준 DB-read 경계를 박제하는 새 ADR (ADR-0047)** 이며, 이것이 후속 service-layer materialization 함수 + `GET /api/admin/export/:id/download` controller 배선 task 의 contract source 가 된다.

## Required Reading

- [docs/decisions/ADR-0046-export-dump-materialization-storage.md](../decisions/ADR-0046-export-dump-materialization-storage.md) — §Decision1·2·3 (materialization·저장·invariant) + §Out of scope + §Follow-ups 1·2. 본 ADR 의 직접 상류.
- [docs/decisions/ADR-0044-export-import-job-persistence.md](../decisions/ADR-0044-export-import-job-persistence.md) — ExportJob entity + `artifactRef` pointer + §2 raw 미저장 invariant. 본 ADR 의 조부.
- [docs/STATE.json](../STATE.json) — Q-0043 decision (옵션1 — 본 ADR 의 외력) + Q-0042 decision.
- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) — `previewSelection` 의 `{instant}` projection-only read (REQ-032 안전 선례) + `EXPORT_ENTITY_SOURCES` 5 entity → Prisma delegate 매핑 (본 ADR 이 full-record 컬럼 경계를 결정할 대상).
- [src/export/export-dump.ts](../../src/export/export-dump.ts) — `ExportDump` envelope + `ExportRecord` (materialization 입력 contract).
- [src/export/export-scope-select.ts](../../src/export/export-scope-select.ts) — `ExportEntity` 5 union + `ExportRecord` 타입 (현재 `{entity, instant}` 만 — full-record 확장 여부가 본 ADR 결정 대상).
- [docs/architecture/data-model.md](../architecture/data-model.md) L171 — artifact 저장소 deferred 항목 (ADR-0046 이 닫은 부분 + 본 ADR 이 닫을 DB-read 부분).
- [docs/requirements.md](../requirements.md) L51 — REQ-032 source of truth ("Raw data 저장 금지 — 평가 결과만 보유").
- [prisma/schema.prisma](../../prisma/schema.prisma) — 5 export entity (Assessment / Person / Group / LlmProviderConfig / PermissionDeniedRecord) 의 컬럼 정의 — 특히 `LlmProviderConfig` 의 secret(암호화 API key) 컬럼 식별 (allow/deny 결정 source). 필요 부분만 read.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0047-export-dump-db-read-scope.md` 1 개를 신설한다 (frontmatter: id `ADR-0047`, status `ACCEPTED`, relatedTask `T-0513`, relatedReq `[REQ-030, REQ-032]`, supersedes `null`). ADR-0046 의 sequel 임을 §Context 에 명시 (충돌 아니라 보완).
- [ ] **§Decision1 — full-record DB-read 범위**: materialization 이 `ExportDump.records` 를 채우기 위해 read 하는 **entity 별 컬럼 allow-list** 를 박제한다. 5 entity (Assessment / Person / Group / LlmProviderConfig / PermissionDeniedRecord) 각각 "평가 결과 / master record 로서 dump 에 포함되는 컬럼" 과 "제외 컬럼" 을 표로 명시. `previewSelection` 의 `{instant}` projection-only 가 full-record read 로 확장될 때의 query 표면 변화를 박제.
- [ ] **§Decision2 — REQ-032 raw-미저장 + secret 제외 경계**: read 한 full-record 가 (a) raw 외부 본문 (REQ-032 금지 대상) 을 포함하지 않음을 entity 별로 논증, (b) `LlmProviderConfig` 의 **암호화 API key / secret 컬럼은 dump allow-list 에서 명시 제외** (deny-list), (c) projection-only(select 명시) 방식으로 deny 컬럼이 query 단계에서 애초에 read 되지 않도록 강제하는 원칙을 박제한다.
- [ ] **§Decision3 — 후속 구현 invariant**: 후속 materialization service 함수 / repository query / controller 가 지켜야 할 invariant 박제 — (i) ADR-0046 §Decision3 의 4 invariant (새 dep 0 · in-process · descriptor single-source · raw 미저장) 보존, (ii) 본 ADR 의 entity 별 allow-list 컬럼만 `select` (deny 컬럼 read 금지), (iii) 새 외부 dependency / 새 credential 0 (Node 내장 + 기존 Prisma 만 — 새 dep 필요 시 §5 BLOCKED).
- [ ] **§Consequences** (긍정 + 부정/trade-off + Cross-Module Impact): cross-module impact 가 AssessmentModule 1 개로 한정됨을 논증 (≥3 module spread 아님 → BLOCKED 미해당).
- [ ] **§Alternatives considered**: 최소 2 안 — (A) 전체 row read 후 application-layer 에서 secret strip (미채택 — secret 이 메모리에 잠시라도 올라옴, projection deny 가 더 안전), (B) full-record 를 별도 게이트로 추가 미루기 (미채택 — Q-0043 이 이미 방향 승인).
- [ ] **§Out of scope**: 실 materialization service 함수 / repository query 구현 / controller 배선 / chunk 단위 직렬화 / 임시 dir retention 은 후속 task 로 명시 (본 ADR 은 결정 전용 0 LOC).
- [ ] **§Follow-ups**: 후속 chain (materialization service 함수 → download controller → repository DB-query streaming) 을 각 ≤300 LOC / ≤5 파일 + R-112 로 분해 가능하도록 윤곽 박제.
- [ ] **§References**: ADR-0046 / ADR-0044 / ADR-0033(새 dep 0 선례) / ADR-0003(monolithic) / REQ-030 / REQ-032 / Q-0043 + 관련 src 파일 링크.
- [ ] `tester` 호출: 본 task 는 코드 변경 0 (ADR 문서만) 이나 R-110 적용 — production code 변경이 0 LOC 이어도 `pnpm lint && pnpm build && pnpm test` 가 green 임을 tester 가 확인 (문서 추가가 빌드/test 를 깨지 않음 검증). 신규 src/test 파일 0 이므로 신규 unit test 작성은 없음 — 본 ADR 은 결정 전용이라 testable public symbol 신설 0 (분기 없음 — happy/error/branch/negative unit test 항목은 본 task 에 해당 없음, 후속 코드 task 가 R-112 4종 충족).
- [ ] **분기 없음 — R-112 4종 (happy/error/branch/negative) + coverage 80% 항목은 본 ADR-전용 task 에 생략**: 신규 코드/public symbol 0 이라 unit test 대상이 없다. 후속 materialization 코드 task 가 `pnpm test:cov` (line ≥ 80% / function ≥ 80%) 를 강제 cover 한다.
- [ ] PR 본문에 "smoke/e2e 미존재 아님 — 본 task 는 코드 변경 0 ADR" 및 본 task 파일 링크 + acceptance checklist 포함.

## Out of Scope

- 실 service-layer materialization 함수 구현 (`ExportDump` → Node `Readable` → 응답) — 후속 task (본 ADR ACCEPTED 후).
- `GET /api/admin/export/:id/download` streaming controller 배선 — 후속 task.
- full-record 를 read 하는 신규 repository query 의 실 코드 — 후속 task (본 ADR 이 그 컬럼 경계만 박제).
- `ExportRecord` 타입의 full-record 확장 실 코드 변경 — 후속 task (본 ADR 은 확장 방향만 결정).
- chunk 단위 직렬화 / 로컬 임시 dir retention/cleanup 정책 — 후속 task.
- 외부 object-storage 도입 — 별도 사용자 게이트 (ADR-0046 §Alternatives A, 본 ADR 범위 밖).
- import / restore 측 역직렬화 — 별도 chain.
- `src/` / `test/` / `prisma/` 코드 변경 일절 — 본 task 는 ADR 문서 1 개만.

## Suggested Sub-agents

`architect → tester` (architect 가 ADR-0047 작성 — DB-read 컬럼 경계 결정이 핵심; tester 가 lint/build/test green 확인).

## Follow-ups

(작성 시 비어 있음. sub-agent 가 관련 작업 발견 시 append.)
