// ImportController — `/api/admin/import` 의 import job 생성·status polling 조회
// endpoint (T-0489, ADR-0044 §Follow-ups 의 export/import controller 배선 중 Import
// 측 HTTP slice). ExportController (T-0488) 의 controller RBAC stack 1:1 mirror —
// ImportJobService (T-0487) 위에 HTTP-facing layer 를 신설해 Admin 이 평가 자료
// import job 을 생성·조회 (REQ-030 Import, REQ-032 raw 미저장, REQ-045 Admin 전용)
// 하는 경로를 노출한다. 이로써 UC-07 §5 Import 측 HTTP entry 가 코드 차원에서 처음
// 채워진다.
//
// endpoint surface:
//   - POST /api/admin/import          → createJob 후 job runner 로 실 복원을 실행하고
//     그 결과 job 을 반환. **multipart 파일 수신 배선 완료 (ADR-0055 §Decision 1, T-1252)
//     + 크기 상한 강제 (ADR-0055 §Decision 3, T-1253)** — `mode` form field + dump
//     artifact 파일 1 개 (`file`) 를 `FileInterceptor("file", { limits: { fileSize:
//     MAX_IMPORT_FILE_SIZE_BYTES } })` (multer bundled in @nestjs/platform-express,
//     새 dep 0) + `@UploadedFile()` 로 받는다. 크기 상한 초과 시 multer 가
//     `MulterError(LIMIT_FILE_SIZE)` 를 던지고 `MulterExceptionFilter` 가 이를 413
//     Payload Too Large 로 매핑한다 (상한 없는 memoryStorage 의 DoS 표면 차단 —
//     ADR-0055 §Decision 2/3). 파일 누락 시 BadRequestException(400). **복원 엔진 배선
//     완료 (ADR-0055 §Follow-up b, T-1286)** — 받은 buffer 를 `ImportJobRunnerService`
//     에 그대로 넘겨 markRunning → 복원 → markSucceeded 를 요청-응답 안에서 완주하고,
//     그 반환 job (status=SUCCEEDED + restoredRowCount) 을 재가공 없이 돌려준다. 이로써
//     T-1254 의 interim FAILED guard 는 제거됐고 ADR-0055 §Consequences 의 false-success
//     표면은 실 복원 결과로 닫힌다. **응답 envelope 확장 완료 (T-1296)** — 응답 body 는
//     job row 의 필드 전부 + `restoreSummary` (복원 영향 요약) 한 key 로 구성된다
//     (CreateImportResponse). 기존 필드 (`id` / `status` / `mode` / `restoredRowCount` /
//     `artifactRef` / `error`) 는 이름·위치·값 전부 불변이고 요약만 additive 로 얹힌다 —
//     이로써 UC-07 §5 의 "복원 row count + 영향 요약" 이 처음으로 외부 사실이 된다.
//   - POST /api/admin/import/preview  → **복원을 실행하지 않고** 영향 요약만 반환하는
//     dry-run (T-1299). create 와 **똑같은 업로드 수신 stack** 위에서 previewFromDump 만
//     호출한다 — job row 0 · runner 호출 0 · DB write 0. **응답 envelope 확장 완료
//     (T-1302)** — 응답 body 는 요약 3 그룹 (`deleted`/`inserted`/`kept`) + 해석된
//     `mode` 한 key 로 구성된다 (PreviewImportResponse). 요약 수치는 실행 응답의
//     `restoreSummary` 와 같은 타입·같은 값이라 preview ↔ 실행 비교가 그대로 성립하고
//     (UC-07 §5 64 행 confirmation 의 "영향 범위"), client 는 그 수치가 어느 mode 기준인지를
//     응답만으로 알 수 있다 (mode 생략 시 REPLACE 로 조용히 해석되던 것이 외부 사실이 됨).
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
// 책임 경계:
//   - 실 atomic transaction 복원 로직 (REPLACE $transaction / MERGE conflict) 은
//     ImportRestoreService 소유 — controller 는 runner 호출만 한다.
//   - 실패 사유 기록·정제 (markFailed) 는 runner 소유 — controller 는 예외를 삼키지
//     않고 raw propagate 만 한다 (REQ-032 raw 미저장 정합).
//   - 비동기 queue / background worker / 진행률 스트리밍 0 — runner 를 요청-응답 안에서
//     동기적으로 await 한다.
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
import type { RestorePlanSummary } from "../export/import-restore-plan-summary";

