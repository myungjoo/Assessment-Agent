// REQ-072 / REQ-073 Admin 패널 (인원·그룹·재평가·import/export·스케줄) 의 마지막 fragment
// 인 "스케줄" building block (ADR-0040 §1). cron 주기 지정(R-72)·manual trigger(R-73) 은
// P7 (Scheduling & operations) 기능이지만 P6 Admin 패널 bullet 이 "스케줄" 을 frontend
// fragment 로 명시하므로, 본 컴포넌트는 그 위에 올라가는 순수 presentational controlled
// component 다 — cron 식·진행 상태·에러·안내 문구·콜백을 props 로만 받아 렌더하고, cron
// 입력 변경·적용 버튼·manual trigger 버튼 클릭 시 콜백만 호출한다. 실제 cron 식 검증/파싱·
// schedule 적용 요청(POST /api/schedule)·manual trigger 요청·진행률 polling·전역 상태·
// 라우팅·App.tsx 배선은 후속 container slice 및 P7 책임 (Out of Scope). 직전 8개 P6 컴포넌트
// (EvaluationGuardBanner, LoginForm, EvaluationResultTable, DifficultyModelSelector,
// SuperAdminSetupForm, GroupMemberList, ReEvaluationTriggerPanel, DataImportExportPanel)
// 와 동일한 props/분기/named·default export convention 을 차용한다.

import type { ChangeEvent } from 'react';

// busy=true 일 때 노출할 기본 한국어 진행 문구.
const BUSY_TEXT = '적용 중…';
// 적용 버튼 기본 라벨 (applyLabel 미전달/빈 문자열 시 fallback — 빈 라벨 방지).
const DEFAULT_APPLY_LABEL = '적용';
// manual trigger 버튼 기본 라벨 (triggerLabel 미전달/빈 문자열 시 fallback — 빈 라벨 방지).
const DEFAULT_TRIGGER_LABEL = '지금 실행';

interface SchedulePanelProps {
  // 현재 cron 식 값(선택) — cron 입력에 표시할 값. 미전달이면 빈 값으로 시작.
  cronExpression?: string;
  // cron 식 변경 콜백(선택) — 주어졌을 때만 cron 입력을 활성 렌더하고 change 시 호출한다.
  // 미전달이면 입력을 비활성화한다(읽기 표시 — 의미 없는 변경 방지).
  onCronChange?: (value: string) => void;
  // 적용 트리거 콜백(선택) — 주어졌을 때만 적용 버튼을 활성 렌더하고 클릭 시 호출한다.
  // 미전달이면 버튼을 비활성화한다(의미 없는 트리거 방지).
  onApply?: () => void;
  // manual trigger 콜백(선택) — 주어졌을 때만 "지금 실행" 버튼을 활성 렌더하고 클릭 시 호출.
  // 미전달이면 버튼을 비활성화한다.
  onManualTrigger?: () => void;
  // 진행 중 플래그 — true 면 error·콜백 유무와 무관하게 진행 표시 우선(busy 우선 정책).
  // 트리거(입력·버튼)는 미렌더해 중복 트리거를 막는다.
  busy?: boolean;
  // 에러 문구(선택) — busy 가 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 안내/성공 문구(선택) — busy/error 가 아닌 정상 상태에서 truthy 면 별도 영역에 렌더.
  message?: string;
  // 적용 버튼 라벨(선택). 빈 문자열이면 기본 라벨로 fallback(빈 라벨 방지).
  applyLabel?: string;
  // manual trigger 버튼 라벨(선택). 빈 문자열이면 기본 라벨로 fallback(빈 라벨 방지).
  triggerLabel?: string;
}

// 스케줄 설정 패널. 실제 cron 검증·schedule/trigger 요청은 수행하지 않고 props 의 상태를
// 표시하며 onCronChange/onApply/onManualTrigger 콜백만 호출하는 presentational 책임만 진다 —
// 실제 요청·진행률 polling·토스트는 상위 컨테이너가 수행한다.
function SchedulePanel({
  cronExpression,
  onCronChange,
  onApply,
  onManualTrigger,
  busy,
  error,
  message,
  applyLabel,
  triggerLabel,
}: SchedulePanelProps) {
  // busy 우선 정책 — 진행 중이면 error·콜백 유무와 무관하게 진행 표시만 렌더한다.
  // 트리거(입력·버튼)를 아예 렌더하지 않아 중복 트리거를 원천 차단한다.
  if (busy === true) {
    return <div role="status">{BUSY_TEXT}</div>;
  }

  // 에러 분기 — busy 가 아니고 error 가 truthy 면 패널 대신 alert 영역만 렌더한다.
  // (빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다 — 경계값.)
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // 라벨 fallback — 빈 문자열/미전달이면 기본 한국어 라벨로 대체(의미 없는 빈 라벨 방지).
  const applyText = applyLabel ? applyLabel : DEFAULT_APPLY_LABEL;
  const triggerText = triggerLabel ? triggerLabel : DEFAULT_TRIGGER_LABEL;

  // cron 입력 change 핸들러 — onCronChange 가 주어졌을 때만 현재 입력 값으로 호출.
  const handleCronChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (onCronChange) {
      onCronChange(event.target.value);
    }
  };

  return (
    <div>
      {/* cron 식 입력 — onCronChange 미전달이면 비활성화(의미 없는 변경 방지). */}
      <label>
        cron 주기
        <input
          type="text"
          value={cronExpression ?? ''}
          disabled={!onCronChange}
          readOnly={!onCronChange}
          onChange={handleCronChange}
        />
      </label>

      {/* 적용 버튼 — onApply 미전달이면 비활성화(의미 없는 트리거 방지). */}
      <button type="button" disabled={!onApply} onClick={() => onApply?.()}>
        {applyText}
      </button>

      {/* manual trigger 버튼 — onManualTrigger 미전달이면 비활성화. */}
      <button type="button" disabled={!onManualTrigger} onClick={() => onManualTrigger?.()}>
        {triggerText}
      </button>

      {/* 안내/성공 문구 — 정상 상태에서 message 가 truthy 일 때만 렌더한다. */}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}

export type { SchedulePanelProps };
export default SchedulePanel;
