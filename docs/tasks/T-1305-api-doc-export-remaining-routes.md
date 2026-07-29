---
id: T-1305
title: api.md UC-07 표에 export 잔여 route 5 행 신설 (running · describe-scope · preview-selection · :id/status-view · :id)
phase: P5
status: DONE
completedAt: 2026-07-29T10:52:00Z
commitMode: direct
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 45
estimatedFiles: 1
created: 2026-07-29
independentStream: import-restore-engine
dependsOn: [T-1304]
touchesFiles:
  - docs/architecture/api.md
plannerNote: "doc-only enumerated-section x1.6 x inline-amend 0.4 = 약 45 LOC / 1 파일. T-1304 이월 Follow-up — export 측 shipped 5 route 의 api.md 정본 부재 해소"
---

# T-1305 — api.md UC-07 표에 export 잔여 route 5 행 신설

## Why

[T-1304](T-1304-api-doc-import-query-export-download-rows.md) 이 import 조회 3 종 + export download 를 정본에 박제해 UC-07 그룹의 endpoint 존재 drift 를 절반 닫았고, 나머지 절반이 본 task 다. [export.controller.ts](../../src/export/export.controller.ts) 에는 `@Get("running")` (178 행) · `@Post("describe-scope")` (208 행) · `@Post("preview-selection")` (244 행) · `@Get(":id/status-view")` (438 행) · `@Get(":id")` (453 행) 5 개 route 가 이미 production 에서 응답하는데, [api.md](../architecture/api.md) 의 UC-07 그룹에는 그 경로 문자열이 **0 hit** 이다 (planner pre-check 로 `describe-scope|preview-selection|status-view|export/running` grep 결과 0 확인 — issue-still-relevant 통과).

즉 export 측은 mutation 1 행 (`POST /api/admin/export`) + download 1 행만 정본에 있고, **scope 확정 전 preview 계열 2 종과 status polling 계열 3 종이 통째로 미문서화** 다. 이 상태에서는 web 배선을 담당할 후속 slice 가 정본만 읽고는 "scope preview 경로가 존재한다" 는 사실 자체를 알 수 없다.

코드 0 LOC · 기존 doc 1 파일의 표 행 추가만이라 §3.1 상 `direct` 이고 R-110/R-112 는 면제되며, 대신 controller ↔ 문서 문자 대조를 Acceptance Criteria 로 강제한다 (T-1304 와 동일 검증 형태).

**estimate 근거** — 표 행 5 개 신설 ~55 LOC + traceability 행/각주 amend ~10 LOC → base ~70, doc-only enumerated-section × 1.6 × inline-amend 0.4 = × 0.64 → **~45 LOC / 1 파일** (cap 안, `sizeExempt` 불요). 실제 markdown 표는 행당 1 줄이라 실측 diff 는 이보다 훨씬 작을 것으로 본다 (T-1304 실측 +7/-1 선례).

## Required Reading

