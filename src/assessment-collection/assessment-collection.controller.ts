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
import { RunStatusService } from "../run-status/run-status.service";

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
  constructor(
    private readonly triggerService: CollectionTriggerService,
    // RunStatusService — POST /collect 의 실행 상태 카운터 source(T-1845, ADR-0060
    // §Follow-ups (c)). 수집 축이 "지금 실행 중인가" 를 프로세스 메모리에만 기록하는
    // 관측 보조 provider 로, handler 진입 시 begin("collection") · 종료 시 finally 에서
    // end("collection") 를 부른다. RunStatusModule 이 export 하고 본 controller 의
    // module(assessment-collection.module.ts)이 그 module 을 import 하므로 추가 token
    // 배선 0 — 생성자 주입만(평가 축 T-1842 와 동형 패턴). **기존 triggerService param 의
    // 위치·순서는 불변**이고 본 param 이 마지막에 추가된다(다른 호출부 회귀 0).
    // test 는 jest mock { begin, end } 를 주입해 실 부작용 0 으로 전이 계약만 검증한다.
    private readonly runStatus: RunStatusService,
  ) {}

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
    // 수집 축 실행 상태 전이(T-1845, ADR-0060 §Decision 4 "비용 있는 실행 진입점") —
    // handler 최상단에서 begin 하고 try/finally 로 감싸 성공·실패 어느 종료 경로에서도
    // end 가 정확히 1 회 짝지어지게 한다. begin 을 try **밖**에 두는 이유는 begin 이
    // 던지면 finally 에 진입조차 하지 않아 "짝 없는 end" 가 원천적으로 생길 수 없기
    // 때문이다(현 구현의 begin 은 던지지 않지만 배치로 그 불변식을 고정한다).
    //
    // 위임은 `return await` 로 받는다 — await 없이 promise 를 그대로 반환하면 finally 가
    // **위임 완료 전에** 실행돼 "실행 중" 구간이 사실상 0 이 된다(조기 감소). 위임 인자·
    // 반환 shape·RBAC·ValidationPipe 는 변경 0 — T-1842/T-1843/T-1844 와 동형.
    this.runStatus.begin("collection");
    try {
      return await this.triggerService.triggerCollection(dto);
    } finally {
      this.runStatus.end("collection");
    }
  }
}
