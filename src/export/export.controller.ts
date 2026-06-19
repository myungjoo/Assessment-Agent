// ExportController — `/api/admin/export` 의 export job 생성·status polling 조회
// endpoint (T-0488, ADR-0044 §Follow-ups 의 dependency-order 첫 HTTP slice).
// DifficultyMappingController (T-0139) / UserInstanceAccessController (T-0238) 가
// 박제한 controller RBAC stack 의 1:1 mirror — ExportJobService (T-0486) 위에
// HTTP-facing layer 를 신설해 Admin 이 평가 자료 export job 을 생성·조회 (REQ-030
// Export, REQ-032 raw 미저장, REQ-045 Admin 전용) 하는 경로를 노출한다. 이로써
// UC-07 §5 Export 측 HTTP entry 가 코드 차원에서 처음 채워진다.
//
// endpoint surface:
//   - POST /api/admin/export          → createJob (생성된 job status=PENDING 반환).
//     api.md §5 는 `GET ... scope` query 로 명시하나, **job 생성은 mutation 이므로
//     POST 가 자연스럽다** (REST 정합 — query GET 으로 mutation 발화는 안티패턴).
//     endpoint 메서드를 POST 로 박제하고 api.md 의 GET→POST 정정을 follow-up 으로
//     기록 (task §AC create endpoint 항목의 "POST 가 자연스러우면 근거 1줄 명시" 정합).
//   - GET  /api/admin/export/running  → findRunning (RUNNING 목록, UC-07 §8 status polling).
//   - POST /api/admin/export/describe-scope → describeScope (선택 scope 의 사람-친화
//     설명 모델, UC-07 §5 step 2 + §6.1 + §8 (a) read-only — describeExportScope(T-0462)
//     helper 를 실호출 배선, DB write 0 / raw 미접근). CreateExportDto body 를 받아
//     enum→lowercase scope kind 변환 + dateRange ISO→Date coerce 후 helper 호출.
//     POST 메서드라 `@Get(":id")` 동적 segment 와 충돌 없음 (메서드 분리 — Import 측
//     describeModes 는 GET segment 라 `:id` 위에 선언했으나, 본 endpoint 는 POST 라
//     순서 무관). Import 측 GET /modes (T-0493) 의 export 측 대칭.
//   - GET  /api/admin/export/:id      → findJob (단건 polling, 부재 시 service 가
//     NotFoundException→404 raw forward).
//   라우트 선언 순서 주의 — `running` 고정 segment 를 `:id` 동적 segment 보다 먼저
//   선언해야 "running" 이 :id 로 포착되지 않는다 (NestJS path matching 순서).
//   describe-scope 는 POST 라 GET `:id` 와 메서드가 달라 순서 영향 없음.
//
// ValidationPipe wire (DifficultyMappingController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — POST body 의
//     CreateExportDto 형식 검증.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 (raw 본문 키 등) 포함 시 400 BadRequest
//     (ADR-0044 §2 raw 미저장 — raw 본문 키 거부).
//   - transform: plain JSON 을 CreateExportDto instance 로 변환 (scope enum 검증 활성).
//
// controller 자체 분기 0 (service raw forward — DifficultyMappingController 정책 동일):
//   - scope invariant 위반 (FULL+한정값 / RANGE-dateRange 누락 등) → service 의
//     BadRequestException(400) raw propagate.
//   - 단건 조회 부재 → service 의 NotFoundException(404) raw propagate.
//   - controller 는 actor.sub (`@CurrentUser("sub")`) 를 requestedById 로 결합하고
//     dto 의 scope/dateRange/entitySelector 를 service 로 forward 만 하며, 추가
//     try/catch·status 변환을 신설하지 않는다 (service 가 모든 4xx 변환 책임).
//
// RBAC 적용 (DifficultyMappingController 의 Admin+ tier 1:1 mirror — 신규 auth 결정 0):
//   - export 는 administrative concern (REQ-045 Admin 전용) — 3 endpoint 전부 Admin+ tier.
//     `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
//   - Admin / SuperAdmin 통과 (RolesGuard escalation), User actor 403 (tier 미달).
//   - 인증 부재 (cookie 없음 / invalid JWT) → JwtAuthGuard 가 401.
//
// 책임 경계 (Out of Scope — T-0488 §Out of Scope):
//   - ImportController / Import DTO (POST /api/admin/import multipart) — 후속 task.
//   - 45 helper 실호출·실 dump 직렬화·streaming 응답 — 후속 chain. 본 controller 는
//     job record 생성·조회만, 실 dump 전송 0.
//   - 신규 auth-flow / RBAC 정책 변경 0 — 기존 guard stack 적용만.
//   - 응답 envelope 표준화 / pagination / sort — service return 그대로 forward.
import { Readable } from "node:stream";

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import {
  ExportScope as PrismaExportScope,
  JobStatus as PrismaJobStatus,
  type ExportJob,
} from "@prisma/client";
import type { Response } from "express";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import type { PeriodRange } from "../common/period-boundary";

