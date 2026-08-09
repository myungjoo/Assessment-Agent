---
id: T-1543
title: 실 DB perf slice 22 — GET /api health read 의 DB 미접촉 latency floor 실측
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 420
estimatedFiles: 2
created: 2026-08-09
createdAt: 2026-08-09T13:10:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1542]
sizeExempt: true
exemptReason: 실 DB perf slice 계열은 spec 1 파일이 구조상 270~570 LOC (T-1500 275 / T-1526 274 / T-1528 339 / T-1530 345 / T-1537 552 / T-1539 528 / T-1541 549 실측) — 2 파일 유지 하 LOC 만 초과
touchesFiles:
  - test/perf/app-root-read-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "P5 PLAN 142 행 R-92 조회 3s — 실 DB slice 22(GET /api). 인벤토리 (B) 잔여 1 소진. 새 축 = DB 미접촉·guard 0 route 의 latency floor. 도메인 14 → 15 · route 30 → 31. pr · 2 파일 약 420 LOC."
---

# T-1543 — 실 DB perf slice 22: `AppController` health read (`GET /api`) 의 DB 미접촉 floor 실측

## Why

[docs/PLAN.md](../PLAN.md) `142 행` (P5 성능 검증 · R-92 "조회·시각화 3초 이내" / REQ-048) 의 실 DB
round-trip cutover 는 slice 1~21 로 **endpoint 도메인 14 개 · 조회 route 30 개** 에 도달했고,
[T-1542](T-1542-perf-realdb-slice21-doc-sync.md) doc-sync 로
[부하계획](../ops/load-resilience-test-plan.md) `§ 5` item 5 의 잔여 read route 인벤토리가 최신이다.
그 인벤토리가 확정한 **진짜 잔여 cutover 후보 (B)** 는 이제 `GET /api` (`AppController` root,
`app-root-read`) **1 건뿐** 이며 (`569 행`), 본 task 는 그 마지막 후보를 실 Postgres 부트스트랩으로
측정해 **(B) 를 0 으로 만드는** slice 다.

**본 slice 고유 축 — 실 부트스트랩 하 "DB 미접촉 route" 의 latency floor.** slice 1~21 은 전부
요청 경로가 실 Prisma round-trip 을 최소 1 회 수행하는 route 였다. 반면 `GET /api` 는
[`src/app.controller.ts`](../../src/app.controller.ts) 의 `getRoot()` 가
[`AppService.getStatus()`](../../src/app.service.ts) 의 **고정 상수 문자열**(`APP_STATUS_MESSAGE`)
을 동기 반환할 뿐이라, **실 `AppModule` + 실 Prisma 연결이 살아 있는 상태에서도 요청 경로는 DB 를
전혀 건드리지 않는다**. 따라서 본 slice 의 실측값은 같은 harness · 같은 부트스트랩 조건에서의
**framework + HTTP 왕복만의 하한(floor)** 이며, 앞선 21 slice 의 p95 를 읽을 때 "얼마가 DB 몫인가"
를 가늠할 **대조 기준선** 이 된다. mock 판 [`app-root-read.perf-spec.ts`](../../test/perf/app-root-read.perf-spec.ts)
(T-0859) 는 `AppService` 를 mock 으로 갈아끼운 collector 배선 floor 였을 뿐 **실 부트스트랩 floor 는
아니었다** — 그 차이가 본 slice 의 존재 이유다.

**두 번째 축 — guard layer 가 아예 없는 첫 실 DB slice.** slice 1~21 은 모두 `JwtAuthGuard`
(+ 상당수는 `RolesGuard` + `@Roles("Admin")`) 를 통과하는 route 라 cookie 발급이 전제였다.
`AppController` 는 **guard 미적용** 이라 인증 없이 200 이 나오고, 변조 쿠키를 붙여도 401 이 아니며,
User tier actor 도 403 이 아니다 — 이 "**다른 slice 와 정반대의 negative**" 를 실 부트스트랩에서
실증하는 것이 본 slice 의 두 번째 고유 지점이다.

