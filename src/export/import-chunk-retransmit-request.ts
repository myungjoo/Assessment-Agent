// import-chunk-retransmit-request — UC-07 §8 NFR chunked upload(resumable) Import 측에서, 재조립 검증으로
// 드러난 *누락 chunk index* 를 인접한 연속 run 으로 묶어 클라이언트에 재업로드를 요청할 retransmit-request
// plan 을 순수 산술로 산정하는 helper (T-0483, P7 / REQ-030 / REQ-032 / REQ-045). 직전 IMPORT 측 helper
// 들은 수신 chunk 를 (T-0480 validateImportChunkReassemblyOrder) 재조립 가능한 완전·연속·무중복·정렬
// 시퀀스인지 *검증(go/no-go)* 하고, (T-0481 describeImportChunkUploadProgress) 수신 진행 상태를 *렌더*
// 하고, (T-0482 planImportChunkDeduplication) 중복·overlap 수신 record 를 *dedup* 한다. 그러나 어느
// helper 도 누락 chunk 의 *재업로드 요청 plan* 을 만들지 않는다 — T-0480 은 missingIndexes/gapBytes 를
// *탐지만* 할 뿐 그 누락 index 를 "몇 번의 요청으로·인접 run 으로 묶어·얼마의 byte 를 다시 받을지" 의
// actionable 요청 단위로 묶지 않는다. 이 retransmit-request 도메인은 46 helper 중 0 회 cover 된 gap 이다.
//
// 본 helper 는 download(Export) 측 buildExportChunkResumePlan(T-0471 — *보내는* 측 재개 directive)의
// 대칭 IMPORT(*받는* 측 재업로드 요청 directive)이며, coalesceExportChunkRefetch(T-0473 — 실패 export
// chunk 의 인접 byte 범위 병합)의 import 측 mirror 이다. 그러나 방향(보내는 측 resume vs 받는 측
// request)·입력(ack 개수/실패 chunk vs 수신 ImportChunkDescriptor[]+expectedTotalChunks)·출력(resume/
// coalesce byte range vs 재업로드 요청할 index run 배열)이 직교한다. T-0480 validate 와도 직교 — validate
// 는 누락을 *탐지(시작 가능?)* 하고, 본 helper 는 누락을 *어떻게 다시 받을지(요청 plan)* 산정한다(완전성
// boolean·gap·overlap·정렬 재판정 금지). 도메인 타입 ImportChunkDescriptor 는 T-0480 의
// import-chunk-reassembly-order.ts 에서 그대로 import 해 재사용한다(DRY — 재정의 금지).
//
// 실 업로드 수신·byte slice·실 재조립·HTTP Range/206·resumable upload 프로토콜(tus 등)·타이머·시계 read 0
// — chunk 디스크립터(index·offset·size)와 expectedTotalChunks·표준 chunk byte 크기는 caller 가 전달하고,
// 본 helper 는 산술 요청 plan 만 한다(non-mutating·결정성). 입력 방어 골격(isPlainObject /
// describeNonObject / isValidNonNegativeInteger / isValidPositiveInteger) + 한국어 message convention 은
// import-chunk-reassembly-order.ts 를 mirror 한다. validateImportChunkReassemblyOrder 는 재호출하지 않는다.
import { ImportChunkDescriptor } from "./import-chunk-reassembly-order";

// buildImportChunkRetransmitRequest 입력 — plain object. receivedChunks 는 현재까지 수신된 chunk 디스크립터
// 배열(비-음수 index·offset, 양의 size), expectedTotalChunks 는 완전 시퀀스의 총 chunk 수(= 정상 index
// 범위 0..expectedTotalChunks-1, 비-음수 정수), expectedChunkSizeBytes 는 아직 수신 안 된 chunk 의 byte
// 크기 추정에 쓸 chunk 당 표준 byte 크기(양의 정수 ≥ 1)이다.
export interface ImportChunkRetransmitRequestInput {
  receivedChunks: ImportChunkDescriptor[];
  expectedTotalChunks: number;
  expectedChunkSizeBytes: number;
}

