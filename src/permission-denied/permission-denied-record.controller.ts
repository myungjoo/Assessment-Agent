// PermissionDeniedRecordController — `/api/permission-denied-records` GET audit 조회
// endpoint. T-0214 acceptance 박제 (ADR-0023 후속 chain row 2 controller slice).
// LlmProviderConfigController (T-0140) 의 controller RBAC stack 을 1:1 mirror —
// PermissionDeniedRecordService (T-0209, actor-aware list 로 확장) 위에 HTTP-facing
// layer 를 신설해 운영자가 권한 거부 audit 를 조회하는 read-only 경로를 노출한다.
//
// endpoint (ADR-0023 §5):
//   - GET /api/permission-denied-records → service.list(actor, filter) (200, 빈
//     배열도 정상 — 404 변환 0). query param instanceRef / provider / httpStatus 로
//     필터 (기존 PermissionDeniedRecordFilter). 응답은 record view (provider /
//     instanceRef / resourceRef / principal / httpStatus / reason / createdAt) —
//     redaction 불요 (schema-level secret-at-rest, ADR-0022 §1 / ADR-0023 §5).
//
// audience 차등 (ADR-0023 §1/§3) — controller 자체 분기 없음:
//   - controller 는 @CurrentUser() 로 actor (JwtPayload) 를 추출해 service 에 명시
//     전달하고, audience 차등 (Admin bypass / non-Admin binding-부재 fallback) 은
//     service-layer 가 actor.role 로 분기한다 (단일 강제 지점, ADR-0023 §3 service-
//     layer actor-aware 분기). controller 는 raw forward 만 — own-instance 강제를
//     controller 에 두지 않아 다른 호출자의 우회 표면 0.
//
// query param 처리:
//   - instanceRef / provider 는 문자열 그대로 filter 로 매핑 (undefined 면 omit).
//   - httpStatus 는 query string 이라 항상 문자열로 도착 — 숫자 변환을 controller 가
//     수행 (parseHttpStatus). 비정상값 (non-numeric) 은 throw 0 으로 무시 (undefined
//     처리 → 해당 컬럼 필터 안 함, ADR-0023 §5 query param 경계 / 본 task negative
//     case #6). repository.findMany 가 부재 키를 where 에서 omit 하므로 안전.
//
// RBAC 적용 (ADR-0023 §5 — LlmProviderConfigController stack mirror, 신규 auth 결정 0):
//   - @UseGuards(JwtAuthGuard, RolesGuard) + @Roles("User") — authenticated 면 endpoint
//     접근 (User 이상 모두 허용, RolesGuard escalation), audience 차등은 service-layer
//     own-instance 필터로 (ADR-0023 §5). User / Admin / SuperAdmin 모두 통과.
//   - 인증 부재 (cookie 없음 / invalid JWT) → JwtAuthGuard 가 401. 본 endpoint 는
//     @Roles("User") 라 authenticated 면 role 게이트 통과 — 403 은 향후 endpoint 가
//     더 높은 tier 를 요구할 때의 경계 (ADR-0023 §4).
//
// 책임 경계 (Out of Scope — task §Out of Scope / ADR-0023 박제):
//   - non-Admin own-instance 실 필터 결선 — User↔instance binding schema (ADR-0023
//     §2(b) DB-schema 게이트, Q-0019 미승인) 선행 요구. 본 slice 는 non-Admin = 빈
//     배열 fallback 까지만 (service-layer). own-instance 필터는 Follow-up.
//   - JwtPayload 확장 (instance claim) — ADR-0023 §2 server-side lookup 채택, claim 비확장.
//   - 새 guard / interceptor 신설 0 — 기존 stack 재사용 (ADR-0023 §3.2).
//   - 응답 envelope 표준화 / pagination / sort 변경 0 — repository createdAt desc 그대로.
import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import type { PermissionDeniedRecord } from "@prisma/client";

import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

import type { PermissionDeniedRecordFilter } from "./permission-denied-record.repository";
import { PermissionDeniedRecordService } from "./permission-denied-record.service";

// parseHttpStatus — query string 의 httpStatus 를 숫자로 변환. query param 은 항상
// 문자열로 도착하므로 controller 가 변환 책임. 비정상값 (undefined / 빈 문자열 /
// non-numeric) 은 undefined 반환 → filter 에서 omit (ADR-0023 §5 / negative case #6).
// throw 0 — 잘못된 query param 이 500 을 유발하지 않고 단순히 해당 필터를 적용 안 함.
function parseHttpStatus(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") {
    return undefined;
  }
  // Number() 는 "403abc" → NaN, " 403 " → 403. 정수 + 유한값만 채택.
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
}

@Controller("api/permission-denied-records")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
  }),
)
export class PermissionDeniedRecordController {
  constructor(private readonly service: PermissionDeniedRecordService) {}

  // GET /api/permission-denied-records — 권한 거부 audit 조회 (ADR-0023 §5). 200 OK +
  // record view 배열. @CurrentUser() 로 actor (JwtPayload) 를 추출해 service.list 에
  // 명시 전달 — audience 차등 (Admin 전체 / non-Admin binding-부재 빈 배열) 은
  // service-layer 책임 (controller 자체 분기 없음). query param instanceRef /
  // provider 는 문자열 그대로, httpStatus 는 parseHttpStatus 로 숫자 변환 후 filter
  // 구성 (undefined 키는 omit — repository 가 where 에서 제외).
  //
  // RBAC — @Roles("User") (User 이상 모두 허용, ADR-0023 §5). 인증 부재 시 JwtAuthGuard
  // 가 401. authenticated 면 role 게이트 통과 (audience 차등은 service-layer).
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("User")
  async list(
    @CurrentUser() actor: JwtPayload | undefined,
    @Query("instanceRef") instanceRef?: string,
    @Query("provider") provider?: string,
    @Query("httpStatus") httpStatus?: string,
  ): Promise<PermissionDeniedRecord[]> {
    const filter: PermissionDeniedRecordFilter = {};
    if (instanceRef !== undefined && instanceRef !== "") {
      filter.instanceRef = instanceRef;
    }
    if (provider !== undefined && provider !== "") {
      filter.provider = provider;
    }
    const parsedStatus = parseHttpStatus(httpStatus);
    if (parsedStatus !== undefined) {
      filter.httpStatus = parsedStatus;
    }
    return this.service.list(actor, filter);
  }
}
