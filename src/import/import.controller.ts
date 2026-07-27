// ImportController — `/api/admin/import` 의 import job 생성·status polling 조회
// endpoint (T-0489, ADR-0044 §Follow-ups 의 export/import controller 배선 중 Import
// 측 HTTP slice). ExportController (T-0488) 의 controller RBAC stack 1:1 mirror —
// ImportJobService (T-0487) 위에 HTTP-facing layer 를 신설해 Admin 이 평가 자료
// import job 을 생성·조회 (REQ-030 Import, REQ-032 raw 미저장, REQ-045 Admin 전용)
// 하는 경로를 노출한다. 이로써 UC-07 §5 Import 측 HTTP entry 가 코드 차원에서 처음
// 채워진다.
//
// endpoint surface:
//   - POST /api/admin/import          → createJob (생성된 job status=PENDING 반환).
//     **multipart 파일 수신 배선 완료 (ADR-0055 §Decision 1, T-1252) + 크기 상한 강제
//     (ADR-0055 §Decision 3, T-1253)** — `mode` form field + dump artifact 파일 1 개
//     (`file`) 를 `FileInterceptor("file", { limits: { fileSize: MAX_IMPORT_FILE_SIZE_BYTES } })`
//     (multer bundled in @nestjs/platform-express, 새 dep 0) + `@UploadedFile()` 로 받는다.
//     크기 상한 초과 시 multer 가 `MulterError(LIMIT_FILE_SIZE)` 를 던지고
//     `MulterExceptionFilter` 가 이를 413 Payload Too Large 로 매핑한다 (상한 없는
//     memoryStorage 의 DoS 표면 차단 — ADR-0055 §Decision 2/3). 파일 누락 시
//     BadRequestException(400). 단 **interim** — 받은 buffer 는 아직 복원 엔진에 넘기지
//     않고 (§Follow-up b slice) 수신·크기만 검증하며, controller 는 여전히 mode + actor
//     결합으로 job record (status=PENDING) 만 생성한다 (ADR-0055 §Consequences 의 chain
//     완주 전 interim false-success 상태 그대로 — buffer 미소비 유지).
//   - GET  /api/admin/import/running  → findRunning (RUNNING 목록, UC-07 §8 status polling).
//   - GET  /api/admin/import/modes    → describeModes (import mode 선택 dialog 의 사람-친화
//     설명 목록, UC-07 §5 step 2 + §6.2 — describeImportMode helper 를 REPLACE/MERGE 두
//     mode 에 호출, DB write 0 / raw 미접근).
//   - GET  /api/admin/import/:id      → findJob (단건 polling, 부재 시 service 가
//     P2025 → NotFoundException → 404 raw forward).
//   라우트 선언 순서 주의 — `running`/`modes` 고정 segment 를 `:id` 동적 segment 보다 먼저
//   선언해야 "running"/"modes" 가 :id 로 포착되지 않는다 (NestJS path matching 순서, ExportController 동형).
//
// ValidationPipe wire (ExportController mirror):
//   - Controller-scope `@UsePipes(new ValidationPipe({...}))` — POST body 의
//     CreateImportDto 형식 검증.
//   - whitelist: 정의되지 않은 필드 제거.
//   - forbidNonWhitelisted: 정의되지 않은 필드 (raw 본문 키 등) 포함 시 400 BadRequest
//     (ADR-0044 §2 raw 미저장 — raw 본문 키 거부).
//   - transform: plain JSON 을 CreateImportDto instance 로 변환 (mode enum 검증 활성).
//
// controller 자체 분기 0 (service raw forward — ExportController 정책 동일):
//   - mode invariant 위반 (비유효 enum 등) / requestedById 누락 → service 의
//     BadRequestException(400) raw propagate.
//   - 단건 조회 부재 → service 의 NotFoundException(404) raw propagate.
//   - controller 는 actor.sub (`@CurrentUser("sub")`) 를 requestedById 로 결합하고
//     dto.mode 를 service 로 forward 만 하며, 추가 try/catch·status 변환을 신설하지
//     않는다 (service 가 모든 4xx 변환 책임).
//
// RBAC 적용 (ExportController 의 Admin+ tier 1:1 mirror — 신규 auth 결정 0):
//   - import 는 administrative concern (REQ-045 Admin 전용) — 3 endpoint 전부 Admin+ tier.
//     `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("Admin")`.
//   - Admin / SuperAdmin 통과 (RolesGuard escalation), User actor 403 (tier 미달).
//   - 인증 부재 (cookie 없음 / invalid JWT) → JwtAuthGuard 가 401.
//
// 책임 경계 (Out of Scope — T-0489 §Out of Scope):
//   - multipart 파일 수신 / 실 artifact upload·파싱 (multer · FileInterceptor) — 후속 slice.
//   - 실 atomic transaction 복원 로직 (REPLACE $transaction / MERGE conflict) — 후속 task.
//   - 45 helper 실호출 배선 — 후속 chain. 본 controller 는 job record 생성·조회만.
//   - 신규 auth-flow / RBAC 정책 변경 0 — 기존 guard stack 적용만.
//   - 응답 envelope 표준화 / pagination / sort — service return 그대로 forward.
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ImportMode, type ImportJob } from "@prisma/client";

