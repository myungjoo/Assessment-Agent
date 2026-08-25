---
id: T-1704
title: S2 · S3 `baseline 후 fix` 표기 해제 판단 사전 박제 (S1 선례 승계 요건 · 판정 규칙 · 결론, 부하계획 §3 + §5 + PLAN 141 행)
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-047, REQ-048]
estimatedDiff: 100
estimatedFiles: 2
independentStream: load-k6-baseline-tag-release
dependsOn: [T-1644, T-1668, T-1701, T-1702, T-1703]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-26
completedAt: 2026-08-25T21:52:00Z
plannerNote: P5 R-91 chain — 이월 ③(§3 임계 표 재조정) 의 앞단 판단 소절 + 240 행 "실측 0 회" drift 폐쇄 (코드 0 LOC)
---

# T-1704 — S2 · S3 `baseline 후 fix` 표기 해제 판단 사전 박제

## Why

[T-1701](T-1701-s2-6-s3-5-log-reread.md) 이 이월한 세 항목 중 ① 은 [T-1702](T-1702-s3-cliff-rule-third-sample.md),
② 는 [T-1703](T-1703-s2-stage-decomposition-decision.md) 이 닫았고 남은 것은 **③ `§3` 임계 표
재조정** 하나다. 그런데 표에 남은 `baseline 후 fix` 칸 2 개(S2 `p50 latency / throughput` ·
S3 `error rate`)는 **"몇 표본이 모이면 · 무엇을 확인하면 태그를 뗀다"는 요건이 어디에도 박제돼
있지 않다** — `§3.1` 의 S2 1~6 회차 · S3 1~5 회차는 매 회차 "표본이 N 회뿐이라 재확정 근거가
되지 못한다" 고만 적어 왔고, 그 N 의 문턱은 판정자마다 달라질 수 있다. 표본을 더 본 뒤에 요건을
정하면 그 표본에 맞춘 사후 정당화(over-fitting)가 되므로, [T-1686](T-1686-k6-seed-persons-cap-decision.md) ·
[T-1690](T-1690-stage-value-path-beta.md) · [T-1698](T-1698-s3-latency-cliff-judgment-rule.md) ·
[T-1703](T-1703-s2-stage-decomposition-decision.md) 이 밟은 **"집행 전 판단 소절 사전 박제"** 형태를
그대로 승계해 요건 · 판정 규칙 · 결론만 굳힌다. 동시에 `§3` 240~243 행 의 **"두 축은 baseline
실측이 아직 0 회"** 서술이 현행 사실(S2 **6 회** · S3 **5 회** 회수 완료)과 갈린 drift 를
[T-1679](T-1679-s2-gate-doc-drift-closure.md) 선례대로 **무효화 표기**로 폐쇄한다. 새 측정 · 새
dispatch · 코드 변경은 **0** 이다. PLAN `141 행` 오너 최우선 R-91 chain 의 다음 칸이다.

## Required Reading

- `docs/ops/load-resilience-test-plan.md` `192~200 행` — `§3` 임계 표 8 행. 특히 **S2 `p50 latency /
  throughput | baseline 후 fix (관찰용)`**(198 행) 과 **S3 `error rate (동시성 단계별) | < 1%
  (baseline 후 fix)`**(200 행) 두 칸이 본 판단의 대상이다. **표 자체는 문자 단위 무변경**.
- `docs/ops/load-resilience-test-plan.md` `237~243 행` — `S1 error rate < 1% 확정 근거` bullet
  (S1 축이 태그를 뗀 **선례의 정본** — 5 회 run 전량 `0.00%`) 과 그 뒤의 **`S2 · S3 의 baseline 후
  fix 표기는 무변경` bullet**(240~243 행, "실측 아직 **0 회**"). 후자가 본 slice 의 **무효화 표기
  대상**이다.
- `docs/ops/load-resilience-test-plan.md` `244~258 행` — `각주 — 임계 fix 시점`. S1 축이 `평균 + 3σ
  → 100ms 올림` 을 택한 이유(3 표본 단조 감소 · `max` 채택 시 flapping)가 정본. **본 각주는 이력
  서술이라 문자 단위 무변경 — 무효화 표기 대상 아님**.
- `docs/ops/load-resilience-test-plan.md` `259~297 행` — `S1 관찰용 p95 게이트 재확정 규칙 (사전
  박제, T-1668)` 의 조항 ① ~ ④. 본 slice 가 승계할 **산정식(② 평균+3σ 100ms 올림)** · **표본 취급
  (③ outlier 제거 금지 · 축 혼합 금지 · 하향 금지)** · **집행 경로 split(④ 코드 `pr` + 문서
  `direct`)** 의 정본. **규칙 소절은 0 hunk**.
