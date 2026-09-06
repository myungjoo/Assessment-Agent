---
id: T-1928
title: 문서 축 narrative annotation helper 를 adjustments pipeline step (8) 로 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-020]
estimatedDiff: 260
estimatedFiles: 3
created: 2026-09-06
independentStream: p5-document-contribution
dependsOn: [T-1927]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts
  - src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts
  - src/assessment-evaluation/evaluation-orchestrator.service.spec.ts
plannerNote: "P5 · REQ-020 코멘트 상향 배선 · T-1927 Follow-up (a) — annotation step (8) 배선 (pre-check eb4acb00 소비처 0 행)"
---

# T-1928 — 문서 축 narrative annotation helper 를 adjustments pipeline step (8) 로 배선

## Why

README `39 행` 은 "조직에 큰 기여를 문서를 통해 한 인원에게 더 높은 점수와 **더 높은 평가 코멘트**" 를 요구한다. [docs/requirements.md](../requirements.md) `39 행` REQ-020 의 미충족 3 축 중 식별 축(T-1923 · T-1924)과 점수 상향 축(T-1925 · T-1926)은 배선까지 닫혔고, 코멘트 축은 helper 만 [T-1927](T-1927-document-contribution-narrative-annotation.md) 로 머지돼 **소비처가 없다**. 본 task 는 T-1927 Follow-up (a) 가 지정한 그 배선을 수행해 CLAUDE.md §3 소비처 동반 의무의 잔여분을 닫는다.

**issue-still-relevant pre-check (origin/main `eb4acb00` / bookkeeping `6302920a` 실측)** — 배선 구멍이 유효하다:

