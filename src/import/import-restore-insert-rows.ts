// import-restore-insert-rows — UC-07 Import 복원 insert step 의 `createMany({ data })` row 순수
// builder (T-1270, REQ-030 / REQ-032).
// [ADR-0055](../../docs/decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원
// 엔진 chain (역직렬화 → 구조 검증 → version gate → records hydrate → 복원 입력 합성 → plan 산출 →
// FK 안전 순서 → operation 그룹핑 → entity 매핑 → step 계획 → **ADR-0044 §3 atomic `$transaction`
// 복원** → controller 재배선) 중 마지막 실행 조각을 3 으로 쪼갠 **실행 slice 1/3** 이다
// (1/3 insert row 산출 · 2/3 delete `where` 산출 · 3/3 실 `$transaction` runner).
//
// T-1264 의 step 은 "어느 delegate 의 어느 메서드를 어떤 순서로" 까지 서술하지만
// `prisma.<delegate>.createMany({ data })` 가 원하는 것은 record 가 아니라 그 `fields` 자체다.
// 본 helper 는 그 **한 겹 순수 변환만** 담당한다.
//
// 책임 경계 (하지 않는 것): Prisma client · `$transaction` · DB · repository · file I/O · REST 배선
// 0 (slice 3/3 책임 — `@prisma/client` 를 import 조차 하지 않는다) / delete step 의 `where` 절 산출
// 0 (slice 2/3 책임 — 그래서 delete step 은 거부한다) / `hydrateImportDumpRecords` 의 allow-list
// 재검증 0 (source-of-truth 는 상류 hydrate 하나뿐 — 두 번 판정하면 규칙이 갈라진다).
//
// 타입 파라미터화 대신 **런타임 narrowing** 을 쓴 이유 (본 slice 확정 설계): `records` 가
// `ExportRecord[]` (fields 없음) 로 선언돼 `fields` 가 타입 상 보이지 않지만, 여기가 값이 DB 로
// 넘어가는 **마지막 경계** 라 타입 소거 뒤에도 남는 그물이 필요하다 (`export-full-record.ts` 의
// "조립 layer 마지막 그물" 선례와 동형). 이 선택으로 타입 전파 전용 slice 2 개를 덜어냈다.
//
// 순수 · non-mutating — 입력 step / record / `fields` 를 변형하지 않고 (freeze 된 입력도 통과) 항상
// 새 배열 · 새 row 를 돌려주며, 값은 **불투명하게 그대로** 옮긴다 (Date 재생성 · 직렬화 · 형 변환 ·
// key 정규화 0 — identity 보존, 같은 입력 2 회 호출 시 동일 결과). REQ-032 정합: 영속 저장 0, error
// 메시지에 `fields` 값 · record 원본 · stack 0 (종류 이름 · 위반 index 만). 입력 방어는 sibling
// `planImportRestoreTransactionSteps` 와 동형 throw 계약 (한국어 TypeError / RangeError) 이며, 전
// record 검증을 마친 뒤에야 row 를 만들어 **부분 결과를 돌려주는 경로가 없다**.
import { type FullExportRecord } from "../export/export-full-record";

import { type ImportRestoreTransactionStep } from "./import-restore-steps";

// error 메시지용 안전 표현 — string 은 값 그대로, 그 외는 타입 이름만 (`planImportRestoreTransaction
// Steps` 의 동명 helper 사본 — 공용 module 추출은 별도 위생 slice). phase / method 처럼 **payload 가
// 아닌 enum 토큰** 에만 쓴다.
function describeReceived(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

// payload 자리 (record 원소 · 그 `fields`) 전용 종류 표기 — 그 자리 값을 그대로 실으면 dump 내용이
// 메시지 · 로그로 샌다 (REQ-032). 값은 절대 싣지 않고 종류 이름만 노출하되, `typeof` 로는 둘 다
// "object" 인 배열 · Date 는 따로 표기한다 (`import-dump-records-hydrate.describeFieldsKind` 와
// 동형 규칙).
function describeFieldsKind(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return value instanceof Date ? "Date" : typeof value;
}

// plain object 판정 — null / 배열 / Date / 함수 / primitive / class instance (Map 등) 거부, 순수
// 객체와 `Object.create(null)` 만 허용. `export-full-record.isPlainObject` (그리고 그 짝인
// `import-dump-records-hydrate` 의 사본) 와 **문자 그대로 같은 엄격도** 의 사본이다 (두 helper 모두
// module-export 되지 않아 규칙만 로컬 mirror — 공용 module 추출은 별도 위생 slice). 느슨한 판정이면
// `fields: new Date()` 가 통과해 **빈 row 가 조용히 DB 로 들어가 데이터가 소실** 된다. drift 는
// colocated spec 의 감시 test 가 pin 한다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value) || value instanceof Date) {
    return false;
  }
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// step 계약 검증 — 객체 shape · phase · method · records 배열/비-empty. phase / method 위반이
// RangeError 인 이유: 타입은 정상인데 **본 slice 가 맡지 않는 종류의 step** (delete 의 `where` 산출은
// slice 2/3) 이라 범위 위반이다. 빈 `records` 는 상류 계약 (T-1264 "빈 그룹 미생성") 위반이라 역시
// RangeError — no-op batch 를 하류로 흘리지 않는다.
function assertInsertStep(candidate: unknown): asserts candidate is {
  records: unknown[];
} {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    throw new TypeError(
      `buildImportRestoreInsertRows: step 은 객체여야 합니다 (받음: ${describeReceived(candidate)})`,
    );
  }

  const step = candidate as Partial<ImportRestoreTransactionStep>;

  if (step.phase !== "insert") {
    throw new RangeError(
      `buildImportRestoreInsertRows: step.phase 는 insert 여야 합니다 (받음: ${describeReceived(step.phase)}) — delete step 은 본 helper 의 책임이 아닙니다`,
    );
  }

  if (step.method !== "createMany") {
    throw new RangeError(
      `buildImportRestoreInsertRows: step.method 는 createMany 여야 합니다 (받음: ${describeReceived(step.method)})`,
    );
  }

  // 배열-shape 판정은 `typeof` 만 노출한다 — `records` 는 payload 를 담는 필드다 (REQ-032).
  if (!Array.isArray(step.records)) {
    throw new TypeError(
      `buildImportRestoreInsertRows: step.records 는 배열이어야 합니다 (받음: ${typeof step.records})`,
    );
  }

  if (step.records.length === 0) {
    throw new RangeError(
      `buildImportRestoreInsertRows: step.records 는 1 건 이상이어야 합니다 (빈 batch 는 만들지 않습니다)`,
    );
  }
}

