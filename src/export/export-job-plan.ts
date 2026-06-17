// export-job-plan — UC-07 §8 NFR Export 다운로드 실행 plan(동기 즉시 다운로드 vs async job +
// status polling + chunked streaming) 조립 순수 helper (T-0467, P7 R-57 / REQ-030 / REQ-032 /
// REQ-045). 직전 estimateExportDumpSize(T-0466)는 선별 record 집합으로부터 예상 dump 크기 +
// recommendation("sync" | "async-streaming") + large 권고만 산출할 뿐, 그 권고를 실제 전달 경로
// (즉시 streaming vs async job 생성 후 status polling)의 사람-친화 실행 plan descriptor 로
// 조립하는 helper 는 30 helper 중 0 회 cover 된 gap 이다(git grep buildExportJobPlan|ExportJobPlan|
// exportJob|statusPolling|asyncJob src/ → 0 매칭).
//
// UC-07 §8 NFR 은 "대량 dump 는 long-running operation 가능 — async job + status polling +
// chunked streaming" 을 명시한다. T-0466 의 size estimate 가 "이 dump 는 대량" 까지만 판정한다면,
// 본 helper 는 그 추정(ExportDumpSizeEstimate)을 입력으로만 받아(estimateExportDumpSize 재호출 0
// — DRY) "그럼 어떻게 전달할 것인가(즉시 다운로드 vs job 생성 후 polling)" 의 실행 plan 을 순수
// 합성으로 박제한다. UC-07 §5 step 13(Export 다운로드 완료) + §3 trigger 1(scope confirmation
// dialog)의 다운로드 방식 안내가 필요로 하는 plan descriptor 를 채운다.
//
// 실 async job 생성 / job queue / job id 발급 / status store / status polling endpoint / chunked
// streaming 직렬화 / resumable upload 배선 0 — 입력 estimate 의 recommendation / large /
// estimatedBytes / humanSize / recordTotal 만으로 plan 을 derive 한다. 실 job lifecycle 은 P5
// service layer(repository / scheduler 게이트). 새 도메인 타입은 ExportJobMode /
// ExportJobStatus / ExportJobPlan / ExportJobPlanOptions 만 신설하며 ExportDumpSizeEstimate 는
// 재사용(import). 새 외부 dependency 0. 코드 골격은 export-dump-size-estimate.ts(T-0466)의
// isPlainObject / describeNonObject 입력 방어 + 한국어 message convention 을 mirror 한다.
import { ExportDumpSizeEstimate } from "./export-dump-size-estimate";

// Export 다운로드 전달 mode — "sync-download"(즉시 동기 다운로드) 또는 "async-job"(async job
// 생성 후 status polling). estimate.recommendation 과 1:1 대응한다("sync"→sync-download,
// "async-streaming"→async-job).
export type ExportJobMode = "sync-download" | "async-job";

// async job 의 상태 집합 — 실 store / lifecycle 0, plan 안내용 enum 일 뿐. queued(생성·대기) →
// running(처리 중) → ready(다운로드 가능) 가 정상 흐름이며 failed 는 실패 종단 상태다.
export type ExportJobStatus = "queued" | "running" | "ready" | "failed";

// Export 다운로드 실행 plan — plain object. mode 는 전달 경로, chunked 는 대량 시 chunked
// streaming 권고 여부(estimatedBytes > chunkThreshold), pollingRequired 는 status polling 필요
// 여부, statusFlow 는 async 면 [queued, running, ready] 순·sync 면 빈 배열, headline 은 plan 을
// 담은 한국어 한 줄, instructionLines 는 한국어 단계 안내 목록이다.
// 불변: mode === "async-job" ⟺ pollingRequired === true ⟺ statusFlow.length > 0.
// 후속 WebUI confirmation dialog(UC-07 §3 trigger 1) / 다운로드 완료 안내(§5 step 13)가 이
// 모델을 그대로 렌더한다.
export interface ExportJobPlan {
  mode: ExportJobMode;
  chunked: boolean;
  pollingRequired: boolean;
  statusFlow: ExportJobStatus[];
  headline: string;
  instructionLines: string[];
}

