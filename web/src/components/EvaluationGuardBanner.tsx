// R-78 평가 진행 중 시각화 보호 — 전역 경고 배너 (ADR-0040 §6).
// 평가 자료 수집/평가 중에는 기존 자료만 표시하고 상단에 경고 배너를 띄운다.
// 본 컴포넌트는 실행 상태를 props 로 받는 순수 presentational 컴포넌트다 —
// 실행 상태 polling·/api/* 소비·전역 상태 배선은 후속 slice 책임 (Out of Scope).

// 평가 진행 중임을 알리는 기본 한국어 경고 문구.
const DEFAULT_MESSAGE =
  '평가가 진행 중입니다. 표시되는 자료는 직전까지 수집된 기존 자료입니다.';

interface EvaluationGuardBannerProps {
  // 평가 실행 상태 — true 면 경고 배너를 렌더, false 면 아무것도 렌더하지 않는다.
  active: boolean;
  // 기본 문구 대신 사용할 사용자 정의 경고 문구 (선택). 빈 문자열이면 기본 문구로 fallback.
  message?: string;
}

// 평가 진행 중 경고 배너. active 가 false 면 자료 화면을 가리지 않도록 null 을 반환한다.
function EvaluationGuardBanner({ active, message }: EvaluationGuardBannerProps) {
  // 비활성 시 배너 미노출 — 기존 자료 화면을 가리지 않는다.
  if (!active) {
    return null;
  }

  // 빈 message 는 기본 문구로 fallback (의미 없는 빈 배너 방지 정책).
  const text = message ? message : DEFAULT_MESSAGE;

  return <div role="alert">{text}</div>;
}

export type { EvaluationGuardBannerProps };
export default EvaluationGuardBanner;
