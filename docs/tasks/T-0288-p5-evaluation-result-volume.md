---
id: T-0288
title: P5 평가 결과 타입 + volume 산출 — EvaluationResult + 결정적 volume 계산 순수 함수
phase: P5
status: DONE
completedAt: 2026-06-09T00:50:00+09:00
prNumber: 240
mergedAs: ffab1a6
reviewRounds: 1
commitMode: pr
coversReq: [REQ-026, REQ-037, REQ-038, REQ-040, REQ-097, TBD]
estimatedDiff: 225
estimatedFiles: 3
created: 2026-06-09
dependsOn: [T-0286, T-0287]
plannerSource: "ADR-0032 Follow-ups §2/§3 splitted — scoring service slice 안에서 결정적 volume 산출만 분리(LLM mocked 의존 0)"
plannerNote: "P5 두 번째 impl slice — ADR-0032 §3 의 deterministic volume 산출만 분리. dependency 0, LLM 무관 순수 함수, R-112 4종 cover."
---

# T-0288 — P5 평가 결과 타입 + volume 산출 (EvaluationResult + deterministic volume)

## Why

[ADR-0032 P5 평가 계약](../decisions/ADR-0032-p5-evaluation-contract.md) 의 Follow-ups §2/§3 에서 가장 작은 dependency-free slice 를 분해한다. T-0287 (`Activity` → `EvaluationInput` 매퍼 MERGED, PR #239) 이 평가 입력 layer 의 backbone 을 박제했고, 본 task 는 그 위에서 **출력(`EvaluationResult`) 타입 + 결정적 volume 산출 순수 함수** 를 박제한다.

핵심 가치 — (1) ADR-0032 §3 가 박제한 `EvaluationResult` 의 4 필드 (`narrative` / `difficulty` / `contribution` / `volume`) 중 **`volume` 만이 LLM 무관 deterministic 수치** 이므로 (ADR §3 "양은 metadata 기반 deterministic, LLM 무관"), LLM mock 의존 0 의 순수 함수 slice 로 단독 분리 가능. (2) 본 slice 가 출력 타입의 단일 source-of-truth 를 박제하면, 후속 scoring service slice (Follow-up §2, LLM `generate` 호출 + narrative/contribution/difficulty 채움) 는 본 타입 위에서만 동작 — `EvaluationResult` 의 contract 가 LLM 호출 layer 의 입력 invariant 가 된다. (3) `volume` 의 결정적 산출은 abusing 방지 metric (R-26 코드 abusing / R-40 문서 abusing) 의 기반 — LLM 정성 (R-37/38 품질 분류) 과 분리해 독립 검증 가능.

본 slice 는 **순수 타입 + 순수 함수 + colocated spec** 만 — dependency 0 / NestJS @Injectable 0 / Prisma 0 / LLM 호출 0. T-0287 (evaluation-input.ts + evaluation-input.mapper.ts) 의 동형 패턴 mirror.

## Required Reading

- [docs/decisions/ADR-0032-p5-evaluation-contract.md](../decisions/ADR-0032-p5-evaluation-contract.md) — §3 (난이도·기여도·양 output 산출 계약) + §Follow-ups (scoring service slice 분리). 본 task 가 박제할 `EvaluationResult` 필드 4 종 (`narrative` / `difficulty` / `contribution` / `volume`) 의 의미와 결합 원칙. `volume` 이 deterministic metric 수치임을 명시 (§3 "양은 metadata 기반 결정적 수치, LLM 무관").
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) — T-0287 박제. 본 task 의 `volume` 계산 함수의 입력 타입. `metadata: ActivityMetadata` 필드 surface.
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) — `ActivityMetadata = Record<string, ActivityMetadataValue>` (`string | number | boolean | null` scalar only — REQ-032). `titleLength: number` 같은 현 metadata 키 패턴.
- [src/assessment-collection/domain/activity-contribution.mapper.ts](../../src/assessment-collection/domain/activity-contribution.mapper.ts) — `PLACEHOLDER_VOLUME` placeholder + 주석 ("contributionScore / volume 은 수집 시점에는 미정 — P5 평가 파이프라인이 채움"). 본 task 가 그 placeholder 를 평가-side 에서 실 산출로 대체.
- [src/llm/difficulty.ts](../../src/llm/difficulty.ts) — `Difficulty = "easy" | "medium" | "hard"` + `DIFFICULTIES` const. `EvaluationResult.difficulty` 필드의 타입 source.
- [src/llm/llm-gateway.interface.ts](../../src/llm/llm-gateway.interface.ts) — `LlmGenerateResult.narrative: string` shape. `EvaluationResult.narrative` 필드가 그대로 흘려받을 surface.
- [docs/architecture/data-model.md](../architecture/data-model.md) §4 (REQ-032 raw-not-stored 불변) — `EvaluationResult` 도 raw 본문 필드 부재 보장.

