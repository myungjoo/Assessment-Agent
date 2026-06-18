// export-dump-chunk-slice — UC-07 Export dump 다운로드 의 byte slice 순수 helper (T-0507, P7
// R-57 / REQ-030 / REQ-032). 머지된 ADR-0046 (b718bb8) Decision §1 "기존 chunk helper 와의
// 맞물림" 절 (i) 은 책임 분리를 박제했다: buildExportChunkPlan(export-chunk-plan.ts)이
// totalBytes/chunkSizeBytes 로부터 각 chunk 의 offsetBytes/sizeBytes 를 **산정**하면,
// materialization 은 직렬화된 byte 를 그 경계대로 **slice** 한다 — helper 가 "어디서부터 몇
// byte", 본 함수가 "실제 byte slice" 를 책임진다. 직전 T-0506(materializeExportDump, 08a010f)은
// 전체 envelope 를 한 번에 JSON.stringify 해 단일 Readable 로 만드는 piece 만 박제했고, 그
// §Out of Scope 가 "chunk byte slice — export-chunk-* helper 가 산정한 경계를 소비하는 별도
// 후속 task" 로 deferred 했다. 본 helper 는 그 deferred piece 를 순수 함수 1 개로 닫는다.
//
// 직렬화 방식은 export-dump-materialize.ts(T-0506) / export-artifact-descriptor.ts(estimateByteSize,
// L107~110: Buffer.byteLength(JSON.stringify(dump), "utf8"))와 **정확히 동일** 한 JSON.stringify(dump)
// → Buffer.from(serialized, "utf8") 다. 그래서 직렬화 byte length 가 plan.totalBytes 와 drift 0
// 으로 정합해야 하며(ADR-0046 §Decision 3 descriptor single-source), 불일치 시 RangeError 로
// 거부한다(chunk helper 산정값만 소비 — 재계산 금지).
//
// DB / repository / controller / Readable push / Content-Range 헤더 직렬화는 전부 §Out of Scope
// (후속 task). 본 함수는 이미 메모리에 있는 ExportDump + ExportChunkPlan 만 입력으로 받아
// in-memory Buffer 배열만 반환한다. 새 도메인 타입 신설 0(ExportDump 는 ./export-dump,
// ExportChunkPlan/ExportChunk 는 ./export-chunk-plan import), 새 외부 dependency 0(Node 내장
// Buffer 만). 코드 골격은 export-dump-materialize.ts 의 isPlainObject / describeNonObject 입력
// 방어 + 한국어 TypeError + non-mutating + freeze 통과 패턴을 mirror 한다.
import { ExportChunkPlan } from "./export-chunk-plan";
import { ExportDump } from "./export-dump";

// 본 helper 가 반환하는 단일 element 타입 — plan.chunks[i] 의 경계 메타(index/offsetBytes/
// sizeBytes/last)에 실 byte(bytes: Buffer)를 더한 것. bytes 는 입력 직렬화 buffer 와 alias 0
// 인 독립 복사본이라 호출측이 mutate 해도 원본/후속 호출이 영향받지 않는다.
export interface MaterializedExportDumpChunk {
  index: number;
  offsetBytes: number;
  sizeBytes: number;
  last: boolean;
  bytes: Buffer;
}

// plain object(null / 배열 / 비-object 아님) 판정 — top-level dump / plan 입력 방어에 쓴다
// (export-dump-materialize.isPlainObject 동형).
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 비-plain-object 값의 표시명 — 메시지에 어떤 잘못된 입력이 왔는지 담는다
// (export-dump-materialize.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === undefined
    ? "undefined"
    : value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;
}

