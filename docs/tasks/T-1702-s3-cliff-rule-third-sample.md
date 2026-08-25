---
id: T-1702
title: S3 latency cliff 판정 규칙 3 번째 표본 기계 대입 (S3 5 회차 산출값 + 종합 결론 재평가, 부하계획 §3.1 + §5 + PLAN 141 행)
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-047, REQ-048]
estimatedDiff: 45
estimatedFiles: 2
independentStream: load-k6-s3-baseline
dependsOn: [T-1698, T-1699, T-1701]
touchesFiles:
  - docs/ops/load-resilience-test-plan.md
  - docs/PLAN.md
created: 2026-08-26
plannerNote: P5 R-91 chain — T-1701 이월 ① (규칙 ② 를 3 번째 표본에 대입 · 조항 ③ 재평가, 규칙 재조정 0)
---

# T-1702 — S3 latency cliff 판정 규칙 3 번째 표본 기계 대입

## Why

[T-1701](T-1701-s2-6-s3-5-log-reread.md) 이 run `32879776505` 재독으로 `#### S3 5 회차` 를 신설하면서
**단계 분해 표본을 2 개 → 3 개**로 늘렸고, 그 소절 안에서 "규칙 조항 ② 를 이 3 번째 표본에
대입하지는 않는다(별도 slice 소관 — Out of Scope)" 로 본 slice 를 명시 이월했다. 본 slice 는
[T-1698](T-1698-s3-latency-cliff-judgment-rule.md) 이 사전 박제한 `#### S3 latency cliff 판정 규칙`
조항 ② 를 **새 표본 1 개에 기계 대입**하고 조항 ③ (최소 2 개 · 최근 연속 2 표본 동일 결론) 을
**갱신된 표본 집합으로 재평가**해 종합 결론을 갱신한다 — [T-1699](T-1699-s3-latency-cliff-rule-application.md)
가 표본 1 · 2 에 한 것과 **같은 형태를 그대로 승계**한다. PLAN `141 행` 오너 최우선 R-91 chain 의
다음 칸이다.

## Required Reading

- `docs/ops/load-resilience-test-plan.md` `394~472 행` — `#### S3 latency cliff 판정 규칙 (사전 박제, T-1698)` 조항 ①~⑥ (판정식 ㉮ `R(1) ≥ 8.0` · ㉯ `Δp95 ≥ 10ms` · ㉱ 결합 · ③ 표본 요건 · ④ 결론 3 값의 귀결).
- `docs/ops/load-resilience-test-plan.md` `2264~2338 행` — `#### S3 5 회차 (T-1701, run 32879776505)`, 특히 `단계별 custom Trend 3 행` bullet 의 `s3_stage_duration_1`/`_2`/`_3` p95 · p99 원문.
- `docs/ops/load-resilience-test-plan.md` `2249~2263 행` — T-1699 가 `#### S3 4 회차` 꼬리에 add-only 로 박제한 **표본 2 산출값 bullet** 과 **종합 결론 bullet** (본 slice 가 승계할 서식·문체의 정본).
- `docs/ops/load-resilience-test-plan.md` `§5` item 5 — Follow-up 인덱스의 해당 항목 (꼬리 1 문단 append 지점).
- `docs/PLAN.md` `141 행` — R-91 성능 검증 bullet (꼬리 1 문장 append 지점, 회분 표기 `S1 16 회 · S2 6 회 · S3 5 회` 는 이미 T-1701 이 갱신 — **재갱신 금지**).

## Acceptance Criteria

