---
id: T-1095
title: app-root-read perf-spec getStatus call-count exactly-1 완결 — health-read(GET /api) happy-path 의 loose toHaveBeenCalled() 1건을 정확 횟수(toHaveBeenCalledTimes(1))로 못박아 중복 재호출 회귀 차단, 이로써 test 트리 전량의 positive-loose call-count 소진 (call-count 완결성 sweep leg 30 = tree-wide 마감)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 3
estimatedFiles: 1
created: 2026-07-18
dependsOn: []
touchesFiles:
  - test/perf/app-root-read.perf-spec.ts
independentStream: realdata-e2e-callcount-completeness-sweep
plannerNote: "P5 call-count 완결성 sweep leg 30 = tree-wide 마감. pre-check 실증(정밀 grep, 2026-07-18, origin/main): realdata consistency spec 전량(55개) positive-loose = 0(leg 28~29 = evaluation-plan·result-issue-command-plan 로 소진 완료). test/ 전체 재-grep 결과 잔여 positive-loose 는 test/perf/app-root-read.perf-spec.ts:145 단 1건. GET /api health-read happy-path test(L137~146)가 request 1회 → getRoot → getStatus 1회 호출 후 loose expect(service.getStatus).toHaveBeenCalled() 를 남김. beforeEach(jest.clearAllMocks())(L97~98) 격리 + 단일 request 이므로 exact N=1 확정 → toHaveBeenCalledTimes(1). 이 1건 tighten 으로 test 트리 전량의 positive-loose call-count 를 0 으로 소진(sweep 축 마감). pr test-only 1파일, src/helper .ts 0 LOC, file-disjoint dep[] stage5b."
---

# T-1095 — app-root-read perf-spec getStatus call-count exactly-1 완결 (sweep leg 30 = tree-wide 마감)

## Why

P5 test-hardening 의 call-count 완결성 sweep(T-1065 §D 후보 (b))은 leg 28([T-1093](T-1093-eval-plan-callcount.md), evaluation-plan)·leg 29([T-1094](T-1094-result-issue-command-plan-callcount.md), result-issue-command-plan)로 realdata-e2e consistency spec 전량의 positive-loose `toHaveBeenCalled()` 를 소진했다. 본 leg 30 은 T-1094 Follow-ups 의 지시(잔여 positive-loose 실제 0 재확인 후 남으면 leg 30)에 따라 **test 트리 전체를 재-grep** 한 결과 확정한 **마지막 tree-wide 잔여 1건**을 tighten 해 sweep 축을 완전히 마감한다.

planner pre-check(정밀 grep, 2026-07-18, origin/main):
- realdata consistency spec 55개 전량 positive-loose = **0** (`.not.` 제외, leg 28~29 로 소진 완료).
- test/ 전체 재-grep 결과 잔여 positive-loose 는 `test/perf/app-root-read.perf-spec.ts:145` 단 **1건** 뿐.

이 1건은 `AppController` 의 health/sanity read(`GET /api` → `getRoot` → `appService.getStatus()` 고정 문자열 200 반환, REQ-048 조회 perf 배선 floor case) happy-path test(L137~146)에 있다. 해당 test 는 `request(app.getHttpServer()).get("/api")` 를 **1회** 호출하고, `getRoot` 는 `getStatus` 를 **정확히 1회** 호출한 뒤 loose `expect(service.getStatus).toHaveBeenCalled()`(L145)를 남긴다. describe 블록의 `beforeEach(() => jest.clearAllMocks())`(L97~98)로 각 test 진입 시 mock 이 초기화되고 본 test 는 단일 request 만 발화하므로, 도달한 호출 횟수는 **exact 1** 이 정확 횟수다.

loose `toHaveBeenCalled()` 는 ≥ 1 만 보장하므로, `getRoot` 가 향후 리팩터링에서 `getStatus` 를 **중복 호출(2회 이상)** 하는 회귀가 발생해도 잡지 못한다. 이 1건을 `toHaveBeenCalledTimes(1)` 로 못박아 **중복 재호출 회귀를 차단**하고, 이로써 **test 트리 전량의 positive-loose call-count 를 0 으로 소진**해 sweep 축을 tree-wide 로 마감한다. test-only 1파일, production `src`·helper `.ts` 로직 무변경.

## Required Reading

