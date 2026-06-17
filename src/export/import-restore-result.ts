// import-restore-result — UC-07 Import 복원 완료 결과 메시지 조립 순수 helper (T-0455,
// P7 R-57 / REQ-030 / REQ-032 / REQ-037). T-0437 selectExportRecords → … → T-0448
// summarizeRestorePlan → T-0453 buildRestoreConfirmation(실행 *전* 강한 confirmation) →
// T-0454 formatAuditLogLine 다음의 게이트-free building block 이다. UC-07 §5 step 13
// (`결과 표시 … Import: 복원 완료 + "다음 평가 진행 시 비어있는 시간 구간 자동 재수집" 안내`)
// + §8 (a) `복원 row count + 영향 요약` 응답 + §8 (c) `UC-01 의 다음 발화가 복원된 master +
// 비어있는 시간 구간 자동 감지 → 재수집`(REQ-037)은 Import transaction commit *이후* Admin 에게
// 보여줄 **복원 완료 결과 메시지** 조립을 박제한다. T-0437~T-0454 의 17 building block 은
// 사전(pre-execution) 흐름만 cover 했고 — transaction commit *후* 결과(복원 완료) 메시지를
// 조립하는 helper 는 0 회 cover 된 gap 이다. 본 helper 는 그 gap 을 순수 DRY 합성으로 박제한다.
//
// buildRestoreResult(summary, mode)는 이미 산출된 RestorePlanSummary(T-0448)와 import
// mode(replace/merge)를 입력으로 받아(재실행 0 — 순수 DRY 합성)
// {headline, restoredCounts, impactLines[], reseedNotice} 단일 결과 모델로 조립한다.
// reseedNotice 는 REQ-037 §8 (c) 자동 재수집 안내 문구(replace/merge 양 mode 공통 — 복원 후
// 비어있는 구간은 항상 다음 발화가 재수집).
//
// persistence / repository / transaction / DB delete-insert / REST 배선 / logger 호출 0, 새
// 외부 dependency 0, 새 도메인 타입은 RestoreResult 만 신설(RestorePlanSummary /
// RestorePlanGroupBreakdown / ExportEntity 재사용). RestorePlanSummary 산출 로직 재구현 0 —
// 본 helper 는 입력으로만 받는다(DRY, summarizeRestorePlan T-0448 책임). 코드 골격은
// import-restore-confirmation.ts(직전 대칭 task T-0453 — 실행 *전* confirmation)의 plain 모델
// interface + 한국어 TypeError/RangeError 메시지 convention + non-mutating + 빈 입력 정상 +
// perEntity 5-entity 패턴을 mirror 한다. REQ-032(raw 미저장)는 입력 summary 의 count 만 다뤄
// raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.
import { ExportEntity } from "./export-scope-select";
import {
  RestorePlanGroupBreakdown,
  RestorePlanSummary,
} from "./import-restore-plan-summary";

// 복원 완료 결과 메시지 모델 — plain object. headline 은 "복원 완료" + mode(replace/merge
// 한국어 표기) + 핵심 count 를 담은 한국어 한 줄, restoredCounts 는 summary 세 그룹의 total 을
// 그대로 옮긴 요약 수치, impactLines 는 deleted/inserted/kept 각 그룹의 total + 0 아닌 perEntity
// 라인(replace mode 의 kept.total=0 은 생략), reseedNotice 는 REQ-037 §8 (c) 자동 재수집 안내
// 한국어 문구(replace/merge 공통 비-빈 문자열)다. 후속 WebUI 결과 화면(P6)이 이 모델을 그대로
// 렌더하고, REST controller(repository 게이트 후속)가 §8 (a) 응답으로 직렬화한다.
export interface RestoreResult {
  headline: string;
  restoredCounts: { deleted: number; inserted: number; kept: number };
  impactLines: string[];
  reseedNotice: string;
}

// 허용 import mode — UC-07 §6.2 의 두 적용 방식. 입력 방어에서 이 집합 밖의 값은 호출측 배선
// 버그로 보아 RangeError(허용 enum 위반은 RangeError, shape 위반은 TypeError 로 구분).
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

// REQ-037 §8 (c) 자동 재수집 안내 — replace/merge 공통 비-빈 문자열. 본 helper 는 안내 문구만
// 조립하며 실 재수집 trigger / UC-01 cron 발화 배선은 §Out of Scope(게이트된 후속).
const RESEED_NOTICE =
  "다음 평가 진행 시 비어있는 시간 구간이 자동으로 재수집됩니다";

// plain object(null / 배열 / 비-object 아님) 판정 — top-level summary + 그룹 + perEntity 입력
// 방어에 쓴다.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 비-plain-object 값의 표시명 — 메시지에 어떤 잘못된 입력이 왔는지 담는다.
function describeNonObject(value: unknown): string {
  return value === undefined
    ? "undefined"
    : value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;
}

// 한 그룹 breakdown(deleted/inserted/kept)의 shape 방어 — 부재 / 비-object 면 TypeError(어느
// 그룹인지 label 로 명시), total 이 비-정수(NaN / 소수 / 음수 / 비-number)면 TypeError, perEntity
// 가 부재 / 비-object 면 TypeError(본 helper 는 §AC 에 따라 perEntity 도 엄격 검증 —
// import-restore-confirmation 보다 강한 방어). 검증 후 호출측은 group.perEntity 를 안전하게 읽는다.
function assertGroupBreakdown(
  value: unknown,
  label: string,
): asserts value is RestorePlanGroupBreakdown {
  if (!isPlainObject(value)) {
    throw new TypeError(
      `buildRestoreResult: summary.${label} 은(는) object 여야 합니다 ` +
        `(받음: ${describeNonObject(value)})`,
    );
  }
  const total = (value as { total?: unknown }).total;
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) {
    throw new TypeError(
      `buildRestoreResult: summary.${label}.total 은(는) 0 이상 정수여야 합니다 ` +
        `(받음: ${String(total)})`,
    );
  }
  const perEntity = (value as { perEntity?: unknown }).perEntity;
  if (!isPlainObject(perEntity)) {
    throw new TypeError(
      `buildRestoreResult: summary.${label}.perEntity 은(는) object 여야 합니다 ` +
        `(받음: ${describeNonObject(perEntity)})`,
    );
  }
}

