// export-chunk-refetch-coalesce — UC-07 §8 NFR chunked streaming 의 재요청 지시에서 *인접
// (연속 index)한 실패 chunk 들을 하나의 연속 byte 범위로 병합*해 재요청 HTTP Range 요청 수를
// 최소화하는 순수 helper (T-0473, P7 R-57 / REQ-030 / REQ-032 / REQ-045). 직전
// reconcileExportChunkIntegrity(T-0472)는 수신측 per-chunk 무결성 검사 결과로부터 실패 chunk 를
// 골라 *각 실패 chunk 마다 content-range 를 1:1 로* 나열한 재요청 지시(refetchRanges)를 산정하지만,
// 실패 chunk 가 연속으로 발생한 경우(예: chunk 1·2·3 손상) 이를 chunk 1 개당 HTTP Range 요청
// 하나씩 — 즉 분리된 N 개 재요청으로 보내는 것은 비효율이며 UC-07 §8 NFR 의 효율적 전송에 반한다.
// 인접한 실패 chunk 들을 *하나의 연속 byte 범위*(bytes=offset(1)-end(3))로 병합해 *재요청 HTTP
// Range 요청 수를 최소화*하는 합성(coalescing)은 36 helper 중 0 회 cover 된 gap 이다(git grep
// coalesce|mergeRange|RefetchBatch|contiguous|coalesceRefetch|RangeBatch|batchRefetch src/export
// → 0 매칭).
//
// reconcileExportChunkIntegrity 가 실패 chunk 를 *식별·열거*(per-chunk 1:1 범위)한다면, 본 helper
// 는 그와 직교(orthogonal) — 이미 산출된 무결성 reconcile 결과의 failedChunks(index 오름차순 보장)를
// 받아 *연속 index 의 실패 chunk 들을 하나의 byte 범위로 병합*한 재요청 batch plan 을 순수 산술로
// derive 한다(실 재전송·byte slice·HTTP Range·헤더 직렬화 0). 비연속 실패(예: chunk 1·4)는 분리된
// 2 개 범위로, 연속 실패(예: chunk 1·2·3)는 하나의 병합 범위로 derive 한다. UC-07 §5 step 13(Export
// 다운로드) + §8 chunked streaming 의 효율적 부분 손상 복구(재요청 요청 수 최소화)를 채운다.
//
// 실 digest / checksum 계산 / chunk 무결성 검증 재실행 / 실 재전송 / byte slice 추출 / HTTP Range
// 요청·206 Partial Content / Content-Range·Range 헤더 직렬화 / multipart / 재시도 정책·backoff·상태
// 머신 0 — 입력으로 받은 ExportChunkIntegrityReconcile(T-0472)의 failedChunks 만으로 연속 byte
// 범위를 순수 산술로 병합한다. reconcileExportChunkIntegrity / buildExportChunkResumePlan /
// describeExportChunkStreamProgress / buildExportChunkPlan 을 재호출하지 않고 입력 reconcile 의
// failedChunks 를 그대로 사용한다(DRY — 무결성 검증 재실행 금지). 새 도메인 타입은
// ExportChunkRefetchRange / ExportChunkRefetchBatch 만 신설하며 ExportChunkIntegrityReconcile /
// ExportChunk 는 재사용(import — 중복 정의 금지). 새 외부 dependency 0. 코드 골격은
// export-chunk-integrity-reconcile.ts(T-0472)의 isPlainObject / describeNonObject /
// isValidNonNegativeInteger 입력 방어 + 한국어 message convention 을 mirror 한다.
import { ExportChunkIntegrityReconcile } from "./export-chunk-integrity-reconcile";
import { ExportChunk } from "./export-chunk-plan";

