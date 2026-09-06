---
id: T-1926
title: 문서 축 contribution 상향 helper 를 adjustments pipeline step (7) 로 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-020]
estimatedDiff: 200
estimatedFiles: 2
created: 2026-09-06
independentStream: p5-document-contribution
dependsOn: [T-1925]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts
plannerNote: "P5 · REQ-020 소비처 배선 · T-1925 Follow-up (a) — 상향 helper 를 pipeline step (7) 로 배선 (pre-check 851209ba caller 0)"
---

# T-1926 — 문서 축 contribution 상향 helper 를 adjustments pipeline step (7) 로 배선

## Why

[README.md](../../README.md) `39 행` ("문서를 통해 조직에 큰 기여를 한 인원에게 더 높은 점수") 를 서빙하는 [docs/requirements.md](../requirements.md) `39 행` REQ-020 은 아직 `IN_PROGRESS` 다. 미충족 3 축 중 **식별 축** 은 T-1923(신호) + T-1924(detection pipeline 배선) 로, **결정적 점수 상향 축의 helper** 는 T-1925(`applyDocumentContributionUplift`) 로 채워졌으나 **그 helper 를 실제로 호출하는 소비처가 아직 0** 이라 상향이 런타임에서 한 번도 일어나지 않는다. 본 task 는 CLAUDE.md §3 소비처 동반 의무의 잔여분 — [T-1925](T-1925-document-contribution-score-uplift.md) 의 Follow-up (a) — 만 가져가 helper 를 후처리 composer 의 step (7) 로 배선한다.

