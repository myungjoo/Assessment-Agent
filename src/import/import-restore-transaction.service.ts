// import-restore-transaction.service — UC-07 Import 복원 step 배열을 단일 `$transaction` 안에서
// 실행하는 service (T-1275, REQ-030 / REQ-032). ADR-0055 §Follow-up (b) 복원 엔진 chain 의 실행
// 조각 **3b-2a** — 3b-1 `runImportRestoreSteps` 를 실 tx 위에 올리는 배선만 한다.
// 하지 않는 것: Prisma error (P2002 / P2003 / P2025) → HTTP exception 매핑 0 · module provider
// 등록 0 · controller / import-job.service 재배선 0 (3b-2b / 3c 위임) / 복원 값·서술 조립 0 ·
// entity 순서 검증 0 (상류 `groupImportRestoreOperations` · `planImportRestoreTransactionSteps`
// 위임 — 사본 0 이라 그쪽 한국어 throw 를 **그대로 전파** 한다).
// 원자성 계약: `$transaction` 을 정확히 1 회 열고 그 안에서 runner 를 정확히 1 회 부른다 — 나눠
// 열면 부분 복원이 성공으로 보고된다. 되돌리기 보상 로직 0 — 콜백이 도중 throw 하면 되돌리기는
// `$transaction` 이 하고 본 service 는 error 를 그대로 전파한다 (흉내내면 이중 보상).
// rollback 전제 (T-1274 NIT-1): runner 의 tx surface guard 는 step 별 lazy 검사라 `steps[1]` 의
// 결함이 `steps[0]` 실행 **후** 드러나지만, 그 부분 적용도 같은 rollback 으로 무해화된다 (실 DB
// 왕복 실증은 3b-2b).
// 선-조립: step 조립을 트랜잭션 **밖에서** 끝낸다 — 조립이 실패하는데 세션·커넥션을 먼저 잡으면
// 낭비다. 조립 결과가 빈 배열이면 트랜잭션을 아예 열지 않는다 (빈 왕복 0).
// REQ-032: 본 service 는 메시지를 만들지 않는다 — record 원본 · `fields` · `instant` · plan
// payload · stack 이 어떤 산출물에도 실리지 않는다.
import { Injectable } from "@nestjs/common";

import { type FullExportRecord } from "../export/export-full-record";
import { type ImportRestorePlan } from "../export/import-restore-plan";
import { PrismaService } from "../persistence/prisma.service";

import { groupImportRestoreOperations } from "./import-restore-ops";
import {
  runImportRestoreSteps,
  type ImportRestoreStepOutcome,
  type ImportRestoreTxClient,
} from "./import-restore-run-steps";
import { planImportRestoreTransactionSteps } from "./import-restore-steps";

// 복원 1 회의 결과 — runner outcome 원본 + phase 별 건수 합계 (UC-07 §8 restoredRowCount 재료).
export interface ImportRestoreTransactionResult {
  outcomes: ImportRestoreStepOutcome[];
  deleted: number;
  inserted: number;
}

// interactive transaction 옵션 — 기본 5s timeout 은 대용량 dump 의 createMany 배치에서 그대로
// 터진다 (부분 복원이 아니라 통째 rollback 이지만 복원 자체가 불가능해진다).
export const IMPORT_RESTORE_TRANSACTION_OPTIONS = Object.freeze({
  maxWait: 10_000,
  timeout: 120_000,
});

// phase 별 건수 합 — outcome 을 재정렬 · 병합하지 않고 count 만 더한다.
function sumPhase(
  outcomes: readonly ImportRestoreStepOutcome[],
  phase: ImportRestoreStepOutcome["phase"],
): number {
  return outcomes.reduce(
    (total, outcome) => total + (outcome.phase === phase ? outcome.count : 0),
    0,
  );
}

@Injectable()
export class ImportRestoreTransactionService {
  constructor(private readonly prisma: PrismaService) {}

  // restore — plan 을 step 배열로 조립한 뒤 단일 `$transaction` 안에서 순차 실행한다.
  // 흐름: 조립 (트랜잭션 밖) → 빈 step 단락 → `$transaction` 1 회 → runner 1 회 → 합계.
  // 상류 / runner / Prisma 가 던진 error 는 감싸지 않고 그대로 전파하며 부분 결과를 만들지 않는다.
  async restore(
    plan: ImportRestorePlan<FullExportRecord>,
  ): Promise<ImportRestoreTransactionResult> {
    const steps = planImportRestoreTransactionSteps(
      groupImportRestoreOperations(plan),
    );
    if (steps.length === 0) {
      return { outcomes: [], deleted: 0, inserted: 0 };
    }

    const outcomes = await this.prisma.$transaction(
      // 캐스팅은 이 한 곳뿐 — runner 가 요구하는 5 delegate key 는 실 `Prisma.TransactionClient`
      // 의 부분집합이라 구조적으로 안전하고, 좁은 타입만 runner 로 흘려보낸다 (`any` 0).
      async (tx) =>
        runImportRestoreSteps(tx as unknown as ImportRestoreTxClient, steps),
      IMPORT_RESTORE_TRANSACTION_OPTIONS,
    );
    return {
      outcomes,
      deleted: sumPhase(outcomes, "delete"),
      inserted: sumPhase(outcomes, "insert"),
    };
  }
}
