// RecentDeletionRunnerService unit test (CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative 충분 cover). CollectionTriggerService + RecentDeletionDeleter 를 jest mock 으로
// 주입 — 실 삭제·실 수집·실 DB·실 token 0(Q-0022 deferred 정합). 본 runner 의 조립
// (buildRecentDeletionPlan 위임)·삭제 위임·재수집 결선·분기·error 전파(fail-fast)만
// 검증한다. buildRecentDeletionPlan 자체의 경계/필터 정확성은 recent-deletion-plan.spec.ts
// 가 cover — 본 spec 은 runner 의 결선만.
import type { CollectionTriggerService } from "../assessment-collection/collection-trigger.service";

import { buildRecentDeletionPlan } from "./recent-deletion-plan";
import {
  RecentDeletionDeleter,
  RecentDeletionRunnerService,
} from "./recent-deletion-runner.service";

// reference = KST 2026-06-11(목) 한낮 — 결정론 fixture. 본 reference 가 속한 KST 일은
// 2026-06-11 이므로 days=1 window = [2026-06-11 00:00 KST, 2026-06-12 00:00 KST).
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
        period: "day",
        scope: "aggregate",
        periodStart: dto.periodStart ?? "",
        contributionCount: 0,
      })),
  );
}

// makeService — mock CollectionTriggerService + (선택) deleter 주입한 runner.
function makeService(
  opts: {
    triggerSpy?: jest.Mock;
    deleter?: RecentDeletionDeleter;
  } = {},
): { service: RecentDeletionRunnerService; triggerSpy: jest.Mock } {
  const triggerSpy = opts.triggerSpy ?? makeTriggerSpy();
  const triggerService = {
    triggerCollection: triggerSpy,
  } as unknown as CollectionTriggerService;
  const service = new RecentDeletionRunnerService(triggerService, opts.deleter);
  return { service, triggerSpy };
}

// makeDeleterSpy — deleteInstants mock. 기본은 받은 instant 수를 삭제 수로 반환.
function makeDeleterSpy(
  impl?: (personId: string, instants: ReadonlyArray<Date>) => Promise<number>,
): jest.Mock {
  return jest.fn(
    impl ??
      (async (_personId, instants: ReadonlyArray<Date>) => instants.length),
  );
}

// window 안의 instant 2개 + 밖의 instant 1개를 섞은 후보. days=1 window 기준.
const inWindowA = new Date("2026-06-11T05:00:00Z"); // KST 14:00 11일 → window 안
const outOfWindow = new Date("2026-05-01T00:00:00Z"); // 한참 과거 → window 밖

describe("RecentDeletionRunnerService.runRecentDeletion — happy-path", () => {
  it("toDelete 가 있으면 deleteInstants 를 plan.toDelete 와 동일 집합으로 1회 호출한다", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service } = makeService({ deleter });
    const instants = [inWindowA, outOfWindow];

    await service.runRecentDeletion("person-1", instants, reference, 1);

    const plan = buildRecentDeletionPlan(reference, 1, instants);
    expect(deleter.deleteInstants).toHaveBeenCalledTimes(1);
    expect(deleter.deleteInstants).toHaveBeenCalledWith(
      "person-1",
      plan.toDelete,
    );
    // plan.toDelete 는 window 안 instant 만 — outOfWindow 는 제외(보존).
    expect(plan.toDelete).toContainEqual(inWindowA);
    expect(plan.toDelete).not.toContainEqual(outOfWindow);
  });

  it("삭제 후 triggerCollection 을 window.start ISO / day / aggregate 로 1회 호출한다", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service, triggerSpy } = makeService({ deleter });
    const instants = [inWindowA];

    await service.runRecentDeletion("person-1", instants, reference, 1);

    const plan = buildRecentDeletionPlan(reference, 1, instants);
    expect(triggerSpy).toHaveBeenCalledTimes(1);
    expect(triggerSpy.mock.calls[0][0]).toEqual({
      personId: "person-1",
      period: "day",
      scope: "aggregate",
      periodStart: plan.window.start.toISOString(),
    });
  });

  it("deletedCount(=deleter 반환) / recollected=true 요약을 반환한다", async () => {
    const deleter = { deleteInstants: makeDeleterSpy(async () => 3) };
    const { service } = makeService({ deleter });

    const result = await service.runRecentDeletion(
      "person-9",
      [inWindowA],
      reference,
      1,
    );

    expect(result).toEqual({
      personId: "person-9",
      deletedCount: 3,
      recollected: true,
    });
  });

  it("삭제가 재수집보다 먼저 호출된다(순서 — delete → 재수집)", async () => {
    const order: string[] = [];
    const deleter = {
      deleteInstants: jest.fn(async () => {
        order.push("delete");
        return 1;
      }),
    };
    const triggerSpy = makeTriggerSpy(async (dto) => {
      order.push("recollect");
      return { personId: dto.personId };
    });
    const { service } = makeService({ deleter, triggerSpy });

    await service.runRecentDeletion("person-1", [inWindowA], reference, 1);

    expect(order).toEqual(["delete", "recollect"]);
  });
});

