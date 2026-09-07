---
id: T-1956
title: 알고리즘·연구 축 상향 건수 관측 로그 배선 (step (9))
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-019]
estimatedDiff: 150
estimatedFiles: 2
estimatedFilesNote: production 1 (evaluation-adjustments-pipeline.ts) + colocated spec 1 — 다른 src·docs·test/perf·workflow 변경 0
created: 2026-09-08
independentStream: p5-algorithm-research-uplift
dependsOn: [T-1953, T-1954]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts
plannerNote: "P5 품질 분류 bullet(PLAN 103 행) — ADR-0064 §Status 가 명시한 유일한 잔여 항목(상향 건수 관측 로그). 선례 T-1946 동형."
---

# T-1956 — 알고리즘·연구 축 상향 건수 관측 로그 배선 (step (9))

## Why

[ADR-0064](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) 는 `§ Status` (`18 행`) 에서 **"잔여 항목은 (c) 의 상향 건수 관측 로그 1 건뿐"** 이라고 스스로 못박았고, `§ Consequences` (`101 행`) 는 그 로그를 오탐 (= 부당 상향으로 동료의 상대 순위가 깎이는 위험) 완화 수단 (iv) 로 지정한다. 상향 adjuster 는 T-1953 · T-1954 로 이미 production 경로에서 `contribution` 을 `"high"` 로 **바꾸고 있는데**, 과잉 발동을 수치로 인지할 경로가 없는 상태다. 본 task 는 ADR-0064 chain 의 **마지막 코드 slice** 이며, 직전 arc 의 동형 선례는 [T-1946](T-1946-content-dedup-removal-count-log.md) (ADR-0063 `§ Follow-ups (c)` 제거 건수 로그, PR #1528) 다.

**issue-still-relevant pre-check (origin/main `c5d14267` 실측 — 안착 0)**:

- `git grep -c "Logger" origin/main -- src/assessment-evaluation/` → **매칭 0**. 평가 layer 전체 (domain + service) 에 `Logger` 참조가 하나도 없다 → 관측 경로 미안착.
- `git grep -n "Logger\|console\." -- src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts` → **0** (ADR-0064 `§ Status` `18 행` 의 실측 서술과 일치).
- 반대로 세어야 할 대상은 이미 안착 — [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) `355~357 행` 이 `const algorithmResearchUplifted = applyAlgorithmResearchUplift(documentAnnotated, signals.algorithmResearch);` 이고 `361 행` 이 flatten 이라, **step (9) 직전 (`documentAnnotated`) 과 직후 (`algorithmResearchUplifted`) 두 배열이 같은 scope 에 동시에 존재** 한다 → 건수 산출 좌표가 실재한다.
- 동일 의도 task 0 — `grep -ln "관측 로그" docs/tasks/*.md` 의 hit 은 T-1946 (다른 축, 완료) 과 ADR-0064 chain task 들의 Follow-ups 언급뿐이고, 알고리즘·연구 축 로그를 수행하는 task 는 없다.

**로그 site 결정 근거** — 건수는 **step (9) 안에서만 정확히 알 수 있다**. orchestrator ([evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) `177 행`) 는 composer 를 단일 호출로 위임하므로 step (6) notable · (7) document 상향분과 step (3) `"zero"` floor 보존분을 구분할 수 없어 **과대 보고** 가 된다. 따라서 composer 안에서 두 배열을 비교해 센다. `Logger` 는 `@nestjs/common` 내장이라 **새 dependency 0** 이고, 반환 계약 · 계산 결과는 1 도 바뀌지 않는 관측 side-channel 이다 (domain 순수성 완화는 본 파일 1 곳 한정 — ADR-0064 `§ Status` 가 지목한 파일 그대로).

**오너 게이트 판정 — 셋 다 미침범**: PLAN `157 행` (R-91 k6 최우선) 은 `package.json` · `.github/workflows/load-k6.yml` · `test/load/` 무변경이라 자원 경합 0 (k6 harness 는 이미 안착). PLAN `158 행` (per-route perf baseline 신규 slice 금지) 은 `test/perf/` 무변경으로 비해당. PLAN `183 행` (REQ 재판정 구현 후 1 회) 은 REQ-019 재판정이 T-1955 에서 **이미 1 회 수행** 됐으므로 본 task 는 `docs/requirements.md` 를 **건드리지 않는다**.

**CLAUDE.md `§ 3` 소비처 동반 의무 판정: 충족** — 본 slice 는 helper 신설이 아니라 production 호출 경로 (`applyEvaluationAdjustments`) 안의 **배선 그 자체** 다. 분리 Follow-up 0, cap 예외 주장 0.

## Required Reading

- [docs/decisions/ADR-0064-algorithm-research-contribution-uplift.md](../decisions/ADR-0064-algorithm-research-contribution-uplift.md) — `§ Status` (`18 행`, 잔여 항목 정의) · `§ Consequences` (`101 행` 오탐 완화 (iv), `104 행` 경계) · `§ Follow-ups (c)` (`112 행`, 관측 로그 축 미착수 표기)
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) — `276~285 행` (step (9) signals guard), `343~346 행` (step (8) 산출 `documentAnnotated`), `348~362 행` (step (9) 호출 + `(10)` flatten + 함수 종료). **본 task 의 유일한 production 변경 지점**
- [src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts) `44 행` (`ALGORITHM_RESEARCH_UPLIFT_LEVEL = "high"`) · `87~123 행` (`applyAlgorithmResearchUplift` 의 `upliftable` 판정 6 규칙 — 세는 대상의 정의). **읽기 전용 — 본 helper 는 수정하지 않는다**
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) `997 행` 이하 `describe("applyEvaluationAdjustments — algorithm-research uplift 배선(T-1954)")` — 본 task 의 spec 을 붙일 이웃 describe (신규 describe 를 그 뒤에 추가한다, colocated 유지)
- [docs/tasks/T-1946-content-dedup-removal-count-log.md](T-1946-content-dedup-removal-count-log.md) — 직전 동형 선례 (제거 건수 1 줄 로그 / 0 건 억제 / raw 유출 0 / spy 기반 spec). 본 task 는 그 구성을 상향 건수 축으로 mirror 한다
- [src/run-status/run-status.service.spec.ts](../../src/run-status/run-status.service.spec.ts) `41 행` — `jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {})` 사내 Logger spy 선례 (본 task 는 동형으로 `log` spy)
- [src/permission-denied/persisting-permission-denied-emitter.ts](../../src/permission-denied/persisting-permission-denied-emitter.ts) `39 행` — `new Logger(<context>)` 선언 선례

