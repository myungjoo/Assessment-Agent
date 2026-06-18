// export-dump-materialize — UC-07 Export dump 다운로드 materialization 의 dependency-free 첫
// 구현 step (T-0506, P7 R-57 / REQ-030 / REQ-032). ADR-0046 (b718bb8) Decision §1 은 `ExportDump`
// envelope 를 **in-process 에서 Node.js 내장 `stream`/`Readable` 기반으로 materialize** 한다고
// 박제했다(`JSON.stringify(envelope)` 직렬화 → Node `Readable` 로 감싸 응답 본문으로 흘려보냄,
// 새 외부 dependency 0). 본 helper 는 그 chain 의 첫 step — envelope 를 받아 직렬화 byte 를 담은
// Node `stream.Readable` 을 반환하는 **순수 함수 1 개** 다. DB / repository / controller 배선은
// 후속 task 책임(ADR-0046 §Out of scope) — 본 step 은 순수 함수 + unit test 만으로 완결한다.
//
// 직렬화 표현은 export-artifact-descriptor.ts 의 `estimateByteSize`(L107~110: `Buffer.byteLength(
// JSON.stringify(dump), "utf8")`)와 동일한 `JSON.stringify(dump)` (UTF-8) 로 박제해 descriptor
// `byteSizeHint` 와 materialization 의 실 byte 가 drift 0 으로 정합한다. chunk 단위 직렬화(대량
// dump 메모리 압박 완화)·controller 배선·로컬 임시 dir 영속 저장·압축은 전부 §Out of Scope(ADR-
// 0046 §Decision 1 "Node Readable stream" 전략만 박제, 그 외는 후속 task).
//
// 코드 골격은 export-dump.ts / export-artifact-descriptor.ts 의 순수-helper 패턴(non-mutating ·
// isPlainObject 입력 방어 · 한국어 TypeError · `Object.freeze(dump)` 로 호출해도 통과)을 mirror
// 한다. 새 도메인 타입 신설 0(`ExportDump` 는 `./export-dump` import), 새 외부 dependency 0
// (Node 내장 `stream` 만).
import { Readable } from "stream";

import { ExportDump } from "./export-dump";

// plain object(null / 배열 / 비-object 아님) 판정 — top-level dump 입력 방어에 쓴다.
// export-artifact-descriptor.ts 의 isPlainObject 와 동형 convention.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 비-plain-object 값의 표시명 — 메시지에 어떤 잘못된 입력이 왔는지 담는다
// (export-artifact-descriptor.ts.describeNonObject 동형).
function describeNonObject(value: unknown): string {
  return value === undefined
    ? "undefined"
    : value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;
}

// materializeExportDump — `ExportDump` envelope 를 받아 `JSON.stringify(dump)` 결과(UTF-8 byte)
// 를 담은 Node 내장 `stream.Readable` 을 반환한다. ADR-0046 §Decision 1 정합:
//   - `JSON.stringify(dump)` 로 envelope 전체를 한 번에 직렬화 (chunk 단위 분할은 후속 task).
//   - `Readable.from(serialized)` 로 Node 내장 stream 으로 감싼다 (push API 직접 사용 0,
//     `Readable.from` 가 이미 Node 표준 helper — 새 dep 0).
//   - 입력 dump 객체·중첩 구조를 변형하지 않는다 (non-mutating — `Object.freeze(dump)` 로 호출
//     해도 통과; `JSON.stringify` 자체가 입력을 변형하지 않음).
//   - 동일 입력 2 회 호출은 동일 byte 결과 (순수·결정성 — `JSON.stringify` 결정성에 위임).
//
// 입력 방어 (분기 분리 — branch coverage):
//   - dump 가 plain object 가 아니면(null / undefined / 숫자 / 문자열 / 배열) → TypeError
//     (한국어 message, 기존 helper convention `materializeExportDump: dump 는 ...` 형태).
//     scope/records 같은 하위 필드 접근 자체가 의미 없으므로 직렬화 전에 즉시 throw.
//   - 직렬화 불가 입력(순환 참조 등)은 `JSON.stringify` 의 native TypeError 가 그대로 전파 —
//     본 helper 가 별도 wrap 하지 않는다 (호출측이 원본 진단 메시지 그대로 받게).
//
// 빈 records envelope(`recordCount: 0`, `records: []`)도 정상 직렬화되어 valid JSON stream 을
// 반환한다 (`{"records":[],...}` 같은 형태). 멀티바이트 한글 등 UTF-8 multi-byte 문자도 정확히
// 직렬화된다 (`Readable.from(string)` 의 기본 encoding 이 UTF-8 — Node 표준).
export function materializeExportDump(dump: ExportDump): Readable {
  // top-level dump 가 plain object 가 아니면 직렬화 의미가 없어 즉시 throw.
  if (!isPlainObject(dump)) {
    throw new TypeError(
      `materializeExportDump: dump 는 plain object 여야 합니다 (받음: ${describeNonObject(
        dump,
      )})`,
    );
  }

  // JSON.stringify 는 입력을 변형하지 않는다 (freeze 된 dump 로 호출해도 통과). 직렬화 불가
  // 입력(순환 참조 등)은 native TypeError 가 그대로 전파되어 호출측이 원본 진단을 받는다.
  const serialized = JSON.stringify(dump);

  // Readable.from(string) — Node 표준 helper. 기본 encoding 이 UTF-8 이며 chunked push API 를
  // 직접 다루지 않아도 standard `Readable` instance 를 반환한다 (`result instanceof Readable`
  // 통과). chunk 단위 분할 직렬화는 ADR-0046 §Out of scope (후속 task).
  return Readable.from(serialized);
}