// 병합된 연속 byte 범위 descriptor — plain object. firstBytePos 는 병합 범위 시작 byte(= 그룹 첫
// 실패 chunk 의 offsetBytes), lastBytePos 는 병합 범위 끝 byte inclusive(= 그룹 마지막 실패 chunk 의
// offsetBytes + sizeBytes - 1), byteLength 는 범위 byte 수(= lastBytePos - firstBytePos + 1 = 그룹
// chunk sizeBytes 합), firstChunkIndex 는 그룹 첫 chunk index, lastChunkIndex 는 그룹 마지막 chunk
// index, chunkCount 는 그룹에 포함된 연속 chunk 개수이다. content-range inclusive 경계는
// export-chunk-stream-progress 와 동일 규칙(단 단일 chunkIndex 대신 병합된 첫·끝 index 를 별도 노출).
// 후속 streaming controller 가 이 수치를 "Range: bytes={firstBytePos}-{lastBytePos}" 헤더로
// 직렬화한다(헤더 문자열 생성은 본 helper 밖 — repository 게이트).
export interface ExportChunkRefetchRange {
  firstBytePos: number;
  lastBytePos: number;
  byteLength: number;
  firstChunkIndex: number;
  lastChunkIndex: number;
  chunkCount: number;
}

// chunked streaming 재요청 batch plan 모델 — plain object. allIntact 는 병합할 실패 chunk 가 0 개인가
// (= reconcile.allIntact), failedChunkCount 는 병합 전 실패 chunk 총 개수(= reconcile.failedChunkCount),
// rangeCount 는 병합 후 연속 범위 개수(= ranges.length), ranges 는 병합된 연속 byte 범위 배열
// (firstBytePos 오름차순; 모두 무결하면 빈 배열), refetchBytes 는 병합 범위 byteLength 합(=
// reconcile.refetchBytes 와 동일 — 병합은 byte 총량을 보존), headline 은 한국어 한 줄 병합 결과 요약이다.
// 불변: ranges 의 chunkCount 합 === failedChunkCount, refetchBytes === reconcile.refetchBytes,
// rangeCount <= failedChunkCount(병합으로 같거나 줄어듦), allIntact ⟺ (ranges.length === 0) ⟺
// (failedChunkCount === 0) ⟺ (refetchBytes === 0), 각 range 의 byteLength === lastBytePos -
// firstBytePos + 1, ranges 는 firstBytePos 오름차순(인접 range 끼리 byte gap 존재 — 연속이면 병합됐을
// 것). 후속 streaming controller / WebUI 재요청 안내가 이 모델을 그대로 사용한다.
export interface ExportChunkRefetchBatch {
  allIntact: boolean;
  failedChunkCount: number;
  rangeCount: number;
  ranges: ExportChunkRefetchRange[];
  refetchBytes: number;
  headline: string;
}

// plain object(null/배열/비-object 아님) 판정 — reconcile / chunk 입력 방어에 쓴다
// (export-chunk-integrity-reconcile.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (export-chunk-integrity-reconcile.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// 값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부
// (export-chunk-integrity-reconcile.isValidNonNegativeInteger 동형). index/offsetBytes 검증에 쓴다.
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// 값이 유효한 양의 정수(0 불허)인지 판정 — sizeBytes 는 chunk 가 빈 byte 일 수 없으므로 > 0.
function isValidPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// failedChunks 항목이 손상되지 않은 ExportChunk 인지 검증 — plain object 이고 index/offsetBytes 가
// 비-음수정수, sizeBytes 가 양의 정수여야 한다. 위반 시 부적합 index·받은 값을 박제한 TypeError.
function assertValidFailedChunk(chunk: unknown, position: number): void {
  if (!isPlainObject(chunk)) {
    throw new TypeError(
      `coalesceExportChunkRefetch: reconcile.failedChunks[${position}] 는 plain object 여야 합니다 (받음: ${describeNonObject(
        chunk,
      )})`,
    );
  }
  const index = (chunk as { index: unknown }).index;
  if (!isValidNonNegativeInteger(index)) {
    throw new TypeError(
      `coalesceExportChunkRefetch: reconcile.failedChunks[${position}].index 는 0 이상의 정수여야 합니다 (받음: ${String(
        index,
      )})`,
    );
  }
  const offsetBytes = (chunk as { offsetBytes: unknown }).offsetBytes;
  if (!isValidNonNegativeInteger(offsetBytes)) {
    throw new TypeError(
      `coalesceExportChunkRefetch: reconcile.failedChunks[${position}].offsetBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        offsetBytes,
      )})`,
    );
  }
  const sizeBytes = (chunk as { sizeBytes: unknown }).sizeBytes;
  if (!isValidPositiveInteger(sizeBytes)) {
    throw new TypeError(
      `coalesceExportChunkRefetch: reconcile.failedChunks[${position}].sizeBytes 는 양의 정수여야 합니다 (받음: ${String(
        sizeBytes,
      )})`,
    );
  }
}

