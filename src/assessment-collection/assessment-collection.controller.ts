// AssessmentCollectionController — collection manual-trigger HTTP 진입점(ADR-0031 §2).
// POST /api/assessment-collection/collect 가 CollectionTriggerService.triggerCollection 에
// 위임해 한 Person 을 "지금 수집" 한다(REQ-040 manual trigger). collection backbone 의
// caller 0 상태를 실제 호출 가능하게 하는 HTTP caller.
//
// ValidationPipe(whitelist + forbidNonWhitelisted + transform) controller-scope —
// AssessmentController mirror. 정의 외 필드 → 400, decorator 위반(필수 누락/wrong type/
// 잘못된 ISO) → 400.
//
// RBAC — Admin+ tier(@Roles("Admin"), ADR-0031 §2). 수집 trigger 는 비용 있는 write/
// orchestration 연산이라 AssessmentController POST(Admin+) 패턴 mirror(REQ-045). 인증 부재
// → JwtAuthGuard 401, tier 미달 → RolesGuard 403.
//
// service-layer HttpException → status 자동 mapping(controller 추가 변환 0, raw forward):
// NotFoundException(Person 부재) → 404 / BadRequestException(period·scope literal 위반) →
// 400 / ConflictException(동일 경계 P2002) → 409.
//
// 책임 경계(Out of Scope): orchestration 재구현 0(triggerService 위임만). RBAC/Validation
// Pipe 통합 검증은 #4 e2e. 응답은 CollectionTriggerSummary 그대로(전문 미반환, ADR-0031 §2).
import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import {
  CollectionTriggerService,
  type CollectionTriggerSummary,
} from "./collection-trigger.service";
import { CollectTriggerDto } from "./dto/collect-trigger.dto";

@Controller("api/assessment-collection")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class AssessmentCollectionController {
  constructor(private readonly triggerService: CollectionTriggerService) {}

  // POST /api/assessment-collection/collect — REQ-040 manual trigger. 201 Created +
  // CollectionTriggerSummary. CollectionTriggerService.triggerCollection 에 그대로 위임
  // (분기 없음 — service-layer 가 6단계 orchestration + HttpException 책임). RBAC Admin+.
  @Post("collect")
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async collect(
    @Body() dto: CollectTriggerDto,
  ): Promise<CollectionTriggerSummary> {
    return this.triggerService.triggerCollection(dto);
  }
}
