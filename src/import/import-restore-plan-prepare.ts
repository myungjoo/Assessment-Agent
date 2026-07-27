// import-restore-plan-prepare — UC-07 Import 복원 plan 준비 순수 helper (T-1260, REQ-030 / REQ-032).
// [ADR-0055](../../docs/decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원
// 엔진 chain (역직렬화 → 구조 검증 → version gate → records hydrate → 복원 입력 합성 →
// **복원 plan 산출** → ADR-0044 §3 atomic `$transaction` 복원 → controller 재배선) 의 **여섯 번째
// slice** 다. T-1259 의 `prepareImportRestoreInput` (buffer → `FullExportRecord[]` + version 판정,
// T-1268 이 `ExportRecord[]` 에서 좁힘) 과
// T-0442 의 `buildImportRestorePlan` (기존 + incoming + mode → plan) 은 각각 머지됐지만 서로
// 배선되지 않았고, Prisma `ImportMode` (REPLACE / MERGE) ↔ `ImportRestoreMode` (replace / merge)
// 를 잇는 경로도 없었다. 게다가 `buildImportRestorePlan` 은 **throw 계약** 이라 verdict 계약인
// 상류 chain 과 그대로 이어붙일 수 없다 — 본 helper 가 그 합성 + mode 매핑 + throw→verdict 흡수
// 한 겹만 닫아, 다음 slice (실 `$transaction` 복원) 가 **plan 하나만 받아 실행** 하면 되도록
// 단일 계약을 만든다.
//
// 순수·non-mutating — DB · repository · file I/O · Prisma client 호출 · `$transaction` · REST
// 배선 0 이며 (`ImportMode` 는 enum 값만 import), 상류/하류 helper 의 규칙 (JSON 파싱 · 구조 검증 ·
// version 판정 · records 복원 · replace/merge 분류) 을 재구현하지 않고 **mode 매핑 + 호출 순서 +
// 실패 stage 분류** 만 담당한다 (DRY — 각 규칙의 source-of-truth 는 각 helper). REQ-032 (raw
// 미저장) 정합: 변환 결과를 어디에도 영속 저장하지 않으며 실패 시에도 stack / raw error 객체를
// 노출하지 않는다.
import { ImportMode } from "@prisma/client";

import type { FullExportRecord } from "../export/export-full-record";
import type { ExportRecord } from "../export/export-scope-select";
import {
  buildImportRestorePlan,
  type ImportRestoreMode,
  type ImportRestorePlan,
} from "../export/import-restore-plan";
import type {
  SchemaVersionCompat,
  SchemaVersionCompatOptions,
} from "../export/schema-version-compat";

import {
  prepareImportRestoreInput,
  type ImportRestoreInputStage,
} from "./import-restore-input";

// 실패가 발생한 준비 단계 — 상류 복원 입력 stage ("deserialize" | "structure" | "version" |
// "records") 를 재사용하고 본 helper 고유의 두 단계만 덧붙인다 (문자열 리터럴 재선언 0 — 상류
// stage 가 늘어나면 자동 추종). "mode" 는 Prisma enum 매핑 실패, "plan" 은 plan 산출 helper 의
// throw 를 흡수한 단계다.
export type ImportRestorePlanStage = ImportRestoreInputStage | "mode" | "plan";

// 복원 plan 준비 verdict — discriminated union. 성공이면 ADR-0044 §3 `$transaction` 복원이 그대로
// 소비할 plan 과 그 근거 (복원된 records + version 호환 판정) 를 함께 돌려주고, 실패면 실패
// stage 와 한국어 위반 목록만 돌려준다 (throw 0 — sibling 순수 helper 패턴 mirror). 실패 시
// 부분 결과 (plan / records) 는 돌려주지 않는다 (복원은 all-or-nothing).
//
// T-1269 증분 — 성공 갈래를 `plan: ImportRestorePlan<FullExportRecord>` + `records:
// FullExportRecord[]` 로 **좁힌다** (chain 타입 전파 leg 2/2). 런타임에는 T-1265 이후 이미 그 값이
// 흐르지만 (상류 T-1268 이 `prepareImportRestoreInput` 을 `FullExportRecord[]` 로 좁혔고, T-1266 이
// plan 을 `ImportRestorePlan<TInsert>` 로 일반화했다) 여기서 다시 넓게 선언돼 `fields` 가 타입 상
// 사라졌다. 좁혀야 다음 slice 의 `$transaction` 이 `plan.toInsert[i].fields` 를 캐스팅 없이
// `createMany({ data })` 에 넣을 수 있다. `FullExportRecord` 는 `ExportRecord` 의 구조적 subtype 이라
// 넓힘 대입 (covariance) 으로 기존 소비처는 한 줄도 고치지 않고 그대로 컴파일된다.
export type ImportRestorePlanPrepareResult =
  | {
      ok: true;
      plan: ImportRestorePlan<FullExportRecord>;
      records: FullExportRecord[];
      version: SchemaVersionCompat;
    }
  | { ok: false; stage: ImportRestorePlanStage; issues: string[] };

