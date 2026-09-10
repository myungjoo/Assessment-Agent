---
id: T-2017
title: REQ-045 재판정 + REQ-046 · REQ-073 drift 정정 — 인원 · 그룹 · 파트 편집 route 미보호 실측 반영
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-045, REQ-046, REQ-073]
estimatedDiff: 60
estimatedFiles: 1
created: 2026-09-10
independentStream: req-rbac-readjudication
dependsOn: [T-1989]
touchesFiles: [docs/requirements.md]
plannerNote: P5 · REQ-045 미판정(T-1980~T-1989 이월분 1 회) + REQ-046/073 DONE 이 미보호 20 route 와 모순, direct 1 파일
---

# T-2017 — REQ-045 재판정 + REQ-046 · REQ-073 drift 정정 (인원 · 그룹 · 파트 편집 route 미보호 실측 반영)

## Why

README `85 행` 은 "Admin 은 평가 자료 재작성, Reset, Import/Export, 인원 편집, 인원 Group/파트 편집 등을 할 수 있다" 이고, `86 행` 은 "User 등급은 Read-only 활동만 할 수 있다" 이다. `168 행` 도 "편집은 Admin 등급만 수행할 수 있고 User 등급은 조회만 가능하다" 고 적는다. 이 세 행에 대응하는 요구표 3 행이 실측과 어긋나 있다.

- [requirements.md](../requirements.md) `64 행` **REQ-045** 는 상태 칸이 맨 `IN_PROGRESS` 뿐이다. 근거 문장이 한 번도 적힌 적이 없다. 그런데 이 REQ 를 `coversReq` 로 가진 e2e 계약 slice 4 건(T-1980 · T-1981 · T-1982 · T-1989)이 모두 머지됐다. 이 4 건은 모두 Out of Scope 에 "REQ status 재판정 — 머지 후 1 회로 이월" 을 적었다. 본 task 가 그 이월분 1 회다(CLAUDE.md §3.1 once-rule).
- `65 행` **REQ-046** 은 상태 칸이 맨 `DONE` 이다. 근거 문장이 없다.
- `92 행` **REQ-073** 은 `DONE` 이다. 셀은 "실 차단의 정본은 이 guard 다" 라고 적는다. 그런데 근거로 드는 guard 는 `collection-target.controller.ts`(평가 대상 **시스템**) 뿐이다. README `166 행` 의 평가 대상 **인원** 쪽은 셀에 한 번도 나오지 않는다.

**핵심 실측 (origin/main `0bff79a9`, 전부 재현 가능)** — 인원 · 그룹 · 파트 편집 route 는 인증 guard 가 **0** 이다.

- `src/user/person.controller.ts` · `src/user/group.controller.ts` · `src/user/part.controller.ts` 3 파일에서 `UseGuards` · `@Roles` 는 **0 hit** 이다. `@Controller("api/persons")`(`44 행`)의 5 route, `@Controller("api/groups")`(`79 행`)의 9 route, `@Controller("api/parts")`(`50 행`)의 6 route, 합계 20 route 가 전부 무인증이다. 이 20 route 에는 `POST` · `PATCH` · `DELETE` 편집 route 가 포함된다.
- 파일 주석이 이것을 미완으로 자인한다. person `20 행`, group `51 행`, part `28 행` 에 "AuthGuard (Admin+ / User+) 적용 안 함 — 후속 task 책임" 이 있다.
- 계약 문서 [api.md](../architecture/api.md) `80~97 행` 은 같은 route 들을 `Admin+`(편집) / `User+`(조회) 로 명시한다. 계약과 구현이 어긋나 있다.
- [route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) `122~125 행` 은 이 20 route 를 `known-gap-REQ-043` 부채로 정확히 센다(`KNOWN_GAP_REQ_043.length` = 20).
- [persons](../../test/e2e/persons.e2e-spec.ts) · [groups](../../test/e2e/groups.e2e-spec.ts) · [parts](../../test/e2e/parts.e2e-spec.ts) e2e 3 파일에서 `cookie` · `Cookie` · `loginAs` 는 **0 hit** 이고 `403` 도 0 hit 이다. 즉 e2e 는 무인증 편집 요청이 성공하는 현 상태를 잠그고 있다. 반면 다른 e2e 32 파일은 `403` 단언을 가진다(예: `collection-targets.e2e-spec.ts` 10).
- 요구표 최신 commit 은 `fbc41cba`(T-2016, REQ-004 행만 수정)다. 세 행 중 어느 것도 이 사실을 반영하지 않는다. `STATE.currentTask` · `nextTask` 도 모두 null 이라 이 3 행을 건드리는 진행 중 task 는 없다.

