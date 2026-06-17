// import-chunk-upload-progress — UC-07 §8 NFR resumable upload Import 측 *수신* chunk 디스크립터들로부터
// 업로드 진행 상태(진행률·status taxonomy·resume offset)를 렌더하는 순수 helper (T-0481, P7 / REQ-030 /
// REQ-032 / REQ-045). 지금까지의 chunked-streaming helper(T-0437~T-0480, 44개)는 거의 전부 Export 측
// (다운로드)이며, 그중 describeExportChunkStreamProgress(T-0470)는 다운로드 *전송 진행 상태*(전달
// chunk·전송 byte·진행률·현재 content-range)를 렌더한다. 직전 validateImportChunkReassemblyOrder(T-0480)는
// IMPORT 측으로 pivot 해 수신 chunk 가 재조립 가능한 완전 시퀀스인지를 *검증(go/no-go)* 했다.
//
// 그러나 resumable upload 에는 검증과 별개로 *수신 진행 상태(upload progress) 렌더* 책임이 있다: importer 가
// dump 를 여러 chunk 로 나눠 업로드받는 동안, WebUI/status-polling 은 "지금까지 몇 개 chunk·몇 byte
// 수신됐고·진행률 몇 %·현재 상태가 미시작/업로드중/지연-미완/완료 중 무엇이며·업로드를 재개한다면 어느
// offset 부터인가" 를 표시해야 한다. 이 업로드 진행 view 는 다운로드 측 describeExportChunkStreamProgress 의
// 대칭 책임이지만 IMPORT 측에서는 44 helper 중 0 회 cover 된 gap 이다.
//
// 본 helper 는 T-0480 의 *검증* 과 직교한다: T-0480 은 시퀀스가 완전·연속·무중복·정렬인지를 boolean 으로
// 판정하고, 본 helper 는 수신된 chunk 들로부터 사람-친화 진행 상태(percentComplete·status taxonomy·
// resumeOffset)를 렌더한다. validateImportChunkReassemblyOrder 재호출·완전성 boolean 판정·missing/
// duplicate index 도출은 하지 않으며(진행 렌더만), resumeOffset 산정에 필요한 연속 구간 추적만 자체 단일
// 패스로 수행한다.
//
// 실 업로드 수신·byte slice·HTTP Range/206·multipart/resumable upload 프로토콜·타이머·시계 read 0 —
// chunk 디스크립터(index·offset·size)와 기대 수치(expectedTotalBytes·expectedChunkCount)는 caller 가
// 전달하고, 본 helper 는 산술 렌더만 한다(non-mutating·결정성·DRY). "stalled" 는 시간 경과가 아니라
// *시퀀스 gap* 기반 판정 — 시계 read 0. 도메인 타입 ImportChunkDescriptor 는 import-chunk-reassembly-
// order.ts(T-0480)에서 그대로 import 해 재사용한다(DRY — 재정의 금지). 입력 방어 골격(isPlainObject /
// describeNonObject / isValidNonNegativeInteger / isValidPositiveInteger) + 한국어 message convention 은
// import-chunk-reassembly-order.ts 를 mirror 한다.
import { ImportChunkDescriptor } from "./import-chunk-reassembly-order";

// 업로드 진행 상태 taxonomy(문자열 union) — not-started(수신 chunk 0), uploading(일부 연속 수신·미완),
// stalled-incomplete(수신은 있으나 시퀀스 gap 으로 연속 구간이 끊겨 멈춘 미완), complete(전 chunk·전 byte
// 수신). 별도 enum 객체는 신설하지 않는다.
export type ImportChunkUploadStatus =
  | "not-started"
  | "uploading"
  | "stalled-incomplete"
  | "complete";

// describeImportChunkUploadProgress 입력 — plain object. receivedChunks 는 지금까지 수신된 chunk
// 디스크립터 배열(비-음수 index·offset, 양의 size), expectedTotalBytes 는 완전 dump 의 총 byte(비-음수
// 정수), expectedChunkCount 는 완전 dump 의 총 chunk 수(비-음수 정수)이다.
export interface ImportChunkUploadProgressInput {
  receivedChunks: ImportChunkDescriptor[];
  expectedTotalBytes: number;
  expectedChunkCount: number;
}

