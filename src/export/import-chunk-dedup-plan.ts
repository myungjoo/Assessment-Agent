// import-chunk-dedup-plan — UC-07 §8 NFR resumable upload Import 측 *재전송으로 중복·overlap 된 수신
// chunk 디스크립터에서 재조립용 유지/폐기 집합과 제거 통계를 순수 산술로 산정*하는 helper
// (T-0482, P7 / REQ-030 / REQ-032 / REQ-045). resumable upload 는 업로드가 중단됐다가 재개될 때
// importer 가 이미 받은 chunk 를 클라이언트가 재전송할 수 있어 — 수신된 chunk 디스크립터 배열에는
// 같은 index 가 두 번 이상 나타나거나(중복), 서로 다른 디스크립터가 같은 byte 범위를 부분/완전
// overlap 하는 일이 자연스럽게 발생한다.
//
// 직전 helper 들은 IMPORT 측 수신 chunk 를 (T-0480) 재조립 가능한 완전·연속·무중복·정렬 시퀀스인지
// 검증(go/no-go)하고, (T-0481) 수신 진행 상태(진행률·status·resumeOffset)를 렌더한다. 그러나 둘 다
// 중복/overlap 을 *해소*하지는 않는다: T-0480 은 duplicateIndexes·overlapBytes 를 *탐지만* 하고 어느
// record 를 유지·폐기할지 결정하지 않으며, T-0481 은 진행률만 그린다. 재조립을 실제로 시작하려면 그
// 사이의 책임 — "재전송으로 중복된 수신 record 중 무엇을 유지하고 무엇을 버려 깨끗한 1:1 dedup 집합을
// 만들 것인가, redundant record/byte 가 얼마나 제거됐는가" — 를 산정하는 dedup 계획 helper 가 필요하다.
// 이 도메인은 45 helper(T-0437~T-0481) 중 0 회 cover 된 gap 이다.
//
// download 측 coalesceExportChunkRefetch(재요청 byte 범위 coalesce)의 대칭 IMPORT 측 resolve 이지만
// 방향(보내는 측 재요청 range 병합 vs 받는 측 중복 수신 record dedup)·입력(요청 range vs 수신
// ImportChunkDescriptor[])·출력(coalesce 된 range vs 유지/폐기 record 집합 + 제거 통계)이 직교한다.
// T-0480 validate 와도 직교(완전성/연속성/missingIndexes 판정 0 — 중복 해소 결정만).
//
// 실 업로드 수신·byte slice·실 재조립·HTTP Range/206·resumable upload 프로토콜(tus 등)·digest/checksum·
// 타이머·시계 read 0 — chunk 디스크립터(index·offset·size)는 caller 가 전달하고, 본 helper 는 산술
// dedup 계획만 한다(non-mutating·결정성·DRY). 도메인 타입 ImportChunkDescriptor 는 T-0480 의
// import-chunk-reassembly-order 에서 그대로 import 해 재사용하며(재정의 금지), 입력 방어 골격
// (isPlainObject / describeNonObject / isValidNonNegativeInteger / isValidPositiveInteger) + 한국어
// message convention 은 import-chunk-reassembly-order.ts 를 mirror 한다.
import { ImportChunkDescriptor } from "./import-chunk-reassembly-order";

// planImportChunkDeduplication 입력 — plain object. receivedChunks 는 재개 재전송으로 중복·overlap
// 가능한 수신 chunk 디스크립터 배열(비-음수 index·offset, 양의 size)이다.
export interface ImportChunkDeduplicationInput {
  receivedChunks: ImportChunkDescriptor[];
}

