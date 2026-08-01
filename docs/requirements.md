# Requirements Traceability — README → REQ-NNN

본 문서는 [README.md](../README.md) 의 모든 지시사항을 **추적 가능한 REQ-NNN ID** 로 박제하고, 각 REQ 가 어느 phase / task / code / test 에서 구현·검증되는지 1:1 매핑하는 표다.

## 운영 룰

- **단일 source of truth**: README 의 새 지시 / 수정 / 삭제는 본 문서의 매핑에도 즉시 반영 (planner 가 README 변경을 감지하면 REQ row 갱신).
- **kind enum**: `FR` (Functional Requirement — 사용자 시나리오 / 기능 / 행동) / `NFR` (Non-Functional Requirement — 성능·보안·가용성·확장성·UX 품질) / `Constraint` (외부 제약 — 사용 가능 stack / 외부 시스템 / 정책 / 법적 / 운영).
- **상태 enum**: `PLANNED` (PLAN.md 에 bullet 으로 등록) / `IN_PROGRESS` (대응 task 진행 중) / `DONE` (대응 PR merge 됨) / `BLOCKED` (humanQuestion 발생) / `SUPERSEDED` (해당 REQ 가 다른 REQ 로 대체됨).
- **검증 위치 enum**: `unit` / `smoke` / `e2e` / `perf` / `policy` (정책 / 문서 / agent rule) / `manual` (사람 검증 필요) / `n/a`.
- **하나의 REQ 가 여러 task 에 분포 가능**: "구현 위치" 컬럼에 phase / task 목록을 comma 로.
- 본 표의 본문은 **P1-Entry (T-0013) 가 채웠다** — 66 REQ row 모두 `kind` (FR / NFR / Constraint) 분류 완료, 7 컬럼 schema 로 확장. 이후 README 변경 시 planner 가 본 표를 동기화.

## 매핑 표

7 컬럼 schema (REQ / README 행 / 요약 / kind / 구현 위치 / 검증 위치 / 상태). kind 값: `FR` / `NFR` / `Constraint`.

