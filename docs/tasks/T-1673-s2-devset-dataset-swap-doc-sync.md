---
id: T-1673
title: S2 person leg devset 조회 교체의 집행 사실을 부하계획 문서와 PLAN 에 반영
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 75
estimatedFiles: 2
created: 2026-08-24
createdAt: 2026-08-24T14:40:00Z
dependsOn: [T-1672]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
independentStream: load-harness-r91
plannerNote: PLAN 141 행 R-91 chain 54/N — T-1671 설계 ⑥ 의 두 번째 slice(direct 문서 반영), 실측 0
---

# T-1673 — S2 person leg devset 조회 교체의 집행 사실을 부하계획 문서와 PLAN 에 반영

## Why

[T-1671](T-1671-s2-devset-dataset-swap-design.md) 이 `docs/ops/load-resilience-test-plan.md`
`#### S2 dataset 교체 설계 (사전 박제)` 소절 **⑥** 에 집행 순서를 `1. (pr) 교체 집행` →
`2. (direct) 문서 반영` **2 task 로 못 박았고**, 그 **1 번은 [T-1672](T-1672-s2-devset-dataset-swap-exec.md)
가 PR #1333 → main `27953b24`(2 파일 `+267/-33`) 로 이미 끝냈다**. 본 task 는 남은 **2 번**
그대로다 — 코드가 main 에 들어간 사실을 계획 문서와 PLAN 에 박제해, 설계 문서만 읽은 다음 turn 이
"S2 는 아직 합성 person 30 위에서 돈다" 로 오독하는 drift 를 닫는다.

문서 갱신을 코드와 같은 commit 에 섞지 않는 이유는 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 이다
(`docs/` 만 바꾸므로 rule 1 에 따라 `commitMode: direct`). 미착수 확인도 마쳤다 —
`load-resilience-test-plan.md` · `PLAN.md` 에 `T-1672` 문자열이 **0 건**이라 main 선반영은 없다.

본 task 는 **실측을 하지 않는다**. S2 첫 실 dispatch 와 `§3.1` 회차 기록은 설계 ⑥ 이 명시한
**세 번째 task** 소관이며, 그 전까지 S2 축 실측 회차는 여전히 **0 회**다. 따라서 `§3` 표의 S2 축
임계(p95 3000ms · `baseline 후 fix` 표기)도 이번에 손대지 않는다(설계 ⑤ 승계).

## Required Reading

- `docs/ops/load-resilience-test-plan.md` `67~155 행` 의 `#### S2 dataset 교체 설계 (사전 박제)`
  소절 — 본 task 의 **정본 명세**. 특히 `137~152 행` 의 ⑥ split 2 항목(1 = pr 교체 집행 완료,
  2 = 본 task) 과 ⑤ 임계 무변경 조항.
- 같은 문서 `789~797 행` 부근 `§5` item 5 의 문단 **"함께 좁혀진 것은 S2 축의 *설계* 다"**
  (`791 행` 시작) — T-1671 이 "설계일 뿐 집행 · 실측이 0 이라 잔여 항목 해소 표기는 하지 않는다"
  로 닫아둔 곳. 본 task 가 **설계 → 집행 완료(실측은 여전히 0)** 로 한 칸 전진시킬 유일한 지점.
- `docs/PLAN.md` `141 행`(`- 100~200명 / 50~100 repo / ~1000 confluence page / **1h 이내** (R-91)`
  로 시작하는 sub-bullet) 의 **꼬리** — 직전 slice 들(T-1669 · T-1671)이 append 한 형태를 그대로
  따른다. `140 행` 의 `- [ ] **성능 검증**:` checkbox 는 **건드리지 않는다**.
- `test/load/s2-read.js` 의 `45~47 행`(`DEVSET_EMAIL_DOMAIN` 사본 상수 + 정본 경로 주석) ·
  `84~97 행`(`GET /api/persons` → `filter` → `slice(0, SEED_PERSONS)` → `map` 단일 식 +
  `[s2-read] devset 표본 취득 …명 / 필터 통과 …건 / 상한 …명` 로그) · `teardown()` —
  문서에 적을 **사실의 원문**. 추정으로 쓰지 말고 이 파일에서 확인한 것만 적는다.
