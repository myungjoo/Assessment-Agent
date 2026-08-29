import { describe, expect, it, vi } from 'vitest';
// R-112 — T-1771 AdminView 의 ServiceIdentityRowActions 행별 플래그 순수 파생 helper 전용 spec.
// 별도 파일인 이유는 거대 파일(AdminView.test.tsx) 추가 편집을 피하기 위함이며(delete · primary
// 러너 spec 선례 승계), 컨테이너를 렌더하지 않으므로 useApiResource 만 비워 AdminView 모듈
// import 부작용을 차단한다(새 dependency 0).
vi.mock('../api/useApiResource', () => ({
  useApiResource: () => ({ data: undefined, loading: false, error: undefined }),
  toErrorMessage: (e: unknown) => `문구:${String(e)}`,
}));
import { deriveServiceIdentityRowActionsFlags as derive } from './AdminView';
import type { ServiceIdentityRowFlagsInput, ServiceIdentityRowActionsFlags } from './AdminView';

const ROW = 'si-1';
const OTHER = 'si-2';
const MSG = '삭제에 실패했습니다.';
// 세 값이 모두 꺼진 기본 반환 — 미선택 · 무관 행의 기대값이다.
const OFF: ServiceIdentityRowActionsFlags = { confirmingDelete: false, loading: false, error: undefined };