- [docs/architecture/api.md](../architecture/api.md) 123~132 행 — UC-07 그룹 표 (T-1304 후 10 행). 표 형식은 **5 열** (`| METHOD | route | UC | 설명 | 권한 |` — 파이프 6 개). 130 행 (`GET /api/admin/export/:id/download`) 이 서술 밀도·표기 관례 (`T-NNNN 문서화 (구현 근거: <controller 경로> <데코레이터>)`) 의 **본보기**. 기존 10 행 서술은 **0 수정**.
- [docs/architecture/api.md](../architecture/api.md) 182 행 + 185 행 — UC-07 traceability 행과 그 아래 "import 조회 3 종을 표에 넣지 않는 근거" 각주. 본 task 의 traceability 판단은 이 각주 문장과 **정합** 해야 한다.
- [src/export/export.controller.ts](../../src/export/export.controller.ts) 172~186 행 — `@Get("running")`. 반환 `ExportJob[]` (`service.findRunning` raw forward), 매칭 0 이면 빈 배열 (404 변환 0), `:id` 보다 먼저 선언. **0 수정**.
- [src/export/export.controller.ts](../../src/export/export.controller.ts) 188~232 행 — `@Post("describe-scope")`. `CreateExportDto` body 재사용, `SCOPE_ENUM_TO_PAYLOAD` enum→lowercase 변환 + `coerceDateRange` ISO→Date coerce 후 `describeExportScope` helper 직호출 (service 미경유), controller 분기 0 (helper 의 `RangeError`/`TypeError` raw propagate → 500), DB write 0. POST + 고정 segment 라 `GET :id` 와 충돌 0. **0 수정**.
- [src/export/export.controller.ts](../../src/export/export.controller.ts) 234~262 행 — `@Post("preview-selection")`. 동일 변환 후 `service.previewSelection(scope)` 호출 — describe-scope 와 달리 **실 DB read** (5 entity `{instant}` projection 만, 전체 row·raw 미조회 — REQ-032) 로 첫 실 선별 수행. job record 생성·status 변경 0, 실 record payload 반환 0 (요약만). **0 수정**.
- [src/export/export.controller.ts](../../src/export/export.controller.ts) 425~466 행 — `@Get(":id/status-view")` 와 `@Get(":id")`. status-view 는 `service.findJob(id)` (부재 시 404 raw propagate) 후 `JOB_STATUS_TO_VIEW` 매핑 → `describeExportJobStatus` helper, DB write 0, `:id/status-view` 가 `:id` 보다 먼저 선언. `:id` 는 `findUniqueOrThrow` 의 P2025 → `NotFoundException` 404. **0 수정**.
- [src/export/export-scope-description.ts](../../src/export/export-scope-description.ts) 35~42 행 — `ExportScopeDescription` 6 필드 (`headline` / `scopeKind` / `scopeLine` / `dateRangeLine?` / `entityLines` / `readOnly: true`). **0 수정**.
- [src/export/export-job.service.ts](../../src/export/export-job.service.ts) 178~207 행 — `ExportSelectionPreview` **9 필드** (`selectedCount` / `excludedCount` / `perEntitySelected` / `summary` / `sizeEstimate` / `deliveryPlan` / `completionResult` / `chunkPlan` / `streamProgress`) 와 append-only 확장 주석. **0 수정**.
- [src/export/export-job-status-view.ts](../../src/export/export-job-status-view.ts) 31~40 행 — `ExportJobStatusView` 8 필드 (`status` / `phaseLabel` / `stepIndex` / `totalSteps` / `nextStatus` / `terminal` / `downloadable` / `message`). **0 수정**.

## Acceptance Criteria

