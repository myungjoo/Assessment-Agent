// import-restore-order — UC-07 Import 복원 FK 안전 실행 순서 순수 helper (T-1261, REQ-030 / REQ-032).
// [ADR-0055](../../docs/decisions/ADR-0055-import-multipart-file-upload.md) §Follow-up (b) 복원
// 엔진 chain (역직렬화 → 구조 검증 → version gate → records hydrate → 복원 입력 합성 → 복원 plan
// 산출 → **FK 안전 실행 순서** → ADR-0044 §3 atomic `$transaction` 복원 → controller 재배선) 의
// **일곱 번째 slice** 다. 직전 slice (T-1260) 가 buffer 하나에서 `ImportRestorePlan` 까지 산출하는
// 단일 계약을 만들었지만, 그 plan 을 실제 `$transaction` 으로 옮기려면 **어느 entity 부터 지우고
// 어느 entity 부터 넣을지** 가 먼저 정해져야 한다. 본 helper 는 그 **실행 순서 한 겹만** 상수 +
// 정렬 함수로 박제해, 다음 slice (plan → entity 별 operation 그룹핑) 와 그 다음 slice (실
// `$transaction`) 가 순서를 재추론하지 않게 한다.
//
// 순서의 근거는 `prisma/schema.prisma` 의 relation 사실이다 — export 5 entity 사이의 유일한 직접
// FK 는 `Assessment.personId → Person` (필수 FK, `onDelete: Cascade`, schema L294~308) 뿐이라
// 삽입은 `Person` 이 `Assessment` 보다 **먼저**, 삭제는 그 **역순** 이어야 부분 실패 없이
// all-or-nothing (ADR-0044 §3) 이 성립한다. `Group` ↔ `Person` 은 join entity
// (`PersonGroupMembership`, export 대상 아님) 경유라 직접 FK 0 이고, `LlmProviderConfig` /
// `PermissionDeniedRecord` 는 나머지 넷과 FK 0 이다. `Person.partId → Part` 의 `Part` 는 export 5
// entity 밖이라 본 순서의 고려 대상이 아니다. 즉 새 정책 결정 0 — schema 사실의 파생물이다.
//
// 순수·non-mutating — 입력 배열 변형 0, 반환은 항상 새 배열, 모듈 상수는 호출로 변하지 않는다.
// DB · Prisma client · repository · `$transaction` · file I/O · REST 배선 0 (`@prisma/client`
// import 0) 이며 plan 산출 · mode 매핑 · delegate 이름 매핑 같은 인접 helper 규칙을 재구현하지
// 않는다 (DRY — 본 helper 는 **순서** 만 담당). REQ-032 (raw 미저장) 정합: 어떤 record 도 읽지
// 않고 entity 이름만 다루므로 raw 를 저장할 표면 자체가 없다.
//
// 입력 방어는 sibling `buildImportRestorePlan` 과 **동형 throw 계약** (TypeError / RangeError +
// 한국어 메시지) 을 택했다 — 상류 `prepareImportRestorePlan` 이 이미 verdict 로 걸러낸 입력을 받는
// 위치라 verdict wrapper 를 한 겹 더 두지 않는다 (throw 흡수는 하류 `$transaction` slice 책임).
import { type ExportEntity } from "../export/export-scope-select";

// 복원 실행 phase — 삭제 단계 / 삽입 단계 2 종. 하류 slice (operation 그룹핑 · 실 `$transaction`)
// 가 `"insert" | "delete"` literal union 을 각자 재선언하지 않도록 named type 으로 승격했다
// (T-1261 reviewer NIT-1 회수). 타입 명명일 뿐 런타임 동작 변경 0 이다.
export type ImportRestorePhase = "insert" | "delete";

// FK 안전 **삽입** rank 의 단일 source-of-truth. `Record<ExportEntity, number>` 라 `ExportEntity`
// union 에 새 entity 가 추가되면 본 객체의 키 누락이 컴파일 error 로 드러난다 (silent 누락 차단).
// 유일한 FK 제약은 `Person` < `Assessment` 이며, 나머지 상대 순서 (`Group` / `LlmConfig` /
// `AuditLog`) 는 FK 가 없어 자유롭지만 재현 가능한 실행을 위해 결정론적 고정값으로 박아둔다.
const INSERT_RANK: Readonly<Record<ExportEntity, number>> = Object.freeze({
  Person: 0,
  Group: 1,
  LlmConfig: 2,
  AuditLog: 3,
  Assessment: 4,
});

