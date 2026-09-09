---
id: T-1987
title: route census 스캐너 본체(censusRoutes) 공통 helper 로 통합 + 두 census smoke spec 동시 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-061]
estimatedDiff: 300
estimatedFiles: 4
sizeExempt: true
exemptReason: pure-extraction — 두 spec 의 동일 스캐너 루프를 helper 로 이동, 신규 로직은 반환 레코드의 필드 합집합 1 건뿐(각 필드 계산식은 원본에서 verbatim)
dependsOn: [T-1986]
touchesFiles:
  [
    test/helpers/route-census.ts,
    test/helpers/route-census.spec.ts,
    test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts,
    test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts,
  ]
independentStream: route-census-shared-helper
created: 2026-09-08
plannerNote: P5 · T-1986 이 Out of Scope 로 이월한 마지막 중복 — 스캐너 본체 44/59 행이 아직 두 census 에 복제돼 route 모수가 갈릴 수 있다
---

# T-1987 — route census 스캐너 본체(censusRoutes) 공통 helper 로 통합 + 두 census smoke spec 동시 배선

## Why

[T-1986](T-1986-route-census-shared-tokenizer-helper.md) 이 정규식 4 종 · `stripComments` · `findFiles` · `extractControllerPrefix` 를 [test/helpers/route-census.ts](../../test/helpers/route-census.ts) 로 뽑았지만, **route 모수를 실제로 세는 스캐너 본체 `censusRoutes` 는 통합 대상에서 제외**했다 (같은 파일 `9~10 행` 주석 + T-1986 `## Out of Scope` 첫 항목 — "반환 타입부터 달라 API 설계가 필요한 별도 slice"). 그 결과 T-1983(guard 적용률 축 · REQ-043) 과 T-1985(e2e 왕복 커버리지 축 · PLAN `166 행`) 이 **route 89 개라는 같은 모수를 각자 복제된 루프로 따로 센다** — 스캐너 결함 1 건 (예: T-1985 reviewer 가 남긴 정규식 관대함) 을 한쪽에서만 고치면 두 census 의 분모가 조용히 갈리고, "미보호 집합 정확 일치" · "미커버 집합 정확 일치" 두 계약이 서로 다른 모수 위에서 성립하게 된다. 본 task 는 그 마지막 중복을 닫아 T-1986 이 시작한 단일 출처화를 완결한다. 반환 타입 상이 문제는 **필드 합집합 레코드 1 종**으로 해소한다 (아래 §Acceptance Criteria 1).

issue-still-relevant pre-check (origin/main `544c9d63`, 실측):

- `git show origin/main:test/helpers/route-census.ts | grep -c censusRoutes` → **1**, 그러나 그 1 건은 `9 행` 의 "통합 대상이 아니며 각자 자리에 남는다" 라는 **주석 문장**이고 `export function censusRoutes` 정의는 **0** (helper 의 export 는 정규식 4 종 + 함수 3 개뿐 — `19`·`23`·`27`·`31`·`38`·`52`·`67 행`). 안착 0.
- 두 스캐너 본체의 trimmed 행 비교 — guard `74~132 행`(59 행) vs e2e `52~105 행`(54 행) 에서 **동일 trimmed 행 44 개** (≈ 80%). 차이는 누적 필드뿐: guard 는 `classGuarded` + `{method, fullPath, guarded}`, e2e 는 `{prefix, suffix, label}`.
- 두 label 표기는 이미 동일 문자열이다 — guard `141 행` `` `${r.method} ${r.fullPath}` `` = e2e `98 행` `` `${match[1].toUpperCase()} /${full}` ``. 합집합 레코드가 두 소비처를 모두 만족한다는 근거.
- `docs/tasks/` 에 `T-1987` 미사용, 동일 의도 PENDING task 0.

소비처 동반 의무 (CLAUDE.md §3) — **충족**. helper 신설분과 소비처 2 개 배선을 같은 PR 에 넣는다 (T-1986 과 같은 형태).

