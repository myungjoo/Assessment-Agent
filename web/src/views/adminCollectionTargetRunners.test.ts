import { describe, expect, it, vi } from 'vitest';

// R-112 — T-1830 순수 추출로 신설된 모듈의 **경계 spec**. 러너 3 개의 상세 행동(가드 · 전이 ·
// 인코딩 · 예외 분기)은 이미 AdminView.collection-targets-{create,delete,active-toggle}.test.tsx
// 3 개가 `from './AdminView'` 경로로 전량 cover 하고 있어 여기서 그것을 복제하지 않는다.
// 본 파일이 검증하는 것은 그 3 spec 이 볼 수 없는 **새 모듈 자신의 공개 표면** 이다 —
// 즉 (a) 9 심볼 중 export 계약인 5 개가 새 모듈에서 직접 import 되는가, (b) AdminView 재수출을
// 거치지 않은 직접 import 경로에서도 각 러너의 정상/미발사 계약이 같은가. 이동 전에는 존재할 수
// 없던 검증이라 기존 spec 과 중복이 아니다.
import {
  COLLECTION_TARGETS_PATH,
  COLLECTION_TARGET_TYPE_VALUES,
  runCreateCollectionTarget,
  runDeleteCollectionTarget,
  runToggleCollectionTargetActive,
} from './adminCollectionTargetRunners';
import { COLLECTION_TARGET_TYPES } from '../components/CollectionTargetAddForm';

const ID = 'ct-1';

describe('adminCollectionTargetRunners 모듈 경계 (T-1830)', () => {
  // happy-path — 상수 2 개가 정본 값 그대로 노출된다(path 재선언 0 · type 정본 위임).
  it('상수 2 개를 정본 값 그대로 export 한다 (happy-path)', () => {
    expect(COLLECTION_TARGETS_PATH).toBe('/api/collection-targets');
    // 값 복제가 아니라 CollectionTargetAddForm 정본을 넓힌 별칭이어야 한다(같은 원소 · 같은 순서).
    expect(COLLECTION_TARGET_TYPE_VALUES).toEqual([...COLLECTION_TARGET_TYPES]);
  });

  // happy-path — 직접 import 경로에서도 3 러너가 정확한 method/path/body 로 1 회 발사하고 재조회한다.
  it('3 러너가 직접 import 경로에서도 1 회 발사 후 재조회한다 (happy-path)', async () => {
    const post = vi.fn(async () => ({ id: ID }));
    const remove = vi.fn(async () => undefined);
    const patch = vi.fn(async () => undefined);
    const reloadTargets = vi.fn();
    const common = { describeError: (e: unknown) => String(e), reloadTargets };

    await runCreateCollectionTarget(
      { type: COLLECTION_TARGET_TYPES[0], instanceKey: 'k', endpoint: 'e' },
      {
        ...common,
        post,
        creating: false,
        setCreating: vi.fn(),
        setCreateError: vi.fn(),
        resetInput: vi.fn(),
      },
    );
    await runDeleteCollectionTarget(ID, {
      ...common,
      remove,
      deletingId: undefined,
      setDeletingId: vi.fn(),
      setDeleteError: vi.fn(),
    });
    await runToggleCollectionTargetActive(ID, false, {
      ...common,
      patch,
      togglingId: undefined,
      setTogglingId: vi.fn(),
      setToggleError: vi.fn(),
    });

    expect(post.mock.calls).toHaveLength(1);
    expect(remove.mock.calls).toHaveLength(1);
    expect(patch.mock.calls).toHaveLength(1);
    expect(reloadTargets).toHaveBeenCalledTimes(3);
  });

  // error path — 발사기가 reject 해도 throw 0, 문구만 세우고 재조회는 하지 않는다(3 러너 공통 계약).
  it('발사기 reject 시 throw 없이 문구만 세우고 재조회하지 않는다 (error path)', async () => {
    const boom = async () => {
      throw new Error('500');
    };
    const reloadTargets = vi.fn();
    const setCreateError = vi.fn();
    const setDeleteError = vi.fn();
    const setToggleError = vi.fn();
    const common = { describeError: (e: unknown) => `문구:${String(e)}`, reloadTargets };

    await expect(
      runCreateCollectionTarget(
        { type: COLLECTION_TARGET_TYPES[0], instanceKey: 'k', endpoint: 'e' },
        {
          ...common,
          post: boom,
          creating: false,
          setCreating: vi.fn(),
          setCreateError,
          resetInput: vi.fn(),
        },
      ),
    ).resolves.toBeUndefined();
    await expect(
      runDeleteCollectionTarget(ID, {
        ...common,
        remove: boom,
        deletingId: undefined,
        setDeletingId: vi.fn(),
        setDeleteError,
      }),
    ).resolves.toBeUndefined();
    await expect(
      runToggleCollectionTargetActive(ID, true, {
        ...common,
        patch: boom,
        togglingId: undefined,
        setTogglingId: vi.fn(),
        setToggleError,
      }),
    ).resolves.toBeUndefined();

    expect(setCreateError).toHaveBeenLastCalledWith('문구:Error: 500');
    expect(setDeleteError).toHaveBeenLastCalledWith('문구:Error: 500');
    expect(setToggleError).toHaveBeenLastCalledWith('문구:Error: 500');
    expect(reloadTargets).not.toHaveBeenCalled();
  });

  // 분기 + negative — 미발사 가드도 직접 import 경로에서 동일하다(허용 밖 type / 빈 id / in-flight).
  it('가드 조건이면 미발사한다 (분기 + negative)', async () => {
    const fire = vi.fn(async () => undefined);
    const reloadTargets = vi.fn();
    const common = { describeError: String, reloadTargets };

    // 허용 밖 type — @IsIn 밖 값은 네트워크 전에 차단.
    await runCreateCollectionTarget(
      { type: 'JIRA', instanceKey: 'k', endpoint: 'e' },
      {
        ...common,
        post: fire,
        creating: false,
        setCreating: vi.fn(),
        setCreateError: vi.fn(),
        resetInput: vi.fn(),
      },
    );
    // 공백뿐 id — trim 후 빈 문자열이면 item path 가 깨지므로 미발사.
    await runDeleteCollectionTarget('   ', {
      ...common,
      remove: fire,
      deletingId: undefined,
      setDeletingId: vi.fn(),
      setDeleteError: vi.fn(),
    });
    // in-flight — 진행 중 id 를 보유하면 이중 PATCH 차단.
    await runToggleCollectionTargetActive(ID, true, {
      ...common,
      patch: fire,
      togglingId: 'other',
      setTogglingId: vi.fn(),
      setToggleError: vi.fn(),
    });

    expect(fire).not.toHaveBeenCalled();
    expect(reloadTargets).not.toHaveBeenCalled();
  });
});
