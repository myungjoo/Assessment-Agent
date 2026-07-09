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

## 실 endpoint 배선 perf-spec (`summary-read` / `assessment-read` / `contribution-read` / `person-read` / `group-read` / `part-read` / `user-read` / `permission-denied-read` / `llm-provider-config-read` / `difficulty-mapping-read` / `cron-schedule-read` / `export-running-read` / `import-running-read` / `auth-me-read` / `summary-detail-read` / `group-detail-read` / `assessment-detail-read` / `person-detail-read` / `part-detail-read` / `contribution-detail-read` / `user-detail-read` / `llm-provider-config-detail-read` / `export-detail-read` / `import-detail-read` / `group-persons-read` / `part-persons-read` / `export-status-view-read` / `import-modes-read`)

collector 를 **실제 조회 endpoint** 에 배선하는 실 perf-spec 은 현재 스물여덟 개다. 스물여덟 다
`Test.createTestingModule` 로 대상 controller + **mocked service** 를 부트스트랩하고,
`collectLatencySamples(() => request(app.getHttpServer()).get(...), N)` 로 반복 호출해
표본을 수집하고 `assertS2Threshold(result).pass` 를 검증한다. `summary-read`·
`user-read`·`permission-denied-read`·`llm-provider-config-read`·`difficulty-mapping-read`·
`cron-schedule-read`·`export-running-read`·`import-running-read` 는 `JwtAuthGuard`/
`RolesGuard` 두 가드가 부착된 controller 라 둘 다
`overrideGuard(...).useValue({ canActivate: () => true })`
로 통과시키고, `auth-me-read` 는 `JwtAuthGuard` **만** 부착이라 그 하나만 override 하되
`canActivate` 가 `req.user = { sub }` 를 박제해야 me 핸들러가 sub 분기(200/404)에
도달한다(RolesGuard override 불요). `person-read`·`group-read`·`part-read` 는 guard
미적용 controller 라 override 가 불요하다. harness 가 단일 controller 에 국한되지 않고
요약·평가·기여·인원·그룹·파트·사용자·권한거부·LLM설정·난이도매핑·cron스케줄·export러닝·import러닝·auth-me·요약상세(:id)·그룹상세(:id)·평가상세(:id)·인원상세(:id)·파트상세(:id)·기여상세(:id)·사용자상세(:id)·LLM설정상세(:id)·export상세(:id)·import상세(:id)·그룹인원(:id/persons)·파트인원(:id/persons)·export진행뷰(:id/status-view)·import모드(/modes)
28 read 경로 전반에 재사용됨을 실증한다(단건 detail(:id) 24 + sub-resource(:id/persons) read 2 + derived-detail(:id/status-view) read 1 + derived-list(/modes) read 1).

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
- `auth-me-read.perf-spec.ts` (T-0843) — `AuthController` + 4 mock provider(`AuthService`·
  `UserRepository`·`JwtService`·`UserService`, me 경로가 실제로 호출하는 것은
  `userService.findById` 뿐), `GET /api/auth/me`(me → `userService.findById(req.user.sub)`
  → `UserResponseDto.fromEntity` — 인증된 사용자 자기 자신 조회, ADR-0008 §6 / REQ-048
  조회 back) 배선. 열네 번째 배선 spec. 앞선 12·13 slice(Export/Import 의 Admin 가드
  부착 raw-forward list)와 달리 이 endpoint 는 (1) `@UseGuards(JwtAuthGuard)` **만**
  부착(RolesGuard 미적용)이고 (2) **controller 자체 분기가 있는** self-read 다: sub 부재
  시 401(defence in depth), `findById` 가 stale token(DB row 삭제) 시 404
  (`NotFoundException`), 정상 시 5 필드(hashedPassword 제외) 200. 따라서 `user-read` 의
  passGuard 패턴을 mirror 하되 RolesGuard override 부분만 제거하고, `overrideGuard
  (JwtAuthGuard)` 의 `canActivate` 가 `req.user = { sub }` 를 박제해 me 핸들러가 sub 를
  읽어 200/404 분기에 도달하게 한다(req.user 미박제 시 401 분기). happy-path 는 응답
  body 에 hashedPassword 가 없음(UserResponseDto whitelist)도 함께 assert 한다. non-2xx
  분류 실증은 mocked `findById` 의 404(stale token) error path 와, req.user 미박제 guard
  를 쓰는 별도 module 의 401 defence-in-depth 분기로 커버한다.
