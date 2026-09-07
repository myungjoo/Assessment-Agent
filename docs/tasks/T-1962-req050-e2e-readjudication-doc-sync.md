---
id: T-1962
title: REQ-050 "test/e2e 참조 0" 자인 정정 — difficulty-mappings e2e 좌표 doc-sync (once-rule 1 회)
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-050]
estimatedDiff: 16
estimatedFiles: 1
created: 2026-09-08
independentStream: req050-e2e-readjudication
dependsOn: [T-1960, T-1961]
touchesFiles: [docs/requirements.md]
plannerNote: P7 REQ-050 — T-1960·T-1961 두 축 머지 후 요구표의 "difficulty-mappings e2e 참조 0" 자인을 실 좌표로 1 회 재판정
---

# T-1962 — REQ-050 "test/e2e 참조 0" 자인 정정 (difficulty-mappings e2e 좌표 doc-sync)

## Why

`docs/requirements.md` `69 행` REQ-050 은 상태 칸 말미에 스스로 **"`test/e2e/` 의 difficulty-mappings 참조도 0 이라 (perf 축 `test/perf/difficulty-mapping-read.perf-spec.ts` 만 존재) 셋업 전 fail-fast 4xx 의 실경로 검증이 unit 밖에 없다"** 고 적고 있다. 그 공백은 T-1960(조회 축, PR #1538 → main `68786f7e`)과 T-1961(슬롯 재지정 축, PR #1539 → main `a75d98ae`)이 `test/e2e/difficulty-mappings.e2e-spec.ts` 로 닫았고, 두 task 모두 Out of Scope 에 "REQ-050 재판정은 GET·PATCH 두 축이 모두 머지된 뒤 별도 direct doc-sync **1 회**로 수행" 이라고 명시해 이 시점을 예약해 두었다. PLAN `183 행` once-rule 이 허용하는 "구현 slice 머지 뒤 REQ 당 1 회" 재판정 시점이 지금이다.

**issue-still-relevant pre-check (origin/main `7359f154` 실측)** — ① `grep -c "difficulty-mappings 참조도 0" docs/requirements.md` → **1 hit**(정정 대상이 실재하고 유일). ② `git grep -c "" origin/main -- test/e2e/difficulty-mappings.e2e-spec.ts` → **403 행**, `describe(` 는 `61 행` GET(T-1960) · `224 행` PATCH(T-1961) **2 개**, `it(` 총 **15 개**(GET 6 · PATCH 9) — 정정 근거가 main 에 안착했다. ③ `git log origin/main --oneline -8 -- docs/requirements.md` 최신 8 건은 T-1959(REQ-027) · T-1955(REQ-019) · T-1947(REQ-009) · T-1938(REQ-004) · T-1935(REQ-036) · T-1930(REQ-047) · T-1929(REQ-020) · T-1922(REQ-011) 로 **REQ-050 재판정 0 건** — 본 e2e arc 안에 선행 재판정 commit 이 없다(직전 REQ-050 재판정은 `2026-08-02` 의 T-1384 로, e2e arc **이전** 다른 arc 의 1 회다). ④ 동일 의도 PENDING task 0 · `T-1962` ID 미사용. 따라서 안착 0 · 중복 0 이 확정이다.

**오너 게이트 판정** — PLAN `157 행`(k6 부하검증 최우선): `package.json` · `.github/workflows/` · `test/load/` 무변경이라 자원 경합 0(문서 1 행 정정). PLAN `158 행`(R-92 per-route perf baseline churn 중단): `test/perf/*.perf-spec.ts` 를 1 파일도 추가·수정하지 않으므로 비해당. PLAN `182 행`(소비처 동반 의무): helper · factory · 어댑터 신설 0 인 doc-only slice 라 **비해당**(소비처 개념 부재). PLAN `183 행`(REQ 재판정 once-rule): 본 task 는 구현 slice(T-1960 · T-1961)가 **이미 머지된 뒤** 수행하는 REQ-050 당 **1 회** 재판정이며, 본 arc 에 구현 전 재판정은 0 건이었다(두 구현 task 모두 `docs/requirements.md` 무접촉) — 규칙 준수.

## Required Reading

- `docs/requirements.md` `69 행` — REQ-050 행 전체(정정 대상). 특히 말미의 `3 row seed 경로가 부재하고 … 검증이 unit 밖에 없다` 구간. 인접 행의 서술 관례를 그대로 승계할 것.
- `test/e2e/difficulty-mappings.e2e-spec.ts` — 헤더 주석 `1~30 행`(고정 계약 서술), `61 행` GET describe, `224 행` PATCH describe. 각 it 이 무엇을 잠그는지 실제로 읽고 셀 것.
- `src/llm/difficulty-mapping.controller.ts` `58 · 75 · 92~95 행` — `@Controller("api/llm/difficulty-mappings")` · `@Get()` · `@Patch(":difficulty")` + `@Roles("Admin")`.
- `docs/decisions/ADR-0011-difficulty-model-assignment.md` `§ 3` (`60~64 행`) — fail-fast 결정 원문(요구표 서술이 인용하는 근거).
- `docs/progress/journal-2026-09-07.md` 말미 T-1960 · T-1961 항목 — 머지 좌표(PR #1538 → `68786f7e`, PR #1539 → `a75d98ae`)와 CI green 사실.
- `docs/tasks/T-1959-req027-e2e-readjudication-doc-sync.md` — 직전 동형 doc-sync 의 서술 형식(정정 문장 구조 · 한계 명시 방식) 참고.
- `docs/PLAN.md` `183 행` — REQ 재판정 once-rule 원문.

## Acceptance Criteria

- [ ] `docs/requirements.md` **1 파일만** 수정한다. `src/` · `web/` · `test/` · `prisma/` · `.github/` · `package.json` diff **0**.
- [ ] `69 행` REQ-050 상태 칸에서 **"`test/e2e/` 의 difficulty-mappings 참조도 0"** 자인을 제거한다. 완료 후 `grep -c "difficulty-mappings 참조도 0" docs/requirements.md` 가 **0** 이어야 한다(다른 행에 같은 문자열을 새로 만들지 않는다).
- [ ] 제거한 자리에 실 e2e 좌표를 박제한다 — 파일 경로 `test/e2e/difficulty-mappings.e2e-spec.ts`, **describe 2 개**(GET 축 T-1960 · PATCH 축 T-1961)와 **it 개수**, 그리고 두 축이 각각 무엇을 잠그는지(GET: seed 전 200 + `[]` · null FK 슬롯 미필터 · User 403 / SuperAdmin 200 · 실패 body 데이터 누출 0 / PATCH: 실 config 지정 200 + DB FK 반영 · 기설정 슬롯 overwrite 200 · 미지원 난이도 400 · config 부재 404 · 슬롯 row 부재 P2025 404 · 실패 경로 FK 불변)를 1 회 서술한다. 출처로 T-1960 · PR #1538 · main `68786f7e` 와 T-1961 · PR #1539 · main `a75d98ae` 를 남긴다.
- [ ] **계수는 실행 시점에 직접 재검산**한다 — `describe(` / `it(` 개수를 `test/e2e/difficulty-mappings.e2e-spec.ts` 에서 실제로 세어 적는다(본 task 파일의 `403 행 · describe 2 · it 15(GET 6 · PATCH 9)` 를 그대로 베끼지 말 것). 기존 서술의 `unit 축 = 5 spec 105 it` 계수도 같은 방식으로 재검산해 어긋나면 정정한다.
- [ ] 검증 위치 열 `policy + unit` 은 **재검토해 반영**한다 — 이제 e2e 축 실 근거가 생겼으므로 실측에 따라 `policy + unit + e2e` 로 갱신하되, 갱신 시 그 근거(위 spec 좌표)를 같은 행 안에 남긴다.
- [ ] 상태 값 `IN_PROGRESS` 는 **유지**한다 — 미충족 축(**항목→난이도 결정 규칙 축**: `classifyNarrative` 가 LLM marker 파싱 기반이고 결정 규칙이 코드·ADR 어디에도 없음)이 그대로 살아 있어 DONE 승격 근거가 없다. e2e 좌표 추가만으로 상태를 올리지 않는다.
- [ ] 남은 **한계**를 최소 2 개 유지·명시한다 — (1) `prisma/` 에 3 row seed script 가 여전히 0 이라 운영 셋업 경로는 미검증(e2e 는 spec 안 헬퍼로 자체 seed), (2) `evaluation-scoring.service.ts` 가 `options.difficulty` 를 주입하지 않아 gateway 의 난이도 routing 분기가 평가 경로에서 미발화. 실측으로 확인되는 한계가 더 있으면 추가한다.
- [ ] 표 구조 무결성 — 해당 행이 여전히 `| REQ-050 | 97 | … |` 형태의 **단일 행 7 칸**이고 개행이 끼어들지 않는다(`grep -c "^| REQ-050 |" docs/requirements.md` → **1**).
- [ ] 문서 본문은 한국어, 행 범위 표기는 CLAUDE.md §12 규약(`69 행`, `~` 구분자, `L` prefix 금지)을 따른다.
- [ ] 총 diff **≤ 300 LOC / 1 파일**. R-110 · R-112 는 **direct doc-only 면제**(production 코드 · test 변경 0 이라 happy / error / 분기 / negative 4 축과 coverage 게이트의 적용 대상이 아니다). 소비처 동반 의무(CLAUDE.md §3)도 helper 신설 0 이라 **비해당**.

## Out of Scope

- REQ-049 `68 행` 행 수정 — 이미 `DONE` 이고 e2e 부재를 주장하지 않아 drift 가 아니다. once-rule 예산을 소모하지 않도록 건드리지 않는다.
- REQ-050 **외** 다른 REQ 행의 status · 서술 수정(once-rule 은 REQ 당 1 회 — 다른 REQ 를 끼워 넣으면 그 REQ 의 1 회를 소모한다).
- `docs/use-cases/REQ-COVERAGE-AUDIT.md` REQ-050 row 및 audit 계수 재산출 — 본 doc-sync 는 요구표 1 행에 한정한다.
- `docs/architecture/api.md` 의 difficulty-mappings route 행 갱신.
- `src/llm/` · `src/assessment-evaluation/` 동작 변경(항목→난이도 결정 규칙 신설 · `options.difficulty` 주입 배선 등) — 본 task 는 문서만 사실에 맞춘다. 필요하면 Follow-ups 로.
- `prisma/` 3 row seed script 신설.
- `test/e2e/difficulty-mappings.e2e-spec.ts` 의 케이스 추가 · 수정.
- `test/perf/` · `test/load/` · k6 관련 일체 무접촉(PLAN `157`·`158 행`).
- `scripts/daily-test.sh` leg 추가 금지(Q-0054 선례 — drift-guard smoke 3 종 동반 수정을 강제해 5-파일 cap 을 깬다).

## Suggested Sub-agents

`implementer`

## Follow-ups

(비어 있음)