`sizeExempt` 근거 (planner estimate-model §순수 추출 리팩터) — (a) 동작 변경 0: 이동 후에도 census 수치 (controller 23 · route 89 · guarded 64 · covered 87) 가 불변이어야 한다. (b) 신규 로직은 **반환 레코드의 필드 합집합 1 건**뿐이며 각 필드 계산식은 두 원본에서 verbatim 복사한다. (c) 기존 단언은 무접촉이고 두 smoke spec 은 import 경로만 바뀐 상태로 그대로 통과한다. 파일 수 4 ≤ 5 이라 파일 cap 은 면제 없이 지킨다.

## Required Reading

- [test/helpers/route-census.ts](../../test/helpers/route-census.ts) — 전체 `73 행`. 특히 `8~10 행`(이번에 거짓이 되는 "통합 대상이 아니다" 주석) · `27~28 행` `ROUTE_RE` · `31 행` `SLASH_RE` · `38~45 행` `stripComments` · `52~60 행` `findFiles` · `67~73 행` `extractControllerPrefix`.
- [test/helpers/route-census.spec.ts](../../test/helpers/route-census.spec.ts) — `170 행`. `42 행` top-level describe 구조와 `43`·`84`·`117`·`157 행` 4 개 하위 describe 배치 (새 describe 를 같은 층위로 append).
- [test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) — `268 행`. 이동 대상 `70 행` `RouteEntry` · `72~132 행` `censusRoutes`, 소비 지점 `135~139 행` `repoRoutes` · `141 행` `label`, 무접촉 구간 `29 행` `MIN` · `32~68 행` allowlist · `143 행` 이후 전 단언.
- [test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-e2e-coverage-census-drift.smoke-spec.ts) — `272 행`. 이동 대상 `41 행` `RouteRef` · `47~105 행` `censusRoutes`, 잔류 대상 `44~45 행` `BOUNDARY`/`esc` · `113~125 행` `isCoveredBy` · `128~136 행` `uncoveredLabels`, 소비 지점 `145~146 행` `repoRoutes`, 무접촉 구간 `31 행` `MIN` · `35~39 행` allowlist · `148 행` 이후 전 단언.
- [docs/tasks/T-1986-route-census-shared-tokenizer-helper.md](T-1986-route-census-shared-tokenizer-helper.md) — `## Out of Scope` 첫 항목(본 task 의 출처) 과 AC 표기 방식.
- [CLAUDE.md](../../CLAUDE.md) §3.2 (R-110 · R-112) · §3 (소비처 동반 의무).

## Acceptance Criteria

