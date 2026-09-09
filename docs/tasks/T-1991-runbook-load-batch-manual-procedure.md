---
id: T-1991
title: 운영 런북에 부하 배치 수동 실행 절차 신설 (REQ-047 manual 축)
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 72
estimatedFiles: 1
estimatedLoc: 72
independentStream: ops-doc-runbook
dependsOn: []
touchesFiles:
  - docs/ops/runbook.md
created: 2026-09-09
plannerNote: P7 성능 검증 · REQ-047 잔여 (iii) — runbook 에 사람이 따라 할 배치 부하 실행 절차 박제(doc-only direct)
---

# T-1991 — 운영 런북에 부하 배치 수동 실행 절차 신설 (REQ-047 manual 축)

## Why

REQ-047 의 검증 위치 enum 은 `manual + perf test` 인데, `manual` 축이 지금 **workflow_dispatch 버튼 존재**까지만 확보돼 있고 사람이 따라 할 실행 절차는 어디에도 없다. [docs/requirements.md](../requirements.md) `66 행` REQ-047 상태 칸의 잔여 (iii) 가 그 사실을 그대로 적는다 — "`docs/ops/runbook.md` 는 `14 행` 계획 문서 cross-link 한 줄뿐이라 사람이 따라 할 배치 부하 실행 절차는 미박제다". [docs/PLAN.md](../PLAN.md) `147 행` 성능 검증 bullet(R-91 축) 의 운영 측 공백이기도 하다.

**issue-still-relevant pre-check (planner 실측, origin/main `4f5056de`)** — ① `git show origin/main:docs/ops/runbook.md | grep -n "^## "` = `21 행` §1 배포 · `74 행` §2 복구 · `117 행` §3 trouble-shoot · `143 행` §4 운영 전제 체크리스트 **4 개뿐**(총 163 행), 부하 관련 절 0. ② 같은 파일에서 `k6` · `test:load` · `workflow_dispatch` grep 히트 **0**, `부하` 히트는 `14 행` 관련 문서 cross-link **1 줄**뿐. ③ `git log origin/main -- docs/ops/runbook.md` = `3e6eae1f`(T-0821 신설) · `ad0b6f83`(T-0826) **2 건**으로 harness 도입(T-1620~) 이후 무접촉. ④ `docs/tasks/` 에 같은 의도의 미완 task 0(REQ-047 관련 최근 task 인 [T-1930](T-1930-requirements-req047-load-scale-rejudge.md) 은 재판정 doc-sync 로 이 공백을 *지적만* 하고 닫았다). → 미해소 확인.

본 task 는 harness · workflow · 임계를 **한 줄도 바꾸지 않고**, 이미 존재하는 실행면(workflow dispatch input · `pnpm test:load:*` · env 3 종 · summary 회수 step) 을 런북 절차로 박제하기만 한다. 오너 지시 `158 행`(신규 per-route perf baseline slice 금지) 과 `183 행`(REQ 재판정 왕복 금지) 어느 쪽도 건드리지 않는다 — 재판정·checkbox 변경은 Out of Scope.

## Required Reading

- [docs/ops/runbook.md](../ops/runbook.md) — 전체 163 행. 특히 `1~20 행`(머리말 · 관련 문서 목록), `21 행` §1 · `74 행` §2 · `117 행` §3 · `143 행` §4 의 절 구성·서술 톤(신설 절은 이 톤을 승계).
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — `9~21 행`(`workflow_dispatch` + `s1_persons` input 기본 `"10"`), `26~28 행`(concurrency `load-k6`, cancel 안 함), `78~93 행`(대상 컨테이너 기동 + `-e LOAD_TEST_STUB=1`), `114~122 행`(`pnpm seed:devset-logins` 로 133 로그인 적재), `124~132 행`(k6 설치 + smoke, `K6_BASE_URL: http://localhost:3000`), `138~146 행`(S1 step · `K6_S1_PERSONS` 주입 · `--summary-export=k6-s1-summary.json`), `153~190 행`(S1 실측 요약을 `GITHUB_STEP_SUMMARY` 로 회수, 요약 파일 부재 시 문구), `195~217 행`(S2 · S3 step), `218~223 행`(정리).
- [test/load/s1-batch.js](../../test/load/s1-batch.js) — `26~45 행`: `K6_BASE_URL` · `K6_S1_PERSONS` 기본값, `EXTRAPOLATION_PERSONS = 133`, `FULL_RUN_BUDGET_MS = 3600000`, `BATCH_P95_MS` 외삽 산식(임계 해석에 필요).
- [package.json](../../package.json) `23~27 행` — `test:load` · `test:load:s1` · `test:load:s2` · `test:load:s3` · `seed:devset-logins`.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§2` 시나리오 S1~S3 정의, `725 행` `### 3.1 baseline 실측 기록`(실측 회차 적재 위치), `2641 행` `## 5. Follow-up 인덱스`(잔여 축 pointer).
- [docs/requirements.md](../requirements.md) `66 행` — REQ-047 상태 칸의 잔여 (i)(ii)(iii) 문장(신설 절의 "한계" 서술 근거).

## Acceptance Criteria

