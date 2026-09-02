// run-status.controller.spec.ts — `GET /api/run-status` 조회 route 검증
// (T-1846, ADR-0060 §Follow-ups (b)).
//
// 책임: controller 가 §Decision 2 의 응답 계약을 **service 에게 온전히 위임** 한다는 사실과
// §Decision 3 의 `User+` 경계가 guard metadata 로 고정돼 있다는 사실을 박제한다.
//
// R-112 충족 매핑:
//  - happy-path: 비실행 상태에서 handler 가 `active: false` · 두 축 runningCount 0 ·
//    startedAt null · observedAt 문자열을 반환하고, snapshot() 이 정확히 1 회 호출되며
//    반환값이 service 반환값과 동일 참조다.
//  - error path: snapshot() 이 throw 하면 handler 가 삼키지 않고 raw 전파한다
//    (기본값 대체 · 200 위장 없음).
//  - flow / branch: `active` 토글 양쪽을 축 조합 4 종(평가만 · 수집만 · 동시 · 둘 다 비실행)
//    으로 cover 하고 각 경우 §Decision 2 불변식 2 종을 단언한다.
//  - negative cases 충분 cover: (a) 키 집합 완전 일치(가공 0) · (b) 연속 2 회 호출의
//    observedAt 이 서로 다르고 캐시되지 않음 · (c) 조회가 begin · end 를 한 번도 부르지
//    않음(부수효과 0) · (d) route metadata(path · method) · (e) guard stack 2 종 부착 ·
//    (f) @Roles tier 가 정확히 ["User"](Admin 상향 회귀 차단).
import { RequestMethod } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Test, type TestingModule } from "@nestjs/testing";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLES_METADATA_KEY } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { RunStatusController } from "./run-status.controller";
import { RunStatusService, type RunStatusSnapshot } from "./run-status.service";

/** 비실행 상태의 응답 fixture — happy-path 와 negative (a) 가 공유한다. */
function idleSnapshot(
  observedAt = "2026-09-02T00:00:00.000Z",
): RunStatusSnapshot {
  return {
    active: false,
    evaluation: { active: false, runningCount: 0, startedAt: null },
    collection: { active: false, runningCount: 0, startedAt: null },
    observedAt,
  };
}

