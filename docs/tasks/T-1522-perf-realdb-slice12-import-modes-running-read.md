---
id: T-1522
title: 실 DB round-trip perf-spec slice 12 — ImportController 조회 2 route(0-query modes · RUNNING job 목록) p95 실측
phase: P7
status: DONE
prNumber: 1222
completedAt: 2026-08-06T17:38:59Z
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 290
estimatedFiles: 2
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1520]
touchesFiles:
  - test/perf/import-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 ①(실측 endpoint 10 개) 을 열한 번째 도메인으로 확장 — 새 축은 DB 미도달 0-query 동기 route 의 배선-only latency floor + 같은 fixture 안 DB/배선 성분 병렬 관측 + 필터·payload enum 2 종 혼재"
---

# T-1522 — 실 DB round-trip slice 12 (ImportController 조회 2 route)

## Why

[PLAN.md](../PLAN.md) `142 행` (R-92 조회 3초 이내) 의 잔여 절은 실 DB round-trip 실측 범위가
**endpoint 10 개(조회 route 19)** 뿐이며 나머지 read perf-spec **30 개** 는 여전히 service mock +
guard override(배선 latency) 임을 명시한다. 그 잔여를 endpoint 단위로 좁혀 온 slice 1~11
([T-1500](T-1500-perf-realdb-person-read-baseline.md) · [T-1502](T-1502-perf-realdb-group-read-njoin.md) ·
[T-1504](T-1504-perf-realdb-slice3-njoin-scale-sensitivity.md) ·
[T-1506](T-1506-perf-realdb-slice4-assessment-authed-read.md) ·
[T-1508](T-1508-perf-realdb-slice5-contribution-fanout-read.md) ·
[T-1510](T-1510-perf-realdb-slice6-summary-authed-read.md) ·
[T-1512](T-1512-perf-realdb-slice7-part-fk-reverse-read.md) ·
[T-1514](T-1514-perf-realdb-slice8-user-selfor-admin-read.md) ·
[T-1516](T-1516-perf-realdb-slice9-permission-denied-audience-read.md) ·
[T-1518](T-1518-perf-realdb-slice10-export-job-polling-read.md) ·
[T-1520](T-1520-perf-realdb-slice11-llm-provider-config-read.md)) 의 **열두 번째** 이자
**열한 번째 endpoint 도메인** 이 본 task 다.

대상은 `ImportController` 의 조회 2 route — `GET /api/admin/import/modes` ·
`GET /api/admin/import/running`. 앞 11 slice 와의 질적 차이는 **구조 축 3 개** 다.

① **DB 미도달 0-query route 의 첫 실측** — `modes` 는 handler 자체가 `async` 도 아닌 **동기 반환**
이고 service 미경유 · Prisma delegate 호출 **0** 이다(고정 2 mode enum 을 helper 로 서술 변환해
반환). 앞 11 slice 의 측정 route 는 예외 없이 최소 1 query 를 발화했으므로, 실 DB 부트스트랩 아래에서
**guard stack + 라우팅 + 직렬화만의 배선 latency floor** 를 처음 분리 관측한다.

② **같은 controller · 같은 fixture 안에서 0-query route 와 DB round-trip route 를 나란히 측정** —
`running` 은 실 `ImportJob` 을 `status: "RUNNING"` 으로 거르는 실 query 경로라, 동일 프로세스 · 동일
표본 조건에서 **DB 성분과 배선 성분의 상대 관측 기록** 이 처음 남는다(두 표본의 대소 관계는 slice 3
선례대로 wall-clock 비결정성 때문에 **단언하지 않고 관찰만** 한다).

③ **한 요청에 Prisma enum 2 종(필터 축 + payload 축) 혼재** — `ImportJob` 은 slice 10 `ExportJob` 의
정합 쌍이라 `@@index([status, createdAt])` leading-edge · `JobStatus` enum 필터 · `Restrict` FK 는
같지만, payload 축이 다르다: `mode`(`ImportMode`) 라는 **두 번째 enum 컬럼** + `restoredRowCount`
(`Int?`) + `error` / `artifactRef`(`String?`) 의 **nullable scalar 혼재** 다(slice 10 은 `Json?` 2 컬럼
JSONB 역직렬화 축이었다).

