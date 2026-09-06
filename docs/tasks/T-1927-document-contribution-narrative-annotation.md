---
id: T-1927
title: 문서 축 notable author 의 narrative marker annotation helper 신설
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-020]
estimatedDiff: 230
estimatedFiles: 2
created: 2026-09-06
independentStream: p5-document-contribution
dependsOn: [T-1923, T-1925]
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts
  - src/assessment-evaluation/domain/evaluation-document-contribution-adjust.spec.ts
plannerNote: "P5 · REQ-020 코멘트 상향 축 · T-1926 Follow-up (b) — 문서 축 narrative marker helper (pre-check 8d0f6555 심볼 0 행)"
---

# T-1927 — 문서 축 notable author 의 narrative marker annotation helper 신설

## Why

README `39 행` 은 "조직에 큰 기여를 문서를 통해 한 인원에게 **더 높은 점수와 더 높은 평가 코멘트**" 를 요구한다. [docs/requirements.md](../requirements.md) `39 행` REQ-020 이 열거한 미충족 3 축 중 식별 축(T-1923 · T-1924)과 결정적 점수 상향 축(T-1925 · T-1926)은 머지됐고, 남은 것은 **문서 기반 코멘트 상향 축** 하나다. 본 task 는 [T-1926](T-1926-document-contribution-uplift-pipeline-wiring.md) Follow-up (b) 가 지정한 그 축의 순수 helper 를 신설한다.

**issue-still-relevant pre-check (origin/main `8d0f6555` 실측)** — 코멘트 축 구멍이 유효하다:

