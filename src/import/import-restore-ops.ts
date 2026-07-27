// import-restore-ops — UC-07 Import 복원 operation 그룹핑 순수 helper (T-1262, REQ-030 / REQ-032).
// [ADR-0055](../../docs/decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원
// 엔진 chain (역직렬화 → 구조 검증 → version gate → records hydrate → 복원 입력 합성 → 복원 plan
// 산출 → FK 안전 실행 순서 → **entity 별 operation 그룹핑** → ADR-0044 §3 atomic `$transaction`
// 복원 → controller 재배선) 의 **여덟 번째 slice** 다. 직전 slice (T-1261) 가 "어느 entity 를 먼저
// 넣고 먼저 지울지" 순서만 박제했지만, 실 `$transaction` 은 record 를 **entity 단위 배치** (예:
// `person.deleteMany` / `assessment.createMany`) 로 넘겨야 하므로 `ImportRestorePlan` 의
// `{toDelete, toInsert}` 평면 배열을 **(phase, entity, records) 실행 단위** 로 접는 한 겹이 더
// 필요하다. 본 helper 는 그 **순수 변환만** 담당해, 다음 slice (실 `$transaction`) 가 순서 재추론 ·
// 그룹핑 · 평면 순회를 한꺼번에 떠안지 않게 한다.
//
// 산출 순서 계약: **delete phase 그룹 전부 → insert phase 그룹 전부**. FK 참조를 끊고 나서 다시
// 잇는 순서라야 `Assessment.personId → Person` 필수 FK 가 중간 상태에서도 깨지지 않는다. 각 phase
// 안의 entity 순서는 `orderImportRestoreEntities` 결과를 그대로 따르며 (insert 는 `Person` 이
// `Assessment` 앞, delete 는 그 역순), 순서 상수 · 역순 배열을 본 파일에서 재선언하지 않는다
// (DRY — T-1261 이 유일한 source-of-truth).
//
// `toKeep` 은 삭제 · 삽입 대상이 아니므로 operation 을 만들지 않고, record 가 0 건인 entity 는 빈
// 그룹조차 만들지 않는다 (하류가 no-op batch 를 걸러낼 필요 0). 그룹 안 record 는 **입력 순서를
// 보존** 한다.
//
// 순수 · non-mutating — 입력 `plan` / 그 배열 / 원소를 변형하지 않고 (freeze 된 입력으로 호출해도
// 통과) 항상 새 배열 · 새 그룹 객체를 돌려준다. 반환 배열을 호출자가 변형해도 다음 호출 결과는
// 오염되지 않는다. DB · Prisma client · repository · `$transaction` · file I/O · REST 배선 0 이며
// plan 산출 규칙 · mode 매핑 · delegate 이름 매핑 같은 인접 helper 규칙도 재구현하지 않는다.
// REQ-032 (raw 미저장) 정합: record 의 `entity` 이름만 읽고 payload 를 들여다보지 않으며, error
// 메시지에도 record 원본 · raw 를 싣지 않는다 (비-string 값은 typeof 만 노출).
//
// 입력 방어는 sibling `buildImportRestorePlan` / `orderImportRestoreEntities` 와 **동형 throw 계약**
// (TypeError / RangeError + 한국어 메시지) 을 택했다 — 상류 `prepareImportRestorePlan` 이 이미
// verdict 로 걸러낸 성공분 plan 을 받는 위치라 verdict wrapper 를 한 겹 더 두지 않는다 (throw 흡수는
// 하류 `$transaction` slice 책임). 검증을 두 배열 모두 마친 뒤에야 그룹을 만들므로 **부분 결과를
// 돌려주는 경로가 없다**.
import {
  type ExportEntity,
  type ExportRecord,
} from "../export/export-scope-select";
import { type ImportRestorePlan } from "../export/import-restore-plan";

import {
  IMPORT_RESTORE_INSERT_ORDER,
  type ImportRestorePhase,
  orderImportRestoreEntities,
} from "./import-restore-order";

// 허용 entity 멤버십 판정용 집합 — T-1261 상수에서 파생하므로 5 literal 재선언 0.
const VALID_ENTITIES: ReadonlySet<string> = new Set(
  IMPORT_RESTORE_INSERT_ORDER,
);

// 실행 단위 — 하류 `$transaction` 이 그대로 한 batch 로 옮길 수 있는 (phase, entity, records) 묶음.
// records 는 항상 1 건 이상이며 (빈 그룹을 만들지 않으므로) 입력 순서를 보존한 새 배열이다.
export interface ImportRestoreOperation {
  phase: ImportRestorePhase;
  entity: ExportEntity;
  records: ExportRecord[];
}

