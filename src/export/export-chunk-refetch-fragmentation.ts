// export-chunk-refetch-fragmentation — UC-07 §8 NFR chunked streaming 재요청 batch(T-0473)의
// 실패 byte 영역이 dump 전반에 *얼마나 흩어져(분산) 있는지의 형상(fragmentation)* 을 순수 산술로
// 정량화하는 helper (T-0475, P7 / REQ-030 / REQ-032 / REQ-045). 직전
// coalesceExportChunkRefetch(T-0473)는 수신측 무결성 reconcile 의 연속(인접 index) 실패 chunk 들을
// 하나의 byte 범위로 *병합*한 재요청 batch(ExportChunkRefetchBatch{rangeCount, failedChunkCount,
// refetchBytes, ranges})를 산정하고, summariseExportChunkRefetchSavings(T-0474)는 병합이 절감한
// *HTTP Range 요청 수·절감률*을 정량화한다. 그러나 둘 다 손상이 한 덩어리로 뭉쳐 있는지(1개 큰 범위)
// 아니면 dump 전반에 잘게 흩어져 있는지(많은 작은 범위), 가장 큰 범위가 얼마인지, 범위당 평균
// byte·chunk 수가 얼마인지 등 *손상 byte 영역의 분산 형상* 은 노출하지 않는다 — 38 helper 중 0 회
// cover 된 gap 이다(git grep fragment|scatter|dispersion|density|largestRange|averageRange|
// spanBytes|contiguity src/export → 0 도메인 cover).
//
// coalesceExportChunkRefetch 가 재요청 범위를 *병합·열거* 하고 summariseExportChunkRefetchSavings 가
// *요청 수 절감* 을 정량화한다면, 본 helper 는 그와 직교(orthogonal) — 이미 산출된
// ExportChunkRefetchBatch 의 ranges 배열을 1 회 순회해 *손상 byte 영역의 분산 형상*(범위 개수, 최대/
// 최소/평균 범위 byte, 범위당 평균 chunk 수, 단일 범위 통합 여부, 가장 큰 범위가 차지하는 byte 비중)을
// 순수 산술로 derive 한다(실 재전송·byte slice·HTTP Range·헤더 직렬화·요청 발행 0). 이로써 운영자/로그가
// "재요청 N개 범위, 최대 X bytes, 평균 Y bytes/범위" 같은 손상 형상을 관측해 재전송 전략(병렬도·우선순위)을
// 판단할 근거를 갖는다 — UC-07 §8 NFR 의 효율적 부분 손상 복구를 정량적으로 보강한다. 실 재전송·byte
// slice·HTTP Range·헤더 직렬화·스케줄링·고차 통계 0. coalesceExportChunkRefetch /
// summariseExportChunkRefetchSavings 를 재호출하지 않고 입력 batch 의 ranges·필드를 그대로 사용한다(DRY
// — coalescing 재실행·savings 중복 금지). 새 도메인 타입은 ExportChunkRefetchFragmentation 만 신설하며
// ExportChunkRefetchBatch / ExportChunkRefetchRange 는 재사용(import). 새 외부 dependency 0. 코드 골격은
// export-chunk-refetch-coalesce.ts(T-0473)의 isPlainObject / describeNonObject /
// isValidNonNegativeInteger 입력 방어 + 한국어 message convention 을 mirror 한다.
import {
  ExportChunkRefetchBatch,
  ExportChunkRefetchRange,
} from "./export-chunk-refetch-coalesce";