// 한 그룹의 영향 라인을 누적 — total 라인 1 개 + 0 아닌 perEntity 만 entity 라인. perEntity 의
// entity 값이 0 / 비-정수면 라인을 생략한다(부가 정보라 관대 — total 은 이미 엄격 검증됨). 입력을
// 변형하지 않고 lines 배열에 push 만 한다(non-mutating).
function appendGroupLines(
  lines: string[],
  group: RestorePlanGroupBreakdown,
  key: "deleted" | "inserted" | "kept",
): void {
  const label = GROUP_LABELS[key];
  lines.push(`${label} ${group.total} row`);
  const perEntity = group.perEntity as Record<ExportEntity, unknown>;
  for (const entity of ENTITY_ORDER) {
    const count = perEntity[entity];
    // 0 아닌 양의 정수 entity 만 라인으로 노출(0 / 비-정수는 생략 — 영향 없음으로 간주).
    if (typeof count === "number" && Number.isInteger(count) && count > 0) {
      lines.push(`  - ${entity}: ${count} row ${label}`);
    }
  }
}

// buildRestoreResult — 이미 산출된 RestorePlanSummary(T-0448)와 import mode 를 받아 Import
// transaction commit *이후* Admin 에게 보여줄 복원 완료 결과 메시지 모델을 순수 합성한다(UC-07
// §5 step 13 + §8 (a)(c) 정합):
//   - headline — "복원 완료" + mode(replace/merge 한국어 표기) + 삭제/삽입/보존 핵심 count 한 줄.
//   - restoredCounts — summary.deleted/inserted/kept 의 total 을 그대로 옮긴 요약 수치.
//   - impactLines — deleted → inserted → kept 순 각 그룹 total 라인 + 0 아닌 perEntity 라인.
//     replace mode 는 kept.total=0 이 정상(§6.2)이라 kept.total===0 이면 보존 라인 자체를 생략한다.
//   - reseedNotice — REQ-037 §8 (c) 자동 재수집 안내(replace/merge 공통 비-빈 문자열).
//
// 입력 summary 객체 / 중첩 perEntity map 을 변형하지 않고 새 객체·배열을 반환한다(non-mutating —
// freeze 된 summary 로 호출해도 통과). 빈 복원(모든 total 0)도 정상 처리한다(throw 0 — total 0
// 라인 + 자동 재수집 안내). transaction 후 안전을 위한 입력 방어:
//   - summary 가 plain object 아님(null / 배열 / 비-object) → TypeError.
//   - summary.deleted / inserted / kept 중 하나가 부재 / 비-object → TypeError(어느 그룹인지 명시).
//   - 그 total 이 0 이상 정수 아님(NaN / 소수 / 음수 / 비-number) → TypeError.
//   - 그 perEntity 가 부재 / 비-object → TypeError.
//   - mode 가 "replace" / "merge" 외 값(빈 문자열 / 대문자 / 숫자 / null 등) → RangeError.
// happy-path 는 summarizeRestorePlan 통과 summary 를 전제하므로 위 방어 분기는 negative test 로
// cover 한다.
export function buildRestoreResult(
  summary: RestorePlanSummary,
  mode: "replace" | "merge",
): RestoreResult {
  // top-level summary 가 plain object 가 아니면 하위 그룹에 접근할 수 없어 즉시 throw.
  if (!isPlainObject(summary)) {
    throw new TypeError(
      `buildRestoreResult: summary 는 plain object 여야 합니다 (받음: ${describeNonObject(
        summary,
      )})`,
    );
  }

  // mode 는 두 허용 값 외 거부 — 빈 문자열 / 대문자 "REPLACE" / 숫자 / null 등 모두 RangeError
  // (허용 enum 위반은 RangeError, shape 위반은 TypeError 로 구분).
  if (typeof mode !== "string" || !VALID_IMPORT_MODES.has(mode)) {
    throw new RangeError(
      `buildRestoreResult: mode 는 "replace" | "merge" 중 하나여야 합니다 (받음: ${String(
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

  const modeLabel = mode === "replace" ? "전체 교체(replace)" : "병합(merge)";
  const headline =
    `복원 완료 — ${modeLabel} 모드, 삭제 ${deleted.total} / 삽입 ${inserted.total} / ` +
    `보존 ${kept.total} row`;

  const restoredCounts = {
    deleted: deleted.total,
    inserted: inserted.total,
    kept: kept.total,
  };

  // impactLines — 세 그룹 각각 total 라인 + 0 아닌 perEntity 라인(deleted → inserted → kept 순).
  // replace mode 의 kept.total===0 은 정상(§6.2)이라 보존 라인 자체를 생략한다.
  const impactLines: string[] = [];
  appendGroupLines(impactLines, deleted, "deleted");
  appendGroupLines(impactLines, inserted, "inserted");
  if (kept.total > 0) {
    appendGroupLines(impactLines, kept, "kept");
  }

  return {
    headline,
    restoredCounts,
    impactLines,
    reseedNotice: RESEED_NOTICE,
  };
}
