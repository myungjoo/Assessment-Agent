---
id: T-1640
title: load-k6.yml 에 S1 표본 인원 workflow_dispatch input 을 신설해 run 마다 표본을 바꿀 수 있게 한다
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-047]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-08-22
dependsOn: [T-1633, T-1636, T-1638, T-1639]
touchesFiles:
  - .github/workflows/load-k6.yml
  - test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts
independentStream: load-harness-r91
plannerNote: "P5 R-91 chain 21/N — 오너 PLAN 144 행 ②. §5 item 5 잔여 ①(실 scale)·②(반복 run)을 동시에 여는 표본 파라미터화 선행 slice."
---

# T-1640 — S1 표본 인원을 workflow_dispatch input 으로 파라미터화

## Why

오너 지시([PLAN.md](../PLAN.md) `144 행`, [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) ACCEPTED) 의 R-91 chain 은 T-1637·T-1639 로 S1 baseline 실측 **2 회**를 회수했고, [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 의 잔여는 이제 **① 실 scale 실측(133 명)** 과 **② 반복 run 기반 임계 fix** 둘뿐이다. 그런데 현재 표본 인원은 `load-k6.yml` 안에 리터럴 `"10"` 으로 두 곳(S1 실행 step · 기록 step)에 굳어 있어, 표본을 바꾸려면 **매번 workflow 를 수정하는 pr-mode task 가 필요**하다 — 잔여 ①·② 를 각각 여러 회 반복해야 하는 상황에서 이 구조는 slice 를 무한 증식시킨다. 본 slice 는 `workflow_dispatch` 에 표본 인원 input 1 개를 신설하고 기본값을 현행 `10` 으로 고정해, **동작은 그대로 두면서 dispatch 시점에 표본을 주입**할 수 있게 만든다. 잔여 ①(133 명 run)·②(같은 조건 반복 run)을 workflow 재수정 0 으로 여는 선행 slice 다.

## Required Reading

- [.github/workflows/load-k6.yml](../../.github/workflows/load-k6.yml) — `9~10 행` `on: workflow_dispatch:` 트리거, `96~104 행` 부근 "k6 S1 평가 배치 부하 시나리오 실행" step 의 `K6_S1_PERSONS: "10"`, `112~120 행` 부근 "S1 실측 요약 기록" step 의 같은 env 주입.
- [test/load/s1-batch.js](../../test/load/s1-batch.js) `20~35 행` — `__ENV.K6_S1_PERSONS` 기본값 `10` · `EXTRAPOLATION_PERSONS = 133` · 임계 재 선형 외삽식(본 slice 는 **스크립트를 건드리지 않는다**, 기본값 parity 대상으로만 읽는다).
- [test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts](../../test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts) — 파일 머리 helper (`loadYml` · `triggerSection` · `extractStep` · `extractStepBlock` · `extractKey` · `extractEnvFallback` · `unquote` · `stepIndexOf`) 와 표본 인원 parity 를 이미 단언하는 지점 **4 곳**: `1578 행`(T-1633 (b)) · `1799 행` · `1901 행` · `2260~2265 행`(T-1636/T-1638 계열). 본 slice 가 최소 수정으로 승계해야 하는 대상이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§3` 각주 · `§3.1` 2 회차 기록 · `§5` item 5 잔여 ①·②.
- [docs/decisions/ADR-0057-s1-batch-load-io-isolation.md](../decisions/ADR-0057-s1-batch-load-io-isolation.md) `D4` — 축소 표본 + 재 선형 외삽 게이트(본 slice 는 이 결정을 바꾸지 않는다).

## Acceptance Criteria

- [ ] `load-k6.yml` 의 `on: workflow_dispatch:` 가 input **`s1_persons`** 1 개를 갖는다 — `description` 은 한국어(표본 인원 설명 + 미지정 시 기본값 의미), `required: false`, `type: string`, **`default: "10"`**. input 을 2 개 이상 신설하지 않는다.
- [ ] "k6 S1 평가 배치 부하 시나리오 실행" step 과 "S1 실측 요약 기록" step 의 `K6_S1_PERSONS` 주입값이 **둘 다 같은 input 표현식**(`${{ inputs.s1_persons }}`)을 가리킨다 — 두 곳이 서로 다른 값을 가질 수 있는 형태(한쪽만 리터럴 유지)는 금지(회차 간 기록 drift 원인).
- [ ] `test/load/s1-batch.js` 는 **변경 0** — 스크립트의 `__ENV.K6_S1_PERSONS` 기본값 `10` 과 `EXTRAPOLATION_PERSONS = 133` · 임계 외삽식은 그대로다. 본 slice 는 **주입 경로만** 파라미터화한다.
- [ ] 기존 표본 parity 단언(위 Required Reading 의 4 지점)을 **취지 보존한 채 최소 수정**한다 — 리터럴 `"10"` 직접 비교 대신 `workflow_dispatch` input 의 `default` 를 뽑아 스크립트 `__ENV` 기본값과 대조하는 형태로 옮긴다(양쪽 동시 drift 차단이라는 원래 의도 유지). 단언을 **삭제하거나 느슨하게(예: `toBeDefined()` 로 치환) 만들지 않는다**.
- [ ] 위 목적의 helper 는 **최대 1 개**만 신설하고(예: input 표현식 → 선언된 default 해석), 나머지는 기존 helper 재사용. 신설 helper 는 non-string 입력에 `TypeError` 를 던지는 기존 helper 계약과 동형이다.
- [ ] `test/smoke/load-workflow-k6-harness-wiring-drift.smoke-spec.ts` 에 **T-1640 describe 1 블록**을 추가하고 아래 R-112 4 종을 모두 cover 한다:
  - [ ] **happy-path**: ① `workflow_dispatch` 에 `s1_persons` input 이 선언돼 있고 `default` 가 스크립트 `__ENV` 기본값과 같다는 단언, ② S1 실행 step 의 `K6_S1_PERSONS` 가 그 input 표현식을 가리킨다는 단언, ③ 기록 step 의 `K6_S1_PERSONS` 도 같은 표현식을 가리킨다는 단언.
  - [ ] **error path**: ① 표현식이 오타난 형태(`inputs.s1_person` 등 다른 이름)를 가리키지 않음 — 선언된 input 이름 집합과 대조, ② 신설 helper 가 non-string 입력에 `TypeError` 를 던진다, ③ 선언되지 않은 input 을 조회하면 `null`(추측 0) 을 돌려준다.
  - [ ] **분기 cover**: 신설 helper 의 "표현식이 input 참조인 경우 / 리터럴 값인 경우" 두 갈래 각각 1+ test(파라미터화 이전 형태의 workflow 문자열을 넣어도 리터럴 그대로 해석돼야 한다 — 하위호환 분기).
  - [ ] **negative cases 충분 cover**: ① input 을 `required: true` 로 선언해 무인자 dispatch 를 깨뜨리는 형태가 **없음**, ② `default` 가 비어 있거나 숫자 아님(공백·비숫자 문자열) 인 형태가 **없음**, ③ input 신설이 `pull_request` · `push` · `schedule` 트리거 유입을 동반하지 않음(상시 CI 오염 차단 — T-1620 negative 계약 유지), ④ 기록 step 이 여전히 `if: always()` 이고 S1 step 뒤에 온다(T-1636/T-1638 순서 계약 회귀 0), ⑤ 기록 step 의 메타 7 항목과 `tee -a` append 배선이 그대로다(T-1638 회귀 0), ⑥ step env 에 표본 인원 리터럴 `"10"` 이 **남아 있지 않음**(파라미터화 누락 차단).
- [ ] `pnpm lint && pnpm build` 통과.
- [ ] `pnpm test` 통과 — 대상 drift-guard spec 의 기존 describe(T-1620~T-1638) 회귀 0.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%). `src/` 변경 0 이라 coverage 수치 변동은 없어야 한다.

## Out of Scope

- **실제 dispatch 를 하지 않는다** — 파라미터화가 실 run 에서 동작하는지 확인하는 dispatch + `§3.1` 기록은 별도 direct slice.
- **표본 인원 133 명 실 scale run · dataset seed**(`§5` item 5 잔여 ①) 금지 — 본 slice 는 기본값 `10` 을 그대로 둔다.
- **`§3` 표 임계 숫자 fix**(잔여 ②) 금지 — 반복 run 분산 확보 전에는 무변경.
- `test/load/*.js` 스크립트 본문 변경 금지(임계식 · 외삽 상수 · setup/teardown 포함).
- S2 / S3 step 에 같은 input 파라미터화를 확장하지 않는다 (S1 우선 — 필요 시 별도 slice).
- `docs/ops/load-resilience-test-plan.md` · `PLAN.md` doc-sync 는 direct-mode 라 본 pr task 에 섞지 않는다 (CLAUDE.md §3.1 rule 3).
- `actions/checkout@v4` Node 20 deprecation 경고 해소(T-1637 Follow-ups) · `set -o pipefail` 등 shell 옵션 정책(T-1638 Follow-ups) 는 본 slice 에 섞지 않는다.
- 새 외부 action · 새 npm dependency 도입 금지 (CLAUDE.md §5 새-dep 게이트).

## Suggested Sub-agents

`implementer → tester`

## Result (2026-08-22)

PR **#1315** 스쿼시 머지 **f6c34b2d** (2 파일 +249/-12, reviewer round 1 APPROVE · 4-게이트 통과).
`load-k6.yml` 의 `on: workflow_dispatch:` 에 input **`s1_persons`** 1 개만 신설했다 — 한국어 description
(표본 인원 + 미지정 시 기본값 의미) · `required: false` · `type: string` · `default: "10"`. "k6 S1 평가 배치
부하 시나리오 실행" step 과 "S1 실측 요약 기록" step 두 곳에 리터럴로 굳어 있던 `K6_S1_PERSONS: "10"` 은
**같은 input 표현식 하나**로 통일해, 한쪽만 리터럴로 남아 회차 기록이 drift 하는 경로를 없앴다.
`test/load/s1-batch.js` 는 **변경 0** — `__ENV.K6_S1_PERSONS` 기본값 10 · `EXTRAPOLATION_PERSONS = 133` ·
재 선형 외삽 게이트(ADR-0057 `D4`)는 그대로이고 본 slice 는 주입 경로만 파라미터화했다.
drift-guard smoke spec 의 기존 표본 parity 단언 4 지점은 삭제·완화 없이 "`workflow_dispatch` input 의
`default` ↔ 스크립트 `__ENV` 기본값 대조" 형태로 옮겨 양쪽 동시 drift 차단이라는 원래 취지를 보존했고,
신설 helper 는 `resolveInputExpr` **1 개뿐**(non-string 입력에 `TypeError` 를 던지는 기존 helper 계약과 동형).
T-1640 describe 1 블록(it 14 개 — happy 3 · error 3 · 분기 2 · negative 6) 추가로 smoke 160 test pass,
unit 443 suite / 12738 test pass, `test:cov` 임계(line·function 80%) 통과 — `src/` 변경 0 이라 수치 불변.
이로써 [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§5` item 5 의 잔여
①(실 scale 133 명 실측) · ②(반복 run 기반 임계 fix) 를 **workflow 재수정 0** 으로 열 수 있다.

## Follow-ups
