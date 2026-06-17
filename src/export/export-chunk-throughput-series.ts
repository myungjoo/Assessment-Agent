// export-chunk-throughput-series — UC-07 §8 NFR chunked streaming 의 여러 처리율 snapshot
// (T-0477)을 시계열로 평활(smoothing)·집계하는 순수 helper (T-0478, P7 / REQ-030 / REQ-032 /
// REQ-045). estimateExportChunkStreamThroughput(T-0477)는 *단일* 진행 snapshot 으로부터 그 시점의
// 누적 평균 처리율·잔여 ETA·정체 여부를 산출하지만 — 누적 평균 한 값만으로는 전송이 도중에 얼마나
// 빨랐다 느려졌나(최고/최저 순간 처리율)·정체가 몇 번/몇 구간 있었나·진행이 단조 증가했나가 드러나지
// 않는다. 운영자/WebUI 가 polling 주기마다 받아 모은 throughput snapshot 의 시계열을 단일 요약으로
// 평활·집계하면 진행 바의 "평균 속도"·"최고 속도"·"정체 횟수" 표시와 §8 정체 누적 감지를 정량 보강한다.
//
// 이 multi-sample throughput series 도메인은 41 helper(T-0437~T-0477) 중 0 회 cover 된 gap 이며
// T-0477 의 Out of Scope 가 "이동 평균·다중 snapshot 시계열 기반 평활 throughput 은 별도 후속 helper
// 후보" 로 명시 deferral 한 직교 영역이다. 본 helper 는 T-0477 이 만든 ExportChunkStreamThroughput 의
// *배열*을 입력으로 받아 sample 별 bytesPerSecond / stalled / transferredBytes / complete 필드로부터
// 시계열 집계를 derive 한다(처리율 재산정 0 — DRY, estimateExportChunkStreamThroughput 재호출 금지).
//
// 실 streaming / byte slice / HTTP Range·206 Partial Content / 타이머·Date.now()·performance.now()
// 등 실 시계 read 0 — 각 snapshot 의 수치는 caller 가 이미 산정해 전달한다(순수·결정성·non-mutating).
// 새 도메인 타입은 ExportChunkThroughputSeries 만 신설하며 ExportChunkStreamThroughput 는
// 재사용(import). 새 외부 dependency 0. 코드 골격은 export-chunk-stream-throughput.ts(T-0477)의
// isPlainObject / describeNonObject / isValidNonNegativeInteger 입력 방어 + 한국어 message
// convention 을 mirror 한다(비가중 산술 평균·최고·최저만 — EWMA·가중 평활·고차 통계는 Out of Scope).
import { ExportChunkStreamThroughput } from "./export-chunk-stream-throughput";

// chunked streaming 처리율 snapshot 시계열 집계 모델 — plain object. sampleCount 는 입력 배열 길이,
// averageBytesPerSecond 는 sample 들의 bytesPerSecond 산술 평균(빈 배열 → 0), peakBytesPerSecond /
// minBytesPerSecond 는 최댓/최솟값(빈 배열 → 0), stalledSampleCount 는 stalled === true 인 sample 수,
// stalledWindowCount 는 연속된 stalled sample 묶음을 1 구간으로 센 정체 *구간* 수(run-length),
// everStalled 는 정체가 한 번이라도 있었는가(= stalledSampleCount > 0), monotonicProgress 는 인접
// sample 의 transferredBytes 가 비-감소인가(역행 0; sampleCount ≤ 1 → true), complete 는 마지막
// sample 의 complete(빈 배열 → false), headline 은 한국어 한 줄 요약이다.
// 불변: 0 <= minBytesPerSecond <= averageBytesPerSecond <= peakBytesPerSecond (sampleCount ≥ 1),
// 0 <= stalledWindowCount <= stalledSampleCount <= sampleCount, everStalled === (stalledSampleCount
// > 0), stalledSampleCount === 0 ⟹ stalledWindowCount === 0, sampleCount <= 1 ⟹ monotonicProgress
// === true. 후속 WebUI 진행 표시(UC-07 §5 step 13)가 그대로 사용한다.
export interface ExportChunkThroughputSeries {
  sampleCount: number;
  averageBytesPerSecond: number;
  peakBytesPerSecond: number;
  minBytesPerSecond: number;
  stalledSampleCount: number;
  stalledWindowCount: number;
  everStalled: boolean;
  monotonicProgress: boolean;
  complete: boolean;
  headline: string;
}

