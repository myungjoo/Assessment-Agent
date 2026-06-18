// ExportJobService — ExportJob 의 생성·status 전이·polling 조회 persistence service
// (T-0486, ADR-0044 §Follow-ups 두 번째 항목의 dependency-order 첫 slice).
//
// 위상 (P7 export/import 실 배선 chain step3):
//   - step1 (T-0484, ADR-0044) 이 ExportJob/ImportJob 영속 데이터 모델을 박제하고,
//     step2 (T-0485) 가 prisma/schema.prisma 에 model ExportJob + enum + migration 을
//     merge 했다. 본 service 가 그 entity 를 실제로 읽고 쓰는 첫 코드다.
//   - UC-07 §8 NFR 의 "async job + status polling" backbone 을 코드 차원에서 채운다 —
//     생성(createJob) → status 전이(markRunning/markSucceeded/markFailed) → 조회
//     (findJob/findRunning) 의 ExportJob 생명주기를 PrismaService 위에 얇게 wrapping.
//
// 책임 경계 (task §Out of Scope):
//   - export controller / DTO (GET /api/admin/export) 배선 — 후속 task.
//   - ImportJobService (atomic transaction §3) — 후속 task (대칭이나 별도 slice).
//   - 45 helper (T-0437~T-0483) 실호출 배선 (chunked streaming·dedup) — 후속 chain.
//   - module 등록 (ExportModule / AssessmentModule 편입) — 후속 task (본 task 는 class +
//     spec 만; 미등록이어도 unit test 통과).
//   - 실 dump 직렬화 (DB row → artifact) — 본 service 는 status/artifactRef record 만.
//
// Prisma error 정책 (person.service.ts 컨벤션 mirror):
//   - findJob / mark* 가 row 부재 시 Prisma 의 P2025 (record not found) 를
//     NotFoundException 으로 변환한다. 그 외 known error code 는 그대로 propagate.
//   - raw 미저장 invariant (ADR-0044 §2) — createJob 의 input 에 raw payload 필드 자체가
//     없다. error 는 사람-친화 short message 만 record (raw stack trace 미저장).
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ExportScope, Prisma, type ExportJob } from "@prisma/client";

import { PrismaService } from "../persistence/prisma.service";

// buildExportChunkPlan(T-0469) + ExportChunkPlan 타입을 same-folder 경로
// (`./export-chunk-plan`)로 import 해 previewSelection 응답에 chunkPlan 으로 surface 한다
// (barrel re-export·alias 신설 0 — buildExportJobPlan/buildExportResult import 패턴 mirror).
// ExportChunkPlan 은 service interface(ExportSelectionPreview) 가 그대로 재노출한다.
import {
  buildExportChunkPlan,
  type ExportChunkPlan,
} from "./export-chunk-plan";
import {
  estimateExportDumpSize,
  type ExportDumpSizeEstimate,
} from "./export-dump-size-estimate";
// buildExportJobPlan(T-0467) + ExportJobPlan 타입을 same-folder 경로(`./export-job-plan`)로
// import 해 previewSelection 응답에 deliveryPlan 으로 surface 한다(barrel re-export·alias 신설
// 0). ExportJobPlan 은 service interface(ExportSelectionPreview) 가 그대로 재노출한다.
import { buildExportJobPlan, type ExportJobPlan } from "./export-job-plan";
// buildExportResult(T-0456) + ExportResult 타입을 same-folder 경로(`./export-result`)로
// import 해 previewSelection 응답에 completionResult 로 surface 한다(barrel re-export·alias
// 신설 0 — buildExportJobPlan import 패턴 mirror). ExportResult 는 service interface
// (ExportSelectionPreview) 가 그대로 재노출한다.
import { buildExportResult, type ExportResult } from "./export-result";
import { buildExportScopeRejection } from "./export-scope-rejection-message";
import {
  selectExportRecords,
  VALID_EXPORT_ENTITIES,
  type ExportEntity,
  type ExportRecord,
  type ExportScope as ExportScopePayload,
} from "./export-scope-select";
import { validateExportScope } from "./export-scope-validate";
import {
  summarizeExportSelection,
  type ExportSelectionSummary,
} from "./export-selection-summary";

