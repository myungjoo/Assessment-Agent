import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

// R-112 — T-1777 AdminView → <ServiceIdentityList renderRowActions> 마운트 결선 전용 spec.
// AdminView.service-identity-wiring.test.tsx harness 를 승계한다(ServiceIdentityList 를 prop
// 캡처 stub 으로 치환 + renderToStaticMarkup). 본 spec 이 고정하는 것은 "컨테이너가 어떤 값을
// slot 에 실어 내려보내는가" 하나뿐이며, slot factory · props factory · 플래그 helper 의 계약
// 자체는 T-1771/T-1773/T-1775 spec 책임이라 여기서 재검증하지 않는다(중복 금지).
import type { ApiResourceState } from '../api/useApiResource';
import type { ServiceIdentityListProps } from '../components/ServiceIdentityList';
import type { ServiceIdentityRow } from '../api/serviceIdentity';
import type { ServiceIdentityRowActionsProps } from '../components/ServiceIdentityRowActions';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  // describeError 로 주입되는 함수 — 실패 경로가 이 문구 파생을 통과하는지 보려고 접두사를 붙인다.
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));

// 발사 primitive 2 종만 partial mock 으로 치환한다 — 나머지 export(경로 조립 등)는 원본 그대로
// 남겨야 컨테이너의 조회 path 계약이 깨지지 않는다.
const removeMock = vi.fn();
const setPrimaryMock = vi.fn();
vi.mock('../api/serviceIdentity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/serviceIdentity')>()),
  deleteServiceIdentity: (...args: unknown[]) => removeMock(...args),
  setPrimaryServiceIdentity: (...args: unknown[]) => setPrimaryMock(...args),
}));

const captured: ServiceIdentityListProps[] = [];
vi.mock('../components/ServiceIdentityList', () => ({
  default: (props: ServiceIdentityListProps) => {
    captured.push(props);
    return null;
  },
}));
vi.mock('../components/PersonList', () => ({ default: () => null }));

import AdminView from './AdminView';

const AUTH_ME = '/api/auth/me';
const PERSONS_PATH = '/api/persons';
const MARK = '/identities';
const EMPTY_OK: ApiResourceState<unknown> = {
  data: [],
  loading: false,
  error: undefined,
};
const PERSONS = [
  { id: 'p1', fullName: '홍길동', email: 'a@example.com', active: true },
];
const ROW: ServiceIdentityRow = {
  id: 'i1',
  personId: 'p1',
  service: 'github',
  externalId: 'octocat',
  isPrimary: true,
};

interface MountOptions {
  identity?: ApiResourceState<unknown>;
  personId?: string;
}

// SuperAdmin + 인원 1명을 주입해 인원 관리 섹션이 마운트되게 한다(그 외 path 는 빈 성공).
function mount(options: MountOptions = {}) {
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (path === AUTH_ME) {
      return { data: { role: 'SuperAdmin' }, loading: false, error: undefined };
    }
    if (path === PERSONS_PATH) {
      return { data: PERSONS, loading: false, error: undefined };
    }
    if (typeof path === 'string' && path.includes(MARK)) {
      return options.identity ?? { ...EMPTY_OK, data: [ROW] };
    }
    return EMPTY_OK;
  });
  renderToStaticMarkup(
    <AdminView initialSelectedIdentityPersonId={options.personId ?? 'p1'} />,
  );
  return captured[0];
}

// 캡처한 slot 을 행 1 건으로 호출해 그 반환 element 의 props 를 꺼낸다.
function actionsFor(
  row: ServiceIdentityRow,
  options: MountOptions = {},
): ServiceIdentityRowActionsProps {
  const slot = mount(options).renderRowActions;
  expect(typeof slot).toBe('function');
  const element = slot?.(row) as ReactElement<ServiceIdentityRowActionsProps>;
  return element.props;
}

// props 타입은 콜백을 void 로 좁히지만 런타임 반환은 러너 promise 라 완료를 기다릴 수 있다.
const settle = (fired: void): Promise<unknown> =>
  Promise.resolve(fired as unknown as Promise<unknown>);

