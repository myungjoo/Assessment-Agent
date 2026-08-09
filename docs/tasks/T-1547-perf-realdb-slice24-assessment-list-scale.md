---
id: T-1547
title: 실 DB perf slice 24 — GET /api/assessments 규모 민감도 실측 (index prefix 필터 + 인증 경유)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 290
estimatedFiles: 3
created: 2026-08-09
createdAt: 2026-08-09T21:45:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1546]
touchesFiles:
  - test/perf/assessment-list-scale-realdb.perf-spec.ts
  - test/perf/README.md
  - docs/tasks/T-1547-perf-realdb-slice24-assessment-list-scale.md
plannerNote: "PLAN 140~142 행 성능 검증 bullet 의 잔여 축 (b) 규모 민감도 2 → 3 route — 인증 guard 경유 + composite index prefix 필터 규모 축 첫 실측"
---

# T-1547 — 실 DB perf slice 24: `GET /api/assessments` 규모 민감도

## Why

[T-1546](T-1546-perf-realdb-slice23-doc-sync.md) 이 slice 23 doc-sync 를 마치면서
[PLAN.md](../PLAN.md) `140 행` 성능 검증 bullet 은 여전히 `[ ]`, REQ-048 은 `IN_PROGRESS`,
[부하계획](../ops/load-resilience-test-plan.md) `§ 5` item 5 는 **미완** 으로 남았다. 잔여 축은 넷 —
(a) (A) 부류 mock spec 30 개 retire 판단, (b) **규모 민감도**, (c) baseline 확정 · 임계 fix,
(d) web 렌더 측정 + REQ-047 실 scale 부하. 본 task 는 T-1546 `## Follow-ups` 가 planner 몫으로
이월한 선택지 중 **(b) 규모 민감도** 를 이어서 택한다.

근거: 규모 축 실측은 slice 3(`GET /api/groups/:id/persons` — membership 수 = 요청당 query 수) 과
slice 23(`GET /api/persons` — 목록 route 의 총 row 수 + `active` 선택도) **두 route 에만** 도달했고,
[test/perf/README.md](../../test/perf/README.md) `잔여` bullet 이 "나머지 endpoint 의 규모 민감도는
미측정" 이라고 명시한다. 그 둘의 대상 controller 는 **둘 다 guard 미부착** 이고 필터 컬럼도
**index 선언이 없거나(`Person.active`) N+1 navigation** 이었다. 본 slice 는 그 두 공백을 함께 닫는다.

**본 slice 고유 축 ① — 인증 · 인가 layer 를 통과하는 첫 규모 축 slice.** `AssessmentController`
([src/user/assessment.controller.ts](../../src/user/assessment.controller.ts) `93~107 행`) 은
`@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` 가 붙은 route 다. slice 4(T-1506) 가
**고정 소규모 표본**(`WEEK_ROWS = 4` · `MONTH_ROWS = 3`) 으로 guard 경유 p95 를 이미 쟀지만, guard 비용이
**결과 집합 규모와 무관한 상수** 인지는 한 번도 관측된 적이 없다. 규모를 키운 두 표본을 같은 guard stack
으로 통과시키는 것이 본 slice 의 첫 축이다.

**본 slice 고유 축 ② — composite index prefix 필터의 2 단 선택도.** 대상 필터는
`@@index([personId, period, periodStart])`
([prisma/schema.prisma](../../prisma/schema.prisma) `Assessment` model) 의 **prefix** 를 탄다.
slice 23 의 선택도 축은 **무-index boolean 컬럼**(`active`) 이라 "응답은 줄어도 스캔 대상은 그대로"
였지만, 본 slice 는 ① `personId` 로 **다른 person 의 row 를 배제** 하고 ② `period` 로 한 번 더 좁히는
**2 단** 이라 "테이블 총 row 는 크지만 응답은 작다" 를 index 경유로 만드는 첫 표본이다. slice 4 는 이
경로를 **소규모 단일 표본** 으로만 쟀으므로 규모 반응은 미관측이다.