// Prisma known error helper — `code` field 가 known request error 의 식별자.
// 실 PrismaClientKnownRequestError 인스턴스 생성 cost 를 회피하고 duck typing 으로
// code 만 추출한다 (전 service 의 동일 helper 패턴 mirror — person.service.ts 등).
function getPrismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

// CreateExportJobInput — createJob 의 입력 shape. raw payload 필드 0 (ADR-0044 §2 —
// ExportJob 의 어떤 필드도 raw 외부 본문을 보유하지 않으며 input 도 동일).
//   - scope — dump 범위 (FULL / RANGE / PARTIAL).
//   - requestedById — 발화한 User FK scalar (REQ-045 Admin, ADR-0044 §1 누가 dump 를
//     일으켰는지 추적).
//   - dateRange — scope=RANGE 시 기간 한정값 (Json 직렬화). 구체 shape 은 후속 task.
//   - entitySelector — scope=PARTIAL 시 entity·인원 한정값 (Json 직렬화).
export interface CreateExportJobInput {
  scope: ExportScope;
  requestedById: string;
  dateRange?: unknown;
  entitySelector?: unknown;
}

// Prisma ExportScope enum(uppercase) ↔ validateExportScope helper payload 의 lowercase
// scope literal 매핑. prisma/schema.prisma 의 enum ExportScope(FULL/RANGE/PARTIAL) 가
// source 이고, helper 는 export-scope-select.ts 의 ExportScope["scope"]("full"/"range"/
// "partial") 를 요구한다 — 본 상수가 그 대소문자·형태 차이를 흡수한다(schema 변경 0).
const SCOPE_ENUM_TO_PAYLOAD: Record<ExportScope, string> = {
  [ExportScope.FULL]: "full",
  [ExportScope.RANGE]: "range",
  [ExportScope.PARTIAL]: "partial",
};

// EXPORT_ENTITY_SOURCES — 5 ExportEntity(UC-07 §6.1 entitySelector 목록) → Prisma
// model delegate accessor + instant 컬럼 매핑표 (T-0497 architect 결정, ADR-0044 §1
// dump 대상 entity 정합). ExportEntity union 의 5 literal 과 Prisma model 이름이 일부
// 다른(LlmConfig→LlmProviderConfig, AuditLog→PermissionDeniedRecord) 차이를 본 표가
// 흡수한다(schema·helper 변경 0 — SCOPE_ENUM_TO_PAYLOAD 패턴 mirror).
//
// instant 컬럼 결정(UC-07 §6.1 range scope [start,end) 판정의 "record 가 생성/발생한
// 시각" 의미 정합): 5 model 모두 `createdAt`(row 생성 시각)을 instant 로 쓴다 —
// Assessment 는 평가 record 생성, Person/Group/LlmProviderConfig 는 master record 생성,
// PermissionDeniedRecord(=AuditLog) 는 감사 사건 발생 시각으로 모두 createdAt 이 자연.
//
// Record<ExportEntity, ...> 타입 강제 — ExportEntity union 에 새 entity 가 추가되면
// 본 표가 컴파일 단계에서 누락을 catch(R-112 negative — entity 확장 회귀 방지).
//
// 🔥 REQ-032 projection-only — value 의 `instantColumn` 만 Prisma `select` 로 read 하고
// 전체 row·raw 본문 컬럼은 select 하지 않는다(아래 previewSelection 의 findMany select).
const EXPORT_ENTITY_SOURCES: Record<
  ExportEntity,
  { delegate: ExportEntityDelegate; instantColumn: string }
> = {
  Assessment: { delegate: "assessment", instantColumn: "createdAt" },
  Person: { delegate: "person", instantColumn: "createdAt" },
  Group: { delegate: "group", instantColumn: "createdAt" },
  LlmConfig: { delegate: "llmProviderConfig", instantColumn: "createdAt" },
  AuditLog: { delegate: "permissionDeniedRecord", instantColumn: "createdAt" },
};

