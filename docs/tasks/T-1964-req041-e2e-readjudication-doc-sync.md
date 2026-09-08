---
id: T-1964
title: REQ-041 상태 칸 근거 공백 정정 — recent-deletion unit·e2e 좌표 doc-sync (once-rule 1 회)
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-041]
estimatedDiff: 16
estimatedFiles: 1
created: 2026-09-08
independentStream: req041-e2e-readjudication
dependsOn: [T-1963]
touchesFiles: [docs/requirements.md]
plannerNote: P7 REQ-041 — T-1963 e2e 머지 후, 검증 위치가 선언만 하고 근거가 0 이던 상태 칸에 실 좌표를 1 회 박제
---

# T-1964 — REQ-041 상태 칸 근거 공백 정정 (recent-deletion unit·e2e 좌표 doc-sync)

## Why

`docs/requirements.md` `60 행` REQ-041 은 현재 한 줄이 통째로
`| REQ-041 | 74 | Admin 최근 N일 결과 manual delete → 재수집 | FR | P7 | unit + e2e | DONE (POST /api/schedules/recent-deletion/:personId delete→재수집) |`
뿐이다. 검증 위치 열은 **`unit + e2e`** 를 선언하는데 상태 칸에는 spec 파일 · 구현 심볼 좌표가 **하나도 없어**, 인접 REQ 행들(`50 행` REQ-031 · `52 행` REQ-033 등)이 모두 `implemented-on-main` 좌표를 박제한 관례와 어긋난다. 그리고 그 선언 중 **e2e 축은 T-1963 머지 전까지 실제로 거짓**이었다(참조 0). 지금 그 근거가 생겼으므로, 선언과 실측을 한 번에 일치시키는 시점이다.

