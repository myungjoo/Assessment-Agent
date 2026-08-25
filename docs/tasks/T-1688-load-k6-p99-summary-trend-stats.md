---
id: T-1688
title: 부하 스크립트 3 종에 p(99) summaryTrendStats 배선 (설계 ① 후보 A · 문제 (a) 코드 slice)
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047, REQ-048]
independentStream: load-resilience-plan
dependsOn: [T-1687]
touchesFiles:
  - test/load/s1-batch.js
  - test/load/s2-read.js
  - test/load/s3-concurrent.js
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
estimatedDiff: 190
estimatedFiles: 4
created: 2026-08-25T05:30:00Z
completedAt: 2026-08-25T05:54:42Z
prNumber: 1337
mergeCommit: d6301e30d4f568c4454c8a82202cdb882a91cffd
plannerNote: P5 성능 검증(PLAN 141 행) — T-1687 Follow-up ① 의 코드 pr 앞단, 설계 ① 후보 A 로 문제 (a) p99 미확보만 닫는다
---

# T-1688 — 부하 스크립트 3 종에 p(99) summaryTrendStats 배선

## Why

T-1687 이 부하계획 `§3` 의 `#### 단계별 percentile export 설계 (사전 박제, T-1687)` 소절로 굳힌 조항 ①~⑤ 중,
**조항 ⑤ (i) 코드 `pr`** 경로의 앞단이다. 설계가 정의한 두 공백 중 **문제 (a) — `p99` 미확보** 만 닫는다:
k6 기본 요약이 `p(90)` · `p(95)` 까지만 내보내 `§3` 표 "집계" 규약의 셋째 항(`p99`)이 S1 12·13 회차 · S2 2·3 회차 ·
S3 1·2 회차 **전 회차에서 "미확보"** 로 이월돼 있다. 설계 ① 이 열어둔 후보 2 종 중 **후보 A
(`options.summaryTrendStats` 에 `p(99)` 추가)** 를 택해 새 dependency **0** 으로 회수 수단을 배선한다.
PLAN `140~141 행` "성능 검증(R-91)" 축의 후속이며, 문제 (b)(단계 분해)는 본 task 범위 밖이다(아래 Out of Scope).

## Required Reading

- `docs/ops/load-resilience-test-plan.md` `281~348 행` — `#### 단계별 percentile export 설계 (사전 박제, T-1687)` 소절 전체 (조항 ①~⑤ 가 본 task 의 계약이다)
- `test/load/s1-batch.js` `58~74 행` — `export const options` (thresholds 는 문자 단위 불변 대상)
- `test/load/s2-read.js` `57~75 행` — `export const options`
- `test/load/s3-concurrent.js` `32~48 행` — `export const options` (`stages` · `thresholds` 불변 대상)
- `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` `4172~4379 행` — 마지막 describe(T-1682) 와 `routeTagsOf` helper. 새 describe 는 이 파일 **끝에 append** 하고 기존 describe 본문은 건드리지 않는다.

## Acceptance Criteria

- [x] `test/load/s1-batch.js` · `s2-read.js` · `s3-concurrent.js` 세 스크립트의 `export const options` 에 각각
      `summaryTrendStats` 배열을 선언하고, k6 기본 6 종(`avg` · `min` · `med` · `max` · `p(90)` · `p(95)`)을 **전부 보존**한 위에
      `p(99)` 를 추가한다. 각 선언 옆에 목적(설계 문제 (a) 회수 · 관찰 전용)을 한국어 주석 1~2 줄로 남긴다.
- [x] 설계 조항 ② 준수 — 세 스크립트의 `thresholds` 배열 · 임계 숫자(`3000` · `0.01` · `BATCH_P95_MS` · `STUB_BASELINE_P95_MS`) ·
      판정 route tag(`batch` · `read` · `write` · `persons` · `groups` · `parts` · `me`) · `options.stages` · `vus` · `duration` · `iterations` 은
      **문자 단위 0 변경**. `git diff -U0` 이 순수 삽입(+주석) 임을 확인한다.
- [x] 설계 조항 ① 준수 — `package.json` 의 `dependencies` / `devDependencies` 에 새 키 **0**(k6 내장 기능만 사용).
- [x] **happy-path test**: drift-guard spec(`test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts`) 끝에 새 describe 를 append 해,
      세 스크립트가 각각 `summaryTrendStats` 를 선언하고 그 배열이 기본 6 종 + `p(99)` 를 모두 포함함을 단언한다(스크립트당 1+ it).
