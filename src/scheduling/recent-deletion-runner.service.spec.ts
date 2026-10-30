// RecentDeletionRunnerService unit test (CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative 충분 cover). CollectionTriggerService + RecentDeletionDeleter 를 jest mock 으로
// 주입 — 실 삭제·실 수집·실 DB·실 token 0(Q-0022 deferred 정합). 본 runner 의 조립
// (buildRecentDeletionPlan 위임)·삭제 위임·재수집 결선·분기·error 전파(fail-fast)만
// 검증한다. buildRecentDeletionPlan 자체의 경계/필터 정확성은 recent-deletion-plan.spec.ts
// 가 cover — 본 spec 은 runner 의 결선만.
import { ConflictException, NotFoundException } from "@nestjs/common";

import type { CollectionTriggerService } from "../assessment-collection/collection-trigger.service";
import type { EvaluationPersistedRecordsReader } from "../assessment-evaluation/evaluation-persisted-records-reader.service";
import type { PeriodBridgeAdminPersistService } from "../assessment-evaluation/period-bridge-admin-persist.service";
import type { LlmProviderConfigResolver } from "../llm/llm-provider-config-resolver.service";
import { RunStatusService } from "../run-status/run-status.service";
import type { PersonService } from "../user/person.service";

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
  const service = new RecentDeletionRunnerService(
    triggerService,
    {} as LlmProviderConfigResolver,
    {} as PersonService,
    {} as EvaluationPersistedRecordsReader,
    {} as PeriodBridgeAdminPersistService,
    {} as RunStatusService,
    opts.deleter,
  );
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