// chunked streaming 재요청 batch 의 실패 byte 영역 분산 형상 모델 — plain object. allIntact 는 재요청
// 범위가 0 개인가(= batch.allIntact), rangeCount 는 분산된 재요청 범위 개수(= batch.rangeCount =
// ranges.length), failedChunkCount 는 총 실패 chunk(= batch.failedChunkCount), refetchBytes 는 총
// 재요청 byte(= batch.refetchBytes), largestRangeBytes 는 가장 큰 범위의 byteLength(ranges 비었으면 0),
// smallestRangeBytes 는 가장 작은 범위의 byteLength(ranges 비었으면 0), averageRangeBytes 는 범위당
// 평균 byte(refetchBytes / rangeCount; rangeCount === 0 이면 0; 소수 그대로), averageChunksPerRange 는
// 범위당 평균 chunk 수(failedChunkCount / rangeCount; rangeCount === 0 이면 0; 소수 그대로),
// largestRangeChunkCount 는 가장 큰 byteLength 범위의 chunkCount(동률이면 먼저 만난 것; ranges 비었으면 0),
// largestRangeShare 는 가장 큰 범위가 차지하는 byte 비중(largestRangeBytes / refetchBytes; refetchBytes
// === 0 이면 0; 0~1 소수), singleRange 는 손상이 한 덩어리로 통합됐는가(rangeCount === 1), fragmented 는
// 손상이 둘 이상으로 분산됐는가(rangeCount > 1), headline 은 한국어 한 줄 요약이다. 후속 streaming
// controller / WebUI 재요청 안내가 그대로 사용한다.
export interface ExportChunkRefetchFragmentation {
  allIntact: boolean;
  rangeCount: number;
  failedChunkCount: number;
  refetchBytes: number;
  largestRangeBytes: number;
  smallestRangeBytes: number;
  averageRangeBytes: number;
  averageChunksPerRange: number;
  largestRangeChunkCount: number;
  largestRangeShare: number;
  singleRange: boolean;
  fragmented: boolean;
  headline: string;
}

// plain object(null/배열/비-object 아님) 판정 — batch 입력 방어에 쓴다
// (export-chunk-refetch-coalesce.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (export-chunk-refetch-coalesce.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// 값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부
// (export-chunk-refetch-coalesce.isValidNonNegativeInteger 동형).
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// ranges 의 각 원소가 손상되지 않은 ExportChunkRefetchRange 인지 검증 — plain object 이고
// byteLength/chunkCount 가 비-음수정수여야 한다(본 helper 가 실제로 사용하는 필드만 검증). 위반 시
// 부적합 원소 index·label·받은 값을 박제한 TypeError.
function assertValidRange(range: unknown, position: number): void {
  if (!isPlainObject(range)) {
    throw new TypeError(
      `summariseExportChunkRefetchFragmentation: batch.ranges[${position}] 는 plain object 여야 합니다 (받음: ${describeNonObject(
        range,
      )})`,
    );
  }
  const byteLength = (range as { byteLength: unknown }).byteLength;
  if (!isValidNonNegativeInteger(byteLength)) {
    throw new TypeError(
      `summariseExportChunkRefetchFragmentation: batch.ranges[${position}].byteLength 는 0 이상의 정수여야 합니다 (받음: ${String(
        byteLength,
      )})`,
    );
  }
  const chunkCount = (range as { chunkCount: unknown }).chunkCount;
  if (!isValidNonNegativeInteger(chunkCount)) {
    throw new TypeError(
      `summariseExportChunkRefetchFragmentation: batch.ranges[${position}].chunkCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        chunkCount,
      )})`,
    );
  }
}

