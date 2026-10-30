// RecentDeletionRunnerService unit test. 수집 · 저장 · 인원 조회는 mock 이고, 실 DB 교체는
// test/e2e 가 검증한다. 좌표 계산 자체는 recent-deletion-coordinates.spec.ts 가 맡는다.
import { ConflictException, NotFoundException } from "@nestjs/common";

import type { EvaluationPersistedRecordsReader } from "../assessment-evaluation/evaluation-persisted-records-reader.service";
import type { PeriodBridgeAdminPersistService } from "../assessment-evaluation/period-bridge-admin-persist.service";
import type { LlmProviderConfigResolver } from "../llm/llm-provider-config-resolver.service";
import { RunStatusService } from "../run-status/run-status.service";
import type { PersonService } from "../user/person.service";

import { RecentDeletionRunnerService } from "./recent-deletion-runner.service";

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

  it("실행 도중 앱이 종료되면 끝난 교체는 유지하고 남은 좌표만 not refreshed 다_n", async () => {
    const { service, persist } = setup();
    let destroyed: Promise<void> = Promise.resolve();
    persist.mockImplementationOnce(() => {
      destroyed = service.onModuleDestroy();
      return Promise.resolve({ created: true });
    });
    await service.startRefresh("p1", 3);
    await settle(service);
    await destroyed;
    expect(service.refreshStatus("p1").result).toMatchObject({
      refreshedCount: 1,
      notRefreshedCount: 2,
      aborted: true,
    });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("거부된 요청은 직전 결과를 지우지 않는다_n", async () => {
    const { service, runStatus, finish } = setup();
    await service.startRefresh("p1", 1);
    const previous = await finish();
    runStatus.begin("evaluation");
    await expect(service.startRefresh("p1", 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(service.refreshStatus("p1").result).toEqual(previous);
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
