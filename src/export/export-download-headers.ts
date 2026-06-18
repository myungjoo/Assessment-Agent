// export-download-headers — UC-07 Export 다운로드 응답의 HTTP 헤더 문자열 직렬화 순수 helper
// (T-0510, P7 R-57 / REQ-030 / REQ-032). 머지된 ADR-0046 (b718bb8) Decision §1 은 두 헤더 직렬화
// 책임을 박제했다: (1) 다운로드 응답 헤더(Content-Type / Content-Disposition / Content-Length)는
// buildExportArtifactDescriptor(T-0457) 산출물(contentType / contentDisposition / byteSizeHint)을
// **그대로** 직렬화한다 — descriptor 가 곧 materialization 의 메타 source. (2) describeExportChunk
// StreamProgress 의 currentRange(content-range 수치)를 `Content-Range: bytes {first}-{last}/{total}`
// 헤더로 직렬화한다(**helper 가 수치를, materialization 이 헤더 문자열 생성을** — RFC 7233). 그리고
// §Decision 3 invariant 는 "descriptor single-source — controller 가 헤더값을 새로 계산하지 않는다
// (drift 0)" 를 강제한다.
//
// 직전 chain step 들(materializeExportDump T-0506 / sliceMaterializedDumpByChunkPlan T-0507 /
// createChunkedExportDumpReadable T-0509)은 byte body 측만 닫았다. 본 helper 는 그 stream body 와
// 함께 응답에 실릴 **헤더 문자열 map** 을 descriptor·content-range 수치로부터 직렬화하는 layer 를
// 닫는다 — 순수 함수 1 개. 실 res.setHeader / @Header() decorator / StreamableFile 배선은 후속
// controller task(ADR-0046 §Out of scope) — 본 helper 는 헤더 key→value 문자열 map 만 반환한다.
//
// 코드 골격은 export-dump-materialize.ts(T-0506) / export-artifact-descriptor.ts(T-0457)의 순수-helper
// 패턴(non-mutating · isPlainObject 입력 방어 · 한국어 TypeError/RangeError · Object.freeze 호출
// 통과 · 결정성)을 mirror 한다. 새 도메인 타입 신설 0(ExportArtifactDescriptor / ExportChunkContentRange
// 재사용 import), 새 외부 dependency 0(순수 문자열 조립만).
import { ExportArtifactDescriptor } from "./export-artifact-descriptor";
import { ExportChunkContentRange } from "./export-chunk-stream-progress";

// plain object(null / 배열 / 비-object 아님) 판정 — descriptor / contentRange 입력 방어에 쓴다.
// export-dump-materialize.ts 의 isPlainObject 와 동형 convention.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 비-plain-object 값의 표시명 — 메시지에 어떤 잘못된 입력이 왔는지 담는다
// (export-dump-materialize.ts.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === undefined
    ? "undefined"
    : value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;
}