**새 축이 아닌 것도 미리 못 박는다** — collector/assert 배선 재사용은 slice 1~21 과 동일하고,
`p95MaxMs: 0` 주입 fail 분기 · 인위 non-2xx 주입 errorRate 분기는 mock slice 시절부터의 관용 수단이며,
`buildBaselineReport` 관찰 전용(디스크 write 0) 도 전 slice 공통이다. 이들을 새 축으로 주장하지 않는다.

**경고 — 본 route 에는 timing-fragile 사고 이력이 있다.**
[`app-root-measure-confirm.perf-spec.ts`](../../test/perf/app-root-measure-confirm.perf-spec.ts) 의
compared 분기(T-0877)가 wall-clock 대소를 단언해 **T-0880 의 PR CI 를 2 회 연속 red 로 만들었고
T-0881 이 주입 clock 으로 결정론화** 해야 했다. 본 slice 는 "floor" 라는 성격상 **"다른 route 보다
빠르다" 를 단언하고 싶은 유혹이 구조적으로 크다** — 그 단언은 **금지** 다 (AC 6).

## Required Reading

- [test/perf/import-detail-read-realdb.perf-spec.ts](../../test/perf/import-detail-read-realdb.perf-spec.ts)
  (T-1541, slice 21) — **본 spec 의 구조 mirror**. 헤더 주석 형식, `latency-collector` /
  `latency-metrics` / `latency-baseline` import 3 종, `jest.setTimeout(120_000)`, `ITERATIONS` ·
  `SHORT_ITERATIONS` 관용, `describe("negative cases 충분 cover")` 블록 구성을 그대로 따른다.
  **수정 금지** — 읽기 전용 선례다.
- [test/perf/app-root-read.perf-spec.ts](../../test/perf/app-root-read.perf-spec.ts) (T-0859) —
  같은 route 의 **mock 판**. 헤더 주석이 이 route 의 특성(param 0 · guard 0 · 예외 경로 0 · 상수
  문자열 반환)을 이미 정리해 뒀다. **수정 · 삭제 금지** (AC 8).
- [src/app.controller.ts](../../src/app.controller.ts) + [src/app.service.ts](../../src/app.service.ts) —
  측정 대상. `@Controller("api")` + `@Get()` = `GET /api`, 반환값은 상수 `APP_STATUS_MESSAGE`
  (`"Assessment-Agent"`). **수정 금지** (production code 무변경 task).
