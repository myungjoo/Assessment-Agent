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
//
// 실행 slice **3c-4b** (T-1295) 증분 — T-1294 가 `restoreFromDump` 결과에 동봉한 plan 영향
// 요약 (`summary`) 이 본 runner 지역 변수에서 사라지고 있었다 (`inserted` 만 읽고 버림).
// 본 slice 는 반환 경계 **한 겹** 만 넓혀 `runJob` 이 `{ job, summary }` 를 돌려준다 —
// 요약 재계산 0 · 영속화 0 (`ImportJob` 에 breakdown 컬럼이 없고 컬럼 추가는 schema
// migration 이라 CLAUDE.md §5 상 사람 결정 대상) · 외부 HTTP 응답 shape 변화 0.
import { HttpException, Injectable } from "@nestjs/common";
import { type ImportJob, type ImportMode } from "@prisma/client";

import { type RestorePlanSummary } from "../export/import-restore-plan-summary";

import { ImportJobService } from "./import-job.service";
import {
  ImportRestoreService,
  type ImportRestoreResult,
} from "./import-restore.service";

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

// RunImportJobResult — `runJob` 의 반환 shape (T-1295). 마감된 job row 와 복원 영향 요약을
// **각각 상류가 만든 인스턴스 그대로** 담는다 (복제 · 재계산 · 필드 pick 0).
//   - `job`     : `markSucceeded` 가 돌려준 row 그 자체 (status=SUCCEEDED + restoredRowCount).
//   - `summary` : `restoreFromDump` 결과의 `summary` 그 자체 — MERGE 가 보존한 건수 (`kept`)
//                 와 REPLACE 가 entity 별로 지운 건수 (`deleted.perEntity`) 를 담은 요약
//                 (UC-07 §5 step 15 "복원 row count + 영향 요약" 의 요약 쪽).
// 요약을 job row 에 합치지 않고 별도 필드로 두는 이유: row 는 Prisma model 그대로여야
// 하고 (영속 shape 오염 0), 요약은 in-memory 전달값이기 때문이다.
export interface RunImportJobResult {
  job: ImportJob;
  summary: RestorePlanSummary;
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
  //   (3-성공) markSucceeded 로 마감하고 그 반환 row 를 재가공 없이 `job` 에, 복원이 산출한
  //       요약을 재계산 없이 `summary` 에 담아 돌려준다 (T-1295). 이 호출이 reject 하면 그
  //       error 를 그대로 전파하며 markFailed 를 부르지 않는다 — bookkeeping 실패를 복원
  //       실패로 오분류하지 않기 위해 성공 경로는 try 밖에 둔다.
  async runJob(input: RunImportJobInput): Promise<RunImportJobResult> {
    await this.jobs.markRunning(input.jobId);

    // catch 가 항상 재throw 로 끝나므로 try 이후 지점의 definite assignment 가 보존된다
    // (명시 타입을 붙여도 TS2454 가 나지 않는다 — evolving-any 에 기댈 이유가 없다).
    // 타입은 `ImportRestoreResult` — 실행 결과 3 필드에 더해 `summary` 까지 보이는 정본이다.
    let restored: ImportRestoreResult;
    try {
      restored = await this.restore.restoreFromDump(input.buffer, input.mode);
    } catch (error) {
      await this.recordFailure(input.jobId, error);
      throw error;
    }

    // restoredRowCount 는 `inserted` **만** 쓴다 — UC-07 §8 (e) 의 "복원된 row count" 는
    // 재구성된 row 수이고, REPLACE 의 선삭제 건수 (`deleted`) 는 복원량이 아니라 합산하지 않는다.
    // `summary` 가 손에 들어온 뒤에도 이 규칙은 **불변** 이다 — `summary.inserted.total` 로
    // 바꾸면 두 값이 같다는 보증 없이 저장 의미가 조용히 바뀌므로 회귀 표면이 된다 (T-1295).
    const job = await this.jobs.markSucceeded(
      input.jobId,
      input.artifactRef,
      restored.inserted,
    );

    // 두 인스턴스를 그대로 싣기만 한다 — 요약 재계산 · 복제 · 필드 pick 0 (집계 규칙의
    // source-of-truth 는 `summarizeRestorePlan` 단독, DRY).
    return { job, summary: restored.summary };
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
