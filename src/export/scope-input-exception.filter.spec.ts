// ScopeInputExceptionFilter spec — T-1328 acceptance. R-112: 4 매핑 분기
// (HttpException passthrough / RangeError→400 / TypeError→400 / unknown→500) +
// negative(null·undefined·문자열·plain object·subclass·빈 message·내부 노출 0) 충분 cover.
// 필터가 응답을 직접 직렬화하므로 ArgumentsHost + express Response 를 mock 해 status·body 단언
// (multer-exception.filter.spec.ts 구조 mirror).
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  UnauthorizedException,
  type ArgumentsHost,
} from "@nestjs/common";

import { ScopeInputExceptionFilter } from "./scope-input-exception.filter";

// express Response mock — status()/json() 체이닝을 캡처해 필터가 쓴 status·body 검증.
function buildResponseMock(): {
  response: { status: jest.Mock; json: jest.Mock };
  captured: { status?: number; body?: unknown };
} {
  const captured: { status?: number; body?: unknown } = {};
  const response: { status: jest.Mock; json: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockImplementation((code: number) => {
    captured.status = code;
    return response;
  });
  response.json.mockImplementation((body: unknown) => {
    captured.body = body;
    return response;
  });
  return { response, captured };
}

function buildHost(response: unknown): ArgumentsHost {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ArgumentsHost;
}

describe("ScopeInputExceptionFilter", () => {
  let filter: ScopeInputExceptionFilter;

  beforeEach(() => {
    filter = new ScopeInputExceptionFilter();
  });

  // (2) RangeError → 400. happy-path — 본 필터가 존재하는 이유(scope 조합 결함).
  it("RangeError(dateRange 누락) → 400 + 한국어 안내 message (happy — 호출자 입력 결함 4xx 매핑)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(
      new RangeError(
        "describeExportScope: range scope 는 dateRange 가 필요합니다",
      ),
      buildHost(response),
    );
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(JSON.stringify(captured.body)).toContain(
      "Export scope 입력이 올바르지 않습니다",
    );
    expect(JSON.stringify(captured.body)).toContain("dateRange 가 필요합니다");
    expect(response.status).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  // (3) TypeError → 400 (Invalid Date 계열).
  it("TypeError(Invalid Date) → 400 (error path — 날짜 형식 결함도 호출자 오류)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(
      new TypeError(
        "describeExportScope: dateRange.start 은(는) 유효한 Date instance 여야 합니다",
      ),
      buildHost(response),
    );
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(JSON.stringify(captured.body)).toContain("dateRange.start");
  });

  // (1) HttpException passthrough — 원래 status/body 보존 (재매핑·swallow 0).
  it.each([
    ["403 Forbidden", new ForbiddenException("Forbidden"), 403, "Forbidden"],
    ["401 Unauthorized", new UnauthorizedException(), 401, "Unauthorized"],
    [
      "400 BadRequest(ValidationPipe)",
      new BadRequestException("scope 값이 올바르지 않습니다"),
      400,
      "scope 값이 올바르지 않습니다",
    ],
  ])(
    "HttpException passthrough — %s 는 status·body 재매핑 0 (branch — RBAC/ValidationPipe 보존)",
    (_label, exception, expectedStatus, fragment) => {
      const { response, captured } = buildResponseMock();
      filter.catch(exception, buildHost(response));
      const serialized = JSON.stringify(captured.body);
      expect(captured.status).toBe(expectedStatus);
      expect(serialized).toContain(fragment);
      expect(serialized).not.toContain("Export scope 입력이 올바르지 않습니다");
    },
  );

  // (4) unknown → 500 (default 동작 보존 — 4xx 오분류 0, 내부 세부 미노출).
  it("unknown Error → 500 (error path — 서버 결함은 5xx 보존, 4xx 오분류 0)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(new Error("boom"), buildHost(response));
    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(JSON.stringify(captured.body)).not.toContain("boom");
  });

  // negative — 방어 입력은 알려진 예외 미해당 → 500 (오탐 방지, throw 0).
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["문자열", "just a string"],
    ["plain object", { message: "RangeError 처럼 생긴 객체" }],
  ])(
    "방어 — %s 입력 → 500 (negative — 4xx 오탐 0, throw 0)",
    (_l, exception) => {
      const { response, captured } = buildResponseMock();
      expect(() => filter.catch(exception, buildHost(response))).not.toThrow();
      expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    },
  );

  it("RangeError subclass 도 400 유지 + body 에 내부 노출 0 (negative — instanceof 경계 · 정보 누출 방지)", () => {
    class ScopeRangeError extends RangeError {}
    const { response, captured } = buildResponseMock();
    filter.catch(
      new ScopeRangeError("허용 외 entity 가 섞여 있습니다"),
      buildHost(response),
    );
    const serialized = JSON.stringify(captured.body);
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(serialized).toContain("허용 외 entity");
    expect(serialized).not.toContain("scope-input-exception.filter");
    expect(captured.body).not.toHaveProperty("stack");
  });

  it("message 가 문자열이 아닌 RangeError → 400 + 안내 문구만 (negative — message 방어 분기)", () => {
    const { response, captured } = buildResponseMock();
    const error = new RangeError("원본");
    Object.defineProperty(error, "message", { value: 42 });
    filter.catch(error, buildHost(response));
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toMatchObject({
      message: "Export scope 입력이 올바르지 않습니다.",
    });
  });

  it("message 가 빈 문자열인 RangeError → 400 + 안내 문구만 (negative — 빈 꼬리 0)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(new RangeError(""), buildHost(response));
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toMatchObject({
      message: "Export scope 입력이 올바르지 않습니다.",
    });
  });
});