// sliceMaterializedDumpByChunkPlan — ExportDump envelope 와 그에 대응하는 ExportChunkPlan 을
// 받아, 직렬화된 byte 를 plan 의 chunk 경계대로 잘라 MaterializedExportDumpChunk 배열을 반환한다.
// ADR-0046 §Decision 1 맞물림 (i) 정합:
//   (a) JSON.stringify(dump) 로 1 회 직렬화 후 Buffer.from(serialized, "utf8") 로 buffer 화
//       (materializeExportDump 와 정확히 같은 직렬화 방식).
//   (b) Buffer.byteLength(serialized, "utf8") === plan.totalBytes invariant 검증 — 불일치(stale
//       plan 등)면 RangeError(한국어 message). descriptor single-source 강제(ADR-0046 §Decision 3).
//   (c) plan.chunks 를 순회하며 buffer.subarray(offset, offset + size) 로 slice 후 새
//       Buffer.from(slice) 로 복사한 byte 를 element 에 담음 — 입력 buffer 와 alias 0.
//
// 반환 배열 길이 === plan.chunkCount, 각 element 의 index/offsetBytes/sizeBytes/last 는
// plan.chunks[i] 의 동명 필드와 동일. chunkCount === 0(totalBytes 0)인 빈 envelope 도 정상 —
// 반환 []. 입력 dump/plan 을 변형하지 않으며(non-mutating — Object.freeze 통과), 동일 입력 2 회
// 호출은 모든 element 의 byte 까지 동일(결정성 — JSON.stringify 결정성에 위임).
//
// 입력 방어 (분기 분리 — branch coverage):
//   - dump 가 plain object 아님(null/undefined/숫자/문자열/배열) → TypeError(한국어 message).
//   - plan 이 plain object 아님 → TypeError. plan.chunks 가 배열 아님 → TypeError.
//   - 직렬화 byte length 가 plan.totalBytes 와 불일치 → RangeError.
//   - 직렬화 불가 입력(순환 참조 등)은 JSON.stringify 의 native TypeError 가 그대로 전파.
export function sliceMaterializedDumpByChunkPlan(
  dump: ExportDump,
  plan: ExportChunkPlan,
): MaterializedExportDumpChunk[] {
  // top-level dump 가 plain object 가 아니면 직렬화 의미가 없어 즉시 throw.
  if (!isPlainObject(dump)) {
    throw new TypeError(
      `sliceMaterializedDumpByChunkPlan: dump 는 plain object 여야 합니다 (받음: ${describeNonObject(
        dump,
      )})`,
    );
  }

  // top-level plan 이 plain object 가 아니면 chunk 경계 접근 불가 — 즉시 throw.
  if (!isPlainObject(plan)) {
    throw new TypeError(
      `sliceMaterializedDumpByChunkPlan: plan 은 plain object 여야 합니다 (받음: ${describeNonObject(
        plan,
      )})`,
    );
  }

  // plan.chunks 가 배열이 아니면(plan shape 위반 — null/누락 등) 순회 불가 — TypeError.
  const chunks = (plan as { chunks: unknown }).chunks;
  if (!Array.isArray(chunks)) {
    throw new TypeError(
      `sliceMaterializedDumpByChunkPlan: plan.chunks 는 배열이어야 합니다 (받음: ${describeNonObject(
        chunks,
      )})`,
    );
  }

  // materializeExportDump 와 정확히 같은 직렬화 방식 — JSON.stringify(dump) → UTF-8 Buffer.
  // 직렬화 불가 입력(순환 참조)은 native TypeError 가 그대로 전파.
  const serialized = JSON.stringify(dump);
  const buffer = Buffer.from(serialized, "utf8");

  // descriptor single-source 강제(ADR-0046 §Decision 3) — 실 byte length 가 plan 산정값과
  // 어긋나면(stale plan / 손상 plan) chunk 경계가 무의미하므로 RangeError 로 거부. chunk helper
  // 가 산정한 값만 소비하고 본 함수가 재계산하지 않는다.
  if (buffer.length !== plan.totalBytes) {
    throw new RangeError(
      `sliceMaterializedDumpByChunkPlan: 직렬화 byte length(${buffer.length})가 ` +
        `plan.totalBytes(${String(
          plan.totalBytes,
        )})와 일치하지 않습니다 — stale 하거나 손상된 plan 입니다`,
    );
  }

  // plan.chunks 경계대로 slice — subarray 는 같은 메모리를 공유하므로 Buffer.from(slice) 로
  // 독립 복사본을 만들어 alias 0 을 보장한다(호출측 mutate 가 원본/후속 호출에 영향 0).
  const result: MaterializedExportDumpChunk[] = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i];
    const slice = buffer.subarray(
      chunk.offsetBytes,
      chunk.offsetBytes + chunk.sizeBytes,
    );
    result.push({
      index: chunk.index,
      offsetBytes: chunk.offsetBytes,
      sizeBytes: chunk.sizeBytes,
      last: chunk.last,
      bytes: Buffer.from(slice),
    });
  }

  return result;
}
