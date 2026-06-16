// schema-version-compat — UC-07 Import schema version 호환 판정 순수 helper (T-0439, P7 R-57 /
// REQ-030 / REQ-032). T-0437 의 selectExportRecords(scope 선별) → T-0438 의 buildExportDump
// (dump envelope 조립, 직렬화 방향) 다음의 자연 building block 인 **역방향(Import) 입구의
// version gate** 다. 업로드된 dump 의 schemaVersion string 과 현재 시스템의
// EXPORT_SCHEMA_VERSION 만 비교해 호환 판정(UC-07 §6.3)을 plain verdict 로 반환만 한다 —
// persistence/repository/DB query · file parse · 무결성 hash · 압축 해제 · streaming · REST
// 배선 호출 0 이며, 실 migration 수행(§6.3 (i), P5 migration table 책임) · transaction(§7.5)도
// 본 helper 0 이다. "migrate 가능 후보" verdict 만 낸다.
//
// 코드 골격은 export-scope-select.ts / export-dump.ts 의 순수-helper 패턴(non-mutating + 입력
// 검증 + TypeError 분기 메시지)을 mirror 한다. "현재 시스템 version" default 는 새 상수를
// 신설하지 않고 export-dump.ts 의 EXPORT_SCHEMA_VERSION 을 그대로 재사용한다(UC-07 §6.3 의
// version mismatch source). REQ-032(raw 미저장)는 본 helper 가 version string 만 다뤄 raw 와
// 무관하므로 자연 유지된다.
import { EXPORT_SCHEMA_VERSION } from "./export-dump";

// 호환 판정 옵션 — currentVersion 부재 시 EXPORT_SCHEMA_VERSION default 적용,
// allowMigrationFrom 은 "현재 version 으로 자동 migration 이 허용된 과거 version 목록"
// (부재/빈 배열 시 migration 후보 없음 → mismatch 는 전부 reject).
export interface SchemaVersionCompatOptions {
  currentVersion?: string;
  allowMigrationFrom?: ReadonlyArray<string>;
}

// 호환 판정 verdict — plain object. accept 시 reason 생략, migrate/reject 시 reason 박제.
// compatible 은 "현재 schema 로 그대로 적용 가능한가"(accept 만 true), action 은 후속 배선이
// 실행할 분기(accept = 그대로 load, migrate = migration 후보, reject = 거부).
export interface SchemaVersionCompat {
  compatible: boolean;
  action: "accept" | "migrate" | "reject";
  uploadedVersion: string;
  currentVersion: string;
  reason?: string;
}

// 비어있지 않은 schema version string 검증 — 비-string / 빈 문자열 / 공백만이면 TypeError.
// export-dump.ts 의 assertValidDate 와 동형 message convention(label 을 메시지에 담음).
function assertVersionString(
  value: unknown,
  label: string,
): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(
      `checkSchemaVersionCompat: ${label} 은(는) 비어있지 않은 schemaVersion string 이어야 합니다 ` +
        `(받음: ${typeof value === "string" ? `"${value}"` : typeof value})`,
    );
  }
}

// checkSchemaVersionCompat — 업로드된 dump 의 schemaVersion 을 현재 시스템 version 과 비교해
// 호환 판정 verdict 를 반환한다. UC-07 §6.3 정합:
//   - uploadedVersion === currentVersion → { compatible: true, action: "accept" }(reason 생략).
//   - uploadedVersion !== currentVersion 이고 allowMigrationFrom 에 uploadedVersion 포함
//     → { compatible: false, action: "migrate", reason: "<uploaded>→<current> 자동 migration 후보" }
//     (§6.3 (i) — 본 helper 는 후보 판정만, 실 migration 0).
//   - uploadedVersion !== currentVersion 이고 migration 후보 아님
//     → { compatible: false, action: "reject", reason: "schema version mismatch: <uploaded> ≠ <current>" }
//     (§6.3 (ii) default — file 무결성 우선).
//
// 입력 인자를 변형하지 않으며(non-mutating — freeze 된 allowMigrationFrom 으로 호출해도 통과),
// allowMigrationFrom 부재/빈 배열 시 migration 후보가 없어 mismatch 는 전부 reject 된다.
// uploadedVersion / currentVersion(주어진 경우)이 비-string·빈 문자열·공백만이면 TypeError,
// allowMigrationFrom(주어진 경우)이 배열 아님 / 원소가 비-string 이면 TypeError 를 throw 한다.
export function checkSchemaVersionCompat(
  uploadedVersion: string,
  options: SchemaVersionCompatOptions = {},
): SchemaVersionCompat {
  assertVersionString(uploadedVersion, "uploadedVersion");

  // currentVersion 부재(undefined) 시 EXPORT_SCHEMA_VERSION default. 명시된 경우 동일 검증.
  const currentVersion = options.currentVersion ?? EXPORT_SCHEMA_VERSION;
  if (options.currentVersion !== undefined) {
    assertVersionString(options.currentVersion, "currentVersion");
  }

  // allowMigrationFrom 검증 — 주어진 경우 배열이어야 하고 원소가 전부 string 이어야 한다.
  const allowMigrationFrom = options.allowMigrationFrom;
  if (allowMigrationFrom !== undefined) {
    if (!Array.isArray(allowMigrationFrom)) {
      throw new TypeError(
        `checkSchemaVersionCompat: allowMigrationFrom 은(는) string 배열이어야 합니다 ` +
          `(받음: ${typeof allowMigrationFrom})`,
      );
    }
    for (let index = 0; index < allowMigrationFrom.length; index += 1) {
      if (typeof allowMigrationFrom[index] !== "string") {
        throw new TypeError(
          `checkSchemaVersionCompat: allowMigrationFrom[${index}] 은(는) string 이어야 합니다 ` +
            `(받음: ${typeof allowMigrationFrom[index]})`,
        );
      }
    }
  }

  // version 일치 → accept(현재 schema 로 그대로 적용 가능, reason 생략).
  if (uploadedVersion === currentVersion) {
    return {
      compatible: true,
      action: "accept",
      uploadedVersion,
      currentVersion,
    };
  }

  // mismatch 이고 자동 migration 허용 목록에 포함 → migrate 후보(§6.3 (i)).
  if (
    allowMigrationFrom &&
    allowMigrationFrom.indexOf(uploadedVersion) !== -1
  ) {
    return {
      compatible: false,
      action: "migrate",
      uploadedVersion,
      currentVersion,
      reason: `${uploadedVersion}→${currentVersion} 자동 migration 후보`,
    };
  }

  // mismatch 이고 migration 후보 아님 → reject(§6.3 (ii) default, file 무결성 우선).
  return {
    compatible: false,
    action: "reject",
    uploadedVersion,
    currentVersion,
    reason: `schema version mismatch: ${uploadedVersion} ≠ ${currentVersion}`,
  };
}
