---
id: T-0493
title: ImportController 에 GET /api/admin/import/modes 신설 + describeImportMode(T-0465) 실호출 배선 — 45 helper 배선 chain step3
phase: P7
status: DONE
prNumber: 404
mergedAs: deb1abe
reviewRounds: 1
commitMode: pr
coversReq: [REQ-030, REQ-032, REQ-045]
estimatedDiff: 180
estimatedFiles: 2
created: 2026-06-18
independentStream: export-import-wiring
dependsOn: [T-0489, T-0492]
touchesFiles:
  - src/import/import.controller.ts
  - src/import/import.controller.spec.ts
plannerNote: "P7 helper-배선 chain step3 — describeImportMode(T-0465 순수 helper, 어디서도 미호출) 를 신설 GET /api/admin/import/modes 에 실호출 배선. payload-free·auth-role 무관, 새 dep/schema/multipart 0."
---

# T-0493 — ImportController 에 GET /api/admin/import/modes 신설 + describeImportMode 실호출 배선

## Why

P7 export/import 실 배선 chain 의 "45 helper(T-0437~T-0483) 실 호출 배선" 단계에서, step1([T-0491](T-0491-export-job-service-scope-validate-wire.md), `validateExportScope`→ExportJobService) 과 step2([T-0492](T-0492-import-job-service-race-guard-wire.md), `evaluateImportRaceGuard`→ImportJobService) 가 각각 export·import 측 첫 helper 를 실 path 에 배선해 merge 됐다. 본 task 는 chain step3 — import mode 선택 단계의 사람-친화 설명 helper 를 실 HTTP path 에 연결한다.

`describeImportMode` ([T-0465](T-0465-import-mode-description.md), `src/export/import-mode-description.ts`) 는 UC-07 §6.2 + §5 step 2 의 "Import mode(replace/merge) 선택 dialog 에서 그 mode 가 DB 에 무엇을 하는가(파괴적 교체 vs 보존적 병합)를 row count 없이 설명" 하는 순수 helper 인데, `git grep describeImportMode -- src/**/*.controller.ts src/**/*.service.ts` 결과 **자기 spec 외 어디서도 호출되지 않는다**. 반면 현행 `ImportController` 는 job 생성(POST)·status polling(GET running / GET :id) 만 노출할 뿐, **WebUI 가 mode 를 선택하기 전에 각 mode 의 의미를 받아올 경로가 없다** — UC-07 §5 step 2 의 "mode 선택 dialog" 정보 source 가 코드 차원에서 비어 있다.

본 task 는 `GET /api/admin/import/modes` 라이트웨이트 endpoint 를 신설해 `describeImportMode` 를 REPLACE·MERGE 두 mode 에 대해 호출하고, 그 `ImportModeDescription[]`(headline / detailLines / destructive / mergeStrategy / reason) 를 그대로 반환한다. 이로써 (1) 미호출 helper 1 종이 실 HTTP path 에 연결되고(REQ-030 Import mode 선택), (2) raw 미저장 invariant(REQ-032) 는 그대로 유지되며(helper 는 mode enum 만 다루고 raw 본문·DB 미접근), (3) Admin 전용 import 경로(REQ-045)의 기존 guard stack 을 동일하게 적용한다.

본 task 는 **persistence / DB write 0, multipart 0** — mode enum → 설명 모델의 순수 derivation 을 HTTP 로 노출만 한다. 새 외부 dependency / DB schema / auth-flow / multipart 표면 0(helper·controller·guard 이미 존재, endpoint 1 개만 추가).

## Required Reading

