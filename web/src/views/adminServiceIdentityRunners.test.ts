import { describe, expect, it, vi } from 'vitest';

// R-112 — T-1852 순수 추출로 신설된 모듈의 **경계 spec**. 러너 4 개의 상세 행동(가드 · 전이 ·
// 문구 파생 · 예외 분기)은 이미 AdminView.service-identity-{create,update,delete,primary}.test.tsx
// 4 개가 `from './AdminView'` 경로로 전량 cover 하고 있어 여기서 그것을 복제하지 않는다.
// 본 파일이 검증하는 것은 그 4 spec 이 볼 수 없는 **새 모듈 자신의 공개 표면** 이다 —
// 즉 (a) 러너 4 개가 새 모듈에서 직접 import 되는가, (b) AdminView 재수출을 거치지 않은 직접
// import 경로에서도 각 러너의 정상 / 실패 / 미발사 계약이 같은가, (c) 재수출본과 직접 import 본이
// **동일 함수 참조** 인가(row-bridge spec 의 위임 검증이 계속 유효함의 근거). 이동 전에는 존재할
// 수 없던 검증이라 기존 spec 과 중복이 아니다.
import {
  runCreateServiceIdentity,
  runUpdateServiceIdentity,
  runDeleteServiceIdentity,
  runSetPrimaryServiceIdentity,
} from './adminServiceIdentityRunners';
import {
  runCreateServiceIdentity as reexportedCreate,
  runUpdateServiceIdentity as reexportedUpdate,
  runDeleteServiceIdentity as reexportedDelete,
  runSetPrimaryServiceIdentity as reexportedSetPrimary,
} from './AdminView';

const PERSON_ID = 'person-1';
const IDENTITY_ID = 'si-1';
const INPUT = { service: 'github', externalId: 'octocat' };

// 4 러너의 deps 를 한 번에 조립하는 헬퍼 — 각 test 는 필요한 축만 스프레드로 덮어쓴다.
// 진행 플래그(in-flight)는 러너마다 이름이 달라 공통 override 인자를 두지 않고 호출부에서 덮는다.
function makeDeps() {
  const bumpRefresh = vi.fn();
  const describeError = (e: unknown) => `문구:${String(e)}`;
  return {
    bumpRefresh,
    create: {
      create: vi.fn(async () => ({ id: IDENTITY_ID })),
      describeError,
      creating: false,
      setCreating: vi.fn(),
      setCreateError: vi.fn(),
      bumpRefresh,
      resetInput: vi.fn(),
    },
    update: {
      update: vi.fn(async () => undefined),
      describeError,
      updating: false,
      setUpdating: vi.fn(),
      setUpdateError: vi.fn(),
      bumpRefresh,
      endEdit: vi.fn(),
    },
    remove: {
      remove: vi.fn(async () => undefined),
      describeError,
      deleting: false,
      setDeleting: vi.fn(),
      setDeleteError: vi.fn(),
      bumpRefresh,
      endConfirm: vi.fn(),
    },
    primary: {
      setPrimary: vi.fn(async () => ({ id: IDENTITY_ID })),
      describeError,
      settingPrimary: false,
      setSettingPrimary: vi.fn(),
      setPrimaryError: vi.fn(),
      bumpRefresh,
    },
  };
}

