import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceIdentityAddForm, {
  EXTERNAL_ID_HINT_ID,
  EXTERNAL_ID_HINT_TEXT,
  EXTERNAL_ID_MAX_LENGTH,
  SERVICE_HINT_ID,
  SERVICE_HINT_TEXT,
  SERVICE_MAX_LENGTH,
} from './ServiceIdentityAddForm';
import type { ServiceIdentityAddFormProps } from './ServiceIdentityAddForm';

// R-112 — ADR-0058 §Follow-ups (d) 쓰기 축 1/2(추가 폼) 검증.
// SuperAdminSetupForm.test.tsx / ServiceIdentityList.test.tsx 와 동일 패턴: jsdom ·
// @testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만
// assert 해 dep 표면을 0 으로 둔다. 정적 렌더는 이벤트를 발화하지 않으므로 onSubmit /
// onServiceChange / onExternalIdChange 콜백 자체는 검증 대상이 아니다 — 렌더 markup
// (제목, input value, role="alert", 안내 문구·aria-describedby, 버튼 텍스트·disabled) 만 본다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// no-op 콜백 — controlled component 라 props 로 받아야 하나, 정적 렌더에선 호출되지 않는다.
const noop = () => {};

// 버튼 텍스트 토큰 (구현과 정합 — 말줄임표는 U+2026 …, "..." 3 점 아님).
const SUBMIT_TEXT = 'identity 추가';
const LOADING_TEXT = '추가 중…';

// 규칙을 모두 만족하는 기준 입력 — 각 test 는 여기서 한 축만 바꿔 분기를 고립시킨다.
const baseProps: ServiceIdentityAddFormProps = {
  service: 'github',
  externalId: 'octo-dev',
  onServiceChange: noop,
  onExternalIdChange: noop,
  onSubmit: noop,
};

const render = (overrides: Partial<ServiceIdentityAddFormProps> = {}): string =>
  renderToStaticMarkup(<ServiceIdentityAddForm {...baseProps} {...overrides} />);

// submit 버튼의 여는 태그만 잘라낸다 — disabled 속성 유무를 폼 전체가 아닌 버튼 범위에서 본다.
const extractButtonTag = (html: string): string => {
  const matched = html.match(/<button[^>]*>/);
  return matched === null ? '' : matched[0];
};

// 버튼 라벨만 잘라낸다 — 제목 <h3>service identity 추가</h3> 가 버튼 텍스트를 부분 포함하므로
// 라벨 검증은 반드시 버튼 안쪽으로 범위를 좁혀야 한다.
const extractButtonText = (html: string): string => {
  const matched = html.match(/<button[^>]*>(.*?)<\/button>/);
  return matched === null ? '' : matched[1];
};

const isSubmitDisabled = (html: string): boolean => extractButtonTag(html).includes('disabled');

// name 속성으로 <input> 태그 하나를 통째로 잘라낸다 — value · aria-describedby 배선 검증용.
const extractInput = (html: string, name: string): string => {
  const matched = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
  return matched === null ? '' : matched[0];
};