**issue-still-relevant pre-check (origin/main `c5d63ce5` 실측)** — ① `git grep -c "recent-deletion" origin/main -- test/` → **`test/e2e/schedules-recent-deletion.e2e-spec.ts` 10 hit**(T-1963, PR #1540 → main `3587309e`). 머지 전 같은 명령이 **0 hit** 이었으므로 정정 대상이 실재하고 근거도 안착했다. ② `grep -n "^| REQ-041 |" docs/requirements.md` → **1 행(`60 행`)** 이고 상태 칸에 spec 경로 문자열이 **0** — 즉 좌표 박제가 아직 안 됐다. ③ `docs/tasks/*.md` 중 `REQ-041` 을 언급하는 **非-DONE task 0 건**(T-1963 은 DONE) — 중복 큐잉 0. ④ `T-1964` ID 미사용 확인. 따라서 안착 0 · 중복 0 이 확정이다.

**오너 게이트 판정** — PLAN `157 행`(k6 부하검증 최우선): `package.json` · `.github/workflows/` · `test/load/` 무변경이라 자원 경합 0. PLAN `158 행`(per-route perf baseline churn 중단): `test/perf/*.perf-spec.ts` 무접촉이라 비해당. PLAN `182 행`(소비처 동반 의무): helper · factory · 어댑터 신설 0 인 doc-only slice 라 **비해당**. PLAN `183 행`(REQ 재판정 once-rule): 본 task 는 구현 slice T-1963 이 **머지된 뒤** 수행하는 REQ-041 당 **1 회** 재판정이고, T-1963 자신은 `docs/requirements.md` 를 건드리지 않았으며 Out of Scope 에 "머지 후 별도 direct doc-sync 1 회" 로 이 시점을 예약해 두었다 — 규칙 준수.

## Required Reading

- `docs/requirements.md` `60 행` — REQ-041 행 전체(정정 대상). 인접 `50 행`(REQ-031) · `52 행`(REQ-033)의 `implemented-on-main` 서술 관례를 그대로 승계할 것.
- `test/e2e/schedules-recent-deletion.e2e-spec.ts` — `54 행` 단일 describe + 그 아래 it 들(happy 2 · error 2 · branch 2 · negative 2 계열). 각 it 이 무엇을 잠그는지 실제로 읽고 셀 것.
- `src/scheduling/recent-deletion.controller.ts` — `@Post("recent-deletion/:personId")` · `@HttpCode(202)` · `@UseGuards(JwtAuthGuard, RolesGuard)` · `@Roles("Admin")` · controller-scope `ValidationPipe`.
- `src/scheduling/recent-deletion-runner.service.ts` `58 행` ~ `140 행` — `RecentDeletionRunResult` 3 key(`personId` / `deletedCount` / `recollected`) · `toDelete` 빈 no-op 분기 · `RECENT_DELETION_DELETER` 미주입 시 `deletedCount` 0.
- `src/scheduling/recent-deletion-window.ts` `17 행` ~ `55 행` — `DEFAULT_DAYS = 1` · `MAX_DAYS = 366` · KST 일 경계 `[start, end)`.
- `src/scheduling/scheduling.module.ts` — `RecentDeletionController` 등록 + `RecentDeletionRunnerService` provider 배선(실 deleter 미주입 사실의 근거).
- unit 축 계수 대상 4 spec — `src/scheduling/recent-deletion.controller.spec.ts` · `recent-deletion-runner.service.spec.ts` · `recent-deletion-window.spec.ts` · `recent-deletion-plan.spec.ts` · `dto/recent-deletion.dto.spec.ts`.
- `docs/tasks/T-1963-schedules-recent-deletion-e2e-contract.md` — 머지된 e2e 축의 계약 서술 및 Out of Scope(재판정 예약 문구).
- `docs/tasks/T-1962-req050-e2e-readjudication-doc-sync.md` — 직전 동형 doc-sync 의 서술 형식.
- `docs/PLAN.md` `183 행` — REQ 재판정 once-rule 원문.

## Acceptance Criteria

- [ ] `docs/requirements.md` **1 파일만** 수정한다. `src/` · `web/` · `test/` · `prisma/` · `.github/` · `package.json` diff **0**.
- [ ] `60 행` REQ-041 상태 칸에 **구현 좌표**를 박제한다 — 최소 `src/scheduling/recent-deletion.controller.ts`(route · 202 · Admin tier) · `recent-deletion-runner.service.ts`(`RecentDeletionRunResult` 3 key) · `recent-deletion-window.ts`(`DEFAULT_DAYS 1` / `MAX_DAYS 366` / KST 일 경계) · `scheduling.module.ts`(controller 등록 + provider 배선) 4 축.
- [ ] 같은 칸에 **e2e 좌표**를 박제한다 — 파일 경로 `test/e2e/schedules-recent-deletion.e2e-spec.ts`, describe 개수와 it 개수, 그리고 무엇을 잠그는지(202 + 3 key happy · `days` 명시 축 · 미존재 personId 404 · 미인증 401 · window 밖/빈 배열 시 `recollected false` no-op · ValidationPipe 400 군 · User 403 / SuperAdmin 202). 출처로 **T-1963 · PR #1540 · main `3587309e`** 를 남긴다.
- [ ] **계수는 실행 시점에 직접 재검산**한다 — `describe(` / `it(` 개수를 `test/e2e/schedules-recent-deletion.e2e-spec.ts` 와 unit spec 5 종에서 실제로 세어 적는다(본 task 파일의 서술을 그대로 베끼지 말 것). unit 축도 "spec N 개 · it M 개" 형태로 계수를 남긴다.
- [ ] 검증 위치 열 `unit + e2e` 는 **유지**한다 — 이제 두 축 모두 실 근거가 생겼으므로 값 변경 없이 근거만 채운다.
- [ ] 상태 값 `DONE` 도 **유지**한다 — 본 task 는 승격·강등이 아니라 근거 박제다. 아래 한계 명시로 DONE 의 범위를 좁혀 적을 것.
- [ ] 남은 **한계**를 최소 2 개 명시한다 — (1) `RECENT_DELETION_DELETER` 실 repository provider 가 미주입이라 현재 `deletedCount` 가 항상 0(= 실 삭제는 미배선, 재수집만 발화), (2) `days > 366`(`MAX_DAYS` 초과) 요청이 helper 의 `RangeError` 로 500 이 되는 경로가 계약으로 고정되지 않았다. 실측으로 더 확인되면 추가한다.
- [ ] 표 구조 무결성 — 해당 행이 여전히 `| REQ-041 | 74 | … |` 형태의 **단일 행 7 칸**이고 개행이 끼어들지 않는다(`grep -c "^| REQ-041 |" docs/requirements.md` → **1**).
- [ ] 문서 본문은 한국어, 행 범위 표기는 CLAUDE.md §12 규약(`60 행`, `~` 구분자, `L` prefix 금지)을 따른다.
- [ ] 총 diff **≤ 300 LOC / 1 파일**. R-110 · R-112 는 **direct doc-only 면제**(production 코드 · test 변경 0 이라 happy / error / 분기 / negative 4 축과 coverage 게이트의 적용 대상이 아니다). 소비처 동반 의무(CLAUDE.md §3)도 helper 신설 0 이라 **비해당**.

## Out of Scope

- REQ-041 **외** 다른 REQ 행의 status · 서술 수정 — once-rule 은 REQ 당 1 회이므로 다른 REQ 를 끼워 넣으면 그 REQ 의 1 회를 소모한다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` REQ-041 row 및 audit 계수 재산출.
- `docs/architecture/api.md` 의 recent-deletion route 행 갱신.
- `src/scheduling/` 동작 변경 — 특히 `days > 366` 의 `RangeError` → 400 매핑, `RECENT_DELETION_DELETER` 실 provider 바인딩은 각각 별도 pr task(전자는 계약 결정 필요, 후자는 schema/repository 게이트 동반).
- `test/e2e/schedules-recent-deletion.e2e-spec.ts` 케이스 추가 · 수정.
- `test/perf/` · `test/load/` · k6 관련 일체 무접촉(PLAN `157 행` · `158 행`).
- `scripts/daily-test.sh` leg 추가 금지(Q-0054 선례 — drift-guard smoke 3 종 동반 수정을 강제해 5-파일 cap 을 깬다).

## Suggested Sub-agents

`implementer`

## Follow-ups

(비어 있음)
