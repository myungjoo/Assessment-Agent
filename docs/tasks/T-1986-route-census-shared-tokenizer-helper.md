---
id: T-1986
title: route census 정적 추출 공통 helper 추출 + 두 census smoke spec 동시 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 280
estimatedFiles: 4
dependsOn: []
touchesFiles:
  [
    test/helpers/route-census.ts,
    test/helpers/route-census.spec.ts,
    test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts,
    test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts,
  ]
independentStream: route-census-shared-helper
created: 2026-09-08
plannerNote: P5 · T-1983/T-1985 census 2 종의 토크나이저가 byte-identical 로 복제됨 — 한쪽만 고치면 두 census 가 갈린다
---

# T-1986 — route census 정적 추출 공통 helper 추출 + 두 census smoke spec 동시 배선

## Why

직전 2 slice 가 census drift smoke 를 각각 세웠다 — [T-1983](T-1983-route-auth-guard-coverage-census-smoke.md) 이 guard 적용률 축(REQ-043), [T-1985](T-1985-route-e2e-coverage-census-smoke.md) 이 e2e 왕복 커버리지 축([docs/PLAN.md](../PLAN.md) `166 행`). 둘 다 `src/**/*.controller.ts` 를 **정적 추출**해 route 를 세므로 토크나이저가 같은데, 각자 자기 파일 안에 복제돼 있다. 그래서 추출기 결함 1 건을 한쪽에서만 고치면 두 census 의 route 모수가 조용히 갈리고, 그 순간 "미보호 집합 정확 일치" · "미커버 집합 정확 일치" 라는 두 계약이 서로 다른 89 를 세게 된다. T-1985 PR #1558 의 reviewer MINOR 3 건 중 "토크나이저 T-1983 과 동형 중복" 이 이 지점을 짚었고 task 가 공통 추출을 별도 slice 로 이월했다 — 본 slice 가 그 이월분이다.

**issue-still-relevant pre-check (origin/main `7d08e8da`, 본 fire 실측)**:

- 공통 helper 부재 — `git ls-tree origin/main test/helpers/` 에 `route`/`census` 이름 히트 **0**. `git grep "stripComments\|TOKEN_RE" origin/main` 히트는 위 smoke spec **2 개뿐**이고 `src/` · `scripts/` 는 0 건이라, 추출 대상이 이미 main 에 안착한 정황이 없다.
- 중복은 실측으로 확인됨 — 두 파일의 **공백 제외 동일 trimmed 행 69 개**. 그중 `findFiles` 는 [route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) `84~92 행` 과 [route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) `144~152 행` 이 **8 행 byte-identical**, 정규식 상수 4 종(`TOKEN_RE` · `CONTROLLER_RE` · `ROUTE_RE` · `SLASH_RE`)도 guard `63~69 행` 과 e2e `33~39 행` 이 순서만 다르고 내용 동일하다.
- 새 계약을 만드는 slice 가 아니라 **기존 계약 2 개의 단일 출처를 만드는** slice 다 — 두 smoke spec 의 `MIN` 하한 · allowlist · describe/it 단언은 무접촉이며 실행 결과가 바뀌면 안 된다.
- T-1986 ID 미사용 (`docs/tasks/` 최대 ID = T-1985).

**소비처 동반 의무 판정 (CLAUDE.md §3)** — 충족. 본 slice 는 helper 신설과 **소비처 2 개(두 smoke spec) 배선을 같은 PR 에 포함**한다. helper-only PR 이 아니며 cap 초과 예외를 쓰지 않는다.

## Required Reading

- [test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) `11~12 행`(fs import) · `63~69 행`(정규식 4 종) · `73~82 행`(`stripComments`) · `84~92 행`(`findFiles`) · `96~104 행`(`extractControllerPrefix`) · `106~165 행`(`censusRoutes` — **이동 대상 아님**) · `284~300 행`(Error path 단언 — 이동 후에도 그대로 green 이어야 하는 계약).
- [test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) `12~13 행` · `33~39 행`(정규식 4 종) · `49~116 행`(`censusRoutes` — 앞부분의 인라인 strip + `@Controller` prefix 추출만 helper 호출로 치환) · `144~152 행`(`findFiles`) · `273~284 행`(Error path 단언 — `/@Controller decorator 부재/` 와 `TypeError` 두 계약 보존).
- [test/jest-smoke.json](../../test/jest-smoke.json) — `rootDir: ".."` 라 smoke spec 에서 `test/helpers/` import 가 유효함을 보이는 좌표.
- [package.json](../../package.json) `jest` 블록 — `testRegex` `.*\.spec\.ts$` + `testPathIgnorePatterns` 에 `test/smoke` · `test/e2e` 만 제외 → 신설 `test/helpers/route-census.spec.ts` 는 `pnpm test`(unit) 에서 실행된다. `collectCoverageFrom` 은 `src/**` 뿐이라 helper 는 coverage 분모 밖.
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) 와 [test/helpers/db-truncate.spec.ts](../../test/helpers/db-truncate.spec.ts) — `test/helpers/` 의 helper + colocated spec 짝 관례.
- [CLAUDE.md](../../CLAUDE.md) `§3` (소비처 동반 의무) · `§3.2` (R-110 · R-112 · R-113).

