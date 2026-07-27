// import-restore-delete-instants — UC-07 Import 복원 delete step 의 삭제 대상 instant 목록 순수
// 산출기 (T-1271, REQ-030 / REQ-032). ADR-0055 §Follow-up (b) 복원 엔진 chain 의 마지막 실행 조각
// 4 개 (1/3 insert row · **2a instant 목록** · 2b `where` 조립 · 3/3 `$transaction` runner) 중
// **2a** 다. `toDelete` 원소는 `ExportRecord` (entity + instant 뿐, **id 없음**) 라 식별 축이
// `instant` 하나뿐이므로, 계약 검증 (phase / method / entity 일치 / 유효 Date) 후 **목록 산출까지만**
// 한다. 하지 않는 것: `instantColumn` 조회 0 · `where` 조립 0 (2b) / Prisma client · `$transaction`
// · DB · repository · file I/O · REST 배선 0 (3/3) / insert step 의 row 산출 0 (T-1270 책임 — 그래서
// insert step 은 거부). 순수 · non-mutating (입력 step / records / Date 변형 0, freeze 된 입력도
// 통과) — 새 배열이되 원소 Date 는 입력 instance 그대로 (복제 0 — T-1270 "값은 불투명하게" 와 동형),
// 같은 millis 는 첫 등장 1 건만 남기고 정렬 0 (상류 순서 회귀를 조용히 덮지 않는다). REQ-032 정합:
// error 메시지에 record 원본 · `instant` 값 · stack 0. throw 계약은 sibling 과 동형 (한국어
// TypeError / RangeError) 이며, 전 record 검증을 마친 뒤에야 조립해 **부분 결과 반환 경로가 없다**.
import { type ExportRecord } from "../export/export-scope-select";

import { type ImportRestoreTransactionStep } from "./import-restore-steps";

// 위반 보고 공용 — 함수 이름 prefix 를 한 곳에서만 붙인다 (메시지 표기 drift 0).
function fail(Ctor: new (message: string) => Error, message: string): never {
  throw new Ctor(`collectImportRestoreDeleteInstants: ${message}`);
}

// enum 토큰 (phase/method/entity) 전용 — string 은 값 그대로, 그 외 타입명만. T-1270 `describeReceived` **사본**.
function tokenOf(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return value === null ? "null" : typeof value;
}

// payload 자리 (record 원소 · 그 `instant`) 전용 종류 표기 — 값 노출 0 (REQ-032), Date 는 Invalid 까지 구분.
function kindOf(value: unknown): string {
  if (value instanceof Date && Number.isNaN(value.getTime())) {
    return "Invalid Date";
  }
  return value === null ? "null" : typeof value;
}

// step 계약 검증 — 객체 shape · phase/method · records 배열/비-empty. phase·method 위반이 RangeError
// 인 이유는 타입은 정상인데 **본 helper 가 맡지 않는 종류의 step** 이라서고, 빈 `records` 가
// RangeError 인 이유는 상류 계약 (T-1264 "빈 그룹 미생성") 위반이자 전체 삭제로 오독될 수 있어서다.
function assertDeleteStep(candidate: unknown): asserts candidate is {
  entity: unknown;
  records: unknown[];
} {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    fail(TypeError, `step 은 객체여야 합니다 (받음: ${kindOf(candidate)})`);
  }
  const step = candidate as Partial<ImportRestoreTransactionStep>;
  if (step.phase !== "delete" || step.method !== "deleteMany") {
    fail(
      RangeError,
      `step 은 delete/deleteMany 여야 합니다 (받음: phase=${tokenOf(step.phase)}, method=${tokenOf(step.method)}) — insert step 은 buildImportRestoreInsertRows 책임입니다`,
    );
  }
  // 배열-shape 판정은 `typeof` 만 노출한다 — `records` 는 payload 를 담는 필드다 (REQ-032).
  if (!Array.isArray(step.records)) {
    fail(TypeError, `records 는 배열이어야 합니다 (${typeof step.records})`);
  }
  if (step.records.length === 0) {
    fail(RangeError, `records 는 1 건 이상이어야 합니다 (빈 목록 미생성)`);
  }
}

// record 1 건의 `instant` 런타임 narrowing — 원소가 객체 아님 / instant 가 비-Date · Invalid Date 면
// TypeError, entity 가 step 과 다르면 RangeError (다른 delegate 의 row 가 섞여 삭제되는 사고 차단).
function narrowRecordInstant(
  candidate: unknown,
  index: number,
  entity: unknown,
): Date {
  if (typeof candidate !== "object" || candidate === null) {
    fail(
      TypeError,
      `records[${index}] 는 객체여야 합니다 (${kindOf(candidate)})`,
    );
  }
  const record = candidate as Partial<ExportRecord>;
  if (record.entity !== entity) {
    fail(
      RangeError,
      `records[${index}].entity 는 step.entity (${tokenOf(entity)}) 와 같아야 합니다 (받음: ${tokenOf(record.entity)})`,
    );
  }
  const instant: unknown = record.instant;
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    fail(
      TypeError,
      `records[${index}].instant 는 유효한 Date 여야 합니다 (${kindOf(instant)})`,
    );
  }
  return instant;
}

// collectImportRestoreDeleteInstants — delete step 의 record 배열을 삭제 대상 instant 목록으로 옮긴다.
// 같은 millis 는 첫 등장 1 건만 남기고 (`deleteMany` 의 `in` 목록 팽창 방지) 상대 순서는 입력 그대로.
export function collectImportRestoreDeleteInstants(
  step: ImportRestoreTransactionStep,
): Date[] {
  // 타입 우회로 들어온 비-객체를 잡기 위해 unknown 으로 낮춰 판정한다.
  const candidate: unknown = step;
  assertDeleteStep(candidate);
  // 검증 → 조립 2-pass. 첫 pass 에서 하나라도 위반이면 목록을 하나도 만들지 않는다.
  const instants = candidate.records.map((record, index) =>
    narrowRecordInstant(record, index, candidate.entity),
  );
  // 첫 등장만 남기는 filter — 새 배열이지만 원소 Date 는 입력 instance 그대로다 (복제 0).
  const seen = new Set<number>();
  return instants.filter((instant) => {
    const millis = instant.getTime();
    if (seen.has(millis)) {
      return false;
    }
    seen.add(millis);
    return true;
  });
}
