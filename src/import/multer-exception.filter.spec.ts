// MulterExceptionFilter spec — T-1253 acceptance (ADR-0055 §Decision 3). R-112:
// 4 매핑 분기(LIMIT_FILE_SIZE→413 / 기타 MulterError→400 / HttpException passthrough
// / unknown→500) + negative(null·undefined·non-Error·non-Multer object 방어) 충분 cover.
// 필터가 응답을 직접 직렬화하므로 ArgumentsHost + express Response 를 mock 해 status·body 단언.
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  Post,
  UnauthorizedException,
  UploadedFile,
  UseFilters,
  UseInterceptors,
  type ArgumentsHost,
  type INestApplication,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";

import { MulterExceptionFilter } from "./multer-exception.filter";
import type { UploadedDumpFile } from "./uploaded-dump-file";

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

// raw MulterError-like 객체 (duck typing 대상 — multer 직접 import 회피, §Decision 4).
function buildMulterError(code: string): { name: string; code: string } {
  return { name: "MulterError", code };
}

describe("MulterExceptionFilter", () => {
  let filter: MulterExceptionFilter;

  beforeEach(() => {
    filter = new MulterExceptionFilter();
  });

  // (1) raw MulterError(LIMIT_FILE_SIZE) → 413.
  it("MulterError(LIMIT_FILE_SIZE) → 413 Payload Too Large (error path — 크기 상한 초과 핵심)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(buildMulterError("LIMIT_FILE_SIZE"), buildHost(response));
    expect(captured.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(captured.body).toMatchObject({
      statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
    });
    expect(response.status).toHaveBeenCalledTimes(1);
    expect(response.json).toHaveBeenCalledTimes(1);
  });

  // (2) 그 외 MulterError → 400 (원인 code 를 body 에 담아 진단 보존).
  it("MulterError(LIMIT_UNEXPECTED_FILE) → 400 Bad Request (branch — 비 size MulterError)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(
      buildMulterError("LIMIT_UNEXPECTED_FILE"),
      buildHost(response),
    );
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toMatchObject({ statusCode: HttpStatus.BAD_REQUEST });
    expect(JSON.stringify(captured.body)).toContain("LIMIT_UNEXPECTED_FILE");
  });

  it("MulterError 이지만 미지 code 여도 400 (negative — 미지 code 도 4xx 안전 매핑)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(buildMulterError("SOME_FUTURE_CODE"), buildHost(response));
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
  });

  // (3) HttpException passthrough — 원래 status/body 보존 (재매핑·swallow 0).
  it("HttpException(BadRequestException 400) passthrough — 원래 status·body 보존 (happy — 파일 누락 400)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(
      new BadRequestException("dump artifact 파일(file) 업로드가 필요합니다."),
      buildHost(response),
    );
    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(JSON.stringify(captured.body)).toContain("업로드가 필요합니다");
  });

  it.each([
    ["401", new UnauthorizedException("Unauthorized"), HttpStatus.UNAUTHORIZED],
    ["403", new ForbiddenException("Forbidden"), HttpStatus.FORBIDDEN],
    ["404", new NotFoundException("not found"), HttpStatus.NOT_FOUND],
  ])(
    "HttpException passthrough — %s 은 재매핑 없이 원래 status 유지 (negative — RBAC/service status 보존)",
    (_label, exception, expectedStatus) => {
      const { response, captured } = buildResponseMock();
      filter.catch(exception, buildHost(response));
      expect(captured.status).toBe(expectedStatus);
    },
  );

  it("이미 PayloadTooLargeException(413) 도 passthrough 로 413 보존 (branch — Nest FileInterceptor 선변환 경로)", () => {
    const { PayloadTooLargeException } = jest.requireActual("@nestjs/common");
    const { response, captured } = buildResponseMock();
    filter.catch(
      new PayloadTooLargeException("File too large"),
      buildHost(response),
    );
    expect(captured.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
  });

  // (4) unknown → 500 (내부 세부는 노출하지 않음).
  it("unknown Error → 500 Internal Server Error (error path — default 동작 보존)", () => {
    const { response, captured } = buildResponseMock();
    filter.catch(new Error("unexpected DB outage"), buildHost(response));
    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(JSON.stringify(captured.body)).not.toContain("unexpected DB outage");
  });

  // negative — 방어 입력은 MulterError/HttpException 미해당 → 500 (duck typing 오탐 방지).
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["문자열", "just a string"],
    ["숫자", 42],
    ["빈 객체", {}],
    ["name 만 다른 객체", { name: "SomeOtherError", code: "LIMIT_FILE_SIZE" }],
    ["non-string code", { name: "MulterError", code: 5 }],
  ])(
    "방어 — %s 입력 → 500 (negative — duck typing 오탐 방지)",
    (_label, exception) => {
      const { response, captured } = buildResponseMock();
      filter.catch(exception, buildHost(response));
      expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    },
  );
});

// 실 파이프라인 integration — FileInterceptor(limits.fileSize) + @UseFilters 를 붙인
// throwaway controller 로 multer 실제 크기 초과 경로가 end-to-end 413 을 내는지 실측
// (production 상한 50 MiB 대신 tiny 10 bytes 로 mechanism 만 검증). 상한 이하는 201.
describe("MulterExceptionFilter (실 FileInterceptor 파이프라인 integration)", () => {
  @Controller("upload")
  class TinyUploadController {
    @Post()
    @UseFilters(MulterExceptionFilter)
    @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 10 } }))
    receive(@UploadedFile() file: UploadedDumpFile | undefined): {
      size: number;
    } {
      return { size: file?.size ?? 0 };
    }
  }

  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TinyUploadController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("상한(10 bytes) 초과 업로드 → 413 (happy — 실 multer LIMIT_FILE_SIZE → 필터 413)", async () => {
    await request(app.getHttpServer())
      .post("/upload")
      .attach("file", Buffer.alloc(64, 0x61), "big.json")
      .expect(HttpStatus.PAYLOAD_TOO_LARGE);
  });

  it("상한 이하 업로드 → 201 정상 통과 (branch — 필터가 정상 흐름 방해 안 함)", async () => {
    const res = await request(app.getHttpServer())
      .post("/upload")
      .attach("file", Buffer.from("abc"), "small.json")
      .expect(201);
    expect(res.body.size).toBe(3);
  });
});
