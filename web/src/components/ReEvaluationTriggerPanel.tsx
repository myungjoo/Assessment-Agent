// REQ-041 (R-74) Admin 재평가(최근 N일 delete→재수집) 트리거 패널 — Admin 패널
// (인원·그룹·재평가·import/export·스케줄) 의 "재평가" building block (ADR-0040 §1).
// backend 의 재수집/N일 delete API 는 별도 phase(P7)에서 완결될 예정이라, 본 컴포넌트는
// 그 위에 올라가는 순수 presentational controlled component 다 — 선택 가능한 N일 window
// 목록·선택값·진행 상태·에러를 props 로만 받아 렌더하고, 트리거 버튼 클릭 시 콜백만
// 호출한다. 실제 /api/* fetch·재수집/삭제 요청·낙관적 업데이트·전역 상태·라우팅 배선·
// confirm 모달 흐름은 후속 container slice 책임 (Out of Scope). 직전 6개 P6 컴포넌트
// (EvaluationGuardBanner, LoginForm, EvaluationResultTable, DifficultyModelSelector,
// SuperAdminSetupForm, GroupMemberList) 와 동일한 props/분기/named·default export
// convention 을 차용한다.

// N일 재수집 window 옵션 — 선택 가능한 기간 단위(예: 최근 1일/1주/30일).
interface ReEvaluationWindow {
  // 재수집 대상 기간(일) — selectedDays 와 매칭되는 값이자 콜백 인자로 쓴다.
  days: number;
  // window 표시 라벨(예: '최근 1일') — 선택 UI 의 주 라벨.
  label: string;
}

// submitting=true 일 때 노출할 기본 한국어 진행 문구.
const SUBMITTING_TEXT = '재수집 진행 중…';
// windows 가 빈 배열일 때 노출할 기본 한국어 문구 — 선택할 window 가 없어 트리거 불가.
const EMPTY_WINDOWS_TEXT = '선택 가능한 재수집 기간이 없습니다';
// 파괴적(delete→재수집) 동작 경고의 기본 한국어 문구 (confirmText 미전달/빈 문자열 시 fallback).
const DEFAULT_CONFIRM_TEXT =
  '주의: 선택한 기간의 기존 결과를 삭제한 뒤 재수집합니다. 되돌릴 수 없습니다.';
// 재수집 트리거 버튼 라벨.
const TRIGGER_LABEL = '재수집 시작';

interface ReEvaluationTriggerPanelProps {
  // 선택 가능한 N일 window 목록 — controlled component 라 상위가 보유한다(빈 배열이면 빈 상태).
  windows: ReEvaluationWindow[];
  // 현재 선택된 window 의 days 값(controlled) — windows 에 없는 값이면 placeholder 로 fallback.
  selectedDays: number;
  // window 선택 변경 콜백 — placeholder(빈 value) 가 아닌 window 선택 시에만 호출한다.
  onSelect: (days: number) => void;
  // 재수집 트리거 버튼 클릭 콜백 — 선택된 days 로 호출한다.
  onTrigger: (days: number) => void;
  // 재수집 진행 중 플래그 — true 면 windows·error 유무와 무관하게 진행 표시 우선(submitting 우선 정책).
  submitting?: boolean;
  // 에러 문구(선택) — submitting 이 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 파괴적 동작 경고 문구(선택). 빈 문자열이면 기본 문구로 fallback(빈 경고 방지).
  confirmText?: string;
}

// 재평가 트리거 패널. 실제 재수집/삭제 요청은 수행하지 않고 props 의 windows·selectedDays 를
// 표시하며 onSelect/onTrigger 콜백만 호출하는 presentational 책임만 진다 — 실제 요청·낙관적
// 업데이트·confirm 흐름은 상위 컨테이너가 수행한다.
function ReEvaluationTriggerPanel({
  windows,
  selectedDays,
  onSelect,
  onTrigger,
  submitting,
  error,
  confirmText,
}: ReEvaluationTriggerPanelProps) {
  // submitting 우선 정책 — 진행 중이면 error·windows 유무와 무관하게 진행 표시만 렌더한다.
  if (submitting === true) {
    return <div role="status">{SUBMITTING_TEXT}</div>;
  }

  // 에러 분기 — submitting 이 아니고 error 가 truthy 면 선택 UI 대신 alert 영역만 렌더한다.
  // (빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다 — 경계값.)
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // 빈 목록 분기 — 선택할 window 가 없으므로 트리거 폼 대신 빈 상태 메시지를 렌더한다.
  // (의미 없는 빈 트리거 방지 — 트리거 버튼 자체를 렌더하지 않는다.)
  if (windows.length === 0) {
    return <div role="status">{EMPTY_WINDOWS_TEXT}</div>;
  }

  // 경고 문구 — confirmText 미전달/빈 문자열이면 기본 문구로 fallback(빈 경고 방지 정책).
  const warning = confirmText ? confirmText : DEFAULT_CONFIRM_TEXT;

  // <select> 변경 핸들러 — 빈 value 선택은 무시하고, window 선택 시에만 days 로 콜백 호출.
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    if (value !== '') {
      onSelect(Number(value));
    }
  };

  // selectedDays 가 windows 에 존재하는지 — 없으면 placeholder(빈 value) 로 fallback 하고
  // 트리거 버튼을 비활성화한다(의미 없는 기간의 트리거 방지 — 값 mismatch 경계).
  const hasSelection = windows.some((window) => window.days === selectedDays);

  return (
    <div>
      {/* 파괴적 동작 경고 — 항상 표시해 사용자가 delete→재수집 임을 인지하게 한다. */}
      <p>{warning}</p>

      <label>
        재수집 기간
        <select
          name="reevaluation-window"
          // controlled — 현재 선택값을 반영하되 windows 에 없는 값은 placeholder 로 fallback.
          value={hasSelection ? String(selectedDays) : ''}
          onChange={handleChange}
        >
          {/* 미선택 placeholder — value 빈 문자열이라 콜백을 트리거하지 않는다. */}
          <option value="">선택하세요</option>
          {windows.map((window) => (
            <option key={window.days} value={window.days}>
              {window.label}
            </option>
          ))}
        </select>
      </label>

      {/* 트리거 버튼 — 진행 중이 아닐 때만 도달하며, 유효 선택이 없으면 비활성화한다. */}
      <button
        type="button"
        disabled={!hasSelection}
        onClick={() => onTrigger(selectedDays)}
      >
        {TRIGGER_LABEL}
      </button>
    </div>
  );
}

export type { ReEvaluationWindow, ReEvaluationTriggerPanelProps };
export default ReEvaluationTriggerPanel;
