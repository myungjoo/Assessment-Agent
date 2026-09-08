---
id: T-1969
title: REQ-039 · REQ-040 상태 칸 근거 공백 정정 — cron 스케줄 unit·e2e 좌표 doc-sync (once-rule REQ 당 1 회)
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-039, REQ-040]
estimatedDiff: 24
estimatedFiles: 1
created: 2026-09-08
independentStream: req039-req040-e2e-readjudication
dependsOn: [T-1968]
touchesFiles: [docs/requirements.md]
plannerNote: P7 REQ-039/040 — T-1968 e2e 머지 후, 검증 위치만 선언하고 좌표가 0 이던 두 상태 칸에 실 근거를 1 회 박제
---

# T-1969 — REQ-039 · REQ-040 상태 칸 근거 공백 정정 (cron 스케줄 unit·e2e 좌표 doc-sync)

## Why

`docs/requirements.md` `58 행` REQ-039 와 `59 행` REQ-040 은 검증 위치 열에 각각 `unit + e2e` · `e2e` 를 **선언만** 하고, 상태 칸에는 spec 파일 · 구현 심볼 좌표가 **하나도 없다**. 인접 REQ 행들(`60 행` REQ-041 은 T-1964 가, `69 행` 계열은 T-1962 가 각각 `implemented-on-main` 좌표를 박제)의 관례와 어긋나고, 두 행이 선언한 **e2e 축은 T-1968 머지 전까지 실제로 거짓**(참조 0)이었다. 지금 그 근거가 main 에 생겼으므로 선언과 실측을 일치시키는 시점이다. 두 REQ 는 **같은 구현·같은 spec(T-1968)** 이 동시에 닫으므로 각 REQ 의 "1 회" 를 동시에 소진하는 것이 PLAN `183 행`(재판정 왕복 제거) 의 취지에 맞다.

