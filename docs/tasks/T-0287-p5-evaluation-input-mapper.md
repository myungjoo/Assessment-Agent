---
id: T-0287
title: P5 평가 입력 매퍼 — Activity → EvaluationInput 순수 함수 + colocated spec
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-030, REQ-032, TBD]
estimatedDiff: 225
estimatedFiles: 3
created: 2026-06-08
completedAt: 2026-06-08T22:35:00+09:00
prNumber: 239
mergeSha: 3332972
reviewRounds: 2
plannerNote: P5 첫 impl slice — ADR-0032 Follow-up §1 매퍼 분해. dependency 0, mocked LLM 무관(순수 함수), R-112 4종 cover.
---

# T-0287 — P5 평가 입력 매퍼 (Activity → EvaluationInput)

## Why

[ADR-0032 P5 평가 계약](../decisions/ADR-0032-p5-evaluation-contract.md) ACCEPTED 박제 후 Q-0027 사용자 결정 (option 2 P5 진입 승인 + ADR-first → impl slice 는 Follow-ups 분해) 의 첫 impl slice 다. ADR-0032 §1 Decision (평가 단위 계약) 이 박제한 **`Activity` → `EvaluationInput` 정규화 순수 함수** 를 단독으로 박제한다.

핵심 가치 — (1) `contributionKind` 를 `"code" | "document"` 2 종으로 정규화 (GitHub commit/PR → `code`, GitHub issue + Confluence page → `document`) 해 L82 ([PLAN.md](../PLAN.md) line 82) "GitHub Issue 를 문서 기여로 평가 (R-30)" 를 계약 차원에서 박제, (2) ADR-0032 §2/§3 의 후속 slice (LLM scoring service / dedup) 가 본 매퍼의 출력 위에서 동작하도록 backbone 박제, (3) `Activity` 의 typed-metadata-only surface 만 사용해 REQ-032 raw-not-stored 보존.

본 slice 는 **순수 함수 + 타입 정의 + colocated spec** 만 — dependency 0 / NestJS @Injectable 0 / Prisma import 0 / LLM 호출 0. [src/assessment-collection/domain/activity-contribution.mapper.ts](../../src/assessment-collection/domain/activity-contribution.mapper.ts) 의 동형 패턴 mirror.

## Required Reading

- [docs/decisions/ADR-0032-p5-evaluation-contract.md](../decisions/ADR-0032-p5-evaluation-contract.md) — 본 ADR §1 (평가 단위 계약) + §Follow-ups 의 매퍼 slice 정의. `EvaluationInput` 필드 5 종 (`unitId` / `contributionKind` / `sourceType` / `instanceKey` / `author` / `timestamp` / `metadata`) 박제.
- [src/assessment-collection/domain/activity.ts](../../src/assessment-collection/domain/activity.ts) — `Activity` discriminated union (`GithubActivity` `kind: "commit" | "pr" | "issue"` + `ConfluenceActivity`), `ActivityMetadata` (scalar only — REQ-032), 본 매퍼의 입력 타입.
- [src/assessment-collection/domain/activity-contribution.mapper.ts](../../src/assessment-collection/domain/activity-contribution.mapper.ts) — 동형 패턴 reference. 순수 함수 + sourceType 분기 + REQ-032 보존 주석 스타일을 mirror.
- [src/assessment-collection/domain/activity-contribution.mapper.spec.ts](../../src/assessment-collection/domain/activity-contribution.mapper.spec.ts) — colocated spec 위치/형식 reference (R-112 4 종 cover 스타일).
- [docs/architecture/data-model.md](../architecture/data-model.md) §4 (raw-not-stored invariant REQ-032) — 본 매퍼 출력이 보존해야 할 invariant.

## Acceptance Criteria

### 신규 파일 박제

- [ ] **`src/assessment-evaluation/domain/evaluation-input.ts` 신설** — `EvaluationInput` interface + `ContributionKind` (`"code" | "document"`) union + `CONTRIBUTION_KINDS` const + `isContributionKind` type guard 박제. 파일 머리 주석에 ADR-0032 §1 / REQ-032 정합 명시. `import` 는 `Activity` 도메인의 typed alias (`ActivityMetadata` 등) 만 — NestJS / Prisma import 0. `activity.ts` 의 `DIFFICULTIES`/`ACTIVITY_SOURCE_TYPES` 패턴 mirror.

