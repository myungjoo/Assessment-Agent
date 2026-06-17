// import-chunk-reassembly-order — UC-07 §8 NFR chunked upload Import 측 수신 chunk 디스크립터가 완전·
// 연속·무중복·정렬된 reassembly 가능한 시퀀스인지 순수 산술로 검증하는 helper (T-0480, P7 / REQ-030 /
// REQ-032 / REQ-045). 지금까지의 chunked-streaming helper 들(T-0437~T-0479, 43개)은 거의 전부 Export
// 측(다운로드)에 집중돼 있다 — buildExportChunkPlan·describeExportChunkStreamProgress·buildExport
// ChunkResumePlan·estimateExportChunkStreamThroughput·refetch 계열(coalesce/savings/fragmentation/
// gap/retry-budget)·integrity reconcile 모두 export 가 chunk 를 *내보내는/재요청하는* 쪽이다.
//
// 그러나 chunked 전송에는 대칭되는 Import 측(수신·업로드) 책임이 있다: dump 가 여러 chunk 로 나뉘어
// 도착하면, importer 는 재조립(reassembly)을 시작하기 전에 *수신한 chunk 디스크립터들이 하나의 완전한
// byte 시퀀스를 이루는지* 검증해야 한다 — 빠진 chunk 가 없는가(완전성), 인접 chunk 의 byte 범위가 끊김
// 없이 이어지는가(연속성·gap 없음), 같은 범위가 두 번 오지 않았는가(무중복·overlap 없음), index 가
// 0..N-1 로 정렬돼 있는가(순서). 이 검증을 통과해야만 atomic Import transaction(§8 (b) — 부분 복원
// 상태 없음)을 안전하게 시작할 수 있다. 이 import-side chunk reassembly-order 검증 도메인은 43 helper
// 중 0 회 cover 된 gap 이다(git grep ImportChunk|reassembl|nextExpectedOffset 0).
//
// Export 측 summariseExportChunkRefetchGaps(T-0476)는 *손상돼 재요청할* export chunk 의 byte gap 을
// 다루지만, 본 helper 는 *수신된 import chunk* 가 재조립 가능한 완전 시퀀스인지를 판정한다 — 방향
// (다운로드 vs 업로드)·목적(재요청 대상 산정 vs 재조립 go/no-go)이 직교한다.
//
// 실 업로드 수신·byte slice 추출·재조립(실 bytes 결합)·HTTP Range/206 Partial Content·resumable upload
// 프로토콜·digest/checksum·타이머·시계 read 0 — chunk 디스크립터(index·offset·size)는 caller 가
// 전달하고, 본 helper 는 산술 검증만 한다(non-mutating·결정성·DRY). 입력 방어 골격(isPlainObject /
// describeNonObject / isValidNonNegativeInteger) + 한국어 message convention 은 export-chunk-refetch-
// gap.ts 를 mirror 한다.

// 수신된 dump chunk 디스크립터 — plain object. index 는 0-기반 chunk 순번(비-음수 정수), offsetBytes 는
// 이 chunk 가 차지하는 시작 byte offset(비-음수 정수), sizeBytes 는 이 chunk 의 byte 크기(양의 정수,
// ≥ 1)이다.
export interface ImportChunkDescriptor {
  index: number;
  offsetBytes: number;
  sizeBytes: number;
}

// validateImportChunkReassemblyOrder 입력 — plain object. chunks 는 수신된 chunk 디스크립터 배열,
// expectedTotalBytes 는 완전 시퀀스의 총 byte 수(비-음수 정수)이다.
export interface ImportChunkReassemblyOrderInput {
  chunks: ImportChunkDescriptor[];
  expectedTotalBytes: number;
}

