// import-preflight-summary — UC-07 Import 사전 검증 결과 통합 go/no-go 순수 helper (T-0452, P7
// R-57 / REQ-030 / REQ-032). T-0437 selectExportRecords → T-0438 buildExportDump → T-0439
// checkSchemaVersionCompat → T-0440 validateImportDumpStructure → T-0441 summarizeImportImpact →
// T-0442 buildImportRestorePlan → T-0443 buildExportImportAuditEntry → T-0444 validateExportScope
// → T-0445 상수 DRY → T-0446 computeDumpChecksum/verifyDumpChecksum → T-0448 summarizeRestorePlan
// → T-0449 summarizeExportSelection → T-0450 validateImportDumpSize → T-0451
// detectImportMergeConflicts 의 다음 게이트-free 단추다. 위 14 helper 가 Import 사전 검증을
// **개별 verdict 단위**로 박제했으나, UC-07 §7.4("transaction 시작 전 reject — DB 변경 0") +
// §7.3(payload 검증 실패 → 400 + 검증 메시지) 가 요구하는 **"이 모든 검증을 한데 모은 단일
// go/no-go 결정"** 은 그 14 helper 중 0 회 cover 됐다. 본 helper 는 이미 산출된 sub-verdict 들을
// 입력으로 받아(재실행 0 — 순수 DRY 합성) { proceed, blockingIssues, warnings, summary } 단일
// 보고로 통합한다.
//
// persistence / repository / transaction / REST 호출 0, sub-verdict 의 **재계산** 0(본 helper 는
// 이미 산출된 verdict 를 합성만 — validateImportDumpStructure / checkSchemaVersionCompat /
// validateImportDumpSize / verifyDumpChecksum / detectImportMergeConflicts 를 본 helper 안에서
// 호출 금지), 새 도메인 타입 신설 0(5 sub-verdict + ExportEntity 재사용), 새 외부 dependency 0.
// 코드 골격은 sibling helper 들의 순수-helper 패턴(입력 방어 throw + 한국어 message + non-
// mutating)을 mirror 한다. 단 본 helper 는 합성 verdict 의 입력이 "이미 통과한 sub-verdict" 라는
// 계약이므로 **입력 shape 불일치는 TypeError**(verdict 가 아니라 호출측 배선 버그). REQ-032(raw
// 미저장)는 입력 verdict 의 boolean/enum 만 다루고 raw 를 새로 fetch 하지 않으므로 자연 유지된다.
import { DumpChecksumVerification } from "./export-dump-checksum";
import { ImportDumpSizeVerdict } from "./import-dump-size-validate";
import { ImportDumpValidation } from "./import-dump-validate";
import { ImportMergeConflictReport } from "./import-merge-conflict";
import { SchemaVersionCompat } from "./schema-version-compat";

// 사전 검증 sub-verdict 묶음 — 4 필수(structure / version / size / checksum) + 1 선택
// (mergeConflict, merge mode 일 때만 제공 — replace mode 면 부재). 본 helper 는 이 5 verdict 를
// 입력으로만 받고 어떤 것도 재계산하지 않는다(게이트-free DRY 합성).
export interface ImportPreflightVerdicts {
  structure: ImportDumpValidation;
  version: SchemaVersionCompat;
  size: ImportDumpSizeVerdict;
  checksum: DumpChecksumVerification;
  mergeConflict?: ImportMergeConflictReport;
}

// 통합 go/no-go 보고 — plain object. proceed 는 blockingIssues 가 빈 배열일 때만 true
// (proceed === (blockingIssues.length === 0) 불변), blockingIssues 는 transaction 진행을 막는
// 위반의 한국어 누적 목록(즉시 throw 0 — 전부 모아서 보고, UC-07 §7.4), warnings 는 진행은
// 가능하나 사용자 confirmation 영역인 항목(version migrate / mergeConflict)의 한국어 누적 목록,
// summary 는 사람이 읽을 한국어 요약 1 줄.
export interface ImportPreflightReport {
  proceed: boolean;
  blockingIssues: string[];
  warnings: string[];
  summary: string;
}

// 허용 schema version action enum — SchemaVersionCompat.action 의 3 값. 입력 방어에서 이 집합
// 밖의 값은 호출측 배선 버그로 보아 TypeError.
const VALID_VERSION_ACTIONS: ReadonlySet<string> = new Set([
  "accept",
  "migrate",
  "reject",
]);

// plain object(null / 배열 / 비-object 아님) 판정 — sub-verdict 입력 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 필수 sub-verdict 가 object 인지 — 부재 / 비-object(string / number / 배열 / null) 면 TypeError.
function assertVerdictObject(
  value: unknown,
  label: string,
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new TypeError(
      `summarizeImportPreflight: ${label} verdict 는 object 여야 합니다 ` +
        `(받음: ${
          value === undefined
            ? "undefined"
            : value === null
              ? "null"
              : Array.isArray(value)
                ? "array"
                : typeof value
        })`,
    );
  }
}

// boolean field 검증 — 비-boolean(예: structure.valid 가 truthy string) 이면 TypeError.
function assertBooleanField(
  value: unknown,
  label: string,
): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(
      `summarizeImportPreflight: ${label} 은(는) boolean 이어야 합니다 (받음: ${typeof value})`,
    );
  }
}

