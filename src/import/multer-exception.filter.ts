// MulterExceptionFilter — import 업로드 파이프라인(`FileInterceptor` + multer)에서
// 발생한 예외를 명시적 HTTP status 로 매핑하는 NestJS `ExceptionFilter`
// (ADR-0055 §Decision 3, T-1253 §Follow-up c — reviewer NIT-1 회수).
//
// 상한 없는 memoryStorage(§Decision 2)는 DoS 표면이라 §Decision 3 이 limits.fileSize
// 상한을 안전 전제로 박제했다. 상한 초과 시 multer 는 MulterError(LIMIT_FILE_SIZE) 를
// 던지는데, 명시적 매핑이 없으면 default filter 하에서 500 으로 표면화될 수 있어
// 구현이 자동 4xx 를 가정할 수 없다. 본 필터가 그 4xx 매핑을 controller 계약으로 박제한다.
//
// 매핑 규칙 (4 분기):
//   (1) HttpException (파일 누락 400 / RBAC 401·403 / service 4xx / Nest 가
//       FileInterceptor 안에서 LIMIT_FILE_SIZE 를 이미 PayloadTooLargeException 으로
//       선변환한 경우) → 원래 status·body 그대로 passthrough (재매핑·swallow 금지).
//   (2) raw MulterError(LIMIT_FILE_SIZE) → 413 (Nest 선변환 우회 도달 시 방어적 매핑).
//   (3) 그 외 raw MulterError (예: LIMIT_UNEXPECTED_FILE) → 400.
//   (4) 그 외 unknown → 500 (default 동작 보존).
//
// zero-dep(ADR-0055 §Decision 4): @types/multer 미도입 + multer 직접 import 회피 —
// MulterError 는 duck typing(name === "MulterError" + string code)으로만 감지한다.
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  PayloadTooLargeException,
} from "@nestjs/common";
import type { Response } from "express";

// MulterError 의 zero-dep 구조적 타입 — 감지에 필요한 name/code 만 담는다.
interface MulterErrorLike {
  name: string;
  code: string;
}

// duck typing 으로 raw MulterError 감지 (multer 직접 import 회피). null·undefined·
// non-object·name 불일치·non-string code 는 모두 false → unknown 분기(500)로 흐른다.
function isMulterError(exception: unknown): exception is MulterErrorLike {
  if (typeof exception !== "object" || exception === null) {
    return false;
  }
  const candidate = exception as { name?: unknown; code?: unknown };
  return candidate.name === "MulterError" && typeof candidate.code === "string";
}

@Catch()
export class MulterExceptionFilter implements ExceptionFilter {
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
    if (isMulterError(exception)) {
      if (exception.code === "LIMIT_FILE_SIZE") {
        return new PayloadTooLargeException(
          "업로드 파일이 허용 크기 상한을 초과했습니다.",
        ); // (2)
      }
      return new BadRequestException(
        `업로드 요청이 거부되었습니다 (multer 오류: ${exception.code}).`,
      ); // (3)
    }
    return new InternalServerErrorException(); // (4) 500 default 보존.
  }
}
