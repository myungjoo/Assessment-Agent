---
id: T-1698
title: S3 latency cliff 판정 규칙 사전 박제 (단계 표본 2 개 확보 후, 부하계획 §3 신규 소절 + §5 + PLAN 141 행)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047, REQ-048]
estimatedDiff: 130
estimatedFiles: 2
independentStream: load-k6-s3-baseline
dependsOn: [T-1694]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-25
plannerNote: P5 R-91 chain 63/N — T-1694 Follow-up ② 의 "규칙 사전 박제 → 기계 적용" 2 단계 중 앞단(규칙만, 판정 0)
---

# T-1698 — S3 latency cliff 판정 규칙 사전 박제

## Why

[PLAN.md](../PLAN.md) `141 행` (R-91 부하 검증 — 오너 최우선 지시) chain 의 다음 칸이다.
[T-1691](T-1691-s3-stage-custom-trend.md) 이 단계별 custom `Trend` 3 행을 배선한 뒤
[T-1692](T-1692-s3-stage-trend-first-dispatch-record.md) (S3 3 회차) 와
[T-1694](T-1694-s3-stage-trend-second-dispatch-record.md) (S3 4 회차) 가 단계 분해 표본을 **2 개**
확보했고, T-1694 는 그 2 표본에 대해 "`latency cliff` 유무 판정 · `§3` 표 문구 fix 는 하지 않는다 —
**규칙 사전 박제 → 기계 적용 2 단계 승계**" 로 명시 이월했다 (`§3.1` `#### S3 4 회차` 의 `§3` 표 S3 축
무변경 판정 문단).

본 slice 는 그 2 단계 중 **앞단(규칙만)** 이다. 지금 `§3` 표 S3 행의 `latency cliff 부재` 는 임계 `✓`
개수 · `http_req_failed` · interrupted iteration · progress 누적 완료 수라는 **정황 4 종**으로만 적혀
있고 ([T-1687](T-1687-stagewise-percentile-export-design.md) 설계 소절의 문제 (b) 가 그 공백을 정의),
단계별 Trend 로 값이 생긴 지금도 **어떤 수치를 어떻게 보면 cliff 인지** 가 문서 어디에도 없다. 규칙
없이 판정부터 하면 그 회차 수치에 맞춘 사후 정당화가 되고 다음 회차 판정자가 같은 기준을 재추론한다 —
[T-1668](T-1668-s1-stub-baseline-gate-refix-rule.md) 재확정 규칙이 S1 축에서 먼저 굳혀 T-1695 ~ T-1697
집행이 기계적으로 흐른 것과 같은 구조를 S3 축에 세운다. 따라서 본 slice 는 **규칙만 적고 판정은
하지 않는다**.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — 주 변경 파일. 다음 지점만 본다
  (행 좌표는 현행 main 기준, 삽입으로 밀리면 재확인):
  - `187 행` ~ `201 행` — `§3` 측정 지표·임계 표. `201 행` 이 S3 행 (`p95 저하 곡선` / `latency cliff 부재`).
    **읽기 전용 — 본 slice 는 표 문자 단위 무변경.**
  - `298 행` ~ `393 행` — `#### 단계별 percentile export 설계 (사전 박제, T-1687)` 소절 전체.
    특히 `310~319 행` 의 문제 (a)·(b) 정의, `339 행` ~ `346 행` 의 조항 ② (판정 임계 불변 — export 는 관찰 전용),
    `376 행` ~ `393 행` 의 조항 ⑥ (경로 β custom Trend 채택 + 후보 A·B 층위 구분). **신규 소절을 이 소절 바로
    다음 · `### 3.1` (`394 행`) 앞에 삽입한다.**
  - `1851 행` ~ `1862 행` — `#### S3 3 회차` 의 단계별 Trend 3 행 원문 (단계 1 p95 `5.01ms` · p99 `6.55ms` /
    단계 2 `21.33ms` · `26.25ms` / 단계 3 `21.4ms` · `26.12ms`). 규칙 산출의 표본 1.
  - `1930 행` ~ `1948 행` — `#### S3 4 회차` 의 단계별 Trend 3 행 원문 (단계 1 p95 `4.36ms` · p99 `7.34ms` /
    단계 2 `20.01ms` · `64.93ms` / 단계 3 `18.24ms` · `23.08ms`) + 2 표본 Δ. 규칙 산출의 표본 2.
  - `1966 행` ~ `1970 행` — `#### S3 4 회차` 의 `§3` 표 S3 축 무변경 판정 문단 = 본 slice 를 지목한 이월 문장.
    **꼬리 add-only pointer 1 줄을 붙일 지점 (기존 문장 · 수치 삭제 0).**
  - `2008 행` 이후 `§5` item 5 — 꼬리에 집행 문단 1 개 append 할 지점.
  - `169 행` · `165 행` ~ `186 행` — `### S3. 동시 요청 내성` 의 목표 서술 + `options.stages` 3 단
    (`10s→5 VU` · `10s→20 VU` · `5s→0`). 단계 간 VU 증가 비 (5 → 20 = **4 배**) 는 규칙 산출의 근거 입력.
