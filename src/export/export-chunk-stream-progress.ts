// export-chunk-stream-progress — UC-07 §8 NFR chunked streaming 의 전송 *진행 상태*(전달·잔여 chunk·
// 전송 byte·진행률·현재 chunk content-range)를 렌더하는 순수 helper (T-0470, P7 R-57 / REQ-030 /
// REQ-032 / REQ-045). 직전 buildExportChunkPlan(T-0469)은 ExportChunkPlan{chunkCount, chunks[],
// lastChunkSizeBytes, ...} 으로 정적 chunk 경계(몇 개로·각각 몇 byte·어디서부터)까지만 산출하고,
// describeExportJobStatus(T-0468)는 async job *전체* 의 단일 status enum 을 진행 view 로 렌더할
// 뿐 — streaming 도중 "지금 몇 번째 chunk 까지 전달됐고·몇 byte 전송됐고·진행률 몇 %·현재 chunk 의
// Content-Range 수치는 무엇인가" 의 전송 진행 상태(transfer progress) 렌더는 33 helper 중 0 회
// cover 된 gap 이다(git grep describeExportChunk|ExportChunkProgress|ExportChunkStream|
// chunkProgress|contentRange|ExportStreamProgress src/export → 0 매칭).
//
// describeExportJobStatus 가 job-level 진행 view 라면, 본 helper 는 한 단계 안쪽 — chunk-stream
// 단위의 진행률을 렌더한다(job-level 과 chunk-level 의 view 분리). UC-07 §5 step 13(Export
// 다운로드) + §8 chunked streaming 이 필요로 하는 진행 표시(WebUI progress bar / resume offset
// 안내)를 채운다.
//
// 실 chunked streaming / byte slice 추출 / HTTP Range·Content-Range 헤더 직렬화(실 "Content-Range:
// bytes a-b/c" 문자열) / SSE·long-poll 전송 / resumable upload 배선 0 — 입력으로 받은
// ExportChunkPlan 과 deliveredChunks(이미 전달된 chunk 개수)만으로 진행 상태를 순수 산술로 derive
// 한다. buildExportChunkPlan 을 재호출하지 않고 입력 plan 의 chunks 경계를 그대로 사용한다(DRY).
// 새 도메인 타입은 ExportChunkContentRange / ExportChunkStreamProgress 만 신설하며 ExportChunkPlan
// / ExportChunk 는 재사용(import). 새 외부 dependency 0. 코드 골격은 export-chunk-plan.ts(T-0469)의
// isPlainObject / describeNonObject / isValidNonNegativeInteger 입력 방어 + 한국어 message
// convention 을 mirror 한다.
import { ExportChunk, ExportChunkPlan } from "./export-chunk-plan";

// 현재(다음 전달할) chunk 의 content-range 수치 descriptor — plain object. firstBytePos 는 이 chunk
// 의 시작 byte(inclusive), lastBytePos 는 끝 byte(inclusive = offsetBytes + sizeBytes - 1),
// totalBytes 는 전체 byte(content-range 의 instance-length), chunkIndex 는 0-base 현재 chunk 순번이다.
// 후속 streaming controller 가 이 수치를 "Content-Range: bytes {firstBytePos}-{lastBytePos}/
// {totalBytes}" 헤더로 직렬화한다(헤더 문자열 생성은 본 helper 밖 — repository 게이트).
export interface ExportChunkContentRange {
  firstBytePos: number;
  lastBytePos: number;
  totalBytes: number;
  chunkIndex: number;
}