// Export 다운로드 plan 조립 옵션 — 전부 선택. chunkThresholdBytes 는 estimatedBytes 가 이 값을
// 초과하면 chunked=true(부재 시 DEFAULT_CHUNK_THRESHOLD_BYTES), pollIntervalSeconds 는 polling
// 안내 문구에 쓸 간격 초(부재 시 DEFAULT_POLL_INTERVAL_SECONDS)다. 정책 source(ENV / DB / config)는
// 본 helper 책임 0 — 옵션으로 받은 값만 사용한다(후속 controller 가 정책 값을 넘긴다).
export interface ExportJobPlanOptions {
  chunkThresholdBytes?: number;
  pollIntervalSeconds?: number;
}

// estimatedBytes 가 이 byte 를 초과하면 chunked streaming 을 권고하는 default 임계(5 MB).
// 옵션 chunkThresholdBytes 로 덮어쓸 수 있다(정책 source 0 — 옵션으로 받은 값만 사용).
export const DEFAULT_CHUNK_THRESHOLD_BYTES = 5 * 1024 * 1024;

// polling 안내 문구에 쓸 default 간격(초). 옵션 pollIntervalSeconds 로 덮어쓸 수 있다.
export const DEFAULT_POLL_INTERVAL_SECONDS = 3;

// async job 의 정상 상태 흐름 — queued → running → ready. failed 는 실패 종단 상태라 정상 흐름
// 배열에 포함하지 않는다(enum 으로는 존재). 반환 시 항상 새 배열로 복제해 non-mutating 보장.
const ASYNC_STATUS_FLOW: readonly ExportJobStatus[] = [
  "queued",
  "running",
  "ready",
];

// estimate.recommendation 의 허용 집합 — 이 밖의 값은 호출측 배선 버그로 보아 RangeError.
// estimateExportDumpSize(T-0466)의 recommendation 타입과 동형 집합.
const VALID_RECOMMENDATIONS: ReadonlySet<string> = new Set<
  ExportDumpSizeEstimate["recommendation"]
>(["sync", "async-streaming"]);