// previewSelection 이 read 하는 PrismaService delegate 이름 union — findMany({ select })
// projection-only read 만 사용한다. 본 union 으로 EXPORT_ENTITY_SOURCES 의 delegate 값을
// 컴파일 차원에서 PrismaService 의 실 accessor 로 제약한다.
type ExportEntityDelegate =
  | "assessment"
  | "person"
  | "group"
  | "llmProviderConfig"
  | "permissionDeniedRecord";

// DEFAULT_EXPORT_CHUNK_SIZE_BYTES — chunked streaming 분할 단위(1 MB). buildExportChunkPlan
// (T-0469)이 chunkSizeBytes 를 필수 양의 정수 인자로 요구하므로 본 service 가 module-level
// 상수로 박제해 전달한다. 정책 source 0 — 인자로 받은 값만 분할에 쓰며, 정책 row · ENV 기반
// 동적 chunk size 결정·주입은 별도 task(T-0503 §Follow-ups)다(직전 step T-0501 의
// DEFAULT_CHUNK_THRESHOLD_BYTES / DEFAULT_POLL_INTERVAL_SECONDS default 상수 패턴 mirror).
// 주의: buildExportJobPlan 의 chunkThreshold(전달 여부 판정)와 본 상수(분할 단위)는 다른 축이다.
const DEFAULT_EXPORT_CHUNK_SIZE_BYTES = 1024 * 1024;

// ExportSelectionPreview — previewSelection 의 반환 shape. 전체 row·raw payload 미반환,
// count 요약만(REQ-032 — 선별된 실 record 데이터 노출 0).
//   - perEntitySelected 는 5 entity 별 selected count breakdown(사람-친화 미리보기용).
//     summarizeExportSelection 배선(T-0499) 이후 selectedCount/excludedCount/
//     perEntitySelected 는 각각 summary.selected.total / summary.excluded.total /
//     summary.selected.perEntity 와 1:1 mirror 이며 backward-compat 위해 유지한다
//     (중복 제거는 별도 refactor task — 본 task §Follow-ups).
//   - summary 는 summarizeExportSelection(T-0449 helper) 산출 — selected/excluded 두
//     그룹 각각의 total + perEntity(5 entity 0-init) + instantRange{earliest,latest}|null
//     을 노출(UC-07 §3 trigger 1 confirmation dialog / §8 (b) Audit row 의 breakdown).
//     excluded 측 perEntity breakdown 과 양 그룹의 instant 시간 범위가 본 필드로 처음
//     노출된다(기존 perEntitySelected 는 selected 측만 cover 했음).
//   - sizeEstimate 는 estimateExportDumpSize(T-0466 helper) 산출 — selected record 를
//     entity-별 byte weight 로 추정한 예상 dump 크기(estimatedBytes/humanSize/recordTotal/
//     perEntityBytes(5 entity 0-init)/large/recommendation/guidanceLines)를 노출한다
//     (UC-07 §8 NFR 동기/async-streaming 권고 + §3 trigger 1 confirmation dialog 의 규모
//     안내). selection 만 derivation 하므로 추가 DB read 0(REQ-032 raw 미저장 자연 유지).
//     append-only 확장 — 기존 4 필드는 불변(backward-compat).
//   - deliveryPlan 은 buildExportJobPlan(T-0467 helper) 산출 — sizeEstimate(예상 dump 크기 +
//     recommendation)를 입력으로 "그럼 실제로 어떻게 전달할 것인가" 의 실행 plan 을 derive
//     한다(mode('sync-download'|'async-job')/chunked/pollingRequired/statusFlow/headline/
//     instructionLines). UC-07 §8 NFR(대량 dump 는 async job + status polling + chunked
//     streaming) + §3 trigger 1 confirmation dialog + §5 step 13 다운로드 완료 안내가 요구하는
//     "sync 다운로드인가 async job 인가, 어떤 단계를 거치는가" 를 처음 노출한다. helper 는
//     sizeEstimate 만 derivation 하므로 추가 DB read 0(REQ-032 derivation-only 자연 유지).
//     append-only 확장 — 기존 5 필드는 불변(backward-compat).
export interface ExportSelectionPreview {
  selectedCount: number;
  excludedCount: number;
  perEntitySelected: Record<ExportEntity, number>;
  summary: ExportSelectionSummary;
  sizeEstimate: ExportDumpSizeEstimate;
  deliveryPlan: ExportJobPlan;
  // completionResult 는 buildExportResult(T-0456) 산출 — 이미 산출된 summary 와 인자 scope 를
  // 그대로 forward 해 "이 scope 로 무엇이 export 되는가" 의 사람-친화 완료 결과(headline/
  // exportedCounts/impactLines/scopeLine)를 derive 한다(UC-07 §5 step 13 + §8 (a) 정합).
  // helper 는 summary/scope 만 derivation 하므로 추가 DB read 0(REQ-032 derivation-only).
  // append-only 확장 — 기존 6 필드는 불변(backward-compat).
  completionResult: ExportResult;
  // chunkPlan 은 buildExportChunkPlan(T-0469) 산출 — deliveryPlan.chunked === true(대량 dump)
  // 일 때만 sizeEstimate 의 estimatedBytes 를 DEFAULT_EXPORT_CHUNK_SIZE_BYTES 단위로 분할한
  // chunk 경계 plan(totalBytes/chunkSizeBytes/chunkCount/chunks/lastChunkSizeBytes/headline)을
  // derive 하고, chunked === false(sync 다운로드 — chunk 불요)면 null 이다(UC-07 §5 step 13 +
  // §8 NFR chunked streaming chunk 경계 정합). helper 는 sizeEstimate + 상수만 derivation 하므로
  // 추가 DB read 0(REQ-032 derivation-only). append-only 확장 — 기존 7 필드는 불변(backward-compat).
  chunkPlan: ExportChunkPlan | null;
}

