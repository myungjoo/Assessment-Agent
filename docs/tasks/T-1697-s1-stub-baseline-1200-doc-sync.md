---
id: T-1697
title: S1 stub baseline 관찰 임계 1100ms → 1200ms 문서 동기 (규칙 ④ split 뒷단, 부하계획 §3 · 규칙 소절 · §5 + PLAN 141 행)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047]
estimatedDiff: 70
estimatedFiles: 2
independentStream: load-k6-s1-baseline
dependsOn: [T-1696]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-25
plannerNote: P5 R-91 chain 62/N — T-1696 Follow-up ① (규칙 ④ split 뒷단 문서 direct, 코드는 이미 main 5fb0931c 에 1200 박제)
---

# T-1697 — S1 stub baseline 관찰 임계 1100ms → 1200ms 문서 동기 (규칙 ④ split 뒷단)

## Why

[T-1695](T-1695-s1-15-s2-5-log-reread.md) 가 S1 **15 회차**(run `32843613484`) 로그를 재독하며 [T-1668](T-1668-s1-stub-baseline-gate-refix-rule.md) 재확정 규칙의 트리거 **①-(a)**(`✗ 'p(95)<1100' p(95)=1.15s`) 와 **①-(b)**(실 scale 표본 12 개 평균 **824.73ms** + 3 × 표본표준편차 **124.70ms** = **1198.83ms** > 현행 임계) 를 **둘 다** 발화시켰고, 규칙 ② 산정식으로 새 관찰용 임계 **`1200ms`** 를 기계 산정했다. 규칙 ④ 는 그 집행을 **2 task split** 으로 못 박았고([CLAUDE.md](../../CLAUDE.md) `§3.1` rule 3), **앞단 (i) 코드 `pr`** 은 [T-1696](T-1696-s1-stub-baseline-1200-code-sync.md)(PR #1340 → main `5fb0931c`) 이 이미 집행했다 — `test/load/s1-batch.js` 의 `STUB_BASELINE_P95_MS = 1200` 과 drift guard smoke 의 `S1_STUB_BASELINE_P95_MS = 1200` 이 main 에 박제돼 있다. 본 slice 는 규칙 ④ 가 남긴 **뒷단 (ii) 문서 `direct`** 뿐으로, [부하계획](../ops/load-resilience-test-plan.md) 의 **규범 서술** 에 남은 `1100` 잔재를 `1200` 으로 맞춘다. 지금 문서와 코드가 갈려 있어(`§3` 표는 `≤ 1100ms`, 코드는 `1200`) 다음 회차 판정자가 어느 쪽을 정본으로 볼지 갈린다 — 900 → 1100 회차의 T-1676(코드) → T-1677(문서) 선례를 그대로 반복한다. PLAN `140~141 행` R-91 chain.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — 본 slice 의 주 변경 파일. 다음 지점만 본다 (행 좌표는 현행 main 기준, 삽입으로 밀리면 재확인):
  - `196 행` — `§3` 임계 표의 S1 관찰용 p95 row (`≤ 1100ms (stub 조건 baseline, 표본 133)`).
  - `207~212 행` — `- **S1 관찰용 p95 임계 도출식(현행 1100ms — T-1675 재산정)**` 각주 (실 scale 8 표본 · 평균 786.13 · σ 81.35 · 올림 전 1030.18 → `1100ms`).
  - `213~217 행` — `- **위 임계의 원 도출(T-1644)은 이력이며 현행 임계가 아니다**` 각주 (`900ms` 이력 — **읽기 전용, 소급 치환 금지**).
  - `218~228 행` — `- **위 1100ms 는 REQ-047 판정 임계가 아니다**` 각주 (제목 · 본문의 `1100ms`, `STUB_BASELINE_P95_MS = 1100`, `p(95)<1100`, 집행 pointer `T-1676`).
  - `237~247 행` — `- **각주 — 임계 fix 시점**` (T-1644 이력 서술 + 현행 pointer `1100ms` · T-1675 산정 · T-1676/T-1677 집행).
  - `248~281 행` — `- **S1 관찰용 p95 게이트 재확정 규칙 (사전 박제, T-1668)**` 소절 — ①-(a) 의 `p(95)<1100`(`253 행`) 과 ④ 집행 경로의 "첫 집행(900ms → 1100ms) 은 완료됐다"(`273~278 행`).
  - `1170~1196 행` — `#### 15 회차` 의 트리거 발화 판정 + **산정 4 종**(표본 12 개 · 평균 **824.73ms** · 표본표준편차 **124.70ms** · 올림 전 **1198.83ms** → 올림 후 **1200ms**) 과 `§3` 표 무변경 판정 문단. **인용 근거이자 add-only pointer 를 붙일 지점** — 기존 수치 · 문장은 읽기 전용.
  - `2013~2016 행` — `§5` item 5 의 임계 확정 주체 서술 + `p95 **≤ 1100ms(stub 조건 baseline, 표본 133)**`.
  - `2954 행` — `§5` item 5 의 `임계 재확정 규칙 pointer (T-1668)` 안 `1100ms` 표기.
- [docs/PLAN.md](../PLAN.md) `140~141 행` — R-91 성능 검증 bullet. 꼬리 append 지점 (checkbox `140 행` 은 `[ ]` 유지).
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `44~46 행` — `STUB_BASELINE_P95_MS = 1200;` 이 이미 main 에 박제됐음을 **확인만** (읽기 전용, 본 slice 는 코드 무변경).
- [docs/tasks/T-1677-s1-stub-baseline-threshold-doc-sync.md](T-1677-s1-stub-baseline-threshold-doc-sync.md) — 900 → 1100 회차의 동형 선례. 갱신 범위 · 이력 보존 방식의 참조 기준.

## Acceptance Criteria

- [x] `§3` 임계 표 (`196 행`) 의 S1 관찰용 p95 row 임계가 `≤ 1200ms (stub 조건 baseline, 표본 133)` 로 갱신됐다. 같은 row 의 지표 칸 · 근거 칸(`회귀 관찰 — REQ-047 판정 임계 아님`) 은 문자 단위 무변경이고, 표의 다른 7 개 row(배치 완료 시간 · error rate · S2 3 행 · S3 2 행) 도 무변경이다.
- [x] `S1 관찰용 p95 임계 도출식` 각주 (`207~212 행`) 가 **현행 임계 1200ms 기준**으로 갱신됐고, 규칙 ② 가 요구하는 **산정 4 종** — 표본 목록(실 scale **12 개**) · 평균 **824.73ms** · 표본표준편차 **124.70ms** · 올림 전 **1198.83ms** — 이 모두 명시됐다. 근거 출처로 `§3.1` **15 회차** 를 가리킨다. 직전 T-1675 산정(8 표본 · 786.13 · 81.35 · 1030.18 → `1100ms`) 은 **이력으로 보존**하되 현행 임계가 아님이 문장으로 구분된다 (T-1644 `900ms` 이력 각주와 동형 처리).
- [x] `위 1100ms 는 REQ-047 판정 임계가 아니다` 각주 (`218~228 행`) 의 규범 수치가 전부 `1200` 으로 동기됐다 — 제목의 `1100ms`, 본문 서술의 `1100ms`, `STUB_BASELINE_P95_MS = 1100` → `1200`, 임계 배열 서술의 `p(95)<1100` → `p(95)<1200`, 숫자 동기 집행 주체 pointer 가 T-1676(PR #1334 → `ebe6d8f8`) 에 더해 **T-1696(PR #1340 → main `5fb0931c`)** 로 갱신. **성격 구분 서술**(REQ-047 판정 임계는 `FULL_RUN_BUDGET_MS` 1h 예산 그대로 · 표본 133 조건부 활성 · 기본 표본 10 run 영향 0) 은 논리 그대로 유지된다.
- [x] `각주 — 임계 fix 시점` (`237~247 행`) 의 T-1644 이력 서술(`809.38 → 100ms 올림 900ms`) 과 T-1675 재산정 서술은 **소급 치환하지 않고 보존**하되, 현행 임계가 **1200ms**(T-1695 산정 · T-1696 코드 / 본 task 문서 집행) 임을 가리키는 pointer 가 **1~2 줄** 추가됐다.
- [x] T-1668 규칙 소절 (`248~281 행`) 이 갱신됐다 — ①-(a) 의 게이트 문자열이 `p(95)<1200` 으로, 소절 머리의 `현행 **1100ms**` 가 `1200ms` 로, ④ 집행 경로에 **둘째 집행(1100ms → 1200ms)** 완료 pointer(**(i) 코드** = T-1696 PR #1340 → main `5fb0931c`, **(ii) 문서** = 본 task) 가 첫 집행 pointer 를 **지우지 않고** 이어 붙는 형태로 박제됐다. 규칙 ①~④ 의 **판정 논리 자체는 무변경**(트리거 조건 · 산정식 · outlier 제거 금지 · 하향 금지 · split 요구 · 성격 구분 불변 모두 문자 단위 그대로).
- [x] `§5` item 5 (`2013~2016 행`) 의 `p95 **≤ 1100ms(stub 조건 baseline, 표본 133)**` 가 `≤ 1200ms` 로 갱신되고, 임계 확정 주체 사슬이 `T-1644 확정 → T-1675 재산정 → T-1676/T-1677 집행` 에서 **`→ T-1695 재산정 → T-1696/T-1697 집행`** 까지 이어진 한 줄로 반영됐다. 같은 item 의 `임계 재확정 규칙 pointer (T-1668)` (`2954 행`) 안 `1100ms` 도 `1200ms` 로 동기됐다. item 5 의 **잔여 ① · ② · ③ 표기와 실측 회차 개수 서술은 무변경**(본 slice 는 새 실측 0).
- [x] `§3.1` 회차 기록의 기존 문장 · 수치는 **한 글자도 바뀌지 않았다** — 12~15 회차의 `p(95)<1100` · `1100ms 게이트 대비 여유` 같은 표기는 **그 시점 실제 게이트 문자열**이라 소급 치환 금지(CLAUDE.md §12 "전면 소급 치환 금지" 승계). 예외는 `#### 15 회차` 꼬리에 붙이는 **add-only pointer 1 줄**(본 slice 가 규칙 ④ 뒷단을 집행해 이월분이 해소됐다는 사실) 뿐이며, 그 문단의 기존 서술 삭제는 **0** 이다.
- [x] [PLAN.md](../PLAN.md) `141 행` R-91 bullet 꼬리에 본 slice 집행 사실 **1 문장** 이 append 됐다(관찰용 임계 문서 축 `1100` → `1200` 동기, 코드 축은 T-1696 이 선행). `140 행` checkbox 는 **`[ ]` 유지**(LLM stub · 실 수집 왕복 0 · 단일 iteration 조건 불변). 회차 개수 표기(S1 15 · S2 5 · S3 4) 는 새 실측이 0 이므로 무변경.
- [x] `grep -n "1100" docs/ops/load-resilience-test-plan.md` 결과에 남은 `1100` 이 **모두** ① `§3.1` 회차 기록 ② T-1675/T-1676/T-1677 이력 서술 중 하나로 분류된다 (규범 서술에는 **0 개**). 완료 노트에 잔존 건수와 분류를 1 줄로 적는다.
- [x] `git diff --name-only` 가 `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` + driver bookkeeping(`docs/STATE.json` · `docs/tasks/T-1697-*.md` · `docs/progress/journal-*.md`) 외에 **아무 파일도 포함하지 않는다** — `test/` · `.github/workflows/` · `src/` · `package.json` 무변경. 변경 파일 ≤ 5 · diff ≤ 300 LOC.
- [x] `pnpm lint` 1 회 무경고(문서 변경이라 무영향 확인용) 또는 markdown 렌더 확인 — 표 파이프 정렬이 깨지지 않았고 상대 링크가 유효하다.

**R-112 적용 여부**: 본 task 는 `commitMode: direct` **doc-only** 이며 production code · spec · workflow 를 0 LOC 건드린다. CLAUDE.md §3.2 R-110 의 "direct-mode doc-only commit 만 본 규칙 면제" 에 해당하므로 tester 호출 · unit test 추가 의무 **없음**. 코드 쪽 임계와 drift guard mutation 대조군은 T-1696 이 이미 cover 했다.

## Out of Scope

- `test/load/s1-batch.js` · `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 등 **코드 파일 일체** — T-1696 이 이미 `1200` 으로 동기했다. 재확인만 하고 손대지 않는다(손대면 `commitMode` 가 갈려 CLAUDE.md §3.1 rule 3 위반).
- **새 `workflow_dispatch` · rerun · 재시도 0** — 16 회차 실측 · 새 관찰 임계가 실 run 에서 `✓` 로 도는지 확인은 본 slice 범위 밖이다(T-1696 Follow-up ②). 본 slice 는 이미 회수된 15 회분 표본만 인용한다.
- `§3.1` 회차 기록의 소급 치환 · 표본 재계산 · outlier 제거 — 규칙 ② · ③ 이 명시 금지. 산정 4 종은 T-1695 가 박제한 값을 **그대로 인용** 하고 재계산하지 않는다.
- 임계 **하향** 검토 및 `FULL_RUN_BUDGET_MS` · `BATCH_P95_MS` 외삽 산식 · `http_req_failed: ["rate<0.01"]` 같은 **판정 게이트** 서술 — 규칙 ③ 과 성격 구분 불변 조항이 금지.
- `p99` "미확보" 표기 소급 치환 · 단계별 percentile export 설계 소절(T-1687) 갱신 — 별도 chain(T-1694 Follow-up ①) 소관.
- S2 · S3 축의 `baseline 후 fix` 표기 — 해당 축 확정 근거가 아직 없어 무변경.
- `140 행` checkbox 를 `[x]` 로 바꾸는 것 — 실 수집 축 미검증이라 금지.

## Suggested Sub-agents

`implementer` (문서 편집 전담, doc-only 이므로 architect · tester 불요)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 노트

**Status: DONE** (2026-08-25, main direct commit)

- 규칙 ④ 뒷단 **(ii) 문서 `direct`** 집행 완료 — [부하계획](../ops/load-resilience-test-plan.md) 의 **규범 서술** 6 지점을 `1100` → `1200` 으로 동기했다: `§3` 임계 표 S1 관찰용 p95 row · 도출식 각주(현행 1200ms / T-1695 재산정, 산정 4 종 = 12 표본 · 824.73 · 124.70 · 1198.83) · 성격 구분 각주(`STUB_BASELINE_P95_MS = 1200` · `p(95)<1200` · 집행 pointer 에 T-1696 추가) · 임계 fix 시점 각주 pointer · T-1668 규칙 소절(머리 `1200ms` · ①-(a) 게이트 문자열 · ④ 둘째 집행 pointer) · `§5` item 5(`≤ 1200ms` + 확정 사슬 `→ T-1695 재산정 → T-1696/T-1697 집행` + T-1668 pointer).
- **이력 보존** — T-1644 `900ms` · T-1675 `1100ms` 서술은 소급 치환 0 이고 "현행 임계가 아니다" 문장으로 구분했다. `§3.1` 회차 기록은 **삭제 0**, 예외는 `#### 15 회차` 꼬리의 add-only pointer 1 개뿐이다.
- **판정 게이트 무변경 확인** — `FULL_RUN_BUDGET_MS` · `BATCH_P95_MS` 외삽 산식 · `http_req_failed: ["rate<0.01"]` 서술은 diff 에 단 한 줄도 등장하지 않는다(`git diff | grep` 로 전수 확인). 코드 축(`test/` · `src/` · `.github/workflows/` · `package.json`) 은 **0 LOC**.
- **잔존 `1100` 전수 분류 (규범 서술 0 개)** — `grep -n "1100" docs/ops/load-resilience-test-plan.md` 결과 **59 건**: ① `§3.1` 회차 기록(11~15 회차 · S2 · S3 기록, add-only pointer 1 줄 포함) **38 건** · ② T-1675/T-1676/T-1677 이력 서술(`§3` 각주 · 규칙 ④ 첫 집행 pointer) **11 건** · ③ `§5` item 5 의 회차 요약 · 이력 pointer **10 건**. 규범(현행 임계) 서술은 **0 건**이다.
- `pnpm lint` **무경고 1 회** + `§3` 표 파이프 5 개 정렬 유지 · 새 상대 링크 추가 0 확인.
- AC 11 항목 전부 `[x]` — 미달성 0. [PLAN.md](../PLAN.md) `141 행` 꼬리에 1 문장 append 했고 `140 행` checkbox 는 `[ ]` 유지(실 수집 왕복 여전히 0).
