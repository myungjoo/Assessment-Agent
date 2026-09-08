// RecentDeletionInputExceptionFilter spec — T-1965 acceptance. R-112: 4 매핑 분기
// (HttpException passthrough / RangeError→400 / TypeError→400 / unknown→500) + negative
// (subclass · 비-문자열 · 빈 message · days 하한 축 · 403·404 downgrade 0 · null·undefined
// ·문자열·plain object). 필터가 응답을 직접 직렬화하므로 ArgumentsHost + express Response
// 를 mock 해 단언한다 (scope-input-exception.filter.spec.ts 구조 mirror).
import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
  type ArgumentsHost,
} from "@nestjs/common";

import { RecentDeletionInputExceptionFilter } from "./recent-deletion-input-exception.filter";

const GUIDE = "최근 N일 삭제 요청 입력이 올바르지 않습니다";

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
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
}

describe("RecentDeletionInputExceptionFilter", () => {
  let filter: RecentDeletionInputExceptionFilter;

  beforeEach(() => {
    filter = new RecentDeletionInputExceptionFilter();
  });

  // (2) RangeError → 400. happy-path — 본 필터가 존재하는 이유(days 상한 초과 500 누수).
  it("RangeError(days 상한 366 초과) → 400 + 한국어 안내 + 원 message 결합 (happy — 입력 결함 4xx 매핑)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(
      new RangeError(
        "buildRecentDeletionWindow: days 상한(366일=1년) 초과 (받음: 400)",
      ),
      buildHost(response),
    );
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    const serialized = JSON.stringify(captured.body);
    expect(serialized).toContain(GUIDE);
    expect(serialized).toContain("days 상한(366일=1년) 초과");
    expect(response.status).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  // (3) TypeError → 400 (instants 원소 Invalid Date 계열).
  it("TypeError(instants 원소 Invalid Date) → 400 (branch — 형식 결함도 호출자 오류)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(
      new TypeError(
        "selectInDeletionWindow: instants[1] 은(는) 유효한 Date instance 여야 합니다",
      ),
      buildHost(response),
    );
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(JSON.stringify(captured.body)).toContain("instants[1]");
  });

  // (1) HttpException passthrough — status/body 보존 (재매핑·swallow 0). 404 는 T-1963
  // e2e 가 고정한 raw forward 계약, 403 은 RolesGuard 결과 보존(400 downgrade 0).
  it.each([
    [
      "404 NotFound(Person 부재)",
      new NotFoundException("person 을 찾을 수 없습니다"),
      404,
      "person 을 찾을 수 없습니다",
    ],
    [
      "403 Forbidden(RBAC tier 미달)",
      new ForbiddenException("Forbidden"),
      403,
      "Forbidden",
    ],
    ["401 Unauthorized", new UnauthorizedException(), 401, "Unauthorized"],
    [
      "400 BadRequest(ValidationPipe)",
      new BadRequestException("days 는 양의 정수여야 합니다"),
      400,
      "days 는 양의 정수여야 합니다",
    ],
  ])(
    "HttpException passthrough — %s 는 status·body 재매핑 0 (branch — 404/RBAC/ValidationPipe 계약 보존)",
    (_label, exception, expectedStatus, fragment) => {
      const { response, captured } = buildResponseMock();
      filter.catch(exception, buildHost(response));
      const serialized = JSON.stringify(captured.body);
      expect(captured.status).toBe(expectedStatus);
      expect(serialized).toContain(fragment);
      expect(serialized).not.toContain(GUIDE);
    },
  );

  // (4) unknown → 500 (default 동작 보존 — 4xx 오분류 0, 내부 세부 미노출).
  it("unknown Error(DB 연결 실패) → 500 보존 (error path — 서버 결함 5xx, 4xx 오분류 0)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(
      new Error("connect ECONNREFUSED 127.0.0.1:5432"),
      buildHost(response),
    );
    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(JSON.stringify(captured.body)).not.toContain("ECONNREFUSED");
  });

  // negative — 방어 입력은 알려진 예외 미해당 → 500 (4xx 오탐 0, throw 0).
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

  it("RangeError subclass 도 400 유지 + body 에 내부 구조 노출 0 (negative — instanceof 경계 · 정보 누출 방지)", () => {
    class DaysRangeError extends RangeError {}
    const { response, captured } = buildResponseMock();
    filter.catch(
      new DaysRangeError("days 상한(366일=1년) 초과 (받음: 999)"),
      buildHost(response),
    );
    const serialized = JSON.stringify(captured.body);
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(serialized).toContain("days 상한");
    expect(serialized).not.toContain("recent-deletion-input-exception.filter");
    expect(captured.body).not.toHaveProperty("stack");
  });

  it("message 가 문자열이 아닌 RangeError → 400 + 안내 문구만 (negative — message 방어 분기, throw 0)", () => {
    const { response, captured } = buildResponseMock();
    const error = new RangeError("원본");
    Object.defineProperty(error, "message", { value: 42 });
    expect(() => filter.catch(error, buildHost(response))).not.toThrow();
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toMatchObject({ message: `${GUIDE}.` });
  });

  it("message 가 빈 문자열인 TypeError → 400 + 안내 문구만 (negative — 빈 꼬리 0)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(new TypeError(""), buildHost(response));
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toMatchObject({ message: `${GUIDE}.` });
    expect(JSON.stringify(captured.body)).not.toContain(`${GUIDE}: `);
  });

  // negative — 상한 축과 다른 message 를 갖는 하한/정수 축 RangeError 도 동일하게 400.
  it.each(["0", "1.5"])(
    "days 하한·정수 축 RangeError(받음: %s) 도 400 (negative — 상한 축 message 에 의존 0)",
    (received) => {
      const { response, captured } = buildResponseMock();
      filter.catch(
        new RangeError(
          `buildRecentDeletionWindow: days 는 1 이상의 정수여야 합니다 (받음: ${received})`,
        ),
        buildHost(response),
      );
      expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
      expect(JSON.stringify(captured.body)).toContain("1 이상의 정수");
    },
  );
});
