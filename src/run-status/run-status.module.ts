// RunStatusModule — RunStatusService 를 provider 로 등록·export 하고, 조회 route 인
// RunStatusController 를 controller 로 등록하는 최소 module.
// 소비처 module (ADR-0060 §Follow-ups (a) 평가 축 · (c) 수집 축) 은 본 module 을 imports 에
// 넣기만 하면 RunStatusService 를 주입받는다.
// AppModule 등록은 소비처가 생기는 (b)(T-1846) 에서 실제로 수행했다 — 아래 controllers 와
// 짝을 이뤄야 `GET /api/run-status` 가 런타임에 서빙되므로 둘은 같은 slice 에 있다.
import { Module } from "@nestjs/common";

import { RunStatusController } from "./run-status.controller";
import { RunStatusService } from "./run-status.service";

@Module({
  controllers: [RunStatusController],
  providers: [RunStatusService],
  exports: [RunStatusService],
})
export class RunStatusModule {}
