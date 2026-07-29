// import-restore.service — UC-07 Import 복원 orchestrator service (T-1281, REQ-030 / REQ-032).
// ADR-0055 §Follow-up (b) 복원 엔진 chain 의 실행 slice **3c-2b** — 따로 닫힌 재료 셋 (기존
// record 로딩 `collectFullExportRecords` (3c-2a) · plan 준비 `prepareImportRestorePlan` ·
// atomic 실행 `ImportRestoreTransactionService` (3b-2a~3b-2c)) 을 잇는 호출자가 0 이라
// `prepareImportRestorePlan` 의 production 호출처가 없었다. 본 service 가 그 한 겹만 합성한다.
//
// 실행 slice **3c-4a** (T-1294) 증분 — (4) 의 atomic 실행 **앞** 에서 `summarizeRestorePlan`
// (T-0448) 을 1 회 불러 plan 영향 breakdown 을 파생하고 결과에 `summary` 로 동봉한다. 집계
// 규칙은 그 helper 가 단독으로 소유하고 본 service 는 호출 지점만 정한다 (요약 재구현 0).
//
// 실행 slice **3c-5a** (T-1297) 증분 — 같은 재료로 **복원을 실행하지 않고** 영향 요약만 내는
// `previewFromDump` 를 신설한다. UC-07 §5 sequence 64 행의 confirmation (destructive 명시 +
// **영향 범위**) 은 실행 **전** 수치를 요구하는데, 지금까지의 `restoreFromDump` 는 커밋 뒤에만
// 그 요약을 줬다. preview 는 `this.transaction.restore` 를 부르지 않아 `$transaction` 을 아예
// 열지 않으며 (DB write 0 — UC-07 §7.4 의 "transaction 시작 전 reject" 규율과 동형), 두 메서드가
// 공유하는 (1)~(3) + 요약 파생은 private helper `planAndSummarize` **한 곳** 만 소유한다 (거부
// message 조립 · 요약 파생 순서의 사본 0). `previewFromDump` 의 production 호출처는 본 slice
// 에서 **0** 이다 — `POST /api/admin/import/preview` endpoint 배선은 다음 slice (3c-5b), 실 HTTP
// 왕복 e2e 는 그다음 (3c-5c) 이라 본 slice 는 controller · runner · module 을 열지 않는다.
//
// 본문은 **정확히 4 단계** 이며 새 로직이 0 이다 — 재시도 · 로깅 · 관측 metric · 캐시 · 부분
// 복원 · 보상 로직 · job status 전이 · scope 선별 0. 각 규칙의 source-of-truth 는 각 재료
// helper 이고 본 service 는 **호출 순서와 단락 지점** 만 소유한다 (DRY).
// 단락 순서 계약 ([UC-07](../../docs/use-cases/UC-07-export-import.md) §7.3 / §7.4): 실패
// verdict 는 **트랜잭션을 열기 전에** 400 으로 거부한다 (DB 변경 0) — 그래서 (3) 의 throw 가
// (4) 보다 반드시 앞에 온다. 전파 계약: `prepareImportRestorePlan` 은 throw 0 계약이라
// try/catch 로 감싸지 않고, read 단계 throw (delegate reject / builder TypeError · RangeError)
// 와 `restore()` throw (매핑된 ConflictException · BadRequestException 또는 원본 Prisma error)
// 는 **인스턴스 그대로** 전파한다 (재랩핑 · 흡수 0). REQ-032: 거부 message 는 stage 토큰 +
// 상류가 이미 정제한 한국어 issue 만 조립하고 dump 원문 · record `fields` · plan payload ·
// stack 을 싣지 않으며 원본 verdict 를 `cause` 로도 붙이지 않는다.
// 하지 않는 것 (task §Out of Scope): controller / `import-job.service.ts` 재배선 0 (3c-3) ·
// `SchemaVersionCompatOptions` 노출 0 (기본값 호출 + verdict 준수). T-1282 (slice 3c-2c) 가
// 본 service 를 `import.module.ts` 의 providers · exports 에 등록했으나 **호출처는 여전히 0**
// 이라 런타임 동작 변화는 없다 (실 배선은 3c-3).
import { BadRequestException, Injectable } from "@nestjs/common";
import { type ImportMode } from "@prisma/client";

import { collectFullExportRecords } from "../export/export-full-record-collect";
import { asExportFullRecordReadClient } from "../export/export-full-record-read-client";
import {
  summarizeRestorePlan,
  type RestorePlanSummary,
} from "../export/import-restore-plan-summary";
import { PrismaService } from "../persistence/prisma.service";

import { prepareImportRestorePlan } from "./import-restore-plan-prepare";
import {
  ImportRestoreTransactionService,
  type ImportRestoreTransactionResult,
} from "./import-restore-transaction.service";

// 복원 1 회의 결과 — 실행 결과 (`outcomes` / `deleted` / `inserted`) 에 plan 영향 breakdown
// 요약 한 필드만 더한다 (T-1294, UC-07 §5 step 12 "복원 row count + 영향 요약" 의 첫 배선).
// 기존 3 필드의 이름 · 타입 · 값은 그대로라 `restored.inserted` 만 읽는 상류
// (`ImportJobRunnerService`) 는 한 줄도 고치지 않고 컴파일 · 동작한다.
export interface ImportRestoreResult extends ImportRestoreTransactionResult {
  summary: RestorePlanSummary;
}

