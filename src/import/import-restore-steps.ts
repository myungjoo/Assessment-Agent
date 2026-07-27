// import-restore-steps — UC-07 Import 복원 `$transaction` step 계획 순수 helper (T-1264,
// REQ-030 / REQ-032).
// [ADR-0055](../../docs/decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원
// 엔진 chain (역직렬화 → 구조 검증 → version gate → records hydrate → 복원 입력 합성 → plan 산출
// → FK 안전 순서 → operation 그룹핑 → entity 매핑 공용 module → **ADR-0044 §3 atomic
// `$transaction` 복원** → controller 재배선) 의 **열 번째 slice** 다.
//
// T-1262 의 `ImportRestoreOperation` 은 `(phase, entity, records)` 까지만 알고, T-1263 이 승격한
// `EXPORT_ENTITY_SOURCES` 는 `entity → delegate·model` 만 안다. 실 `prisma.$transaction([...])` 을
// 부르려면 그 둘을 합친 **"어느 delegate 의 어느 메서드를 어떤 순서로 부를지"** 가 필요하다. 본
// helper 는 그 **순수 변환과 순서 계약 검증만** 담당한다 — Prisma client 를 잡지 않고 호출 **서술**
// (step) 만 만들어, 다음 slice (실 `$transaction` 실행) 가 매핑 · 순서 · 검증을 한꺼번에 떠안지
// 않게 한다.
//
// 매핑 규칙: `phase === "delete"` → `method: "deleteMany"`, `phase === "insert"` →
// `method: "createMany"`. `delegate` / `model` 은 `EXPORT_ENTITY_SOURCES` (T-1263) 에서만 얻고 본
// 파일에서 5 entity 매핑을 재선언하지 않는다 (사본 0 — T-1261 reviewer NIT-1 재발 방지).
//
// 순서 계약: 입력 operation 배열은 **모든 delete 가 모든 insert 앞** 이어야 한다 (FK 를 끊고 다시
// 잇는 순서 — `Assessment.personId → Person` 필수 FK 가 중간 상태에서도 깨지지 않도록). 손으로
// 조립된 배열이 그 계약을 깨면 위반 index 를 담은 `RangeError` 를 던진다. **재정렬하지 않는다** —
// 순서를 조용히 고쳐주면 상류 그룹핑의 회귀가 숨어버리므로 알리기만 한다.
//
// 순수 · non-mutating — 입력 배열 / operation / records 를 변형하지 않고 (freeze 된 입력으로
// 호출해도 통과) 항상 새 배열 · 새 step 객체를 돌려준다. 단 복사는 **shallow** 다 — `records` 는
// 새 배열로 만들지만 그 안의 record 객체는 입력과 그대로 공유한다 (T-1264 는 payload 를 들여다보지
// 않으므로 불투명하게 옮기기만 한다). Prisma client · `$transaction` 실행 · DB · repository ·
// file I/O · REST 배선 0 이며, 순서 상수 · 그룹핑 규칙 · 매핑표를 재구현하지 않는다 (DRY).
// REQ-032 (raw 미저장) 정합: record 를 **불투명하게** 옮기기만 하고 payload 를 들여다보지 않으며,
// error 메시지에도 record 원본 · `instant` 를 싣지 않는다 (배열-shape 판정은 타입 이름만 노출).
//
// 입력 방어는 sibling `groupImportRestoreOperations` 와 **동형 throw 계약** (한국어 TypeError /
// RangeError) 을 택했다 — 상류가 이미 verdict 로 걸러낸 성공분을 받는 위치라 verdict wrapper 를 한
// 겹 더 두지 않는다 (throw 흡수는 하류 `$transaction` slice 책임). 검증을 전 원소에 대해 마친
// 뒤에야 step 을 만들므로 **부분 결과를 돌려주는 경로가 없다**.
import {
  EXPORT_ENTITY_SOURCES,
  type ExportEntityDelegate,
} from "../export/export-entity-sources";
import {
  type ExportEntity,
  type ExportRecord,
} from "../export/export-scope-select";