// summariseExportChunkRefetchFragmentation — 이미 산출된 ExportChunkRefetchBatch(T-0473)의 ranges
// 배열을 1 회 순회해 실패 byte 영역의 분산 형상(범위 크기·산포)을 순수 산술로 derive 한다(UC-07 §8 NFR
// 정합).
//
// 산정:
//   - largestRangeBytes = max(byteLength), smallestRangeBytes = min(byteLength)(ranges 비었으면 둘 다 0).
//   - largestRangeChunkCount = largestRangeBytes 범위의 chunkCount(동률이면 먼저 만난 것).
//   - averageRangeBytes = rangeCount === 0 ? 0 : refetchBytes / rangeCount(소수 그대로).
//   - averageChunksPerRange = rangeCount === 0 ? 0 : failedChunkCount / rangeCount(소수 그대로).
//   - largestRangeShare = refetchBytes === 0 ? 0 : largestRangeBytes / refetchBytes(0~1).
//   - singleRange = rangeCount === 1, fragmented = rangeCount > 1, allIntact = batch.allIntact.
//
// 불변: rangeCount >= 1 일 때 0 <= smallestRangeBytes <= averageRangeBytes <= largestRangeBytes,
// largestRangeBytes <= refetchBytes, 0 <= largestRangeShare <= 1, rangeCount === 1 ⟹ largestRangeBytes
// === smallestRangeBytes === refetchBytes && largestRangeShare === 1 && singleRange && !fragmented,
// allIntact ⟺ rangeCount === 0 ⟺ (refetchBytes === 0 && failedChunkCount === 0), allIntact ⟹ 모든
// byte/평균/share 값 0 && !singleRange && !fragmented, rangeCount >= 1 일 때 singleRange XOR fragmented
// (rangeCount === 0 이면 둘 다 false).
//
// 경계: allIntact(rangeCount 0, ranges []) → 모든 byte/평균/share 0, singleRange/fragmented false,
// "재요청 범위 없음(무결)". 단일 범위(rangeCount 1) → largest === smallest === refetchBytes,
// largestRangeShare 1, singleRange true. 다중 범위 → 최대/최소/평균/share/fragmented derive.
//
// 입력 batch / batch.ranges 를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체는 항상
// 새 것. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - batch 이 plain object 아님(null/배열/원시값) → TypeError(label "batch").
//   - batch.ranges 가 배열 아님 → TypeError(label "batch.ranges", 받은 값 박제).
//   - batch.failedChunkCount / batch.rangeCount / batch.refetchBytes 비-음수정수 아님 → TypeError
//     (label·받은 값 박제 — 손상된 batch 거부).
//   - batch.allIntact 가 boolean 아님 → TypeError(label·받은 값 박제).
//   - batch.ranges 원소가 plain object 아님 / byteLength·chunkCount 비-음수정수 아님 → TypeError
//     (원소 index·label·받은 값 박제).
//   - batch.rangeCount !== batch.ranges.length(계약 위반) → RangeError(불일치 박제).
//   - batch.allIntact 와 수치의 모순(true 인데 rangeCount/ranges.length !== 0; false 인데 rangeCount ===
//     0) → RangeError(모순 박제).
//   - ranges 의 byteLength 합 !== batch.refetchBytes 또는 ranges 의 chunkCount 합 !==
//     batch.failedChunkCount(coalescing 계약 위반 — 손상된 batch) → RangeError(위반·기대값·실제값 박제).
export function summariseExportChunkRefetchFragmentation(
  batch: ExportChunkRefetchBatch,
): ExportChunkRefetchFragmentation {
  // top-level batch 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(batch)) {
    throw new TypeError(
      `summariseExportChunkRefetchFragmentation: batch 은 plain object 여야 합니다 (받음: ${describeNonObject(
        batch,
      )})`,
    );
  }

  const allIntact = (batch as { allIntact: unknown }).allIntact;
  if (typeof allIntact !== "boolean") {
    throw new TypeError(
      `summariseExportChunkRefetchFragmentation: batch.allIntact 는 boolean 이어야 합니다 (받음: ${String(
        allIntact,
      )})`,
    );
  }

  const failedChunkCount = (batch as { failedChunkCount: unknown })
    .failedChunkCount;
  if (!isValidNonNegativeInteger(failedChunkCount)) {
    throw new TypeError(
      `summariseExportChunkRefetchFragmentation: batch.failedChunkCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        failedChunkCount,
      )})`,
    );
  }

  const rangeCount = (batch as { rangeCount: unknown }).rangeCount;
  if (!isValidNonNegativeInteger(rangeCount)) {
    throw new TypeError(
      `summariseExportChunkRefetchFragmentation: batch.rangeCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        rangeCount,
      )})`,
    );
  }

  const refetchBytes = (batch as { refetchBytes: unknown }).refetchBytes;
  if (!isValidNonNegativeInteger(refetchBytes)) {
    throw new TypeError(
      `summariseExportChunkRefetchFragmentation: batch.refetchBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        refetchBytes,
      )})`,
    );
  }

  const ranges = (batch as { ranges: unknown }).ranges;
  if (!Array.isArray(ranges)) {
    throw new TypeError(
      `summariseExportChunkRefetchFragmentation: batch.ranges 는 배열이어야 합니다 (받음: ${describeNonObject(
        ranges,
      )})`,
    );
  }

  // 각 ranges 원소가 손상되지 않은 ExportChunkRefetchRange 인지 검증(byteLength/chunkCount 비-음수정수).
  for (let i = 0; i < ranges.length; i += 1) {
    assertValidRange(ranges[i], i);
  }

  const typedRanges = ranges as ExportChunkRefetchRange[];

  // rangeCount 와 실제 ranges.length 의 계약 일치 검증 — 손상된 batch 거부.
  if (rangeCount !== typedRanges.length) {
    throw new RangeError(
      `summariseExportChunkRefetchFragmentation: batch.rangeCount(${rangeCount})가 batch.ranges.length(${typedRanges.length})와 일치하지 않습니다 — 손상된 batch`,
    );
  }

  // allIntact 와 수치의 모순 검증 — 무결/손상 정의 위반 거부.
  if (allIntact === true && rangeCount !== 0) {
    throw new RangeError(
      `summariseExportChunkRefetchFragmentation: batch.allIntact 가 true 인데 batch.rangeCount(${rangeCount})가 0 이 아닙니다 — 모순된 batch`,
    );
  }
  if (allIntact === false && rangeCount === 0) {
    throw new RangeError(
      `summariseExportChunkRefetchFragmentation: batch.allIntact 가 false 인데 batch.rangeCount 가 0 입니다 — 모순된 batch`,
    );
  }

  // ranges 를 1 회 순회 — byteLength 합·chunkCount 합 누적 + 최대/최소 byteLength·최대 범위 chunkCount.
  let largestRangeBytes = 0;
  let smallestRangeBytes = 0;
  let largestRangeChunkCount = 0;
  let byteLengthSum = 0;
  let chunkCountSum = 0;
  for (let i = 0; i < typedRanges.length; i += 1) {
    const range = typedRanges[i];
    byteLengthSum += range.byteLength;
    chunkCountSum += range.chunkCount;
    if (i === 0) {
      largestRangeBytes = range.byteLength;
      smallestRangeBytes = range.byteLength;
      largestRangeChunkCount = range.chunkCount;
    } else {
      // 동률 최대는 먼저 만난 것을 유지하기 위해 *엄격 초과* 일 때만 교체.
      if (range.byteLength > largestRangeBytes) {
        largestRangeBytes = range.byteLength;
        largestRangeChunkCount = range.chunkCount;
      }
      if (range.byteLength < smallestRangeBytes) {
        smallestRangeBytes = range.byteLength;
      }
    }
  }

  // ranges 의 byteLength 합이 batch.refetchBytes 와 일치해야 한다(coalescing 계약 — byte 총량 보존).
  if (byteLengthSum !== refetchBytes) {
    throw new RangeError(
      `summariseExportChunkRefetchFragmentation: batch.ranges 의 byteLength 합(${byteLengthSum})이 batch.refetchBytes(${refetchBytes})와 일치하지 않습니다 — 손상된 batch`,
    );
  }
  // ranges 의 chunkCount 합이 batch.failedChunkCount 와 일치해야 한다(coalescing 계약).
  if (chunkCountSum !== failedChunkCount) {
    throw new RangeError(
      `summariseExportChunkRefetchFragmentation: batch.ranges 의 chunkCount 합(${chunkCountSum})이 batch.failedChunkCount(${failedChunkCount})와 일치하지 않습니다 — 손상된 batch`,
    );
  }

  const averageRangeBytes = rangeCount === 0 ? 0 : refetchBytes / rangeCount;
  const averageChunksPerRange =
    rangeCount === 0 ? 0 : failedChunkCount / rangeCount;
  const largestRangeShare =
    refetchBytes === 0 ? 0 : largestRangeBytes / refetchBytes;
  const singleRange = rangeCount === 1;
  const fragmented = rangeCount > 1;

  const headline = allIntact
    ? `chunked streaming 재요청 분산: 재요청 범위 없음(무결)`
    : `chunked streaming 재요청 분산: 재요청 ${rangeCount}개 범위, 최대 ${largestRangeBytes} bytes, 평균 ${averageRangeBytes} bytes/범위`;

  return {
    allIntact,
    rangeCount,
    failedChunkCount,
    refetchBytes,
    largestRangeBytes,
    smallestRangeBytes,
    averageRangeBytes,
    averageChunksPerRange,
    largestRangeChunkCount,
    largestRangeShare,
    singleRange,
    fragmented,
    headline,
  };
}
