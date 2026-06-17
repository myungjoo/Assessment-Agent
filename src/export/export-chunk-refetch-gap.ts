// export-chunk-refetch-gap — UC-07 §8 NFR chunked streaming 재요청 batch(T-0473)의 분산된 재요청
// 범위들 *사이*에 끼어 있는 무결(intact) byte gap 을 순수 산술로 정량화하는 helper (T-0476, P7 /
// REQ-030 / REQ-032 / REQ-045). 직전 coalesceExportChunkRefetch(T-0473)는 수신측 무결성 reconcile 의
// 연속(인접 index) 실패 chunk 들을 하나의 byte 범위로 *병합*한 재요청 batch(ExportChunkRefetchBatch
// {rangeCount, failedChunkCount, refetchBytes, ranges})를 산정하고,
// summariseExportChunkRefetchSavings(T-0474)는 병합이 절감한 *HTTP Range 요청 수·절감률*을,
// summariseExportChunkRefetchFragmentation(T-0475)는 손상 byte 영역의 *분산 형상*(최대/최소/평균 범위
// byte·범위 크기 산포)을 정량화한다. 그러나 셋 중 어느 것도 *분산된 재요청 범위들 사이*에 끼어 있는
// 무결 byte gap — 즉 첫 범위 시작부터 마지막 범위 끝까지의 outer span 안에서 실패 범위가 차지하지 않는
// 무결 byte 가 얼마인지, gap 이 몇 개인지, 가장 큰 gap 이 얼마인지 — 는 노출하지 않는다. 이 gap-
// between-ranges 도메인은 39 helper 중 0 회 cover 된 gap 이다(git grep -i gapBytes|interRangeGap|
// betweenRange|coverageSpan|spannedBytes|outerSpan|wastedBytes|envelopeBytes|gapCount src/export → 0).
//
// coalesceExportChunkRefetch 가 재요청 범위를 *병합·열거* 하고, summariseExportChunkRefetchSavings 가
// *요청 수 절감* 을, summariseExportChunkRefetchFragmentation 가 *범위 크기 분산* 을 정량화한다면, 본
// helper 는 그와 직교(orthogonal) — 이미 산출된 ExportChunkRefetchBatch 의 ranges 배열을 1 회 순회해
// 인접 범위 *사이*의 무결 byte gap(outer span·spannedBytes·gapBytes·largest/averageGapBytes·gapRatio·
// gapCount·contiguous)을 순수 산술로 derive 한다(실 재전송·byte slice·HTTP Range·헤더 직렬화·요청 발행
// 0). 이 gap 정보는 재전송 전략 결정에 핵심이다: N 개의 분리된 작은 Range 요청(refetchBytes 만 전송,
// gap 0)과 outer span 전체를 한 번의 큰 Range 요청(spannedBytes = refetchBytes + gapBytes 전송, gap 의
// 무결 byte 까지 불필요 재전송하지만 요청 1 개)의 trade-off 를 판단하려면 gap 총량·형상이 필요하다.
// UC-07 §8 NFR 의 효율적 부분 손상 복구를 정량적으로 보강한다.
//
// 실 재전송·byte slice 추출·HTTP Range 요청·206 Partial Content·Content-Range/Range 헤더 직렬화·
// whole-span vs N-range 재전송 전략 결정·고차 통계(표준편차·중앙값·히스토그램) 0. coalesceExport
// ChunkRefetch / summariseExportChunkRefetchSavings / summariseExportChunkRefetchFragmentation 를
// 재호출하지 않고 입력 batch 의 ranges·필드를 그대로 사용한다(DRY — coalescing 재실행·savings/
// fragmentation 중복 금지). 새 도메인 타입은 ExportChunkRefetchGaps 만 신설하며 ExportChunkRefetchBatch
// / ExportChunkRefetchRange 는 재사용(import). 새 외부 dependency 0. 코드 골격은
// export-chunk-refetch-coalesce.ts(T-0473)의 isPlainObject / describeNonObject /
// isValidNonNegativeInteger 입력 방어 + 한국어 message convention 을 mirror 한다.
import {
  ExportChunkRefetchBatch,
  ExportChunkRefetchRange,
} from "./export-chunk-refetch-coalesce";