## Acceptance Criteria

- [ ] `evaluation-adjustments-pipeline.ts` 에 module-level `const` 으로 `new Logger("EvaluationAdjustmentsPipeline")` 를 1 개 선언한다 (`@nestjs/common` 내장 — **새 dependency 0**). class 신설 · DI 주입 · export 는 하지 않는다.
- [ ] step (9) 직후에서 **상향된 단위 수** 를 계산한다 — 같은 index 의 `documentAnnotated[i].result.contribution` 과 `algorithmResearchUplifted[i].result.contribution` 이 **다른** 원소의 개수. 두 배열은 길이 · 순서가 보존되므로 index 대응이 성립함을 코드 주석 1 줄로 명시한다.
- [ ] 건수가 `> 0` 일 때만 `logger.log(...)` 를 **정확히 1 회** 호출하고, `0` 이면 **억제** 한다 (평가 호출마다 0 건 로그가 쌓이는 것을 막기 위한 결정 — 억제 규칙을 주석 1 줄로 명시). T-1946 의 억제 규칙과 동형.
- [ ] 로그 문자열에 `unitId` · `author` · `narrative` · marker 어휘 · 원본 title 중 **어느 것도 포함하지 않는다** — 건수 (정수) + 고정 한국어 문구만 (REQ-032 raw 미저장 정합 + CLAUDE.md `§ 9`).
- [ ] 반환 계약 무변경 — `applyEvaluationAdjustments` 는 여전히 `algorithmResearchUplifted.map((entry) => entry.result)` 를 반환하고 길이 · 순서 · 각 필드 값이 로그 도입 전과 동일하다. step (9) 이전 8 step 의 코드는 건드리지 않는다.
- [ ] happy-path test 1+ (R-112-1): 알고리즘·연구 신호 대상 author 의 `"low"` 단위 2 건이 섞인 입력에서 `Logger.prototype.log` spy 가 **1 회** 호출되고 인자 문자열에 상향 건수 `2` 가 담긴다.
- [ ] error path test 1+ (R-112-2): `signals.algorithmResearch` 가 `null` / `undefined` 인 입력에서 기존 한국어 `TypeError` 가 그대로 throw 되고 (`276~285 행` guard 회귀 0), 그 경로에서 `log` 호출이 **0 회** 임을 단언한다 (부분 관측 위장 0).
- [ ] 분기별 test (R-112-3): (i) 상향 `> 0` → 로그 1 회, (ii) `signal.byAuthor` 가 빈 배열 (대상 0) → 로그 0 회, (iii) 대상 author 지만 모든 단위가 이미 `"high"` (멱등, 변화 0) → 로그 0 회, (iv) 대상 author 지만 step (3) quality floor 로 `"zero"` 인 단위 → 상향 미발생이므로 로그 0 회, (v) 빈 `entries` → 로그 0 회 · throw 0.
- [ ] negative test (R-112-4, 예외 분기마다 1+): (a) 로그 인자 문자열이 입력의 `unitId` · `author` · `narrative` 값 어느 것도 **포함하지 않음** 을 단언, (b) **step (6) notable · (7) document 상향분만 있고 알고리즘·연구 신호는 꺼진 입력** 에서 로그 0 회 — 다른 축의 상향을 세지 않음의 직접 검증 (T-1946 의 "pass 1 제거분을 세지 않음" 과 동형), (c) `log` spy 를 걸어도 반환 배열이 기존 spec 의 기대와 완전히 동일함 (계약 회귀 0), (d) 입력 `entries` · `signals` 비변형 (`Object.freeze` 입력 통과).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (전역 line ≥ 80% / function ≥ 80%) 이며 변경 파일 `evaluation-adjustments-pipeline.ts` 의 line · branch 100% 유지.
- [ ] 신규 spec 은 **colocated** 위치인 `src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts` 의 `997 행` describe 뒤에 새 `describe("applyEvaluationAdjustments — algorithm-research 상향 건수 관측 로그(T-1956)")` 로 추가한다 (신규 spec 파일 생성 금지 — 파일 수 2 유지).

