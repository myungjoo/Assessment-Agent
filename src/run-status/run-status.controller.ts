// RunStatusController — `GET /api/run-status` 조회 route 의 HTTP-facing layer.
// ADR-0060 §Follow-ups (b) 이며, (a)(T-1841 · T-1842) 가 만든 RunStatusService 와
// (c)(T-1845) 까지 배선된 "상태를 켜는 비용 있는 실행 진입점" 4/4 위에 얹힌다.
//
// route (§Decision 2 계약 표 그대로):
//   - GET /api/run-status → status (200, 실행 중 여부와 무관하게 항상 200)
//
// 요청 표면이 **비어 있다** — query parameter · request body · path parameter 를 하나도
// 받지 않는다(§Decision 2 "request body 없음(query parameter 0)"). 그래서 DTO 도
// ValidationPipe 도 두지 않는다 — 검증할 입력 자체가 없다.
//
// 순수 위임 — handler 는 `snapshot()` 을 정확히 1 회 부르고 그 반환값을 가공 없이
// (복제 · 필드 추가/삭제 · 기본값 주입 · 캐시 0) 동일 참조로 돌려준다. §Decision 2 의
// 불변식(`active === (evaluation.active || collection.active)`, 축별
// `active === (runningCount > 0)`)과 `observedAt` 갱신은 전부 service 가 이미 보장하므로
// 여기서 재구현하면 진실이 두 곳으로 갈라진다. 따라서 **본 handler 에 조건 분기가 없다**
// (R-112 분기 축은 spec 의 축 조합 4 종 + metadata 케이스로 대체 배치).
//
// 응답 타입은 service 가 이미 export 하는 `RunStatusSnapshot` 을 그대로 재사용한다 —
// 새 DTO · 새 응답 타입 파일을 만들지 않는다(같은 shape 를 두 번 선언하면 drift 한다).
//
// 오류 계약 — try/catch 0, raw forward. `snapshot()` 이 던지면 그대로 전파하고 기본값
// 대체 · 200 위장을 하지 않는다. 조회가 조용히 거짓 `active: false` 를 내면 배너가 꺼져
// ADR-0060 §Consequences (a) 가 경고한 false-success 오독을 만든다.
//
// RBAC (§Decision 3 — `User+`): `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")`.
// 배너는 인증된 모든 등급의 전역 요소라 가장 낮은 인증 tier 로 연다. 미인증 401 은
// JwtAuthGuard, tier 미달 403 은 RolesGuard 소관이며 본 controller 는 어느 쪽도
// 재구현하지 않는다. RolesGuard 의 ROLE_HIERARCHY 로 Admin · SuperAdmin 도 통과한다.
//
// 책임 경계 (Out of Scope): RunStatusService 본문 수정 0(begin / end / snapshot / 타입은
// 조회 route 의 소비 대상일 뿐이다) · 조회가 상태를 바꾸는 부수효과 0(`begin` · `end` 를
// 부르지 않는다) · polling 주기 · 캐시 · rate limit · 다중 인스턴스 대응 0(§Decision 5 가
// 명시적으로 범위 밖) · e2e spec 0(§Follow-ups (d)) · web polling 배선 0(§Follow-ups (e)) ·
// api.md · requirements.md doc-sync 0(§Follow-ups (f)).
import { Controller, Get, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import { RunStatusService, type RunStatusSnapshot } from "./run-status.service";

@Controller("api/run-status")
export class RunStatusController {
  constructor(private readonly service: RunStatusService) {}

  // GET /api/run-status — 평가 · 수집 두 축의 현재 실행 상태 snapshot.
  // 200 OK + JSON 객체(성공 status 는 NestJS 기본값이라 `@HttpCode` 불요). 두 축 모두
  // 비실행이어도 예외가 아니라 `active: false` 를 담은 200 이다(§Decision 2 성공 status 행).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  status(): RunStatusSnapshot {
    return this.service.snapshot();
  }
}