## Acceptance Criteria

- [ ] `test/helpers/route-census.ts` 신설 — 두 smoke spec 이 공유하는 **정적 추출 primitive 만** export: 정규식 4 종(`TOKEN_RE` · `CONTROLLER_RE` · `ROUTE_RE` · `SLASH_RE`) · `stripComments(source)` · `findFiles(dir, suffix)` · `extractControllerPrefix(source)`. 동작 변경 0 — 기존 구현을 그대로 옮긴다.
- [ ] `extractControllerPrefix` 의 throw 메시지에 문자열 `@Controller decorator 부재` 를 유지한다 (두 smoke spec 의 Error path 가 `/@Controller decorator 부재/` 로 단언 중).
- [ ] `stripComments` 는 non-string 입력에 `TypeError` throw 를 유지한다 (e2e spec 의 `censusRoutes(undefined)` → `TypeError` 계약이 이 경로를 통해 보존돼야 한다).
- [ ] colocated spec `test/helpers/route-census.spec.ts` 신설. **happy-path** — export 된 함수 각각(`stripComments` · `findFiles` · `extractControllerPrefix`) 에 정상 입력 1+ 씩(주석 제거 + 문자열 리터럴 보존 / 실 디렉터리 재귀 수집 정렬 / prefix 앞뒤 `/` 정규화).
- [ ] **error path** 1+ 씩 — `stripComments(undefined)` → `TypeError`, `extractControllerPrefix("export class Bare {}")` → `Error` + 메시지 매칭, `findFiles(<없는 경로>, ".ts")` → throw (조용한 빈 배열 fallback 금지).
- [ ] **분기별 1+** — `stripComments` 의 (a) line 주석 (b) block 주석 (c) 문자열/템플릿 리터럴 안의 `//` 보존 (d) 개행 보존 각 1+; `extractControllerPrefix` 의 (a) 인자 있는 `@Controller("api/x")` (b) 인자 없는 `@Controller()` → 빈 prefix (c) 앞뒤 `/` 정규화 각 1+; `findFiles` 의 (a) 하위 디렉터리 재귀 (b) suffix 불일치 제외 각 1+.
- [ ] **negative case 를 예외 분기마다 1+** — 주석 안에 적힌 `@Controller` 가 prefix 로 오추출되지 않음 / 문자열 리터럴 안의 `/* */` 가 코드로 지워지지 않음 / suffix 가 파일명 중간에만 있는 파일이 수집되지 않음 / 빈 문자열 소스에서 빈 prefix 로 silent fallback 하지 않고 throw / 디렉터리를 파일로 오수집하지 않음 — 각 1+.
- [ ] 소비처 배선 1 — `test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts` 가 위 4 심볼을 helper 에서 import 하고 자기 파일의 중복 정의를 제거한다. `MIN`(`19 행`) · allowlist(`21~57 행`) · 모든 `describe`/`it` 본문은 **무접촉**.
- [ ] 소비처 배선 2 — `test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts` 가 같은 helper 를 import 하고 인라인 strip + prefix 추출을 helper 호출로 치환한다. `MIN`(`21 행`) · allowlist(`24~29 행`) · `isCoveredBy` · `uncoveredLabels` · 모든 단언은 **무접촉**.
- [ ] 사용하지 않게 된 `fs` import 심볼이 남지 않는다 (`pnpm lint` 로 검증).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:smoke` 에서 두 census suite 가 **배선 전과 같은 개수의 test 로 PASS** (census 수치가 바뀌면 안 된다).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- 두 spec 의 `censusRoutes` 본체 통합 — guard 판정용(`guarded` 플래그)과 e2e 판정용(`prefix`/`suffix`)이 반환 타입부터 다르다. 통합은 API 설계가 필요한 별도 slice 이며 본 slice 는 **동일 코드만** 옮긴다.
- `isCoveredBy` · `uncoveredLabels` · `BOUNDARY` · `esc` (e2e 전용 매칭기) 이동.
- `MIN` 하한값 · allowlist 항목 · reason 태그 조정 (census 수치 재측정은 본 slice 밖).
- `src/` · `web/` · `prisma/` · `.github/workflows/` · `package.json` 변경.
- 정규식 자체의 정밀도 개선 (T-1985 reviewer MINOR 중 "정적 suffix segment 인접성" · "동적 segment 정규식 관대") — 동작 변경이라 별도 slice.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 적는다.)