import { CreateImportDto } from "./dto/create-import.dto";
import { ImportJobRunnerService } from "./import-job-runner.service";
import { ImportJobService } from "./import-job.service";
import { ImportRestoreService } from "./import-restore.service";
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

// MISSING_DUMP_FILE_MESSAGE — dump artifact 파일 누락 400 의 문구 (T-1299). create 와
// preview 가 같은 업로드 수신 stack 을 쓰므로 문구도 같아야 하는데, 리터럴 사본을 두면
// 한쪽만 고쳐지는 drift 표면이 생긴다 — 상수 1 개를 양쪽이 참조한다. 값은 create 가 종전에
// 쓰던 문구 **그대로** 라 기존 spec · e2e 단언은 한 글자도 바뀌지 않는다.
const MISSING_DUMP_FILE_MESSAGE =
  "dump artifact 파일(file) 업로드가 필요합니다 (multipart/form-data).";

// Prisma ImportMode enum(uppercase REPLACE/MERGE) ↔ describeImportMode helper 가
// 요구하는 lowercase ImportRestoreMode("replace"/"merge") 매핑. prisma/schema.prisma
// 의 enum ImportMode 가 source 이고, helper 는 import-restore-plan.ts 의
// ImportRestoreMode lowercase literal 을 요구한다 — 본 상수가 그 대소문자 차이를
// 흡수한다(schema·helper 변경 0, ExportJobService.SCOPE_ENUM_TO_PAYLOAD 패턴 mirror).
const IMPORT_MODE_ENUM_TO_PAYLOAD: Record<ImportMode, ImportRestoreMode> = {
  [ImportMode.REPLACE]: "replace",
  [ImportMode.MERGE]: "merge",
};

// CreateImportResponse — POST /api/admin/import 의 응답 shape (T-1296). 마감된 job row 의
// 필드를 그대로 펼친 위에 복원 영향 요약 (`restoreSummary`) 한 key 만 **추가** 한 additive
// envelope 다.
//
// `{ job, summary }` 중첩 대신 spread 를 택한 근거: 중첩은 기존 client 와 e2e 3 종이 읽던
// `body.status` / `body.restoredRowCount` 를 전부 `body.job.*` 로 옮기는 breaking change 라
// 파급이 크다. spread 는 기존 필드의 이름·위치·값을 하나도 건드리지 않으므로 요약을 모르는
// 소비자는 종전과 동일하게 동작한다 (additive 확장).
//
// `restoreSummary` 는 runner 가 준 인스턴스 그대로다 — 복제 · 재계산 · 필드 pick · 반올림 0.
// `restoredRowCount` 도 job row 의 값 그대로이며 `restoreSummary.inserted.total` 로 덮어쓰거나
// 두 값의 일치를 강제하지 않는다 (조용한 의미 변경 금지 — T-1294 / T-1295 판단 유지).
export interface CreateImportResponse extends ImportJob {
  restoreSummary: RestorePlanSummary;
}

// PreviewImportResponse — POST /api/admin/import/preview 의 응답 shape (T-1302).
// `RestorePlanSummary` 3 그룹을 그대로 펼친 위에 **해석된 mode** 한 key 만 추가한 additive
// envelope 다 (key 집합은 정확히 deleted/inserted/kept/mode 4 개).
//
// `{ mode, summary }` 중첩 대신 spread 를 택한 근거: preview 응답은 실행 응답의
// `restoreSummary` 와 **타입이 대응** 해야 한다 — e2e 가 두 수치를 직접 비교하고 (section H),
// client 도 confirmation 에서 같은 reader 로 두 값을 읽는다. 중첩은 그 대응을 깨서
// `preview.body.summary.deleted` vs `executed.body.restoreSummary.deleted` 로 경로를
// 갈라놓는다. spread 는 요약 key 의 이름·위치·값을 하나도 건드리지 않으므로 mode 를 모르는
// 소비자는 종전과 동일하게 동작한다 (CreateImportResponse 의 additive spread 선례 정합).
//
// 요약 3 그룹은 service 인스턴스에서 온 값 그대로다 — 복제 후 필드 pick · 재계산 · 반올림 ·
// 개명 0. `mode` 가 요약 key 를 덮지 않으며 wrapper 도 추가하지 않는다.
export interface PreviewImportResponse extends RestorePlanSummary {
  mode: ImportMode;
}