describe('adminServiceIdentityRunners 모듈 경계 (T-1852)', () => {
  // happy-path — 직접 import 경로에서도 4 러너가 각자의 primitive 를 정확한 인자로 1 회 발사하고
  // 성공 전이(bumpRefresh + 각자의 마감 콜백)를 수행한다.
  it('4 러너가 직접 import 경로에서 1 회 발사 후 성공 전이한다 (happy-path)', async () => {
    const d = makeDeps();

    await runCreateServiceIdentity(PERSON_ID, INPUT, d.create);
    expect(d.create.create.mock.calls).toEqual([[PERSON_ID, INPUT]]);
    expect(d.create.resetInput).toHaveBeenCalledTimes(1);
    expect(d.create.setCreating.mock.calls).toEqual([[true], [false]]);

    await runUpdateServiceIdentity(
      PERSON_ID,
      IDENTITY_ID,
      { externalId: 'renamed' },
      d.update,
    );
    expect(d.update.update.mock.calls).toEqual([
      [PERSON_ID, IDENTITY_ID, { externalId: 'renamed' }],
    ]);
    expect(d.update.endEdit).toHaveBeenCalledTimes(1);

    await runDeleteServiceIdentity(PERSON_ID, IDENTITY_ID, d.remove);
    expect(d.remove.remove.mock.calls).toEqual([[PERSON_ID, IDENTITY_ID]]);
    expect(d.remove.endConfirm).toHaveBeenCalledTimes(1);

    await runSetPrimaryServiceIdentity(PERSON_ID, IDENTITY_ID, d.primary);
    expect(d.primary.setPrimary.mock.calls).toEqual([[PERSON_ID, IDENTITY_ID]]);

    // 4 러너 모두 성공 시 권위 목록 재조회를 1 회씩 건다.
    expect(d.bumpRefresh).toHaveBeenCalledTimes(4);
  });

  // error path — 발사기가 reject 해도 throw 0, 문구만 세우고 진행 플래그는 finally 로 되돌린다.
  it('발사 primitive reject 시 throw 없이 문구를 세우고 진행 플래그를 되돌린다 (error path)', async () => {
    const boom = async () => {
      throw new Error('500');
    };
    const d = makeDeps();

    await expect(
      runCreateServiceIdentity(PERSON_ID, INPUT, { ...d.create, create: boom }),
    ).resolves.toBeUndefined();
    await expect(
      runUpdateServiceIdentity(
        PERSON_ID,
        IDENTITY_ID,
        { externalId: 'renamed' },
        { ...d.update, update: boom },
      ),
    ).resolves.toBeUndefined();
    await expect(
      runDeleteServiceIdentity(PERSON_ID, IDENTITY_ID, {
        ...d.remove,
        remove: boom,
      }),
    ).resolves.toBeUndefined();
    await expect(
      runSetPrimaryServiceIdentity(PERSON_ID, IDENTITY_ID, {
        ...d.primary,
        setPrimary: boom,
      }),
    ).resolves.toBeUndefined();

    expect(d.create.setCreateError).toHaveBeenLastCalledWith('문구:Error: 500');
    expect(d.update.setUpdateError).toHaveBeenLastCalledWith('문구:Error: 500');
    expect(d.remove.setDeleteError).toHaveBeenLastCalledWith('문구:Error: 500');
    expect(d.primary.setPrimaryError).toHaveBeenLastCalledWith(
      '문구:Error: 500',
    );
    // 진행 플래그는 on → off 로 되돌아온다(finally).
    expect(d.create.setCreating.mock.calls).toEqual([[true], [false]]);
    expect(d.update.setUpdating.mock.calls).toEqual([[true], [false]]);
    expect(d.remove.setDeleting.mock.calls).toEqual([[true], [false]]);
    expect(d.primary.setSettingPrimary.mock.calls).toEqual([[true], [false]]);
  });

  // negative ④ — 실패 경로에서는 목록 재조회(bumpRefresh)와 마감 콜백을 부르지 않는다.
  it('실패 경로에서 재조회·마감 콜백을 부르지 않는다 (negative)', async () => {
    const boom = async () => {
      throw new Error('404');
    };
    const d = makeDeps();

    await runCreateServiceIdentity(PERSON_ID, INPUT, { ...d.create, create: boom });
    await runUpdateServiceIdentity(
      PERSON_ID,
      IDENTITY_ID,
      { externalId: 'renamed' },
      { ...d.update, update: boom },
    );
    await runDeleteServiceIdentity(PERSON_ID, IDENTITY_ID, {
      ...d.remove,
      remove: boom,
    });
    await runSetPrimaryServiceIdentity(PERSON_ID, IDENTITY_ID, {
      ...d.primary,
      setPrimary: boom,
    });

    expect(d.bumpRefresh).not.toHaveBeenCalled();
    expect(d.create.resetInput).not.toHaveBeenCalled();
    expect(d.update.endEdit).not.toHaveBeenCalled();
    expect(d.remove.endConfirm).not.toHaveBeenCalled();
  });

  // 분기 + negative ①② — runCreateServiceIdentity 의 3 no-op 가드를 갈래별로 분리 검증한다.
  it('runCreateServiceIdentity 의 3 가드가 갈래별로 미발사한다 (분기 + negative)', async () => {
    // ① 공백뿐 personId — 깨진 path 를 네트워크 전에 차단.
    const blankPerson = makeDeps().create;
    await runCreateServiceIdentity('   ', INPUT, blankPerson);
    expect(blankPerson.create).not.toHaveBeenCalled();
    expect(blankPerson.setCreating).not.toHaveBeenCalled();

    // ② 빈 externalId — 400 확정 요청을 사전 차단(service 만 채운 미완 입력).
    const blankExternalId = makeDeps().create;
    await runCreateServiceIdentity(
      PERSON_ID,
      { service: 'github', externalId: '  ' },
      blankExternalId,
    );
    expect(blankExternalId.create).not.toHaveBeenCalled();

    // ②' — 빈 service 도 같은 갈래로 미발사.
    const blankService = makeDeps().create;
    await runCreateServiceIdentity(
      PERSON_ID,
      { service: '', externalId: 'octocat' },
      blankService,
    );
    expect(blankService.create).not.toHaveBeenCalled();

    // ③ in-flight — 이전 create 미완 중 재호출 시 이중 POST 0.
    const inFlight = { ...makeDeps().create, creating: true };
    await runCreateServiceIdentity(PERSON_ID, INPUT, inFlight);
    expect(inFlight.create).not.toHaveBeenCalled();
    expect(inFlight.setCreateError).not.toHaveBeenCalled();
  });

  // 분기 + negative ③ — 나머지 3 러너의 id 가드 · 입력 가드 · in-flight 가드를 갈래별로 검증한다.
  it('update/delete/primary 러너의 id·in-flight 가드가 미발사한다 (분기 + negative)', async () => {
    // update — 공백 personId / 공백 identityId / 빈 입력 / in-flight 4 갈래.
    const u1 = makeDeps().update;
    await runUpdateServiceIdentity(' ', IDENTITY_ID, { externalId: 'x' }, u1);
    const u2 = makeDeps().update;
    await runUpdateServiceIdentity(PERSON_ID, '  ', { externalId: 'x' }, u2);
    const u3 = makeDeps().update;
    await runUpdateServiceIdentity(PERSON_ID, IDENTITY_ID, { externalId: ' ' }, u3);
    const u4 = { ...makeDeps().update, updating: true };
    await runUpdateServiceIdentity(PERSON_ID, IDENTITY_ID, { externalId: 'x' }, u4);
    for (const d of [u1, u2, u3, u4]) {
      expect(d.update).not.toHaveBeenCalled();
      expect(d.setUpdating).not.toHaveBeenCalled();
    }

    // delete — 공백 personId / 공백 identityId / in-flight 3 갈래(입력 가드 없음).
    const d1 = makeDeps().remove;
    await runDeleteServiceIdentity('', IDENTITY_ID, d1);
    const d2 = makeDeps().remove;
    await runDeleteServiceIdentity(PERSON_ID, '   ', d2);
    const d3 = { ...makeDeps().remove, deleting: true };
    await runDeleteServiceIdentity(PERSON_ID, IDENTITY_ID, d3);
    for (const d of [d1, d2, d3]) {
      expect(d.remove).not.toHaveBeenCalled();
      expect(d.endConfirm).not.toHaveBeenCalled();
    }

    // primary — 공백 personId / 공백 identityId / in-flight 3 갈래.
    const p1 = makeDeps().primary;
    await runSetPrimaryServiceIdentity('  ', IDENTITY_ID, p1);
    const p2 = makeDeps().primary;
    await runSetPrimaryServiceIdentity(PERSON_ID, '', p2);
    const p3 = { ...makeDeps().primary, settingPrimary: true };
    await runSetPrimaryServiceIdentity(PERSON_ID, IDENTITY_ID, p3);
    for (const d of [p1, p2, p3]) {
      expect(d.setPrimary).not.toHaveBeenCalled();
      expect(d.setSettingPrimary).not.toHaveBeenCalled();
    }
  });

  // negative ⑤ — 재수출 identity 보존. AdminView 경유본과 직접 import 본이 같은 함수 참조여야
  // 기존 spec 5 개(특히 row-bridge 의 위임 검증)가 이동 후에도 같은 대상을 보게 된다.
  it('AdminView 재수출본과 직접 import 본이 동일 함수 참조다 (negative — 재수출 identity)', () => {
    expect(reexportedCreate).toBe(runCreateServiceIdentity);
    expect(reexportedUpdate).toBe(runUpdateServiceIdentity);
    expect(reexportedDelete).toBe(runDeleteServiceIdentity);
    expect(reexportedSetPrimary).toBe(runSetPrimaryServiceIdentity);
  });
});
