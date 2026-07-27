// import-restore-input — UC-07 Import 복원 입력 준비 순수 helper (T-1259, REQ-030 / REQ-032).
// [ADR-0055](../../docs/decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원
// 엔진 chain (역직렬화 → 구조 검증 → schema version gate → 복원 plan 입력 복원 → ADR-0044 §3
// atomic `$transaction` 복원 → controller 재배선) 의 **다섯 번째 slice** 다. T-1257 의
// `screenImportDumpBuffer` (buffer → 복원 시도 가능 여부 + dump + version 판정) 와 T-1258 의
// `hydrateImportDumpRecords` (dump → `FullExportRecord[]`) 는 각각 머지됐지만 서로 배선되지 않아,
// 업로드 buffer 하나에서 `$transaction` 복원 입력 (`FullExportRecord[]` + version 판정) 까지 한 번에
// 얻을 방법이 없었다 — 본 helper 가 그 합성 한 겹만 닫아 다음 slice (실 `$transaction` 복원) 가
// 소비할 **단일 진입 계약** 을 만든다.
//
// 순수·non-mutating — DB · repository · file I/O · Prisma · `$transaction` · `buildImportRestorePlan`
// 호출 · REST 배선 0 이며, 상류/하류 helper 의 규칙 (JSON 파싱 · 구조 검증 · version 판정 ·
// records 타입 복원) 을 재구현하지 않고 **호출 순서와 실패 stage 분류만** 담당한다 (DRY — 각
// 규칙의 source-of-truth 는 각 helper). REQ-032 (raw 미저장) 정합: 변환 결과를 어디에도 영속
// 저장하지 않는다.
import type { FullExportRecord } from "../export/export-full-record";
import type {
  SchemaVersionCompat,
  SchemaVersionCompatOptions,
} from "../export/schema-version-compat";

import { hydrateImportDumpRecords } from "./import-dump-records-hydrate";
import {
  screenImportDumpBuffer,
  type ImportDumpScreenStage,
} from "./import-dump-screen";

// 실패가 발생한 준비 단계 — 상류 screening stage ("deserialize" | "structure" | "version") 를
// 재사용하고 records 복원 단계만 덧붙인다 (문자열 리터럴 재선언 0 — 상류 stage 가 늘어나면 자동
// 추종). 상류 배선이 사용자 안내 문구를 단계별로 나눠 쓸 수 있게 하는 분류 key 다.
export type ImportRestoreInputStage = ImportDumpScreenStage | "records";

// 복원 입력 verdict — discriminated union. 성공이면 ADR-0044 §3 `$transaction` 복원이 그대로
// 소비할 `FullExportRecord[]` 와 version 호환 판정을 함께 돌려주고 (accept / migrate 구분은
// 호출측 몫), 실패면 실패 stage 와 한국어 위반 목록을 돌려준다 (throw 0 — sibling 순수 helper
// 패턴 mirror). 실패 시 부분 결과는 돌려주지 않는다 (복원은 all-or-nothing).
//
// T-1268 증분 — `records` 를 `ExportRecord[]` 에서 `FullExportRecord[]` (= `ExportRecord` +
// `fields` payload) 로 **좁힌다**. 런타임에는 T-1265 이후 `hydrateImportDumpRecords` 가 이미
// `fields` 를 실어 보내고 있었지만 타입 경계에서 사라져, 하류 `$transaction` 복원이
// `createMany({ data: fields })` 에 넣을 row 값을 타입 상 볼 수 없었다. `FullExportRecord` 는
// `ExportRecord` 의 구조적 subtype 이라 넓힘 대입 (covariance) 으로 기존 소비처
// (`import-restore-plan-prepare.ts` 등) 는 한 줄도 고치지 않고 그대로 컴파일된다.
export type ImportRestoreInputResult =
  | { ok: true; records: FullExportRecord[]; version: SchemaVersionCompat }
  | { ok: false; stage: ImportRestoreInputStage; issues: string[] };

// prepareImportRestoreInput — 업로드 dump buffer 하나를 `$transaction` 복원 입력까지 준비한다.
// 동작은 **단락 평가 2 단계** 다:
//   (1) `screenImportDumpBuffer` 실패 → 그 stage ("deserialize" | "structure" | "version") 와
//       issues 를 **그대로** 전달한다 (재가공 0). hydrate 는 실행하지 않는다 — 파싱/구조/version
//       이 아직 보장되지 않은 dump 에 records 복원을 시도할 이유가 없다.
//   (2) screening 성공 후 `hydrateImportDumpRecords` 실패 → { ok: false, stage: "records",
//       issues: <hydrate 가 누적한 배열 그대로> }. index 를 담은 위반 메시지 convention 은 하류
//       helper 가 이미 갖추고 있어 재가공하지 않는다.
//   (3) 둘 다 통과 → { ok: true, records, version }. screening 이 돌려준 version 판정을 그대로
//       실어 보낸다 — migrate 는 차단하지 않으며 (호출측 confirmation 영역), accept / migrate
//       구분 판단 근거를 verdict 로 전달할 뿐이다 (실 migration 수행 0).
// 입력 `buffer` / `options` 를 변형하지 않으며, 어떤 입력에서도 throw 하지 않는다 (같은 buffer
// 로 두 번 호출하면 동일 결과 — idempotent).
export function prepareImportRestoreInput(
  buffer: Buffer,
  options?: SchemaVersionCompatOptions,
): ImportRestoreInputResult {
  // (1) 1 단계 — 역직렬화 + 구조 검증 + version gate 합성 verdict. 비-Buffer / 빈 / 손상 JSON /
  // 구조 위반 / 호환 불가 version 은 전부 여기서 판정되며, stage 와 issues 를 그대로 흘려보낸다.
  const screened = screenImportDumpBuffer(buffer, options);
  if (!screened.ok) {
    return { ok: false, stage: screened.stage, issues: screened.issues };
  }

  // (2) 2 단계 — dump.records → FullExportRecord[] 타입 복원 (instant 를 Date 로, fields 는 값
  // 변환 0 으로 보존). 위반이 있으면 부분 결과 없이 누적 issues 만 "records" stage 로 분류해
  // 돌려준다.
  const hydrated = hydrateImportDumpRecords(screened.dump);
  if (!hydrated.ok) {
    return { ok: false, stage: "records", issues: hydrated.issues };
  }

  // (3) 전부 통과 — 다음 slice ($transaction 복원) 가 쓸 복원 입력과 version 판정 근거를 함께
  // 넘긴다. migrate 여부로 차단하지 않는다.
  return { ok: true, records: hydrated.records, version: screened.version };
}