// error 메시지용 안전 표현 — string 은 값 그대로, 그 외는 타입 이름만 노출한다. 객체를 문자열로
// 강제 변환하지 않으므로 record payload 가 메시지로 새지 않고 (REQ-032), null-prototype 객체처럼
// `String()` 이 throw 하는 입력에도 안전하다.
function describeReceived(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null) {
    return "null";
  }
  return typeof value;
}

// 런타임 멤버십 판정 겸 type guard — 상류가 verdict 로 걸러준 입력이라도 비-string / 오타 /
// 소문자 값이 타입 우회로 흘러들 수 있으므로 값 자체로 확인한다.
function isExportEntity(value: unknown): value is ExportEntity {
  return typeof value === "string" && VALID_ENTITIES.has(value);
}

// plan 의 한 배열 검증 — 비-배열이면 TypeError, 원소가 null / 원시값이라 `entity` 를 읽을 수 없거나
// 5 literal 밖 값이면 그 배열명 + index 를 담은 RangeError. 검증만 하고 변형하지 않는다.
function assertPhaseRecords(records: unknown, label: string): void {
  if (!Array.isArray(records)) {
    throw new TypeError(
      `groupImportRestoreOperations: plan.${label} 는 배열이어야 합니다 (받음: ${typeof records})`,
    );
  }
  for (let index = 0; index < records.length; index += 1) {
    const entity: unknown = (records[index] as ExportRecord | null | undefined)
      ?.entity;
    if (!isExportEntity(entity)) {
      throw new RangeError(
        `groupImportRestoreOperations: plan.${label}[${index}].entity 는 export entity 5 종 중 하나여야 합니다 (받음: ${describeReceived(entity)})`,
      );
    }
  }
}

// 한 phase 의 평면 배열을 entity 별 그룹으로 접는다 — 등장한 entity 만 모아
// `orderImportRestoreEntities` 로 정렬한 뒤 그 순서대로 그룹을 만든다. 이미 검증을 마친 배열만
// 들어오므로 여기서 다시 throw 하지 않으며, filter 가 새 배열을 만들어 입력을 건드리지 않는다.
function buildPhaseOperations(
  records: ReadonlyArray<ExportRecord>,
  phase: ImportRestorePhase,
): ImportRestoreOperation[] {
  const present = new Set<ExportEntity>();
  for (let index = 0; index < records.length; index += 1) {
    present.add(records[index].entity);
  }

  return orderImportRestoreEntities([...present], phase).map((entity) => ({
    phase,
    entity,
    records: records.filter((record) => record.entity === entity),
  }));
}

// groupImportRestoreOperations — `ImportRestorePlan` 을 하류 `$transaction` 이 그대로 실행할 수 있는
// (phase, entity, records) operation 배열로 접는다.
//   - delete phase 그룹이 전부 앞, insert phase 그룹이 그 뒤 (FK 를 끊고 다시 잇는 순서).
//   - 각 phase 안 entity 순서는 `orderImportRestoreEntities` 결과 그대로 (insert 는 `Person` <
//     `Assessment`, delete 는 그 역순).
//   - `toKeep` 은 operation 을 만들지 않고, record 0 건인 entity 는 빈 그룹조차 만들지 않는다.
//   - 세 배열이 모두 비어도 정상 — 빈 배열을 돌려준다 (error 아님).
// 입력 방어:
//   - plan 이 null / undefined / 비-객체 → TypeError.
//   - plan.toDelete 또는 plan.toInsert 가 배열 아님 → TypeError.
//   - 두 배열 원소의 `entity` 가 export entity 5 종 밖 (오타 / 소문자 / null / 숫자 / 객체) 이거나
//     원소 자체가 null / 원시값 → 그 배열명 + index 를 담은 RangeError.
export function groupImportRestoreOperations(
  plan: ImportRestorePlan,
): ImportRestoreOperation[] {
  // 타입 우회로 들어온 비-객체를 잡기 위해 unknown 으로 낮춰 판정한다.
  const candidate: unknown = plan;
  if (typeof candidate !== "object" || candidate === null) {
    throw new TypeError(
      `groupImportRestoreOperations: plan 은 객체여야 합니다 (받음: ${describeReceived(candidate)})`,
    );
  }

  // 두 배열 검증을 모두 마친 뒤에 그룹 조립을 시작한다 (부분 결과 반환 경로 0).
  assertPhaseRecords(plan.toDelete, "toDelete");
  assertPhaseRecords(plan.toInsert, "toInsert");

  return [
    ...buildPhaseOperations(plan.toDelete, "delete"),
    ...buildPhaseOperations(plan.toInsert, "insert"),
  ];
}
