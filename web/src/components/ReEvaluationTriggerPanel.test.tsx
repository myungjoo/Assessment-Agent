import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReEvaluationTriggerPanel from './ReEvaluationTriggerPanel';
import type { ReEvaluationWindow } from './ReEvaluationTriggerPanel';

// R-112 — REQ-041(R-74) 재평가(N일 재수집) 트리거 패널(ADR-0040 §1) 검증.
// GroupMemberList.test.tsx / DifficultyModelSelector.test.tsx 와 동일 패턴: jsdom·
// @testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만
// 검증해 dep 표면을 최소화한다 (ADR-0040 §5 게이트). renderToStaticMarkup 은 이벤트를
// 발화하지 않으므로 onSelect/onTrigger 콜백 자체는 검증 대상이 아니다 — 분기별 markup
// (role="status"/"alert", <select>/<option>/<button>, window label, 경고/비활성 토큰)
// 만 assert 한다. 파일명은 .test.tsx 고정 — root jest 의 testRegex(.*\.spec\.ts$)
// pickup 충돌 회피.

// 진행 문구 식별 토큰 (구현의 SUBMITTING_TEXT 와 정합 — 말줄임표는 U+2026 …).
const SUBMITTING_TOKEN = '재수집 진행 중';
// 빈 windows 상태 문구 (구현의 EMPTY_WINDOWS_TEXT 와 정합).
const EMPTY_WINDOWS = '선택 가능한 재수집 기간이 없습니다';
// 기본 경고 문구 식별 토큰 (구현의 DEFAULT_CONFIRM_TEXT 와 정합).
const DEFAULT_CONFIRM_TOKEN = '되돌릴 수 없습니다';
// 트리거 버튼 라벨 (구현의 TRIGGER_LABEL 과 정합).
const TRIGGER_LABEL = '재수집 시작';

// 테스트용 window 목록 — 1일/7일/30일 3종.
const sampleWindows: ReEvaluationWindow[] = [
  { days: 1, label: '최근 1일' },
  { days: 7, label: '최근 1주' },
  { days: 30, label: '최근 30일' },
];

const noop = () => undefined;

