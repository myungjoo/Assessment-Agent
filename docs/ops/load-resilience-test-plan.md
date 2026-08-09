# 부하·내성 테스트 계획 (Load / Resilience Test Plan)

본 문서는 Assessment-Agent 의 **부하·내성 테스트 계획**이다. 시나리오·측정 임계·접근
방식·필요 도구를 **먼저 문서로 확정**하고, 실제 harness 구현·CI 통합·도구 도입은
follow-up 으로 남긴다(doc-first). 실제 부하 harness 는 신규 외부 dependency(k6 /
artillery / autocannon 등)를 요구할 가능성이 커, [CLAUDE.md §5](../../CLAUDE.md) 상
새 dependency 추가는 BLOCKED(사람 승인 → ADR)이다 — 따라서 **본 문서는 계획만** 담고
도구 선택 결정 자체는 본 문서 범위 밖이다(§5 follow-up 참조).

관련 문서:

- [docs/requirements.md](../requirements.md) — REQ-047 / REQ-048 (성능 NFR, 둘 다 PLANNED).
- [docs/ops/runbook.md](runbook.md) — 운영 런북(배포·복구·trouble-shoot), 본 문서와 cross-link.
- [docs/ops/daily-deploy-test.md](daily-deploy-test.md) — 일일 배포·자동 테스트 플레이북(기능 스모크, 부하 아님).

> **범위 한정**: 본 문서는 *계획 문서*다. 실제 부하 스크립트·측정 실행·도구 도입은
> 별도 task(대개 pr-mode + 신규 dependency ADR)로 넘긴다(§5).

---

## 1. 목표·범위

부하·내성 테스트는 README 성능 특성(88~92행)을 back 하는 두 NFR 을 검증한다.

- **REQ-047** (requirements.md line 66) — 100~200명 평가대상 × 50~100 repo × ~1000
  confluence page 규모의 **평가 작성 배치가 1시간 이내** 완료. 검증 위치 enum
  `manual + perf test`, 상태 PLANNED.
- **REQ-048** (requirements.md line 67) — 이미 저장된 평가 결과 **조회·시각화가 3초
  이내**(거의 실시간). 검증 위치 enum `perf test`, 상태 PLANNED.

두 REQ 모두 requirements.md line 10 의 검증 위치 enum 중 **`perf`** 에 매핑된다 — 본
계획이 그 `perf` 검증의 시나리오·임계·접근을 정의한다. 기능 정합(functional
correctness)은 unit / e2e 가 이미 cover 하므로 본 문서 범위 밖이며, 본 문서는 **부하 하
성능·내성**만 다룬다.

**범위 밖**: 기능 검증(unit/e2e), 성능 최적화(코드 변경), 실제 harness 코드·CI step 추가.

---

## 2. 부하 시나리오

최소 3 개 시나리오를 정량 임계와 함께 정의한다. 규모 수치는 REQ-047/048 의 기대치에서
파생한다.

### S1. 평가 배치 부하 (REQ-047)

- **부하**: 100~200명 평가대상 × 50~100 repo × ~1000 confluence page 규모의 평가 작성
  배치 1 회.
- **목표**: 배치 **완료 시간 ≤ 1h**. LLM 호출·수집(GitHub/Confluence)·저장 전 구간 포함.
- **관찰**: 완료 시간, 단계별(수집 / LLM / 저장) 소요 분포, 실패·재시도 건수.
- **주의**: 실 LLM·외부 수집 endpoint 의존도가 커, 부하 측정 시 stub/record-replay 또는
  격리 endpoint 필요(§4 참조) — 순수 서버 처리량과 외부 I/O 대기를 분리 측정.

### S2. 조회 API 응답 지연 (REQ-048)

- **부하**: 이미 저장된 평가 결과에 대한 조회·시각화 read 요청을 반복(warm cache /
  cold 양쪽).
- **목표**: **p95 latency < 3s** (README line 92 "3초 이내"). p50 도 함께 관찰.
- **관찰**: p50 / p95 / p99 latency, throughput(req/s), error rate.
- **대상 endpoint**: 조회·시각화 read API(요약·평가 결과 조회 경로). 실제 대상 목록은
  harness 구현 시 [docs/architecture](../architecture) 의 API 뷰에서 확정.

### S3. 동시 요청 내성 (Resilience)

- **부하**: concurrent read + write(평가 작성 진행 중 조회) 혼합 부하를 동시성 수준을
  올려가며 인가.
- **목표**: 동시성 증가 하에서 **error rate 급증·latency cliff 부재**(graceful
  degradation). 명시 임계는 harness 실측 baseline 확정 후 fix(초기 가이드: error rate
  < 1%, p95 저하가 부하 대비 linear 이내).
- **관찰**: 동시성 단계별 error rate·p95, 커넥션 풀·DB 포화 지점, 타임아웃 발생.

---

## 3. 측정 지표·임계

각 시나리오의 pass/fail 판정 지표를 표로 명시한다. 임계 중 "baseline 후 fix" 표기는
harness 최초 실측으로 기준선을 잡은 뒤 확정한다(over-fitting 방지).

| 시나리오 | 핵심 지표 | pass 임계 | 근거 |
| --- | --- | --- | --- |
| S1 평가 배치 부하 | 배치 완료 시간 | ≤ 1h | REQ-047 (README line 91) |
| S1 평가 배치 부하 | 배치 실패·재시도율 | error rate < 1% (baseline 후 fix) | 내성 |
| S2 조회 지연 | p95 latency | < 3s | REQ-048 (README line 92) |
| S2 조회 지연 | p50 latency / throughput | baseline 후 fix (관찰용) | 관찰 |
| S2 조회 지연 | error rate | < 1% | 내성 |
| S3 동시성 내성 | error rate (동시성 단계별) | < 1% (baseline 후 fix) | graceful degradation |
| S3 동시성 내성 | p95 저하 곡선 | latency cliff 부재 | 내성 |

- **집계**: latency 는 percentile(p50/p95/p99), throughput 는 req/s 또는 배치/h, error
  rate 는 non-2xx / 전체.
- **환경 고정**: 측정 결과는 실행 환경(CPU/메모리/DB/네트워크)에 종속되므로, 각 run 은
  환경 메타(하드웨어·동시성·데이터 규모)를 함께 기록해 비교 가능하게 한다.

---

## 4. 접근 방식·도구 후보

부하 측정 접근을 **기존 dependency 로 가능한 범위**와 **신규 도구 필요 범위**로 구분한다.

### 4.1 기존 dependency 로 가능한 범위

- **supertest 기반 반복 호출 measure** — `supertest`(package.json 기존 devDependency)로
  조회 endpoint 를 반복 호출하고 wall-clock latency 를 수집하는 경량 측정. S2 의
  단일-클라이언트 latency 스모크 수준(부하 발생기 아님)에 적합.
- 한계: 진짜 동시성 부하(S3)·고 RPS 발생은 supertest 만으로 부족(단일 프로세스 순차
  호출 성격). concurrent 시나리오는 아래 신규 도구가 필요.

### 4.2 신규 도구 필요 범위 (도구 결정은 본 문서 범위 밖)