// 수신 chunk 중복 해소 계획 모델 — plain object. receivedChunkCount 는 수신 record 수
// (= receivedChunks.length), keptChunks 는 중복 해소 후 유지할 디스크립터(index 오름차순·각 index 당
// 1 개, 새 배열·원소도 새 객체 복사), keptChunkCount 는 keptChunks.length, discardedChunkCount 는
// receivedChunkCount - keptChunkCount, duplicateIndexes 는 2 회 이상 등장한 index 오름차순·중복제거,
// keptBytes 는 keptChunks 의 sizeBytes 단순 합, redundantBytes 는 폐기된 record 의 sizeBytes 합
// (= 전체 수신 sizeBytes 합 - keptBytes), overlapBytes 는 유지된 keptChunks 를 offset 기준 정렬했을 때
// 인접 chunk 가 겹치는 총 byte(중복 index 폐기 후에도 서로 다른 index 가 byte 범위를 겹칠 수 있음),
// hasDuplicates 는 duplicateIndexes.length > 0, headline 은 한국어 한 줄 요약이다. 후속 import
// controller / WebUI 업로드 dedup 안내가 그대로 사용한다.
export interface ImportChunkDeduplicationPlan {
  receivedChunkCount: number;
  keptChunks: ImportChunkDescriptor[];
  keptChunkCount: number;
  discardedChunkCount: number;
  duplicateIndexes: number[];
  keptBytes: number;
  redundantBytes: number;
  overlapBytes: number;
  hasDuplicates: boolean;
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

// receivedChunks 의 각 원소가 유효한 ImportChunkDescriptor 인지 검증 — plain object 이고
// index/offsetBytes 가 비-음수정수, sizeBytes 가 양의 정수(≥ 1)여야 한다. 위반 시 부적합 원소
// index·label·받은 값을 박제한 TypeError.
function assertValidDescriptor(chunk: unknown, position: number): void {
  if (!isPlainObject(chunk)) {
    throw new TypeError(
      `planImportChunkDeduplication: receivedChunks[${position}] 는 plain object 여야 합니다 (받음: ${describeNonObject(
        chunk,
      )})`,
    );
  }
  const index = (chunk as { index: unknown }).index;
  if (!isValidNonNegativeInteger(index)) {
    throw new TypeError(
      `planImportChunkDeduplication: receivedChunks[${position}].index 는 0 이상의 정수여야 합니다 (받음: ${String(
        index,
      )})`,
    );
  }
  const offsetBytes = (chunk as { offsetBytes: unknown }).offsetBytes;
  if (!isValidNonNegativeInteger(offsetBytes)) {
    throw new TypeError(
      `planImportChunkDeduplication: receivedChunks[${position}].offsetBytes 는 0 이상의 정수여야 합니다 (받음: ${String(
        offsetBytes,
      )})`,
    );
  }
  const sizeBytes = (chunk as { sizeBytes: unknown }).sizeBytes;
  if (!isValidPositiveInteger(sizeBytes)) {
    throw new TypeError(
      `planImportChunkDeduplication: receivedChunks[${position}].sizeBytes 는 1 이상의 정수여야 합니다 (받음: ${String(
        sizeBytes,
      )})`,
    );
  }
}

// planImportChunkDeduplication — 재개 재전송으로 중복·overlap 된 수신 chunk 디스크립터 배열에서
// 재조립용 유지(keptChunks)/폐기 집합과 제거 통계를 순수 산술로 산정한다(UC-07 §8 NFR 정합).
// 입력 receivedChunks 를 (원본 비변형) 처리해 위 필드를 derive 한다.
//
// dedup 규칙: 같은 index 가 여러 번 등장하면 *첫 등장(입력 순서상 먼저 나온) 디스크립터를 유지하고
// 나머지를 폐기*(결정적 tie-break — 입력 순서 안정). 단 같은 index 의 재전송은 동일 byte 범위여야
// 하므로, 같은 index 가 중복되되 offsetBytes/sizeBytes 가 서로 다른 경우(모순된 재전송)는 dedup
// 불가능한 입력으로 보고 TypeError 로 거부한다.
//
// 산정:
//   - receivedChunkCount = receivedChunks.length.
//   - keptChunks = 각 index 의 첫 등장 디스크립터를 index 오름차순으로 정렬한 새 배열(원소도 새 객체).
//   - keptChunkCount = keptChunks.length(= 서로 다른 index 의 수).
//   - discardedChunkCount = receivedChunkCount - keptChunkCount.
//   - duplicateIndexes = 2 회 이상 등장한 index 오름차순·중복제거.
//   - keptBytes = Σ keptChunks.sizeBytes, redundantBytes = 전체 수신 Σ sizeBytes - keptBytes.
//   - overlapBytes = keptChunks 를 offsetBytes 기준 정렬 후 인접 [prev.offset, prev.offset+prev.size)
//     와 [cur.offset, cur.offset+cur.size) 의 겹침 합.
//   - hasDuplicates = duplicateIndexes.length > 0.
//
// 불변: keptChunkCount + discardedChunkCount === receivedChunkCount, keptChunkCount === 서로 다른
// index 의 수, redundantBytes >= 0, keptBytes + redundantBytes === 전체 수신 Σ sizeBytes,
// overlapBytes >= 0, hasDuplicates ⟺ duplicateIndexes.length > 0 ⟺ discardedChunkCount > 0,
// keptChunks 는 index 오름차순·중복 index 0.
//
// 경계: 빈 receivedChunks(모든 수치 0·hasDuplicates=false). 중복 0(keptChunkCount===receivedChunkCount).
// 단일 index 동일 디스크립터 3 회(keptChunkCount=1·discardedChunkCount=2·redundantBytes=2*size). 뒤섞인
// 순서 입력의 정렬된 keptChunks. 서로 다른 index 의 byte overlap(중복 0·overlapBytes>0). 중복+overlap 동시.
//
// 입력 receivedChunks 배열·원소를 변형하지 않으며(non-mutating — freeze 된 입력 통과), 반환 객체·배열·
// 원소는 항상 새 것. 동일 입력 2 회 호출은 동등 결과(순수·결정성). 입력 방어:
//   - input 이 plain object 아님(null/배열/원시값) → TypeError(label "input").
//   - input.receivedChunks 가 배열 아님 → TypeError(label "receivedChunks", 받은 값 박제).
//   - input.receivedChunks[i] 가 plain object 아님 / index·offsetBytes 비-음수정수 아님 / sizeBytes
//     양의정수 아님 → TypeError(원소 index·label·받은 값 박제).
//   - 같은 index 가 중복되되 offsetBytes/sizeBytes 가 서로 다름(모순된 재전송) → TypeError(label
//     "receivedChunks"·해당 index 박제).
export function planImportChunkDeduplication(
  input: ImportChunkDeduplicationInput,
): ImportChunkDeduplicationPlan {
  // top-level input 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(input)) {
    throw new TypeError(
      `planImportChunkDeduplication: input 은 plain object 여야 합니다 (받음: ${describeNonObject(
        input,
      )})`,
    );
  }

