import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceIdentityRowActions, {
  DELETE_CANCEL_TEXT,
  DELETE_CONFIRM_TEXT,
  DELETE_TEXT,
  EDIT_TEXT,
  PRIMARY_BADGE_TEXT,
  PRIMARY_DELETE_HINT_TEXT,
  SET_PRIMARY_TEXT,
  buildDeleteConfirmText,
} from './ServiceIdentityRowActions';
import type { ServiceIdentityRowActionsProps } from './ServiceIdentityRowActions';

// R-112 — ADR-0058 §Follow-ups (d) 쓰기 축 3/3(삭제 · primary 지정 액션) 검증.
// ServiceIdentityEditForm.test.tsx 와 동일 패턴: jsdom · @testing-library 없이
// react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 assert 해 dep 표면을 0 으로
// 둔다. 정적 렌더는 이벤트를 발화하지 않으므로 onEdit / onDeleteRequest / onDeleteConfirm /
// onDeleteCancel / onSetPrimary 콜백 자체는 검증 대상이 아니다 — 렌더 markup(버튼 유무 ·
// disabled, primary 표식, 확인 문구, 자동 승격 안내, role="alert") 만 본다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// no-op 콜백 — controlled component 라 props 로 받아야 하나, 정적 렌더에선 호출되지 않는다.
const noop = () => {};

// 기준 행 — isPrimary === false 인 평범한 행. 각 test 는 여기서 한 축만 바꿔 분기를 고립시킨다.
const baseProps: ServiceIdentityRowActionsProps = {
  identity: { id: 'a', personId: 'p', service: 'github', externalId: 'octo-dev', isPrimary: false },
  onEdit: noop,
  onDeleteRequest: noop,
  onDeleteConfirm: noop,
  onDeleteCancel: noop,
  onSetPrimary: noop,
};

const render = (overrides: Partial<ServiceIdentityRowActionsProps> = {}): string =>
  renderToStaticMarkup(<ServiceIdentityRowActions {...baseProps} {...overrides} />);

// primary 행 props 를 조립한다 — identity 는 중첩 객체라 spread 로 갈아끼운다.
const primaryProps = (
  overrides: Partial<ServiceIdentityRowActionsProps> = {},
): Partial<ServiceIdentityRowActionsProps> => ({
  identity: { ...baseProps.identity, isPrimary: true },
  ...overrides,
});

// 버튼의 여는 태그만 name 속성으로 잘라낸다 — 버튼이 3~4 개 공존하므로 disabled 판정은 반드시
// 대상 버튼 범위로 좁혀야 한다(name="delete" 는 name="delete-confirm" 과 구분된다).
const extractButtonTag = (html: string, name: string): string => {
  const matched = html.match(new RegExp(`<button[^>]*name="${name}"[^>]*>`));
  return matched === null ? '' : matched[0];
};
const hasButton = (html: string, name: string): boolean => extractButtonTag(html, name) !== '';
const isDisabled = (html: string, name: string): boolean =>
  extractButtonTag(html, name).includes('disabled');

// primary 표식만 잘라낸다 — 'primary' 는 primary 지정 버튼 라벨에도 들어가므로 표식 검증은
// 전용 span 안쪽으로 범위를 좁혀야 한다.
const extractPrimaryBadge = (html: string): string => {
  const matched = html.match(/<span class="primary-badge">(.*?)<\/span>/);
  return matched === null ? '' : matched[1];
};

const extractAlert = (html: string): string => {
  const matched = html.match(/<div role="alert">(.*?)<\/div>/);
  return matched === null ? '' : matched[1];
};