**issue-still-relevant pre-check (origin/main `851209ba` 실측)** — 재큐잉이 아니다. ① `git grep -n "applyDocumentContributionUplift" origin/main -- src` 의 **비-spec 히트는 helper 자기 파일뿐**이고 [`evaluation-adjustments-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 에는 **0 행** — 소비처가 실재하지 않는다. ② 같은 파일 `102~104 행` 주석이 "6 번째 `documentContribution`(T-1924)은 … 현재 `applyEvaluationAdjustments` 의 5-step thread 는 이를 소비하지 않는다(상향 adjuster 편입은 후속 slice)" 로 미소비를 **스스로 자인**하고, `251~254 행` 의 마지막 문장은 여전히 `applyNotableContributionUplift(...).map((entry) => entry.result)` 로 코드 축 상향 뒤 곧장 flatten 한다. ③ [`evaluation-adjustments-pipeline.spec.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) `54~55 행` 도 "documentContribution 은 … 현재 어떤 adjuster 도 소비하지 않으므로 빈 신호로만 채운다" 로 동일 사실을 박제한다. → 부분 안착조차 없다. 반대로 **입력 축은 이미 준비 완료** — [`evaluation-detection-signals-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `121 행` 이 `documentContribution: computeDocumentContributionSignal(deduped)` 로 신호를 실제 산출하므로, 본 배선만으로 detection → adjustment 경로가 끝까지 이어진다.

**경쟁 축 배제 근거** — PLAN `157 행` R-91(k6 실 scale 부하)은 배포기기 PAT · LLM 자격증명 게이트라 cron 이 자율 집행할 수 없고, PLAN `158 행` R-92 는 오너가 신규 per-route perf baseline slice 큐잉을 금지했다. PLAN `183 행` AdminView god component 부채는 `web/` 축이라 stream 이 다르다. 본 P5 arc 안에서는 소비처 0 상태를 남겨두는 것이 가장 큰 미완이라 배선을 먼저 닫는다.

## Required Reading

- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) — **변경 정본**. 다음 좌표를 모두 갱신 대상으로 본다.
  - `43~47 행` — 헤더 step 목록의 `6. notable uplift` / `7. flatten`. 문서 축 상향이 새 step (7) 로 들어가고 flatten 이 (8) 로 밀린다.
  - `50~53 행` — "필드 직교성" 절의 `step 3·6 : contribution 만 갱신` 문장(3 = 하한 floor, 6·7 = 상한 uplift).
  - `56~63 행` — "throw 경계(5 위임 helper 와 정합)" 절 및 signal 필드 열거.
  - `70~87 행` — import 블록. `75 행` 이 이미 `DocumentContributionSignal` 을 **type-only** 로 import 하고 있으므로 값 import 는 새 줄로 추가한다.
  - `100~120 행` — `EvaluationAdjustmentSignals` 주석 및 `120 행` `documentContribution` 필드. `102~104 행` 의 "어떤 adjuster 도 소비하지 않는다" 자인 주석이 갱신 대상.
  - `124~171 행` — JSDoc 의 "5-step thread" · step 목록 · 빈 배열 계약.
  - `183~213 행` — signal 필드 guard 5 개(`abuse` / `updateCount` / `quality` / `underPerformer` / `notableContribution`). 같은 형식의 `documentContribution` guard 를 마지막에 1 개 추가한다.
  - `249~255 행` — 현재 step (6) + flatten 문장. 여기가 실제 삽입 지점이다.
- [src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts) `34 행` `DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL = "high"` 와 `applyDocumentContributionUplift(entries, signal)` 시그니처 — 소비할 helper. **재구현 0**, 호출만 한다.
- [src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts) `54~78 행` — `DocumentContributionSignal`(`totalAuthorCount` / `meanDocumentUnitCount` / `byAuthor` / `notableDetected`) 의 필드 이름. spec fixture 작성에 필요하다.
- [src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) — **colocated spec 정본**(신규 spec 파일을 만들지 않는다).
  - `52~101 행` `makeEmptySignals()` — `documentContribution` 을 이미 빈 신호로 채우고 있어 기존 케이스는 무변경 통과한다. `54~55 행` 의 미소비 주석만 갱신.
  - `399 행` `describe("negative cases — 5 signal 필드 누락 (각 step 경계 cover)")` — 여기에 `documentContribution` 누락 케이스를 추가하고 describe 문자열의 "5" 를 실제 개수로 정정.
  - `546~601 행` `describe("applyEvaluationAdjustments — notable uplift 배선(T-1921)")` — **본 task 가 추가할 describe 의 mirror 기준**(신호 충돌 batch 로 floor 우선 + marker + 상향을 한 번에 단언하는 구성).
- [docs/decisions/ADR-0032](../decisions/) 는 읽지 않아도 된다 — 본 slice 는 기존 composer 계약 안의 step 추가라 새 결정이 없다.

## 설계 (구현 전 확정 — ADR 불요)

- 삽입 위치: **step (6) notable uplift 산출을 받아** `applyDocumentContributionUplift(notableUplifted, signals.documentContribution)` 를 호출하고, 그 산출에 `.map((entry) => entry.result)` flatten 을 건다. 즉 순서는 `… → (6) notable uplift → (7) document uplift → (8) flatten`.
- 순서 근거(주석으로 박제): (a) step (3) quality floor **뒤**여야 `"zero"` 하한 우선이 성립한다(helper 자체 규칙 (3) 과 정합). (b) step (6) 과 (7) 은 같은 `contribution` 필드를 다루지만 **목표 등급이 `"high"` 로 동일** 하고 두 helper 모두 멱등이라, 한 author 가 코드 축·문서 축 모두 notable 이어도 산출이 `"high"` 로 수렴한다(순서 무관 — 그래도 v1 순서 고정).
- guard 1 개 추가: `signals.documentContribution` 이 `null` / `undefined` 면 기존 5 guard 와 **같은 문장 형식** 의 한국어 `TypeError`. 던지는 시점은 기존 guard 블록 끝(위임 호출 전).
- 계약 불변: 반환 타입 `EvaluationResult[]`, 길이·순서 보존, 입력 비변형, 위임 throw 전파(try/catch 0), 신호 계산·상향 규칙 재구현 0.

## Acceptance Criteria

- [ ] [evaluation-adjustments-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 가 `applyDocumentContributionUplift` 를 import 해 step (6) 산출 위에 호출하고, flatten 은 그 산출에만 걸린다(`git grep -n "applyDocumentContributionUplift" src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts` 가 import 1 + 호출 1 로 히트).
- [ ] `102~104 행` 의 "현재 어떤 adjuster 도 소비하지 않는다" 자인 주석과 spec `54~55 행` 의 동일 취지 주석이 **둘 다** 소비 사실로 갱신된다(stale 자인 0 — `git grep -n "소비하지 않는다" src/assessment-evaluation/domain/evaluation-adjustments-pipeline*.ts` 가 0 행).
- [ ] 헤더 step 목록 · 필드 직교성 절 · throw 경계 절 · JSDoc 의 "5-step" / "5 위임" / "5 signal" 표기가 실제 step · 위임 · signal 개수와 일치하도록 정정된다(수치 drift 0).
- [ ] **happy-path unit test 1+** — 문서 축 `notable === true` author 의 `"low"` / `"medium"` 단위가 `applyEvaluationAdjustments` 산출에서 `DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL`(`"high"`) 로 상향되고, 배열 길이·순서가 입력과 동일함을 단언.
- [ ] **error path unit test 1+** — `signals.documentContribution` 을 `null` 로, 그리고 `undefined` 로 준 두 케이스가 각각 한국어 `TypeError` 를 던짐을 검증(기존 `399 행` describe 에 편입 + describe 문자열의 signal 개수 정정).
- [ ] **분기별 test 1+** — (a) `documentContribution` 이 빈 신호면 전 단위 무변경(기존 baseline 유지), (b) 문서 축 대상 author 만 상향되고 비대상 author 는 무변경, (c) step (3) quality floor 표적 단위는 `"zero"` 로 남는다(하한 우선), (d) 코드 축 notable 과 문서 축 notable 이 **동시** 인 author 단위가 `"high"` 로 수렴(두 uplift 중복 적용이 값을 깨지 않음).
- [ ] **negative case 를 예외 분기마다 1+** — ① 문서 축 상향이 `narrative` · `difficulty` · `volume` · `unitId` 를 오염시키지 않음, ② `[저성과자] ` / `[중요기여] ` marker 접두(step 4·5)가 문서 축 상향 후에도 보존됨, ③ 호출 전후 입력 `entries` · `signals` deep-equal 불변(입력 비변형), ④ 빈 `entries: []` → `[]` 반환 계약 유지.
- [ ] 신규 spec 파일을 만들지 않고 colocated [evaluation-adjustments-pipeline.spec.ts](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) 안에 `describe("applyEvaluationAdjustments — document uplift 배선(T-1926)")` 1 개로 모은다(T-1921 describe 와 동형 위치 — 파일 끝).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과 — 기존 pipeline spec 케이스는 하나도 깨지지 않는다(`makeEmptySignals` 가 이미 문서 축 필드를 채우므로 baseline 무변경이어야 한다).
- [ ] `pnpm test:cov` 통과 — line 80% 이상 / function 80% 이상 (`package.json` `coverageThreshold.global`).

## Out of Scope

- **코멘트 상향 축 금지** — `narrative` 에 문서 축 marker 를 접두하는 `applyDocumentContributionAnnotation` 류 helper 신설·배선은 별도 slice([T-1925](T-1925-document-contribution-score-uplift.md) Follow-up (b))다. 본 task 는 `contribution` 필드 배선만.
- **helper 본문 수정 금지** — [evaluation-document-contribution-adjust.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts) 및 그 colocated spec 은 손대지 않는다(T-1925 에서 line/branch/function 100% 로 닫혔다). 배선 중 helper 결함이 보이면 고치지 말고 Follow-ups 에 적는다.
- **detection layer 금지** — [evaluation-detection-signals-pipeline.ts](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) · `evaluation-document-contribution-signal.ts` · `DOCUMENT_CONTRIBUTION_RELATIVE_CEILING` 값 변경 0(입력은 이미 준비돼 있다).
- **기존 5 adjuster 및 그 spec 수정 금지** — `evaluation-abuse-adjust.ts` / `evaluation-update-count-adjust.ts` / `evaluation-quality-adjust.ts` / `evaluation-underperformer-adjust.ts` / `evaluation-notable-contribution-adjust.ts`.
- **orchestrator 축 금지** — `evaluation-orchestrator.service.ts` · 그 spec · 영속 mapper · `summary-aggregate.ts` 는 본 task 밖이다(composer 계약이 불변이라 배선 변경 불요).
- `docs/requirements.md` REQ-020 재판정 · `docs/PLAN.md` checkbox 승격 금지 — CLAUDE.md §3.1 에 따라 구현 chain((a)+(b)) 머지 **후** REQ 당 1 회 별도 direct task.
- `prisma/schema.prisma` · 응답 계약 · `deploy/daily-test.sh` · `.github/workflows/` · `package.json` 변경 금지(`daily-test.sh` 는 drift-guard smoke 3 종을 같은 commit 으로 끌어들여 파일 cap 을 깨뜨린다 — Q-0054 동형 사고).
- 새 외부 dependency · 새 ADR 신설 금지. 기존 composer 계약 안의 step 추가라 새 결정이 없으며, 설계 판단이 그 범위를 벗어난다고 보이면 즉시 BLOCKED 로 escalate 한다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (b) 코멘트 상향 slice — 문서 축 notable author 의 `narrative` marker 접두(`applyNotableContributionAnnotation` 패턴 mirror, README `39 행` 뒷절 "더 높은 평가 코멘트") + 그 pipeline 배선.
- (c) (b) 머지 후 REQ-020 재판정 1 회(direct) — `docs/requirements.md` `39 행` 상태 문자열 + PLAN 해당 bullet.
