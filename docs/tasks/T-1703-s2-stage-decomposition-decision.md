---
id: T-1703
title: S2 축 단계 분해 확대 판단 사전 박제 (constant-VU 프로파일 전제 · 축 후보와 결론, 부하계획 §3 + §5 + PLAN 141 행)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 85
estimatedFiles: 2
independentStream: load-k6-s2-stage-decomposition
dependsOn: [T-1687, T-1691, T-1701]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-26
plannerNote: P5 R-91 chain — T-1701 이월 ② 의 배선 전 판단 소절 (s2-read.js 는 stages 0 · 코드 0 LOC)
---

# T-1703 — S2 축 단계 분해 확대 판단 사전 박제

## Why

[T-1701](T-1701-s2-6-s3-5-log-reread.md) 이 `#### S2 6 회차` 의 "의미 / 한계" 에 **"단계 분해는
S2 축에서 여전히 미확보 — `s2-read.js` 로의 확대 배선은 별도 `pr` slice 소관"** 을 이월했고, 같은
문장이 `#### S2 5 회차` 에도 있다. 그런데 [`test/load/s2-read.js`](../../test/load/s2-read.js) 의
프로파일은 `vus: 5` · `duration: "20s"` 의 **상수 VU** 이고 `options.stages` 정의가 **0** 이라,
[T-1687](T-1687-stage-percentile-export-design.md) 설계 조항 ③ 의 "단계 값 = `options.stages` 경계와
1:1 대응하는 산술 1 식" 을 **그대로 이식할 축 자체가 없다**. 배선 slice 가 이 공백을 즉석에서
메우면 축 정의가 구현에 맞춰 사후 정당화되므로, 본 slice 는 [T-1686](T-1686-k6-seed-persons-cap-decision.md)
(`#### K6_SEED_PERSONS 상한 상향 판단`) · [T-1690](T-1690-stage-value-path-beta.md) 이 밟은 **"배선 전
판단 소절 사전 박제"** 형태를 그대로 승계해 축 후보 · 판정 규칙 · 결론만 굳힌다. 새 측정 · 코드
변경은 **0** 이다. PLAN `141 행` 오너 최우선 R-91 chain 의 다음 칸이다.

## Required Reading

- `docs/ops/load-resilience-test-plan.md` `298~393 행` — `#### 단계별 percentile export 설계 (사전 박제, T-1687)`,
  특히 조항 ② (판정 임계 불변 · export 는 관찰 전용) · ③ (판정 tag 를 늘리지 않고 새 tag key 1 개) ·
  ⑤ (집행 경로 split — 코드 `pr` + 문서 `direct`) · ⑥-(다)(경로 β custom `Trend`).
- `docs/ops/load-resilience-test-plan.md` `1880~1959 행` — `#### K6_SEED_PERSONS 상한 상향 판단 (T-1686)`.
  본 slice 가 승계할 **판정 규칙 서식(ⓐ/ⓑ 조건 → 분기 결론)** 의 정본.
- `docs/ops/load-resilience-test-plan.md` `1795~1800 행` · `1876~1880 행` — `#### S2 5 회차` · `#### S2 6 회차`
  의 "의미 / 한계" 중 **"단계 분해는 S2 축에서 여전히 미확보"** 이월 문장 (인용 대상, **소급 치환 금지**).
- `docs/ops/load-resilience-test-plan.md` `394~472 행` 끝 ~ `473 행` — `#### S3 latency cliff 판정 규칙` 소절
  종료 지점과 `### 3.1` 헤더. **본 소절 삽입 지점은 그 사이**.
- `test/load/s2-read.js` `55~80 행` — `options` 블록 (`summaryTrendStats` · `vus: 5` · `duration: "20s"` ·
  `thresholds` 6 항목 · "ramping stages 는 S3 소관이라 쓰지 않는다" 머리 주석). **인용만 — 파일 변경 0**.
- `test/load/s3-concurrent.js` `35~66 행` — `STAGE_TAG_KEY` · `STAGE_TAG_VALUES` · 단계별 `Trend` 3 종
  lookup 표. S2 로 이식할 때 무엇이 전제인지 확인용 (**변경 0**).
- `docs/PLAN.md` `141 행` — R-91 성능 검증 bullet (꼬리 1 문장 append 지점). 회분 표기
  `S1 16 회 · S2 6 회 · S3 5 회` **재갱신 금지**.

## Acceptance Criteria

- [ ] `docs/ops/load-resilience-test-plan.md` 의 `#### S3 latency cliff 판정 규칙` 소절 **직후 ·
      `### 3.1` 헤더 직전**에 `#### S2 단계 분해 확대 판단 (사전 박제, T-1703)` 소절 1 개를 **add-only**
      로 신설한다 (기존 소절 문장 삭제 · 재배치 **0**).
