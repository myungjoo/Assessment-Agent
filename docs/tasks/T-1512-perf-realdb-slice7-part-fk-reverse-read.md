---
id: T-1512
title: 실 DB round-trip perf-spec slice 7 — 비-index FK 역방향 Part 소속 Person 조회 p95 실측
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 275
estimatedFiles: 2
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1511]
touchesFiles:
  - test/perf/part-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 ①(실측 endpoint 5 개) 에서 split — 여섯 번째 endpoint 도메인 + 명시 index 부재 FK 필터 + 상수 2-query + soft-delete 축"
---

# T-1512 — 실 DB round-trip perf-spec slice 7 (비-index FK 역방향 Part 소속 Person 조회)

## Why

[PLAN.md](../PLAN.md) `142 행` P7 성능검증 bullet 의 **잔여 ①** 은 "실 DB round-trip 실측 범위가
endpoint **5 개(조회 route 10)** 뿐" 이라고 박제돼 있다 ([T-1511](T-1511-perf-realdb-slice6-doc-sync.md)
가 main `42aa7b5f` 로 동기 완료). 본 task 는 그 잔여를 **여섯 번째 endpoint 도메인**
(`PartController` 조회 2 route) 으로 한 단계 더 좁히는 slice 7 이며,
[T-1500](T-1500-perf-realdb-person-read-baseline.md) → [T-1502](T-1502-perf-realdb-group-read-njoin.md)
→ [T-1504](T-1504-perf-realdb-slice3-njoin-scale-sensitivity.md) →
[T-1506](T-1506-perf-realdb-slice4-assessment-authed-read.md) →
[T-1508](T-1508-perf-realdb-slice5-contribution-fanout-read.md) →
[T-1510](T-1510-perf-realdb-slice6-summary-authed-read.md) 로 이어진 실 DB baseline 축의 연속이다.

slice 7 의 질적 차이는 **조회 구조 축 3 개** 다. ① `GET /api/parts/:id/persons` 의 필터 컬럼
`Person.partId` 는 `@unique` 도 `@@index` 도 **선언되지 않은 유일한 실측 필터 컬럼** 이다 (slice 4 =
composite `@@index`, slice 5 = composite unique 의 prefix, slice 6 = unique·index 중복 tuple) —
**index 미보장 경로에서도 REQ-048 임계가 성립하는지** 의 첫 증거다. ② `PartService.findPersonsByPartId`
는 부모 존재 검증(`findById`) 후 자식 조회(`findByPartId`) 를 하는 **요청당 상수 2 query** 패턴이라,
slice 2 의 membership 비례 N+1 과도 앞 slice 들의 단일 SELECT 와도 다르다. ③ 그 자식 조회는
`activeOnly` 기본값 때문에 `where: { partId, active: true }` **soft-delete 필터** 를 동반한다
(REQ-026) — 비활성 row 가 섞인 seed 에서 걸러짐과 latency 를 함께 관측하는 첫 지점이다.

본 task 는 **측정만** 한다. production code · 기존 mock perf-spec · 임계값 · baseline write 는
불변이고, PLAN · 부하계획 · REQ-048 문서 갱신은 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3
(direct·pr mixed 금지) 에 따라 **머지 후 별도 direct doc-sync task** 로 이월한다.

## Required Reading

- [test/perf/group-read-realdb.perf-spec.ts](../../test/perf/group-read-realdb.perf-spec.ts)
  — guard 미부착 controller 를 `createE2EApp()` 로 측정한 slice 2 원형. 부트스트랩 · seed ·
  `afterEach(truncateAll)` · 측정/분기 test 배치를 승계한다 (**이 파일 자체는 수정 금지**).
- [test/perf/summary-read-realdb.perf-spec.ts](../../test/perf/summary-read-realdb.perf-spec.ts)
  — 직전 slice 6. 파일 머리 주석 분량 · test 배치 밀도의 cap 기준선 (**수정 금지**).
- [test/perf/README.md](../../test/perf/README.md) 의 `## 실 DB round-trip baseline (slice 목록)`
  절 — slice 7 항목과 잔여 계수를 갱신할 정본 위치.
- [src/user/part.controller.ts](../../src/user/part.controller.ts) — `@Controller("api/parts")` 의
  `@Get()` `findAll()` · `@Get(":id/persons")` `findPersons(id)`. **guard 미부착** (인증 노이즈 0),
  클래스 레벨 `ValidationPipe(whitelist·forbidNonWhitelisted)` 적용.
- [src/user/part.service.ts](../../src/user/part.service.ts) 의 `findPersonsByPartId` — 옵션 (a)
  (부모 `findById` 로 404 강제 → `PersonRepository.findByPartId` forwarding) 인 **상수 2 query** 근거.
- [src/user/person.repository.ts](../../src/user/person.repository.ts) `121~139 행` `findByPartId` —
  `activeOnly` 기본 true 분기 (`where: { partId, active: true }` vs `where: { partId }`) 와 매칭 0 시
  빈 배열 반환 계약.
- `prisma/schema.prisma` 의 `model Part` (`name @unique`) 와 `model Person` 의 `partId String?` —
  **partId 에 `@@index` 선언이 없음** 을 확인할 근거.
- 공용 helper (이미 존재, 신규 helper 작성 금지):
  [test/helpers/e2e-app-factory.ts](../../test/helpers/e2e-app-factory.ts) (`createE2EApp`) ·
  [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) (`truncateAll`) ·
  [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts)
  (`collectLatencySamples` · `assertS2Threshold`) ·
  [test/perf/latency-metrics.ts](../../test/perf/latency-metrics.ts) (`summarizeLatency`) ·
  [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts)
  (`buildBaselineReport` · `formatBaselineLine`).