// startRefresh 는 기다리지 않는 실행을 남기므로 끝날 때까지 이벤트 루프를 돌린다.
async function settle(service: RecentDeletionRunnerService): Promise<void> {
  for (let i = 0; i < 100 && service.refreshStatus("p1").running; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe("RecentDeletionRunnerService — 최근 N일 재수집", () => {
  // 2026-06-11(목) 12:00 KST. days=1 창은 06-10 하루다.
  const NOW = new Date("2026-06-11T03:00:00Z");
  const YESTERDAY = new Date("2026-06-10T00:00:00+09:00");
  const TODAY = new Date("2026-06-11T00:00:00+09:00");
  const person = {
    id: "p1",
    serviceIdentities: [{ service: "github", externalId: "kim" }],
  };

  function setup(rows: unknown[] = []) {
    const runStatus = new RunStatusService();
    const persist = jest.fn().mockResolvedValue({ created: true });
    const resolve = jest.fn().mockResolvedValue("model-1");
    const findPerson = jest.fn().mockResolvedValue(person);
    const read = jest.fn().mockResolvedValue(rows);
    const service = new RecentDeletionRunnerService(
      {} as CollectionTriggerService,
      {
        resolveDefaultModelId: resolve,
      } as unknown as LlmProviderConfigResolver,
      { findByIdWithIdentities: findPerson } as unknown as PersonService,
      { readForPersons: read } as unknown as EvaluationPersistedRecordsReader,
      {
        generateAndPersistIfCollected: persist,
      } as unknown as PeriodBridgeAdminPersistService,
      runStatus,
    );
    const finish = async () => {
      await settle(service);
      return service.refreshStatus("p1").result;
    };
    // 다음 실행을 모델 조회에서 붙잡아 "실행 중" 상태를 결정적으로 만든다.
    const holdNextRun = (): (() => void) => {
      let release = (): void => undefined;
      resolve.mockReturnValueOnce(
        new Promise((done) => {
          release = () => done("model-1");
        }),
      );
      return () => release();
    };
    return {
      service,
      runStatus,
      persist,
      resolve,
      findPerson,
      read,
      finish,
      holdNextRun,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const row = (periodStart: Date, period = "day", scope = "aggregate") => ({
    personId: "p1",
    period,
    scope,
    periodStart,
  });

  it("좌표를 reeval 로 다시 평가하고 삭제 · 교체 건수를 알린다", async () => {
    const { service, persist, runStatus, read, finish } = setup([
      row(YESTERDAY),
    ]);
    const started = await service.startRefresh("p1", 1);
    expect(started).toMatchObject({ personId: "p1", running: true });
    expect(await finish()).toMatchObject({
      deletedCount: 1,
      refreshedCount: 1,
      notRefreshedCount: 0,
      aborted: false,
    });
    expect(read).toHaveBeenCalledWith(["p1"]);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith(
      person,
      { since: YESTERDAY.toISOString(), until: TODAY.toISOString() },
      { modelId: "model-1" },
      {
        personId: "p1",
        period: "day",
        scope: "aggregate",
        periodStart: YESTERDAY,
      },
      true,
    );
    expect(runStatus.snapshot().evaluation.active).toBe(false);
  });

  it("수집이 불완전한 좌표는 not refreshed 이고 삭제로 세지 않는다_n", async () => {
    const { service, persist, finish } = setup([row(YESTERDAY)]);
    persist.mockResolvedValue(null);
    await service.startRefresh("p1", 1);
    expect(await finish()).toMatchObject({
      deletedCount: 0,
      refreshedCount: 0,
      notRefreshedCount: 1,
      aborted: false,
    });
  });

  it("실행 중 재호출과 다른 인원 호출은 409 이고 실행을 늘리지 않는다_n", async () => {
    const { service, runStatus, finish, holdNextRun } = setup();
    const release = holdNextRun();
    await service.startRefresh("p1", 1);
    await expect(service.startRefresh("p1", 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.startRefresh("p2", 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(runStatus.snapshot().evaluation.runningCount).toBe(1);
    release();
    await finish();
  });

  it("저장본 없던 좌표는 refreshed 로만 센다", async () => {
    const { service, finish } = setup();
    await service.startRefresh("p1", 1);
    expect(await finish()).toMatchObject({
      deletedCount: 0,
      refreshedCount: 1,
    });
  });

  it("days 미지정은 1 일이다", async () => {
    const { service, persist, finish } = setup();
    await service.startRefresh("p1");
    await finish();
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("좌표 하나의 실패 · 경합은 그 좌표만 포기하고 나머지를 계속한다_n", async () => {
    const { service, persist, finish } = setup();
    persist
      .mockRejectedValueOnce(new ConflictException("경합"))
      .mockRejectedValueOnce("LLM 장애")
      .mockResolvedValue({ created: true });
    await service.startRefresh("p1", 3);
    expect(await finish()).toMatchObject({
      refreshedCount: 1,
      notRefreshedCount: 2,
      aborted: false,
    });
  });

  it("식별자가 없으면 저장을 시도하지 않는다_n", async () => {
    const { service, persist, findPerson, finish } = setup([row(YESTERDAY)]);
    findPerson.mockResolvedValue({ ...person, serviceIdentities: [] });
    await service.startRefresh("p1", 1);
    expect(await finish()).toMatchObject({
      deletedCount: 0,
      refreshedCount: 0,
      notRefreshedCount: 1,
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("창 밖 row 는 건드리지 않는다_n", async () => {
    const { service, persist, finish } = setup([
      row(TODAY),
      row(new Date("2026-06-09T00:00:00+09:00")),
    ]);
    await service.startRefresh("p1", 1);
    expect(await finish()).toMatchObject({ deletedCount: 0 });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][3].periodStart).toEqual(YESTERDAY);
  });

  it("창 안의 진행 중 row 는 not refreshed 로 세고 저장하지 않는다_n", async () => {
    const { service, persist, finish } = setup([
      row(new Date("2026-06-08T00:00:00+09:00"), "week"),
    ]);
    await service.startRefresh("p1", 4);
    expect(await finish()).toMatchObject({ notRefreshedCount: 1 });
    expect(
      persist.mock.calls.some(([, , , context]) => context.period === "week"),
    ).toBe(false);
  });

  it("모델 조회 실패는 아무것도 저장하지 않고 aborted 다_n", async () => {
    const { service, persist, resolve, runStatus, finish } = setup();
    resolve.mockRejectedValue(new Error("no default provider"));
    await service.startRefresh("p1", 1);
    expect(await finish()).toMatchObject({ refreshedCount: 0, aborted: true });
    expect(persist).not.toHaveBeenCalled();
    expect(runStatus.snapshot().evaluation.active).toBe(false);
  });

  it("앱 종료 시 남은 좌표를 not refreshed 로 두고 멈춘다_n", async () => {
    const { service, persist, holdNextRun } = setup();
    const release = holdNextRun();
    await service.startRefresh("p1", 3);
    const destroyed = service.onModuleDestroy();
    release();
    await destroyed;
    expect(service.refreshStatus("p1").result).toMatchObject({
      notRefreshedCount: 3,
      aborted: true,
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("tick 등 다른 평가 실행 중이면 409 다_n", async () => {
    const { service, runStatus, persist } = setup();
    runStatus.begin("evaluation");
    await expect(service.startRefresh("p1", 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(persist).not.toHaveBeenCalled();
    expect(runStatus.snapshot().evaluation.runningCount).toBe(1);
  });

  it("인원 부재 404 · days 범위 위반은 실행을 시작하지 않는다_n", async () => {
    const { service, findPerson, runStatus } = setup();
    await expect(service.startRefresh("p1", 400)).rejects.toBeInstanceOf(
      RangeError,
    );
    findPerson.mockRejectedValue(new NotFoundException());
    await expect(service.startRefresh("x", 1)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(runStatus.snapshot().evaluation.active).toBe(false);
  });

  it("상태 조회는 인원별이고 새 실행은 이전 결과를 지운다", async () => {
    const { service, finish, holdNextRun } = setup();
    expect(service.refreshStatus("p1")).toEqual({
      personId: "p1",
      running: false,
      result: null,
    });
    const release = holdNextRun();
    await service.startRefresh("p1", 1);
    expect(service.refreshStatus("p1").running).toBe(true);
    expect(service.refreshStatus("p2").running).toBe(false);
    release();
    await finish();
    expect(service.refreshStatus("p1").result).not.toBeNull();
    const releaseSecond = holdNextRun();
    await service.startRefresh("p1", 1);
    expect(service.refreshStatus("p1").result).toBeNull();
    expect(service.refreshStatus("p1").running).toBe(true);
    releaseSecond();
    await finish();
  });

  it("앱 종료 중에는 새 실행을 시작하지 않는다_n", async () => {
    const { service, runStatus } = setup();
    await service.onModuleDestroy();
    await expect(service.startRefresh("p1", 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(runStatus.snapshot().evaluation.active).toBe(false);
  });
});
