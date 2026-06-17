// export-chunk-resume-plan — UC-07 §8 NFR chunked streaming 의 전송 *재개 지시*(중단 후 어느 byte
// 부터 다시 보낼지·잔여 chunk 목록·재개 시 첫 chunk 의 content-range 수치·애초에 재개가 필요한가)를
// 산정하는 순수 helper (T-0471, P7 R-57 / REQ-030 / REQ-032 / REQ-045). 직전
// describeExportChunkStreamProgress(T-0470)는 ExportChunkStreamProgress{deliveredChunks,
// transferredBytes, percentComplete, currentChunk, currentRange, ...} 으로 *순방향 진행 view*(지금
// 어디까지 왔나)를 렌더할 뿐 — 전송이 중단(연결 끊김·timeout)됐다가 재개될 때 "어느 byte 부터 다시
// 보내야 하고·어떤 chunk 들이 잔여이며·재개 시 첫 chunk 의 Content-Range 수치는 무엇이고·애초에
// 재개가 필요하긴 한가" 의 재개 지시(resume directive) 산정은 34 helper 중 0 회 cover 된 gap 이다
// (git grep ExportChunkResume|ChunkResumePlan|buildExportChunkResume|ResumeDirective|resumeFromChunk
// src/ → 0 매칭).
//
// describeExportChunkStreamProgress 가 진행 *상태* 를 보여주는 read-only view 라면, 본 helper 는 그로부터
// 한 단계 앞 — 중단 지점에서 *무엇을 다시 해야 하는가* 의 actionable plan 을 순수 산술로 derive 한다
// (progress view 와 resume directive 의 책임 분리). UC-07 §5 step 13(Export 다운로드) + §8 chunked
// streaming 이 필요로 하는 resumable 전송(재시도·재개 offset 안내)을 채운다.
//
// 실 재전송 / byte slice 추출 / HTTP Range 요청·206 Partial Content / Content-Range 헤더 직렬화 /
// SSE·long-poll·resumable upload 프로토콜 배선 / 재시도 정책·backoff·상태 머신 0 — 입력으로 받은
// ExportChunkPlan 과 acknowledgedChunks(수신측이 ack 한 chunk 개수)만으로 재개 plan 을 순수 산술로
// derive 한다. buildExportChunkPlan / describeExportChunkStreamProgress 를 재호출하지 않고 입력 plan 의
// chunks 경계를 그대로 사용한다(DRY). 새 도메인 타입은 ExportChunkResumePlan 만 신설하며 ExportChunkPlan
// / ExportChunk / ExportChunkContentRange 는 재사용(import — content-range 타입은
// export-chunk-stream-progress 에서 import 재사용, 중복 정의 금지). 새 외부 dependency 0. 코드 골격은
// export-chunk-stream-progress.ts(T-0470)의 isPlainObject / describeNonObject /
// isValidNonNegativeInteger 입력 방어 + 한국어 message convention 을 mirror 한다.
import { ExportChunk, ExportChunkPlan } from "./export-chunk-plan";
import { ExportChunkContentRange } from "./export-chunk-stream-progress";

// chunked streaming 재개 지시 모델 — plain object. resumeNeeded 는 재개가 필요한가(acknowledgedChunks
// < chunkCount), acknowledgedChunks 는 이미 ack 된 chunk 개수(입력 그대로), acknowledgedBytes 는 ack 된
// chunk 들의 sizeBytes 합(= 재개 시작 byte offset), resumeFromByte 는 다음 전송이 시작할 byte offset
// (= acknowledgedBytes; 전부 ack 됐으면 totalBytes), remainingChunks 는 아직 ack 안 된 chunk 목록
// (chunks[acknowledgedChunks..] 의 복사본; 전부 ack 됐으면 빈 배열), remainingChunkCount 는 잔여 chunk
// 개수(= chunkCount - acknowledgedChunks), remainingBytes 는 잔여 byte(= totalBytes - acknowledgedBytes),
// resumeRange 는 재개 시 첫 잔여 chunk 의 content-range 수치(resumeNeeded=false 이면 null), headline 은
// 한국어 한 줄 재개 지시 요약이다.
// 불변: acknowledgedBytes + remainingBytes === totalBytes, acknowledgedChunks + remainingChunkCount
// === chunkCount, remainingChunks.length === remainingChunkCount, resumeNeeded ⟺ (remainingChunkCount
// > 0), resumeRange === null ⟺ !resumeNeeded, resumeNeeded 이면 resumeFromByte ===
// remainingChunks[0].offsetBytes(재개 byte 가 첫 잔여 chunk 시작과 일치), !resumeNeeded 이면
// resumeFromByte === totalBytes && remainingBytes === 0. 후속 streaming controller / WebUI 재개 안내가
// 이 모델을 그대로 사용한다.
export interface ExportChunkResumePlan {
  resumeNeeded: boolean;
  acknowledgedChunks: number;
  acknowledgedBytes: number;
  resumeFromByte: number;
  remainingChunks: ExportChunk[];
  remainingChunkCount: number;
  remainingBytes: number;
  resumeRange: ExportChunkContentRange | null;
  headline: string;
}

