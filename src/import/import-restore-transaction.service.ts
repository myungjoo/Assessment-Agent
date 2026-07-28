// import-restore-transaction.service — UC-07 Import 복원 step 배열을 단일 `$transaction` 안에서
// 실행하고 실패 시 Prisma error 를 HTTP exception 으로 매핑하는 service (T-1275 / T-1278,
// REQ-030 / REQ-032). ADR-0055 §Follow-up (b) 복원 엔진 chain 의 실행 조각 **3b-2a + 3b-2c-2**.
// 하지 않는 것: module provider 등록 0 · controller / import-job.service 재배선 0 (3c 위임) ·
// 복원 값·서술 조립 0 · entity 순서 검증 0 (상류 `groupImportRestoreOperations` ·
// `planImportRestoreTransactionSteps` 위임). 상류 조립은 트랜잭션 **밖** 이라 그쪽 한국어 throw
// 는 매핑을 거치지 않고 지금처럼 **그대로 전파** 된다.
// 매핑 배선 (3b-2c-2): `$transaction` 한 겹만 try/catch 로 감싸 `toImportRestoreHttpException`
// 을 1 회 부른다 — 적중 (P2002 / P2025 → 409 · P2003 → 400) 이면 그 exception 을, `undefined`
// 면 원본 instance 를 그대로 던진다 (무차별 흡수 금지). 재시도 0 · 보상 0 · 로깅 0.
// 설계 결정 (A) 흡수 0: helper 호출을 자체 try/catch 로 다시 감싸지 않는다 — 실 Prisma known
// error 는 plain data property 라 접근자 throw 가 없고, 계약 밖 입력용 분기를 늘리면 T-1277 이
// pin 한 "판정 실패를 숨기지 않는다" 와 층위가 어긋난다 (accessor throw 시 원본 유실은 trade-off).
// 원자성 계약: `$transaction` 을 정확히 1 회 열고 그 안에서 runner 를 정확히 1 회 부른다 — 나눠
// 열면 부분 복원이 성공으로 보고된다. 되돌리기는 `$transaction` 몫이라 보상 로직 0 이며, runner
// lazy guard 의 부분 적용도 같은 rollback 으로 무해화된다 (T-1274 NIT-1 · T-1276 실 DB 실증).
// 선-조립: step 조립을 트랜잭션 **밖에서** 끝낸다 — 조립이 실패하는데 세션·커넥션을 먼저 잡으면
// 낭비다. 조립 결과가 빈 배열이면 트랜잭션을 아예 열지 않는다 (빈 왕복 0 · catch 미진입).
// REQ-032: 본 service 는 메시지를 만들지 않는다 — 매핑 문구는 helper 가 조립하고, record 원본 ·
// `fields` · `instant` · plan payload · stack 은 어떤 산출물에도 실리지 않는다.
import { Injectable } from "@nestjs/common";

import { type FullExportRecord } from "../export/export-full-record";
import { type ImportRestorePlan } from "../export/import-restore-plan";
import { PrismaService } from "../persistence/prisma.service";

import { toImportRestoreHttpException } from "./import-restore-error";
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
  // 흐름: 조립 (트랜잭션 밖 · catch 밖) → 빈 step 단락 → `$transaction` 1 회 → runner 1 회 → 합계.
  // 실패 경로: 매핑 적중이면 HTTP exception, 미적중이면 원본 그대로 — 부분 결과는 만들지 않는다.
  async restore(
    plan: ImportRestorePlan<FullExportRecord>,
  ): Promise<ImportRestoreTransactionResult> {
    // 조립 throw (상류 한국어 문구) 는 Prisma error 가 아니라 매핑 대상이 아니다 — try 밖에 둔다.
    const steps = planImportRestoreTransactionSteps(
      groupImportRestoreOperations(plan),
    );
    if (steps.length === 0) {
      return { outcomes: [], deleted: 0, inserted: 0 };
    }

    try {
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
    } catch (error) {
      // 판정은 helper 한 곳뿐 — 여기서 code 를 다시 읽거나 문구를 덧붙이지 않는다 (REQ-032).
      throw toImportRestoreHttpException(error) ?? error;
    }
  }
}
