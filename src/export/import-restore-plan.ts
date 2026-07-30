// import-restore-plan — UC-07 Import 복원 plan 산출 순수 helper (T-0442, P7 R-57 / REQ-030 /
// REQ-032). T-0437 의 selectExportRecords(scope 선별) → T-0438 의 buildExportDump(dump 조립) →
// T-0439 의 checkSchemaVersionCompat(version gate) → T-0440 의 validateImportDumpStructure
// (구조 무결성 gate) → T-0441 의 summarizeImportImpact(영향 범위 요약) 다음의 자연 building
// block 이다. 구조 검증(T-0440)과 영향 요약(T-0441)을 통과한 dump 를 실 transaction 으로
// 복원하기 직전, **어떤 record 를 삭제 / 삽입 / 보존할지** 를 결정하는 것이 UC-07 §6.2 의
// replace / merge mode 정책이다. 본 helper 는 그 결정 로직을 순수 derivation 으로 박제한다 —
// 메모리에 올라온 기존 record 배열 + import dump 의 record 배열 + mode 를 받아
// {toDelete, toInsert, toKeep} plan 을 산출하는 순수 함수다.
//
// 실 transaction / repository / DB delete-insert / Prisma 호출 0 이며(UC-07 §5 step 9·13, §6.2,
// §8 (a) 게이트된 후속 sub-slice 책임), file parse / JSON.parse / 무결성 hash 도 본 helper 0
// 이다 — 본 helper 는 이미 메모리에 올라온 record 배열만 다룬다. schema version 호환 판정
// (T-0439)도 구조 무결성 전체 검증(T-0440)도 본 helper 0 이며, transaction 전 안전을 위해
// 최소 입력 방어(비-배열 / instant 비-Date·Invalid Date / 잘못된 mode)만 명시적 error 로 막는다.
// 코드 골격은 export-scope-select.ts / import-restore-preview.ts 의 순수-helper 패턴(plain 결과
// interface + non-mutating + assertValidDate 한국어 메시지 convention + 입력 순서 보존)을 mirror
// 하고, 타입은 새로 신설하지 않고 export-scope-select.ts 의 ExportEntity / ExportRecord 를
// 재사용한다. REQ-032(raw 미저장)는 본 helper 가 입력 record 만 다루고 raw 를 새로 fetch 하지
// 않으므로 helper layer 에서 자연 유지된다.
//
// T-1266 (ADR-0055 §Follow-up (b) chain 12 번째 slice) — 상류 hydrate(T-1265)가 fields 를 실은
// FullExportRecord[] 를 돌려주게 되면서, plan 경계에서 그 타입이 ExportRecord 로 좁혀져 사라지던
// 문제를 **삽입 대상 record 타입 파라미터** 하나로 닫는다. 런타임 동작은 0 변경(이미 원소 참조를
// 그대로 옮긴다)이고, fields 는 여전히 들여다보지도 변환하지도 않는다(REQ-032 정합 — 충돌 key 는
// entity + instant 만, error 메시지에도 fields 값이 실리지 않는다).
import { ExportRecord } from "./export-scope-select";

// Import 복원 mode — UC-07 §6.2. replace(default): 기존 row 모두 삭제 후 file snapshot 으로 복원.
// merge: 기존 row 보존 + file artifact 의 row 추가, conflict 시 file 우선.
export type ImportRestoreMode = "replace" | "merge";

const VALID_MODES: ReadonlySet<string> = new Set(["replace", "merge"]);

// 복원 plan — plain object. 실 transaction 이 이 plan 대로 delete → insert 를 수행하되 기존 중
// toKeep 은 건드리지 않는다(UC-07 §1 invariant (b) atomic — 본 helper 는 분류만, 실 transaction 은
// 후속). 세 배열 모두 입력 순서를 보존하며 non-mutating(입력 배열·원소 변형 0).
//
// 타입 파라미터 TInsert (T-1266) — **삽입 대상 record 타입만** 여는 단일 파라미터다. 이름이
// TInsert 인 이유는 여는 대상이 정확히 toInsert 하나이기 때문이고(TRecord 처럼 넓은 이름은 세
// 배열이 다 열리는 오해를 부른다), 기본값을 ExportRecord 로 둔 이유는 타입 인자 없이 쓰는 기존
// 소비처(import-restore-plan-summary / import-merge-conflict / import-restore-ops 등)를 한 줄도
// 고치지 않기 위해서다(하위호환).
export interface ImportRestorePlan<
  TInsert extends ExportRecord = ExportRecord,
> {
  // 삭제 대상 — replace: 기존 전부. merge: incoming 과 충돌(같은 key)하는 기존만.
  // 파라미터화하지 않는다 — 기존 row 는 DB 에서 읽은 것이라 dump 의 fields 를 갖지 않는다.
  toDelete: ExportRecord[];
  // 삽입 대상 — replace: incoming 전부. merge: incoming 전부(비충돌은 신규, 충돌은 file 우선 교체).
  // incoming 이 실어온 타입(예: fields 를 가진 FullExportRecord)이 여기까지 그대로 전달된다.
  toInsert: TInsert[];
  // 보존 대상 — replace: 없음(빈 배열). merge: incoming 과 충돌하지 않는 기존.
  toKeep: ExportRecord[];
}

