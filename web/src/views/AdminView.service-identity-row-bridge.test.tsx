import { describe, expect, it, vi } from 'vitest';
// R-112 — T-1772 AdminView 의 ServiceIdentity 행별 액션 어댑터(러너 boolean 계약 ↔ 플래그 id-귀속
// 계약) 전용 spec. 별도 파일인 이유는 거대 파일(AdminView.test.tsx) 추가 편집을 피하기 위함이며
// (T-1771 플래그 helper spec 선례 승계), 컨테이너를 렌더하지 않으므로 useApiResource 만 비워
// AdminView 모듈 import 부작용을 차단한다(새 dependency 0).
vi.mock('../api/useApiResource', () => ({
  useApiResource: () => ({ data: undefined, loading: false, error: undefined }),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));
import {
  buildServiceIdentityRowActionBridge as build,
  deriveServiceIdentityRowActionsFlags as derive,
  runDeleteServiceIdentity,
  runSetPrimaryServiceIdentity,
} from './AdminView';
import type { InFlightIdGate, ServiceIdentityRowActionBridgeDeps } from './AdminView';

const ROW = 'si-1';
const OTHER = 'si-2';
const MSG = '삭제에 실패했습니다.';

// 주입 harness — gate 는 실제 createInFlightIdGate 와 같은 read/write 계약을 흉내내되(write 가
// 다음 read 에 즉시 반영), 호출 횟수를 세기 위해 spy 로 감싼다.
function harness(initial?: string) {
  let current = initial;
  const write = vi.fn((next: string | undefined) => {
    current = next;
  });
  const gate: InFlightIdGate = { read: () => current, write };
  const setErrorIdentityId = vi.fn();
  const setErrorText = vi.fn();
  const deps: ServiceIdentityRowActionBridgeDeps = { gate, setErrorIdentityId, setErrorText };
  return { deps, write, setErrorIdentityId, setErrorText, read: () => current };
}

describe('AdminView — ServiceIdentity 행별 액션 어댑터 (T-1772 buildServiceIdentityRowActionBridge)', () => {
  // happy-path — 러너의 실제 호출 순서(setBusy(true) → setError(undefined) → 실패 setError(문구)
  // → finally setBusy(false))를 그대로 재현해 gate · 두 setter 가 규칙대로 불리는지 고정한다.
  it('이 행이 진행 중이면 busy 가 켜지고 러너 호출 순서가 규칙대로 반영된다 (happy-path)', () => {
    const h = harness(ROW);
    const bridge = build(ROW, h.deps);
    expect(bridge.busy).toBe(true);

    const fresh = harness();
    const running = build(ROW, fresh.deps);
    expect(running.busy).toBe(false);
    running.setBusy(true);
    running.setError(undefined);
    running.setError(MSG);
    running.setBusy(false);

    expect(fresh.write.mock.calls).toEqual([[ROW], [undefined]]);
    expect(fresh.setErrorIdentityId.mock.calls).toEqual([[undefined], [ROW]]);
    expect(fresh.setErrorText.mock.calls).toEqual([[undefined], [MSG]]);
    expect(fresh.read()).toBeUndefined();
  });

  // happy-path — 두 러너 deps 에 그대로 꽂히는 모양인지 실제 러너로 검증한다(삭제 축 성공).
  it('삭제 러너 deps 에 그대로 주입돼 성공 후 진행 표시가 비워진다 (happy-path — 러너 정합)', async () => {
    const h = harness();
    const bridge = build(ROW, h.deps);
    const bumpRefresh = vi.fn();
    const endConfirm = vi.fn();
    await runDeleteServiceIdentity('p-1', ROW, {
      remove: vi.fn(async () => ({})),
      describeError: () => MSG,
      deleting: bridge.busy,
      setDeleting: bridge.setBusy,
      setDeleteError: bridge.setError,
      bumpRefresh,
      endConfirm,
    });
    expect(bumpRefresh).toHaveBeenCalledTimes(1);
    expect(endConfirm).toHaveBeenCalledTimes(1);
    expect(h.write.mock.calls).toEqual([[ROW], [undefined]]);
    expect(h.setErrorText.mock.calls).toEqual([[undefined]]);
  });

  // error path — 실패 문구는 반드시 이 행 id 로 귀속돼야 한다(귀속 누락 = 무성 실패 차단).
  it('primary 러너 실패 시 setErrorIdentityId 가 이 행 id 로 불린다 (error path — 귀속)', async () => {
    const h = harness();
    const bridge = build(ROW, h.deps);
    await runSetPrimaryServiceIdentity('p-1', ROW, {
      setPrimary: vi.fn(async () => {
        throw new Error('boom');
      }),
      describeError: () => MSG,
      settingPrimary: bridge.busy,
      setSettingPrimary: bridge.setBusy,
      setPrimaryError: bridge.setError,
      bumpRefresh: vi.fn(),
    });
    expect(h.setErrorIdentityId.mock.calls).toEqual([[undefined], [ROW]]);
    expect(h.setErrorText.mock.calls).toEqual([[undefined], [MSG]]);
  });

  // error path — 어댑터가 써 넣은 값을 T-1771 플래그 helper 가 읽으면 이 행에서만 문구가 뜬다.
  it('어댑터가 귀속한 실패를 플래그 helper 가 이 행에서만 노출한다 (error path — 두 helper 정합)', () => {
    const h = harness();
    build(ROW, h.deps).setError(MSG);
    const errorIdentityId = h.setErrorIdentityId.mock.calls.at(-1)?.[0] as string | undefined;
    const errorText = h.setErrorText.mock.calls.at(-1)?.[0] as string | undefined;
    expect(derive({ identityId: ROW, errorIdentityId, errorText }).error).toBe(MSG);
    expect(derive({ identityId: OTHER, errorIdentityId, errorText }).error).toBeUndefined();
  });

  // 분기 (b) — busy 는 gate 값이 정규화 후 이 행과 일치할 때만 참이다(참 · 거짓 양쪽).
  it.each<[string, string | undefined, boolean]>([
    ['gate 가 이 행', ROW, true],
    ['gate 가 앞뒤 공백만 다른 이 행', `  ${ROW} `, true],
    ['gate 가 다른 행', OTHER, false],
    ['gate 가 undefined', undefined, false],
    ['gate 가 공백뿐', '   ', false],
  ])('(b) busy — %s (분기 — 진리표)', (_label, held, expected) => {
    expect(build(ROW, harness(held).deps).busy).toBe(expected);
  });

  // 분기 (c) — setBusy 의 참(켜기) · 거짓(끄기) 양쪽 + 소유 여부 조합.
  it.each<[string, string | undefined, boolean, (string | undefined)[][]]>([
    ['켜기: 비어 있던 gate 에 이 행을 쓴다', undefined, true, [[ROW]]],
    ['켜기: 다른 행이 들고 있어도 이 행으로 덮어쓴다', OTHER, true, [[ROW]]],
    ['끄기: 이 행이 소유 중이면 비운다', ROW, false, [[undefined]]],
    ['끄기: 다른 행이 소유 중이면 쓰지 않는다', OTHER, false, []],
    ['끄기: 아무도 없으면 쓰지 않는다', undefined, false, []],
  ])('(c) setBusy — %s (분기 — 진리표)', (_label, held, next, expectedWrites) => {
    const h = harness(held);
    build(ROW, h.deps).setBusy(next);
    expect(h.write.mock.calls).toEqual(expectedWrites);
  });

  // 분기 (d) — 문구 truthy · falsy 양쪽.
  it.each<[string, string | undefined, (string | undefined)[]]>([
    ['문구 있음 → 이 행에 귀속', MSG, [ROW, MSG]],
    ['빈 문자열 → 둘 다 비움', '', [undefined, undefined]],
    ['공백뿐 → 둘 다 비움', '   ', [undefined, undefined]],
    ['undefined → 둘 다 비움', undefined, [undefined, undefined]],
  ])('(d) setError — %s (분기 — 진리표)', (_label, text, [expectedId, expectedText]) => {
    const h = harness();
    build(ROW, h.deps).setError(text);
    expect(h.setErrorIdentityId.mock.calls).toEqual([[expectedId]]);
    expect(h.setErrorText.mock.calls).toEqual([[expectedText]]);
  });

  // negative (a) — 귀속 불가한 행 id 는 busy 가 꺼지고 어떤 setter 도 부르지 않는 no-op 다.
  it.each(['', '   ', '\t\n'])('행 id 가 비거나 공백뿐이면 전부 no-op 이다 (negative — 귀속 불가 %#)', (identityId) => {
    const h = harness(identityId);
    const bridge = build(identityId, h.deps);
    bridge.setBusy(true);
    bridge.setBusy(false);
    bridge.setError(MSG);
    bridge.setError(undefined);
    expect(bridge.busy).toBe(false);
    expect(h.write).not.toHaveBeenCalled();
    expect(h.setErrorIdentityId).not.toHaveBeenCalled();
    expect(h.setErrorText).not.toHaveBeenCalled();
  });

  // negative — 다른 행이 진행 중일 때의 늦은 끄기가 남의 진행 표시를 지우지 않는다.
  it('다른 행이 진행 중이면 setBusy(false) 가 gate.write 를 부르지 않는다 (negative — 늦은 끄기)', () => {
    const h = harness(OTHER);
    build(ROW, h.deps).setBusy(false);
    expect(h.write).not.toHaveBeenCalled();
    expect(h.read()).toBe(OTHER);
  });

  // negative — 앞뒤 공백만 다른 gate 값 · 행 id 는 같은 행으로 취급한다(trim 정규화 계약).
  it('앞뒤 공백만 다른 gate 값도 같은 행으로 취급한다 (negative — trim 경계)', () => {
    const h = harness(`\t${ROW}\n`);
    const bridge = build(`  ${ROW} `, h.deps);
    expect(bridge.busy).toBe(true);
    bridge.setBusy(false);
    bridge.setError(MSG);
    expect(h.write.mock.calls).toEqual([[undefined]]);
    // 정규화한 행 id 로 귀속한다(padding 이 섞인 원본이 아니라).
    expect(h.setErrorIdentityId.mock.calls).toEqual([[ROW]]);
  });

  // negative — build 자체는 부수효과 0 이고, 같은 인자로 두 번 build 하면 같은 모양이다(순수성).
  it('build 만 하면 어떤 setter 도 부르지 않고 두 번 build 결과 모양이 같다 (negative — 순수성)', () => {
    const h = harness(ROW);
    const first = build(ROW, h.deps);
    const second = build(ROW, h.deps);
    expect(h.write).not.toHaveBeenCalled();
    expect(h.setErrorIdentityId).not.toHaveBeenCalled();
    expect(h.setErrorText).not.toHaveBeenCalled();
    expect(first.busy).toBe(second.busy);
    expect(Object.keys(first).sort()).toEqual(['busy', 'setBusy', 'setError']);
    expect(() => build('', h.deps)).not.toThrow();
  });
});