describe("RecentDeletionRunnerService.runRecentDeletion — flow/branch", () => {
  it("toDelete 빈 케이스(전부 window 밖) → deleter·trigger 0회 + no-op 요약", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service, triggerSpy } = makeService({ deleter });

    const result = await service.runRecentDeletion(
      "person-1",
      [outOfWindow],
      reference,
      1,
    );

    expect(deleter.deleteInstants).not.toHaveBeenCalled();
    expect(triggerSpy).not.toHaveBeenCalled();
    expect(result).toEqual({
      personId: "person-1",
      deletedCount: 0,
      recollected: false,
    });
  });

  it("빈 instants 배열 → no-op(정상, error 아님)", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service, triggerSpy } = makeService({ deleter });

    const result = await service.runRecentDeletion(
      "person-1",
      [],
      reference,
      1,
    );

    expect(deleter.deleteInstants).not.toHaveBeenCalled();
    expect(triggerSpy).not.toHaveBeenCalled();
    expect(result.recollected).toBe(false);
    expect(result.deletedCount).toBe(0);
  });

  it("deleter 미주입(기본=삭제 0) → 삭제 0 + 재수집은 정상 호출", async () => {
    // toDelete 가 있어도 deleter 미주입이면 deletedCount=0, 단 toDelete 비지 않았으므로
    // 재수집은 호출된다(recollected=true).
    const { service, triggerSpy } = makeService(); // deleter 미주입

    const result = await service.runRecentDeletion(
      "person-1",
      [inWindowA],
      reference,
      1,
    );

    expect(result.deletedCount).toBe(0);
    expect(result.recollected).toBe(true);
    expect(triggerSpy).toHaveBeenCalledTimes(1);
  });

  it("days 명시(30) 경로 — 더 넓은 window 로 더 많은 instant 가 toDelete 에 든다", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service } = makeService({ deleter });
    // outOfWindow(2026-05-01)는 days=1 에선 밖이지만 days=30 (2026-06-11 기준 5월 중순부터)
    // 에선 여전히 밖일 수 있어, days=60 으로 명시해 포함시킨다.
    const instants = [inWindowA, outOfWindow];

    await service.runRecentDeletion("person-1", instants, reference, 60);

    const plan = buildRecentDeletionPlan(reference, 60, instants);
    expect(deleter.deleteInstants).toHaveBeenCalledWith(
      "person-1",
      plan.toDelete,
    );
    expect(plan.toDelete).toContainEqual(outOfWindow);
  });

  it("days 기본값(미지정=1) 경로 — helper DEFAULT_DAYS 위임", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service } = makeService({ deleter });
    const instants = [inWindowA, outOfWindow];

    // days 생략 → 기본 1. outOfWindow 는 제외, inWindowA 만 삭제 대상.
    const result = await service.runRecentDeletion(
      "person-1",
      instants,
      reference,
    );

    const plan = buildRecentDeletionPlan(reference, 1, instants);
    expect(deleter.deleteInstants).toHaveBeenCalledWith(
      "person-1",
      plan.toDelete,
    );
    expect(result.recollected).toBe(true);
  });

  it("reference 미지정 시 현재 시각 기준으로 plan 산출(window.start ISO 유효)", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service, triggerSpy } = makeService({ deleter });
    // 현재 시각 기준 days=1 window 안에 드는 instant 를 만들기 위해 now 를 그대로 후보로.
    const now = new Date();
    const result = await service.runRecentDeletion("person-1", [now], now, 1);

    // now 가 속한 KST 일은 window [start, end) 안 → 삭제 대상.
    expect(result.recollected).toBe(true);
    expect(() =>
      new Date(triggerSpy.mock.calls[0][0].periodStart).toISOString(),
    ).not.toThrow();
  });
});