- `src/import/import.controller.ts` 전체 — 배선 대상. 기존 3 endpoint(POST `create` / GET `running` / GET `:id`)의 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` RBAC stack 과 controller-scope `@UsePipes(ValidationPipe(...))`, 그리고 **라우트 선언 순서 주의**(고정 segment `modes`/`running` 를 동적 `:id` 보다 먼저 선언 — NestJS path matching 순서) 를 정확히 파악. 신설 `GET modes` 도 `:id` 보다 위에 둔다.
- `src/export/import-mode-description.ts` 전체 — 호출할 순수 helper. `describeImportMode(mode: ImportRestoreMode): ImportModeDescription`. **입력 타입은 lowercase `ImportRestoreMode = "replace" | "merge"`** 이고, 반환 `ImportModeDescription` 은 `{ headline, detailLines[], destructive, mergeStrategy, reason }`. 허용 외 mode 는 helper 가 `TypeError`(비-string) / `RangeError`(허용 외 string) 를 throw 하므로, controller 는 **이미 알려진 2 종 mode 만 helper 에 넘긴다**(임의 입력 helper 전달 금지).
- `src/export/import-restore-plan.ts` 의 `ImportRestoreMode` 타입 정의(L25, `"replace" | "merge"`) — Prisma `ImportMode` enum(REPLACE / MERGE, uppercase) 과의 대소문자 차이 확인. 매핑이 필요하면 `ExportJobService` 의 `SCOPE_ENUM_TO_PAYLOAD` 패턴(uppercase enum → lowercase literal Record 상수)을 mirror.
- `prisma/schema.prisma` L561~564 `enum ImportMode { REPLACE; MERGE }` — 노출할 2 mode 의 source of truth(controller 가 이 두 enum 멤버를 lowercase 로 변환해 helper 호출).
- `src/import/import.controller.spec.ts` 전체 — colocated spec. 본 task 의 신설 endpoint test 를 여기에 추가(신규 spec 파일 생성 금지 — colocated 우선). 기존 4 부분 구조(unit / @Roles metadata 단언 / RBAC guard integration / real RolesGuard escalation)에 `modes` endpoint 분기를 동형으로 추가.

## Acceptance Criteria

배선 설계 (구현 방향 — 세부는 implementer 재량, 단 helper 호출은 의무):

- [ ] `ImportController` 에 `GET /api/admin/import/modes` 핸들러를 신설한다. 핸들러는 REPLACE·MERGE 두 mode 각각을 lowercase `ImportRestoreMode`(`"replace"` / `"merge"`) 로 변환해 `describeImportMode` 를 호출하고, 결과 `ImportModeDescription[]`(2 원소)를 반환한다. enum→lowercase 변환은 `ExportJobService.SCOPE_ENUM_TO_PAYLOAD` 패턴(Record 상수)을 mirror — 변환 근거 주석 1줄 박제.
- [ ] 신설 핸들러의 라우트 선언 위치는 동적 `:id` segment **위**(고정 `modes`/`running` 다음, `:id` 이전)에 둔다 — "modes" 가 `:id` 로 포착되지 않도록(NestJS path matching 순서). 본 ordering 이 spec 의 RBAC integration test 에서 검증되도록 한다.
- [ ] 신설 endpoint 는 기존 3 endpoint 와 동일한 RBAC stack 을 적용한다 — `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`(import 는 administrative concern, REQ-045). 신규 auth-flow / 정책 변경 0.
- [ ] `describeImportMode` 가 자기 spec 외에 실 controller 에서 호출됨을 검증 — `git grep describeImportMode -- src/import/import.controller.ts` 가 1+ 매칭.
- [ ] [R-112 happy] `GET /api/admin/import/modes` 가 Admin actor 로 호출 시 2 원소 배열(REPLACE → destructive=true, MERGE → destructive=false)을 200 으로 반환하고, 각 원소의 `headline`/`detailLines`(비어있지 않음)/`reason`(`"replace"`/`"merge"`) 가 helper 산출과 일치하는 test 1+.
- [ ] [R-112 error path] helper 가 잘못된 입력에 throw 하는 계약을 controller 가 어기지 않음을 검증 — controller 가 helper 에 넘기는 mode 가 항상 `"replace"`/`"merge"` 두 lowercase 값뿐(임의 입력 forward 0)임을 단언하는 test 1+(예: helper 를 spy 해 호출 인자가 정확히 두 lowercase 값인지 확인). enum→lowercase 매핑이 깨지면 fail.
- [ ] [R-112 flow/branch] `modes` 핸들러는 client 입력 분기가 없는 고정 2-mode 산출 — 분기 cover 는 (a) REPLACE 변환 → destructive=true 산출, (b) MERGE 변환 → destructive=false 산출 두 mode 산출 경로 각 1+ test. (client-driven 분기 없음 — 그 사실을 spec 주석 1줄로 명시.)
- [ ] [R-112 negative cases 충분 cover] 예외 상황 각 1+: (1) 인증 부재(cookie 없음 / invalid JWT) 시 JwtAuthGuard 가 401, (2) User tier actor(Admin 미달) 시 RolesGuard 가 403(real RolesGuard escalation 부분에서 User 403 / Admin·SuperAdmin 통과 동형 추가), (3) `@Roles("Admin")` + `@UseGuards(JwtAuthGuard, RolesGuard)` metadata 가 신설 핸들러에 부착됐는지 Reflector 단언 test, (4) 반환 배열이 정확히 2 원소이며 REPLACE/MERGE 두 reason 만 포함(중복/누락 없음)임을 단언하는 test.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과. 신규/변경 코드 `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — import.controller.ts 변경 부분 cover.

## Out of Scope

- **multipart 파일 수신 / 실 artifact upload·파싱**(multer / FileInterceptor) — 새 infra 표면, §5 BLOCKED 인접. 본 task 는 mode 설명 조회 endpoint 만.
- **`createJob`(POST) 응답에 mode description 결합** — POST 는 job record 생성만(raw `ImportJob` forward, T-0489 박제 유지). 본 task 는 별도 조회 endpoint 신설만, 기존 POST 응답 shape 불변.
- **`describeImportMode` 자체 로직 수정** — helper 는 호출만(T-0465 박제 그대로). 새 mode·필드 추가 금지.
- **ImportJobService 변경** — 본 task 는 controller layer 만 touch(touchesFiles 2 파일). service 는 건드리지 않는다(helper 가 service 의존 0 — 순수 함수).
- **CreateImportDto / ValidationPipe 정책 변경** — 신설 endpoint 는 body 없는 GET 이라 DTO 무관. 기존 controller-scope ValidationPipe 그대로(GET 에 영향 0).
- **실 atomic transaction 복원 로직**(ADR-0044 §3 REPLACE `$transaction` / MERGE conflict resolution) — Q-0040 범위 밖, 별도 §5/§9 게이트. 본 task 는 mode 설명 산출만.
- **`describeImportMode` 를 export 측·다른 helper 로 추가 배선** — chain 의 후속 slice. 한 task 1 helper 배선 원칙.
- **STATE.json / journal / PLAN 등 doc 변경** — direct-mode 별 task. 본 task 는 코드+spec pr-mode 만.

## Suggested Sub-agents

`implementer → tester`

(아키텍처 결정 0 — 기존 helper·controller·guard·mock 재사용, 새 ADR 불요. architect 생략.)

## Follow-ups

(생성 시점 비어 있음. sub-agent 가 관련 작업 발견 시 여기에 append — 예: 나머지 import 측 미호출 helper(`validateImportDumpStructure`·`validateImportDumpSize`·`detectImportMergeConflicts`·`summarizeImportImpact` 등) 의 배선 slice — 단 이들은 dump payload 가 필요해 multipart upload infra task 선행이 자연스럽다. export 측 mode/scope 설명 helper(`describeExportScope` 등) 의 대칭 배선 slice.)
