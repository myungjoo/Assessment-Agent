// evaluation-result.persist.mapper — in-memory `EvaluationResult[]` + 평가 trigger
// context → 기존 `AssessmentCreateInput`(1) / `ContributionCreateInput[]`(N) 변환
// 순수 함수 layer (ADR-0033 §Decision 1 컬럼 매핑 + §2 R-59 derived-only + §54 매핑
// 함수 layer 결정, §Follow-ups 2번째 slice). 부수효과 0 / 외부 의존 0 — NestJS
// `@Injectable` 미사용, Prisma client import 0, repository import 0.
// `evaluation-input.mapper.ts` 의 순수-함수 패턴(의존성 0, `satisfies` compile-time
// 동기)을 1:1 mirror 한다. REQ-036(기여도 정규화 수치) / REQ-032(raw 미저장) 정합.
//
// 매핑 방향(ADR-0033 §54): `assessment-evaluation` 도메인(의존성 0 타입)이 `user`
// 영속 module 의 create input 타입으로 단방향 변환된다. 역방향 import(영속 entity
// 가 평가 도메인 타입 import) 금지 — 도메인 순수성 보존. 출력 타입은 기존
// `assessment.repository.ts` / `contribution.repository.ts` 의 input 타입을 그대로
// import 재사용한다(새 타입 발명 0, Out of Scope).
//
// 컬럼 매핑(ADR-0033 §1):
//   - EvaluationResult.difficulty        → Contribution.difficulty (그대로)
//   - EvaluationResult.contribution(enum) → Contribution.contributionScore(number)
//     — `contributionLevelToScore` 결정적 변환(zero=0/low=1/medium=2/high=3).
//   - EvaluationResult.volume            → Contribution.volume (그대로, ≥0 정수 invariant)
//   - EvaluationResult.unitId            → Contribution.sourceRef (그대로, 재수집 참조)
//   - unitId prefix                      → Contribution.sourceType (commit/pr/issue/document)
//   - (도출 불가)                         → Contribution.sourceUrl = "" placeholder(ADR-0033 §1)
//
// context 4-tuple(personId/period/scope/periodStart)은 `EvaluationResult` 에 없으므로
// (ADR-0033 §51) 영속화 진입의 필수 입력으로 받는다. assessmentId 는 본 매핑 출력에
// 미포함 — write service 가 nested create 시점에 주입(Out of Scope, ADR-0033 §Follow-ups 3).
//
// R-59 / REQ-032: 본 매퍼는 평가-파생 데이터(난이도/기여도 수치/양/narrative/참조
// 식별자)만 전사한다. raw 본문(commit message/diff/issue body/page HTML)은 source
// 타입(`EvaluationResult`)이 애초에 보유하지 않아 구조적으로 저장 불가.

import type { Difficulty } from "../../llm/difficulty";
import type { AssessmentCreateInput } from "../../user/assessment.repository";
import type { ContributionCreateInput } from "../../user/contribution.repository";

import {
  type ContributionLevel,
  CONTRIBUTION_LEVELS,
  type EvaluationResult,
  isContributionLevel,
} from "./evaluation-result";

// 평가 trigger context 4-tuple — `EvaluationResult` 에 없는 영속 식별 축(ADR-0033
// §51). 누구를(personId) / 어느 기간(period) / 어느 scope / 어느 기간 시작
// (periodStart) 로 평가했는지. 영속화 진입점이 controller/orchestrator 에서 받아
// 본 매핑에 내려보낸다.
export interface EvaluationPersistContext {
  personId: string;
  period: string;
  scope: string;
  periodStart: Date;
}

// 본 매핑이 출력하는 Contribution create input — write service 가 assessmentId 를
// nested create 로 주입하므로 `ContributionCreateInput` 에서 assessmentId 만 제외한
// 형태(ADR-0033 §Follow-ups 3, task Out of Scope). 새 타입 발명이 아니라 기존
// 타입의 Omit 파생 — 컬럼 contract 는 contribution.repository.ts single source.
export type ContributionCreateInputWithoutAssessment = Omit<
  ContributionCreateInput,
  "assessmentId"
