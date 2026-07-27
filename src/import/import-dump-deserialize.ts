// import-dump-deserialize — UC-07 Import dump buffer 역직렬화 순수 helper (T-1255,
// REQ-030 / REQ-032). [ADR-0055](../../docs/decisions/ADR-0055-import-multipart-file-upload.md)
// §Decision 2 (memoryStorage in-memory buffer 를 복원 엔진에 직접 전달) 가 넘겨주는 raw
// `Buffer` 를 JSON 객체로 **역직렬화만** 한다. ADR-0055 §Follow-up (b) 의 복원 엔진 chain
// (역직렬화 → 구조 검증 → schema version gate → ADR-0044 §3 atomic `$transaction` 복원) 중
// 가장 앞단 slice 이며, 하류 소비자인 import-dump-validate.ts 의
// `validateImportDumpStructure` 가 "이미 파싱된 plain object" 를 받으므로 본 helper 가 그
// 앞단 gap 을 메운다.
//
// 순수·non-mutating — 입력 buffer 를 변형하지 않고, DB · repository · file I/O · gzip 해제 ·
// 구조 검증 · schema version 판정 · REST 배선 호출 0 이다. 구조 typing 도 하지 않는다
// (성공 시 value 는 `unknown` — 구조 검증은 하류 validate 책임, decouple). 코드 골격은
// import-dump-validate.ts 의 순수-helper 패턴 (plain verdict interface + 한국어 위반 메시지 +
// early-throw 아님) 을 mirror 한다. REQ-032 (raw 미저장) 정합: 파싱 결과를 어디에도 영속
// 저장하지 않으며, 실패 reason 에도 raw 본문 / stack 을 담지 않는다 (사람-친화 short message).

// 역직렬화 verdict — discriminated union. 성공이면 파싱 결과를 `value` 로, 실패면 한국어
// short message 를 `reason` 으로 돌려준다 (throw 아님 — 하류 배선이 transaction 을 시작하지
// 않고 reason 을 그대로 사용자에게 안내할 수 있도록).
export type DumpDeserializeResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: string };

// 비-Buffer 입력의 사람-친화 타입 라벨 — reason 메시지에만 쓰며 raw 값 자체는 담지 않는다
// (REQ-032: 외부 본문 미노출).
function describeInput(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// deserializeDumpBuffer — 업로드된 dump 본문 buffer 를 UTF-8 로 decode 한 뒤 `JSON.parse`
// 한다. 분기는 4 개다:
//   (1) 입력이 Buffer 가 아님 (`Buffer.isBuffer` false) → { ok: false, reason }
//   (2) 빈 buffer (length 0) 또는 whitespace-only 본문 → { ok: false, reason }
//   (3) 손상 JSON (SyntaxError) → catch 해서 { ok: false, reason } (throw 하지 않음)
//   (4) 정상 → { ok: true, value: <파싱 결과> }
// 파싱 결과가 primitive / array 여도 (예: `123`, `"x"`, `[]`) 본 helper 는 `ok: true` 로
// 통과시킨다 — envelope 구조 판정은 하류 `validateImportDumpStructure` 책임이다.
export function deserializeDumpBuffer(buffer: Buffer): DumpDeserializeResult {
  // (1) 런타임 방어 — 배선 실수 / multipart 필드 누락으로 Buffer 가 아닌 값이 올 수 있다.
  if (!Buffer.isBuffer(buffer)) {
    return {
      ok: false,
      reason: `dump 본문은 Buffer 여야 합니다 (받음: ${describeInput(buffer)})`,
    };
  }

  // (2) 빈 파일 / whitespace-only — JSON.parse 는 SyntaxError 를 내지만 원인이 "손상" 이
  // 아니라 "본문 없음" 이므로 별도 reason 으로 구분해 안내한다.
  if (buffer.length === 0) {
    return { ok: false, reason: "빈 dump 파일입니다 (본문이 비어 있습니다)" };
  }
  const text = buffer.toString("utf-8");
  if (text.trim().length === 0) {
    return {
      ok: false,
      reason: "빈 dump 파일입니다 (공백 문자만 담겨 있습니다)",
    };
  }

  // (3)(4) 실 파싱 — SyntaxError 는 catch 해 verdict 로 변환한다. raw 본문 / stack 은 담지
  // 않고 사람-친화 한국어 short message 만 남긴다 (REQ-032).
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      reason: "손상된 dump JSON — 파일 내용을 파싱할 수 없습니다",
    };
  }
}
