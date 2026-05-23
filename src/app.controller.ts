// 루트 컨트롤러. GET / 만 노출한다.
// 본 task 의 sanity 용도이며, 도메인 endpoint 는 추후 별도 컨트롤러로 분리한다.
import { Controller, Get } from "@nestjs/common";

import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET / — AppService.getStatus() 의 결과를 그대로 반환.
  // 의도적으로 매우 단순하게 유지: 본 endpoint 의 목적은 "앱이 살아있다" 의 신호.
  @Get()
  getRoot(): string {
    return this.appService.getStatus();
  }
}
