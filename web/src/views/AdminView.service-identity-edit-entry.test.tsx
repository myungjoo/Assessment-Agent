import { describe, expect, it, vi } from 'vitest';
// R-112 — T-1776 AdminView 의 ServiceIdentity 행 편집 진입 helper 전용 spec. 별도 파일인 이유는
// 거대 파일(AdminView.test.tsx) 추가 편집을 피하기 위함이며(T-1773 props · T-1775 slot spec 선례
// 승계), 컨테이너를 렌더하지 않으므로 useApiResource 만 비워 모듈 import 부작용을 차단한다
// (ADR-0040 §5 — RTL 미도입이라 상태 구동 렌더 test 대신 helper 직접 호출 + setter mock 검증으로
// 진입 계약을 고정한다).
vi.mock('../api/useApiResource', () => ({
  useApiResource: () => ({ data: undefined, loading: false, error: undefined }),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));
import { beginServiceIdentityEdit as beginEdit } from './AdminView';
import type { BeginServiceIdentityEditDeps } from './AdminView';
import type { ServiceIdentityRow } from '../api/serviceIdentity';

const PERSON = 'p-1';
const ROW = 'si-1';

function row(over: Partial<ServiceIdentityRow> = {}): ServiceIdentityRow {
  return {
    id: ROW,
    personId: PERSON,
    service: 'github',
    externalId: 'octo',
    isPrimary: false,
    ...over,
  };
}

// 주입 harness — 6 setter 를 모두 spy 로 두고, "어느 것도 부르지 않음"(전체 no-op) 검증을 위해
// 호출 총합을 한 번에 셀 수 있게 배열로도 노출한다.
function harness() {
  const spies = {
    setEditingIdentityId: vi.fn<(next: string) => void>(),
    setEditExternalIdInput: vi.fn<(next: string) => void>(),
    setUpdateError: vi.fn<(next: string | undefined) => void>(),
    setConfirmingDeleteId: vi.fn<(next: string | undefined) => void>(),
    setErrorIdentityId: vi.fn<(next: string | undefined) => void>(),
    setErrorText: vi.fn<(next: string | undefined) => void>(),
  };
  const deps: BeginServiceIdentityEditDeps = spies;
  const totalCalls = () =>
    Object.values(spies).reduce((sum, spy) => sum + spy.mock.calls.length, 0);
  return { deps, spies, totalCalls };
}

describe('beginServiceIdentityEdit — 행 편집 진입 helper (T-1776)', () => {
  // ---- happy path — 정상 행 1 회 진입 ----
  it('정상 행이면 6 setter 가 각각 기대 인자로 1 회씩 호출된다', () => {
    const { deps, spies, totalCalls } = harness();

    beginEdit(row(), deps);

    expect(spies.setEditingIdentityId).toHaveBeenCalledTimes(1);
    expect(spies.setEditingIdentityId).toHaveBeenCalledWith(ROW);
    expect(spies.setEditExternalIdInput).toHaveBeenCalledTimes(1);
    expect(spies.setEditExternalIdInput).toHaveBeenCalledWith('octo');
    expect(spies.setUpdateError).toHaveBeenCalledTimes(1);
    expect(spies.setUpdateError).toHaveBeenCalledWith(undefined);
    expect(spies.setConfirmingDeleteId).toHaveBeenCalledTimes(1);
    expect(spies.setConfirmingDeleteId).toHaveBeenCalledWith(undefined);
    expect(spies.setErrorIdentityId).toHaveBeenCalledTimes(1);
    expect(spies.setErrorIdentityId).toHaveBeenCalledWith(undefined);
    expect(spies.setErrorText).toHaveBeenCalledTimes(1);
    expect(spies.setErrorText).toHaveBeenCalledWith(undefined);
    // 6 setter × 1 회 = 6 — 그 밖의 추가 호출이 없다.
    expect(totalCalls()).toBe(6);
    expect(beginEdit(row(), deps)).toBeUndefined();
  });

  it('대상 id 는 정규화 값이 아니라 원문 그대로 실린다(목록 find 가 원문 비교)', () => {
    const { deps, spies } = harness();
    const padded = `  ${ROW}  `;

    beginEdit(row({ id: padded }), deps);

    expect(spies.setEditingIdentityId).toHaveBeenCalledWith(padded);
    // trim 된 값이 실리면 padding 있는 행을 목록에서 못 찾아 폼이 즉시 접힌다.
    expect(spies.setEditingIdentityId).not.toHaveBeenCalledWith(ROW);
    expect(spies.setEditExternalIdInput).toHaveBeenCalledWith('octo');
  });

  // ---- error path — 비정상 payload 방어 ----
  it.each([
    ['undefined', undefined],
    ['숫자', 42],
    ['null', null],
    ['객체', { toString: () => 'x' }],
  ])('externalId 가 %s 인 비정상 row 도 throw 없이 빈 문자열 prefill 로 접힌다', (_label, bad) => {
    const { deps, spies } = harness();
    const broken = { ...row(), externalId: bad } as unknown as ServiceIdentityRow;

    expect(() => beginEdit(broken, deps)).not.toThrow();

    expect(spies.setEditExternalIdInput).toHaveBeenCalledTimes(1);
    expect(spies.setEditExternalIdInput).toHaveBeenCalledWith('');
    // prefill 만 접히고 나머지 5 종 갱신은 그대로 수행된다.
    expect(spies.setEditingIdentityId).toHaveBeenCalledWith(ROW);
    expect(spies.setUpdateError).toHaveBeenCalledWith(undefined);
  });

  it('externalId 가 빈 문자열이면 문자열 분기라 그 값(빈 문자열)이 그대로 prefill 된다', () => {
    const { deps, spies } = harness();

    beginEdit(row({ externalId: '' }), deps);

    expect(spies.setEditExternalIdInput).toHaveBeenCalledWith('');
    expect(spies.setEditingIdentityId).toHaveBeenCalledTimes(1);
  });

  // ---- 분기 cover — 귀속 가능 / 귀속 불가 ----
  it('귀속 가능 행 분기는 6 setter 전체를 갱신한다', () => {
    const { deps, totalCalls } = harness();

    beginEdit(row({ id: 'si-999' }), deps);

    expect(totalCalls()).toBe(6);
  });

  it.each([
    ['빈 문자열 id', ''],
    ['공백만 id', '   '],
    ['탭·개행만 id', '\t\n '],
  ])('귀속 불가 행(%s)은 6 setter 중 어느 것도 부르지 않는 전체 no-op 이다', (_label, badId) => {
    const { deps, spies, totalCalls } = harness();

    expect(() => beginEdit(row({ id: badId }), deps)).not.toThrow();

    expect(totalCalls()).toBe(0);
    expect(spies.setEditingIdentityId).not.toHaveBeenCalled();
    expect(spies.setConfirmingDeleteId).not.toHaveBeenCalled();
  });

  // ---- negative cases ----
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['숫자', 7],
  ])('id 가 문자열이 아닌(%s) 행도 throw 없이 전체 no-op 이다', (_label, badId) => {
    const { deps, totalCalls } = harness();
    const broken = { ...row(), id: badId } as unknown as ServiceIdentityRow;

    expect(() => beginEdit(broken, deps)).not.toThrow();

    expect(totalCalls()).toBe(0);
  });

  it('호출은 인자 객체(identity · deps)를 변형하지 않는다', () => {
    const { deps } = harness();
    const identity = row();
    const before = JSON.parse(JSON.stringify(identity));
    const depsKeys = Object.keys(deps).sort();

    beginEdit(identity, deps);

    expect(identity).toEqual(before);
    expect(Object.keys(deps).sort()).toEqual(depsKeys);
  });

  it('같은 행 재진입도 이전 실패 문구 3 종을 매번 다시 비운다', () => {
    const { deps, spies } = harness();

    beginEdit(row(), deps);
    beginEdit(row(), deps);

    expect(spies.setUpdateError.mock.calls).toEqual([[undefined], [undefined]]);
    expect(spies.setErrorIdentityId.mock.calls).toEqual([[undefined], [undefined]]);
    expect(spies.setErrorText.mock.calls).toEqual([[undefined], [undefined]]);
    // 삭제 확인 slot 도 재진입마다 닫는다(다른 행이 그 사이 열어둘 수 있다).
    expect(spies.setConfirmingDeleteId.mock.calls).toEqual([[undefined], [undefined]]);
    expect(spies.setEditingIdentityId).toHaveBeenCalledTimes(2);
  });

  it('다른 행으로 이어 진입하면 대상 id 와 prefill 이 그 행 값으로 교체된다', () => {
    const { deps, spies } = harness();

    beginEdit(row(), deps);
    beginEdit(row({ id: 'si-2', externalId: 'hub' }), deps);

    expect(spies.setEditingIdentityId.mock.calls).toEqual([[ROW], ['si-2']]);
    expect(spies.setEditExternalIdInput.mock.calls).toEqual([['octo'], ['hub']]);
  });
});