import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import {
  describeImportMode,
  type ImportModeDescription,
} from "../export/import-mode-description";
import type { ImportRestoreMode } from "../export/import-restore-plan";

import { CreateImportDto } from "./dto/create-import.dto";
import { ImportJobService } from "./import-job.service";
import { MulterExceptionFilter } from "./multer-exception.filter";
import type { UploadedDumpFile } from "./uploaded-dump-file";

// MAX_IMPORT_FILE_SIZE_BYTES — import dump artifact 업로드의 크기 상한(bytes).
// ADR-0055 §Decision 3 이 박제한 "limits.fileSize 상한이 반드시 강제된다" invariant 의
// 구체 수치다. 상한 없는 memoryStorage(§Decision 2)는 무제한 업로드가 프로세스 메모리를
// 소진시키는 DoS 표면이므로 상한 강제가 memoryStorage 채택의 안전 전제다.
//
// 근거(50 MiB): 평가 자료 dump 는 JSON 직렬화 DB 스냅샷이라 현실적 규모(사용자·평가·응답
// 로우)에서 대체로 수 MiB~수십 MiB 수준이다. 50 MiB 는 현실적 export 에 충분한 여유를
// 주면서도 단일 요청이 메모리에 올릴 수 있는 최대치를 제한해 DoS 표면을 좁힌다.
// env override / 동적 config 는 본 slice 범위 밖 — 분기 있는 env parsing 도입 없이 단순
// 상수로 둔다(배포 환경별 조정 필요 시 별도 follow-up 로 env parsing helper + spec 박제).
export const MAX_IMPORT_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Prisma ImportMode enum(uppercase REPLACE/MERGE) ↔ describeImportMode helper 가
// 요구하는 lowercase ImportRestoreMode("replace"/"merge") 매핑. prisma/schema.prisma
// 의 enum ImportMode 가 source 이고, helper 는 import-restore-plan.ts 의
// ImportRestoreMode lowercase literal 을 요구한다 — 본 상수가 그 대소문자 차이를
// 흡수한다(schema·helper 변경 0, ExportJobService.SCOPE_ENUM_TO_PAYLOAD 패턴 mirror).
const IMPORT_MODE_ENUM_TO_PAYLOAD: Record<ImportMode, ImportRestoreMode> = {
  [ImportMode.REPLACE]: "replace",
  [ImportMode.MERGE]: "merge",
};