**측정만 한다** — index 추가 · `findByPerson` 쿼리 최적화 · 페이지네이션 도입은 production code /
schema 변경이라 전부 범위 밖이다 (관측 결과가 어떻든 본 task 에서 고치지 않는다. schema 변경은
[CLAUDE.md](../../CLAUDE.md) `§5` BLOCKED 게이트 대상이기도 하다).

**계수 함정 (doc-sync 가 이어받을 사전 인지).** 새 파일명
`assessment-list-scale-realdb.perf-spec.ts` 에는 `read` 가 **없으므로**(slice 3 · 23 과 같은 셈법)
`*read*` glob 은 **51 불변**, `*read*realdb*` 도 **21 불변**, 따라서 "mock 잔존 read perf-spec
**30 개**" 도 불변이다. 늘어나는 것은 perf-spec 총계 **57 → 58** 과 `*realdb*` **23 → 24** 뿐이다.
또 본 slice 는 **slice 4 와 같은 route** 를 다른 규모로 잴 뿐이라 **실측 도메인 15 · 조회 route 31 ·
인벤토리 (A) 30 / (B) 0 / (C) 0 이 전부 불변** 이고, 규모 축 route 는 **2 → 3** 이 된다.

## Required Reading

- [test/perf/person-list-scale-realdb.perf-spec.ts](../../test/perf/person-list-scale-realdb.perf-spec.ts)
  — **규모 축 구조 정본**(slice 23). 헤더 주석 ①~④ 구성 · 두 표본 상수 · `observations` 누적 ·
  대소 관계 미단언 규약을 승계한다. **수정 금지**.
- [test/perf/assessment-read-realdb.perf-spec.ts](../../test/perf/assessment-read-realdb.perf-spec.ts)
  — slice 4. 같은 route 의 **인증 경유 부트스트랩 정본**(`createAuthenticatedE2EApp` ·
  `buildAuthCookie` · `afterEach(truncateAll)` 직후 `reseedAuthenticatedActors`) 과 seed 시
  `@@unique([personId, period, scope, periodStart])` 충돌 회피용 `periodStart` 분산 방식.
  **수정 금지** (본 slice 는 별도 파일이다).
- [src/user/assessment.controller.ts](../../src/user/assessment.controller.ts) `82~119 행` —
  `findByPerson` 의 필수 `personId` 400 분기와 `period` 유무 분기, guard stack. **수정 금지**.
- [prisma/schema.prisma](../../prisma/schema.prisma) 의 `model Assessment` —
  `@@unique([personId, period, scope, periodStart])` 와 `@@index([personId, period, periodStart])`.
  **수정 금지** (읽기만 — schema 변경은 §5 BLOCKED).
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) ·
  [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `createAuthenticatedE2EApp`
  반환 형태 · `reseedAuthenticatedActors` 의 actor 재-seed 계약 · `truncateAll` 정리 범위.
  **둘 다 수정 금지**.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) ·
  [test/perf/latency-metrics.ts](../../test/perf/latency-metrics.ts) — `collectLatencySamples` ·
  `assertS2Threshold` · `summarizeLatency` 시그니처. **primitive 수정 금지**(관찰 전용, 디스크
  write 0 — baseline 파일 확정은 잔여 축 (c) 소관).
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 의
  **slice 23 bullet** 과 말미 **잔여** bullet — 본 task 가 갱신할 유일한 문서.
- [docs/tasks/T-1545-perf-realdb-slice23-person-list-scale.md](T-1545-perf-realdb-slice23-person-list-scale.md)
  `## Acceptance Criteria` — 규모 축 slice 의 AC 문형과 flaky 차단 규약 승계 출처.

## Acceptance Criteria

- [ ] **AC 1 — 신규 spec 1 개.** `test/perf/assessment-list-scale-realdb.perf-spec.ts` 를 새로
  만든다. `createAuthenticatedE2EApp([{ role: "User" }])` 로 **mock override 0 · guard override 0**
  인 실 `AppModule` 을 부트스트랩하고 `ctx.prisma` 실 client 로 seed 한다. 기존 perf-spec · helper ·
  primitive · production code · schema 는 **한 파일도 수정하지 않는다**. 헤더 주석은 slice 4 · 23 을
  **cross-ref** 로 승계하되 산문 복제 없이 **≤ 25 줄**.
