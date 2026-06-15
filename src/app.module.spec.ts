// app.module.spec.ts — AppModule root wiring 검증 (T-0412, ADR-0042 §Decision 2).
//
// 책임: ScheduleModule.forRoot() 를 AppModule 에 import 한 뒤 SchedulerRegistry 가
// 전역 주입 가능해졌는지(= 후속 ③ 동적 cron service 의 선행 조건)를 박제한다.
//
// R-112 충족 매핑:
//  - happy-path: AppModule 이 정상 컴파일되고 SchedulerRegistry 인스턴스가 주입된다.
//  - error path / negative: SchedulerRegistry 주입 결과가 undefined 가 아님(ScheduleModule
//    미import 시 NestJS 가 주입 실패하므로 본 단언이 wiring 누락을 catch) + 빈 registry 로
//    시작(부팅 직후 동적 cron job 0)이라는 경계 계약 단언.
//  - flow / branch: 본 task 는 선언적 import 1줄로 분기 코드를 추가하지 않으므로
//    "분기 없음 — flow/branch 항목은 부팅 직후 빈 registry 상태 단언으로 갈음".
//  - negative cases 충분 cover: 부팅 시 동적 등록 job 부재(getCronJobs().size === 0,
//    getIntervals().length === 0, getTimeouts().length === 0)로 후속 ③ 가 의존하는
//    초기 빈-registry 계약을 박제.
import { SchedulerRegistry } from "@nestjs/schedule";
import { Test, type TestingModule } from "@nestjs/testing";

import { AppModule } from "./app.module";
import {
  CRON_TICK_HANDLER,
  CronScheduleController,
} from "./scheduling/cron-schedule.controller";
import { CronScheduleService } from "./scheduling/cron-schedule.service";

describe("AppModule (T-0412 ScheduleModule wiring)", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    // imports: [AppModule] 로 root DI 그래프 전체를 컴파일. ScheduleModule.forRoot()
    // 이 빠지면 SchedulerRegistry provider 가 없어 아래 get() 단계가 throw 한다.
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => {
    // 컴파일된 module 은 lifecycle hook 정리를 위해 close. (DB 연결 등 외부 자원은
    // .compile() 만으로 열리지 않으나, ScheduleModule 의 onModuleDestroy 정리를 보장.)
    await moduleRef?.close();
  });

  // happy-path: AppModule 컴파일 성공 + SchedulerRegistry 주입 가능.
  it("AppModule 이 정상 컴파일되고 SchedulerRegistry 가 주입 가능하다", () => {
    const registry = moduleRef.get(SchedulerRegistry);
    expect(registry).toBeDefined();
    expect(registry).toBeInstanceOf(SchedulerRegistry);
  });

  // negative 1: 주입 결과가 undefined / null 이 아님 (ScheduleModule 미import 회귀 catch).
  it("주입된 SchedulerRegistry 는 undefined 나 null 이 아니다", () => {
    const registry = moduleRef.get(SchedulerRegistry);
    expect(registry).not.toBeUndefined();
    expect(registry).not.toBeNull();
  });

  // negative 2 / 경계: 부팅 직후 동적 등록 cron job 이 0 개 (빈 registry 계약).
  it("부팅 직후 동적 등록 cron job 이 0 개다 (declarative job 미정의)", () => {
    const registry = moduleRef.get(SchedulerRegistry);
    expect(registry.getCronJobs().size).toBe(0);
  });

  // negative 3 / 경계: interval / timeout 도 빈 상태로 시작 — 후속 ③ 가 의존하는 초기 계약.
  it("부팅 직후 interval / timeout 등록도 0 개다 (빈 registry 로 시작)", () => {
    const registry = moduleRef.get(SchedulerRegistry);
    expect(registry.getIntervals()).toHaveLength(0);
    expect(registry.getTimeouts()).toHaveLength(0);
  });
});

