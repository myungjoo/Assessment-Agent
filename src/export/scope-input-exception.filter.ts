// ScopeInputExceptionFilter — export scope preview 2 종(`POST /api/admin/export/
// describe-scope` · `POST /api/admin/export/preview-selection`)의 **호출자 입력 결함**을
// 500 대신 400 으로 매핑하는 NestJS `ExceptionFilter` (T-1328, T-1305 이월 결함 회수).
//
// 두 endpoint 는 controller 자체 분기 0 정책이라 helper(describeExportScope /
// selectExportRecords)가 던지는 RangeError·TypeError 가 swallow 없이 raw propagate 하고,
// NestJS default exception filter 가 이를 500 으로 매핑한다. 그 결과 "내 입력이 잘못됐다"와
// "서버가 죽었다"를 Admin UI 가 구분할 수 없고, 정상적인 입력 검증 실패가 5xx 로 집계된다.
// 본 필터가 controller 경계에서만 그 매핑을 바로잡는다 — helper/service 의 throw 종류는
// 1 줄도 바꾸지 않는다(domain layer 에 HTTP 의존을 들이지 않기 위함).
//
// 매핑 규칙 (4 분기 — MulterExceptionFilter(T-1253) 와 동형 우선순위):
//   (1) HttpException (JwtAuthGuard 401 / RolesGuard 403 / ValidationPipe 400 /
//       service 4xx) → 원래 status·body 그대로 passthrough (재매핑·swallow 금지).
//   (2) RangeError (RANGE + dateRange 누락 / start >= end / PARTIAL + 빈 entitySelector /
//       허용 외 entity) → 400 BadRequest.
//   (3) TypeError (dateRange.start/end 가 Invalid Date 이거나 비-Date) → 400 BadRequest.
//   (4) 그 외 unknown → 500 (default 동작 보존 — swallow 금지, 4xx 오분류 금지).
//
// 400 응답 message 는 한국어 안내 + 원 error.message 를 함께 담아 호출자가 어느 입력이
// 잘못됐는지 알 수 있게 한다. helper 메시지는 scope 형태·ISO 날짜·entity 이름만 담고
// secret 이나 stack trace 를 포함하지 않는다(§9 확인 완료).
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
const SCOPE_INPUT_GUIDE = "Export scope 입력이 올바르지 않습니다";

// 원 예외 message 를 안내 문구와 결합한다. message 가 비어 있으면(빈 문자열 RangeError 등)
// 안내 문구만 남긴다 — 빈 괄호 꼬리를 남기지 않기 위함.
function buildBadRequestMessage(error: Error): string {
  const detail = typeof error.message === "string" ? error.message.trim() : "";
  return detail.length > 0
    ? `${SCOPE_INPUT_GUIDE}: ${detail}`
    : `${SCOPE_INPUT_GUIDE}.`;
}

@Catch()
export class ScopeInputExceptionFilter implements ExceptionFilter {
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
      // (2)(3) scope 조합·날짜 형식 결함 — 호출자 입력 오류이므로 400.
      return new BadRequestException(buildBadRequestMessage(exception));
    }
    return new InternalServerErrorException(); // (4) 500 default 보존.
  }
}