| REQ | README 행 | 요약 | kind | 구현 위치 (phase/task) | 검증 위치 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | 1 | 본 문서는 Use Case 문서의 기본 | Constraint | P2 | policy | PLANNED |
| REQ-002 | 6 | Web Interface 를 제공하는 Agent System | FR | P6 / P3 | smoke + e2e | IN_PROGRESS |
| REQ-003 | 7 | 개발자 기여 양·질 평가 / 저장 / 표시 | FR | P3 + P5 + P6 | unit + smoke | PLANNED |
| REQ-004 | 9 | 수치 지표 + LLM 평가 코멘트 (사용자 지정 기간) | FR | P5 | unit + e2e | PLANNED |
| REQ-005 | 16 | github.com 평가 | FR | P4 | unit (provider) + e2e | DONE (단일 GithubAdapter + instance-keyed env config 배선, public 은 api.github.com 라우팅 특례 — live 호출은 env-gated) |
| REQ-006 | 17 | github.sec.samsung.net 평가 | FR | P4 | unit + e2e | DONE (같은 GithubAdapter 의 sec instance 경로, GITHUB_LIVE_HOST_SPECS 사양 박제 — live 호출은 env-gated) |
| REQ-007 | 18 | github.ecodesamsung.com 평가 | FR | P4 | unit + e2e | DONE (같은 GithubAdapter 의 ecode instance 경로, GITHUB_LIVE_HOST_SPECS 사양 박제 — live 호출은 env-gated) |
| REQ-008 | 20 | 접근 권한(read) 부족 시 인식·통지 | FR | P4 | unit + smoke | PLANNED |
| REQ-009 | 21 | Fork/Rebase/Meld 중복 제거 + 시간적 중복 (earlier date 우선) | FR | P5 | unit | PLANNED |
| REQ-010 | 24 | 코드 기여 양·질 평가 | FR | P5 | unit | PLANNED |
| REQ-011 | 25 | 중요·어려운 기여 → 높은 점수 ("어렵고 남이 못할 일") | FR | P5 | manual + unit | PLANNED |
| REQ-012 | 26 | 코드 abusing 방지 (commit/PR 숫자만 늘리기) | FR | P5 | unit | DONE (computeAbuseSignal 반복 부풀리기 신호 + applyAbuseSignalToVolume volume 감점, adjustments pipeline 1 순위 배선) |
| REQ-013 | 27 | 저성과자 식별 | FR | P5 | unit | PLANNED |
| REQ-014 | 30 | Issue 평가 (본인 follow-up 소비 제외) | FR | P4 + P5 | unit | PLANNED |
| REQ-015 | 31 | Confluence 지정 SPACE 평가 | FR | P4 | unit + e2e | PLANNED |
| REQ-016 | 33 | Confluence 접근 권한 부족 인식·통지 | FR | P4 | unit | PLANNED |
| REQ-017 | 34 | Confluence SPACE crawling vs hierarchy 탐색 정책 (ADR) | Constraint | P4 (ADR 필수) | policy | PLANNED |
| REQ-018 | 37 | 단순 보고·copy-paste 로그 = zero-contribution | FR | P5 | unit | PLANNED |
| REQ-019 | 38 | 새 알고리즘·외부 연구 소개 = 높은 contribution | FR | P5 | unit + manual | PLANNED |
| REQ-020 | 39 | 조직 기여 큰 인원 → 높은 점수 | FR | P5 | manual + unit | PLANNED |
| REQ-021 | 40 | 문서 abusing 방지 (의미 없는 기여 단순 반복) | FR | P5 | unit | DONE (같은 computeAbuseSignal 의 R-40 문서 abusing 경로 — 코드 abusing 과 동일 심볼 쌍으로 cover) |
| REQ-022 | 41 | 문서 update 횟수 중립화 (advantage/disadvantage 둘 다 없음) | FR | P5 | unit | DONE (implemented-on-main — T-0524 `computeUpdateCountNeutralization` PR #437 + T-0525 `applyUpdateCountNeutralizationToVolume` PR #438; volume 산출이 version 미사용 → advantage 0, 중립 보존 → disadvantage 0. ADR-0049 group-by-collapse 안은 미채택 — Q-0046 옵션1) |
| REQ-023 | 45-46 | 서비스별 ID 매핑 (1 인물 ↔ N 서비스 ID) | FR | P3 | unit | DONE (implemented-on-main — `schema.prisma` `model ServiceIdentity` 의 1 Person ↔ N `service`/`externalId` 매핑 + `@@unique([personId, service])` 서비스당 1 매핑 invariant; 검증은 `service-identity.repository.spec.ts` 의 findByPersonId / create 케이스 — service·controller 미보유라 e2e 없음) |
| REQ-024 | 47 | Primary key 역할 ID 지정 (서비스 중 1개) | Constraint | P3 (ADR 필수) | policy + unit | DONE (implemented-on-main — `ServiceIdentity.isPrimary Boolean @default(false)` + repository `setPrimary` 의 `$transaction` updateMany(false) → update(true) 로 primary 1 row transition 보장, unit spec 3 종 cover. 한계 — 전용 ADR 없이 [ADR-0002](decisions/ADR-0002-db.md) 에 귀속돼 policy 축은 간접 cover 이고, "정확히 1 primary" service-layer 강제와 HTTP 노출(service·controller) 은 미보유) |
| REQ-025 | 48 | 일부 서비스 ID NULL 허용 | FR | P3 | unit | DONE (implemented-on-main — 미등록 서비스는 nullable 컬럼이 아니라 `ServiceIdentity` row 부재로 NULL 을 표현하는 설계; `findByPersonId` 가 row 부재 시 빈 배열 반환 spec 으로 검증 — service·controller 미보유라 e2e 없음) |
| REQ-026 | 49 | 인원 CRUD + Deactivate/Activate (휴직 시 숨김) | FR | P3 | unit + e2e | DONE (implemented-on-main — `PersonService` CRUD + `deactivate`/`reactivate`(softDelete/restore, 휴직 숨김) 를 `PersonController` 5 endpoint(`@Get()` · `@Get(":id")` · `@Post()` · `@Patch(":id")` · `@Delete(":id")`) 가 forward, `GET /api/persons` 는 `findActive` 로 비활성 숨김; unit spec + `test/e2e/persons.e2e-spec.ts` 11 it 로 검증. 한계 — 전용 `POST /:id/deactivate` endpoint 가 없어 활성 토글은 `PATCH /api/persons/:id` 의 `{active}` 경유이고, `deactivate`/`reactivate` 메서드 자체와 비활성 포함 조회(`findAll`) 는 HTTP 미노출) |
| REQ-027 | 50 | 신규 인원 1년치 평가 1회 (일반은 1주 단위) | FR | P7 + P5 | unit + e2e | DONE (POST /api/schedules/backfill/:personId · buildBackfillPlan DEFAULT_WEEKS=52 · unit spec 3종 — e2e 미보유) |
| REQ-028 | 51 | Group 정책 (다중 임의 group + 단일 조직도 파트) | FR | P3 | unit | DONE (implemented-on-main — 다중 group 소속은 `PersonGroupMembership` 중간 테이블 N:M(`@@unique([personId, groupId])` 로 중복 소속만 금지) 로, 조직도 파트 1 개는 `Person.partId` 단일 FK(`Restrict` 로 소속 인원 있는 Part 삭제 차단) 로 표현; `group.service.ts` · `part.service.ts` · `person-group-membership.repository.ts` + 각 unit spec 보유. 한계 — `partId String?` 가 **nullable** 이라 "정확히 1 파트" invariant 는 DB 제약이 아니며, schema 23~26 행 주석대로 service-layer 강제는 후속 과제로 defer) |
| REQ-029 | 56 | 평가 자료 non-volatile 저장 | NFR | P3 | unit | DONE (implemented-on-main — 저장소는 `schema.prisma` 44 행 `provider = "postgresql"` 의 PostgreSQL 영속 DB([ADR-0002](decisions/ADR-0002-db.md)), 평가 결과 write path 는 [ADR-0033](decisions/ADR-0033-evaluation-result-persistence.md) §Decision 1 매핑을 구현한 `src/assessment-evaluation/evaluation-result-persist.service.ts` → `src/user/assessment.repository.ts` 의 `create`/`delete` + `contribution.repository.ts` · `summary.repository.ts`; 검증은 `assessment.repository.spec.ts` 22 it · `summary.repository.spec.ts` 21 it 등 unit spec 과 `test/e2e/assessments.e2e-spec.ts` 20 it. 한계 — 프로세스 재기동 후 잔존을 직접 확인하는 durability 전용 test 는 없고, ADR-0002 의 single-operator 전제상 replication · PITR · 정기 backup 은 미도입) |
| REQ-030 | 57 | Export/backup + Restore | FR | P7 | e2e | DONE (implemented-on-main — 두 축 모두 실재: export 는 `src/export/export.controller.ts` 의 `@Controller("api/admin/export")` + `@Post()` / `@Get(":id/download")` (dump 다운로드) / `@Get(":id/status-view")`, restore 는 `src/import/import.controller.ts` 의 `@Controller("api/admin/import")` + `@Post()` / `@Post("preview")` / `@Get("modes")`; 영속 job record 는 `schema.prisma` 614 행 `ExportJob` · 649 행 `ImportJob` model, reset 축은 `ImportMode.REPLACE` (schema 571~574 행 enum, `ImportJob.mode` 기본값) 를 `import-restore-transaction.service.ts` 가 단일 `$transaction` 안에서 선삭제 후 재생성하는 형태로 구현. 검증은 e2e 5 spec 56 it — `test/e2e/export-download.e2e-spec.ts` 12 it · `export-scope-preview.e2e-spec.ts` 10 it · `import-restore-http.e2e-spec.ts` 21 it · `import-restore-rejection.e2e-spec.ts` 6 it · `import-restore-transaction.e2e-spec.ts` 7 it. 한계 — README 원문의 "reset" 이 DB 전체 초기화인지 dump 에 담긴 entity 범위 한정 선삭제인지는 본 재판정에서 확인하지 못했고 (`ImportMode` 는 destructive REPLACE 와 비파괴 MERGE 2 종 병존, `import-merge-conflict.ts` 가 후자의 충돌 처리 담당), 예약 backup · 외부 저장소 업로드 같은 운영 automation 과 비동기 job queue 는 부재해 runner 를 요청-응답 안에서 동기 await 한다) |
| REQ-031 | 58 | 재수집 중복 방지 + 최근 1주 재수집 OK | FR | P5 | unit | DONE (implemented-on-main — 두 축 모두 실재 + 수집 경로에 배선: 중복 방지 축은 `src/assessment-collection/domain/commit-dedup.ts` 의 `dedupGithubActivities()` (dedup 키 = commit 은 `commit:<externalId>`(=commit SHA) 단일 키 earliest-wins, pr/issue 는 `<kind>:<repoRef>:<externalId>` 합성 키) + `src/assessment-collection/domain/page-dedup.ts` 의 `dedupConfluenceActivities()` (dedup 키 = `externalId`(=page id), 최대 `version` latest-wins), 각각 `github-collection.service.ts` 32·115 행 · `confluence-collection.service.ts` 41·90 행에서 수집 누적 직후 호출되어 배선 확인. 최근 1주 축은 `src/assessment-collection/domain/recollection-window.ts` 의 `applyRecollectionWindow(since, windowDays)` + 기본 상수 `RECOLLECTION_WINDOW_DAYS = 7` 로, `since-derivation.service.ts` 25·59 행 `deriveSinceWithRecollectionWindow()` 를 거쳐 `collection-trigger.service.ts` 67 행에서 실제 수집 trigger 에 thread 된다 (`dto.windowDays` 미지정 시 7 일). 영속 layer 중복 차단은 `schema.prisma` 348 행 `@@unique([assessmentId, sourceRef])`. 검증은 unit 4 spec 76 it — `domain/commit-dedup.spec.ts` 31 it · `domain/page-dedup.spec.ts` 9 it · `domain/recollection-window.spec.ts` 17 it · `since-derivation.service.spec.ts` 19 it. 한계 — README 원문의 "뒤늦게 push 된 과거 자료를 놓치지 않는다" 축은 7 일 window 겹침으로만 부분 충족이고 window 밖 late-arriving 데이터의 별도 보정 경로는 부재하며, 주기 수집 scheduler 도 `src/scheduling/` 의 REST cron endpoint (`cron-schedule.controller.ts`) 까지만 존재하고 `scheduling.module.ts` 의 `CRON_TICK_HANDLER` 기본 provider 가 logging no-op stub 이라 자동 주기 재수집은 미결선 — 현재는 manual `backfill.controller.ts` 호출에 의존한다) |
| REQ-032 | 59 | 🔥 Raw data 저장 금지 — 평가 결과만 보유 | Constraint | P3 (ADR 필수) | policy + reviewer 점검 | DONE (implemented-on-main — 대응 ADR 실재: [ADR-0006](decisions/ADR-0006-assessment-data-model.md) §Decision 4 (raw 본문 컬럼 0 의 schema-level 강제) + [ADR-0033](decisions/ADR-0033-evaluation-result-persistence.md) §Decision 2 (영속화 path 의 raw payload 0 재확인, 새 컬럼 0), 둘 다 ACCEPTED. 실측 — `schema.prisma` 의 `Assessment` · `Contribution` · `Summary` 3 model 컬럼은 평가 파생 수치(difficulty · contributionScore · volume) · LLM narrative · 참조 식별자(sourceType · sourceUrl · sourceRef) · timestamp 뿐이고 commit diff · PR/issue body · 문서 원문 같은 raw 본문 컬럼은 0. 한계 — 검증 위치의 `reviewer 점검` 축에 자동화가 없다: `.claude/agents/reviewer.md` 의 raw 미저장 점검 항목 0 hit, `scripts/` 에도 대응 check script 부재라 사실상 ADR + schema 주석 policy 에만 의존) |
| REQ-033 | 60 | commit/문서 별 기여도·난이도·양 보유 | FR | P3 + P5 | unit | DONE (implemented-on-main — 3 축이 schema · 산정 · 영속 3 layer 모두에 실재: schema 축은 `schema.prisma` 329 행 `Contribution` model 의 `difficulty String` · `contributionScore Decimal` · `volume Int` 3 컬럼이고 건별 단위 키는 `sourceRef String` + 348 행 `@@unique([assessmentId, sourceRef])`. 산정 축은 `src/assessment-evaluation/evaluation-scoring.service.ts` 90 행 `EvaluationScoringService.scoreUnit()` 이 단위 1 건당 `gateway.generate` 1 회 → `classifyNarrative()` (`domain/evaluation-prompt.ts` 155 행) 로 난이도·기여도를, `calculateEvaluationVolume()` (`domain/evaluation-volume.ts` 30 행) 로 양을 산출해 `domain/evaluation-result.ts` 54 행 `EvaluationResult` 의 `difficulty` / `contribution` / `volume` 필드로 조립 — 3 축 모두 산정 경로 확인. 영속 축은 `domain/evaluation-result.persist.mapper.ts` 136 행 `mapEvaluationResultToContribution()` 이 결과 1 건 → Contribution create input 1 건으로 1:1 매핑 (`sourceRef = unitId`, `contributionScore = contributionLevelToScore()` 104 행) 하고 `evaluation-result-persist.service.ts` 213·216~217 행 `tx.assessment.create({ ... contributions: { create: mapped.contributions } })` nested create 로 건별 row 를 박제. 평가 단위 두 종은 persist.mapper 86 행 `KNOWN_SOURCE_TYPES = ["commit", "pr", "issue", "document"]` 로 code commit 과 문서 건 모두 정의. 검증은 unit 5 spec 107 it — `evaluation-scoring.service.spec.ts` 29 it · `domain/evaluation-result.persist.mapper.spec.ts` 21 it · `domain/evaluation-volume.spec.ts` 21 it · `evaluation-result-persist.service.spec.ts` 18 it · `domain/evaluation-result.spec.ts` 18 it. 한계 — 단위 종류 컬럼 `sourceType` 은 실 파이프라인에서 빈 문자열 placeholder 로 떨어진다: 유일한 unitId 합성 지점인 `domain/evaluation-input.mapper.ts` 46 행 `buildUnitId()` 가 prefix 로 `ActivitySourceType` (`github` / `confluence` 2 값, `assessment-collection/domain/activity.ts` 16 행) 을 쓰는데 `resolveSourceType()` (persist.mapper 117 행) 의 인정 집합과 미일치해 `""` fallback 이며 persist.mapper.spec 288 행이 그 동작을 그대로 고정 — 건별 3 축 보유 자체는 충족하나 commit/문서 구분은 `sourceRef` prefix 로만 남는다 (`sourceUrl` 도 도출 source 부재로 빈 문자열). 또 난이도 3 종 모델 (REQ-050) 과의 정합, 문서 건의 수집→평가 end-to-end 연결은 본 재판정에서 확인하지 않았다) |
| REQ-034 | 61 | 일별 활동 요약 평가문 (당일은 자정까지 안 함) | FR | P5 | unit | DONE (isPeriodEvaluable/computePeriodEnd 의 day 경로 — 다음 KST 자정 이후에만 Summary 생성 허용, enumerateSummaryDueCoordinates → SummaryBatchOrchestrator 배선) |
| REQ-035 | 62 | 주간/월간 요약 평가문 (다음주/다음달 시작 시) | FR | P5 | unit | DONE (같은 심볼의 week/month 경로 — 다음 KST 월요일 00:00 · 다음 달 1 일 00:00 이후 허용, ADR-0035 aggregate summary 평가로 cover) |
| REQ-036 | 63 | 상대 비교 가능 + LLM 정성 + Metric 수치 | FR | P3 + P5 | unit | PLANNED |
| REQ-037 | 64 | 평가 없는 부분 일괄 평가 + Reset & Reeval | FR | P5 | e2e | PLANNED |
| REQ-038 | 68-71 | UI 조회 / sort / filter / 시계열 | FR | P6 | smoke + e2e | DONE |
| REQ-039 | 72 | Admin cron 주기 지정 | FR | P7 | unit + e2e | DONE (GET·PUT·DELETE /api/schedules 런타임 cron registry) |
| REQ-040 | 73 | Admin manual trigger | FR | P7 | e2e | DONE (POST /api/schedules/trigger 즉시 1회 발화) |
| REQ-041 | 74 | Admin 최근 N일 결과 manual delete → 재수집 | FR | P7 | unit + e2e | DONE (POST /api/schedules/recent-deletion/:personId delete→재수집) |
| REQ-042 | 78 | 평가 진행 중 시각화 보호 (기존 자료 + 경고 배너) | FR | P6 | smoke + e2e | DONE (배선 완료, 자동 polling defer) |
| REQ-043 | 83 | 모든 기능 ID/Password 보호 | NFR | P3 + P6 | e2e | PLANNED |
| REQ-044 | 84 | 첫 로그인 SuperAdmin / 3 등급 / 승급 / SuperAdmin 만 Admin→User | FR | P3 + P6 | unit + e2e | DONE |
| REQ-045 | 85 | Admin 권한 (재작성/Reset/Import/Export/인원편집/Group편집) | FR | P6 | e2e | IN_PROGRESS |
| REQ-046 | 86 | User read-only (조회/sort/filter) | FR | P6 | e2e | DONE |
| REQ-047 | 91 | 100~200명 / 50~100 repo / ~1000 confluence / 1h 이내 | NFR | P7 | manual + perf test | PLANNED |
| REQ-048 | 92 | 조회·시각화 3초 이내 | NFR | P6 + P7 | perf test | PLANNED |
| REQ-049 | 96 | Admin 이 LLM 모델 지정 | FR | P4 + P6 | e2e | DONE |
| REQ-050 | 97 | 3가지 난이도 모델 + 어떤 항목이 어떤 난이도인지 결정 | Constraint | P4 (ADR 필수) | policy + unit | PLANNED |
| REQ-051 | 99 | custom LLM (OpenAI 호환, 내부 서버, proxy, 3 model 슬롯) | FR | P4 | unit | DONE (adapter·gateway 배선, live 는 env-gated) |
| REQ-052 | 100 | Azure OpenAI provider | FR | P4 | unit | DONE (adapter·gateway 배선, live 는 env-gated) |
| REQ-053 | 101 | Anthropic provider | FR | P4 | unit | DONE (adapter·gateway 배선, live 는 env-gated) |
| REQ-054 | 102 | Google Gemini provider | FR | P4 | unit | DONE (adapter·gateway 배선, live 는 env-gated) |
| REQ-055 | 103 | OpenAI provider | FR | P4 | unit | DONE (adapter·gateway 배선, live 는 env-gated) |
| REQ-056 | 108 | Well-known library / 중복 import 금지 / version mismatch 방지 | Constraint | P0 + 모든 phase | policy + CI | PLANNED |
| REQ-057 | 109 | 한 commit = 한 주제 | Constraint | (정책) CLAUDE.md §3 | policy | DONE |
| REQ-058 | 110 | commit/PR 후 코드 검토 + test 작성 + test 수행 | Constraint | CLAUDE.md §3.2 R-110 + agents | policy | DONE |
| REQ-059 | 111 | 모든 test → CI 자동 실행, fail → CI error | Constraint | CLAUDE.md §3.2 R-111 + ci.yml | policy + CI | DONE (T-0005 후 active) |
| REQ-060 | 112 | unit test (기능 + 예외 + flow + negative) | Constraint | CLAUDE.md §3.2 R-112 + planner | policy + CI (T-0007/T-0008) | DONE |
| REQ-061 | 113 | smoke + e2e 도 CI 에서 수행 | Constraint | CLAUDE.md §3.2 R-113 + T-0009/T-0010 | CI | DONE (T-0009/T-0010) |
| REQ-062 | 114 | 활동 후 test 수행 + 종료 전 CI 수행 | Constraint | CLAUDE.md §3.2 R-114 + LOOP §1 [5] | policy | DONE |
| REQ-063 | 115 | PR 만들면 다른 agent 가 review | Constraint | integrator → reviewer | policy | DONE |
| REQ-064 | 116 | Reviewer + Committer 합의로 merge, 7 round | Constraint | CLAUDE.md §3.3 + integrator | policy | DONE |
| REQ-065 | 117-128 | Reviewer 8 check | Constraint | reviewer.md | policy | DONE |
| REQ-066 | 133 | 코드 commit = PR / 진행상황 doc = direct | Constraint | CLAUDE.md §3.1 | policy | DONE |

## 매핑 표 갱신 룰

- 새 task 가 만들어질 때 task 파일 frontmatter 에 `coversReq: [REQ-NNN, REQ-MMM]` 명시.
- task merge 시 integrator 가 본 표의 해당 REQ row 상태를 `IN_PROGRESS` → `DONE` 으로 갱신 (직접 또는 follow-up doc-only direct commit).
- README 가 변경되면 planner 가 다음 호출에서 본 표를 동기화 (새 row 추가 또는 기존 row 갱신).
- 본 표의 row 가 phase 의 PLAN.md bullet 과 1:N 또는 N:1 일 수 있다. 그 경우 "구현 위치" 컬럼에 PLAN bullet 위치를 명시.

## 누락 검사 (정기 수행)

- planner 는 P 단위 phase 진입 시 본 표를 grep 하여 해당 phase 에 매핑된 REQ row 중 `PLANNED` 상태로 남은 것이 있는지 확인. 있으면 task 생성 후보로.
- reviewer 의 8 check (1) "주어진 주제 해결" 점검 시 PR 의 task frontmatter `coversReq` 가 본 표의 REQ 와 일치하는지 검증.
