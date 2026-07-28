// export-scope-select — UC-07 Export scope 선별 순수 helper (T-0437, P7 R-57 / REQ-030 / REQ-032).
// UC-07 §6.1 의 Export 3 차원 옵션(scope full/range/partial × dateRange × entitySelector) 중
// "이미 메모리에 올라온 record 배열" 을 scope 규칙으로 selected / excluded 두 그룹으로 분류만
// 한다 — persistence/repository/DB query · 직렬화 · REST 배선은 후속 task 책임(본 helper 0).
// REQ-032(raw 미저장)는 본 helper 가 입력 record 만 다루고 raw 를 새로 fetch 하지 않으므로
// helper layer 에서도 자연 유지된다(UC-07 §1 invariant (a)).
//
// 코드 골격은 deletion-window-select.ts 의 순수-helper 패턴을 mirror 한다: 반열림
// [start, end) PeriodRange 분류 + assertValidDate/assertValidRange + non-mutating + 입력
// 순서 보존 + 빈 배열 정상. dateRange 표현은 새 타입을 신설하지 않고 common 의 PeriodRange
// 를 재사용한다(UC-07 §6.1 dateRange 차원).
//
// 제네릭 확장(T-1290) — ExportSelection / selectExportRecords 는 record 타입 파라미터
// TRecord(default = ExportRecord)를 받는다. full-record dump 의 FullExportRecord(= ExportRecord
// + fields)를 scope 선별에 통과시켜도 `fields` 가 타입에서 지워지지 않게 하려는 **타입-only**
// 확장이며 런타임 동작은 0 변경이다(분류 규칙 · 경계 해석 · 에러 메시지 · 순서 전부 불변 —
// 이미 원소 참조를 그대로 옮기고 있었다). import 측 buildImportRestorePlan<TInsert>(T-1266)의
// default 타입 인자 선례와 동형이라 기존 호출처 · 소비처는 무수정으로 컴파일된다.
import { PeriodRange } from "../common/period-boundary";

// UC-07 §6.1 entitySelector 목록 — Export 가 dump 하는 5 entity (Assessment + 인원 master +
// Group + LLM 설정 + Audit log). partial scope 의 선택 단위이자 record 분류 key.
export type ExportEntity =
  | "Assessment"
  | "Person"
  | "Group"
  | "LlmConfig"
  | "AuditLog";

// 분류에 필요한 최소 record 형태 — 전체 row 형태(컬럼 전부)는 후속 배선 책임이라 본 helper 는
// 분류 key(어느 entity 인지 + 언제의 instant 인지)만 안다. instant 는 range scope 의 [start,
// end) 판정에 쓰인다.
export interface ExportRecord {
  entity: ExportEntity;
  instant: Date;
}

// UC-07 §6.1 의 3 차원 Cartesian 옵션 — scope(full/range/partial) + dateRange(임의 start/end)
// + entitySelector(5 entity 다중 선택). dateRange 는 range scope 에서 필수, entitySelector 는
// partial scope 에서 필수. range + entitySelector 동시 지정 시 두 조건 AND(§6.1 분기 backup).
export interface ExportScope {
  scope: "full" | "range" | "partial";
  dateRange?: PeriodRange;
  entitySelector?: ExportEntity[];
}

// 선별 결과 — 입력 records 를 scope 규칙으로 분류한 두 배열. 두 배열 모두 입력 순서를 보존
// 하며, 둘의 합집합은 입력 records 와 동일(중복/누락 0), 입력 배열을 변형하지 않는다.
//
// 타입 파라미터 TRecord (T-1290) — 입력 record 의 실제 타입이 그대로 두 결과 배열까지 전달된다.
// full-record dump(FullExportRecord = ExportRecord + fields)를 scope 선별에 통과시켜도 `fields`
// 가 타입에서 지워지지 않게 하려는 **타입-only 확장** 이며, 런타임 동작은 0 변경이다(이미
// 원소 **참조** 를 그대로 옮긴다). import 측 buildImportRestorePlan<TInsert>(T-1266)의 default
// 타입 인자 형태를 mirror 하므로 기존 `ExportSelection` 표기(export-dump-size-estimate.ts ·
// export-selection-summary.ts · export-job.service.ts)는 한 글자도 고치지 않고 컴파일된다.
export interface ExportSelection<TRecord extends ExportRecord = ExportRecord> {
  selected: TRecord[];
  excluded: TRecord[];
}