- **k6 / artillery / autocannon 등** 전용 부하 발생기 — S1 대규모 배치·S3 동시성 내성의
  고동시성·고 RPS 부하를 발생시키려면 전용 harness 가 필요.
- **BLOCKED 규율**: 위 도구는 모두 **신규 외부 dependency** 다.
  [CLAUDE.md §5](../../CLAUDE.md) 상 새 dependency 추가는 **BLOCKED**(사람 승인 → ADR
  작성 후 도입)이다. 따라서 **도구 선택·도입 결정 자체는 본 계획 문서 범위 밖**이며, §5
  의 follow-up 으로 넘긴다.
- **LLM/외부 수집 의존 격리**: S1 은 실 LLM·GitHub/Confluence I/O 대기가 지배적일 수
  있어, 순수 서버 처리량 측정 시 stub / record-replay / 격리 endpoint 를 선행 설계해야
  한다(도구 ADR 에서 함께 결정).

---

## 5. Follow-up 인덱스

본 문서는 계획만 담는다. 실제 실행은 아래를 후속 task 후보로 나열한다(순서는 의존성 기준).

1. **부하 도구 선택 ADR** (pr-mode + 신규 dependency, 사람 승인) — k6 / artillery /
   autocannon 중 택1, trade-off·격리 endpoint 전략 박제. [CLAUDE.md §5](../../CLAUDE.md)
   BLOCKED 해소 전제. → [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) (PROPOSED, k6 권고 — 도입은 owner 승인 후 별도 task).
2. **S2 조회 latency 경량 harness** (supertest 기반, 신규 dependency 불요 가능) — 위 1
   과 독립적으로 먼저 착수 가능한 최소 measure.
3. **S1 / S3 부하 harness 구현** — 1 의 도구 결정 후. 배치 부하·동시성 내성 스크립트.
4. **CI 통합** — 부하 harness 를 `.github/workflows/` 에 별도 job(정기/수동 trigger)으로
   편입. 상시 PR CI 와 분리(부하는 무거움).