@Injectable()
export class ExportJobService {
  constructor(private readonly prisma: PrismaService) {}

  // createJob — status=PENDING ExportJob row 를 생성한다.
  // scope 검증 책임 (schema 주석 L549 "service-layer 가 값 invariant 검증 책임"):
  //   - requestedById 가 비었으면 BadRequestException (FK 발화자 필수). 이 축은 scope
  //     payload 가 아닌 발화자 식별 책임이라 helper(validateExportScope) 가 다루지 않으므로
  //     본 service 가 helper 호출 전에 먼저 검증한다 (책임 분리 — 둘 다 400 이지만 별 분기).
  //   - 그 외 scope/dateRange/entitySelector 의 field-level 유효성은 validateExportScope
  //     (T-0444) 순수 helper 에 위임 (UC-07 §6.1 3 차원 옵션 — scope enum / range 의 반열림
  //     start<end / partial 의 entity 멤버십 / AND 조합). helper 가 { valid:false } 면 그
  //     verdict 를 buildExportScopeRejection(T-0463) 에 그대로 forward 해 §7.3 구조화 reject
  //     메시지(headline + field 별 묶음 detailLines)로 BadRequestException(400) — raw stack
  //     미포함(REQ-032).
  async createJob(input: CreateExportJobInput): Promise<ExportJob> {
    if (!input.requestedById) {
      throw new BadRequestException(
        "requestedById 는 필수입니다 (누가 dump 를 발화했는지 추적).",
      );
    }

    // scope/dateRange/entitySelector field-level 검증을 helper 에 위임 (T-0444 배선).
    const verdict = validateExportScope(this.toScopePayload(input));
    if (!verdict.valid) {
      // ad-hoc field+message join 대신 buildExportScopeRejection(T-0463) 실호출 —
      // UC-07 §7.3 의 구조화 reject 메시지(headline + field 별 묶음 detailLines +
      // 재입력 guidance)로 교체. verdict 는 타입 동일(ExportScopeValidation)이라 변환 없이
      // 그대로 forward. raw verdict.errors 객체·stack 을 메시지에 직렬화하지 않는다(REQ-032).
      const rejection = buildExportScopeRejection(verdict);
      throw new BadRequestException(
        [rejection.headline, ...rejection.detailLines].join("\n"),
      );
    }

    return this.prisma.exportJob.create({
      data: {
        scope: input.scope,
        requestedById: input.requestedById,
        // null 정규화 — scope 별 미사용 축은 명시적 null (schema nullable Json?).
        dateRange: this.toJsonOrNull(input.dateRange),
        entitySelector: this.toJsonOrNull(input.entitySelector),
      },
    });
  }