describe('ServiceIdentityRowActions', () => {
  it('기본 상태에서 3 버튼이 모두 렌더되고 전부 enabled 다(happy path)', () => {
    const html = render();
    expect(hasButton(html, 'edit')).toBe(true);
    expect(hasButton(html, 'delete')).toBe(true);
    expect(hasButton(html, 'set-primary')).toBe(true);
    expect(isDisabled(html, 'edit')).toBe(false);
    expect(isDisabled(html, 'delete')).toBe(false);
    expect(isDisabled(html, 'set-primary')).toBe(false);
    expect(html).toContain(EDIT_TEXT);
    expect(html).toContain(DELETE_TEXT);
    expect(html).toContain(SET_PRIMARY_TEXT);
  });

  it('대상 행의 service · externalId 를 표시한다(happy path)', () => {
    const html = render();
    expect(html).toContain('github');
    expect(html).toContain('octo-dev');
  });

  it('error 가 truthy 면 role="alert" 영역에 그 문구를 렌더한다(error path)', () => {
    const html = render({ error: '삭제에 실패했습니다' });
    expect(extractAlert(html)).toBe('삭제에 실패했습니다');
  });

  it('error 미전달이면 alert 영역이 없다(error path)', () => {
    expect(render()).not.toContain('role="alert"');
  });

  it('빈 문자열 error 는 alert 를 렌더하지 않는다(negative — 경계값)', () => {
    expect(render({ error: '' })).not.toContain('role="alert"');
  });

  it('confirmingDelete === true 면 확인 문구와 확정 · 취소 버튼을 렌더한다(분기)', () => {
    const html = render({ confirmingDelete: true });
    expect(html).toContain(buildDeleteConfirmText('github', 'octo-dev'));
    expect(hasButton(html, 'delete-confirm')).toBe(true);
    expect(hasButton(html, 'delete-cancel')).toBe(true);
    expect(html).toContain(DELETE_CONFIRM_TEXT);
    expect(html).toContain(DELETE_CANCEL_TEXT);
  });

  it('confirmingDelete 미전달이면 확인 문구 · 확정 · 취소가 없다(분기)', () => {
    const html = render();
    expect(hasButton(html, 'delete-confirm')).toBe(false);
    expect(hasButton(html, 'delete-cancel')).toBe(false);
    expect(html).not.toContain(buildDeleteConfirmText('github', 'octo-dev'));
  });

  it('확인 단계에서는 삭제 버튼과 그 텍스트를 다시 렌더하지 않는다(negative — 2 중 삭제 차단)', () => {
    const html = render({ confirmingDelete: true });
    expect(hasButton(html, 'delete')).toBe(false);
    expect(html).not.toContain(DELETE_TEXT);
  });

  it('isPrimary === true 면 표식을 렌더하고 primary 지정 버튼을 disabled 로 둔다(분기)', () => {
    const html = render(primaryProps());
    expect(extractPrimaryBadge(html)).toBe(PRIMARY_BADGE_TEXT);
    expect(isDisabled(html, 'set-primary')).toBe(true);
    expect(isDisabled(html, 'edit')).toBe(false);
    expect(isDisabled(html, 'delete')).toBe(false);
  });

  it('isPrimary === false 면 표식이 없고 primary 지정 버튼이 enabled 다(분기)', () => {
    const html = render();
    expect(extractPrimaryBadge(html)).toBe('');
    expect(isDisabled(html, 'set-primary')).toBe(false);
  });

  it('primary 행의 확인 단계에서는 자동 승격 안내를 노출한다(분기)', () => {
    expect(render(primaryProps({ confirmingDelete: true }))).toContain(PRIMARY_DELETE_HINT_TEXT);
  });

  it('primary 가 아닌 행의 확인 단계에서는 안내를 노출하지 않는다(분기)', () => {
    expect(render({ confirmingDelete: true })).not.toContain(PRIMARY_DELETE_HINT_TEXT);
  });

  it('primary 행이어도 확인 단계가 아니면 안내를 노출하지 않는다(negative)', () => {
    expect(render(primaryProps())).not.toContain(PRIMARY_DELETE_HINT_TEXT);
  });

  it('loading === true 면 기본 상태의 3 버튼이 모두 disabled 다(분기 — loading 우선)', () => {
    const html = render({ loading: true });
    expect(isDisabled(html, 'edit')).toBe(true);
    expect(isDisabled(html, 'delete')).toBe(true);
    // isPrimary === false 라 평소엔 enabled 인 버튼도 loading 이 우선해 막힌다.
    expect(isDisabled(html, 'set-primary')).toBe(true);
  });

  it('loading === false 면 버튼을 막지 않는다(분기)', () => {
    const html = render({ loading: false });
    expect(isDisabled(html, 'edit')).toBe(false);
    expect(isDisabled(html, 'delete')).toBe(false);
  });

  it('loading + confirmingDelete 조합에서는 확정 · 취소까지 disabled 다(negative — loading 우선)', () => {
    const html = render({ loading: true, confirmingDelete: true });
    expect(isDisabled(html, 'delete-confirm')).toBe(true);
    expect(isDisabled(html, 'delete-cancel')).toBe(true);
    expect(isDisabled(html, 'edit')).toBe(true);
  });

  it('externalId 가 빈 문자열인 행도 렌더가 깨지지 않는다(negative — 경계값)', () => {
    const html = render({
      identity: { ...baseProps.identity, externalId: '' },
      confirmingDelete: true,
    });
    expect(hasButton(html, 'delete-confirm')).toBe(true);
    expect(html).toContain(buildDeleteConfirmText('github', ''));
  });
});
