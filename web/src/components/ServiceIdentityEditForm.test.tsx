import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceIdentityEditForm, {
  EXTERNAL_ID_HINT_ID,
  EXTERNAL_ID_HINT_TEXT,
  EXTERNAL_ID_MAX_LENGTH,
  SERVICE_LOCKED_HINT_ID,
  SERVICE_LOCKED_HINT_TEXT,
} from './ServiceIdentityEditForm';
import type { ServiceIdentityEditFormProps } from './ServiceIdentityEditForm';

// R-112 — ADR-0058 §Follow-ups (d) 쓰기 축 2/3(수정 폼) 검증.
// ServiceIdentityAddForm.test.tsx 와 동일 패턴: jsdom · @testing-library 없이
// react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 assert 해 dep 표면을 0 으로
// 둔다. 정적 렌더는 이벤트를 발화하지 않으므로 onSubmit / onCancel / onExternalIdChange 콜백
// 자체는 검증 대상이 아니다 — 렌더 markup (제목, input value, role="alert", 안내 문구·
// aria-describedby, 버튼 텍스트·disabled) 만 본다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// no-op 콜백 — controlled component 라 props 로 받아야 하나, 정적 렌더에선 호출되지 않는다.
const noop = () => {};

// 버튼 텍스트 토큰 (구현과 정합 — 말줄임표는 U+2026 …, "..." 3 점 아님).
const SUBMIT_TEXT = 'identity 수정';
const LOADING_TEXT = '수정 중…';
const CANCEL_TEXT = '취소';

// 규칙을 모두 만족하고 원본과 다른 기준 입력 — 각 test 는 여기서 한 축만 바꿔 분기를 고립시킨다.
const baseProps: ServiceIdentityEditFormProps = {
  service: 'github',
  initialExternalId: 'octo-dev',
  externalId: 'octo-dev-renamed',
  onExternalIdChange: noop,
  onSubmit: noop,
  onCancel: noop,
};

const render = (overrides: Partial<ServiceIdentityEditFormProps> = {}): string =>
  renderToStaticMarkup(<ServiceIdentityEditForm {...baseProps} {...overrides} />);

// 버튼의 여는 태그만 type 속성으로 잘라낸다 — submit / cancel 두 버튼이 공존하므로
// disabled 판정은 반드시 대상 버튼 범위로 좁혀야 한다.
const extractButtonTag = (html: string, type: string): string => {
  const matched = html.match(new RegExp(`<button[^>]*type="${type}"[^>]*>`));
  return matched === null ? '' : matched[0];
};

// 버튼 라벨만 잘라낸다 — 제목 <h3>service identity 수정</h3> 이 버튼 텍스트를 부분 포함하므로
// 라벨 검증은 반드시 버튼 안쪽으로 범위를 좁혀야 한다.
const extractButtonText = (html: string, type: string): string => {
  const matched = html.match(new RegExp(`<button[^>]*type="${type}"[^>]*>(.*?)</button>`));
  return matched === null ? '' : matched[1];
};

const isSubmitDisabled = (html: string): boolean =>
  extractButtonTag(html, 'submit').includes('disabled');
const isCancelDisabled = (html: string): boolean =>
  extractButtonTag(html, 'button').includes('disabled');

// name 속성으로 <input> 태그 하나를 통째로 잘라낸다 — value · aria-describedby 배선 검증용.
const extractInput = (html: string, name: string): string => {
  const matched = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
  return matched === null ? '' : matched[0];
};