// 업로드 수신 진행 상태 모델 — plain object. receivedChunkCount 는 수신 chunk 수(= receivedChunks.length),
// expectedChunkCount 는 입력 echo, remainingChunkCount 는 잔여(= max(0, expectedChunkCount -
// receivedChunkCount)), receivedBytes 는 수신 chunk 의 sizeBytes 단순 합, expectedTotalBytes 는 입력 echo,
// remainingBytes 는 잔여 byte(= max(0, expectedTotalBytes - receivedBytes)), percentComplete 는 진행률
// (0~100 정수, expectedTotalBytes 0 이면 100), complete 는 전 chunk·전 byte 수신 여부, status 는 진행
// taxonomy, resumeOffset 은 업로드 재개 시 다음에 받아야 할 byte offset(정렬된 수신 chunk 를 offset 0 부터
// 끊김 없이 따라갔을 때 첫 끊김/끝 offset — 완전하면 expectedTotalBytes, 미시작이면 0), headline 은 한국어
// 한 줄 요약이다. 후속 import controller / WebUI 업로드 진행 표시(UC-07 §5 step 13)가 그대로 사용한다.
// 불변: receivedBytes >= expectedTotalBytes ⟹ remainingBytes === 0, 0 <= percentComplete <= 100,
// complete ⟺ status === "complete", receivedChunkCount === 0 ⟺ status === "not-started",
// 0 <= resumeOffset <= expectedTotalBytes, complete ⟹ (resumeOffset === expectedTotalBytes &&
// percentComplete === 100).
export interface ImportChunkUploadProgress {
  receivedChunkCount: number;
  expectedChunkCount: number;
  remainingChunkCount: number;
  receivedBytes: number;
  expectedTotalBytes: number;
  remainingBytes: number;
  percentComplete: number;
  complete: boolean;
  status: ImportChunkUploadStatus;
  resumeOffset: number;
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
// (import-chunk-reassembly-order.isValidNonNegativeInteger 동형).
function isValidNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// 값이 유효한 양의 유한 정수(≥ 1)인지 판정 — 0/음수/NaN/Infinity/소수/비-number 거부
// (import-chunk-reassembly-order.isValidPositiveInteger 동형).
function isValidPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

// receivedChunks 의 각 원소가 유효한 ImportChunkDescriptor 인지 검증 — plain object 이고 index/offsetBytes
// 가 비-음수정수, sizeBytes 가 양의 정수(≥ 1)여야 한다. 위반 시 부적합 원소 index·label·받은 값을 박제한
// TypeError.
function assertValidDescriptor(chunk: unknown, position: number): void {
  if (!isPlainObject(chunk)) {
    throw new TypeError(
      `describeImportChunkUploadProgress: receivedChunks[${position}] 는 plain object 여야 합니다 (받음: ${describeNonObject(
        chunk,
      )})`,
    );
  }
  const index = (chunk as { index: unknown }).index;
  if (!isValidNonNegativeInteger(index)) {
    throw new TypeError(
      `describeImportChunkUploadProgress: receivedChunks[${position}].index 는 0 이상의 정수여야 합니다 (받음: ${String(
        index,
      )})`,
    );
  }
  const offsetBytes = (chunk as { offsetBytes: unknown }).offsetBytes;
  if (!isValidNonNegativeInteger(offsetBytes)) {
    throw new TypeError(
      `describeImportChunkUploadProgress: receivedChunks[${position}].offsetBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        offsetBytes,
      )})`,
    );
  }
  const sizeBytes = (chunk as { sizeBytes: unknown }).sizeBytes;
  if (!isValidPositiveInteger(sizeBytes)) {
    throw new TypeError(
      `describeImportChunkUploadProgress: receivedChunks[${position}].sizeBytes 는 1 이상의 정수여야 합니다 (받음: ${String(
        sizeBytes,
      )})`,
    );
  }
}

// describeImportChunkUploadProgress — 수신된 chunk 디스크립터 배열과 기대 수치로부터 업로드 진행 상태를
// 순수 산술로 산정한다(UC-07 §8 NFR resumable upload 정합). receivedChunks 를 (원본 비변형) offset 기준
// 정렬한 복사본으로 위 필드를 단일 패스로 derive 한다.
//
// 산정:
//   - receivedChunkCount = receivedChunks.length, receivedBytes = Σ sizeBytes(단순 합).
//   - remainingChunkCount = max(0, expectedChunkCount - receivedChunkCount).
//   - remainingBytes = max(0, expectedTotalBytes - receivedBytes).
//   - percentComplete = expectedTotalBytes === 0 ? 100 : min(100, round((receivedBytes/expectedTotalBytes)*100)).
//   - resumeOffset = 정렬된 수신 chunk 를 offset 0 부터 끊김 없이 따라갔을 때 첫 끊김/끝 offset(완전하면
//     expectedTotalBytes, 미시작이면 0).
//   - complete = (receivedChunkCount === expectedChunkCount && receivedBytes === expectedTotalBytes &&
//     expectedChunkCount > 0); expectedChunkCount === 0 이면 complete = true.
//   - status taxonomy: receivedChunkCount === 0 → "not-started"; complete → "complete"; resumeOffset 이
//     receivedBytes 만큼 끊김 없이 전진했으면(연속 수신·미완) → "uploading"; 연속 구간이 receivedBytes
//     보다 앞서 멈춤(시퀀스 gap 으로 끊긴 미완) → "stalled-incomplete".
//
// 경계: 빈 receivedChunks(status "not-started"·receivedChunkCount 0·receivedBytes 0·percentComplete 0·
// resumeOffset 0·complete false; 단 expectedChunkCount 0 이면 complete true·status "complete"·
// percentComplete 100). 단일 chunk 완전 수신(complete true·resumeOffset expectedTotalBytes·100%). 부분
// 연속 수신("uploading"·resumeOffset 수신끝·100% 미만). gap 으로 인한 stalled("stalled-incomplete"·
// resumeOffset 첫 gap 에서 멈춤). 입력 뒤섞였으나 정렬 후 완전("complete").
//
// 입력 receivedChunks 배열·원소를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체는 항상
// 새 것. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - input 이 plain object 아님(null/배열/원시값) → TypeError(label "input").
//   - input.receivedChunks 가 배열 아님 → TypeError(label "receivedChunks", 받은 값 박제).
//   - input.receivedChunks[i] 가 plain object 아님 / index·offsetBytes 비-음수정수 아님 / sizeBytes
//     양의정수 아님 → TypeError(원소 index·label·받은 값 박제).
//   - input.expectedTotalBytes / input.expectedChunkCount 비-음수정수 아님 → TypeError(label·받은 값 박제).
export function describeImportChunkUploadProgress(
  input: ImportChunkUploadProgressInput,
): ImportChunkUploadProgress {
  // top-level input 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(input)) {
    throw new TypeError(
      `describeImportChunkUploadProgress: input 은 plain object 여야 합니다 (받음: ${describeNonObject(
        input,
      )})`,
    );
  }

