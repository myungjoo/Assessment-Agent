---
id: T-0859
title: S2 조회 latency harness 를 AppController GET /api health-read 에 배선하는 서른 번째 perf-spec 신설
phase: P8
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 250
estimatedFiles: 2
created: 2026-07-09
independentStream: s2-latency-harness
dependsOn: []
touchesFiles:
  - test/perf/app-root-read.perf-spec.ts
  - test/perf/README.md
plannerNote: "P8 load-resilience §5 follow-up #2 — S2 latency harness 30번째 perf-spec, AppController GET /api health-read(getStatus 고정 문자열, guard-free·service-무의존·분기 0의 최단 read) + README 28→30 카운트 catch-up(export-download T-0858 누락분 동반 반영)"
---

# T-0859 — S2 조회 latency harness 를 AppController GET /api health-read 에 배선하는 서른 번째 perf-spec 신설

## Why

[docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) §5 follow-up #2(S2 조회 latency harness 배선)의 **서른 번째 slice**다. T-0830~T-0858 이 29개 조회 endpoint(list/query/self-read 14 + `:id` detail 10 + `:id/persons` sub-resource 2 + derived-detail(`:id/status-view`) 1 + derived-list(`/modes`) 1 + artifact-stream(`:id/download`) 1)에 latency collector 를 배선했다. 다음 미배선 read 로 `AppController` 의 **health/sanity read** 인 `GET /api`(`getRoot` 핸들러 — `appService.getStatus()` 가 반환하는 고정 문자열 `APP_STATUS_MESSAGE`("Assessment-Agent")를 그대로 200 반환)을 배선한다.

이 endpoint 는 지금까지 배선한 모든 read 중 **가장 단순한 형태**다: (1) guard 미적용(가드 override 불요), (2) path/query param 없음, (3) service 는 `getStatus()` **동기 함수 1개만 호출**하며 예외 경로가 없음(항상 200 고정 문자열, `describeModes`(T-0857)의 순수-helper derive 보다도 단순 — helper derive 조차 없음). 따라서 harness 재사용이 복잡한 detail·derive·stream read 뿐 아니라 **최단 health-check read 에서도 유효함**을 실증하며, collector 배선 정확성 검증의 하한(floor) case 를 채운다(REQ-048 조회 p95 < 3s).

부수적으로 직전 slice(T-0858 export-download)가 `test/perf/README.md` 카운트/목록 갱신을 동반하지 않아 README 가 28 spec 에 머물러 있으므로, 본 task 에서 **README 를 28 → 30 으로 catch-up**(export-download `:id/download` + app-root `/api` 둘 다 반영)해 문서-실제 drift 를 해소한다.

## Required Reading

- [test/perf/import-modes-read.perf-spec.ts](../../test/perf/import-modes-read.perf-spec.ts) — 가장 가까운 부트스트랩 mirror(T-0857). service-무의존 read 라 service mock 은 부트스트랩 주입만 존재·본 endpoint 에서 미호출인 점, error path 를 요청 wrapper 레벨 인위 non-2xx 주입으로 커버하는 패턴이 본 task 와 동형(단 본 task 는 guard 미적용이라 `overrideGuard` 부분을 제거).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `collectLatencySamples` / `assertS2Threshold` / `RequestFn` 시그니처(호출·배선 대상, 변경 금지).
- [src/app.controller.ts](../../src/app.controller.ts) — `@Controller("api")` + `@Get() getRoot(): string { return this.appService.getStatus(); }`. 가드 부착 0, param 0, 분기 0. 배선 대상.
- [src/app.service.ts](../../src/app.service.ts) — `getStatus()` 가 고정 상수 `APP_STATUS_MESSAGE`("Assessment-Agent")를 반환. 예외 경로 없음.
- [test/perf/jest-perf.json](../../test/perf/jest-perf.json) — `testRegex: test/perf/.*\.perf-spec\.ts$` 매칭 확인(신설 spec 이 `pnpm test:perf` 로만 실행됨).
- [test/perf/README.md](../../test/perf/README.md) — perf-spec 카운트/목록 표(현재 28 로 기재됨 — export-download(T-0858) 미반영. 본 task 에서 28 → 30 으로 catch-up: `export-download`(artifact-stream, T-0858) + `app-root`(health, T-0859) 둘 다 상단 목록 + 하단 endpoint 설명 항목에 추가).

## Acceptance Criteria