- [test/helpers/e2e-app-factory.ts](../../test/helpers/e2e-app-factory.ts) +
  [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) +
  [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — 실 부트스트랩 · cookie 발급 ·
  `truncateAll` 의 정본. 본 slice 는 guard 가 없어 cookie 가 **happy-path 에는 불요** 하지만
  negative (b)(c) 에서 "쿠키가 있어도/변조돼도 200" 을 보이기 위해 쓴다.
- [test/perf/README.md](../../test/perf/README.md) 의 `## 실 DB round-trip baseline (slice 목록)` 절
  **slice 20~21 bullet**(`871 행` · `904 행` 부근) 과 그 뒤 **잔여** bullet — 본 task 가 slice 22
  항목을 append 할 자리이자 계수 정본.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 의
  **(B) 목록**(`569 행`) 과 **오독 차단 단락**(`587 행` 부근) — 본 slice 가 (B) 를 0 으로 만든다는
  근거이자, "(B) 0 = 성능 검증 완료" 오독을 금지하는 근거. **본 task 는 이 파일을 수정하지 않는다**
  (doc-sync 는 별도 direct task 로 이월 — AC 11).

## Acceptance Criteria

- [ ] **AC 1 — 신규 spec 1 파일 신설.** `test/perf/app-root-read-realdb.perf-spec.ts` 를 새로 만든다.
  **mock override 0** 인 실 `AppModule` 부트스트랩 + 실 Prisma client 로 `GET /api` 를 측정하며,
  `AppService` 를 `useValue` 로 갈아끼우지 않는다 (그렇게 하면 mock 판 T-0859 의 중복이 된다).
  헤더 주석에 **측정 대상 route · 본 slice 고유 축 2 종 · 새 축이 아닌 것 · 결정론 전략** 을
  slice 21 과 같은 형식으로 적는다.
- [ ] **AC 2 — happy-path test 1+.** `GET /api` 를 `ITERATIONS` 회 반복 조회 → 매 응답 **200** +
  body 가 상수 `APP_STATUS_MESSAGE`(`"Assessment-Agent"`) 와 정확히 일치 + `collectLatencySamples`
  표본 수 == 반복 수 + `assertS2Threshold` 의 `pass === true` (p95 < **3000ms**) 를 단언한다.
  상수는 `src/app.service.ts` 에서 **import 해서** 쓰고 문자열 리터럴을 복제하지 않는다.
- [ ] **AC 3 — error path test 1+.** `getRoot()` 자체에는 **예외 경로가 없다**(항상 200 상수 반환).
  이 사실을 주석에 명시한 뒤, error path 는 **인접 미매칭 경로**로 커버한다 — `GET /api/no-such-route`
  를 `SHORT_ITERATIONS` 회 반복해 전부 **404** 이고 500 이 아니며 응답 본문에 raw stack ·
  내부 경로가 노출되지 않고 collector 성공 표본이 **0** 임을 단언한다.
- [ ] **AC 4 — 분기 cover.** `getRoot()` 는 **분기가 0** 이다. 이 사실을 주석에 명시하고, 분기 cover
  는 (a) `assertS2Threshold` 의 **pass 분기** 와 **fail 분기** 양쪽 도달(AC 2 + AC 7 (d)(e)),
  (b) **DB 전량 truncate 전 / 후** 두 조건에서 응답 · 상태코드가 **불변** 임을 보이는 대조 쌍
  (= 본 route 가 DB 를 접촉하지 않는다는 실증) 으로 채운다. truncate 후 응답이 500 이 아니라
  **200 + 동일 문자열** 이어야 한다.
- [ ] **AC 5 — 새 축 test 1+ (DB 미접촉 floor).** 실 Prisma 가 연결된 부트스트랩에서 `GET /api` 의
  p95 를 측정해 **절대 임계 3000ms 미만** 임을 단언하고, `buildBaselineReport` /
  `formatBaselineLine` 으로 **관찰 라인만** 남긴다(디스크 write 0 — AC 10). 표본 규모 · 반복 수를
  spec 상수로 노출해 다른 slice 와 조건을 비교 가능하게 둔다.
- [ ] **AC 6 — timing-fragile 단언 금지 (회귀 차단, 본 task 최우선 함정).** 본 spec 은 **어떤
  wall-clock 값끼리도 대소를 단언하지 않는다** — 다른 route · 다른 slice · 같은 spec 안의 두 측정
  구간끼리도 마찬가지다. "floor 이므로 더 빠르다" 류 단언 · `expect(p95A).toBeLessThan(p95B)` ·
  기대 상한을 3000ms 보다 타이트하게 조이는 단언 전부 금지 (T-0877 → T-0880 CI 2 회 red →
  T-0881 결정론화 이력). 허용되는 latency 단언은 **고정 임계 `DEFAULT_P95_MAX_MS`(3000) 대비
  pass** 와 **주입 임계 0 대비 fail** 뿐이다. floor 성격은 **주석과 README 서술로만** 표현한다.
- [ ] **AC 7 — negative cases 충분 cover (각 1+ test, 최소 6 종).**
  (a) **인증 쿠키 없이** 반복 조회 → 401 이 아니라 **200** (guard 미적용 실증 — slice 1~21 과
  정반대). (b) **변조 토큰 쿠키** 를 붙여도 401/403 이 아니라 **200** 이고 표본이 정상 수집된다.
  (c) **User tier actor** cookie 로도 403 이 아니라 **200** (RolesGuard 부재 실증).
  (d) `p95MaxMs: 0` 주입 → 실 측정값이라도 `pass === false` + 사유가 p95 임계임을 단언.
  (e) 요청 wrapper 가 **인위 non-2xx(500 또는 503)** 를 반환하게 만들어 errorRate 위반 fail 분기
  도달 + 200 혼합 표본에서 `0 < errorRate < 1`. (f) **query string 을 붙여도**(`GET /api?x=1`)
  200 + 동일 문자열 (param 0 route 실증). (g) **`POST /api`** 는 405 가 아니라 **404** 로 수렴하고
  500 이 아님. — (a)~(g) 중 최소 6 종을 각각 별도 `it()` 로 두고 `describe("negative cases 충분
  cover")` 블록에 모은다.
- [ ] **AC 8 — 기존 app-root spec 2 개 무변경.** `test/perf/app-root-read.perf-spec.ts` 와
  `test/perf/app-root-measure-confirm.perf-spec.ts` 를 **수정 · 삭제 · 이름 변경하지 않는다**.
  `git diff --stat` 에 이 두 파일이 등장하면 위반이다.
- [ ] **AC 9 — 실행 검증.** `pnpm test:perf` 로 신규 spec 이 **실행되어 통과** 함을 확인하고
  (실 Postgres 필요 — CI `perf test` step 과 동일 조건), `pnpm test` 는 신규 spec 을 **picking 하지
  않음**(jest-perf 의 `testRegex` 가 `*.perf-spec.ts` 전용) 을 확인한다. 아울러 `pnpm lint` ·
  `pnpm build` 통과. **coverage 임계(line ≥ 80% / function ≥ 80%)**: 본 task 는 `src/` production
  code 를 1 LOC 도 바꾸지 않으므로 `pnpm test:cov` 결과가 **기존 대비 하락 없음** 을 확인하는
  것으로 갈음한다 (perf-spec 은 coverage 집계 대상 밖).
- [ ] **AC 10 — 임계 · baseline 정책 불변.** `DEFAULT_P95_MAX_MS = 3000` 을 바꾸지 않고, baseline 은
  **관찰 전용** 으로만 쓰며 baseline 파일을 디스크에 write 하지 않는다.
- [ ] **AC 11 — `test/perf/README.md` 계수 갱신 (실측값만).** `## 실 DB round-trip baseline (slice
  목록)` 절 끝에 **slice 22** bullet 을 slice 21 과 같은 형식으로 추가하고, 잔여 bullet 의 계수를
  아래 실측으로 갱신한다 — `ls test/perf/*.perf-spec.ts | wc -l` **56**,
  `ls test/perf/*read*.perf-spec.ts | wc -l` **51**, `ls test/perf/*realdb*.perf-spec.ts | wc -l`
  **22**, `ls test/perf/*read*realdb*.perf-spec.ts | wc -l` **21**. test 수는
  `grep -c "^\s*it(" test/perf/app-root-read-realdb.perf-spec.ts` **실측값** 을 쓴다 (추정 금지).
  **PLAN · 부하계획 · requirements 는 본 task 에서 건드리지 않는다** (§3.1 rule 3 — direct·pr
  mixed 금지, doc-sync 는 Follow-ups 로 이월).
- [ ] **AC 12 — 계수 함정 ① (mock 잔존 30 불변).** 신규 파일명에도 `read` 가 있어 `*read*` glob 이
  **50 → 51** 로 늘지만 실 DB read 도 **20 → 21** 로 함께 늘어 mock 잔존은 `51 − 21 = ` **30 으로
  불변** 이다. README 에서 이 30 을 증감시키지 않고, 계산식만 `read 51 개 − 실 DB read 21 개` 로
  갱신하며 결과가 같은 이유를 1 구절 남긴다.
- [ ] **AC 13 — 계수 함정 ② (도메인이 이번엔 는다).** `AppController` 는 실측 endpoint 도메인
  14 개에 **없던 새 도메인** 이므로(부하계획 `569 행` 이 근거) 도메인 **14 → 15**, 조회 route
  **30 → 31** 로 **둘 다 +1** 이다 — slice 15·17·18·19·20·21 의 "도메인 불변 · route 만 +1" 셈법을
  **복사하지 않고**, **slice 16 과 같은 셈법** 임을 1 구절로 명기한다.
- [ ] **AC 14 — 계수 함정 ③ (완료 선언 0, 본 slice 최대 함정).** 본 slice 로 인벤토리 **(B) 가
  1 → 0** 이 되고 조회 route 실측이 **31 = 인벤토리 열거 총계** 에 도달하지만, README 어디에도
  **"조회 성능 검증 완료" · "잔여 소진" · "전량 실측 달성"** 으로 읽히는 표현을 쓰지 않는다.
  ① 인벤토리는 스스로 **완전 열거를 주장하지 않는다**(부하계획 `587 행`), ② (A) 부류 mock spec
  **30 개의 retire 판단은 미착수**, ③ **write / trigger route 는 애초에 목록 밖**,
  ④ REQ-047 실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정 **4 잔여 축 존속** — 이 4 유보를
  slice 22 bullet 또는 잔여 bullet 에 **명시** 한다.
- [ ] **AC 15 — 크기 · 규약 검산.** `git diff --stat` 이 **2 파일** (`test/perf/app-root-read-realdb.perf-spec.ts`
  신규 + `test/perf/README.md`) 임을 확인한다. LOC 는 `sizeExempt: true` 로 면제되나 파일 수 2 는
  반드시 지킨다. 새로 쓰는 행 좌표 표기는 [CLAUDE.md](../../CLAUDE.md) §12 (`§ 12.76` `R1`·`R4`·
  `R5`) 를 따르고(구분자 `~`, 단일 행 `569 행`, `L` prefix 금지), 주석 · 문서 본문은 한국어로 쓴다.

## Out of Scope

- **production code 변경 일체** — `src/app.controller.ts` · `src/app.service.ts` ·
  `APP_STATUS_MESSAGE` 값 · guard 부착 여부를 바꾸지 않는다. 본 slice 는 **현재 동작을 판단 없이
  측정만** 한다. "health endpoint 에 guard 가 없다" 를 보안 결함으로 적지 않는다 (REQ-057 등
  보안 REQ 행 재판정 금지 — 필요하면 Follow-ups 에만).
- **기존 app-root spec 2 개 수정 · 삭제 · 통합** (AC 8) — 특히
  `app-root-measure-confirm.perf-spec.ts` 의 T-0877/T-0880/T-0881 이력 재판정 · 리팩터 금지.
- **PLAN · 부하계획 · requirements 3 문서 갱신** — §3.1 rule 3 (direct · pr mixed 금지) 에 따라
  **머지 후 별도 `direct` doc-sync task** 로 이월한다 (Follow-ups 에 적는다). 본 PR 은
  `test/perf/README.md` 정본만 갱신한다.
- **(A) 부류 mock perf-spec 30 개의 retire · 삭제 · 통합** — 특히 이번에 (A) 로 옮겨갈
  `app-root-read.perf-spec.ts` 를 지울지 남길지는 T-1536 이 명시적으로 유보한 별도 판단이다.
- **write / trigger route 의 perf 배선** · **인벤토리 범위를 read 밖으로 확장** — 기존 경계 문장을
  유지한다.
- **REQ-047 실 scale 부하 (100~200명 / 50~100 repo / ~1000 confluence page / 1h) 착수** ·
  **k6 등 부하 발생기 도입** (ADR-0054 PROPOSED 대기) · **새 dependency 추가** — §5 BLOCKED 게이트
  대상이다. 본 slice 의 표본은 상대 비교용 소규모이며 REQ-047 충족으로 읽히게 적지 않는다.
- **baseline 파일 확정 · 임계값 조정 · CI perf job 구성 변경** — `DEFAULT_P95_MAX_MS = 3000` 및
  "baseline 후 fix" 서술 불변 (AC 10).
- **`latency-collector` · `latency-metrics` · `latency-baseline` 순수 primitive 자체 변경** — 본
  spec 은 이들을 **호출 · 배선만** 한다.
- **PLAN 성능 검증 checkbox 체크 · REQ-048 status flip** — 본 task 는 그 파일들을 열지 않는다.
- **DB schema · index · migration 변경** — §5 BLOCKED 대상.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 아키텍처 결정 0, slice 1~21 이 확립한 harness 재사용).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

주의 (실행 시 참고): (1) negative (b)(c) 에서 cookie 를 쓰고 AC 4 에서 `truncateAll` 을 수행하면
후속 test 의 actor `User` 가 사라진다 — 발급 순서를 truncate 이후로 두거나 actor 를 재seed 한다.
(2) 머지 후 **PLAN `142 행` · 부하계획 `§ 5` item 5 인벤토리 (B) 1 → 0 · REQ-048 3 문서 doc-sync** 를
별도 `direct` task 로 이월한다.
