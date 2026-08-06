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
   확정하고 본 문서를 갱신. **실 DB round-trip 실측이 slice 12 까지 도달**: slice 1(T-1500, main
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
   slice 4·5·6·7·8·9·10·11·12 가 route 폭을 늘렸으므로 실측 범위는
   **11 endpoint (조회 21 route)** 다(slice 9 는 route 를 1 개만, slice 10·11·12 는 각각
   2 개를 더한다. 정본
   서술 = [`test/perf/README.md`](../../test/perf/README.md) 의
   `## 실 DB round-trip baseline (slice 목록)`).
   단 **본 item 은 미완** — `buildBaselineReport` + `formatBaselineLine` 은 **관찰 전용**
   이고 `writeBaselineFile` / `confirmOrCompareBaseline` 는 미사용이라 baseline 파일 확정이
   성립하지 않으며, §3 의 "baseline 후 fix" 임계 fix 도 미착수다. **잔여**: baseline 파일
   확정 · 임계 fix · 측정 endpoint 확대(나머지 read perf-spec 30 개는 service mock 잔존 —
   계산식은 read 41 개 − 실 DB read 11 개이며, slice 12 도 파일명에 `read` 가 있어 피감수(40→41)와
   감수(10→11)가 함께 1 씩 늘어 차이 30 은 불변이다) · **다른 endpoint(slice 5 의 contribution
   fan-out · slice 6 의 summary 시계열 조회 · slice 7 의 part 소속 조회 · slice 8 의 user 목록
   무필터 전량 SELECT · slice 9 의 permission-denied audit 목록 · slice 10 의 export job
   polling · slice 11 의 LLM provider config 조회 · slice 12 의 import job polling 과 modes
   조회 포함) 의
   규모 민감도**(규모 축 실측은 `:id/persons` 한 route 에 한해 도달).