// chunked streaming 재요청 batch 의 분산 범위 사이 무결 byte gap 모델 — plain object. allIntact 는
// 재요청 범위가 0 개인가(= batch.allIntact), rangeCount 는 분산된 재요청 범위 개수(= batch.rangeCount =
// ranges.length), refetchBytes 는 실패 범위 byte 합(= batch.refetchBytes), outerSpanFirstBytePos 는 첫
// 범위의 firstBytePos(ranges 비었으면 0), outerSpanLastBytePos 는 마지막 범위의 lastBytePos(ranges
// 비었으면 0), spannedBytes 는 outer span 전체 byte(= outerSpanLastBytePos - outerSpanFirstBytePos + 1;
// ranges 비었으면 0; rangeCount === 1 이면 === refetchBytes), gapCount 는 인접 범위 사이 gap 개수
// (= max(rangeCount - 1, 0)), gapBytes 는 범위 사이 무결 byte 총합(= spannedBytes - refetchBytes; ranges
// 비었거나 단일 범위면 0), largestGapBytes 는 가장 큰 단일 gap 의 byte(gap 없으면 0), averageGapBytes 는
// gap 당 평균 byte(gapBytes / gapCount; gapCount === 0 이면 0; 소수 그대로), gapRatio 는 outer span 중
// 무결 비중(gapBytes / spannedBytes; spannedBytes === 0 이면 0; 0~1 소수), contiguous 는 범위 사이 gap 이
// 0 인가(gapCount === 0 — 무결이거나 단일 범위), headline 은 한국어 한 줄 요약이다. 후속 streaming
// controller / WebUI 재요청 안내가 그대로 사용한다.
export interface ExportChunkRefetchGaps {
  allIntact: boolean;
  rangeCount: number;
  refetchBytes: number;
  outerSpanFirstBytePos: number;
  outerSpanLastBytePos: number;
  spannedBytes: number;
  gapCount: number;
  gapBytes: number;
  largestGapBytes: number;
  averageGapBytes: number;
  gapRatio: number;
  contiguous: boolean;
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
// firstBytePos/lastBytePos/byteLength 가 비-음수정수여야 한다(본 helper 가 실제로 사용하는 필드).
// 위반 시 부적합 원소 index·label·받은 값을 박제한 TypeError.
function assertValidRange(range: unknown, position: number): void {
  if (!isPlainObject(range)) {
    throw new TypeError(
      `summariseExportChunkRefetchGaps: batch.ranges[${position}] 는 plain object 여야 합니다 (받음: ${describeNonObject(
        range,
      )})`,
    );
  }
  const firstBytePos = (range as { firstBytePos: unknown }).firstBytePos;
  if (!isValidNonNegativeInteger(firstBytePos)) {
    throw new TypeError(
      `summariseExportChunkRefetchGaps: batch.ranges[${position}].firstBytePos 는 0 이상의 정수여야 합니다 (받음: ${String(
        firstBytePos,
      )})`,
    );
  }
  const lastBytePos = (range as { lastBytePos: unknown }).lastBytePos;
  if (!isValidNonNegativeInteger(lastBytePos)) {
    throw new TypeError(
      `summariseExportChunkRefetchGaps: batch.ranges[${position}].lastBytePos 는 0 이상의 정수여야 합니다 (받음: ${String(
        lastBytePos,
      )})`,
    );
  }
  const byteLength = (range as { byteLength: unknown }).byteLength;
  if (!isValidNonNegativeInteger(byteLength)) {
    throw new TypeError(
      `summariseExportChunkRefetchGaps: batch.ranges[${position}].byteLength 는 0 이상의 정수여야 합니다 (받음: ${String(
        byteLength,
      )})`,
    );
  }
}

// summariseExportChunkRefetchGaps — 이미 산출된 ExportChunkRefetchBatch(T-0473)의 ranges 배열을 1 회
// 순회해 인접 쌍 (ranges[i], ranges[i+1]) 의 gap = ranges[i+1].firstBytePos - ranges[i].lastBytePos - 1
// 을 누적·최대화하여 범위 *사이*의 무결 byte gap 을 순수 산술로 derive 한다(UC-07 §8 NFR 정합).
//
// 산정:
//   - outerSpanFirstBytePos = ranges[0].firstBytePos(비었으면 0).
//   - outerSpanLastBytePos = ranges[last].lastBytePos(비었으면 0).
//   - spannedBytes = rangeCount === 0 ? 0 : outerSpanLastBytePos - outerSpanFirstBytePos + 1.
//   - gapBytes = Σ gap, largestGapBytes = max(gap), gapCount = max(rangeCount - 1, 0).
//   - averageGapBytes = gapCount === 0 ? 0 : gapBytes / gapCount(소수 그대로).
//   - gapRatio = spannedBytes === 0 ? 0 : gapBytes / spannedBytes(0~1).
//   - contiguous = gapCount === 0, allIntact = batch.allIntact.
//
// 불변: spannedBytes === refetchBytes + gapBytes, 0 <= gapBytes <= spannedBytes, 0 <= gapRatio <= 1,
// largestGapBytes <= gapBytes, gapCount === 0 ⟹ gapBytes/largestGapBytes/averageGapBytes/gapRatio === 0
// && contiguous, rangeCount === 1 ⟹ spannedBytes === refetchBytes && gapCount === 0 && contiguous,
// allIntact ⟺ rangeCount === 0 ⟹ 모든 span/gap 값 0 && contiguous, rangeCount >= 2 ⟹ gapBytes >=
// rangeCount - 1(병합 batch 는 인접 범위 사이 최소 1 byte gap — 연속이면 병합됐을 것).
//
// 경계: allIntact(rangeCount 0, ranges []) → 모든 span/gap 값 0, gapCount 0, contiguous true, "재요청
// 범위 없음(무결)". 단일 범위(rangeCount 1) → spannedBytes === refetchBytes, gap 전부 0, contiguous.
// 다중 범위 → outer span/gapBytes/largestGapBytes/averageGapBytes/gapRatio derive, !contiguous.
//
// 입력 batch / batch.ranges 를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체는 항상
// 새 것. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - batch 이 plain object 아님(null/배열/원시값) → TypeError(label "batch").
//   - batch.ranges 가 배열 아님 → TypeError(label "batch.ranges", 받은 값 박제).
//   - batch.failedChunkCount / batch.rangeCount / batch.refetchBytes 비-음수정수 아님 → TypeError
//     (label·받은 값 박제 — 손상된 batch 거부).
//   - batch.allIntact 가 boolean 아님 → TypeError(label·받은 값 박제).
//   - batch.ranges 원소가 plain object 아님 / firstBytePos·lastBytePos·byteLength 비-음수정수 아님 →
//     TypeError(원소 index·label·받은 값 박제).
//   - batch.rangeCount !== batch.ranges.length(계약 위반) → RangeError(불일치 박제).
//   - batch.allIntact 와 수치의 모순(true 인데 rangeCount !== 0; false 인데 rangeCount === 0) →
//     RangeError(모순 박제).
//   - 원소의 byteLength !== lastBytePos - firstBytePos + 1(범위 계약 위반) → RangeError(원소 index·기대·
//     실제값 박제).
//   - ranges 의 byteLength 합 !== batch.refetchBytes(coalescing 계약 위반) → RangeError(위반·기대·실제값
//     박제).
//   - ranges 가 firstBytePos 오름차순 아님 또는 인접 범위가 겹치거나 연속(ranges[i].lastBytePos >=
//     ranges[i+1].firstBytePos - 1 — 연속이면 병합됐어야 함) → RangeError(원소 index·위반 박제).
export function summariseExportChunkRefetchGaps(
  batch: ExportChunkRefetchBatch,
): ExportChunkRefetchGaps {
  // top-level batch 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(batch)) {
    throw new TypeError(
      `summariseExportChunkRefetchGaps: batch 은 plain object 여야 합니다 (받음: ${describeNonObject(
        batch,
      )})`,
    );
  }

