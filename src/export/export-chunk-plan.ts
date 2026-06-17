// export-chunk-plan — UC-07 §8 NFR chunked streaming 의 실제 chunk 경계(전체 chunk 개수·각 chunk
// 의 byte offset·각 chunk 의 byte size·마지막 chunk 의 잔여 byte)를 산정하는 순수 helper
// (T-0469, P7 R-57 / REQ-030 / REQ-032 / REQ-045). 직전 buildExportJobPlan(T-0467)은 estimate 로
// 부터 chunked: boolean(estimatedBytes > chunkThreshold) 권고 플래그까지만 산출하고,
// describeExportJobStatus(T-0468)는 단일 status enum 을 진행 view 로 렌더할 뿐 — chunked streaming
// 을 실제로 수행하려면 필요한 chunk 경계 산정은 32 helper 중 0 회 cover 된 gap 이다(git grep
// buildExportChunkPlan|ExportChunkPlan|ExportChunk|computeChunk|chunkOffsets src/ → 0 매칭).
//
// T-0467 이 "chunked 가 필요한가" 를 boolean 으로 판정한다면, 본 helper 는 그 estimate 의
// estimatedBytes 와 chunk 크기(chunkSizeBytes)를 입력으로 받아 "그럼 chunk 를 어떻게 자를
// 것인가(몇 개로·각각 몇 byte·어디서부터)" 의 분할 plan 을 순수 산술로 박제한다. UC-07 §5 step
// 13(Export 다운로드) + §8 chunked streaming 이 필요로 하는 chunk descriptor 를 채운다.
//
// 실 chunked streaming / byte slice 추출 / HTTP Range·Content-Range 헤더 직렬화 / SSE·long-poll
// 전송 / job store 0 — 입력으로 받은 estimatedBytes 와 chunkSizeBytes 만으로 경계를 derive 한다.
// chunk threshold(buildExportJobPlan 의 전달 여부 판정)와 chunk size(본 helper 의 분할 단위)를
// 혼동하지 않으며 buildExportJobPlan 의 chunked 플래그를 재호출하지 않는다(DRY — estimatedBytes
// 만 입력). 새 도메인 타입은 ExportChunk / ExportChunkPlan / ExportChunkPlanOptions 만 신설하며
// ExportDumpSizeEstimate 는 재사용(import). 새 외부 dependency 0. 코드 골격은
// export-job-plan.ts(T-0467)의 isPlainObject / describeNonObject / isValidNonNegativeInteger 입력
// 방어 + 한국어 message convention 을 mirror 한다.
import { ExportDumpSizeEstimate } from "./export-dump-size-estimate";

// 단일 chunk 의 경계 descriptor — plain object. index 는 0-base 순번, offsetBytes 는 이 chunk 의
// 시작 byte offset, sizeBytes 는 이 chunk 의 byte 수(마지막 chunk 는 잔여), last 는 마지막 chunk
// 면 true. 후속 chunked streaming(HTTP Range·Content-Range)이 이 경계를 그대로 byte slice 에 쓴다.
export interface ExportChunk {
  index: number;
  offsetBytes: number;
  sizeBytes: number;
  last: boolean;
}

// chunked streaming 분할 plan — plain object. totalBytes 는 입력 estimatedBytes 그대로,
// chunkSizeBytes 는 분할 단위, chunkCount 는 전체 chunk 개수, chunks 는 경계 목록,
// lastChunkSizeBytes 는 마지막 chunk 의 byte(totalBytes 가 chunkSize 의 배수면 chunkSize, 아니면
// 잔여; chunk 0 개면 0), headline 은 한국어 한 줄 요약이다.
// 불변: chunks.length === chunkCount, sum(chunks[*].sizeBytes) === totalBytes, 마지막 외 모든
// chunk sizeBytes === chunkSizeBytes, chunks[i].offsetBytes === chunks[i-1].offsetBytes +
// chunks[i-1].sizeBytes(연속·gap 0·overlap 0), chunkCount > 0 이면 0 < lastChunkSizeBytes <=
// chunkSizeBytes. 후속 streaming controller / WebUI 진행 view 가 이 모델을 그대로 사용한다.
export interface ExportChunkPlan {
  totalBytes: number;
  chunkSizeBytes: number;
  chunkCount: number;
  chunks: ExportChunk[];
  lastChunkSizeBytes: number;
  headline: string;
}