5. **baseline 확정 + 임계 fix** — 최초 실측으로 §3 의 "baseline 후 fix" 임계를 실 수치로
   확정하고 본 문서를 갱신. **실 DB round-trip 실측이 slice 19 까지 도달**: slice 1(T-1500, main
   `0395c51e`) 의 [`person-read-realdb.perf-spec.ts`](../../test/perf/person-read-realdb.perf-spec.ts)
   가 mock override 0 부트스트랩 + 실 Prisma seed 로 `GET /api/persons` 의 p95 < 3000ms 를 실측했고,
   slice 2(T-1502, main `97198504`) 의
   [`group-read-realdb.perf-spec.ts`](../../test/perf/group-read-realdb.perf-spec.ts) 가 같은 구조로
   `GET /api/groups` 목록 · `:id` · `:id/persons` 를 측정해 **N+1 indirect navigation**
   (`findPersonsByGroupId` 의 membership 비례 query) 경로에서도 같은 임계 충족을 증거화했다. 이어
   slice 3(T-1504, main `a8bc1e28`) 의
   [`group-persons-scale-realdb.perf-spec.ts`](../../test/perf/group-persons-scale-realdb.perf-spec.ts)
   가 slice 2 와 **같은 route** (`GET /api/groups/:id/persons`) 를 membership **5 건 vs 60 건** 두
   표본으로 측정해 규모가 커져도 p95 < 3000ms 가 유지됨을 실측했다 — 즉 slice 3 이 늘린 것은
   route 폭이 아니라 **규모 축** 이었다. 그다음 slice 4(T-1506, main `861add36`) 의
   [`assessment-read-realdb.perf-spec.ts`](../../test/perf/assessment-read-realdb.perf-spec.ts)
   (9 test) 가 세 번째 endpoint 도메인인 `AssessmentController` 의 조회 2 route
   (`GET /api/assessments?personId=&period=` · `GET /api/assessments/:id`) 를 **실 JWT 로
   `JwtAuthGuard` + `RolesGuard` 를 통과하며** 측정해 인증 layer + DB round-trip 을 모두 포함한
   경로에서도 p95 < 3000ms 임을 실측했다(401 분기로 guard 생존 확인, `@@index([personId, period,
   periodStart])` 를 타는 필터 + 다중 row 경로라 앞 slice 의 flat 목록 · N+1 loop 와 구조가 다르다).
   그다음 slice 5(T-1508, main `b15ffb0e`) 의
   [`contribution-read-realdb.perf-spec.ts`](../../test/perf/contribution-read-realdb.perf-spec.ts)
   (10 test) 가 네 번째 endpoint 도메인인 `ContributionController` 의 조회 2 route
   (`GET /api/contributions?assessmentId=` · `GET /api/contributions/:id`) 를 slice 4 에 이어
   **실 JWT 로 guard 를 통과하며** 측정해 **부모→자식 FK fan-out** 경로에서도 p95 < 3000ms 임을
   실측했다(필터가 명시 `@@index` 가 아니라 `@@unique([assessmentId, sourceRef])` composite unique
   index 의 **prefix** 를 타고, seed 는 `Person → Assessment → Contribution` **3-level FK chain** 의
   상대 비교용 소규모 표본 `PRIMARY_CHILDREN = 5` · `OTHER_CHILDREN = 3` 이라 REQ-047 의 실 scale
   부하 검증이 아니다). 그다음 slice 6(T-1510, main `403a1240`) 의
   [`summary-read-realdb.perf-spec.ts`](../../test/perf/summary-read-realdb.perf-spec.ts)
   (10 test) 가 다섯 번째 endpoint 도메인인 `SummaryController` 의 조회 2 route
   (`GET /api/summaries?personId=&period=` · `GET /api/summaries/:id`) 를 slice 4·5 에 이어
   **실 JWT 로 guard 를 통과하며** 측정해 **시계열 정렬 조회** 경로에서도 p95 < 3000ms 임을
   실측했다(구조 축 2 개 추가 — ① `@@unique([personId, period, periodStart])` 와 `@@index` 가
   **동일 tuple 로 중복 정의된 유일 entity** 라 optimizer 가 어느 index 를 타든 임계가 성립하는지의
   첫 증거이고, ② `narrative` 가 서술형 long text 라 응답 본문이 앞 slice 보다 큰 **payload 크기 축**
   이다. seed 는 `WEEK_ROWS = 4` · `MONTH_ROWS = 2` 의 상대 비교용 소규모 표본이라 REQ-047 의 실
   scale 부하 검증이 아니고, 401 은 **cookie 부재 · 변조 토큰 2 조건** 으로 살아 있다).
   그다음 slice 7(T-1512, main `561f3fdf`) 의
   [`part-read-realdb.perf-spec.ts`](../../test/perf/part-read-realdb.perf-spec.ts)
   (10 test) 가 여섯 번째 endpoint 도메인인 `PartController` 의 조회 2 route
   (`GET /api/parts` · `GET /api/parts/:id/persons`) 를 측정해 **명시 index 가 없는 FK 역방향
   필터** 경로에서도 p95 < 3000ms 임을 실측했다(구조 축 3 개 추가 — ① 필터 컬럼 `Person.partId`
   는 `@unique` 도 `@@index` 도 선언되지 않은 **유일한 실측 필터 컬럼** 이라 index 미보장 경로의
   첫 증거이고, ② `findPersonsByPartId` 가 부모 존재 검증 후 자식 조회를 하는 **요청당 상수
   2 query** 라 slice 2 의 membership 비례 N+1 과도 앞 slice 들의 단일 SELECT 와도 다르며,
   ③ 자식 조회가 `activeOnly` 기본값으로 `active: true`(REQ-026) 를 타는 **soft-delete 필터**
   라 비활성 row 를 섞은 seed 에서 걸러짐과 latency 를 함께 관측한다. `PartController` 는
   guard 미부착이라 slice 4·5·6 과 달리 401 분기가 없는 **인증 노이즈 0 측정** 이고, seed 는
   `ACTIVE_PERSONS = 5` · `INACTIVE_PERSONS = 2` · `OTHER_PERSONS = 3` 의 상대 비교용 소규모
   표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 8(T-1514, main `7bcb2c81`) 의
   [`user-read-realdb.perf-spec.ts`](../../test/perf/user-read-realdb.perf-spec.ts)
   (10 test) 가 일곱 번째 endpoint 도메인인 `UserController` 의 조회 2 route
   (`GET /api/users` · `GET /api/users/:id`) 를 **실 JWT 로** 측정해 **self-OR-Admin OR 분기와
   403 인가 거절을 포함한** 경로에서도 p95 < 3000ms 임을 실측했다(구조 축 3 개 추가 —
   ① 상세 route 가 `isSelf || isAdminPlus` OR 분기를 controller 에서 판정해 권한 부족 **403** 과
   존재 부재 **404** 가 의미상 분리되고, 403 은 `service.findById` 호출이 0 이라 **DB 를 타지 않는
   거절 경로의 latency** 를 처음 관측하는 **403 인가 분기의 첫 실측** 이고, ② 목록은
   `JwtAuthGuard + RolesGuard`(`@Roles("Admin")`) · 상세는 `JwtAuthGuard` 만 + controller 분기라
   같은 controller 안에서 **guard stack 깊이가 다른 두 route** 를 나란히 재는 **route 별 상이
   guard tier** 이며(slice 7 의 guard 미부착 측정 뒤 **guard 통과 축이 복귀** 하고 거절 상태가
   401 뿐 아니라 403 까지 넓어졌다), ③ 결과 집합이 곧 actor 가 속한 **인증 principal 테이블**
   `User` 이고 필터 축도 **단일 컬럼 `@unique`(`User.email`)** + 목록의 **무필터 전량 SELECT**
   다 — slice 4 = composite `@@index`, 5 = composite unique prefix, 6 = unique·index 중복 tuple,
   7 = 무-index. seed 는 `TARGET_USERS = 3` · `ITERATIONS = 8` · `SHORT_ITERATIONS = 4` 의 상대
   비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 9(T-1516, main `87a1bcb8`) 의
   [`permission-denied-read-realdb.perf-spec.ts`](../../test/perf/permission-denied-read-realdb.perf-spec.ts)
   (12 test) 가 여덟 번째 endpoint 도메인이자 첫 `src/user/` 외부 module 인
   `PermissionDeniedRecordController` 의 조회 1 route (`GET /api/permission-denied-records`) 를
   **실 JWT 로** 측정해 **거부가 아니라 결과 집합이 축소되는 audience 차등** 경로에서도
   p95 < 3000ms 임을 실측했다(구조 축 3 개 추가 — ① 응답은 모두 **200** 인데 actor 에 따라 발화
   query 수가 **1(Admin bypass) / 2(allowlist 조회 + `findMany`) / 1(공집합 early return)** 로
   갈리는 첫 경로라 slice 8 의 **403 거부** 와도 slice 7 의 요청당 상수 2 query 와도 다르고,
   ② 대상 테이블이 `@@index([instanceRef, createdAt])` 와
   `@@index([provider, httpStatus, createdAt])` **둘** 을 갖고 `@unique` 는 **0** 인 유일 실측
   대상이라 optimizer 가 필터 조합에 따라 후보를 고르고 `orderBy: { createdAt: "desc" }` 가 두
   index 의 후행 컬럼과 **정렬 축을 공유** 하며(두 표본의 대소 관계는 slice 3 선례대로 단언하지
   않는다 — slice 4 = composite `@@index`, 5 = composite unique prefix, 6 = unique·index 중복
   tuple, 7 = 무-index, 8 = 단일 컬럼 `@unique`), ③ 필터가 query **3 축**
   (`instanceRef` · `provider` · `httpStatus`) 조합이고 non-Admin 경로는 접근 허용 instance 를
   `instanceRef in [...]` 로 주입하는 **다축 query param + allowlist `IN` 절** 이다. 측정 대상은
   **append-only audit 테이블** 이고, seed 는 `ITERATIONS = 8` · `SHORT_ITERATIONS = 4` ·
   `SEED_ROWS`(5 row) 의 상대 비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 10(T-1518, main `c1630d40`) 의
   [`export-read-realdb.perf-spec.ts`](../../test/perf/export-read-realdb.perf-spec.ts)
   (10 test) 가 아홉 번째 endpoint 도메인인 `ExportController` 의 조회 2 route
   (`GET /api/admin/export/running` · `GET /api/admin/export/:id`) 를 **실 JWT 로** 측정해
   **운영 job polling** 경로에서도 p95 < 3000ms 임을 실측했다(구조 축 3 개 추가 —
   ① `findRunning` 이 `where: { status: "RUNNING" }` 로 `@@index([status, createdAt])` 의
   **leading-edge 1 컬럼만** 타고 그 필터 타입이 String/Int 가 아니라
   **Prisma enum(`JobStatus`)** 인 **enum 필터 + index 선두 컬럼** 의 첫 실측이고
   (slice 4 = composite `@@index`, 5 = composite unique prefix, 6 = unique·index 중복 tuple,
   7 = 무-index, 8 = 단일 컬럼 `@unique`, 9 = index 후보 2 개), ② `dateRange` ·
   `entitySelector` 가 nullable `Json?` 이라 **구조화 payload 의 JSONB 역직렬화 +
   NULL/비-NULL 혼재 표본** 을 처음 재며(slice 6 의 `narrative` long text 는 평문 축이라
   다르고, 두 표본의 대소 관계는 slice 3 선례대로 단언하지 않는다), ③ 두 route 모두
   `@Roles("Admin")` 이라 User tier actor 는 **RolesGuard 단계에서 DB 미도달 403** 인
   **guard 레벨 403** 이다 — slice 8 의 403 은 controller 가 self-OR-Admin 을 판정한
   **controller 레벨** 거절이었으므로 같은 403 이어도 **발생 layer 가 다르다**. 부수 축으로
   도메인 데이터가 아닌 **운영 job 생명주기 테이블** 을 처음 재고, 단건 조회가
   **`findUniqueOrThrow` 의 P2025 → 404 변환** 경로이며 FK 가 **`onDelete: Restrict`** 다.
   seed 는 `ITERATIONS = 8` · `SHORT_ITERATIONS = 4` · 4 status 혼재 job 소수 row 의 상대
   비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 11(T-1520, main `a3703964`) 의
   [`llm-provider-config-read-realdb.perf-spec.ts`](../../test/perf/llm-provider-config-read-realdb.perf-spec.ts)
   (9 test) 가 열 번째 endpoint 도메인인 `LlmProviderConfigController` 의 조회 2 route
   (`GET /api/llm/providers` · `GET /api/llm/providers/:id`) 를 **실 JWT 로** 측정해
   **운영 secret config 조회** 경로에서도 p95 < 3000ms 임을 실측했다(구조 축 3 개 추가 —
   ① `LlmProviderConfig` 는 `@id` 외에 `@unique` · `@@unique` · `@@index` 가 **하나도 없는
   첫 실측 대상** 이라 목록은 무필터 전량 `findMany()` · 단건은 **PK 직행 `findUnique`** 인
   **secondary index 0 테이블** 이고(slice 7 은 필터 컬럼만 무-index 이고 테이블에는 다른
   index 가 있었으며, 8 = 단일 컬럼 `@unique`, 9 = index 후보 2 개, 10 = `@@index` 선두 컬럼),
   ② service 가 row 마다 명시 field pick 으로 `apiKey`(AES-256-GCM envelope ciphertext) 를
   버린 **새 view 객체** 를 만들어 **DB payload > 응답 payload** 이므로 **row 수 비례 변환
   CPU** 가 latency 에 처음 섞이며(앞 10 slice 는 repository row 를 그대로 직렬화 forward),
   ③ 단건 404 가 repository 의 null 을 service 가 분기해 `NotFoundException` 을 던지는
   **null 분기 기반** 이라 slice 10 의 `findUniqueOrThrow` **P2025 예외 기반** 404 와 같은
   상태코드여도 **발생 메커니즘이 다르다**. 부수 축으로 대상 테이블이 `truncateAll` 명단에
   없어 **spec-local `deleteMany` 정리가 필요한 첫 대상** 이고, 역방향
   relation(`DifficultyMapping[]`, `onDelete: Restrict`) 이 있는데도 `include` 0 인
   **미조인 SELECT** 이며, 도메인 데이터가 아닌 **운영 secret 보관 config 테이블** 이다.
   403 layer 는 두 route 모두 `@Roles("Admin")` 이라 slice 10 과 동일해 새 축이 아니다.
   seed 는 config **0 건(빈 배열) · 3 건 전량** 표본과 `ITERATIONS = 8` ·
   `SHORT_ITERATIONS = 4` 반복의 상대 비교용 소규모 표본이라 REQ-047 의 실 scale 부하
   검증이 아니다).
   그다음 slice 12(T-1522, main `cc8b9f36`) 의
   [`import-read-realdb.perf-spec.ts`](../../test/perf/import-read-realdb.perf-spec.ts)
   (8 test) 가 열한 번째 endpoint 도메인인 `ImportController` 의 조회 2 route
   (`GET /api/admin/import/modes` · `GET /api/admin/import/running`) 를 **실 JWT 로** 측정해
   **DB 미도달 route 와 DB round-trip route 모두** p95 < 3000ms 임을 실측했다(구조 축 3 개
   추가 — ① **0-query 동기 handler 의 배선-only latency floor 첫 분리 관측**: `modes` 는
   handler 가 `async` 도 아닌 **동기 반환** 이고 service 미경유 · Prisma delegate 호출 **0**
   이라 **guard stack + 라우팅 + 직렬화만의 latency floor** 를 처음 분리해 잰다(앞 11 slice
   의 측정 route 는 예외 없이 최소 1 query 를 발화했다), ② **같은 controller · 같은 fixture
   안에서 0-query route 와 DB round-trip route 를 나란히 측정**: `running` 은 실 `ImportJob`
   을 `status: "RUNNING"` 으로 거르는 실 query 경로라 동일 프로세스 · 동일 표본 조건에서
   **DB 성분과 배선 성분의 상대 관측 기록** 이 처음 남는다(두 표본의 대소 관계는 slice 3
   선례대로 단언하지 않고 관찰만 한다), ③ **한 요청에 Prisma enum 2 종(필터 축 `JobStatus`
   + payload 축 `ImportMode`) + `Int?` / `String?` nullable scalar 혼재**: `ImportJob` 은
   slice 10 `ExportJob` 의 정합 쌍이라 `@@index([status, createdAt])` leading-edge ·
   `JobStatus` enum 필터 · `Restrict` FK 는 같지만 payload 축이 `mode`(`ImportMode`) 라는
   **두 번째 enum 컬럼** + `restoredRowCount`(`Int?`) + `error` / `artifactRef`(`String?`)
   의 nullable scalar 혼재라 slice 10 의 `Json?` 2 컬럼 JSONB 축과 상이하다. 부수 축으로
   `modes` 응답은 **DB 상태와 무관한 고정 2 원소**(REPLACE=destructive / MERGE) 라 seed
   유무에 latency 가 반응하지 않고, 403 layer 는 두 route 모두 `@Roles("Admin")` 이라
   slice 10·11 과 동일해 새 축이 아니다. seed 는 `ITERATIONS = 8` ·
   `SHORT_ITERATIONS = 4` · status 혼재 import job 소수 row 의 상대 비교용 소규모 표본이라
   REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 13(T-1524, main `51c02093`) 의
   [`difficulty-mapping-read-realdb.perf-spec.ts`](../../test/perf/difficulty-mapping-read-realdb.perf-spec.ts)
   (8 test) 가 열두 번째 endpoint 도메인인 `DifficultyMappingController` 의 조회 1 route
   (`GET /api/llm/difficulty-mappings`) 를 **실 JWT 로** 측정해 p95 < 3000ms 임을 실측했다
   (구조 축 3 개 추가 — ① **nullable 관계형 FK 의 NULL / 비-NULL 혼재 + `include` 0 미조인
   조회**: `llmProviderConfigId` 가 `String?` 이라 슬롯마다 지정 / 미지정이 갈리는데 앞 12
   slice 의 payload 축에는 **관계형 FK 자체가 nullable 인 경로가 없었다**(slice 10 의 `Json?`
   2 컬럼은 구조화 scalar, slice 12 의 `Int?` / `String?` 은 비-관계 scalar). 부모 row 가
   실재해도 `findMany()` 가 `include` 를 주지 않아 **join 0 · FK 는 문자열 컬럼으로만
   직렬화** 된다, ② **부모–자식 두 테이블이 각각 별도 slice 로 실측되는 첫 페어이자
   `onDelete: Restrict` 로 정리 순서가 강제되는 첫 실 DB slice**: 부모 `LlmProviderConfig`
   는 slice 11(T-1520, main `a3703964`) 에서 이미 쟀고 본 slice 는 그 **자식** 을 잰다. 두
   테이블 모두 `truncateAll` 명단 밖이라 spec-local `deleteMany` 가 필요하고 **자식 먼저**
   순서를 지켜야 한다, ③ **schema 로 카디널리티가 상한된 고정 슬롯 테이블**:
   `@@unique([difficulty])` + easy/medium/hard 3 슬롯 고정
   ([ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md) §1) 이라 결과 집합이
   구조적으로 3 을 넘을 수 없어 **규모 민감도가 schema 로 bounded 인 첫 실측 경로** 다 — 앞
   slice 의 대상은 모두 원리상 무한 증가 가능한 테이블이었다. `@Roles("Admin")` guard 레벨
   403 은 slice 10·11·12 와 동일하고 무필터 전량 `findMany()` 도 slice 11 과 같아 둘 다 새
   축이 아니다. seed 는 슬롯 **0 건(빈 배열) · 3 슬롯 전량** 표본과 반복 소수 회의 상대
   비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 14(T-1526, main `d5a5a1b8`) 의
   [`auth-me-read-realdb.perf-spec.ts`](../../test/perf/auth-me-read-realdb.perf-spec.ts)
   (9 test) 가 열세 번째 endpoint 도메인인 `AuthController` 의 조회 1 route
   (`GET /api/auth/me`) 를 **실 JWT cookie 로** 측정해 p95 < 3000ms 임을 실측했다
   (구조 축 3 개 추가 — ① **조회 키가 요청 표면이 아니라 인증 토큰 payload(`req.user.sub`)
   에서 나오는 첫 경로**: path param 0 · query 0 이라 요청 표면이 **cookie 뿐** 이고 결과
   집합이 **actor 자신 1 row** 로 고정된다(앞 13 slice 의 필터 입력은 예외 없이 URL path
   param 또는 query 였고 slice 8 의 `User` 상세도 path param `:id` 기반이었다),
   ② **`JwtAuthGuard` 단독 — `RolesGuard` 미부착으로 403 분기가 구조적으로 부재**:
   slice 10~13 은 `@Roles("Admin")` guard 레벨 403, slice 8 은 같은 controller 안 route 별
   guard tier 차이, slice 7 은 guard 0 이었고 **인증만 있고 인가 0** 인 guard stack 은 본
   slice 가 처음이라 401 만 존재한다, ③ **stale token 404 — 인증 통과 + DB 도달 +
   principal row 부재 조합의 첫 실측**: 서명이 유효한 토큰인데 해당 `User` row 가 삭제되면
   `findById(sub)` 가 `NotFoundException` → 404 로 갈린다(slice 10 의 404 는 **임의 path
   param id** 의 부재였고 본 경로는 **actor 자신의 row 부재** 라 401 이 아니라 404 로
   갈리는 지점이 다르다). 부수 축으로 응답이 `UserResponseDto.fromEntity` 를 거쳐
   `hashedPassword` 를 차단하는 **단건 sanitize** 이고(slice 11 의 per-row sanitize 는
   목록 · row 수 비례 변환이라 성격이 다르다), PK 직행 `findUnique` 자체는 slice 11 과
   같아 **새 축이 아니다**. seed 는 actor **2 명(User tier · Admin tier)** 과 반복 소수 회의
   상대 비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 15(T-1528, main `8d63f40c`) 의
   [`export-status-view-read-realdb.perf-spec.ts`](../../test/perf/export-status-view-read-realdb.perf-spec.ts)
   (12 test) 가 이미 실측된 `ExportController` 의 **파생 view 1 route**
   (`GET /api/admin/export/:id/status-view`) 를 **실 JWT cookie 로** 측정해 p95 < 3000ms 임을
   실측했다(**endpoint 도메인을 늘리지 않고 조회 route 만 23 → 24 로 늘리는 첫 slice** —
   구조 축 3 개 추가: ① **파생 view 반환** 으로 DB row 와 응답 shape 가 완전히 다른 첫 실 DB
   경로(`phaseLabel` · `stepIndex` · `totalSteps` · `nextStatus` · `terminal` · `downloadable` ·
   한국어 `message` 를 신설해 반환하므로 `ExportJob` 의 어떤 컬럼도 그대로 나오지 않는다),
   ② **DB enum 1 컬럼이 응답 전체를 결정**(`JobStatus` 4 값이 `JOB_STATUS_TO_VIEW` 를 거쳐
   4 종의 서로 다른 view 로 갈린다 — slice 10 이 같은 enum 을 **필터 축** 으로 썼던 것과 달리
   본 slice 는 **payload 결정 축** 으로 쓴다), ③ **같은 row 를 읽는 두 route 가 각각 별도
   slice 로 실측되는 첫 페어**(slice 10 의 `GET :id` raw record 와 본 slice 의
   `:id/status-view` 파생 view — slice 13 의 부모–자식 페어는 두 테이블이었지만 본 건은
   **동일 테이블 · 동일 row** 이고 두 p95 의 대소 관계는 slice 3 선례대로 단언하지 않는다).
   `@Roles("Admin")` guard 레벨 403 과 `findUniqueOrThrow` 의 P2025 → 404 는 slice 10 과
   동일해 새 축이 아니다. seed 는 `JobStatus` 4 값 혼재 job 소수 row 와 반복 소수 회의 상대
   비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 16(T-1530, main `a276beb4`) 의
   [`cron-schedule-read-realdb.perf-spec.ts`](../../test/perf/cron-schedule-read-realdb.perf-spec.ts)
   (13 test) 가 **열네 번째 endpoint 도메인이자 첫 `src/scheduling/` 모듈 실측** 인
   `CronScheduleController` 의 조회 1 route (`GET /api/schedules`) 를 **실 JWT cookie 로**
   측정해 p95 < 3000ms 임을 실측했다(slice 15 와 반대로 **도메인과 route 를 각각 1 개씩** 더해
   endpoint 13 → 14 · 조회 route 24 → 25 로 늘린다 — 구조 축 3 개 추가: ① **결과 집합이 DB
   row 가 아니라 in-process `SchedulerRegistry` 상태인 첫 경로**(`getCronJobs()` Map 의 key
   배열이라 어떤 테이블도 읽지 않는다 — slice 12 의 0-query `modes` 는 **DB·상태와 무관한
   고정 2 원소 상수** 였으나 본 응답은 **선행 write 로 변하는 가변 상태** 다), ② **같은 spec
   안의 HTTP write(`PUT` / `DELETE`)가 read 표본을 만드는 첫 페어**(앞 15 slice 는 Prisma 로
   seed 를 직접 심고 read 만 쟀다 — write route 자체의 p95 는 단언하지 않고 상태 준비 수단으로만
   쓴다), ③ **규모 축이 DB row 수가 아니라 registry 등록 수인 첫 slice**(등록 0 건 vs 4 건 두
   표본이며 대소 관계는 slice 3 선례대로 미단언). `@Roles("Admin")` guard 레벨 403 과 cookie
   미부착·서명 변조 401 은 slice 10~13 과 동일해 **새 축이 아니다**. 표본은 등록 0 건 · 4 건과
   반복 소수 회의 상대 비교용 소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 17(T-1532, main `2b632266`) 의
   [`export-download-read-realdb.perf-spec.ts`](../../test/perf/export-download-read-realdb.perf-spec.ts)
   (13 test) 가 **이미 실측 도메인인 `ExportController` 의 다운로드 1 route**
   (`GET /api/admin/export/:id/download`) 를 **실 JWT cookie 로** 측정해 p95 < 3000ms 임을
   실측했다(slice 16 과 반대로 **slice 15 와 같은 셈법** 이라 endpoint 도메인은 **14 불변** 이고
   조회 route 만 **25 → 26** 으로 늘며, `ExportController` 는 slice 10 · slice 15 에 이어 **세
   번째로 재는 controller** 다 — 구조 축 3 개 추가: ① **한 요청이 서로 무관한 5 테이블을
   `Promise.all` 로 병렬로 읽는 첫 fan-out**(`materializeFullExportDownload` →
   `collectFullExportRecords` 가 `EXPORT_ENTITY_SOURCES` 5 entity(Assessment · Person · Group ·
   LlmConfig · AuditLog)에 각각 `findMany` 를 던진다 — 앞 16 slice 의 최대 fan-out 은 slice 2·3
   의 membership indirect navigation 이라 **같은 chain 안 loop** 였다), ② **응답이 JSON body 가
   아니라 `StreamableFile` stream artifact 인 첫 slice**(`serializeExportDownloadHeaders` 가
   `Content-Type` / `Content-Disposition` / `Content-Length` 를 세팅하므로 latency 에 직렬화 +
   Buffer 수집 + header 산출 비용이 포함되고, `Content-Length` 가 **실 body byte 길이와 일치**
   함을 단언하는 첫 경로이자 **응답 크기가 byte 로 관측 가능한 첫 경로** 다), ③ **DB 읽기량과
   응답 크기가 분리되는 첫 경로**(scope 선별 `selectExportRecords` 가 DB 가 아니라 **in-process**
   라 RANGE / PARTIAL job 은 응답이 작아져도 **읽는 row 수는 FULL 과 동일** — 규모 축이 응답
   크기가 아니라 **총 DB row 수** 이며 소규모 seed(entity 당 1~2 row)와 상대적 대규모
   seed(Person 20 + Assessment 20 누적) 두 표본의 대소 관계와 byte 증가량은 slice 3 선례대로
   미단언). `@Roles("Admin")` guard 레벨 403 · cookie 미부착·서명 변조 401 · 부재 id 404 는
   slice 10~16 과 동일해 **새 축이 아니다**. 표본은 위 두 seed 와 반복 소수 회의 상대 비교용
   소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 18(T-1534, main `b1da3564`) 의
   [`group-members-read-realdb.perf-spec.ts`](../../test/perf/group-members-read-realdb.perf-spec.ts)
   (12 test) 가 **이미 실측 도메인인 `GroupController` 의 membership 조회 1 route**
   (`GET /api/groups/:id/members`) 를 실 부트스트랩으로 측정해 p95 < 3000ms 임을 실측했다
   (**slice 15·17 과 같은 셈법** 이라 endpoint 도메인은 **14 불변** 이고 조회 route 만
   **26 → 27** 로 늘며 `GroupController` 는 slice 2 · slice 3 에 이어 **세 번째로 재는
   controller** 다 — 구조 축 3 개 추가: ① **N:M 중간 테이블 row 자체가 응답 payload 인 첫 실 DB
   경로**(`GroupService.findMembershipsByGroupId` 가 `PersonGroupMembership` row 를 가공 0 으로
   반환해 `id` / `personId` / `groupId` / `createdAt` 4 컬럼의 가장 좁은 shape 이다 — 앞 17
   slice 의 응답은 도메인 entity row · sanitize view · 파생 view · in-process registry 상태 ·
   stream artifact 였을 뿐 관계 자체를 1 급 payload 로 내린 경로가 없었다), ② **같은 부모 row 를
   조인 경로와 비조인 경로로 나란히 재는 첫 페어**(`:id/persons` 는 membership 추출 후
   `PersonRepository.findById` loop 라 query 가 membership 수에 비례하고 `:id/members` 는 상수
   2 query 인데 같은 group id · 같은 seed 에서 두 route 를 한 spec 으로 잰다 — 대소 관계와
   규모별 증가율은 slice 3 선례대로 미단언이고 "상수 2 query" 자체는 slice 7 과 같아 새 축이
   아니다), ③ **복합 unique tuple 의 후행(non-prefix) 컬럼 단독 필터**(필터 컬럼 `groupId` 가
   `@@unique([personId, groupId])` 의 두 번째 컬럼이라 prefix 를 못 탄다 — slice 5 는 prefix 를
   탔고 slice 7 은 unique 선언 자체가 0 이었으므로 **선언된 unique index 가 있는데도 그 prefix 를
   못 타는 첫 경로** 다). 401 / 403 은 `GroupController` guard 미부착이라 구조적으로 부재하며
   slice 2·3 과 동일해 **새 축이 아니다**. 본 slice 는 mock 짝
   perf-spec(`group-members-read.perf-spec.ts`)이 존재하지 않는 첫 실 DB read slice 라 mock spec
   총수 변화가 **0** 이다. 표본은 membership 5 건 / 50 건 두 seed 와 반복 소수 회의 상대 비교용
   소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   그다음 slice 19(T-1537, main `9466d76d`) 의
   [`person-detail-read-realdb.perf-spec.ts`](../../test/perf/person-detail-read-realdb.perf-spec.ts)
   (11 test) 가 **이미 실측 도메인인 `PersonController` 의 단건 상세 조회 1 route**
   (`GET /api/persons/:id`) 를 실 부트스트랩으로 측정해 p95 < 3000ms 임을 실측했다
   (**slice 15·17·18 과 같은 셈법** 이라 endpoint 도메인은 **14 불변** 이고 조회 route 만
   **27 → 28** 로 늘며 `PersonController` 는 slice 1(T-1500) 에 이어 **두 번째로 재는
   controller** 다 — 구조 축 3 개 추가: ① **soft-delete 가시성 비대칭의 첫 실측**(같은 테이블을
   읽는데 목록 `findActive` 는 `active: true` 를 강제(REQ-026)해 비활성 row 를 감추는 반면 단건
   `findById` 는 그 필터가 없어 **200 + `active: false`** 로 노출된다 — 한 테이블의 목록 route 와
   단건 route 가 서로 다른 가시성 규칙을 갖는 첫 경로이며 본 문서는 그 현재 동작을 **판단 없이
   인용만** 한다), ② **목록 ↔ 단건 페어 측정**(같은 seed 상태에서 `GET /api/persons` 와
   `GET /api/persons/:id` 를 한 spec 으로 나란히 재는 첫 페어 — 두 p95 의 대소 관계는 slice 3
   선례대로 미단언), ③ **규모 축의 의미가 route 마다 갈린다는 관찰**(목록은 결과 집합이 규모에
   비례하지만 단건은 응답이 **1 row 고정** 이라 person 5 건 / 100 건 두 표본 모두 3000ms 미만만
   단언하고 증가율은 미단언). PK 직행 `findUnique` 는 slice 11·14 와, repository null → 404
   분기는 slice 11 과, guard 미부착(401 / 403 구조적 부재)은 slice 1·2·7 과 동일해 셋 다 **새 축이
   아니다**. 본 slice 는 mock 짝 perf-spec(`person-detail-read.perf-spec.ts`, T-0847)이 **실존**
   해 그 route 가 아래 인벤토리에서 **(B) 미측정 → (A) 실측완료 로 옮겨가는 첫 재분류 사례** 이고
   mock spec 총수 변화는 **0** 이다(slice 18 의 "mock 짝 부재" 와는 반대 상황이라 그 서술을 본
   slice 에 옮겨 적지 않는다). 표본은 person 5 건 / 100 건 두 seed 와 반복 소수 회의 상대 비교용
   소규모 표본이라 REQ-047 의 실 scale 부하 검증이 아니다).
   slice 4·5·6·7·8·9·10·11·12·13·14 가 route 폭을 늘렸고 slice 16 이 도메인과 route 를 함께
   늘렸으므로 실측 범위는
   **14 endpoint (조회 28 route)** 다(slice 9·13·14 는 route 를 1 개만, slice 10·11·12 는 각각
   2 개를 더하고, slice 15 는 도메인을 늘리지 않고 route 만 1 개, slice 16 은 도메인과 route 를
   각각 1 개씩 더하며, slice 17 은 다시 slice 15 와 같은 셈법으로 **도메인을 늘리지 않고 route
   만 1 개** 를 더하고, slice 18 도 **slice 15·17 과 같은 셈법으로 도메인을 늘리지 않고 route
   만 1 개** 를 더하며, slice 19 도 **slice 15·17·18 과 같은 셈법으로 도메인을 늘리지 않고
   route 만 1 개**(이미 실측 도메인 `PersonController` 를 두 번째로 재는 slice) 를 더한다. 정본
   서술 = [`test/perf/README.md`](../../test/perf/README.md) 의
   `## 실 DB round-trip baseline (slice 목록)`).
   단 **본 item 은 미완** — `buildBaselineReport` + `formatBaselineLine` 은 **관찰 전용**
   이고 `writeBaselineFile` / `confirmOrCompareBaseline` 는 미사용이라 baseline 파일 확정이
   성립하지 않으며, §3 의 "baseline 후 fix" 임계 fix 도 미착수다. **잔여**: baseline 파일
   확정 · 임계 fix · 측정 endpoint 확대(나머지 read perf-spec 30 개는 service mock 잔존 —
   계산식은 read 48 개 − 실 DB read 18 개이며, slice 19 도 파일명에 `read` 가 있어 피감수(47→48)와
   감수(17→18)가 함께 1 씩 늘어 차이 30 은 불변이다 — `group-persons-scale-realdb` 는 파일명에
   `read` 가 없어 양쪽 모두에서 빠진다) · **다른 endpoint(slice 5 의 contribution
   fan-out · slice 6 의 summary 시계열 조회 · slice 7 의 part 소속 조회 · slice 8 의 user 목록
   무필터 전량 SELECT · slice 9 의 permission-denied audit 목록 · slice 10 의 export job
   polling · slice 11 의 LLM provider config 조회 · slice 12 의 import job polling 과 modes
   조회 · slice 13 의 difficulty mapping 고정 슬롯 조회 · slice 14 의 auth me self 조회 ·
   slice 15 의 export status-view 파생 조회 · slice 16 의 cron schedule 레지스트리 조회 ·
   slice 17 의 export dump download 조회 · slice 18 의 group membership 조회 ·
   slice 19 의 person 단건 상세 조회
   포함 — 다만 slice 13 의 대상은
   `@@unique([difficulty])` 3 슬롯 상한이라 규모가 schema 로 bounded 여서 **규모 축의 의미가
   다르고**, slice 14 의 대상은 결과 집합이 **actor 자신 1 row 로 고정** 이라 **규모 축 자체가
   성립하지 않으며**, slice 15 의 대상도 결과 집합이 **단건 1 row 고정** 이라 규모 축이 row
   수가 아니라 **`JobStatus` 값의 종류(4 값)** 로만 갈리고, slice 16 의 대상은 규모 축이
   **DB row 수가 아니라 registry 등록 수** 라 slice 16 이 **등록 0 건 / 4 건 두 표본으로 이미
   관측**(대소 관계는 미단언)했으므로 DB 규모 민감도 축 자체가 성립하지 않고, slice 17 의
   대상은 규모 축이 **응답 크기가 아니라 총 DB row 수** 라 slice 17 이 **소규모 seed / 상대적
   대규모 seed 두 표본으로 이미 관측**(대소 관계와 byte 증가량은 미단언)했으나 그 두 표본도
   **REQ-047 실 scale 부하와는 무관한 소규모 표본** 이라 규모 축이 해소된 것은 아니고, slice 18 의
   대상도 membership **5 건 / 50 건 두 표본을 관측 기록으로만** 남겼을 뿐(대소 관계·증가율
   미단언) 그 두 표본 역시 **REQ-047 실 scale 부하와는 무관한 소규모 표본** 이라 규모 축이
   해소되지 않았으며, slice 19 의 대상은 응답이 **1 row 고정** 이라 규모 축의 의미 자체가 목록
   route 와 달라 person **5 건 / 100 건 두 표본을 관측 기록으로만** 남겼을 뿐(대소 관계·증가율
   미단언) 그 두 표본 또한 **REQ-047 실 scale 부하와는 무관한 소규모 표본** 이다 — 미측정
   목록에 통째로 넣어 오독하지도, 해소된 것처럼 읽지도 않는다) 의
   규모 민감도**(규모 축 실측은 `:id/persons` 한 route 에 한해 도달).

   **잔여 read route 인벤토리 (slice 19 시점 확인분, T-1536 작성 → T-1538 갱신)** — 바로 위 `**잔여**` 의 "mock 잔존
   read perf-spec 30 개" 를 **route 단위** 로 펼친 backlog 다. slice 목록의 **정본은
   [`test/perf/README.md`](../../test/perf/README.md) 의 `## 실 DB round-trip baseline (slice 목록)`**
   이고 본 절은 **plan 측 backlog (정본의 파생)** 이라 둘이 어긋나면 **정본이 이긴다** (본 인벤토리
   작성은 정본 파일을 수정하지 않았다 — 인용만 했다). 아래 개수는 모두 편집 전 실측값이다 —
   `test/perf/*.perf-spec.ts` **53** · `*read*` **48** · `*realdb*` **19** · `*read*realdb*` **18**.
   범위는 **read (조회) route 한정** 이며 write / trigger route 의 부하 측정은 §5 의 다른 item
   소관이라 여기서 목록화하지 않는다.

   **(A) route 는 실 DB 실측 완료 · mock spec 만 잔존 — 27 개 (잔여 slice 후보 아님)**
   (spec 이름은 `.perf-spec.ts` 접미 생략)

   | mock spec | route | 실측 slice (realdb spec) |
   | --- | --- | --- |
   | `person-read` | `GET /api/persons` | slice 1 (`person-read-realdb`) |
   | `group-read` | `GET /api/groups` | slice 2 (`group-read-realdb`) |
   | `group-detail-read` | `GET /api/groups/:id` | slice 2 (`group-read-realdb`) |
   | `group-persons-read` | `GET /api/groups/:id/persons` | slice 2·3 (`group-read-realdb` · `group-persons-scale-realdb`) |
   | `assessment-read` | `GET /api/assessments?personId=&period=` | slice 4 (`assessment-read-realdb`) |
   | `assessment-detail-read` | `GET /api/assessments/:id` | slice 4 (`assessment-read-realdb`) |
   | `contribution-read` | `GET /api/contributions?assessmentId=` | slice 5 (`contribution-read-realdb`) |
   | `contribution-detail-read` | `GET /api/contributions/:id` | slice 5 (`contribution-read-realdb`) |
   | `summary-read` | `GET /api/summaries?personId=` | slice 6 (`summary-read-realdb`) |
   | `summary-detail-read` | `GET /api/summaries/:id` | slice 6 (`summary-read-realdb`) |
   | `part-read` | `GET /api/parts` | slice 7 (`part-read-realdb`) |
   | `part-persons-read` | `GET /api/parts/:id/persons` | slice 7 (`part-read-realdb`) |
   | `user-read` | `GET /api/users` | slice 8 (`user-read-realdb`) |
   | `user-detail-read` | `GET /api/users/:id` | slice 8 (`user-read-realdb`) |
   | `permission-denied-read` | `GET /api/permission-denied-records` | slice 9 (`permission-denied-read-realdb`) |
   | `export-running-read` | `GET /api/admin/export/running` | slice 10 (`export-read-realdb`) |
   | `export-detail-read` | `GET /api/admin/export/:id` | slice 10 (`export-read-realdb`) |
   | `llm-provider-config-read` | `GET /api/llm/providers` | slice 11 (`llm-provider-config-read-realdb`) |
   | `llm-provider-config-detail-read` | `GET /api/llm/providers/:id` | slice 11 (`llm-provider-config-read-realdb`) |
   | `import-modes-read` | `GET /api/admin/import/modes` | slice 12 (`import-read-realdb`) |
   | `import-running-read` | `GET /api/admin/import/running` | slice 12 (`import-read-realdb`) |
   | `difficulty-mapping-read` | `GET /api/llm/difficulty-mappings` | slice 13 (`difficulty-mapping-read-realdb`) |
   | `auth-me-read` | `GET /api/auth/me` | slice 14 (`auth-me-read-realdb`) |
   | `export-status-view-read` | `GET /api/admin/export/:id/status-view` | slice 15 (`export-status-view-read-realdb`) |
   | `cron-schedule-read` | `GET /api/schedules` | slice 16 (`cron-schedule-read-realdb`) |
   | `export-download-read` | `GET /api/admin/export/:id/download` | slice 17 (`export-download-read-realdb`) |
   | `person-detail-read` | `GET /api/persons/:id` | slice 19 (`person-detail-read-realdb`) |

   (A) 부류 mock spec 을 **retire · 삭제 · 통합할지는 별도 판단** 이며 본 절은 그 판단을 하지 않는다
   (`test/` 변경이라 `pr` 이고, "배선 latency 만 재는" mock 고유 책임이 남아 있는지부터 따져야 한다).

   **(B) route 미측정 · mock spec 존재 — 3 개 (진짜 잔여 slice 후보)**

   - `import-detail-read` → `GET /api/admin/import/:id` — slice 12 는 `modes` · `running` 두 route 만 쟀다.
   - `part-detail-read` → `GET /api/parts/:id` — slice 7 은 목록과 `:id/persons` 만 쟀다.
   - `app-root-read` → `GET /api` (`AppController` root) — 실측 endpoint 도메인 14 개에 `AppController` 가 없다.

   **보수 분류 표기** — 이제 `import-detail-read` **1 건** 만 남는다: realdb spec 이 그 path 를 두드리기는
   하지만(slice 12 의 `no-such-job-id` 404) **errorRate fail 분기용 negative** 라 happy-path 실측 근거를
   못 찾았고 정본 slice bullet 도 이를 조회 route 로 세지 않아 **추측 대신 (B) 로 보수 분류** 한다.
   `person-detail-read` 도 같은 이유(slice 1 의 부재 id 404 만 존재)로 T-1536 이 (B) 에 보수 분류해
   뒀으나, **slice 19(T-1537) 가 `GET /api/persons/:id` 를 happy-path 로 실측하면서 그 유보가 해소** 돼
   (A) 로 옮겼다 — 보수 분류는 근거가 생기면 이렇게 풀린다는 첫 선례다.

   **(C) perf-spec 자체가 없는데 미측정인 read route — 현 시점 확인분 0 건**

   `grep -rn "@Get(" src/**/*.controller.ts` sweep 기준 controller 20 개의 조회 route 는 **31 개**
   (`@Get` 이 0 인 write / trigger 전용 controller 5 개 제외) 이고, 이는 **실측 28 + (B) 3 = 31** 과
   맞물린다 — 즉 **현 시점 (C) 는 0 건** 이다. slice 18 의 `GET /api/groups/:id/members` 가 **(C) 였다가
   해소된 선례** 다(mock 짝이 없어 "mock 잔존 30" 셈에는 애초에 안 잡히는데 미측정이던 route —
   T-1534 의 "계수 함정 ②"). `AppController` 의 root read 는 (C) 후보로 보였으나
   `app-root-read.perf-spec.ts` 가 실존해 **(B) 로 분류** 했다. 본 절은 **완전 열거를 주장하지 않는다** —
   controller · route 가 늘면 다시 조사해야 하는 **현 시점 확인분** 일 뿐이다.

   **자체 검산** — `A + B = 27 + 3 = 30` 이고 위 `**잔여**` 의 계산식 `read 48 − 실 DB read 18 = 30`
   도 같은 **30** 이다. 앞은 **route 분류의 합**, 뒤는 **파일 glob 의 차** 라 **서로 다른 셈이 같은 수를
   가리키는** 교차 검증이 된다. 두 셈이 어긋나면 문서가 아니라 분류를 고친다.

   **오독 차단 — "mock 잔존 30 개" ≠ "잔여 slice 30 개"**. 30 은 **파일 계수** 일 뿐이고 실제 잔여
   cutover 후보는 **(B) + (C) = 3 + 0 = 3 route** 다((A) 로 1 건이 옮겨가 3 이 됐다고 해서 잔여가 곧
   소진 임박인 것은 아니다 — (A) 부류 mock spec 의 retire 판단은 여전히 미착수이고 write / trigger
   route 는 애초에 본 목록 밖이다). (A) 27 개는 route 가 이미 실측돼 잔여가 아니며,
   반대로 (C) 부류는 mock 짝이 없어 30 에 **애초에 안 잡히므로** 30 은 잔여의 상한도 하한도 아니다.

   본 인벤토리는 **측정 0 · 새 spec 0 · production code 0** 의 목록화라 REQ-048 재판정도
   REQ-047(100~200명 / 50~100 repo / ~1000 confluence page / 1h) 진전도 **아니다** — 위 item 5 의
   **미완** 서술(baseline 파일 확정 · 임계 fix 미착수 · `writeBaselineFile` 미사용)과 규모 민감도 ·
   실 scale 부하 · 시각화(web) 렌더 측정 축 잔여는 **그대로 유효** 하다. 다음 slice 로 어느 route 를
   고를지의 **우선순위 부여도 본 절의 몫이 아니다**.
