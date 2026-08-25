---
id: T-1691
title: S3 스크립트에 단계별 custom Trend 를 배선 (설계 조항 ⑥ 경로 β · 문제 (b) 뒷조각)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047, REQ-048]
independentStream: load-resilience-plan
dependsOn: [T-1687, T-1688, T-1689, T-1690]
touchesFiles:
  - test/load/s3-concurrent.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
estimatedDiff: 200
estimatedFiles: 2
created: 2026-08-25T08:05:00Z
prNumber: 1339
completedAt: 2026-08-25T08:57:08Z
plannerNote: P5 성능 검증(PLAN 141 행) — T-1690 조항 ⑥ (마) 코드 pr slice, 단계 축 값의 생성 수단(경로 β) 배선
---

# T-1691 — S3 스크립트에 단계별 custom Trend 를 배선

## Why

[load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 의 `#### 단계별 percentile export 설계`
소절이 정의한 두 공백 중 **(a) `p99` 미확보** 는 T-1688(PR #1337) 이, **(b) 단계 분해 불가** 의 앞조각인
**단계 축 부여** 는 T-1689(PR #1338) 가 닫았다. 남은 뒷조각은 T-1690 이 조항 **⑥** 으로 굳힌 caveat —
**k6 종료 요약은 request tag 를 자동으로 sub-metric 으로 분해하지 않아 `stage` 축만으로는 단계별 값이
요약에 생기지 않는다** — 이며, 그 해소 수단으로 조항 ⑥ (다) 가 **경로 β(k6 런타임 내장 `k6/metrics` 의
`Trend` custom metric)** 를 이미 채택해 뒀다. 본 task 는 조항 ⑥ **(마) 의 코드 `pr` 1 slice** 를 그대로
집행한다 — 수단 재추론 없이 β 를 배선하고, 스크립트와 drift-guard 단언을 **같은 commit 에서 동기**한다
(둘이 갈리면 guard red — T-1676 · T-1688 · T-1689 선례 동형). PLAN `141 행` 의 P5 부하·복원력 검증 bullet 을 잇는다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `349~375 행`
  (`#### 단계별 percentile export 설계` 소절 **조항 ⑥** 전문 — (가) caveat · (나) 경로 α 불채택 ·
  (다) 경로 β 채택 · (라) 조항 ②·④ 재확인 · (마) 집행 split. 본 task 의 계약 정본)
- [test/load/s3-concurrent.js](../../test/load/s3-concurrent.js) 전문 (123 행) — 특히
  `32~57 행`(`STAGE_TAG_KEY` · `STAGE_TAG_VALUES` · `STAGE_STEP_MS` · `stageTagOf` · `withStage`),
  `58~80 행`(`options` — `summaryTrendStats` · `stages` · `thresholds` 4 종, **판정면**),
  `95~111 행`(`export default` iteration 의 write · read · delete 3 왕복)
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts)
  `4609~4788 행` (T-1689 describe 블록 — 본 task 의 describe 를 그 **뒤에 append**. 상단 helper
  (`s3Script` · `s3Body` · `thresholdKeys` · `stageTagKeyOf` · `stageTagValuesOf` · `routeTagsOf`) 는
  **재사용**하고 중복 정의하지 않는다)
- [CLAUDE.md](../../CLAUDE.md) `§3.1` (commit mode) · `§3.2` R-110/R-112 · `§12` (언어 · 범위 좌표 표기)

## Acceptance Criteria

- [ ] [`test/load/s3-concurrent.js`](../../test/load/s3-concurrent.js) 가 **k6 런타임 내장 모듈**
      `k6/metrics` 의 `Trend` 를 import 하고, `STAGE_TAG_VALUES` 3 종과 **1:1 대응**하는 custom
      Trend 인스턴스 3 개를 선언한다(지표 이름은 단계 값이 식별되는 고정 접두형 — 예
      `s3_stage_duration_1` · `_2` · `_3`). **새 외부 dependency 0** — `package.json` ·
      `pnpm-lock.yaml` 은 문자 단위 0 변경이다(조항 ① · ⑥ (다)).
- [ ] `export default` 의 **write · read · delete 3 왕복 각각**에 대해 응답의
      `timings.duration` 을 해당 단계의 Trend 에 `add` 한다. 단계 결정은 **요청에 실제로 붙은 tag 값을
      재사용**한다 — `withStage(...)` 로 만든 params 를 const 로 잡아 그 `tags[STAGE_TAG_KEY]` 로
      Trend 를 고르며, 요청 직후 `stageTagOf` 를 **재호출하지 않는다**(단 경계를 넘는 왕복에서 tag 와
      Trend 행이 다른 단계로 갈리는 drift 차단).
- [ ] 단계 → Trend 선택은 **조건 분기 0** 의 lookup 1 회다 — `if` · 삼항 · `switch` 를 쓰지 않아 스크립트
      머리 주석 규약 ⑤ **"조건 분기 로직 0"** 을 유지한다.
- [ ] 판정면 **문자 단위 0 변경**(조항 ② · ⑥ (라)) — `thresholds` 4 종 키와 순서 · 임계 숫자
      (`3000` · `0.01`) · `stages` 의 `duration`/`target` · `route` tag 값 4 종 · `summaryTrendStats`
      6+1 종이 그대로이며, custom Trend 에는 **어떤 threshold 도 부착하지 않는다**.
- [ ] `setup()` · `teardown()` 의 왕복(`seed` · `teardown` tag)은 **단계 축 밖**이므로 Trend record 를
      추가하지 않는다. 기존 `[s3-concurrent] persons 행 수 …` 로그 2 줄(T-1682)과 `startRows` ·
      `startedAt` 소비 경로는 회귀 0 이다. artifact 업로드 · JSON 내보내기 · 외부 저장소 배선 0
      (조항 ④ 승계 — 회수는 run log 1 경로).
- [ ] **happy-path test** — drift-guard smoke 에 describe 1 개를 append 해 ① `k6/metrics` 의 `Trend`
      import 실재 ② Trend 인스턴스가 단계 값 3 종과 1:1 대응 ③ `export default` 안에서 3 왕복 모두가
      `add(` 로 record ④ `thresholds` 키 4 종이 순서까지 불변임을 각각 단언한다(각 1+ it).
- [ ] **error path test** — 스크립트 본문이 0-byte(`""`) 이거나 import · Trend 선언이 없는 합성 본문에서
      추출 helper 가 **추측 없이** 빈 배열 또는 `null` 을 내고 **0-byte false-PASS 가 나지 않음**을
      단언하는 it 1+. non-string 입력에 대한 계약(throw 또는 명시 반환)도 1+.
- [ ] **분기 cover** — 추출 helper 의 분기마다 it 1+ (예: 따옴표 종류 차이 · import 가 한 줄/여러 줄 ·
      Trend 선언이 개별 `const` / 객체 리터럴 형태 각각에서 같은 정규형을 내는지).
- [ ] **negative cases 충분 cover** — 최소 5 종을 합성 본문 mutation 으로 검출한다: (1) `k6/metrics`
      import 를 지운 본문 (2) Trend 인스턴스 하나(단계 `3`)를 지운 본문 (3) 3 왕복 중 하나의 record 를
      지운 본문 (4) custom Trend 를 `thresholds` 에 임계로 굳힌 본문(관찰 전용 위반 · 판정면 오염)
      (5) 스크립트에 `if (` · `? :` 같은 조건 분기가 새로 들어간 본문(규약 ⑤ 위반). 각 케이스는 원본을
      mutate 하지 않는 대조군 단언을 동반한다. 추가로 (6) `package.json` 의 `dependencies` ·
      `devDependencies` 에 k6 관련 항목이 유입되지 않았음을 단언하는 it 1+.
- [ ] `pnpm lint` · `pnpm build` 무경고, `pnpm test` green(기존 spec 회귀 0), `pnpm test:cov` 임계 통과
      (line ≥ 80% / function ≥ 80% — `src/` 변경 0 이라 전역 coverage 는 불변이어야 한다).
- [ ] diff ≤ 300 LOC · 변경 파일 ≤ 5 개(본 task 는 **2 파일**). `git diff --stat` 로 확인하며
      `src/` · `.github/workflows/` · `package.json` · `docs/` 변경이 **0** 이다.

## Out of Scope

- **새 `workflow_dispatch` · rerun · 실측 수치 회수** — 본 task 는 **새 측정 0**. 배선된 Trend 가 실제
  run 요약에 찍히는지 확인하는 dispatch 는 후속 slice 소관이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) · [docs/PLAN.md](../PLAN.md)
  등 **모든 문서 변경** — 조항 ⑥ (마) 가 문서는 실 run 뒤 별도 `direct` slice 로 못 박았다
  (CLAUDE.md `§3.1` rule 3 split 유지). `§3.1` 회차 기록의 "미확보" 표기 갱신도 여기서 하지 않는다.
- `thresholds` · 임계 숫자 · `route` tag 값 · `options.stages` · `summaryTrendStats` 의 어떤 수정도 금지
  (조항 ②).
- 경로 α(`thresholds` 에 관찰 전용 selector 선언) 재검토 — 조항 ⑥ (나) 가 이미 불채택으로 굳혔다.
- `handleSummary()` 신설(후보 B) · 요약 표시 형식 변경 — 값의 **생성** 만이 본 slice 범위이고 **표시**
  수단은 폐기되지 않은 채 별도 판단으로 남는다(조항 ⑥ 꼬리).
- [`s1-batch.js`](../../test/load/s1-batch.js) · [`s2-read.js`](../../test/load/s2-read.js) 로의 확대 배선.
- 새 외부 dependency 추가 (발견 시 CLAUDE.md `§5` BLOCKED), [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md)
  status 변경, 새 ADR 신설.

## Suggested Sub-agents

`implementer → tester` (수단 선택은 조항 ⑥ 이 이미 굳혀 architect 미호출. `commitMode: pr` 이라
R-110 tester 호출 의무).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 append)

