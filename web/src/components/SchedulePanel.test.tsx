import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SchedulePanel from './SchedulePanel';

// R-112 — REQ-072/REQ-073 스케줄 설정 패널(ADR-0040 §1) 검증.
// DataImportExportPanel.test.tsx / ReEvaluationTriggerPanel.test.tsx 와 동일 패턴: jsdom·
// @testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만
// 검증해 dep 표면을 최소화한다 (ADR-0040 §5 게이트). renderToStaticMarkup 은 이벤트를
// 발화하지 않으므로 onCronChange/onApply/onManualTrigger 콜백 자체는 검증 대상이 아니다 —
// 분기별 markup (role="status"/"alert", <input>/<button>, 라벨 텍스트, cronExpression 값
// 반영, disabled 속성 유무) 만 assert 한다. 파일명은 .test.tsx 고정 — root jest 의
// testRegex(.*\.spec\.ts$) pickup 충돌 회피.

// 진행 문구 식별 토큰 (구현의 BUSY_TEXT 와 정합 — 말줄임표는 U+2026 …).
const BUSY_TOKEN = '적용 중';
// 적용 버튼 기본 라벨 (구현의 DEFAULT_APPLY_LABEL 과 정합).
const DEFAULT_APPLY = '적용';
// manual trigger 기본 라벨 (구현의 DEFAULT_TRIGGER_LABEL 과 정합).
const DEFAULT_TRIGGER = '지금 실행';

const noop = () => undefined;
// onCronChange 시그니처용 noop (string 인자 — 정적 렌더라 실제 호출되진 않는다).
const noopStr = (_value: string) => undefined;