- [ ] **`src/assessment-evaluation/domain/evaluation-input.mapper.ts` 신설** — `mapActivityToEvaluationInput(activity: Activity): EvaluationInput` 순수 함수 박제. 분기: GitHub `kind="commit"|"pr"` → `contributionKind: "code"` / GitHub `kind="issue"` → `contributionKind: "document"` (L82/R-30) / Confluence → `contributionKind: "document"`. `unitId` 는 `<sourceType>:<instanceKey>:<externalId>` 합성 (ADR-0032 §1 박제 — dedup key 와 정합). `sourceType` / `instanceKey` / `author` / `timestamp` / `metadata` 는 `Activity` 에서 그대로 전사. throw 0 / 부수효과 0 / @Injectable 0.

- [ ] **`src/assessment-evaluation/domain/evaluation-input.mapper.spec.ts` 신설 (colocated)** — R-112 4 종 + negative cases 충분 cover (CLAUDE.md §3.2):
  - **happy-path** — GitHub commit/PR/issue + Confluence page 각 1+ test (총 4 종 분기 cover). GitHub issue → `contributionKind: "document"` 박제 검증 (L82 의 계약 박제).
  - **error path / negative** — `metadata` 가 빈 객체일 때 정상 전사, `metadata` scalar 값 (`string`/`number`/`boolean`/`null`) 4 종 전부 보존, `unitId` 합성 (sourceType + instanceKey + externalId 모두 빈 문자열 불가 시나리오는 입력 invariant 차원이라 skip — Activity 자체가 string 필수). REQ-032 보존 검증 — `EvaluationInput` 에 raw 본문 키 (`body` / `diff` / `html` 등) 부재 type-level 검증. `contributionKind` 가 항상 `CONTRIBUTION_KINDS` 멤버임 검증.
  - **branch cover** — sourceType (github/confluence) × GithubActivityKind (commit/pr/issue) 의 4 분기 (commit→code / pr→code / issue→document / confluence→document) 전부 cover.
  - `isContributionKind` type guard 의 truthy/falsy 분기 각 1+.

### 통과 명령

- [ ] `pnpm lint` 통과 (0 error).
- [ ] `pnpm build` 통과 (TypeScript strict mode).
- [ ] `pnpm test src/assessment-evaluation/domain/evaluation-input.mapper.spec.ts` 통과 (모든 assertion green).
- [ ] `pnpm test:cov` 전체 통과 + `coverageThreshold.global` (line ≥ 80% AND function ≥ 80%) 충족. 신규 파일 (mapper + types) 의 line/function/branch 100% 가 목표 (순수 함수라 도달 가능).
- [ ] CI workflow 의 `pnpm test:smoke` / `pnpm test:e2e` 도 그대로 green (본 slice 가 기존 기능 회귀 0 확인).

### Reviewer/Integrator 게이트

- [ ] reviewer agent APPROVE + PR comment 외부 post (§3.3 4-게이트 (1)(2)).
- [ ] CI green (4-게이트 (4)).
- [ ] integrator self-check 통과 (4-게이트 (3)).

## Out of Scope

- **LLM scoring service / prompt 조립 / `LlmHttpGateway.generate` 호출** — ADR-0032 Follow-up §2 의 별도 slice. 본 task 는 매퍼만.
- **dedup / self-follow-up(R-30) 제외 로직** — ADR-0032 Follow-up §3 별도 slice. 매퍼는 단일 `Activity` 1 건 변환만, batch dedup 0.
- **`EvaluationResult` 타입 / 난이도·기여도·양 산출** — ADR-0032 Follow-up §2/§3 별도 slice.
- **평가 결과 영속화 schema / Prisma migration** — §5 schema 게이트 deferred (ADR-0032 §Consequences 부정 trade-off).
- **issue comment thread 수집 확장** — ADR-0029 수집 경계 별도 ADR/slice.
- **평가 controller / DTO / endpoint** — ADR-0032 Follow-up §5.
- **NestJS module / providers 등록** — 본 매퍼는 순수 함수 → caller (scoring service) 가 직접 import. Module 등록은 scoring service slice 책임.
- **PLAN.md 의 L96 평가 bullet `[ ]`→`[x]` flip** — 매퍼 1 건으로 P5 bullet 종료 아님. 후속 scoring service slice 까지 완결 후 별도 doc-sync.

## Suggested Sub-agents

`implementer → tester` — architect 호출 0 (설계는 ADR-0032 가 박제 완료, 본 slice 는 구현). implementer 가 evaluation-input.ts + evaluation-input.mapper.ts 신설, tester 가 colocated spec 작성 + R-112 4 종 + negative cover + coverage 100% 확인.

## Follow-ups

(implementer / tester / reviewer 가 작업 중 발견한 인접 work 를 추가)