// Prisma ImportMode → 하류 helper 의 ImportRestoreMode 매핑표. enum 멤버가 아닌 값은 lookup 이
// undefined 를 돌려주므로 그대로 거부 근거가 된다 (import-job.service 의
// `Object.values(ImportMode).includes(...)` 방어와 동일 취지의 런타임 방어).
const MODE_MAP: ReadonlyMap<ImportMode, ImportRestoreMode> = new Map<
  ImportMode,
  ImportRestoreMode
>([
  [ImportMode.REPLACE, "replace"],
  [ImportMode.MERGE, "merge"],
]);

// 임의 값의 **안전한** 문자열 표기 — `String(value)` 는 primitive 변환이 불가능한 값
// (`Object.create(null)` · `Symbol.toPrimitive` / `toString` 이 throw 하는 객체 등) 에서 자체적으로
// throw 하므로, 본 helper 의 "어떤 입력에서도 throw 하지 않는다" 계약을 깨뜨린다. 그래서
// 문자열은 그대로, 그 밖의 primitive 는 String 변환, 객체류는 try/catch 로 감싸 실패 시
// `typeof` 표기로 대체한다 (표기 실패가 verdict 실패를 throw 로 바꾸지 않도록).
function describeUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }
  try {
    return String(value);
  } catch {
    // 문자열화 자체가 실패한 값 — 종류만 알린다 (raw 객체 · stack 미노출, REQ-032 정합).
    return `[문자열화 불가 ${typeof value} 값]`;
  }
}

// throw → issue 문자열 흡수 — message 만 취하고 stack / Error 객체는 노출하지 않는다 (REQ-032
// 정합). Error 가 아닌 값이 throw 돼도 안전 표기로 바꿔 계약 (issues: string[]) 을 유지한다.
function toIssue(error: unknown): string {
  return describeUnknown(error instanceof Error ? error.message : error);
}

// prepareImportRestorePlan — 업로드 dump buffer + 메모리에 올라온 기존 record 배열 + Prisma
// ImportMode 를 받아 `$transaction` 복원이 그대로 실행할 복원 plan 까지 준비한다.
// 동작은 **단락 평가 3 단계** 다:
//   (1) mode 매핑 — REPLACE → "replace", MERGE → "merge". enum 멤버가 아닌 값 (소문자 / "PATCH" /
//       null / undefined / number / 객체) 은 stage "mode" 로 즉시 거부하며 **buffer 파싱을 시도
//       하지 않는다** (잘못된 mode 로는 어떤 plan 도 낼 수 없으므로 파싱 비용이 낭비다).
//   (2) `prepareImportRestoreInput` 실패 → 그 stage 와 issues 를 **그대로** 전달 (재가공 0).
//       plan 산출은 실행하지 않는다 — records 가 아직 보장되지 않은 입력으로 분류할 이유가 없다.
//   (3) `buildImportRestorePlan` 호출 — 그 helper 는 throw 계약 (비-배열 existing / Invalid Date
//       원소 → TypeError) 이라 본 helper 가 stage "plan" verdict 로 흡수한다.
//   (4) 전부 통과 → { ok: true, plan, records, version }. version 판정은 상류 결과를 재해석 없이
//       그대로 실어 보내며 action === "migrate" 를 차단하지 않는다 (차단 판단은 호출측 몫).
// 입력 `buffer` / `existing` / `options` 를 변형하지 않으며, 어떤 입력에서도 throw 하지 않는다
// (같은 입력으로 두 번 호출하면 동일 결과 — idempotent).
export function prepareImportRestorePlan(
  buffer: Buffer,
  existing: ReadonlyArray<ExportRecord>,
  mode: ImportMode,
  options?: SchemaVersionCompatOptions,
): ImportRestorePlanPrepareResult {
  // (1) mode 매핑 — 실패 시 buffer 파싱 이전에 단락 종료.
  const restoreMode = MODE_MAP.get(mode);
  if (restoreMode === undefined) {
    return {
      ok: false,
      stage: "mode",
      issues: [
        `prepareImportRestorePlan: mode 는 REPLACE 또는 MERGE 여야 합니다 (받음: ${describeUnknown(mode)})`,
      ],
    };
  }

  // (2) 복원 입력 준비 — 역직렬화 / 구조 / version / records 실패 stage 를 그대로 흘려보낸다.
  const input = prepareImportRestoreInput(buffer, options);
  if (!input.ok) {
    return { ok: false, stage: input.stage, issues: input.issues };
  }

  // (3) plan 산출 — throw 계약을 verdict 로 흡수 (stack / raw error 미노출).
  let plan: ImportRestorePlan<FullExportRecord>;
  try {
    plan = buildImportRestorePlan(existing, input.records, restoreMode);
  } catch (error) {
    return { ok: false, stage: "plan", issues: [toIssue(error)] };
  }

  // (4) 전부 통과 — 다음 slice ($transaction 복원) 가 쓸 plan 과 그 판단 근거를 함께 넘긴다.
  return { ok: true, plan, records: input.records, version: input.version };
}
