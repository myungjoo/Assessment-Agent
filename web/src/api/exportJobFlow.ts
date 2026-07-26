// export-job orchestration 헬퍼(T-1243) — T-1242 primitive(exportJob.ts) 위에 job
// lifecycle(create → poll status → download)을 단일 순수 함수로 합성한다. AdminView.tsx
// (hub) 무접촉 격리로 R-112 충분 cover + file-disjoint 를 얻는다(배선은 최종 slice).
// primitive 는 직접 import 강결합 대신 deps 주입(AdminView ExportDeps convention 계승),
// terminal 토큰은 backend 권위 소스(prisma/schema.prisma enum JobStatus) 그대로 박제,
// 하위 primitive 의 reject 는 삼키지 않고 전파한다.

import type { CreateExportInput, ExportJob } from './exportJob';

// backend JobStatus enum(prisma/schema.prisma) 그대로 박제한 종결 토큰(PENDING/RUNNING=진행중).
const SUCCEEDED_STATUS = 'SUCCEEDED';
const FAILED_STATUS = 'FAILED';

// 주입 의존성 — 앞 3개는 exportJob.ts 시그니처 그대로. delay 는 poll 간 대기(미주입 시
// setTimeout 기반 기본 구현).
interface ExportJobFlowDeps {
  createExportJob: (input: CreateExportInput) => Promise<ExportJob>;
  getExportJob: (id: string) => Promise<ExportJob>;
  downloadExportJob: (id: string) => Promise<Response>;
  delay?: (ms: number) => Promise<void>;
}

// poll 제어 옵션 — maxPolls 회까지 getExportJob 를 재조회, 각 poll 사이 intervalMs 대기.
interface RunExportJobOptions {
  maxPolls?: number;
  intervalMs?: number;
}

const DEFAULT_MAX_POLLS = 30;
const DEFAULT_INTERVAL_MS = 1000;

// 기본 delay — 실 타이머 대기(setTimeout). 테스트는 즉시 resolve mock 을 주입한다.
function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// job.status 가 종결(성공/실패)인지 — 비-terminal(PENDING/RUNNING)이면 계속 poll.
function isTerminal(status: string): boolean {
  return status === SUCCEEDED_STATUS || status === FAILED_STATUS;
}

// export job orchestration — create → poll status(SUCCEEDED 까지) → download 순차 합성.
// 이미 종결이면 즉시 판정(SUCCEEDED→download / FAILED→throw), 아니면 maxPolls 회까지
// delay(intervalMs) 후 getExportJob 재조회. FAILED→throw(download 미시도), maxPolls
// 초과→timeout throw(무한 loop 방지). 하위 primitive reject 는 삼키지 않고 전파.
async function runExportJob(
  input: CreateExportInput,
  deps: ExportJobFlowDeps,
  options?: RunExportJobOptions,
): Promise<Response> {
  const maxPolls = options?.maxPolls ?? DEFAULT_MAX_POLLS;
  const intervalMs = options?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const delay = deps.delay ?? defaultDelay;

  let current = await deps.createExportJob(input);
  const id = current.id;
  // 비정상 시퀀스 방어 — 생성 job 에 id 가 없으면 조회 대상 자체가 없으므로 즉시 중단.
  if (!id) {
    throw new Error('export job 생성 응답에 유효한 id 가 없습니다');
  }

  // 종결 도달까지 poll — 첫 job 이 이미 종결이면 루프 미진입(즉시 완료 경계).
  let polls = 0;
  while (!isTerminal(current.status)) {
    if (polls >= maxPolls) {
      throw new Error(
        `export job 상태 polling 이 ${maxPolls}회 내에 종결되지 않았습니다 (timeout)`,
      );
    }
    await delay(intervalMs);
    current = await deps.getExportJob(id);
    polls += 1;
  }

  // 종결 상태 판정 — FAILED 면 download 를 시도하지 않고 즉시 throw.
  if (current.status === FAILED_STATUS) {
    throw new Error('export job 이 FAILED 상태로 종결되었습니다');
  }

  // SUCCEEDED — 결과 dump 를 download 하여 raw Response 를 그대로 resolve.
  return deps.downloadExportJob(id);
}

export { runExportJob, SUCCEEDED_STATUS, FAILED_STATUS };
export type { ExportJobFlowDeps, RunExportJobOptions };