import { CreateExportDto } from "./dto/create-export.dto";
import {
  buildExportArtifactDescriptor,
  type ExportArtifactDescriptor,
} from "./export-artifact-descriptor";
import { serializeExportDownloadHeaders } from "./export-download-headers";
import { EXPORT_SCHEMA_VERSION, type ExportDump } from "./export-dump";
import type { ExportJobStatus } from "./export-job-plan";
import {
  describeExportJobStatus,
  type ExportJobStatusView,
} from "./export-job-status-view";
import {
  ExportJobService,
  type ExportSelectionPreview,
} from "./export-job.service";
import {
  describeExportScope,
  type ExportScopeDescription,
} from "./export-scope-description";
import type {
  ExportEntity,
  ExportScope as ExportScopePayload,
} from "./export-scope-select";

// Prisma ExportScope enum(uppercase FULL/RANGE/PARTIAL) ↔ describeExportScope helper 가
// 요구하는 lowercase scope kind("full"/"range"/"partial") 매핑. prisma/schema.prisma 의
// enum ExportScope 가 source 이고, helper 는 export-scope-select.ts 의 ExportScope["scope"]
// lowercase literal 을 요구한다 — 본 상수가 그 대소문자 차이를 흡수한다(schema·helper 변경
// 0, ExportJobService.SCOPE_ENUM_TO_PAYLOAD / ImportController.IMPORT_MODE_ENUM_TO_PAYLOAD
// 패턴 mirror).
const SCOPE_ENUM_TO_PAYLOAD: Record<
  PrismaExportScope,
  ExportScopePayload["scope"]
> = {
  [PrismaExportScope.FULL]: "full",
  [PrismaExportScope.RANGE]: "range",
  [PrismaExportScope.PARTIAL]: "partial",
};

// Prisma JobStatus enum(uppercase PENDING/RUNNING/SUCCEEDED/FAILED) ↔
// describeExportJobStatus helper 가 요구하는 lowercase ExportJobStatus("queued"/
// "running"/"ready"/"failed") 매핑. prisma/schema.prisma 의 enum JobStatus 가 source
// 이고, helper 는 export-job-plan.ts 의 ExportJobStatus lowercase literal 을 요구한다 —
// 본 상수가 그 대소문자·어휘 차이(SUCCEEDED→ready)를 흡수한다(schema·helper 변경 0,
// SCOPE_ENUM_TO_PAYLOAD 패턴 mirror). 타입을 Record<PrismaJobStatus, ...> 로 강제해
// enum 에 새 status 가 추가되면 본 표가 컴파일 단계에서 누락을 catch 한다.
const JOB_STATUS_TO_VIEW: Record<PrismaJobStatus, ExportJobStatus> = {
  [PrismaJobStatus.PENDING]: "queued",
  [PrismaJobStatus.RUNNING]: "running",
  [PrismaJobStatus.SUCCEEDED]: "ready",
  [PrismaJobStatus.FAILED]: "failed",
};

