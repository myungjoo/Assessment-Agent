// import-job-runner.service — job status 전이와 복원 실행을 합성하는 runner service
// (T-1284, REQ-030 / REQ-032). ADR-0055 §Follow-up (b) 복원 엔진 chain 의 실행 slice **3c-3a**.
// T-1281 이 orchestrator `ImportRestoreService.restoreFromDump` 를, T-0487 이 `ImportJobService`
// 의 `markRunning` / `markSucceeded` / `markFailed` 전이를 각각 갖췄지만 그 둘을 이어 부르는
// 코드가 0 이었다. 본 service 가 그 **한 겹** 만 소유한다.
//
// 이 책임을 controller 나 `ImportJobService` 에 넣지 않는 이유 (task §Why): controller 는
// "자체 분기 0 (service raw forward)" 를 계약으로 박제했고 실패 전이 · message 정제 ·
// `restoredRowCount` 산출은 HTTP 관심사가 아니다. `ImportJobService` 는 스스로를 "PrismaService
// 위 얇은 persistence wrapping" 으로 한정했으므로 복원 orchestrator 를 주입할 자리가 아니다.
//
// 본문은 **정확히 3 단계** 이며 새 로직이 0 이다 — 재시도 · 로깅 · 관측 metric · 부분 복원 ·
// 보상 로직 · status 선검증 guard · 동시 실행 race guard 0 (race 차단은 `createJob` 의
// `evaluateImportRaceGuard` 몫). 본 service 는 **호출 순서와 실패 message 정제 지점** 만 갖는다.
// 하지 않는 것 (task §Out of Scope): `import.module.ts` 등록 0 (slice 3c-3b) · controller 교체
// 0 (3c-3c) · e2e 0 (3c-3d). 본 commit 시점에 **호출처는 0** 이라 런타임 동작 변화도 0 이다.
import { HttpException, Injectable } from "@nestjs/common";
import { type ImportJob, type ImportMode } from "@prisma/client";

import { ImportJobService } from "./import-job.service";
import { ImportRestoreService } from "./import-restore.service";

// 예기치 못한 실패의 **고정** 기록 문구 (REQ-032 raw 미저장). `HttpException` 이 아닌 error
// (raw Prisma error · 일반 Error · 비-Error throw) 는 message · code · meta · stack 중 어느
// 조각도 job record 에 싣지 않고 본 상수만 기록한다 — 원본 진단 정보는 전파되는 error
// 인스턴스가 그대로 들고 가므로 기록 쪽에서 재노출할 이유가 없다.
export const IMPORT_RESTORE_UNEXPECTED_FAILURE_MESSAGE =
  "import 복원 실패 — 예기치 못한 오류로 복원이 중단되었습니다.";

// RunImportJobInput — `runJob` 의 입력 shape. positional 인자 4 개는 문자열 2 개 (`jobId` /
// `artifactRef`) 가 인접해 호출부 혼동 위험이 크므로 객체 입력으로 고정한다.
export interface RunImportJobInput {
  jobId: string;
  buffer: Buffer;
  mode: ImportMode;
  artifactRef: string;
}

@Injectable()
export class ImportJobRunnerService {
  constructor(
    private readonly jobs: ImportJobService,
    private readonly restore: ImportRestoreService,
  ) {}

  // runJob — job 1 건의 복원 실행 전체를 합성한다.
  //   (1) markRunning — 여기서 throw 하면 (2) 는 **미도달** 이다 (전이 실패 상태에서 DB 를
  //       건드리지 않는다). 전이 error (P2025 → NotFoundException 등) 는 그대로 전파.
  //   (2) restoreFromDump — buffer · mode 는 재가공 없이 **같은 인스턴스** 로 넘긴다.
  //   (3-실패) 사유를 정제해 markFailed 로 기록한 뒤 **원본 error 인스턴스를 재throw** 한다
  //       (재랩핑 0 → 상류가 만든 400 / 409 가 controller 까지 그대로 흐른다).
  //   (3-성공) markSucceeded 로 마감하고 그 반환 row 를 재가공 없이 돌려준다. 이 호출이
  //       reject 하면 그 error 를 그대로 전파하며 markFailed 를 부르지 않는다 — bookkeeping
  //       실패를 복원 실패로 오분류하지 않기 위해 성공 경로는 try 밖에 둔다.
  async runJob(input: RunImportJobInput): Promise<ImportJob> {
    await this.jobs.markRunning(input.jobId);

    let restored;
    try {
      restored = await this.restore.restoreFromDump(input.buffer, input.mode);
    } catch (error) {
      await this.recordFailure(input.jobId, error);
      throw error;
    }

    // restoredRowCount 는 `inserted` **만** 쓴다 — UC-07 §8 (e) 의 "복원된 row count" 는
    // 재구성된 row 수이고, REPLACE 의 선삭제 건수 (`deleted`) 는 복원량이 아니라 합산하지 않는다.
    return this.jobs.markSucceeded(
      input.jobId,
      input.artifactRef,
      restored.inserted,
    );
  }

  // recordFailure — 실패 사유를 정제해 기록한다 (기록은 **best-effort**).
  // 정제 분기는 2 개뿐: (a) `HttpException` 이면 상류 (`ImportRestoreService` /
  // `toImportRestoreHttpException`) 가 이미 정제한 한국어 message 그대로, (b) 그 외는 고정 상수.
  // markFailed 자체가 reject 하는 edge 는 **의도적으로 흡수** 한다 — 호출자에게 전파돼야 하는
  // 것은 언제나 복원 실패의 원인이며, bookkeeping 실패가 그 원인을 덮으면 진단이 불가능해진다.
  private async recordFailure(jobId: string, error: unknown): Promise<void> {
    const message =
      error instanceof HttpException
        ? error.message
        : IMPORT_RESTORE_UNEXPECTED_FAILURE_MESSAGE;

    try {
      await this.jobs.markFailed(jobId, message);
    } catch {
      // 흡수 지점 — 위 주석의 근거대로 원본 복원 error 전파를 우선한다 (재시도 · 로깅 0).
    }
  }
}