  // markRunning — PENDING → RUNNING 전이 + startedAt 기록 (ADR-0044 §1 실 실행 시작 시각).
  // row 부재 시 P2025 → NotFoundException.
  async markRunning(id: string): Promise<ExportJob> {
    return this.updateOrThrow(id, {
      status: "RUNNING",
      startedAt: new Date(),
    });
  }

  // markSucceeded — RUNNING → SUCCEEDED 전이 + finishedAt + artifactRef 기록.
  // artifactRef 는 dump artifact 의 참조 식별자 (raw 본문 아님, ADR-0044 §2).
  async markSucceeded(id: string, artifactRef: string): Promise<ExportJob> {
    return this.updateOrThrow(id, {
      status: "SUCCEEDED",
      finishedAt: new Date(),
      artifactRef,
    });
  }

  // markFailed — RUNNING → FAILED 전이 + finishedAt + error 기록.
  // error 는 사람-친화 short message 만 (raw stack trace 미저장, ADR-0044 §2).
  async markFailed(id: string, error: string): Promise<ExportJob> {
    return this.updateOrThrow(id, {
      status: "FAILED",
      finishedAt: new Date(),
      error,
    });
  }

  // findJob — 단건 polling 조회. row 부재 시 findUniqueOrThrow 가 P2025 throw →
  // NotFoundException 변환 (UC-07 §8 status polling 의 단건 조회).
  async findJob(id: string): Promise<ExportJob> {
    try {
      return await this.prisma.exportJob.findUniqueOrThrow({ where: { id } });
    } catch (error) {
      throw this.mapNotFound(error, id);
    }
  }

  // findRunning — status=RUNNING ExportJob 목록 (UC-07 §8 status polling — 진행 중 job).
  // 매칭 0 이면 빈 배열 반환 (Prisma findMany native 동작).
  async findRunning(): Promise<ExportJob[]> {
    return this.prisma.exportJob.findMany({ where: { status: "RUNNING" } });
  }