**once-rule 정합** — REQ-045 는 "구현 slice 머지 후 REQ 당 1 회" 규칙에 따른 재판정이다. REQ-046 · REQ-073 은 규칙의 예외 "구현 arc 와 무관한 status drift 정정" 에 해당한다. 새 구현 arc 가 없다. 이미 DONE 으로 적힌 칸이 저장소 실측과 모순된다. 세 행의 근거가 같은 20 route 라서 한 task 로 묶는다. 따로 나누면 같은 실측을 세 번 반복하게 된다(PLAN `183 행` 오너 지시의 왕복 제거 취지).

**status 는 미리 정하지 않는다.** 아래 AC 의 축별 실측이 결정한다. 다만 판정 원칙은 하나로 고정한다. REQ-073 셀 스스로 "실 차단의 정본은 backend guard" 라고 적었다. 그러므로 세 행 모두 web 층 gating 만으로는 "Admin 만 편집 가능" · "User 는 read-only" 를 충족한 것으로 보지 않는다.

**본 task 가 guard 를 붙이지 않는 이유** — 20 route 에 guard 를 배선하는 일은 T-1983 · T-1984 가 CLAUDE.md `§5` 인증 변경(오너 승인 대상)으로 분류했다. 본 task 는 그 분류를 바꾸지 않는다. 사실을 요구표에 옮겨 적고, IN_PROGRESS 잔여를 이름과 좌표로 특정하는 데까지만 한다. 오너 결정 요청은 `## Follow-ups` (a) 에 적는다.

**cap 근거** — 1 파일에서 기존 3 행만 셀 단위로 교체한다(doc-only enumerated-section × 1.6 × inline-amend × 0.4 = × 0.64, base ~95 LOC → 약 60 LOC). 행 교체라서 diff 는 +3/-3 이다. helper · 소비처 신설이 0 이므로 CLAUDE.md §3 소비처 동반 의무에 걸리지 않는다.

## Required Reading

- [README.md](../../README.md) `83~86 행`(보안 특성 — ID/Password 보호 · 3 등급 · Admin 권한 목록 · User read-only), `164~168 행`(평가 대상 두 종류 + "편집은 Admin 등급만")
- [docs/requirements.md](../requirements.md) `1~19 행`(운영 룰 · 상태 enum · 7 컬럼 헤더), `62 행` REQ-043(`한계 —` 문단의 `known-gap-REQ-043` 20 route 서술은 참조만 한다 — 수정 대상 아님), `64 행` REQ-045 · `65 행` REQ-046 · `92 행` REQ-073(수정 대상 3 행)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) `20 행` · `44 행` · `67~109 행`, [src/user/group.controller.ts](../../src/user/group.controller.ts) `51 행` · `79 행` · `92~198 행`, [src/user/part.controller.ts](../../src/user/part.controller.ts) `28 행` · `50 행` · `63~131 행` — guard 부재 확인용
- [docs/architecture/api.md](../architecture/api.md) `78~97 행` — 같은 route 의 계약 tier(`Admin+` / `User+`)
- [test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts](../../test/smoke/route-auth-guard-coverage-census-drift.smoke-spec.ts) `8 행` · `30 행` · `122~125 행` — 부채 20 건의 기계 강제 좌표
- Admin 전용 축의 실 근거(REQ-045 판정용, `@Roles("Admin")` 좌표와 e2e 403 단언을 1 건씩 재현 확인): [export.controller.ts](../../src/export/export.controller.ts) · [import.controller.ts](../../src/import/import.controller.ts) · [assessment-evaluation.controller.ts](../../src/assessment-evaluation/assessment-evaluation.controller.ts)(재작성 · reset · fill-run) · [recent-deletion.controller.ts](../../src/scheduling/recent-deletion.controller.ts), e2e 는 `test/e2e/assessment-evaluation-reset.e2e-spec.ts` · `export-download.e2e-spec.ts` · `import-restore-rejection.e2e-spec.ts` · `period-bridge-reevaluate.e2e-spec.ts`
- [docs/tasks/T-1983-route-auth-guard-coverage-census-smoke.md](T-1983-route-auth-guard-coverage-census-smoke.md) `26 행` · `31 행` · `59 행` — §5 분류 출처
- [docs/tasks/T-2016-req004-period-window-arc-readjudication.md](T-2016-req004-period-window-arc-readjudication.md) — 직전 재판정의 셀 작성 형식(축 나열 · add-only · 좌표 재현)

