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
