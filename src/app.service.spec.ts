// AppService 및 AppController 의 sanity test.
// R-112 충족:
//  - happy-path: getStatus() / getRoot() 가 약속된 문자열을 반환
//  - negative test: 반환값이 undefined / 빈 문자열이 아님
//  - flow / branch: controller 가 service 결과를 그대로 위임하는지 검증
// 본 spec 은 도메인 로직 없이 부트스트랩 가능성과 DI 배선만을 확인한다.
import { Test, TestingModule } from "@nestjs/testing";

import { AppController } from "./app.controller";
import { AppService, APP_STATUS_MESSAGE } from "./app.service";

describe("AppService", () => {
  let service: AppService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();
    service = moduleRef.get<AppService>(AppService);
  });

  // happy-path: getStatus() 가 약속된 상수를 반환
  it("getStatus() 는 APP_STATUS_MESSAGE 와 동일한 문자열을 반환한다", () => {
    expect(service.getStatus()).toBe(APP_STATUS_MESSAGE);
  });

  // negative test 1: 반환값이 undefined / null 이 아님
  it("getStatus() 는 undefined 나 null 을 반환하지 않는다", () => {
    const result = service.getStatus();
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  // negative test 2: 반환값이 빈 문자열이 아님
  it("getStatus() 는 비어있지 않은 문자열을 반환한다", () => {
    const result = service.getStatus();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("AppController", () => {
  let controller: AppController;
  let service: AppService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    controller = moduleRef.get<AppController>(AppController);
    service = moduleRef.get<AppService>(AppService);
  });

  // happy-path: GET /api 가 service 결과를 그대로 반환 (T-0354 에서 / → /api 이전)
  it("getRoot() 는 AppService.getStatus() 결과와 동일한 값을 반환한다", () => {
    expect(controller.getRoot()).toBe(service.getStatus());
  });

  // flow: controller 가 service 호출에 위임 (분기 / 자체 로직 없음 확인)
  it("getRoot() 는 AppService.getStatus() 를 호출한다", () => {
    const spy = jest.spyOn(service, "getStatus").mockReturnValue("SENTINEL");
    expect(controller.getRoot()).toBe("SENTINEL");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  // negative test: service 가 예외를 던지면 controller 도 그대로 전파
  it("AppService.getStatus() 가 throw 하면 getRoot() 도 throw 한다", () => {
    jest.spyOn(service, "getStatus").mockImplementation(() => {
      throw new Error("service-failure");
    });
    expect(() => controller.getRoot()).toThrow("service-failure");
  });
});