## Acceptance Criteria

**공통 · 구조 보존**

- [ ] [docs/requirements.md](../requirements.md) 의 `64 행` · `65 행` · `92 행` **3 행만** 수정한다. `git diff -U0 docs/requirements.md` 의 hunk 가 이 3 행에만 걸린다(다른 REQ 행 · 헤더 · 운영 룰 무접촉).
- [ ] 표 구조를 보존한다. 수정 후 `grep -c '^| REQ-' docs/requirements.md` = **84** 이고 `wc -l < docs/requirements.md` = **121**(수정 전과 동일)이다. 3 행 각각 `sed -n '<n>p' docs/requirements.md | tr -cd '|' | wc -c` = **8** 이다. 셀 본문에 `|` 문자를 새로 넣지 않는다.
- [ ] 적는 모든 좌표는 `sed -n '<n>p' <file>` 로 1 건씩 재현 확인한다. 재현되지 않는 좌표는 적지 않는다. 수치(route 수 · hit 수 · it 수)는 이 task 파일의 값을 옮기지 말고 실행 시점에 다시 센다. 실측이 이 파일의 값과 다르면 실측을 적고 차이를 `## Follow-ups` 에 남긴다.

**REQ-045 (`64 행`, once-rule 재판정)**

- [ ] README `85 행` 의 Admin 권한 6 축(재작성 · Reset · Import/Export · 인원 편집 · 인원 Group/파트 편집)을 축별로 나눠 적는다. 축마다 ① Admin 이 수행하는 backend route 와 `@Roles` 좌표, ② User 등급 · 무인증 요청이 거부되는지와 그 e2e 단언 좌표(403 / 401)를 적는다.
- [ ] **인원 편집 · 인원 Group/파트 편집 2 축은 guard 0 실측을 그대로 적는다** — 20 route 무인증, 파일 주석 자인 좌표 3 곳, api.md `Admin+` 계약과의 불일치, census `known-gap-REQ-043` 20 건 좌표.
- [ ] status 를 `IN_PROGRESS` 유지 / `DONE` 승격 중 하나로 고르고 사유를 같은 셀에 적는다. 유지 시 잔여 축을 **1 개** 로 이름과 좌표를 특정한다(예: "인원 · 그룹 · 파트 20 route 의 `Admin+` / `User+` guard 배선 — CLAUDE.md `§5` 오너 승인 대기"). "일부 미흡" 같은 모호한 표현은 쓰지 않는다. 회차 표기는 "T-1980 · T-1981 · T-1982 · T-1989 머지 후 1 회" 로 한다.

**REQ-046 (`65 행`, drift 정정)**

- [ ] 맨 `DONE` 칸에 근거를 붙인다. 적을 내용은 두 가지다. ① User 등급의 조회 · 정렬 · 필터가 동작하는 좌표, ② 쓰기 route 거부 여부. 쓰기 route 거부는 guard 가 있는 도메인(e2e 403 단언 좌표)과 guard 가 없는 인원 · 그룹 · 파트 20 route 로 나눠 적는다.
- [ ] **판정 원칙 적용** — web `isAdmin` gating 은 화면에서 컨트롤을 숨길 뿐이다. User 등급 cookie(또는 무인증) 요청이 인원 · 그룹 · 파트 편집에 성공하는 한 "User 는 read-only" 가 backend 에서 강제되지 않는다. 이 사실을 근거로 status 를 다시 판정한다. `DONE` 을 유지하려면 README `86 행` 을 web 표면 한정으로 해석해도 되는 근거를 1 문장 이상 적어야 한다. 그 근거가 REQ-073 셀의 "실 차단의 정본은 backend guard" 원칙과 충돌하지 않음도 함께 보인다. 근거를 대지 못하면 `IN_PROGRESS` 로 내리고 잔여 1 개를 특정한다(REQ-045 잔여와 같은 축이면 "REQ-045 잔여와 동일" 로 연결).