**issue-still-relevant pre-check (origin/main `3fcda201` 실측)** — ① `git grep -c "schedules" origin/main -- test/e2e/schedules-cron.e2e-spec.ts` → **9 hit** (파일 실재, T-1968 · PR #1544 → main `92726756`). 머지 전 같은 파일이 부재였으므로 근거가 새로 안착했다. ② `git grep -c "\bit(\|it\.each" origin/main -- test/e2e/schedules-cron.e2e-spec.ts` → **10 hit** (`describe` 1). ③ `sed -n '58,59p' docs/requirements.md | grep -c 'src/scheduling\|test/e2e'` → **0** — 두 행 상태 칸에 좌표 문자열이 아직 0 이라 정정 대상이 실재한다. ④ `grep -l 'REQ-039\|REQ-040' docs/tasks/*.md` 의 모든 매치 task 가 `status: DONE` — **非-DONE 중복 큐잉 0**. ⑤ `ls docs/tasks | grep -c 'T-1969'` → **0** (ID 미사용).

**오너 게이트 판정** — PLAN `157 행`(R-91 k6 최우선): `package.json` · `.github/workflows/` · `test/load/` 무변경이라 자원 경합 0. PLAN `158 행`(per-route perf baseline churn 중단): `test/perf/*` 무접촉이라 비해당. PLAN `182 행`(소비처 동반 의무): helper · factory · 어댑터 신설 0 인 doc-only slice 라 비해당. PLAN `183 행`(AdminView 부채 / 재판정 once-rule): `web/` 무접촉이고, 본 task 는 구현·계약 slice T-1968 이 **머지된 뒤** 수행하는 REQ 당 **1 회** 재판정이며 T-1968 이 Out of Scope 에 "머지 후 별도 direct task 로 1 회만" 으로 이 시점을 예약해 두었다 — 규칙 준수.

## Required Reading

- `docs/requirements.md` `58 행` · `59 행` — REQ-039 · REQ-040 행 전체(정정 대상). `60 행` REQ-041(T-1964 결과)의 `implemented-on-main` 서술 관례를 그대로 승계할 것.
- `test/e2e/schedules-cron.e2e-spec.ts` `79 행` describe 1 개와 그 아래 `148` · `165` · `177` · `190` · `201` · `210` · `220` · `227 행` it + `255 행` · `282 행` `it.each` — 각 it 이 무엇을 잠그는지 직접 읽고 셀 것.
- `src/scheduling/cron-schedule.controller.ts` `72 행`(controller-scope ValidationPipe) · `90 행`(`@Get()`) · `103 행`(`@Put()` + `@HttpCode(200)`) · `120 행`(`@Delete(":name")` + `@HttpCode(204)`) · `140 행`(`@Post("trigger")` + `@HttpCode(202)`) · 각 route 의 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
- `src/scheduling/cron-schedule.service.ts` `1 행` ~ `45 행` — `SchedulerRegistry` 위 얇은 wrapper(정적 `@Cron` 아닌 **동적 registry**, 즉 in-memory) 라는 사실.
- `src/scheduling/scheduling.module.ts` `32 행` ~ `40 행` — `CRON_TICK_HANDLER` 기본 provider 가 **logging stub** 이라는 사실(실 평가 pipeline 결선 미배선) + controller 등록 배선.
- unit 축 계수 대상 — `src/scheduling/cron-schedule.controller.spec.ts` · `src/scheduling/cron-schedule.service.spec.ts`.
- `docs/tasks/T-1968-cron-schedule-e2e-contract.md` — 머지된 e2e 축의 계약 서술 및 Out of Scope(재판정 예약 문구).
- `docs/tasks/T-1964-req041-e2e-readjudication-doc-sync.md` — 직전 동형 doc-sync 의 서술 형식.
- `docs/PLAN.md` `183 행` — REQ 재판정 once-rule 원문.

## Acceptance Criteria

- [ ] `docs/requirements.md` **1 파일만** 수정한다. `src/` · `web/` · `test/` · `prisma/` · `.github/` · `package.json` diff **0**.
- [ ] `58 행` REQ-039 상태 칸에 **구현 좌표**를 박제한다 — 최소 `src/scheduling/cron-schedule.controller.ts`(`@Get()` 200 / `@Put()` 200 / `@Delete(":name")` 204 · Admin tier · controller-scope ValidationPipe) · `cron-schedule.service.ts`(`SchedulerRegistry` 동적 등록 wrapper) · `scheduling.module.ts`(controller 등록 + `CRON_TICK_HANDLER` provider) 3 축.
- [ ] `59 행` REQ-040 상태 칸에 **구현 좌표**를 박제한다 — `src/scheduling/cron-schedule.controller.ts` `@Post("trigger")` + `@HttpCode(202)` + Admin tier, 그리고 `scheduling.module.ts` 의 `CRON_TICK_HANDLER` 기본 provider 경유라는 사실.
- [ ] 두 행 모두에 **e2e 좌표**를 박제한다 — 파일 경로 `test/e2e/schedules-cron.e2e-spec.ts`, describe 개수와 it 개수, 그리고 무엇을 잠그는지(PUT→GET→DELETE→GET lifecycle · 동일 name 재등록 = 교체 · 0 건 GET 200 `[]` · 유효하지 않은 cron 식/공백 name 400 · 부재 name DELETE 404 · `POST trigger` 202 · ValidationPipe `it.each` · RBAC User 403 / 401 2 종 / SuperAdmin escalation). 출처로 **T-1968 · PR #1544 · main `92726756`** 를 남긴다.
- [ ] **계수는 실행 시점에 직접 재검산**한다 — `describe(` / `it(` / `it.each` 개수를 `test/e2e/schedules-cron.e2e-spec.ts` 와 unit spec 2 종에서 실제로 세어 적는다(본 task 파일의 숫자를 그대로 베끼지 말 것). unit 축도 "spec N 개 · it M 개" 형태로 계수를 남긴다.
- [ ] 검증 위치 열(REQ-039 `unit + e2e` · REQ-040 `e2e`)은 **값 변경 없이 유지**한다 — 두 축 모두 실 근거가 생겼으므로 근거만 채운다.
- [ ] 상태 값 `DONE` 도 **두 행 모두 유지**한다 — 본 task 는 승격·강등이 아니라 근거 박제다. 아래 한계 명시로 DONE 의 범위를 좁혀 적을 것.
- [ ] 남은 **한계**를 REQ 당 최소 1 개 명시한다 — REQ-039: cron registry 가 `SchedulerRegistry` **in-memory** 라 프로세스 재기동 시 등록이 소실된다(영속 저장 미배선). REQ-040: `CRON_TICK_HANDLER` 기본 provider 가 **logging stub** 이라 202 는 수락만 고정하고 실 평가 pipeline 발화는 미검증. 실측으로 더 확인되면 추가한다.
- [ ] 표 구조 무결성 — 두 행이 각각 여전히 `| REQ-039 | 72 | … |` · `| REQ-040 | 73 | … |` 형태의 **단일 행 7 칸**이고 개행이 끼어들지 않는다(`grep -c "^| REQ-039 |" docs/requirements.md` → **1**, REQ-040 도 **1**).
- [ ] 문서 본문은 한국어, 행 범위 표기는 CLAUDE.md §12 규약(`58 행`, `~` 구분자, `L` prefix 금지)을 따른다.
- [ ] 총 diff **≤ 300 LOC / 1 파일**. R-110 · R-112 는 **direct doc-only 면제**(production 코드 · test 변경 0 이라 happy / error / 분기 / negative 4 축과 coverage 게이트의 적용 대상이 아니다). 소비처 동반 의무(CLAUDE.md §3)도 helper 신설 0 이라 비해당.

## Out of Scope

- REQ-039 · REQ-040 **외** 다른 REQ 행의 status · 서술 수정 — 특히 T-1967 이 예약한 **REQ-051 재판정은 별도 task** 다(끼워 넣으면 그 REQ 의 1 회를 여기서 소모한다).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` REQ-039 / REQ-040 row 및 audit 계수 재산출.
- `docs/architecture/api.md` 의 `/api/schedules` route 행 갱신 · `docs/PLAN.md` `157 행` 이하 bullet 재서술.
- `src/scheduling/` 동작 변경 — 특히 cron registry 영속화, `CRON_TICK_HANDLER` 실 평가 pipeline 결선은 각각 별도 pr task(전자는 schema 게이트, 후자는 ADR 범위 확인 동반).
- `test/e2e/schedules-cron.e2e-spec.ts` 케이스 추가 · 수정.
- `test/perf/*` · `test/load/*` · `.github/workflows/` 변경 (PLAN `157 행` · `158 행` 오너 게이트).
- `web/` · AdminView 관련 변경 (PLAN `183 행`).

## Suggested Sub-agents

`implementer` (doc-only 단일 파일 편집 — direct commit 이므로 tester 면제, R-110 doc-only 예외)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