- [ ] `#### S3 5 회차` 소절 **꼬리에 add-only bullet 1 개** 신설 — 제목은 T-1699 서식을 승계해
      `- **판정 규칙 조항 ② 기계 대입 — 표본 3 (add-only, T-1702)**` 형태. 본문에 ㉮ `R(1) = p95(단계 2) / p95(단계 1)`
      을 **기박제 원문 수치 그대로** 대입한 식과 **소수 둘째 자리 반올림** 산출값, 배수 임계 `R(1) ≥ 8.0`
      만족/불만족, ㉯ `Δp95 = p95(단계 2) − p95(단계 1)` 산출값과 가드 `Δp95 ≥ 10ms` 만족/불만족,
      ㉱ 결합에 따른 **본 표본 결론** 1 개를 적는다. 단계 2 → 3 은 ramp-down 이라 판정식 대상 밖임을 1 구로 명시.
- [ ] 같은 소절 꼬리에 **종합 결론 bullet 1 개** 신설 — 조항 ③ 을 **갱신된 표본 집합(3 개)** 으로 재평가한다:
      최소 2 개 요건 충족 여부 + **최근 연속 2 표본**(S3 4 회차 · S3 5 회차) 의 결론 일치 여부를 각각 명시하고,
      결론 3 값(`cliff 부재` · `cliff 있음` · `판정 보류`) 중 하나를 박제. T-1699 가 표본 2 개로 닫은 결론과의
      관계(유지/변경) 를 1 구로 밝힌다.
- [ ] **규칙 재조정 0** — `394~472 행` 규칙 소절은 **문자 단위 무변경**. 산출 결과에 맞춰 임계 `8.0` ·
      가드 `10ms` · 조항 ①~⑥ 문안을 고치는 hunk 가 diff 에 **0** 임을 `git diff -U0 -- docs/ops/load-resilience-test-plan.md`
      로 자기 점검. (규칙 ③ 의 "현재 단계 분해 표본 수는 2 개" 문장도 그 시점 사실이므로 **소급 치환 금지** — §12.)
- [ ] 조항 ④ 귀결 집행 — 결론이 `cliff 부재` 면 `§3` 표 S3 행(`p95 저하 곡선` / `latency cliff 부재`) 은
      **문자 단위 무변경**, `cliff 있음` 이면 표 fix 를 하지 않고 별도 slice 로 이월 명시, `판정 보류` 면
      표 문구 이월 + 보류 사유 명시. **어느 결론에서도 `§3` 표 diff 는 0 줄**.
- [ ] `§5` item 5 꼬리에 집행 문단 1 개 append (기존 문장 삭제 0) + `docs/PLAN.md` `141 행` 꼬리에 1 문장 append.
      `140 행` checkbox 는 `[ ]` 유지, 회분 표기(S1 16 · S2 6 · S3 5) **무변경**.
- [ ] **새 `workflow_dispatch` · rerun · 재시도 · 실측 회수 0** — 본 slice 는 기박제 수치만 사용한다.
      `test/` · `src/` · `.github/workflows/` · `package.json` diff **0 파일** (`git diff --name-only` 로 확인).
- [ ] `pnpm lint` 무경고. doc-only 2 파일 · ≤300 LOC · ≤5 파일 cap 준수.
- [ ] R-110/R-112: `commitMode: direct` doc-only 이므로 tester 의무 **면제** (production code 0 LOC · 분기 없음 → R-112 4 종 해당 없음).

## Out of Scope

- 규칙 소절(`394~472 행`) 의 임계 · 가드 · 조항 문안 수정 — 산출 결과에 맞춘 사후 조정은 T-1698 이 막으려 한 것 자체.
- `§3` 임계 표 재조정 (T-1701 이월 ③) — 별도 slice.
- `s2-read.js` 단계별 custom `Trend` 확대 배선 (T-1701 이월 ②, `pr` slice) — 본 slice 는 코드 0 LOC.
- 새 run dispatch · rerun · 4 번째 표본 확보.
- S3 1 · 2 회차의 정황 4 종 서술 소급 수정 (규칙 조항 ① 이 "강등이지 삭제가 아니다" 로 못 박음).
- `STUB_BASELINE_P95_MS` · drift-guard 상수 · `s3-concurrent.js` `thresholds` 변경.

## Suggested Sub-agents

`implementer` (doc-only 편집 — architect/tester 불요)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