  const receivedChunks = (input as { receivedChunks: unknown }).receivedChunks;
  if (!Array.isArray(receivedChunks)) {
    throw new TypeError(
      `describeImportChunkUploadProgress: input.receivedChunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        receivedChunks,
      )})`,
    );
  }

  const expectedTotalBytes = (input as { expectedTotalBytes: unknown })
    .expectedTotalBytes;
  if (!isValidNonNegativeInteger(expectedTotalBytes)) {
    throw new TypeError(
      `describeImportChunkUploadProgress: input.expectedTotalBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        expectedTotalBytes,
      )})`,
    );
  }

  const expectedChunkCount = (input as { expectedChunkCount: unknown })
    .expectedChunkCount;
  if (!isValidNonNegativeInteger(expectedChunkCount)) {
    throw new TypeError(
      `describeImportChunkUploadProgress: input.expectedChunkCount 는 0 이상의 정수여야 합니다 (받음: ${String(
        expectedChunkCount,
      )})`,
    );
  }

  // 각 receivedChunks 원소가 유효한 ImportChunkDescriptor 인지 검증.
  for (let i = 0; i < receivedChunks.length; i += 1) {
    assertValidDescriptor(receivedChunks[i], i);
  }

  const typedChunks = receivedChunks as ImportChunkDescriptor[];
  const receivedChunkCount = typedChunks.length;