// summarizeImportPreflight — 이미 산출된 4 필수 + 1 선택 sub-verdict 를 받아 transaction 전
// 단일 go/no-go 보고로 통합한다(UC-07 §7.4 정합):
//   - blocking 분기: structure.valid === false OR size.valid === false OR checksum.valid === false
//     OR version.action === "reject" → blockingIssues 에 각 사유 누적(즉시 throw 0 — 전부 모음).
//   - warning 분기: version.action === "migrate"(§6.3 (i) migration 후보 — confirmation 영역) /
//     mergeConflict.hasConflict === true(§6.2 file 우선 — confirmation 영역) → warnings 에 누적.
//   - proceed === (blockingIssues.length === 0). summary 는 blocking / warning 건수 기반 한국어 1 줄.
//
// 입력 인자를 변형하지 않으며(non-mutating — freeze 된 verdict 로 호출해도 통과, 반환은 새 객체),
// 입력 묶음이 null / undefined, 필수 sub-verdict 부재 / 비-object, valid 가 비-boolean,
// version.action 이 미허용 enum, mergeConflict 가 제공됐으나 hasConflict 비-boolean 이면
// 한국어 메시지 TypeError 를 throw 한다(이미 통과한 verdict 라는 입력 계약 위반 = 배선 버그).
export function summarizeImportPreflight(
  verdicts: ImportPreflightVerdicts,
): ImportPreflightReport {
  // 입력 묶음 자체 방어 — null / undefined / 비-object 면 하위 field 접근 불가.
  if (!isPlainObject(verdicts)) {
    throw new TypeError(
      `summarizeImportPreflight: verdicts 는 object 여야 합니다 ` +
        `(받음: ${
          verdicts === undefined
            ? "undefined"
            : verdicts === null
              ? "null"
              : Array.isArray(verdicts)
                ? "array"
                : typeof verdicts
        })`,
    );
  }

  // 4 필수 sub-verdict 의 object + 핵심 field shape 방어. 각 부재마다 별도 메시지.
  assertVerdictObject(verdicts.structure, "structure");
  assertBooleanField(verdicts.structure.valid, "structure.valid");

  assertVerdictObject(verdicts.version, "version");
  if (
    typeof verdicts.version.action !== "string" ||
    !VALID_VERSION_ACTIONS.has(verdicts.version.action)
  ) {
    throw new TypeError(
      `summarizeImportPreflight: version.action 은(는) "accept" | "migrate" | "reject" ` +
        `중 하나여야 합니다 (받음: ${String(verdicts.version.action)})`,
    );
  }

  assertVerdictObject(verdicts.size, "size");
  assertBooleanField(verdicts.size.valid, "size.valid");

  assertVerdictObject(verdicts.checksum, "checksum");
  assertBooleanField(verdicts.checksum.valid, "checksum.valid");

  // mergeConflict 는 선택 입력 — 제공된 경우에만 shape 방어(replace mode 면 부재가 정상).
  const mergeConflict = verdicts.mergeConflict;
  if (mergeConflict !== undefined) {
    assertVerdictObject(mergeConflict, "mergeConflict");
    assertBooleanField(mergeConflict.hasConflict, "mergeConflict.hasConflict");
  }

  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  // blocking 분기 — 각 위반을 모두 누적(early-return 0). 순서: structure → version → size →
  // checksum(사용자가 검증 단계 순서로 읽도록).
  if (verdicts.structure.valid === false) {
    blockingIssues.push("dump 구조 검증 실패 (structure invalid)");
  }
  if (verdicts.version.action === "reject") {
    const reason = verdicts.version.reason;
    blockingIssues.push(
      `schema version 호환 불가 (version reject)${
        typeof reason === "string" && reason.length > 0 ? ` — ${reason}` : ""
      }`,
    );
  }
  if (verdicts.size.valid === false) {
    blockingIssues.push("dump 크기 한계 초과 (size invalid)");
  }
  if (verdicts.checksum.valid === false) {
    blockingIssues.push("dump 무결성 checksum 불일치 (checksum invalid)");
  }

  // warning 분기 — 진행 차단은 아니나 사용자 confirmation 영역. version migrate + mergeConflict.
  if (verdicts.version.action === "migrate") {
    const reason = verdicts.version.reason;
    warnings.push(
      `schema version 자동 migration 후보 (version migrate)${
        typeof reason === "string" && reason.length > 0 ? ` — ${reason}` : ""
      }`,
    );
  }
  if (mergeConflict !== undefined && mergeConflict.hasConflict === true) {
    const total =
      typeof mergeConflict.total === "number" ? mergeConflict.total : 0;
    warnings.push(
      `merge 충돌 ${total}건 (file 우선 적용 또는 reject 결정 필요)`,
    );
  }

  const proceed = blockingIssues.length === 0;
  const summary = proceed
    ? warnings.length === 0
      ? "사전 검증 통과"
      : `사전 검증 통과 (경고 ${warnings.length}건)`
    : `사전 검증 실패 (차단 ${blockingIssues.length}건)`;

  return { proceed, blockingIssues, warnings, summary };
}
