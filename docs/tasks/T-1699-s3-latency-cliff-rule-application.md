---
id: T-1699
title: S3 latency cliff 판정 규칙 기계 적용 (2 표본 산출값 + 결론 박제, 부하계획 §3.1 + §5 + PLAN 141 행)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047, REQ-048]
estimatedDiff: 75
estimatedFiles: 2
independentStream: load-k6-s3-baseline
dependsOn: [T-1698]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-26
completedAt: 2026-08-25T16:48:00Z
plannerNote: P5 R-91 chain 64/N — T-1698 Follow-up 의 뒷단(규칙 ② 기계 대입 · 결론 박제, 규칙 재조정 0)
---

# T-1699 — S3 latency cliff 판정 규칙 기계 적용

## Why

[PLAN.md](../PLAN.md) `141 행` (R-91 부하 검증 — 오너 최우선 지시) chain 의 다음 칸이다.
[T-1698](T-1698-s3-latency-cliff-judgment-rule.md) 이 `#### S3 latency cliff 판정 규칙 (사전 박제, T-1698)`
소절로 판정 입력 · 판정식 · 표본 요건 · 결론 3 값의 귀결 · 집행 split · 판정면 불변 6 조항을 굳혔고,
그 조항 ⑤ 가 **규칙 적용은 같은 commit 이 아니라 별도 `direct` slice** 라고 못 박았다. 본 slice 가
그 뒷단이다 — 이미 확보된 **단계 분해 표본 2 개** ([T-1692](T-1692-s3-stage-trend-first-dispatch-record.md)
S3 3 회차 run `32833365988` · [T-1694](T-1694-s3-stage-trend-second-dispatch-record.md) S3 4 회차 run
`32843613484`) 에 규칙 조항 ② 를 **기계 대입** 해 산출값 (`R(1)` · `Δp95`) 과 결론을 박제한다.

본 slice 의 핵심 제약은 **규칙을 다시 만지지 않는 것** 이다. 산출 결과가 마음에 들지 않는다는 이유로
임계 `8.0` · 가드 `10ms` 를 조정하면 T-1698 이 막으려 한 사후 정당화가 그대로 재발한다. 규칙은
읽기 전용 입력이고, 본 slice 는 **계산과 기록** 만 한다. S1 축에서 T-1668 규칙이 T-1695 ~ T-1697 로
기계 집행된 것과 같은 구조다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — 주 변경 파일. 다음 지점만 본다
  (행 좌표는 현행 main `b226fe50` 기준, 삽입으로 밀리면 재확인):
  - `394 행` ~ `472 행` — `#### S3 latency cliff 판정 규칙 (사전 박제, T-1698)` 소절 **전문**. 본 slice 의
    규범 입력이며 **읽기 전용 — 문자 단위 무변경**. 특히 조항 ② 의 `R(1)` 정의 · 배수 임계 `8.0` ·
    절대 하한 가드 `Δp95 ≥ 10ms` · ㉰ p99 제외 · ㉱ 결합 규칙, 조항 ③ 표본 요건 (최소 2 개 · 최근 연속
    2 표본 동일 결론 · 미달 시 `판정 보류`), 조항 ④ 결론 3 값의 `§3` 표 귀결.
  - `187 행` ~ `201 행` — `§3` 측정 지표·임계 표. `201 행` 이 S3 행 (`p95 저하 곡선` / `latency cliff 부재`).
    **읽기 전용 — 결론이 `cliff 부재` 로 나오면 조항 ④ 에 따라 문자 단위 무변경.**
  - `1898 행` ~ `1974 행` — `#### S3 3 회차` 소절. 특히 단계별 Trend 3 행 원문과 `단계별 값 판정` bullet
    (단계 1 p95 **5.01ms** / 단계 2 p95 **21.33ms** / 단계 3 p95 **21.4ms**). **표본 1 의 입력.**
  - `1975 행` ~ `2058 행` — `#### S3 4 회차` 소절. 단계별 Trend 3 행 원문 (단계 1 p95 **4.36ms** /
    단계 2 p95 **20.01ms** / 단계 3 p95 **18.24ms**) + `§3` 표 S3 축 무변경 판정 문단 + T-1698 pointer 문단.
    **표본 2 의 입력이자 종합 결론 문단을 붙일 지점.**
  - `3150 행` 이후 `§5` item 5 꼬리 — 집행 문단 1 개 append 지점.