  // previewSelection — selectExportRecords(T-0437 순수 helper) 를 실 DB read path 에
  // 배선하는 read-only preview (UC-07 §6.1 scope 선별 + REQ-032 projection-only).
  // (1) 5 entity 에서 `{instant}` projection 만 Prisma findMany({ select }) 로 모아
  //     ExportRecord[] 로 조립(전체 row·raw 미조회 — REQ-032), (2) selectExportRecords
  //     실호출로 selected/excluded 분류, (3) count 요약만 반환(실 record payload 0).
  // DB write 0 — job record 생성·status 전이와 무관한 순수 조회. scope 검증(범위 누락 등)
  // 은 helper 가 RangeError/TypeError 로 throw 하며 본 메서드는 swallow 없이 propagate
  // (describe-scope 의 raw-forward 정책과 일관 — controller 가 service 호출 전 변환만 함).
  async previewSelection(
    scope: ExportScopePayload,
  ): Promise<ExportSelectionPreview> {
    // 5 entity 의 instant projection 을 병렬 read 후 ExportRecord[] 로 평탄화.
    const records = await this.collectExportRecords();

    // selectExportRecords 실호출(T-0437 helper 배선) — scope 규칙으로 selected/excluded
    // 분류. scope invariant 위반(range+dateRange 누락 등)은 helper 가 throw → propagate.
    const selection = selectExportRecords(scope, records);
    const { selected, excluded } = selection;

    // summarizeExportSelection 실호출(T-0449 helper 배선, T-0499) — selectExportRecords
    // 가 산출한 ExportSelection 을 그대로 forward 해 selected/excluded 두 그룹 각각의
    // total + perEntity(5 entity) + instantRange 를 derive 한다(UC-07 §3 trigger 1 /
    // §8 (b) confirmation·audit breakdown 정합). helper 는 입력 selection 만 집계하므로
    // 추가 DB read 0 — REQ-032 raw 미저장은 derivation-only 라 자연 유지된다. 입력은 항상
    // selectExportRecords 통과 selection(selected/excluded 가 ExportRecord[] 배열)이라
    // helper 의 입력 방어 분기(TypeError)는 정상 경로에서 미발화한다.
    const summary = summarizeExportSelection(selection);

    // estimateExportDumpSize 실호출(T-0466 helper 배선) — 동일 selection 을 그대로
    // forward 해 selected record 의 예상 dump 크기 + async 임계 판정 + 한국어 안내를
    // derive 한다(UC-07 §8 NFR sync/async-streaming 권고 + §3 trigger 1 confirmation
    // dialog 의 규모 안내 정합). byte weight / async 임계는 helper default 로 호출한다
    // (옵션 미전달 — 정책 row · ENV 기반 동적 주입은 별도 task §Follow-ups). helper 는
    // 입력 selection 만 집계하므로 추가 DB read 0(REQ-032 derivation-only 자연 유지).
    // 입력은 항상 selectExportRecords 통과 selection(selected/excluded 가 ExportRecord[]
    // 배열)이라 helper 의 입력 방어 분기(TypeError)는 정상 경로에서 미발화한다.
    const sizeEstimate = estimateExportDumpSize(selection);

    // buildExportJobPlan 실호출(T-0467 helper 배선) — 위에서 산출된 sizeEstimate 를 그대로
    // forward 해 Export 다운로드 실행 plan(mode/chunked/pollingRequired/statusFlow/headline/
    // instructionLines)을 derive 한다(UC-07 §8 NFR sync 다운로드 vs async job + status polling
    // + chunked streaming + §3 trigger 1 confirmation dialog / §5 step 13 다운로드 완료 안내
    // 정합). chunk 임계 / poll 간격은 helper default(options 미전달 — DEFAULT_CHUNK_THRESHOLD_
    // BYTES 5MB / DEFAULT_POLL_INTERVAL_SECONDS 3s)로 호출한다(정책 row · ENV 기반 동적 주입은
    // 별도 task §Follow-ups). helper 는 입력 sizeEstimate 만 derivation 하므로 추가 DB read 0
    // (REQ-032 derivation-only 자연 유지 — estimate descriptor 만 derive, raw payload 0). 입력
    // sizeEstimate 는 항상 estimateExportDumpSize 산출(recommendation 은 sync/async-streaming ·
    // estimatedBytes 는 비-음수 정수)이라 helper 입력 방어 분기(RangeError/TypeError)는 정상
    // 경로에서 미발화한다.
    const deliveryPlan = buildExportJobPlan(sizeEstimate);

    // buildExportResult 실호출(T-0456 helper 배선) — 이미 산출된 summary(ExportSelectionSummary)
    // 와 인자로 받은 scope 를 그대로 forward 해 "이 scope 로 무엇이 실제로 export 되는가" 의
    // 사람-친화 완료 결과(headline 다운로드 완료 메시지 / exportedCounts / entity-별 impactLines /
    // scopeLine)를 derive 한다(UC-07 §5 step 13 다운로드 완료 결과 + §8 (a) Export postcondition
    // scope 요약·entity-별 영향·row count 정합). scope 인자는 ExportScopePayload 가 ExportScope
    // (T-0437)의 별칭(line 48)이라 추가 변환·매핑 없이 그대로 전달 가능(buildExportResult 가
    // 기대하는 ExportScope 와 동일 타입). helper 는 입력 summary/scope 만 derivation 하므로 추가
    // DB read 0(REQ-032 derivation-only 자연 유지 — result message 만 derive, raw payload 0).
    // 입력 summary 는 항상 summarizeExportSelection 통과 산출(selected/excluded 두 그룹의 total +
    // perEntity breakdown 보유)이고 scope 는 selectExportRecords 가 이미 검증한 full/range/partial
    // 이라, helper 의 입력 방어 분기(RangeError/TypeError)는 정상 경로에서 미발화한다.
    const completionResult = buildExportResult(summary, scope);

    // buildExportChunkPlan 실호출(T-0469 helper 배선) — deliveryPlan.chunked === true(대량 dump)
    // 일 때만 sizeEstimate 를 DEFAULT_EXPORT_CHUNK_SIZE_BYTES 단위로 분할한 chunk 경계 plan 을
    // derive 하고, chunked === false(sync 다운로드 — chunk 불요)면 null 로 둔다(UC-07 §5 step 13
    // 다운로드 + §8 NFR chunked streaming chunk 경계 정합). chunkSizeBytes 는 default 상수 사용
    // (정책 row · ENV 기반 동적 주입은 별도 task §Follow-ups — 직전 step T-0501 의 default 상수
    // 패턴 mirror). helper 는 입력 sizeEstimate + 상수만 derivation 하므로 추가 DB read 0
    // (REQ-032 derivation-only 자연 유지 — chunk 경계만 산술 derive, raw payload 0). 입력
    // sizeEstimate.estimatedBytes 는 항상 estimateExportDumpSize 산출(비-음수 정수)이고
    // chunkSizeBytes 는 양의 정수 상수라, helper 의 입력 방어 분기(RangeError/TypeError)는 정상
    // 경로에서 미발화한다.
    const chunkPlan = deliveryPlan.chunked
      ? buildExportChunkPlan(sizeEstimate, DEFAULT_EXPORT_CHUNK_SIZE_BYTES)
      : null;

    // selected 의 entity 별 count breakdown — 5 entity 0 초기화 후 누적(미선택 entity 는 0).
    // summary.selected.perEntity 와 동일 값이나 backward-compat 위해 기존 필드 유지.
    const perEntitySelected = VALID_EXPORT_ENTITIES.reduce(
      (acc, entity) => {
        acc[entity] = 0;
        return acc;
      },
      {} as Record<ExportEntity, number>,
    );
    for (const record of selected) {
      perEntitySelected[record.entity] += 1;
    }

    return {
      selectedCount: selected.length,
      excludedCount: excluded.length,
      perEntitySelected,
      summary,
      sizeEstimate,
      deliveryPlan,
      completionResult,
      chunkPlan,
    };
  }

