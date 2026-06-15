// BackfillRunnerService unit test (CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative 충분 cover). CollectionTriggerService 를 jest mock 으로 주입 — 실 수집·실
// DB·실 token 0(Q-0025 deferred 정합). 본 runner 의 조립(buildBackfillPlan 위임)·순회
// (시간순 순차)·idempotency 분기·error 전파(fail-fast)만 검증한다. buildBackfillPlan
// 자체의 경계 정확성은 backfill-plan.spec.ts 가 cover — 본 spec 은 runner 의 결선만.
import type { CollectionTriggerService } from "../assessment-collection/collection-trigger.service";

import { buildBackfillPlan } from "./backfill-plan";
import {
  AlreadyBackfilledChecker,
  BackfillRunnerService,
} from "./backfill-runner.service";

// reference = KST 2026-06-11(목) 한낮 — backfill-plan.spec 과 동일 fixture(결정론).
const reference = new Date("2026-06-11T03:00:00Z");

// triggerCollection mock — 반환값(CollectionTriggerSummary)은 runner 가 소비하지 않으므로
// 최소 형태로 채운다. reject 시나리오는 개별 test 가 mockRejectedValue 로 변형.
function makeTriggerSpy(
  impl?: (dto: { personId: string; periodStart?: string }) => Promise<unknown>,
): jest.Mock {
  return jest.fn(
    impl ??
      (async (dto) => ({
        assessmentId: "a-1",
        personId: dto.personId,
        since: null,
        period: "week",
        scope: "aggregate",
        periodStart: dto.periodStart ?? "",
        contributionCount: 0,
      })),
  );
}

// makeService — mock CollectionTriggerService + (선택) idempotency 판정자 주입한 runner.
function makeService(
  opts: {
    triggerSpy?: jest.Mock;
    checker?: AlreadyBackfilledChecker;
  } = {},
): { service: BackfillRunnerService; triggerSpy: jest.Mock } {
  const triggerSpy = opts.triggerSpy ?? makeTriggerSpy();
  const triggerService = {
    triggerCollection: triggerSpy,
  } as unknown as CollectionTriggerService;
  const service = new BackfillRunnerService(triggerService, opts.checker);
  return { service, triggerSpy };
}

describe("BackfillRunnerService.runBackfill — happy-path", () => {
  it("산출된 window 수만큼 triggerCollection 을 호출하고 요약을 반환한다", async () => {
    const { service, triggerSpy } = makeService();
    const result = await service.runBackfill("person-1", reference, 4);

    expect(triggerSpy).toHaveBeenCalledTimes(4);
    expect(result).toEqual({
      personId: "person-1",
      totalWindows: 4,
      triggeredCount: 4,
      skipped: false,
    });
  });

  it("호출 순서가 시간순(가장 오래된 window 의 periodStart 가 첫 호출)이다", async () => {
    const { service, triggerSpy } = makeService();
    await service.runBackfill("person-1", reference, 4);

    const plan = buildBackfillPlan(reference, 4);
    // 각 호출의 periodStart 가 해당 window.start 의 ISO 와 1:1 시간순 일치.
    for (let i = 0; i < plan.length; i += 1) {
      expect(triggerSpy.mock.calls[i][0].periodStart).toBe(
        plan[i].start.toISOString(),
      );
    }
    // 첫 호출이 가장 오래된 window(index 0).
    expect(triggerSpy.mock.calls[0][0].periodStart).toBe(
      plan[0].start.toISOString(),
    );
  });

  it("각 호출의 period='week' / scope='aggregate' / personId 가 박제값이다", async () => {
    const { service, triggerSpy } = makeService();
    await service.runBackfill("person-7", reference, 2);

    for (const call of triggerSpy.mock.calls) {
      expect(call[0].personId).toBe("person-7");
      expect(call[0].period).toBe("week");
      expect(call[0].scope).toBe("aggregate");
    }
  });

  it("weeks 미지정 시 helper 기본값(52)으로 위임한다", async () => {
    const { service, triggerSpy } = makeService();
    const result = await service.runBackfill("person-1", reference);

    expect(triggerSpy).toHaveBeenCalledTimes(52);
    expect(result.totalWindows).toBe(52);
    expect(result.triggeredCount).toBe(52);
  });

  it("reference 미지정 시 현재 시각을 기준으로 plan 을 산출한다", async () => {
    const { service, triggerSpy } = makeService();
    // reference 생략 → new Date() 위임. weeks=1 이라 단일 호출.
    const result = await service.runBackfill("person-1", undefined, 1);

    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(result.triggeredCount).toBe(1);
    // 호출된 periodStart 가 유효 ISO 인지(현재 시각 주 경계).
    expect(() =>
      new Date(triggerSpy.mock.calls[0][0].periodStart).toISOString(),
    ).not.toThrow();
  });
});

describe("BackfillRunnerService.runBackfill — flow/branch (weeks 호출 횟수 분기)", () => {
  it("weeks=1 이면 단일 window → triggerCollection 1회(경계)", async () => {
    const { service, triggerSpy } = makeService();
    const result = await service.runBackfill("person-1", reference, 1);

    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(result.totalWindows).toBe(1);
  });

  it("weeks=10 이면 triggerCollection 10회", async () => {
    const { service, triggerSpy } = makeService();
    const result = await service.runBackfill("person-1", reference, 10);

    expect(triggerSpy).toHaveBeenCalledTimes(10);
    expect(result.triggeredCount).toBe(10);
  });
});

