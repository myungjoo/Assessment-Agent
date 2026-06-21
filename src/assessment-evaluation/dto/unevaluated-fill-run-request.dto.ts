// UnevaluatedFillRunRequestDto — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분 일괄
// 평가" / REQ-038) Q-0045 옵션1 run-side 사슬의 HTTP request body 검증 DTO. T-0564 가
// 박제한 `UnevaluatedFillRunOrchestratorService.run(rawBridges, requestModelId,
// defaultModelId)` 의 입력 3 축 — rawBridges / modelId / defaultModelId — 을 HTTP
// boundary 에서 **형식만** 검증한다(POST /api/assessment-evaluation/unevaluated-fill-run).
//
// `UnevaluatedFillPlanRequestDto`(T-0542, plan-side request DTO) 패턴 mirror —
// class-validator decorator 로 형식만 검증하고, 허용 literal 값(period 의 day/week/month,
// scope 의 commit/document/aggregate, modelId 의 허용 set)은 service/domain helper 책임
// (@IsIn 미적용, 기존 evaluation DTO 관행 정합). plan-request DTO 와의 동형/차이:
//   - 동형: modelId 류는 `@IsOptional + @IsString + @IsNotEmpty`(선택 + 제공 시 비어있지
//     않은 string), 필수 string 류는 `@IsString + @IsNotEmpty`.
//   - 차이: plan-request 의 입력은 5 축 모두 primitive(string / string 배열)라 nested DTO
//     검증이 없었지만, 본 run-request 의 `rawBridges` 는 **nested `PeriodBridgeDto` 배열**
//     이라 `@ValidateNested({ each: true })` + `@Type(() => PeriodBridgeDto)`(class-
//     transformer)로 각 원소를 PeriodBridgeDto decorator 로 재귀 검증한다(plain object →
//     PeriodBridgeDto 인스턴스 transform 후 각 4~5 축 검증).
//
// 본 DTO 는 controller endpoint(`runUnevaluatedFill`)의 @Body() 로 사용되어 검증된 3 축이
// `UnevaluatedFillRunOrchestratorService.run(dto.rawBridges, dto.modelId,
// dto.defaultModelId)` 로 그대로 흘러간다(가공 0). controller-scope ValidationPipe
// (whitelist + forbidNonWhitelisted + transform)과 결합돼 다음을 자동 강제한다:
//   - 정의되지 않은 필드 → 400 BadRequest(forbidNonWhitelisted). 본 DTO 단독 validate()
//     호출(spec)에서는 whitelist 옵션이 없으므로 unknown 필드를 무시한다 — forbid 거부는
//     controller-scope pipe 검증(별도 controller spec).
//   - decorator 위반(rawBridges 누락 / non-array / nested PeriodBridgeDto 위반 / modelId
//     빈 문자열 / defaultModelId 누락) → 400.
//
// 책임 경계(task Out of Scope 정합):
//   - controller endpoint 실배선 · orchestrator 위임 · 좌표 dedup / options 도출은 본 DTO
//     밖(controller / service / core 책임).
//   - 허용 literal 값 검증(period day/week/month, scope commit/document/aggregate,
//     허용 modelId set)은 domain helper / service 책임(@IsIn 미적용).
//   - `defaultModelId` 의 source(env / `LlmProviderConfig` table 자동 주입)는 본 DTO 밖 —
//     본 DTO 는 request body 의 명시 인자로만 받는다(클라이언트 책임, 후속 config slice).
//   - 새 외부 dependency 0 — class-validator / class-transformer 는 이미 의존(period-
//     bridge.dto.ts / unevaluated-fill-plan-request.dto.ts 가 사용 중, package.json 박제).
import { Type } from "class-transformer";
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";

import { PeriodBridgeDto } from "./period-bridge.dto";

export class UnevaluatedFillRunRequestDto {
  // rawBridges — 미평가 fill run 을 수행할 raw 좌표(PeriodBridgeDto) 배열(dedup 전).
  // `UnevaluatedFillRunOrchestratorService.run` 의 1 번째 인자와 형식상 1:1. 각 원소는
  // PeriodBridgeDto decorator 로 재귀 검증된다(`@ValidateNested({ each: true })` +
  // `@Type(() => PeriodBridgeDto)`) — plain object → PeriodBridgeDto 인스턴스 transform
  // 후 personId/period/scope/periodStart(+선택 reevaluate) 형식 검증.
  //
  // 빈 배열 정책(박제): core 의 `dedupePeriodBridgeRequests` / `runUnevaluatedFillRunCore`
  // 는 빈 좌표 배열을 결정적으로 빈 outcomes 결과로 흡수한다. 따라서 DTO 단에서
  // `@ArrayNotEmpty` 를 **적용하지 않고** 빈 배열을 형식상 허용한다 — 빈 배열 → 빈 outcomes
  // 의 자연스러운 흐름(거부 책임을 도메인 결정성에 위임). plan DTO 의 personIds 빈 배열
  // 정책 mirror.
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PeriodBridgeDto)
  rawBridges!: PeriodBridgeDto[];

  // modelId — run-request 가 넘기는 선택적 평가 modelId. 유효 non-empty 면 우선 채택되고,
  // 빈 값(미지정 / null / "")이면 service 가 `defaultModelId` 로 fallback 한다(options 도출
  // 은 core 의 `buildFillRunScoringOptions` 책임). 형식만 검증 — 허용 modelId set 검증은
  // service 책임(@IsIn 미적용). `@IsOptional` 이라 미제공 payload 는 통과하고, 제공 시
  // `@IsNotEmpty` 로 빈 문자열은 거부한다.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  modelId?: string;

  // defaultModelId — request 의 modelId 가 비어있을 때 fallback 대상이 되는 필수 default
  // modelId. 필수(`@IsString + @IsNotEmpty`) — 누락 / 빈 문자열은 400 으로 거부한다.
  // request 도 비어있고 default 도 무효면 core 의 한국어 `TypeError`(options 무효)가
  // 전파된다. env / config table 에서 자동 주입하는 layer 는 본 DTO 밖(후속 config slice).
  @IsString()
  @IsNotEmpty()
  defaultModelId!: string;
}