// 수신 chunk 재조립 순서·완전성 검증 결과 모델 — plain object. receivedChunkCount 는 수신 chunk 수
// (= chunks.length), expectedTotalBytes 는 입력 echo, coveredBytes 는 정렬·중복제거 없이 단순 sizeBytes
// 합, complete 는 빠진 index·gap·overlap 없이 0..N-1 이 끊김없이 expectedTotalBytes 를 정확히 덮는가,
// outOfOrder 는 입력 순서가 index 오름차순이 아닌가, missingIndexes 는 0..maxIndex 중 누락된 index
// 오름차순, duplicateIndexes 는 중복 등장한 index 오름차순·중복제거, gapBytes 는 정렬 후 인접 chunk
// 사이 비어있는 총 byte, overlapBytes 는 정렬 후 인접 chunk 가 겹치는 총 byte, byteShortfall 은
// max(0, expectedTotalBytes - coveredBytes), nextExpectedOffset 은 정렬된 시퀀스를 끊김 없이 따라갔을
// 때 다음에 와야 할 offset(완전하면 expectedTotalBytes), headline 은 한국어 한 줄 요약이다. 후속 import
// controller / WebUI 업로드 검증 안내가 그대로 사용한다.
export interface ImportChunkReassemblyOrderReport {
  receivedChunkCount: number;
  expectedTotalBytes: number;
  coveredBytes: number;
  complete: boolean;
  outOfOrder: boolean;
  missingIndexes: number[];
  duplicateIndexes: number[];
  gapBytes: number;
  overlapBytes: number;
  byteShortfall: number;
  nextExpectedOffset: number;
  headline: string;
}

// plain object(null/배열/비-object 아님) 판정 — input/chunk 입력 방어에 쓴다
// (export-chunk-refetch-gap.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (export-chunk-refetch-gap.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// 값이 유효한 비-음수 유한 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부
// (export-chunk-refetch-gap.isValidNonNegativeInteger 동형).
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// 값이 유효한 양의 유한 정수(≥ 1)인지 판정 — 0/음수/NaN/Infinity/소수/비-number 거부.
function isValidPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

// chunks 의 각 원소가 유효한 ImportChunkDescriptor 인지 검증 — plain object 이고 index/offsetBytes 가
// 비-음수정수, sizeBytes 가 양의 정수(≥ 1)여야 한다. 위반 시 부적합 원소 index·label·받은 값을 박제한
// TypeError.
function assertValidDescriptor(chunk: unknown, position: number): void {
  if (!isPlainObject(chunk)) {
    throw new TypeError(
      `validateImportChunkReassemblyOrder: chunks[${position}] 는 plain object 여야 합니다 (받음: ${describeNonObject(
        chunk,
      )})`,
    );
  }
  const index = (chunk as { index: unknown }).index;
  if (!isValidNonNegativeInteger(index)) {
    throw new TypeError(
      `validateImportChunkReassemblyOrder: chunks[${position}].index 는 0 이상의 정수여야 합니다 (받음: ${String(
        index,
      )})`,
    );
  }
  const offsetBytes = (chunk as { offsetBytes: unknown }).offsetBytes;
  if (!isValidNonNegativeInteger(offsetBytes)) {
    throw new TypeError(
      `validateImportChunkReassemblyOrder: chunks[${position}].offsetBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        offsetBytes,
      )})`,
    );
  }
  const sizeBytes = (chunk as { sizeBytes: unknown }).sizeBytes;
  if (!isValidPositiveInteger(sizeBytes)) {
    throw new TypeError(
      `validateImportChunkReassemblyOrder: chunks[${position}].sizeBytes 는 1 이상의 정수여야 합니다 (받음: ${String(
        sizeBytes,
      )})`,
    );
  }
}

