// bootstrap.spec.ts — applyGlobalMiddleware helper 의 R-112 4 카테고리 cover
// (T-0090 박제). INestApplication mock 으로 isolation — 실 NestFactory 호출 0.
//
// 책임:
//   - happy — middleware 1 회 wire (cookie-parser instance 1 회 app.use 호출).
//   - branch — app.use 인자 type 검증 (express middleware function signature 정합).
//   - error path — app === null/undefined 시 TypeError throw (typescript type 강제로
//     runtime 0 이나 강제 cast 로 negative case 박제).
//   - negative — middleware 호출 횟수 정확히 1 (향후 middleware 추가 시 본 spec
//     의 count assertion 이 fail → 자동 catch — spec 이 source of truth).
import type { INestApplication } from "@nestjs/common";

import { applyGlobalMiddleware } from "./bootstrap";

interface MockApp {
  use: jest.Mock;
}

const buildMockApp = (): MockApp => ({ use: jest.fn() });

describe("applyGlobalMiddleware (T-0090)", () => {
  // happy — middleware 1 회 wire. cookie-parser instance 1 회 app.use 호출.
  it("happy — applyGlobalMiddleware 호출 시 app.use 가 1 회 호출되고 middleware function 인자 전달", () => {
    const mockApp = buildMockApp();
    applyGlobalMiddleware(mockApp as unknown as INestApplication);

    expect(mockApp.use).toHaveBeenCalledTimes(1);
    const callArg = mockApp.use.mock.calls[0][0];
    expect(callArg).toBeDefined();
    expect(typeof callArg).toBe("function");
  });

  // branch — app.use 인자 type 검증. cookie-parser middleware 는 express 의
  // (req, res, next) => void signature → function 의 length 가 3.
  it("branch — app.use 인자가 express middleware function signature (req, res, next) 정합", () => {
    const mockApp = buildMockApp();
    applyGlobalMiddleware(mockApp as unknown as INestApplication);

    const callArg = mockApp.use.mock.calls[0][0] as (
      ...args: unknown[]
    ) => void;
    expect(typeof callArg).toBe("function");
    // express middleware 의 정규 arity — (req, res, next).
    expect(callArg.length).toBe(3);
  });

  // error path — app === null 시 TypeError throw. typescript type 강제로 runtime 0
  // 이나 강제 cast (as unknown as INestApplication) 로 negative case 박제.
  it("error — app === null 시 TypeError throw (negative cast 박제)", () => {
    expect(() =>
      applyGlobalMiddleware(null as unknown as INestApplication),
    ).toThrow(TypeError);
  });

  // error path — app === undefined 시 TypeError throw (negative cast 박제).
  it("error — app === undefined 시 TypeError throw (negative cast 박제)", () => {
    expect(() =>
      applyGlobalMiddleware(undefined as unknown as INestApplication),
    ).toThrow(TypeError);
  });

  // negative — middleware 호출 횟수 정확히 1. 향후 middleware 추가 시 본 it 이
  // fail → spec 이 source of truth 로 동작 (CLAUDE.md §3.2 R-112 negative 분기).
  it("negative — applyGlobalMiddleware 가 정확히 1 회만 app.use 호출 (향후 middleware 추가 시 spec 갱신 의무)", () => {
    const mockApp = buildMockApp();
    applyGlobalMiddleware(mockApp as unknown as INestApplication);

    expect(mockApp.use).toHaveBeenCalledTimes(1);
  });
});