describe('ServiceIdentityAddForm', () => {
  // happy-path — 규칙을 만족하는 두 축이 value 로 렌더되고 submit 이 enabled.
  it('service·externalId 가 규칙을 만족하면 두 입력 value 를 렌더하고 submit 이 enabled 다 (happy-path)', () => {
    const html = render();
    expect(extractInput(html, 'service')).toContain('value="github"');
    expect(extractInput(html, 'externalId')).toContain('value="octo-dev"');
    expect(extractButtonText(html)).toBe(SUBMIT_TEXT);
    expect(isSubmitDisabled(html)).toBe(false);
  });

  // error path — error 가 truthy 면 role="alert" 영역에 그 문구가 렌더된다.
  it('error 전달 시 role="alert" 영역에 문구를 렌더한다 (error path)', () => {
    const html = render({ error: '이미 등록된 service 입니다' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('이미 등록된 service 입니다');
  });

  // error path — error 미전달이면 alert 영역 자체가 없다.
  it('error 미전달 시 alert 영역을 렌더하지 않는다 (error path)', () => {
    expect(render()).not.toContain('role="alert"');
  });

  // negative — 빈 문자열 error 는 falsy 라 alert 영역을 만들지 않는다.
  it('빈 문자열 error 는 alert 영역을 렌더하지 않는다 (negative)', () => {
    expect(render({ error: '' })).not.toContain('role="alert"');
  });

  // 분기 (1) loading 우선 — 입력이 모두 유효해도 submit 을 막고 진행 문구를 보인다.
  it('loading=true 면 입력이 유효해도 submit 이 disabled 이고 진행 문구를 보인다 (분기: loading 우선)', () => {
    const html = render({ loading: true });
    expect(isSubmitDisabled(html)).toBe(true);
    expect(extractButtonText(html)).toBe(LOADING_TEXT);
  });

  // 분기 (2) 빈 service.
  it('service 가 빈 문자열이면 submit 이 disabled 다 (분기: 빈 service)', () => {
    expect(isSubmitDisabled(render({ service: '' }))).toBe(true);
  });

  // 분기 (3) 빈 externalId.
  it('externalId 가 빈 문자열이면 submit 이 disabled 다 (분기: 빈 externalId)', () => {
    expect(isSubmitDisabled(render({ externalId: '' }))).toBe(true);
  });

  // 분기 (4) service 형식 위반.
  it('service 가 허용 문자 밖이면 submit 이 disabled 다 (분기: service 형식 위반)', () => {
    expect(isSubmitDisabled(render({ service: 'git hub' }))).toBe(true);
  });

  // 분기 (5) service 길이 초과 — 65 자는 형식은 맞지만 @MaxLength(64) 위반.
  it('service 가 65 자면 submit 이 disabled 다 (분기: service 길이 초과)', () => {
    expect(isSubmitDisabled(render({ service: 'a'.repeat(SERVICE_MAX_LENGTH + 1) }))).toBe(true);
  });

  // 분기 (6) externalId 길이 초과 — 256 자는 @MaxLength(255) 위반.
  it('externalId 가 256 자면 submit 이 disabled 다 (분기: externalId 길이 초과)', () => {
    expect(isSubmitDisabled(render({ externalId: 'x'.repeat(EXTERNAL_ID_MAX_LENGTH + 1) }))).toBe(
      true,
    );
  });

  // 분기 — 안내 문구는 입력 상태와 무관하게 항상 렌더되고 aria-describedby 로 각 입력에 연결된다.
  it('두 안내 문구를 항상 렌더하고 각 입력의 aria-describedby 가 그 id 를 가리킨다 (분기: 안내 연결)', () => {
    const html = render({ service: '', externalId: '' });
    expect(html).toContain(`<p id="${SERVICE_HINT_ID}">${SERVICE_HINT_TEXT}</p>`);
    expect(html).toContain(`<p id="${EXTERNAL_ID_HINT_ID}">${EXTERNAL_ID_HINT_TEXT}</p>`);
    expect(extractInput(html, 'service')).toContain(`aria-describedby="${SERVICE_HINT_ID}"`);
    expect(extractInput(html, 'externalId')).toContain(
      `aria-describedby="${EXTERNAL_ID_HINT_ID}"`,
    );
  });

  // negative — 공백만 입력한 service 는 빈 입력으로 본다(trim 후 빈 문자열).
  it('공백만 입력한 service 는 submit 이 disabled 다 (negative)', () => {
    expect(isSubmitDisabled(render({ service: '   ' }))).toBe(true);
  });

  // negative — 공백만 입력한 externalId 도 빈 입력으로 본다.
  it('공백만 입력한 externalId 는 submit 이 disabled 다 (negative)', () => {
    expect(isSubmitDisabled(render({ externalId: '   ' }))).toBe(true);
  });

  // negative — 허용 문자 밖 기호·한글·공백 포함 service 는 모두 막힌다(형식 분기 다중 표본).
  it.each(['git/hub', '깃허브', 'git hub', 'git@hub', 'git+hub'])(
    'service=%s 는 형식 위반이라 submit 이 disabled 다 (negative)',
    (invalidService) => {
      expect(isSubmitDisabled(render({ service: invalidService }))).toBe(true);
    },
  );

  // negative 경계값 — service 64 자 정확히는 통과, 65 자부터 막힌다(위 분기 test 와 짝).
  it('service 가 정확히 64 자면 submit 이 enabled 다 (negative: 경계값)', () => {
    expect(isSubmitDisabled(render({ service: 'a'.repeat(SERVICE_MAX_LENGTH) }))).toBe(false);
  });

  // negative 경계값 — externalId 255 자 정확히는 통과, 256 자부터 막힌다.
  it('externalId 가 정확히 255 자면 submit 이 enabled 다 (negative: 경계값)', () => {
    expect(isSubmitDisabled(render({ externalId: 'x'.repeat(EXTERNAL_ID_MAX_LENGTH) }))).toBe(
      false,
    );
  });

  // ADR-0058 §Decision 2 — primary 전이는 전용 route 단일화라 본 폼에 isPrimary 입력 축이 없다.
  it('isPrimary 입력 축을 렌더하지 않는다 (ADR-0058 §Decision 2)', () => {
    const html = render();
    expect(html).not.toContain('isPrimary');
    expect(html).not.toContain('type="checkbox"');
  });
});