- [ ] `test/perf/app-root-read.perf-spec.ts` 1개 파일 신설 — `AppController` 를 `Test.createTestingModule` 로 부트스트랩하고 `AppService` 를 `useValue` mock(`getStatus` jest.fn)으로 주입. 이 controller 는 guard 미적용이라 `overrideGuard` 는 불요(person-read/group-read 처럼 순수 부트스트랩) — 주석에 명시. `collectLatencySamples(() => request(app.getHttpServer()).get("/api"), N)` 로 배선.
- [ ] **Happy-path test 1+**: `getRoot` 가 정상 200(`getStatus` mockReturnValue("Assessment-Agent"))을 N회 반환할 때 `collectLatencySamples` 가 `total===N`, `failures===0`, `samplesMs.length===N`, `assertS2Threshold(result).pass===true`, `errorRate===0` 임을 검증. 별도 1개 assert 로 실 응답 body 가 고정 문자열("Assessment-Agent")이고 `getStatus` 가 실호출됨을 확인.
- [ ] **Error path test 1+**: `getStatus` 는 예외 경로가 없는 순수 동기 반환이므로(항상 200), collector 의 실패(non-2xx) 분기 정상 동작 실증은 **요청 wrapper 레벨에서 인위 non-2xx status(예: 500/503)를 주입**하는 케이스로 커버 → 전부 `failures`, `samplesMs.length===0`, `assertS2Threshold(result).pass===false` + "error rate 임계 초과" 사유 포함. (import-modes T-0857 의 순수-helper 패턴 mirror — service 자체 예외가 없어 wrapper 레벨 주입인 이유를 주석에 명시.)
- [ ] **Flow / branch cover**: controller 자체 client 입력 분기 없음(param 0, 항상 고정 문자열 forward) → 이 항목은 collector 의 성공(2xx)/실패(non-2xx) 분기를 정상 응답(200) vs 인위 non-2xx 로 각각 커버함을 spec 주석에 명시(controller 분기 부재).
- [ ] **Negative cases 충분 cover**(예외 상황 분기마다 1+): (a) 요청 wrapper 가 503(서비스 불가 성격 non-2xx) 반환 → failures 분류·samplesMs 미집계; (b) mixed 부분 실패 — N회 중 1회만 non-2xx → `failures===1` 부분 집계 정확성 + `errorRateMax:0` 로도 fail; (c) `iterations===1` 경계 → 단일 health-read 로도 harness 정상 동작; (d) 요청 wrapper 가 body 없이 status 200 만 반환해도 harness 는 성공 집계(collector 성공 판정이 body 문자열 shape 에 독립임 실증 — harness 는 status 만 성공 판정).
- [ ] `pnpm lint && pnpm build && pnpm test:perf` 통과 — 신설 spec 포함 전체 perf-spec(30 suites) green(`jest-perf.json` 의 `testRegex` 매칭).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — perf-spec 은 collector/controller 를 호출만 하고 `.spec.ts$` 밖이라 unit coverage gate 에 무회귀임을 tester 가 확인.
- [ ] `test/perf/README.md` 의 배선 endpoint 카운트/목록을 28 → 30 으로 catch-up: 상단 spec 목록에 `export-download-read`(artifact-stream, T-0858)·`app-root-read`(health, T-0859) 추가, 하단 endpoint 설명에 두 항목 추가(app-root 는 guard-free·service-무의존·분기 0 의 최단 health-read 임을, export-download 는 dual-service-call artifact-stream read 임을 명시), 본문 카운트 서술(28 → 30) 동기.

## Out of Scope

- 실 DB round-trip baseline 실측 / k6 등 부하 발생기 / CI perf job 상시 편입 / collector·assert 순수 로직 자체 변경 — 본 spec 은 primitive 를 **호출·배선**만 한다.
- `AppService.getStatus` / `APP_STATUS_MESSAGE` 상수 자체 로직·값 검증 — app.service.spec.ts / app.controller.spec.ts 소관. 본 spec 은 정상 200 경로만 배선한다.
- POST/PATCH/DELETE write route(예: export `describe-scope`·`preview-selection`·`POST` create) perf 배선 — 본 spec 은 조회에 집중(write/derive-POST latency 는 별도 후속 slice).
- 실 부트스트랩 health-probe(liveness/readiness) endpoint 신설 / e2e health smoke — 본 spec 은 기존 `GET /api` sanity read 에 collector 를 배선만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 append)