@Controller("api/admin/export")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ExportController {
  constructor(private readonly service: ExportJobService) {}

  // POST /api/admin/export — export job 생성 (REQ-030 Export). @CurrentUser("sub") 로
  // 추출한 actor.sub 를 requestedById 로 결합해 (client 임의 발화자 위장 불가, REQ-045)
  // dto.scope/dateRange/entitySelector 와 함께 service.createJob 로 forward. 생성된
  // job (status=PENDING) 을 그대로 반환. scope invariant 위반은 service 가
  // BadRequestException(400) raw forward — controller 자체 분기 없음.
  //
  // RBAC — Admin+ tier. @Roles("Admin") → Admin / SuperAdmin 통과 (RolesGuard
  // escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async create(
    @Body() dto: CreateExportDto,
    @CurrentUser("sub") actorSub: string,
  ): Promise<ExportJob> {
    return this.service.createJob({
      scope: dto.scope,
      requestedById: actorSub,
      dateRange: dto.dateRange,
      entitySelector: dto.entitySelector,
    });
  }

  // GET /api/admin/export/running — 진행 중 (status=RUNNING) export job 목록
  // (UC-07 §8 status polling). 매칭 0 이면 빈 배열 (service findRunning 의 raw
  // forward — 404 변환 0). `:id` 동적 segment 보다 먼저 선언해 "running" 이 :id 로
  // 포착되지 않도록 함.
  //
  // RBAC — Admin+ tier (create 동일).
  @Get("running")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async findRunning(): Promise<ExportJob[]> {
    return this.service.findRunning();
  }

  // POST /api/admin/export/describe-scope — 선택 scope 의 사람-친화 설명 모델 조회
  // (UC-07 §5 step 2 + §6.1 + §8 (a) read-only, REQ-030/032/045). 사용자가 Export 를
  // *확정하기 전* "내가 무엇을 내보내는지" 를 보여줄 scope preview dialog 의 정보 source —
  // Import 측 describeModes(T-0493) 의 export 측 대칭이다. CreateExportDto 를 그대로
  // request body 로 재사용해 받고(create 와 동일 DTO), Prisma ExportScope enum →
  // lowercase scope kind 변환(SCOPE_ENUM_TO_PAYLOAD) + dateRange 의 ISO string → Date
  // coerce(ExportJobService.coerceDateRange 패턴 mirror — JSON 에 Date 타입이 없어
  // start/end 가 string 으로 들어옴) 후 describeExportScope(T-0462) helper 를 실호출하고,
  // 반환된 ExportScopeDescription 을 200 으로 그대로 반환한다.
  //
  // controller 자체 분기 0 (helper raw forward — create/findJob 정책 동일):
  //   - RANGE+dateRange 누락 / start>=end / PARTIAL+빈 entitySelector / 허용 외 entity
  //     섞임 → helper 의 RangeError, dateRange 비-Date/Invalid → helper 의 TypeError 가
  //     swallow 없이 raw propagate(NestjS default exception filter 가 500 으로 매핑 —
  //     본 controller 는 try/catch·status 변환 신설 0, helper 가 입력 방어 책임).
  //   - persistence / DB write 0 — describeScope 는 순수 합성(read-only). job record
  //     생성·status 변경 0 (REQ-032 raw 미저장 자연 유지 — 입력 scope 만 다룸).
  //
  // POST + describe-scope 고정 segment 라 GET `:id` 동적 segment 와 메서드·경로 모두
  // 달라 라우트 충돌 0 (기존 running/:id GET 순서 불변).
  //
  // RBAC — Admin+ tier (create 동일). @Roles("Admin") → Admin / SuperAdmin 통과
  // (RolesGuard escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Post("describe-scope")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  describeScope(@Body() dto: CreateExportDto): ExportScopeDescription {
    // enum→lowercase scope kind 변환 + dateRange ISO→Date coerce + entitySelector
    // forward 로 helper 입력 ExportScope 를 합성한다(create 의 service 위임과 달리 본
    // 경로는 helper 를 직접 호출 — describeScope 는 read-only 순수 합성이라 service 불요).
    const helperInput: ExportScopePayload = {
      scope: SCOPE_ENUM_TO_PAYLOAD[dto.scope],
      dateRange: this.coerceDateRange(dto.dateRange),
      entitySelector: dto.entitySelector as ExportEntity[] | undefined,
    };
    return describeExportScope(helperInput);
  }

  // POST /api/admin/export/preview-selection — 선택 scope 로 실 DB 선별을 수행한 결과의
  // count 요약 조회 (UC-07 §6.1 scope 선별 + §8 (a) read-only, REQ-030/032/045). describe
  // -scope(T-0494) 가 scope 의 사람-친화 *설명* 만 합성했다면, 본 endpoint 는 scope 검증
  // 통과 후 5 entity 의 `{instant}` projection 을 실 DB read 해 selectExportRecords(T-0437)
  // 로 처음 실 선별을 수행한다. CreateExportDto 를 그대로 body 로 재사용해 받고, describe
  // -scope 와 동일하게 enum→lowercase scope kind 변환(SCOPE_ENUM_TO_PAYLOAD) + dateRange
  // ISO string→Date coerce(coerceDateRange) 후 service.previewSelection(scope) 를 호출하고
  // count 요약(selectedCount·excludedCount·perEntitySelected)을 200 으로 반환한다.
  //
  // controller 자체 분기 0 (service/helper raw forward — describeScope/findJob 정책 동일):
  //   - RANGE+dateRange 누락 / start>=end / PARTIAL+빈 entitySelector / 허용 외 entity →
  //     service 안의 selectExportRecords 가 RangeError, dateRange Invalid Date → TypeError
  //     를 swallow 없이 raw propagate(controller 는 형 변환만, 판정은 helper).
  //   - DB read-only — 5 entity `{instant}` projection 만 select(전체 row·raw 미조회,
  //     REQ-032). job record 생성·status 변경 0 / 실 record payload 반환 0(count 요약만).
  //
  // POST + preview-selection 고정 segment 라 GET `:id` 동적 segment 와 메서드·경로 모두
  // 달라 라우트 충돌 0 (describe-scope 와 동일 — running/:id GET 순서 불변).
  //
  // RBAC — Admin+ tier (create 동일). @Roles("Admin") → Admin / SuperAdmin 통과
  // (RolesGuard escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Post("preview-selection")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async previewSelection(
    @Body() dto: CreateExportDto,
  ): Promise<ExportSelectionPreview> {
    // enum→lowercase scope kind 변환 + dateRange ISO→Date coerce + entitySelector forward
    // 로 service 입력 ExportScope 합성(describeScope 와 동일 변환 — 중복 최소화 위해 같은
    // SCOPE_ENUM_TO_PAYLOAD / coerceDateRange 재사용, 신규 helper 파일 신설 0).
    const scope: ExportScopePayload = {
      scope: SCOPE_ENUM_TO_PAYLOAD[dto.scope],
      dateRange: this.coerceDateRange(dto.dateRange),
      entitySelector: dto.entitySelector as ExportEntity[] | undefined,
    };
    return this.service.previewSelection(scope);
  }

  // coerceDateRange — JSON body 의 dateRange 는 역직렬화 과정에서 start/end 가 ISO string
  // 으로 들어올 수 있으므로(JSON 에 Date 타입 부재), string 이면 new Date(...) 로 coerce
  // 한다(ExportJobService.coerceDateRange 패턴 mirror). coerce 후 helper 의 assertValidDate
  // 가 Invalid Date(잘못된 ISO string)를 TypeError 로 잡는다. 이미 Date instance 면 그대로
  // 통과, dateRange 가 object 가 아니면(undefined 포함) undefined 로 흘려보내 helper 의
  // dateRange 부재 분기(RANGE 면 RangeError)가 처리하도록 둔다(본 controller 는 형 변환만,
  // 판정은 helper).
  private coerceDateRange(
    value: Record<string, unknown> | undefined,
  ): PeriodRange | undefined {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    const range = value as { start?: unknown; end?: unknown };
    return {
      start:
        typeof range.start === "string" ? new Date(range.start) : range.start,
      end: typeof range.end === "string" ? new Date(range.end) : range.end,
    } as PeriodRange;
  }

  // buildScopePayload — 저장된 ExportJob row 의 scope(Prisma enum) + dateRange/entitySelector
  // (Json 컬럼)를 materializeFullExportDownload 가 받는 lowercase ExportScopePayload 로 합성한다
  // (describeScope/previewSelection 이 CreateExportDto 에서 합성하던 SCOPE_ENUM_TO_PAYLOAD +
  // coerceDateRange 패턴을 job row 입력으로 mirror — 신규 helper 신설 0, 기존 변환 재사용).
  // job 의 scope 는 materialize 의 dump envelope meta context 로만 박제되며 record 선별과 결합
  // 되지 않는다(§Out of Scope — materializeFullExportDownload 는 5 entity 전체 read).
  private buildScopePayload(job: ExportJob): ExportScopePayload {
    return {
      scope: SCOPE_ENUM_TO_PAYLOAD[job.scope],
      dateRange: this.coerceDateRange(
        job.dateRange as Record<string, unknown> | undefined,
      ),
      entitySelector: (job.entitySelector ?? undefined) as
        | ExportEntity[]
        | undefined,
    };
  }

  // buildHeaderDumpSeed — buildExportArtifactDescriptor 의 입력 dump seed 를 합성한다. descriptor
  // 산출에 필요한 필드는 scope(scopeToken/fileName) + generatedAt(timestamp 토큰)뿐이고 byteSizeHint
  // 은 download() 가 실 body 길이로 보정하므로(records 길이 무관), records 는 빈 배열로 둔다(합성
  // dump 의 JSON.stringify 길이는 byteSizeHint 보정으로 폐기됨). entityCounts 는 5 entity 0 초기화.
  // 본 seed 는 header 메타(contentType/contentDisposition/scopeToken) 산출 전용이며 body bytes 와
  // 무관하다(descriptor single-source — 길이만 download() 가 실값으로 교체).
  private buildHeaderDumpSeed(scope: ExportScopePayload): ExportDump {
    return {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      scope,
      entityCounts: {
        Assessment: 0,
        Person: 0,
        Group: 0,
        LlmConfig: 0,
        AuditLog: 0,
      },
      recordCount: 0,
      records: [],
    };
  }

  // collectStream — Node Readable 의 chunk 들을 단일 Buffer 로 모은다(body bytes 변형 0 — 길이
  // 측정 + StreamableFile 입력용). materializeExportDump 가 Readable.from(JSON.stringify(...)) 로
  // 이미 in-memory 단일 chunk 를 만들므로 추가 메모리 비용은 미미하다. stream error(의존성 실패
  // 등)는 reject 로 raw propagate(controller 자체 swallow 0 — handler 가 그대로 throw).
  private async collectStream(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string),
      );
    }
    return Buffer.concat(chunks);
  }

  // GET /api/admin/export/:id/download — 저장된 export job 의 full-record dump 를 단일
  // stream 으로 다운로드한다 (UC-07 §5 step13 다운로드 완료 + §8 (c) file artifact 전달,
  // REQ-030 Export / REQ-032 raw 미저장 / REQ-045 Admin 전용). ADR-0047 §Follow-ups[3] chain
  // 의 HTTP 표면 — 직전 T-0518 이 service 차원에서 완결한 materializeFullExportDownload(scope)
  // Readable 을 사용자에게 내려주는 진입점이다. 배선 3 단계:
  //   (1) findJob(id) 로 저장된 job 을 조회해 그 job 의 Prisma scope/dateRange/entitySelector 를
  //       lowercase ExportScopePayload 로 합성(buildScopePayload — describeScope/previewSelection
  //       이 dto 에서 합성하던 SCOPE_ENUM_TO_PAYLOAD + coerceDateRange 패턴을 job row 입력으로
  //       mirror). 부재 시 findJob 의 NotFoundException(404)이 합성 도달 전 raw propagate.
  //   (2) materializeFullExportDownload(scope) 로 full-record dump 의 Node Readable 을 획득.
  //       service reject(의존성 실패)는 swallow 없이 raw propagate (controller 자체 try/catch 0).
  //   (3) 그 Readable 을 Buffer 로 모아 정확한 byte 길이를 얻고, buildExportArtifactDescriptor 로
  //       산출한 descriptor 의 contentType/contentDisposition/scopeToken 은 그대로 두되 byteSizeHint
  //       만 실제 body 길이로 맞춘 뒤 serializeExportDownloadHeaders 로 직렬화한 header 를 response
  //       에 설정하고, body Buffer 를 StreamableFile 로 stream 한다.
  //
  // StreamableFile 선택 근거(@Res({ passthrough: true }) 대신): NestJS 권장 streaming 전달
  // primitive 가 StreamableFile 이며, passthrough Res 직접 res.end 보다 (a) 예외 발생 시
  // NestJS exception filter 가 정상 동작하고(부분 전송 후 raw res 조작과 달리), (b) Content-Type
  // 자동 추론을 끄고 우리가 descriptor 에서 산출한 header 를 우선하기 쉽다. header 는 동적
  // (filename 에 timestamp 토큰)이라 정적 @Header() decorator 로는 표현 불가 → passthrough Res
  // 핸들에 res.set(headers) 로 설정하고 body 는 StreamableFile 로 반환한다(header 설정과 body
  // 반환 책임 분리 — res.end 수동 호출 0).
  //
  // descriptor single-source 정합(ADR-0047 §Decision3(i)): contentType/contentDisposition/
  // scopeToken 은 buildExportArtifactDescriptor 산출물을 그대로 쓴다(재계산 0). byteSizeHint 만
  // 실 body 길이로 교체하는 이유 — service 는 Readable 만 반환하고 dump 객체를 노출하지 않으므로,
  // 합성 dump(빈 records)로 산출한 byteSizeHint 는 실제 stream 길이와 어긋난다. Content-Length 가
  // 실 body 와 불일치하면 HTTP 응답이 깨지므로(잘림/hang), 실 buffer.length 로 보정한다. 이는
  // 재필터/secret strip 이 아니라 길이 메타 1 개의 정확도 보정일 뿐 — body bytes 는 service 의
  // Readable 그대로 forward(상류 T-0514 projection + T-0515 builder 가 이미 secret/raw 강제,
  // controller 재검증 0).
  //
  // 🔥 재필터 / secret strip / 컬럼 재검증 0 — controller 는 raw forward. body 는 service Readable
  // 의 bytes 를 변형 없이 그대로 흘려보낸다(buffer 는 길이 측정 + StreamableFile 입력용이며 내용
  // 가공 0).
  //
  // route 선언 순서 — `:id/download` 고정-깊이 segment 를 `:id` 동적 segment 보다 먼저 선언해
  // NestJS path matching 안전을 확보(기존 running / :id/status-view before :id 패턴 동형).
  //
  // RBAC — Admin+ tier (create 동일). @Roles("Admin") → Admin / SuperAdmin 통과
  // (RolesGuard escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Get(":id/download")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async download(
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // (1) job 조회 + 저장 scope 합성 — 부재 시 findJob 의 NotFoundException(404) raw propagate.
    const job = await this.service.findJob(id);
    const scope = this.buildScopePayload(job);

    // (2) full-record dump Readable 획득 — service reject(의존성 실패)는 raw propagate.
    const stream = await this.service.materializeFullExportDownload(scope);

    // (3) Readable → Buffer 로 모아 실 byte 길이 측정(materializeExportDump 는 이미 in-memory
    //     Readable.from(JSON.stringify(...)) 이므로 추가 메모리 비용 미미). body bytes 변형 0.
    const body = await this.collectStream(stream);

    // descriptor 는 합성 dump(scope + 측정 시각)로 contentType/contentDisposition/scopeToken 을
    // 산출하고, byteSizeHint 만 실 body 길이로 보정한다(Content-Length 정확도 — 위 주석 참조).
    const baseDescriptor = buildExportArtifactDescriptor(
      this.buildHeaderDumpSeed(scope),
    );
    const descriptor: ExportArtifactDescriptor = {
      ...baseDescriptor,
      byteSizeHint: body.byteLength,
    };

    // 다운로드 header(Content-Type / Content-Disposition / Content-Length)를 response 에 설정.
    res.set(serializeExportDownloadHeaders(descriptor));

    // body Buffer 를 단일 stream 으로 반환 — NestJS 가 StreamableFile 을 response 로 흘려보낸다.
    return new StreamableFile(body);
  }

  // GET /api/admin/export/:id/status-view — async Export job 의 사람-친화 진행 view 조회
  // (UC-07 §8 NFR async job + status polling + §5 step 13 다운로드 완료 직전 진행 안내,
  // REQ-030/032/045). findJob(id) 로 조회한 job 의 Prisma JobStatus 를 helper 가 요구하는
  // lowercase ExportJobStatus 로 JOB_STATUS_TO_VIEW 매핑한 뒤 describeExportJobStatus(T-0468)
  // 를 실호출해 ExportJobStatusView(phaseLabel·stepIndex·totalSteps·nextStatus·terminal·
  // downloadable·한국어 message)를 200 으로 반환한다. raw ExportJob 만 주던 GET :id 와 달리
  // "지금 몇 단계 중 몇 번째인지" 를 사람-친화 view 로 derive 한다.
  //
  // controller 자체 분기 0 (helper / service raw forward — findJob/describeScope 정책 동일):
  //   - job 부재 → service.findJob 의 NotFoundException(404)이 helper 호출 전에 raw propagate
  //     (controller 자체 try/catch·status 변환 신설 0, REQ-032 raw stack 미노출 정합).
  //   - 정상 조회 시 status 는 항상 JOB_STATUS_TO_VIEW 가 산출한 정상 lowercase 값이라 helper
  //     의 입력 방어 분기(TypeError/RangeError)는 정상 경로에서 미발화 — 매핑표가 4 enum 을
  //     1:1 cover 하므로 미정의 값이 helper 로 흘러가지 않는다.
  //   - persistence / DB write 0 — describeExportJobStatus 는 status enum 하나만 다루는 순수
  //     합성(read-only). job record 변경 0 (REQ-032 raw 미저장 자연 유지).
  //
  // route 선언 순서 — `:id/status-view` 고정-깊이 segment 를 `:id` 동적 segment 보다 먼저
  // 선언해 NestJS path matching 안전을 확보(기존 running before :id 패턴 동형).
  //
  // RBAC — Admin+ tier (create 동일). @Roles("Admin") → Admin / SuperAdmin 통과
  // (RolesGuard escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401.
  @Get(":id/status-view")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async statusView(@Param("id") id: string): Promise<ExportJobStatusView> {
    // findJob 부재 시 NotFoundException 이 여기서 raw propagate — helper 호출 도달 전.
    const job = await this.service.findJob(id);
    // Prisma JobStatus → lowercase ExportJobStatus 매핑 후 helper 실호출(UC-07 §8 진행 view).
    return describeExportJobStatus(JOB_STATUS_TO_VIEW[job.status]);
  }

  // GET /api/admin/export/:id — 단건 status polling 조회 (UC-07 §8). :id 는 path
  // param raw forward — 부재 시 service 의 findUniqueOrThrow 가 P2025 →
  // NotFoundException(404) 변환, controller 는 swallow 없이 raw propagate.
  //
  // RBAC — Admin+ tier (create 동일).
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async findJob(@Param("id") id: string): Promise<ExportJob> {
    return this.service.findJob(id);
  }
}
