# test/perf — S2 조회 latency 경량 harness

부하·내성 계획([load-resilience-test-plan.md](../../docs/ops/load-resilience-test-plan.md) §5 follow-up #2)의
**S2 조회 latency measure**(REQ-048, p95 < 3s)를 위한 자리다. 신규 dependency 없이 기존
`supertest` 로 진행한다(k6/artillery 등 발생기는 ADR-0054, owner 승인 후 별도 task).

## 측정 primitive (`latency-metrics.ts`)

DB·네트워크·앱 부트스트랩에 의존하지 않는 **순수 함수**(입력 배열 → 출력 수치).

- `percentile(samplesMs, p)` — p-분위수(0~100, 선형 보간).
- `summarizeLatency(samplesMs)` — `{ p50, p95, p99, count, maxMs }`(§3 임계 표 대응).
- `errorRate(total, failures)` — non-2xx/전체 비율(0~1), total=0 방어.

```ts
import { summarizeLatency, errorRate } from "./latency-metrics";
const s = summarizeLatency(samplesMs); // p95 < 3000(ms) 검증
const er = errorRate(reqs.length, fails); // er < 0.01 검증
```

`latency-metrics.spec.ts` 는 순수 unit 이라 기본 `pnpm test` 에서도 수집·검증된다.

## 표본 수집기 (`latency-collector.ts`)

요청 함수를 주입받아 반복 호출하며 latency 표본을 모으고 S2 임계를 판정하는 순수
orchestration 로직(DB·네트워크 무의존, clock 주입으로 결정론적).

- `collectLatencySamples(request, iterations, opts?)` → `{ samplesMs, total, failures }`.
  `request: () => Promise<{ ok?: boolean; status?: number }>`, `opts.now?` 로 clock 주입.
- `assertS2Threshold(result, thresholds?)` → `{ pass, summary, errorRate, reasons }`.
  기본 임계 p95 < 3000ms(REQ-048) / errorRate < 0.01(§3), 위반 사유는 `reasons` 축적.

```ts
import { collectLatencySamples, assertS2Threshold } from "./latency-collector";
// 후속 *.perf-spec.ts 에서 supertest 호출 함수를 주입:
const r = await collectLatencySamples(() => request(app).get("/summary"), 30);
expect(assertS2Threshold(r).pass).toBe(true);
```

## 실 endpoint 배선 perf-spec (`summary-read` / `assessment-read` / `contribution-read` / `person-read` / `group-read` / `part-read` / `user-read` / `permission-denied-read` / `llm-provider-config-read` / `difficulty-mapping-read` / `cron-schedule-read` / `export-running-read` / `import-running-read`)

collector 를 **실제 조회 endpoint** 에 배선하는 실 perf-spec 은 현재 열세 개다. 열세 다
`Test.createTestingModule` 로 대상 controller + **mocked service** 를 부트스트랩하고,
`collectLatencySamples(() => request(app.getHttpServer()).get(...), N)` 로 반복 호출해
표본을 수집하고 `assertS2Threshold(result).pass` 를 검증한다. `summary-read`·
`user-read`·`permission-denied-read`·`llm-provider-config-read`·`difficulty-mapping-read`·
`cron-schedule-read`·`export-running-read`·`import-running-read` 는 guard 가 부착된
controller 라 `JwtAuthGuard`/`RolesGuard` 를
`overrideGuard(...).useValue({ canActivate: () => true })`
로 통과시키지만, `person-read`·`group-read`·`part-read` 는 guard 미적용 controller 라
override 가 불요하다. harness 가 단일 controller 에 국한되지 않고
요약·평가·기여·인원·그룹·파트·사용자·권한거부·LLM설정·난이도매핑·cron스케줄·export러닝·import러닝
13 read 경로 전반에 재사용됨을 실증한다.

- `summary-read.perf-spec.ts` (T-0830) — `SummaryController` + mocked `SummaryService`,
  `GET /api/summaries?personId=...` 배선. 첫 실 perf-spec.
- `assessment-read.perf-spec.ts` (T-0831) — `AssessmentController` + mocked
  `AssessmentService`, `GET /api/assessments?personId=&period=`(REQ-038 시계열 조회) 배선.
  두 번째 배선 spec. 이 endpoint 는 `personId` query 누락 시 controller 가
  `BadRequestException`(400) 을 강제하는 고유 분기가 있어, collector 가 non-2xx(400) 도
  `failures` 로 정확히 분류하는지 추가 검증한다.
- `contribution-read.perf-spec.ts` (T-0832) — `ContributionController` + mocked
  `ContributionService`, `GET /api/contributions?assessmentId=...`(REQ-033 aggregate-level
  기여 조회) 배선. 세 번째 배선 spec. 이 endpoint 도 `assessmentId` query 누락/빈 string
  시 controller 가 `BadRequestException`(400) 을 강제하는 분기가 있어, collector 의
  non-2xx(400) 분류 검증을 이어간다.
- `person-read.perf-spec.ts` (T-0833) — `PersonController` + mocked `PersonService`,
  `GET /api/persons`(REQ-048 active 인원 목록 조회) 배선. 네 번째 배선 spec. 이
  controller 는 guard 미적용이라 `overrideGuard` 가 불요하며, query-param 400 분기가
  없어 non-2xx 분류 실증은 `GET /api/persons/:id` 의 404(mocked `findById` 이
  `NotFoundException` throw) 분기로 이어간다.
- `group-read.perf-spec.ts` (T-0834) — `GroupController` + mocked `GroupService`,
  `GET /api/groups`(REQ-048 Group 목록 조회) 배선. 다섯 번째 배선 spec. 이 controller 도
  guard 미적용이라 `overrideGuard` 가 불요하며(person-read 와 동일), query-param 400
  분기가 없어 non-2xx 분류 실증은 `GET /api/groups/:id` 의 404(mocked `findById` 이
  `NotFoundException` throw) 분기로 이어간다.
- `part-read.perf-spec.ts` (T-0835) — `PartController` + mocked `PartService`,
  `GET /api/parts`(REQ-048 Part 목록 조회) 배선. 여섯 번째 배선 spec. 이 controller 도
  guard 미적용이라 `overrideGuard` 가 불요하며(person-read·group-read 와 동일),
  query-param 400 분기가 없어 non-2xx 분류 실증은 `GET /api/parts/:id` 의 404(mocked
  `findById` 이 `NotFoundException` throw) 분기로 이어간다.
- `user-read.perf-spec.ts` (T-0836) — `UserController` + mocked `UserService`,
  `GET /api/users`(REQ-048 사용자 목록 조회) 배선. 일곱 번째 배선 spec. 이 endpoint 는
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가 부착된 첫 list
  조회** 라 `summary-read` 처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)`
  로 가드를 무력화한다. non-2xx 분류 실증은 `GET /api/users/:id` 의 404(mocked `findById`
  이 `NotFoundException` throw) 분기로 커버하되, `detail` 핸들러가 self-vs-admin 분기에서
  `@CurrentUser() actor` 를 읽으므로 JwtAuthGuard override 의 `canActivate` 가 `req.user`
  를 Admin payload 로 박제해 `findById` 에 결정론적으로 도달시킨다.
- `permission-denied-read.perf-spec.ts` (T-0837) — `PermissionDeniedRecordController` +
  mocked `PermissionDeniedRecordService`, `GET /api/permission-denied-records`(REQ-033
  권한 거부 audit 조회) 배선. 여덟 번째 배선 spec. 이 endpoint 는
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` 로 **가드가 부착된 audit
  조회** 라 `user-read` 처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)`
  로 가드를 무력화한다. 또한 `instanceRef`/`provider`/`httpStatus` **query param 필터
  분기**(`parseHttpStatus` 숫자 변환 포함)를 가지므로, negative case (b) 로
  `?provider=github&httpStatus=403` query param 이 붙은 경로도 harness 가 latency 를
  정상 수집함을 실증한다. non-2xx 분류 실증은 mocked `list` 가 예외를 던져 endpoint 가
  500 을 반환하는 error path 로 커버한다(list 는 actor 를 mocked service 로만 forward
  하므로 req.user 박제 불요 — canActivate true 만으로 충분).
- `llm-provider-config-read.perf-spec.ts` (T-0838) — `LlmProviderConfigController` +
  mocked `LlmProviderConfigService`, `GET /api/llm/providers`(REQ-096 Admin 가시성 /
  REQ-048 조회 back) 배선. 아홉 번째 배선 spec. 이 endpoint 는
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가 부착된 Admin
  list read** 라 `user-read`·`permission-denied-read` 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한다.
  `findAll` 핸들러는 query param 도 `@CurrentUser()` actor 도 읽지 않고 mocked
  `findAll()` 를 raw forward(apiKey 제거 view 배열 반환, controller 자체 분기 없음)하므로
  req.user 박제가 불요하다(canActivate true 만으로 충분). negative case 로 빈 배열(등록
  0)·다건 배열도 harness 가 정상 수집함을 실증한다. non-2xx 분류 실증은 mocked `findAll`
  이 예외를 던져 endpoint 가 500 을 반환하는 error path 로 커버한다.
- `difficulty-mapping-read.perf-spec.ts` (T-0839) — `DifficultyMappingController` +
  mocked `DifficultyMappingService`, `GET /api/llm/difficulty-mappings`(findAll →
  `findAllMappings` — 3 고정 슬롯(easy/medium/hard) 난이도↔model 매핑 목록 조회,
  REQ-096 Admin 가시성 / REQ-048 조회 back) 배선. 열 번째 배선 spec. 이 endpoint 는
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가 부착된 Admin
  list read** 라 `user-read`·`permission-denied-read`·`llm-provider-config-read` 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한다.
  `findAll` 핸들러는 query param 도 `@CurrentUser()` actor 도 읽지 않고 mocked
  `findAllMappings()` 를 raw forward(repository.findMany 순서 그대로 반환, controller
  자체 분기 없음)하므로 req.user 박제가 불요하다(canActivate true 만으로 충분).
  negative case 로 빈 배열(슬롯 seed 전)·3 슬롯 배열도 harness 가 정상 수집함을 실증한다.
  non-2xx 분류 실증은 mocked `findAllMappings` 이 예외를 던져 endpoint 가 500 을
  반환하는 error path 로 커버한다.
- `cron-schedule-read.perf-spec.ts` (T-0840) — `CronScheduleController` + mocked
  `CronScheduleService`, `GET /api/schedules`(list → `service.list()` — 현재 등록된
  cron job 이름 `string[]` 조회, REQ-096 Admin 가시성 / REQ-048 조회 back) 배선.
  열한 번째 배선 spec. 이 endpoint 는 `@UseGuards(JwtAuthGuard, RolesGuard)` +
  `@Roles("Admin")` 로 **가드가 부착된 Admin list read** 라
  `user-read`·`permission-denied-read`·`llm-provider-config-read`·`difficulty-mapping-read`
  처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한다.
  또한 controller 가 `@Inject(CRON_TICK_HANDLER)` 로 `CronTickHandler` 를 함께
  주입받으므로, 테스트 모듈은 `CronScheduleService` mock 과 더불어 `CRON_TICK_HANDLER`
  **no-op `useValue` provider**(list 경로 미호출)도 제공해야 부트스트랩이 성립한다.
  `list` 핸들러는 query param 도 `@CurrentUser()` actor 도 읽지 않고 mocked `list()` 를
  raw forward(등록 job 이름 순서 그대로 반환, 빈 배열도 404 변환 없음, controller 자체
  분기 없음)하므로 req.user 박제가 불요하다(canActivate true 만으로 충분). negative
  case 로 빈 배열(등록 0)·다건 배열도 harness 가 정상 수집함을 실증한다. non-2xx 분류
  실증은 mocked `list` 이 예외를 던져 endpoint 가 500 을 반환하는 error path 로 커버한다.
- `export-running-read.perf-spec.ts` (T-0841) — `ExportController` + mocked
  `ExportJobService`, `GET /api/admin/export/running`(findRunning →
  `service.findRunning()` — status=RUNNING 인 ExportJob 목록 조회, UC-07 §8 status
  polling / REQ-030 Export / REQ-045 Admin 전용 / REQ-048 조회 back) 배선. 열두 번째
  배선 spec. 이 endpoint 는 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`
  로 **가드가 부착된 Admin list read** 라
  `user-read`·`permission-denied-read`·`llm-provider-config-read`·`difficulty-mapping-read`·`cron-schedule-read`
  처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한다.
  단 cron-schedule 과 달리 `ExportController` 생성자는 `ExportJobService` 하나만
  주입받아 부가 provider 가 **불요**하다(더 단순). `findRunning` 핸들러는 query param
  도 `@CurrentUser()` actor 도 읽지 않고 mocked `findRunning()` 를 raw forward(RUNNING
  job 배열 순서 그대로 반환, 빈 배열도 404 변환 없음, controller 자체 분기 없음)하므로
  req.user 박제가 불요하다(canActivate true 만으로 충분). negative case 로 빈 배열(진행
  중 0)·다건 배열도 harness 가 정상 수집함을 실증한다. non-2xx 분류 실증은 mocked
  `findRunning` 이 예외를 던져 endpoint 가 500 을 반환하는 error path 로 커버한다.