  const allIntact = (batch as { allIntact: unknown }).allIntact;
  if (typeof allIntact !== "boolean") {
    throw new TypeError(
      `summariseExportChunkRefetchGaps: batch.allIntact 는 boolean 이어야 합니다 (받음: ${String(
        allIntact,
      )})`,
    );
  }

  const failedChunkCount = (batch as { failedChunkCount: unknown })
    .failedChunkCount;
  if (!isValidNonNegativeInteger(failedChunkCount)) {
    throw new TypeError(
      `summariseExportChunkRefetchGaps: batch.failedChunkCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        failedChunkCount,
      )})`,
    );
  }

  const rangeCount = (batch as { rangeCount: unknown }).rangeCount;
  if (!isValidNonNegativeInteger(rangeCount)) {
    throw new TypeError(
      `summariseExportChunkRefetchGaps: batch.rangeCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        rangeCount,
      )})`,
    );
  }

  const refetchBytes = (batch as { refetchBytes: unknown }).refetchBytes;
  if (!isValidNonNegativeInteger(refetchBytes)) {
    throw new TypeError(
      `summariseExportChunkRefetchGaps: batch.refetchBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        refetchBytes,
      )})`,
    );
  }

  const ranges = (batch as { ranges: unknown }).ranges;
  if (!Array.isArray(ranges)) {
    throw new TypeError(
      `summariseExportChunkRefetchGaps: batch.ranges 는 배열이어야 합니다 (받음: ${describeNonObject(
        ranges,
      )})`,
    );
  }

  // 각 ranges 원소가 손상되지 않은 ExportChunkRefetchRange 인지 검증(firstBytePos/lastBytePos/byteLength
  // 비-음수정수) + 원소 byte 계약(byteLength === lastBytePos - firstBytePos + 1) 검증.
  for (let i = 0; i < ranges.length; i += 1) {
    assertValidRange(ranges[i], i);
    const range = ranges[i] as ExportChunkRefetchRange;
    const expectedByteLength = range.lastBytePos - range.firstBytePos + 1;
    if (range.byteLength !== expectedByteLength) {
      throw new RangeError(
        `summariseExportChunkRefetchGaps: batch.ranges[${i}].byteLength(${range.byteLength})가 lastBytePos - firstBytePos + 1(${expectedByteLength})와 일치하지 않습니다 — 손상된 범위`,
      );
    }
  }

