---
id: T-0520
title: export full-record download endpoint live-DB e2e-spec 추가
phase: P5
status: DONE
mergedAs: 56d7c9b
prNumber: 433
reviewRounds: 2
completedAt: 2026-06-19T11:01:13Z
commitMode: pr
coversReq: [REQ-030, REQ-032]
estimatedDiff: 260
estimatedFiles: 1
created: 2026-06-19
dependsOn: []
touchesFiles:
  - test/e2e/export-download.e2e-spec.ts
plannerNote: P5 export download chain — ADR-0047 §Follow-ups 잔여 live-DB e2e-spec. T-0519 controller 까지 완결, 실 PostgreSQL roundtrip 검증만 남음.
---

# T-0520 — export full-record download endpoint live-DB e2e-spec 추가

## Why

ADR-0047 §Follow-ups 의 마지막 잔여 조각이다. export full-record download chain 은 순수 helper(T-0507~T-0517) → service-layer 배선(T-0518 `materializeFullExportDownload`) → HTTP streaming controller(T-0519 `GET /api/admin/export/:id/download`)까지 완결됐으나, 지금까지의 검증은 전부 unit + supertest(in-memory mock) 수준이다. R-113(README 113행)은 unit 외에 **end-to-end test 도 CI 에서 함께 수행**할 것을 요구하므로, 실 PostgreSQL roundtrip(5 entity seed → export job 생성 → download 호출 → full-record dump 본문 검증)을 거치는 live-DB e2e-spec 1개를 추가해 chain 을 닫는다. 특히 REQ-032(raw 미저장 경계) 의 핵심 회귀 — `LlmProviderConfig.apiKey` secret 이 다운로드 응답 본문에 **부재함**을 실 DB 경로로 단언하는 것이 본 task 의 가장 중요한 negative case 다.

## Required Reading

- `src/export/export.controller.ts` — `download()` 핸들러(`@Get(":id/download")`, line 337~411): findJob → materializeFullExportDownload → serializeExportDownloadHeaders → StreamableFile 흐름과 404 raw propagate 동작.
- `src/export/export-job.service.ts` — `materializeFullExportDownload`, `collectFullExportRecords`, `EXPORT_ENTITY_SOURCES` 5 entity 매핑(seed 대상 entity 확인용).
- `src/export/export-entity-full-record-select.ts` — `EXPORT_ENTITY_FULL_RECORD_SELECT` allow-list(특히 `LlmProviderConfig` select 에 `apiKey` 부재 — secret deny projection-only).
- `test/e2e/permission-denied-records.e2e-spec.ts` — 동형 Admin RBAC e2e 패턴(beforeAll/afterAll 구조, actor seed, truncate, supertest 호출, 한국어 describe/it 문자열 스타일).
- `test/helpers/auth-e2e-helper.ts` — `createAuthenticatedE2EApp`, `issueAccessTokenFor`, `buildAuthCookie`, `SeedUserRole`, `AuthenticatedE2EContext` 시그니처.
- `test/helpers/db-truncate.ts` — `truncateAll(prisma)`(beforeEach/afterAll 정리), `TRUNCATE_TABLES`(seed 가능 테이블 목록 확인).
- `test/jest-e2e.json` — e2e testRegex(`.*\.e2e-spec\.ts$`)·globalSetup·`maxWorkers: 1` — 새 spec 이 자동 픽업됨을 확인(설정 변경 불요).
- `prisma/schema.prisma` — 5 export entity(특히 `LlmProviderConfig.apiKey`)의 seed 에 필요한 필수 컬럼.

## Acceptance Criteria

`pnpm test:e2e` 로 실행되는 새 spec `test/e2e/export-download.e2e-spec.ts` 1개를 추가한다. 모든 case 는 실 PostgreSQL(globalSetup) + `createAuthenticatedE2EApp` 위에서 동작해야 한다.

- [ ] **Happy path**: Admin 토큰으로 (a) export job 생성(POST) → (b) `GET /api/admin/export/:id/download` 호출 시 200 + `Content-Type`/`Content-Disposition` 다운로드 헤더 존재 + 응답 본문이 5 entity seed 데이터를 담은 full-record dump(파싱 가능한 JSON, `records`/`meta` 구조) 임을 단언. 최소 1 entity 에 대해 `fields` 가 instant 외 실제 컬럼을 보존함을 확인.
- [ ] **Error path**: 존재하지 않는 export job id 로 download 호출 시 404(findJob `NotFoundException` raw propagate) 단언.
- [ ] **Flow / branch cover**: (1) seed 데이터 0건(빈 DB)인 export job 의 download → 200 + 빈/0-record dump 경계, (2) 데이터 1+건 dump 의 두 분기를 각각 case 로 분리.
- [ ] **Negative cases 충분 cover** — 각 1+ test:
  - 인증 없음(쿠키/토큰 부재) → 401.
  - non-Admin(User 역할) 토큰 → 403(RolesGuard).
  - **(핵심 회귀, REQ-032)** `LlmProviderConfig`(또는 secret 보유 entity) 를 실 DB 에 `apiKey` 값과 함께 seed 한 뒤 download → 응답 본문 JSON 전체에 그 apiKey secret 문자열이 **부재**함을 단언(`expect(bodyText).not.toContain(<seed apiKey>)` + 파싱된 record 의 fields 에 `apiKey` key 부재). secret 이 실 DB-read 경로를 통과해도 다운로드에 누출되지 않음을 실증.
- [ ] **Coverage**: e2e 는 `coverageThreshold` 게이트 대상이 아니나(unit `pnpm test:cov` 가 별도 게이트), 본 spec 이 production code 를 변경하지 않으므로 기존 unit coverage(line ≥ 80% / function ≥ 80%) 가 유지됨을 `pnpm test:cov` 통과로 확인.
- [ ] `pnpm lint && pnpm build && pnpm test:e2e` 모두 통과(tester 가 실행 결과 trail 박제).
- [ ] describe/it 문자열·주석은 한국어(§12), 식별자/경로/HTTP status/header 이름은 영어 유지.
- [ ] `afterAll` 에서 `app.close()` + `prisma.$disconnect()`(또는 helper 가 제공하는 teardown) 로 connection 누수 방지.

## Out of Scope

- production code(`src/`) 변경 일절 — 본 task 는 test 추가만. 다운로드 동작에 결함이 발견되면 고치지 말고 Follow-ups 에 기록(별도 patch task).
- chunked/range download e2e — 본 spec 은 단일 full-record download(StreamableFile 단일 stream) 경로만. chunk-plan byte slice e2e 는 별도 chain.
- import/restore 측 e2e — 별도 chain(게이트3 미승인 multer upload 표면 포함).
- `test/jest-e2e.json`·CI workflow 변경 — testRegex 가 새 spec 을 자동 픽업하므로 설정 수정 불요.
- 새 e2e helper 추가 — 기존 `auth-e2e-helper`/`db-truncate` 로 충분. 부족 시에만 최소 helper 확장(그래도 1 파일 cap 유지).

## Suggested Sub-agents

`implementer → tester` (production code 변경 0 — architect 불요. e2e spec 작성 후 tester 가 실 DB 위 `pnpm test:e2e` 실행 결과 검증).

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 append)