describe("RunStatusController (위임 동작)", () => {
  let controller: RunStatusController;
  let serviceMock: { snapshot: jest.Mock; begin: jest.Mock; end: jest.Mock };

  beforeEach(async () => {
    // service 는 mock 으로 교체한다 — controller 가 "무엇을 계산하는가" 가 아니라
    // "service 결과를 그대로 흘려보내는가" 만이 본 spec 의 검증 대상이기 때문이다.
    serviceMock = {
      snapshot: jest.fn(),
      begin: jest.fn(),
      end: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RunStatusController],
      providers: [{ provide: RunStatusService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(RunStatusController);
  });

  // happy-path: 비실행 상태의 응답 shape + 위임 횟수 + 동일 참조.
  it("happy-path: 비실행 상태 snapshot 을 가공 없이 그대로 반환하고 snapshot() 을 1 회만 호출한다", () => {
    const expected = idleSnapshot();
    serviceMock.snapshot.mockReturnValue(expected);

    const result = controller.status();

    expect(serviceMock.snapshot).toHaveBeenCalledTimes(1);
    expect(serviceMock.snapshot).toHaveBeenCalledWith();
    // 동일 참조 — 복제 · 재조립을 하지 않는다.
    expect(result).toBe(expected);
    // 동일 내용 — §Decision 2 의 비실행 상태 계약.
    expect(result.active).toBe(false);
    expect(result.evaluation).toEqual({
      active: false,
      runningCount: 0,
      startedAt: null,
    });
    expect(result.collection).toEqual({
      active: false,
      runningCount: 0,
      startedAt: null,
    });
    expect(typeof result.observedAt).toBe("string");
  });

  // error path: service 예외의 raw 전파. 삼키고 기본값을 내면 배너가 조용히 꺼져
  // ADR-0060 §Consequences (a) 의 false-success 오독을 만든다.
  it("error path: snapshot() 이 throw 하면 예외를 삼키지 않고 그대로 전파한다", () => {
    const boom = new Error("snapshot 실패");
    serviceMock.snapshot.mockImplementation(() => {
      throw boom;
    });

    expect(() => controller.status()).toThrow(boom);
    expect(serviceMock.snapshot).toHaveBeenCalledTimes(1);
  });

  // negative (a): 키 집합 완전 일치 — 필드 삭제 · 추가 · 변형 0.
  it("negative (a): 응답의 키 집합이 service 반환값과 완전히 일치한다 (필드 추가 · 삭제 0)", () => {
    const expected = idleSnapshot();
    serviceMock.snapshot.mockReturnValue(expected);

    const result = controller.status();

    expect(Object.keys(result).sort()).toEqual(
      ["active", "collection", "evaluation", "observedAt"].sort(),
    );
    expect(Object.keys(result.evaluation).sort()).toEqual(
      ["active", "runningCount", "startedAt"].sort(),
    );
    expect(Object.keys(result.collection).sort()).toEqual(
      ["active", "runningCount", "startedAt"].sort(),
    );
    expect(result).toEqual(expected);
  });

  // negative (b): 연속 2 회 호출이 서로 다른 observedAt 을 그대로 흘려보낸다 (캐시 0).
  it("negative (b): 연속 2 회 호출이 캐시 없이 매번 새 snapshot 을 반환한다", () => {
    const first = idleSnapshot("2026-09-02T00:00:00.000Z");
    const second = idleSnapshot("2026-09-02T00:00:05.000Z");
    serviceMock.snapshot.mockReturnValueOnce(first).mockReturnValueOnce(second);

    const a = controller.status();
    const b = controller.status();

    expect(serviceMock.snapshot).toHaveBeenCalledTimes(2);
    expect(a).toBe(first);
    expect(b).toBe(second);
    expect(a.observedAt).not.toBe(b.observedAt);
  });

  // negative (c): 조회는 상태를 바꾸지 않는다 — begin · end 호출 0.
  it("negative (c): 조회 handler 가 begin · end 를 한 번도 호출하지 않는다 (부수효과 0)", () => {
    serviceMock.snapshot.mockReturnValue(idleSnapshot());

    controller.status();
    controller.status();

    expect(serviceMock.begin).not.toHaveBeenCalled();
    expect(serviceMock.end).not.toHaveBeenCalled();
  });
});

describe("RunStatusController (축 조합 분기 — 실제 RunStatusService 연동)", () => {
  let controller: RunStatusController;
  let service: RunStatusService;

  beforeEach(async () => {
    // 분기 축은 mock 이 아니라 **실제 service** 로 돌린다 — §Decision 2 의 불변식이
    // controller 를 통과한 뒤에도 성립하는지가 검증 대상이기 때문이다.
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [RunStatusController],
      providers: [RunStatusService],
    }).compile();

    controller = moduleRef.get(RunStatusController);
    service = moduleRef.get(RunStatusService);
  });

  /** §Decision 2 불변식 2 종 — 응답 전역 active 와 축별 active. */
  function expectInvariants(snapshot: RunStatusSnapshot): void {
    expect(snapshot.active).toBe(
      snapshot.evaluation.active || snapshot.collection.active,
    );
    expect(snapshot.evaluation.active).toBe(
      snapshot.evaluation.runningCount > 0,
    );
    expect(snapshot.collection.active).toBe(
      snapshot.collection.runningCount > 0,
    );
  }

  // 분기 (1): 평가 축만 실행 중.
  it("분기 (1): 평가 축만 실행 중이면 active 가 true 이고 수집 축은 비실행이다", () => {
    service.begin("evaluation");

    const result = controller.status();

    expect(result.active).toBe(true);
    expect(result.evaluation.runningCount).toBe(1);
    expect(result.evaluation.startedAt).not.toBeNull();
    expect(result.collection.active).toBe(false);
    expect(result.collection.startedAt).toBeNull();
    expectInvariants(result);
  });

  // 분기 (2): 수집 축만 실행 중.
  it("분기 (2): 수집 축만 실행 중이면 active 가 true 이고 평가 축은 비실행이다", () => {
    service.begin("collection");

    const result = controller.status();

    expect(result.active).toBe(true);
    expect(result.collection.runningCount).toBe(1);
    expect(result.collection.startedAt).not.toBeNull();
    expect(result.evaluation.active).toBe(false);
    expect(result.evaluation.startedAt).toBeNull();
    expectInvariants(result);
  });

  // 분기 (3): 두 축 동시 실행.
  it("분기 (3): 두 축이 동시에 실행 중이면 두 축 모두 active 이고 전역 active 도 true 다", () => {
    service.begin("evaluation");
    service.begin("collection");
    service.begin("collection");

    const result = controller.status();

    expect(result.active).toBe(true);
    expect(result.evaluation.runningCount).toBe(1);
    expect(result.collection.runningCount).toBe(2);
    expectInvariants(result);
  });

  // 분기 (4): 둘 다 비실행 (begin 후 end 로 되돌린 경로 — 카운터가 실제로 0 으로 닫힌다).
  it("분기 (4): 두 축 모두 비실행이면 active 가 false 이고 startedAt 이 둘 다 null 이다", () => {
    service.begin("evaluation");
    service.begin("collection");
    service.end("evaluation");
    service.end("collection");

    const result = controller.status();

    expect(result.active).toBe(false);
    expect(result.evaluation.runningCount).toBe(0);
    expect(result.collection.runningCount).toBe(0);
    expect(result.evaluation.startedAt).toBeNull();
    expect(result.collection.startedAt).toBeNull();
    expectInvariants(result);
  });
});