- `git grep "DocumentContributionAnnotation\|DOCUMENT_CONTRIBUTION_NARRATIVE_MARKER\|문서기여" origin/main -- src web` 히트 **0 행**. 유일한 문자열 매칭은 [T-1925](T-1925-document-contribution-score-uplift.md) `66 행` · [T-1926](T-1926-document-contribution-uplift-pipeline-wiring.md) `70 행` 의 **Out of Scope 문장**뿐이라 두 선행 slice 가 본 축을 명시적으로 미착수로 남겼음을 자인한다.
- 소비 대상 helper 파일 [`evaluation-document-contribution-adjust.ts`](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts) 는 `109 행` 전체가 `34 행` 상수 · `40 행` 인터페이스 · `73 행` `applyDocumentContributionUplift` 3 개 export 뿐이고 `narrative` 는 `45 행` 주석의 "전사한다" 목록에만 등장한다 — 문서 축이 `narrative` 를 손대는 경로 0.
- 반면 입력 신호는 준비 완료다 — `DocumentContributionSignal` 은 [`evaluation-detection-signals-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-detection-signals-pipeline.ts) `121 행` 에서 6 번째 신호로 산출되고 있다(T-1924 머지분).

즉 본 task 는 재큐잉이 아니다. 코드 축 선례 [`evaluation-notable-contribution-adjust.ts`](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts) `83 행` 상수 + `135 행` `applyNotableContributionAnnotation` 의 **문서 축 동형 mirror** 를 같은 문서 축 파일에 추가한다(코드 축이 annotate + uplift 를 한 파일에 둔 배치와 동형).

**오너 지시 게이트 회피 확인** — PLAN `157 행` R-91(k6 실 scale 자격증명 게이트) 미접촉 · PLAN `158 행` R-92 per-route perf baseline 신규 slice 미큐잉 · REQ-020 재판정은 본 slice 머지 뒤 Follow-up (b) 로 REQ 당 1 회만.

**소비처 동반 의무(CLAUDE.md §3) 예외 적용** — pipeline 배선까지 한 PR 에 넣으면 `evaluation-adjustments-pipeline.ts` + 그 spec + `evaluation-orchestrator.service.spec.ts` 3 파일이 추가돼 **파일 5 개 · 약 380 LOC** 로 cap(300 LOC)을 초과한다(T-1925 → T-1926 분리 선례와 동형). 따라서 배선은 아래 Follow-ups (a) 에 파일 · 배선 단위로 명시한다.

## Required Reading

- [`src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts`](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts) — 본 task 의 수정 대상. `34 행` 상수 · `40~48 행` `DocumentContributionAdjustEntry` · `73~109 행` `applyDocumentContributionUplift`(재사용할 방어 · 색인 · 비변형 패턴).
- [`src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts`](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts) — mirror 원형. `83 행` `NOTABLE_CONTRIBUTION_NARRATIVE_MARKER` · `135 행` `applyNotableContributionAnnotation` · `175~178 행` `startsWith` 멱등 처리.
- [`src/assessment-evaluation/domain/evaluation-document-contribution-adjust.spec.ts`](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.spec.ts) — 확장 대상 colocated spec. `23 행` `makeResult` · `37 행` `makeAuthorEntry` · `49 행` `makeSignal` 기존 helper 재사용(신규 fixture 중복 정의 금지).
- [`src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts`](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.spec.ts) `70~379 행` — 코드 축 annotation 의 5 describe 구성(happy / error / flow / negative / 결정성) 참조.
- [`src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts`](../../src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts) — 소비 신호 `DocumentContributionSignal` / `DocumentContributionEntry` 타입 정의(타입 재정의 금지, `import type` 재사용).
- [docs/requirements.md](../requirements.md) `39 행` — REQ-020 의 미충족 3 축 서술 중 "문서 기반 코멘트 상향 축 부재".

## Acceptance Criteria

- [ ] [`evaluation-document-contribution-adjust.ts`](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.ts) 에 public symbol 2 개 추가: 상수 `DOCUMENT_CONTRIBUTION_NARRATIVE_MARKER`(값은 코드 축 `"[중요기여] "` 와 대칭인 문서 축 한국어 marker 1 개, single-source 로 export) + 순수 함수 `applyDocumentContributionAnnotation(entries: DocumentContributionAdjustEntry[], signal: DocumentContributionSignal): DocumentContributionAdjustEntry[]`.
- [ ] 기존 타입 · 상수 재사용 — `DocumentContributionAdjustEntry` / `DocumentContributionSignal` / `DocumentContributionEntry` 를 **재정의하지 않고** import 만 한다. 신호 판정 로직(평균 × 1.5 비교) 재구현 0 — `signal.byAuthor[*].notable` 을 읽기만 한다.
- [ ] 동작 계약: `notable === true` author 의 **모든** 단위 `result.narrative` 앞에 marker 를 접두하고 그 외 필드(`unitId` / `contribution` / `difficulty` / `volume`)는 전사. author 미매칭 · `notable === false` 는 무변경 passthrough(단 항상 새 객체 복제). `narrative.startsWith(marker)` 면 중복 접두하지 않는다(멱등).
- [ ] 방어: `entries` 또는 `signal` 이 `null`/`undefined` 인 경우의 한국어 `TypeError` 2 개가 유일한 throw. 빈 배열 · 빈 `byAuthor` 는 흡수. 입력 `entries` / 원소 / `result` / `signal` 비변형(길이 · 순서 보존).
- [ ] **happy-path test 1+** — 추가된 public symbol 2 개 각각에 대해: 상수 값 직접 단언 1 건 + notable author 의 narrative 가 marker 접두된 결과 단언 1 건.
- [ ] **error path test 1+** — `entries` `null`/`undefined`, `signal` `null`/`undefined` 각각 `TypeError` throw 와 한국어 메시지 단언.
- [ ] **분기별 test 1+** — (a) author 미매칭 (b) `notable === false` (c) `notable === true` 최초 접두 (d) 이미 marker 로 시작(멱등) (e) 빈 `entries` (f) 빈 `byAuthor` 각 1+.
- [ ] **negative case 를 예외 분기마다 1+** — 비대상 author 의 narrative 무오염 · `contribution`/`difficulty`/`volume` 필드 무변경 · 입력 객체 deep-equal 비변형(`Object.freeze` 통과) · 2 회 적용 결과가 1 회와 동일(멱등) · 출력 길이 · 순서 보존 · 코드 축 marker 와 문자열 충돌 없음 각 1+.
- [ ] spec 은 colocated [`evaluation-document-contribution-adjust.spec.ts`](../../src/assessment-evaluation/domain/evaluation-document-contribution-adjust.spec.ts) 에 `describe("applyDocumentContributionAnnotation")` 로 추가하며, 기존 `makeResult` / `makeAuthorEntry` / `makeSignal` helper 를 재사용한다(신규 spec 파일 신설 금지).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green.
- [ ] `pnpm test:cov` 통과 — 전역 line ≥ 80% AND function ≥ 80%, 변경 파일은 100% 유지.
- [ ] diff ≤ 300 LOC · 파일 2 개(cap 준수).

## Out of Scope

- **pipeline 배선 금지** — [`evaluation-adjustments-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 에 새 step 을 넣거나 step 번호를 재배치하지 않는다(cap 초과 — Follow-up (a)).
- **점수 축 재손질 금지** — `applyDocumentContributionUplift` 본문 · `DOCUMENT_CONTRIBUTION_UPLIFT_LEVEL` 은 무변경. 본 task 는 `narrative` 만 손댄다.
- **detection 재구현 금지** — `computeDocumentContributionSignal` · 상수 `DOCUMENT_CONTRIBUTION_RELATIVE_CEILING` 수정 0.
- **REQ status 재판정 금지** — `docs/requirements.md` `39 행` · PLAN 갱신은 배선 머지 뒤 별도 direct task(Follow-up (b)).
- 코드 축 [`evaluation-notable-contribution-adjust.ts`](../../src/assessment-evaluation/domain/evaluation-notable-contribution-adjust.ts) · 저성과자 helper · orchestrator · Prisma schema · web 미접촉.
- LLM prompt · narrative 문장 생성 변경 금지 — 결정적 marker 접두만.

## Follow-ups

- (a) 소비처 배선 slice — [`evaluation-adjustments-pipeline.ts`](../../src/assessment-evaluation/domain/evaluation-adjustments-pipeline.ts) 에 `applyDocumentContributionAnnotation(entries, signals.documentContribution)` 를 step (7) document uplift 뒤 **step (8)** 로 호출하고 flatten 을 step (9) 로 밀기 + `13`/`47`/`156 행` 주석의 step 수 · 위임 수 갱신 + colocated `evaluation-adjustments-pipeline.spec.ts` 기대값 확장(+ 필요 시 `evaluation-orchestrator.service.spec.ts` baseline narrative 단언 1 줄).
- (b) (a) 머지 후 REQ-020 재판정 1 회(direct) — `docs/requirements.md` `39 행` 상태 문자열(3 축 부재 서술 해소) + PLAN 해당 bullet.
