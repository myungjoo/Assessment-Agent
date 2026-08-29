import { describe, expect, it, vi } from 'vitest';
// R-112 — T-1773 AdminView 의 ServiceIdentity 행별 액션 props 조립 factory 전용 spec. 별도 파일인
// 이유는 거대 파일(AdminView.test.tsx) 추가 편집을 피하기 위함이며(T-1772 어댑터 spec 선례 승계),
// 컨테이너를 렌더하지 않으므로 useApiResource 만 비워 모듈 import 부작용을 차단한다(ADR-0040 §5 —
// RTL 미도입이라 상태 구동 렌더 test 대신 factory 직접 호출로 배선 표를 고정한다).
vi.mock('../api/useApiResource', () => ({
  useApiResource: () => ({ data: undefined, loading: false, error: undefined }),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));
import {
  buildServiceIdentityRowActionsProps as build,
  deriveServiceIdentityRowActionsFlags as derive,
} from './AdminView';
import type { InFlightIdGate, ServiceIdentityRowActionsWiringDeps } from './AdminView';
import type { ServiceIdentityRow } from '../api/serviceIdentity';

const PERSON = 'p-1';
const ROW = 'si-1';
const OTHER = 'si-2';
const BOOM = new Error('boom');
const FAIL = `문구:${String(BOOM)}`;
type Fire = (p: string, i: string) => Promise<unknown>;
type Opts = Partial<
  Pick<ServiceIdentityRowActionsWiringDeps, 'personId' | 'confirmingDeleteId' | 'busyIdentityId' | 'errorIdentityId' | 'errorText'>
> & { removeImpl?: Fire; setPrimaryImpl?: Fire; gateInitial?: string };

function row(over: Partial<ServiceIdentityRow> = {}): ServiceIdentityRow {
  return { id: ROW, personId: PERSON, service: 'github', externalId: 'octo', isPrimary: false, ...over };
}

// 주입 harness — gate 는 createInFlightIdGate 와 같은 read/write 계약(쓰면 다음 read 에 즉시 반영)을
// 흉내내고, 나머지는 전부 spy 라 누가 몇 번 어떤 인자로 불렸는지가 그대로 드러난다.
function harness(opts: Opts = {}) {
  let current = opts.gateInitial;
  const gate: InFlightIdGate = { read: () => current, write: (next) => { current = next; } };
  const spies = {
    onEdit: vi.fn(), bumpRefresh: vi.fn(), setConfirmingDeleteId: vi.fn(),
    setErrorIdentityId: vi.fn(), setErrorText: vi.fn(),
    remove: vi.fn<Fire>(opts.removeImpl ?? (async () => ({}))),
    setPrimary: vi.fn<Fire>(opts.setPrimaryImpl ?? (async () => ({}))),
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

// props 타입이 콜백 반환을 void 로 지우므로, 러너 완료를 기다리기 위해 반환값을 promise 로 되살린다.
const settle = (fn: () => void): Promise<unknown> => Promise.resolve(fn() as unknown);
// 주입 spy 전원이 한 번도 불리지 않았음(= 완전 no-op) 검증.
function expectSilent(h: ReturnType<typeof harness>): void {
  for (const spy of [h.onEdit, h.remove, h.setPrimary, h.bumpRefresh, h.setErrorIdentityId, h.setErrorText, h.setConfirmingDeleteId]) {
    expect(spy).not.toHaveBeenCalled();
  }
}

describe('AdminView — ServiceIdentity 행별 액션 props 조립 (T-1773 buildServiceIdentityRowActionsProps)', () => {
  it('플래그 3 종이 derive 결과와 일치하고 조립 자체는 부수효과 0 이다 (happy-path)', () => {
    const flagIn = { identityId: ROW, confirmingDeleteId: ROW, busyIdentityId: ROW, errorIdentityId: ROW, errorText: FAIL };
    const h = harness(flagIn);
    const identity = row();
    const props = build(identity, h.deps);
    expect({ confirmingDelete: props.confirmingDelete, loading: props.loading, error: props.error }).toEqual(derive(flagIn));
    expect(props.identity).toBe(identity);
    expect(identity).toEqual(row());
    expectSilent(h);
    expect(h.readGate()).toBeUndefined();
  });

  it('onDeleteConfirm 은 remove 만 (personId, identity.id) 로 1 회 부른다 (happy-path — 축 교차 차단)', async () => {
    const h = harness({ confirmingDeleteId: ROW });
    await settle(build(row(), h.deps).onDeleteConfirm);
    expect(h.remove.mock.calls).toEqual([[PERSON, ROW]]);
    expect(h.setPrimary).not.toHaveBeenCalled();
    expect(h.bumpRefresh).toHaveBeenCalledTimes(1);
    // 성공했을 때만 확인 단계를 닫는다(진행 표시도 자기 소유일 때만 비운다).
    expect(h.setConfirmingDeleteId.mock.calls).toEqual([[undefined]]);
    expect(h.readGate()).toBeUndefined();
  });

  it('onSetPrimary 는 setPrimary 만 1 회 부르고 onEdit · onDeleteRequest 도 계약대로다 (happy-path)', async () => {
    const h = harness();
    const identity = row();
    const props = build(identity, h.deps);
    await settle(props.onSetPrimary);
    props.onEdit();
    props.onDeleteRequest();
    // 축 교차 차단 — primary 축은 remove 를 부르지 않는다.
    expect(h.setPrimary.mock.calls).toEqual([[PERSON, ROW]]);
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(h.onEdit.mock.calls).toEqual([[identity]]);
    // primary 축엔 확인 단계가 없어 slot 은 onDeleteRequest 로만 열린다.
    expect(h.setConfirmingDeleteId.mock.calls).toEqual([[ROW]]);
  });

  it('remove 가 reject 하면 실패 문구가 이 행에 귀속되고 재조회는 없다 (error path)', async () => {
    const h = harness({ confirmingDeleteId: ROW, removeImpl: async () => Promise.reject(BOOM) });
    await expect(settle(build(row(), h.deps).onDeleteConfirm)).resolves.toBeUndefined();
    expect(h.setErrorIdentityId.mock.calls).toEqual([[undefined], [ROW]]);
    expect(h.setErrorText.mock.calls).toEqual([[undefined], [FAIL]]);
    expect(h.bumpRefresh).not.toHaveBeenCalled();
    // negative — 실패 후 확인 단계는 닫히지 않아 같은 자리에서 재시도할 수 있다.
    expect(h.setConfirmingDeleteId).not.toHaveBeenCalled();
    expect(h.readGate()).toBeUndefined();
  });

  it('setPrimary 가 reject 하면 실패 문구가 이 행에 귀속되고 재조회는 없다 (error path)', async () => {
    const h = harness({ setPrimaryImpl: async () => Promise.reject(BOOM) });
    await expect(settle(build(row(), h.deps).onSetPrimary)).resolves.toBeUndefined();
    expect(h.setErrorIdentityId.mock.calls).toEqual([[undefined], [ROW]]);
    expect(h.setErrorText.mock.calls).toEqual([[undefined], [FAIL]]);
    expect(h.bumpRefresh).not.toHaveBeenCalled();
  });

  // 분기 — 빈 문자열 / negative — identity.id 가 공백뿐(sentinel 유입 차단). 두 입력 모두 정규화
  // 결과가 빈 행이라 같은 진리표를 요구하므로 case 를 나눠 한 자리에서 고정한다.
  it('정규화 결과가 빈 행은 다섯 콜백 전원 no-op 이고 플래그도 모두 꺼짐이다 (분기 · negative)', async () => {
    for (const badId of ['', '   ']) {
      const h = harness({ confirmingDeleteId: badId, busyIdentityId: badId, errorIdentityId: badId, errorText: FAIL });
      const props = build(row({ id: badId }), h.deps);
      expect([props.confirmingDelete, props.loading, props.error]).toEqual([false, false, undefined]);
      props.onEdit();
      props.onDeleteRequest();
      props.onDeleteCancel();
      await Promise.all([settle(props.onDeleteConfirm), settle(props.onSetPrimary)]);
      expectSilent(h);
      expect(h.readGate()).toBeUndefined();
    }
  });

  it('onDeleteCancel 은 이 행이 확인 대상일 때만 slot 을 비운다 (분기 — 소유 검사)', () => {
    const mine = harness({ confirmingDeleteId: ROW });
    build(row(), mine.deps).onDeleteCancel();
    expect(mine.setConfirmingDeleteId.mock.calls).toEqual([[undefined]]);
    const theirs = harness({ confirmingDeleteId: OTHER });
    build(row(), theirs.deps).onDeleteCancel();
    expect(theirs.setConfirmingDeleteId).not.toHaveBeenCalled();
  });

  it('gate 가 이 행을 들고 있으면 in-flight 가드로 재발사가 0 이다 (분기)', async () => {
    const h = harness({ gateInitial: ROW });
    const props = build(row(), h.deps);
    await Promise.all([settle(props.onDeleteConfirm), settle(props.onSetPrimary)]);
    expect(h.remove).not.toHaveBeenCalled();
    expect(h.setPrimary).not.toHaveBeenCalled();
    expect(h.readGate()).toBe(ROW);
  });

  it('gate 가 다른 행을 들고 있으면 정상 발사된다 (분기 — 행 단위 in-flight)', async () => {
    const h = harness({ gateInitial: OTHER });
    await settle(build(row(), h.deps).onDeleteConfirm);
    expect(h.remove.mock.calls).toEqual([[PERSON, ROW]]);
    // 발사 중 이 행이 gate 를 잡았다가, 마감 시 자기 소유일 때만 비운다.
    expect(h.readGate()).toBeUndefined();
  });

  it('personId 가 미선택이면 두 러너가 no-op 이다 (분기 — 빈 문자열 · negative 공백뿐)', async () => {
    for (const badPerson of ['', '   ']) {
      const h = harness({ personId: badPerson });
      const props = build(row(), h.deps);
      await Promise.all([settle(props.onDeleteConfirm), settle(props.onSetPrimary)]);
      expect(h.remove).not.toHaveBeenCalled();
      expect(h.setPrimary).not.toHaveBeenCalled();
      expect(h.bumpRefresh).not.toHaveBeenCalled();
      // 러너를 타지 않는 콜백은 여전히 살아있다(가드는 발사 축에만 건다).
      props.onDeleteRequest();
      expect(h.setConfirmingDeleteId.mock.calls).toEqual([[ROW]]);
    }
  });

  it('이미 primary 인 행에서도 onSetPrimary 는 그대로 발사된다 (negative — 러너에 가드 없음)', async () => {
    const h = harness();
    await settle(build(row({ isPrimary: true }), h.deps).onSetPrimary);
    // 버튼 disable 은 ServiceIdentityRowActions 책임이고 client 계약은 idempotent 다(ADR-0058 §Decision 1).
    expect(h.setPrimary.mock.calls).toEqual([[PERSON, ROW]]);
  });

  it('errorText 가 빈 문자열이면 error 를 노출하지 않는다 (negative)', () => {
    const h = harness({ errorIdentityId: ROW, errorText: '' });
    expect(build(row(), h.deps).error).toBeUndefined();
  });

  it('어댑터를 콜백 호출 시점마다 새로 build 한다 (negative — 굳은 busy 스냅샷 회귀 차단)', async () => {
    const h = harness();
    const props = build(row(), h.deps);
    await settle(props.onDeleteConfirm);
    expect(h.remove).toHaveBeenCalledTimes(1);
    // build 이후 gate 가 이 행을 잡으면, 두 번째 호출은 그 새 값을 보고 발사하지 않아야 한다.
    h.gate.write(ROW);
    await settle(props.onDeleteConfirm);
    expect(h.remove).toHaveBeenCalledTimes(1);
  });
});