// app.module.spec.ts — SchedulingModule root wiring 검증 (T-0415, ADR-0042 §Decision 2,
// P7 ③ slice 2, REQ-039).
//
// 책임: SchedulingModule 을 AppModule 에 import 한 뒤 동적 cron 지정 진입점
// (CronScheduleController / CronScheduleService / CRON_TICK_HANDLER 토큰) 이 root DI
// 그래프에서 주입 가능한지(= /api/schedules 엔드포인트가 런타임에 살아있는지)를 박제한다.
//
// R-112 충족 매핑:
//  - happy-path: AppModule 컴파일 후 CronScheduleController / CronScheduleService /
//    CRON_TICK_HANDLER 가 root DI 그래프에서 주입된다.
//  - error path / negative: 각 주입 결과가 undefined / null 이 아님(SchedulingModule
//    미import 시 NestJS 가 주입 실패해 get() 이 throw 하므로 본 단언이 wiring 누락을 catch).
//  - flow / branch: 본 task 는 선언적 import 1줄로 분기 코드를 추가하지 않으므로
//    "분기 없음 — flow/branch 항목은 부팅 직후 빈 cron registry 상태 단언으로 갈음"
//    (위 T-0412 describe 의 getCronJobs().size === 0 계약이 SchedulingModule import
//    후에도 유지됨을 아래에서 회귀 단언).
//  - negative cases 충분 cover: (a) CronScheduleController · (b) CronScheduleService ·
//    (c) CRON_TICK_HANDLER 기본 handler 각각 not undefined/null 로 주입 대상별 분리 단언.
describe("AppModule (T-0415 SchedulingModule wiring)", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    // imports: [AppModule] 로 root DI 그래프 전체를 컴파일. SchedulingModule import 가
    // 빠지면 아래 CronScheduleController / CronScheduleService / CRON_TICK_HANDLER get()
    // 단계가 provider 부재로 throw 한다.
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  // happy-path: CronScheduleController 가 root DI 그래프에서 주입 가능.
  it("CronScheduleController 가 root DI 그래프에서 주입 가능하다", () => {
    const controller = moduleRef.get(CronScheduleController);
    expect(controller).toBeDefined();
    expect(controller).toBeInstanceOf(CronScheduleController);
  });

  // happy-path: CronScheduleService 가 root DI 그래프에서 주입 가능.
  it("CronScheduleService 가 root DI 그래프에서 주입 가능하다", () => {
    const service = moduleRef.get(CronScheduleService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(CronScheduleService);
  });

  // negative (a): CronScheduleController 주입 결과가 undefined / null 이 아님
  // (SchedulingModule 미import 회귀 catch).
  it("주입된 CronScheduleController 는 undefined 나 null 이 아니다", () => {
    const controller = moduleRef.get(CronScheduleController);
    expect(controller).not.toBeUndefined();
    expect(controller).not.toBeNull();
  });

  // negative (b): CronScheduleService 주입 결과가 undefined / null 이 아님.
  it("주입된 CronScheduleService 는 undefined 나 null 이 아니다", () => {
    const service = moduleRef.get(CronScheduleService);
    expect(service).not.toBeUndefined();
    expect(service).not.toBeNull();
  });

  // negative (c): CRON_TICK_HANDLER 기본 handler(no-op stub) 토큰이 resolve 가능 +
  // 호출 가능한 함수다 (module 의 defaultCronTickHandlerProvider 바인딩 회귀 catch).
  it("CRON_TICK_HANDLER 토큰이 resolve 가능하고 호출 가능한 함수다", () => {
    const handler = moduleRef.get(CRON_TICK_HANDLER);
    expect(handler).not.toBeUndefined();
    expect(handler).not.toBeNull();
    expect(typeof handler).toBe("function");
  });

  // 회귀: SchedulingModule import 후에도 부팅 직후 동적 등록 cron job 이 0 개 유지
  // (declarative @Cron job 미정의 — import 가 부팅 시점 job 을 등록하지 않음을 박제).
  it("SchedulingModule import 후에도 부팅 직후 동적 cron job 이 0 개다 (회귀)", () => {
    const registry = moduleRef.get(SchedulerRegistry);
    expect(registry.getCronJobs().size).toBe(0);
  });
});