// plain object(null/배열/비-object 아님) 판정 — estimate + options 입력 방어에 쓴다
// (export-dump-size-estimate.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (export-dump-size-estimate.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// byte / 간격 옵션값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number
// 거부(export-dump-size-estimate.isValidByteWeight 동형).
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// buildExportJobPlan — estimateExportDumpSize(T-0466)가 산출한 ExportDumpSizeEstimate 를 받아
// Export 다운로드 실행 plan 을 순수 derivation 으로 조립한다(UC-07 §8 NFR 정합):
//   - estimate.recommendation === "async-streaming"(== estimate.large) → mode="async-job" +
//     pollingRequired=true + statusFlow=[queued,running,ready] + chunked streaming·status polling
//     단계 안내(한국어). recommendation 을 ground truth 로 사용한다.
//   - estimate.recommendation === "sync" → mode="sync-download" + pollingRequired=false +
//     statusFlow=[] + 즉시 다운로드 안내. estimate.large 가 recommendation 과 모순되어도
//     (예: large=true 인데 recommendation="sync") recommendation 을 신뢰하고 large 는 무시한다
//     (recommendation 이 estimate 의 공식 권고 필드 — T-0466 불변 large===(recommendation===
//     "async-streaming") 이 깨진 입력은 호출측 책임).
//   - chunked 는 estimate.estimatedBytes > chunkThresholdBytes 일 때만 true(경계 === 는 초과 아님).
//
// 입력 estimate / options 를 변형하지 않으며(non-mutating — freeze 된 입력 통과), statusFlow /
// instructionLines 는 항상 새 배열. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - estimate 가 plain object 아님(null/배열/원시값) → TypeError(label "estimate").
//   - estimate.recommendation 이 "sync"/"async-streaming" 외 값 → RangeError(받은 값 박제).
//   - estimate.estimatedBytes 가 비-정수·음수·NaN·Infinity·비-number → TypeError.
//   - options 가 비-object(배열/null — undefined 는 정상) → TypeError.
//   - chunkThresholdBytes / pollIntervalSeconds 가 부적합 → TypeError(어느 옵션인지 박제).
export function buildExportJobPlan(
  estimate: ExportDumpSizeEstimate,
  options?: ExportJobPlanOptions,
): ExportJobPlan {
  // top-level estimate 가 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(estimate)) {
    throw new TypeError(
      `buildExportJobPlan: estimate 는 plain object 여야 합니다 (받음: ${describeNonObject(
        estimate,
      )})`,
    );
  }

  const recommendation = (estimate as { recommendation: unknown })
    .recommendation;
  if (
    typeof recommendation !== "string" ||
    !VALID_RECOMMENDATIONS.has(recommendation)
  ) {
    throw new RangeError(
      `buildExportJobPlan: estimate.recommendation 은 sync/async-streaming 중 하나여야 합니다 (받음: ${String(
        recommendation,
      )})`,
    );
  }

  const estimatedBytes = (estimate as { estimatedBytes: unknown })
    .estimatedBytes;
  if (!isValidNonNegativeInteger(estimatedBytes)) {
    throw new TypeError(
      `buildExportJobPlan: estimate.estimatedBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        estimatedBytes,
      )})`,
    );
  }

  // options 가 주어졌으면 비-object 거부(undefined 는 정상 — 전체 default 적용).
  if (options !== undefined && !isPlainObject(options)) {
    throw new TypeError(
      `buildExportJobPlan: options 는 plain object 여야 합니다 (받음: ${describeNonObject(
        options,
      )})`,
    );
  }

  const opts = (options ?? {}) as ExportJobPlanOptions;

  // chunkThresholdBytes — 주어졌을 때만 검증. 부재 시 DEFAULT_CHUNK_THRESHOLD_BYTES.
  if (
    opts.chunkThresholdBytes !== undefined &&
    !isValidNonNegativeInteger(opts.chunkThresholdBytes)
  ) {
    throw new TypeError(
      `buildExportJobPlan: options.chunkThresholdBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        opts.chunkThresholdBytes,
      )})`,
    );
  }
  const chunkThresholdBytes =
    opts.chunkThresholdBytes ?? DEFAULT_CHUNK_THRESHOLD_BYTES;

  // pollIntervalSeconds — 주어졌을 때만 검증. 부재 시 DEFAULT_POLL_INTERVAL_SECONDS.
  if (
    opts.pollIntervalSeconds !== undefined &&
    !isValidNonNegativeInteger(opts.pollIntervalSeconds)
  ) {
    throw new TypeError(
      `buildExportJobPlan: options.pollIntervalSeconds 는 0 이상의 정수여야 합니다 (받음: ${String(
        opts.pollIntervalSeconds,
      )})`,
    );
  }
  const pollIntervalSeconds =
    opts.pollIntervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS;

  // chunked 권고 — estimatedBytes 가 임계 초과 시에만 true(경계 === 는 초과 아님).
  const chunked = estimatedBytes > chunkThresholdBytes;
  const humanSize = (estimate as { humanSize?: unknown }).humanSize;
  const humanSizeText =
    typeof humanSize === "string" ? humanSize : `${estimatedBytes} B`;

  if (recommendation === "async-streaming") {
    // async-job → status polling 필수 + 정상 상태 흐름 박제. chunked 면 chunked streaming 안내 추가.
    const instructionLines = [
      `예상 dump 가 대량(${humanSizeText})이라 async job 으로 처리합니다.`,
      "1) Export job 을 생성합니다 (상태: queued).",
      `2) job 상태를 약 ${pollIntervalSeconds} 초 간격으로 polling 합니다 (queued → running → ready).`,
      chunked
        ? "3) 상태가 ready 가 되면 chunked streaming 으로 분할 다운로드합니다."
        : "3) 상태가 ready 가 되면 다운로드합니다.",
    ];
    return {
      mode: "async-job",
      chunked,
      pollingRequired: true,
      // ASYNC_STATUS_FLOW 는 모듈 공유 상수라 항상 새 배열로 복제(non-mutating 보장).
      statusFlow: [...ASYNC_STATUS_FLOW],
      headline: `Export 다운로드 plan: async job + status polling (예상 ${humanSizeText})`,
      instructionLines,
    };
  }

  // sync-download → 즉시 동기 다운로드. polling 불필요 + statusFlow 빈 배열.
  const instructionLines = [
    `예상 dump 가 소량(${humanSizeText})이라 즉시 동기 다운로드합니다.`,
    chunked
      ? "1) chunked streaming 으로 분할 다운로드합니다."
      : "1) 단일 응답으로 즉시 다운로드합니다.",
  ];
  return {
    mode: "sync-download",
    chunked,
    pollingRequired: false,
    statusFlow: [],
    headline: `Export 다운로드 plan: 즉시 동기 다운로드 (예상 ${humanSizeText})`,
    instructionLines,
  };
}