  // --- private helpers ---

  // collectExportRecords — 5 entity 에서 instant 컬럼만 projection read 후 ExportRecord[]
  // 로 평탄화. EXPORT_ENTITY_SOURCES 매핑표를 돌며 각 delegate.findMany({ select:
  // { <instantColumn>: true } }) 로 전체 row·raw 미조회(REQ-032)하고, entity literal 을
  // 부여해 helper 입력 형태로 만든다. 빈 DB(전부 빈 배열)는 빈 records → helper 가 빈
  // 분류 정상 반환(throw 0, 경계).
  private async collectExportRecords(): Promise<ExportRecord[]> {
    const entries = Object.entries(EXPORT_ENTITY_SOURCES) as Array<
      [ExportEntity, { delegate: ExportEntityDelegate; instantColumn: string }]
    >;

    const perEntity = await Promise.all(
      entries.map(async ([entity, source]) => {
        // delegate 별 Prisma findMany 시그니처가 model 마다 달라(union) 좁은 projection
        // -only 시그니처로 unknown 경유 cast — 본 경로는 select 1 컬럼만 read 한다.
        const delegate = this.prisma[source.delegate] as unknown as {
          findMany: (args: {
            select: Record<string, true>;
          }) => Promise<Array<Record<string, unknown>>>;
        };
        // 🔥 projection-only — instant 컬럼 1개만 select(전체 row·raw 미조회, REQ-032).
        const rows = await delegate.findMany({
          select: { [source.instantColumn]: true },
        });
        return rows.map((row) => ({
          entity,
          instant: row[source.instantColumn] as Date,
        }));
      }),
    );

    return perEntity.flat();
  }