describe('ReEvaluationTriggerPanel', () => {
  // happy-path — windows + selectedDays 정상 전달 시 각 label + <select>/<button> 렌더.
  it('windows + selectedDays 전달 시 각 window label + 트리거 버튼을 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={7}
        onSelect={noop}
        onTrigger={noop}
      />,
    );
    expect(html).toContain('<select');
    expect(html).toContain('<button');
    expect(html).toContain(TRIGGER_LABEL);
    expect(html).toContain('최근 1일');
    expect(html).toContain('최근 1주');
    expect(html).toContain('최근 30일');
    // <option> 개수 = window 수 + placeholder 1.
    const optionCount = (html.match(/<option/g) ?? []).length;
    expect(optionCount).toBe(sampleWindows.length + 1);
  });

  // happy-path(순서 보존) — props 의 windows 순서대로 출력되어야 한다(내부 정렬 없음).
  it('windows 를 props 순서 그대로 렌더한다 — 1일이 1주보다 앞 index (happy-path, 순서 보존)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={1}
        onSelect={noop}
        onTrigger={noop}
      />,
    );
    expect(html.indexOf('최근 1일')).toBeLessThan(html.indexOf('최근 1주'));
    expect(html.indexOf('최근 1주')).toBeLessThan(html.indexOf('최근 30일'));
  });

  // happy-path(controlled) — selectedDays 가 windows 에 있으면 해당 option 이 selected.
  it('selectedDays 가 windows 에 존재하면 해당 option 이 selected 로 렌더된다 (happy-path, controlled)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={7}
        onSelect={noop}
        onTrigger={noop}
      />,
    );
    // react-dom/server 는 controlled select 의 선택 option 에 selected 속성을 렌더한다.
    expect(html).toContain('selected');
    expect(html).toContain('value="7"');
  });

  // error path — error truthy → role="alert" 영역에 문구 렌더, 선택 UI(<select>) 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, <select> 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={7}
        onSelect={noop}
        onTrigger={noop}
        error="재수집 요청에 실패했습니다"
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('재수집 요청에 실패했습니다');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<button');
  });

  // flow/branch — submitting=true → role="status" + 진행 문구, 선택 UI/버튼 미렌더.
  it('submitting=true 면 role="status" + 진행 문구 렌더, <select>/<button> 미렌더 (branch — submitting)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={7}
        onSelect={noop}
        onTrigger={noop}
        submitting={true}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(SUBMITTING_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('재수집 진행 중…');
    expect(html).not.toContain('재수집 진행 중...');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<button');
  });

  // flow/branch — 빈 windows 배열 → 빈 상태 문구 렌더, 트리거 버튼 미렌더(트리거 불가).
  it('windows 빈 배열 → 빈 상태 문구 렌더, 트리거 버튼 미렌더 (branch — empty)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={[]}
        selectedDays={0}
        onSelect={noop}
        onTrigger={noop}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(EMPTY_WINDOWS);
    expect(html).not.toContain('<select');
    expect(html).not.toContain('<button');
  });

  // flow/branch — 정상 렌더 시 기본 경고 문구가 항상 표시된다(파괴적 동작 인지).
  it('정상 렌더 시 파괴적 동작 경고 문구를 표시한다 (branch — 정상 + 경고 표시)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={1}
        onSelect={noop}
        onTrigger={noop}
      />,
    );
    expect(html).toContain(DEFAULT_CONFIRM_TOKEN);
  });

  // negative — submitting=true 가 error 보다 우선(둘 다 전달 시 진행 표시만, alert 미렌더).
  it('error 전달 + submitting=true → alert 대신 진행 표시 우선 (negative — submitting 이 error 보다 우선)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={7}
        onSelect={noop}
        onTrigger={noop}
        submitting={true}
        error="에러 문구"
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(SUBMITTING_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — submitting=true 가 windows 보다 우선(채워져도 선택 UI 미렌더).
  it('windows 있음 + submitting=true → 선택 UI 미렌더, 진행 표시 우선 (negative — submitting 우선 정책)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={7}
        onSelect={noop}
        onTrigger={noop}
        submitting={true}
      />,
    );
    expect(html).toContain(SUBMITTING_TOKEN);
    expect(html).not.toContain('<select');
    expect(html).not.toContain('최근 1일');
  });

  // negative/edge — error="" (falsy) + windows 있음 → alert 미렌더·정상 선택 UI 렌더.
  it('error="" (falsy) + windows 있음 → alert 미렌더·선택 UI 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={7}
        onSelect={noop}
        onTrigger={noop}
        error=""
      />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<select');
    expect(html).toContain('최근 1일');
  });

  // negative/edge — error="" (falsy) + 빈 windows → alert 미렌더·빈 상태로 진입.
  it('error="" (falsy) + 빈 windows → alert 미렌더·빈 상태 문구 렌더 (negative — 빈 문자열 error + empty)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={[]}
        selectedDays={0}
        onSelect={noop}
        onTrigger={noop}
        error=""
      />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('role="status"');
    expect(html).toContain(EMPTY_WINDOWS);
  });

  // negative/edge — selectedDays 가 windows 에 없는 값 → throw 없이 안전 렌더 + 버튼 disabled.
  it('selectedDays 가 windows 에 없는 값 → throw 없이 렌더, 트리거 버튼 disabled (negative — 값 mismatch 경계)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={999}
        onSelect={noop}
        onTrigger={noop}
      />,
    );
    expect(html).toContain('<select');
    // 유효 선택이 없으므로 트리거 버튼은 비활성화된다.
    expect(html).toContain('disabled');
    // placeholder 로 fallback — selected 된 실제 window option 은 없어야 한다.
    expect(html).not.toContain('value="999"');
  });

  // negative/edge — confirmText 미전달 → 기본 경고 문구 fallback.
  it('confirmText 미전달 → 기본 경고 문구로 fallback 한다 (negative — 기본 경고 fallback)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={1}
        onSelect={noop}
        onTrigger={noop}
      />,
    );
    expect(html).toContain(DEFAULT_CONFIRM_TOKEN);
  });

  // negative/edge — confirmText="" (빈 문자열) → 기본 경고 문구로 fallback(빈 경고 방지).
  it('confirmText="" → 기본 경고 문구로 fallback 한다 (negative — 빈 문자열 경계값)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={1}
        onSelect={noop}
        onTrigger={noop}
        confirmText=""
      />,
    );
    expect(html).toContain(DEFAULT_CONFIRM_TOKEN);
  });

  // negative — custom confirmText 전달 시 기본 문구 대신 custom 경고 렌더(override).
  it('custom confirmText 전달 → 기본 문구 대신 custom 경고를 렌더한다 (negative — override)', () => {
    const custom = '이 작업은 7일치 결과를 삭제합니다';
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={7}
        onSelect={noop}
        onTrigger={noop}
        confirmText={custom}
      />,
    );
    expect(html).toContain(custom);
    expect(html).not.toContain(DEFAULT_CONFIRM_TOKEN);
  });

  // negative/edge — 유효 selectedDays 면 트리거 버튼이 활성(disabled 미부여) 상태로 렌더.
  it('유효 selectedDays 면 트리거 버튼이 활성(disabled 미부여) 상태로 렌더된다 (negative — 활성 경계)', () => {
    const html = renderToStaticMarkup(
      <ReEvaluationTriggerPanel
        windows={sampleWindows}
        selectedDays={30}
        onSelect={noop}
        onTrigger={noop}
      />,
    );
    expect(html).toContain('<button');
    expect(html).not.toContain('disabled');
  });
});
