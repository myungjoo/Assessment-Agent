---
id: T-1959
title: REQ-027 "e2e 미보유" 표기 정정 — backfill e2e 좌표 doc-sync (once-rule 1 회)
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-027]
estimatedDiff: 12
estimatedFiles: 1
created: 2026-09-07
independentStream: req027-e2e-readjudication
dependsOn: [T-1958]
touchesFiles: [docs/requirements.md]
plannerNote: P7 REQ-027 — T-1958 e2e 머지 후 요구표의 유일한 "e2e 미보유" 자인을 실 spec 좌표로 1 회 재판정
---

# T-1959 — REQ-027 "e2e 미보유" 표기 정정 (backfill e2e 좌표 doc-sync)

## Why

`docs/requirements.md` `46 행` REQ-027 은 검증 위치를 `unit + e2e` 로 선언해 두고 상태 칸에 스스로 **"e2e 미보유"** 를 적고 있다. 그 공백은 직전 T-1958(PR #1537 → main `742bd62d`)이 `test/e2e/schedules-backfill.e2e-spec.ts` **192 행 · it 5 개**로 닫았으므로, 요구표의 자인은 이제 **사실과 어긋난 유일한 잔여 drift** 다. T-1958 의 Follow-ups (a) 가 명시한 후속이자 PLAN `183 행` once-rule 이 허용하는 "구현 slice 머지 뒤 REQ 당 1 회" 재판정 시점이다.

**issue-still-relevant pre-check (origin/main `de7811d7` 실측)** — ① `grep -n "e2e 미보유" docs/requirements.md` → **46 행 1 hit 만** 잔존(정정 대상이 실재하고 유일). ② `git ls-tree origin/main --name-only test/e2e/` 에 `test/e2e/schedules-backfill.e2e-spec.ts` **존재**(정정할 근거가 main 에 안착). ③ `git log origin/main --oneline -5 -- docs/requirements.md` 최신 5 건은 T-1955(REQ-019) · T-1947(REQ-009) · T-1938(REQ-004) · T-1935(REQ-036) · T-1930(REQ-047) 로 **REQ-027 재판정 0 건** — 동일 의도 선행 commit 이 없다. ④ 동일 의도 PENDING task 0 · `T-1959` ID 미사용. 따라서 안착 0 · 중복 0 이 확정이다.

**오너 게이트 판정** — PLAN `157 행`(k6 부하검증 최우선): `package.json` · `.github/workflows/` · `test/load/` 무변경이라 자원 경합 0(문서 1 행 정정). PLAN `158 행`(R-92 per-route perf baseline churn 중단): `test/perf/*.perf-spec.ts` 를 1 파일도 추가·수정하지 않으므로 비해당. PLAN `182 행`(소비처 동반 의무): helper · factory · 어댑터 신설 0 인 doc-only slice 라 비해당(소비처 개념 부재). PLAN `183 행`(REQ 재판정 once-rule): 본 task 는 구현 slice(T-1958)가 **이미 머지된 뒤** 수행하는 **REQ-027 당 1 회** 재판정이며, 본 arc 에 구현 전 재판정은 0 건이었다(T-1958 은 `docs/requirements.md` 를 건드리지 않았다) — 규칙 준수.

## Required Reading

- `docs/requirements.md` `46 행` — REQ-027 행 전체(정정 대상). 인접 행의 서술 관례(`DONE (implemented-on-main — … 검증 위치 … 한계 …)`)를 그대로 승계할 것.
- `test/e2e/schedules-backfill.e2e-spec.ts` — 전체 192 행. `47 행` describe 명, `88 행`(happy 202 + 4 key + 52/52 + Assessment 52 건) · `119 행`(idempotency skip 분기) · `153 행`(401) · `166 행`(403) · `180 행`(404) 5 it 의 실제 단언.
- `src/scheduling/backfill.controller.ts` `69~77 행` — `@Post("backfill/:personId")` + `@HttpCode(202)` + `@Roles("Admin")`.
- `src/scheduling/backfill-plan.ts` — `DEFAULT_WEEKS = 52` 상수 위치(기존 서술의 근거 확인용).
- `docs/progress/journal-2026-09-07.md` 말미 T-1958 항목 — 머지 좌표(PR #1537 → `742bd62d`)와 CI green 사실.
- `docs/PLAN.md` `183 행` — REQ 재판정 once-rule 원문.

## Acceptance Criteria

- [ ] `docs/requirements.md` **1 파일만** 수정한다. `src/` · `web/` · `test/` · `prisma/` · `.github/` · `package.json` diff **0**.
- [ ] `46 행` REQ-027 의 상태 칸에서 문자열 **"e2e 미보유"** 를 제거한다. 완료 후 `grep -c "e2e 미보유" docs/requirements.md` 가 **0** 이어야 한다(다른 행에 같은 문자열을 새로 만들지 않는다).
- [ ] 제거한 자리에 실 e2e 좌표를 박제한다 — 파일 경로 `test/e2e/schedules-backfill.e2e-spec.ts`, **it 5 개**, 그리고 각 it 이 무엇을 잠그는지(202 + `BackfillRunResult` 4 key + 52/52 + `Assessment` 52 건 week/aggregate · idempotency skip 202 `skipped:true` 건수 불변 · 401 · 403 · 404 raw forward)를 R-112 4 축(happy / error / 분기 / negative)에 대응시켜 1 회 서술한다. 출처로 T-1958 · PR #1537 · main `742bd62d` 를 남긴다.
- [ ] `unit spec 3종` 이라는 기존 계수를 **실측으로 재검산**해 정정한다 — `ls src/scheduling/ | grep backfill` 기준 colocated spec 은 `backfill.controller.spec.ts` · `backfill-runner.service.spec.ts` · `backfill-plan.spec.ts` · `assessment-backfill-checker.service.spec.ts` **4 종**이다. 실행 시점에 다시 세어 실제 개수를 적는다(본 문서의 4 를 그대로 베끼지 말 것).
- [ ] 검증 위치 열 `unit + e2e` 는 **그대로 둔다**(열 값 변경 0). 이제 두 축 모두 실 근거를 가지므로 열을 바꿀 이유가 없다.
- [ ] 남은 **한계**를 최소 2 개 명시한다 — (1) e2e 는 빈 `serviceIdentities` Person 을 쓰는 no-network 계약 검증이라 실 GitHub/Confluence 수집을 거친 backfill 은 미검증, (2) endpoint 가 `weeks` / 기준일 파라미터를 받지 않아 52 주 고정이고 영속 backfill 표식이 없어 idempotency 는 "직전 Assessment 존재" proxy 판정에 의존. 실측으로 확인되는 한계가 더 있으면 추가한다.
- [ ] 표 구조 무결성 — 해당 행이 여전히 `| REQ-027 | 50 | … |` 형태의 **단일 행 7 칸**이고 개행이 끼어들지 않는다(`grep -c "^| REQ-027 |" docs/requirements.md` → **1**).
- [ ] 문서 본문은 한국어, 행 범위 표기는 CLAUDE.md §12 규약(`46 행`, `~` 구분자, `L` prefix 금지)을 따른다.
- [ ] 총 diff **≤ 300 LOC / 1 파일**. doc-only 이므로 test 추가 없음(R-110 direct doc-only 면제 — `pnpm lint && pnpm build && pnpm test` 는 코드 변경 0 이라 회귀 대상 아님).

## Out of Scope

- `docs/architecture/api.md` `165 행` backfill route 행 갱신 — 그 행은 "e2e 미보유" 를 주장하지 않아 drift 가 아니다. 건드리지 않는다.
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` `61 행` REQ-027 row 및 audit 계수 재산출 — 본 doc-sync 는 요구표 1 행에 한정한다.
- REQ-027 **외** 다른 REQ 행의 status · 서술 수정(once-rule 은 REQ 당 1 회 — 다른 REQ 를 끼워 넣으면 그 REQ 의 1 회를 소모한다).
- `src/scheduling/` 의 endpoint · runner · checker 동작 변경(파라미터화 · 영속 backfill 표식 신설 등) — 본 task 는 문서만 사실에 맞춘다.
- `test/e2e/schedules-backfill.e2e-spec.ts` 의 케이스 추가 · 수정.
- `test/perf/` · `test/load/` · k6 관련 일체 무접촉(PLAN `157`·`158 행`).
- `scripts/daily-test.sh` leg 추가 금지(Q-0054 선례 — drift-guard smoke 3 종 동반 수정을 강제해 cap 을 깬다).

## Suggested Sub-agents

`implementer`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