// 인접(연속)한 누락 index 를 묶은 재업로드 요청 run — plain object. firstIndex 는 run 첫 누락 index,
// lastIndex 는 run 마지막 누락 index(inclusive), chunkCount 는 이 run 의 연속 누락 chunk 수
// (= lastIndex - firstIndex + 1)이다. 후속 import controller / WebUI 가 "index {firstIndex}..{lastIndex}
// 를 다시 업로드" 안내를 이 run 에서 직렬화한다(직렬화는 본 helper 밖 — repository 게이트).
export interface ImportChunkRetransmitRun {
  firstIndex: number;
  lastIndex: number;
  chunkCount: number;
}

// 누락 chunk 재업로드 요청 plan 모델 — plain object. retransmitNeeded 는 누락 index 가 1개 이상인가,
// receivedChunkCount 는 서로 다른 수신 index 수, expectedTotalChunks 는 입력 echo, missingIndexes 는
// 0..expectedTotalChunks-1 중 수신 안 된 index 오름차순, missingChunkCount 는 = missingIndexes.length,
// runs 는 인접 누락 index 를 묶은 요청 run 배열(firstIndex 오름차순; 누락 0 이면 빈 배열), runCount 는
// = runs.length(= 클라이언트에 보낼 재업로드 요청 개수), estimatedRetransmitBytes 는
// = missingChunkCount × expectedChunkSizeBytes(다시 받아야 할 byte 추정), headline 은 한국어 한 줄 요약
// (누락 chunk 수·요청 run 수·재수신 byte 추정)이다. 후속 import controller / WebUI 재업로드 요청 안내가
// 이 모델을 그대로 사용한다.
export interface ImportChunkRetransmitRequest {
  retransmitNeeded: boolean;
  receivedChunkCount: number;
  expectedTotalChunks: number;
  missingIndexes: number[];
  missingChunkCount: number;
  runs: ImportChunkRetransmitRun[];
  runCount: number;
  estimatedRetransmitBytes: number;
  headline: string;
}

// plain object(null/배열/비-object 아님) 판정 — input/chunk 입력 방어에 쓴다
// (import-chunk-reassembly-order.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// value 가 null/배열/비-object 일 때의 사람-친화 type label — 입력 방어 메시지에 쓴다
// (import-chunk-reassembly-order.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === null
    ? "null"
    : Array.isArray(value)
      ? "array"
      : typeof value;
}

// 값이 유효한 비-음수 유한 정수(0 허용)인지 판정 — NaN/Infinity/소수/음수/비-number 거부
// (import-chunk-reassembly-order.isValidNonNegativeInteger 동형). index/offsetBytes/expectedTotalChunks 검증.
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// 값이 유효한 양의 유한 정수(≥ 1)인지 판정 — 0/음수/NaN/Infinity/소수/비-number 거부.
// sizeBytes/expectedChunkSizeBytes 검증에 쓴다.
function isValidPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

// receivedChunks 의 각 원소가 유효한 ImportChunkDescriptor 인지 검증 — plain object 이고
// index/offsetBytes 가 비-음수정수, sizeBytes 가 양의 정수(≥ 1)여야 한다. 위반 시 부적합 원소
// index·label·받은 값을 박제한 TypeError.
function assertValidDescriptor(chunk: unknown, position: number): void {
  if (!isPlainObject(chunk)) {
    throw new TypeError(
      `buildImportChunkRetransmitRequest: receivedChunks[${position}] 는 plain object 여야 합니다 (받음: ${describeNonObject(
        chunk,
      )})`,
    );
  }
  const index = (chunk as { index: unknown }).index;
  if (!isValidNonNegativeInteger(index)) {
    throw new TypeError(
      `buildImportChunkRetransmitRequest: receivedChunks[${position}].index 는 0 이상의 정수여야 합니다 (받음: ${String(
        index,
      )})`,
    );
  }
  const offsetBytes = (chunk as { offsetBytes: unknown }).offsetBytes;
  if (!isValidNonNegativeInteger(offsetBytes)) {
    throw new TypeError(
      `buildImportChunkRetransmitRequest: receivedChunks[${position}].offsetBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        offsetBytes,
      )})`,
    );
  }
  const sizeBytes = (chunk as { sizeBytes: unknown }).sizeBytes;
  if (!isValidPositiveInteger(sizeBytes)) {
    throw new TypeError(
      `buildImportChunkRetransmitRequest: receivedChunks[${position}].sizeBytes 는 1 이상의 정수여야 합니다 (받음: ${String(
        sizeBytes,
      )})`,
    );
  }
}

