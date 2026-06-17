// import-restore-confirmation — UC-07 Import 강한 confirmation dialog 메시지 조립 순수 helper
// (T-0453, P7 R-57 / REQ-030 / REQ-032). T-0437 selectExportRecords → T-0438 buildExportDump →
// T-0439 checkSchemaVersionCompat → T-0440 validateImportDumpStructure → T-0441
// summarizeImportImpact → T-0442 buildImportRestorePlan → … → T-0448 summarizeRestorePlan →
// T-0451 detectImportMergeConflicts → T-0452 summarizeImportPreflight 의 다음 게이트-free
// building block 이다. UC-07 §3 trigger 2 + §5 step 2·step 7 은 Import / Restore 가 "가장
// destructive 한 흐름 — 강한 confirmation dialog 필수(destructive 명시 + 영향 범위 표시 + 기존
// 데이터 삭제 경고 + 사용자 명시 확인)" 을 요구한다. T-0437~T-0452 의 15 building block 은
// 영향 범위를 *구조화 데이터*(RestorePlanSummary{deleted/inserted/kept × total/perEntity})로
// 박제했으나, 그 데이터를 사용자에게 보여줄 confirmation dialog *메시지 모델* 로 조립하는
// helper 는 0 회 cover 된 gap 이다 — 실 controller / WebUI 배선이 RestorePlanSummary 를 매번
// 풀어 경고 문구를 중복 작성해야 한다. 본 helper 는 이미 산출된 RestorePlanSummary(T-0448)와
// import mode(replace/merge)를 입력으로 받아(재실행 0 — 순수 DRY 합성)
// {destructive, requiresExplicitConfirm, headline, warnings[], impactLines[]} 단일 confirmation
// 모델로 통합한다.
//
// persistence / repository / transaction / DB delete-insert / REST 배선 호출 0, 새 외부
// dependency 0, 새 도메인 타입은 RestoreConfirmation 만 신설(RestorePlanSummary /
// RestorePlanGroupBreakdown / ExportEntity 재사용). RestorePlanSummary 산출 로직 재구현 0 — 본
// helper 는 입력으로만 받는다(DRY). 코드 골격은 import-restore-plan-summary.ts / import-restore-
// preview.ts / import-preflight-summary.ts 의 순수-helper 패턴(plain 모델 interface + 한국어
// TypeError 메시지 convention + non-mutating + 빈 입력 정상 + perEntity 5-entity)을 mirror
// 한다. REQ-032(raw 미저장)는 입력 summary 의 count 만 다뤄 raw 를 새로 fetch 하지 않으므로
// helper layer 에서 자연 유지된다.
import { ExportEntity } from "./export-scope-select";
import {
  RestorePlanGroupBreakdown,
  RestorePlanSummary,
} from "./import-restore-plan-summary";

// 강한 confirmation dialog 메시지 모델 — plain object. destructive 는 "replace mode 에서 삭제될
// row 가 있는가"(돌이킬 수 없는 손실 발생 여부), requiresExplicitConfirm 은 destructive 와 동치
// (강한 명시 확인 필요), headline 은 mode·삭제/삽입/보존 total 을 담은 한국어 한 줄, warnings 는
// 사용자가 진행 전 반드시 읽어야 할 한국어 경고 누적(throw 0), impactLines 는 deleted/inserted/
// kept 각 그룹의 total + 0 아닌 perEntity 만 한국어 라인으로 나열한 영향 범위 목록이다. 후속
// WebUI confirmation 컴포넌트(P6)가 이 모델을 그대로 렌더한다.
export interface RestoreConfirmation {
  destructive: boolean;
  requiresExplicitConfirm: boolean;
  headline: string;
  warnings: string[];
  impactLines: string[];
}

// 허용 import mode — UC-07 §6.2 의 두 적용 방식. 입력 방어에서 이 집합 밖의 값은 호출측 배선
// 버그로 보아 TypeError.
const VALID_IMPORT_MODES: ReadonlySet<string> = new Set(["replace", "merge"]);

