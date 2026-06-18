// export-dump-chunk-readable — UC-07 Export dump 다운로드 의 chunked-Readable 실행 layer 순수
// factory (T-0509, P7 R-57 / REQ-030 / REQ-032). 머지된 ADR-0046 (b718bb8) Decision §1 "기존 chunk
// helper 와의 맞물림" 절 (i) 은 다음을 박제했다: buildExportChunkPlan(export-chunk-plan.ts)이
// totalBytes/chunkSizeBytes 로부터 각 chunk 의 offsetBytes/sizeBytes 를 **산정**하면,
// materialization 은 직렬화된 byte 를 그 경계대로 slice 해 **Readable 에 push** 한다 — helper 가
// "어디서부터 몇 byte" 를, materialization 이 "실제 byte slice + push" 를 책임진다(책임 분리).
//
// 직전 chain step 두 개는 그 piece 의 절반씩만 박제했다: T-0506(materializeExportDump, 08a010f)은
// envelope 전체를 한 번에 JSON.stringify 해 **단일** Readable.from(serialized) 로 만들고(chunk 경계
// 0), T-0507(sliceMaterializedDumpByChunkPlan, 885bc22)은 직렬화 byte 를 chunk 경계대로 자른
// **in-memory Buffer[]** 만 반환한다(Readable push 0). 본 factory 는 그 둘을 합쳐, T-0507 의 byte
// slice 결과(chunk 경계대로 잘린 Buffer 배열)를 Node 표준 helper Readable.from 으로 감싸 chunk
// 경계대로 buffer 를 차례로 push 하는 stream 을 반환한다 — ADR-0046 §Decision 1 이 envision 한
// "chunk 경계대로 push 하는 Readable" 자체를 produce 하는 deferred piece 를 닫는다.
//
// 직렬화·invariant 검증은 sliceMaterializedDumpByChunkPlan(T-0507)에 전적으로 위임한다 — 본
// factory 는 그 결과 buffer 만 Readable.from 으로 push 할 뿐 재구현하지 않는다(DRY, ADR-0046
// §Decision 3 재계산 금지). 따라서 입력 방어(dump/plan 비-object → TypeError, totalBytes drift →
// RangeError)는 T-0507 의 throw 가 factory 호출 시점에 즉시(eager) 그대로 전파된다 — 본 factory 가
// 별도 wrap 하지 않아 호출측이 T-0507 의 원본 진단 메시지를 그대로 받는다.
//
// HTTP response pipe / StreamableFile 래핑 / Content-Length·Content-Range 헤더 / chunk 단위 직렬화 /
// checksum / resume / DB·repository 배선은 전부 §Out of Scope(후속 task). 본 factory 는 이미
// 메모리에 있는 ExportDump + ExportChunkPlan 만 입력으로 받아 in-process Readable instance 만
// 반환한다. 새 도메인 타입 신설 0(ExportDump 는 ./export-dump, ExportChunkPlan 은 ./export-chunk-plan
// import), 새 외부 dependency 0(Node 내장 stream.Readable 만 — Web Streams / readable-stream npm 등
// 외부 stream lib 의존 0). backpressure / pause / resume 는 Readable.from 의 default 동작 채택.
import { Readable } from "stream";

import { ExportChunkPlan } from "./export-chunk-plan";
import { ExportDump } from "./export-dump";
import { sliceMaterializedDumpByChunkPlan } from "./export-dump-chunk-slice";

// createChunkedExportDumpReadable — ExportDump envelope 와 그에 대응하는 ExportChunkPlan 을 받아,
// 직렬화 byte 를 plan 의 chunk 경계대로 잘라 chunk 순서대로 push 하는 Node 내장 stream.Readable 을
// 반환한다. ADR-0046 §Decision 1 맞물림 (i) 정합:
//   (a) sliceMaterializedDumpByChunkPlan(dump, plan)(T-0507)을 호출해 chunk 경계대로 잘린 Buffer
//       배열을 얻는다 — 직렬화(JSON.stringify → UTF-8 Buffer)·totalBytes drift 검증·alias 0
//       (Buffer.from(slice) 독립 복사본)는 전부 그 helper 가 책임진다(본 factory 재구현 0).
//   (b) Readable.from(chunks.map((c) => c.bytes)) — Node 표준 helper 로 Buffer iterable 을 stream
//       으로 감싼다. push API 를 직접 다루지 않아도 standard Readable instance 를 반환한다
//       (result instanceof Readable 통과). 각 element 가 한 번의 push 가 되어 chunk 경계가
//       stream 단위로 그대로 보존된다(offsetBytes 오름차순 → index 0,1,2,... 순서 push).
//
// 반환 Readable 의 동작:
//   - result instanceof Readable === true (Node 내장 stream — 외부 stream lib 0).
//   - chunkCount === 0(빈 envelope) → 빈 iterable → 즉시 end event 만 발생하는 빈 stream(throw 0).
//   - chunkCount === 1 → 단일 buffer push 후 end.
//   - chunkCount > 1 → chunk 들을 offsetBytes 오름차순으로 차례 push(stream 으로 받은 chunk 를
//     concat 하면 Buffer.from(JSON.stringify(dump), "utf8") 와 byte-동일 — T-0507 의 slice 합 ===
//     직렬화 buffer invariant 가 stream 까지 보존).
//
// 입력 방어는 sliceMaterializedDumpByChunkPlan 의 throw 가 본 factory 호출 시점에 즉시(eager) 그대로
// 전파된다 — Readable 을 받은 뒤 read 단계가 아니라 호출 즉시 throw:
//   - dump 가 plain object 아님 → 한국어 TypeError(원본 message 유지).
//   - plan 이 plain object 아님 → 한국어 TypeError. plan.chunks 가 배열 아님 → 한국어 TypeError.
//   - 직렬화 byte length 가 plan.totalBytes 와 불일치 → 한국어 RangeError.
//
// 입력 dump/plan 객체·중첩 구조를 변형하지 않는다(non-mutating — Object.freeze 통과; slice helper
// 가 이미 non-mutating). 동일 입력 2 회 호출의 stream 산출 byte 가 동일(결정성 — JSON.stringify +
// T-0507 결정성에 위임). produce 한 stream 의 buffer 는 T-0507 의 Buffer.from(slice) 독립 복사본이라
// mutate 해도 후속 호출 stream 에 영향 0(alias 0).
export function createChunkedExportDumpReadable(
  dump: ExportDump,
  plan: ExportChunkPlan,
): Readable {
  // T-0507 에 직렬화·invariant 검증·byte slice·alias 0 을 전적으로 위임한다. 입력 방어 throw
  // (TypeError/RangeError)는 이 호출 시점에 즉시 그대로 전파된다(eager — Readable 반환 전).
  const chunks = sliceMaterializedDumpByChunkPlan(dump, plan);

  // Buffer iterable → Node 표준 Readable. 각 element 가 한 번의 push 가 되어 chunk 경계가 stream
  // 단위로 보존된다. 빈 배열(chunkCount === 0)이면 즉시 end 하는 빈 stream 을 반환한다(throw 0).
  return Readable.from(chunks.map((chunk) => chunk.bytes));
}
