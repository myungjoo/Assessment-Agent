// export-import-audit — UC-07 Export/Import Audit log 항목 조립 순수 helper (T-0443, P7 R-57 /
// REQ-030 / REQ-032 / REQ-045). T-0437 의 selectExportRecords(scope 선별) → T-0438 의
// buildExportDump(dump 조립) → T-0439 checkSchemaVersionCompat(version gate) → T-0440
// validateImportDumpStructure(구조 무결성 gate) → T-0441 summarizeImportImpact(영향 요약) →
// T-0442 buildImportRestorePlan(복원 plan) 다음의 자연 building block 이다. 위 6 개 단추는
// Export 선별·조립과 Import 검증·복원 plan 까지 cover 했으나, UC-07 §8 (b) Export Audit row 와
// §8 (e) Import Audit row — 두 분기 모두에서 의무인 "Audit log 1 row 생성(operation 종류 +
// actor + scope/file source + row count)"(§5 step 12)은 아직 어떤 helper 도 cover 하지 않는다.
// 본 helper 는 그 audit 항목을 순수 derivation 으로 박제한다 — operation 종류(export/import) +
// actor 식별자 + 권한 등급 + scope/source context + row count + 발생 시각(instant)을 받아
// 직렬화 가능한 plain audit entry 객체를 조립하는 순수 함수다.
//
// 실 Audit log row insert / repository / Prisma / transaction / DB 호출 0 이며(UC-07 §5 step 12,
// §8 (b)(e) 게이트된 후속 sub-slice 책임), file parse / source 의 실 hash·무결성 검증도 본
// helper 0 이다 — source 는 식별 문자열로만 받아 박제한다. dump query / 복원 transaction 도 본
// helper 0 — T-0438 / T-0442 가 산출한 dump·plan 을 소비만 하고 재계산하지 않는다.
// 코드 골격은 export-dump.ts / import-restore-plan.ts 의 순수-helper 패턴(plain 결과 interface +
// non-mutating + assertValidDate 한국어 메시지 convention + VALID set 입력 방어)을 mirror 하고,
// 타입은 새로 신설하지 않고 export-scope-select.ts 의 ExportScope, export-dump.ts 의 ExportDump,
// import-restore-plan.ts 의 ImportRestoreMode / ImportRestorePlan 을 재사용한다.
// REQ-032(raw 미저장)는 본 helper 가 count / scope / source metadata 만 다루고 raw 를 새로 fetch
// 하지 않으므로 helper layer 에서 자연 유지된다(UC-07 §1 invariant (a)).
import { ExportDump } from "./export-dump";
import { ExportScope } from "./export-scope-select";
import { ImportRestoreMode, ImportRestorePlan } from "./import-restore-plan";

// audit operation 종류 — UC-07 §8 (b) Export / §8 (e) Import 두 분기.
export type ExportImportAuditOperation = "export" | "import";

const VALID_OPERATIONS: ReadonlySet<string> = new Set(["export", "import"]);

// actor 권한 등급 — UC-07 §2 (Admin / SuperAdmin). 그 외 등급은 export/import 권한 밖이라 거부.
export type AuditActorRole = "Admin" | "SuperAdmin";

const VALID_ROLES: ReadonlySet<string> = new Set(["Admin", "SuperAdmin"]);

// audit entry 입력 — operation 에 맞는 sub-payload(export 또는 import) 필수. actor 식별자 +
// 권한 등급 + 발생 시각(ISO 직렬화 대상)은 분기 공통. export 분기는 T-0438 dump 를, import
// 분기는 T-0442 plan + mode + 선택적 source 를 소비만 한다(재계산 0).
export interface ExportImportAuditInput {
  operation: ExportImportAuditOperation;
  actor: { id: string; role: AuditActorRole };
  occurredAt: Date;
  export?: { scope: ExportScope; dump: ExportDump };
  import?: {
    mode: ImportRestoreMode;
    plan: ImportRestorePlan;
    source?: string;
  };
}

// export 분기 detail — UC-07 §8 (b) "Export 종류 + scope + row count". scope 요약 + entity 별
// count 박제(dump 와 동일한 ground truth, 재계산 0).
export interface ExportAuditDetail {
  scope: ExportScope;
  entityCounts: ExportDump["entityCounts"];
}

// import 분기 detail — UC-07 §8 (e) "Import 종류 + file source + 복원된 row count". mode +
// plan 세 배열 length + source(부재 시 null) 박제.
export interface ImportAuditDetail {
  mode: ImportRestoreMode;
  deleted: number;
  inserted: number;
  kept: number;
  source: string | null;
}

// 조립된 audit entry — 직렬화 가능한 plain object. operation 종류 + actor 식별자/등급 +
// 발생 시각(ISO string) + row count + 분기별 detail. 항상 새 객체(non-mutating).
export interface ExportImportAuditEntry {
  operation: ExportImportAuditOperation;
  actorId: string;
  actorRole: AuditActorRole;
  occurredAt: string;
  rowCount: number;
  detail: ExportAuditDetail | ImportAuditDetail;
}