- [ ] **`GET /api/admin/export/running` 행 신설** — 진행 중 (`status=RUNNING`) export job 목록 조회, UC-07 §8 status polling 경로. 응답 200 + `ExportJob[]` (`ExportJobService.findRunning` raw forward), **매칭 0 이면 빈 배열** (404 변환 0). 실패 401 (미인증) / 403 (비-Admin). `running` literal 이 `:id` 보다 먼저 선언돼 id 로 포착되지 않는다는 사실 1 절. 권한 열 `Admin+`.
- [ ] **`POST /api/admin/export/describe-scope` 행 신설** — 선택 scope 의 사람-친화 설명 조회 (UC-07 §5 step 2 + §6.1, export 확정 **전** scope preview dialog 의 정보 source). 요청 body 는 `CreateExportDto` 재사용 (`create` 와 동일 DTO). 응답 200 + `ExportScopeDescription` (`headline` / `scopeKind` / `scopeLine` / `dateRangeLine?` / `entityLines` / `readOnly`). **DB read·write 0** — 입력 scope 만 다루는 순수 합성 (REQ-032 자연 유지). controller 분기 0 — 잘못된 scope 조합 (RANGE + `dateRange` 누락 · `start>=end` · PARTIAL + 빈 `entitySelector` · 허용 외 entity) 은 helper 의 `RangeError`, Invalid Date 는 `TypeError` 가 swallow 없이 raw propagate 해 **500** 으로 나간다는 사실을 명시 (사용자 대면 4xx 매핑이 아직 없다는 현재 사실 그대로 — 개선은 Follow-ups). 실패 401 / 403.
- [ ] **`POST /api/admin/export/preview-selection` 행 신설** — 선택 scope 로 **실 DB 선별** 을 수행한 결과 요약 조회 (UC-07 §6.1 + §8 (a) read-only). describe-scope 가 *설명* 만 합성하는 것과 달리 5 entity 의 `{instant}` projection 을 실 read 해 `selectExportRecords` 로 선별한다 (전체 row · raw 본문 미조회 — REQ-032). 응답 200 + `ExportSelectionPreview` **9 필드** (`selectedCount` / `excludedCount` / `perEntitySelected` / `summary` / `sizeEstimate` / `deliveryPlan` / `completionResult` / `chunkPlan` / `streamProgress` — append-only 확장이라 앞 6 필드 불변). **job record 생성·status 변경 0 · 실 record payload 반환 0** (count/요약만). 오류 전파는 describe-scope 와 동형 (helper `RangeError`/`TypeError` raw propagate). 실패 401 / 403.
- [ ] **`GET /api/admin/export/:id/status-view` 행 신설** — 단건 job 의 사람-친화 진행 view (UC-07 §8). `findJob(id)` 부재 시 **404** 가 helper 도달 전 raw propagate. 응답 200 + `ExportJobStatusView` 8 필드 (`status` / `phaseLabel` / `stepIndex` / `totalSteps` / `nextStatus` / `terminal` / `downloadable` / `message`). `JOB_STATUS_TO_VIEW` 가 4 enum 을 1:1 cover 하므로 helper 입력 방어 분기는 정상 경로 미발화. DB write 0. `:id/status-view` 가 `:id` 보다 먼저 선언. 실패 401 / 403.
- [ ] **`GET /api/admin/export/:id` 행 신설** — 단건 export job status polling 조회 (UC-07 §8). 응답 200 + `ExportJob`, 부재 id 는 service `findUniqueOrThrow` 의 P2025 → `NotFoundException` **404** (controller swallow 0). 같은 행에 **route 선언 순서** 를 한 절로 박제 — `running` literal · `:id/download` · `:id/status-view` 가 모두 본 행보다 먼저 선언돼 있어 그 경로들이 id 로 포착되지 않는다 (NestJS path matching 은 선언 순서 우선). 실패 401 / 403.
- [ ] **행 위치·표 무결** — 5 행 모두 UC-07 그룹 (123 행 그룹 헤더 ~ `POST /api/admin/restore` 행) **안** 에, 기존 `GET /api/admin/export/:id/download` (130 행) 뒤에 연속으로 넣는다. 신설 5 행 각각 **5 열 무결** (파이프 6 개) 이고 기존 10 행 수정 0. 표 렌더 깨짐 0.
- [ ] **근거 표기** — 각 신설 행 끝에 `T-1305 문서화 (구현 근거: [src/export/export.controller.ts](../../src/export/export.controller.ts) <데코레이터>)` 형태로 T-1304 행의 표기 관례를 그대로 따른다 (본 5 route 도 여러 task 에 걸쳐 shipped 돼 PR 번호 단일 표기가 부정확하므로 파일 pointer 가 정본).
- [ ] **traceability 행 amend** — 182 행 UC-07 cell 에 `POST /api/admin/export/describe-scope` 와 `POST /api/admin/export/preview-selection` 두 개만 추가한다 (둘 다 §5 step 2 의 export 확정 전 경로). **status polling 3 종 (`GET /api/admin/export/running` · `/:id/status-view` · `/:id`) 은 넣지 않는다** — 185 행 각주 (import 조회 3 종 제외 근거) 와 동일 논리이므로 그 각주 문장에 export polling 3 종을 **한 번만 확장 언급** 하고 별도 각주 신설 0. cell 의 성격 표기 (`step 1 ... + step 13 (다운로드)`) 는 step 2 를 포함하도록 한 번만 확장하거나, 확장이 문장을 어색하게 하면 그대로 둔다 (판단 후 commit body 에 한 줄 근거).
- [ ] **grep 대조 4 종 통과** (R-110/R-112 면제의 대체 검증):
  1. `grep -c "api/admin/export/running\|export/describe-scope\|export/preview-selection\|:id/status-view" docs/architecture/api.md` ≥ 4.
  2. `grep -c "ExportScopeDescription\|ExportSelectionPreview\|ExportJobStatusView" docs/architecture/api.md` ≥ 3 이고 세 철자가 각각 `src/export/export-scope-description.ts` · `src/export/export-job.service.ts` · `src/export/export-job-status-view.ts` 의 `export interface` 선언과 문자 일치.
  3. `ExportSelectionPreview` 필드 9 개 · `ExportJobStatusView` 필드 8 개 · `ExportScopeDescription` 필드 6 개 의 개수와 이름이 소스 선언과 일치 (문서에 적은 목록 ↔ 소스 대조).
  4. UC-07 그룹의 모든 표 행이 5 열 무결 — 신설 후 파이프 개수 확인.
- [ ] **R-110/R-112 면제 근거 명시** — 본 task 는 코드 0 LOC / test 0 건이라 tester 호출 불요. 위 grep 4 종 결과를 commit body trail 의 `notes` 에 1~2 줄로 박제 (§11 길이 제한 준수).
- [ ] **direct commit 절차** — main 에서 `git push HEAD:main` (feature branch · PR 생성 0, [LOOP.md](../LOOP.md) §4 push source/target 매칭). commit subject 는 `docs(api): …(T-1305)` 형태.
- [ ] **언어 규율 (§12)** — 문서 본문 · commit 본문은 한국어, route · 타입명 · 필드명 · enum 값은 영어 그대로.