// 공유 준비 경로의 성공 산출물 (T-1297) — plan 타입은 verdict union 에서 **파생** 한다. 상류가
// plan 타입을 다시 좁히거나 넓혀도 본 파일에 사본 선언이 없어 자동 추종한다 (T-1269 가 좁힌
// `ImportRestorePlan<FullExportRecord>` 를 여기서 다시 적지 않는 이유).
type PreparedRestore = {
  plan: Extract<
    ReturnType<typeof prepareImportRestorePlan>,
    { ok: true }
  >["plan"];
  summary: RestorePlanSummary;
};

@Injectable()
export class ImportRestoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transaction: ImportRestoreTransactionService,
  ) {}

  // planAndSummarize — 두 공개 메서드가 공유하는 (1)~(3) + 요약 파생 (T-1297 추출). 성공하면
  // 준비된 plan 인스턴스와 그 영향 요약을 함께 돌려주고, 실패 verdict 는 여기서 400 으로 던진다.
  //   (1) 기존 record 로딩 — 실 Prisma → 좁은 read client 좁히기는 이름 있는 helper
  //       `asExportFullRecordReadClient` (T-1283) 경유다. 캐스팅 근거는 그 module 헤더가
  //       단일 source 로 소유하며 본 service 는 호출만 한다 (근거 사본 0).
  //   (2) plan 준비 — verdict 계약이라 throw 를 기대하지 않는다.
  //   (3) 실패 verdict → 400 으로 단락 (호출측의 실행 단계 미도달 = DB 변경 0).
  private async planAndSummarize(
    buffer: Buffer,
    mode: ImportMode,
  ): Promise<PreparedRestore> {
    const existing = await collectFullExportRecords(
      asExportFullRecordReadClient(this.prisma),
    );

    const prepared = prepareImportRestorePlan(buffer, existing, mode);
    if (!prepared.ok) {
      // 거부 message 조립 — stage 토큰이 본체이고 issue 목록은 **있을 때만** 꼬리로 붙인다.
      // issues 가 비면 구분자 (": ") 만 남아 "stage: plan): " 처럼 끝나던 결함 (T-1281 이월
      // nit (ii)) 을 여기서 닫는다. 실리는 것은 여전히 stage 토큰 + 상류가 정제한 issue
      // 문자열뿐 — dump 원문 · record fields · plan payload · cause 는 0 (REQ-032).
      const detail = prepared.issues.join("; ");
      throw new BadRequestException(
        `import 복원 거부 (stage: ${prepared.stage})${detail ? `: ${detail}` : ""}`,
      );
    }

    // 요약 파생은 `$transaction` **앞** 이다 — `summarizeRestorePlan` 은 입력 방어 위반 시
    // TypeError 를 던지는 계약이라, 커밋 **뒤** 에 부르면 이미 성공한 복원이 error 로 뒤집혀
    // job 이 FAILED 로 오기록된다. 실행 전에 두면 어떤 실패든 UC-07 §7.4 의 "transaction 시작
    // 전 reject (DB 변경 0)" 규율 안으로 들어온다 (위 (3) 단락과 같은 근거). 그 TypeError 는
    // 흡수 · 재랩핑 없이 인스턴스 그대로 전파한다 (본 module 머리 주석의 전파 계약).
    // 요약 인스턴스는 재가공 · 복제 없이 그대로 위로 흘려보낸다.
    return {
      plan: prepared.plan,
      summary: summarizeRestorePlan(prepared.plan),
    };
  }

  // restoreFromDump — dump buffer + Prisma `ImportMode` 를 받아 복원 1 회를 끝까지 실행한다.
  //   (1)~(3) + 요약 파생 → 공유 helper `planAndSummarize` (근거는 그 주석이 단독 소유).
  //   (4) 성공 verdict → 준비된 plan **인스턴스 그대로** atomic 실행에 넘기고, 실행 결과 3
  //       필드에 그 요약만 동봉해 반환한다 (재가공 0).
  async restoreFromDump(
    buffer: Buffer,
    mode: ImportMode,
  ): Promise<ImportRestoreResult> {
    const { plan, summary } = await this.planAndSummarize(buffer, mode);

    const restored = await this.transaction.restore(plan);
    return { ...restored, summary };
  }

  // previewFromDump — 같은 입력으로 **복원을 실행하지 않고** 영향 요약만 낸다 (dry-run).
  //   (1)~(3) + 요약 파생 → 공유 helper `planAndSummarize` (실패 verdict 는 거기서 400).
  //   (4) 성공 verdict → 파생된 요약 인스턴스를 그대로 반환하고 **여기서 끝낸다** —
  //       `this.transaction.restore` 호출 0 이라 `$transaction` 이 열리지 않는다 (DB write 0).
  async previewFromDump(
    buffer: Buffer,
    mode: ImportMode,
  ): Promise<RestorePlanSummary> {
    const { summary } = await this.planAndSummarize(buffer, mode);
    return summary;
  }
}