- `summary-detail-read.perf-spec.ts` (T-0844) — `SummaryController` + mocked
  `SummaryService`(4 jest.fn, detail 경로가 실제 호출하는 것은 `findById` 뿐),
  `GET /api/summaries/:id`(findOne → `service.findById(id)` — 단일 Summary 상세, row
  부재 시 service `NotFoundException` → 404, REQ-048 조회 back) 배선. 열다섯 번째 배선
  spec 이자 **첫 path-param `:id` detail read**. 앞선 14 slice(summary-read(list)~
  auth-me-read)는 전부 list/query/self-read 경로였고, 본 spec 은 첫 단일 상세 조회(:id)
  라 harness 가 detail read 경로까지 재사용됨을 실증한다. 같은 controller 의 list
  endpoint(T-0830)와 같은 가드 스택(`@UseGuards(JwtAuthGuard, RolesGuard)` +
  `@Roles("User")`)을 공유하므로 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)`
  로 둘 다 통과시키되, self-read 가 아니라 `findById(id)` raw forward 라 req.user 박제는
  불요하다(canActivate true 만으로 충분 — auth-me-read 의 sub 박제와 대비). non-2xx 분류
  실증은 mocked `findById` 가 `NotFoundException`(404 — row 부재)/일반 `Error`(500 — 장애)
  를 던져 endpoint 가 404/500 을 반환하는 error path 로 커버하며(404 를 collector
  failures 로 분류), mixed 부분 실패(4회 중 1회 404 → failures===1)도 실증한다.
- `contribution-detail-read.perf-spec.ts` (T-0849) — `ContributionController` + mocked
  `ContributionService`(4 jest.fn, detail 경로가 실제 호출하는 것은 `findById` 뿐),
  `GET /api/contributions/:id`(findOne → `service.findById(id)` — 단일 Contribution 상세,
  row 부재 시 service `NotFoundException` → 404, REQ-048 조회 back) 배선. 스무 번째 배선
  spec 이자 **여섯 번째 path-param `:id` detail read** 이며 첫 Contribution entity 상세
  조회 경로다. detail 핸들러가 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`
  가드 스택을 적용하므로 assessment-detail-read(T-0846) 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 둘 다 통과시키되, self-read
  가 아니라 `findById(id)` raw forward 라 req.user 박제는 불요하다(canActivate true
  만으로 충분). non-2xx 분류 실증은 mocked `findById` 가 `NotFoundException`(404 — row
  부재)/일반 `Error`(500 — 장애)를 던져 endpoint 가 404/500 을 반환하는 error path 로
  커버하며(404 를 collector failures 로 분류), mixed 부분 실패(4회 중 1회 404 →
  failures===1)도 실증한다.