describe("RunStatusController (route · guard metadata)", () => {
  // negative (d) 전반: base path 가 `api/run-status` 로 고정 (§Decision 2 path 행).
  it("negative (d-1): base path 가 api/run-status 이다", () => {
    const path = Reflect.getMetadata("path", RunStatusController) as
      | string
      | undefined;

    expect(path).toBe("api/run-status");
  });

  // negative (d) 후반: handler 가 GET 이며 하위 경로 없이 base path 에 직접 박혀 있다.
  it("negative (d-2): status handler 가 GET '' 로 박혀 있다", () => {
    expect(
      Reflect.getMetadata("method", RunStatusController.prototype.status),
    ).toBe(RequestMethod.GET);
    expect(
      Reflect.getMetadata("path", RunStatusController.prototype.status),
    ).toBe("/");
  });

  // negative (e): guard stack 이 JwtAuthGuard(401) → RolesGuard(403) 순으로 부착.
  // 미인증 401 · tier 미달 403 경계가 guard 위임임을 고정한다.
  it("negative (e): handler 에 @UseGuards(JwtAuthGuard, RolesGuard) 가 이 순서로 부착돼 있다", () => {
    expect(
      Reflect.getMetadata("__guards__", RunStatusController.prototype.status),
    ).toEqual([JwtAuthGuard, RolesGuard]);
  });

  // negative (f): @Roles tier 가 정확히 ["User"] — Admin 상향 회귀 차단
  // (§Decision 3 · Alternatives 의 "@Roles('Admin') 으로 제한" 미채택 근거).
  it('negative (f): @Roles metadata 가 정확히 ["User"] 이다 (Admin 상향 회귀 차단)', () => {
    const reflector = new Reflector();

    expect(
      reflector.get<string[]>(
        ROLES_METADATA_KEY,
        RunStatusController.prototype.status,
      ),
    ).toEqual(["User"]);
  });

  // negative (f) 보강: controller class 레벨에는 guard · roles metadata 가 없다
  // (권한 경계가 handler 한 곳에만 선언돼 이중 정의로 갈라지지 않음).
  it("negative (f-2): controller class 레벨에는 guard · roles metadata 가 부착돼 있지 않다", () => {
    expect(
      Reflect.getMetadata("__guards__", RunStatusController),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(ROLES_METADATA_KEY, RunStatusController),
    ).toBeUndefined();
  });
});