## Out of Scope

- [evaluation-algorithm-research-adjust.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-adjust.ts) · [evaluation-algorithm-research-signal.ts](../../src/assessment-evaluation/domain/evaluation-algorithm-research-signal.ts) 의 **판정식 · 상수 · 시그니처 변경** — 본 task 는 세기만 하고 상향 규칙을 재구현하거나 helper 반환 shape 을 바꾸지 않는다.
- step (1)~(8) 의 다른 adjuster 에 동형 로그를 함께 다는 것 — cap 초과 + 축별 결정 근거가 다르다. 필요 시 별도 slice (Follow-ups).
- [evaluation-orchestrator.service.ts](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) 변경 — 건수 산출 좌표가 composer 안에 있어 orchestrator 는 손댈 이유가 없다 (`§ Why` 의 site 결정 근거).
- `docs/requirements.md` REQ-019 재판정 — PLAN `183 행` once-rule 상 T-1955 가 이미 1 회 수행했다. 본 task 는 문서 재판정 0.
- ADR-0064 본문 개정 (`§ Status` 잔여 항목 표기 갱신 포함) — ADR 결정 내용 변경은 별건이며, `§ Status` 문구 정리는 `direct` doc slice 로 분리한다 (Follow-ups).
- [evaluation-quality-signal.ts](../../src/assessment-evaluation/domain/evaluation-quality-signal.ts) · [evaluation-quality-adjust.ts](../../src/assessment-evaluation/domain/evaluation-quality-adjust.ts) `2~3 행` 의 `REQ-037 / REQ-038` 주석 오기 정정 — ADR-0064 `§ Consequences` `104 행` 이 범위 밖으로 명시. 별도 `pr` slice.
- [docs/architecture/modules.md](../architecture/modules.md) · [REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 등재, github mapper `kind` 한정 확대 (후속 ADR 선행), marker 어휘 확장 · 본문 축 편입.
- `test/perf/` · `test/load/` · `test/e2e/` · `test/smoke/` · `package.json` · `.github/workflows/` · `prisma/` 일체 무변경 (PLAN `157 행` · `158 행` 오너 게이트 보존, `scripts/daily-test.sh` leg 추가 금지 — drift-guard smoke spec 3 종 동반으로 cap 이 깨진다).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 인접 작업 발견 시 여기에 추가한다.)