describe('ServiceIdentityEditForm', () => {
  // happy-path — 규칙을 만족하고 원본과 다른 입력이면 값·읽기전용 service 가 렌더되고 제출 가능하다.
  it('유효하고 변경된 입력이면 값·service 텍스트를 렌더하고 submit 이 enabled 다', () => {
    const html = render();
    expect(html).toContain('service identity 수정');
    expect(html).toContain('<strong>github</strong>');
    expect(extractInput(html, 'externalId')).toContain('value="octo-dev-renamed"');
    expect(extractButtonText(html, 'submit')).toBe(SUBMIT_TEXT);
    expect(isSubmitDisabled(html)).toBe(false);
  });

  // error path — error 가 truthy 면 alert 영역에 그 문구가 그대로 노출된다.
  it('error 가 있으면 role="alert" 영역에 문구를 렌더한다', () => {
    const html = render({ error: '외부 식별자가 이미 사용 중입니다.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('외부 식별자가 이미 사용 중입니다.');
  });

  // error path 반대 분기 — error 미전달이면 alert 영역 자체가 없다.
  it('error 가 없으면 alert 영역을 렌더하지 않는다', () => {
    expect(render()).not.toContain('role="alert"');
  });

  // negative — 빈 문자열 error 도 falsy 라 alert 를 만들지 않는다(빈 상자 렌더 방지).
  it('error 가 빈 문자열이면 alert 영역을 렌더하지 않는다 (negative)', () => {
    expect(render({ error: '' })).not.toContain('role="alert"');
  });

  // 게이팅 분기 (1) loading 우선 — 입력이 유효해도 진행 중이면 막힌다 + 라벨이 바뀐다.
  it('loading 중이면 입력이 유효해도 submit 이 disabled 이고 라벨이 바뀐다', () => {
    const html = render({ loading: true });
    expect(isSubmitDisabled(html)).toBe(true);
    expect(extractButtonText(html, 'submit')).toBe(LOADING_TEXT);
  });

  // 게이팅 분기 (2) 빈 externalId — 미완 입력은 막힌다.
  it('externalId 가 비어 있으면 submit 이 disabled 다', () => {
    expect(isSubmitDisabled(render({ externalId: '' }))).toBe(true);
  });

  // negative — 공백만 입력한 externalId 도 미완 입력으로 본다(trim 후 빈 문자열).
  it('externalId 가 공백뿐이면 submit 이 disabled 다 (negative)', () => {
    expect(isSubmitDisabled(render({ externalId: '   ' }))).toBe(true);
  });

  // 게이팅 분기 (3) 길이 초과 — 256 자는 backend @MaxLength(255) 위반이라 미리 막는다.
  it('externalId 가 256 자면 submit 이 disabled 다', () => {
    const html = render({ externalId: 'x'.repeat(EXTERNAL_ID_MAX_LENGTH + 1) });
    expect(isSubmitDisabled(html)).toBe(true);
  });

  // negative 경계값 — 255 자 정확히는 통과한다(위 초과 test 와 짝).
  it('externalId 가 정확히 255 자면 submit 이 enabled 다 (negative: 경계값)', () => {
    const html = render({ externalId: 'x'.repeat(EXTERNAL_ID_MAX_LENGTH) });
    expect(isSubmitDisabled(html)).toBe(false);
  });

  // 게이팅 분기 (4) 변경 0 — 원본과 같으면 PATCH 가 무의미하므로 막는다.
  it('externalId 가 initialExternalId 와 같으면 submit 이 disabled 다', () => {
    expect(isSubmitDisabled(render({ externalId: baseProps.initialExternalId }))).toBe(true);
  });

  // negative — 앞뒤 공백만 다른 값은 backend 에 다른 값으로 저장되므로 "변경" 으로 보고 통과시킨다
  // (구현 규칙: 변경 0 판정은 trim 없는 원문 비교).
  it('externalId 가 initialExternalId 와 공백만 다르면 submit 이 enabled 다 (negative)', () => {
    expect(isSubmitDisabled(render({ externalId: ` ${baseProps.initialExternalId}` }))).toBe(false);
  });

  // 취소 분기 (a) — 평시에는 취소가 언제나 열려 있다(입력이 무효해도 빠져나갈 수 있어야 한다).
  it('취소 버튼은 입력이 무효해도 enabled 다', () => {
    const html = render({ externalId: '' });
    expect(extractButtonText(html, 'button')).toBe(CANCEL_TEXT);
    expect(isCancelDisabled(html)).toBe(false);
  });

  // 취소 분기 (b) — loading 중에만 취소도 막힌다.
  it('loading 중이면 취소 버튼도 disabled 다', () => {
    expect(isCancelDisabled(render({ loading: true }))).toBe(true);
  });

  // 안내 문구 · aria-describedby 배선 — 입력 전에도 조건이 항상 노출되고 입력과 연결된다.
  it('externalId 안내 문구를 렌더하고 aria-describedby 로 입력과 연결한다', () => {
    const html = render();
    expect(html).toContain(`id="${EXTERNAL_ID_HINT_ID}"`);
    expect(html).toContain(EXTERNAL_ID_HINT_TEXT);
    expect(extractInput(html, 'externalId')).toContain(`aria-describedby="${EXTERNAL_ID_HINT_ID}"`);
  });

  // ADR-0058 §Decision 3 — service 는 편집 불가라 그 이유를 문구로 노출한다.
  it('service 가 수정 불가라는 안내 문구를 렌더한다 (ADR-0058 §Decision 3)', () => {
    const html = render();
    expect(html).toContain(`id="${SERVICE_LOCKED_HINT_ID}"`);
    expect(html).toContain(SERVICE_LOCKED_HINT_TEXT);
  });

  // negative — service 는 텍스트로만 렌더된다. input 은 externalId 하나뿐이어야 한다.
  it('service 를 편집 가능한 input 으로 렌더하지 않는다 (negative)', () => {
    const html = render();
    expect(html.match(/<input/g) ?? []).toHaveLength(1);
    expect(html).not.toContain('name="service"');
  });

  // ADR-0058 §Decision 2 — primary 전이는 전용 route 단일화라 본 폼에 isPrimary 입력 축이 없다.
  it('isPrimary 입력 축을 렌더하지 않는다 (ADR-0058 §Decision 2)', () => {
    const html = render();
    expect(html).not.toContain('isPrimary');
    expect(html).not.toContain('type="checkbox"');
  });

  // 추가 폼과 같은 화면에 공존해도 hint id 가 충돌하지 않아야 한다(id 독립 규약).
  it('안내 문구 id 가 추가 폼의 id 와 겹치지 않는다', () => {
    expect(EXTERNAL_ID_HINT_ID).toBe('service-identity-edit-external-id-hint');
    expect(EXTERNAL_ID_HINT_ID).not.toBe('service-identity-add-external-id-hint');
  });
});