describe('SchedulePanel', () => {
  // happy-path — 정상 상태(busy/error 없음 + 콜백 셋 다 전달) → cron 입력·적용 버튼·manual
  // trigger 버튼이 활성(disabled 없음) 상태로 렌더되고 기본 라벨·cronExpression 값이 표시된다.
  it('정상 상태 + 콜백 전달 시 cron 입력·적용·실행 버튼을 활성 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <SchedulePanel
        cronExpression="0 2 * * *"
        onCronChange={noopStr}
        onApply={noop}
        onManualTrigger={noop}
      />,
    );
    expect(html).toContain('type="text"');
    // cronExpression 값이 입력에 반영된다.
    expect(html).toContain('0 2 * * *');
    expect(html).toContain('<button');
    expect(html).toContain(DEFAULT_APPLY);
    expect(html).toContain(DEFAULT_TRIGGER);
    // 콜백이 모두 전달됐으므로 어떤 disabled 속성도 렌더되지 않는다(활성).
    expect(html).not.toContain('disabled');
  });

  // error path — error truthy → role="alert" 영역에 문구 렌더, 트리거(<input>/<button>) 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, 트리거 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <SchedulePanel error="스케줄 적용에 실패했습니다" onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('스케줄 적용에 실패했습니다');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('type="text"');
  });

  // flow/branch — busy=true → role="status" + 진행 문구, 트리거 전부 미렌더.
  it('busy=true 면 role="status" + "적용 중…" 렌더, 트리거 미렌더 (branch — busy)', () => {
    const html = renderToStaticMarkup(
      <SchedulePanel busy={true} onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(BUSY_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('적용 중…');
    expect(html).not.toContain('적용 중...');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('type="text"');
  });

  // flow/branch — 정상 상태에서 cron 입력 렌더 분기 (onCronChange 전달 → 활성 입력).
  it('정상 상태 + onCronChange 전달 → cron 입력을 활성으로 렌더한다 (branch — cron 입력)', () => {
    const html = renderToStaticMarkup(<SchedulePanel onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />);
    expect(html).toContain('type="text"');
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('readonly');
  });

  // flow/branch — 정상 상태에서 적용 버튼 렌더 분기 (onApply 전달 → 활성 버튼).
  it('정상 상태 + onApply 전달 → 적용 버튼을 활성으로 렌더한다 (branch — 적용 버튼)', () => {
    const html = renderToStaticMarkup(<SchedulePanel onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />);
    expect(html).toContain('<button');
    expect(html).toContain(DEFAULT_APPLY);
    expect(html).not.toContain('disabled');
  });

  // flow/branch — 정상 상태에서 manual trigger 버튼 렌더 분기 (onManualTrigger 전달 → 활성 버튼).
  it('정상 상태 + onManualTrigger 전달 → 실행 버튼을 활성으로 렌더한다 (branch — manual trigger 버튼)', () => {
    const html = renderToStaticMarkup(<SchedulePanel onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />);
    expect(html).toContain(DEFAULT_TRIGGER);
    expect(html).not.toContain('disabled');
  });

  // flow/branch — message 전달 → 안내 문구를 별도 role="status" 영역에 렌더한다.
  it('정상 상태 + message 전달 → 안내 문구를 렌더한다 (branch — message 전달)', () => {
    const html = renderToStaticMarkup(
      <SchedulePanel onCronChange={noopStr} onApply={noop} onManualTrigger={noop} message="스케줄이 적용되었습니다" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('스케줄이 적용되었습니다');
    // 트리거는 정상 상태라 함께 렌더된다.
    expect(html).toContain('<button');
  });

  // flow/branch — message 미전달 → 안내 문구 영역(role="status") 미렌더(트리거만).
  it('정상 상태 + message 미전달 → 안내 문구 영역을 렌더하지 않는다 (branch — message 미전달)', () => {
    const html = renderToStaticMarkup(<SchedulePanel onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />);
    expect(html).toContain('<button');
    // 정상 상태에선 진행/안내 status 영역이 없다.
    expect(html).not.toContain('role="status"');
  });

  // negative — busy=true 가 error 보다 우선(busy 우선 정책 — error 동시 전달도 진행 표시만).
  it('error 전달 + busy=true → alert 대신 진행 표시 우선 (negative — busy 가 error 보다 우선)', () => {
    const html = renderToStaticMarkup(
      <SchedulePanel busy={true} error="에러 문구" onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(BUSY_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — busy=true 가 콜백보다 우선(busy 우선 정책 — 트리거 미렌더로 중복 트리거 차단).
  it('콜백 전달 + busy=true → 트리거 미렌더·진행 표시 우선 (negative — busy 우선·중복 차단)', () => {
    const html = renderToStaticMarkup(
      <SchedulePanel busy={true} onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />,
    );
    expect(html).toContain(BUSY_TOKEN);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('type="text"');
  });

  // negative — error 와 정상 콜백 동시 전달 시 error 우선, 트리거 영역 미렌더.
  it('error 와 정상 콜백 동시 전달 → error 우선·트리거 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <SchedulePanel error="적용 실패" onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('적용 실패');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('type="text"');
  });

  // negative — onCronChange 미전달 → cron 입력이 비활성(disabled+readonly)으로 렌더된다.
  it('onCronChange 미전달 → cron 입력을 비활성(disabled)으로 렌더한다 (negative — cron 콜백 미전달)', () => {
    const html = renderToStaticMarkup(<SchedulePanel onApply={noop} onManualTrigger={noop} />);
    expect(html).toContain('type="text"');
    // 입력은 비활성화돼야 한다(버튼들은 콜백 전달이라 활성).
    expect(html).toContain('disabled');
  });

  // negative — onApply 미전달 → 적용 버튼이 비활성(disabled)으로 렌더된다.
  it('onApply 미전달 → 적용 버튼을 비활성(disabled)으로 렌더한다 (negative — 적용 콜백 미전달)', () => {
    const html = renderToStaticMarkup(<SchedulePanel onCronChange={noopStr} onManualTrigger={noop} />);
    expect(html).toContain(DEFAULT_APPLY);
    expect(html).toContain('disabled');
  });

  // negative — onManualTrigger 미전달 → 실행 버튼이 비활성(disabled)으로 렌더된다.
  it('onManualTrigger 미전달 → 실행 버튼을 비활성(disabled)으로 렌더한다 (negative — trigger 콜백 미전달)', () => {
    const html = renderToStaticMarkup(<SchedulePanel onCronChange={noopStr} onApply={noop} />);
    expect(html).toContain(DEFAULT_TRIGGER);
    expect(html).toContain('disabled');
  });

  // negative — 콜백 전부 미전달 → cron 입력·적용 버튼·실행 버튼 모두 비활성(disabled 3회 이상).
  it('콜백 전부 미전달 → cron 입력·버튼 모두 비활성 (negative — 콜백 전부 미전달)', () => {
    const html = renderToStaticMarkup(<SchedulePanel />);
    const disabledCount = (html.match(/disabled/g) ?? []).length;
    // cron 입력(1) + 적용 버튼(1) + 실행 버튼(1) = 최소 3회.
    expect(disabledCount).toBeGreaterThanOrEqual(3);
  });

  // negative — applyLabel/triggerLabel 미전달 → 기본 한국어 라벨로 fallback.
  it('applyLabel/triggerLabel 미전달 → 기본 라벨로 fallback (negative — 기본 라벨 fallback)', () => {
    const html = renderToStaticMarkup(<SchedulePanel onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />);
    expect(html).toContain(DEFAULT_APPLY);
    expect(html).toContain(DEFAULT_TRIGGER);
  });

  // negative/edge — 빈 문자열 라벨 → 기본 라벨로 fallback(의미 없는 빈 라벨 방지).
  it('applyLabel=""/triggerLabel="" → 기본 라벨로 fallback (negative — 빈 문자열 라벨 경계값)', () => {
    const html = renderToStaticMarkup(
      <SchedulePanel onCronChange={noopStr} onApply={noop} onManualTrigger={noop} applyLabel="" triggerLabel="" />,
    );
    expect(html).toContain(DEFAULT_APPLY);
    expect(html).toContain(DEFAULT_TRIGGER);
  });

  // happy/override — custom 라벨 전달 시 기본 라벨 대신 custom 라벨 렌더.
  it('custom applyLabel/triggerLabel 전달 → 기본 라벨 대신 custom 라벨 렌더 (override)', () => {
    const html = renderToStaticMarkup(
      <SchedulePanel
        onCronChange={noopStr}
        onApply={noop}
        onManualTrigger={noop}
        applyLabel="주기 저장"
        triggerLabel="즉시 재평가"
      />,
    );
    expect(html).toContain('주기 저장');
    expect(html).toContain('즉시 재평가');
    expect(html).not.toContain(`>${DEFAULT_APPLY}<`);
  });

  // negative/edge — 빈 문자열 error(falsy) → alert 미렌더·정상 패널 렌더.
  it('error="" (falsy) → alert 미렌더·정상 패널 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(
      <SchedulePanel error="" onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<button');
    expect(html).toContain('type="text"');
  });

  // negative/edge — 빈 문자열 message(falsy) → 안내 문구 영역 미렌더(정상 패널만).
  it('message="" (falsy) → 안내 문구 영역 미렌더 (negative — 빈 문자열 message 경계값)', () => {
    const html = renderToStaticMarkup(
      <SchedulePanel message="" onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />,
    );
    expect(html).toContain('<button');
    expect(html).not.toContain('role="status"');
  });

  // negative/edge — cronExpression 미전달 → 입력 값이 빈 값(value="")으로 렌더된다.
  it('cronExpression 미전달 → cron 입력 값이 빈 값으로 렌더된다 (negative — cron 값 미전달 경계값)', () => {
    const html = renderToStaticMarkup(<SchedulePanel onCronChange={noopStr} onApply={noop} onManualTrigger={noop} />);
    expect(html).toContain('type="text"');
    expect(html).toContain('value=""');
  });
});
