// import-dump-records-hydrate — UC-07 Import dump records 역직렬화(hydration) 순수 helper
// (T-1258, REQ-030 / REQ-032). [ADR-0055](../../docs/decisions/ADR-0055-import-multipart-file-upload.md)
// §Follow-up (b) 복원 엔진 chain (역직렬화 → 구조 검증 → schema version gate → **복원 plan 입력
// 복원** → ADR-0044 §3 atomic `$transaction` 복원 → controller 재배선) 의 **네 번째 slice** 다.
// T-1257 의 `screenImportDumpBuffer` 는 "복원 시도해도 되는 dump 인가" 까지 답하지만 그 결과
// `dump.records` 는 JSON round-trip 을 거친 plain object 배열 (instant 가 ISO string) 이라, 하류
// `buildImportRestorePlan` 이 요구하는 `ExportRecord[]` (`instant: Date`) 계약과 타입이 맞지
// 않는다 — 본 helper 가 그 gap 만 닫는다.
//
// 순수·non-mutating — DB · repository · file I/O · JSON 파싱 · schema version 판정 · 구조 무결성
// 재검증 (`validateImportDumpStructure` 재구현) · `buildImportRestorePlan` 호출 · REST 배선 0
// 이며, 상류 helper 의 규칙을 재구현하지 않고 **records 원소의 타입 복원만** 담당한다 (DRY —
// 구조 무결성의 source-of-truth 는 import-dump-validate.ts). REQ-032 (raw 미저장) 정합: 변환
// 결과를 어디에도 영속 저장하지 않는다. throw 0 verdict 패턴과 index 를 담은 한국어 위반 메시지
// convention 은 import-dump-validate.ts 를 mirror 한다.
import { ExportEntity, ExportRecord } from "../export/export-scope-select";

// 허용 5 entity (UC-07 §6.1 entitySelector 목록). import-dump-validate.ts 와 동일 집합이며 그쪽
// 상수가 export 되지 않아 같은 값을 로컬 mirror 한다 (선례 정합).
const ALL_ENTITIES: ReadonlyArray<ExportEntity> = [
  "Assessment",
  "Person",
  "Group",
  "LlmConfig",
  "AuditLog",
];

const VALID_ENTITY_SET: ReadonlySet<string> = new Set(ALL_ENTITIES);

// 역직렬화 verdict — discriminated union. 성공이면 입력 순서를 보존한 `ExportRecord[]`, 실패면
// 한국어 위반 목록을 돌려준다 (throw 0 — sibling 순수 helper 패턴 mirror). 실패 시 부분 결과는
// 돌려주지 않는다 (복원은 all-or-nothing — ADR-0044 §3 atomic 전제).
export type ImportDumpRecordsHydration =
  | { ok: true; records: ExportRecord[] }
  | { ok: false; issues: string[] };

// plain object(null/배열/비-object 아님) 판정 — dump 자체와 records 원소 검사에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 위반 메시지에 담을 값 종류 표기 — null 만 typeof 로 구분되지 않아 별도 처리한다.
function describeKind(value: unknown): string {
  return value === null ? "null" : typeof value;
}

// instant 복원 — `new Date(...)` 로 파싱 가능한 string (ISO 8601 이 정상 경로지만 RFC 2822 등
// 런타임이 파싱하는 다른 형식도 수용) 또는 유효한 `Date` instance 만 허용하고, 어느 쪽이든
// **새 Date 객체** 로 복사한다 (입력 원소의 Date 를 그대로 공유하지 않음 — non-mutating 보강).
// 빈 문자열 · 파싱 불가 문자열 · Invalid Date · number · null · 누락은 전부 null 로 거부한다.
function toInstant(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// hydrateImportDumpRecords — screening 을 통과한 dump 의 `records` 를 `ExportRecord[]` 로 복원한다.
// 분기는 3 개다:
//   (1) `dump.records` 가 배열이 아니면 (dump 자체가 plain object 가 아닌 경우 포함) → 단일 issue.
//   (2) 배열이면 각 원소를 검사해 — plain object 아님 / `entity` 가 5 허용 값 아님 / `instant` 가
//       유효 instant 로 복원 불가 — 위반마다 **그 index 를 담은 issue 를 누적** 한다 (early-return
//       아님 — 여러 위반을 한 번에 안내, import-dump-validate 패턴 정합).
//   (3) 위반 0 이면 입력 **순서를 보존한** 새 `ExportRecord[]` 로 `{ ok: true, records }` 반환.
// 입력 `dump` / `dump.records` / 원소 객체를 변형하지 않으며 (freeze 된 입력도 통과), 어떤
// 입력에서도 throw 하지 않는다.
export function hydrateImportDumpRecords(
  dump: Record<string, unknown>,
): ImportDumpRecordsHydration {
  // dump 자체가 plain object 가 아니면 field 접근 자체가 불가하므로 records 미상으로 취급한다
  // (구조 무결성은 상류 helper 책임 — 여기서는 throw 0 보장을 위한 최소 방어).
  const records = isPlainObject(dump) ? dump.records : undefined;

  // (1) 비-배열 분기 — 원소 검사에 진입하지 않는다.
  if (!Array.isArray(records)) {
    return {
      ok: false,
      issues: [`records 는 배열이어야 합니다 (받음: ${describeKind(records)})`],
    };
  }

  // (2) 원소별 검사 — 위반은 누적하고, 유효 원소만 새 객체로 복원해 둔다.
  const issues: string[] = [];
  const hydrated: ExportRecord[] = [];
  for (let index = 0; index < records.length; index += 1) {
    const record: unknown = records[index];
    if (!isPlainObject(record)) {
      issues.push(
        `records[${index}] 는 { entity, instant } 형태의 object 여야 합니다`,
      );
      continue;
    }

    const entity = record.entity;
    const entityValid =
      typeof entity === "string" && VALID_ENTITY_SET.has(entity);
    if (!entityValid) {
      issues.push(
        `records[${index}].entity 는 5 허용 entity 중 하나여야 합니다 (받음: ${String(
          entity,
        )})`,
      );
    }

    const instant = toInstant(record.instant);
    if (instant === null) {
      issues.push(
        `records[${index}].instant 는 Date 로 파싱 가능한 string 또는 유효한 Date instance 여야 합니다 (받음: ${describeKind(
          record.instant,
        )})`,
      );
    }

    if (entityValid && instant !== null) {
      hydrated.push({ entity: entity as ExportEntity, instant });
    }
  }

  // (3) 위반이 하나라도 있으면 부분 결과 없이 issues 만 돌려준다.
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, records: hydrated };
}