describe('AdminView — ServiceIdentity 행별 액션 플래그 파생 (T-1771 deriveServiceIdentityRowActionsFlags)', () => {
  // happy-path — 대상 행이 확인 단계 + 진행 중 + 자기 실패 문구를 모두 가지면 셋 다 켜진다.
  it('세 대상 id 가 모두 이 행이면 확인 · 진행 · 문구가 전부 켜진다 (happy-path)', () => {
    expect(
      derive({
        identityId: ROW,
        confirmingDeleteId: ROW,
        busyIdentityId: ROW,
        errorIdentityId: ROW,
        errorText: MSG,
      }),
    ).toEqual({ confirmingDelete: true, loading: true, error: MSG });
  });

  // error path — 문구가 있어도 귀속 행이 다르면 노출하지 않는다(문구 복제 차단의 핵심 계약).
  it('errorText 가 있어도 errorIdentityId 가 다른 행이면 error 는 undefined 다 (error path)', () => {
    expect(derive({ identityId: ROW, errorIdentityId: OTHER, errorText: MSG })).toEqual(OFF);
  });

  // error path — 귀속 행이 일치해도 문구가 비어 있으면 노출할 것이 없다.
  it.each<[string, string | undefined]>([
    ['빈 문자열', ''],
    ['undefined', undefined],
  ])('errorIdentityId 가 일치해도 errorText 가 %s 면 error 는 undefined 다 (error path)', (_label, errorText) => {
    expect(derive({ identityId: ROW, errorIdentityId: ROW, errorText })).toEqual(OFF);
  });

  // 분기 — 판정 규칙 (a) ~ (d) 각각의 참 · 거짓 양쪽을 진리표로 전량 고정한다.
  it.each<[string, ServiceIdentityRowFlagsInput, ServiceIdentityRowActionsFlags]>([
    // (a) 행 id 단락 — 켜짐/꺼짐 양쪽.
    ['(a) 거짓: 행 id 가 있으면 나머지 판정이 수행된다', { identityId: ROW, confirmingDeleteId: ROW }, { confirmingDelete: true, loading: false, error: undefined }],
    ['(a) 참: 행 id 가 비면 대상 id 가 다 일치해도 전부 꺼진다', { identityId: '', confirmingDeleteId: '', busyIdentityId: '', errorIdentityId: '', errorText: MSG }, OFF],
    // (b) confirmingDelete — 일치/불일치.
    ['(b) 참: confirmingDeleteId 일치', { identityId: ROW, confirmingDeleteId: ROW }, { confirmingDelete: true, loading: false, error: undefined }],
    ['(b) 거짓: confirmingDeleteId 가 다른 행', { identityId: ROW, confirmingDeleteId: OTHER }, OFF],
    // (c) loading — 일치/불일치.
    ['(c) 참: busyIdentityId 일치', { identityId: ROW, busyIdentityId: ROW }, { confirmingDelete: false, loading: true, error: undefined }],
    ['(c) 거짓: busyIdentityId 가 다른 행', { identityId: ROW, busyIdentityId: OTHER }, OFF],
    // (d) error — 귀속 일치 + 문구 truthy 양쪽 조합.
    ['(d) 참: 귀속 일치 + 문구 있음', { identityId: ROW, errorIdentityId: ROW, errorText: MSG }, { confirmingDelete: false, loading: false, error: MSG }],
    ['(d) 거짓: 귀속 일치 + 문구 없음', { identityId: ROW, errorIdentityId: ROW, errorText: '' }, OFF],
    ['(d) 거짓: 귀속 불일치 + 문구 있음', { identityId: ROW, errorIdentityId: OTHER, errorText: MSG }, OFF],
    // 축 독립 — 진행 중이어도 확인 단계 · 문구는 각자의 대상 id 만 본다.
    ['축 독립: 진행 중 + 확인 단계는 다른 행', { identityId: ROW, busyIdentityId: ROW, confirmingDeleteId: OTHER }, { confirmingDelete: false, loading: true, error: undefined }],
  ])('%s (분기 — 진리표)', (_label, input, expected) => {
    expect(derive(input)).toEqual(expected);
  });

  // negative — 행 id 가 빈 문자열 · 공백뿐이면 어떤 대상 id 와도 일치시키지 않는다(sentinel '' 사고 차단).
  it.each(['', '   ', '\t\n'])('행 id 가 비거나 공백뿐이면 전부 꺼진다 (negative — sentinel %#)', (identityId) => {
    expect(
      derive({ identityId, confirmingDeleteId: '  ', busyIdentityId: undefined, errorIdentityId: '', errorText: MSG }),
    ).toEqual(OFF);
  });

  // negative — 세 대상 id 가 모두 undefined 면 아무 것도 켜지지 않는다(초기 렌더 상태).
  it('세 대상 id 가 모두 undefined 면 아무 것도 켜지지 않는다 (negative — 초기 상태)', () => {
    expect(derive({ identityId: ROW })).toEqual(OFF);
  });

  // negative — 다른 행의 진행이 이 행을 잠그지 않는다(행 단위 in-flight 계약).
  it('다른 행이 진행 중이어도 이 행은 잠기지 않는다 (negative — 행 단위 in-flight)', () => {
    expect(derive({ identityId: ROW, busyIdentityId: OTHER })).toEqual(OFF);
  });

  // negative — 다른 행이 확인 단계여도 이 행은 열리지 않는다(전 행 동시 확정 노출 차단).
  it('다른 행이 확인 단계여도 이 행은 열리지 않는다 (negative — 확인 단계 격리)', () => {
    expect(derive({ identityId: ROW, confirmingDeleteId: OTHER })).toEqual(OFF);
  });

  // negative — 앞뒤 공백만 다른 id 는 같은 행으로 취급한다(trim 정규화 계약).
  it.each([`  ${ROW}`, `${ROW}  `, `\t${ROW}\n`])(
    '앞뒤 공백만 다른 대상 id 도 같은 행으로 취급한다 (negative — trim 경계 %#)',
    (padded) => {
      expect(
        derive({ identityId: `  ${ROW} `, confirmingDeleteId: padded, busyIdentityId: padded, errorIdentityId: padded, errorText: MSG }),
      ).toEqual({ confirmingDelete: true, loading: true, error: MSG });
    },
  );

  // negative — 순수성: 인자 객체를 변형하지 않고, 같은 인자로 반복 호출하면 결과가 같다.
  it('인자 객체를 변형하지 않고 반복 호출 결과가 같다 (negative — 순수성)', () => {
    const input: ServiceIdentityRowFlagsInput = {
      identityId: ` ${ROW} `,
      confirmingDeleteId: ROW,
      busyIdentityId: OTHER,
      errorIdentityId: ROW,
      errorText: MSG,
    };
    const first = derive(input);
    const second = derive(input);
    expect(input).toEqual({
      identityId: ` ${ROW} `,
      confirmingDeleteId: ROW,
      busyIdentityId: OTHER,
      errorIdentityId: ROW,
      errorText: MSG,
    });
    expect(first).toEqual(second);
    expect(first).toEqual({ confirmingDelete: true, loading: false, error: MSG });
  });

  // negative — 반환 객체는 호출마다 새로 만들어진다(한 행의 값을 다른 행이 공유하지 않는다).
  it('호출마다 새 객체를 반환한다 (negative — 반환 공유 차단)', () => {
    const input: ServiceIdentityRowFlagsInput = { identityId: ROW, busyIdentityId: ROW };
    expect(derive(input)).not.toBe(derive(input));
  });
});