// plain object(null/배열/비-object 아님) 판정 — plan 입력 방어에 쓴다
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
// (export-chunk-stream-progress.isValidNonNegativeInteger 동형). chunkCount/totalBytes/
// acknowledgedChunks 검증에 쓴다.
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// buildExportChunkResumePlan — 이미 산출된 ExportChunkPlan 과 acknowledgedChunks(수신측이 ack 한
// chunk 개수)로부터 chunked streaming 의 재개 지시를 순수 산술로 산정한다(UC-07 §8 NFR + §5 step 13
// 정합):
//   - acknowledgedBytes = plan.chunks[0..acknowledgedChunks-1] 의 sizeBytes 합(acknowledgedChunks=0
//     이면 0). resumeFromByte = acknowledgedBytes.
//   - resumeNeeded = (acknowledgedChunks < plan.chunkCount).
//   - remainingChunkCount = plan.chunkCount - acknowledgedChunks.
//   - remainingBytes = plan.totalBytes - acknowledgedBytes.
//   - remainingChunks = plan.chunks.slice(acknowledgedChunks) 의 복사(원본 chunk 객체 mutate·공유 금지).
//   - resumeRange = resumeNeeded ? {firstBytePos: remainingChunks[0].offsetBytes, lastBytePos:
//     remainingChunks[0].offsetBytes + remainingChunks[0].sizeBytes - 1, totalBytes: plan.totalBytes,
//     chunkIndex: remainingChunks[0].index} : null.
//
// 경계: chunkCount 0(0 byte plan) → acknowledgedChunks 0 만 허용(0 초과면 RangeError) · resumeNeeded
// false · acknowledgedBytes 0 · resumeFromByte 0 · remainingChunks [] · resumeRange null.
// acknowledgedChunks 0(미시작, chunkCount>0) → resumeNeeded true · acknowledgedBytes 0 · resumeFromByte
// 0 · remainingChunks 전체 복사 · resumeRange 첫 chunk 경계. acknowledgedChunks === chunkCount(완료) →
// resumeNeeded false · remainingChunks [] · remainingBytes 0 · resumeFromByte totalBytes · resumeRange
// null.
//
// 입력 plan / plan.chunks 를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체·중첩 객체·
// remainingChunks 항목·resumeRange 는 항상 새 것. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - plan 이 plain object 아님(null/배열/원시값) → TypeError(label "plan").
//   - plan.chunkCount 비-음수정수 아님 / plan.totalBytes 비-음수정수 아님 / plan.chunks 배열 아님 /
//     plan.chunks.length !== plan.chunkCount(손상) → TypeError(받은 값·불일치 박제).
//   - acknowledgedChunks 비-음수정수 아님(음수·소수·NaN·Infinity·비-number) → TypeError(받은 값 박제).
//   - acknowledgedChunks > plan.chunkCount → RangeError(acknowledgedChunks·chunkCount 박제 — ack 된
//     chunk 가 전체 chunk 를 초과할 수 없음).
export function buildExportChunkResumePlan(
  plan: ExportChunkPlan,
  acknowledgedChunks: number,
): ExportChunkResumePlan {
  // top-level plan 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(plan)) {
    throw new TypeError(
      `buildExportChunkResumePlan: plan 은 plain object 여야 합니다 (받음: ${describeNonObject(
        plan,
      )})`,
    );
  }

  const chunkCount = (plan as { chunkCount: unknown }).chunkCount;
  if (!isValidNonNegativeInteger(chunkCount)) {
    throw new TypeError(
      `buildExportChunkResumePlan: plan.chunkCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        chunkCount,
      )})`,
    );
  }

  const totalBytes = (plan as { totalBytes: unknown }).totalBytes;
  if (!isValidNonNegativeInteger(totalBytes)) {
    throw new TypeError(
      `buildExportChunkResumePlan: plan.totalBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        totalBytes,
      )})`,
    );
  }

  const chunks = (plan as { chunks: unknown }).chunks;
  if (!Array.isArray(chunks)) {
    throw new TypeError(
      `buildExportChunkResumePlan: plan.chunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        chunks,
      )})`,
    );
  }

  // chunks.length 와 chunkCount 불일치는 손상된 plan — 거부(재개 산정의 전제가 깨짐).
  if (chunks.length !== chunkCount) {
    throw new TypeError(
      `buildExportChunkResumePlan: plan.chunks.length(${chunks.length})가 plan.chunkCount(${chunkCount})와 일치하지 않습니다 — 손상된 plan`,
    );
  }

  // acknowledgedChunks 는 비-음수 정수여야 한다 — 음수·소수·NaN·Infinity·비-number 거부.
  if (!isValidNonNegativeInteger(acknowledgedChunks)) {
    throw new TypeError(
      `buildExportChunkResumePlan: acknowledgedChunks 는 0 이상의 정수여야 합니다 (받음: ${String(
        acknowledgedChunks,
      )})`,
    );
  }

  // ack 된 chunk 가 전체 chunk 를 초과할 수 없다 — 범위 위반은 RangeError.
  if (acknowledgedChunks > chunkCount) {
    throw new RangeError(
      `buildExportChunkResumePlan: acknowledgedChunks(${acknowledgedChunks})가 plan.chunkCount(${chunkCount})를 초과합니다 — ack 된 chunk 가 전체 chunk 를 넘을 수 없습니다`,
    );
  }

  const typedChunks = chunks as ExportChunk[];

  // ack 된 chunk 들의 byte 합 — chunks[0..acknowledgedChunks-1] 의 sizeBytes 누적(acknowledgedChunks=0
  // 이면 0). 이 값이 재개 시작 byte offset(resumeFromByte)이 된다.
  let acknowledgedBytes = 0;
  for (let i = 0; i < acknowledgedChunks; i += 1) {
    acknowledgedBytes += typedChunks[i].sizeBytes;
  }

  const resumeFromByte = acknowledgedBytes;
  const resumeNeeded = acknowledgedChunks < chunkCount;
  const remainingChunkCount = chunkCount - acknowledgedChunks;
  const remainingBytes = totalBytes - acknowledgedBytes;

  // 잔여 chunk 목록 — chunks[acknowledgedChunks..] 의 복사본(원본 객체 mutate·공유 금지 — 새 객체로).
  const remainingChunks: ExportChunk[] = typedChunks
    .slice(acknowledgedChunks)
    .map((chunk) => ({ ...chunk }));

  // 재개 시 첫 잔여 chunk 의 content-range 수치 — inclusive 경계(lastBytePos = offset + size - 1).
  // 재개 불요(전부 ack)면 null.
  const resumeRange: ExportChunkContentRange | null = resumeNeeded
    ? {
        firstBytePos: remainingChunks[0].offsetBytes,
        lastBytePos:
          remainingChunks[0].offsetBytes + remainingChunks[0].sizeBytes - 1,
        totalBytes,
        chunkIndex: remainingChunks[0].index,
      }
    : null;

  const headline = resumeNeeded
    ? `chunked streaming 재개: 전체 ${chunkCount} 개 중 ${acknowledgedChunks} 개 ack, byte ${resumeFromByte} 부터 잔여 ${remainingChunkCount} 개 chunk(${remainingBytes} B) 재전송, 다음 chunk #${remainingChunks[0].index}`
    : chunkCount === 0
      ? `chunked streaming 재개: 전송할 chunk 가 없습니다 (0 chunk, 재개 불요)`
      : `chunked streaming 재개: 전체 ${chunkCount} 개 chunk(${totalBytes} B) 모두 ack — 재개 불요`;

  return {
    resumeNeeded,
    acknowledgedChunks,
    acknowledgedBytes,
    resumeFromByte,
    remainingChunks,
    remainingChunkCount,
    remainingBytes,
    resumeRange,
    headline,
  };
}