// UC-07 §6.1 의 scope 차원·entitySelector 차원 단일 source-of-truth (T-0445 통합). 본 두
// 상수가 select 의 내부 검증과 validate(export-scope-validate.ts)의 mirror 선언을 동시에
// 대체한다 — 한쪽이 바뀌면 다른 쪽이 silent 하게 어긋날 위험을 제거(DRY). 향후 entity 추가/
// 삭제는 ExportEntity union 과 본 배열을 함께 갱신해야 하며, 두 export-scope helper 가 같은
// 멤버십 집합을 본다(regression test 가 단언).
export const VALID_EXPORT_SCOPES: ReadonlyArray<ExportScope["scope"]> = [
  "full",
  "range",
  "partial",
];

// 허용 ExportEntity 5 종(UC-07 §6.1 entitySelector 목록 — ExportEntity union 과 동일 집합).
export const VALID_EXPORT_ENTITIES: ReadonlyArray<ExportEntity> = [
  "Assessment",
  "Person",
  "Group",
  "LlmConfig",
  "AuditLog",
];

const VALID_SCOPES: ReadonlySet<string> = new Set(VALID_EXPORT_SCOPES);

// Invalid Date / 비-Date 입력은 명시적 error (deletion-window-select 의 assertValidDate 와
// 동형 message convention — 해당 helper 가 export 되지 않아 본 파일에 mirror 한다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `selectExportRecords: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// range scope 의 dateRange 검증 — start/end 가 유효 Date 인지(TypeError) + 반열림 구간이
// 비어있지 않은지(start < end, RangeError). start >= end(역전/빈 구간)는 선별 대상이 없으므로
// 호출자 오류로 거부한다(deletion-window-select.assertValidWindow 동형).
function assertValidRange(range: PeriodRange): void {
  assertValidDate(range?.start, "dateRange.start");
  assertValidDate(range?.end, "dateRange.end");
  if (range.start.getTime() >= range.end.getTime()) {
    throw new RangeError(
      `selectExportRecords: dateRange 는 start < end 인 반열림 구간이어야 합니다 ` +
        `(start=${range.start.toISOString()}, end=${range.end.toISOString()})`,
    );
  }
}

// selectExportRecords — 주어진 records 를 scope 규칙으로 selected / excluded 두 그룹으로
// 분류한다. UC-07 §6.1 정합:
//   - scope "full"    → 모든 record selected(dateRange/entitySelector 무시).
//   - scope "range"   → dateRange [start, end) 반열림에 드는 record 만 selected(start 포함,
//                       end 배타). dateRange 부재 시 RangeError.
//   - scope "partial" → entitySelector 에 포함된 entity 의 record 만 selected.
//                       entitySelector 부재/빈 배열 시 RangeError(모호 상태 거부).
//   - range + entitySelector 동시 지정 → 두 조건 AND(둘 다 만족해야 selected).
//
// 입력 배열을 변형하지 않고 새 배열을 반환하며, 각 결과 배열 순서는 입력 순서를 보존한다.
// 빈 records 입력은 빈 분류(error 아님). scope 가 허용 외 값이면 RangeError, records 가
// 배열이 아니면 TypeError, 원소 instant 가 비-Date/Invalid Date 면 그 index 를 메시지에
// 담아 TypeError 를 throw 한다.
//
// 타입 파라미터 TRecord (T-1290) — 입력 원소 타입이 그대로 selected/excluded 까지 전달된다.
// 분기 순서 · 검증 순서 · 에러 메시지 · 결과 순서 · non-mutating 계약은 전부 현행 그대로이며
// 내부 지역 배열의 원소 타입만 TRecord 로 좁힌 **타입-only 확장** 이다(런타임 0 변경).
// 목적: materializeFullExportDownload 가 만드는 FullExportRecord[](= ExportRecord + fields)를
// 본 helper 에 통과시켜도 `fields` 를 캐스팅 없이 읽을 수 있게 하는 것 — 다음 slice 의 scope
// 배선이 캐스팅 표면을 만들지 않도록 미리 타입만 연다(T-1266 buildImportRestorePlan 동형).
export function selectExportRecords<
  TRecord extends ExportRecord = ExportRecord,
