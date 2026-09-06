---
id: T-1930
title: k6 부하 harness 실측으로 REQ-047 재판정 (requirements.md 66 행)
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 60
estimatedFiles: 1
created: 2026-09-06
independentStream: p7-req047-load-scale-rejudge
dependsOn: []
touchesFiles:
  - docs/requirements.md
plannerNote: "P7 R-91 축 — REQ-047 row 가 ADR-0054 PROPOSED·harness 미도입을 단언하나 main 은 k6 도입 완료. 구현 후 1 회 재판정 (doc-only)"
---

# T-1930 — k6 부하 harness 실측으로 REQ-047 재판정 (requirements.md 66 행)

## Why

[docs/requirements.md](../requirements.md) `66 행` REQ-047 (100~200명 / 50~100 repo / ~1000 confluence / 1h 이내, README `91 행`) 은 상태가 `PLANNED 유지` 이고 판정 본문이 **"측정 3 축 전부 부재"** 를 단언한다. 그 근거 4 종이 origin/main `09414562` 실측과 정면으로 어긋난다 — 판정 이후 [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) ACCEPTED flip 과 k6 chain (`T-1620` ~ `T-1688`) 이 머지됐는데 REQ row 만 갱신되지 않은 stale drift 다. 본 slice 는 그 drift 를 실측 좌표로 정정하는 **구현 후 1 회** 재판정이다.

**오너 지시 게이트 확인** (세 건 모두 회피 근거 있음):

- [PLAN](../PLAN.md) `183 행` (REQ 재판정 왕복 제거 — 구현 후 1 회만): REQ-047 은 k6 chain 머지 **이전에도 이후에도** 재판정된 적이 없다 (`ls docs/tasks/ | grep -i req047` → 0 건, `git log --oneline -- docs/requirements.md` 최근 이력에 REQ-047 재판정 commit 0). 본 slice 가 arc 의 유일한 · 구현 직후 1 회 재판정이라 once-rule 위반이 아니다.
- [PLAN](../PLAN.md) `158 행` (R-92 per-route perf baseline churn 금지): 본 slice 는 `test/perf/` 를 만들지도 고치지도 않는다 — 금지 대상(신규 per-route baseline slice) 밖의 doc-only 정정이다.
- [PLAN](../PLAN.md) `157 행` (R-91 k6 부하검증 최우선): 본 slice 는 R-91 과 **경합이 아니라 그 축의 문서 정산** 이다. chain ① k6 도입은 이미 안착했고 (`package.json` `23~26 행`, [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml)), 잔여 ② 실 scale 실행 축은 [PLAN](../PLAN.md) `161 행` 이 밝히듯 `실 수집 → 평가` 가 자격증명 0 · `LOAD_TEST_STUB=1` 이라 미발화 상태다 (§5 게이트). 그 잔여를 지우지 않고 REQ row 에 **정확히 남기는** 것이 본 slice 의 산출물이다.

**issue-still-relevant pre-check (origin/main `09414562` 실측 — 아래 4 종은 전부 "row 의 서술 vs main 의 사실" 대조)**:

1. row 는 ADR-0054 를 `4 행 status: PROPOSED · 권고 단계이며 채택이 아니다` 로 적으나, `git show origin/main:docs/decisions/ADR-0054-load-resilience-harness-tool.md` `4 행` 은 `status: ACCEPTED` (date 2026-07-08) 다.
2. row 는 `harness 도구는 아직 미도입` 이라 적으나, `package.json` `23~26 행` 에 `test:load` / `test:load:s1` / `test:load:s2` / `test:load:s3` 4 스크립트가 있고 `test/load/` 에 `smoke.js` · `s1-batch.js` · `s2-read.js` · `s3-concurrent.js` 가 실재하며 [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) 이 별도 job (`31 행` `k6 부하 smoke`) 으로 `129` · `138` · `195` · `211 행` step 에서 4 스크립트를 실행한다.
3. row 는 `1h 절대 임계 assertion 부재 · 판정에 쓰이는 3600s 정의 0 건` 이라 적으나, `test/load/s1-batch.js` `34 행` 이 `FULL_RUN_BUDGET_MS = 3600000`, `36~38 행` 이 표본 외삽 임계 `BATCH_P95_MS`, `68~75 행` 이 `thresholds` 의 `http_req_duration{route:batch}` p95 게이트를 정의한다.
4. row 는 `대규모 seed 스크립트가 없으며 100~200명 fixture 는 0 건` 이라 적으나, `scripts/seed-devset-logins.ts` + `package.json` `27 행` `seed:devset-logins` + `test/load/realdata-devset-logins.json` (실 devset) 가 실재하고 workflow `114~122 행` step 이 `133 로그인 실 dataset seed 적재` 를 수행한다.

즉 동일 의도가 main 에 선반영된 중복 task 가 아니라, **문서만 뒤처진 drift** 를 닫는 slice 다.

## Required Reading