// Invalid Date / 비-Date 입력은 명시적 error (export-dump.assertValidDate 와 동형 message
// convention — 해당 helper 가 export 되지 않아 본 파일에 mirror 한다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `buildExportImportAuditEntry: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// buildExportImportAuditEntry — operation(export/import) + actor + occurredAt + 분기 sub-payload 를
// 받아 직렬화 가능한 audit entry 를 순수 derivation 으로 조립한다. UC-07 §5 step 12 / §8 (b)(e)
// 정합:
//   - export 분기: rowCount = dump.recordCount(dump 와 동일한 ground truth 1 개 선택),
//     detail.scope 는 dump.scope 가 아니라 입력 export.scope 박제, detail.entityCounts 는
//     dump.entityCounts 박제.
//   - import 분기: rowCount = plan.toInsert.length(UC-07 §8 (e) "복원된 row count"),
//     detail.mode 는 입력 mode, detail.deleted/inserted/kept 는 plan 세 배열 length,
//     detail.source 는 입력 source ?? null.
//   - occurredAt 은 toISOString() 으로 직렬화(비-Date/Invalid Date 시 TypeError).
//
// 입력 객체·배열·중첩 dump/plan 을 변형하지 않고 항상 새 객체를 반환한다(non-mutating, freeze 된
// 입력으로 호출해도 통과). 입력 방어(transaction 전 안전):
//   - input 부재(null/undefined) → TypeError.
//   - operation 이 "export"/"import" 외 값 → RangeError.
//   - actor 부재 또는 actor.id 비-string → TypeError, actor.role 이 허용 등급 외 → RangeError.
//   - occurredAt 이 비-Date/Invalid Date → TypeError.
//   - operation="export" 인데 export sub-payload(또는 dump) 부재 → TypeError.
//   - operation="import" 인데 import sub-payload(또는 plan) 부재 → TypeError.
export function buildExportImportAuditEntry(
  input: ExportImportAuditInput,
): ExportImportAuditEntry {
  if (!input) {
    throw new TypeError(
      `buildExportImportAuditEntry: input 은 operation/actor/occurredAt 을 담은 객체여야 합니다 (받음: ${String(
        input,
      )})`,
    );
  }

  // operation 검증 먼저 — 분기 진입 전 거부(대소문자 mismatch / null / 숫자 모두 reject).
  if (
    typeof input.operation !== "string" ||
    !VALID_OPERATIONS.has(input.operation)
  ) {
    throw new RangeError(
      `buildExportImportAuditEntry: operation 은 export/import 중 하나여야 합니다 (받음: ${String(
        input.operation,
      )})`,
    );
  }

  // actor 검증 — 부재 / id 비-string 은 TypeError, role 이 허용 등급 외면 RangeError.
  const actor = input.actor;
  if (!actor || typeof actor.id !== "string") {
    throw new TypeError(
      `buildExportImportAuditEntry: actor 는 id(string) 와 role 을 담은 객체여야 합니다 (받음: ${String(
        actor && actor.id,
      )})`,
    );
  }
  if (!VALID_ROLES.has(actor.role)) {
    throw new RangeError(
      `buildExportImportAuditEntry: actor.role 은 Admin/SuperAdmin 중 하나여야 합니다 (받음: ${String(
        actor.role,
      )})`,
    );
  }

  // occurredAt 검증 + ISO 직렬화 — 비-Date/Invalid Date 면 TypeError.
  assertValidDate(input.occurredAt, "occurredAt");
  const occurredAt = input.occurredAt.toISOString();

  if (input.operation === "export") {
    // export 분기 — export sub-payload + dump 필수. rowCount 는 dump.recordCount 를 ground
    // truth 로 박제(entityCounts 합과 불일치하더라도 dump.recordCount 우선).
    const payload = input.export;
    if (!payload || !payload.dump) {
      throw new TypeError(
        "buildExportImportAuditEntry: operation=export 에는 export.dump sub-payload 가 필요합니다",
      );
    }
    const dump = payload.dump;
    return {
      operation: "export",
      actorId: actor.id,
      actorRole: actor.role,
      occurredAt,
      rowCount: dump.recordCount,
      detail: {
        scope: payload.scope,
        // 입력 dump 의 entityCounts 를 새 객체로 복사해 박제(non-mutating — 원본 공유 0).
        entityCounts: { ...dump.entityCounts },
      },
    };
  }

  // import 분기 — import sub-payload + plan 필수. rowCount 는 복원된 row 수 = plan.toInsert.length.
  const payload = input.import;
  if (!payload || !payload.plan) {
    throw new TypeError(
      "buildExportImportAuditEntry: operation=import 에는 import.plan sub-payload 가 필요합니다",
    );
  }
  const plan = payload.plan;
  return {
    operation: "import",
    actorId: actor.id,
    actorRole: actor.role,
    occurredAt,
    rowCount: plan.toInsert.length,
    detail: {
      mode: payload.mode,
      deleted: plan.toDelete.length,
      inserted: plan.toInsert.length,
      kept: plan.toKeep.length,
      // source 부재(undefined) 시 null 로 박제 — 빈 문자열은 그대로 보존(구분).
      source: payload.source ?? null,
    },
  };
}
