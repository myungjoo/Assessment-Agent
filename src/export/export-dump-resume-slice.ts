// export-dump-resume-slice — UC-07 Export dump 다운로드 의 *재개(resume) materialization* 순수
// helper (T-0511, P7 R-57 / REQ-030 / REQ-032). 머지된 ADR-0046 (b718bb8) Decision §1 "기존 chunk
// helper 와의 맞물림" 절 (iii) 은 "buildExportChunkResumePlan 의 resumeFromByte/remainingChunks 가
// 재개 시 materialization 의 시작 offset 을 지시한다" 를 박제했다 — 전송이 중단됐다가 재개될 때
// 이미 ack 된 chunk 는 빼고 resume plan 이 지목한 remainingChunks 만 다시 materialize 해 재전송하는
// piece. 직전 chain step 들은 (i) sliceMaterializedDumpByChunkPlan(T-0507) 로 전체 chunk 를 byte
// slice 하고, (ii) serializeExportDownloadHeaders(T-0510) 로 Content-Range 헤더를 직렬화했지만,
// (iii) resume 측 — "이미 materialize 된 전체 chunk 배열에서 remaining chunk 들만 골라낸다" — 는
// 비어 있었다(git grep selectRemainingMaterializedDumpChunk src/export/ → 0 매칭).
//
// 책임 분리: buildExportChunkResumePlan(T-0471)은 ExportChunkResumePlan{resumeNeeded,
// remainingChunks: ExportChunk[], remainingChunkCount, resumeFromByte, ...} 으로 *재개 지시*(어느
// chunk 부터 다시 보낼지)를 순수 산술로 derive 하지만 chunk 경계 메타만 들고 실 byte 는 없다.
// 반대로 sliceMaterializedDumpByChunkPlan 산출 MaterializedExportDumpChunk[] 은 실 byte(bytes:
// Buffer)를 들지만 전체 chunk 다. 본 helper 가 그 둘을 잇는다 — resume plan 이 지목한 index 의
// materialized chunk subset 만 (원래 byte 보존하며) 골라 반환한다. resume plan 재산정 0(T-0471
// 산출값만 소비 — single-source, ADR-0046 §Decision 3), byte slice 재계산 0(T-0507 산출 chunk 의
// bytes 그대로 독립 복사). controller/service/HTTP 206 Partial Content / Range 파싱은 §Out of Scope
// (후속 task). 새 도메인 타입 신설 0(MaterializedExportDumpChunk 는 ./export-dump-chunk-slice,
// ExportChunkResumePlan 은 ./export-chunk-resume-plan, ExportChunk 는 ./export-chunk-plan import),
// 새 외부 dependency 0(Node 내장 Buffer 만). 코드 골격은 sibling helper(T-0507/T-0471)의
// isPlainObject / describeNonObject 입력 방어 + 한국어 TypeError/RangeError + non-mutating +
// Buffer.from alias 0 패턴을 mirror 한다.
import { ExportChunkResumePlan } from "./export-chunk-resume-plan";
import { MaterializedExportDumpChunk } from "./export-dump-chunk-slice";

// plain object(null/배열/비-object 아님) 판정 — resumePlan / 각 materialized element 입력 방어에
// 쓴다(export-dump-chunk-slice.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 비-plain-object 값의 사람-친화 type label — 입력 방어 메시지에 어떤 잘못된 입력이 왔는지 담는다
// (export-dump-chunk-slice.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === undefined
    ? "undefined"
    : value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;
}

