// RecentDeletionInputExceptionFilter — `POST /api/schedules/recent-deletion/:personId`
// 의 **호출자 입력 결함** 을 500 대신 400 으로 매핑하는 NestJS `ExceptionFilter`
// (T-1965, T-1963 Follow-up ① 회수). ScopeInputExceptionFilter(T-1328) 의 1:1 mirror 다.
//
// 결함 형태 — DTO 는 days 상한 검증을 `buildRecentDeletionWindow` 의 `assertValidDays` 에
// 위임한다(명시된 책임 경계). 그래서 `days: 400` 은 ValidationPipe 를 통과한 뒤 `RangeError`
// 로 떨어지고, controller 는 raw forward 라 삼키지 않으며, NestJS default filter 가 500 으로
// 매핑한다 — 입력 오류가 "서버가 죽었다" 로 보고되고 5xx 로 집계된다. 본 필터가 controller
// 경계에서만 그 매핑을 바로잡되 domain layer 의 throw 종류는 1 줄도 바꾸지 않는다(HTTP 의존
// 을 domain 에 들이지 않는다는 T-1328 결정 승계).
//
// 매핑 규칙 (4 분기 — ScopeInputExceptionFilter 와 동형 우선순위):
//   (1) HttpException (401 / 403 / ValidationPipe 400 / runner 의 Person 404) → 원래
//       status·body passthrough. T-1963 e2e 의 404 raw forward 계약이 그대로 유지된다.
//   (2) RangeError (days 가 비-정수 / 0 이하 / 상한 366 초과) → 400 BadRequest.
//   (3) TypeError (instants 비-배열 · 원소 Invalid Date, reference 비-Date) → 400.
//   (4) 그 외 unknown → 500 (default 보존 — swallow 금지, 4xx 오분류 금지).
//
// 400 message 는 한국어 안내 + 원 error.message 결합이라 호출자가 어느 입력이 잘못됐는지
// 알 수 있다. helper 메시지는 days 숫자·window 경계만 담아 secret·stack trace 미포함(§9).
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
} from "@nestjs/common";
import type { Response } from "express";

// 400 안내 문구 prefix — 원 error.message 앞에 붙여 "호출자 입력 결함" 임을 명시한다.
const RECENT_DELETION_INPUT_GUIDE =
  "최근 N일 삭제 요청 입력이 올바르지 않습니다";

// 원 예외 message 를 안내 문구와 결합한다. message 가 비어 있거나 문자열이 아니면
// 안내 문구만 남긴다 — 빈 꼬리(`: ` · 빈 괄호) 를 남기지 않기 위함.
function buildBadRequestMessage(error: Error): string {
  const detail = typeof error.message === "string" ? error.message.trim() : "";
  return detail.length > 0
    ? `${RECENT_DELETION_INPUT_GUIDE}: ${detail}`
    : `${RECENT_DELETION_INPUT_GUIDE}.`;
}

@Catch()
export class RecentDeletionInputExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const mapped = this.toHttpException(exception);
    const response = host.switchToHttp().getResponse<Response>();
    response.status(mapped.getStatus()).json(mapped.getResponse());
  }

  // 예외를 매핑 규칙에 따라 HttpException 으로 정규화 (분기 로직 단위 테스트 용이).
  private toHttpException(exception: unknown): HttpException {
    if (exception instanceof HttpException) {
      return exception; // (1) 원래 status/body 보존 passthrough.
    }
    if (exception instanceof RangeError || exception instanceof TypeError) {
      // (2)(3) days 범위·instants 형식 결함 — 호출자 입력 오류이므로 400.
      return new BadRequestException(buildBadRequestMessage(exception));
    }
    return new InternalServerErrorException(); // (4) 500 default 보존.
  }
}