  const receivedChunks = (input as { receivedChunks: unknown }).receivedChunks;
  if (!Array.isArray(receivedChunks)) {
    throw new TypeError(
      `planImportChunkDeduplication: input.receivedChunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        receivedChunks,
      )})`,
    );
  }

  // 각 receivedChunks 원소가 유효한 ImportChunkDescriptor 인지 검증.
  for (let i = 0; i < receivedChunks.length; i += 1) {
    assertValidDescriptor(receivedChunks[i], i);
  }

  const typedChunks = receivedChunks as ImportChunkDescriptor[];
  const receivedChunkCount = typedChunks.length;

  // 각 index 의 첫 등장 디스크립터를 유지(tie-break — 입력 순서 안정). 같은 index 의 재전송은 동일
  // byte 범위여야 하므로, 후속 등장이 첫 등장과 offset/size 가 다르면 모순된 재전송으로 거부한다.
  // 또한 등장 횟수를 누적해 duplicateIndexes / redundantBytes 를 산정한다.
  const firstSeen = new Map<number, ImportChunkDescriptor>();
  const indexCounts = new Map<number, number>();
  let totalReceivedBytes = 0;
  for (let i = 0; i < typedChunks.length; i += 1) {
    const chunk = typedChunks[i];
    totalReceivedBytes += chunk.sizeBytes;
    const existing = firstSeen.get(chunk.index);
    if (existing === undefined) {
      firstSeen.set(chunk.index, chunk);
    } else if (
      existing.offsetBytes !== chunk.offsetBytes ||
      existing.sizeBytes !== chunk.sizeBytes
    ) {
      throw new TypeError(
        `planImportChunkDeduplication: receivedChunks 의 index ${chunk.index} 가 서로 다른 byte 범위로 중복 수신됐습니다 — 같은 chunk 의 재전송은 동일 offset/size 여야 합니다 (모순된 재전송: offsetBytes ${existing.offsetBytes}→${chunk.offsetBytes}, sizeBytes ${existing.sizeBytes}→${chunk.sizeBytes})`,
      );
    }
    indexCounts.set(chunk.index, (indexCounts.get(chunk.index) ?? 0) + 1);
  }

