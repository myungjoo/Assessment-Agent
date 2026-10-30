// REQ-041 (R-74) Admin 최근 N일 재수집 패널 (ADR-0040 §1). controlled presentational 컴포넌트라
// window · 진행 · 오류 · 결과를 props 로만 받고 콜백만 호출한다. 요청은 상위 컨테이너가 수행한다.

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
// 파괴적 동작 경고의 기본 한국어 문구 (confirmText 미전달/빈 문자열 시 fallback).
const DEFAULT_CONFIRM_TEXT =
  '주의: 선택한 기간(어제까지)의 저장 결과를 다시 수집·평가해 교체합니다. 교체된 이전 결과는 되돌릴 수 없습니다. 수집이나 평가에 실패한 기간의 결과는 그대로 남고, 아직 끝나지 않은 오늘은 제외합니다.';
const ABORTED_TEXT =
  '실행이 끝까지 진행되지 못했습니다. 처리하지 못한 기간의 이전 결과는 그대로이니 다시 시도해 주세요.';
// 재수집 트리거 버튼 라벨.
const TRIGGER_LABEL = '재수집 시작';

// 서버가 돌려준 끝난 재수집의 실제 결과 (GET /api/schedules/recent-deletion/:personId).
interface RecentRefreshResult {
  deletedCount: number;
  refreshedCount: number;
  notRefreshedCount: number;
  aborted: boolean;
}

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
  // 에러 문구(선택) — truthy 면 role="alert" 로 알리고, 재시도할 수 있게 선택 UI 도 함께 렌더한다.
  error?: string;
  // 마지막 실행 결과(선택) — 삭제 · 저장 · 미교체 건수를 표시한다.
  result?: RecentRefreshResult;
  // true 면 트리거 버튼을 비활성화한다(예: 인원 미선택).
  triggerDisabled?: boolean;
  // 파괴적 동작 경고 문구(선택). 빈 문자열이면 기본 문구로 fallback(빈 경고 방지).
  confirmText?: string;
}

function ReEvaluationTriggerPanel({
  windows,
  selectedDays,
  onSelect,
  onTrigger,
  submitting,
  error,
  result,
  triggerDisabled,
  confirmText,
}: ReEvaluationTriggerPanelProps) {
  // submitting 우선 정책 — 진행 중이면 error·windows 유무와 무관하게 진행 표시만 렌더한다.
  if (submitting === true) {
    return <div role="status">{SUBMITTING_TEXT}</div>;
  }

  // 오류 · 결과 안내는 선택 UI 유무와 무관하게 항상 보인다.
  const notices = (
    <>
      {error ? <div role="alert">{error}</div> : null}
      {result ? (
        <div role="status">
          <p>
            이전 결과 삭제 {result.deletedCount}건 · 새로 저장 {result.refreshedCount}건 · 갱신 안 됨{' '}
            {result.notRefreshedCount}건
          </p>
          {result.aborted ? <p>{ABORTED_TEXT}</p> : null}
        </div>
      ) : null}
    </>
  );

  // 빈 목록 분기 — 선택할 window 가 없으므로 트리거 폼 대신 빈 상태 메시지를 렌더한다.
  if (windows.length === 0) {
    return (
      <div>
        {notices}
        <div role="status">{EMPTY_WINDOWS_TEXT}</div>
      </div>
    );
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
      {notices}
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
        disabled={!hasSelection || triggerDisabled === true}
        onClick={() => onTrigger(selectedDays)}
      >
        {TRIGGER_LABEL}
      </button>
    </div>
  );
}

export type { ReEvaluationWindow, ReEvaluationTriggerPanelProps, RecentRefreshResult };
export default ReEvaluationTriggerPanel;