- [docs/tasks/T-1668-s1-stub-baseline-gate-refix-rule.md](T-1668-s1-stub-baseline-gate-refix-rule.md) —
  S1 축의 동형 선례 (규칙 사전 박제 → 기계 집행). 규칙 소절의 조항 구성 · 트리거 · 집행 split 서술 방식의 참조 기준.
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) `34 행` (`STAGE_TAG_KEY`) · `68~74 행`
  (`thresholds` 4 항목) — **확인만** (읽기 전용, 본 slice 는 코드 0 LOC).
- [docs/PLAN.md](../PLAN.md) `140~141 행` — R-91 성능 검증 bullet. 꼬리 append 지점.

## Acceptance Criteria

- [ ] [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 에
      `#### S3 latency cliff 판정 규칙 (사전 박제, T-1698)` 소절을 **T-1687 설계 소절 다음 · `### 3.1` 앞** 에
      신설한다. 소절은 아래 6 조항을 **모두** 포함한다.
- [ ] **조항 ① 판정 입력** — 1 차 입력은 단계별 custom Trend `s3_stage_duration_1` · `_2` · `_3` 의
      **p95 · p99** (T-1691 배선 + T-1688 `p(99)` 열) 임을 명시하고, 기존 **정황 4 종** (임계 `✓` 개수 ·
      `http_req_failed` · interrupted iteration · progress 누적 완료 수) 은 **보조 근거로 강등** 됨을 적는다
      (정황 4 종 서술 자체는 삭제하지 않는다).
- [ ] **조항 ② 판정식** — 단계 간 상승을 **비율 1 식**(예: `p95(단계 k+1) / p95(단계 k)`)으로 정의하고,
      ㉮ 배수 임계 ㉯ **절대 하한 가드** (수 ms 대 미세 절대차가 배수로 증폭되는 것을 차단하는 최소 절대 증가폭)
      두 값을 굳힌다. 두 값은 확보된 **2 표본의 실측 범위** 와 단계 간 **VU 증가 비 4 배** (5 VU → 20 VU) 에
      근거해 산출하고, 산출 근거 문장을 임계 숫자와 **같은 자리에** 적는다. 임의 상수를 근거 없이 적지 않는다.
- [ ] **조항 ③ 표본 요건** — 판정에 필요한 **최소 단계 분해 표본 수** 와 **연속 동일 결론 요건** 을 명시하고,
      미달 시 결론은 **"판정 보류"** 임을 적는다. 현재 표본이 몇 개인지 (2 개) 를 사실로만 적는다.
- [ ] **조항 ④ 결론 3 값과 그 귀결** — `cliff 부재` / `cliff 있음` / `판정 보류` 3 값 각각이 `§3` 표 S3 행
      문구 (`latency cliff 부재`) 에 미치는 영향을 적는다 — 부재는 **문구 무변경**, 있음은 문구 fix 를 **별도 판정
      slice** 소관으로, 보류는 **표기 이월** 로 못 박는다.
- [ ] **조항 ⑤ 집행 split** — 규칙 적용(기계 판정)은 **별도 `direct` slice** 이며 본 소절과 **같은 commit 에서
      적용하지 않는다** 를 명시한다 (T-1668 → T-1695 ~ T-1697 선례 인용).
- [ ] **조항 ⑥ 판정면 불변** — 본 규칙은 **관찰 전용** 이라 [`s3-concurrent.js`](../../test/load/s3-concurrent.js)
      의 `thresholds` 배열 (`68~74 행` 4 항목) · 임계 숫자 · 판정 route tag · `options.stages` ·
      `summaryTrendStats` 는 **문자 단위 0 변경** 이고, 규칙이 red/green 을 만들지 않음을 T-1687 조항 ② 와 정합되게 적는다.
- [ ] **판정 0 검증** — 본 slice diff 어디에도 "cliff 가 있다 / 없다" 로 읽히는 **단정 문장이 없다**.
      2 표본 수치는 **규칙 산출 근거로 인용만** 하고 결론을 내지 않는다 (`git diff` 로 자기 점검).
- [ ] `§3.1` `#### S3 4 회차` 꼬리에 본 slice 를 가리키는 **add-only pointer 1 줄** 을 붙인다 — 그 소절의 기존
      문장 · 수치 **삭제 0**. 그 밖의 회차 기록 (`#### 1 회차` ~ `#### 15 회차` · `#### S2 *` · `#### S3 1~3 회차`) 은
      **문자 단위 무변경** ([CLAUDE.md](../../CLAUDE.md) `§12` 소급 치환 금지).
- [ ] `§5` item 5 꼬리에 본 slice 집행 문단 **1 개** append (`§5` 기존 문장 삭제 0).
- [ ] [PLAN.md](../PLAN.md) `141 행` 꼬리에 **1 문장** append. `140 행` checkbox 는 실 수집 축 미검증이므로
      **`[ ]` 유지**.
- [ ] `test/` · `src/` · `.github/workflows/` · `package.json` 변경 **0 LOC** (`git diff --stat` 으로 확인).
      새 `workflow_dispatch` · rerun · 실측 회수 **0** — 본 slice 는 기박제 로그 인용만 한다.
- [ ] 회분 표기 (`§3.1` 헤더의 `S1 15 회분 · S2 5 회분 · S3 4 회분`) 는 새 실측이 없으므로 **무변경**.
- [ ] `pnpm lint` 1 회 무경고. doc-only · production **0 LOC** 이므로 R-110 tester 의무 면제
      ([CLAUDE.md](../../CLAUDE.md) `§3.2`) — 이 사실을 완료 노트에 적는다.
- [ ] 변경 파일 **2 개** · diff **≤ 300 LOC** (`§3` cap).

## Out of Scope

- **`latency cliff` 유무 단정** — 본 slice 는 규칙만 굳힌다. 2 표본에 규칙을 기계 적용하는 판정은 **다음 slice** 소관.
- **`§3` 임계 표 S3 행 (`latency cliff 부재` · `error rate < 1%`) 문구 fix** — 조항 ④ 가 정한 대로 결론이 나온 뒤
  별도 slice 가 다룬다.
- **코드 변경 일체** — `test/load/*` · drift-guard smoke spec · `load-k6.yml` · `package.json` 무변경.
- **새 dispatch · rerun · 새 실측 회수** — 기존 run 로그의 기박제 수치만 인용한다.
- **S1 · S2 축 규칙 확장** — 본 규칙은 S3 단계 분해 축 한정. S1 관찰 게이트는 T-1668 규칙 소관.
- **T-1687 조항 ⑥ 꼬리의 표시 수단 (후보 A · B) 재결정** — T-1688 의 `p(99)` 배선으로 이미 실배선된 축이라
  본 slice 에서 다시 고르지 않는다.
- **회차 기록 소급 치환** — `#### S3 4 회차` 꼬리 add-only pointer 1 줄 외의 회차 기록 편집 금지.

## Suggested Sub-agents

`implementer` (doc 작성) → (tester 면제 — direct doc-only, production 0 LOC)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