- `user-detail-read.perf-spec.ts` (T-0850) — `UserController` + mocked `UserService`
  (4 jest.fn, detail 경로가 실제 호출하는 것은 `findById` 뿐), `GET /api/users/:id`
  (detail → controller 자체 인가 분기: isSelf(actor.sub===id)/isAdminPlus(actor.role)
  통과 시 `service.findById(id)` → `UserResponseDto.fromEntity`(200), 둘 다 false 시
  `ForbiddenException`(403 — service 미도달), row 부재 시 `NotFoundException`(404),
  REQ-048 조회 back) 배선. 스물한 번째 배선 spec 이자 **일곱 번째 path-param `:id`
  detail read** 이며 **controller 자체 403 분기가 있는 첫 detail(:id)** 다. `GET
  /api/users/:id` 는 `@UseGuards(JwtAuthGuard)` **만** 부착(RolesGuard 미적용)이라
  auth-me-read(T-0843)처럼 `overrideGuard(JwtAuthGuard)` 의 `canActivate` 가 `req.user`
  를 박제하되, me 의 sub-only 박제와 달리 `{ sub, role }` 를 박제해 detail 핸들러가
  self/Admin+ 분기(200/403/404)에 도달하게 한다. passGuard payload 를 test 별로 달리해
  (User-self → 200, Admin-other → 200, User-other → 403) 세 분기를 각각 실증하고, mocked
  `findById` 의 `NotFoundException` 으로 404(not-found, 403 과 구분되는 non-2xx)를,
  403 분기에서는 `findById` 미호출(controller 가 service 도달 전 차단)을 함께 검증한다.
  happy-path 는 응답 body 에 hashedPassword 가 없음(UserResponseDto whitelist)도 assert,
  mixed 부분 실패(4회 중 1회 404 → failures===1)도 실증한다.
- `llm-provider-config-detail-read.perf-spec.ts` (T-0851) — `LlmProviderConfigController` +
  mocked `LlmProviderConfigService`(5 jest.fn, detail 경로가 실제 호출하는 것은 `findById`
  뿐), `GET /api/llm/providers/:id`(findById → `service.findById(id)` — 단일 LLM provider
  config 상세, row 부재 시 service `NotFoundException` → 404, 정상 시 apiKey 제거된
  `LlmProviderConfigView`(200), REQ-096 Admin 가시성 / REQ-048 조회 back) 배선. 스물두 번째
  배선 spec 이자 **여덟 번째 path-param `:id` detail read** 다. detail 핸들러가
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 가드 스택을 적용하므로
  assessment-detail-read(T-0846)·contribution-detail-read(T-0849) 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 둘 다 통과시키되, user :id
  (T-0850)의 controller 자체 403 분기와 달리 본 endpoint 는 controller 자체 authorization
  분기가 없어(RolesGuard 가 가드하는 것을 override 로 통과) `findById(id)` raw forward 라
  req.user 박제는 불요하다(canActivate true 만으로 충분). happy-path 는 응답 body 에
  apiKey 가 미노출(LlmProviderConfigView allow-list redaction — secret 은 view 타입에서
  제외)임을 함께 assert 한다. non-2xx 분류 실증은 mocked `findById` 가
  `NotFoundException`(404 — row 부재)/일반 `Error`(500 — 장애)를 던져 endpoint 가 404/500
  을 반환하는 error path 로 커버하며(404 를 collector failures 로 분류), mixed 부분
  실패(4회 중 1회 404 → failures===1)도 실증한다.
- `export-detail-read.perf-spec.ts` (T-0852) — `ExportController` + mocked
  `ExportJobService`(5 jest.fn, detail 경로가 실제 호출하는 것은 `findJob` 뿐),
  `GET /api/admin/export/:id`(findJob → `service.findJob(id)` — 단건 status polling
  조회, row 부재 시 service 의 `findUniqueOrThrow` 가 P2025 → `NotFoundException` → 404,
  정상 시 단건 `ExportJob`(200), REQ-096 Admin export/import 가시성 / REQ-048 조회 back)
  배선. 스물세 번째 배선 spec 이자 **아홉 번째 path-param `:id` detail read** 다. detail
  핸들러가 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 가드 스택을
  적용하므로 llm-provider-config-detail-read(T-0851) 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 둘 다 통과시키되, user :id
  (T-0850)의 controller 자체 403 분기와 달리 본 endpoint 는 controller 자체 authorization
  분기가 없어(RolesGuard 가 가드하는 것을 override 로 통과) `findJob(id)` raw forward 라
  req.user 박제는 불요하다(canActivate true 만으로 충분). 같은 export 모듈 sibling
  spec(export-running-read.perf-spec.ts, T-0841)의 부트스트랩(ExportController +
  `ExportJobService` mock 단일 주입)을 재사용한다. non-2xx 분류 실증은 mocked `findJob`
  이 `NotFoundException`(404 — row 부재)/일반 `Error`(500 — 장애)를 던져 endpoint 가
  404/500 을 반환하는 error path 로 커버하며(404 를 collector failures 로 분류), mixed
  부분 실패(4회 중 1회 404 → failures===1)도 실증한다.
