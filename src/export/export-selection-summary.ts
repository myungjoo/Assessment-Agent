// export-selection-summary — UC-07 Export 선별 결과 영향 breakdown 요약 순수 helper (T-0449,
// P7 R-57 / REQ-030 / REQ-032). T-0437 의 selectExportRecords → T-0438 의 buildExportDump →
// T-0439 의 checkSchemaVersionCompat → T-0440 의 validateImportDumpStructure → T-0441 의
// summarizeImportImpact → T-0442 의 buildImportRestorePlan → ... → T-0448 의 summarizeRestorePlan
// 다음의 자연 building block 이다. Import 측에는 영향 요약 helper 두 개(summarizeImportImpact —
// dump 입력 / summarizeRestorePlan — plan 의 3 배열 입력)가 있지만, Export 측의 대칭 helper 는
// 부재였다 — selectExportRecords(T-0437)가 산출한 ExportSelection({selected, excluded} 두 배열)은
// 두 배열을 통째로 들고 있을 뿐, UC-07 §3 trigger 1 의 confirmation dialog(scope 옵션 선택) +
// §5 step 2(scope 옵션 확인) + §8 (b) Audit row(Export 종류 + actor + scope + row count)가
// 필요로 하는 선별/제외 row 의 entity-별 + 전체 breakdown + instant 시간 범위를 0회 derive 한다.
// buildExportDump(T-0438)는 envelope entityCounts(selected 만) + recordCount 단일 metadata 만
// 노출하고 excluded 분포·instant 범위는 노출 0 이다. 본 helper 는 그 gap 을 순수 derivation 으로
// 박제한다 — ExportSelection 을 받아 {selected, excluded} 각각의 total + perEntity(5 entity)
// breakdown + instantRange(earliest/latest 또는 null)를 산출하는 순수 함수다.
//
// persistence / repository / transaction / DB query · 직렬화 · REST 배선 호출 0 이며, 새 도메인
// 타입 신설 0(export-scope-select.ts 의 ExportSelection / ExportEntity / ExportRecord 재사용),
// 새 외부 dependency 0 이다. selectExportRecords 의 분류 로직 재구현도 0 — 본 helper 는 selection
// 을 입력으로만 받는다. 코드 골격은 import-restore-preview.ts(summarizeImportImpact)의 순수-helper
// 패턴(plain 요약 interface + perEntity 5 entity 0-init + instantRange{earliest,latest}|null +
// non-mutating + assertValidDate 한국어 메시지 convention + 빈 입력 정상)을 mirror 하고,
// import-restore-plan-summary.ts(summarizeRestorePlan)의 "두 개 이상 그룹 breakdown"(summarizeGroup
// 내부 helper + 그룹 별 반환 패턴)을 selected/excluded 두 그룹으로 확장한다. REQ-032(raw 미저장)는
// 본 helper 가 입력 selection 의 record 만 집계하고 raw 를 새로 fetch 하지 않으므로 layer 에서
// 자연 유지된다.
import {
  ExportEntity,
  ExportRecord,
  ExportSelection,
} from "./export-scope-select";

// 한 그룹(selected/excluded)의 breakdown — total(그룹 전체 row 수) + perEntity(5 entity 전부
// key 인 number map, records 실측 집계) + instantRange(records 의 instant 시간 범위, 빈 그룹이면
// null). 5 허용 외 entity 는 perEntity 에 key 가 없어 자연 무시(entity 허용 검증은 T-0440 책임
// 으로 위임).
export interface ExportSelectionGroupBreakdown {
  total: number;
  perEntity: Record<ExportEntity, number>;
  instantRange: { earliest: Date; latest: Date } | null;
}

// Export 선별 결과 영향 breakdown 요약 verdict — plain object. selection 의 두 배열(selected/
// excluded)을 각각 그룹 breakdown 으로 집계한다. 후속 confirmation dialog(UC-07 §3 trigger 1 /
// §5 step 2)와 Audit row(§8 (b) row count)가 이 요약을 그대로 사용한다.
export interface ExportSelectionSummary {
  selected: ExportSelectionGroupBreakdown;
  excluded: ExportSelectionGroupBreakdown;
}

