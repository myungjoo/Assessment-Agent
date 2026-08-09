---
id: T-1539
title: 실 DB perf slice 20 — part 단건 상세 조회 실측
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 340
estimatedFiles: 2
created: 2026-08-09
createdAt: 2026-08-09T05:40:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1538]
sizeExempt: true
exemptReason: 실 DB perf slice 계열은 spec 1 파일이 구조상 270~550 LOC (T-1500 275 / T-1526 274 / T-1528 339 / T-1530 345 / T-1537 552 실측) — 2 파일 유지 하 LOC 만 초과
touchesFiles:
  - test/perf/part-detail-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "P5 PLAN 142 행 R-92 조회 3s — 실 DB slice 20(GET /api/parts/:id). T-1536 인벤토리 (B) 3 후보 중 가장 오래된 미해소 짝. 합성 route 의 내부 구성 query 를 단독 route 로 분리 측정. 도메인 14 불변 · route 28 → 29. pr · 2 파일 약 340 LOC."
---

# T-1539 — 실 DB perf slice 20: part 단건 상세 조회 실측

## Why

[docs/PLAN.md](../PLAN.md) `142 행` (P5 성능 검증 · R-92 "조회·시각화 3초 이내" / REQ-048) 의 실 DB
round-trip cutover 는 slice 1~19 로 **endpoint 도메인 14 개 · 조회 route 28 개** 에 도달했다.
T-1536 인벤토리([부하계획](../ops/load-resilience-test-plan.md) `§ 5` item 5)가 확정한 **진짜 잔여
cutover 후보 (B) 3 route** 는 이제 `GET /api/parts/:id` · `GET /api/admin/import/:id` · `GET /api`
셋이며, T-1538 doc-sync 로 그 인벤토리가 최신 상태다. 본 task 는 그중 **가장 오래된 미해소 짝** 인
`GET /api/parts/:id` 를 slice 20 으로 소진한다.

이 route 를 먼저 고르는 이유는 두 가지다. ① slice 7
([`part-read-realdb.perf-spec.ts`](../../test/perf/part-read-realdb.perf-spec.ts), T-1512) 가 같은
`PartController` 의 목록(`GET /api/parts`) 과 자식 목록(`GET /api/parts/:id/persons`) 만 재고 단건
`:id` 는 남겨뒀다 — slice 12(T-1522) 가 남긴 `import-detail` 짝보다 **더 오래된 미해소 짝** 이다
(slice 19 가 "가장 오래된 짝부터" 라는 선례를 이미 세웠다). ② 구조 축이 새롭다 — `:id/persons` 를
처리하는 `PartService.findPersonsByPartId` 는 **내부에서 `this.findById(partId)` 를 먼저 호출** 한 뒤
자식 `findMany` 를 태우는 요청당 상수 2 query 경로인데, 본 route 는 **그 첫 query 만 단독으로 노출된
route** 다. 즉 합성 route 의 **구성 성분 query 를 분리해 재는 첫 페어** 다.

본 slice 는 **측정만** 한다 — production code · schema · 임계값은 건드리지 않는다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  잔여 인벤토리의 (B) 3 route 목록과 계수 검산 (`A + B = 27 + 3 = 30`).
- [test/perf/README.md](../../test/perf/README.md) — slice 19 bullet 과 그 아래 `**잔여**` bullet
  (계수 정본: perf-spec 53 / read glob 48 / 실 DB read 18 / 실 DB 총 19 / mock 잔존 30).
- [test/perf/part-read-realdb.perf-spec.ts](../../test/perf/part-read-realdb.perf-spec.ts) —
  slice 7. 부트스트랩 · seed · `afterEach(truncateAll)` 구조를 그대로 승계할 대상.
- [test/perf/person-detail-read-realdb.perf-spec.ts](../../test/perf/person-detail-read-realdb.perf-spec.ts) —
  slice 19. 단건 상세 slice 의 헤더 서술 형식(위치 / mock 짝 / 새 축 / **새 축으로 주장하지 않는 것** /
  negative 구성)을 형식 선례로 삼는다.
- [src/user/part.controller.ts](../../src/user/part.controller.ts) — `@Get(":id") findById` 와
  guard 미부착 사실.
- [src/user/part.service.ts](../../src/user/part.service.ts) — `findById` 의 null → `NotFoundException`
  분기, `findPersonsByPartId` 가 `findById` 를 선행 호출하는 2 query 구조.
