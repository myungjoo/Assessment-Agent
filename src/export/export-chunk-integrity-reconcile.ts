// export-chunk-integrity-reconcile — UC-07 §8 NFR chunked streaming 의 수신측 per-chunk 무결성
// 검증 결과로부터 *재요청 지시*(어느 chunk 들이 손상됐고·각 재요청의 Content-Range 수치는
// 무엇이며·재요청 byte 총량은 얼마이고·애초에 전부 무결한가)를 산정하는 순수 helper (T-0472,
// P7 R-57 / REQ-030 / REQ-032 / REQ-045). 직전 buildExportChunkResumePlan(T-0471)은
// acknowledgedChunks(연속 ack 개수)로부터 *순방향 재개*(어느 byte 부터 이어 보낼지)만 산정하지만,
// 전송 자체는 끊기지 않았어도 수신측이 chunk 별 무결성 검사(예: 각 chunk digest 대조)에서
// *비연속적인 실패*(예: chunk 0·2 통과, chunk 1·4 손상)를 발견한 경우 "어느 chunk 들을 다시
// 보내야 하고·각 재요청의 Content-Range 수치는 무엇이며·재요청 byte 총량은 얼마이고·전부
// 무결한가" 의 재요청 지시(re-fetch directive) 산정은 35 helper 중 0 회 cover 된 gap 이다
// (git grep ChunkIntegrity|verifyExportChunk|ChunkChecksum|reconcileChunk|ChunkVerification src/
// → 0 매칭).
//
// buildExportChunkResumePlan 이 *연속* ack 경계 기준 forward resume 이라면, 본 helper 는 그와
// 직교(orthogonal) — 임의(비연속) chunk 집합의 무결성 실패를 받아 *그 chunk 들만* 골라 재요청
// plan 을 순수 산술로 derive 한다(연속 forward resume 과 비연속 무결성 재요청의 책임 분리).
// UC-07 §5 step 13(Export 다운로드) + §8 chunked streaming 이 필요로 하는 신뢰성 있는 전송(부분
// 손상 복구)을 채운다.
//
// 실 digest / checksum 계산 / chunk 내용 비교 / 실 재전송 / byte slice 추출 / HTTP Range 요청·206
// Partial Content / Content-Range 헤더 직렬화(실 "Content-Range: bytes a-b/c" 문자열) / 재시도
// 정책·backoff·상태 머신 0 — 입력으로 받은 ExportChunkPlan 과 chunkIntegrity(chunk 별 무결성
// 결과 boolean 배열)만으로 재요청 plan 을 순수 산술로 derive 한다. buildExportChunkPlan /
// buildExportChunkResumePlan / verifyDumpChecksum 를 재호출하지 않고 입력 plan 의 chunks 경계를
// 그대로 사용한다(DRY). 새 도메인 타입은 ExportChunkIntegrityReconcile 만 신설하며 ExportChunkPlan
// / ExportChunk / ExportChunkContentRange 는 재사용(import — content-range 타입은
// export-chunk-stream-progress 에서 import 재사용, 중복 정의 금지). 새 외부 dependency 0. 코드
// 골격은 export-chunk-resume-plan.ts(T-0471)의 isPlainObject / describeNonObject /
// isValidNonNegativeInteger 입력 방어 + 한국어 message convention 을 mirror 한다.
import { ExportChunk, ExportChunkPlan } from "./export-chunk-plan";
import { ExportChunkContentRange } from "./export-chunk-stream-progress";

// chunked streaming per-chunk 무결성 재요청 지시 모델 — plain object. allIntact 는 전부 무결한가
// (실패 chunk 0 개), verifiedChunkCount 는 검증 대상 chunk 개수(= plan.chunkCount), intactChunkCount
// 는 통과 chunk 개수, failedChunkCount 는 실패 chunk 개수, failedChunks 는 실패한 chunk 목록(실패
// index 의 plan.chunks 항목 복사본; index 오름차순; 모두 무결하면 빈 배열), refetchRanges 는 각
// 실패 chunk 의 content-range 수치 배열(failedChunks 와 1:1 동순서; 모두 무결하면 빈 배열),
// refetchBytes 는 실패 chunk 들의 sizeBytes 합(= 재요청 총 byte; 모두 무결하면 0), headline 은
// 한국어 한 줄 재요청 지시 요약이다.
// 불변: intactChunkCount + failedChunkCount === verifiedChunkCount(= chunkCount),
// failedChunks.length === failedChunkCount === refetchRanges.length, allIntact ⟺ (failedChunkCount
// === 0) ⟺ (refetchBytes === 0) ⟺ (refetchRanges.length === 0), refetchBytes <= totalBytes,
// failedChunks 는 항상 index 오름차순. 후속 streaming controller / WebUI 재요청 안내가 이 모델을
// 그대로 사용한다.
export interface ExportChunkIntegrityReconcile {
  allIntact: boolean;
  verifiedChunkCount: number;
  intactChunkCount: number;
  failedChunkCount: number;
  failedChunks: ExportChunk[];
  refetchRanges: ExportChunkContentRange[];
  refetchBytes: number;
  headline: string;
}