- [ ] 소절이 **사실 확정 bullet 1 개**로 시작한다 — `s2-read.js` 의 현행 프로파일이 `vus: 5` ·
      `duration: "20s"` 상수 VU 이고 `options.stages` 정의가 **0** 이라는 것, 머리 주석이 "ramping
      stages 는 S3 소관" 으로 그 부재를 이미 의도로 못 박고 있다는 것을 **기박제 원문 인용**으로만 적는다
      (새 측정 · 추정 0).
- [ ] **축 후보 열거 bullet** — S2 에 단계 축을 만들 수단 후보를 **3 종**으로 굳히고 각각 (i) 무엇을
      cover 하는지 (ii) 판정면(`thresholds` 6 항목 · route sub-metric 표본 구성)을 움직이는지 (iii) 새
      외부 dependency 를 늘리는지를 한 줄씩 적는다. 후보는 최소 다음을 포함한다 — ㉠ `duration` 을 시간
      구간으로 등분해 경과시간 → 구간 index 산술 1 식으로 tag 를 다는 안, ㉡ `s2-read.js` 에 ramping
      `stages` 를 새로 도입하는 안, ㉢ 확대하지 않는 안(S2 는 이미 `route` 축 4 종 분해가 있고 latency
      cliff 판정 대상이 아니라는 근거).
- [ ] **판정 규칙 bullet** — T-1686 서식을 승계해 조건 2 개로 적는다: ⓐ 그 후보가 S2 의 **판정면**
      (`http_req_duration` 전역 · `{route:persons|groups|parts|me}` 4 종 sub-metric 의 표본 구성과 임계 숫자)
      을 문자 단위로든 표본 구성으로든 움직이는가, ⓑ 그 후보가 **닫는 공백**이 `§3` 표의 어느 칸에
      대응하는가(대응 칸이 없으면 공백이 아니다). 두 조건의 조합에 따른 **분기 결론 3 값**
      (`확대 채택` · `확대 유예` · `확대 불요`) 을 명시한다.
- [ ] **결론 bullet 1 개** — 위 규칙을 3 후보에 기계 대입해 **결론 1 값**을 박제한다. 결론이
      `확대 채택` 이면 T-1687 조항 ⑤ 의 split(코드 `pr` → 문서 `direct`) 을 그대로 승계한다고 명시하고,
      `확대 유예` · `확대 불요` 면 **재개 트리거**(어떤 사실이 관측되면 본 판단을 다시 연다) 를 1 구로
      적는다. 어느 결론이든 T-1701 이 이월한 "별도 `pr` slice 소관" 문장과의 관계(승계 / 대체 / 종결) 를
      1 구로 밝힌다.
- [ ] **판정면 불변 · 코드 0 LOC** — `test/` · `src/` · `.github/workflows/` · `package.json` diff 가
      **0 파일**임을 `git diff --name-only` 로 자기 점검. `§3` 임계 표는 **문자 단위 무변경**이고
      `#### 단계별 percentile export 설계` · `#### S3 latency cliff 판정 규칙` 소절도 **0 hunk** 임을
      `git diff -U0 -- docs/ops/load-resilience-test-plan.md` 로 확인.
- [ ] **소급 치환 0** — `#### S2 5 회차` · `#### S2 6 회차` 의 "단계 분해는 S2 축에서 여전히 미확보"
      문장과 기박제 회차 수치는 **문자 단위 무변경** (CLAUDE.md §12).
- [ ] `§5` item 5 꼬리에 집행 문단 1 개 append (기존 문장 삭제 0) + `docs/PLAN.md` `141 행` 꼬리에
      1 문장 append. `140 행` checkbox 는 `[ ]` 유지, 회분 표기(S1 16 · S2 6 · S3 5) **무변경**.
- [ ] **새 `workflow_dispatch` · rerun · 재시도 · 실측 회수 0**.
- [ ] `pnpm lint` 무경고. doc-only 2 파일 · ≤300 LOC · ≤5 파일 cap 준수.
- [ ] R-110/R-112: `commitMode: direct` doc-only 이므로 tester 의무 **면제** (production code 0 LOC ·
      분기 없음 → R-112 4 종 해당 없음).

## Out of Scope

- `s2-read.js` 실배선 (tag key · custom `Trend` · `stages` 도입) — 결론이 `확대 채택` 이어도 코드는
  **별도 `pr` slice** 소관이다 (T-1687 조항 ⑤ split — 판단과 배선을 한 commit 에 합치지 않는다).
- `s2-read.js` 의 `thresholds` · `vus` · `duration` · `summaryTrendStats` 변경.
- `§3` 임계 표 재조정 (T-1701 이월 ③) · S2 축 임계 재산정 — 별도 slice.
- 새 run dispatch · rerun · 7 번째 S2 표본 확보.
- `#### S3 latency cliff 판정 규칙` · `#### 단계별 percentile export 설계` 조항 문안 수정.
- 기박제 회차 본문 · 회분 표기 · `140 행` checkbox 상태 변경.

## Suggested Sub-agents

`implementer` (doc-only 편집 — architect/tester 불요)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