// plain object(null/배열/비-object 아님) 판정 — sample 원소 입력 방어에 쓴다
// (export-chunk-stream-throughput.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (export-chunk-stream-throughput.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// 값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부
// (export-chunk-stream-throughput.isValidNonNegativeInteger 동형).
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// 값이 유효한 비-음수 유한 number(소수 허용, 0 허용)인지 판정 — NaN/Infinity/음수/비-number 거부.
// bytesPerSecond 는 처리율이라 소수일 수 있으므로 정수가 아니라 유한 number 로 검증한다.
function isValidNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// summariseExportChunkThroughputSeries — estimateExportChunkStreamThroughput(T-0477)가 산출한
// ExportChunkStreamThroughput snapshot 배열을 단일 패스로 순회해 평균/최고/최저 byte rate·정체 sample
// 수·정체 구간(run-length) 수·everStalled·단조 진행·완료 여부를 순수 산술로 평활·집계한다.
//   - averageBytesPerSecond = sampleCount === 0 ? 0 : Σ bytesPerSecond / sampleCount.
//   - peakBytesPerSecond = sampleCount === 0 ? 0 : max(bytesPerSecond).
//   - minBytesPerSecond = sampleCount === 0 ? 0 : min(bytesPerSecond).
//   - stalledSampleCount = count(stalled === true).
//   - stalledWindowCount = stalled === true 인 sample 의 연속 run 개수.
//   - monotonicProgress = ∀ i>0: samples[i].transferredBytes >= samples[i-1].transferredBytes.
//   - complete = sampleCount === 0 ? false : samples[last].complete.
//
// 경계: 빈 배열([]) → sampleCount=0·모든 rate 0·stalledSampleCount/stalledWindowCount=0·
// everStalled=false·monotonicProgress=true·complete=false. 단일 sample → average=peak=min=그 sample
// 의 bytesPerSecond·monotonicProgress=true·stalledWindowCount = sample.stalled ? 1 : 0. 모두 정체 →
// stalledSampleCount=sampleCount·stalledWindowCount=1. 교차 정체([정체,정상,정체]) → stalledWindowCount=2.
// transferredBytes 역행 → monotonicProgress=false.
//
// 입력 배열·원소를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체는 항상 새 것. 동일
// 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - samples 가 배열 아님(null/object/원시값) → TypeError(label "samples").
//   - 원소가 plain object 아님(null/배열/원시값) → TypeError(index·받은 값 박제).
//   - 원소의 bytesPerSecond 가 비-음수 유한 number 아님 → TypeError(index·label·받은 값 박제).
//   - 원소의 transferredBytes 가 비-음수정수 아님 → TypeError(index·label·받은 값 박제).
//   - 원소의 stalled / complete 가 boolean 아님 → TypeError(index·label·받은 값 박제).
export function summariseExportChunkThroughputSeries(
  samples: ExportChunkStreamThroughput[],
): ExportChunkThroughputSeries {
  // top-level samples 가 배열이 아니면 순회 불가 — 즉시 throw.
  if (!Array.isArray(samples)) {
    throw new TypeError(
      `summariseExportChunkThroughputSeries: samples 는 배열이어야 합니다 (받음: ${describeNonObject(
        samples,
      )})`,
    );
  }

  const sampleCount = samples.length;

  // 단일 패스 집계용 누적기 — rate 의 합/최고/최저, 정체 sample/run 수, 단조 진행 여부.
  let sumBytesPerSecond = 0;
  let peakBytesPerSecond = 0;
  let minBytesPerSecond = 0;
  let stalledSampleCount = 0;
  let stalledWindowCount = 0;
  let monotonicProgress = true;
  let previousStalled = false;
  let previousTransferredBytes = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = samples[index];

    // 원소가 plain object 가 아니면 하위 필드 접근 불가 — index·받은 값 박제 후 throw.
    if (!isPlainObject(sample)) {
      throw new TypeError(
        `summariseExportChunkThroughputSeries: samples[${index}] 는 plain object 여야 합니다 (받음: ${describeNonObject(
          sample,
        )})`,
      );
    }

    const bytesPerSecond = (sample as { bytesPerSecond: unknown })
      .bytesPerSecond;
    if (!isValidNonNegativeFinite(bytesPerSecond)) {
      throw new TypeError(
        `summariseExportChunkThroughputSeries: samples[${index}].bytesPerSecond 는 0 이상의 유한 number 여야 합니다 (받음: ${String(
          bytesPerSecond,
        )})`,
      );
    }

    const transferredBytes = (sample as { transferredBytes: unknown })
      .transferredBytes;
    if (!isValidNonNegativeInteger(transferredBytes)) {
      throw new TypeError(
        `summariseExportChunkThroughputSeries: samples[${index}].transferredBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
          transferredBytes,
        )})`,
      );
    }

    const stalled = (sample as { stalled: unknown }).stalled;
    if (typeof stalled !== "boolean") {
      throw new TypeError(
        `summariseExportChunkThroughputSeries: samples[${index}].stalled 는 boolean 이어야 합니다 (받음: ${String(
          stalled,
        )})`,
      );
    }

    const complete = (sample as { complete: unknown }).complete;
    if (typeof complete !== "boolean") {
      throw new TypeError(
        `summariseExportChunkThroughputSeries: samples[${index}].complete 는 boolean 이어야 합니다 (받음: ${String(
          complete,
        )})`,
      );
    }

    // rate 집계 — 합산 + 첫 원소를 max/min 시드로, 이후 갱신.
    sumBytesPerSecond += bytesPerSecond;
    if (index === 0) {
      peakBytesPerSecond = bytesPerSecond;
      minBytesPerSecond = bytesPerSecond;
    } else {
      if (bytesPerSecond > peakBytesPerSecond) {
        peakBytesPerSecond = bytesPerSecond;
      }
      if (bytesPerSecond < minBytesPerSecond) {
        minBytesPerSecond = bytesPerSecond;
      }
    }

    // 정체 집계 — sample 수 + run 경계(직전이 비정체였다가 정체로 진입할 때 새 구간 1 증가).
    if (stalled) {
      stalledSampleCount += 1;
      if (!previousStalled) {
        stalledWindowCount += 1;
      }
    }

    // 단조 진행 — 첫 원소 이후 transferredBytes 가 직전보다 작으면 역행(monotonic 깨짐).
    if (index > 0 && transferredBytes < previousTransferredBytes) {
      monotonicProgress = false;
    }

    previousStalled = stalled;
    previousTransferredBytes = transferredBytes;
  }

  const averageBytesPerSecond =
    sampleCount === 0 ? 0 : sumBytesPerSecond / sampleCount;
  const everStalled = stalledSampleCount > 0;
  const complete =
    sampleCount === 0 ? false : samples[sampleCount - 1].complete;

  const headline =
    sampleCount === 0
      ? "chunked streaming 처리율 시계열: 표본 없음 (sample 0)"
      : `chunked streaming 처리율 시계열: 표본 ${sampleCount} 개, 평균 ${averageBytesPerSecond} B/s, 최고 ${peakBytesPerSecond} B/s, 최저 ${minBytesPerSecond} B/s, 정체 ${stalledWindowCount} 구간(${stalledSampleCount} 표본), ${
          complete ? "전송 완료" : "전송 진행 중"
        }`;

  return {
    sampleCount,
    averageBytesPerSecond,
    peakBytesPerSecond,
    minBytesPerSecond,
    stalledSampleCount,
    stalledWindowCount,
    everStalled,
    monotonicProgress,
    complete,
    headline,
  };
}