import { type ImportRestoreOperation } from "./import-restore-ops";
import {
  IMPORT_RESTORE_INSERT_ORDER,
  type ImportRestorePhase,
} from "./import-restore-order";

// 허용 entity 멤버십 판정용 집합 — T-1261 상수에서 파생하므로 5 literal 재선언 0. Set 이라
// prototype 상속 속성 (`__proto__` / `constructor`) 이 멤버로 오탐되지 않는다.
const VALID_ENTITIES: ReadonlySet<string> = new Set(
  IMPORT_RESTORE_INSERT_ORDER,
);

// phase → Prisma delegate 메서드 이름. 두 phase 뿐이라 표를 두지 않고 분기 하나로 파생한다.
export type ImportRestoreStepMethod = "deleteMany" | "createMany";

// 하류 `$transaction` 이 그대로 옮길 수 있는 호출 서술 1 건.
//   - phase / entity — 입력 operation 에서 그대로 승계 (재정렬 · 병합 0).
//   - delegate / model — `EXPORT_ENTITY_SOURCES` 조회 결과 (본 파일 재선언 0).
//   - method — phase 파생 (`delete` → deleteMany, `insert` → createMany).
//   - records — 입력 순서를 보존한 **새 배열** (호출자가 바꿔도 입력 불변).
export interface ImportRestoreTransactionStep {
  phase: ImportRestorePhase;
  entity: ExportEntity;
  delegate: ExportEntityDelegate;
  model: string;
  method: ImportRestoreStepMethod;
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

// 런타임 멤버십 판정 겸 type guard — 타입 우회로 흘러든 비-string / 오타 / 소문자 값을 값 자체로
// 확인한다.
function isExportEntity(value: unknown): value is ExportEntity {
  return typeof value === "string" && VALID_ENTITIES.has(value);
}

function isRestorePhase(value: unknown): value is ImportRestorePhase {
  return value === "delete" || value === "insert";
}

// operation 1 건 검증 — 원소가 null / 원시값이라 필드를 읽을 수 없거나, phase / entity 가 허용
// 값 밖이거나, records 가 배열이 아니거나 비어 있으면 그 index 를 담고 throw 한다. 검증만 하고
// 변형하지 않는다. `records` 가 빈 배열인 경우는 T-1262 의 "빈 그룹 미생성" 계약 위반이라
// RangeError 로 알린다 (no-op batch 를 하류로 흘리지 않는다).
function assertOperation(candidate: unknown, index: number): void {
  if (typeof candidate !== "object" || candidate === null) {
    throw new TypeError(
      `planImportRestoreTransactionSteps: operations[${index}] 는 객체여야 합니다 (받음: ${describeReceived(candidate)})`,
    );
  }

  const operation = candidate as Partial<ImportRestoreOperation>;

  if (!isRestorePhase(operation.phase)) {
    throw new RangeError(
      `planImportRestoreTransactionSteps: operations[${index}].phase 는 delete/insert 중 하나여야 합니다 (받음: ${describeReceived(operation.phase)})`,
    );
  }

  if (!isExportEntity(operation.entity)) {
    throw new RangeError(
      `planImportRestoreTransactionSteps: operations[${index}].entity 는 export entity 5 종 중 하나여야 합니다 (받음: ${describeReceived(operation.entity)})`,
    );
  }

  // 배열-shape 판정은 `typeof` 만 노출한다 — `records` 는 payload 를 담는 필드라
  // `describeReceived` 로 string 값을 그대로 실으면 malformed 입력의 내용이 메시지 · 로그로 샌다
  // (REQ-032). sibling `assertPhaseRecords` (import-restore-ops) 와 동형 계약.
  if (!Array.isArray(operation.records)) {
    throw new TypeError(
      `planImportRestoreTransactionSteps: operations[${index}].records 는 배열이어야 합니다 (받음: ${typeof operation.records})`,
    );
  }

  if (operation.records.length === 0) {
    throw new RangeError(
      `planImportRestoreTransactionSteps: operations[${index}].records 는 1 건 이상이어야 합니다 (빈 그룹은 만들지 않습니다)`,
    );
  }
}

// 순서 계약 검증 — 모든 delete 가 모든 insert 앞인지 확인한다. insert 를 한 번이라도 본 뒤에
// delete 가 나오면 그 index 를 담은 RangeError. 재정렬은 하지 않는다 (위반은 고치지 않고 알린다).
function assertPhaseOrdering(operations: ReadonlyArray<unknown>): void {
  let insertSeenAt = -1;
  for (let index = 0; index < operations.length; index += 1) {
    const phase = (operations[index] as ImportRestoreOperation).phase;
    if (phase === "insert") {
      if (insertSeenAt < 0) {
        insertSeenAt = index;
      }
      continue;
    }
    if (insertSeenAt >= 0) {
      throw new RangeError(
        `planImportRestoreTransactionSteps: delete operation 은 모든 insert 앞에 와야 합니다 (operations[${index}] 가 operations[${insertSeenAt}] 뒤의 delete)`,
      );
    }
  }
}

// planImportRestoreTransactionSteps — `ImportRestoreOperation` 배열을 하류 `$transaction` 이 그대로
// 실행할 수 있는 step 서술 배열로 옮긴다.
//   - 입력과 **같은 개수 · 같은 순서** 의 step 을 만든다 (재정렬 · 병합 · 중복 제거 0 — 같은 entity
//     가 같은 phase 에 두 번 나오면 step 도 2 개).
//   - `delegate` / `model` 은 `EXPORT_ENTITY_SOURCES` 조회 결과, `method` 는 phase 파생.
//   - 빈 배열 입력은 정상 — 빈 배열을 돌려준다 (error 아님).
// 입력 방어:
//   - operations 가 배열 아님 (null / undefined / 객체 / 문자열 / 숫자) → TypeError.
//   - 원소가 null / 원시값 → TypeError, records 가 배열 아님 → TypeError.
//   - phase 가 delete/insert 밖, entity 가 5 종 밖, records 가 빈 배열 → RangeError.
//   - delete 가 insert 뒤에 오면 위반 index 를 담은 RangeError (순서 계약).
export function planImportRestoreTransactionSteps(
  operations: ImportRestoreOperation[],
): ImportRestoreTransactionStep[] {
  // 타입 우회로 들어온 비-배열을 잡기 위해 unknown 으로 낮춰 판정한다.
  const candidate: unknown = operations;
  // 위 records 판정과 같은 이유로 배열-shape 은 `typeof` 만 노출한다 (payload 비노출).
  if (!Array.isArray(candidate)) {
    throw new TypeError(
      `planImportRestoreTransactionSteps: operations 는 배열이어야 합니다 (받음: ${typeof candidate})`,
    );
  }

  // 원소 검증 → 순서 계약 검증 → 조립. 검증을 전부 마친 뒤에야 step 을 만들므로 부분 결과 반환
  // 경로가 없다.
  for (let index = 0; index < candidate.length; index += 1) {
    assertOperation(candidate[index], index);
  }
  assertPhaseOrdering(candidate as ReadonlyArray<unknown>);

  return (candidate as ReadonlyArray<ImportRestoreOperation>).map(
    (operation) => {
      const source = EXPORT_ENTITY_SOURCES[operation.entity];
      return {
        phase: operation.phase,
        entity: operation.entity,
        delegate: source.delegate,
        model: source.model,
        method:
          operation.phase === "delete"
            ? ("deleteMany" as const)
            : ("createMany" as const),
        // 새 배열로 복사 — 호출자가 반환 step 의 records 를 바꿔도 입력 operation 은 불변.
        records: [...operation.records],
      };
    },
  );
}