- `import-detail-read.perf-spec.ts` (T-0853) — `ImportController` + mocked
  `ImportJobService`(3 jest.fn, detail 경로가 실제 호출하는 것은 `findJob` 뿐),
  `GET /api/admin/import/:id`(findJob → `service.findJob(id)` — 단건 status polling
  조회, row 부재 시 service 의 `findUniqueOrThrow` 가 P2025 → `NotFoundException` → 404,
  정상 시 단건 `ImportJob`(200), REQ-096 Admin export/import 가시성 / REQ-048 조회 back)
  배선. 스물네 번째 배선 spec 이자 **열 번째 path-param `:id` detail read** 다. 직전
  export :id detail slice(T-0852)와 export↔import counterpart 로 대칭이다. detail
  핸들러가 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 가드 스택을
  적용하므로 export-detail-read(T-0852) 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 둘 다 통과시키되, user :id
  (T-0850)의 controller 자체 403 분기와 달리 본 endpoint 는 controller 자체 authorization
  분기가 없어(RolesGuard 가 가드하는 것을 override 로 통과) `findJob(id)` raw forward 라
  req.user 박제는 불요하다(canActivate true 만으로 충분). 같은 import 모듈 sibling
  spec(import-running-read.perf-spec.ts, T-0842)의 부트스트랩(ImportController +
  `ImportJobService` mock 단일 주입)을 재사용한다. non-2xx 분류 실증은 mocked `findJob`
  이 `NotFoundException`(404 — row 부재)/일반 `Error`(500 — 장애)를 던져 endpoint 가
  404/500 을 반환하는 error path 로 커버하며(404 를 collector failures 로 분류), mixed
  부분 실패(4회 중 1회 404 → failures===1)도 실증한다.
- `group-persons-read.perf-spec.ts` (T-0854) — `GroupController` + mocked
  `GroupService`(sub-resource 경로가 실제 호출하는 것은 `findPersonsByGroupId` 뿐),
  `GET /api/groups/:id/persons`(findPersons → `service.findPersonsByGroupId(id)` —
  지정 Group 소속 Person 목록, Group 부재 시 service 사전 검증이 `NotFoundException` →
  404, Group 있고 membership 0 이면 200 + 빈 배열(404 아님), membership 1+ 면 200 +
  Person[], REQ-048 조회 back) 배선. 스물다섯 번째 배선 spec 이자 **첫 sub-resource
  (:id/persons) read** 다. 직전 24 spec 이 모두 list/query/self 또는 단건 detail(:id)
  read 였고, 본 slice 는 단건 detail 을 넘어 하위 리소스 목록 조회 경로로 harness 를
  확장한다. `GroupController` 는 group-detail(T-0845)·group-read(list) 와 같이 guard
  미적용이라 `overrideGuard` 없이 순수 부트스트랩하며, `findPersons` 는 `@Param("id")`
  를 `findPersonsByGroupId(id)` 로 raw forward 라 controller 자체 분기가 없다. 반환이
  단건 object 가 아니라 **Person[] 목록**이라 정상 응답이 배열이며, membership 0 → 빈
  배열도 200 성공으로 분류하는 **empty-list happy-path** 를 별도 커버한다. non-2xx 분류
  실증은 mocked `findPersonsByGroupId` 가 `NotFoundException`(404 — Group 부재)/일반
  `Error`(500 — 장애)를 던져 endpoint 가 404/500 을 반환하는 error path 로 커버하며(404
  를 collector failures 로 분류), mixed 부분 실패(4회 중 1회 404 → failures===1)도
  실증한다.