- [ ] `test/helpers/route-census.ts` 에 **필드 합집합 레코드 타입 1 종 + `censusRoutes` 1 개**를 export 로 추가한다. 레코드는 두 소비처가 쓰던 필드를 모두 담는다 — `method`(대문자) · `prefix`(앞뒤 `/` 정규화) · `suffix`(같은 정규화) · `fullPath`(`/` 로 시작하는 전체 경로) · `label`(`` `${method} ${fullPath}` ``) · `guarded`(클래스 레벨 `@UseGuards` 또는 해당 route decorator 블록의 `@UseGuards`). 루프 본문 · 괄호 균형 이어붙이기 · `seenClass` 판정은 기존 두 구현에서 **verbatim** 이동한다.
- [ ] 기존 throw 계약 3 종을 그대로 승계한다 — `@Controller` 부재 소스는 `@Controller decorator 부재` 메시지로 throw, non-string 입력은 `TypeError`, 없는 디렉터리는 `findFiles` 가 throw. (두 smoke spec 의 Error path 단언 `262`·`264`·`267 행` 이 이 문자열·타입에 걸려 있다.)
- [ ] 파일 상단 주석의 `8~10 행` "각 spec 의 `censusRoutes` 본체는 … 통합 대상이 아니며 각자 자리에 남는다" 문장을 현행 사실로 갱신한다 (거짓 서술 잔존 금지).
- [ ] colocated spec `test/helpers/route-census.spec.ts` 에 `censusRoutes` describe 를 append. **happy-path** — 실제 `src/**/*.controller.ts` 1 개를 read 해 route 1+ 를 뽑고 `label` 이 `METHOD /api…` 형태임을 단언 1+.
- [ ] **error path** 1+ — `censusRoutes("export class Bare {}")` → `Error` + `/@Controller decorator 부재/` 매칭, `censusRoutes(undefined as unknown as string)` → `TypeError`.
- [ ] **분기별 1+** — (a) 클래스 레벨 `@UseGuards` → 전 route `guarded: true` (b) 메서드 레벨 `@UseGuards` → 그 route 만 `true`, 형제 route 는 `false` (c) 인자 없는 `@Get()` → `fullPath` 가 prefix 자신 · `suffix` 는 빈 문자열 (d) 여러 행에 걸친 `@UsePipes(...)` 가 섞여도 route 누락·오판 0 — 각 1+.
- [ ] **negative case 를 예외 분기마다 1+** — 주석 안의 `@Get`/`@UseGuards` 예시가 route 로 오집계되지 않음 / 클래스 선언 앞의 decorator 가 첫 route 의 보호로 새지 않음 / guard 없는 route 를 하나 더하면 그 route 만 `guarded: false` 로 분류됨 / `@Controller` 부재를 route 0 개로 조용히 흡수하지 않음 — 각 1+.
- [ ] 소비처 배선 1 — guard smoke spec 이 `censusRoutes` 를 helper 에서 import 하고 자기 파일의 `RouteEntry` 타입 · `censusRoutes` 정의를 제거한다. `MIN`(`29 행`) · allowlist(`32~68 행`) · 모든 `describe`/`it` 본문은 **무접촉** (`label` helper 는 유지하거나 레코드의 `label` 필드로 치환 — 둘 다 허용, 단 단언 문자열은 불변).
- [ ] 소비처 배선 2 — e2e smoke spec 이 같은 helper 를 import 하고 자기 파일의 `RouteRef` 타입 · `censusRoutes` 정의를 제거한다. `isCoveredBy` · `uncoveredLabels` 의 매개변수 타입만 helper 레코드로 바꾸고 **본문 로직은 무접촉**. `MIN`(`31 행`) · allowlist(`35~39 행`) · 모든 단언 무접촉.
- [ ] 사용하지 않게 된 import 심볼(`SLASH_RE` · `ROUTE_RE` 등) 이 두 소비처에 남지 않는다 (`pnpm lint` 로 검증).
- [ ] `pnpm lint && pnpm build && pnpm test` green. `pnpm test:smoke` 에서 두 census suite 가 **배선 전과 같은 개수의 test 로 PASS** 하고 census 수치 (controller 23 · route 89 · guarded 64 · covered 87 · 미보호 25 · 미커버 2) 가 **불변**이다.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 0 LOC 변경이라 전역 coverage 는 불변이어야 한다.

## Out of Scope

- `isCoveredBy` · `uncoveredLabels` · `BOUNDARY` · `esc` (e2e 전용 매칭기) 의 helper 이동 — 본 slice 는 **스캐너 본체 1 개**만 옮긴다.
- T-1985 reviewer 가 남긴 매칭 정밀도 MINOR 2 건 (정적 suffix segment 인접성 · 동적 segment 정규식 관대함) 수정 — 동작 변경이라 별도 slice. 본 task 는 그 수정이 **한 곳에서만 이뤄지도록** 자리를 만드는 것까지다.
- `MIN` 하한값 · allowlist 항목 · reason 태그 조정, census 수치 재측정.
- guard 미배선 20 route 의 실 `@UseGuards` 배선 (CLAUDE.md §5 오너 승인 대상).
- `src/` · `web/` · `prisma/` · `.github/workflows/` · `package.json` · `docs/requirements.md` 변경 (PLAN `157`·`158`·`183 행` 오너 게이트 미침범 — `test/perf` · `test/load` 도 무접촉).
- `scripts/daily-test.sh` leg 추가 (Q-0054 선례 — leg 추가는 drift-guard parity spec 3 종 동반이라 cap 초과).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 적는다.)
