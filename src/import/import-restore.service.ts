// import-restore.service — UC-07 Import 복원 orchestrator service (T-1281, REQ-030 / REQ-032).
// ADR-0055 §Follow-up (b) 복원 엔진 chain 의 실행 slice **3c-2b** — 따로 닫힌 재료 셋 (기존
// record 로딩 `collectFullExportRecords` (3c-2a) · plan 준비 `prepareImportRestorePlan` ·
// atomic 실행 `ImportRestoreTransactionService` (3b-2a~3b-2c)) 을 잇는 호출자가 0 이라
// `prepareImportRestorePlan` 의 production 호출처가 없었다. 본 service 가 그 한 겹만 합성한다.
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
// 하지 않는 것 (task §Out of Scope): `import.module.ts` provider 등록 0 (slice 3c-2c) ·
// controller / `import-job.service.ts` 재배선 0 (3c-3) · `SchemaVersionCompatOptions` 노출 0
// (기본값 호출 + verdict 준수). 본 commit 시점의 호출처는 0 이라 런타임 동작 변화도 0 이다.
import { BadRequestException, Injectable } from "@nestjs/common";
import { type ImportMode } from "@prisma/client";

import {
  collectFullExportRecords,
  type ExportFullRecordReadClient,
} from "../export/export-full-record-collect";
import { PrismaService } from "../persistence/prisma.service";

import { prepareImportRestorePlan } from "./import-restore-plan-prepare";
import {
  ImportRestoreTransactionService,
  type ImportRestoreTransactionResult,
} from "./import-restore-transaction.service";

@Injectable()
export class ImportRestoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transaction: ImportRestoreTransactionService,
  ) {}

  // restoreFromDump — dump buffer + Prisma `ImportMode` 를 받아 복원 1 회를 끝까지 실행한다.
  //   (1) 기존 record 로딩 — 실 Prisma → 좁은 read client 캐스팅은 **호출자 몫** 이라 본
  //       service 의 이 한 줄에서만 일어난다 (export-job.service 의 선례 mirror).
  //   (2) plan 준비 — verdict 계약이라 throw 를 기대하지 않는다.
  //   (3) 실패 verdict → 400 으로 단락 (아래 (4) 미도달 = DB 변경 0).
  //   (4) 성공 verdict → 준비된 plan **인스턴스 그대로** atomic 실행에 넘기고 결과를 재가공
  //       없이 반환한다.
  async restoreFromDump(
    buffer: Buffer,
    mode: ImportMode,
  ): Promise<ImportRestoreTransactionResult> {
    const existing = await collectFullExportRecords(
      this.prisma as unknown as ExportFullRecordReadClient,
    );

    const prepared = prepareImportRestorePlan(buffer, existing, mode);
    if (!prepared.ok) {
      throw new BadRequestException(
        `import 복원 거부 (stage: ${prepared.stage}): ${prepared.issues.join("; ")}`,
      );
    }

    return this.transaction.restore(prepared.plan);
  }
}