>;

// 본 매핑 함수의 출력 묶음 — aggregate Assessment(1) + component Contribution[](N).
export interface MappedAssessment {
  assessment: AssessmentCreateInput;
  contributions: ContributionCreateInputWithoutAssessment[];
}

// CONTRIBUTION_SCORE_BY_LEVEL — ContributionLevel enum → contributionScore(number)
// 결정적 매핑(ADR-0033 §1, REQ-036). zero=0 / low=1 / medium=2 / high=3 의 등간격
// ordinal 로 "상대 비교 의미"(REQ-036)를 보존한다(단조 증가). `Record<Contribution
// Level, number>` 타입으로 union 의 전 멤버 누락을 compile-time 강제 —
// CONTRIBUTION_LEVELS single source 와 동기(`evaluation-input.ts` satisfies 패턴 mirror).
const CONTRIBUTION_SCORE_BY_LEVEL: Record<ContributionLevel, number> = {
  zero: 0,
  low: 1,
  medium: 2,
  high: 3,
};

// KNOWN_SOURCE_TYPES — unitId prefix 로 인정하는 sourceType 집합(ADR-0033 §1 —
// commit / pr / issue / document). 평가-side unitId 는 `<sourceType>:<instanceKey>:
// <externalId>` 합성(ADR-0032 §1)이나, 영속 Contribution.sourceType 은 단위 종류
// (commit/pr/issue/document)를 기대하므로 prefix 세그먼트로 도출한다. 알려진 prefix
// 가 아니면 빈 문자열 fallback(§1 — 도출 불가 placeholder, service-layer 가 후속 검증).
const KNOWN_SOURCE_TYPES = ["commit", "pr", "issue", "document"] as const;

// DIFFICULTY_ORDER — Assessment.difficulty aggregate(최대값)를 결정적으로 뽑기 위한
// ordinal. ADR-0033 §50 의 "최빈/최대" 중 **최대**를 채택한다 — 한 기간의 대표
// 난이도는 가장 높은 기여의 난이도가 평가 의미상 보수적으로 적합(최빈은 동률 시
// tie-break 규칙이 추가로 필요해 결정성이 약화). 동률/단일/혼합 모두 결정적.
// `summary-aggregate.ts`(ADR-0035 §Decision 1 metricScore 집계)가 난이도 평균 산출에
// 동일 ordinal 을 재사용하므로 export 한다(단위↔요약 난이도 척도 single source).
export const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  easy: 0,
  medium: 1,
  hard: 2,
};

// contributionLevelToScore — ContributionLevel enum 을 contributionScore(number)로
// 변환하는 순수 함수(ADR-0033 §1, REQ-036). 입력이 런타임 unknown string(타입 우회)
// 인 경우 `isContributionLevel` type-guard 로 reject — 알 수 없는 등급은 silent 0
// 대신 throw 해 매핑 오류를 조기 노출한다(R-112 error path).
export function contributionLevelToScore(level: string): number {
  if (!isContributionLevel(level)) {
    throw new Error(
      `알 수 없는 ContributionLevel 값: "${level}" (허용: ${CONTRIBUTION_LEVELS.join("/")})`,
    );
  }
  return CONTRIBUTION_SCORE_BY_LEVEL[level];
}

// resolveSourceType — unitId 의 prefix 세그먼트(`:` 앞)를 Contribution.sourceType 으로
// 도출하는 순수 함수(ADR-0033 §1). 알려진 prefix(commit/pr/issue/document)면 그대로,
// 아니면 빈 문자열 fallback — 도출 불가를 placeholder 로 표현(service-layer 후속
// 검증 대상). throw 0 — sourceType 도출 실패는 매핑 중단 사유가 아니다.
export function resolveSourceType(unitId: string): string {
  const prefix = unitId.split(":")[0];
  return (KNOWN_SOURCE_TYPES as readonly string[]).includes(prefix)
    ? prefix
    : "";
}

