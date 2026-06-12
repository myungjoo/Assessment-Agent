// 루트 컨트롤러. GET /api 만 노출한다.
// sanity 용도이며, 도메인 endpoint 는 추후 별도 컨트롤러로 분리한다.
// T-0354: ADR-0040 §2 경계 (backend = /api/* namespace) 에 맞춰 GET / → GET /api 로
// 이전 — 운영에서 SPA root (/ → index.html fallback) 가 본 endpoint 에 가려지지 않게.
import { Controller, Get } from "@nestjs/common";

import { AppService } from "./app.service";

@Controller("api")
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET /api — AppService.getStatus() 의 결과를 그대로 반환.
  // 의도적으로 매우 단순하게 유지: 본 endpoint 의 목적은 "앱이 살아있다" 의 신호.
  @Get()
  getRoot(): string {
    return this.appService.getStatus();
  }
}
