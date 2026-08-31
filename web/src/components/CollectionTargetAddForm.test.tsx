import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CollectionTargetAddForm, {
  COLLECTION_TARGET_TYPES,
  ENDPOINT_HINT_ID,
  ENDPOINT_HINT_TEXT,
  ENDPOINT_MAX_LENGTH,
  INSTANCE_KEY_HINT_ID,
  INSTANCE_KEY_HINT_TEXT,
  INSTANCE_KEY_MAX_LENGTH,
  SUBMIT_LOADING_TEXT,
  SUBMIT_TEXT,
  TYPE_HINT_ID,
  TYPE_HINT_TEXT,
  createCollectionTargetSubmitHandler,
  isCollectionTargetSubmitDisabled,
} from './CollectionTargetAddForm';
import type { CollectionTargetAddFormProps } from './CollectionTargetAddForm';

// R-112 — T-1826 ADR-0059 §Follow-ups (e) 편집 축 1/N(등록 폼) 검증.
// ServiceIdentityAddForm.test.tsx 와 동일 패턴: jsdom · @testing-library 없이
// react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만 assert 해 dep 표면을
// 0 으로 둔다. 정적 렌더는 이벤트를 발화하지 않으므로 submit 이벤트 분기는 컴포넌트가 쓰는
// 순수 팩토리(createCollectionTargetSubmitHandler)를 직접 호출해 검증한다.
// 파일명은 .test.tsx 고정 — root jest 의 testRegex (.*\.spec\.ts$) pickup 충돌 회피.

// no-op 콜백 — controlled component 라 props 로 받아야 하나, 정적 렌더에선 호출되지 않는다.
const noop = () => {};

// 규칙을 모두 만족하는 기준 입력 — 각 test 는 여기서 한 축만 바꿔 분기를 고립시킨다.
const baseProps: CollectionTargetAddFormProps = {
  type: 'GITHUB',
  instanceKey: 'corp-github',
  endpoint: 'github.com',
  onTypeChange: noop,
  onInstanceKeyChange: noop,
  onEndpointChange: noop,
  onSubmit: noop,
};

const render = (overrides: Partial<CollectionTargetAddFormProps> = {}): string =>
  renderToStaticMarkup(<CollectionTargetAddForm {...baseProps} {...overrides} />);

// submit 버튼의 여는 태그만 잘라낸다 — disabled 속성 유무를 폼 전체가 아닌 버튼 범위에서 본다.
const extractButtonTag = (html: string): string => {
  const matched = html.match(/<button[^>]*>/);
  return matched === null ? '' : matched[0];
};

// 버튼 라벨만 잘라낸다 — 제목 <h3>수집 대상 등록</h3> 이 버튼 텍스트와 같은 문구를 담으므로
// 라벨 검증은 반드시 버튼 안쪽으로 범위를 좁혀야 한다.
const extractButtonText = (html: string): string => {
  const matched = html.match(/<button[^>]*>(.*?)<\/button>/);
  return matched === null ? '' : matched[1];
};

const isSubmitDisabled = (html: string): boolean =>
  extractButtonTag(html).includes('disabled');

// name 속성으로 <input> 태그 하나를 통째로 잘라낸다 — value · aria-describedby 배선 검증용.
const extractInput = (html: string, name: string): string => {
  const matched = html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
  return matched === null ? '' : matched[0];
};

