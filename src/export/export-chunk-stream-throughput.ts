// export-chunk-stream-throughput — UC-07 §8 NFR chunked streaming 의 전송 *진행 상태*(T-0470)와
// caller 가 측정한 경과 시간(elapsedMillis)으로부터 전송 처리율(throughput)·잔여 ETA·정체(stall)
// 여부를 순수 산술로 정량화하는 helper (T-0477, P7 / REQ-030 / REQ-032 / REQ-045).
// describeExportChunkStreamProgress(T-0470)는 ExportChunkStreamProgress{transferredBytes,
// remainingBytes, totalBytes, complete, percentComplete, ...}로 전송 진행 상태를 산출하지만 — 이는
// 순수히 byte/chunk 차원일 뿐 시간 차원이 전혀 없다. 운영자/WebUI 가 "얼마나 빨리 전송 중인가(처리율)·
// 앞으로 얼마나 더 걸리나(ETA)·전송이 멈춰있는가(stall)"를 알려면 진행 snapshot 에 경과 시간을 결합한
// 정량화가 필요하다. 이 transfer-rate/ETA/stall 도메인은 40 helper(T-0437~T-0476) 중 0 회 cover 된
// gap 이다(git grep -iwl throughput|bytesPerMillisecond|bytesPerSecond|etaMillis|transferRate|
// elapsedMillis src/export → 0 매칭).
//
// 직전 4 helper(coalesce T-0473 / savings T-0474 / fragmentation T-0475 / gap T-0476)는 모두
// ExportChunkRefetchBatch 의 부분 손상 재요청 byte 영역 metric 을 다뤘다 — 그 refetch-batch metric
// 공간은 포화 상태다. 본 helper 는 그와 직교(orthogonal) — 정상 streaming 의 시간 대비 진행 효율을
// 정량화한다(처리율 = transferred / elapsed, 잔여 ETA = remaining / rate, 정체 = rate ≈ 0).
//
// 실 streaming / byte slice 추출 / HTTP Range·206 Partial Content / 타이머·Date.now()·
// performance.now() 등 실 시계 read 0 — elapsedMillis 는 caller 가 측정해 인자로 전달한다(순수·결정성).
// 진행 상태(transferredBytes·remainingBytes·percentComplete)를 재산정하지 않고 입력으로 받은
// ExportChunkStreamProgress 의 필드를 그대로 사용한다(DRY — describeExportChunkStreamProgress
// 재호출·재구현 금지). 새 도메인 타입은 ExportChunkStreamThroughput 만 신설하며
// ExportChunkStreamProgress 는 재사용(import). 새 외부 dependency 0. 코드 골격은
// export-chunk-stream-progress.ts(T-0470)의 isPlainObject / describeNonObject /
// isValidNonNegativeInteger 입력 방어 + 한국어 message convention 을 mirror 한다.
import { ExportChunkStreamProgress } from "./export-chunk-stream-progress";

// chunked streaming 전송 처리율·잔여 ETA·정체 모델 — plain object. complete 는 전송 완료 여부
// (= progress.complete), transferredBytes/remainingBytes/totalBytes 는 입력 progress 의 byte 수치
// 그대로, elapsedMillis 는 입력 경과 시간 그대로, bytesPerMillisecond 는 ms 당 전송 byte
// (= elapsedMillis === 0 ? 0 : transferredBytes / elapsedMillis; 소수 그대로), bytesPerSecond 는 초당
// 전송 byte(= bytesPerMillisecond * 1000), etaMillis 는 잔여 byte 전송 추정 ms, etaKnown 은 ETA 산정
// 가능 여부(= remainingBytes === 0 || bytesPerMillisecond > 0), stalled 는 정체 여부(= 미완료인데
// 시간은 흘렀으나 한 byte 도 전송 안 됨), headline 은 한국어 한 줄 요약이다.
// etaMillis 의미: etaKnown === false 일 때 etaMillis === 0 은 "산정 불가"(미완료인데 rate 0),
// etaKnown === true 일 때 etaMillis === 0 은 "이미 완료/잔여 0"을 뜻한다(etaKnown 으로 구분).
// 불변: bytesPerMillisecond >= 0, bytesPerSecond === bytesPerMillisecond * 1000,
// etaKnown === false ⟹ etaMillis === 0, remainingBytes === 0 ⟹ etaMillis === 0 && etaKnown === true,
// complete ⟹ remainingBytes === 0 && etaMillis === 0 && etaKnown === true && stalled === false,
// transferredBytes + remainingBytes === totalBytes, stalled === true ⟹ bytesPerMillisecond === 0 &&
// !complete. 후속 WebUI 진행 표시(UC-07 §5 step 13 의 "남은 시간"·"전송 속도")가 그대로 사용한다.
export interface ExportChunkStreamThroughput {
  complete: boolean;
  transferredBytes: number;
  remainingBytes: number;
  totalBytes: number;
  elapsedMillis: number;
  bytesPerMillisecond: number;
  bytesPerSecond: number;
  etaMillis: number;
  etaKnown: boolean;
  stalled: boolean;
  headline: string;
}