- `git show --stat 27953b24` 로 확인 가능한 머지 사실(2 파일 `+267/-33`, PR #1333).

## Acceptance Criteria

- [ ] `docs/ops/load-resilience-test-plan.md` `§5` item 5 의 **"함께 좁혀진 것은 S2 축의 *설계* 다"**
      문단이 **설계 → 집행 완료**로 갱신된다. 다음 사실을 모두 포함할 것: T-1672 (PR #1333 → main
      `27953b24`, 2 파일 `+267/-33`) 가 ① person leg 를 `GET /api/persons` + `@load.devset.test`
      필터 + `slice(0, SEED_PERSONS)` 단일 식으로 전환 ② `teardown()` person DELETE 루프 제거로
      공유 dataset 보존(group / part DELETE 는 유지) ③ `K6_SEED_PERSONS` 숫자 `30` · 정규화 표현 ·
      3 자 parity 무변경(의미만 "표본 상한") ④ drift-guard 단언 (a)~(g) 를 같은 commit 에서 갱신.
- [ ] 같은 문단이 **S2 축 실측은 여전히 0 회**임을 명시하고, `§5` item 5 의 **잔여 개수는 `1 개`
      그대로**(실 수집 왕복 축) 유지한다 — 본 교체는 잔여 ① 의 해소 근거가 아니다. `② · ③` 표기도
      무변경.
- [ ] `#### S2 dataset 교체 설계 (사전 박제)` 소절 **⑥ 의 1 번 항목**에 집행 완료 pointer
      (T-1672 · PR #1333 · main `27953b24`)가 **1~2 줄**로 append 되고, **2 번 항목이 본 task 로
      닫힌다**는 사실이 함께 적힌다. 설계 ①~⑤ 본문의 판단 문장은 **한 글자도 고치지 않는다**
      (사후 정당화 방지 — 설계는 박제된 그대로 둔다).
- [ ] `docs/PLAN.md` `141 행` 꼬리에 S2 person leg 교체 사실이 append 된다(직전 slice 형태 승계).
      `140 행` checkbox `- [ ] **성능 검증**:` 는 `[ ]` 그대로 — 실측 0 회라 완료 표기 금지.
- [ ] `docs/ops/load-resilience-test-plan.md` `§3` 표의 S2 축 3 행(p95 `< 3s` · p50/throughput
      `baseline 후 fix` · error rate `< 1%`)이 **문자 단위로 무변경**임을 `git diff` 로 확인
      (설계 ⑤). `§3.1` 에 새 회차 소절 **추가 0**(실 run 0 회).
- [ ] 변경 파일이 정확히 **2 개**(`docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md`)이고
      `git diff --stat` 이 `docs/` 밖 경로를 **하나도** 포함하지 않는다 — `test/` · `src/` ·
      `.github/workflows/` · `package.json` 변경 0(§3.1 rule 1 유지).
- [ ] `pnpm test` 가 기존과 동일하게 green(453 suite / 13,009 test 기준) — doc-only 변경이라
      회귀 0 임을 확인한다. (R-112 4 항목은 코드 변경 0 인 direct doc task 라 해당 없음 —
      새 public symbol · 분기 추가 0.)
- [ ] 문서 본문은 한국어, 경로 · 식별자 · 수치는 영어/원문 그대로(§12).

## Out of Scope

- **실 dispatch 금지** — `load-k6.yml` 을 돌려 S2 수치를 얻는 것은 설계 ⑥ 이 명시한 **세 번째
  task** 다. 본 task 에서 `gh workflow run` 을 호출하지 않는다.
- **임계 숫자 변경 금지** — `§3` 표의 S2 p95 3000ms · `baseline 후 fix` 표기 · S1 축 900ms 전부
  무변경. `s2-read.js` 의 임계 배열도 건드리지 않는다.
- **코드 · spec · workflow 변경 금지** — `test/load/s2-read.js`,
  `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts`,
  `.github/workflows/load-k6.yml` 는 읽기 전용. 문서와 코드가 어긋나 보이면 고치지 말고
  Follow-ups 에 적는다.
- **`K6_SEED_PERSONS` 상한 `30` → `133` 상향 검토 금지** — 설계 ③ 이 "S2 첫 실측 이후 별도 판단"
  으로 미뤘다.
- **S3(`s3-concurrent.js`) dataset 교체 금지** — 설계가 명시적으로 범위 밖으로 남긴 별도 slice.
- **`§5` item 5 의 잔여 ① 해소 표기 금지** — 실 수집 왕복 축은 여전히 0 이다.
- **PLAN R-92 mega-bullet prune 금지** — 별도 오너 지시 backlog(`PLAN.md` 146 행).

## Suggested Sub-agents

`implementer` → (doc-only 이므로 tester 는 `pnpm test` green 확인만)

## Follow-ups

(작성 시점 없음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