// chunk-stream 전송 진행 상태 모델 — plain object. totalChunks 는 입력 plan.chunkCount 그대로,
// deliveredChunks 는 전달 완료 chunk 개수, remainingChunks 는 잔여(= totalChunks - deliveredChunks),
// transferredBytes 는 전달 완료 chunk 들의 byte 합, totalBytes 는 입력 plan.totalBytes 그대로,
// remainingBytes 는 잔여 byte(= totalBytes - transferredBytes), percentComplete 는 진행률(0~100,
// totalBytes 0 이면 100), complete 는 전부 전달 여부(deliveredChunks === totalChunks), currentChunk
// 는 다음 전달할 chunk(= chunks[deliveredChunks], 전부 전달됐으면 null), currentRange 는 그 chunk 의
// content-range 수치(currentChunk null 이면 null), headline 은 한국어 한 줄 진행 요약이다.
// 불변: transferredBytes + remainingBytes === totalBytes, deliveredChunks + remainingChunks ===
// totalChunks, complete ⟺ (remainingChunks === 0 && remainingBytes === 0), currentChunk === null
// ⟺ complete, complete 일 때 percentComplete === 100. 후속 WebUI 진행 표시(UC-07 §5 step 13)가 이
// 모델을 그대로 렌더한다.
export interface ExportChunkStreamProgress {
  totalChunks: number;
  deliveredChunks: number;
  remainingChunks: number;
  transferredBytes: number;
  totalBytes: number;
  remainingBytes: number;
  percentComplete: number;
  complete: boolean;
  currentChunk: ExportChunk | null;
  currentRange: ExportChunkContentRange | null;
  headline: string;
}