// 하나의 연속 그룹(인접 index 의 실패 chunk 들)을 하나의 ExportChunkRefetchRange 로 병합한다.
// firstBytePos = 그룹 첫 chunk.offsetBytes, lastBytePos = 그룹 마지막 chunk.offsetBytes +
// 마지막 chunk.sizeBytes - 1(inclusive), byteLength = lastBytePos - firstBytePos + 1.
function mergeGroup(group: ExportChunk[]): ExportChunkRefetchRange {
  const first = group[0];
  const last = group[group.length - 1];
  const firstBytePos = first.offsetBytes;
  const lastBytePos = last.offsetBytes + last.sizeBytes - 1;
  return {
    firstBytePos,
    lastBytePos,
    byteLength: lastBytePos - firstBytePos + 1,
    firstChunkIndex: first.index,
    lastChunkIndex: last.index,
    chunkCount: group.length,
  };
}

// coalesceExportChunkRefetch — 이미 산출된 ExportChunkIntegrityReconcile(T-0472)의 failedChunks
// (index 오름차순)를 index 가 연속(인접)한 그룹으로 분할해 각 그룹을 하나의 ExportChunkRefetchRange
// 로 병합한다(UC-07 §8 NFR + §5 step 13 정합). 그룹화 규칙: failedChunks 를 순회하며 직전 chunk 의
// index + 1 === 현재 chunk.index 이면 같은 그룹, 아니면 새 그룹 시작(연속 index 만 병합 — chunk
// index 인접성 기준; ExportChunkPlan 의 chunk 는 gap/overlap 0 이므로 index 연속 ⟺ byte 연속).
//
// 산정:
//   - ranges = 연속 그룹마다 mergeGroup(그룹). firstBytePos 오름차순(failedChunks 가 오름차순이므로).
//   - allIntact = reconcile.allIntact, failedChunkCount = reconcile.failedChunkCount.
//   - rangeCount = ranges.length, refetchBytes = ranges 의 byteLength 합(= reconcile.refetchBytes).
//
// 경계: allIntact(failedChunks []) → ranges [], rangeCount 0, refetchBytes 0. 단일 실패 → rangeCount
// 1, chunkCount 1, firstChunkIndex === lastChunkIndex. 전부 연속 실패 → rangeCount 1(전체 병합).
// 전부 비연속 → rangeCount === failedChunkCount(각 chunkCount 1). 혼합 → 부분 병합.
//
// 입력 reconcile / reconcile.failedChunks 를 변형하지 않으며(non-mutating — freeze 된 입력 통과),
// 반환 객체·ranges 항목은 항상 새 것. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - reconcile 이 plain object 아님(null/배열/원시값) → TypeError(label "reconcile").
//   - reconcile.failedChunks 가 배열 아님 → TypeError(label "reconcile.failedChunks", 받은 값 박제).
//   - reconcile.failedChunks 항목이 plain object 아님 / index·offsetBytes 비-음수정수 아님 /
//     sizeBytes 비-양정수 → TypeError(부적합 index·받은 값 박제 — 손상된 reconcile 거부).
//   - reconcile.failedChunks 가 index 오름차순 아님(직전 index >= 현재 index — 정렬 위반·중복) →
//     RangeError(위반 위치 index 박제 — 입력 계약 위반).
//   - reconcile.allIntact 와 failedChunks 의 모순(allIntact=true 인데 failedChunks 비어있지 않음) →
//     RangeError(모순 박제 — 손상된 reconcile).
//   - reconcile.failedChunkCount !== failedChunks.length → RangeError(불일치 박제 — 손상된 reconcile).
export function coalesceExportChunkRefetch(
  reconcile: ExportChunkIntegrityReconcile,
): ExportChunkRefetchBatch {
  // top-level reconcile 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(reconcile)) {
    throw new TypeError(
      `coalesceExportChunkRefetch: reconcile 은 plain object 여야 합니다 (받음: ${describeNonObject(
        reconcile,
      )})`,
    );
  }

  const failedChunks = (reconcile as { failedChunks: unknown }).failedChunks;
  if (!Array.isArray(failedChunks)) {
    throw new TypeError(
      `coalesceExportChunkRefetch: reconcile.failedChunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        failedChunks,
      )})`,
    );
  }

  // 각 failedChunks 항목이 손상되지 않은 ExportChunk 인지 검증 + index 오름차순(엄격 증가) 검증.
  // ExportChunkPlan 의 chunk 는 중복 index 가 없으므로 직전 index >= 현재 index 는 정렬 위반·중복.
  let prevIndex = -1;
  for (let i = 0; i < failedChunks.length; i += 1) {
    const chunk = failedChunks[i];
    assertValidFailedChunk(chunk, i);
    const index = (chunk as ExportChunk).index;
    if (index <= prevIndex) {
      throw new RangeError(
        `coalesceExportChunkRefetch: reconcile.failedChunks 는 index 오름차순이어야 합니다 — failedChunks[${i}].index(${index})가 직전 index(${prevIndex}) 이하입니다 (정렬 위반·중복)`,
      );
    }
    prevIndex = index;
  }

  const typedChunks = failedChunks as ExportChunk[];

  // allIntact / failedChunkCount 와 실제 failedChunks 의 모순 검증 — 손상된 reconcile 거부.
  const allIntact = (reconcile as { allIntact: unknown }).allIntact;
  if (allIntact === true && typedChunks.length !== 0) {
    throw new RangeError(
      `coalesceExportChunkRefetch: reconcile.allIntact 가 true 인데 reconcile.failedChunks 가 비어있지 않습니다 (failedChunks.length=${typedChunks.length}) — 손상된 reconcile`,
    );
  }
  if (allIntact === false && typedChunks.length === 0) {
    throw new RangeError(
      `coalesceExportChunkRefetch: reconcile.allIntact 가 false 인데 reconcile.failedChunks 가 비어있습니다 — 손상된 reconcile`,
    );
  }

  const failedChunkCount = (reconcile as { failedChunkCount: unknown })
    .failedChunkCount;
  if (failedChunkCount !== typedChunks.length) {
    throw new RangeError(
      `coalesceExportChunkRefetch: reconcile.failedChunkCount(${String(
        failedChunkCount,
      )})가 reconcile.failedChunks.length(${typedChunks.length})와 일치하지 않습니다 — 손상된 reconcile`,
    );
  }

  // 연속 index 그룹으로 분할 — 직전 chunk.index + 1 === 현재 chunk.index 이면 같은 그룹, 아니면
  // 새 그룹. 입력 chunk 객체는 복사하지 않고 읽기만 한다(non-mutating; 반환 range 는 새 객체).
  const groups: ExportChunk[][] = [];
  for (let i = 0; i < typedChunks.length; i += 1) {
    const chunk = typedChunks[i];
    if (i > 0 && typedChunks[i - 1].index + 1 === chunk.index) {
      groups[groups.length - 1].push(chunk);
    } else {
      groups.push([chunk]);
    }
  }

  // 각 그룹을 하나의 연속 byte 범위로 병합 — firstBytePos 오름차순(failedChunks 오름차순이므로).
  const ranges: ExportChunkRefetchRange[] = groups.map(mergeGroup);
  const rangeCount = ranges.length;
  const refetchBytes = ranges.reduce((sum, range) => sum + range.byteLength, 0);
  const resolvedAllIntact = failedChunkCount === 0;

  const headline = resolvedAllIntact
    ? `chunked streaming 재요청 병합: 실패 chunk 가 없습니다 — 재요청 불요`
    : `chunked streaming 재요청 병합: 실패 ${failedChunkCount} 개 chunk 를 연속 byte 범위 ${rangeCount} 개로 병합 — 재요청 ${rangeCount} 회 (${refetchBytes} B)`;

  return {
    allIntact: resolvedAllIntact,
    failedChunkCount,
    rangeCount,
    ranges,
    refetchBytes,
    headline,
  };
}