describe("BackfillRunnerService.runBackfill — idempotency 분기", () => {
  it("판정자 true → triggerCollection 0회 호출하고 skip 결과 반환", async () => {
    const checker: AlreadyBackfilledChecker = {
      isAlreadyBackfilled: jest.fn(async () => true),
    };
    const { service, triggerSpy } = makeService({ checker });
    const result = await service.runBackfill("person-1", reference, 4);

    expect(triggerSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      personId: "person-1",
      totalWindows: 0,
      triggeredCount: 0,
      skipped: true,
    });
    expect(checker.isAlreadyBackfilled).toHaveBeenCalledWith("person-1");
  });

  it("판정자 false → 정상 순회(skip 안 함)", async () => {
    const checker: AlreadyBackfilledChecker = {
      isAlreadyBackfilled: jest.fn(async () => false),
    };
    const { service, triggerSpy } = makeService({ checker });
    const result = await service.runBackfill("person-1", reference, 3);

    expect(triggerSpy).toHaveBeenCalledTimes(3);
    expect(result.skipped).toBe(false);
    expect(result.triggeredCount).toBe(3);
  });

  it("판정자 미주입(기본) → skip 안 함(@Optional 기본 false 경로)", async () => {
    const { service, triggerSpy } = makeService(); // checker 미주입
    const result = await service.runBackfill("person-1", reference, 2);

    expect(triggerSpy).toHaveBeenCalledTimes(2);
    expect(result.skipped).toBe(false);
  });
});

describe("BackfillRunnerService.runBackfill — error-path (fail-fast 전파)", () => {
  it("중간 window 의 triggerCollection reject → runBackfill 이 reject(fail-fast)", async () => {
    // 2번째 호출에서 reject. 3개 window 중 1개만 성공한 뒤 전파되어야 한다.
    let count = 0;
    const triggerSpy = makeTriggerSpy(async (dto) => {
      count += 1;
      if (count === 2) {
        throw new Error("collect reject(중간 실패)");
      }
      return { personId: dto.personId };
    });
    const { service } = makeService({ triggerSpy });

    await expect(service.runBackfill("person-1", reference, 3)).rejects.toThrow(
      "collect reject(중간 실패)",
    );
    // fail-fast: 2번째 reject 시점에 중단 — 3번째 호출은 발생하지 않는다.
    expect(triggerSpy).toHaveBeenCalledTimes(2);
  });

  it("첫 window 의 triggerCollection reject(Person 404 류) → 즉시 전파", async () => {
    const triggerSpy = makeTriggerSpy(async () => {
      throw new Error("Person not found(404)");
    });
    const { service } = makeService({ triggerSpy });

    await expect(service.runBackfill("person-x", reference, 5)).rejects.toThrow(
      "Person not found(404)",
    );
    expect(triggerSpy).toHaveBeenCalledTimes(1);
  });

  it("idempotency 판정자가 reject 하면 그 에러를 전파한다", async () => {
    const checker: AlreadyBackfilledChecker = {
      isAlreadyBackfilled: jest.fn(async () => {
        throw new Error("판정 조회 실패");
      }),
    };
    const { service, triggerSpy } = makeService({ checker });

    await expect(service.runBackfill("person-1", reference, 3)).rejects.toThrow(
      "판정 조회 실패",
    );
    // 판정 단계에서 throw → triggerCollection 미호출.
    expect(triggerSpy).not.toHaveBeenCalled();
  });
});

describe("BackfillRunnerService.runBackfill — negative 충분 cover", () => {
  it.each([
    ["0 (경계)", 0],
    ["음수", -3],
    ["소수", 2.5],
    ["NaN", NaN],
    ["521 (상한 초과)", 521],
  ])(
    "비정상 weeks=%s 는 buildBackfillPlan 의 RangeError 를 전파(triggerCollection 미호출)",
    async (_label, weeks) => {
      const { service, triggerSpy } = makeService();
      await expect(
        service.runBackfill("person-1", reference, weeks),
      ).rejects.toThrow(RangeError);
      expect(triggerSpy).not.toHaveBeenCalled();
    },
  );

  it("Invalid Date reference 는 helper 의 TypeError 를 전파(triggerCollection 미호출)", async () => {
    const { service, triggerSpy } = makeService();
    await expect(
      service.runBackfill("person-1", new Date(NaN), 4),
    ).rejects.toThrow(TypeError);
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it("빈 personId 도 helper/trigger 로 그대로 전달된다(형식 검증은 DTO/service 책임)", async () => {
    // runner 자체는 personId 형식을 검증하지 않는다(DTO/AssessmentService 책임, Out of
    // Scope). 빈 문자열이면 triggerCollection 에 그대로 위임되고, 실 service 는 거부하나
    // 본 unit 은 mock 이므로 호출 위임만 단언한다.
    const { service, triggerSpy } = makeService();
    await service.runBackfill("", reference, 1);

    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(triggerSpy.mock.calls[0][0].personId).toBe("");
  });
});