  // receivedBytes = 단순 sizeBytes 합.
  let receivedBytes = 0;
  for (let i = 0; i < typedChunks.length; i += 1) {
    receivedBytes += typedChunks[i].sizeBytes;
  }

  const remainingChunkCount = Math.max(
    0,
    expectedChunkCount - receivedChunkCount,
  );
  const remainingBytes = Math.max(0, expectedTotalBytes - receivedBytes);

  // 정렬한 복사본(원본 비변형)으로 연속 구간 추적 — resumeOffset 은 offset 0 부터 끊김 없이 이어지는
  // 동안만 전진하고 첫 끊김(시작 offset != 0 또는 gap)에서 멈춘다. 끝까지 끊김 없으면 마지막 chunk 끝.
  const sorted = typedChunks
    .slice()
    .sort((a, b) => a.offsetBytes - b.offsetBytes);

  let resumeOffset = 0;
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].offsetBytes === resumeOffset) {
      resumeOffset = sorted[i].offsetBytes + sorted[i].sizeBytes;
    } else {
      // 첫 끊김(시작 offset != 0 또는 gap) — 연속 구간 종료, 이후 chunk 는 전진에 기여하지 않음.
      break;
    }
  }
  // resumeOffset 은 expectedTotalBytes 로 clamp(초과 수신이어도 재개 offset 은 끝을 넘지 않음).
  resumeOffset = Math.min(resumeOffset, expectedTotalBytes);

  // 진행률 — expectedTotalBytes 0 이면 100, 그 외 byte 비율 반올림 후 100 으로 clamp(초과 수신 방어).
  const percentComplete =
    expectedTotalBytes === 0
      ? 100
      : Math.min(100, Math.round((receivedBytes / expectedTotalBytes) * 100));

  // complete — 전 chunk·전 byte 수신(expectedChunkCount > 0); 기대가 0 chunk 면 빈 dump 로 완료 간주.
  const complete =
    expectedChunkCount === 0 ||
    (receivedChunkCount === expectedChunkCount &&
      receivedBytes === expectedTotalBytes &&
      expectedChunkCount > 0);

  // status taxonomy — 미시작 / 완료 / 연속 수신중(uploading) / gap 으로 끊긴 미완(stalled-incomplete).
  let status: ImportChunkUploadStatus;
  if (complete) {
    status = "complete";
  } else if (receivedChunkCount === 0) {
    status = "not-started";
  } else if (resumeOffset === receivedBytes) {
    // 연속 구간이 receivedBytes 만큼(첫 chunk offset 0 부터 끊김 없이) 전진 — 연속 수신중.
    status = "uploading";
  } else {
    // 연속 구간이 receivedBytes 보다 앞서 멈춤 — 시퀀스 gap 으로 끊긴 미완.
    status = "stalled-incomplete";
  }

  const headline = complete
    ? expectedChunkCount === 0
      ? `업로드 진행: 수신할 chunk 가 없습니다 (0/0 chunk, 100%, 완료)`
      : `업로드 진행: 전체 ${expectedChunkCount}개 chunk(${expectedTotalBytes} B) 수신 완료 (100%)`
    : status === "not-started"
      ? `업로드 진행: 아직 수신된 chunk 가 없습니다 (0/${expectedChunkCount} chunk, 0%, 미시작)`
      : `업로드 진행: ${expectedChunkCount}개 중 ${receivedChunkCount}개 chunk 수신, ${receivedBytes}/${expectedTotalBytes} B (${percentComplete}%), ${
          status === "stalled-incomplete" ? "gap 으로 정체" : "수신중"
        }, 재개 offset ${resumeOffset}`;

  return {
    receivedChunkCount,
    expectedChunkCount,
    remainingChunkCount,
    receivedBytes,
    expectedTotalBytes,
    remainingBytes,
    percentComplete,
    complete,
    status,
    resumeOffset,
    headline,
  };
}