- [ ] **AC 2 — happy-path (규모 축 2 표본).** ① 소규모(대상 person **10 row**) 와 ② 대규모(대상
  person **200 row**) 두 표본 각각에 대해 `GET /api/assessments?personId=<id>` 를 실 JWT cookie 로
  반복 측정해 `assertS2Threshold` 가 **p95 < 3000ms** 로 pass 하고, 응답 배열 길이가 seed 행 수와
  **정확히 일치** 함을 확인한다(실 query 발화 입증). 반복 횟수는 대규모가 직렬화 비용이 크므로
  소규모보다 작게 잡는다(slice 3 · 23 의 `SMALL/LARGE_ITERATIONS` 선례).
- [ ] **AC 3 — 분기 cover ① index prefix 2 단 선택도.** 대규모 표본에 **다른 person 의 row**
  (예: 150 row) 를 섞은 상태에서 ⓐ `?personId=` 만 준 요청과 ⓑ `?personId=&period=week` 를 준 요청
  두 갈래를 측정한다. ⓐ 는 대상 person row 수와, ⓑ 는 그중 `week` row 수와 **정확히 일치** 하는 길이를
  돌려주고 타 person row 가 **0 건 혼입** 이며 두 갈래 모두 p95 가 임계 아래임을 확인한다 — "테이블
  총 row(대상 + 타인)와 응답 크기가 분리되는 표본" 임을 주석 1 구절로 남긴다.
- [ ] **AC 4 — 분기 cover ② pass / fail 양쪽 도달.** `assertS2Threshold` 의 **pass 분기**(AC 2 · 3)와
  **fail 분기**(`p95MaxMs: 0` 주입 → 실 측정 시간에 무의존한 결정론적 throw) 를 모두 도달시킨다.
  controller 의 `period` 유무 분기(AC 3 ⓐ / ⓑ)도 본 항목의 branch cover 에 포함된다.
- [ ] **AC 5 — negative cases 충분 cover (각 1+ test).** 최소 다음 5 종 —
  (a) **`personId` 누락** 요청이 **400** (controller 필수 query 분기),
  (b) **매칭 0 건**(존재하지 않는 `personId` 또는 전량 다른 period) 요청이 404 가 아니라
  **200 + `[]`**(빈 컬렉션은 오류가 아님 — 경계값),
  (c) **cookie 미부착** 요청이 **401**(`JwtAuthGuard` 생존 — 규모 표본과 무관하게 성립),
  (d) 인위 **non-2xx 주입** 표본의 `errorRate` 위반과, 2xx 혼합 표본의 **`0 < errorRate < 1`**,
  (e) 대규모 표본을 `truncateAll` 로 비운 **전/후 대조 쌍** 에서 응답 길이가 200 → 0 으로 바뀌고 두
  요청 모두 **200** 임. truncate 가 actor `User` row 도 지우므로 **`reseedAuthenticatedActors` 로
  원본 id 그대로 재삽입** 한다(새 id · token 재발급 금지, `db-truncate.ts` 수정 0).
- [ ] **AC 6 — 대소 관계 assert 금지 (flaky 차단).** 두 표본의 p95 대소(`large > small`) 는
  **assert 하지 않고** `observations` 배열에 관측 기록으로만 남긴다(slice 3 · 23 선례 — wall-clock
  비결정성). 단언은 **각 표본이 임계 아래** 라는 것뿐이다.
- [ ] **AC 7 — 실행 · 통과 확인.** `pnpm test:perf` 로 신규 spec 이 실행돼 **전부 pass** 하고,
  `pnpm lint && pnpm build && pnpm test` 도 통과한다(기본 `pnpm test` 는 `.perf-spec.ts` 를 picking
  하지 않으므로 계수 변화 0). CI 의 `perf test` step 도 green 이어야 한다.
- [ ] **AC 8 — coverage.** `pnpm test:cov` 가 **line ≥ 80% / function ≥ 80%** 로 통과한다(본 task 는
  production code 변경 0 이라 coverage 수치 변동은 없어야 한다 — 회귀 0 확인 목적).
