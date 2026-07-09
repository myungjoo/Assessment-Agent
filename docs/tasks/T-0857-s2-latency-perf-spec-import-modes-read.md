---
id: T-0857
title: S2 조회 latency perf-spec 를 ImportController GET /api/admin/import/modes derived-list read 에 배선
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048, REQ-030, REQ-032]
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/import-modes-read.perf-spec.ts
  - test/perf/README.md
estimatedDiff: 240
estimatedFiles: 2
created: 2026-07-09
plannerNote: "P8 load-resilience §5 #2 — S2 latency harness 28번째 perf-spec, ImportController GET /api/admin/import/modes derived-list read (import-running T-0842 mirror, guard-protected Admin, describeImportMode helper derive, service-무의존)"
---

# T-0857 — S2 조회 latency perf-spec 를 ImportController GET /api/admin/import/modes derived-list read 에 배선

## Why

[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 follow-up #2(조회 endpoint latency harness 배선)의 스물여덟 번째 slice다. T-0830~T-0856 이 27 개 조회 endpoint(list/query/self-read 14 + summary·group·assessment·person·part·contribution·user·llm-config·export·import :id detail 10 + group·part :id/persons sub-resource 2 + export :id/status-view derived-detail 1)에 collector 를 배선했다. 본 task 는 `ImportController` 의 `GET /api/admin/import/modes`(`describeModes` → 고정 2 mode(Prisma `ImportMode.REPLACE`/`MERGE`)를 lowercase `ImportRestoreMode` 로 변환해 `describeImportMode` helper 에 넘겨 각 mode 의 `ImportModeDescription`(2 원소: REPLACE→destructive=true / MERGE→destructive=false)를 200 반환 — client 입력 분기 0, 항상 알려진 2 종 mode 만 helper 로 forward, persistence 0)에 harness 를 배선한다. export `:id/status-view`(T-0856)가 **derived-detail** 이었다면 본 endpoint 는 고정 목록을 helper 로 derive 하는 **derived-list** read 라 harness 재사용이 pass-through·조합 detail 뿐 아니라 파생 목록 read 에서도 유효함을 실증한다. `@UseGuards(JwtAuthGuard, RolesGuard) @Roles("Admin")` 가 부착된 Admin-tier read 라 import-running(T-0842) 의 guard override 패턴을 mirror 한다. `describeModes` 는 service 를 호출하지 않는 동기 helper-derive 핸들러라 앞선 slice 들의 `findJob`/`findRunning` mock 배선과 달리 **service-무의존 read** 라는 고유 특성을 커버한다. REQ-048(조회 p95 < 3s) + REQ-030(Import mode 선택) / REQ-032(raw 미저장·미노출)를 cover 한다.

## Required Reading

- [test/perf/import-running-read.perf-spec.ts](../../test/perf/import-running-read.perf-spec.ts) — 본 spec 의 부트스트랩 mirror 원본(T-0842). 같은 `ImportController` + `ImportJobService` mock(`useValue`) + `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` useValue(passGuard) 무력화 패턴(mirror 원본 — 본 task 는 배선 대상 route 를 `running` findRunning → `modes` describeModes 로 치환하고, 반환 타입이 raw job 목록이 아니라 helper 가 derive 한 `ImportModeDescription[]`(항상 2 원소)임에 주석 반영. `describeModes` 는 service 호출이 없으므로 `ImportJobService` mock 은 부트스트랩 주입만 존재하고 본 endpoint 에서는 호출되지 않음 — spec 주석에 명시).
- [test/perf/export-status-view-read.perf-spec.ts](../../test/perf/export-status-view-read.perf-spec.ts) — 직전 derived read slice(T-0856). derived-detail 배선의 서술·집계 검증 패턴 참고(본 task 는 derived-*list* 이며 error path 는 service 예외 대신 성공 200 만 나오는 순수-helper 특성이라 다름 — 아래 Acceptance 참조).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` / `assertS2Threshold` / `RequestFn` 시그니처(호출·배선 대상, 변경 금지).
- [src/import/import.controller.ts](../../src/import/import.controller.ts) (line 135~153) — `@Get("modes") @UseGuards(JwtAuthGuard, RolesGuard) @Roles("Admin") describeModes()` → `[ImportMode.REPLACE, ImportMode.MERGE].map((mode) => describeImportMode(IMPORT_MODE_ENUM_TO_PAYLOAD[mode]))`. controller 자체 try/catch·client 입력 분기 0(항상 고정 2 mode, service 호출 없음, `:id` 동적 segment 보다 먼저 선언).
- [test/perf/README.md](../../test/perf/README.md) — perf-spec 카운트/목록 표(27 → 28 갱신 대상, 상단 목록 + 하단 endpoint 설명 둘 다).

## Acceptance Criteria

- [ ] `test/perf/import-modes-read.perf-spec.ts` 신설 — `GET /api/admin/import/modes` 를 `collectLatencySamples`/`assertS2Threshold` 에 배선. `JwtAuthGuard`·`RolesGuard` 는 `overrideGuard(...).useValue(passGuard)`(canActivate:()=>true)로 통과(import-running T-0842 mirror), `ImportJobService` 는 mock(`useValue`)로 부트스트랩 주입(본 endpoint 는 호출 안 함 — 주석 명시).
- [ ] **Happy-path test 1+**: `describeModes` 호출 → 200 N회 → `total===N`, `failures===0`, `samplesMs.length===N`, `assertS2Threshold(result).pass===true`, `errorRate===0`. 응답 body 가 `ImportModeDescription[]`(길이 2, REPLACE→destructive=true / MERGE→destructive=false)임을 최소 1개 field 로 확인(helper derive 결과 실증).
- [ ] **Error path test 1+**: 성공 latency 배선(2xx) 대비, collector 의 실패(non-2xx) 분기가 정상 동작함을 실증하기 위해 요청 함수가 non-2xx(예: 4xx/5xx status)를 반환하는 인위 케이스를 주입 → 전부 `failures`, `samplesMs.length===0`, `assertS2Threshold(result).pass===false` + "error rate 임계 초과" 사유 포함. (describeModes 는 순수-helper 라 자체 예외 경로가 없으므로 collector 실패 분기는 요청 wrapper 레벨에서 non-2xx 를 주입해 커버 — spec 주석에 이 차이 명시.)
- [ ] **Flow / branch coverage**: controller 자체 client 입력 분기 없음(항상 고정 2 mode helper forward) → 이 항목은 collector 의 성공(2xx)/실패(non-2xx) 분기를 정상 응답 vs 인위 non-2xx 로 커버함을 spec 주석에 명시(controller 분기 부재).
- [ ] **Negative cases 충분 cover** — 각 1+ test: (a) 요청 wrapper 가 non-2xx(예: 403/500)를 반환 → failures 분류(2xx 아님, samplesMs 미집계), (b) mixed 부분 실패(N회 중 1회만 non-2xx → `failures===1` 부분 집계 정확성), (c) `iterations===1` 경계에서 harness 정상 동작, (d) 응답 배열이 예상과 다른 길이(예: 빈 배열 또는 3 원소) 케이스에서도 harness 자체는 2xx 를 성공으로 정상 집계함(harness 는 body 형태에 무관 — 관심사 분리 실증).
- [ ] `pnpm test:perf` 통과 — 신규 spec 포함 28 suites green(`jest-perf.json` 의 `testRegex: test/perf/.*\.perf-spec\.ts$` 매칭).
- [ ] `pnpm lint && pnpm build` green.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — perf-spec 은 `.spec.ts$` 밖이라 unit coverage gate 에 회귀 무영향임을 tester 가 확인.
- [ ] `test/perf/README.md` 의 배선 endpoint 카운트/목록을 27 → 28(import /modes 추가)으로 갱신, derived-list(/modes) read 명시(상단 목록 괄호 + 하단 endpoint 설명 항목 둘 다).

## Out of Scope

- 실 DB round-trip baseline 실측 / 실 Prisma / k6 등 부하 발생기 / CI perf job 상시 편입(§5 item 3~5 별도 follow-up).
- `latency-collector.ts` / `latency-metrics.ts` 등 primitive·orchestration 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
- `describeImportMode` / `IMPORT_MODE_ENUM_TO_PAYLOAD` helper 자체 로직·mode 설명 문자열 단위 검증 — helper 전용 unit spec 소관(본 spec 은 정상 derive 경로만 배선).
- `export/:id/download`(StreamableFile·@Res passthrough·buffer collection·header serialize 로 heavier mocking 필요) 배선 — 별도 slice.
- `ImportController.findJob`(:id detail)·`findRunning`(running list) 재배선(각각 import-detail / import-running spec 이 이미 존재) — 본 spec 은 `modes` derived-list 만.
- POST/PATCH/DELETE write route perf 배선(본 spec 은 조회에 집중).
- 실 JWT 발급·검증·RBAC(@Roles("Admin")) escalation 자체 검증 — 본 spec 은 가드를 override 로 무력화한 뒤 latency 배선만(인증 정책은 기존 controller/service spec / roles.guard.spec / e2e).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 append)