## Out of Scope

- **코드 · test 수정 0** — `src/**`, `test/**` 어느 파일도 건드리지 않는다 (§3.1 rule 3 — 섞으면 direct/pr 혼합 위반). `scripts/daily-test.sh` 도 무관 (leg 추가 시 drift-guard smoke spec 3 종 동반 수정으로 5 파일 cap 이 깨진 Q-0054 선례 회피).
- **오류 매핑 개선 0** — describe-scope · preview-selection 의 `RangeError`/`TypeError` 가 500 으로 나가는 현재 동작을 **문서에 사실대로 적을 뿐**, 4xx 매핑 코드 변경은 별건 (Follow-ups 의 T-1291 이월 항목과 동일 성격).
- **UC-07 use-case 문서 수정 0** — §5 mermaid sequence 에 scope preview step 반영, §8 polling 절 보강 등은 별건. 본 task 는 api.md 1 파일만 만진다.
- **기존 10 행 재서술 0** — UC-07 그룹의 기존 행 (mutation 5 + import 조회 3 + download 1 + 그룹 헤더) 문장은 손대지 않는다 (추가만). 185 행 각주는 **한 문장 확장만** 허용.
- **응답 예시 JSON 블록 신설 0** — 표 셀 안 산문 서술 유지 (기존 관례). 9 필드 · 8 필드 목록도 산문 안 인라인 나열로 적는다.
- **data-model.md · directory.md 동기 0** — 본 5 route 는 새 엔티티·디렉토리를 만들지 않는다.
- **크기 초과 시** — 서술이 길어져 cap 에 접근하면 status polling 3 행 (`running` · `:id/status-view` · `:id`) 을 다음 slice 로 미루고 preview 계열 2 행 (`describe-scope` · `preview-selection`) 을 먼저 박제한다 (미문서화의 정보 손실이 더 큰 쪽이 preview 계열).

## Suggested Sub-agents

`implementer` (doc-only — tester 미호출, R-110 면제 근거는 Acceptance Criteria 에 명시)

## Follow-ups

- (T-1304 이월) UC-07 §5 mermaid sequence 에 preview step (import dry-run + export scope preview) 반영 — autonumber 재정렬 동반이라 별도 slice.
- (본 task 발 가능) export preview 2 종의 잘못된 scope 조합이 **500** 으로 나가는 현재 동작의 4xx 매핑 여부 판단 — 사용자 대면 status 결정이라 제품 판단 대상 (T-1291 이월 `RangeError` 항목과 함께 묶어 처리 가능).
- (유지) **부분 dump + REPLACE 의 비선별 entity 삭제** — "Group 만 담긴 파일" 을 REPLACE 로 올리면 Person·Assessment 까지 증발한다. preview + mode echo 로 실행 전 정보는 갖춰졌으나 차단/경고 여부는 제품 결정 — 사람 판단 대상.
- (유지, 3c-3d3) 크기 상한 413 e2e — 50 MiB 초과 업로드. supertest 의 multer mid-stream abort 표면화를 먼저 국소 확인 후 flaky 하면 포기 선택지를 planner 에 보고.
- (T-1290 round 1 MINOR A 이월) `ExportSelection` 의 `selected` / `excluded` 를 `readonly TRecord[]` 로 좁혀 배열 공변 unsoundness 를 닫는 slice — 소비처 4 곳 동반 수정 필요.
- (T-1291 → 이월) `selectExportRecords` 의 `RangeError` (손상 job row) 가 download 경로에서 **500** 으로 나간다 — 사용자 대면 status (409/422) 매핑 여부 판단 필요.
- (미해결 정책, T-1287 → 이월) `LlmProviderConfig` 왕복 불가 — export 가 `apiKey` 를 제외 (ADR-0047 secret deny) 하는데 schema 의 `apiKey` 는 not-null 이라 복원 `$transaction` 이 통째로 실패할 것으로 예상. **secret 처리 결정이라 §5 사람 결정 대상**.
- (관측, 이월) UC-07 §8 (b)(e) 의 Export / Import Audit log row 영속화 0 — 범용 `AuditLog` model 부재. schema migration 이라 §5 사람 결정 대상.