- `part-persons-read.perf-spec.ts` (T-0855) — `PartController` + mocked
  `PartService`(sub-resource 경로가 실제 호출하는 것은 `findPersonsByPartId` 뿐),
  `GET /api/parts/:id/persons`(findPersons → `service.findPersonsByPartId(id)` —
  지정 Part 소속 Person 목록, Part 부재 시 service 사전 검증(`findById(partId)`
  재호출)이 `NotFoundException` → 404, Part 있고 소속 Person 0 이면 200 + 빈 배열
  (404 아님), 소속 Person 1+ 면 200 + Person[], REQ-048 조회 back + REQ-028 reverse
  query) 배선. 스물여섯 번째 배선 spec 이자 **두 번째 sub-resource(:id/persons)
  read** 다. 직전 group-persons(T-0854)와 group↔part counterpart 로 대칭이다.
  `PartController` 는 part-detail(T-0854 sibling)·part-read(list) 와 같이 guard
  미적용이라 `overrideGuard` 없이 순수 부트스트랩하며(group-persons T-0854 mirror),
  `findPersons` 는 `@Param("id")` 를 `findPersonsByPartId(id)` 로 raw forward 라
  controller 자체 분기가 없다. 반환이 단건 object 가 아니라 **Person[] 목록**이라
  정상 응답이 배열이며, 소속 Person 0 → 빈 배열도 200 성공으로 분류하는
  **empty-list happy-path** 를 별도 커버한다. non-2xx 분류 실증은 mocked
  `findPersonsByPartId` 가 `NotFoundException`(404 — Part 부재)/일반 `Error`(500 —
  장애)를 던져 endpoint 가 404/500 을 반환하는 error path 로 커버하며(404 를
  collector failures 로 분류), mixed 부분 실패(4회 중 1회 404 → failures===1)도
  실증한다.
- `export-status-view-read.perf-spec.ts` (T-0856) — `ExportController` + mocked
  `ExportJobService`(5 jest.fn, derived-detail 경로가 실제 호출하는 것은 `findJob`
  뿐), `GET /api/admin/export/:id/status-view`(statusView → `service.findJob(id)` 로
  job 조회 후 `describeExportJobStatus(JOB_STATUS_TO_VIEW[job.status])` 로 사람-친화
  `ExportJobStatusView`(phaseLabel·terminal·downloadable·한국어 message)를 200 반환,
  job 부재 시 findJob 의 `NotFoundException`(404)이 helper 호출 도달 전 raw propagate,
  REQ-030 async job 진행 view / REQ-032 raw stack 미노출 / REQ-048 조회 back) 배선.
  스물일곱 번째 배선 spec 이자 **첫 derived-detail(:id/status-view) read** 다. 앞선 26
  spec 중 export :id detail(T-0852)이 raw record(단건 ExportJob)를 반환한 반면, 본
  endpoint 는 status 를 view 로 derive 하는 조합 read 라 harness 재사용이 순수
  pass-through 뿐 아니라 derive 경로에서도 유효함을 실증한다. statusView 핸들러가
  `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")` 가드 스택을 적용하므로
  export-detail-read(T-0852) 처럼 `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)`
  로 둘 다 통과시키되, controller 자체 authorization 분기가 없어(RolesGuard 가 가드하는
  것을 override 로 통과) `findJob(id)` raw forward 라 req.user 박제는 불요하다(canActivate
  true 만으로 충분). 서로 다른 JobStatus(진행 중 RUNNING → "running" / terminal
  SUCCEEDED → "ready")를 mock 으로 주어 JOB_STATUS_TO_VIEW 매핑 + helper derive 가 각각
  정상 200 으로 분류되고 view 가 status 별로 phaseLabel·terminal 을 달리 산출함을
  실증하며, 응답 body 가 raw ExportJob 이 아니라 derive 된 `ExportJobStatusView` 임을
  최소 1개 field(phaseLabel·terminal)로 확인한다. non-2xx 분류 실증은 mocked `findJob`
  이 `NotFoundException`(404 — job 부재)/일반 `Error`(500 — 장애)를 던져 endpoint 가
  404/500 을 반환하는 error path 로 커버하며(404 를 collector failures 로 분류), mixed
  부분 실패(4회 중 1회 404 → failures===1)도 실증한다.