- [ ] `docs/ops/runbook.md` 끝에 **`## 5. 부하 배치 수동 실행 (REQ-047 manual 축)`** 절 1 개를 신설한다. 검증: `grep -n "^## 5\. 부하 배치 수동 실행" docs/ops/runbook.md` 히트 **1**.
- [ ] 신설 절이 **CI 경로**(권장)를 단계로 적는다 — GitHub Actions `Load (k6)` workflow 를 `workflow_dispatch` 로 실행 / `s1_persons` input 의미(미지정 기본 `10`, 실 scale 반복은 `133`) / 같은 이름 job 은 `concurrency: load-k6` 로 직렬화되며 진행 중 run 은 취소되지 않는다는 점. 검증: `grep -n "workflow_dispatch\|s1_persons\|load-k6" docs/ops/runbook.md` 히트 각 1+.
- [ ] 신설 절이 **로컬 경로**를 단계로 적는다 — 선행 조건(앱 + PostgreSQL 기동, `pnpm seed:devset-logins` 로 devset 적재, k6 바이너리는 npm 패키지가 아니라 별도 설치) → `pnpm test:load` (smoke) → `pnpm test:load:s1` → `:s2` → `:s3` 순서. 검증: `grep -c "test:load:s1" docs/ops/runbook.md` ≥ 1 이고 4 script 명이 모두 등장.
- [ ] 신설 절이 **env 3 종**의 이름·기본값·의미를 표 또는 목록으로 적는다 — `K6_BASE_URL`(기본 `http://localhost:3000`), `K6_S1_PERSONS`(기본 `10`, 표본 인원), `LOAD_TEST_STUB`(정확히 `1` 일 때만 stub LLM 바인딩, fail-safe default OFF). 검증: `grep -n "K6_BASE_URL\|K6_S1_PERSONS\|LOAD_TEST_STUB" docs/ops/runbook.md` 히트 각 1+.
- [ ] 신설 절이 **결과 판독법**을 적는다 — 판정 임계는 `BATCH_P95_MS = 3600000 × (표본 인원 / 133)` 외삽식이고 실패는 k6 threshold 위반(exit≠0), 실측 요약은 run 의 Job Summary(`S1 실측 요약 기록` step) 에서 회수하며 요약 파일 부재 문구의 의미(k6 가 요약 전 종료 = 설치·부팅 실패), 회차 기록은 `load-resilience-test-plan.md` `### 3.1` 에 적재한다는 pointer. 검증: `grep -n "3600000\|Job Summary\|### 3.1" docs/ops/runbook.md` 히트 1+.
- [ ] 신설 절이 **한계**를 명시한다 — 이 경로는 `LOAD_TEST_STUB=1` stub LLM + 자격증명 0 이라 실 수집·실 LLM 왕복은 발화하지 않고(REQ-047 잔여 (i)), S1 은 축소 표본 + 선형 외삽이라 1h full run 실측이 아니다(잔여 (ii)). 검증: 해당 두 문장이 파일에 실재.
- [ ] 기존 `§1`~`§4` 의 **번호·제목·본문은 무변경**(append-only). 검증: `git diff -U0 docs/ops/runbook.md | grep -c "^-[^-]"` = **0**.
- [ ] 인용한 좌표·값이 실제와 일치한다(문서만 보고 지어내지 않는다). 검증: 인용한 `load-k6.yml` 행 번호를 `sed -n '<n>p'` 로 1 건씩 대조, `package.json` script 명 4 개를 `grep` 으로 대조.
- [ ] 상대 링크가 전부 유효하다. 검증: 신설 절이 거는 링크 대상 파일이 `ls` 로 실재.
- [ ] 변경은 `docs/ops/runbook.md` **1 파일**. 검증: `git diff --stat` 이 1 파일.
- [ ] doc-only `direct` 이므로 R-110 tester 면제 — 코드·spec 변경 0 이라 R-112 4 축(happy / error / 분기 / negative) 은 **비해당**(분기 없음, 이 항목 생략). `pnpm lint` / `pnpm test` 는 실행하지 않는다.

## Out of Scope

- k6 를 **실제로 실행**하거나 workflow 를 dispatch 하는 것(측정 회차 추가는 별건).
- `.github/workflows/load-k6.yml` · `test/load/*.js` · `package.json` · 임계 상수 수정 — 본 task 의 production/워크플로 diff 는 **0**.
- `docs/requirements.md` REQ-047 재판정, `docs/PLAN.md` checkbox·bullet 수정, `load-resilience-test-plan.md` 본문 수정(오너 지시 `183 행` 재판정 왕복 금지 · 본 task 는 pointer 만 건다).
- 신규 per-route perf baseline slice 큐잉·작성(오너 지시 `158 행` 금지).
- REQ-043 guard 미배선 20 route 배선(§5 auth 게이트 · 오너 승인 대상).
- runbook `§1`~`§4` 재편·번호 재배치·기존 문장 다듬기.
- T-1989 reviewer MINOR(`CLOSED_BY_T1989` `readonly` 누락) — `test/` 변경이라 commitMode 가 갈린다. 다음 census `pr` slice 로 이월.

## Suggested Sub-agents

`implementer` (doc-only, direct — architect · tester 불요)

## Follow-ups

(작성 시점 비어 있음)