부수 축으로 `modes` 응답은 **DB 상태와 완전 무관한 고정 2 원소**(REPLACE=destructive / MERGE) 라
seed 유무에 latency 가 반응하지 않아야 하고, 두 route 모두 `@Roles("Admin")` 이라 403 layer 는
slice 10·11 과 동일하므로 **새 축으로 주장하지 않고 negative cover 로만** 유지한다.

본 task 는 **측정만** 한다 — production code · schema · mock 짝 perf-spec · 임계값(`p95 3000ms`,
REQ-048) 을 바꾸지 않는다. PLAN · 부하계획 · REQ-048 3 문서 반영은 [CLAUDE.md](../../CLAUDE.md) §3.1
rule 3(direct·pr mixed 금지) 에 따라 **머지 후 별도 direct doc-sync task** 로 이월한다.

## Required Reading

- [test/perf/llm-provider-config-read-realdb.perf-spec.ts](../../test/perf/llm-provider-config-read-realdb.perf-spec.ts) — 직전 slice 11 의 구조 템플릿(부트스트랩 · seed · 반복 · 단언 형태). 본 spec 은 이 형태를 따른다.
- [test/perf/export-read-realdb.perf-spec.ts](../../test/perf/export-read-realdb.perf-spec.ts) — slice 10 의 job 테이블(`ExportJob`) seed · `RUNNING` 필터 · Admin 403 선례. `ImportJob` 은 그 정합 쌍이라 seed 형태를 그대로 참고한다.
- [src/import/import.controller.ts](../../src/import/import.controller.ts) `340 행` ~ 끝 — `@Get("running")` · `@Get("modes")` · `@Get(":id")` 의 route 선언 순서와 guard/RBAC.
- [src/import/import-job.service.ts](../../src/import/import-job.service.ts) `160 행` ~ `185 행` — `findJob`(P2025 → 404) · `findRunning`(빈 배열 raw forward).
- [test/perf/README.md](../../test/perf/README.md) `631 행` ~ `660 행` — slice 11 항목 · **잔여** 절 · 로컬 실행 전제(본 task 가 slice 12 항목 추가 + 잔여 계수 갱신 대상).

## Acceptance Criteria

- [ ] `test/perf/import-read-realdb.perf-spec.ts` 신설 — `createAuthenticatedE2EApp` 로 mock override **0** · guard override **0** 인 실 `AppModule` 을 부트스트랩하고, 실 `PrismaService` 로 `ImportJob` 을 직접 seed 한 뒤 두 route 를 supertest 로 반복 호출해 `collectLatencySamples` + `assertS2Threshold` 로 p95 < 3000ms 를 단언한다.
- [ ] **happy-path** 2+ — ① `GET /api/admin/import/modes` 가 200 + 고정 2 원소(REPLACE destructive / MERGE non-destructive) 를 반환하며 p95 임계를 만족, ② `GET /api/admin/import/running` 이 200 + `RUNNING` job 배열을 반환하며 p95 임계를 만족.
- [ ] **error path** 1+ — 존재하지 않는 id 로 `GET /api/admin/import/:id` 를 호출하면 `findUniqueOrThrow` 의 P2025 가 **404** 로 변환됨을 확인(측정 대상 2 route 의 경로 오인 방지용 최소 1 case — 이 route 는 p95 표본에 넣지 않는다).
- [ ] **분기** 각 1+ — ① `RUNNING` 매칭 0 일 때 빈 배열(404 아님), ② `RUNNING` 1+ 와 다른 status(`PENDING`/`SUCCEEDED`/`FAILED`) 혼재 seed 에서 **비-RUNNING 미혼입**, ③ `modes` 응답이 seed 유무(0 건 / 혼재 다건)와 **무관하게 동일한 2 원소** 임(DB 미도달 축의 직접 증거).
- [ ] **negative cases 충분 cover** 4+ — ① cookie 부재 401(`modes`), ② 변조 토큰 401(`running`), ③ User tier actor 403(`modes` — guard 레벨 거절), ④ User tier actor 403(`running`). guard 는 override 하지 않고 실 JWT 로 통과·거절을 모두 태운다.
- [ ] `afterEach` 는 `truncateAll` 후 actor 를 **원본 id 그대로** 재-seed 한다(`reseedAuthenticatedActors`) — `ImportJob.requestedById` 가 `User` 를 FK 로 참조하므로 재-seed 누락 시 다음 case 의 seed 가 FK 위반으로 깨진다. `test/helpers/db-truncate.ts` 수정 **0**(`"User"` TRUNCATE CASCADE 가 `ImportJob` 을 함께 정리).
- [ ] 두 표본(0-query vs DB round-trip) 의 **대소 관계는 단언하지 않는다** — slice 3 선례대로 `buildBaselineReport` / 로그 한 줄 관찰 기록만.
- [ ] `test/perf/README.md` 의 `## 실 DB round-trip baseline (slice 목록)` 에 **slice 12** 항목을 추가하고 **잔여** 절 계수를 실검산으로 갱신(실측 endpoint 10 → **11**, 조회 route 19 → **21**, perf-spec 45 → **46**, read glob 40 → **41**, 실 DB round-trip 10 → **11**, mock 잔존 **30 불변** — 피감수·감수가 함께 1 증가).
- [ ] `pnpm lint && pnpm build` green, `pnpm test:cov` 통과(line ≥ 80% AND function ≥ 80%) — production src 변경 0 이라 coverage 무회귀여야 한다.
- [ ] 로컬/CI 에서 `pnpm test:perf` green(실 Postgres + `prisma migrate deploy` 전제. CI 의 `perf test` step 은 `services.postgres` + migrate deploy 이후라 workflow 편집 불요 — 기존 `testRegex` 가 새 spec 을 자동 picking).