// FK 안전 삽입 순서 — `["Person", "Group", "LlmConfig", "AuditLog", "Assessment"]`. 5 entity 를
// 빠짐없이 정확히 1 번씩 담는다 (INSERT_RANK 에서 파생하므로 두 곳이 어긋날 수 없다). 삭제 순서는
// 본 배열의 역순이며 별도 상수로 손으로 적지 않는다 (DRY). 동결 배열이라 push / index 대입이
// 원본을 바꾸지 못한다.
export const IMPORT_RESTORE_INSERT_ORDER: ReadonlyArray<ExportEntity> =
  Object.freeze(
    (Object.keys(INSERT_RANK) as ExportEntity[]).sort(
      (left, right) => INSERT_RANK[left] - INSERT_RANK[right],
    ),
  );

// 허용 entity 멤버십 판정용 집합 — 상수에서 파생하므로 별도 literal 재선언 0.
const VALID_ENTITIES: ReadonlySet<string> = new Set(
  IMPORT_RESTORE_INSERT_ORDER,
);

// 런타임 멤버십 판정 겸 type guard — 상류가 verdict 로 걸러준 입력이라도 비-string / 오타 /
// 소문자 값이 타입 우회로 흘러들 수 있으므로 값 자체로 확인한다.
function isExportEntity(value: unknown): value is ExportEntity {
  return typeof value === "string" && VALID_ENTITIES.has(value);
}

// orderImportRestoreEntities — 주어진 entity 집합을 phase 순서로 정렬한 **새 배열** 로 돌려준다.
//   - `phase: "insert"` → IMPORT_RESTORE_INSERT_ORDER 순서 (`Person` 이 `Assessment` 보다 앞).
//   - `phase: "delete"` → 그 정확한 역순 (상수에서 파생 — 역순 배열을 손으로 적지 않는다).
// 입력 중복은 제거하고 (같은 entity 는 1 번만), 입력에 없는 entity 는 결과에도 없다. 빈 배열
// 입력은 정상이며 두 phase 모두 빈 배열을 돌려준다 (error 아님). 입력 방어:
//   - phase 가 "insert"/"delete" 밖 값 → RangeError (분기 진입 전 거부).
//   - entities 가 배열 아님 → TypeError.
//   - 원소가 5 literal 밖 값 (비-string / 오타 / 소문자 / null / 숫자 / 객체) → 그 index 를 담은
//     RangeError. 검증을 전부 마친 뒤에야 결과를 만들므로 **부분 결과를 돌려주는 경로가 없다**.
export function orderImportRestoreEntities(
  entities: ReadonlyArray<ExportEntity>,
  phase: ImportRestorePhase,
): ExportEntity[] {
  if (phase !== "insert" && phase !== "delete") {
    throw new RangeError(
      `orderImportRestoreEntities: phase 는 insert/delete 중 하나여야 합니다 (받음: ${String(phase)})`,
    );
  }

  if (!Array.isArray(entities)) {
    throw new TypeError(
      `orderImportRestoreEntities: entities 는 배열이어야 합니다 (받음: ${typeof entities})`,
    );
  }

  // 멤버십 검증 + dedupe 를 한 번에 — 결과 배열 조립은 검증 완주 후에만 시작한다.
  const requested = new Set<ExportEntity>();
  for (let index = 0; index < entities.length; index += 1) {
    const entity: unknown = entities[index];
    if (!isExportEntity(entity)) {
      throw new RangeError(
        `orderImportRestoreEntities: entities[${index}] 는 export entity 5 종 중 하나여야 합니다 (받음: ${String(entity)})`,
      );
    }
    requested.add(entity);
  }

  // filter 가 새 배열을 만들므로 reverse 를 이어붙여도 모듈 상수는 오염되지 않는다.
  const ordered = IMPORT_RESTORE_INSERT_ORDER.filter((entity) =>
    requested.has(entity),
  );
  return phase === "delete" ? ordered.reverse() : ordered;
}