// plain object(null/배열/비-object 아님) 판정 — plan 입력 방어에 쓴다
// (export-chunk-resume-plan.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (export-chunk-resume-plan.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// 값이 유효한 비-음수 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부
// (export-chunk-resume-plan.isValidNonNegativeInteger 동형). chunkCount/totalBytes 검증에 쓴다.
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// reconcileExportChunkIntegrity — 이미 산출된 ExportChunkPlan 과 chunkIntegrity(chunk 별 무결성
// 결과 boolean 배열 — chunkIntegrity[i] === true 이면 chunk i 무결, false 이면 손상)로부터 chunked
// streaming 의 재요청 지시를 순수 산술로 산정한다(UC-07 §8 NFR + §5 step 13 정합):
//   - failedChunks = plan.chunks.filter((_, i) => chunkIntegrity[i] === false) 의 복사(원본 chunk
//     객체 mutate·공유 금지 — 새 객체로; filter 가 index 오름차순을 보존).
//   - failedChunkCount = failedChunks.length, intactChunkCount = plan.chunkCount - failedChunkCount.
//   - allIntact = (failedChunkCount === 0).
//   - refetchBytes = failedChunks 의 sizeBytes 합(allIntact 면 0).
//   - refetchRanges = failedChunks.map(c => {firstBytePos: c.offsetBytes, lastBytePos: c.offsetBytes
//     + c.sizeBytes - 1, totalBytes: plan.totalBytes, chunkIndex: c.index})(content-range inclusive
//     경계 — export-chunk-stream-progress 와 동일 규칙; allIntact 면 빈 배열).
//   - verifiedChunkCount = plan.chunkCount.
//
// 경계: chunkCount 0(0 byte plan) → chunkIntegrity 빈 배열만 허용 · allIntact true · 전부 0/빈
// 배열. 전부 무결(chunkIntegrity 전부 true, chunkCount>0) → allIntact true · failedChunks [] ·
// refetchBytes 0 · refetchRanges []. 전부 손상(전부 false) → allIntact false · failedChunks 전체
// 복사 · refetchBytes totalBytes · refetchRanges 전체 chunk content-range. 비연속 실패 → 실패 index
// 만 오름차순으로 골라 동순서 refetchRanges.
//
// 입력 plan / plan.chunks / chunkIntegrity 를 변형하지 않으며(non-mutating — freeze 된 입력 통과),
// 반환 객체·failedChunks 항목·refetchRanges 항목은 항상 새 것. 동일 입력 2 회 호출은 동등 결과
// (순수·결정성). 입력 방어:
//   - plan 이 plain object 아님(null/배열/원시값) → TypeError(label "plan").
//   - plan.chunkCount 비-음수정수 아님 / plan.totalBytes 비-음수정수 아님 / plan.chunks 배열 아님 /
//     plan.chunks.length !== plan.chunkCount(손상) → TypeError(받은 값·불일치 박제).
//   - chunkIntegrity 배열 아님 → TypeError(label "chunkIntegrity", 받은 값 박제).
//   - chunkIntegrity 항목 중 boolean 아님(숫자·문자·null·undefined) → TypeError(부적합 index·받은
//     값 박제).
//   - chunkIntegrity.length !== plan.chunkCount → RangeError(chunkIntegrity 길이·chunkCount 박제 —
//     검증 결과 개수가 chunk 개수와 불일치).
export function reconcileExportChunkIntegrity(
  plan: ExportChunkPlan,
  chunkIntegrity: boolean[],
): ExportChunkIntegrityReconcile {
  // top-level plan 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(plan)) {
    throw new TypeError(
      `reconcileExportChunkIntegrity: plan 은 plain object 여야 합니다 (받음: ${describeNonObject(
        plan,
      )})`,
    );
  }

  const chunkCount = (plan as { chunkCount: unknown }).chunkCount;
  if (!isValidNonNegativeInteger(chunkCount)) {
    throw new TypeError(
      `reconcileExportChunkIntegrity: plan.chunkCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        chunkCount,
      )})`,
    );
  }

  const totalBytes = (plan as { totalBytes: unknown }).totalBytes;
  if (!isValidNonNegativeInteger(totalBytes)) {
    throw new TypeError(
      `reconcileExportChunkIntegrity: plan.totalBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        totalBytes,
      )})`,
    );
  }

  const chunks = (plan as { chunks: unknown }).chunks;
  if (!Array.isArray(chunks)) {
    throw new TypeError(
      `reconcileExportChunkIntegrity: plan.chunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        chunks,
      )})`,
    );
  }

  // chunks.length 와 chunkCount 불일치는 손상된 plan — 거부(재요청 산정의 전제가 깨짐).
  if (chunks.length !== chunkCount) {
    throw new TypeError(
      `reconcileExportChunkIntegrity: plan.chunks.length(${chunks.length})가 plan.chunkCount(${chunkCount})와 일치하지 않습니다 — 손상된 plan`,
    );
  }

  // chunkIntegrity 는 boolean 배열이어야 한다 — 배열 아니면 거부.
  if (!Array.isArray(chunkIntegrity)) {
    throw new TypeError(
      `reconcileExportChunkIntegrity: chunkIntegrity 는 배열이어야 합니다 (받음: ${describeNonObject(
        chunkIntegrity,
      )})`,
    );
  }

  // chunkIntegrity 길이가 chunkCount 와 불일치 — 검증 결과 개수가 chunk 개수와 안 맞음(범위 위반).
  if (chunkIntegrity.length !== chunkCount) {
    throw new RangeError(
      `reconcileExportChunkIntegrity: chunkIntegrity.length(${chunkIntegrity.length})가 plan.chunkCount(${chunkCount})와 일치하지 않습니다 — 검증 결과 개수가 chunk 개수와 불일치`,
    );
  }

  // chunkIntegrity 의 모든 항목은 boolean 이어야 한다 — 숫자·문자·null·undefined 등 거부(부적합
  // index·받은 값 박제).
  for (let i = 0; i < chunkIntegrity.length; i += 1) {
    if (typeof chunkIntegrity[i] !== "boolean") {
      throw new TypeError(
        `reconcileExportChunkIntegrity: chunkIntegrity[${i}] 는 boolean 이어야 합니다 (받음: ${String(
          chunkIntegrity[i],
        )})`,
      );
    }
  }

  const typedChunks = chunks as ExportChunk[];

  // 실패(무결성 false) chunk 만 오름차순으로 골라 복사 — 원본 chunk 객체 mutate·공유 금지(새 객체).
  // filter 가 원래 index 순서를 보존하므로 failedChunks 는 항상 index 오름차순.
  const failedChunks: ExportChunk[] = typedChunks
    .filter((_, i) => chunkIntegrity[i] === false)
    .map((chunk) => ({ ...chunk }));

  const failedChunkCount = failedChunks.length;
  const intactChunkCount = chunkCount - failedChunkCount;
  const allIntact = failedChunkCount === 0;

  // 재요청 총 byte — 실패 chunk 들의 sizeBytes 합(allIntact 면 0).
  const refetchBytes = failedChunks.reduce(
    (sum, chunk) => sum + chunk.sizeBytes,
    0,
  );

  // 각 실패 chunk 의 content-range 수치 — inclusive 경계(lastBytePos = offset + size - 1),
  // export-chunk-stream-progress 와 동일 규칙. failedChunks 와 1:1 동순서.
  const refetchRanges: ExportChunkContentRange[] = failedChunks.map(
    (chunk) => ({
      firstBytePos: chunk.offsetBytes,
      lastBytePos: chunk.offsetBytes + chunk.sizeBytes - 1,
      totalBytes,
      chunkIndex: chunk.index,
    }),
  );

  const headline = allIntact
    ? chunkCount === 0
      ? `chunked streaming 무결성: 검증할 chunk 가 없습니다 (0 chunk, 전부 무결 — 재요청 불요)`
      : `chunked streaming 무결성: 전체 ${chunkCount} 개 chunk 모두 무결 — 재요청 불요`
    : `chunked streaming 무결성: 전체 ${chunkCount} 개 중 ${failedChunkCount} 개 chunk 손상 — chunk [${failedChunks
        .map((c) => `#${c.index}`)
        .join(", ")}] 재요청 (${refetchBytes} B)`;

  return {
    allIntact,
    verifiedChunkCount: chunkCount,
    intactChunkCount,
    failedChunkCount,
    failedChunks,
    refetchRanges,
    refetchBytes,
    headline,
  };
}
