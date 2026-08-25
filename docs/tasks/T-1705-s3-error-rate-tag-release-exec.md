---
id: T-1705
title: S3 `error rate` 칸 `(baseline 후 fix)` 표기 해제 집행 (T-1704 결론 ④ 의 유일한 집행 건, 코드 0 LOC)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047, REQ-048]
estimatedDiff: 90
estimatedFiles: 2
independentStream: load-k6-baseline-tag-release
dependsOn: [T-1644, T-1668, T-1701, T-1704]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-25
plannerNote: P5 R-91 chain — T-1704 판단 ④ 가 남긴 집행 1 건(S3 판정용 임계 확정) 집행, 판단 축 없음
---

# T-1705 — S3 `error rate` 칸 `(baseline 후 fix)` 표기 해제 집행

## Why

[T-1704](T-1704-s2-s3-baseline-tag-release-rule.md) 가 `§3` 임계 표에 남은 `baseline 후 fix`
태그 **2 칸**의 해제 요건 · 판정 규칙 · 결론을 사전 박제해 **S2 `p50 latency / throughput` →
`해제 불요`** · **S3 `error rate (동시성 단계별)` → `해제 채택`** 을 굳혔고, 그 소절 ④ 는 채택
칸의 집행을 T-1668 규칙 ④ split 대로 **코드 0 LOC · 문서 `direct` 단독 slice** 소관으로 명시해
남겼다. 본 slice 는 그 **유일한 집행 건**이다 — S3 축은 표의 숫자 `< 1%` 와
[`s3-concurrent.js`](../../test/load/s3-concurrent.js) 의 임계 `rate<0.01` 이 **이미 같은 값**이라
바꿀 코드가 없고, 남은 것은 표의 `(baseline 후 fix)` 잠정 표기를 떼서 **판정용 임계를 확정
상태로 만드는 문서 집행**뿐이다. 이로써 T-1701 이 이월한 세 항목(① S3 cliff 규칙 3 표본 대입 —
T-1702, ② S2 단계 분해 확대 판단 — T-1703, ③ `§3` 임계 표 재조정 — T-1704 판단 + 본 집행)이
전부 닫힌다. PLAN [`144 행`](../PLAN.md) R-91 chain 의 다음 칸이며 판단 축을 새로 열지 않는다.

## Required Reading

- `docs/ops/load-resilience-test-plan.md` `547~623 행` — `#### S2 · S3 baseline 후 fix 표기 해제
  판단 (사전 박제, T-1704)` 소절. 특히 **④ 결론** 의 S3 칸 문단(`해제 채택` · 코드 0 LOC · 문서
  `direct` 단독 slice)이 본 slice 의 **집행 지시 전문**이다 — 본문 수정 **0**, 인용만 한다.
- `docs/ops/load-resilience-test-plan.md` `192~200 행` — `§3` 임계 표 8 행. 본 slice 가 고치는
  칸은 **`200 행` S3 행의 pass 임계 셀 1 개**뿐이다.
- `docs/ops/load-resilience-test-plan.md` `237~239 행` — `- **S1 error rate \`< 1%\` 확정 근거**:`
  bullet. 신설할 S3 확정 근거 bullet 의 **서식 원본** (같은 형태 · 같은 분량으로 맞춘다).
- `docs/ops/load-resilience-test-plan.md` `240~247 행` — `- **S2 · S3 의 \`baseline 후 fix\` 표기는
  무변경**` bullet 과 그 꼬리의 T-1704 무효화 표기. 본 slice 는 그 꼬리에 **1~2 줄만 add-only**.
- `docs/ops/load-resilience-test-plan.md` `2557~3682 행` — `§5` item 5 `baseline 확정 + 임계 fix`
  (문서 끝까지). 꼬리에 집행 문단 1 개를 append 하는 지점.
- `docs/PLAN.md` `141 행` — R-91 성능 검증 bullet (꼬리 1 문장 append 지점).

## Acceptance Criteria

- [ ] **표 집행 (본 slice 의 본체)** — `docs/ops/load-resilience-test-plan.md` `200 행` 의
      `| S3 동시성 내성 | error rate (동시성 단계별) | < 1% (baseline 후 fix) | graceful degradation |`
      에서 **`(baseline 후 fix)` 문자열만 제거**해 pass 임계 셀을 `< 1%` 로 만든다. 숫자 `1%` ·
      지표명 · 근거 열 문구는 **문자 단위 무변경**이고, 표의 **나머지 7 행은 0 hunk** 다.