// perEntity 라인 작성 순서 — ExportEntity 5-union 과 동일 집합·고정 순서(라인 결정성 보장).
const ENTITY_ORDER: ReadonlyArray<ExportEntity> = [
  "Assessment",
  "Person",
  "Group",
  "LlmConfig",
  "AuditLog",
];

// 그룹별 한국어 라벨 — impactLines 작성에 쓴다.
const GROUP_LABELS: Record<"deleted" | "inserted" | "kept", string> = {
  deleted: "삭제",
  inserted: "삽입",
  kept: "보존",
};

// plain object(null / 배열 / 비-object 아님) 판정 — top-level summary 입력 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 한 그룹 breakdown(deleted/inserted/kept)의 shape 방어 — 부재 / 비-object 면 TypeError(어느
// 그룹인지 label 로 명시), total 이 비-정수(NaN / 소수 / 음수 / 비-number)면 TypeError. perEntity
// 는 라인 작성 시 0 아닌 값만 number 로 읽으므로 여기서 total 만 엄격 검증한다.
function assertGroupBreakdown(
  value: unknown,
  label: string,
): asserts value is RestorePlanGroupBreakdown {
  if (!isPlainObject(value)) {
    throw new TypeError(
      `buildRestoreConfirmation: summary.${label} 은(는) object 여야 합니다 ` +
        `(받음: ${
          value === undefined
            ? "undefined"
            : value === null
              ? "null"
              : Array.isArray(value)
                ? "array"
                : typeof value
        })`,
    );
  }
  const total = (value as { total?: unknown }).total;
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) {
    throw new TypeError(
      `buildRestoreConfirmation: summary.${label}.total 은(는) 0 이상 정수여야 합니다 ` +
        `(받음: ${String(total)})`,
    );
  }
}

// 한 그룹의 영향 라인을 누적 — total 라인 1 개 + 0 아닌 perEntity 만 entity 라인. perEntity 가
// 비-object 거나 entity 값이 비-정수면 0 으로 간주(total 은 이미 엄격 검증됨 — entity 라인은
// 부가 정보라 관대). 입력을 변형하지 않고 lines 배열에 push 만 한다(non-mutating).
function appendGroupLines(
  lines: string[],
  group: RestorePlanGroupBreakdown,
  key: "deleted" | "inserted" | "kept",
): void {
  const label = GROUP_LABELS[key];
  lines.push(`${label} ${group.total} row`);
  const perEntity = group.perEntity as
    | Record<ExportEntity, unknown>
    | undefined;
  if (!isPlainObject(perEntity)) {
    return;
  }
  for (const entity of ENTITY_ORDER) {
    const count = (perEntity as Record<ExportEntity, unknown>)[entity];
    // 0 아닌 양의 정수 entity 만 라인으로 노출(0 / 비-정수는 생략 — 영향 없음으로 간주).
    if (typeof count === "number" && Number.isInteger(count) && count > 0) {
      lines.push(`  - ${entity}: ${count} row ${label}`);
    }
  }
}

