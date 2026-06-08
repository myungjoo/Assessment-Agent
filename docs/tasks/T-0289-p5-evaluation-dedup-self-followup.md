---
id: T-0289
title: P5 평가-side dedup — 시간적 중복(R-21) earlier-date 우선 + self-follow-up(R-30) 제외 순수 도메인 함수
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-009, REQ-021, REQ-030, TBD]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-06-09
dependsOn: [T-0286, T-0287]
plannerSource: "ADR-0032 Follow-ups §3 (평가-side dedup + self-follow-up 제외 slice) 단독 분해 — LLM 의존 0 순수 도메인 함수"
plannerNote: "P5 세 번째 impl slice — ADR-0032 §4 dedup/self-follow-up 평가-side 책임. dependency 0, LLM 무관 순수 함수, R-112 4종 cover. scoring service slice 와 직교."
---

# T-0289 — P5 평가-side dedup (시간적 중복 earlier-date 우선 + self-follow-up 제외)

## Why

[ADR-0032 P5 평가 계약](../decisions/ADR-0032-p5-evaluation-contract.md) 의 Follow-ups §3 (평가-side dedup + self-follow-up(R-30) 제외 slice) 을 단독 분해한다. T-0287 (`Activity` → `EvaluationInput` 매퍼 MERGED, PR #239) + T-0288 (`EvaluationResult` 타입 + `calculateEvaluationVolume` 결정적 volume 순수 함수 MERGED, PR #240) 이 평가 입력·출력 layer 의 backbone 을 박제했고, 본 task 는 그 위에서 **평가-side 의 중복제거(dedup) 순수 도메인 함수** 를 박제한다.

핵심 가치 — (1) ADR-0032 §4 가 박제한 평가-side dedup 책임 2 종 (i) 시간적 중복 earlier-date 우선(R-21 — 2월 결과물이 3월 timestamp 로 재등장하면 2월 기여로 판단) (ii) self-follow-up 제외(R-30 — A 가 자기 issue 에 자기 follow-up 을 남기고 자기가 소비하는 케이스를 평가 카운트에서 제외) 를 `EvaluationInput[]` 위에서 동작하는 **LLM 무관 순수 함수** 로 구현. (2) 본 slice 가 Q-0027 P5 진입 결정을 driving 한 L82 (GitHub Issue 평가 R-30 + self-follow-up 제외) 의 **self-follow-up 제외 piece** 를 평가-side 에 배치(Q-0027 decision (b) — 수집-side filter 아님)하는 계약을 코드로 박제한다. (3) scoring service slice (Follow-up §2, LLM `generate` 호출) 와 **직교** — dedup 은 LLM 호출 전 단계의 입력 정제이므로 mock LLM 의존 0 으로 단독 검증 가능 (T-0288 `evaluation-volume.ts` 동형 순수 함수 패턴 mirror).

본 slice 는 **순수 함수 + colocated spec** 만 — dependency 0 / NestJS `@Injectable` 0 / Prisma 0 / LLM 호출 0 / DB schema 0 / credential 0 (CLAUDE.md §5 게이트 미발화). 수집-side `commit-dedup.ts` (earliest-wins + 안정적 tie-break) 패턴과 평가-side `evaluation-volume.ts` (순수 함수 + 방어적 입력 처리) 패턴을 결합 mirror.

## Required Reading

- [docs/decisions/ADR-0032-p5-evaluation-contract.md](../decisions/ADR-0032-p5-evaluation-contract.md) — **§Decision (4) dedup + self-follow-up(R-30) 제외 위치** (전문 정독 — 본 task 의 계약 source). 핵심 박제: (a) 수집-side dedup 과 평가-side dedup 은 책임이 다르므로 공존 (수집=구조적 중복 SHA/page-id, 평가=평가 의미의 중복). (b) 평가-side dedup 책임 2 종 = 시간적 중복 earlier-date 우선(R-21) + self-follow-up 제외(R-30). (c) **self-follow-up 검출 semantics**: 'follow-up' = 같은 issue (같은 `externalId` 의 GitHub `kind="issue"` 활동) 안에서 issue 작성자와 동일 author 가 남긴 후속 활동 / 'self' 식별 = author 동일성 / 제외 동작 = self-follow-up 쌍 안의 self-comment(후속)는 평가 카운트에서 제외하되 **issue 생성 자체는 문서 기여로 카운트**. (d) **comment thread 미수집 한계**: 현 수집 mapper 는 issue list item 만 매핑하고 comment thread 는 미수집 → comment-level 정밀 검출은 수집 확장 별도 Follow-up slice 로 deferred. 본 task 는 **comment 미수집 상태에서 검출 가능한 issue 단위 author 동일성 휴리스틱부터 박제**.
- [src/assessment-evaluation/domain/evaluation-input.ts](../../src/assessment-evaluation/domain/evaluation-input.ts) — T-0287 박제. 본 task dedup 함수의 입력 타입. 사용할 필드: `unitId`(dedup key 정합) / `contributionKind`(code/document) / `sourceType` / `author`(self-follow-up 동일성 + 시간적 중복 동일-활동 판정) / `timestamp`(ISO-8601, earlier-date 비교) / `metadata`. **주의**: `EvaluationInput` 에는 `kind`(commit/pr/issue) discriminator 가 없다 — `contributionKind`(code/document) 만 있다. issue 식별은 §Out of Scope / Acceptance Criteria 의 휴리스틱 규칙 참조.
- [src/assessment-collection/domain/commit-dedup.ts](../../src/assessment-collection/domain/commit-dedup.ts) — **패턴 mirror source**. `isEarlier`(Date.parse 수치 비교 우선 + NaN 시 사전식 fallback) + earliest-wins Map 누적 + `firstSeenOrder` 안정적 반환 순서 + 입력 배열 비변형(immutable) 정확히 mirror. 본 task 의 시간적 중복 dedup 이 이 알고리즘을 재사용한다.
- [src/assessment-evaluation/domain/evaluation-volume.ts](../../src/assessment-evaluation/domain/evaluation-volume.ts) — T-0288 박제. 순수 함수 + 방어적 입력 처리(typeof 분기 / 부재 fallback) + JSDoc 확장 여지 명시 패턴 mirror. 본 task 도 동형 순수 함수 스타일.
- [src/assessment-evaluation/domain/evaluation-volume.spec.ts](../../src/assessment-evaluation/domain/evaluation-volume.spec.ts) — colocated spec 패턴 mirror (describe/it 구조 + R-112 4 종 + negative cover + determinism test). 본 task 의 spec 위치 = `src/assessment-evaluation/domain/evaluation-dedup.spec.ts` (colocated).
- [src/assessment-collection/domain/author-filter.ts](../../src/assessment-collection/domain/author-filter.ts) — ADR-0032 §4 가 self 식별 기준으로 가리키는 Person↔identity 귀속 참조. 본 task 는 author-filter 를 import 하지 않고 `EvaluationInput.author` 동일성만으로 self 판정 (귀속은 매핑 단계에서 이미 완료된 전제). 설계 맥락 이해용 read.

## Acceptance Criteria

### 신규 파일 박제

- [ ] **`src/assessment-evaluation/domain/evaluation-dedup.ts` 신설** — 평가-side dedup 순수 함수 2 종 박제. 부수효과 0 / 외부 의존 0 / throw 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / 입력 배열 비변형. 파일 머리 주석에 ADR-0032 §4 / R-21 / R-30 / REQ-032 정합 + comment-level 검출 deferred 명시. `import` 는 `EvaluationInput`(domain 내) 만.
  - **`dedupTemporalDuplicates(inputs: EvaluationInput[]): EvaluationInput[]` — 시간적 중복 earlier-date 우선(R-21)**: 동일 활동이 서로 다른 timestamp 로 재등장할 때 earliest `timestamp` 1 건만 유지한다. 동일 활동의 식별 키 = `unitId`(이미 `<sourceType>:<instanceKey>:<externalId>` 합성이므로 동일 활동을 가리킨다). 같은 `unitId` 가 여럿이면 earliest-wins, timestamp tie 면 먼저 등장한 항목 유지(입력 순서 보존). 반환 순서는 각 키의 최초 등장 위치 기준 안정적·결정적. `commit-dedup.ts` 의 `isEarlier`(Date.parse 우선 + NaN 사전식 fallback) + Map 누적 + `firstSeenOrder` 알고리즘 mirror.
  - **`excludeSelfFollowUps(inputs: EvaluationInput[]): EvaluationInput[]` — self-follow-up 제외(R-30)**: 같은 `document` 기여 단위(issue) 안에서 동일 author 의 후속 활동(self-follow-up)을 평가 카운트에서 제외하되 **최초 기여(issue 생성)는 유지**한다. comment thread 미수집 한계(ADR §4 (d))를 반영한 **issue 단위 휴리스틱**:
    - 검출 대상은 `contributionKind === "document"` 활동만 (code 기여는 self-follow-up 개념 부적용 — ADR §4 의 'issue' 맥락).
    - 그룹 키 = 동일 활동의 베이스 식별자. `unitId` 가 `<sourceType>:<instanceKey>:<externalId>` 합성이므로, 동일 (그룹 키, author) 의 document 활동이 2건 이상이면 **earliest timestamp 1 건(최초 기여)만 유지하고 나머지 동일-author 후속은 제외**. 즉 "자기 document 단위 + 자기 후속" 으로 기여 숫자만 부풀리는 케이스 차단.
    - **그룹 키 산출 규칙은 JSDoc 에 명시** — 본 v1 은 `unitId` 자체를 그룹 키로 사용(동일 issue 의 재등장 단위가 동일 `unitId` 인 전제). comment 가 별도 `unitId` 로 수집되는 미래 확장 시 그룹 키를 issue-base 로 좁히는 정밀화는 수집 확장 Follow-up 으로 deferred 임을 JSDoc 에 박제.
    - 입력 배열 비변형, 반환 순서 안정적(최초 등장 위치 기준), 결정적.
  - **확장 여지 박제(JSDoc)**: "comment thread 미수집(ADR-0032 §4 (d)) 상태라 self-follow-up 검출은 issue 단위 author 동일성 휴리스틱 — comment-level 정밀 검출은 수집 mapper 확장(ADR-0029 경계) 별도 Follow-up slice 로 deferred. fork/rebase/meld 구조적 중복(R-9)은 수집-side commit-dedup 책임이라 본 함수 범위 밖." 명시.

- [ ] **`src/assessment-evaluation/domain/evaluation-dedup.spec.ts` 신설 (colocated)** — R-112 4 종 + negative cases 충분 cover (CLAUDE.md §3.2). 각 함수별 describe block 분리:
  - **`dedupTemporalDuplicates` happy-path** — 같은 `unitId` 가 2건(2월 / 3월 timestamp)일 때 earlier(2월) 1 건만 반환 (R-21). 서로 다른 `unitId` 는 모두 보존. 1+ test 각.
  - **`dedupTemporalDuplicates` error/negative** — 빈 배열 → 빈 배열. 중복 0 (모두 고유 `unitId`) → 입력 그대로(순서 보존). 동일 timestamp tie → 먼저 등장한 항목 유지. 파싱 불가 timestamp(예: `"not-a-date"`) → 사전식 fallback 으로 결정적 순서. 3+ 항목 동일 `unitId` → earliest 1 건만.
  - **`excludeSelfFollowUps` happy-path** — 동일 (그룹 키, author) 의 `document` 활동 2건(issue 생성 + 동일-author 후속)일 때 earliest(최초 기여) 1 건만 유지, 후속 제외 (R-30). 1+ test.
  - **`excludeSelfFollowUps` branch/negative** —
    - `contributionKind === "code"` 활동은 동일 키여도 제외 안 함(code 는 self-follow-up 부적용 분기) → 모두 보존.
    - **다른 author** 의 동일 그룹 키 document 활동 → 둘 다 보존(self 아님 — author 동일성 false 분기).
    - 동일 author, 다른 그룹 키 → 둘 다 보존(별개 단위).
    - 빈 배열 → 빈 배열.
    - self-follow-up 0 (모든 document 가 고유) → 입력 그대로.
    - 3+ 동일-author 후속 → 최초 1 건만, 나머지 전부 제외.
  - **branch cover** — `dedupTemporalDuplicates` 의 isEarlier 분기(earlier 교체 / tie 유지 / NaN fallback) 각 1+. `excludeSelfFollowUps` 의 contributionKind 분기(document vs code) + author 동일성 분기(same vs different) 각 1+.
  - **type-level / immutability** — 입력 배열이 mutate 되지 않음 검증(원본 length·내용 보존). 두 함수 모두 새 배열 반환.
  - **결정성(determinism)** — 동일 입력 2 회 호출이 동일 출력(순서 포함) — LLM 의존 0 검증.
  - **compose 정합(선택)** — `excludeSelfFollowUps(dedupTemporalDuplicates(inputs))` 합성이 두 정책을 모두 적용함 1+ test (두 함수가 독립 합성 가능함 박제).

### 통과 명령

- [ ] `pnpm lint` 통과 (0 error).
- [ ] `pnpm build` 통과 (TypeScript strict mode).
- [ ] `pnpm test src/assessment-evaluation/domain/evaluation-dedup.spec.ts` 통과 (모든 assertion green).
- [ ] `pnpm test:cov` 전체 통과 + `coverageThreshold.global` (line ≥ 80% AND function ≥ 80%) 충족. 신규 파일(순수 함수)의 line/function/branch 100% 목표(순수 함수라 도달 가능).
- [ ] CI workflow 의 `pnpm test:smoke` / `pnpm test:e2e` 도 그대로 green (본 slice 회귀 0 확인).

### Reviewer/Integrator 게이트

- [ ] reviewer agent APPROVE + PR comment 외부 post (§3.3 4-게이트 (1)(2)).
- [ ] CI green (4-게이트 (4)) + approval-gate (CI step "reviewer agent approval 검증") 통과.
- [ ] integrator self-check 통과 (4-게이트 (3)).

## Out of Scope

- **LLM scoring service / `LlmHttpGateway.generate` 호출 / prompt 조립** — ADR-0032 Follow-up §2 의 별도 후속 slice. 본 task 는 LLM 호출 전 단계의 입력 dedup 만 — `narrative` / `difficulty` / `contribution` 채우는 책임은 후속 scoring service. 본 dedup 과 scoring 은 직교(독립 합성).
- **fork/rebase/meld 구조적 중복(R-9) / commit SHA dedup / page-id+version dedup** — 수집-side `commit-dedup.ts` / `page-dedup.ts` 책임(ADR-0029 §4, ADR-0032 §4 "수집-side dedup 재설계 금지"). 본 task 는 평가-side 의 시간적·의미적 중복만.
- **issue comment thread 수집 확장** — comment-level self-follow-up 정밀 검출에 필요한 comment 데이터 수집은 ADR-0029 수집 경계를 건드리므로 별도 Follow-up slice (ADR-0032 §4 (d)). 본 task 는 comment 미수집 상태에서 검출 가능한 **issue 단위 author 동일성 휴리스틱** 만.
- **`EvaluationInput` / `EvaluationResult` 타입 변경** — T-0287 / T-0288 박제 그대로(본 task 는 `EvaluationInput` import 만).
- **재수집 정책 / 최근 1주 재수집 OK(R-58)** — PLAN P5 별도 bullet(L100). 본 task 는 in-memory dedup 함수만, 재수집 보호 정책은 별도 slice.
- **abusing 방지 metric(R-26/40) / update 횟수 중립화(R-41)** — PLAN P5 별도 bullet(L101/L102). volume(T-0288) + dedup(본 task) 위에 쌓이는 별도 slice.
- **NestJS module / providers 등록 / DI** — 본 slice 는 순수 함수 → caller(scoring service / aggregate evaluation)가 직접 import. Module 등록은 상위 layer slice 책임.
- **평가 controller / DTO / endpoint / R-9 사용자 지정 기간** — ADR-0032 Follow-up §5.
- **평가 결과 영속화 / Prisma migration** — §5 schema 게이트 deferred(ADR-0032 §Consequences 부정 trade-off).
- **PLAN.md L99(중복 제거 bullet) / L96 평가 bullet `[ ]`→`[x]` flip** — 본 slice 1 건으로 P5 bullet 종료 아님. 후속 slice 완결 후 별도 doc-sync.
- **author-filter.ts import 또는 Person↔identity 귀속 재구현** — 귀속은 매핑 단계에서 완료된 전제. 본 task 는 `EvaluationInput.author` 문자열 동일성만으로 self 판정.

## Suggested Sub-agents

`implementer → tester` — architect 호출 0 (설계는 ADR-0032 §4 가 박제 완료, 본 slice 는 구현). implementer 가 `evaluation-dedup.ts` 신설(순수 함수 2 종 + JSDoc), tester 가 colocated spec 작성 + R-112 4 종 + negative cover + coverage 100% 확인.

## Follow-ups

(implementer / tester / reviewer 가 작업 중 발견한 인접 work 를 추가)