@Controller("api/admin/import")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ImportController {
  constructor(private readonly service: ImportJobService) {}

  // POST /api/admin/import — import job 생성 (REQ-030 Import). multipart/form-data 로
  // dump artifact 파일 1 개 (`file`) + `mode` form field 를 받는다 (ADR-0055 §Decision 1).
  //   - @UseInterceptors(FileInterceptor("file", { limits: { fileSize:
  //     MAX_IMPORT_FILE_SIZE_BYTES } })) — multer (memoryStorage default, ADR-0055
  //     §Decision 2) 가 파일을 in-memory buffer 로 파싱하되 limits.fileSize 상한을 강제
  //     (§Decision 3, DoS 표면 차단). FileInterceptor 는 @nestjs/platform-express
  //     (multer bundled) 제공 → 새 runtime dep 0 (package.json 불변).
  //   - @UseFilters(MulterExceptionFilter) — 크기 상한 초과 시 multer 가 던진
  //     MulterError(LIMIT_FILE_SIZE) 를 413 Payload Too Large 로 매핑 (기타 MulterError
  //     400, HttpException passthrough, unknown 500). 명시적 4xx 매핑이 없으면 상한 초과가
  //     500 으로 표면화될 수 있어 구현이 자동 4xx 를 가정할 수 없다 (reviewer NIT-1 회수).
  //   - @UploadedFile() file — 수신한 파일 (UploadedDumpFile local 타입, ADR-0055
  //     §Decision 4 로 @types/multer 없이 typing). 파일 누락 시 file 은 undefined.
  //   - @CurrentUser("sub") actorSub — 인증 actor.sub 를 requestedById 로 결합
  //     (client 임의 발화자 위장 불가, REQ-045). @Body() dto 의 mode 를 forward.
  //
  // 파일 누락 분기 (ADR-0055 §Follow-up a): file 이 undefined 면 BadRequestException(400)
  // 으로 거부한다 (dump artifact 없이 import 진행 불가). 파일 수신 시에는 기존대로
  // service.createJob({ mode, requestedById }) 로 진행하고 생성된 job (status=PENDING)
  // 을 반환한다. mode 미지정 시 dto.mode 가 undefined 로 forward 되어 service 가 schema
  // @default(REPLACE) 를 적용한다. mode invariant 위반은 service 가 BadRequestException
  // raw forward — controller 는 파일 누락 외 추가 분기를 두지 않는다.
  //
  // **interim (ADR-0055 §Consequences 부정)**: 받은 file.buffer 는 아직 소비하지 않는다
  // — 파싱→실 복원 엔진 배선은 §Follow-up (b) slice. 본 (c) slice 는 크기 상한 강제 +
  // 초과 거부 매핑만 추가하며, buffer 는 여전히 미소비다 (파일을 *받는 입구* + 크기
  // 게이트만 열고 createJob 시그니처는 보존).
  //
  // RBAC — Admin+ tier. @Roles("Admin") → Admin / SuperAdmin 통과 (RolesGuard
  // escalation), User actor 403. 인증 부재 시 JwtAuthGuard 가 401. guard 는
  // FileInterceptor 보다 먼저 실행되므로 미인증/권한 미달 요청은 파일 파싱 전에 차단된다.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_IMPORT_FILE_SIZE_BYTES },
    }),
  )
  async create(
    @UploadedFile() file: UploadedDumpFile | undefined,
    @Body() dto: CreateImportDto,
    @CurrentUser("sub") actorSub: string,
  ): Promise<ImportJob> {
    if (file === undefined) {
      throw new BadRequestException(
        "dump artifact 파일(file) 업로드가 필요합니다 (multipart/form-data).",
      );
    }

    return this.service.createJob({
      mode: dto.mode,
      requestedById: actorSub,
    });
  }

  // GET /api/admin/import/running — 진행 중 (status=RUNNING) import job 목록
  // (UC-07 §8 status polling). 매칭 0 이면 빈 배열 (service findRunning 의 raw
  // forward — 404 변환 0). `:id` 동적 segment 보다 먼저 선언해 "running" 이 :id 로
  // 포착되지 않도록 함.
  //
  // RBAC — Admin+ tier (create 동일).
  @Get("running")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async findRunning(): Promise<ImportJob[]> {
    return this.service.findRunning();
  }

  // GET /api/admin/import/modes — import mode(replace/merge) 선택 dialog 의 사람-친화
  // 설명 목록 조회 (UC-07 §5 step 2 + §6.2, REQ-030 Import mode 선택). 고정 2 mode
  // (Prisma ImportMode enum REPLACE/MERGE) 를 lowercase ImportRestoreMode 로 변환해
  // describeImportMode helper 에 넘기고, 각 mode 의 ImportModeDescription 을 그대로
  // 반환한다 (2 원소: REPLACE→destructive=true / MERGE→destructive=false). client 입력
  // 분기 0 — 항상 알려진 2 종 lowercase mode 만 helper 에 forward (임의 입력 forward 0).
  // persistence / DB write 0, raw 본문 미접근 (REQ-032 유지). `:id` 동적 segment 보다
  // 먼저 선언해 "modes" 가 :id 로 포착되지 않도록 함 (NestJS path matching 순서).
  //
  // RBAC — Admin+ tier (create 동일).
  @Get("modes")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  describeModes(): ImportModeDescription[] {
    // 알려진 2 종 mode 만 enum→lowercase 변환 후 helper 호출 (임의 입력 helper 전달 0).
    return [ImportMode.REPLACE, ImportMode.MERGE].map((mode) =>
      describeImportMode(IMPORT_MODE_ENUM_TO_PAYLOAD[mode]),
    );
  }

  // GET /api/admin/import/:id — 단건 status polling 조회 (UC-07 §8). :id 는 path
  // param raw forward — 부재 시 service 의 findUniqueOrThrow 가 P2025 →
  // NotFoundException(404) 변환, controller 는 swallow 없이 raw propagate.
  //
  // RBAC — Admin+ tier (create 동일).
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  async findJob(@Param("id") id: string): Promise<ImportJob> {
    return this.service.findJob(id);
  }
}
