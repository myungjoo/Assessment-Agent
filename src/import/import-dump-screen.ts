// import-dump-screen — UC-07 Import dump 사전 선별(screening) 순수 helper (T-1257, REQ-030 /
// REQ-032). [ADR-0055](../../docs/decisions/ADR-0055-import-multipart-file-upload.md)
// §Follow-up (b) 의 복원 엔진 chain (역직렬화 → 구조 검증 → **schema version gate** →
// ADR-0044 §3 atomic `$transaction` 복원 → controller 재배선) 중 **세 번째 slice** 다.
// T-1256 의 `parseImportDumpBuffer` (buffer → 파싱 + 구조 verdict) 는 "이 파일이 우리 dump
// 포맷인가" 까지만 답하고, T-0439 의 `checkSchemaVersionCompat` 는 2026-06 부터 caller 0 인 채
// 놓여 있었다 — 본 helper 가 그 둘을 합성해 "업로드 buffer 하나를 넣으면 **복원 시도해도 되는
// dump 인지** 단일 verdict 로 답한다" 는 상류 계약을 완성한다.
//
// 순수·non-mutating — DB · repository · file I/O · gzip 해제 · size / checksum / merge 판정 ·
// 통합 go/no-go 합성 (`summarizeImportPreflight`) · REST 배선 호출 0 이며, 하류 helper 의 세부
// 규칙을 재구현하지 않고 **호출 순서와 실패 stage 분류만** 담당한다 (DRY — 각 규칙의
// source-of-truth 는 각 helper). REQ-032 (raw 미저장) 정합: 파싱 결과를 어디에도 영속 저장하지
// 않는다.
import {
  checkSchemaVersionCompat,
  type SchemaVersionCompat,
  type SchemaVersionCompatOptions,
} from "../export/schema-version-compat";

import {
  parseImportDumpBuffer,
  type ImportDumpParseStage,
} from "./import-dump-parse";

// 실패가 발생한 선별 단계 — 파싱 pipeline 의 stage (`deserialize` | `structure`) 를 재사용해
// version gate 단계만 덧붙인다 (문자열 union 재정의 0 — parse stage 가 늘어나면 자동 추종).
export type ImportDumpScreenStage = ImportDumpParseStage | "version";

// 선별 verdict — discriminated union. 성공이면 파싱된 dump 와 version 호환 판정을 함께 돌려주고
// (호출측이 accept / migrate 를 스스로 구분할 수 있도록), 실패면 실패 stage 와 한국어 위반
// 목록을 돌려준다 (throw 아님 — sibling 순수 helper 패턴 mirror).
export type ImportDumpScreenResult =
  | { ok: true; dump: Record<string, unknown>; version: SchemaVersionCompat }
  | { ok: false; stage: ImportDumpScreenStage; issues: string[] };

// screenImportDumpBuffer — 업로드 dump buffer 를 파싱·구조 검증한 뒤 schema version gate 까지
// 통과했는지 단일 verdict 로 답한다. 분기는 4 개이며 **단락 평가** 다:
//   (1) 파싱 pipeline 실패 → 그 stage ("deserialize" | "structure") 와 issues 를 **그대로**
//       전달한다 (재가공 0). version gate 는 실행하지 않는다 — schemaVersion 의 존재/shape 자체가
//       아직 보장되지 않았으므로 `checkSchemaVersionCompat` 의 TypeError 경로에 닿을 수 있다.
//   (2) 파싱 성공 + version reject → { ok: false, stage: "version", issues: [reason] }
//       (import-preflight-summary 의 blocking 등급과 동일 분류).
//   (3) 파싱 성공 + version migrate → { ok: true, dump, version }. migrate 는 차단이 아니라
//       호출측 confirmation 영역이며 (import-preflight-summary 의 warning 등급과 동일 분류),
//       판단 근거는 반환된 version verdict 로 전달한다 (실 migration 수행 0).
//   (4) 파싱 성공 + version accept → { ok: true, dump, version }.
export function screenImportDumpBuffer(
  buffer: Buffer,
  options?: SchemaVersionCompatOptions,
): ImportDumpScreenResult {
  // (1) 1~2 단계 — buffer → 파싱 + 구조 verdict. 비-Buffer / 빈 / 손상 JSON / 구조 위반은 전부
  // 여기서 verdict 가 되며, 실패 stage 와 issues 를 그대로 흘려보낸다.
  const parsed = parseImportDumpBuffer(buffer);
  if (!parsed.ok) {
    return { ok: false, stage: parsed.stage, issues: parsed.issues };
  }

  // (2) 3 단계 — schema version gate. 구조 검증이 schemaVersion 을 "비어있지 않은 string" 으로
  // 이미 보장하므로 (import-dump-validate.ts 79~81 행) 여기서 TypeError 경로는 발생하지 않는다.
  const version = checkSchemaVersionCompat(
    parsed.dump.schemaVersion as string,
    options,
  );
  if (version.action === "reject") {
    return {
      ok: false,
      stage: "version",
      issues: [
        version.reason ??
          `schema version 호환 불가: ${version.uploadedVersion} ≠ ${version.currentVersion}`,
      ],
    };
  }

  // (3)(4) accept / migrate — 하류 slice ($transaction 복원) 가 쓸 dump 와 version 판정 근거를
  // 함께 넘긴다. migrate 는 차단하지 않는다 (호출측 confirmation 영역).
  return { ok: true, dump: parsed.dump, version };
}
