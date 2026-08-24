---
id: T-1677
title: S1 stub baseline 임계 900ms → 1100ms 문서 동기 (규칙 ④ split 뒷단, 부하계획 §3 · 규칙 소절 · §5)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 45
estimatedFiles: 1
independentStream: load-k6-s1-baseline
dependsOn: [T-1676]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
created: 2026-08-25
plannerNote: P5 R-91 chain 58/N — T-1676 Follow-up ① (규칙 ④ split 뒷단 문서 direct, 코드는 이미 main ebe6d8f8 에 1100 박제)
---

# T-1677 — S1 stub baseline 임계 900ms → 1100ms 문서 동기 (규칙 ④ split 뒷단)

## Why

[T-1675](T-1675-load-k6-s1-11th-run-recovery.md) 가 S1 11 회차(run `32746598803`, p95 **967.52ms**)에서 [T-1668](T-1668-s1-stub-baseline-gate-refix-rule.md) 재확정 규칙의 트리거 **①-(a)** 와 **①-(b)** 를 모두 충족시켰고, 규칙 ② 산정식으로 새 관찰용 임계 **`1100ms`** 를 기계 산정했다. 규칙 ④ 는 그 집행을 **2 task split** 으로 못 박았고([CLAUDE.md](../../CLAUDE.md) `§3.1` rule 3), **앞단 (i) 코드 `pr`** 은 [T-1676](T-1676-s1-stub-baseline-threshold-code-sync.md)(PR #1334 → main `ebe6d8f8`)이 이미 집행했다 — `test/load/s1-batch.js` 의 `STUB_BASELINE_P95_MS = 1100` 과 drift guard smoke 의 `S1_STUB_BASELINE_P95_MS = 1100` 이 main 에 박제돼 있다. 본 slice 는 규칙 ④ 가 남긴 **뒷단 (ii) 문서 `direct`** 뿐으로, [부하계획](../ops/load-resilience-test-plan.md) 의 **규범 서술** 에 남은 `900` 잔재를 `1100` 으로 맞춘다. 현재 문서는 코드와 갈려 있어(`§3` 표는 `≤ 900ms`, 코드는 `1100`) 다음 회차 판정자가 어느 쪽을 정본으로 볼지 갈린다. PLAN `140~141 행` R-91 chain.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — 본 slice 가 유일하게 바꾸는 파일. 다음 5 지점만 본다:
  - `180 행` — `§3` 임계 표의 S1 관찰용 p95 row (`≤ 900ms (stub 조건 baseline, 표본 133)`).
  - `191~194 행` — `- **S1 관찰용 p95 임계 도출식(본 회차 확정)**` 각주 (T-1644 의 3 표본 → `900ms` 도출).
  - `195~205 행` — `- **위 900ms 는 REQ-047 판정 임계가 아니다**` 각주 (본문에 `900ms` 3 회 · `STUB_BASELINE_P95_MS = 900` · `p(95)<900` 포함).
  - `213~221 행` — `- **각주 — 임계 fix 시점**` (T-1644 이력 서술, `100ms 올림 **900ms**` 포함).
  - `222~250 행` — `- **S1 관찰용 p95 게이트 재확정 규칙 (사전 박제, T-1668)**` 소절 — ①-(a) 의 `p(95)<900` 표기와 ④ 집행 경로.
  - `856~870 행` — `§5` item 5 의 `p95 **≤ 900ms(stub 조건 baseline, 표본 133)**`.
  - `714~726 행` — 11 회차 소절의 **산정 결과 4 종**(표본 8 개 · 평균 **786.13ms** · 표본표준편차 **81.35ms** · 평균+3σ **1030.18ms** → 올림 **1100ms**). **읽기 전용** — 본 slice 가 갱신 서술에 인용할 근거값 출처다.
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `44~46 행` — `STUB_BASELINE_P95_MS = 1100;` 가 이미 main 에 박제됐음을 **확인만** (읽기 전용, 본 slice 는 코드 무변경).

## Acceptance Criteria

- [ ] `§3` 임계 표 (`180 행`) 의 S1 관찰용 p95 row 임계가 `≤ 1100ms (stub 조건 baseline, 표본 133)` 로 갱신됐다. 같은 row 의 근거 칸(`회귀 관찰 — REQ-047 판정 임계 아님`)은 무변경.
- [ ] `S1 관찰용 p95 임계 도출식` 각주 (`191~194 행`) 가 **현행 임계 1100ms 기준**으로 갱신됐고, 규칙 ② 가 요구하는 **산정 4 종** — 표본 목록(실 scale 8 회차) · 평균 **786.13ms** · 표본표준편차 **81.35ms** · 올림 전 **1030.18ms** — 이 모두 명시됐다. T-1644 의 원 도출(3 표본 · `809.38ms` → `900ms`)은 **이력으로 보존**하되 현행 임계가 아님이 문장으로 구분된다.
- [ ] `위 900ms 는 REQ-047 판정 임계가 아니다` 각주 (`195~205 행`) 의 규범 수치가 전부 `1100` 으로 동기됐다 — 제목의 `900ms`, 본문 서술의 `900ms`, `STUB_BASELINE_PERSONS = 133` 옆 `STUB_BASELINE_P95_MS = 900` → `1100`, 임계 배열 서술의 `p(95)<900` → `p(95)<1100`. **성격 구분 서술**(REQ-047 판정 임계는 `FULL_RUN_BUDGET_MS` 1h 예산 그대로)은 문장 그대로 유지.
- [ ] `각주 — 임계 fix 시점` (`213~221 행`) 의 T-1644 이력 서술(`809.38 → 100ms 올림 900ms`)은 **소급 치환하지 않고 보존**하되, 그 뒤에 현행 임계가 T-1675 산정 · T-1676/T-1677 집행으로 **1100ms** 임을 가리키는 pointer **1 줄**이 추가됐다.
- [ ] T-1668 규칙 소절 (`222~250 행`) 이 갱신됐다 — ①-(a) 의 게이트 문자열이 `p(95)<1100` 으로, ④ 집행 경로에 본 회차 집행 완료 pointer(**(i) 코드** = T-1676 PR #1334 → main `ebe6d8f8`, **(ii) 문서** = 본 task)가 각각 박제. 규칙 ①~④ 의 **판정 논리 자체는 무변경**(트리거 조건 · 산정식 · 표본 취급 · split 요구 모두 그대로).
- [ ] `§5` item 5 (`856~870 행`) 의 `p95 **≤ 900ms(stub 조건 baseline, 표본 133)**` 가 `≤ 1100ms` 로 갱신되고, 임계 확정 주체가 T-1644 단독이 아니라 **T-1644 확정 → T-1675 재산정 → T-1676/T-1677 집행** 임이 한 줄로 반영됐다.
- [ ] **`§3.1` 회차 기록(`251~807 행`)은 한 글자도 바뀌지 않았다** — 6~11 회차 소절의 `p(95)<900` · `900ms 게이트까지 여유` 같은 표기는 **그 시점 실제 게이트 문자열**이라 소급 치환 금지(§12 "전면 소급 치환 금지" 승계). `git diff` 로 해당 행 범위 변경 0 을 확인.
- [ ] `grep -n "900" docs/ops/load-resilience-test-plan.md` 결과에 남은 `900` 이 **모두** ① `§3.1` 회차 기록 ② T-1644 이력 서술 중 하나로 분류된다 (규범 서술에는 0 개). task 완료 노트에 잔존 건수와 분류를 1 줄로 적는다.
- [ ] `git diff --name-only` 가 `docs/ops/load-resilience-test-plan.md` + driver bookkeeping(`docs/STATE.json` · `docs/tasks/T-1677-*.md` · `docs/progress/journal-*.md`) 외에 **아무 파일도 포함하지 않는다** — `test/` · `.github/workflows/` · `src/` · `package.json` 무변경.
- [ ] `pnpm lint` (문서 변경이라 무영향 확인용) 또는 최소한 markdown 렌더 확인 — 표 파이프 정렬이 깨지지 않았고 상대 링크가 유효하다.

**R-112 적용 여부**: 본 task 는 `commitMode: direct` **doc-only** 이며 production code · spec · workflow 를 0 LOC 건드린다. CLAUDE.md §3.2 R-110 의 "direct-mode doc-only commit 만 본 규칙 면제" 에 해당하므로 tester 호출 · unit test 추가 의무 **없음**. 코드 쪽 임계는 T-1676 이 drift guard mutation 대조군까지 이미 cover 했다.

## Out of Scope

- `test/load/s1-batch.js` · `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 등 **코드 파일 일체** — T-1676 이 이미 `1100` 으로 동기했다. 재확인만 하고 손대지 않는다(손대면 `commitMode` 가 갈려 §3.1 rule 3 위반).
- `.github/workflows/load-k6.yml` 의 S2 step `if: always()` 부재 문제 — T-1674 Follow-up ③ / T-1676 Follow-up ② 승계 건으로 **별도 `pr` slice**. 본 slice 는 워크플로 무변경.
- **새 k6 run dispatch 금지** — 12 회차 실측은 본 task 범위 밖이다. 본 slice 는 이미 회수된 11 회분 표본만 인용한다.
- `§3.1` 회차 기록의 소급 치환 · outlier 제거 · 표본 재계산 — 규칙 ③ 이 명시 금지.
- S2 · S3 축의 `baseline 후 fix` 표기 — 해당 축 실측이 여전히 0 회라 무변경.
- 임계 **하향** 검토 — 규칙 ③ 이 금지.

## Suggested Sub-agents

`implementer` 단독 (doc-only inline-amend, tester 불요 — 위 R-112 적용 여부 참조).

## Follow-ups

- (승계) `.github/workflows/load-k6.yml` `195 행` 근처 S2 step 에 `if: always()` 부재 → S1 게이트 red 시 S2 · S3 가 `skipped` 되어 dispatch 1 회가 통째로 소진된다. T-1674 Follow-up ③ → T-1676 Follow-up ② 승계, `pr` slice 필요.
