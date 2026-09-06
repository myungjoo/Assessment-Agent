// SummaryAggregateRequestDto — P5 REQ-004 "지정 기간의 주요 활동 종합 요약" 의 좌표 종합
// 코멘트 chain(`SummaryNarrativeService.generateBatchNarrative` → `SummaryPersistService.
// persistSummary` → `SummaryAggregateOrchestratorService.evaluateAndPersist`) 에 대한 HTTP
// 진입점의 **입력 계약**(request body) 을 박제하는 DTO(T-1936, 배선 1/2).
//
// 본 DTO 가 실어 나르는 것은 `SummaryAggregateOrchestratorService.evaluateAndPersist`
// (summary-aggregate-orchestrator.service.ts 105~130 행)의 5 인자 중 caller 가 결정해야 하는
// 축들이다:
//   - `context: SummaryBatchContext`(summary-batch-prompt.ts 27~32 행) ← personId / period /
//     periodStart 3-tuple.
//   - `results: EvaluationResult[]`(domain/evaluation-result.ts 54~70 행) ← results 배열.
//   - `mode: PersistMode`(evaluation-result-persist.service.ts 45 행) ← mode.
//   - `options: SummaryPersistOptions`(summary-persist.service.ts 55~58 행) ← modelId.
//   - `now: Date` — 요청 본문이 아니라 소비처가 `new Date()` 로 주입(시점 게이트의 결정성).
//
// `EvaluateActivitiesDto`(T-0293) / `RelativeComparisonQueryDto`(T-1934) 패턴 mirror —
// class-validator decorator 로 **형식만** 검증하고, 허용 literal 값 검증은 전부 본 DTO 밖:
//   - `period` 의 day/week/month → `summary.service.ts` 의 `assertValidPeriod` 및
//     `isPeriodEvaluable`(summary-aggregate-orchestrator.service.ts 의 시점 게이트) 소유.
//   - `mode` 의 fill/reeval → `PersistMode`(evaluation-result-persist.service.ts 45 행) 소유.
//   - `difficulty` 의 easy/medium/hard, `contribution` 의 zero/low/medium/high →
//     `domain/evaluation-result.ts`(`DIFFICULTIES` / `CONTRIBUTION_LEVELS` type-guard) 소유.
// 따라서 본 파일의 `@IsIn` 은 0 개다 — DTO 가 같은 판정을 중복 소유하면 허용 literal 정본이
// 두 곳으로 갈라지고, 도메인 집합이 확장될 때 boundary 가 조용히 뒤처진다.
//
// controller-scope ValidationPipe(whitelist + forbidNonWhitelisted + transform)와 결합돼
// 다음 2 종의 400 이 자동 강제된다:
//   - 정의되지 않은 body 필드 → 400 BadRequest(forbidNonWhitelisted). `EvaluationResult` 의
//     typed surface 5 필드 밖의 raw 본문 유입을 boundary 에서 차단해 REQ-032 "raw 본문 0"
//     구조가 type 차원에서 보존된다.
//   - decorator 위반(필수 누락 / wrong type / nested 원소 결함) → 400.
//
// 책임 경계(task Out of Scope 정합):
//   - `periodStart` 는 ISO-8601 **문자열**로 받고 `Date` 변환은 소비처(controller) 책임이다.
//     본 DTO 는 `@Type` 을 `results` nested 변환에만 쓰고 날짜 축에는 쓰지 않는다 — 변환
//     실패가 DTO 안에서 조용히 Invalid Date 로 굳는 경로를 만들지 않기 위해서다.
//   - DTO → 도메인(`SummaryBatchContext` / `EvaluationResult[]`) 변환 매퍼는 소비처 slice
//     (배선 2/2) 책임. 본 파일은 route · controller 를 건드리지 않는다.
//   - 새 외부 dependency 0 — class-validator / class-transformer 는 같은 디렉터리의 기존
//     DTO 들이 이미 사용 중(package.json 변경 0).
import { Type } from "class-transformer";
import {
  IsArray,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

// SummaryAggregateUnitResultDto — `EvaluationResult`(domain/evaluation-result.ts 54~70 행)
// 5 필드의 입력 형식을 **형식 차원에서만** 검증하는 nested DTO. 좌표 종합 코멘트는 이미
// 산출된 단위 평가 묶음을 입력으로 받으므로(orchestrator 는 재평가하지 않는다), 본 nested
// DTO 가 그 묶음의 HTTP 표현이다.
//
// 허용 literal 값(difficulty 의 easy/medium/hard, contribution 의 zero/low/medium/high)
// 검증은 domain type-guard 책임(@IsIn 미적용 — evaluate-activities.dto.ts 의 sourceType
// 관행 정합).
export class SummaryAggregateUnitResultDto {
  // unitId — 평가 단위 고유 식별자(`<sourceType>:<instanceKey>:<externalId>` 합성).
  // prompt 의 unit 식별 축이자 결과 ↔ 입력 trace 의 backbone 이라 빈 값은 거부한다.
  @IsString()
  @IsNotEmpty()
  unitId!: string;

  // narrative — LLM 정성 평가문. **빈 문자열을 허용**한다(@IsNotEmpty 미적용) — 평가문이
  // 비어 있는 unit 이나 빈 묶음을 prompt builder 가 그대로 흡수하는 기존 계약
  // (summary-batch-prompt.ts) 을 boundary 가 뒤집지 않기 위해서다. 형식(string)만 강제.
  @IsString()
  narrative!: string;

  // difficulty — 난이도 분류(easy/medium/hard). 형식만 검증, 허용 literal 값은
  // `isDifficulty`(domain/evaluation-result.ts) 책임.
  @IsString()
  @IsNotEmpty()
  difficulty!: string;

  // contribution — 기여도 품질 분류(zero/low/medium/high). 형식만 검증, 허용 literal 값은
  // `isContributionLevel`(domain/evaluation-result.ts) 책임.
  @IsString()
  @IsNotEmpty()
  contribution!: string;

  // volume — 양(deterministic 수치, ≥ 0 정수). `EvaluationResult.volume` 정합으로 정수 ·
  // 음수 아님을 boundary 에서 강제한다 — 음수/소수가 prompt 의 수치 축으로 흘러들어가면
  // 종합 코멘트가 조용히 왜곡되기 때문(도메인 계약이 "≥ 0 정수"로 이미 좁혀져 있다).
  @IsInt()
  @Min(0)
  volume!: number;
}

export class SummaryAggregateRequestDto {
  // personId — 종합 요약 대상 person 식별자. `SummaryBatchContext.personId` source 이자
  // 좌표 idempotency key(ADR-0035 §Decision 4)의 leading 축.
  @IsString()
  @IsNotEmpty()
  personId!: string;

  // period — 요약 기간 종류(day/week/month). 형식만 검증, 허용 literal 값은 orchestrator 의
  // 시점 게이트(`isPeriodEvaluable`) 및 `SummaryService.assertValidPeriod` 책임.
  @IsString()
  @IsNotEmpty()
  period!: string;

  // periodStart — 기간 시작 instant(ISO-8601 string). 소비처가 `new Date(...)` 로 파싱해
  // `SummaryBatchContext.periodStart: Date` 로 변환한다(변환은 소비처 책임 — 위 머리 주석).
  // `@IsISO8601()` 로 형식을 boundary 에서 강제 — 비-ISO 문자열(예: "2026-13-99")은 400 으로
  // 거부되어 Invalid Date 가 시점 게이트 · persist 까지 흘러가 opaque 하게 실패하는 경로를
  // 차단한다(relative-comparison-query.dto.ts 의 periodStart 패턴 mirror).
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  periodStart!: string;

  // mode — 영속화 모드(`PersistMode` = "fill" | "reeval", evaluation-result-persist.service.ts
  // 45 행). 형식만 검증하고 허용 literal 값은 persist service 책임(@IsIn 미적용). 본 endpoint
  // 는 mode 를 **필수**로 받는다 — 좌표 종합 코멘트의 재평가 여부는 caller 의 명시적 intent
  // 이고, 기본값을 boundary 가 임의로 정하면 reeval 의도가 fill no-op 으로 조용히 흡수된다.
  @IsString()
  @IsNotEmpty()
  mode!: string;

  // modelId — narrative 생성에 쓸 LLM model 식별자. `SummaryPersistOptions.modelId`
  // (summary-persist.service.ts 55~58 행) source 로 그대로 전달된다.
  @IsString()
  @IsNotEmpty()
  modelId!: string;

  // results — 좌표에 속한 단위 평가 묶음(`EvaluationResult[]` 의 HTTP 표현). **빈 배열을
  // 허용**한다(@ArrayMinSize 미적용) — 활동이 없는 기간도 "활동 없음" 종합 코멘트를 남기는
  // 것이 기존 batch prompt 계약이고, 빈 묶음 거부는 그 축을 boundary 가 잘라내기 때문이다.
  // nested 원소 결함은 `@ValidateNested({ each: true })` 로 `children` 에 전파된다.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SummaryAggregateUnitResultDto)
  results!: SummaryAggregateUnitResultDto[];
}
