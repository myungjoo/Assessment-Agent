// SchedulingModule compile test (CLAUDE.md §3.2 R-112 — DI 배선 검증). T-0413, P7 ③
// slice 1. ScheduleModule.forRoot() 를 테스트 모듈에 함께 import 해 전역 SchedulerRegistry
// 를 공급 → CronScheduleService 가 정상 resolve 됨을 검증한다. forRoot 누락 시
// 주입 실패(SchedulerRegistry provider 부재)로 module 생성이 reject 됨을 negative 로 박제.
import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { Test } from "@nestjs/testing";

import { CronScheduleService } from "./cron-schedule.service";
import { SchedulingModule } from "./scheduling.module";

describe("SchedulingModule", () => {
  it("ScheduleModule.forRoot() 와 함께 import 하면 CronScheduleService 가 resolve 된다 (happy)", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScheduleModule.forRoot(), SchedulingModule],
    }).compile();

    const service = moduleRef.get(CronScheduleService);
    expect(service).toBeInstanceOf(CronScheduleService);
    // 부팅 직후 동적 job 0 — 빈 registry 초기 계약(T-0412) 정합.
    expect(service.list()).toEqual([]);

    await moduleRef.close();
  });

  it("SchedulerRegistry 공급(ScheduleModule.forRoot())이 없으면 주입 실패로 compile 이 reject 된다 (negative)", async () => {
    // forRoot 없이 SchedulingModule 의 provider 만 등록 — SchedulerRegistry token 부재.
    @Module({
      providers: [CronScheduleService],
    })
    class BrokenModule {}

    await expect(
      Test.createTestingModule({ imports: [BrokenModule] }).compile(),
    ).rejects.toThrow();
  });
});