@Controller("api/admin/import")
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ImportController {
  // ImportJobRunnerService · ImportRestoreService 는 **값 import** 로 주입한다
  // (`import type` 금지 — DI 메타데이터가 소거되어 Nest 가 의존을 해석하지 못한다).
  // 등록은 T-1285 (runner) · T-1282 (restore) 가 이미 import.module.ts 의
  // providers·exports 에 마쳤다 (본 slice 의 module 수정 0).
  constructor(
    private readonly service: ImportJobService,
    private readonly runner: ImportJobRunnerService,
    private readonly restore: ImportRestoreService,
  ) {}

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
  // 본문 3 단계 (ADR-0055 §Follow-up b 배선 완료, T-1286):
  //   (1) 파일 검증 — file 이 undefined 면 BadRequestException(400) 으로 거부한다 (dump
  //       artifact 없이 import 진행 불가). **controller 자체 분기는 이 하나뿐**이며
  //       createJob · runJob 은 둘 다 미호출로 남는다.
  //   (2) createJob({ mode: dto.mode, requestedById }) — job record(PENDING) 생성. mode
  //       미지정 시 dto.mode 가 undefined 로 forward 되어 service 가 schema
  //       @default(REPLACE) 를 적용한다.
  //   (3) runner.runJob({ jobId, buffer, mode, artifactRef }) — markRunning → dump 복원
  //       → markSucceeded 를 runner 가 합성하고, 그 반환 `{ job, summary }` 를 spread 로
  //       조립해 돌려준다 (CreateImportResponse). `artifactRef` 는 업로드 파일명
  //       (file.originalname), `mode` 는 dto 가 아니라 **생성된 job row 의 확정값**
  //       (job.mode — schema @default 적용 후) 을 쓴다. buffer 는 복사·slice 없이 같은
  //       인스턴스로 넘긴다.
  //
  // 예외 정책 — createJob 의 mode invariant 400 / 진행 중 race 409, runJob 의 dump 파싱
  // 실패 400 등은 전부 **raw propagate** 한다 (재랩핑·try/catch 0). 실패 사유 기록은
  // runner 의 recordFailure 몫이라 controller 는 markFailed 를 호출하지 않는다.
  //
  // 동기 실행 — runJob 을 요청-응답 안에서 await 한다 (queue / background worker 0).
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
  ): Promise<CreateImportResponse> {
    if (file === undefined) {
      throw new BadRequestException(MISSING_DUMP_FILE_MESSAGE);
    }

    // 파일 수신·크기 검증 통과 후 job record (status=PENDING) 를 생성한다. createJob 이
    // ConflictException(진행 중 race) / BadRequestException(mode invariant) 등을 던지면
    // 아래 runJob 은 미도달이며 예외가 그대로 raw propagate 된다.
    const job = await this.service.createJob({
      mode: dto.mode,
      requestedById: actorSub,
    });

    // 실 복원 실행 (ADR-0055 §Follow-up b) — runner 가 markRunning → restoreFromDump →
    // markSucceeded 를 합성한다. mode 는 dto.mode 가 아니라 생성된 row 의 job.mode 를
    // 쓴다 (schema @default(REPLACE) 가 적용된 확정값이 source). buffer 는 재가공 없이
    // 같은 인스턴스로, artifactRef 는 업로드 파일명 그대로 넘긴다. 복원 실패 시 runner 가
    // 사유를 기록한 뒤 원본 error 를 재throw 하므로 controller 는 삼키지 않는다.
    const result = await this.runner.runJob({
      jobId: job.id,
      buffer: file.buffer,
      mode: job.mode,
      artifactRef: file.originalname,
    });

    // 응답 조립 (T-1296) — runner 가 준 `{ job, summary }` 를 job 필드 spread + 요약 1 key
    // 로 펼친다. 기존 필드는 이름·값 그대로이고 `restoreSummary` 만 additive 로 얹히므로
    // 요약을 모르는 client 는 종전과 동일하게 동작한다 (중첩 envelope 를 택하지 않은 근거는
    // CreateImportResponse 선언부 주석). 요약은 runner 인스턴스를 그대로 싣는다 — 복제 ·
    // 재계산 0. runner 계약상 `summary` 는 성공 경로에서 항상 존재하므로 fallback 분기
    // (`?? {}` · optional chaining) 를 두지 않는다 (controller 자체 분기는 파일 누락 400
    // 하나뿐이라는 계약 유지). 이 지점이 UC-07 §5 의 "영향 요약" 이 외부 사실이 되는 곳이다.
    return { ...result.job, restoreSummary: result.summary };
  }

  // POST /api/admin/import/preview — 복원을 실행하지 않고 영향 요약만 내는 dry-run
  // (T-1299, UC-07 §5 sequence 64 행 confirmation 의 "영향 범위"). decorator stack 과
  // 업로드 수신 계약은 create 와 **동일** 하므로 그 근거 (FileInterceptor 상한 ·
  // MulterExceptionFilter 413 매핑 · @UploadedFile 타이핑 · Admin+ tier) 를 반복하지
  // 않는다 — create 의 주석이 정본이다. 차이만 적는다: job row 미생성 (`createJob` 미호출
  // — dry-run 이 ImportJob 을 남길 이유가 없다, T-1297 판단 유지) · runner 미호출
  // (markRunning/markSucceeded 전이 0) · transaction 미개시 (previewFromDump 가
  // `$transaction` 을 아예 열지 않는다 — UC-07 §7.4 "transaction 시작 전 reject" 와 동형) ·
  // @CurrentUser 미결합 (발화자를 기록할 row 자체가 없다. 인증·RBAC 는 guard 가 강제).
  //
  // 본문 3 단계 — (1) file 이 undefined 면 400 (create 와 같은 상수 문구), (2) mode 해석
  // (아래 REPLACE fallback 근거 참조), (3) previewFromDump(file.buffer, mode) 의 요약에
  // 해석된 mode 를 얹어 반환 (T-1302). 요약 3 그룹의 **값** 은 service 가 준 그대로다
  // (재계산 · 필드 pick · 반올림 0) — 실행 응답의 `restoreSummary` 와 같은 수치여야
  // preview ↔ 실행 비교가 성립한다. 거부 verdict 400 · read 단계 TypeError 는 **raw
  // propagate** (재랩핑 · try/catch 0 — echo 조립은 성공 경로에만 있다).
  @Post("preview")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("Admin")
  @UseFilters(MulterExceptionFilter)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: MAX_IMPORT_FILE_SIZE_BYTES },
    }),
  )
  async preview(
    @UploadedFile() file: UploadedDumpFile | undefined,
    @Body() dto: CreateImportDto,
  ): Promise<PreviewImportResponse> {
    if (file === undefined) {
      throw new BadRequestException(MISSING_DUMP_FILE_MESSAGE);
    }

    // mode 미지정 시 ImportMode.REPLACE 로 해석한다. create 경로는 mode 를 undefined 로
    // forward 해 job row 생성 시 schema 의 `@default(REPLACE)` 가 적용되지만, preview 는
    // row 를 만들지 않아 그 default 가 적용될 자리가 없다 — 여기서 같은 값을 명시해야
    // preview 수치와 실행 후 수치가 **같은 mode 기준** 이 된다. 즉 본 fallback 은
    // prisma/schema.prisma 의 `enum ImportMode` default mirror 이며, schema default 가
    // 바뀌는데 여기가 안 바뀌면 두 경로가 조용히 어긋난다 (drift 지점 — 함께 고칠 것).
    // 이 `mode` 상수 하나가 service 인자와 응답 key 양쪽의 **유일한 source** 다 (T-1302) —
    // 아래에서 dto.mode 를 다시 참조하거나 문자열로 재조립하지 않는다. 두 곳이 각자 해석하면
    // "요약의 기준 mode" 와 "응답이 주장하는 mode" 가 어긋날 수 있는데, 같은 변수를 쓰는 한
    // 그 어긋남은 구조적으로 불가능하다.
    const mode = dto.mode ?? ImportMode.REPLACE;

    const summary = await this.restore.previewFromDump(file.buffer, mode);

    // 응답 조립 (T-1302) — 요약 3 그룹을 펼친 뒤 해석된 mode 1 key 만 얹는다. 요약 값은
    // 손대지 않으므로 `restoreSummary` 와의 수치 비교 계약이 그대로 유지된다 (근거는
    // PreviewImportResponse 선언부 주석). spread 는 얕은 복사라 각 그룹 객체는 service
    // 인스턴스를 그대로 참조한다 — 그룹 내부 재계산 0.
    return { ...summary, mode };
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
