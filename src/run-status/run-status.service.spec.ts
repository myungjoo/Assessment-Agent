// RunStatusService spec — T-1841 acceptance (R-112 4 종: happy / error / 분기 / negative).
// ADR-0060 §Decision 2 의 필드 shape 과 불변식, §Decision 4 의 전이 규칙을 service 단위로 고정한다.

import { Logger } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";

import {
  isRunAxis,
  RUN_AXES,
  RunStatusService,
  type RunAxis,
  type RunStatusSnapshot,
} from "./run-status.service";

/** ISO-8601 UTC (`2026-09-02T00:00:00.000Z`) 문자열 판정. */
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** ADR-0060 §Decision 2 불변식 — 두 축 파생값과 전체 active 의 정합. */
function expectInvariants(snapshot: RunStatusSnapshot): void {
  expect(snapshot.evaluation.active).toBe(snapshot.evaluation.runningCount > 0);
  expect(snapshot.collection.active).toBe(snapshot.collection.runningCount > 0);
  expect(snapshot.active).toBe(
    snapshot.evaluation.active || snapshot.collection.active,
  );
  for (const axis of RUN_AXES) {
    expect(snapshot[axis].runningCount).toBeGreaterThanOrEqual(0);
    if (snapshot[axis].active) {
      expect(snapshot[axis].startedAt).toMatch(ISO_UTC);
    } else {
      expect(snapshot[axis].startedAt).toBeNull();
    }
  }
}

