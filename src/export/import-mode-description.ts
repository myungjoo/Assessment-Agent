// import-mode-description — UC-07 §6.2 Import mode(replace/merge) 선택 사람-친화 설명 메시지 조립
// 순수 helper (T-0465, P7 R-57 / REQ-030 / REQ-032 / REQ-045). T-0437~T-0464 의 28 building
// block 은 Import mode 의 *판정·계획·결과*는 cover 했으나(buildImportRestorePlan 계획,
// summarizeImportImpact 영향, buildRestoreConfirmation 실행 직전 destructive 경고,
// buildRestoreResult 완료 결과), 사용자가 mode 를 *선택하는 dialog 단계*(UC-07 §5 step 2)에서
// "이 mode 가 DB 에 무엇을 하는가" 를 row count 없이 설명하는 메시지는 0 회 cover 된 gap 이다.
//
// 본 helper 는 직전 T-0462 describeExportScope(Export 측 scope 선택 설명)의 정확한 Import 측
// 대칭이다 — Export 가 read-only scope 범위를 설명한다면, Import 는 mode(replace/merge)가 DB 에
// 가하는 동작(파괴적 교체 vs 보존적 병합)을 설명한다. buildRestoreConfirmation(T-0453)과의 차이가
// 존재 근거다 — confirmation 은 *실행 직전* 의 강한 경고(영향 row count + 명시 확인 요구)인 반면,
// 본 helper 는 *선택 단계* 에서 row count 없이(아직 dump 분석 전) mode 의 의미만 설명한다.
//
// describeImportMode(mode) 는 이미 선택된 ImportRestoreMode enum 만 입력으로 받아(실 DB /
// transaction / dump 분석 / REST / UI 0 — 순수·재실행 0) {headline, detailLines[], destructive,
// mergeStrategy, reason} 의 ImportModeDescription 을 조립한다. persistence / repository / REST
// 배선 호출 0, 새 외부 dependency 0, 새 도메인 타입은 ImportModeDescription 만 신설
// (ImportRestoreMode 는 import-restore-plan.ts 재사용 — 새 mode 도메인 타입 신설 금지). 코드
// 골격은 export-scope-description.ts 의 순수-helper 패턴(plain 모델 interface + 한국어
// TypeError/RangeError 입력 방어 + non-mutating + 불변 flag)을 mirror 한다. REQ-032(raw 미저장)는
// 입력 mode enum 만 다뤄 raw 를 새로 fetch 하지 않으므로 helper layer 에서 자연 유지된다.
import { ImportRestoreMode } from "./import-restore-plan";

// Import mode 설명 dialog 메시지 모델 — plain object. headline 은 선택 mode 를 담은 한국어 한 줄,
// detailLines 는 그 mode 가 DB 에 무엇을 하는지의 한국어 설명 라인 목록(비어있지 않음), destructive
// 는 "기존 row 를 삭제하는가"(replace=true / merge=false) 의 불변 flag, mergeStrategy 는 merge
// 일 때만 conflict 정책 안내 문자열(replace 일 때 null), reason 은 분기 식별 슬러그
// ("replace" | "merge")다. destructive === (reason === "replace") 불변. 후속 WebUI mode 선택
// dialog(P6)가 이 모델을 그대로 렌더한다.
export interface ImportModeDescription {
  headline: string;
  detailLines: string[];
  destructive: boolean;
  mergeStrategy: string | null;
  reason: "replace" | "merge";
}

// 허용 import mode 집합 — 입력 방어에서 이 집합 밖의 값(대소문자 mismatch / 임의 문자열)은
// 호출측 배선 버그로 보아 RangeError. import-restore-plan.ts 의 VALID_MODES 와 동형 집합.
const VALID_MODES: ReadonlySet<string> = new Set<ImportRestoreMode>([
  "replace",
  "merge",
]);

// describeImportMode — 이미 선택된 ImportRestoreMode 를 받아 Import mode 선택 dialog 의 설명
// 메시지 모델을 순수 합성한다(UC-07 §6.2 + §5 step 2 정합):
//   - mode "replace" (default) → headline(전체 교체) + "기존 row 모두 삭제 후 file snapshot 으로
//     복원" 의미 detailLine + destructive=true + mergeStrategy=null + reason="replace".
//   - mode "merge" → headline(병합) + "기존 row 보존 + file artifact 의 row 추가" 의미 detailLine
//     + conflict 정책(file 우선 또는 reject) mergeStrategy 라인 + destructive=false +
//     reason="merge".
//
// destructive === (reason === "replace") 불변(replace 만 파괴적). 반환 객체·배열은 호출마다 새로
// 생성하며(non-mutating, 입력 변형 0), 동일 입력 2 회 호출은 동등 결과(순수·결정성)다. dialog
// 표시 전 안전을 위한 입력 방어:
//   - mode 가 string 아님(null / undefined / 숫자 / 객체) → TypeError(한국어).
//   - mode 가 "replace" / "merge" 외 string(대문자 "REPLACE" / "overwrite" 등) → RangeError(한국어).
export function describeImportMode(
  mode: ImportRestoreMode,
): ImportModeDescription {
  // 비-string 은 enum 멤버십 판정 전에 거부 — null / undefined / 숫자 / 객체 모두 TypeError.
  if (typeof mode !== "string") {
    throw new TypeError(
      `describeImportMode: mode 는 string 이어야 합니다 (받음: ${
        mode === null ? "null" : typeof mode
      })`,
    );
  }

  // 허용 2 종 외 string 은 거부 — 대문자 "REPLACE" / "overwrite" 등 모두 RangeError.
  if (!VALID_MODES.has(mode)) {
    throw new RangeError(
      `describeImportMode: mode 는 replace/merge 중 하나여야 합니다 (받음: ${mode})`,
    );
  }

  if (mode === "replace") {
    // replace(default) → 파괴적 전체 교체. mergeStrategy 는 없음(null).
    return {
      headline: "Import mode: 전체 교체(replace)",
      detailLines: [
        "기존 row 를 모두 삭제한 뒤 file snapshot 으로 복원합니다",
        "복원 후 DB 는 file artifact 의 상태와 동일해집니다 (기존 데이터는 사라집니다)",
      ],
      destructive: true,
      mergeStrategy: null,
      reason: "replace",
    };
  }

  // merge → 보존적 병합. 기존 row 를 삭제하지 않고 file artifact 의 row 를 추가하며, conflict 시
  // 정책(file 우선 또는 reject)을 mergeStrategy 라인으로 안내한다(실 conflict resolution 은 P5
  // service layer 책임 — 본 helper 의 mergeStrategy 는 안내 문자열일 뿐 실 로직 0).
  return {
    headline: "Import mode: 병합(merge)",
    detailLines: [
      "기존 row 를 보존한 채 file artifact 의 row 를 추가합니다",
      "기존 데이터는 삭제되지 않으며 file 의 신규 row 만 더해집니다",
    ],
    destructive: false,
    mergeStrategy:
      "conflict(같은 key) 발생 시 file artifact 의 row 를 우선하거나 해당 row 를 reject 합니다",
    reason: "merge",
  };
}
