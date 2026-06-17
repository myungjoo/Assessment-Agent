// export-job-status-view — UC-07 §8 NFR async Export job 의 현재 polling 상태(ExportJobStatus)를
// 사람-친화 진행 view(ExportJobStatusView)로 렌더하는 순수 helper (T-0468, P7 R-57 / REQ-030 /
// REQ-032 / REQ-045). 직전 buildExportJobPlan(T-0467)은 async 경로의 statusFlow(queued→running→
// ready) + pollingRequired 까지만 산출할 뿐, polling 도중 받은 현재 ExportJobStatus 를 진행
// view(현재 단계 label·전체 단계 중 몇 번째·다음 단계·종단 여부·다운로드 가능 여부·한국어 안내
// 한 줄)로 렌더하는 helper 는 31 helper 중 0 회 cover 된 gap 이다(git grep
// describeExportJobStatus|ExportJobStatusView|ExportJobProgress src/ → 0 매칭).
//
// UC-07 §8 NFR 은 대량 dump 를 "async job + status polling + chunked streaming" 으로 처리하라
// 명시한다. T-0467 의 plan 이 "어떤 경로로 다운로드할지" 를 정한다면, 본 helper 는 그 async 경로
// 에서 매 poll 응답마다 "지금 어디까지 왔는지" 를 사용자에게 보여줄 view descriptor 를 순수 합성
// 으로 박제한다. UC-07 §5 step 13(Export 다운로드 완료) 직전의 진행 안내가 필요로 하는 모델을
// 채운다.
//
// 실 polling endpoint / status store / job lifecycle / job id 조회 / SSE·long-poll 배선 0 — 입력
// 으로 받은 status enum 하나만으로 view 를 derive 한다(buildExportJobPlan 재호출 0 — DRY). 실
// lifecycle 은 P5 service layer(repository / scheduler 게이트). 새 도메인 타입은
// ExportJobStatusView 만 신설하며 ExportJobStatus 는 export-job-plan.ts 에서 import 재사용(중복
// 정의 금지). 새 외부 dependency 0. 코드 골격은 import-mode-description.ts(T-0465)의 plain 모델
// interface + 한국어 TypeError/RangeError 입력 방어 + non-mutating + 불변 flag 패턴을 mirror 한다.
import { ExportJobStatus } from "./export-job-plan";

// async Export job 진행 view 모델 — plain object. status 는 입력 그대로의 현재 상태, phaseLabel 은
// 현재 상태의 한국어 단계명, stepIndex 는 정상 흐름(queued→running→ready)에서의 0-base 위치(failed
// 는 정상 흐름 밖이라 -1), totalSteps 는 정상 흐름 단계 수(3 고정), nextStatus 는 다음 정상 단계
// (ready/failed 는 다음이 없어 null), terminal 은 종단 여부(ready/failed=true), downloadable 은
// 다운로드 가능 여부(ready 만 true), message 는 현재 진행을 담은 한국어 한 줄이다.
// 불변: downloadable === true ⟹ status === "ready", terminal === (status === "ready" || status ===
// "failed"), nextStatus === null ⟺ terminal === true. 후속 WebUI polling 진행 표시(UC-07 §5 step
// 13)가 이 모델을 그대로 렌더한다.
export interface ExportJobStatusView {
  status: ExportJobStatus;
  phaseLabel: string;
  stepIndex: number;
  totalSteps: number;
  nextStatus: ExportJobStatus | null;
  terminal: boolean;
  downloadable: boolean;
  message: string;
}

// async job 정상 상태 흐름 단계 수 — queued → running → ready 의 3 단계. failed 는 정상 흐름 밖
// (stepIndex=-1)이라 이 수에 포함하지 않는다(enum 으로는 존재하지만 정상 진행 단계가 아님).
const TOTAL_STEPS = 3;

// 각 ExportJobStatus 에 대한 view 매핑 표 — 정상 흐름(queued→running→ready) + 실패 종단(failed)을
// 박제한다. message 만 동적 합성(받은 status 어휘 포함)하고 나머지 필드는 본 표에서 직접 derive 한다.
// 본 표는 모듈 공유 상수라 describeExportJobStatus 는 반환 시 항상 새 객체를 조립한다(non-mutating).
interface StatusSpec {
  phaseLabel: string;
  stepIndex: number;
  nextStatus: ExportJobStatus | null;
  terminal: boolean;
  downloadable: boolean;
  message: string;
}