  const typedRanges = ranges as ExportChunkRefetchRange[];

  // rangeCount 와 실제 ranges.length 의 계약 일치 검증 — 손상된 batch 거부.
  if (rangeCount !== typedRanges.length) {
    throw new RangeError(
      `summariseExportChunkRefetchGaps: batch.rangeCount(${rangeCount})가 batch.ranges.length(${typedRanges.length})와 일치하지 않습니다 — 손상된 batch`,
    );
  }

  // allIntact 와 수치의 모순 검증 — 무결/손상 정의 위반 거부.
  if (allIntact === true && rangeCount !== 0) {
    throw new RangeError(
      `summariseExportChunkRefetchGaps: batch.allIntact 가 true 인데 batch.rangeCount(${rangeCount})가 0 이 아닙니다 — 모순된 batch`,
    );
  }
  if (allIntact === false && rangeCount === 0) {
    throw new RangeError(
      `summariseExportChunkRefetchGaps: batch.allIntact 가 false 인데 batch.rangeCount 가 0 입니다 — 모순된 batch`,
    );
  }

  // ranges 를 1 회 순회 — byteLength 합 누적 + 인접 쌍 gap 누적·최대화 + 오름차순·미겹침·미연속 검증.
  let byteLengthSum = 0;
  let gapBytes = 0;
  let largestGapBytes = 0;
  for (let i = 0; i < typedRanges.length; i += 1) {
    const range = typedRanges[i];
    byteLengthSum += range.byteLength;
    if (i > 0) {
      const prev = typedRanges[i - 1];
      // 인접 범위는 오름차순이며 사이에 최소 1 byte gap 이 있어야 한다(연속/겹침이면 병합됐을 것).
      // gap = range.firstBytePos - prev.lastBytePos - 1; gap < 1 이면 겹침(<0)·연속(=0) — 미병합 거부.
      const gap = range.firstBytePos - prev.lastBytePos - 1;
      if (gap < 1) {
        throw new RangeError(
          `summariseExportChunkRefetchGaps: batch.ranges[${i}].firstBytePos(${range.firstBytePos})가 직전 범위 lastBytePos(${prev.lastBytePos})와 겹치거나 연속입니다 (gap=${gap}) — 오름차순·미병합 계약 위반`,
        );
      }
      gapBytes += gap;
      if (gap > largestGapBytes) {
        largestGapBytes = gap;
      }
    }
  }

  // ranges 의 byteLength 합이 batch.refetchBytes 와 일치해야 한다(coalescing 계약 — byte 총량 보존).
  if (byteLengthSum !== refetchBytes) {
    throw new RangeError(
      `summariseExportChunkRefetchGaps: batch.ranges 의 byteLength 합(${byteLengthSum})이 batch.refetchBytes(${refetchBytes})와 일치하지 않습니다 — 손상된 batch`,
    );
  }

  const outerSpanFirstBytePos =
    rangeCount === 0 ? 0 : typedRanges[0].firstBytePos;
  const outerSpanLastBytePos =
    rangeCount === 0 ? 0 : typedRanges[rangeCount - 1].lastBytePos;
  const spannedBytes =
    rangeCount === 0 ? 0 : outerSpanLastBytePos - outerSpanFirstBytePos + 1;
  const gapCount = rangeCount > 1 ? rangeCount - 1 : 0;
  const averageGapBytes = gapCount === 0 ? 0 : gapBytes / gapCount;
  const gapRatio = spannedBytes === 0 ? 0 : gapBytes / spannedBytes;
  const contiguous = gapCount === 0;

  const headline = allIntact
    ? `chunked streaming 재요청 gap: 재요청 범위 없음(무결)`
    : contiguous
      ? `chunked streaming 재요청 gap: 재요청 ${rangeCount}개 범위, outer span ${spannedBytes} bytes, 사이 무결 0 bytes(gap 0개)`
      : `chunked streaming 재요청 gap: 재요청 ${rangeCount}개 범위, outer span ${spannedBytes} bytes, 사이 무결 ${gapBytes} bytes(gap ${gapCount}개)`;

  return {
    allIntact,
    rangeCount,
    refetchBytes,
    outerSpanFirstBytePos,
    outerSpanLastBytePos,
    spannedBytes,
    gapCount,
    gapBytes,
    largestGapBytes,
    averageGapBytes,
    gapRatio,
    contiguous,
    headline,
  };
}
