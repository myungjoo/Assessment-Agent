---
id: T-1611
title: 체크인 baseline step 요약 포매터의 코드 울타리 길이를 본문 백틱 런에 맞춰 동적 산출
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-08-19
createdAt: 2026-08-19T05:41:15Z
independentStream: perf-checkin-baseline
dependsOn: [T-1610]
touchesFiles:
  - test/perf/checkin-baseline-step-summary.ts
  - test/perf/checkin-baseline-step-summary.spec.ts
plannerNote: P5 perf — ADR-0056 §Decision 3 (b) "step 요약" 축. T-1610 reviewer Nit(울타리 길이 고정) 종결로 배선 slice 전 포매터 출력 계약 확정.
---

# T-1611 — 체크인 baseline step 요약 포매터의 코드 울타리 길이 동적 산출

## Why

[ADR-0056](../decisions/ADR-0056-perf-baseline-checkin-ci.md) `§Decision 3 (b)` 의 "step 요약" 축
첫 조각인 `formatCheckinStepSummaryBlock` 은 T-1610(PR #1288 · `93bd570b`) 으로 머지됐으나,
reviewer 가 round 1 에서 **Nit 1 건 — 코드 울타리 길이가 백틱 3 개로 고정**임을 남겼고 그 처리가
"다음 배선 slice 로 이관" 된 상태다. 현재 구현은 백틱 3 개로 고정된 `FENCE` 상수를 그대로 여닫이에 쓰므로,
`formatCheckinOutcomeBlock` 이 실어 나르는 본문(`result.report` 는 상위 io 진입점이 만든 문자열을
가공 없이 잇는다) 안에 백틱 3 개 이상의 런이 한 번이라도 들어오면 **요약 markdown 이 그 지점에서
조기 종료**돼 이후 내용이 렌더 화면에서 사라지거나 깨진다. 관찰-only 정책(exit code 불변)에서는
가시성이 유일한 신호이므로, 요약이 조용히 깨지는 국면은 신호 자체의 소실이다.

본 slice 는 그 Nit 을 **종결**한다 — 울타리 길이를 상수로 두지 않고 **본문의 최장 백틱 런 + 1
(최소 3)** 로 산출해, GitHub 이 권장하는 "내용보다 긴 울타리" 규약을 만족시킨다. `$GITHUB_STEP_SUMMARY`
실제 append 배선과 `ci.yml` 노출이 이 포매터를 소비하기 **전에** 출력 계약을 확정해 두는 것이
목적이라, 소비자 slice 들이 3-백틱 전제를 굳히기 전에 처리한다.

`§Decision 2`(갱신 주체는 pr-mode task 뿐) · `§Decision 3 (b)`(상대 회귀는 관찰만) 는 그대로다 —
본 task 는 표기 안정성만 손보며 판정 · 임계 · exit code · baseline JSON 을 건드리지 않는다.
[PLAN.md](../PLAN.md) `140 행` 성능 검증 bullet 은 `[ ]` 유지, REQ-048 상태 표기도 불변이다.

## Required Reading

- [test/perf/checkin-baseline-step-summary.ts](../../test/perf/checkin-baseline-step-summary.ts) — 본 task 의 변경 대상(`FENCE` 상수 · `formatCheckinStepSummaryBlock` 조립 순서 · 예외 계약).
- [test/perf/checkin-baseline-step-summary.spec.ts](../../test/perf/checkin-baseline-step-summary.spec.ts) — 기존 19 국면(happy 4 · 분기 3 · error path 4 · negative (a)~(f) 8) 의 서술 패턴(본 task 는 그 위에 국면을 **추가**한다 — 기존 국면 삭제 금지).
- [test/perf/checkin-baseline-report.ts](../../test/perf/checkin-baseline-report.ts) — `formatCheckinOutcomeBlock` 이 `result.report` 를 **가공 없이** 잇는다는 계약(본문에 임의 문자열이 들어올 수 있는 근거).
- [docs/decisions/ADR-0056-perf-baseline-checkin-ci.md](../decisions/ADR-0056-perf-baseline-checkin-ci.md) — `§Decision 3 (b)`(관찰-only · 로그와 step 요약) · `§Follow-ups (b)`.

## Acceptance Criteria

- [ ] `test/perf/checkin-baseline-step-summary.ts` 의 고정 `FENCE` 상수 사용을 **본문 기반 산출**로
      바꾼다 — 여닫이 울타리 길이 = `max(3, 본문 안 최장 연속 백틱 런 길이 + 1)`. 최소치 3 은 상수로
      한 번만 적고(표기가 갈리지 않도록), 여는 울타리와 닫는 울타리는 **같은 문자열**을 쓴다.
- [ ] 산출 로직은 **순수 helper 1 개**로 분리해 분기가 spec 에서 직접 겨냥되게 한다(예:
      `resolveFenceForBody(body: string): string`). export 여부는 구현자 판단이되, export 하면 JSDoc
      으로 계약(입력 · 반환 · 예외 없음)을 명시한다.
- [ ] **본문 가공 0 유지** — code block 안 문자열은 여전히 `formatCheckinOutcomeBlock` 결과를 trim ·
      재정렬 · 이스케이프 · 재계산 없이 그대로 싣는다(백틱을 지우거나 치환하지 않는다 — 울타리만
      늘린다). heading · 상태 줄 · 빈 줄 구분 등 **기존 출력 순서와 문구는 불변**.
- [ ] **부작용 0 · 계약 불변** — 파일 시스템 · `process.env` · 시각 · 난수 접근 0, 인자 변형 0,
      기존 `TypeError` / `RangeError` 계약(`sectionTitle` 자체 검증 + 하위 진입점 전파) 그대로.
      `regressed === true` 입력에도 **throw 하지 않는다**(ADR-0056 §Decision 3 (b) exit code 불변).
- [ ] **happy-path** test 1+ — 백틱 런이 없는 통상 본문에서 울타리가 종전대로 백틱 3 개이고, 전체
      블록 문자열이 기존 기대값과 동일함을 단언(회귀 방지).
- [ ] **error path** test 1+ — 기존 예외 계약이 유지됨을 재단언: `result` 가 non-object · `null` 일 때
      `TypeError`, `outcome` 이 허용 밖 문자열일 때 `RangeError` 가 전파된다.
- [ ] **분기 cover** — 울타리 산출의 각 분기 1+ test: (i) 본문 백틱 런 0 개 → 길이 3,
      (ii) 런 최장 2 개 → 길이 3(최소치 유지), (iii) 런 최장 3 개 → 길이 4,
      (iv) 런 최장 5 개 → 길이 6. `outcome` 3 분기(`established` / `compared` regressed true · false)
      국면도 기존대로 유지된다.
- [ ] **negative cases 충분 cover** — 최소 다음 각 1+ test: (a) 본문 백틱이 **줄 중간**에만 있고 줄
      머리에 없는 국면에서도 산출이 성립, (b) 본문이 백틱 런으로 **시작**하는 국면,
      (c) 본문이 백틱 런으로 **끝나는** 국면에서 닫는 울타리가 본문과 붙어 오인되지 않음,
      (d) `sectionTitle` 이 non-string → `TypeError` · 빈/공백-only → `RangeError`(기존 계약 유지),
      (e) 회귀(`regressed === true`) 입력에서 **throw 0** 임을 명시 단언(관찰-only 계약 보호),
      (f) 같은 입력 2 회 호출이 같은 문자열을 내고 인자가 변형되지 않음(순수성).
- [ ] 신규/변경 심볼의 stmt · branch · func · line coverage 100% 유지, `pnpm test:cov` 통과
      (line ≥ 80% / function ≥ 80%).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] 변경 파일 2 개 · diff ≤ 300 LOC 유지(모듈 순증은 주석 포함 ~30 LOC 이내로 억제).