describe('isCollectionTargetSubmitDisabled (게이팅 순수 함수)', () => {
  const valid = { type: 'GITHUB', instanceKey: 'k', endpoint: 'e' };

  // happy-path — 3 축이 모두 유효하고 non-loading 이면 통과시킨다(분기 4).
  it('전부 유효 + non-loading 이면 false 다 (happy-path)', () => {
    expect(isCollectionTargetSubmitDisabled(valid)).toBe(false);
    expect(isCollectionTargetSubmitDisabled({ ...valid, loading: false })).toBe(
      false,
    );
  });

  // 분기 (3) loading 우선 — 입력이 모두 유효해도 막는다.
  it('loading=true 면 입력이 유효해도 true 다 (분기: loading 우선)', () => {
    expect(isCollectionTargetSubmitDisabled({ ...valid, loading: true })).toBe(
      true,
    );
  });

  // 분기 (1) 입력 미완 + negative (a) 공백만 입력.
  it.each([
    ['instanceKey 빈 문자열', { instanceKey: '' }],
    ['instanceKey 공백뿐', { instanceKey: '   ' }],
    ['instanceKey 탭·개행뿐', { instanceKey: '\t\n' }],
    ['endpoint 빈 문자열', { endpoint: '' }],
    ['endpoint 공백뿐', { endpoint: '  ' }],
    ['둘 다 공백', { instanceKey: ' ', endpoint: '' }],
  ])('%s 이면 true 다 (분기: 입력 미완 / negative)', (_label, patch) => {
    expect(isCollectionTargetSubmitDisabled({ ...valid, ...patch })).toBe(true);
  });

  // 분기 (2) 길이 초과 + negative (b) — 256 자는 @MaxLength(255) 위반.
  it.each([
    ['instanceKey 256 자', { instanceKey: 'k'.repeat(INSTANCE_KEY_MAX_LENGTH + 1) }],
    ['endpoint 256 자', { endpoint: 'e'.repeat(ENDPOINT_MAX_LENGTH + 1) }],
  ])('%s 이면 true 다 (분기: 길이 초과 / negative)', (_label, patch) => {
    expect(isCollectionTargetSubmitDisabled({ ...valid, ...patch })).toBe(true);
  });

  // negative 경계값 — 정확히 255 자는 통과한다(위 초과 test 와 짝).
  it('두 축이 정확히 255 자면 false 다 (negative: 경계값)', () => {
    expect(
      isCollectionTargetSubmitDisabled({
        type: 'CONFLUENCE',
        instanceKey: 'k'.repeat(INSTANCE_KEY_MAX_LENGTH),
        endpoint: 'e'.repeat(ENDPOINT_MAX_LENGTH),
      }),
    ).toBe(false);
  });

  // negative — @IsIn 위반 type(빈 값 · 소문자 · 미지원 종류)은 모두 막힌다(대소문자 구분).
  it.each(['', 'github', 'Github', 'JIRA', ' GITHUB'])(
    'type=%s 는 허용 밖이라 true 다 (negative: type 위반)',
    (invalidType) => {
      expect(
        isCollectionTargetSubmitDisabled({ ...valid, type: invalidType }),
      ).toBe(true);
    },
  );

  // 분기 — 허용 2 종은 모두 통과한다(상수 정본과 판정이 어긋나지 않는지 잠근다).
  it.each([...COLLECTION_TARGET_TYPES])(
    'type=%s 는 허용이라 false 다 (분기: type 2 종)',
    (allowedType) => {
      expect(
        isCollectionTargetSubmitDisabled({ ...valid, type: allowedType }),
      ).toBe(false);
    },
  );
});