## Out of Scope

- `docs/PLAN.md` `142 행` · `docs/ops/load-resilience-test-plan.md` `§ 5` · `docs/requirements.md` REQ-048 갱신 — **머지 후 별도 direct doc-sync task**(§3.1 rule 3).
- production code(`src/**`) · `prisma/schema.prisma` · `test/helpers/db-truncate.ts` 수정.
- 기존 mock 짝 perf-spec(`import-running-read` · `import-modes-read` · `import-detail-read`) 의 삭제 · 수정 · 실 DB 전환.
- 임계값(`DEFAULT_P95_MAX_MS = 3000`) 변경, `writeBaselineFile` / `confirmOrCompareBaseline` 로 baseline **확정**(관찰 전용만).
- import **실행**(`@Post()` 업로드 · `preview` · restore) 경로 측정 — 본 slice 는 조회 route 한정.
- 규모 민감도(소·대규모 두 표본) 측정 · REQ-047 실 scale 부하 — 별도 slice.

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)

## Result (2026-08-06)

`Status: DONE` — PR [#1222](https://github.com/myungjoo/Assessment-Agent/pull/1222) squash merge (`cc8b9f36`).
`test/perf/import-read-realdb.perf-spec.ts` 신설(+273) + `test/perf/README.md` slice 12 bullet · 잔여 계수
갱신(2 파일 / +297-3). happy 2 · error 1 (P2025 → 404) · 분기 3 (RUNNING 0 건 빈 배열 / 비-RUNNING 미혼입 /
modes seed-무관 2 원소) · negative 4 (401 ×2 · 403 ×2) 로 R-112 4 종 cover. 0-query 동기 route 의 배선-only
latency floor 와 DB round-trip route 를 같은 fixture 에서 병렬 관측(대소 관계 미단언), `afterEach` 는
`truncateAll` + `reseedAuthenticatedActors`. reviewer round 1/7 APPROVE, 4-게이트 PASS.

게이트 (4) 는 두 fire 에 걸쳐 해소됐다. 직전 fire 에서 `배포 산출물 검증(Docker 빌드 + 런타임 smoke)` job 이
step 0 개로 15 분 timeout cancelled (`not acquired by Runner of type hosted`) 되기를 5 회 반복했으나, 본 fire 가
같은 시각 main push run `31122598009` 의 **동일 job 이 9 step success** 임을 확인해 **hosted runner 전역 장애가
아니라 stuck run-attempt 에 갇힌 단일-job `rerun-failed-jobs` 경로** 임을 확정했다. 재실행을
`gh run rerun <runId>`(full-run) 로 전환하니 즉시 runner 확보 → 두 job 모두 success
(기본 검사 35 step 4m36s · 배포 산출물 검증 9 step 2m12s), run `31118242293` conclusion `success`.
코드 결함 0 이었으므로 `ci.consecutiveFails` 는 끝까지 0. doc-sync 는 `T-1523`(direct) 로 이월.