// record 1 건의 `fields` 런타임 narrowing — record 가 객체가 아니면 TypeError, `fields` 가 plain
// object 가 아니면 (undefined 인 legacy dump 잔재 포함) 그 index 를 담은 TypeError. own enumerable
// key 가 0 개인 빈 객체는 RangeError (빈 row 를 DB 로 보내지 않는다). 검증만 하고 변형하지 않는다.
function narrowRecordFields(
  candidate: unknown,
  index: number,
): Record<string, unknown> {
  // record 도 payload 자리다 — `describeReceived` (string 을 값 그대로 노출) 를 쓰면 raw string
  // record 가 error 메시지로 새므로 종류 이름만 싣는다 (REQ-032).
  if (typeof candidate !== "object" || candidate === null) {
    throw new TypeError(
      `buildImportRestoreInsertRows: step.records[${index}] 는 객체여야 합니다 (받음: ${describeFieldsKind(candidate)})`,
    );
  }

  const fields: unknown = (candidate as Partial<FullExportRecord>).fields;

  if (!isPlainObject(fields)) {
    throw new TypeError(
      `buildImportRestoreInsertRows: step.records[${index}].fields 는 plain object 여야 합니다 (받음: ${describeFieldsKind(fields)})`,
    );
  }

  // 상류 비대칭 (의도된 것) — `export-full-record.buildFullExportRecord` 와 `hydrateImportDump
  // Records` 는 빈 `fields` 를 정상 허용하지만, 본 helper 는 마지막 경계라 거부한다: 빈 row 를
  // `createMany` 로 보내면 컬럼 0 짜리 레코드가 조용히 DB 에 생긴다. drift 는 colocated spec 이 pin.
  if (Object.keys(fields).length === 0) {
    throw new RangeError(
      `buildImportRestoreInsertRows: step.records[${index}].fields 는 1 개 이상의 컬럼을 가져야 합니다 (빈 row 는 만들지 않습니다)`,
    );
  }

  return fields;
}

// `fields` 의 own enumerable key 만 얕게 복사한 새 row. `Object.keys` 는 정의상 own enumerable key
// 만 돌려주므로 prototype chain key (`toString` / `constructor` / prototype 에만 있는 `__proto__`) 는
// 애초에 실리지 않는다 (`hasOwnProperty.call` 과 동등 수단). 대입에 `row[key] = ...` 대신
// `Object.defineProperty` 를 쓰는 이유: key 가 `"__proto__"` 이면 (own key 로서 `JSON.parse` 산출물에
// 실재할 수 있다) 일반 대입은 own key 를 만들지 않고 **row 의 prototype 을 바꿔버린다**.
function copyFieldsToRow(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    Object.defineProperty(row, key, {
      value: fields[key],
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return row;
}

// buildImportRestoreInsertRows — insert step 의 record 배열을 `createMany({ data })` 에 그대로 넣을
// row 배열로 옮긴다.
// 입력과 **같은 개수 · 같은 순서** 의 row 를 만들고 (재정렬 · 병합 · 중복 제거 0), 각 row 는 record
// `fields` 의 own enumerable key 만 담은 새 객체이며 값은 identity 그대로다. 입력 방어: step 이
// null / undefined / 원시값 / 배열, records 가 배열 아님, record 원소가 null / 원시값, `fields` 가
// plain object 아님 → TypeError (위반 index 포함) / phase !== "insert", method !== "createMany",
// records 가 빈 배열, `fields` 가 빈 객체 → RangeError.
export function buildImportRestoreInsertRows(
  step: ImportRestoreTransactionStep,
): Record<string, unknown>[] {
  // 타입 우회로 들어온 비-객체를 잡기 위해 unknown 으로 낮춰 판정한다.
  const candidate: unknown = step;
  assertInsertStep(candidate);

  // 검증 → 조립 2-pass. 첫 pass 에서 하나라도 위반이면 row 를 하나도 만들지 않는다.
  const narrowed = candidate.records.map((record, index) =>
    narrowRecordFields(record, index),
  );
  return narrowed.map((fields) => copyFieldsToRow(fields));
}