## Acceptance Criteria

### 신규 파일 박제

- [ ] **`src/assessment-evaluation/domain/evaluation-result.ts` 신설** — `EvaluationResult` interface + `ContributionLevel` (`"zero" | "low" | "medium" | "high"`) union + `CONTRIBUTION_LEVELS` const + `isContributionLevel` 순수 type-guard 박제. 파일 머리 주석에 ADR-0032 §3 / REQ-032 / R-37·38 정합 명시. `import` 는 `Difficulty`(`src/llm/difficulty.ts`) + `EvaluationInput`(domain 내) 만 — NestJS / Prisma import 0. `evaluation-input.ts` 의 `ContributionKind` + `satisfies` 패턴 정확히 mirror. `EvaluationResult` 필드 5 종:
  - `unitId: string` — 평가 단위 식별자 (EvaluationInput.unitId 와 정합 — 결과 ↔ 입력 trace 가능).
  - `narrative: string` — LLM 정성 평가문 (`LlmGenerateResult.narrative` 그대로 수용). 본 타입의 필드 존재만 박제, 채우는 책임은 후속 scoring service slice.
  - `difficulty: Difficulty` — 난이도 분류 결과 (easy/medium/hard, `DIFFICULTIES` 정합). R-97 라우팅의 record 차원.
  - `contribution: ContributionLevel` — 기여도 품질 분류 (R-37/38 — zero/low/medium/high 4 등급). zero=단순 보고·copy-paste, high=새 알고리즘·외부 연구 도입.
  - `volume: number` — 양 (deterministic 수치, ≥ 0 정수). 본 task 의 산출 함수가 채우는 유일 필드.

- [ ] **`src/assessment-evaluation/domain/evaluation-volume.ts` 신설** — `calculateEvaluationVolume(input: EvaluationInput): number` 순수 함수 박제. 입력 `EvaluationInput.metadata` 의 scalar 신호를 결정적으로 ≥ 0 정수로 축약한다. throw 0 / 부수효과 0 / @Injectable 0 / LLM 호출 0.
  - **산출 규칙 (v1 baseline)**: `metadata.titleLength` (number) 가 존재하면 그 값을 그대로 volume 으로 사용 (현 collection mapper 가 박제하는 유일 metric — github-activity.mapper.ts / confluence-activity.mapper.ts). 없으면 0. 음수 (방어 — scalar 부정) 는 0 으로 절하. NaN/Infinity 도 0.
  - **타입 안정성**: `metadata.titleLength` 가 number 가 아니면 (string/boolean/null) 0 으로 fallback — `ActivityMetadataValue` union 전 시나리오 cover.
  - **확장 여지 박제**: JSDoc 에 "v1 = titleLength baseline, 추후 R-26 abusing 방지 (commit/PR 숫자만 늘리기) + R-40 문서 abusing (의미 없는 반복) metric 이 추가될 때 본 함수에 누적 — LLM 무관 deterministic 원칙 유지" 명시.

- [ ] **`src/assessment-evaluation/domain/evaluation-result.spec.ts` 신설 (colocated)** — R-112 4 종 + negative cases 충분 cover (CLAUDE.md §3.2):
  - **happy-path** — `EvaluationResult` 객체가 5 필드 (`unitId` / `narrative` / `difficulty` / `contribution` / `volume`) 를 모두 보유하고 type-level shape 가 일치함 검증 (1+ test).
  - **branch cover (`isContributionLevel`)** — `CONTRIBUTION_LEVELS` 멤버 4 종 각 truthy 분기 + 멤버 아님 (예: `"invalid"`, `""`) falsy 분기 (각 1+).
  - **type-level shape group** — `EvaluationResult` 가 raw 본문 키 (`body` / `diff` / `html` 등) 부재임을 type-level assertion 으로 박제 (REQ-032 보존). `CONTRIBUTION_LEVELS` 가 union 멤버 누락 0 (compile-time `satisfies` 검증).
  - **negative** — `difficulty` 가 항상 `DIFFICULTIES` 멤버임 검증, `contribution` 이 항상 `CONTRIBUTION_LEVELS` 멤버임 검증.