>(
  scope: ExportScope,
  records: ReadonlyArray<TRecord>,
): ExportSelection<TRecord> {
  if (!scope || !VALID_SCOPES.has(scope.scope)) {
    throw new RangeError(
      `selectExportRecords: scope 는 full/range/partial 중 하나여야 합니다 (받음: ${String(
        scope?.scope,
      )})`,
    );
  }

  if (!Array.isArray(records)) {
    throw new TypeError(
      `selectExportRecords: records 는 배열이어야 합니다 (받음: ${typeof records})`,
    );
  }

  // range scope 가 쓸 [start, end) ms 경계 — range 분기에서만 계산. entitySelector 가 함께
  // 주어지면 AND 조건의 한 축이 된다.
  let startMs = 0;
  let endMs = 0;
  if (scope.scope === "range") {
    if (!scope.dateRange) {
      throw new RangeError(
        "selectExportRecords: scope=range 에는 dateRange 가 필요합니다",
      );
    }
    assertValidRange(scope.dateRange);
    startMs = scope.dateRange.start.getTime();
    endMs = scope.dateRange.end.getTime();
  }

  // partial scope 가 쓸 entity 집합 — partial 분기에서만 필수. entitySelector 부재/빈 배열은
  // 아무것도 선택 안 되는 모호 상태라 거부한다.
  let partialSet: ReadonlySet<ExportEntity> | null = null;
  if (scope.scope === "partial") {
    if (!scope.entitySelector || scope.entitySelector.length === 0) {
      throw new RangeError(
        "selectExportRecords: scope=partial 에는 비어있지 않은 entitySelector 가 필요합니다",
      );
    }
    partialSet = new Set(scope.entitySelector);
  }

  // range + entitySelector AND 조건의 entity 축 — range scope 에서 entitySelector 가 함께
  // 주어졌을 때만 적용(주어지지 않으면 entity 제약 없음, dateRange 만으로 분류).
  const rangeEntitySet: ReadonlySet<ExportEntity> | null =
    scope.scope === "range" &&
    scope.entitySelector &&
    scope.entitySelector.length > 0
      ? new Set(scope.entitySelector)
      : null;

  // 지역 배열 원소 타입만 TRecord 로 좁힌다(T-1290) — push 하는 값은 입력 원소 **참조** 그대로.
  const selected: TRecord[] = [];
  const excluded: TRecord[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    assertValidDate(record?.instant, `records[${index}].instant`);

    let isSelected: boolean;
    if (scope.scope === "full") {
      // full → 전부 selected(dateRange/entitySelector 무시).
      isSelected = true;
    } else if (scope.scope === "range") {
      const t = record.instant.getTime();
      // 반열림 [start, end) — start 포함, end 배타. getTime() 비교만(offset 산술 0).
      const inRange = t >= startMs && t < endMs;
      // entitySelector 가 함께 주어지면 두 조건 AND.
      isSelected =
        inRange && (rangeEntitySet ? rangeEntitySet.has(record.entity) : true);
    } else {
      // partial → entitySelector 에 든 entity 만 selected.
      isSelected = (partialSet as ReadonlySet<ExportEntity>).has(record.entity);
    }

    if (isSelected) {
      selected.push(record);
    } else {
      excluded.push(record);
    }
  }

  return { selected, excluded };
}