- `test/perf/app-root-read.perf-spec.ts` — 수정 대상 spec(신규 파일 아님). **happy-path describe 의 "getStatus 실호출 확인" test(L137~146) 1건만 수정**: L145 의 `expect(service.getStatus).toHaveBeenCalled()` loose assert 1건을 정확 횟수 `expect(service.getStatus).toHaveBeenCalledTimes(1)` 로 tighten. 해당 test 가 `request(...).get("/api")` 를 **1회만** 호출하고(L138), `beforeEach(() => jest.clearAllMocks())`(L97~98)로 mock 이 test 별 초기화됨을 코드로 재확인해 exact N=1 확정. `service.getStatus` 는 `useValue` mock(`jest.fn()`, L78, `beforeEach` 에서 `mockReturnValue("Assessment-Agent")` L100)이므로 신규 spy 인프라 신설 불요. **광범위 read 금지 — happy-path getStatus 확인 test(L137~146)와 setup(L76~100) 만.**
- `src/app.controller.ts` — `getRoot` 핸들러가 `appService.getStatus()` 를 **정확히 1회** 호출해 그 반환 문자열을 200 으로 forward 함(예외 경로·분기 없음)을 코드로 확인해, 단일 request 당 exact 1 임을 확정. **광범위 read 금지 — getRoot 핸들러 본문만.**
- `docs/tasks/T-1094-result-issue-command-plan-callcount.md` — 직전 leg 29(동일 §D 후보 (b) 축, sweep 의 realdata consistency 마지막 leg). 본 leg 30 은 동일 패턴(loose call-count 를 exactly-N 으로 tighten, 중복 재호출 회귀 방지)을 tree-wide 마지막 1건(perf-spec)에 적용하는 마감 leg. 단 대상 spec 이 realdata consistency 가 아니라 perf-spec 이고, 대상이 값-drift 경계가 아니라 **happy-path 단일 호출 exact-1** 인 점이 차이.

## Acceptance Criteria

본 task 는 `commitMode: pr` test-only leg 이므로 R-112 test 4종 + coverage 를 아래에 매핑한다(production 신규 symbol 0 — 검증 대상은 tighten 하는 call-count 완결성 assert 자체).

