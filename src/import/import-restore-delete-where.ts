// import-restore-delete-where — UC-07 Import 복원 delete step 의 `deleteMany({ where })` 인자 순수
// 조립기 (T-1272, REQ-030 / REQ-032). ADR-0055 §Follow-up (b) 복원 엔진 chain 의 마지막 실행 조각
// 4 개 (1/3 insert row · 2a instant 목록 · **2b `where` 조립** · 3/3 `$transaction` runner) 중
// **2b** 다. 하는 일은 한 겹뿐 — 2a 가 돌려준 instant 목록을 `EXPORT_ENTITY_SOURCES` 의
// `instantColumn` 을 key 로 하는 `{ [컬럼]: { in: Date[] } }` 로 옮긴다.
// 하지 않는 것: Prisma client · `$transaction` · DB · repository · file I/O · REST 배선 0 (3/3) /
// insert step 의 row 산출 0 (1/3 — delete 아닌 step 은 2a 가 거부) / 목록 산출 · 중복 제거 · step
// 계약 검증 0 (2a 위임 — 사본 0 이라 그쪽 한국어 throw 를 감싸지 않고 **그대로 전파**한다).
// 순수 · non-mutating: 입력 step / records / Date 와 `EXPORT_ENTITY_SOURCES` 를 변형하지 않고
// (freeze 된 입력도 통과) 매 호출 새 plain object 를 돌려주되 원소 Date 는 입력 instance 그대로다
// (복제 0 — 1/3 · 2a 의 "값은 불투명하게" 규약과 동형). REQ-032 정합: error 메시지에 record 원본 ·
// `instant` 값 · stack 0 (entity 는 string 값 또는 타입 이름만).
import { EXPORT_ENTITY_SOURCES } from "../export/export-entity-sources";
import { type ExportEntity } from "../export/export-scope-select";

import { collectImportRestoreDeleteInstants } from "./import-restore-delete-instants";
import { type ImportRestoreTransactionStep } from "./import-restore-steps";

// enum 토큰 (entity) 전용 안전 표기 — string 은 값 그대로, 그 외는 타입 이름만. T-1271 `tokenOf`
// **사본** 이다 (공용 module 추출은 별도 위생 slice).
function tokenOf(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return value === null ? "null" : typeof value;
}

// entity 유효성 판정 — `in` 연산자 · 직접 인덱싱 대신 `hasOwnProperty.call` 로 표의 **자기 속성** 만
// 인정한다. 표는 plain object 라 `"constructor"` / `"__proto__"` / `"toString"` 을 `in` 으로 물으면
// prototype 속성이 잡히고, 그러면 `source` 가 undefined 라 key 가 `undefined` 인 where — 즉 조건
// 없는 전체 삭제 — 로 번역될 수 있다.
function isOwnExportEntity(value: unknown): value is ExportEntity {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(EXPORT_ENTITY_SOURCES, value)
  );
}

// buildImportRestoreDeleteWhere — delete step 하나를 `deleteMany({ where })` 의 `where` 로 옮긴다.
// key 는 표에서 읽은 instant 컬럼 이름 (하드코딩 0 — 현재 5 entity 모두 `createdAt`), 값은 2a 가
// 돌려준 목록을 그대로 실은 `{ in }`. 입력 방어: step shape · phase / method · 빈 records · record
// entity 불일치 · 비-Date instant 는 2a 의 한국어 TypeError / RangeError 가 그대로 전파되고,
// `step.entity` 가 표의 자기 속성이 아니면 본 helper 의 한국어 RangeError 다.
export function buildImportRestoreDeleteWhere(
  step: ImportRestoreTransactionStep,
): Record<string, { in: Date[] }> {
  // 목록 산출 · 계약 검증은 2a 위임 — 먼저 부르므로 비-객체 step 도 그쪽 한국어 throw 로 걸린다.
  // 2a 가 빈 `records` 를 거부하니 이 목록은 **항상 1 건 이상** 이다 (빈 `in` 반환 경로 없음).
  const instants = collectImportRestoreDeleteInstants(step);
  const entity: unknown = (step as { entity: unknown }).entity;
  if (!isOwnExportEntity(entity)) {
    throw new RangeError(
      `buildImportRestoreDeleteWhere: entity 는 export entity 5 종 중 하나여야 합니다 (받음: ${tokenOf(entity)})`,
    );
  }
  // 새 plain object — 호출자가 반환값을 변형해도 표 · 입력 records 는 오염되지 않는다.
  return { [EXPORT_ENTITY_SOURCES[entity].instantColumn]: { in: instants } };
}