## Acceptance Criteria

- [ ] `test/perf/part-read-realdb.perf-spec.ts` 를 신설한다. **mock override 0** — `createE2EApp()`
      로 AppModule 을 실 부트스트랩하고 `moduleRef` 의 실 `PrismaService` 로 seed 한다. seed 는
      `Part` 2 개(대상 · 대조군) + 각 Part 소속 `Person` 여러 명이며, 대상 Part 에는 `active: false`
      Person 을 **1+ 포함** 시켜 soft-delete 필터가 실제로 걸러내는지 관측 가능하게 한다.
      `afterEach(truncateAll)` (ADR-0004 `§ Cleanup`) 로 row leak 0, `afterAll` 에서 `app.close()` +
      `prisma.$disconnect()`.
- [ ] **happy-path 2** — `GET /api/parts` (목록) 와 `GET /api/parts/:id/persons` (비-index FK 역방향)
      각각을 반복 측정해 `assertS2Threshold` 로 p95 **< 3000ms** 를 검증한다. 두 test 모두 응답
      body 가 seed 한 row 값(`Part.name` · 소속 `Person.fullName` 집합)과 일치함을 함께 단언해
      **실 query 발화** 를 입증한다 (mock 짝의 `toHaveBeenCalledTimes` 등가 검증).
- [ ] **분기 cover 3** — ① `activeOnly` 기본 분기: 응답에 `active: false` Person 이 **포함되지 않음**
      ② 소속 Person 0 인 Part 는 **200 + 빈 배열** (404 아님) ③ 대조군 Part 소속 Person 이 대상 Part
      응답에 **섞이지 않음** (`partId` equality 필터 정확성). 각 분기 1+ test.
- [ ] **error path 1** — 존재하지 않는 `id` 로 `GET /api/parts/:id/persons` → **404** (부모 존재 검증
      단계에서 `NotFoundException`). 이 fail 분기는 `errorRate` 위반으로 도달해 측정 시간에 의존하지
      않는다.
- [ ] **negative cases 충분 cover 4** — ① 미존재 `id` 요청만 반복했을 때 `assertS2Threshold` 의
      `errorRate` 임계 위반으로 `pass=false` + `reasons` 축적 ② 비현실적 임계 주입(`p95MaxMs: 0`)
      으로 `pass=false` ③ 빈 DB(모든 row truncate 후) 에서 `GET /api/parts` 가 **200 + 빈 배열**
      ④ 잘못된 형식의 `id` (미존재 cuid 형태 문자열) 로도 500 이 아닌 **404** 로 수렴. fail 분기 측정은
      모두 측정 시간 무의존 형태로 두어 flaky 를 만들지 않는다.
- [ ] `test/perf/README.md` 의 `## 실 DB round-trip baseline (slice 목록)` 절에 **slice 7** 항목을
      추가하고 잔여 bullet 의 계수를 실측값으로 갱신한다 — 실측 endpoint **5 → 6 개(조회 route
      10 → 12)**, read 계열 glob · 실 DB read 계수는 **실제 `ls` 결과로 검산해 기재**한다 (피감수와
      감수가 함께 1 씩 늘어 mock 잔존 수는 불변인지 반드시 확인). 완료 선언 · 임계 fix 문구는 넣지 않는다.
- [ ] `pnpm lint` · `pnpm build` · `pnpm test:cov` 가 green (**line ≥ 80% / function ≥ 80%**).
      production code 변경 0 이라 회귀가 없음을 결과에 명시한다. 로컬 Postgres 부재 시
      `pnpm test:perf` 는 CI `perf test` step 이 검증하며, PR CI green 을 4-게이트 판정에 사용한다.
- [ ] 총 diff **≤ 300 LOC / 2 파일** (§3 cap). 파일 머리 설명 주석은 slice 6 대비 **축약** 해 cap
      여유를 확보한다 (직전 slice 실적 +297 로 cap 이 빠듯하다).

## Out of Scope

- `docs/PLAN.md` · `docs/ops/load-resilience-test-plan.md` · `docs/requirements.md` 갱신 — §3.1 rule 3
  (mixed 금지) 에 따라 **머지 후 별도 direct doc-sync task** 로 이월.
- production code (`src/**`) 변경 일체 — `Person.partId` 에 `@@index` 추가 · 2-query 를 join 1 query 로
  축약 · 직렬화 최적화 포함. **schema 변경은 §5 BLOCKED 대상** 이므로 절대 손대지 않는다.
- `GET /api/parts/:id` (단일 상세) 측정 — 앞 slice 의 by-id 패턴과 구조가 같아 정보가치가 낮고 cap 압박만
  키운다. 필요하면 후속 slice 로.
- 앞 slice 의 `*-realdb.perf-spec.ts` 6 개 및 기존 mock perf-spec (`part-read.perf-spec.ts` 등) 수정.
- write route (`POST` / `PATCH` / `DELETE /api/parts`) 측정, 임계값 변경, baseline 파일 write 확정.
- 규모 민감도 (소·대 표본 대소 관계) **assert** — 관찰 한 줄은 가능하나 대소 단언은 flaky 회피를 위해 금지.
- 신규 test helper 추출 · 신규 dependency 추가.

## Suggested Sub-agents

`implementer → tester` (새 아키텍처 결정 없음 — architect 불요).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
