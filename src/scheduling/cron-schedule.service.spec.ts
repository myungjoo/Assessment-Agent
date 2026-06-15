// CronScheduleService + isValidCronExpression unit test (CLAUDE.md §3.2 R-112 —
// happy / error / branch / negative 충분 cover). SchedulerRegistry 를 jest mock 으로
// 주입 — 실 timer·실 cron 발화 0(registry wrapper 동작만 검증). T-0413, P7 ③ slice 1.
//
// 실타이머 누수 차단(T-0413 round 2): production 의 registerOrReplace 가 실제
// `cron` 라이브러리의 `CronJob` 을 생성하고 `job.start()` 로 실타이머를 가동한다.
// 본 spec 은 wrapper 동작(registry add/delete/exists/list 호출)만 검증하므로 실
// CronJob 이 필요 없다. 그러나 mock 없이 두면 `start()` 가 setTimeout 을 띄워
// Jest open-handle 누수 → CI 가 종료하지 못하고 hang 한다(2회 run 모두 관측).
// 따라서 `cron` 모듈을 통째로 mock 해 `CronJob` 을 실타이머 없는 stub 으로 대체한다.
// `CronTime`(isValidCronExpression 의 검증 primitive)은 실제 동작이 필요하므로
// jest.requireActual 로 진짜 구현을 보존한다(검증 분기 정확성 유지).
jest.mock("cron", () => {
  const actual = jest.requireActual<typeof import("cron")>("cron");
  // CronJob stub — 생성자가 cron 식을 actual CronTime 으로 검증해 형식 위반에 throw
  // 하는 production 계약은 보존하되(잘못된 식 등록 거부 테스트가 의존), start/stop 은
  // 실타이머를 띄우지 않는 no-op 으로 둔다. start 호출 여부는 startMock 으로 추적.
  const startMock = jest.fn();
  const stopMock = jest.fn();
  class CronJobStub {
    public start = startMock;
    public stop = stopMock;
    constructor(cronTime: string) {
      // production 과 동일하게 형식 검증 — 잘못된 식이면 생성자에서 throw.
      new actual.CronTime(cronTime);
    }
  }
  return { ...actual, CronJob: CronJobStub };
});

import { BadRequestException, NotFoundException } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";

import {
  CronScheduleService,
  isValidCronExpression,
} from "./cron-schedule.service";

// 유효한 cron 식 — 6-field(초 포함). CronJob 생성이 throw 하지 않는 값.
const VALID_CRON = "0 0 2 * * *";

// fakeRegistry — getCronJobs() 가 반환하는 Map 을 내부 상태로 들고, add/delete 가
// 그 Map 을 갱신하도록 한 가짜 SchedulerRegistry. 실제 timer 없이 wrapper 의
// add/delete/exists/list 동작과 호출 횟수를 검증한다.
function makeRegistry(): {
  registry: SchedulerRegistry;
  jobs: Map<string, unknown>;
  addSpy: jest.Mock;
  deleteSpy: jest.Mock;
} {
  const jobs = new Map<string, unknown>();
  const addSpy = jest.fn((name: string, job: unknown) => {
    jobs.set(name, job);
  });
  const deleteSpy = jest.fn((name: string) => {
    jobs.delete(name);
  });
  const registry = {
    addCronJob: addSpy,
    deleteCronJob: deleteSpy,
    getCronJobs: () => jobs,
  } as unknown as SchedulerRegistry;
  return { registry, jobs, addSpy, deleteSpy };
}

function makeService(): {
  service: CronScheduleService;
  jobs: Map<string, unknown>;
  addSpy: jest.Mock;
  deleteSpy: jest.Mock;
} {
  const { registry, jobs, addSpy, deleteSpy } = makeRegistry();
  return {
    service: new CronScheduleService(registry),
    jobs,
    addSpy,
    deleteSpy,
  };
}

describe("isValidCronExpression", () => {
  it("유효한 cron 식(6-field)에 true 를 반환한다", () => {
    expect(isValidCronExpression(VALID_CRON)).toBe(true);
  });

  it("유효한 cron 식(5-field)에 true 를 반환한다", () => {
    expect(isValidCronExpression("0 2 * * *")).toBe(true);
  });

  it("빈 문자열에 false 를 반환한다 (negative)", () => {
    expect(isValidCronExpression("")).toBe(false);
  });

  it("공백만 있는 식에 false 를 반환한다 (negative)", () => {
    expect(isValidCronExpression("   ")).toBe(false);
  });

  it("형식 위반(필드 수 부족) 식에 false 를 반환한다 (negative)", () => {
    expect(isValidCronExpression("0 0")).toBe(false);
  });

  it("형식 위반(범위 초과) 식에 false 를 반환한다 (negative)", () => {
    expect(isValidCronExpression("99 99 99 * * *")).toBe(false);
  });

  it("비문자열 입력에 false 를 반환한다 (negative)", () => {
    expect(isValidCronExpression(undefined as unknown as string)).toBe(false);
  });
});

