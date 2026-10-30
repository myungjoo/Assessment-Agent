// RecentDeletionController — 최근 N일 결과 재수집 REST 진입점 (R-74 / REQ-041). 대상 row 는 서버가
// 찾는다. 본문의 instants 는 DTO 호환을 위해 받지만 무시하며, T-2074 에서 DTO 에서도 제거한다.
// 실행이 오래 걸리므로 POST 는 시작만 하고 202 로 돌아온다.
//
// 오류 매핑: days 범위 RangeError 는 RecentDeletionInputExceptionFilter 가 400 으로,
// Person 404 · 다른 실행 중 409 는 HttpException 그대로 나간다. Admin+ 전용이다.
import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseFilters,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { RecentDeletionDto } from "./dto/recent-deletion.dto";
import { RecentDeletionInputExceptionFilter } from "./recent-deletion-input-exception.filter";
import {
  RecentDeletionRunnerService,
  type RecentRefreshStatus,
} from "./recent-deletion-runner.service";

@Controller("api/schedules")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class RecentDeletionController {
  constructor(private readonly runner: RecentDeletionRunnerService) {}

  @Post("recent-deletion/:personId")
  @HttpCode(202)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseFilters(RecentDeletionInputExceptionFilter)
  @Roles("Admin")
  async recentDeletion(
    @Param("personId") personId: string,
    @Body() dto: RecentDeletionDto,
  ): Promise<RecentRefreshStatus> {
    return this.runner.startRefresh(personId, dto.days);
  }
}