describe("RecentDeletionRunnerService.runRecentDeletion — error-path (fail-fast 전파)", () => {
  it("deleteInstants reject → 전파하고 재수집 미호출", async () => {
    const deleter = {
      deleteInstants: jest.fn(async () => {
        throw new Error("삭제 실패");
      }),
    };
    const { service, triggerSpy } = makeService({ deleter });

    await expect(
      service.runRecentDeletion("person-1", [inWindowA], reference, 1),
    ).rejects.toThrow("삭제 실패");
    // fail-fast: 삭제 reject 시점에 중단 — 재수집은 발생하지 않는다.
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it("triggerCollection reject → 전파(삭제는 발생, 재수집 실패 표면화)", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const triggerSpy = makeTriggerSpy(async () => {
      throw new Error("collect reject(404)");
    });
    const { service } = makeService({ deleter, triggerSpy });

    await expect(
      service.runRecentDeletion("person-1", [inWindowA], reference, 1),
    ).rejects.toThrow("collect reject(404)");
    // 삭제는 이미 호출됨(부분 상태) — 호출자가 실패를 인지하고 재시도/조사.
    expect(deleter.deleteInstants).toHaveBeenCalledTimes(1);
  });
});

describe("RecentDeletionRunnerService.runRecentDeletion — negative 충분 cover", () => {
  it.each([
    ["0 (경계)", 0],
    ["음수", -3],
    ["소수", 2.5],
    ["NaN", NaN],
    ["367 (상한 초과)", 367],
  ])(
    "비정상 days=%s 는 buildRecentDeletionWindow 의 RangeError 를 전파(삭제·재수집 미호출)",
    async (_label, days) => {
      const deleter = { deleteInstants: makeDeleterSpy() };
      const { service, triggerSpy } = makeService({ deleter });

      await expect(
        service.runRecentDeletion("person-1", [inWindowA], reference, days),
      ).rejects.toThrow(RangeError);
      expect(deleter.deleteInstants).not.toHaveBeenCalled();
      expect(triggerSpy).not.toHaveBeenCalled();
    },
  );

  it("Invalid Date reference 는 helper 의 TypeError 를 전파(삭제·재수집 미호출)", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service, triggerSpy } = makeService({ deleter });

    await expect(
      service.runRecentDeletion("person-1", [inWindowA], new Date(NaN), 1),
    ).rejects.toThrow(TypeError);
    expect(deleter.deleteInstants).not.toHaveBeenCalled();
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it("instants 에 Invalid Date 원소 → selectInDeletionWindow 의 TypeError 전파", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service, triggerSpy } = makeService({ deleter });

    await expect(
      service.runRecentDeletion(
        "person-1",
        [inWindowA, new Date(NaN)],
        reference,
        1,
      ),
    ).rejects.toThrow(TypeError);
    expect(deleter.deleteInstants).not.toHaveBeenCalled();
    expect(triggerSpy).not.toHaveBeenCalled();
  });

  it("instants 비-배열 → helper 의 TypeError 전파", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service } = makeService({ deleter });

    await expect(
      service.runRecentDeletion(
        "person-1",
        "not-an-array" as unknown as ReadonlyArray<Date>,
        reference,
        1,
      ),
    ).rejects.toThrow(TypeError);
    expect(deleter.deleteInstants).not.toHaveBeenCalled();
  });

  it("빈 personId 도 helper/deleter/trigger 로 그대로 전달(형식 검증은 DTO/service 책임)", async () => {
    // runner 자체는 personId 형식을 검증하지 않는다(DTO/AssessmentService 책임, Out of
    // Scope). 빈 문자열이면 deleter/triggerCollection 에 그대로 위임된다.
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service, triggerSpy } = makeService({ deleter });

    const result = await service.runRecentDeletion(
      "",
      [inWindowA],
      reference,
      1,
    );

    expect(deleter.deleteInstants).toHaveBeenCalledWith("", expect.any(Array));
    expect(triggerSpy.mock.calls[0][0].personId).toBe("");
    expect(result.personId).toBe("");
  });

  it("window 경계 instant — start 포함(삭제), end 배타(보존)", async () => {
    const deleter = { deleteInstants: makeDeleterSpy() };
    const { service } = makeService({ deleter });
    const plan0 = buildRecentDeletionPlan(reference, 1, []);
    const startInstant = plan0.window.start; // 포함 → 삭제
    const endInstant = plan0.window.end; // 배타 → 보존

    await service.runRecentDeletion(
      "person-1",
      [startInstant, endInstant],
      reference,
      1,
    );

    const plan = buildRecentDeletionPlan(reference, 1, [
      startInstant,
      endInstant,
    ]);
    expect(plan.toDelete).toContainEqual(startInstant);
    expect(plan.toDelete).not.toContainEqual(endInstant);
    expect(deleter.deleteInstants).toHaveBeenCalledWith(
      "person-1",
      plan.toDelete,
    );
  });
});