// plain object(null/배열/비-object 아님) 판정 — plan 입력 방어에 쓴다
// (export-chunk-plan.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (export-chunk-plan.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// 값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부
// (export-chunk-plan.isValidNonNegativeInteger 동형). chunkCount/totalBytes/deliveredChunks 검증에 쓴다.
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// describeExportChunkStreamProgress — 이미 산출된 ExportChunkPlan 과 deliveredChunks(전달 완료
// chunk 개수)로부터 chunked streaming 의 전송 진행 상태를 순수 산술로 산정한다(UC-07 §8 NFR +
// §5 step 13 정합):
//   - totalChunks = plan.chunkCount, remainingChunks = totalChunks - deliveredChunks.
//   - transferredBytes = plan.chunks[0..deliveredChunks-1] 의 sizeBytes 합(deliveredChunks=0 이면 0).
//   - totalBytes = plan.totalBytes, remainingBytes = totalBytes - transferredBytes.
//   - complete = (deliveredChunks === totalChunks).
//   - currentChunk = complete ? null : plan.chunks[deliveredChunks].
//   - currentRange = currentChunk ? {firstBytePos: offsetBytes, lastBytePos: offsetBytes +
//     sizeBytes - 1, totalBytes, chunkIndex: index} : null.
//   - percentComplete = totalBytes === 0 ? 100 : Math.round((transferredBytes / totalBytes) * 100).
//
// 경계: chunkCount 0(0 byte plan) → totalChunks 0 · deliveredChunks 0 만 허용 · complete true ·
// currentChunk null · percentComplete 100. deliveredChunks 0(미시작) → transferredBytes 0 ·
// percentComplete 0 · currentChunk chunks[0]. deliveredChunks === totalChunks(완료) → complete true
// · currentChunk null · transferredBytes === totalBytes · percentComplete 100.
//
// 입력 plan / plan.chunks 를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체·중첩
// 객체는 항상 새 것. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - plan 이 plain object 아님(null/배열/원시값) → TypeError(label "plan").
//   - plan.chunkCount 비-음수정수 아님 / plan.totalBytes 비-음수정수 아님 / plan.chunks 배열 아님 /
//     plan.chunks.length !== plan.chunkCount(손상) → TypeError(받은 값·불일치 박제).
//   - deliveredChunks 비-음수정수 아님(음수·소수·NaN·Infinity·비-number) → TypeError(받은 값 박제).
//   - deliveredChunks > plan.chunkCount → RangeError(deliveredChunks·chunkCount 박제 — 전달 chunk 가
//     전체 chunk 를 초과할 수 없음).
export function describeExportChunkStreamProgress(
  plan: ExportChunkPlan,
  deliveredChunks: number,
): ExportChunkStreamProgress {
  // top-level plan 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(plan)) {
    throw new TypeError(
      `describeExportChunkStreamProgress: plan 은 plain object 여야 합니다 (받음: ${describeNonObject(
        plan,
      )})`,
    );
  }

  const totalChunks = (plan as { chunkCount: unknown }).chunkCount;
  if (!isValidNonNegativeInteger(totalChunks)) {
    throw new TypeError(
      `describeExportChunkStreamProgress: plan.chunkCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        totalChunks,
      )})`,
    );
  }

  const totalBytes = (plan as { totalBytes: unknown }).totalBytes;
  if (!isValidNonNegativeInteger(totalBytes)) {
    throw new TypeError(
      `describeExportChunkStreamProgress: plan.totalBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        totalBytes,
      )})`,
    );
  }

  const chunks = (plan as { chunks: unknown }).chunks;
  if (!Array.isArray(chunks)) {
    throw new TypeError(
      `describeExportChunkStreamProgress: plan.chunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        chunks,
      )})`,
    );
  }

  // chunks.length 와 chunkCount 불일치는 손상된 plan — 거부(전달 진행 산정의 전제가 깨짐).
  if (chunks.length !== totalChunks) {
    throw new TypeError(
      `describeExportChunkStreamProgress: plan.chunks.length(${chunks.length})가 plan.chunkCount(${totalChunks})와 일치하지 않습니다 — 손상된 plan`,
    );
  }

  // deliveredChunks 는 비-음수 정수여야 한다 — 음수·소수·NaN·Infinity·비-number 거부.
  if (!isValidNonNegativeInteger(deliveredChunks)) {
    throw new TypeError(
      `describeExportChunkStreamProgress: deliveredChunks 는 0 이상의 정수여야 합니다 (받음: ${String(
        deliveredChunks,
      )})`,
    );
  }

  // 전달 chunk 가 전체 chunk 를 초과할 수 없다 — 범위 위반은 RangeError.
  if (deliveredChunks > totalChunks) {
    throw new RangeError(
      `describeExportChunkStreamProgress: deliveredChunks(${deliveredChunks})가 plan.chunkCount(${totalChunks})를 초과합니다 — 전달된 chunk 가 전체 chunk 를 넘을 수 없습니다`,
    );
  }

  const typedChunks = chunks as ExportChunk[];

  // 전달 완료 chunk 들의 byte 합 — chunks[0..deliveredChunks-1] 의 sizeBytes 누적(deliveredChunks=0 이면 0).
  let transferredBytes = 0;
  for (let i = 0; i < deliveredChunks; i += 1) {
    transferredBytes += typedChunks[i].sizeBytes;
  }

  const remainingChunks = totalChunks - deliveredChunks;
  const remainingBytes = totalBytes - transferredBytes;
  const complete = deliveredChunks === totalChunks;

  // 다음 전달할 chunk — 전부 전달됐으면 없음(null). 그 외 chunks[deliveredChunks].
  const currentChunk: ExportChunk | null = complete
    ? null
    : { ...typedChunks[deliveredChunks] };

  // 현재 chunk 의 content-range 수치 — inclusive 경계(lastBytePos = offset + size - 1).
  const currentRange: ExportChunkContentRange | null = currentChunk
    ? {
        firstBytePos: currentChunk.offsetBytes,
        lastBytePos: currentChunk.offsetBytes + currentChunk.sizeBytes - 1,
        totalBytes,
        chunkIndex: currentChunk.index,
      }
    : null;

  // 진행률 — totalBytes 0(전송할 byte 없음)이면 100, 그 외 byte 비율 반올림(transferredBytes <=
  // totalBytes 불변이라 0~100 clamp 불필요).
  const percentComplete =
    totalBytes === 0 ? 100 : Math.round((transferredBytes / totalBytes) * 100);

  const headline = complete
    ? totalChunks === 0
      ? `chunked streaming 진행: 전송할 chunk 가 없습니다 (0/0 chunk, 100%)`
      : `chunked streaming 진행: 전체 ${totalChunks} 개 chunk(${totalBytes} B) 전송 완료 (100%)`
    : `chunked streaming 진행: ${totalChunks} 개 중 ${deliveredChunks} 개 chunk 전송, ${transferredBytes}/${totalBytes} B (${percentComplete}%), 다음 chunk #${currentChunk?.index}`;

  return {
    totalChunks,
    deliveredChunks,
    remainingChunks,
    transferredBytes,
    totalBytes,
    remainingBytes,
    percentComplete,
    complete,
    currentChunk,
    currentRange,
    headline,
  };
}