- `docs/ops/load-resilience-test-plan.md` `473~542 행` — `#### S2 단계 분해 확대 판단 (사전 박제,
  T-1703)`. 본 slice 가 승계할 **판정 규칙 서식**(사실 확정 → 후보/요건 열거 → 조건 2 개 → 분기
  결론 3 값 → 재개 트리거) 의 최근 정본이자, **본 소절의 삽입 지점 바로 앞 소절**이다.
- `docs/ops/load-resilience-test-plan.md` `543 행` — `### 3.1 baseline 실측 기록 (S1 16 회분 ·
  S2 6 회분 · S3 5 회분)` 헤더. **본 소절 삽입 지점은 542 행과 543 행 사이**. 회분 표기 **재갱신 금지**.
- `docs/ops/load-resilience-test-plan.md` `1941~1949 행` — `#### S2 6 회차` 의 `§3` 표 S2 축 무변경
  판정 + 의미/한계 (인용 대상, **소급 치환 금지**). `2398~2404 행` — `#### S3 5 회차` 의 `§3` 표
  S3 축 무변경 판정 (같은 취급).
- `docs/ops/load-resilience-test-plan.md` `2476~2492 행` — `§5` item 5 `baseline 확정 + 임계 fix`.
  꼬리에 집행 문단 1 개 append 하는 지점 (기존 문장 삭제 **0** — 안의 "S2 · S3 … 실측 0 회라
  무변경" 문장도 그대로 둔다).
- `docs/PLAN.md` `141 행` — R-91 성능 검증 bullet (꼬리 1 문장 append 지점). 회분 표기
  `S1 16 회 · S2 6 회 · S3 5 회` **재갱신 금지**.

## Acceptance Criteria

- [ ] `docs/ops/load-resilience-test-plan.md` 의 `#### S2 단계 분해 확대 판단 (사전 박제, T-1703)`
      소절 **직후 · `### 3.1` 헤더 직전**에 `#### S2 · S3 baseline 후 fix 표기 해제 판단 (사전 박제,
      T-1704)` 소절 1 개를 **add-only** 로 신설한다 (기존 소절 문장 삭제 · 재배치 **0**).
- [ ] **① 사실 확정 bullet** — (i) `§3` 표에 `baseline 후 fix` 가 남은 칸이 **정확히 2 개**(S2
      `p50 latency / throughput` 관찰용 · S3 `error rate`) 라는 것, (ii) 두 축의 회수된 실측이 각각
      **S2 6 회 · S3 5 회** 라는 것, (iii) S1 축은 이미 태그를 뗐고 그 근거가 error rate 5 회 전량
      `0.00%` · 관찰용 p95 는 실 scale 3 표본의 평균+3σ 였다는 것을 **기박제 원문 인용 · pointer**
      로만 적는다. **새 측정 · 새 통계 산출 0**.
- [ ] **② 해제 요건 bullet** — 태그 해제에 필요한 요건을 **S1 선례에서만** 끌어와 3 항으로 굳힌다
      (**새 요건 발명 금지**): (ㄱ) **표본 수 요건** — S1 축이 해제한 시점의 표본 수를 그대로 승계한다
      (관찰용 수치 칸 / error rate 칸 각각 무엇이었는지 명시), (ㄴ) **조건 동일성 요건** — 표본 전량의
      환경 메타 7 항목 · 프로파일 · dataset 규모가 동일해야 한다, (ㄷ) **산정식** — 수치 칸은 T-1668
      규칙 ② 의 `평균 + 3 × 표본표준편차 → 100ms 올림`, error rate 칸은 S1 선례대로 `전 표본이 임계를
      여유 있게 만족` 을 그대로 쓰고 `max` 기반 · p99 기반 · 임의 배수 같은 **새 식은 발명하지 않는다**.
      T-1668 규칙 ③(outlier 제거 금지 · 축 혼합 금지 · 하향 금지)도 그대로 승계한다고 명시한다.
- [ ] **③ 판정 규칙 bullet** — T-1686 · T-1703 서식을 승계해 조건 **2 개**로 적는다: ⓐ 해당 축이 위
      (ㄱ) · (ㄴ) 요건을 **현재 충족하는가**, ⓑ 그 칸이 **판정용인가 관찰용인가**(관찰용이면 해제해도
      REQ 판정 임계가 움직이지 않는다). 두 조건의 조합에 따른 **분기 결론 3 값**(`해제 채택` ·
      `해제 유예` · `해제 불요`) 을 명시한다.
- [ ] **④ 결론 bullet** — 위 규칙을 **두 칸(S2 p50/throughput · S3 error rate) 각각에 기계 대입**해
      결론을 **칸마다 1 값**씩 박제한다. `해제 채택` 이면 T-1668 규칙 ④ 의 split(코드 `pr` → 문서
      `direct`; 코드 변경이 0 이면 문서 `direct` 단독) 을 그대로 승계한다고 명시하고, `해제 유예` ·
      `해제 불요` 면 **재개 트리거**(어떤 사실이 관측되면 본 판단을 다시 연다)를 칸마다 1 구로 적는다.
      T-1701 이 이월한 **③ `§3` 임계 표 재조정** 과의 관계(승계 / 대체 / 종결) 도 1 구로 밝힌다.
- [ ] **drift 폐쇄** — `240~243 행` 의 `S2 · S3 의 baseline 후 fix 표기는 무변경` bullet 에
      **무효화 표기 1~2 줄을 add-only 로 덧붙인다**(T-1679 선례) — "실측 아직 **0 회**" 는 T-1644 시점
      사실이며 현행은 S2 **6 회** · S3 **5 회** 이고 현행 판정은 본 소절이라는 pointer. **기존 문장은
      문자 단위 삭제 · 수정 0**(§12 소급 치환 금지).
- [ ] **`§3` 표 · T-1644 각주 · T-1668 규칙 소절 무변경** — `192~200 행` 표와 `244~258 행` 각주,
      `259~297 행` 규칙 소절이 **0 hunk** 임을 `git diff -U0 -- docs/ops/load-resilience-test-plan.md`
      로 자기 점검한다 (본 slice 는 판단만 적고 숫자 · 태그를 실제로 바꾸지 않는다).
- [ ] **코드 0 LOC** — `test/` · `src/` · `.github/workflows/` · `package.json` diff 가 **0 파일**임을
      `git diff --name-only` 로 확인.
- [ ] **소급 치환 0** — `#### S2 6 회차` · `#### S3 5 회차` 를 비롯한 기박제 회차의 "표본이 N 회뿐이라
      재확정 근거가 되지 못한다" 문장과 수치는 **문자 단위 무변경**.
- [ ] `§5` item 5 꼬리에 집행 문단 1 개 append (기존 문장 삭제 0) + `docs/PLAN.md` `141 행` 꼬리에
      1 문장 append. `140 행` checkbox 는 `[ ]` 유지, 회분 표기(S1 16 · S2 6 · S3 5) **무변경**.
- [ ] **새 `workflow_dispatch` · rerun · 재시도 · 실측 회수 0**.
- [ ] `pnpm lint` 무경고. doc-only 2 파일 · ≤300 LOC · ≤5 파일 cap 준수.
- [ ] R-110/R-112: `commitMode: direct` doc-only 이므로 tester 의무 **면제** (production code 0 LOC ·
      분기 없음 → R-112 4 종 해당 없음).

## Out of Scope

- `§3` 표에서 `baseline 후 fix` 태그를 **실제로 떼는 일** · S2 p50/throughput 수치 확정 · S3 error
  rate 확정 — 결론이 `해제 채택` 이어도 **별도 집행 slice** 소관이다 (T-1668 규칙 ④ split — 판단과
  집행을 한 commit 에 합치지 않는다).
- S1 축 관찰용 임계 `1200ms` 재산정 · `STUB_BASELINE_P95_MS` · drift-guard spec 변경 (16 회차에서
  트리거 미발화 — 별도 축).
- `244~258 행` T-1644 각주 안의 "S2 · S3 … 실측이 0 회라 그대로 남는다" 문장 수정 (이력 서술 —
  무효화 표기는 `240~243 행` bullet **1 곳 한정**).
- `#### S3 latency cliff 판정 규칙` · `#### 단계별 percentile export 설계` · `#### S2 단계 분해 확대
  판단` 소절 문안 수정.
- 새 run dispatch · rerun · S2 7 번째 / S3 6 번째 표본 확보 · 로그 재독.
- 기박제 회차 본문 · `§3.1` 헤더 회분 표기 · `140 행` checkbox 상태 변경.

## Suggested Sub-agents

`implementer` (doc-only 편집 — architect/tester 불요)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