// buildRestoreConfirmation — 이미 산출된 RestorePlanSummary(T-0448)와 import mode 를 받아 강한
// confirmation dialog 메시지 모델을 순수 합성한다(UC-07 §3 trigger 2 + §5 step 2·step 7 정합):
//   - destructive === (mode === "replace" && summary.deleted.total > 0) — replace mode 에서
//     삭제될 row 가 있을 때만 돌이킬 수 없는 손실이 발생하므로 destructive. merge mode 는 기존
//     데이터를 삭제하지 않으므로(보존/삽입) destructive=false. replace + 삭제 0 도 false.
//   - requiresExplicitConfirm === destructive — destructive 흐름만 강한 명시 확인 필요.
//   - headline — mode + 삭제/삽입/보존 total 을 담은 한국어 한 줄.
//   - warnings — replace + 삭제 row 존재 시 "기존 데이터 N row 삭제" 경고 1+ 누적(throw 0 —
//     누적 후 반환). 그 외 빈 배열.
//   - impactLines — deleted/inserted/kept 각 그룹의 total 라인 + 0 아닌 perEntity 라인.
//
// 입력 summary 객체 / 중첩 perEntity map 을 변형하지 않고 새 객체·배열을 반환한다(non-mutating
// — freeze 된 summary 로 호출해도 통과). 빈 영향(모든 total 0)도 정상 처리한다(destructive=
// false, warnings=[], impactLines 는 total 0 라인만). transaction 전 안전을 위한 입력 방어:
//   - summary 가 plain object 아님(null / 배열 / 비-object) → TypeError.
//   - summary.deleted / inserted / kept 중 하나가 부재 / 비-object → TypeError(어느 그룹인지 명시).
//   - 그 total 이 0 이상 정수 아님(NaN / 소수 / 음수 / 비-number) → TypeError.
//   - mode 가 "replace" / "merge" 외 값(빈 문자열 / 대문자 / 숫자 등) → TypeError.
// happy-path 는 summarizeRestorePlan 통과 summary 를 전제하므로 위 방어 분기는 negative test 로
// cover 한다.
export function buildRestoreConfirmation(
  summary: RestorePlanSummary,
  mode: "replace" | "merge",
): RestoreConfirmation {
  // top-level summary 가 plain object 가 아니면 하위 그룹에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(summary)) {
    throw new TypeError(
      `buildRestoreConfirmation: summary 는 plain object 여야 합니다 (받음: ${
        summary === null
          ? "null"
          : Array.isArray(summary)
            ? "array"
            : typeof summary
      })`,
    );
  }

  // mode 는 두 허용 값 외 거부 — 빈 문자열 / 대문자 "REPLACE" / 숫자 등 모두 TypeError.
  if (typeof mode !== "string" || !VALID_IMPORT_MODES.has(mode)) {
    throw new TypeError(
      `buildRestoreConfirmation: mode 는 "replace" | "merge" 중 하나여야 합니다 (받음: ${String(
        mode,
      )})`,
    );
  }

  const source = summary as {
    deleted?: unknown;
    inserted?: unknown;
    kept?: unknown;
  };
  assertGroupBreakdown(source.deleted, "deleted");
  assertGroupBreakdown(source.inserted, "inserted");
  assertGroupBreakdown(source.kept, "kept");

  const deleted = source.deleted as RestorePlanGroupBreakdown;
  const inserted = source.inserted as RestorePlanGroupBreakdown;
  const kept = source.kept as RestorePlanGroupBreakdown;

  // destructive — replace mode 에서 실제 삭제될 row 가 있을 때만 true.
  const destructive = mode === "replace" && deleted.total > 0;
  const requiresExplicitConfirm = destructive;

  const modeLabel = mode === "replace" ? "전체 교체(replace)" : "병합(merge)";
  const headline =
    `${modeLabel} 모드 복원 — 삭제 ${deleted.total} / 삽입 ${inserted.total} / ` +
    `보존 ${kept.total} row`;

  // warnings — destructive 흐름만 강한 경고 누적(throw 0).
  const warnings: string[] = [];
  if (destructive) {
    warnings.push(
      `기존 데이터 ${deleted.total} row 삭제 — 되돌릴 수 없습니다. 진행 전 명시적 확인이 필요합니다`,
    );
  }

  // impactLines — 세 그룹 각각 total 라인 + 0 아닌 perEntity 라인(deleted → inserted → kept 순).
  const impactLines: string[] = [];
  appendGroupLines(impactLines, deleted, "deleted");
  appendGroupLines(impactLines, inserted, "inserted");
  appendGroupLines(impactLines, kept, "kept");

  return {
    destructive,
    requiresExplicitConfirm,
    headline,
    warnings,
    impactLines,
  };
}
