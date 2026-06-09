// EvaluateActivitiesDto — P5 평가 manual-trigger endpoint(POST /api/assessment-
// evaluation/evaluate)의 request body 검증 DTO(T-0293, ADR-0032 §1/§Follow-ups).
// `CollectTriggerDto`(T-0117/T-0274) 패턴 mirror — class-validator decorator 로 형식만
// 검증하고, 허용 literal 값(예: sourceType 의 "github"/"confluence") 검증은
// service/orchestrator 책임(@IsIn 미적용, 기존 collection DTO 관행 정합).
//
// 본 DTO 는 AssessmentEvaluationController 의 POST /evaluate @Body() 로 사용된다.
// controller-scope ValidationPipe(whitelist + forbidNonWhitelisted + transform)과
// 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 필드 → 400 BadRequest(forbidNonWhitelisted). `Activity` schema 에
//     부재한 raw 본문 필드(예: commit message 전문)는 whitelist 가 자동 차단해 REQ-032
//     "raw 본문 0" 구조가 type 차원에서 보존된다.
//   - decorator 위반(필수 누락 / wrong type / nested 객체의 필수 필드 누락) → 400.
//
// 책임 경계(ADR-0032 §Follow-ups, 본 task 의 Out of Scope 정합):
//   - period/personId → 수집 → `Activity[]` 변환 bridge 는 본 DTO 밖. 본 endpoint 는
//     "이미 수집된 `Activity[]` + scoring 옵션을 직접 수신" 계약만 박제한다(R-9 사용자
//     지정 기간의 full 계약은 후속 bridge slice).
//   - 평가 결과 영속화 / DB write 0. 본 DTO 는 in-memory 호출만 매개한다.
//   - 새 외부 dependency 0 — class-validator / class-transformer 는 이미 의존
//     (collect-trigger.dto.ts 가 사용 중, package.json 박제).
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

// ActivityItemDto — `Activity`(GithubActivity | ConfluenceActivity, src/assessment-
// collection/domain/activity.ts) 의 입력 형식을 형식 차원에서만 검증하는 nested DTO.
// discriminator 분기(github / confluence)는 형식 차원에서만 cover — 허용 literal 값과
// kind/version 등 source-별 추가 필드 검증은 service/orchestrator 책임(매퍼는 typed
// surface 만 전사, raw 본문 0).
//
// 본 nested DTO 는 다음 base 필드 6 종을 형식 검증한다(ActivityBase 정합):
//   externalId / sourceType / instanceKey / author / timestamp / metadata.
// source-별 추가 필드(GithubActivity.repoRef·kind, ConfluenceActivity.spaceRef·version)는
// 본 DTO 의 명시 필드로 두지 않는다 — forbidNonWhitelisted 로 인해 본 base 외 필드를
// payload 에 두려면 ActivityItemDto 에 박제돼야 거부되지 않는다. 따라서 source-별
// 필드들도 (forbidNonWhitelisted 가 작동하려면) 본 클래스에 옵션 필드로 추가 박제해 둔다.
// 허용 literal 값(sourceType 의 "github"/"confluence", kind 의 "commit"/"pr"/"issue")
// 검증은 orchestrator/매퍼 책임(@IsIn 미적용, collect-trigger.dto.ts 정합).
export class ActivityItemDto {
  // source 고유 식별자(GitHub: commit SHA / PR·issue number, Confluence: page-id).
  // dedup 의 backbone(ADR-0029 §4). 형식: 비어있지 않은 string.
  @IsString()
  @IsNotEmpty()
  externalId!: string;

  // 출처 구분 discriminator — "github" / "confluence". 형식만 검증, 허용 literal 값
  // 검증은 service/매퍼 책임(collect-trigger.dto.ts 의 period/scope 패턴 mirror).
  @IsString()
  @IsNotEmpty()
  sourceType!: string;

  // 활동이 속한 instance key(GitHub: com / sec / ecode, Confluence: instance key).
  @IsString()
  @IsNotEmpty()
  instanceKey!: string;

  // 활동 주체의 외부 service ID(예: GitHub login, Confluence accountId).
  @IsString()
  @IsNotEmpty()
  author!: string;

  // 활동 발생 시각 — ISO-8601 string. since 도출(slice (vi))·earliest-wins dedup
  // (ADR-0029 §4)의 기준. 형식만 검증(파싱은 매퍼 책임).
  @IsString()
  @IsNotEmpty()
  timestamp!: string;

  // typed 보조 메타(scalar only — REQ-032 raw 본문 0). class-validator 의 `@IsObject`
  // 는 type level 의 객체만 강제하고 value scalar 검증은 매퍼/orchestrator 책임이다
  // (DTO 에서 모든 scalar 분기를 verbose 박제하면 raw 객체 그래프 유입과 분기 증가).
  @IsObject()
  metadata!: Record<string, unknown>;