- [docs/tasks/T-1698-s3-latency-cliff-judgment-rule.md](T-1698-s3-latency-cliff-judgment-rule.md) — 앞단 slice
  의 Follow-ups (본 slice 를 지목한 이월 문장).
- [docs/PLAN.md](../PLAN.md) `140~141 행` — R-91 성능 검증 bullet. 꼬리 append 지점.
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) `68~74 행` (`thresholds` 4 항목) —
  **확인만** (읽기 전용, 본 slice 는 코드 0 LOC).

## Acceptance Criteria

- [ ] `§3.1` `#### S3 3 회차` 꼬리에 **add-only bullet 1 개** 를 붙여 규칙 조항 ② 의 기계 대입 결과를
      박제한다 — ㉮ `R(1) = p95(단계 2) / p95(단계 1)` 값 (소수 **둘째 자리** 반올림, 계산 원식을 숫자와
      함께), ㉯ `Δp95 = p95(단계 2) − p95(단계 1)` 값 (단위 `ms`), 그리고 ㉮ · ㉯ 각각의 임계 충족 여부와
      ㉱ 결합 규칙이 산출한 **본 표본 결론** 1 개. 그 소절의 기존 문장 · 수치 **삭제 0**.
- [ ] `§3.1` `#### S3 4 회차` 꼬리에도 같은 형식의 **add-only bullet 1 개** 를 붙여 표본 2 의 `R(1)` ·
      `Δp95` · 임계 충족 여부 · 표본 결론을 박제한다. 기존 문장 · 수치 **삭제 0**.
- [ ] `#### S3 4 회차` 꼬리 (위 bullet 다음) 에 **종합 결론 bullet 1 개** 를 추가한다 — 조항 ③ 표본 요건
      (단계 분해 표본 **2 개** · 최근 연속 2 표본 동일 결론) 의 충족 여부를 사실로 적고, 충족 시 결론 3 값
      (`cliff 부재` / `cliff 있음` / `판정 보류`) 중 규칙이 산출한 **하나** 를 명시한다. 두 표본의 결론이
      갈리면 조항 ③ 에 따라 `판정 보류` 로 적고 그 사유 (표본 수 미달 / 결론 불일치 중 무엇인지) 를 함께 적는다.
- [ ] **결론에 따른 `§3` 표 귀결을 조항 ④ 그대로 집행** — 결론이 `cliff 부재` 면 `§3` 표 S3 행
      (`p95 저하 곡선` / `latency cliff 부재`) 은 **문자 단위 무변경** 이고 그 사실을 종합 결론 bullet 에
      1 문장으로 적는다. `cliff 있음` 이면 표 문구 fix 는 **별도 slice 소관** 이므로 본 slice 에서 표를
      건드리지 않고 이월 문장만 적는다. `판정 보류` 면 표기를 **그대로 이월** 한다. 어느 경우에도 본 slice 의
      `§3` 표 diff 는 **0 줄** 이다 (`git diff` 로 자기 점검).
- [ ] **규칙 재조정 0 검증** — `#### S3 latency cliff 판정 규칙 (사전 박제, T-1698)` 소절 (`394~472 행`) 은
      **문자 단위 무변경** 이다. 임계 `8.0` · 가드 `10ms` · 조항 문안 어느 것도 산출 결과에 맞춰 바꾸지 않는다
      (`git diff` 로 그 행 범위에 hunk 가 0 임을 확인하고 완료 노트에 적는다).
- [ ] **산술 자기 검증** — bullet 에 적은 `R(1)` · `Δp95` 값이 `§3.1` 기박제 원문 수치 (표본 1: `5.01ms` ·
      `21.33ms`, 표본 2: `4.36ms` · `20.01ms`) 로부터 실제로 계산된 값과 일치함을 확인한다. 기박제 수치는
      **한 글자도 고치지 않으며**, 로그에 없는 값을 새로 만들어 넣지 않는다.
- [ ] **ramp-down 단계 제외 준수** — 조항 ② 가 판정 대상을 단계 1 → 2 (`R(1)`) 하나로 한정했으므로 단계
      2 → 3 값은 판정식에 넣지 않는다. 필요하면 관찰 서술로만 인용하고 임계 비교는 하지 않는다.
