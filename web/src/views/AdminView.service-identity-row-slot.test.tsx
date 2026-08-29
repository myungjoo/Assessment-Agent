import { describe, expect, it, vi } from 'vitest';
// R-112 — T-1775 AdminView 의 ServiceIdentity 행별 액션 slot factory 전용 spec. 별도 파일인 이유는
// 거대 파일(AdminView.test.tsx) 추가 편집을 피하기 위함이며(T-1773 props spec 선례 승계), 컨테이너를
// 렌더하지 않으므로 useApiResource 만 비워 모듈 import 부작용을 차단한다(ADR-0040 §5 — RTL 미도입이라
// 상태 구동 렌더 test 대신 factory 직접 호출 + 반환 element 검사로 배선을 고정한다).
vi.mock('../api/useApiResource', () => ({
  useApiResource: () => ({ data: undefined, loading: false, error: undefined }),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));
import type { ReactElement } from 'react';
import { buildServiceIdentityRowActionsSlot as buildSlot } from './AdminView';
import type { InFlightIdGate, ServiceIdentityRowActionsWiringDeps } from './AdminView';
import ServiceIdentityRowActions from '../components/ServiceIdentityRowActions';
import type { ServiceIdentityRowActionsProps } from '../components/ServiceIdentityRowActions';
import type { ServiceIdentityRow } from '../api/serviceIdentity';

const PERSON = 'p-1';
const ROW = 'si-1';
const OTHER = 'si-2';
const BOOM = new Error('boom');
const FAIL = `문구:${String(BOOM)}`;
// 컴포넌트 계약 9 props — slot 이 만든 element 에 이 이름들이 정확히 실려야 한다(추가 · 누락 금지).
const NINE_PROPS = [
  'identity',
  'onEdit',
  'onDeleteRequest',
  'onDeleteConfirm',
  'onDeleteCancel',
  'onSetPrimary',
  'confirmingDelete',
  'loading',
  'error',
];
type Fire = (p: string, i: string) => Promise<unknown>;
type Opts = Partial<
  Pick<
    ServiceIdentityRowActionsWiringDeps,
    'personId' | 'confirmingDeleteId' | 'busyIdentityId' | 'errorIdentityId' | 'errorText'
  >
> & { removeImpl?: Fire; gateInitial?: string };

function row(over: Partial<ServiceIdentityRow> = {}): ServiceIdentityRow {
  return { id: ROW, personId: PERSON, service: 'github', externalId: 'octo', isPrimary: false, ...over };
}

// 주입 harness — T-1773 props spec 형식을 그대로 승계한다. deps 는 mutable 객체라, slot 이 deps 를
// 호출 시점에 다시 읽는지(캐싱 0)를 필드 변경만으로 검증할 수 있다.
function harness(opts: Opts = {}) {
  let current = opts.gateInitial;
  const gate: InFlightIdGate = { read: () => current, write: (next) => { current = next; } };
  const spies = {
    onEdit: vi.fn(), bumpRefresh: vi.fn(), setConfirmingDeleteId: vi.fn(),
    setErrorIdentityId: vi.fn(), setErrorText: vi.fn(),
    remove: vi.fn<Fire>(opts.removeImpl ?? (async () => ({}))),
    setPrimary: vi.fn<Fire>(async () => ({})),
  };
  const deps: ServiceIdentityRowActionsWiringDeps = {
    personId: opts.personId ?? PERSON,
    describeError: (e: unknown) => `문구:${String(e)}`,
    gate,
    confirmingDeleteId: opts.confirmingDeleteId, busyIdentityId: opts.busyIdentityId,
    errorIdentityId: opts.errorIdentityId, errorText: opts.errorText,
    ...spies,
  };
  return { deps, gate, readGate: () => current, ...spies };
}

// element 의 props 는 ReactElement 기본 타입 인자가 unknown 이라 컴포넌트 계약으로 좁혀 읽는다.
const propsOf = (el: ReactElement): ServiceIdentityRowActionsProps =>
  el.props as ServiceIdentityRowActionsProps;
// props 타입이 콜백 반환을 void 로 지우므로, 러너 완료를 기다리기 위해 반환값을 promise 로 되살린다.
const settle = (fn: () => void): Promise<unknown> => Promise.resolve(fn() as unknown);

describe('AdminView — ServiceIdentity 행별 액션 slot (T-1775 buildServiceIdentityRowActionsSlot)', () => {
  it('slot(row) 은 ServiceIdentityRowActions element 를 9 props 그대로 실어 돌려준다 (happy-path)', () => {
    const h = harness({ confirmingDeleteId: ROW, busyIdentityId: ROW, errorIdentityId: ROW, errorText: FAIL });
    const identity = row();
    const el = buildSlot(h.deps)(identity);
    expect(el.type).toBe(ServiceIdentityRowActions);
    // 행 객체는 재구성 없이 같은 참조로 실린다(복제 시 상위 비교 · 식별이 어긋난다).
    expect(propsOf(el).identity).toBe(identity);
    expect(Object.keys(propsOf(el)).sort()).toEqual([...NINE_PROPS].sort());
    expect({
      confirmingDelete: propsOf(el).confirmingDelete,
      loading: propsOf(el).loading,
      error: propsOf(el).error,
    }).toEqual({ confirmingDelete: true, loading: true, error: FAIL });
    // 조립 자체는 부수효과 0 — 어떤 주입 함수도 부르지 않는다.
    for (const spy of [h.onEdit, h.remove, h.setPrimary, h.bumpRefresh, h.setConfirmingDeleteId]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it('onDeleteConfirm 은 remove(personId, identity.id) 를 그 인자 순서로만 부른다 (happy-path — 축 교차 차단)', async () => {
    const h = harness({ confirmingDeleteId: ROW });
    await settle(propsOf(buildSlot(h.deps)(row())).onDeleteConfirm);
    expect(h.remove.mock.calls).toEqual([[PERSON, ROW]]);
    expect(h.setPrimary).not.toHaveBeenCalled();
    expect(h.bumpRefresh).toHaveBeenCalledTimes(1);
  });

  it('onSetPrimary 는 setPrimary(personId, identity.id) 만, onEdit 은 행 객체를 그대로 넘긴다 (happy-path)', async () => {
    const h = harness();
    const identity = row();
    const props = propsOf(buildSlot(h.deps)(identity));
    await settle(props.onSetPrimary);
    props.onEdit();
    expect(h.setPrimary.mock.calls).toEqual([[PERSON, ROW]]);
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.onEdit.mock.calls).toEqual([[identity]]);
  });

  it('정규화 결과가 빈 행은 플래그 3 종이 꺼짐이고 다섯 콜백 전원 no-op 이다 (error path · negative ① ②)', async () => {
    for (const badId of ['', '   ']) {
      const h = harness({ confirmingDeleteId: badId, busyIdentityId: badId, errorIdentityId: badId, errorText: FAIL });
      const props = propsOf(buildSlot(h.deps)(row({ id: badId })));
      expect([props.confirmingDelete, props.loading, props.error]).toEqual([false, false, undefined]);
      props.onEdit();
      props.onDeleteRequest();
      props.onDeleteCancel();
      await Promise.all([settle(props.onDeleteConfirm), settle(props.onSetPrimary)]);
      for (const spy of [h.onEdit, h.remove, h.setPrimary, h.bumpRefresh, h.setErrorIdentityId, h.setErrorText, h.setConfirmingDeleteId]) {
        expect(spy).not.toHaveBeenCalled();
      }
      expect(h.readGate()).toBeUndefined();
    }
  });

  it('remove 가 reject 하면 실패 문구가 귀속 setter 짝으로 이 행에 붙는다 (error path)', async () => {
    const h = harness({ confirmingDeleteId: ROW, removeImpl: async () => Promise.reject(BOOM) });
    await settle(propsOf(buildSlot(h.deps)(row())).onDeleteConfirm);
    expect(h.setErrorIdentityId.mock.calls).toEqual([[undefined], [ROW]]);
    expect(h.setErrorText.mock.calls).toEqual([[undefined], [FAIL]]);
    expect(h.bumpRefresh).not.toHaveBeenCalled();
  });

  it('같은 slot 으로 두 행을 호출하면 진행 중 행만 loading 이다 (분기 (a) — 플래그 복제 차단)', () => {
    const slot = buildSlot(harness({ busyIdentityId: ROW }).deps);
    expect(propsOf(slot(row())).loading).toBe(true);
    expect(propsOf(slot(row({ id: OTHER }))).loading).toBe(false);
  });

  it('같은 slot 으로 두 행을 호출하면 삭제 확인 대상 행만 confirmingDelete 다 (분기 (b))', () => {
    const slot = buildSlot(harness({ confirmingDeleteId: OTHER }).deps);
    expect(propsOf(slot(row())).confirmingDelete).toBe(false);
    expect(propsOf(slot(row({ id: OTHER }))).confirmingDelete).toBe(true);
  });

  it('같은 slot 으로 두 행을 호출하면 실패 귀속 행만 error 문구를 갖는다 (분기 (c))', () => {
    const slot = buildSlot(harness({ errorIdentityId: ROW, errorText: FAIL }).deps);
    expect(propsOf(slot(row())).error).toBe(FAIL);
    expect(propsOf(slot(row({ id: OTHER }))).error).toBeUndefined();
  });

  it('미선택 sentinel 이 든 confirmingDeleteId 는 어떤 행도 열지 않는다 (negative ③)', () => {
    for (const sentinel of ['', '  ']) {
      const slot = buildSlot(harness({ confirmingDeleteId: sentinel }).deps);
      expect(propsOf(slot(row())).confirmingDelete).toBe(false);
      expect(propsOf(slot(row({ id: OTHER }))).confirmingDelete).toBe(false);
    }
  });

  it('errorText 없이 errorIdentityId 만 있으면 error 를 노출하지 않는다 (negative ④)', () => {
    const slot = buildSlot(harness({ errorIdentityId: ROW }).deps);
    expect(propsOf(slot(row())).error).toBeUndefined();
  });

  it('personId 미선택이면 onDeleteConfirm · onSetPrimary 가 러너 가드로 no-op 이다 (negative ⑤)', async () => {
    const h = harness({ personId: '' });
    const props = propsOf(buildSlot(h.deps)(row()));
    await Promise.all([settle(props.onDeleteConfirm), settle(props.onSetPrimary)]);
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.setPrimary).not.toHaveBeenCalled();
    expect(h.bumpRefresh).not.toHaveBeenCalled();
  });

  it('같은 행으로 두 번 호출하면 매번 새 props 가 만들어져 바뀐 deps 가 반영된다 (negative ⑥ — 캐싱 0)', () => {
    const h = harness();
    const slot = buildSlot(h.deps);
    const identity = row();
    const first = slot(identity);
    expect(propsOf(first).confirmingDelete).toBe(false);
    // slot 생성 이후 컨테이너 state 가 바뀐 상황 — 두 번째 호출은 그 새 값을 봐야 한다.
    h.deps.confirmingDeleteId = ROW;
    const second = slot(identity);
    expect(propsOf(second).confirmingDelete).toBe(true);
    // element · props 모두 재사용되지 않는다(캐싱하면 새 상태가 영영 반영되지 않는다).
    expect(second).not.toBe(first);
    expect(propsOf(second)).not.toBe(propsOf(first));
  });
});