// validateImportChunkReassemblyOrder — 수신된 chunk 디스크립터 배열이 완전·연속·무중복·정렬된 reassembly
// 가능한 시퀀스인지 순수 산술로 검증한다(UC-07 §8 NFR 정합). 입력 chunks 를 (원본 비변형) index 기준
// 정렬한 복사본으로 위 필드를 derive 한다.
//
// 산정:
//   - receivedChunkCount = chunks.length, coveredBytes = Σ sizeBytes(정렬·중복제거 없이 단순 합).
//   - outOfOrder = 입력 순서가 index 오름차순(같음 허용 안 함 — strict)이 아님.
//   - missingIndexes = 0..maxIndex 중 등장하지 않은 index 오름차순(maxIndex = 등장 index 의 최대값).
//   - duplicateIndexes = 2회 이상 등장한 index 오름차순·중복제거.
//   - 정렬 후 인접 (prev, cur) 쌍에서 delta = cur.offsetBytes - (prev.offsetBytes + prev.sizeBytes):
//     delta > 0 이면 gap(빈 byte) += delta, delta < 0 이면 overlap(겹친 byte) += -delta.
//   - byteShortfall = max(0, expectedTotalBytes - coveredBytes).
//   - nextExpectedOffset = 정렬된 시퀀스를 끊김 없이(첫 chunk offset 0 부터) 따라갔을 때 다음에 와야 할
//     offset — 첫 gap/overlap/index-누락/중복 또는 끝에서 멈춘다(완전하면 expectedTotalBytes).
//   - complete ⟺ (missingIndexes 0 && duplicateIndexes 0 && gapBytes 0 && overlapBytes 0 &&
//     coveredBytes === expectedTotalBytes && 첫 offset 0).
//
// 불변: coveredBytes === Σ sizeBytes, gapBytes >= 0 && overlapBytes >= 0,
// byteShortfall === max(0, expectedTotalBytes - coveredBytes), complete ⟺ 위 조건, complete ⟹
// nextExpectedOffset === expectedTotalBytes.
//
// 경계: 빈 chunks(complete=false·receivedChunkCount=0·coveredBytes=0·byteShortfall=expectedTotalBytes·
// missingIndexes=[]·nextExpectedOffset=0). 단일 chunk(index 0·offset 0·size=expectedTotalBytes →
// complete=true). 누락 index / 중복 index / gap / overlap / out-of-order / byteShortfall 각 분기 처리.
//
// 입력 chunks 배열·원소를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체·배열은 항상
// 새 것. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - input 이 plain object 아님(null/배열/원시값) → TypeError(label "input").
//   - input.chunks 가 배열 아님 → TypeError(label "chunks", 받은 값 박제).
//   - input.chunks[i] 가 plain object 아님 / index·offsetBytes 비-음수정수 아님 / sizeBytes 양의정수 아님
//     → TypeError(원소 index·label·받은 값 박제).
//   - input.expectedTotalBytes 비-음수정수 아님 → TypeError(label·받은 값 박제).
export function validateImportChunkReassemblyOrder(
  input: ImportChunkReassemblyOrderInput,
): ImportChunkReassemblyOrderReport {
  // top-level input 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(input)) {
    throw new TypeError(
      `validateImportChunkReassemblyOrder: input 은 plain object 여야 합니다 (받음: ${describeNonObject(
        input,
      )})`,
    );
  }

  const chunks = (input as { chunks: unknown }).chunks;
  if (!Array.isArray(chunks)) {
    throw new TypeError(
      `validateImportChunkReassemblyOrder: input.chunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        chunks,
      )})`,
    );
  }

  const expectedTotalBytes = (input as { expectedTotalBytes: unknown })
    .expectedTotalBytes;
  if (!isValidNonNegativeInteger(expectedTotalBytes)) {
    throw new TypeError(
      `validateImportChunkReassemblyOrder: input.expectedTotalBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        expectedTotalBytes,
      )})`,
    );
  }

  // 각 chunks 원소가 유효한 ImportChunkDescriptor 인지 검증.
  for (let i = 0; i < chunks.length; i += 1) {
    assertValidDescriptor(chunks[i], i);
  }

  const typedChunks = chunks as ImportChunkDescriptor[];
  const receivedChunkCount = typedChunks.length;

  // coveredBytes = 단순 sizeBytes 합(정렬·중복제거 없이). outOfOrder = 입력이 index 오름차순(strict)
  // 아님. index 등장 횟수 누적(누락·중복 산정용).
  let coveredBytes = 0;
  let outOfOrder = false;
  let maxIndex = -1;
  const indexCounts = new Map<number, number>();
  for (let i = 0; i < typedChunks.length; i += 1) {
    const chunk = typedChunks[i];
    coveredBytes += chunk.sizeBytes;
    if (i > 0 && chunk.index <= typedChunks[i - 1].index) {
      outOfOrder = true;
    }
    if (chunk.index > maxIndex) {
      maxIndex = chunk.index;
    }
    indexCounts.set(chunk.index, (indexCounts.get(chunk.index) ?? 0) + 1);
  }

  // missingIndexes = 0..maxIndex 중 등장 안 한 index, duplicateIndexes = 2회 이상 등장한 index
  // (둘 다 오름차순). chunks 비었으면 maxIndex = -1 이라 두 루프 모두 비어 빈 배열.
  const missingIndexes: number[] = [];
  for (let idx = 0; idx <= maxIndex; idx += 1) {
    if (!indexCounts.has(idx)) {
      missingIndexes.push(idx);
    }
  }
  const duplicateIndexes: number[] = [];
  for (let idx = 0; idx <= maxIndex; idx += 1) {
    if ((indexCounts.get(idx) ?? 0) >= 2) {
      duplicateIndexes.push(idx);
    }
  }

  // 정렬한 복사본(원본 비변형)으로 인접 byte 연속성 평가 — gap/overlap/nextExpectedOffset.
  const sorted = typedChunks
    .slice()
    .sort((a, b) => a.offsetBytes - b.offsetBytes);

  let gapBytes = 0;
  let overlapBytes = 0;
  // nextExpectedOffset 추적: 끊김 없이(0 부터) 따라간 cursor. 첫 chunk 가 offset 0 에서 시작하고
  // 인접이 끊김 없이 이어지는 동안만 전진하며, 첫 불일치(gap/overlap/시작 offset != 0)에서 멈춘다.
  let nextExpectedOffset = 0;
  let contiguousFromZero = true;
  for (let i = 0; i < sorted.length; i += 1) {
    const cur = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      const delta = cur.offsetBytes - (prev.offsetBytes + prev.sizeBytes);
      if (delta > 0) {
        gapBytes += delta;
      } else if (delta < 0) {
        overlapBytes += -delta;
      }
    }
    if (contiguousFromZero && cur.offsetBytes === nextExpectedOffset) {
      nextExpectedOffset = cur.offsetBytes + cur.sizeBytes;
    } else {
      contiguousFromZero = false;
    }
  }

  const byteShortfall = Math.max(0, expectedTotalBytes - coveredBytes);

  const complete =
    missingIndexes.length === 0 &&
    duplicateIndexes.length === 0 &&
    gapBytes === 0 &&
    overlapBytes === 0 &&
    coveredBytes === expectedTotalBytes &&
    receivedChunkCount > 0 &&
    contiguousFromZero;

  // 완전하면 nextExpectedOffset 은 expectedTotalBytes 와 일치(끊김 없이 끝까지 전진).
  const headline = complete
    ? `import chunk 재조립: ${receivedChunkCount}개 chunk 로 ${expectedTotalBytes} bytes 완전·연속·무중복·정렬(재조립 가능)`
    : `import chunk 재조립: 수신 ${receivedChunkCount}개, 누락 ${missingIndexes.length}개·중복 ${duplicateIndexes.length}개·gap ${gapBytes} bytes·overlap ${overlapBytes} bytes·부족 ${byteShortfall} bytes(재조립 불가)`;

  return {
    receivedChunkCount,
    expectedTotalBytes,
    coveredBytes,
    complete,
    outOfOrder,
    missingIndexes,
    duplicateIndexes,
    gapBytes,
    overlapBytes,
    byteShortfall,
    nextExpectedOffset,
    headline,
  };
}