- [x] **error path test**: 존재하지 않는 스크립트 경로에 대해 읽기가 `throw` 하고(0-byte silent fallback 으로 false-PASS 되지 않음),
      새로 추가한 추출 helper 에 non-string 입력을 주면 `TypeError` 임을 단언하는 it 1+.
- [x] **flow / 분기 cover**: 새 추출 helper 의 분기마다 합성 입력으로 it 1+ — (a) `summaryTrendStats` 배열이 있는 입력 → 원소 목록 반환,
      (b) 배열이 없는 입력 → 미발견 정규형(빈 배열 또는 `null`, throw 아님), (c) 따옴표 종류(`"` / `'`) · 줄바꿈 배치가 달라도 같은 정규형.
- [x] **negative cases 충분 cover** (아래 5 종 각각 it 1+):
      (1) 합성 mutation — `p(99)` 를 뺀 스크립트 본문이면 guard 가 검출(fail 판정)한다.
      (2) 합성 mutation — 기본 6 종 중 하나(`med`)를 지운 본문이면 guard 가 검출한다(열 소실로 기존 회차 대조 불가 차단).
      (3) 세 스크립트 어디에도 `p(99)` 를 **임계로** 쓴 표현이 없다(`thresholds` 안에 `p(99)<` 문자열 0 — 관찰 전용, 조항 ②).
      (4) `package.json` 어디에도 k6 dependency 키가 없다(정적 바이너리 규약 승계).
      (5) `.github/workflows/load-k6.yml` 에 `pull_request` · `push` · `schedule` 트리거가 여전히 없다(상시 CI 무영향 승계).
- [x] `pnpm lint && pnpm build && pnpm test` 통과 + `pnpm test:smoke` 로 새 describe 포함 green.
- [x] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [x] 새 `workflow_dispatch` · rerun · 실측 수치 회수 **0** — 본 task 는 배선만 하고 값 회수는 후속 slice 다.

## Out of Scope

- **설계 문제 (b) — 단계 분해 tag**(조항 ③ 의 `s3-concurrent.js` 단계 식별 전용 tag key 1 개 추가) 는 본 task 에서 하지 않는다. 별도 `pr` slice.
- **설계 후보 B(`handleSummary()`)** 배선 — 후보 A 로 (a) 가 닫히므로 본 task 에서는 쓰지 않는다.
- `docs/ops/load-resilience-test-plan.md` · `docs/PLAN.md` 본문 수정 **0** — 조항 ⑤ (ii) 대로 실 run 으로 값이 회수된 **뒤** 별도 `direct` slice 가 갱신한다.
- `§3.1` 기존 회차 기록의 "미확보" 표기 소급 치환 금지.
- `.github/workflows/load-k6.yml` · `package.json` 의 `test:load*` 스크립트 변경 0(경로 · env parity 는 이미 배선 완료).
- `test/load/smoke.js` 변경 0(측정 회차 기록 대상이 아니다).
- 기존 describe 본문 수정 0 — 새 describe append 만.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시 비어 있음)

## Result (2026-08-25T05:54:42Z)

**DONE** — PR [#1337](https://github.com/myungjoo/Assessment-Agent/pull/1337) squash merge `d6301e30`, feature branch 삭제 완료.

- `test/load/s1-batch.js` · `s2-read.js` · `s3-concurrent.js` 세 스크립트의 `export const options` 에
  `summaryTrendStats`(k6 기본 6 종 `avg`·`min`·`med`·`max`·`p(90)`·`p(95)` **전부 보존** + `p(99)` 추가)를
  목적 주석과 함께 선언. `git diff -U0` **삭제 0 의 순수 삽입** — 임계 숫자 · `thresholds` · 판정 route tag ·
  `stages` · `vus` · `duration` · `iterations` 는 문자 단위 **0 변경**(설계 조항 ②), 새 dependency **0**(조항 ①).
- drift-guard smoke `load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 끝에 describe 1 개 · **it 12 개** append
  (happy 4 · error 1 · 분기 3 · negative 5). 기존 describe 본문 변경 0, 해당 spec 266 it green.
- `+196/-0` · 4 파일(cap 안). `pnpm lint` · `build` · unit **453 suite / 13,009 test** · `test:cov` 임계 통과.
- reviewer **APPROVE** round 1/7, 4-게이트 PASS(PR comment 외부 존재 · PR CI green · integrator 자체 점검).
- **새 `workflow_dispatch` · rerun · 실측 수치 회수 0** — 배선만이며, 실 run 에서 `p(99)` 값을 회수해
  부하계획 6 군데의 "미확보" 표기를 갱신하는 것은 조항 ⑤ (ii) 대로 후속 `direct` slice 소관이다.