const STATUS_SPECS: Readonly<Record<ExportJobStatus, StatusSpec>> = {
  queued: {
    phaseLabel: "대기 중",
    stepIndex: 0,
    nextStatus: "running",
    terminal: false,
    downloadable: false,
    message:
      "Export job 이 대기 중입니다 (1/3 단계). 곧 처리가 시작되며 상태를 계속 polling 합니다.",
  },
  running: {
    phaseLabel: "처리 중",
    stepIndex: 1,
    nextStatus: "ready",
    terminal: false,
    downloadable: false,
    message:
      "Export job 을 처리 중입니다 (2/3 단계). 준비가 끝나면 다운로드할 수 있습니다.",
  },
  ready: {
    phaseLabel: "다운로드 가능",
    stepIndex: 2,
    nextStatus: null,
    terminal: true,
    downloadable: true,
    message:
      "Export job 이 완료되어 다운로드할 수 있습니다 (3/3 단계). 지금 dump 를 내려받으세요.",
  },
  failed: {
    phaseLabel: "실패",
    stepIndex: -1,
    nextStatus: null,
    terminal: true,
    downloadable: false,
    message:
      "Export job 이 실패했습니다. 정상 진행 흐름을 벗어난 종단 상태이며 job 을 다시 생성해야 합니다.",
  },
};

// 허용 status 집합 — 이 밖의 값(미정의 문자열 / 비-string)은 호출측 배선 버그로 보아 reject.
// export-job-plan.ts 의 ExportJobStatus 와 동형 집합.
const VALID_STATUSES: ReadonlySet<string> = new Set<ExportJobStatus>([
  "queued",
  "running",
  "ready",
  "failed",
]);

// 받은 부적합 값의 사람-친화 표기 — 입력 방어 메시지에 박제한다. null/undefined/숫자/객체 모두
// 받은 값을 그대로 드러내 호출측 디버깅을 돕는다.
function describeReceived(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "object") {
    return Array.isArray(value) ? "array" : "object";
  }
  return String(value);
}

// describeExportJobStatus — 현재 ExportJobStatus 하나를 받아 async Export job 진행 view 를 순수
// derivation 으로 조립한다(UC-07 §8 NFR + §5 step 13 정합):
//   - queued → stepIndex=0 · nextStatus="running" · terminal=false · downloadable=false (대기 중).
//   - running → stepIndex=1 · nextStatus="ready" · terminal=false · downloadable=false (처리 중).
//   - ready → stepIndex=2 · nextStatus=null · terminal=true · downloadable=true (다운로드 가능).
//   - failed → stepIndex=-1 · nextStatus=null · terminal=true · downloadable=false (실패 종단).
// totalSteps=3 고정. 불변: downloadable === true ⟹ status === "ready", terminal === (status ===
// "ready" || status === "failed"), nextStatus === null ⟺ terminal === true.
//
// 반환 객체는 호출마다 새로 생성하며(non-mutating — 모듈 공유 STATUS_SPECS 를 복제해 조립), 동일
// 입력 2 회 호출은 동등 결과(순수·결정성)다. view 표시 전 안전을 위한 입력 방어:
//   - status 가 string 아님(null / undefined / 숫자 / 객체 / 배열) → TypeError(받은 값 박제).
//   - status 가 "queued"/"running"/"ready"/"failed" 외 string(빈 문자열 / "cancelled" 등) →
//     RangeError(받은 값 박제).
export function describeExportJobStatus(
  status: ExportJobStatus,
): ExportJobStatusView {
  // 비-string 은 enum 멤버십 판정 전에 거부 — null / undefined / 숫자 / 객체 / 배열 모두 TypeError.
  if (typeof status !== "string") {
    throw new TypeError(
      `describeExportJobStatus: status 는 string 이어야 합니다 (받음: ${describeReceived(
        status,
      )})`,
    );
  }

  // 허용 4 종 외 string 은 거부 — 빈 문자열 / "cancelled" / 대문자 등 모두 RangeError.
  if (!VALID_STATUSES.has(status)) {
    throw new RangeError(
      `describeExportJobStatus: status 는 queued/running/ready/failed 중 하나여야 합니다 (받음: ${describeReceived(
        status,
      )})`,
    );
  }

  // STATUS_SPECS 는 모듈 공유 상수 — 새 객체로 spread 복제해 반환(non-mutating 보장).
  const spec = STATUS_SPECS[status];
  return {
    status,
    phaseLabel: spec.phaseLabel,
    stepIndex: spec.stepIndex,
    totalSteps: TOTAL_STEPS,
    nextStatus: spec.nextStatus,
    terminal: spec.terminal,
    downloadable: spec.downloadable,
    message: spec.message,
  };
}
