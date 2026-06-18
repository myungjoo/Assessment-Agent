// export-dump-refetch-slice — UC-07 Export dump 다운로드 의 *재요청(refetch) materialization* 순수
// helper (T-0512, P7 R-57 / REQ-030 / REQ-032). 머지된 ADR-0046 (b718bb8) Decision §1 "기존 chunk
// helper 와의 맞물림" 절 (iv) 은 "reconcileExportChunkIntegrity 의 refetchRanges 가 손상 chunk
// 재요청 시 materialization 이 다시 slice 할 경계를 지시한다" 를 박제했다 — 수신측이 chunk 별
// 무결성 검사에서 *비연속(non-contiguous) 손상*(예: chunk 0·2 통과, chunk 1·4 손상)을 발견했을
// 때, 그 손상 chunk 들만 골라 다시 materialize 해 재요청에 응답하는 piece. 직전 chain step 들은
// (i) sliceMaterializedDumpByChunkPlan(T-0507) 로 전체 chunk 를 byte slice 하고, (ii)
// serializeExportDownloadHeaders(T-0510) 로 Content-Range 헤더를 직렬화했으며, (iii)
// selectRemainingMaterializedDumpChunks(T-0511) 가 *연속 forward resume* 측 subset 을 골라냈지만,
// (iv) refetch(비연속 손상) 측 — "이미 materialize 된 전체 chunk 배열에서 손상 chunk 들만
// 골라낸다" — 는 비어 있었다(git grep selectRefetchMaterialized src/export/ → 0 매칭).
//
// (iii) resume 와 (iv) refetch 는 직교(orthogonal) 다 — buildExportChunkResumePlan 은 *연속* ack
// 경계 기준 forward resume(어느 byte 부터 이어 보낼지)이지만, reconcileExportChunkIntegrity(T-0472)
// 는 *임의(비연속)* chunk 집합의 무결성 실패를 받아 *그 chunk 들만* 골라 재요청 plan 을 derive
// 한다. reconcileExportChunkIntegrity 는 ExportChunkIntegrityReconcile{allIntact, failedChunks:
// ExportChunk[], failedChunkCount, refetchRanges, refetchBytes, ...} 으로 *재요청 지시*(어느 chunk
// 가 손상됐는지)를 순수 산술로 derive 하지만 chunk 경계 메타만 들고 실 byte 는 없다. 반대로
// sliceMaterializedDumpByChunkPlan 산출 MaterializedExportDumpChunk[] 은 실 byte(bytes: Buffer)를
// 들지만 전체 chunk 다. 본 helper 가 그 둘을 잇는다 — reconcile 결과의 failedChunks 가 지목한
// index 의 materialized chunk subset 만 (원래 byte 보존하며) 골라 반환한다. reconcile 재산정
// 0(T-0472 산출값만 소비 — single-source, ADR-0046 §Decision 3), byte slice 재계산 0(T-0507 산출
// chunk 의 bytes 그대로 독립 복사). controller/service/HTTP 206 Partial Content / Range 재요청
// 배선은 §Out of Scope(후속 task). 새 도메인 타입 신설 0(MaterializedExportDumpChunk 는
// ./export-dump-chunk-slice, ExportChunkIntegrityReconcile 은 ./export-chunk-integrity-reconcile
// import), 새 외부 dependency 0(Node 내장 Buffer 만). 코드 골격은 sibling helper(T-0511/T-0472)의
// isPlainObject / describeNonObject 입력 방어 + 한국어 TypeError/RangeError + non-mutating +
// Buffer.from alias 0 패턴을 mirror 한다.
import { ExportChunkIntegrityReconcile } from "./export-chunk-integrity-reconcile";
import { MaterializedExportDumpChunk } from "./export-dump-chunk-slice";

// plain object(null/배열/비-object 아님) 판정 — reconcile / 각 materialized element 입력 방어에
// 쓴다(export-dump-resume-slice.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 비-plain-object 값의 사람-친화 type label — 입력 방어 메시지에 어떤 잘못된 입력이 왔는지 담는다
// (export-dump-resume-slice.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === undefined
    ? "undefined"
    : value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;
}