  // keptChunks = 첫 등장 디스크립터를 index 오름차순 정렬한 새 배열(원소도 새 객체 복사 — 입력 비공유).
  const keptChunks: ImportChunkDescriptor[] = Array.from(firstSeen.values())
    .map((chunk) => ({
      index: chunk.index,
      offsetBytes: chunk.offsetBytes,
      sizeBytes: chunk.sizeBytes,
    }))
    .sort((a, b) => a.index - b.index);
  const keptChunkCount = keptChunks.length;
  const discardedChunkCount = receivedChunkCount - keptChunkCount;

  // duplicateIndexes = 2 회 이상 등장한 index 오름차순·중복제거.
  const duplicateIndexes: number[] = [];
  for (const [index, count] of indexCounts) {
    if (count >= 2) {
      duplicateIndexes.push(index);
    }
  }
  duplicateIndexes.sort((a, b) => a - b);

  // keptBytes = 유지 record sizeBytes 합, redundantBytes = 폐기된 record sizeBytes 합.
  const keptBytes = keptChunks.reduce((sum, chunk) => sum + chunk.sizeBytes, 0);
  const redundantBytes = totalReceivedBytes - keptBytes;

  // overlapBytes = keptChunks 를 offsetBytes 기준 정렬 후 인접 byte 범위 겹침 합(중복 index 폐기
  // 후에도 서로 다른 index 가 범위를 겹칠 수 있음). 정렬은 별도 복사본에서 — keptChunks 는 index
  // 오름차순 유지.
  const byOffset = keptChunks
    .slice()
    .sort((a, b) => a.offsetBytes - b.offsetBytes);
  let overlapBytes = 0;
  for (let i = 1; i < byOffset.length; i += 1) {
    const prev = byOffset[i - 1];
    const cur = byOffset[i];
    const prevEnd = prev.offsetBytes + prev.sizeBytes;
    const overlap = prevEnd - cur.offsetBytes;
    if (overlap > 0) {
      overlapBytes += overlap;
    }
  }

  const hasDuplicates = duplicateIndexes.length > 0;

  const headline = hasDuplicates
    ? `import chunk dedup: 수신 ${receivedChunkCount}개 중 ${keptChunkCount}개 유지·${discardedChunkCount}개 폐기(중복 index ${duplicateIndexes.length}개·redundant ${redundantBytes} bytes 제거)`
    : `import chunk dedup: 수신 ${receivedChunkCount}개 전부 유일 index — 폐기 0개·redundant 0 bytes(중복 없음)`;

  return {
    receivedChunkCount,
    keptChunks,
    keptChunkCount,
    discardedChunkCount,
    duplicateIndexes,
    keptBytes,
    redundantBytes,
    overlapBytes,
    hasDuplicates,
    headline,
  };
}