- `import-running-read.perf-spec.ts` (T-0842) — `ImportController` + mocked
  `ImportJobService`, `GET /api/admin/import/running`(findRunning →
  `service.findRunning()` — status=RUNNING 인 ImportJob 목록 조회, UC-07 §8 status
  polling / REQ-030 Import / REQ-045 Admin 전용 / REQ-048 조회 back) 배선. 열세 번째
  배선 spec. export-running(T-0841)과 export↔import counterpart 로 대칭이다. 이
  endpoint 는 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 로 **가드가
  부착된 Admin list read** 라
  `user-read`·`permission-denied-read`·`llm-provider-config-read`·`difficulty-mapping-read`·`cron-schedule-read`·`export-running-read`
  처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 가드를 무력화한다.
  export 와 동형으로 `ImportController` 생성자는 `ImportJobService` 하나만 주입받아 부가
  provider 가 **불요**하다(cron-schedule 의 `@Inject(CRON_TICK_HANDLER)` 대비 단순).
  `findRunning` 핸들러는 query param 도 `@CurrentUser()` actor 도 읽지 않고 mocked
  `findRunning()` 를 raw forward(RUNNING job 배열 순서 그대로 반환, 빈 배열도 404 변환
  없음, controller 자체 분기 없음)하므로 req.user 박제가 불요하다(canActivate true
  만으로 충분). negative case 로 빈 배열(진행 중 0)·다건 배열(REPLACE/MERGE 혼재)도
  harness 가 정상 수집함을 실증한다. non-2xx 분류 실증은 mocked `findRunning` 이 예외를
  던져 endpoint 가 500 을 반환하는 error path 로 커버한다.

- **DB 무의존**: service 를 mock 하고(guard 있는 controller 는 override 도) 실 Postgres
  round-trip·실 LLM·실 스케줄러·외부 I/O 가 없어 결정론적이다. 실 DB round-trip
  **baseline 실측**은 별도 follow-up (§5 item 5). 열세 spec 모두 collector 배선의
  **정확성 검증**이지 baseline 측정이 아니다.
- **실행**: `pnpm test:perf` (`jest-perf.json` 의 `testRegex: test/perf/.*\.perf-spec\.ts$`
  가 열세 파일을 모두 picking — 더 이상 `passWithNoTests` 로 skip 되지 않는다). 기본
  `pnpm test` 는 `.spec.ts$` 만 매칭하므로 perf-spec 을 picking 하지 않아 unit coverage
  gate 와 분리된다.
- perf job 은 상시 PR CI 와 분리한다(follow-up #4).

## 후속 harness (DB-backed baseline / S1·S3)

실 조회 endpoint round-trip latency **baseline 실측**(실 Postgres)·S1 배치 부하·S3 동시성
내성 harness 는 별도 follow-up 이며 이 primitive 를 import 한다(§5 item 1/3/5).
