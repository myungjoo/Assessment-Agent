---
id: T-1708
title: realdata devset 정본의 stale "실 run 0 회" 실측 상태 문장을 실사실로 정정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 25
estimatedFiles: 2
created: 2026-08-26
independentStream: r91-load-doc
dependsOn: []
touchesFiles: [docs/ops/realdata-scale-devset.md, docs/PLAN.md]
plannerNote: P7 R-91(오너 🔴🔴 150 행 · 🟢 154 행) — devset 정본의 stale "실 dataset run 0 회" 문장 정정 + PLAN 154 진척 pointer
---

# T-1708 — realdata devset 정본의 stale "실 run 0 회" 실측 상태 문장을 실사실로 정정

## Why

오너 지시 [PLAN](../PLAN.md) `154 행`(🟢 R-91 실데이터 133명 dataset 준비) 의 **정본** 인
[realdata-scale-devset.md](../ops/realdata-scale-devset.md) `## seed 실행 경로` 마지막 bullet 이
**`실 dataset 을 태운 run 은 아직 0 회`** 라고 적혀 있다. 이 문장은 T-1662 가 배선 직후에 쓴
것으로 그 시점에는 참이었으나, 이후 run `32665014391`(첫 성공) · `32677333740`(표본 로그 직접
회수) 를 거쳐 [부하계획](../ops/load-resilience-test-plan.md) `§3.1` `#### 16 회차` 기준 seed step
**연속 9 회 성공** 으로 **사실과 어긋난 상태** 다 — 정본 문서가 자기 축의 진척을 0 으로 보고하는
문서 결함이다. 본 slice 는 그 한 bullet 을 기박제 수치 인용만으로 정정하고, PLAN `154 행` 에
정본 pointer 1 문장을 붙인다(직전 T-1707 의 압축 방침대로 PLAN 쪽은 pointer 만). **새 측정 · 새
dispatch · 코드 변경 0** 이다.

## Required Reading

- [docs/ops/realdata-scale-devset.md](../ops/realdata-scale-devset.md) — `## seed 실행 경로`
  (`174 행` ~), 특히 정정 대상인 마지막 **실측 상태** bullet (`196~197 행`).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — `§3.1`
  `#### 7 회차`(`944 행` ~, seed step fail) · `#### 8 회차`(`998 행` ~, 첫 성공 run
  `32665014391`) · `#### 9 회차`(`1050 행` ~, 표본 로그 `표본 취득 133명 / 요청 133명`) ·
  `#### 16 회차`(`1565 행` ~, seed step **연속 9 회 성공**).
- 같은 문서 `#### 실 수집 왕복(§5 잔여 ①) 해소 경로 판단 (사전 박제, T-1706)`(`634 행` ~) — 결론
  분포(`해소 불요` 2 건 + `사람 승인 대기` 1 건) 인용용.
- [docs/PLAN.md](../PLAN.md) `154 행` (🟢 오너 지시 bullet) — 꼬리 append 위치.

## Acceptance Criteria

- [ ] [realdata-scale-devset.md](../ops/realdata-scale-devset.md) 의 **실측 상태** bullet 이
      `실 dataset 을 태운 run 은 아직 0 회` 서술을 더 이상 포함하지 않는다 —
      `grep -n "아직 0 회" docs/ops/realdata-scale-devset.md` 결과 **0 건**.
- [ ] 교체 문장이 다음 4 사실을 **기박제 인용만으로** 담는다(새 수치 산출 · 새 추정 금지):
      ① 배선 후 첫 run `32652307813` 은 seed step **fail** 이었고 T-1664 가 그 결함을 닫았다,
      ② 첫 성공 run **`32665014391`** 이 `person 133 건 / serviceIdentity 133 건 적재` 를 찍었다,
      ③ run **`32677333740`** 이 `[s1-batch] devset 표본 취득 133명 / 요청 133명` 으로 표본 수를
      직접 회수했다, ④ `§3.1` `#### 16 회차` 기준 seed step 은 **연속 9 회 성공** 이다.
- [ ] 같은 bullet 이 **실 수집 왕복은 여전히 0** 임을 함께 명시하고(LLM `LOAD_TEST_STUB=1` stub —
      [ADR-0057](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `D1` · 부하 job 자격증명 0),
      그 축의 성격이 T-1706 판단 소절의 결론 분포(`해소 불요` 2 건 + `사람 승인 대기` 1 건)로
      규정돼 있음을 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5`
      item 5 잔여 ① pointer 와 함께 적는다.
- [ ] [PLAN.md](../PLAN.md) `154 행` 꼬리에 **≤ 2 줄** append — dataset 준비·seed 배선·실 run
      성공 진척을 위 정본 pointer 로 가리키고, bullet 의 arrow chain 중 `실 수집 → 평가` 단계가
      미발화이므로 checkbox 를 `[ ]` 로 유지한다는 근거를 1 문장으로 적는다. 기존 문장 삭제 **0**.
- [ ] `git diff --stat` 이 **정확히 2 파일**(`docs/ops/realdata-scale-devset.md` ·
      `docs/PLAN.md`) 이고 합계 ≤ 300 LOC 다.
- [ ] `pnpm lint` 무경고(doc-only 라 코드 diff 0).
- [ ] R-110/R-112 는 **면제** — direct doc-only commit 이라 production code 변경 0 LOC 이고 새
      public symbol 도 0 이라 happy/error/branch/negative test 대상이 없다(분기 없음 — 해당 항목
      생략). `test/` · `src/` · `web/` · `.github/workflows/` · `package.json` diff **0 파일**.

## Out of Scope

- 새 `workflow_dispatch` · rerun · 재 dispatch · 새 실측 **0** — 본 slice 는 기박제 수치 인용만
  한다. 새 회차 소절 신설 금지.
- [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) **전체 무변경** — `§3` 임계 표 ·
  각주 · T-1668 재확정 규칙 · T-1686/T-1698/T-1703/T-1704/T-1706 판단 소절 · `§3.1` 회차 본문 ·
  `§5` item 5 잔여 ① 원문(잔여 개수 **1 개** 표기 포함) 모두 **0 hunk**(읽기 전용).
- [realdata-scale-devset.md](../ops/realdata-scale-devset.md) 의 `§A` / `§B` 표 ·
  `## 기계 판독 사본 · drift guard` · `## 재생성(refresh) 명령` 무변경 — 표를 건드리면 같은
  commit 에서 `test/load/realdata-devset-logins.json` 도 고쳐야 하고(drift guard `RangeError`)
  파일 수가 cap 을 넘는다.
- PLAN `154 행` **외 다른 행 무변경** — `140` · `150` · `151` · `152 행` 및 checkbox 상태 전부
  문자 단위 그대로. `154 행` checkbox 를 `[x]` 로 닫지 않는다.
- 새 판단 소절(사전 박제 서식) 신설 금지 — 본 slice 는 stale 문장 정정 + pointer 뿐이다.
- `humanQuestion` 생성 금지 — T-1706 소절 ⑤ 대로 `사람 승인 대기` 후보(㉠)는 재개 트리거 **T1**
  발화 시 후속 slice 소관이다.

## Suggested Sub-agents

`implementer` (doc-only 정정 — architect · tester 불요; direct doc-only 라 R-110 면제)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