- [docs/requirements.md](../requirements.md) `66 행` — REQ-047 row. 재판정 대상. 인접 row (`67 행` REQ-048) 는 서술 형식 · 축 분해 방식 참고용 read-only.
- [docs/requirements.md](../requirements.md) `12~19 행` — 표 schema · 상태 어휘 · 판정 갱신 규율.
- [docs/decisions/ADR-0054-load-resilience-harness-tool.md](../decisions/ADR-0054-load-resilience-harness-tool.md) `1~12 행` (frontmatter status · relatedReq) + `§Decision` — 도구 결정 축의 현재 사실.
- [package.json](../../package.json) `23~27 행` — `test:load` 계열 4 스크립트 + `seed:devset-logins`.
- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) `78~95 행` (컨테이너 기동 + `LOAD_TEST_STUB=1` env) · `114~122 행` (실 dataset seed step) · `129` · `138` · `153` · `195` · `211 행` (스크립트 실행 · 실측 요약 기록 step).
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `1~50 행` (진입 route · 표본 축소 · 외삽 산식 · `FULL_RUN_BUDGET_MS`) + `60~80 행` (`thresholds` 판정면) — 배치 측정 harness 축 · 1h 임계 축의 근거.
- [scripts/seed-devset-logins.ts](../../scripts/seed-devset-logins.ts) 와 [test/load/realdata-devset-logins.json](../../test/load/realdata-devset-logins.json) — scale seed 축의 근거 (인원 수는 파일에서 직접 센 값을 쓴다).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` (임계 표) · `§3.1` (실측 회차 기록) · `§5` (잔여 인벤토리) — 계획 축 + 실측 상태 정본.
- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) `## seed 실행 경로` 의 **실측 상태** bullet — 133명 dataset 의 seed 성공 회차 정본.
- [docs/PLAN.md](../PLAN.md) `157` · `158` · `161` · `183 행` — 오너 지시 게이트 4 건 (본 판정이 넘지 말아야 할 경계).

## Acceptance Criteria

- [ ] `docs/requirements.md` `66 행` REQ-047 row 의 상태 문자열이 **위 Required Reading 을 직접 읽어 실측한 결과** 로 재판정된다. 판정 규칙: (a) 도구 결정 축 · 배치 측정 harness 축 · 1h 임계 축 · scale seed 축이 모두 충족이고 **실 scale 실행까지 발화** 했으면 `DONE`, (b) 하나라도 미충족이면 `IN_PROGRESS` 로 두고 **미충족 축을 이름 붙여 열거** 한다. 상태를 `PLANNED 유지` 로 남기는 결론은 위 4 종 대조가 전부 거짓임을 보이지 않는 한 허용하지 않는다.
- [ ] 현 판정 본문의 **거짓 서술 4 종** 이 전부 폐기되고 실측 좌표로 교체된다 — ① `ADR-0054 status: PROPOSED · 채택 아님` ② `harness 도구 미도입` ③ `1h 절대 임계 assertion 부재 / 3600s 판정 정의 0 건` ④ `대규모 seed 스크립트 · 100~200명 fixture 0 건`. 교체 문장은 각각 파일 경로 + 행 좌표 + 심볼(또는 step 이름)을 포함한다.
- [ ] **잔여 축이 삭제되지 않고 명시** 된다 — 최소 (i) `LOAD_TEST_STUB=1` stub 경로라 실 LLM · 실 수집 왕복이 미발화라는 점 ([PLAN](../PLAN.md) `161 행` 과 정합), (ii) S1 이 133명 full run 이 아니라 축소 표본 + 선형 외삽 판정이라는 점 (`test/load/s1-batch.js` 외삽 산식), (iii) `manual` 검증 축 (사람이 따라 할 배치 부하 실행 절차) 의 현 상태. 각 항목은 실측으로 확인한 대로만 적고, 확인하지 못한 것은 "본 재판정에서 확인하지 않았다" 로 한계를 명시한다.
- [ ] 인용한 모든 행 좌표 · 개수 (스크립트 수 · seed 인원 수 · step 행) 는 편집 시점에 파일을 열어 재확인한 값이다. 확인 명령을 판정 본문에 남기지 않고 결과만 적되, 존재하지 않는 심볼 · 행을 인용하지 않는다.
- [ ] 표 구조 무손상 — `docs/requirements.md` 의 총 행 수가 편집 전과 동일하고 (`grep -c "" docs/requirements.md` 가 `121`), REQ-047 은 여전히 파이프 7 칸 1 행이며 다른 REQ row 는 문자 단위 무변경 (`git diff docs/requirements.md` 의 변경 hunk 가 `66 행` 하나).
- [ ] 코드 변경 0 — `git diff --stat` 에 `src/` · `web/` · `test/` · `.github/` · `package.json` 항목이 없다 (변경 파일은 `docs/requirements.md` 와 본 task 파일 뿐).
- [ ] [CLAUDE.md](../../CLAUDE.md) `§12` 언어 정책 준수 — 판정 본문은 한국어, 식별자 · 경로 · status enum 은 영어. 행 범위 표기는 `§ 12.76` R1~R7 (구분자 `~`, 단일 행은 `66 행`, `L` prefix 금지).

## Out of Scope

- `test/perf/` 신규 spec 추가 · 수정 ([PLAN](../PLAN.md) `158 행` 금지 대상).
- `test/load/*.js` · `.github/workflows/load-k6.yml` · `package.json` · `scripts/` 의 어떤 변경도 금지 — 본 slice 는 읽기만 한다.
- k6 실행 · CI 재실행 · live run 착수 (`pnpm test:load*` 를 돌리지 않는다). 실 scale 실행 축은 자격증명 게이트 (§5) 라 별도 결정 대상이다.
- [PLAN](../PLAN.md) `157` · `161 행` checkbox 승격 — `161 행` 이 `실 수집 → 평가` 미발화를 이유로 `[ ]` 유지를 명시했다. PLAN 파일 미접촉.
- REQ-047 이외 REQ row 재판정 (특히 인접한 REQ-048) — 별도 slice.
- ADR 신설 · 기존 ADR 결정 내용 변경 (본 slice 는 `direct` 이므로 pr-mode 대상 파일을 건드리면 안 된다).

## Suggested Sub-agents

`implementer` (doc-only 편집). direct doc-only commit 이라 [CLAUDE.md](../../CLAUDE.md) `§3.2` R-110 의 tester 의무에서 면제된다 — 코드 · 테스트 변경이 0 인지만 확인한다.

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 추가한다.)