// plain object(null/배열/비-object 아님) 판정 — progress 입력 방어에 쓴다
// (export-chunk-stream-progress.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (export-chunk-stream-progress.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// 값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부
// (export-chunk-stream-progress.isValidNonNegativeInteger 동형).
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// estimateExportChunkStreamThroughput — 이미 산출된 ExportChunkStreamProgress(T-0470)와 caller 가
// 측정한 비-음수정수 elapsedMillis 로부터 전송 처리율·잔여 ETA·정체 여부를 순수 산술로 derive 한다
// (UC-07 §8 NFR + §5 step 13 정합):
//   - bytesPerMillisecond = elapsedMillis === 0 ? 0 : transferredBytes / elapsedMillis.
//   - bytesPerSecond = bytesPerMillisecond * 1000.
//   - etaKnown = remainingBytes === 0 || bytesPerMillisecond > 0.
//   - etaMillis = remainingBytes === 0 ? 0 : (bytesPerMillisecond > 0 ? remainingBytes /
//     bytesPerMillisecond : 0).
//   - stalled = !complete && elapsedMillis > 0 && transferredBytes === 0.
//   - complete = progress.complete.
//
// 경계: complete === true(remainingBytes=0) → etaMillis=0·etaKnown=true·stalled=false(elapsedMillis
// 무관). elapsedMillis === 0(아직 측정 시작) → rate 0·stalled=false(시간 안 흘렀으므로 정체 아님),
// 미완료면 etaKnown=false·etaMillis=0. 정체(elapsedMillis > 0, transferredBytes=0, 미완료) →
// stalled=true·rate 0·etaKnown=false·etaMillis=0. 정상 진행 → rate·ETA derive·stalled=false.
//
// 입력 progress 를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체는 항상 새 것. 동일
// 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - progress 이 plain object 아님(null/배열/원시값) → TypeError(label "progress").
//   - progress.transferredBytes / remainingBytes / totalBytes 비-음수정수 아님 → TypeError(label·받은
//     값 박제).
//   - progress.complete 가 boolean 아님 → TypeError(label·받은 값 박제).
//   - elapsedMillis 비-음수정수 아님(음수·소수·NaN·Infinity·비-number) → TypeError(label·받은 값 박제).
//   - transferredBytes + remainingBytes !== totalBytes(progress 계약 위반) → RangeError(기대·실제값 박제).
//   - complete === true 인데 remainingBytes !== 0, 또는 complete === false 인데 remainingBytes === 0 &&
//     totalBytes > 0(complete 와 remainingBytes 모순) → RangeError(모순 박제).
export function estimateExportChunkStreamThroughput(
  progress: ExportChunkStreamProgress,
  elapsedMillis: number,
): ExportChunkStreamThroughput {
  // top-level progress 가 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(progress)) {
    throw new TypeError(
      `estimateExportChunkStreamThroughput: progress 는 plain object 여야 합니다 (받음: ${describeNonObject(
        progress,
      )})`,
    );
  }

  const transferredBytes = (progress as { transferredBytes: unknown })
    .transferredBytes;
  if (!isValidNonNegativeInteger(transferredBytes)) {
    throw new TypeError(
      `estimateExportChunkStreamThroughput: progress.transferredBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        transferredBytes,
      )})`,
    );
  }

  const remainingBytes = (progress as { remainingBytes: unknown })
    .remainingBytes;
  if (!isValidNonNegativeInteger(remainingBytes)) {
    throw new TypeError(
      `estimateExportChunkStreamThroughput: progress.remainingBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        remainingBytes,
      )})`,
    );
  }

  const totalBytes = (progress as { totalBytes: unknown }).totalBytes;
  if (!isValidNonNegativeInteger(totalBytes)) {
    throw new TypeError(
      `estimateExportChunkStreamThroughput: progress.totalBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        totalBytes,
      )})`,
    );
  }

  const complete = (progress as { complete: unknown }).complete;
  if (typeof complete !== "boolean") {
    throw new TypeError(
      `estimateExportChunkStreamThroughput: progress.complete 는 boolean 이어야 합니다 (받음: ${String(
        complete,
      )})`,
    );
  }

  // elapsedMillis 는 비-음수 정수여야 한다 — 음수·소수·NaN·Infinity·비-number 거부.
  if (!isValidNonNegativeInteger(elapsedMillis)) {
    throw new TypeError(
      `estimateExportChunkStreamThroughput: elapsedMillis 는 0 이상의 정수여야 합니다 (받음: ${String(
        elapsedMillis,
      )})`,
    );
  }

  // progress 의 byte 보존 계약 검증 — transferred + remaining 이 total 과 일치해야 한다.
  if (transferredBytes + remainingBytes !== totalBytes) {
    throw new RangeError(
      `estimateExportChunkStreamThroughput: progress.transferredBytes(${transferredBytes}) + progress.remainingBytes(${remainingBytes})가 progress.totalBytes(${totalBytes})와 일치하지 않습니다 — 손상된 progress`,
    );
  }

  // complete 와 remainingBytes 의 모순 검증 — complete ⟺ remainingBytes === 0(단, totalBytes 0 인
  // 빈 전송은 미완료 표기일 수 없으므로 complete === false && remainingBytes === 0 은 totalBytes > 0
  // 일 때만 모순).
  if (complete === true && remainingBytes !== 0) {
    throw new RangeError(
      `estimateExportChunkStreamThroughput: progress.complete 가 true 인데 progress.remainingBytes(${remainingBytes})가 0 이 아닙니다 — 모순된 progress`,
    );
  }
  if (complete === false && remainingBytes === 0 && totalBytes > 0) {
    throw new RangeError(
      `estimateExportChunkStreamThroughput: progress.complete 가 false 인데 progress.remainingBytes 가 0 입니다 (totalBytes=${totalBytes}) — 모순된 progress`,
    );
  }

  // 처리율 — elapsedMillis 0(아직 측정 시작)이면 단락 0, 그 외 transferred / elapsed(소수 그대로).
  const bytesPerMillisecond =
    elapsedMillis === 0 ? 0 : transferredBytes / elapsedMillis;
  const bytesPerSecond = bytesPerMillisecond * 1000;

  // ETA 산정 가능 여부 — 잔여 0(이미 완료)이거나 rate 가 양수여야 추정 가능.
  const etaKnown = remainingBytes === 0 || bytesPerMillisecond > 0;
  // 잔여 ETA — 잔여 0 이면 0, rate 양수면 remaining / rate, 그 외(미완료인데 rate 0)는 산정 불가라
  // sentinel 0(etaKnown === false 로 의미 구분).
  const etaMillis =
    remainingBytes === 0
      ? 0
      : bytesPerMillisecond > 0
        ? remainingBytes / bytesPerMillisecond
        : 0;

  // 정체 — 미완료인데 시간은 흘렀으나(elapsedMillis > 0) 한 byte 도 전송 안 됨.
  const stalled = !complete && elapsedMillis > 0 && transferredBytes === 0;

  const headline = complete
    ? `chunked streaming 처리율: 전송 완료 (${totalBytes} B, ${elapsedMillis} ms, ${bytesPerSecond} B/s)`
    : stalled
      ? `chunked streaming 처리율: 정체 — ${elapsedMillis} ms 동안 0 B 전송 (잔여 ${remainingBytes} B, ETA 산정 불가)`
      : etaKnown
        ? `chunked streaming 처리율: ${bytesPerSecond} B/s, 전송 ${transferredBytes}/${totalBytes} B, 잔여 ${remainingBytes} B, ETA ${etaMillis} ms`
        : `chunked streaming 처리율: 측정 시작 전(${elapsedMillis} ms), 전송 ${transferredBytes}/${totalBytes} B, ETA 산정 불가`;

  return {
    complete,
    transferredBytes,
    remainingBytes,
    totalBytes,
    elapsedMillis,
    bytesPerMillisecond,
    bytesPerSecond,
    etaMillis,
    etaKnown,
    stalled,
    headline,
  };
}