// Invalid Date / 비-Date 입력은 명시적 error (export-scope-select.assertValidDate 와 동형
// message convention — 해당 helper 가 export 되지 않아 본 파일에 mirror 한다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `buildImportRestorePlan: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// 충돌 판정 key — entity + instant millis 조합(UC-07 §6.2 의 단순 key, PK 기반 dedupe /
// timestamp 비교 같은 복잡한 conflict resolution 은 P5 service layer 책임이라 본 helper 0).
// 구분자 U+0000 은 소스에 raw 바이트가 아니라 `\u0000` 이스케이프 표기로 적는다(T-1267) —
// 산출 문자열은 이전과 바이트 단위로 동일하되, raw 제어 바이트가 있으면 git 이 이 파일을
// binary 로 오탐해 이 모듈을 건드리는 PR 의 production diff 가 GitHub UI 에서 보이지 않는다.
function conflictKey(record: ExportRecord): string {
  return `${record.entity}\u0000${record.instant.getTime()}`;
}

// records 배열 입력 방어 + 원소 instant 검증 — 비-배열 시 TypeError, 원소 instant 가
// 비-Date/Invalid Date 면 그 index 를 메시지에 담아 TypeError. 검증만 하고 변형하지 않는다.
function assertValidRecords(
  records: ReadonlyArray<ExportRecord>,
  label: string,
): void {
  if (!Array.isArray(records)) {
    throw new TypeError(
      `buildImportRestorePlan: ${label} 는 배열이어야 합니다 (받음: ${typeof records})`,
    );
  }
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    assertValidDate(record?.instant, `${label}[${index}].instant`);
  }
}

// buildImportRestorePlan — 기존 record 배열 + import dump 의 incoming record 배열 + mode 를 받아
// 복원 plan(ImportRestorePlan)을 순수 derivation 으로 산출한다. UC-07 §6.2 정합:
//   - replace mode (default): 기존 전부 toDelete, incoming 전부 toInsert, toKeep 빈 배열
//     ("기존 row 모두 삭제 후 file snapshot 으로 복원").
//   - merge mode: incoming 의 충돌 key 집합을 먼저 만든 뒤 —
//       · 기존 record 중 incoming 과 충돌하는 것은 toDelete(file 우선), 비충돌은 toKeep.
//       · incoming record 는 전부 toInsert(비충돌은 신규, 충돌은 기존을 교체하는 file 우선본).
//     충돌 판정 key 는 entity + instant.getTime() 조합("conflict 시 file 우선").
//
// 모든 출력 배열은 입력 순서를 보존하고 non-mutating(freeze 된 입력으로 호출해도 통과, 입력
// 배열·원소 변형 0)이다. 빈 입력은 정상(error 아님) — replace 빈 existing → 빈 toDelete,
// merge 빈 incoming → 빈 toInsert + 기존 전부 toKeep. transaction 전 안전을 위한 최소 입력 방어:
//   - existing / incoming 이 배열 아님 → TypeError.
//   - 원소의 instant 가 유효 Date 아님(비-Date / Invalid Date) → 그 index 를 메시지에 담은 TypeError.
//   - mode 가 "replace"/"merge" 외 값 → RangeError.
//
// 타입 파라미터 TInsert (T-1266) — incoming 원소 타입이 그대로 toInsert 까지 전달된다. 이미
// incoming.slice() 로 원소 **참조** 를 옮기고 있어 런타임 동작은 0 변경이며, 타입 문만 열려
// FullExportRecord(= ExportRecord + fields) 를 넘기면 plan 에서 fields 를 캐스팅 없이 읽을 수
// 있다(다음 slice 의 createMany row payload). existing 은 파라미터화하지 않는다 — 기존 row 는
// fields 를 갖지 않고, merge 의 targeted delete 는 미해결 별도 slice 다.
export function buildImportRestorePlan<
  TInsert extends ExportRecord = ExportRecord,
>(
  existing: ReadonlyArray<ExportRecord>,
  incoming: ReadonlyArray<TInsert>,
  mode: ImportRestoreMode,
): ImportRestorePlan<TInsert> {
  // mode 검증 먼저 — 잘못된 mode 는 분기 진입 전 거부(대소문자 mismatch / null / 숫자 모두 reject).
  if (typeof mode !== "string" || !VALID_MODES.has(mode)) {
    throw new RangeError(
      `buildImportRestorePlan: mode 는 replace/merge 중 하나여야 합니다 (받음: ${String(mode)})`,
    );
  }

  // 두 배열 + 원소 instant 검증 — incoming 충돌 key 를 만들기 전에 입력 무결성을 먼저 확정한다.
  assertValidRecords(existing, "existing");
  assertValidRecords(incoming, "incoming");

  if (mode === "replace") {
    // replace: 기존 전부 삭제, incoming 전부 삽입, 보존 없음. 입력 순서 보존 새 배열(non-mutating).
    return {
      toDelete: existing.slice(),
      toInsert: incoming.slice(),
      toKeep: [],
    };
  }

  // merge: incoming 의 충돌 key 집합을 먼저 구성 — 기존 record 가 이 집합에 들면 충돌(file 우선
  // 으로 toDelete), 아니면 toKeep.
  const incomingKeys = new Set<string>();
  for (let index = 0; index < incoming.length; index += 1) {
    incomingKeys.add(conflictKey(incoming[index]));
  }

  const toDelete: ExportRecord[] = [];
  const toKeep: ExportRecord[] = [];
  // 기존 record 순회 — 입력 순서 보존하며 충돌 여부로 toDelete / toKeep 분류.
  for (let index = 0; index < existing.length; index += 1) {
    const record = existing[index];
    if (incomingKeys.has(conflictKey(record))) {
      toDelete.push(record);
    } else {
      toKeep.push(record);
    }
  }

  // incoming 전부 toInsert — 비충돌은 신규 추가, 충돌은 기존을 교체하는 file 우선본(입력 순서 보존).
  return {
    toDelete,
    toInsert: incoming.slice(),
    toKeep,
  };
}