// assertValidVolume — volume 도메인 invariant(≥0 정수, ADR-0033 §1 / evaluation-
// result.ts L67) 방어. 음수 또는 비정수면 throw — 0 clamp 대신 throw 로 상류 계약
// 위반을 조기 노출한다(R-112 negative case). `EvaluationResult.volume` 은 deterministic
// metric 으로 정상 경로에선 항상 ≥0 정수이나, 타입 우회 입력을 방어한다.
function assertValidVolume(volume: number): void {
  if (!Number.isInteger(volume) || volume < 0) {
    throw new Error(`volume 은 ≥0 정수여야 한다: ${volume}`);
  }
}

// mapEvaluationResultToContribution — 단위 `EvaluationResult` 1 건을 assessmentId
// 미포함 Contribution create input 으로 변환(ADR-0033 §1, 1:1). 순수 함수.
function mapEvaluationResultToContribution(
  result: EvaluationResult,
): ContributionCreateInputWithoutAssessment {
  assertValidVolume(result.volume);
  return {
    sourceType: resolveSourceType(result.unitId),
    // sourceUrl — 도출 source 부재(unitId 는 식별자, URL 아님)이므로 빈 문자열
    // placeholder(ADR-0033 §1). 재수집은 sourceRef(=unitId)로 충분(REQ-031).
    sourceUrl: "",
    sourceRef: result.unitId,
    difficulty: result.difficulty,
    contributionScore: contributionLevelToScore(result.contribution),
    volume: result.volume,
  };
}

// aggregateDifficulty — component Contribution[] 의 난이도를 Assessment 의 대표
// 난이도로 집계(ADR-0033 §50 — 최대 채택, DIFFICULTY_ORDER ordinal). 빈 입력은
// 기본값 "easy"(결정적). 순수 함수.
function aggregateDifficulty(
  contributions: readonly { difficulty: string }[],
): Difficulty {
  let best: Difficulty = "easy";
  for (const c of contributions) {
    const d = c.difficulty as Difficulty;
    if (DIFFICULTY_ORDER[d] > DIFFICULTY_ORDER[best]) {
      best = d;
    }
  }
  return best;
}

// mapEvaluationResultsToAssessment — `EvaluationResult[]` + context 4-tuple 을
// aggregate `AssessmentCreateInput`(1) + component Contribution create input[](N)
// 로 변환하는 진입 순수 함수(ADR-0033 §1/§50/§51). 집계 규칙(결정적):
//   - volume          = Σ contribution.volume
//   - difficulty      = component 난이도의 최대(DIFFICULTY_ORDER)
//   - contributionScore = component score 의 평균(빈 입력 시 0 — div-by-zero 방어)
//   - narrative       = component narrative 의 결합("\n\n" join, raw 미혼입 — R-59
//     보존: narrative 는 LLM 생성 결과물이며 입력 자체가 raw-free 임은 상류 계약 보장)
// 같은 입력 → 같은 출력(referential transparency). 부수효과 0, 입력 mutate 0.
export function mapEvaluationResultsToAssessment(
  context: EvaluationPersistContext,
  results: EvaluationResult[],
): MappedAssessment {
  const contributions = results.map(mapEvaluationResultToContribution);

  const volume = contributions.reduce((sum, c) => sum + c.volume, 0);
  const scoreSum = contributions.reduce(
    (sum, c) => sum + (c.contributionScore as number),
    0,
  );
  // 평균 — 빈 입력 시 div-by-zero 방어로 0(ADR-0033 §Follow-ups 2 "negative: 빈 결과"
  // 결정적 처리). component 가 1+ 면 산술 평균.
  const contributionScore =
    contributions.length === 0 ? 0 : scoreSum / contributions.length;
  const narrative = results.map((r) => r.narrative).join("\n\n");

  const assessment: AssessmentCreateInput = {
    personId: context.personId,
    period: context.period,
    scope: context.scope,
    // periodStart 는 Date instance 그대로 전사(전사 책임만, 변환 0).
    periodStart: context.periodStart,
    difficulty: aggregateDifficulty(contributions),
    contributionScore,
    volume,
    narrative,
  };

  return { assessment, contributions };
}
