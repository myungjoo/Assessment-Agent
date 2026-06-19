---
id: T-0521
title: R-26/R-40 abusing 방지 metric 순수 helper (computeAbuseSignal)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-026, REQ-040]
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-19
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-abuse-signal.ts
  - src/assessment-evaluation/domain/evaluation-abuse-signal.spec.ts
independentStream: p5-abuse-metric
plannerNote: P5 첫 미박제 항목 — R-26/R-40 abusing 방지 metric 의 dependency-free 순수 domain helper 첫 조각(detection layer). export chain 소진 후 다음 방향.
---

# T-0521 — R-26/R-40 abusing 방지 metric 순수 helper (computeAbuseSignal)

## Why

PLAN.md P5 의 미박제 항목 "Abusing 방지 metric — 코드 abusing(commit/PR 숫자만 늘리기, R-26) + 문서 abusing(의미 없는 기여 단순 반복, R-40)" 의 첫 조각이다. 현재 `evaluation-volume.ts` / `evaluation-dedup.ts` 주석이 "R-26/R-40 방지 metric 의 기반" 이라고만 언급할 뿐 dedicated abusing 신호 산출 helper 는 main 에 미박제(`git grep abuseSignal|detectAbus|repetitionInflation src/ origin/main` 0 매칭 — issue-still-relevant 통과). 한 author 의 `EvaluationInput[]` batch 에서 **반복 기반 부풀리기 신호**(다수 near-identical 저-volume 단위, code/document 별 차등)를 결정적으로 산출하는 LLM-무관 순수 domain helper 1 개를 박제한다. 이는 ADR-0032 §3 "양은 metadata 기반 deterministic 수치, LLM 무관" 정신과 정합하며, 후속 scoring service 가 본 신호를 소비해 advantage 중립화/감점에 반영하는 step 은 별도 후속 task 로 분리한다(본 task 는 detection layer 만).

## Required Reading

- `src/assessment-evaluation/domain/evaluation-input.ts` — `EvaluationInput` shape(unitId/contributionKind/author/timestamp/metadata) + `ContributionKind` union.
- `src/assessment-evaluation/domain/evaluation-volume.ts` — 결정적 순수 helper 작성 패턴(throw 0 / 부수효과 0 / referential transparency) + volume 산출 규칙.
- `src/assessment-evaluation/domain/evaluation-dedup.ts` — R-26/R-40 인접 dedup 패턴 + author/unitId 그룹핑 기존 관용구.
- `src/assessment-collection/domain/activity.ts` 의 `ActivityMetadata` 타입 정의부 — metadata scalar 신호(titleLength 등) 참조용(필요 부분만).

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/evaluation-abuse-signal.ts` 신설 — `computeAbuseSignal(inputs: EvaluationInput[]): AbuseSignal` 순수 함수 + `AbuseSignal` 타입(예: `{ author 별 unitCount, lowVolumeUnitCount, repetitionRatio(0~1), suspected: boolean, contributionKind 별 분해 }` — 구체 필드는 implementer 가 결정하되 결정적·LLM 무관·throw 0 원칙 준수). 의존성 0(NestJS `@Injectable` / Prisma / LLM gateway import 0).
- [ ] 결정성 보장 — 동일 입력은 항상 동일 출력(referential transparency), 입력 배열·원소 비변경(non-mutating).
- [ ] happy-path unit test 1+ — 정상 batch(다양한 volume 의 code/document 단위 혼합)에서 기대 신호 산출 검증.
- [ ] error path / 방어 test 1+ — 빈 배열, metadata 누락/비number titleLength, 비정상 timestamp 등 비정상 입력에서 throw 없이 안전한 fallback(예: suspected=false / 0 값) 산출 검증.
- [ ] flow / 분기 cover — code abusing(commit/PR 숫자만 늘리기) 분기와 document abusing(의미 없는 반복) 분기 각 1+ test, suspected true/false 경계 각 1+.
- [ ] negative cases 충분 cover — 단일 author 고-volume 정상 기여(suspected=false), 다수 저-volume 반복(suspected=true), 단위 1 개만(경계), 여러 author 혼합 batch, 모든 단위 동일 unitId 중복 등 예외 상황 각 1+ test(단일 negative 만으로 부족 — 분기마다 cover).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) — 신규 파일은 100% 지향.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] spec 은 colocated `src/assessment-evaluation/domain/evaluation-abuse-signal.spec.ts` 에 작성(NestJS convention + 기존 domain spec 들과 동형).

## Out of Scope

- scoring service / repository / controller 실배선(본 task 는 detection 순수 helper 만 — 후속 task 로 분리).
- LLM 호출·mock 도입(deterministic 원칙 — 정성 abusing 판단은 별도 LLM layer).
- DB schema 변경 / Prisma 모델 추가(§5 게이트 — 본 task 무관).
- R-41 문서 update 횟수 중립화 / R-37·38 품질 분류 / R-27 저성과자 식별(각 별도 P5 항목 — follow-up).
- 기존 `evaluation-volume.ts` / `evaluation-dedup.ts` 수정(ADD-only — 새 파일만).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