// chunk plan 산정 옵션 — 전부 선택. maxChunks 는 산정된 chunkCount 가 이 값을 초과하면 RangeError
// 로 거부할 상한(미지정 시 cap 없음 — chunkCount 는 totalBytes/chunkSize 로만 결정). cap 적용이
// 아니라 거부 방식을 택한 이유: chunk 크기를 임의로 키워 경계를 왜곡하지 않고 호출측이 더 큰
// chunkSizeBytes 를 명시하도록 강제하기 위함이다(정책 source 0 — 인자로 받은 값만 사용).
export interface ExportChunkPlanOptions {
  maxChunks?: number;
}

// plain object(null/배열/비-object 아님) 판정 — estimate + options 입력 방어에 쓴다
// (export-job-plan.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (export-job-plan.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// 값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부
// (export-job-plan.isValidNonNegativeInteger 동형). estimatedBytes 검증에 쓴다.
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// 값이 유효한 양의 정수(0 금지)인지 판정 — 0 나누기 방지를 위해 chunkSizeBytes 와 maxChunks 검증에
// 쓴다. NaN/Infinity/소수/0/음수/비-number 거부.
function isValidPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// buildExportChunkPlan — estimateExportDumpSize(T-0466)가 산출한 ExportDumpSizeEstimate 의
// estimatedBytes(= totalBytes)와 chunkSizeBytes 로부터 chunked streaming 의 chunk 경계를 순수
// 산술로 산정한다(UC-07 §8 NFR 정합):
//   - chunkCount = totalBytes === 0 ? 0 : Math.ceil(totalBytes / chunkSizeBytes).
//   - 각 chunk i(0-base): offsetBytes = i * chunkSizeBytes, 마지막 chunk(i === chunkCount - 1) 외
//     에는 sizeBytes = chunkSizeBytes, 마지막 chunk 는 sizeBytes = totalBytes - offsetBytes(잔여,
//     배수면 chunkSize), last = (i === chunkCount - 1).
//   - lastChunkSizeBytes = chunkCount === 0 ? 0 : chunks[chunkCount-1].sizeBytes.
//   - totalBytes === 0 → chunkCount 0 + chunks [] + lastChunkSizeBytes 0. totalBytes <= chunkSize
//     (0 초과) → 단일 chunk(chunkCount 1, sizeBytes === totalBytes, last true). 배수 → 마지막
//     chunk sizeBytes === chunkSize(빈 추가 chunk 금지).
//
// 입력 estimate / options 를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체·배열은
// 항상 새 것. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - estimate 가 plain object 아님(null/배열/원시값) → TypeError(label "estimate").
//   - estimate.estimatedBytes 가 비-정수·음수·NaN·Infinity·비-number → TypeError(받은 값 박제).
//   - chunkSizeBytes 가 양의 정수(0 금지 — 0 나누기 방지) 아님(0·음수·소수·NaN·Infinity·비-number)
//     → RangeError(받은 값 박제).
//   - options 가 비-object(배열/null — undefined 는 정상) → TypeError.
//   - maxChunks(주어졌으면) 가 양의 정수 아님 → RangeError. 산정된 chunkCount > maxChunks → RangeError.
export function buildExportChunkPlan(
  estimate: ExportDumpSizeEstimate,
  chunkSizeBytes: number,
  options?: ExportChunkPlanOptions,
): ExportChunkPlan {
  // top-level estimate 가 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(estimate)) {
    throw new TypeError(
      `buildExportChunkPlan: estimate 는 plain object 여야 합니다 (받음: ${describeNonObject(
        estimate,
      )})`,
    );
  }

  const totalBytes = (estimate as { estimatedBytes: unknown }).estimatedBytes;
  if (!isValidNonNegativeInteger(totalBytes)) {
    throw new TypeError(
      `buildExportChunkPlan: estimate.estimatedBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        totalBytes,
      )})`,
    );
  }

  // chunkSizeBytes 는 양의 정수여야 한다 — 0 은 0 나누기를 유발하므로 RangeError 로 거부.
  if (!isValidPositiveInteger(chunkSizeBytes)) {
    throw new RangeError(
      `buildExportChunkPlan: chunkSizeBytes 는 1 이상의 정수여야 합니다 (받음: ${String(
        chunkSizeBytes,
      )})`,
    );
  }

  // options 가 주어졌으면 비-object 거부(undefined 는 정상 — 전체 default 적용).
  if (options !== undefined && !isPlainObject(options)) {
    throw new TypeError(
      `buildExportChunkPlan: options 는 plain object 여야 합니다 (받음: ${describeNonObject(
        options,
      )})`,
    );
  }

  const opts = (options ?? {}) as ExportChunkPlanOptions;

  // maxChunks — 주어졌을 때만 검증(양의 정수, 0 금지). 부재 시 cap 없음.
  if (opts.maxChunks !== undefined && !isValidPositiveInteger(opts.maxChunks)) {
    throw new RangeError(
      `buildExportChunkPlan: options.maxChunks 는 1 이상의 정수여야 합니다 (받음: ${String(
        opts.maxChunks,
      )})`,
    );
  }

  // chunk 개수 산정 — 0 byte 면 chunk 없음, 그 외 ceil 로 마지막 잔여 chunk 까지 포함.
  const chunkCount =
    totalBytes === 0 ? 0 : Math.ceil(totalBytes / chunkSizeBytes);

  // maxChunks 상한 초과 시 거부(chunk 크기를 키우는 대신 RangeError — 호출측이 더 큰
  // chunkSizeBytes 를 명시하도록 강제).
  if (opts.maxChunks !== undefined && chunkCount > opts.maxChunks) {
    throw new RangeError(
      `buildExportChunkPlan: 산정된 chunk 개수(${chunkCount})가 maxChunks(${opts.maxChunks})를 초과합니다 — 더 큰 chunkSizeBytes 를 지정하세요`,
    );
  }

  // 각 chunk 경계 산정 — 마지막 chunk 만 잔여(배수면 chunkSize), 나머지는 full chunkSize.
  const chunks: ExportChunk[] = [];
  for (let i = 0; i < chunkCount; i += 1) {
    const offsetBytes = i * chunkSizeBytes;
    const last = i === chunkCount - 1;
    // 마지막 chunk 는 totalBytes - offsetBytes(잔여, 배수면 chunkSize), 그 외는 full chunkSize.
    const sizeBytes = last ? totalBytes - offsetBytes : chunkSizeBytes;
    chunks.push({ index: i, offsetBytes, sizeBytes, last });
  }

  // 마지막 chunk byte — chunk 0 개면 0, 그 외 마지막 chunk 의 sizeBytes.
  const lastChunkSizeBytes =
    chunkCount === 0 ? 0 : chunks[chunkCount - 1].sizeBytes;

  const headline =
    chunkCount === 0
      ? `chunked streaming plan: 전송할 byte 가 없습니다 (0 B)`
      : `chunked streaming plan: 총 ${totalBytes} B 를 ${chunkSizeBytes} B 단위 ${chunkCount} 개 chunk 로 분할 (마지막 ${lastChunkSizeBytes} B)`;

  return {
    totalBytes,
    chunkSizeBytes,
    chunkCount,
    chunks,
    lastChunkSizeBytes,
    headline,
  };
}