- [ ] **`src/assessment-evaluation/domain/evaluation-volume.spec.ts` 신설 (colocated)** — R-112 4 종 + negative cases 충분 cover:
  - **happy-path** — `metadata.titleLength: number` 가 양의 정수일 때 그 값 반환 (예: 42 → 42). 0 일 때 0 반환. 1+ test 각.
  - **error path / negative** —
    - `metadata.titleLength` 부재 → 0.
    - `metadata.titleLength` 가 string (예: `"42"`) → 0 (타입 fallback).
    - `metadata.titleLength` 가 boolean (true/false) → 0.
    - `metadata.titleLength` 가 null → 0.
    - 음수 (예: -5) → 0 (방어).
    - NaN → 0.
    - Infinity / -Infinity → 0.
    - 소수 (예: 3.14) → 3 (floor 또는 정의된 정규화 — JSDoc 에 명시한 규칙 따라 검증).
    - 빈 `metadata` 객체 → 0.
    - `metadata` 에 다른 키만 있고 `titleLength` 부재 → 0.
  - **branch cover** — typeof 분기 (number 정상 / number 비정상 / 비-number) 각 1+ test.
  - **결정성 (determinism)** — 동일 입력 2 회 호출이 동일 출력 (LLM 의존 0 검증).

### 통과 명령

- [ ] `pnpm lint` 통과 (0 error).
- [ ] `pnpm build` 통과 (TypeScript strict mode).
- [ ] `pnpm test src/assessment-evaluation/domain/evaluation-result.spec.ts src/assessment-evaluation/domain/evaluation-volume.spec.ts` 통과 (모든 assertion green).
- [ ] `pnpm test:cov` 전체 통과 + `coverageThreshold.global` (line ≥ 80% AND function ≥ 80%) 충족. 신규 파일 (types + volume 함수) 의 line/function/branch 100% 목표 (순수 함수라 도달 가능).
- [ ] CI workflow 의 `pnpm test:smoke` / `pnpm test:e2e` 도 그대로 green (본 slice 회귀 0 확인).

### Reviewer/Integrator 게이트

- [ ] reviewer agent APPROVE + PR comment 외부 post (§3.3 4-게이트 (1)(2)).
- [ ] CI green (4-게이트 (4)) + approval-gate (CI step "reviewer agent approval 검증") 통과.
- [ ] integrator self-check 통과 (4-게이트 (3)).

## Out of Scope

- **LLM scoring service / `LlmHttpGateway.generate` 호출 / prompt 조립** — ADR-0032 Follow-up §2 의 별도 후속 slice. 본 task 는 출력 타입 + volume 산출만 — `narrative` / `difficulty` / `contribution` 채우는 책임은 후속.
- **dedup / self-follow-up(R-30) 제외 로직 / earlier-date(R-21) 처리** — ADR-0032 Follow-up §3 별도 slice.
- **`EvaluationInput` 타입 변경** — T-0287 박제 그대로 (본 task 는 import 만).
- **평가 결과 영속화 schema / Prisma migration** — §5 schema 게이트 deferred (ADR-0032 §Consequences 부정 trade-off).
- **issue comment thread 수집 확장** — ADR-0029 수집 경계 별도 ADR/slice.
- **평가 controller / DTO / endpoint / R-9 사용자 지정 기간** — ADR-0032 Follow-up §5.
- **NestJS module / providers 등록** — 본 슬라이스는 순수 타입 + 순수 함수 → caller (scoring service) 가 직접 import. Module 등록은 scoring service slice 책임.
- **collection-side `PLACEHOLDER_VOLUME` 제거 / 대체 wiring** — collection mapper 의 transient placeholder 는 그대로 두고, 평가 layer 가 본 함수로 계산해 결과를 갱신하는 wiring 은 scoring service slice. 본 task 는 함수만 박제, caller 0.
- **abusing 방지 metric (R-26/40) 의 추가 신호 (commit/PR 숫자, update 횟수 중립화)** — v1 은 `titleLength` baseline 만. R-26/40 의 metric 확장은 별도 후속 slice (JSDoc 에 확장 여지 명시).
- **PLAN.md 의 L96 평가 bullet `[ ]`→`[x]` flip** — 본 slice 1 건으로 P5 bullet 종료 아님. 후속 scoring service slice + dedup slice 까지 완결 후 별도 doc-sync.
- **ADR-0032 status PROPOSED → ACCEPTED flip** — 별도 direct commit (1 줄 수정, §3.1 direct).

## Suggested Sub-agents

`implementer → tester` — architect 호출 0 (설계는 ADR-0032 가 박제 완료, 본 slice 는 구현). implementer 가 evaluation-result.ts + evaluation-volume.ts 신설, tester 가 colocated spec 2 종 작성 + R-112 4 종 + negative cover + coverage 100% 확인.

## Follow-ups

(implementer / tester / reviewer 가 작업 중 발견한 인접 work 를 추가)