- [ ] **확정 근거 bullet 신설** — `237~239 행` 의 S1 확정 근거 bullet **직후**에
      `- **S3 error rate \`< 1%\` 확정 근거**:` bullet 1 개를 add-only 로 넣는다. 내용은 T-1704
      소절 ④ 가 이미 박제한 사실만 인용한다 (**새 측정 · 새 통계 산출 0**): S3 표본 **5 개**
      (`§3.1` `S3 1~5 회차`) 전량이 `http_req_failed` `✓ 'rate<0.01' rate=0.00%`
      (0/22752 · 0/14867 · 0/24323 · 0/25205 · 0/23510) 라는 것, 요건 (ㄱ) error rate 칸 **5 개** ·
      (ㄴ) 환경 메타 7 항목 · ramping `stages` · 공유 dataset 133 건 동일이 충족된다는 것, 그래서
      **T-1704 판정 ⓐ true + ⓑ 판정용 → `해제 채택`** 에 따라 태그를 뗐다는 것, 그리고 표 숫자와
      [`s3-concurrent.js`](../../test/load/s3-concurrent.js) 의 `rate<0.01` 이 같은 값이라 **코드
      변경이 0** 이라는 것. pointer 는 T-1704 소절 · `§3.1` 회차로 건다.
- [ ] **무변경 bullet 꼬리 동기** — `240~247 행` bullet 꼬리(T-1704 무효화 표기 끝)에 **1~2 줄만**
      add-only 로 덧붙여, 그 "S2 · S3 … 무변경" 서술 중 **S3 칸은 본 slice(T-1705) 가 해제 집행**
      해 이제 태그가 남은 칸은 **S2 `p50 latency / throughput` 1 개**임을 pointer 로 남긴다.
      **기존 문장 · T-1704 표기는 문자 단위 삭제 · 수정 0** ([CLAUDE.md](../../CLAUDE.md) `§12`
      소급 치환 금지 · T-1679 선례).
- [ ] **`§5` item 5 꼬리 집행 문단 1 개 append** — 본 slice 가 S3 error rate 칸을 확정으로 집행했고
      코드 변경이 0 이며 남은 태그가 S2 1 칸(`해제 불요`, 재개 트리거는 T-1704 소절)이라는 사실을
      1 문단으로 적는다. 기존 문장 삭제 **0** (안의 "S2 · S3 … 실측 0 회라 무변경" 이력 서술도
      그대로 둔다).
- [ ] **`docs/PLAN.md` `141 행` 꼬리에 1 문장 append** — S3 error rate 임계가 확정됐다는 사실 +
      정본 pointer. `140 행` checkbox 는 `[ ]` 유지, 회분 표기(S1 **16 회** · S2 **6 회** ·
      S3 **5 회**) **무변경**, `144~148 행` 오너 지시 bullet **무변경**.
- [ ] **판단 축 0** — 본 slice 는 새 판정 규칙 · 새 요건 · 새 산정식을 **하나도 만들지 않는다**.
      T-1704 소절(`547~623 행`) · T-1668 규칙 소절 · `각주 — 임계 fix 시점`(`248~258 행`) ·
      `#### S3 latency cliff 판정 규칙` · `#### S2 단계 분해 확대 판단` 소절이 **0 hunk** 임을
      `git diff -U0 -- docs/ops/load-resilience-test-plan.md` 로 자기 점검한다.
- [ ] **코드 0 LOC** — `test/` · `src/` · `.github/workflows/` · `package.json` diff 가 **0 파일**임을
      `git diff --name-only` 로 확인한다 (특히 `test/load/s3-concurrent.js` 의 `rate<0.01` 무변경).
- [ ] **소급 치환 0** — `§3.1` 의 `#### S3 1~5 회차` · `#### S2 1~6 회차` 본문과 `1611` · `1705` ·
      `1779` 행 등 회차 기록 안의 `baseline 후 fix` 언급은 **그 시점 이력**이므로 문자 단위 무변경.
- [ ] **새 `workflow_dispatch` · rerun · 재시도 · 실측 회수 · 로그 재독 0**.
- [ ] `pnpm lint` 무경고. doc-only 2 파일 · ≤ 300 LOC · ≤ 5 파일 cap 준수.
- [ ] R-110/R-112: `commitMode: direct` doc-only 이므로 tester 의무 **면제** (production code
      0 LOC · 분기 없음 → R-112 4 종 해당 없음).

## Out of Scope

- **S2 `p50 latency / throughput` 칸 태그 제거** — T-1704 결론이 `해제 불요` 이므로 건드리지
  않는다. 재개 트리거(회귀 관찰 게이트 상수 배선 또는 판정용 승격)가 실제로 관측되기 전까지 열지
  않는다.
- S3 `p95 저하 곡선 / latency cliff 부재` 행 · S1 축 3 행 · S2 나머지 2 행 수정.
- S1 관찰용 임계 `1200ms` 재산정 · `STUB_BASELINE_P95_MS` · drift-guard spec 변경.
- `test/load/s3-concurrent.js` 의 임계 · 코드 수정 (이미 같은 값 — 손댈 것 없음).
- 새 run dispatch · rerun · S2 7 번째 / S3 6 번째 표본 확보 · 로그 재독 · `§3.1` 신규 회차 신설.
- `§3.1` 헤더 회분 표기 · `140 행` checkbox 상태 변경 · PLAN `144~148 행` 오너 지시 bullet 수정.
- `§5` item 5 본문 재작성 · PLAN `146 행` R-92 bullet prune (별도 오너 지시 항목).

## Suggested Sub-agents

`implementer` (doc-only 편집 — architect/tester 불요)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