describe('createCollectionTargetSubmitHandler (submit 이벤트 팩토리)', () => {
  // happy-path — 차단 상태가 아니면 기본 동작을 막고 onSubmit 을 1 회 호출한다.
  it('차단 상태가 아니면 preventDefault 후 onSubmit 을 1 회 호출한다 (happy-path)', () => {
    const onSubmit = vi.fn();
    const preventDefault = vi.fn();
    createCollectionTargetSubmitHandler({ submitDisabled: false, onSubmit })({
      preventDefault,
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  // negative (c) — disabled 상태에서 submit 이벤트가 직접 발생해도 onSubmit 미호출 +
  // preventDefault 는 그대로 불려 페이지 reload 가 일어나지 않는다.
  it('차단 상태면 onSubmit 미호출이지만 preventDefault 는 호출한다 (negative)', () => {
    const onSubmit = vi.fn();
    const preventDefault = vi.fn();
    createCollectionTargetSubmitHandler({ submitDisabled: true, onSubmit })({
      preventDefault,
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('CollectionTargetAddForm', () => {
  // happy-path — 규칙을 만족하는 3 축이 value 로 렌더되고 submit 이 enabled 다.
  it('3 축이 규칙을 만족하면 입력 value 를 렌더하고 submit 이 enabled 다 (happy-path)', () => {
    const html = render();
    expect(extractInput(html, 'instanceKey')).toContain('value="corp-github"');
    expect(extractInput(html, 'endpoint')).toContain('value="github.com"');
    expect(html).toContain('<option value="GITHUB"');
    expect(html).toContain('<option value="CONFLUENCE"');
    expect(extractButtonText(html)).toBe(SUBMIT_TEXT);
    expect(isSubmitDisabled(html)).toBe(false);
  });

  // error path — error 가 truthy 면 role="alert" 영역에 그 문구가 렌더된다.
  it('error 전달 시 role="alert" 영역에 문구를 렌더한다 (error path)', () => {
    const html = render({ error: '이미 등록된 수집 대상입니다' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('이미 등록된 수집 대상입니다');
  });

  // error path — error 미전달이면 alert 영역 자체가 없다.
  it('error 미전달 시 alert 영역을 렌더하지 않는다 (error path)', () => {
    expect(render()).not.toContain('role="alert"');
  });

  // negative — 빈 문자열 error 는 falsy 라 alert 영역을 만들지 않는다.
  it('빈 문자열 error 는 alert 영역을 렌더하지 않는다 (negative)', () => {
    expect(render({ error: '' })).not.toContain('role="alert"');
  });

  // 분기 (3) — loading 이면 disabled + 진행 문구.
  it('loading=true 면 submit 이 disabled 이고 진행 문구를 보인다 (분기: loading 우선)', () => {
    const html = render({ loading: true });
    expect(isSubmitDisabled(html)).toBe(true);
    expect(extractButtonText(html)).toBe(SUBMIT_LOADING_TEXT);
  });

  // 분기 (1) — 입력 미완이면 disabled.
  it.each([
    ['instanceKey 빈 문자열', { instanceKey: '' }],
    ['endpoint 빈 문자열', { endpoint: '' }],
    ['instanceKey 공백뿐', { instanceKey: '   ' }],
  ])('%s 이면 submit 이 disabled 다 (분기: 입력 미완)', (_label, patch) => {
    expect(isSubmitDisabled(render(patch))).toBe(true);
  });

  // 분기 (2) — 255 초과면 disabled.
  it('endpoint 가 256 자면 submit 이 disabled 다 (분기: 길이 초과)', () => {
    expect(
      isSubmitDisabled(render({ endpoint: 'e'.repeat(ENDPOINT_MAX_LENGTH + 1) })),
    ).toBe(true);
  });

  // 분기 — 안내 문구는 입력 상태와 무관하게 항상 렌더되고 aria-describedby 로 연결된다.
  it('3 안내 문구를 항상 렌더하고 각 입력의 aria-describedby 가 그 id 를 가리킨다 (분기: 안내 연결)', () => {
    const html = render({ instanceKey: '', endpoint: '' });
    expect(html).toContain(`<p id="${TYPE_HINT_ID}">${TYPE_HINT_TEXT}</p>`);
    expect(html).toContain(
      `<p id="${INSTANCE_KEY_HINT_ID}">${INSTANCE_KEY_HINT_TEXT}</p>`,
    );
    expect(html).toContain(`<p id="${ENDPOINT_HINT_ID}">${ENDPOINT_HINT_TEXT}</p>`);
    expect(extractInput(html, 'instanceKey')).toContain(
      `aria-describedby="${INSTANCE_KEY_HINT_ID}"`,
    );
    expect(extractInput(html, 'endpoint')).toContain(
      `aria-describedby="${ENDPOINT_HINT_ID}"`,
    );
    expect(html).toContain(`aria-describedby="${TYPE_HINT_ID}"`);
  });

  // negative — 서버 생성 축 · credential 계열 입력을 렌더하지 않는다(ADR-0059 §Decision 2).
  // 실으면 forbidNonWhitelisted 가 400 을 내므로 입력 자체가 존재하면 안 된다.
  it.each(['id', 'createdAt', 'updatedAt', 'token', 'password'])(
    'name="%s" 입력을 렌더하지 않는다 (negative: 허용 밖 축)',
    (forbiddenName) => {
      expect(render()).not.toContain(`name="${forbiddenName}"`);
    },
  );

  // negative — 본 slice 는 3 필드 등록 축이라 optional 배열 4 축 입력이 없다(Out of Scope).
  it.each(['orgs', 'repos', 'spaces', 'active'])(
    'name="%s" 입력을 렌더하지 않는다 (negative: 본 slice 범위 밖)',
    (outOfScopeName) => {
      expect(render()).not.toContain(`name="${outOfScopeName}"`);
    },
  );
});