**REQ-073 (`92 행`, drift 정정)**

- [ ] 기존 서술(층 ① collection-target `@Roles` 분리 · 층 ② web `isAdmin` gating · e2e `242` · `251` · `262` · `272 행`)은 **삭제하지 않고 보존** 한다. 그 뒤에 README `166 행` 평가 대상 **인원** 축이 셀에서 누락됐다는 사실을 추가한다. 추가할 사실은 `api/persons` 5 route guard 0, persons e2e 의 cookie · 403 0 hit 이다.
- [ ] 셀 스스로 적은 "실 차단의 정본은 이 guard 다" 원칙에 따라 status 를 다시 판정하고 사유를 적는다. `DONE` 을 유지하려면 인원 축이 REQ-073 범위 밖이라는 근거(README `164~168 행` 해석)를 적어야 한다. 그렇지 않으면 `IN_PROGRESS` 로 내리고 잔여 1 개를 특정한다.
- [ ] 세 행이 같은 잔여를 가리키면 표현을 통일한다. 다른 행에서 같은 좌표를 반복하지 말고 REQ-045 셀을 정본으로 가리킨다.

**R-110 / R-112**

- [ ] 본 task 는 `direct` **doc-only** 다. `src/` · `web/` · `test/` · `prisma/` 변경이 0 이므로 tester 호출과 R-112 4 축(happy-path / error path / 분기별 / 예외 분기마다 negative)이 **면제** 다. 그 사유를 commit body 에 1 줄 적고, 위 grep · sed 기계 검증으로 대신한다.
- [ ] `git diff --stat` 이 정확히 `docs/requirements.md` 1 파일이다. task 파일 `status: DONE` 플립만 추가로 허용한다(direct 1-commit).

## Out of Scope

- **guard 실 배선** — person · group · part 20 route 에 `@UseGuards` · `@Roles` 를 붙이는 일은 하지 않는다. CLAUDE.md `§5` 인증 변경이고 T-1983 · T-1984 가 오너 승인 대상으로 분류했다. 코드 · e2e · census allowlist 도 건드리지 않는다.
- REQ-043(`62 행`) 수정. 적용률 축 서술은 T-1984 가 이미 정정했다. 본 task 는 참조만 한다.
- REQ-002 · REQ-047 · REQ-048 등 다른 IN_PROGRESS 행.
- [api.md](../architecture/api.md) · [PLAN.md](../PLAN.md) · UC 문서 · `REQ-COVERAGE-AUDIT.md` 무접촉.
- T-2016 `## Follow-ups` (a) modules.md 그래프 edge 누락 · (b) REQ-004 셀 / UC-09 stale 좌표 일괄 갱신은 별개 slice 다.

## Suggested Sub-agents

`implementer` (doc 편집 + grep · sed 기계 검증). tester 는 direct doc-only 라 면제.

## Follow-ups

- (a) **오너 결정 필요 — 인원 · 그룹 · 파트 20 route guard 배선** (planner 기록) — `api/persons` 5 · `api/groups` 9 · `api/parts` 6 route 가 무인증으로 편집까지 열려 있다. [api.md](../architecture/api.md) `80~97 행` 계약(`Admin+` / `User+`)과 README `83 행` · `85 행` · `168 행` 을 위반한다. 배선 자체는 기존 `JwtAuthGuard` + `RolesGuard` + `@Roles` 재사용이다. 새 인증 방식도 새 dependency 도 아니다. 하지만 T-1983 · T-1984 가 CLAUDE.md `§5` 인증 변경으로 분류했으므로 `humanQuestion` 으로 오너 승인을 받아야 착수할 수 있다. 승인이 나면 controller 별 slice 로 나눈다. 각 slice 는 controller 1 개 + 그 controller spec + e2e 1 파일(무인증 요청에 cookie 추가 · 401 / 403 단언 신설) + census `known-gap-REQ-043` allowlist 축소를 함께 가져간다(5 파일 cap 안). 이 흐름은 persons → groups → parts 순서로 진행한다.
