// RunStatusModule — RunStatusService 를 provider 로 등록하고 export 하는 최소 module.
// 후속 slice (ADR-0060 §Follow-ups (a2) · (b)) 가 본 module 을 imports 에 넣기만 하면
// RunStatusService 를 주입받는다. AppModule 등록은 소비처가 생기는 (b) 에서 한다 —
// 지금 등록하면 소비처 없는 module 이 부팅에 매달린다.
import { Module } from "@nestjs/common";

import { RunStatusService } from "./run-status.service";

@Module({
  providers: [RunStatusService],
  exports: [RunStatusService],
})
export class RunStatusModule {}