beforeEach(() => {
  captured.length = 0;
  useApiResourceMock.mockReset();
  removeMock.mockReset();
  setPrimaryMock.mockReset();
  removeMock.mockResolvedValue(undefined);
  setPrimaryMock.mockResolvedValue(undefined);
});

describe('AdminView → ServiceIdentityList renderRowActions 마운트 (T-1777)', () => {
  it('happy — slot 이 실려 있고 행 호출이 실제 액션 element 를 돌려준다', () => {
    const slot = mount().renderRowActions;
    expect(typeof slot).toBe('function');
    const element = slot?.(ROW) as ReactElement<ServiceIdentityRowActionsProps>;
    // 행 값이 그대로 실린다(personId · identityId · isPrimary).
    expect(element.props.identity).toEqual(ROW);
    expect(element.props.identity.personId).toBe('p1');
    expect(element.props.identity.id).toBe('i1');
    expect(element.props.identity.isPrimary).toBe(true);
    // 손 조립이 아니라 진짜 ServiceIdentityRowActions element 다(렌더가 그 버튼을 낸다).
    expect(renderToStaticMarkup(element)).toContain('identity 삭제');
  });

  it('error path — 삭제 실패가 throw 없이 문구 경로로 흡수된다', async () => {
    removeMock.mockRejectedValue(new Error('boom'));
    const props = actionsFor(ROW);
    props.onDeleteRequest();
    await expect(settle(props.onDeleteConfirm())).resolves.toBeUndefined();
    expect(removeMock).toHaveBeenCalledWith('p1', 'i1');
  });

  it('분기 (a) — 인원 미선택이면 slot 은 있으나 발사가 no-op 이다', async () => {
    const props = actionsFor(ROW, { personId: '' });
    await settle(props.onDeleteConfirm());
    await settle(props.onSetPrimary());
    expect(removeMock).not.toHaveBeenCalled();
    expect(setPrimaryMock).not.toHaveBeenCalled();
  });

  it('분기 (b) — identity 응답이 비배열이어도 마운트가 깨지지 않는다', () => {
    for (const data of [{ rows: 1 }, null]) {
      captured.length = 0;
      const props = mount({ identity: { data, loading: false, error: undefined } });
      expect(props.identities).toEqual([]);
      expect(typeof props.renderRowActions).toBe('function');
    }
  });

  it('분기 (c) — 초기 상태에서는 행 플래그 3 종이 모두 꺼져 있다', () => {
    const props = actionsFor(ROW);
    expect(props.confirmingDelete).toBe(false);
    expect(props.loading).toBe(false);
    expect(props.error).toBeUndefined();
  });

  it('negative — 행 id 가 공백뿐이면 액션이 전체 no-op 이다', async () => {
    const props = actionsFor({ ...ROW, id: '   ' });
    props.onEdit();
    props.onDeleteRequest();
    await settle(props.onDeleteConfirm());
    await settle(props.onSetPrimary());
    expect(removeMock).not.toHaveBeenCalled();
    expect(setPrimaryMock).not.toHaveBeenCalled();
    expect(props.confirmingDelete).toBe(false);
  });

  it('negative — 삭제 요청 첫 호출은 확인 단계만 열고 DELETE 를 쏘지 않는다', () => {
    const props = actionsFor(ROW);
    props.onDeleteRequest();
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('negative — primary 지정은 setPrimary 만 부른다(교차 배선 차단)', async () => {
    await settle(actionsFor(ROW).onSetPrimary());
    expect(setPrimaryMock).toHaveBeenCalledWith('p1', 'i1');
    expect(removeMock).not.toHaveBeenCalled();
  });

  it('negative — 삭제 확정은 remove 만 부른다(역방향 교차 배선 차단)', async () => {
    await settle(actionsFor(ROW).onDeleteConfirm());
    expect(removeMock).toHaveBeenCalledWith('p1', 'i1');
    expect(setPrimaryMock).not.toHaveBeenCalled();
  });

  it('negative — onEdit 은 함수이며 호출이 throw 하지 않는다', () => {
    const props = actionsFor(ROW);
    expect(typeof props.onEdit).toBe('function');
    expect(() => props.onEdit()).not.toThrow();
    expect(removeMock).not.toHaveBeenCalled();
  });
});