// selectRefetchMaterializedDumpChunks — 이미 materialize 된 MaterializedExportDumpChunk[] 와
// ExportChunkIntegrityReconcile 을 받아, reconcile 의 failedChunks 가 지목한 index 의 materialized
// chunk subset 만 원래 순서(index 오름차순 — failedChunks 가 이미 index 오름차순)로 반환한다.
// ADR-0046 §Decision 1 맞물림 (iv) 정합:
//   (a) reconcile.allIntact === true(손상 chunk 0 — failedChunkCount 0 · failedChunks []) → 빈 배열
//       [] 반환(재요청할 chunk 0 — 정상, throw 0).
//   (b) allIntact === false → failedChunks 각 chunk 의 index 에 대응하는 materialized element 를
//       골라 length === failedChunkCount 인 subset 반환.
//   (c) 각 반환 element 의 bytes 는 입력 materialized element 의 bytes 를 Buffer.from(...) 독립
//       복사본으로 담는다(alias 0 — 반환 bytes mutate 가 입력/후속 호출에 영향 0). 메타(index/
//       offsetBytes/sizeBytes/last)는 그대로 복사.
//   (d) reconcile 의 chunk 경계 메타가 대응 materialized element 의 메타와 어긋나면(single-source
//       drift) RangeError — 본 helper 가 경계를 재계산하지 않고 단지 정합을 검증한다.
//
// 입력 materializedChunks / reconcile / 중첩 구조를 변형하지 않으며(non-mutating — freeze 통과),
// 반환 배열·element 는 항상 새 객체(입력 alias 0). 동일 입력 2 회 호출은 동등 결과(결정성). 입력
// 방어(분기 분리 — branch coverage):
//   (a) materializedChunks 가 배열 아님 → TypeError(받은 label 박제).
//   (b) reconcile 이 plain object 아님 → TypeError.
//   (c) reconcile.failedChunks 가 배열 아님 → TypeError.
//   (d) reconcile.failedChunkCount 가 failedChunks.length 와 불일치 → RangeError(reconcile 불변
//       위반).
//   (e) failedChunks 의 어떤 손상 chunk index 에 대응하는 element 가 materializedChunks 에 없음(범위
//       밖 / 누락) → RangeError(받은 index 박제).
//   (f) 대응 materialized element 의 경계 메타(index/offsetBytes/sizeBytes/last)가 reconcile chunk
//       메타와 불일치 → RangeError(불일치 필드·값 박제 — single-source drift 거부).
//   (g) materializedChunks 의 어떤 element 가 shape 위반(plain object 아님 / bytes 가 Buffer 아님)
//       으로 접근 불가 → TypeError.
export function selectRefetchMaterializedDumpChunks(
  materializedChunks: MaterializedExportDumpChunk[],
  reconcile: ExportChunkIntegrityReconcile,
): MaterializedExportDumpChunk[] {
  // materializedChunks 가 배열이 아니면(null/undefined/object/원시값) 순회 불가 — 즉시 throw.
  if (!Array.isArray(materializedChunks)) {
    throw new TypeError(
      `selectRefetchMaterializedDumpChunks: materializedChunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        materializedChunks,
      )})`,
    );
  }

  // reconcile 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(reconcile)) {
    throw new TypeError(
      `selectRefetchMaterializedDumpChunks: reconcile 은 plain object 여야 합니다 (받음: ${describeNonObject(
        reconcile,
      )})`,
    );
  }

  // reconcile.failedChunks 가 배열이 아니면(reconcile shape 위반) 순회 불가 — TypeError.
  const failedChunks = (reconcile as { failedChunks: unknown }).failedChunks;
  if (!Array.isArray(failedChunks)) {
    throw new TypeError(
      `selectRefetchMaterializedDumpChunks: reconcile.failedChunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        failedChunks,
      )})`,
    );
  }

  // failedChunkCount 가 failedChunks.length 와 어긋나면 손상된/조작된 reconcile — 거부
  // (ExportChunkIntegrityReconcile 불변 failedChunks.length === failedChunkCount 위반).
  const failedChunkCount = (reconcile as { failedChunkCount: unknown })
    .failedChunkCount;
  if (failedChunkCount !== failedChunks.length) {
    throw new RangeError(
      `selectRefetchMaterializedDumpChunks: reconcile.failedChunkCount(${String(
        failedChunkCount,
      )})가 failedChunks.length(${failedChunks.length})와 일치하지 않습니다 — 손상된 reconcile`,
    );
  }

  // materialized element 를 index 로 빠르게 찾기 위한 map — element shape(plain object + bytes 가
  // Buffer)를 검증하며 적재한다. 중복 index 가 와도 마지막 것이 남지만 정합 검증(f)이 byte 경계까지
  // 보므로 본 helper 의 정확성에는 영향 없다.
  const byIndex = new Map<number, MaterializedExportDumpChunk>();
  for (let i = 0; i < materializedChunks.length; i += 1) {
    const element = materializedChunks[i];
    if (!isPlainObject(element)) {
      throw new TypeError(
        `selectRefetchMaterializedDumpChunks: materializedChunks[${i}] 는 plain object 여야 합니다 (받음: ${describeNonObject(
          element,
        )})`,
      );
    }
    if (!Buffer.isBuffer((element as { bytes: unknown }).bytes)) {
      throw new TypeError(
        `selectRefetchMaterializedDumpChunks: materializedChunks[${i}].bytes 는 Buffer 여야 합니다 (받음: ${describeNonObject(
          (element as { bytes: unknown }).bytes,
        )})`,
      );
    }
    byIndex.set(
      (element as unknown as MaterializedExportDumpChunk).index,
      element as unknown as MaterializedExportDumpChunk,
    );
  }

  // failedChunks 순서(index 오름차순 — reconcileExportChunkIntegrity 가 plan.chunks filter 로 오름차순
  // 보존)대로 대응 materialized element 를 골라 독립 복사본으로 담는다. allIntact=true 이면
  // failedChunks 가 빈 배열이라 자연히 [] 가 반환된다(별도 분기 불요 — 빈 루프).
  const result: MaterializedExportDumpChunk[] = [];
  for (let i = 0; i < failedChunks.length; i += 1) {
    const failedChunk = failedChunks[i];
    const materialized = byIndex.get(failedChunk.index);

    // reconcile 이 지목한 index 의 materialized element 가 없으면(범위 밖 / 누락) — 재요청 불가.
    if (materialized === undefined) {
      throw new RangeError(
        `selectRefetchMaterializedDumpChunks: reconcile.failedChunks[${i}] 의 index(${String(
          failedChunk.index,
        )})에 대응하는 materialized chunk 가 없습니다`,
      );
    }

    // single-source drift 거부 — reconcile chunk 경계 메타와 materialized element 메타가 어긋나면
    // 본 helper 가 경계를 재계산하지 않고 RangeError 로 거부한다(ADR-0046 §Decision 3).
    if (
      materialized.index !== failedChunk.index ||
      materialized.offsetBytes !== failedChunk.offsetBytes ||
      materialized.sizeBytes !== failedChunk.sizeBytes ||
      materialized.last !== failedChunk.last
    ) {
      throw new RangeError(
        `selectRefetchMaterializedDumpChunks: index ${String(
          failedChunk.index,
        )} chunk 의 경계 메타가 불일치합니다 — reconcile(offset=${String(
          failedChunk.offsetBytes,
        )}, size=${String(failedChunk.sizeBytes)}, last=${String(
          failedChunk.last,
        )}) vs materialized(offset=${materialized.offsetBytes}, size=${materialized.sizeBytes}, last=${materialized.last}) — single-source drift`,
      );
    }

    // 메타는 그대로 복사, bytes 는 Buffer.from(...) 독립 복사본 — alias 0.
    result.push({
      index: materialized.index,
      offsetBytes: materialized.offsetBytes,
      sizeBytes: materialized.sizeBytes,
      last: materialized.last,
      bytes: Buffer.from(materialized.bytes),
    });
  }

  return result;
}