describe("CronScheduleService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("registerOrReplace — happy / branch", () => {
    it("유효 cron 식 신규 등록 시 addCronJob 1회 + list/exists 반영 (branch: 없음→신규)", () => {
      const { service, addSpy } = makeService();
      service.registerOrReplace("daily", VALID_CRON, () => undefined);

      expect(addSpy).toHaveBeenCalledTimes(1);
      expect(addSpy).toHaveBeenCalledWith("daily", expect.anything());
      expect(service.exists("daily")).toBe(true);
      expect(service.list()).toEqual(["daily"]);
    });

    it("동일 name 재등록 시 deleteCronJob 후 재등록 (branch: 있음→교체)", () => {
      const { service, addSpy, deleteSpy } = makeService();
      service.registerOrReplace("daily", VALID_CRON, () => undefined);
      service.registerOrReplace("daily", "0 0 3 * * *", () => undefined);

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy).toHaveBeenCalledWith("daily");
      expect(addSpy).toHaveBeenCalledTimes(2);
      // 교체 후에도 단일 등록 유지(중복 누적 아님).
      expect(service.list()).toEqual(["daily"]);
    });

    it("신규 등록 분기에서는 deleteCronJob 을 호출하지 않는다 (branch 단언)", () => {
      const { service, deleteSpy } = makeService();
      service.registerOrReplace("daily", VALID_CRON, () => undefined);
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe("registerOrReplace — error path / negative", () => {
    it.each([
      ["빈 문자열", ""],
      ["공백만", "   "],
      ["필드 수 부족", "0 0"],
      ["범위 초과", "99 99 99 * * *"],
    ])(
      "잘못된 cron 식(%s)은 BadRequestException + addCronJob 미호출",
      (_label, expr) => {
        const { service, addSpy } = makeService();
        expect(() =>
          service.registerOrReplace("bad", expr, () => undefined),
        ).toThrow(BadRequestException);
        expect(addSpy).not.toHaveBeenCalled();
        expect(service.exists("bad")).toBe(false);
      },
    );

    it("빈 name 은 BadRequestException + addCronJob 미호출 (negative)", () => {
      const { service, addSpy } = makeService();
      expect(() =>
        service.registerOrReplace("", VALID_CRON, () => undefined),
      ).toThrow(BadRequestException);
      expect(addSpy).not.toHaveBeenCalled();
    });

    it("공백만 있는 name 은 BadRequestException (negative)", () => {
      const { service } = makeService();
      expect(() =>
        service.registerOrReplace("   ", VALID_CRON, () => undefined),
      ).toThrow(BadRequestException);
    });
  });

  describe("remove", () => {
    it("등록된 job 삭제 시 deleteCronJob 1회 + exists false (happy)", () => {
      const { service, deleteSpy } = makeService();
      service.registerOrReplace("daily", VALID_CRON, () => undefined);
      service.remove("daily");

      expect(deleteSpy).toHaveBeenCalledWith("daily");
      expect(service.exists("daily")).toBe(false);
      expect(service.list()).toEqual([]);
    });

    it("부재 name 삭제 시 NotFoundException + deleteCronJob 미호출 (negative)", () => {
      const { service, deleteSpy } = makeService();
      expect(() => service.remove("missing")).toThrow(NotFoundException);
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe("list / exists", () => {
    it("빈 registry 에서 list() 는 빈 배열, exists() 는 false", () => {
      const { service } = makeService();
      expect(service.list()).toEqual([]);
      expect(service.exists("nope")).toBe(false);
    });

    it("복수 등록 시 list() 가 모든 이름을 반환한다", () => {
      const { service } = makeService();
      service.registerOrReplace("a", VALID_CRON, () => undefined);
      service.registerOrReplace("b", "0 0 3 * * *", () => undefined);
      expect(service.list().sort()).toEqual(["a", "b"]);
    });
  });
});