## Out of Scope

- `$GITHUB_STEP_SUMMARY` 로의 실제 append(파일 io · 환경변수 read) — 다음 slice.
- `.github/workflows/ci.yml` 변경(perf step · 토글 · 요약 노출) 0.
- `checkin-baseline-report.ts` · `checkin-baseline-adapter.ts` · `checkin-baseline-spec-wiring.ts`
  등 하위/인접 모듈 변경 0. 본문 문자열을 만드는 쪽에서 백틱을 막는 방식은 **비채택**(가공 0 원칙).
- 기존 `*-measure-confirm-realdb` / `*-read-realdb` perf-spec 배선 변경 0(본 모듈 호출처 신설 0).
- `test/perf/baselines/*.json` 추가 · 갱신 0.
- 상대 회귀의 fail 승격 · tolerance 재산정(ADR-0056 §Decision 3 (b) 의 20 run 표본 조건 미충족).
- `docs/PLAN.md` · `docs/requirements.md` · 부하계획 완료 표기 변경 0.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 발견 시 추가)

## 결과 (2026-08-19T06:49:11Z, DONE)

- `pr` mode — PR [#1289](https://github.com/myungjoo/Assessment-Agent/pull/1289) squash 머지 `d2815f17` + branch 삭제 확인. 2 파일 `+167/-8`, `src/` 0 LOC.
- 고정 `FENCE` 상수를 걷어내고 **본문 최장 백틱 런 + 1** (하한 3) 로 여닫이 울타리 길이를 산출한다. 최소치는 상수 `MIN_FENCE_LENGTH` 1 곳에만 두고, 산출은 export 된 순수 helper `resolveFenceForBody` 로 분리해 JSDoc 에 입력 · 반환 · 예외 없음 계약을 명시.
- **본문 가공 0** — `formatCheckinOutcomeBlock` 이 만든 문자열을 그대로 싣고 울타리만 늘린다. heading · 상태 줄 · 빈 줄 순서 · 문구 · 하위 진입점 모두 불변이라 T-1610 이 확정한 출력 계약이 백틱 없는 본문에서 문자열 단위로 동일.
- **관찰-only 계약 유지** — `regressed=true` 입력에도 throw 0, 부작용 0. 형태 위반은 종전대로 `TypeError` / `RangeError`.
- **R-112** — spec 19 → 34 국면(추가 15: 런 0/2/3/5 분기 · 줄 중간 · 선두 · 말미 런 · title 계약 · 회귀 throw 0 · 순수성). 대상 모듈 stmt/branch/func/line **100%**. 로컬 439 suite · 12610 test pass, `lint` · `build` green, global coverage line · function 임계 충족.
- **4-게이트** — reviewer VERDICT=APPROVE(round 1, comment `#issuecomment-5338523703`) + PR comment 외화(driver 별도 확인) + integrator 자체 점검 + PR CI green 으로 4/4. 잔여 finding 0.
- **남은 축** — `$GITHUB_STEP_SUMMARY` 실제 append 배선과 `ci.yml` 노출은 여전히 미착수(다음 slice). ADR-0056 `§Follow-ups (b)`(본체 ci.yml perf step 편입) · `§Follow-ups (c)`(20 run 표본 미충족) 도 그대로.
