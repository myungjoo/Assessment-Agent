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
//
// T-1265 (열한 번째 slice) 증분 — 실제 dump (`buildFullExportDump`) 는 원소마다 full-record
// payload `fields` 를 싣는데 본 helper 가 그것을 버려, 하류 `$transaction` step 의 `createMany`
// 에 넣을 row 값이 사라지는 gap 이 있었다. 이제 `fields` 를 **검증하고 보존** 한다:
//   - `fields` 는 필수이며 plain object 여야 한다 (legacy 하위호환 없음 — 완화는 별도 ADR).
//   - key 는 해당 entity 의 allow-list (`getExportEntityFullRecordSelect`) 안에만 있어야 한다.
//     ADR-0047 §Decision 2(b) 엄격 거부의 **import 방향 mirror** 로, `LlmConfig.apiKey` 같은
//     secret 이 복원 경로로 들어오는 것을 조립 단계에서 차단한다 (REQ-032).
//   - `fields` 의 **값** 은 들여다보지도 변환하지도 않는다 (타입 검증 0 · Date 복원 0). 위반
//     메시지에도 key 이름과 index 만 싣고 값은 절대 싣지 않는다.
// allow-list 5 entity 매핑은 export 측 single-source 를 import 재사용하며 본 파일에 사본을 두지
// 않는다.
import { getExportEntityFullRecordSelect } from "../export/export-entity-full-record-select";
import type { FullExportRecord } from "../export/export-full-record";
import { ExportEntity } from "../export/export-scope-select";

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

// 역직렬화 verdict — discriminated union. 성공이면 입력 순서를 보존한 `FullExportRecord[]`
// (= `ExportRecord` + `fields`), 실패면 한국어 위반 목록을 돌려준다 (throw 0 — sibling 순수
// helper 패턴 mirror). 실패 시 부분 결과는 돌려주지 않는다 (복원은 all-or-nothing — ADR-0044
// §3 atomic 전제). `FullExportRecord` 는 `ExportRecord` 의 구조적 superset 이라 기존 소비처
// (`prepareImportRestoreInput` 등) 는 수정 없이 그대로 컴파일된다.
export type ImportDumpRecordsHydration =
  | { ok: true; records: FullExportRecord[] }
  | { ok: false; issues: string[] };

// plain object(null/배열/비-object 아님) 판정 — dump 자체와 records 원소 검사에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 위반 메시지에 담을 값 종류 표기 — null 만 typeof 로 구분되지 않아 별도 처리한다.
function describeKind(value: unknown): string {
  return value === null ? "null" : typeof value;
}

// `fields` 전용 종류 표기 — 배열도 `typeof` 로는 "object" 라 위 describeKind 로는 구분되지
// 않는다. 기존 issue 문구 (entity / instant / records) 를 바꾸지 않으려고 별도 helper 를 둔다.
function describeFieldsKind(value: unknown): string {
  if (value === null) {
    return "null";
  }
  return Array.isArray(value) ? "array" : typeof value;
}

// `fields` 의 allow-list 밖 own enumerable key 목록 — `Object.keys` 로 **own enumerable** 만
// 훑고 멤버십은 `Object.prototype.hasOwnProperty` 로 판정한다. 그래야 `__proto__` ·
// `constructor` 같은 이름이 (상속 속성이라는 이유로) 누락되거나, allow-list 의 상속 속성에
// 걸려 오탐으로 허용되는 일이 없다. 값은 읽지 않는다 (REQ-032 — key 이름만 본다).
function collectDisallowedFieldKeys(
  entity: ExportEntity,
  fields: Record<string, unknown>,
): string[] {
  // allow-list single-source — 본 파일에 5 entity 매핑 사본을 두지 않는다 (drift 0).
  const allowSelect = getExportEntityFullRecordSelect(entity);
  return Object.keys(fields).filter(
    (key) => !Object.prototype.hasOwnProperty.call(allowSelect, key),
  );
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

// hydrateImportDumpRecords — screening 을 통과한 dump 의 `records` 를 `FullExportRecord[]` 로
// 복원한다. 분기는 3 개다:
//   (1) `dump.records` 가 배열이 아니면 (dump 자체가 plain object 가 아닌 경우 포함) → 단일 issue.
//   (2) 배열이면 각 원소를 검사해 — plain object 아님 / `entity` 가 5 허용 값 아님 / `instant` 가
//       유효 instant 로 복원 불가 / `fields` 가 plain object 아님 / `fields` 에 allow-list 밖 key
//       존재 — 위반마다 **그 index 를 담은 issue 를 누적** 한다 (early-return 아님 — 여러 위반을
//       한 번에 안내, import-dump-validate 패턴 정합). `entity` 가 무효면 allow-list 조회 자체가
//       불가하므로 그 원소의 allow-list 검사는 **건너뛴다** (issue 중복 0).
//   (3) 위반 0 이면 입력 **순서를 보존한** 새 `FullExportRecord[]` 로 `{ ok: true, records }` 반환.
//       각 원소의 `fields` 는 **새 객체로 shallow copy** 해 담으므로 호출자가 반환값의 `fields`
//       를 바꿔도 입력 dump 는 오염되지 않는다 (값 자체는 불투명하게 그대로 — 값 변환 0).
// 입력 `dump` / `dump.records` / 원소 객체 / `fields` 를 변형하지 않으며 (freeze 된 입력도 통과),
// 어떤 입력에서도 throw 하지 않는다.
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
  const hydrated: FullExportRecord[] = [];
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

    // fields 형태 분기 — 필수이며 plain object 여야 한다 (부재 / null / 배열 / 문자열 / 숫자 /
    // boolean 전부 거부). 값은 들여다보지 않는다.
    const fields = record.fields;
    const fieldsValid = isPlainObject(fields);
    if (!fieldsValid) {
      issues.push(
        `records[${index}].fields 는 컬럼명→값 map 인 object 여야 합니다 (받음: ${describeFieldsKind(
          fields,
        )})`,
      );
    }

    // allow-list 멤버십 분기 — entity 가 유효할 때만 조회 가능하다. 위반 key 이름과 index 만
    // 싣고 값은 싣지 않는다 (REQ-032 — secret 값이 issue 로 새어나가지 않게).
    let allowListOk = true;
    if (entityValid && fieldsValid) {
      const disallowed = collectDisallowedFieldKeys(
        entity as ExportEntity,
        fields,
      );
      if (disallowed.length > 0) {
        allowListOk = false;
        issues.push(
          `records[${index}].fields 에 ${entity} allow-list 밖 key 가 있습니다 (받음: ${disallowed.join(
            ", ",
          )}) — secret / 미정의 컬럼은 복원할 수 없습니다`,
        );
      }
    }

    if (entityValid && instant !== null && fieldsValid && allowListOk) {
      // fields 는 새 객체로 shallow copy — 값은 identity 그대로 옮기고 변환하지 않는다.
      hydrated.push({
        entity: entity as ExportEntity,
        instant,
        fields: { ...fields },
      });
    }
  }

  // (3) 위반이 하나라도 있으면 부분 결과 없이 issues 만 돌려준다.
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, records: hydrated };
}
