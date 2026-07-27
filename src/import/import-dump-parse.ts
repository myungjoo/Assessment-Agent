// import-dump-parse — UC-07 Import dump 파싱 pipeline 순수 helper (T-1256, REQ-030 / REQ-032).
// [ADR-0055](../../docs/decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 의
// 복원 엔진 chain (역직렬화 → 구조 검증 → schema version gate → ADR-0044 §3 atomic
// `$transaction` 복원 → controller 재배선) 중 **두 번째 slice** 다. T-1255 의
// `deserializeDumpBuffer` (buffer → unknown) 와 기존 `validateImportDumpStructure` (파싱된
// object → verdict) 는 서로 배선되지 않은 채 따로 놓여 있었다 — 본 helper 가 그 둘을 합성해
// "업로드 buffer 하나를 넣으면 복원 가능한 dump 인지 단일 verdict 로 답한다" 는 상류 계약을
// 만든다. 순수·non-mutating — DB · repository · file I/O · gzip 해제 · schema version 판정
// (`checkSchemaVersionCompat`) · size / checksum / merge 판정 · 통합 go/no-go 합성
// (`summarizeImportPreflight`) · REST 배선 호출 0 이며, 하류 helper 의 세부 규칙을 재구현하지
// 않고 **호출 순서와 실패 stage 분류만** 담당한다 (DRY — 각 규칙의 source-of-truth 는 각
// helper). REQ-032 (raw 미저장) 정합: 파싱 결과를 어디에도 영속 저장하지 않는다.
import { validateImportDumpStructure } from "../export/import-dump-validate";

import { deserializeDumpBuffer } from "./import-dump-deserialize";

// 실패가 발생한 pipeline 단계 — 상류 배선이 사용자 안내 문구를 나눠 쓸 수 있도록 구분한다
// ("파일이 깨졌습니다" vs "dump 형식이 맞지 않습니다").
export type ImportDumpParseStage = "deserialize" | "structure";

// 파싱 pipeline verdict — discriminated union. 성공이면 파싱된 plain object dump 를, 실패면
// 실패 stage 와 한국어 위반 목록을 돌려준다 (throw 아님 — sibling 순수 helper 패턴 mirror).
export type ImportDumpParseResult =
  | { ok: true; dump: Record<string, unknown> }
  | { ok: false; stage: ImportDumpParseStage; issues: string[] };

// parseImportDumpBuffer — 업로드 dump buffer 를 역직렬화한 뒤 구조 무결성까지 검증한 단일
// verdict 로 답한다. 분기는 3 개이며 **단락 평가** 다:
//   (1) 역직렬화 실패 → { ok: false, stage: "deserialize", issues: [reason] }.
//       구조 검증은 실행하지 않는다 (파싱 결과가 없으므로 검증할 대상 자체가 없다).
//   (2) 역직렬화는 성공했으나 구조 위반 → { ok: false, stage: "structure", issues: <누적 위반> }.
//       위반은 validateImportDumpStructure 가 모아 둔 배열을 그대로 전달한다 (재가공 0 —
//       그 배열은 호출마다 새로 만들어지므로 원본 mutate 위험 없음).
//   (3) 둘 다 통과 → { ok: true, dump }. validateImportDumpStructure 가 top-level plain object
//       가 아닌 값을 이미 invalid 로 걸러내므로 이 시점의 value 는 plain object 임이 보장된다.
export function parseImportDumpBuffer(buffer: Buffer): ImportDumpParseResult {
  // (1) 1 단계 — buffer → unknown. 비-Buffer / 빈 / 손상 JSON 은 전부 여기서 verdict 가 된다.
  const deserialized = deserializeDumpBuffer(buffer);
  if (!deserialized.ok) {
    return { ok: false, stage: "deserialize", issues: [deserialized.reason] };
  }

  // (2) 2 단계 — 파싱된 object → 구조 verdict. primitive / array top-level 도 여기서 걸린다.
  const structure = validateImportDumpStructure(deserialized.value);
  if (!structure.valid) {
    return { ok: false, stage: "structure", issues: structure.issues };
  }

  // (3) 전부 통과 — 하류 slice (version gate → $transaction 복원) 가 쓸 dump 를 그대로 넘긴다.
  return { ok: true, dump: deserialized.value as Record<string, unknown> };
}