// plain object(null/배열/비-object 아님) 판정 — top-level selection 입력 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Invalid Date / 비-Date 입력은 명시적 error (import-restore-preview.assertValidDate 와 동형
// message convention — 해당 helper 가 export 되지 않아 본 파일에 mirror 한다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `summarizeExportSelection: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// 한 selection 배열을 그룹 breakdown 으로 집계 — 비-배열 시 TypeError(label 명시), 원소 instant
// 가 비-Date/Invalid Date 면 그 index 를 메시지에 담아 TypeError. 5 entity 전부 0-init map 에
// records 1 회 순회로 +1 집계하며, 5 허용 외 entity 는 key 가 없어 자연 무시. earliest/latest 는
// 같은 순회에서 갱신하므로 정렬되지 않은 instant 배열에서도 정확한 min/max 를 뽑는다. 빈 그룹의
// instantRange 는 null(단일 record 그룹은 earliest === latest 경계). 입력 배열·원소를 변형하지
// 않고 새 map/instantRange 를 반환한다(non-mutating — 원본 Date 참조는 복제하지 않고 그대로
// 담아도 무방).
function summarizeGroup(
  records: unknown,
  label: string,
): ExportSelectionGroupBreakdown {
  if (!Array.isArray(records)) {
    throw new TypeError(
      `summarizeExportSelection: selection.${label} 는 배열이어야 합니다 (받음: ${typeof records})`,
    );
  }

  // perEntity 5 entity 전부 0 초기화 — records 에 없는 entity 도 key 로 존재(누락 0).
  const perEntity = {
    Assessment: 0,
    Person: 0,
    Group: 0,
    LlmConfig: 0,
    AuditLog: 0,
  } as Record<ExportEntity, number>;

  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index] as ExportRecord;
    assertValidDate(record?.instant, `${label}[${index}].instant`);
    const entity = record.entity;
    // 5 허용 entity 만 집계 — 허용 외 값(분류 전제 위반)은 perEntity 에 key 가 없으므로 자연
    // 무시(누락 0, T-0440 검증 책임 위임).
    if (
      Object.prototype.hasOwnProperty.call(perEntity, entity) &&
      typeof entity === "string"
    ) {
      perEntity[entity] += 1;
    }
    const instant = record.instant;
    if (earliest === null || instant.getTime() < earliest.getTime()) {
      earliest = instant;
    }
    if (latest === null || instant.getTime() > latest.getTime()) {
      latest = instant;
    }
  }

  // 빈 그룹 → instantRange null. 비어있지 않으면 earliest/latest 가 모두 set 됨(단일 record 면
  // earliest === latest 경계).
  const instantRange =
    earliest !== null && latest !== null ? { earliest, latest } : null;

  return { total: records.length, perEntity, instantRange };
}

// summarizeExportSelection — selectExportRecords(T-0437)가 산출한 ExportSelection 을 받아
// {selected, excluded} 각 그룹의 total + perEntity(5 entity) breakdown + instantRange 를 순수
// derivation 으로 산출한다. UC-07 §6.1 정합:
//   - full scope(excluded 빈 배열) → excluded.total=0 + perEntity 전부 0 + instantRange null.
//   - range scope(부분 selected/excluded) → 두 그룹 정확 분배.
//   - partial scope → entity 별 분배 정확.
//   - perEntity 는 record 1 회 순회 entity-별 집계(records 가 ground truth, dump 의
//     entityCounts metadata 와 별개).
//
// 입력 selection / 두 배열 / record instant Date 객체를 변형하지 않으며(non-mutating — freeze 된
// selection/배열로 호출해도 통과), 반환 map/instantRange 는 새 객체다. transaction/dump 조립 전
// 안전을 위한 최소 입력 방어:
//   - selection 이 plain object 아님(null/배열/비-object) → TypeError.
//   - selection.selected / excluded 중 하나가 배열 아님 → TypeError(어느 배열인지 명시).
//   - record 원소의 instant 가 유효 Date 아님(비-Date / Invalid Date) → 그 index 를 메시지에
//     담은 TypeError.
// happy-path 는 selectExportRecords 통과 selection 을 전제하므로 위 방어 분기는 negative test 로
// cover 한다.
export function summarizeExportSelection(
  selection: ExportSelection,
): ExportSelectionSummary {
  // top-level selection 이 plain object 가 아니면 하위 배열에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(selection)) {
    throw new TypeError(
      `summarizeExportSelection: selection 은 plain object 여야 합니다 (받음: ${
        selection === null
          ? "null"
          : Array.isArray(selection)
            ? "array"
            : typeof selection
      })`,
    );
  }

  const source = selection as {
    selected?: unknown;
    excluded?: unknown;
  };

  return {
    selected: summarizeGroup(source.selected, "selected"),
    excluded: summarizeGroup(source.excluded, "excluded"),
  };
}