- [ ] **happy-path — getStatus 정확 호출 횟수(핵심)**: L145 의 loose `expect(service.getStatus).toHaveBeenCalled()` 를 **정확 횟수 `expect(service.getStatus).toHaveBeenCalledTimes(1)`** 으로 tighten. 단일 request 1회 × `getRoot` 의 `getStatus` 1회 재호출 = exact 1 — 코드(`src/app.controller.ts` getRoot 본문 + `beforeEach` clearAllMocks)로 실제 호출 횟수를 재확인해 정확 N=1 을 확정. 중복 호출(getStatus ≥ 2회 for 1-request) 회귀가 발생하면 이 assert 가 fail 하도록 못박는다.
- [ ] **error path 무회귀**: error path describe("요청 wrapper 가 인위 non-2xx 반환", L149~)의 기존 assert(500/503 주입 → failures 분류, assertS2Threshold pass===false)는 손대지 않고 무회귀 통과 확인. `getRoot` 자체는 예외 경로가 없어(항상 200) collector 실패 분기는 요청 wrapper 레벨 non-2xx 주입으로 이미 커버됨 — 본 leg 는 이 구조를 유지.
- [ ] **flow/branch cover**: 본 leg 는 happy-path 단일 호출 경로의 call-count 를 exact-1 로 못박는 것으로, 새 분기를 추가하지 않는다(getRoot 는 분기 없는 순수 forward). "분기 없음 — 이 항목은 기존 happy/error describe 무회귀 유지로 충족".
- [ ] **negative cases 충분 cover**: getStatus 중복 호출(1-request 당 2회 이상) 회귀 방지 의도를 해당 assert 위 comment 에 명시해 exactly-N 완결성의 negative-회귀 성격을 문서화. 기존 error path describe 의 non-2xx negative 커버(500/503 주입, N회 failures)는 손대지 않고 유지.
- [ ] **coverage 유지**: `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 본 leg 는 assert tighten 만이라 커버리지 하락 없어야 함(src 0 LOC 변경).
- [ ] **재현 grep 갱신 확인**: `grep -E 'expect\([^)]*\)\.toHaveBeenCalled\(\)' test/perf/app-root-read.perf-spec.ts | grep -v '\.not\.' | wc -l` 값이 기존(1)에서 **0** 으로 감소(positive loose 제거)하고, 해당 test 에 `toHaveBeenCalledTimes(1)` exact assert 가 존재. 추가로 **tree-wide 마감 확인**: `grep -rlE 'expect\([^)]*\)\.toHaveBeenCalled\(\)' test/` 결과에서 `.not.` 제외 positive-loose 를 가진 파일이 **0** 임을 확인(본 leg 로 test 트리 전량 소진).
- [ ] **perf-spec 실행 확인**: 본 spec 은 `jest-perf.json`(`testRegex: test/perf/.*\.perf-spec\.ts$`)에 매칭돼 `pnpm test:perf` 로 실행됨(기본 `pnpm test` 는 `.spec.ts$` 만 매칭 → picking 0). tester 는 `pnpm test:perf` 로 본 spec 무회귀 통과를 확인.
- [ ] **test-only 확인**: `src/`·`prisma/`·helper `.ts`(production 로직) diff 0. 오직 대상 perf-spec 1파일만 변경(≤300 LOC diff / 1파일, 실제 ~2~3 LOC).
- [ ] **CI green**: `pnpm lint && pnpm build && pnpm test` 및 CI 의 unit/smoke/e2e/perf 전량 통과, suites 무회귀.

## Out of Scope

- 다른 spec 의 call-count tighten — 본 leg 30 은 app-root-read perf-spec **1개** 만. 이로써 test 트리 전량의 positive-loose call-count 가 소진되므로(realdata consistency 는 leg 28~29 로, tree-wide 잔여는 본 leg 로), sweep 축을 마감한다. 다음 방향은 Follow-ups 참조.
- `AppController.getRoot`·`AppService.getStatus`·`APP_STATUS_MESSAGE` 상수 자체 로직·값 변경 — 코드 무변경, perf-spec assert tighten 만.
- error path describe(non-2xx 주입, L149~)·happy-path collector 배선 test(L122~135)의 기존 assert 수정 — 이미 완결, 손대지 않음.
- `.not.toHaveBeenCalled()`(exact-0 negative) assert 수정 — 이미 exact 이므로 대상 아님(본 spec 엔 해당 없음).
- 새 describe 블록·새 test·새 perf endpoint 배선 신설 — 기존 happy-path test 의 loose assert 1건을 exact 로 tighten 만(구조 확장 아님). 필요 시 중복-호출 회귀 의도 comment 만 추가.
- `docs/architecture/*`·ADR 신설, `docs/PLAN.md`·`docs/STATE.json` phase/bullet 변경 — 본 task 범위 밖(driver/planner 소관).

## Suggested Sub-agents

`implementer → tester`. architect 불요(신규 결정 없음 — T-1065 §D 후보 (b) 완결성 축의 마감 leg, 기존 `useValue` mock 재사용, happy-path loose call-count 1건을 exactly-N=1 으로 tighten). tester 는 R-112 test 4종 + coverage 무회귀 + happy-path getStatus 정확 호출 횟수(getRoot 코드로 실제 N=1 확정) tighten + 중복 호출 회귀 방지 의도 검증 + error path 기존 assert 무회귀 + 정밀 grep(대상 spec positive loose = 0, test 트리 전량 positive loose = 0) 확인 + `pnpm test:perf` 실행 확인.

## Follow-ups

- (call-count 완결성 축 마감 — tree-wide) 본 leg 30 으로 **test 트리 전량**의 positive-loose `toHaveBeenCalled()` 가 소진될 전망(2026-07-18 정밀 pre-check 기준, realdata consistency 55개 = 0 + tree-wide 잔여 = 본 perf-spec 1건이 마지막). 후속 planner 는 tighten 완료 후 `grep -rlE 'expect\([^)]*\)\.toHaveBeenCalled\(\)' test/ | (positive filter)` 로 트리 전량 positive-loose 가 실제 0 인지 재확인하고, 남으면 leg 31 로, 없으면 **T-1065 §D 후보 (c) e2e 흐름 커버리지 확장**(각 step seam 의 정합 chain 이 실제 e2e 흐름에서 호출됨을 커버)으로 전환한다. sweep 축(§D 후보 (b) call-count 완결성)은 본 leg 로 마감.