- `git grep -l "applyDocumentContributionAnnotation" origin/main -- src web` 의 히트 파일은 [`evaluation-document-contribution-adjust.ts`](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts)(정의, `141 행`) 와 그 colocated spec **2 개뿐**이다. production 소비처 0 파일.
- [`evaluation-adjustments-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 는 `290 행` 짜리이고 `87 행` import 가 `applyDocumentContributionUplift` **하나만** 가져온다. 본문 `286~289 행` 은 step (7) uplift 산출을 그대로 `.map((entry) => entry.result)` 로 flatten 해 반환 — narrative 접두 경로 0.
- 헤더 주석 `54~55 행` · jsdoc `158 행` 이 "8. flatten" 으로 적혀 있어 현재 pipeline 이 **7 위임 + flatten** 임을 자인한다.
- 반면 입력은 준비 완료다 — `signals.documentContribution` 은 `133 행` 필수 필드이고 `229~236 행` guard 까지 이미 존재한다(T-1924 · T-1926 머지분).
- 소비 경로도 살아 있다 — `applyEvaluationAdjustments` 는 [`evaluation-orchestrator.service.ts`](../../src/assessment-evaluation/evaluation-orchestrator.service.ts) 가 호출하므로, 본 배선이 곧 실행 경로 반영이다.

즉 재큐잉이 아니다. 코드 축 선례는 step (5) `applyNotableContributionAnnotation`(`269~272 행`) 이며 본 task 는 그 문서 축 동형을 uplift 뒤 step (8) 로 붙인다.

**오너 지시 게이트 회피 확인** — PLAN `157 행` R-91 k6 실 scale 자격증명 축 미접촉 · PLAN `158 행` R-92 per-route perf baseline 신규 slice 미큐잉 · PLAN `183 행` REQ 재판정 왕복 제거 지시에 따라 REQ-020 재판정은 본 slice 머지 **뒤 1 회만**(Follow-up (a)).

**소비처 동반 의무(CLAUDE.md §3)** — 본 task 자체가 T-1927 helper 의 소비처 배선이므로 예외 적용 없음. 배선 대상 파일 3 개 · 예상 260 LOC 로 cap(≤ 300 LOC / ≤ 5 파일) 안이다(선례 T-1926 실측 +272/-59 · 3 파일).

## Required Reading

- [`src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) — 본 task 의 배선 대상. `1~14 행` 헤더 step 수 서술 · `44~55 행` v1 순서 목록 · `57~64 행` 필드 직교성 · `87 행` import · `136~189 행` jsdoc · `269~272 행` 코드 축 annotation 선례 · `281~289 행` step (7) + flatten 반환.
- [`src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts`](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts) — 호출할 helper. `121 행` `DOCUMENT_CONTRIBUTION_NARRATIVE_MARKER`(`"[문서기여] "`) · `141 행` `applyDocumentContributionAnnotation` 시그니처 · 멱등 계약.
- [`src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) — 확장 대상 colocated spec. `42 행` `makeResult` · `59 행` `makeEmptySignals` 재사용, `566 행` notable uplift 배선 describe · `625 행` document uplift 배선 describe(T-1926) 가 본 task 가 따를 describe 구성 선례.
- [`src/assessment-evaluation/evaluation-orchestrator.service.spec.ts`](../../src/assessment-evaluation/evaluation-orchestrator.service.spec.ts) — 실행 경로 baseline. 문서 축 notable 이 되는 author 의 `narrative` 단언이 marker 접두로 바뀌는 필연분만 갱신(T-1926 이 같은 위치를 갱신한 선례).
- [docs/requirements.md](../requirements.md) `39 행` — REQ-020 미충족 3 축 서술(코멘트 상향 축 잔여 표기).

## Acceptance Criteria

- [ ] [`evaluation-adjustments-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 가 `applyDocumentContributionAnnotation` 을 import 하고, step (7) `applyDocumentContributionUplift` 산출을 입력으로 받는 **step (8)** 로 호출한다. flatten(`.map((entry) => entry.result)`)은 **step (9)** 로 밀린다. helper 로직(marker 문자열 · notable 판정 · 멱등 처리) 재구현 0 — 호출만.
- [ ] 신호 입력은 기존 `signals.documentContribution` 을 그대로 재사용한다 — `EvaluationAdjustmentSignals` 필드 추가 0, 타입 재정의 0, `229~236 행` guard 재작성 0.
- [ ] 주석 정합: 헤더 `1~14 행`("7-step" · "7 위임 helper" 열거) · `44~55 행` v1 순서 목록 · `57~64 행` 필드 직교성(narrative 그룹에 step 8 편입) · `136~189 행` jsdoc 의 step 수 · 위임 수 서술을 실제 배선(8 위임 + flatten)과 일치시킨다. 수치 drift 0.
- [ ] **happy-path test 1+** — `documentContribution` 신호에 notable author 가 있는 입력에서 `applyEvaluationAdjustments` 산출의 해당 author `narrative` 가 `"[문서기여] "` 로 시작함을 단언(marker 문자열은 helper export 상수를 import 해 단언 — 리터럴 하드코딩 금지).
- [ ] **error path test 1+** — `signals.documentContribution` 이 `null`/`undefined` 일 때 기존 한국어 `TypeError` 가 그대로 유지됨을 단언(배선으로 throw 계약이 바뀌지 않음). 위임 helper 가 던지는 예외를 composer 가 흡수하지 않고 전파함도 1+.
- [ ] **분기별 test 1+** — (a) 문서 축 notable 0 명(무변경 passthrough) (b) notable 1 명(접두) (c) 이미 marker 로 시작하는 narrative(멱등 — 2 회 접두 없음) (d) 코드 축 notable 과 문서 축 notable 이 같은 author 인 경우 두 marker 접두 순서 박제 (e) 저성과자 marker 와 공존하는 경우의 접두 순서 각 1+.
- [ ] **negative case 를 예외 분기마다 1+** — 비대상 author narrative 무오염 · step (1)~(3) 의 `volume`/`contribution` 산출 무변경(필드 직교) · step (7) uplift 결과(`"high"`) 가 step (8) 로 훼손되지 않음 · 입력 `entries`/`signals` deep-equal 비변형 · 산출 길이·순서 보존 · 동일 입력 2 회 호출 deep-equal(결정성) 각 1+.
- [ ] spec 은 colocated [`evaluation-adjustments-pipeline.spec.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.spec.ts) 에 `describe("applyEvaluationAdjustments — document annotation 배선(T-1928)")` 로 추가하고 기존 `makeResult` / `makeEmptySignals` helper 를 재사용한다(신규 spec 파일 신설 금지).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green.
- [ ] `pnpm test:cov` 통과 — 전역 line ≥ 80% AND function ≥ 80%, 변경 production 파일은 100% 유지.
- [ ] diff ≤ 300 LOC · 파일 ≤ 3 개(cap 준수). 실측이 300 에 근접하면 주석 갱신을 step 번호·위임 수 줄로만 한정해 범위를 눌러 담는다.

## Out of Scope

- `docs/requirements.md` REQ-020 재판정 · PLAN bullet 승격 — 본 배선 머지 **뒤** direct task 1 회(Follow-up (a)). 본 PR 에서 doc 상태 문자열을 만지지 않는다(PLAN `183 행` 왕복 금지 지시).
- `evaluation-document-contribution-adjust.ts` helper 본문 변경 — marker 문자열 · 판정 · 멱등 로직은 T-1927 박제분 그대로 사용.
- `evaluation-detection-signals-pipeline.ts` · 신호 산출 helper 변경 0(입력은 이미 준비됨).
- `evaluation-orchestrator.service.ts` production 코드 변경 — composer 호출부는 이미 존재하므로 spec baseline 단언 갱신만 허용.
- web(UI) 노출 · e2e / smoke spec 신설 · 새 dependency · schema 변경.
- R-91 k6 부하 chain(PLAN `157 행`) · R-92 per-route perf baseline 신규 slice(PLAN `158 행`) 접촉 금지.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) 본 slice 머지 후 REQ-020 재판정 1 회(direct) — [docs/requirements.md](../requirements.md) `39 행` 의 미충족 3 축 서술 해소 + PLAN 해당 bullet 승격. REQ 당 1 회만(PLAN `183 행` 지시).
