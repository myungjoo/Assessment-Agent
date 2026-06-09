---
id: T-0299
title: EvaluationResult → AssessmentCreateInput/ContributionCreateInput 매핑 순수 함수 (ADR-0033 §Follow-ups 2번째 slice)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-029, REQ-032, REQ-036]
estimatedDiff: 160
estimatedFiles: 2
created: 2026-06-09
plannerNote: ADR-0033 §Follow-ups 2번째 slice — (EvaluationResult[], context) → Assessment+Contribution create input 순수 함수(enum→Decimal + 집계) + colocated spec. dep 0 / credential 0 / §5 미발화. R-112 backbone×1.5(pure-fn, @Injectable 무).
---

# T-0299 — EvaluationResult → AssessmentCreateInput/ContributionCreateInput 매핑 순수 함수 (ADR-0033 §Follow-ups 2번째 slice)

## Why

ADR-0033 (PR #247 reviewer round2 APPROVE → 92309d7 머지) 가 P5 평가 결과 영속화의 데이터 모델·재평가 semantics·migration 전략을 박제했고, 그 §Follow-ups 가 dependency-free 구현 chain 을 5 slice 로 분해했다. 첫 slice (T-0298 — `Contribution @@unique([assessmentId, sourceRef])` + migration, PR #250 머지 149907b) 가 schema backbone 을 닫았다. 본 task 는 **2번째 slice — 매핑 함수** 다.

ADR-0033 §Decision 1 + §Consequences "부정/trade-off" 가 명시한 대로, 영속화 layer 는 in-memory `EvaluationResult` (의존성 0 도메인 타입, `assessment-evaluation` module) 를 기존 `Assessment` / `Contribution` 의 create input 으로 변환해야 한다. 이 변환은 (a) `ContributionLevel` enum (`zero`/`low`/`medium`/`high`) → `contributionScore` (Decimal-as-number) 결정적 매핑, (b) component `Contribution[]` → `Assessment` aggregate 수치 집계 (volume Σ, difficulty 최빈/최대, contributionScore 평균), (c) `unitId` → `sourceRef` + prefix 기반 `sourceType` 도출, (d) 평가 trigger context 4-tuple (`personId`/`period`/`scope`/`periodStart`) 결합을 책임진다. ADR-0033 §54 가 "역방향 import 금지 — 도메인 순수성 보존을 위해 매핑 함수 layer 를 별도 순수 함수로 둔다 (ADR-0032 `mapActivityToEvaluationInput` 패턴 mirror)" 를 명시한다.

본 slice 가 끝나야 후속 chain (write service slice → orchestrator/controller persist-return → doc-sync) 이 이 매핑 함수의 출력 위에서 reset-and-recreate 트랜잭션을 작성할 수 있다. 순수 함수 + colocated spec 만이므로 새 dependency 0 / 새 credential 0 / §5 게이트 미발화 (schema 게이트는 ADR-0033 + T-0298 이 이미 통과).

## Required Reading

- `docs/decisions/ADR-0033-evaluation-result-persistence.md` (§Decision 1 컬럼 매핑 규칙 + §Decision 2 R-59 derived-only + §54 매핑 함수 layer 결정 + §Consequences 부정 항목 enum→Decimal·집계 risk + §Follow-ups 2번째 항목) — 본 slice 의 결정 source.
- `src/assessment-evaluation/domain/evaluation-result.ts` — 매핑 source 타입 (`EvaluationResult` 5 필드: unitId / narrative / difficulty / contribution(`ContributionLevel`) / volume) + `ContributionLevel` union + `CONTRIBUTION_LEVELS` + `isContributionLevel` 순수 type-guard.
- `src/assessment-evaluation/domain/evaluation-input.mapper.ts` — 본 task 가 mirror 할 **순수-함수 매퍼 패턴** (의존성 0, NestJS `@Injectable` 미사용, Prisma import 0, `satisfies` compile-time 동기). unitId 합성 규칙 (`<sourceType>:<instanceKey>:<externalId>`) 도 여기서 확인 — `unitId` prefix 가 sourceType.
- `src/assessment-evaluation/domain/evaluation-input.mapper.spec.ts` — colocated spec 의 describe/it 패턴 + R-112 4종 cover 형식 mirror.
- `src/user/dto/create-assessment.dto.ts` — `AssessmentCreateInput` 의 8 키 정합 (personId / period / scope / periodStart / difficulty / contributionScore(number) / volume(int≥0) / narrative). 본 매핑 함수 출력의 target shape.
- `src/user/dto/create-contribution.dto.ts` — `ContributionCreateInput` 의 키 정합 (assessmentId 제외 — assessmentId 는 write service 가 create 시 주입 / nested create 이므로 본 매핑은 assessmentId 미포함 형태 권장: sourceType / sourceUrl / sourceRef / difficulty / contributionScore(number) / volume(int≥0)).
- `src/user/assessment.repository.ts` (L20–80, `AssessmentCreateInput` / `ContributionCreateInput` 타입 정의 부분) — 매핑 출력이 정합해야 할 정확한 입력 타입 (이미 정의된 타입 재사용 — 새 타입 발명 금지, import 만).
- `prisma/schema.prisma` L274–329 (Assessment + Contribution 모델) — Decimal / Int / String 컬럼 형식.

## Acceptance Criteria

본 slice 는 `commitMode: pr` 코드 task — R-112 4종 + negative cases 충분 cover 필수.

- [ ] `src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts` (또는 `evaluation-persist.mapper.ts`) 신규 — **의존성 0 순수 함수 layer**. NestJS `@Injectable` 미사용, Prisma client import 0, repository import 0. `evaluation-input.mapper.ts` 의 순수-함수 패턴 1:1 mirror. 파일 머리에 ADR-0033 §1/§2/§54 + REQ-036/REQ-032 박제 주석.
- [ ] `EvaluationResult.contribution` (`ContributionLevel`) → `contributionScore` (number, Decimal 컬럼 대응) 변환 순수 함수 export (예: `contributionLevelToScore`). 결정적 매핑 — zero=0 / low=1 / medium=2 / high=3 (또는 ADR-0033 §1 의 "정규화 규칙" 정합, REQ-036 상대 비교 의미 보존). `CONTRIBUTION_LEVELS` 를 single source 로 `satisfies` 또는 record 로 멤버 누락 compile-time 강제.
- [ ] `EvaluationResult.unitId` → `sourceRef` (그대로) + `sourceType` (unitId prefix `commit`/`pr`/`issue`/`document` 도출) + `sourceUrl` (도출 불가 시 빈 문자열 placeholder — ADR-0033 §1 박제) 매핑.
- [ ] 평가 trigger context 4-tuple (`personId` / `period` / `scope` / `periodStart`) 를 받는 매핑 함수 signature 박제 — 예: `mapEvaluationResultsToAssessment(context: { personId: string; period: string; scope: string; periodStart: Date }, results: EvaluationResult[]): { assessment: AssessmentCreateInput; contributions: ContributionCreateInput[] }`. context 4-tuple 이 `EvaluationResult` 에 없으므로 입력 필수임을 박제 (ADR-0033 §51).
- [ ] `Contribution[]` → `Assessment` aggregate 집계 결정적 순수 함수: `volume` = Σ contribution.volume / `difficulty` = 최빈 또는 최대 (ADR-0033 §50 "최빈/최대" 중 택1, 주석에 근거) / `contributionScore` = 평균 (또는 §50 정합 규칙) / `narrative` = 결합 규칙 (예: 결합/대표값, raw 미혼입 — R-59 보존). 집계 규칙은 결정적 (같은 입력 → 같은 출력).
- [ ] **R-112 happy path**: 정상 `EvaluationResult[]` (예: 3 unit, 다양한 contribution level) + context → 올바른 `AssessmentCreateInput` (집계값 정확) + `ContributionCreateInput[]` (1:1, 각 필드 매핑 정확) 검증 test 1+. 각 export 순수 함수 (`contributionLevelToScore` / sourceType 도출 / aggregate) 별 happy-path 1+.
- [ ] **R-112 error path**: (a) 알 수 없는 / 비정상 `contribution` 값 (런타임 unknown string 이 들어온 경우) 처리 — `isContributionLevel` guard 로 reject 또는 fallback, test 1+. (b) `unitId` prefix 가 알려진 prefix 가 아닌 경우 sourceType 도출 fallback (예: 빈 문자열 또는 명시 default) test 1+.
- [ ] **R-112 branch / flow cover**: contribution level 4 등급 각각의 score 변환 분기 1+ test (zero/low/medium/high 전부). difficulty 집계의 최빈/최대 분기 (동률 / 단일값 / 혼합) 각 1+ test.
- [ ] **R-112 negative cases 충분 cover**: (c) **빈 `EvaluationResult[]`** 입력 — Assessment 집계 (Σ=0, 빈 narrative 등) 의 결정적 처리 1+ test (ADR-0033 §Follow-ups 2번째 항목 "negative: 빈 결과" 명시). (d) `volume` 음수 또는 비정수 입력 방어 (도메인 invariant — 음수면 throw 또는 0 clamp, 규칙 주석 박제) 1+ test. (e) `sourceUrl` 도출 불가 시 빈 문자열 placeholder 반환 1+ test. (f) `periodStart` 가 Date instance 그대로 전사되는지 1+ test.
- [ ] **R-112 coverage 통과**: `pnpm test:cov` 실행 시 line ≥ 80% AND function ≥ 80% jest `coverageThreshold` 통과 (순수 함수라 100% 근접 가능).
- [ ] `pnpm build` / `pnpm lint` 통과. 출력 타입은 `assessment.repository.ts` 의 기존 `AssessmentCreateInput` / `ContributionCreateInput` 를 **import 재사용** (새 타입 발명 0 — Out of Scope).
- [ ] CI (unit / smoke / e2e) 전부 green. 본 slice 는 순수 함수 추가만이므로 기존 smoke/e2e 영향 0 임을 PR 본문에 1 줄 명시.
- [ ] PR 본문에 ADR-0033 §1/§2/§54/§Follow-ups 2번째 / dep 0 / credential 0 / §5 미발화 명시.

## Out of Scope

- write service slice (reset-and-recreate `$transaction` delete-if-exists → create + fill/reeval 모드 + partial-reset) — ADR-0033 §Follow-ups 3번째 slice. 본 task 는 **매핑 함수만**, Prisma write 0.
- orchestrator / controller 의 persist-return 전환 + context 4-tuple 수신 경로 + controller DTO 확장 — §Follow-ups 4번째 slice.
- `AssessmentCreateInput` / `ContributionCreateInput` 타입 신규 정의 / 변경 — 기존 `assessment.repository.ts` 타입을 import 재사용. 새 DTO 신설 금지.
- `assessmentId` 를 매핑 출력에 포함 — write service 가 Assessment create 시점에 nested create 또는 FK 주입으로 처리. 본 매핑은 assessmentId 미포함 `ContributionCreateInput` 형태 (또는 write service 가 채울 hole) 로 둔다.
- `Summary` 영속화 / 집계 — §Follow-ups deferred 항목 (별도 milestone).
- enum→Decimal 변환 수식의 REQ-036 적합성 재검증 ADR — 본 slice 는 ADR-0033 §1 이 박제한 "결정적 순수 함수" 결정을 구현. 매핑 수식이 비교 왜곡 risk 면 reviewer MINOR finding 또는 Follow-up.
- 새 외부 dependency / 새 credential — §5 게이트, 본 slice 미해당 (순수 함수, 외부 호출 0).
- ADR-0033 status PROPOSED → ACCEPTED flip — 별도 1 줄 direct task (origin/main ADR-0033 line 4 가 아직 `PROPOSED` — T-0297 closeout 에서 CI doc-only 게이트로 분리 박제됨. 본 코드 slice 와 무관).

## Suggested Sub-agents

`implementer → tester`

(architect 호출 불필요 — ADR-0033 §1/§2/§54 가 매핑 방향·컬럼 대응·순수-함수 layer 결정을 이미 박제했다. enum→score 수식과 집계 규칙의 구체값만 implementer 가 ADR-0033 §1/§50 정합 범위에서 결정 + 주석 박제.)

## Follow-ups

(비어 있음 — 매 sub-agent 가 작업 중 발견한 관련 항목을 여기 append.)