- [ ] 그 밖의 회차 기록 (`#### 1 회차` ~ `#### 15 회차` · `#### S2 *` · `#### S3 1~2 회차`) 은 **문자 단위
      무변경** ([CLAUDE.md](../../CLAUDE.md) `§12` 소급 치환 금지).
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

- **규칙 자체의 수정 · 보강 · 예외 추가** — 임계 `8.0` · 가드 `10ms` · 조항 ①~⑥ 문안은 읽기 전용. 규칙의
  결함이 보이면 고치지 말고 Follow-ups 에 적는다.
- **`§3` 표 S3 행 문구 fix** — 결론이 `cliff 있음` 으로 나오더라도 표 편집은 별도 slice 소관 (조항 ④).
- **error rate `< 1% (baseline 후 fix)` 축** — 본 slice 는 `latency cliff` 축 하나만 다룬다.
- **코드 변경 일체** — `test/load/*` · drift-guard smoke spec · `load-k6.yml` · `package.json` 무변경.
- **새 dispatch · rerun · 새 실측 회수** — 기존 run 로그의 기박제 수치만 인용한다.
- **S1 · S2 축 판정 확장** — 본 규칙은 S3 단계 분해 축 한정.
- **표본 3 개째 확보 시도** — 표본 공급은 별도 dispatch slice 소관이며 본 slice 는 확보된 2 개로만 판정한다.
- **회차 기록 소급 치환** — S3 3 · 4 회차 꼬리 add-only bullet 외의 회차 기록 편집 금지.

## Suggested Sub-agents

`implementer` (doc 작성) → (tester 면제 — direct doc-only, production 0 LOC)

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 기록 (2026-08-25T16:48:00Z, direct)

- 집행 commit `54f4823a` — [T-1698](T-1698-s3-latency-cliff-judgment-rule.md) 이 박제한 `#### S3 latency cliff 판정 규칙` 조항 ② 를 확보된 단계 분해 표본 **2 개** 에 기계 대입했다. `docs/ops/load-resilience-test-plan.md` `§3.1` 의 `#### S3 3 회차` · `#### S3 4 회차` 꼬리에 표본별 산출값 bullet 2 개 + 종합 결론 bullet 1 개를 add-only 로 append.
- 산출값: 3 회차 `R(1) = 4.26` · `Δp95 = 16.32ms`, 4 회차 `R(1) = 4.59` · `Δp95 = 15.65ms`. 두 표본 모두 배수 임계 `8.0` 미달이므로 조항 ② 의 결합 조건(배수 AND 절대 하한) 불충족 — 표본 결론 `cliff 부재`.
- 조항 ③ 표본 요건(최소 2 개 · 최근 연속 2 표본 동일 결론) 충족 → 종합 결론 **`cliff 부재`**. 조항 ④ 귀결에 따라 `§3` 표 S3 행 문구는 이미 `latency cliff 부재` 라 **표 diff 0 줄**.
- **규칙 재조정 0** — 규칙 소절(`394~472 행`)은 hunk 0, 임계 `8.0` · 가드 `10ms` · 조항 문안 문자 단위 무변경. 산출 결과에 맞춘 사후 임계 조정이 diff 에 없다.
- ramp-down 단계 `2 → 3` 은 조항 ② 대상 밖이라 임계 비교 0. 회분 표기(S1 15 · S2 5 · S3 4) 무변경, `140 행` checkbox `[ ]` 유지, 기박제 수치 소급 치환 0.
- doc-only 2 파일 `+36/-1` (≤300 LOC · ≤5 파일). `test/` · `src/` · `.github/workflows/` · `package.json` **0 LOC**, 새 `workflow_dispatch` · rerun · 실측 회수 **0**. `pnpm lint` 무경고. R-110 tester 의무는 direct doc-only 면제(CLAUDE.md §3.2).

### Follow-ups

- 종합 결론 `cliff 부재` 가 박제됐으므로 S3 축의 다음 칸은 판정이 아니라 **다른 관측면** 이다 — [부하계획](../ops/load-resilience-test-plan.md) `§3` 표 S3 행의 남은 정황 서술(`http_req_failed` · interrupted iteration)에 같은 방식의 사전 판정 규칙이 필요한지 planner 가 판단한다.