- [prisma/schema.prisma](../../prisma/schema.prisma) `114~122 행` — `Part` 모델(4 scalar 컬럼 +
  `persons Person[]` 역방향 relation, `name @unique`).

## Acceptance Criteria

- [ ] `test/perf/part-detail-read-realdb.perf-spec.ts` 신설 — mock override 0 으로 AppModule 을 실
      부트스트랩(`createE2EApp`)하고 `PrismaService` 실 client 로 seed 해 `GET /api/parts/:id` 의
      **DB round-trip 포함 latency** 를 측정한다. 검증은 호출 횟수가 아니라 **응답 body 가 seed row
      값과 일치** 함으로 한다.
- [ ] **happy-path test 1+** — `GET /api/parts/:id` 반복 조회가 전부 200 이고 응답 `name` 이 seed 값과
      일치하며 `assertS2Threshold` 가 p95 < 3000ms 로 pass.
- [ ] **error path test 1+** — 미존재 id 조회가 전부 404 로 수렴하고 표본이 0 (성공 표본 없음) 임을 단언.
      500 이 아님을 명시적으로 확인.
- [ ] **분기 cover** — 최소 3 분기: ① 200 (존재 row), ② 404 (부재 row, `findById` 의 null 분기),
      ③ 자식 Person 0 건 Part 와 자식 다수 Part 의 단건 응답이 **동일한 4 scalar 컬럼 형태** 이고 두
      p95 가 모두 임계 미만 (`include` 0 이라 자식 fan-out 에 payload 가 반응하지 않음).
- [ ] **negative cases 충분 cover** — 예외 상황마다 1+ test: (a) 미존재 id 반복 주입 시 errorRate 임계
      위반으로 `pass === false`, 200 혼합 표본에서는 `0 < errorRate < 1`, (b) `p95MaxMs: 0` 비현실적
      임계 주입 시 실 측정값이라도 `pass === false` + p95 사유, (c) 빈 DB 에서 임의 id 조회가 500 이
      아니라 404 로 수렴, (d) 비-cuid 형태 · 빈 대체 토큰 id 도 404 로 수렴, (e) 삭제된 id 재조회의
      **200 → 404 전이**, (f) 대조군 Part 가 함께 존재해도 응답에 다른 Part 의 `name` 이 섞이지 않음
      (혼입 0), (g) 응답에 `persons` 키가 부재 — 미조인 SELECT 증거.
- [ ] **페어 관측** — 같은 seed 상태에서 slice 7 이 이미 잰 `GET /api/parts/:id/persons` 를 **대조군으로
      함께 호출** 해 두 route 의 p95 를 모두 임계 미만으로 단언하되, **두 route 의 대소 관계는 assert
      하지 않는다**(slice 3 선례 — wall-clock 비결정성). 같은 `findById` null 분기에서 나오는 두 route 의
      404 도 마찬가지로 관찰만 한다. slice 7 spec 파일 자체는 **수정하지 않는다**.
- [ ] spec 헤더 주석에 다음을 명시: ① slice 위치와 계수(도메인 **14 불변** · 조회 route **28 → 29**),
      ② mock 짝이 `test/perf/part-detail-read.perf-spec.ts`(T-0848) 이며 **수정하지 않음**,
      ③ 새 구조 축(합성 route 의 구성 성분 query 분리 측정 · 404 를 공유하는 두 route 의 거절 경로 관측 ·
      규모 축이 **자식 row 수** 인 단건 무반응 관찰), ④ **새 축으로 주장하지 않는 항목** — PK 직행
      `findUnique`(slice 11·14·19 동일) · null 분기 404(slice 11·19 동일) · 미조인 SELECT(slice 11·19
      동일) · guard 부재로 인한 **401 / 403 분기의 구조적 부재**(slice 1·2·7·19 동일) · 한 controller 의
      조회 route 전량 실측 도달(Group slice 18 · Person slice 19 선례가 있어 새 축 아님).