  // GithubActivity.repoRef — confluence activity 에는 미사용. forbidNonWhitelisted 와의
  // 균형 위해 @IsOptional 로 박제. 형식 검증만(허용 literal 값 / source-별 필수 여부는
  // 매퍼/orchestrator 책임).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  repoRef?: string;

  // GithubActivity.kind — "commit"/"pr"/"issue". confluence activity 에는 미사용.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  kind?: string;

  // ConfluenceActivity.spaceRef — github activity 에는 미사용.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  spaceRef?: string;

  // ConfluenceActivity.version — github activity 에는 미사용. number 형식만 검증
  // (자릿수·≥ 0 등 도메인 검증은 매퍼/orchestrator 책임). class-validator 의 nested
  // 검증과 transform 정합을 위해 `@IsOptional` + 명시 박제.
  @IsOptional()
  version?: number;
}

// PersistMode literal — ADR-0033 §3 fill / reeval(REQ-037/REQ-041). DTO 단계에서
// `@IsOptional` + `@IsIn(["fill","reeval"])` 로 미지정 또는 허용 literal 만 통과시키고
// (허용 외 값은 400 거부), controller 가 union 으로 좁혀 persist 에 전달한다.
export type EvaluatePersistMode = "fill" | "reeval";

export class EvaluateActivitiesDto {
  // modelId — `ScoringOptions.modelId` source. `EvaluationScoringService.scoreUnit`
  // 가 gateway.generate 의 modelId 로 그대로 전달한다(ADR-0032 §2). 형식: 비어있지 않은
  // string.
  @IsString()
  @IsNotEmpty()
  modelId!: string;

  // activities — 평가 대상 `Activity[]`(이미 수집된 typed surface). orchestrator 가
  // 매퍼/dedup/scoring 을 compose 한다(ADR-0032 §1/§4/§2). 최소 1 건 — 빈 배열은
  // 호출 무의미(orchestrator 도 빈 결과 반환이지만 endpoint 계약상 거부).
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ActivityItemDto)
  activities!: ActivityItemDto[];

  // --- context 4-tuple(ADR-0033 §51) — 영속화 진입의 식별 축. `EvaluationResult` 에
  // 없으므로 HTTP request body 에서 받아 controller 가 persist context 로 조립한다.
  // 허용 literal 값(period 의 day/week/month, scope 의 commit/document/aggregate) 검증은
  // persist service 책임(@IsIn 미적용 — 기존 collection DTO 관행 정합). periodStart 만
  // ISO-8601 형식을 boundary 에서 강제(@IsISO8601 — malformed date 의 opaque 500 차단).
  // 나머지는 형식 검증 decorator 만 박제. ---

  // personId — 평가 대상 person 의 식별자. idempotency key(ADR-0033 §3)의 leading 축.
  @IsString()
  @IsNotEmpty()
  personId!: string;

  // period — 평가 기간 종류(day/week/month). 형식만 검증, 허용 literal 값은 persist
  // service 책임(VALID_PERIODS single source 재사용).
  @IsString()
  @IsNotEmpty()
  period!: string;

  // scope — 평가 scope(commit/document/aggregate). 형식만 검증, 허용 literal 값은
  // persist service 책임(VALID_SCOPES single source 재사용).
  @IsString()
  @IsNotEmpty()
  scope!: string;

  // periodStart — 기간 시작 시각(ISO-8601 string). controller 가 `new Date(...)` 로
  // 파싱해 persist context 의 `periodStart: Date` 로 변환한다. `@IsISO8601()` 로 형식을
  // boundary 에서 강제 — 비-ISO 문자열(예: "2026-13-99")은 400 으로 거부되어 controller 의
  // `new Date(...)` 가 Invalid Date 를 만들어 persist 로 흘러들어가는 opaque 500 을 차단한다.
  @IsString()
  @IsNotEmpty()
  @IsISO8601()
  periodStart!: string;

  // mode — 영속화 모드(ADR-0033 §3). 선택적이되 제공 시 반드시 허용 literal("fill" |
  // "reeval") 중 하나여야 한다(@IsOptional + @IsIn). 미지정/undefined 는 controller 가
  // 기본값 "fill" 로 idempotent 처리하고, 알 수 없는 literal(예: "reevaluate")은 'fill'
  // no-op 으로 silent 흡수되지 않도록 400 으로 거부한다(ADR-0033 §3 fill/reeval intent 보존).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsIn(["fill", "reeval"])
  mode?: string;
}