describe("RunStatusService", () => {
  let service: RunStatusService;
  let warn: jest.SpyInstance;

  beforeEach(async () => {
    // Logger 출력이 test log 를 오염시키지 않도록 침묵시키되 호출은 관측한다.
    warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {});
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-02T00:00:00.000Z"));

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [RunStatusService],
    }).compile();
    service = moduleRef.get(RunStatusService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("happy path", () => {
    it("비실행 상태 snapshot 은 active false · runningCount 0 · startedAt null 이다", () => {
      const snapshot = service.snapshot();

      expect(snapshot.active).toBe(false);
      expect(snapshot.evaluation).toEqual({
        active: false,
        runningCount: 0,
        startedAt: null,
      });
      expect(snapshot.collection).toEqual({
        active: false,
        runningCount: 0,
        startedAt: null,
      });
      expect(snapshot.observedAt).toBe("2026-09-02T00:00:00.000Z");
      expectInvariants(snapshot);
    });

    it("begin('evaluation') 후 active true · runningCount 1 · startedAt 이 ISO-8601 이다", () => {
      service.begin("evaluation");

      const snapshot = service.snapshot();
      expect(snapshot.active).toBe(true);
      expect(snapshot.evaluation.active).toBe(true);
      expect(snapshot.evaluation.runningCount).toBe(1);
      expect(snapshot.evaluation.startedAt).toBe("2026-09-02T00:00:00.000Z");
      expect(snapshot.evaluation.startedAt).toMatch(ISO_UTC);
      expectInvariants(snapshot);
    });

    it("end('evaluation') 후 비실행 상태로 원상 복귀한다", () => {
      service.begin("evaluation");
      jest.advanceTimersByTime(1_000);
      service.end("evaluation");

      const snapshot = service.snapshot();
      expect(snapshot.active).toBe(false);
      expect(snapshot.evaluation.runningCount).toBe(0);
      expect(snapshot.evaluation.startedAt).toBeNull();
      expectInvariants(snapshot);
    });

    it("snapshot() 은 응답 필드 표의 key 집합을 그대로 노출한다", () => {
      const snapshot = service.snapshot();

      expect(Object.keys(snapshot).sort()).toEqual([
        "active",
        "collection",
        "evaluation",
        "observedAt",
      ]);
      expect(Object.keys(snapshot.evaluation).sort()).toEqual([
        "active",
        "runningCount",
        "startedAt",
      ]);
    });
  });

  describe("error path", () => {
    it("begin 없이 end 를 호출해도 runningCount 가 음수가 되지 않는다", () => {
      service.end("evaluation");

      const snapshot = service.snapshot();
      expect(snapshot.evaluation.runningCount).toBe(0);
      expect(snapshot.evaluation.active).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expectInvariants(snapshot);
    });

    it("불균형 end 2 회 연속도 0 으로 유지된다", () => {
      service.end("collection");
      service.end("collection");

      const snapshot = service.snapshot();
      expect(snapshot.collection.runningCount).toBe(0);
      expect(snapshot.active).toBe(false);
      expect(warn).toHaveBeenCalledTimes(2);
      expectInvariants(snapshot);
    });

    it("begin 1 회 후 end 2 회여도 0 에서 멈춘다 (초과 감소 무시)", () => {
      service.begin("evaluation");
      service.end("evaluation");
      service.end("evaluation");

      const snapshot = service.snapshot();
      expect(snapshot.evaluation.runningCount).toBe(0);
      expect(snapshot.evaluation.startedAt).toBeNull();
      expectInvariants(snapshot);
    });

    it("타입 밖 axis 를 런타임 cast 로 begin 에 넘기면 무시하고 경고만 남긴다", () => {
      service.begin("unknown" as RunAxis);

      const snapshot = service.snapshot();
      expect(snapshot.active).toBe(false);
      expect(snapshot.evaluation.runningCount).toBe(0);
      expect(snapshot.collection.runningCount).toBe(0);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain("unknown");
      expectInvariants(snapshot);
    });

    it("타입 밖 axis 를 end 에 넘겨도 다른 축 상태를 건드리지 않는다", () => {
      service.begin("evaluation");
      service.end(null as unknown as RunAxis);

      const snapshot = service.snapshot();
      expect(snapshot.evaluation.runningCount).toBe(1);
      expect(snapshot.collection.runningCount).toBe(0);
      expect(warn).toHaveBeenCalledTimes(1);
      expectInvariants(snapshot);
    });
  });

  describe("분기 cover", () => {
    it.each([
      [0, false],
      [1, true],
      [2, true],
    ])(
      "runningCount %i 이면 active 는 %s 다 (active 산출 분기)",
      (count, expected) => {
        for (let i = 0; i < count; i += 1) {
          service.begin("evaluation");
        }

        const snapshot = service.snapshot();
        expect(snapshot.evaluation.runningCount).toBe(count);
        expect(snapshot.evaluation.active).toBe(expected);
        expect(snapshot.active).toBe(expected);
        expectInvariants(snapshot);
      },
    );

    it("두 축 조합 4 상태 (둘 다 idle / evaluation 만 / collection 만 / 둘 다) 가 모두 정합한다", () => {
      const idle = service.snapshot();
      expect([
        idle.active,
        idle.evaluation.active,
        idle.collection.active,
      ]).toEqual([false, false, false]);
      expectInvariants(idle);

      service.begin("evaluation");
      const evalOnly = service.snapshot();
      expect([
        evalOnly.active,
        evalOnly.evaluation.active,
        evalOnly.collection.active,
      ]).toEqual([true, true, false]);
      expectInvariants(evalOnly);

      service.begin("collection");
      const both = service.snapshot();
      expect([
        both.active,
        both.evaluation.active,
        both.collection.active,
      ]).toEqual([true, true, true]);
      expectInvariants(both);

      service.end("evaluation");
      const collectionOnly = service.snapshot();
      expect([
        collectionOnly.active,
        collectionOnly.evaluation.active,
        collectionOnly.collection.active,
      ]).toEqual([true, false, true]);
      expectInvariants(collectionOnly);

      service.end("collection");
      expectInvariants(service.snapshot());
      expect(service.snapshot().active).toBe(false);
    });

    it("startedAt 은 실행 중일 때만 값 분기를, 아닐 때 null 분기를 탄다", () => {
      expect(service.snapshot().collection.startedAt).toBeNull();

      service.begin("collection");
      expect(service.snapshot().collection.startedAt).toBe(
        "2026-09-02T00:00:00.000Z",
      );

      service.end("collection");
      expect(service.snapshot().collection.startedAt).toBeNull();
    });

    it("isRunAxis 는 유효 축만 true 를 준다", () => {
      expect(RUN_AXES).toEqual(["evaluation", "collection"]);
      expect(isRunAxis("evaluation")).toBe(true);
      expect(isRunAxis("collection")).toBe(true);
      expect(isRunAxis("Evaluation")).toBe(false);
      expect(isRunAxis("")).toBe(false);
      expect(isRunAxis(undefined)).toBe(false);
      expect(isRunAxis(42)).toBe(false);
      expect(isRunAxis({ axis: "evaluation" })).toBe(false);
    });
  });

  describe("negative cases", () => {
    it("동시 3 건 중 1 건이 끝나도 active 는 true 이고 마지막 1 건이 끝나야 false 다", () => {
      service.begin("evaluation");
      service.begin("evaluation");
      service.begin("evaluation");
      service.end("evaluation");

      const partial = service.snapshot();
      expect(partial.evaluation.runningCount).toBe(2);
      expect(partial.evaluation.active).toBe(true);
      expect(partial.active).toBe(true);
      expectInvariants(partial);

      service.end("evaluation");
      expect(service.snapshot().evaluation.runningCount).toBe(1);
      expect(service.snapshot().active).toBe(true);

      service.end("evaluation");
      const done = service.snapshot();
      expect(done.evaluation.runningCount).toBe(0);
      expect(done.active).toBe(false);
      expectInvariants(done);
    });

    it("out-of-order 종료 — 나중에 시작한 실행이 먼저 끝나도 startedAt 이 실행 중인 것들의 최솟값이다", () => {
      service.begin("evaluation"); // t0
      jest.advanceTimersByTime(5_000);
      service.begin("evaluation"); // t0 + 5s

      expect(service.snapshot().evaluation.startedAt).toBe(
        "2026-09-02T00:00:00.000Z",
      );

      // 나중에 시작한 실행이 먼저 끝난다 → 남은 실행의 시작 시각이 그대로 최솟값.
      service.end("evaluation");
      const after = service.snapshot();
      expect(after.evaluation.runningCount).toBe(1);
      expect(after.evaluation.startedAt).toBe("2026-09-02T00:00:00.000Z");
      expectInvariants(after);

      service.end("evaluation");
      expect(service.snapshot().evaluation.startedAt).toBeNull();
    });

    it("축 격리 — begin('evaluation') 은 collection 의 어떤 필드도 바꾸지 않는다", () => {
      const before = service.snapshot().collection;

      service.begin("evaluation");
      service.begin("evaluation");

      const after = service.snapshot();
      expect(after.collection).toEqual(before);
      expect(after.evaluation.runningCount).toBe(2);
      expectInvariants(after);
    });

    it("축 격리 — 한 축의 end 가 다른 축 카운터를 감소시키지 않는다", () => {
      service.begin("collection");
      service.end("evaluation");

      const snapshot = service.snapshot();
      expect(snapshot.collection.runningCount).toBe(1);
      expect(snapshot.collection.active).toBe(true);
      expect(snapshot.evaluation.runningCount).toBe(0);
      expectInvariants(snapshot);
    });

    it("예외 경로 감소 — begin 후 throw 해도 finally 의 end 로 카운터가 0 으로 복원된다", () => {
      const boom = (): never => {
        throw new Error("평가 도중 실패");
      };

      expect(() => {
        service.begin("evaluation");
        try {
          boom();
        } finally {
          service.end("evaluation");
        }
      }).toThrow("평가 도중 실패");

      const snapshot = service.snapshot();
      expect(snapshot.evaluation.runningCount).toBe(0);
      expect(snapshot.evaluation.startedAt).toBeNull();
      expect(snapshot.active).toBe(false);
      expectInvariants(snapshot);
    });

    it("observedAt 은 호출마다 갱신되는 ISO-8601 문자열이다", () => {
      const first = service.snapshot().observedAt;
      jest.advanceTimersByTime(1_500);
      const second = service.snapshot().observedAt;

      expect(first).toMatch(ISO_UTC);
      expect(second).toMatch(ISO_UTC);
      expect(second).not.toBe(first);
      expect(Date.parse(second) - Date.parse(first)).toBe(1_500);
    });

    it("snapshot 은 내부 상태를 참조로 노출하지 않는다 (반환값 변조가 다음 조회에 새지 않음)", () => {
      service.begin("evaluation");
      const snapshot = service.snapshot();
      snapshot.evaluation.runningCount = 99;
      snapshot.active = false;

      const fresh = service.snapshot();
      expect(fresh.evaluation.runningCount).toBe(1);
      expect(fresh.active).toBe(true);
    });
  });
});