- [ ] `test/perf/README.md` 에 **slice 20 bullet** 추가 + 그 아래 `**잔여**` bullet 의 계수 갱신 —
      perf-spec **53 → 54**, read glob **48 → 49**, 실 DB read **18 → 19**, 실 DB 총 **19 → 20**,
      **mock 잔존 30 은 불변**(`49 − 19 = 30` 검산 명시), 조회 route **28 → 29**, 도메인 **14 불변**.
      계수는 추정 금지 — `ls` glob + `grep -c` 실측값만 기재.
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 — 본 파일은 `jest-perf.json` 의 `testRegex` 에만 매칭돼 기본 `pnpm test` 에는
      picking 되지 않음을 확인.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — production code 변경이 0 이라 coverage 영향
      0 임을 함께 확인.
- [ ] `pnpm test:perf` 로 본 spec 이 실 Postgres(`DATABASE_URL` + `prisma migrate deploy` 전제) 에서
      통과. CI 의 `perf test` step 이 이 전제를 자동 충족함을 확인(workflow 편집 0).

## Out of Scope

- production code 변경 **0** — `PartService.findById` 에 필터 / `include` 추가, guard 부착, 404 메시지
  변경 금지.
- `prisma/schema.prisma` 수정 · migration 추가 (`Part` index 추가 판단은 본 실측을 근거로 하는 별도 task).
- slice 7 spec(`part-read-realdb.perf-spec.ts`) 수정 — 대조군 route 는 본 spec 안에서 호출만 한다.
- mock 짝(`part-detail-read.perf-spec.ts`) 수정 · retire · 통합 — T-1536 이 명시 유보한 별도 주제
  (mock 잔존 계수 불변).
- write route(`POST` · `PATCH` · `DELETE /api/parts`) 의 latency 측정 — seed / 삭제는 Prisma 직접 write.
- 임계값 변경 · baseline 파일 확정 (`DEFAULT_P95_MAX_MS = 3000` 불변, `writeBaselineFile` ·
  `confirmOrCompareBaseline` 미사용 — 관찰 전용, 디스크 write 0).
- 동시성 S3 시나리오 (`concurrency: 1` 고정).
- REQ-047 실 scale 부하 · REQ-048 완료 선언 — PLAN `140 행` checkbox 와 REQ-048 `IN_PROGRESS` 는 불변.
- doc-sync (PLAN `142 행` · 부하계획 `§ 5` item 5 인벤토리 (B) 3 → 2 재분류 · requirements 반영) —
  CLAUDE.md `§3.1` rule 3(direct·pr mixed 금지) 에 따라 머지 후 별도 `direct` task 로 이월.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가)

## 결과 (2026-08-09T06:50:21Z, DONE)

- `pr` mode — feature branch `claude/T-1539-perf-realdb-slice20-part-detail-read` → **PR #1230**
  round 1 에 4-게이트 (reviewer APPROVE + PR comment 외부 존재 + integrator 자체 점검 + CI green)
  전부 통과 후 squash merge **`915f7859`**. 변경 **2 파일 `+565/-4`**
  (`sizeExempt: true` — perf-spec 계열 구조상 LOC 만 초과, 파일 수 2 유지).
- 신설 `test/perf/part-detail-read-realdb.perf-spec.ts` 는 slice 7 의 부트스트랩 · seed ·
  `truncateAll` 구조를 승계하되 **mock override 0** 인 실 `AppModule` + 실 Prisma seed 로
  `GET /api/parts/:id` 를 단독 측정 — slice 7 이 합성 route (`:id/persons`) 로만 재고 남겼던
  **단건 상세** 축을 분리했다. test **12 종** (happy 1 + error 1 + 새 축 3 + negative 7).
- `test/perf/README.md` 계수는 전부 `ls` glob 실측 — perf-spec **54** / read glob **49** /
  실 DB read **19** / 실 DB 총 **20** / mock **30 불변**.
- CI: PR run **green** (perf step 에서 실 Postgres PASS, perf 469 test). 기본 `pnpm test` 에
  본 perf spec 이 미picking 되는 것도 확인. merge 후 main run 은 fire 종료 시점 **in_progress**
  → 다음 fire 첫 단계에서 conclusion 재확인 (R-114 위임).
- AC 전부 ok.

## Follow-ups (실행 후 추가)

- PLAN `142 행` · `docs/ops/load-resilience-test-plan.md` `§ 5` item 5 인벤토리 (B) **3 → 2**
  재분류 doc-sync — `§3.1` rule 3 (direct · pr mixed 금지) 에 따라 **별도 `direct` task 로 이월**.
