// import-restore-step-call — UC-07 Import 복원 step 1 건을 Prisma 호출 서술로 옮기는 순수 dispatch
// (T-1273, REQ-030 / REQ-032). ADR-0055 §Follow-up (b) 복원 엔진 chain 실행 조각 중 **3a** — 1/3
// (insert row) · 2a (instant 목록) · 2b (`where`) 가 만든 값을 **고르기만** 하는 마지막 순수 조각이며
// 다음 slice 3b 가 이 서술을 tx client 에 태운다. 하지 않는 것: Prisma client · `$transaction` · DB ·
// file I/O · REST 배선 0 (3b) / `where` · row 값 조립 0 (2b · 1/3 위임 — 사본 0 이라 그쪽 한국어
// throw 를 **그대로 전파**). 순수 · non-mutating — 입력 step / records / Date / `fields` 와 표를 변형
// 하지 않고 (freeze 입력도 통과) 매 호출 새 객체를 돌려주되 `args` 안의 값 identity 는 하류 규약
// 그대로다. REQ-032: error 메시지에 payload · stack 0.
import {
  EXPORT_ENTITY_SOURCES,
  type ExportEntityDelegate,
} from "../export/export-entity-sources";
import { type ExportEntity } from "../export/export-scope-select";

import { buildImportRestoreDeleteWhere } from "./import-restore-delete-where";
import { buildImportRestoreInsertRows } from "./import-restore-insert-rows";
import {
  type ImportRestoreStepMethod,
  type ImportRestoreTransactionStep,
} from "./import-restore-steps";

// 하류 3b 가 `tx[delegate][method](args)` 로 옮길 서술 1 건 — `args` 는 phase discriminated.
export interface ImportRestoreStepCall {
  delegate: ExportEntityDelegate;
  method: ImportRestoreStepMethod;
  args:
    | { where: Record<string, { in: Date[] }> }
    | { data: Record<string, unknown>[] };
}

// enum 토큰 전용 안전 표기 (string 은 값, 그 외 타입 이름) — T-1272 `tokenOf` **사본** (추출 대기).
function tokenOf(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return value === null ? "null" : typeof value;
}

// entity 판정 — `in` · 직접 인덱싱 대신 `hasOwnProperty.call` 로 표의 **자기 속성** 만 인정 (2b 동형).
// 표는 plain object 라 `"constructor"` / `"__proto__"` 는 `in` 으로 잡히고 그러면 `delegate` 가
// undefined 라 3b 가 tx client 를 undefined key 로 인덱싱한다 (3b 가 잡을 수 없는 사고).
function isOwnExportEntity(value: unknown): value is ExportEntity {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(EXPORT_ENTITY_SOURCES, value)
  );
}

// buildImportRestoreStepCall — 판정 순서는 phase (두 literal 밖이면 **어느 builder 도 부르기 전에**
// RangeError) → entity 자기 속성 → `delegate` drift (덮지 않고 알림) → 값 조립 위임.
export function buildImportRestoreStepCall(
  step: ImportRestoreTransactionStep,
): ImportRestoreStepCall {
  // null / undefined 만 필드 읽기가 터진다 (원시값 · 배열은 undefined) — 빈 객체로 낮춰 읽으면 phase
  // 판정이 먼저 걸려 본 helper 의 한국어 throw 로 거부된다.
  const candidate: unknown = step;
  const shape = (candidate ?? {}) as Record<string, unknown>;
  const phase: unknown = shape.phase;
  if (phase !== "delete" && phase !== "insert") {
    throw new RangeError(
      `buildImportRestoreStepCall: step.phase 는 delete/insert 중 하나여야 합니다 (받음: ${tokenOf(phase)})`,
    );
  }

  // insert 갈래는 하류가 entity 를 아예 읽지 않으므로 이 검사가 **유일한 그물** 이다.
  const entity: unknown = shape.entity;
  const declared: unknown = shape.delegate;
  if (!isOwnExportEntity(entity)) {
    throw new RangeError(
      `buildImportRestoreStepCall: entity 는 export entity 5 종 중 하나여야 합니다 (받음: ${tokenOf(entity)})`,
    );
  }

  const delegate = EXPORT_ENTITY_SOURCES[entity].delegate;
  if (declared !== undefined && declared !== delegate) {
    throw new RangeError(
      `buildImportRestoreStepCall: step.delegate 가 표의 매핑과 다릅니다 (entity ${entity} 는 ${delegate}, 받음: ${tokenOf(declared)})`,
    );
  }

  // 값 조립은 전량 위임 — 두 builder 의 한국어 throw 는 감싸지 않고 그대로 전파된다.
  const method = phase === "delete" ? "deleteMany" : "createMany";
  const args =
    phase === "delete"
      ? { where: buildImportRestoreDeleteWhere(step) }
      : { data: buildImportRestoreInsertRows(step) };
  return { delegate, method, args };
}