// selectRemainingMaterializedDumpChunks — 이미 materialize 된 MaterializedExportDumpChunk[] 와
// ExportChunkResumePlan 을 받아, resume plan 의 remainingChunks 가 지목한 index 의 materialized
// chunk subset 만 원래 순서(index 오름차순)로 반환한다. ADR-0046 §Decision 1 맞물림 (iii) 정합:
//   (a) resumePlan.resumeNeeded === false(전부 ack — remainingChunks []) → 빈 배열 [] 반환(throw 0).
//   (b) resumeNeeded === true → remainingChunks 각 chunk 의 index 에 대응하는 materialized element 를
//       골라 length === remainingChunkCount 인 subset 반환.
//   (c) 각 반환 element 의 bytes 는 입력 materialized element 의 bytes 를 Buffer.from(...) 독립
//       복사본으로 담는다(alias 0 — 반환 bytes mutate 가 입력/후속 호출에 영향 0). 메타(index/
//       offsetBytes/sizeBytes/last)는 그대로 복사.
//   (d) resume plan 의 chunk 경계 메타가 대응 materialized element 의 메타와 어긋나면(single-source
//       drift) RangeError — 본 helper 가 경계를 재계산하지 않고 단지 정합을 검증한다.
//
// 입력 materializedChunks / resumePlan / 중첩 구조를 변형하지 않으며(non-mutating — freeze 통과),
// 반환 배열·element 는 항상 새 객체(입력 alias 0). 동일 입력 2 회 호출은 동등 결과(결정성). 입력
// 방어(분기 분리 — branch coverage):
//   (a) materializedChunks 가 배열 아님 → TypeError(받은 label 박제).
//   (b) resumePlan 이 plain object 아님 → TypeError.
//   (c) resumePlan.remainingChunks 가 배열 아님 → TypeError.
//   (d) resumePlan.remainingChunkCount 가 remainingChunks.length 와 불일치 → RangeError(resume plan
//       불변 위반).
//   (e) remainingChunks 의 어떤 chunk index 에 대응하는 element 가 materializedChunks 에 없음(범위
//       밖 / 누락) → RangeError(받은 index 박제).
//   (f) 대응 materialized element 의 경계 메타(index/offsetBytes/sizeBytes/last)가 resume plan chunk
//       메타와 불일치 → RangeError(불일치 필드·값 박제 — single-source drift 거부).
//   (g) materializedChunks 의 어떤 element 가 shape 위반(plain object 아님 / bytes 가 Buffer 아님)
//       으로 접근 불가 → TypeError.
export function selectRemainingMaterializedDumpChunks(
  materializedChunks: MaterializedExportDumpChunk[],
  resumePlan: ExportChunkResumePlan,
): MaterializedExportDumpChunk[] {
  // materializedChunks 가 배열이 아니면(null/undefined/object/원시값) 순회 불가 — 즉시 throw.
  if (!Array.isArray(materializedChunks)) {
    throw new TypeError(
      `selectRemainingMaterializedDumpChunks: materializedChunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        materializedChunks,
      )})`,
    );
  }

  // resumePlan 이 plain object 가 아니면 하위 필드 접근 불가 — 즉시 throw.
  if (!isPlainObject(resumePlan)) {
    throw new TypeError(
      `selectRemainingMaterializedDumpChunks: resumePlan 은 plain object 여야 합니다 (받음: ${describeNonObject(
        resumePlan,
      )})`,
    );
  }

  // resumePlan.remainingChunks 가 배열이 아니면(plan shape 위반) 순회 불가 — TypeError.
  const remainingChunks = (resumePlan as { remainingChunks: unknown })
    .remainingChunks;
  if (!Array.isArray(remainingChunks)) {
    throw new TypeError(
      `selectRemainingMaterializedDumpChunks: resumePlan.remainingChunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        remainingChunks,
      )})`,
    );
  }

  // remainingChunkCount 가 remainingChunks.length 와 어긋나면 손상된/조작된 resume plan — 거부
  // (ExportChunkResumePlan 불변 remainingChunks.length === remainingChunkCount 위반).
  const remainingChunkCount = (resumePlan as { remainingChunkCount: unknown })
    .remainingChunkCount;
  if (remainingChunkCount !== remainingChunks.length) {
    throw new RangeError(
      `selectRemainingMaterializedDumpChunks: resumePlan.remainingChunkCount(${String(
        remainingChunkCount,
      )})가 remainingChunks.length(${remainingChunks.length})와 일치하지 않습니다 — 손상된 resume plan`,
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
        `selectRemainingMaterializedDumpChunks: materializedChunks[${i}] 는 plain object 여야 합니다 (받음: ${describeNonObject(
          element,
        )})`,
      );
    }
    if (!Buffer.isBuffer((element as { bytes: unknown }).bytes)) {
      throw new TypeError(
        `selectRemainingMaterializedDumpChunks: materializedChunks[${i}].bytes 는 Buffer 여야 합니다 (받음: ${describeNonObject(
          (element as { bytes: unknown }).bytes,
        )})`,
      );
    }
    byIndex.set(
      (element as unknown as MaterializedExportDumpChunk).index,
      element as unknown as MaterializedExportDumpChunk,
    );
  }

  // remainingChunks 순서(index 오름차순 — buildExportChunkResumePlan 이 chunks[ack..] 순서 보존)대로
  // 대응 materialized element 를 골라 독립 복사본으로 담는다. resumeNeeded=false 이면 remainingChunks
  // 가 빈 배열이라 자연히 [] 가 반환된다(별도 분기 불요 — 빈 루프).
  const result: MaterializedExportDumpChunk[] = [];
  for (let i = 0; i < remainingChunks.length; i += 1) {
    const planChunk = remainingChunks[i];
    const materialized = byIndex.get(planChunk.index);

    // resume plan 이 지목한 index 의 materialized element 가 없으면(범위 밖 / 누락) — 재전송 불가.
    if (materialized === undefined) {
      throw new RangeError(
        `selectRemainingMaterializedDumpChunks: resumePlan.remainingChunks[${i}] 의 index(${String(
          planChunk.index,
        )})에 대응하는 materialized chunk 가 없습니다`,
      );
    }

    // single-source drift 거부 — resume plan chunk 경계 메타와 materialized element 메타가 어긋나면
    // 본 helper 가 경계를 재계산하지 않고 RangeError 로 거부한다(ADR-0046 §Decision 3).
    if (
      materialized.index !== planChunk.index ||
      materialized.offsetBytes !== planChunk.offsetBytes ||
      materialized.sizeBytes !== planChunk.sizeBytes ||
      materialized.last !== planChunk.last
    ) {
      throw new RangeError(
        `selectRemainingMaterializedDumpChunks: index ${String(
          planChunk.index,
        )} chunk 의 경계 메타가 불일치합니다 — resume plan(offset=${String(
          planChunk.offsetBytes,
        )}, size=${String(planChunk.sizeBytes)}, last=${String(
          planChunk.last,
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