  // toScopePayload — CreateExportJobInput 을 validateExportScope helper 가 요구하는
  // payload shape({ scope: "full"|"range"|"partial", dateRange?, entitySelector? }) 로
  // 변환한다. Prisma `ExportScope` enum(FULL/RANGE/PARTIAL, uppercase) 과 helper 의
  // lowercase scope literal 사이의 매핑이 핵심 — 매핑되지 않는 값은 그대로 통과시켜
  // helper 의 scope error 가 잡도록 둔다(방어적). dateRange 는 아래 coerce 로 정규화.
  private toScopePayload(input: CreateExportJobInput): {
    scope: string;
    dateRange?: unknown;
    entitySelector?: unknown;
  } {
    return {
      scope: SCOPE_ENUM_TO_PAYLOAD[input.scope] ?? input.scope,
      dateRange: this.coerceDateRange(input.dateRange),
      entitySelector: input.entitySelector,
    };
  }

  // coerceDateRange — JSON body 의 dateRange 는 역직렬화 과정에서 start/end 가 ISO string 으로
  // 들어올 수 있으므로(JSON 에 Date 타입이 없음), string 이면 new Date(...) 로 coerce 한다.
  // coerce 후 helper 의 isValidDate 가 Invalid Date(잘못된 ISO string)를 field error 로 잡는다.
  // 이미 Date instance 면 그대로 통과, dateRange 가 plain object 가 아니면 원본을 그대로 넘겨
  // helper 의 dateRange error 분기가 처리하도록 둔다(본 service 는 형 변환만, 판정은 helper).
  private coerceDateRange(value: unknown): unknown {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return value;
    }
    const range = value as { start?: unknown; end?: unknown };
    return {
      ...range,
      start:
        typeof range.start === "string" ? new Date(range.start) : range.start,
      end: typeof range.end === "string" ? new Date(range.end) : range.end,
    };
  }

  // updateOrThrow — mark* 전이의 공통 update 위임. row 부재 (P2025) 시
  // NotFoundException 으로 변환 (전이 대상 job 이 없을 때의 negative 분기).
  private async updateOrThrow(
    id: string,
    data: Parameters<PrismaService["exportJob"]["update"]>[0]["data"],
  ): Promise<ExportJob> {
    try {
      return await this.prisma.exportJob.update({ where: { id }, data });
    } catch (error) {
      throw this.mapNotFound(error, id);
    }
  }

  // mapNotFound — P2025 면 NotFoundException, 아니면 원본 error 그대로 반환
  // (호출자가 throw 책임 — 변환 범위 밖 error 는 propagate).
  private mapNotFound(error: unknown, id: string): unknown {
    if (getPrismaErrorCode(error) === "P2025") {
      return new NotFoundException(`export job not found: ${id}`);
    }
    return error;
  }

  // toJsonOrNull — 미지정 축(undefined/null)을 DB NULL 로 정규화. nullable Json? 컬럼은
  // raw `null` 을 받지 않고 Prisma.DbNull (DB NULL) / Prisma.JsonNull (JSON null 값) 을
  // 구분해 요구하므로, 본 service 는 "축 미사용 = DB NULL" 의미로 Prisma.DbNull 을 쓴다.
  private toJsonOrNull(
    value: unknown,
  ): Parameters<PrismaService["exportJob"]["create"]>[0]["data"]["dateRange"] {
    if (value === undefined || value === null) {
      return Prisma.DbNull;
    }
    return value as Parameters<
      PrismaService["exportJob"]["create"]
    >[0]["data"]["dateRange"];
  }
}