// 값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN / Infinity / 소수 / 음수 / 비-number 거부
// (export-chunk-stream-progress.ts.isValidNonNegativeInteger 동형). byteSizeHint / content-range
// 수치 검증에 쓴다.
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// serializeExportDownloadHeaders — ExportArtifactDescriptor(필수)와 ExportChunkContentRange(선택,
// partial/chunk 전송 시)를 받아 HTTP 응답 헤더 key→value 문자열 map(Record<string, string>)을
// 직렬화한다. ADR-0046 §Decision 1·3 정합:
//   - Content-Type      = descriptor.contentType 그대로(재계산 0 — descriptor single-source).
//   - Content-Disposition = descriptor.contentDisposition 그대로(이미 `attachment; filename="..."`
//     형태로 조립돼 있어 재조립 0).
//   - Content-Length    = String(descriptor.byteSizeHint)(number → 문자열).
//   - Content-Range     = contentRange 가 제공되면(non-null) `bytes {first}-{last}/{total}`(RFC 7233)
//     추가, 생략/null(full 다운로드)이면 키 부재.
//
// 입력 descriptor / contentRange 객체를 변형하지 않고(non-mutating — Object.freeze 호출 통과) 항상
// 새 plain object 를 반환한다. 동일 입력 2 회 호출은 동등 결과(결정성), 반환 map 은 입력 객체 alias 0.
//
// 입력 방어(분기 분리 — branch coverage):
//   - descriptor 가 plain object 아님(null / 배열 / 원시값) → TypeError(받은 type label 박제).
//   - descriptor.contentType / descriptor.contentDisposition 가 문자열 아님 → TypeError.
//   - descriptor.byteSizeHint 가 비-음수 정수 아님(음수 / 소수 / NaN / Infinity / 비-number)
//     → RangeError(받은 값 박제).
//   - contentRange 가 제공됐으나 plain object 아님 → TypeError.
//   - contentRange.firstBytePos / lastBytePos / totalBytes 가 비-음수 정수 아님 → RangeError.
//   - firstBytePos > lastBytePos, 또는 lastBytePos >= totalBytes → RangeError
//     (RFC 7233 유효 range invariant — first ≤ last < total).
export function serializeExportDownloadHeaders(
  descriptor: ExportArtifactDescriptor,
  contentRange?: ExportChunkContentRange | null,
): Record<string, string> {
  // top-level descriptor 가 plain object 가 아니면 헤더 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(descriptor)) {
    throw new TypeError(
      `serializeExportDownloadHeaders: descriptor 는 plain object 여야 합니다 (받음: ${describeNonObject(
        descriptor,
      )})`,
    );
  }

  const contentType = (descriptor as { contentType: unknown }).contentType;
  if (typeof contentType !== "string") {
    throw new TypeError(
      `serializeExportDownloadHeaders: descriptor.contentType 은(는) 문자열이어야 합니다 (받음: ${describeNonObject(
        contentType,
      )})`,
    );
  }

  const contentDisposition = (descriptor as { contentDisposition: unknown })
    .contentDisposition;
  if (typeof contentDisposition !== "string") {
    throw new TypeError(
      `serializeExportDownloadHeaders: descriptor.contentDisposition 은(는) 문자열이어야 합니다 (받음: ${describeNonObject(
        contentDisposition,
      )})`,
    );
  }

  const byteSizeHint = (descriptor as { byteSizeHint: unknown }).byteSizeHint;
  if (!isValidNonNegativeInteger(byteSizeHint)) {
    throw new RangeError(
      `serializeExportDownloadHeaders: descriptor.byteSizeHint 은(는) 0 이상의 정수여야 합니다 (받음: ${String(
        byteSizeHint,
      )})`,
    );
  }

  // descriptor single-source — 세 헤더는 descriptor 값을 그대로 직렬화(재계산 0). 항상 새 객체.
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": contentDisposition,
    "Content-Length": String(byteSizeHint),
  };

  // contentRange 생략(undefined) 또는 명시적 null(full 다운로드) → Content-Range 키 부재가 정상.
  if (contentRange === undefined || contentRange === null) {
    return headers;
  }

  // contentRange 가 제공됐다면 plain object 여야 한다 — 비-object(배열 / 원시값) 거부.
  if (!isPlainObject(contentRange)) {
    throw new TypeError(
      `serializeExportDownloadHeaders: contentRange 는 plain object 여야 합니다 (받음: ${describeNonObject(
        contentRange,
      )})`,
    );
  }

  const firstBytePos = (contentRange as { firstBytePos: unknown }).firstBytePos;
  const lastBytePos = (contentRange as { lastBytePos: unknown }).lastBytePos;
  const totalBytes = (contentRange as { totalBytes: unknown }).totalBytes;

  if (!isValidNonNegativeInteger(firstBytePos)) {
    throw new RangeError(
      `serializeExportDownloadHeaders: contentRange.firstBytePos 은(는) 0 이상의 정수여야 합니다 (받음: ${String(
        firstBytePos,
      )})`,
    );
  }
  if (!isValidNonNegativeInteger(lastBytePos)) {
    throw new RangeError(
      `serializeExportDownloadHeaders: contentRange.lastBytePos 은(는) 0 이상의 정수여야 합니다 (받음: ${String(
        lastBytePos,
      )})`,
    );
  }
  if (!isValidNonNegativeInteger(totalBytes)) {
    throw new RangeError(
      `serializeExportDownloadHeaders: contentRange.totalBytes 은(는) 0 이상의 정수여야 합니다 (받음: ${String(
        totalBytes,
      )})`,
    );
  }

  // RFC 7233 유효 range invariant — first ≤ last < total. firstBytePos > lastBytePos 이거나
  // lastBytePos >= totalBytes(끝 byte 가 전체 길이를 넘거나 같음)면 손상된 range — 거부.
  if (firstBytePos > lastBytePos) {
    throw new RangeError(
      `serializeExportDownloadHeaders: contentRange.firstBytePos(${firstBytePos})가 lastBytePos(${lastBytePos})보다 큽니다 — 유효한 byte range 가 아닙니다 (RFC 7233: first ≤ last)`,
    );
  }
  if (lastBytePos >= totalBytes) {
    throw new RangeError(
      `serializeExportDownloadHeaders: contentRange.lastBytePos(${lastBytePos})가 totalBytes(${totalBytes}) 이상입니다 — 끝 byte 는 전체 길이보다 작아야 합니다 (RFC 7233: last < total)`,
    );
  }

  // Content-Range: bytes {first}-{last}/{total} — RFC 7233 byte-range 응답 헤더(예: bytes 0-1023/4096).
  headers["Content-Range"] =
    `bytes ${firstBytePos}-${lastBytePos}/${totalBytes}`;

  return headers;
}
