// AssessmentEvaluationController — P5 평가 manual-trigger HTTP 진입점
// (T-0293, ADR-0032 §1/§Follow-ups). POST /api/assessment-evaluation/evaluate 가
// EvaluationOrchestratorService.evaluateActivities 에 위임해 "이미 수집된 `Activity[]` +
// scoring 옵션 → 평가 결과 목록" 의 최소 계약을 HTTP 로 노출한다(REQ-009, REQ-045 manual
// trigger 의 평가 쪽 mirror). 직전 slice T-0292 가 orchestrator 의 in-process 경로를 닫았
// 으나 HTTP caller 0 + AppModule 미등록 상태였고, 본 controller 가 그 빈자리를 채운다.
//
// 패턴 mirror — AssessmentCollectionController(T-0274, ADR-0031 §2):
//   - controller-scope ValidationPipe(whitelist + forbidNonWhitelisted + transform):
//     정의 외 필드 → 400(forbidNonWhitelisted), decorator 위반(필수 누락 / wrong type /
//     nested 객체 위반) → 400, `EvaluateActivitiesDto` 의 class-transformer `@Type`
//     decorator 가 plain object → DTO 인스턴스로 transform.
//   - RBAC Admin+(JwtAuthGuard + RolesGuard + @Roles("Admin")): 인증 부재 → 401, tier 미달
//     → 403. 평가 trigger 는 비용 있는 LLM round-trip 연산이므로 collection trigger 와
//     동일하게 Admin+ 로 시작(R-9 사용자/Admin 허용은 후속 정책 결정 — task 의 Out of
//     Scope 정합).
//   - thin delegate: orchestration / dedup / scoring 재구현 0. controller 는 검증된 DTO 를
//     `{ modelId }` ScoringOptions 와 `activities` `Activity[]` 로 그대로 분해해
//     `orchestrator.evaluateActivities(...)` 에 forward 하고 반환 `EvaluationResult[]` 도
//     가공 0 으로 그대로 forward(분기 없음 — service-layer 가 매핑/dedup/scoring 책임).
//   - service-layer error 는 raw 전파(swallow 0) — orchestrator 가 throw 하면(scoreUnit
//     reject 전파 등) 그대로 NestJS 가 응답으로 매핑하게 둔다(ADR-0032 §2 실패 격리).
//
// 책임 경계(ADR-0032 §Follow-ups + 본 task Out of Scope 정합):
//   - period/personId → 수집 → `Activity[]` 변환 bridge 는 본 controller 밖. 본 endpoint
//     는 "이미 수집된 `Activity[]` 직접 수신" 계약만(R-9 사용자 지정 기간의 full 계약은
//     후속 bridge slice).
//   - 평가 결과 영속화 / Prisma migration / `EvaluationResult` → Assessment·Contribution
//     row 매핑 — §5 schema 게이트 deferred. 본 controller 는 in-memory 결과 반환만.
//   - 일/주/월 aggregate 평가 / batch prompting — orchestrator 가 per-unit 만 cover.
//     집계 endpoint 는 후속 slice(ADR-0032 §2 batch 경계).
//   - e2e HTTP 통합 spec(supertest 실 부팅 + RBAC/Validation 통합 검증) — 후속 slice.
//     본 task 는 colocated controller unit(orchestrator mock)까지.
import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import type { Activity } from "../assessment-collection/domain/activity";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import type { EvaluationResult } from "./domain/evaluation-result";
import { EvaluateActivitiesDto } from "./dto/evaluate-activities.dto";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";

@Controller("api/assessment-evaluation")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class AssessmentEvaluationController {
  // EvaluationOrchestratorService 를 생성자 주입 — 같은 module 내 class provider 라
  // 추가 token 0. test 는 jest mock { evaluateActivities } 를 주입해 실 LLM 호출 0 /
  // 실 네트워크 0 / live credential 0 으로 위임 정합만 검증한다.
  constructor(private readonly orchestrator: EvaluationOrchestratorService) {}

  // POST /api/assessment-evaluation/evaluate — 평가 manual trigger.
  //   - 200 OK + EvaluationResult[](orchestrator 반환 그대로 forward, 가공 0).
  //   - controller-scope ValidationPipe + class-transformer 가 dto 를 인스턴스화하며
  //     nested `activities` 항목도 ActivityItemDto 로 transform 된다. orchestrator 는
  //     `Activity[]` 형식만 요구하므로 검증된 DTO 를 그대로 cast 해 위임한다.
  //   - service-layer error(예: scoreUnit reject) 는 raw 전파(controller 추가 변환 0).
  @Post("evaluate")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async evaluate(
    @Body() dto: EvaluateActivitiesDto,
  ): Promise<EvaluationResult[]> {
    // dto.activities 는 nested DTO 인스턴스 배열(class-transformer 결과)이지만 형식상
    // Activity union 의 필드 집합과 정합한다(externalId/sourceType/instanceKey/author/
    // timestamp/metadata + source-별 옵션 필드). orchestrator 는 `Activity[]` 시그니처를
    // 요구하므로 unknown 을 거쳐 cast(런타임 변환 0 — 동일 객체 forward).
    const activities = dto.activities as unknown as Activity[];
    return this.orchestrator.evaluateActivities(activities, {
      modelId: dto.modelId,
    });
  }
}