- [ ] **AC 9 — 정본 문서 갱신 (`test/perf/README.md` 1 파일만).**
  `## 실 DB round-trip baseline (slice 목록)` 에 **slice 24 bullet** 을 추가하고 말미 **잔여** bullet 의
  계수를 갱신한다 — perf-spec **57 → 58** · `*realdb*` **23 → 24**, `*read*` **51 불변** ·
  `*read*realdb*` **21 불변** · mock 잔존 **30 불변** · 도메인 **15 불변** · 조회 route **31 불변** ·
  인벤토리 (A) 30 / (B) 0 / (C) 0 **불변**, 규모 축 route **2 → 3**. 개수는 **편집 전 실측값**
  (`ls test/perf/*.perf-spec.ts` 계열 glob) 으로 확인해 적는다. slice 24 bullet 은 **≤ 30 줄** 이고
  slice 3 · 23 의 산문을 복제하지 않는다(cross-ref).
- [ ] **AC 10 — 완료 선언 0.** [PLAN.md](../PLAN.md) · [requirements.md](../requirements.md) ·
  [부하계획](../ops/load-resilience-test-plan.md) 은 **본 task 에서 수정하지 않는다**(doc-sync 는 후속
  `direct` task 몫 — §3.1 rule 3 mixed 금지). README 안에서도 "규모 축이 해소됐다" 거나 "REQ-048
  검증 완료" 로 읽히는 문장을 쓰지 않는다 — 본 표본은 **상대 비교용 소규모** 이고 REQ-047 의 실 scale
  부하가 아님을 1 구절로 명시한다.
- [ ] **AC 11 — 크기 · 표기 검산.** `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다. 새로
  추가하는 행 좌표 표기는 [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기"(`§ 12.76` `R1` · `R4` ·
  `R5 (§ 12.91 개정)`) 를 따른다 — 구분자 `~`, 단일 행은 `93 행`, `L` prefix 금지, 기존 행 소급 치환
  금지.

## Out of Scope

- **production code · schema 변경 일체**(`src/` · `prisma/`) — index 추가 · 쿼리 최적화 ·
  페이지네이션 도입은 관측 결과와 무관하게 범위 밖이다(schema 는 §5 BLOCKED 게이트 대상).
- **기존 perf-spec · helper · primitive 수정** — 특히
  [`assessment-read-realdb.perf-spec.ts`](../../test/perf/assessment-read-realdb.perf-spec.ts)(slice 4) ·
  [`person-list-scale-realdb.perf-spec.ts`](../../test/perf/person-list-scale-realdb.perf-spec.ts)(slice 23) ·
  `auth-e2e-helper.ts` · `db-truncate.ts` · `latency-*.ts` 는 **읽기 전용** 이다.
- **mock 짝 retire · 삭제 · 통합** — `assessment-read.perf-spec.ts` ·
  `assessment-detail-read.perf-spec.ts` 는 불변(본 slice 는 대체가 아니라 보완). (A) 부류 30 개의
  retire 판단은 T-1536 이 유보한 별도 축이다.
- **PLAN · requirements · 부하계획 문서 갱신**(AC 10) — 후속 doc-sync `direct` task 몫.
- **baseline 파일 write · 임계값 변경** — `writeBaselineFile` 미사용 유지,
  `DEFAULT_P95_MAX_MS = 3000` 불변(잔여 축 (c) 소관).
- **write / trigger route 측정 · 동시성(S3) · REQ-047 실 scale 부하 · web 렌더 측정** — 각각 별도 축.
- **단건 상세 route(`GET /api/assessments/:id`) 재측정** — slice 4 가 이미 쟀고 응답이 1 row 고정이라
  규모 축이 성립하지 않는다.
- **403 tier 분기 추가 측정** — `@Roles("User")` 라 인증된 모든 role 이 통과한다. 401 만 negative 로
  덮고 403 은 만들지 않는다(slice 8 · 10~13 이 이미 덮은 축이라 새 축도 아니다).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 결정 0, 기존 slice 구조 승계).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