- `import-modes-read.perf-spec.ts` (T-0857) — `ImportController` + mocked
  `ImportJobService`(3 jest.fn, **describeModes 는 이 mock 을 전혀 호출하지 않음** —
  service-무의존 read), `GET /api/admin/import/modes`(describeModes → 고정 2 mode
  (Prisma `ImportMode.REPLACE`/`MERGE`)를 `IMPORT_MODE_ENUM_TO_PAYLOAD` 로 lowercase
  `ImportRestoreMode` 변환 후 `describeImportMode` helper 로 derive 한
  `ImportModeDescription[]`(항상 길이 2: REPLACE→destructive=true / MERGE→destructive=false)
  를 200 반환, client 입력 분기 0 / persistence 0, REQ-030 Import mode 선택 / REQ-032
  raw 미저장·미노출 / REQ-048 조회 back) 배선. 스물여덟 번째 배선 spec 이자 **첫
  derived-list(/modes) read** 다. 직전 export :id/status-view(T-0856)가 단건 status 를
  view 로 derive 하는 derived-detail 이었다면, 본 endpoint 는 고정 목록을 helper 로
  derive 하는 derived-list 라 harness 재사용이 pass-through·조합 detail 뿐 아니라 파생
  목록 read 에서도 유효함을 실증한다. describeModes 는 `@UseGuards(JwtAuthGuard,
  RolesGuard)` + `@Roles("Admin")` 가드 스택을 적용하므로 import-running(T-0842) 처럼
  `overrideGuard(JwtAuthGuard)`·`overrideGuard(RolesGuard)` 로 둘 다 통과시키되,
  controller 자체 authorization 분기가 없어 req.user 박제는 불요하다(canActivate true
  만으로 충분). 앞선 findJob/findRunning mock-예외 slice 들과 달리 describeModes 는
  **service 를 전혀 호출하지 않는 순수 helper-derive** 라 자체 예외 경로가 없다(항상
  200). 따라서 non-2xx 분류 실증은 mocked service 예외가 아니라 **요청 wrapper 레벨에서
  인위 non-2xx status(403/500)를 주입**해 collector 의 실패 분기를 커버하며, happy-path
  는 응답 body 가 helper derive 결과 `ImportModeDescription[]`(길이 2, destructive
  true/false)임과 service mock 미발화를 함께 assert 한다. mixed 부분 실패(4회 중 1회 500
  → failures===1)와 harness 가 body 형태에 무관(status 만 성공 판정)함도 실증한다.

- **DB 무의존**: service 를 mock 하고(guard 있는 controller 는 override 도) 실 Postgres
  round-trip·실 LLM·실 스케줄러·외부 I/O 가 없어 결정론적이다. 실 DB round-trip
  **baseline 실측**은 별도 follow-up (§5 item 5). 스물여덟 spec 모두 collector 배선의
  **정확성 검증**이지 baseline 측정이 아니다.
- **실행**: `pnpm test:perf` (`jest-perf.json` 의 `testRegex: test/perf/.*\.perf-spec\.ts$`
  가 스물여덟 파일을 모두 picking — 더 이상 `passWithNoTests` 로 skip 되지 않는다). 기본
  `pnpm test` 는 `.spec.ts$` 만 매칭하므로 perf-spec 을 picking 하지 않아 unit coverage
  gate 와 분리된다.
- perf job 은 상시 PR CI 와 분리한다(follow-up #4).

## 후속 harness (DB-backed baseline / S1·S3)

실 조회 endpoint round-trip latency **baseline 실측**(실 Postgres)·S1 배치 부하·S3 동시성
내성 harness 는 별도 follow-up 이며 이 primitive 를 import 한다(§5 item 1/3/5).