// buildImportChunkRetransmitRequest — 현재까지 수신된 chunk 디스크립터 배열에서, 완전 시퀀스
// (0..expectedTotalChunks-1) 중 아직 수신 안 된 index 를 식별해 인접한 연속 누락 index 를 하나의 run 으로
// 묶은 재업로드 요청 plan 을 순수 산술로 산정한다(UC-07 §8 NFR resumable upload 정합).
//
// 산정:
//   - 수신 index 집합 = receivedChunks 의 서로 다른 index(중복 수신은 한 번만 셈). receivedChunkCount =
//     서로 다른 수신 index 수.
//   - missingIndexes = 0..expectedTotalChunks-1 중 수신 index 집합에 없는 index 오름차순. expectedTotalChunks
//     이상의(범위 밖) 수신 index 는 누락 판정에 무영향(0..N-1 범위만 본다).
//   - runs = missingIndexes 를 순회하며 직전 누락 index + 1 === 현재면 같은 run, 아니면 새 run 시작
//     (연속 index 만 병합). 예: 누락 [1,2,3,5] → run [{1,3,3},{5,5,1}].
//   - missingChunkCount = missingIndexes.length, runCount = runs.length.
//   - retransmitNeeded = missingChunkCount > 0.
//   - estimatedRetransmitBytes = missingChunkCount × expectedChunkSizeBytes.
//
// 불변: missingChunkCount === missingIndexes.length, runs 의 chunkCount 합 === missingChunkCount,
// runCount === runs.length, retransmitNeeded ⟺ missingChunkCount > 0 ⟺ runCount > 0, runs 는 firstIndex
// 오름차순·인접 run 끼리 비-연속(사이에 최소 1개 수신 index), 각 run 의 firstIndex ≤ lastIndex,
// estimatedRetransmitBytes === missingChunkCount × expectedChunkSizeBytes, retransmitNeeded=false 이면
// runs=[] && missingIndexes=[] && estimatedRetransmitBytes=0.
//
// 경계: expectedTotalChunks=0(receivedChunks 무관 → retransmitNeeded=false). 전부 수신(0..N-1 전부 cover
// → retransmitNeeded=false). 전부 누락(receivedChunks=[] && N>0 → missingIndexes=[0..N-1]·단일 run).
// 산발 누락(여러 run 분리). 단일/인접 누락. 중복 수신·범위 밖 수신 index 는 missingIndexes 에 무영향.
//
// 입력 receivedChunks 배열·원소를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체·runs
// 배열·각 run 은 항상 새 것. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - input 이 plain object 아님(null/배열/원시값) → TypeError(label "input").
//   - input.receivedChunks 가 배열 아님 → TypeError(label "receivedChunks", 받은 값 박제).
//   - input.receivedChunks[i] 가 plain object 아님 / index·offsetBytes 비-음수정수 아님 / sizeBytes
//     양의정수 아님 → TypeError(원소 index·label·받은 값 박제).
//   - input.expectedTotalChunks 비-음수정수 아님 → TypeError(label·받은 값 박제).
//   - input.expectedChunkSizeBytes 양의정수(≥ 1) 아님 → TypeError(label·받은 값 박제).
export function buildImportChunkRetransmitRequest(
  input: ImportChunkRetransmitRequestInput,
): ImportChunkRetransmitRequest {
  // top-level input 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(input)) {
    throw new TypeError(
      `buildImportChunkRetransmitRequest: input 은 plain object 여야 합니다 (받음: ${describeNonObject(
        input,
      )})`,
    );
  }

  const receivedChunks = (input as { receivedChunks: unknown }).receivedChunks;
  if (!Array.isArray(receivedChunks)) {
    throw new TypeError(
      `buildImportChunkRetransmitRequest: input.receivedChunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        receivedChunks,
      )})`,
    );
  }

  const expectedTotalChunks = (input as { expectedTotalChunks: unknown })
    .expectedTotalChunks;
  if (!isValidNonNegativeInteger(expectedTotalChunks)) {
    throw new TypeError(
      `buildImportChunkRetransmitRequest: input.expectedTotalChunks 는 0 이상의 정수여야 합니다 (받음: ${String(
        expectedTotalChunks,
      )})`,
    );
  }

  const expectedChunkSizeBytes = (input as { expectedChunkSizeBytes: unknown })
    .expectedChunkSizeBytes;
  if (!isValidPositiveInteger(expectedChunkSizeBytes)) {
    throw new TypeError(
      `buildImportChunkRetransmitRequest: input.expectedChunkSizeBytes 는 1 이상의 정수여야 합니다 (받음: ${String(
        expectedChunkSizeBytes,
      )})`,
    );
  }

  // 각 receivedChunks 원소가 유효한 ImportChunkDescriptor 인지 검증.
  for (let i = 0; i < receivedChunks.length; i += 1) {
    assertValidDescriptor(receivedChunks[i], i);
  }

  const typedChunks = receivedChunks as ImportChunkDescriptor[];

  // 서로 다른 수신 index 집합(중복 수신은 한 번만 셈) — 입력 비변형(읽기만).
  const receivedIndexes = new Set<number>();
  for (let i = 0; i < typedChunks.length; i += 1) {
    receivedIndexes.add(typedChunks[i].index);
  }
  const receivedChunkCount = receivedIndexes.size;

  // missingIndexes = 0..expectedTotalChunks-1 중 수신 index 집합에 없는 index 오름차순. 범위 밖(>= N)
  // 수신 index 는 이 루프 범위에 안 들어오므로 누락 판정에 무영향.
  const missingIndexes: number[] = [];
  for (let idx = 0; idx < expectedTotalChunks; idx += 1) {
    if (!receivedIndexes.has(idx)) {
      missingIndexes.push(idx);
    }
  }
  const missingChunkCount = missingIndexes.length;

  // 인접(연속)한 누락 index 를 하나의 run 으로 병합 — 직전 누락 index + 1 === 현재면 같은 run 확장,
  // 아니면 새 run 시작. missingIndexes 가 오름차순이므로 runs 도 firstIndex 오름차순.
  const runs: ImportChunkRetransmitRun[] = [];
  for (let i = 0; i < missingIndexes.length; i += 1) {
    const idx = missingIndexes[i];
    if (i > 0 && missingIndexes[i - 1] + 1 === idx) {
      const current = runs[runs.length - 1];
      current.lastIndex = idx;
      current.chunkCount = current.lastIndex - current.firstIndex + 1;
    } else {
      runs.push({ firstIndex: idx, lastIndex: idx, chunkCount: 1 });
    }
  }
  const runCount = runs.length;

  const retransmitNeeded = missingChunkCount > 0;
  const estimatedRetransmitBytes = missingChunkCount * expectedChunkSizeBytes;

  const headline = retransmitNeeded
    ? `import chunk 재업로드 요청: 누락 ${missingChunkCount}개 chunk 를 ${runCount}개 요청 run 으로 묶음 — 재수신 추정 ${estimatedRetransmitBytes} bytes`
    : `import chunk 재업로드 요청: 누락 chunk 가 없습니다 — 재업로드 불요 (수신 ${receivedChunkCount}개 / 기대 ${expectedTotalChunks}개)`;

  return {
    retransmitNeeded,
    receivedChunkCount,
    expectedTotalChunks,
    missingIndexes,
    missingChunkCount,
    runs,
    runCount,
    estimatedRetransmitBytes,
    headline,
  };
}