- (planner 사전 메모) ① 본 배선이 실제 run 요약에 단계별 Trend 행을 만드는지는 `load-k6.yml` **1 회
  dispatch** 로만 확인된다 — 그 회수 slice 는 `direct`(수치 기록) 이며 조항 ⑥ (마) 의 문서 축과 함께
  처리하는 것이 diff 상 자연스럽다.
- (planner 사전 메모) ② 단계별 값이 실제로 확보되면 `§3.1` 회차 기록 6 군데의 `p99` "미확보" 표기와
  `§3` 표의 "latency cliff 부재" 판정 근거 서술이 갱신 대상이 된다(소급 치환 금지 — 값을 얻은 회차부터).

## 결과 (2026-08-25 완료)

- PR [#1339](https://github.com/myungjoo/Assessment-Agent/pull/1339) — reviewer APPROVE round 1/7 (finding 0), CI green, 4-게이트 PASS 후 squash `2ba4ac4b` 로 머지 + branch 삭제.
- `test/load/s3-concurrent.js` 에 내장 `k6/metrics` 의 `Trend` 3 개를 단계 값 3 종과 1:1 로 선언하고, write · read · delete 3 왕복의 duration 을 **요청에 붙은 tag 값 재사용**으로 record 한다 (`stageTagOf` 재호출 0 · 조건 분기 0 의 lookup 1 회 — 경계 straddle drift 차단).
- 판정면(`thresholds` 4 종 · 임계 숫자 · `route` 값 · `stages` · `summaryTrendStats`) 은 **문자 단위 0 변경**, custom Trend 에 threshold 미부착, 새 외부 dependency 0(`package.json` 불변).
- drift-guard smoke `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 에 describe 1 개 append (happy 4 · error 2 · 분기 2 · negative 6) — R-112 4 종 cover. 2 파일 `+293/-4`.
- `src/` 변경 0 이라 전역 coverage 임계 불변. 전체 453 suite / 13009 test green.
