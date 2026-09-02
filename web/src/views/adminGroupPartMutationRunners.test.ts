import { describe, expect, it, vi } from 'vitest';

// R-112 — T-1854 순수 추출로 신설된 모듈의 **경계 spec**. 러너 6 개와 helper 2 개의 상세 행동
// (가드 · 전이 · 인코딩 · 409 전용 문구 · 편집 종료)은 이미 AdminView.{group,part}-{create,delete,
// update}-contract.test.ts 6 개가 `from './AdminView'` 경로로 전량 cover 하고 있어 여기서 그것을
// 복제하지 않는다. 본 파일이 검증하는 것은 그 6 spec 이 볼 수 없는 **새 모듈 자신의 공개 표면**
// 이다 — 즉 (a) 14 심볼 중 값 심볼 8 개 + path 상수 2 개가 새 모듈에서 직접 import 되는가,
// (b) AdminView 재수출을 거치지 않은 직접 import 경로에서도 각 러너의 정상 / 실패 / 미발사 계약이
// 같은가, (c) 재수출본과 직접 import 본이 **동일 함수 참조** 인가(기존 계약 spec 6 개의 검증이
// 이동 후에도 계속 유효함의 근거). 이동 전에는 존재할 수 없던 검증이라 기존 spec 과 중복이 아니다.
import {
  GROUPS_PATH,
  PARTS_PATH,
  PART_DUPLICATE_ERROR,
  runCreateGroup,
  runCreatePart,
  runDeleteGroup,
  runDeletePart,
  resolveSelectedPartIdAfterDelete,
  buildDeletePartBumpRefresh,
  runUpdateGroup,
  runUpdatePart,
} from './adminGroupPartMutationRunners';
import {
  runCreateGroup as reexportedCreateGroup,
  runCreatePart as reexportedCreatePart,
  runDeleteGroup as reexportedDeleteGroup,
  runDeletePart as reexportedDeletePart,
  resolveSelectedPartIdAfterDelete as reexportedResolveSelected,
  buildDeletePartBumpRefresh as reexportedBuildBumpRefresh,
  runUpdateGroup as reexportedUpdateGroup,
  runUpdatePart as reexportedUpdatePart,
} from './AdminView';

const GROUP_ID = 'group-1';
const PART_ID = 'part-1';
const BOOM = new Error('boom');

// 공통 문구 파생 — 실패 경로 단언을 위해 입력을 그대로 되비추는 결정적 함수를 쓴다.
const describeError = (e: unknown) => `문구:${String(e)}`;

// 6 러너의 deps 를 한 번에 조립하는 헬퍼 — 각 test 는 필요한 축만 스프레드로 덮어쓴다.
// 진행 플래그(creating / deleting / updating)는 러너마다 이름이 달라 공통 override 인자를 두지
// 않고 호출부에서 덮는다.
function makeDeps() {
  return {
    createGroup: {
      create: vi.fn(async () => undefined),
      describeError,
      creating: false,
      setCreating: vi.fn(),
      setCreateError: vi.fn(),
      bumpRefresh: vi.fn(),
      resetInput: vi.fn(),
    },
    createPart: {
      create: vi.fn(async () => undefined),
      describeError,
      isConflict: vi.fn(() => false),
      creating: false,
      setCreating: vi.fn(),
      setCreateError: vi.fn(),
      bumpRefresh: vi.fn(),
      resetInput: vi.fn(),
    },
    deleteGroup: {
      remove: vi.fn(async () => undefined),
      describeError,
      deleting: false,
      setDeleting: vi.fn(),
      setDeleteError: vi.fn(),
      bumpRefresh: vi.fn(),
    },
    deletePart: {
      remove: vi.fn(async () => undefined),
      describeError,
      deleting: false,
      setDeleting: vi.fn(),
      setDeleteError: vi.fn(),
      bumpRefresh: vi.fn(),
    },
    updateGroup: {
      update: vi.fn(async () => undefined),
      describeError,
      updating: false,
      setUpdating: vi.fn(),
      setUpdateError: vi.fn(),
      bumpRefresh: vi.fn(),
      closeEdit: vi.fn(),
    },
    updatePart: {
      update: vi.fn(async () => undefined),
      describeError,
      isConflict: vi.fn(() => false),
      updating: false,
      setUpdating: vi.fn(),
      setUpdateError: vi.fn(),
      bumpRefresh: vi.fn(),
      closeEdit: vi.fn(),
    },
  };
}

describe('adminGroupPartMutationRunners 모듈 경계 (T-1854)', () => {
  // ---------------------------------------------------------------- happy-path
  it('path 상수 2 개와 409 문구 상수를 정본 값 그대로 export 한다 (happy-path)', () => {
    expect(GROUPS_PATH).toBe('/api/groups');
    expect(PARTS_PATH).toBe('/api/parts');
    expect(PART_DUPLICATE_ERROR).toBe('이미 존재하는 파트 이름입니다');
  });

  it('생성 러너 2 개가 직접 import 경로에서도 1 회 POST 후 재조회·입력 초기화한다 (happy-path)', async () => {
    const deps = makeDeps();
    await runCreateGroup('  개발본부  ', deps.createGroup);
    await runCreatePart(' 백엔드 ', deps.createPart);

    expect(deps.createGroup.create).toHaveBeenCalledTimes(1);
    expect(deps.createGroup.create).toHaveBeenCalledWith(GROUPS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '개발본부' }),
    });
    expect(deps.createGroup.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(deps.createGroup.resetInput).toHaveBeenCalledTimes(1);
    expect(deps.createGroup.setCreating.mock.calls).toEqual([[true], [false]]);

    expect(deps.createPart.create).toHaveBeenCalledTimes(1);
    expect(deps.createPart.create).toHaveBeenCalledWith(PARTS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '백엔드' }),
    });
    expect(deps.createPart.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(deps.createPart.resetInput).toHaveBeenCalledTimes(1);
  });

  it('삭제 러너 2 개가 직접 import 경로에서도 1 회 DELETE 후 재조회한다 (happy-path)', async () => {
    const deps = makeDeps();
    await runDeleteGroup(GROUP_ID, deps.deleteGroup);
    await runDeletePart(PART_ID, deps.deletePart);

    expect(deps.deleteGroup.remove).toHaveBeenCalledTimes(1);
    expect(deps.deleteGroup.remove).toHaveBeenCalledWith(
      `${GROUPS_PATH}/${GROUP_ID}`,
      { method: 'DELETE' },
    );
    expect(deps.deleteGroup.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(deps.deleteGroup.setDeleting.mock.calls).toEqual([[true], [false]]);

    expect(deps.deletePart.remove).toHaveBeenCalledTimes(1);
    expect(deps.deletePart.remove).toHaveBeenCalledWith(
      `${PARTS_PATH}/${PART_ID}`,
      { method: 'DELETE' },
    );
    expect(deps.deletePart.bumpRefresh).toHaveBeenCalledTimes(1);
  });

  it('수정 러너 2 개가 직접 import 경로에서도 1 회 PATCH 후 재조회·편집 종료한다 (happy-path)', async () => {
    const deps = makeDeps();
    await runUpdateGroup(GROUP_ID, ' 새 그룹 ', '옛 그룹', deps.updateGroup);
    await runUpdatePart(PART_ID, ' 새 파트 ', '옛 파트', deps.updatePart);

    expect(deps.updateGroup.update).toHaveBeenCalledTimes(1);
    expect(deps.updateGroup.update).toHaveBeenCalledWith(
      `${GROUPS_PATH}/${GROUP_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '새 그룹' }),
      },
    );
    expect(deps.updateGroup.bumpRefresh).toHaveBeenCalledTimes(1);
    expect(deps.updateGroup.closeEdit).toHaveBeenCalledTimes(1);

    expect(deps.updatePart.update).toHaveBeenCalledTimes(1);
    expect(deps.updatePart.update).toHaveBeenCalledWith(
      `${PARTS_PATH}/${PART_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '새 파트' }),
      },
    );
    expect(deps.updatePart.closeEdit).toHaveBeenCalledTimes(1);
  });

  it('helper 2 개가 정상 입력에서 선택 전이·콜백 조립을 수행한다 (happy-path)', () => {
    // 선택과 무관한 파트를 지웠으면 현재 선택을 그대로 보존한다.
    expect(resolveSelectedPartIdAfterDelete(PART_ID, 'part-2')).toBe(PART_ID);

    const setRefreshNonce = vi.fn();
    const setSelected = vi.fn();
    const bump = buildDeletePartBumpRefresh(
      setRefreshNonce,
      setSelected,
      PART_ID,
    );
    // factory 는 호출 전에는 아무 setter 도 건드리지 않는다(조립만).
    expect(setRefreshNonce).not.toHaveBeenCalled();
    bump();
    expect(setRefreshNonce).toHaveBeenCalledTimes(1);
    expect(setRefreshNonce.mock.calls[0][0](2)).toBe(3);
    expect(setSelected).toHaveBeenCalledTimes(1);
    // 삭제된 파트가 선택 중이었으면 해제, 아니면 유지.
    expect(setSelected.mock.calls[0][0](PART_ID)).toBe('');
    expect(setSelected.mock.calls[0][0]('part-2')).toBe('part-2');
  });

  // -------------------------------------------------------------- error path
  it('생성 러너 2 개가 발사 실패 시 throw 없이 문구를 표면화하고 진행 플래그를 되돌린다 (error path)', async () => {
    const deps = makeDeps();
    deps.createGroup.create = vi.fn(async () => {
      throw BOOM;
    });
    deps.createPart.create = vi.fn(async () => {
      throw BOOM;
    });

    await expect(runCreateGroup('개발본부', deps.createGroup)).resolves.toBeUndefined();
    expect(deps.createGroup.setCreateError.mock.calls).toEqual([
      [undefined],
      [describeError(BOOM)],
    ]);
    expect(deps.createGroup.setCreating.mock.calls).toEqual([[true], [false]]);
    // negative ④ — 실패 경로에서는 목록 재조회·입력 초기화를 하지 않는다.
    expect(deps.createGroup.bumpRefresh).not.toHaveBeenCalled();
    expect(deps.createGroup.resetInput).not.toHaveBeenCalled();

    await expect(runCreatePart('백엔드', deps.createPart)).resolves.toBeUndefined();
    expect(deps.createPart.setCreateError).toHaveBeenLastCalledWith(
      describeError(BOOM),
    );
    expect(deps.createPart.setCreating.mock.calls).toEqual([[true], [false]]);
    expect(deps.createPart.bumpRefresh).not.toHaveBeenCalled();
  });

  it('삭제 러너 2 개가 발사 실패 시 throw 없이 문구를 표면화하고 진행 플래그를 되돌린다 (error path)', async () => {
    const deps = makeDeps();
    deps.deleteGroup.remove = vi.fn(async () => {
      throw BOOM;
    });
    deps.deletePart.remove = vi.fn(async () => {
      throw BOOM;
    });

    await expect(runDeleteGroup(GROUP_ID, deps.deleteGroup)).resolves.toBeUndefined();
    expect(deps.deleteGroup.setDeleteError).toHaveBeenLastCalledWith(
      describeError(BOOM),
    );
    expect(deps.deleteGroup.setDeleting.mock.calls).toEqual([[true], [false]]);
    expect(deps.deleteGroup.bumpRefresh).not.toHaveBeenCalled();

    await expect(runDeletePart(PART_ID, deps.deletePart)).resolves.toBeUndefined();
    expect(deps.deletePart.setDeleteError).toHaveBeenLastCalledWith(
      describeError(BOOM),
    );
    expect(deps.deletePart.setDeleting.mock.calls).toEqual([[true], [false]]);
    expect(deps.deletePart.bumpRefresh).not.toHaveBeenCalled();
  });

  it('수정 러너 2 개가 발사 실패 시 throw 없이 문구를 표면화하고 진행 플래그를 되돌린다 (error path)', async () => {
    const deps = makeDeps();
    deps.updateGroup.update = vi.fn(async () => {
      throw BOOM;
    });
    deps.updatePart.update = vi.fn(async () => {
      throw BOOM;
    });

    await expect(
      runUpdateGroup(GROUP_ID, '새 그룹', '옛 그룹', deps.updateGroup),
    ).resolves.toBeUndefined();
    expect(deps.updateGroup.setUpdateError).toHaveBeenLastCalledWith(
      describeError(BOOM),
    );
    expect(deps.updateGroup.setUpdating.mock.calls).toEqual([[true], [false]]);
    expect(deps.updateGroup.bumpRefresh).not.toHaveBeenCalled();
    expect(deps.updateGroup.closeEdit).not.toHaveBeenCalled();

    await expect(
      runUpdatePart(PART_ID, '새 파트', '옛 파트', deps.updatePart),
    ).resolves.toBeUndefined();
    expect(deps.updatePart.setUpdateError).toHaveBeenLastCalledWith(
      describeError(BOOM),
    );
    expect(deps.updatePart.setUpdating.mock.calls).toEqual([[true], [false]]);
    expect(deps.updatePart.closeEdit).not.toHaveBeenCalled();
  });

  it('파트 러너 2 개는 409 판정 시 전용 중복 문구로 갈라진다 (error path 분기)', async () => {
    const deps = makeDeps();
    deps.createPart.create = vi.fn(async () => {
      throw BOOM;
    });
    deps.createPart.isConflict = vi.fn(() => true);
    deps.updatePart.update = vi.fn(async () => {
      throw BOOM;
    });
    deps.updatePart.isConflict = vi.fn(() => true);

    await runCreatePart('백엔드', deps.createPart);
    expect(deps.createPart.setCreateError).toHaveBeenLastCalledWith(
      PART_DUPLICATE_ERROR,
    );

    await runUpdatePart(PART_ID, '새 파트', '옛 파트', deps.updatePart);
    expect(deps.updatePart.setUpdateError).toHaveBeenLastCalledWith(
      PART_DUPLICATE_ERROR,
    );
  });

  // ------------------------------------------------------- 분기 / negative cover
  it('negative ① — 생성 2 종은 공백만 든 name 에서 미발사한다 (분기)', async () => {
    const deps = makeDeps();
    await runCreateGroup('   ', deps.createGroup);
    await runCreatePart('\t\n ', deps.createPart);

    expect(deps.createGroup.create).not.toHaveBeenCalled();
    expect(deps.createGroup.setCreating).not.toHaveBeenCalled();
    expect(deps.createPart.create).not.toHaveBeenCalled();
    expect(deps.createPart.setCreating).not.toHaveBeenCalled();
  });

  it('negative ② — 삭제·수정 4 종은 공백만 든 id 에서 미발사한다 (분기)', async () => {
    const deps = makeDeps();
    await runDeleteGroup('  ', deps.deleteGroup);
    await runDeletePart('  ', deps.deletePart);
    await runUpdateGroup('  ', '새 그룹', '옛 그룹', deps.updateGroup);
    await runUpdatePart('  ', '새 파트', '옛 파트', deps.updatePart);

    expect(deps.deleteGroup.remove).not.toHaveBeenCalled();
    expect(deps.deletePart.remove).not.toHaveBeenCalled();
    expect(deps.updateGroup.update).not.toHaveBeenCalled();
    expect(deps.updatePart.update).not.toHaveBeenCalled();
  });

  it('negative ③ — 6 러너 모두 in-flight 중 재호출에서 이중 발사가 0 이다 (분기)', async () => {
    const deps = makeDeps();
    await runCreateGroup('개발본부', { ...deps.createGroup, creating: true });
    await runCreatePart('백엔드', { ...deps.createPart, creating: true });
    await runDeleteGroup(GROUP_ID, { ...deps.deleteGroup, deleting: true });
    await runDeletePart(PART_ID, { ...deps.deletePart, deleting: true });
    await runUpdateGroup(GROUP_ID, '새 그룹', '옛 그룹', {
      ...deps.updateGroup,
      updating: true,
    });
    await runUpdatePart(PART_ID, '새 파트', '옛 파트', {
      ...deps.updatePart,
      updating: true,
    });

    expect(deps.createGroup.create).not.toHaveBeenCalled();
    expect(deps.createPart.create).not.toHaveBeenCalled();
    expect(deps.deleteGroup.remove).not.toHaveBeenCalled();
    expect(deps.deletePart.remove).not.toHaveBeenCalled();
    expect(deps.updateGroup.update).not.toHaveBeenCalled();
    expect(deps.updatePart.update).not.toHaveBeenCalled();
  });

  it('negative ⑤ — 수정 2 종은 공백만 든 name·원본과 동일한 name 에서 PATCH 0 회다 (분기)', async () => {
    const deps = makeDeps();
    // name 공백 가드
    await runUpdateGroup(GROUP_ID, '   ', '옛 그룹', deps.updateGroup);
    await runUpdatePart(PART_ID, '   ', '옛 파트', deps.updatePart);
    // 미변경 가드 — 앞뒤 공백만 덧댄 입력도 원본과 같게 취급한다.
    await runUpdateGroup(GROUP_ID, '  옛 그룹  ', '옛 그룹', deps.updateGroup);
    await runUpdatePart(PART_ID, '  옛 파트  ', '옛 파트', deps.updatePart);

    expect(deps.updateGroup.update).not.toHaveBeenCalled();
    expect(deps.updateGroup.setUpdating).not.toHaveBeenCalled();
    expect(deps.updatePart.update).not.toHaveBeenCalled();
    expect(deps.updatePart.setUpdating).not.toHaveBeenCalled();
  });

  it('resolveSelectedPartIdAfterDelete 는 3 갈래(공백 삭제 id / 선택 일치 / 불일치)를 가른다 (분기)', () => {
    // 삭제 id 가 비었으면(비정상 호출) 현재 선택을 보존한다.
    expect(resolveSelectedPartIdAfterDelete(PART_ID, '   ')).toBe(PART_ID);
    // 선택 중이던 파트가 지워졌으면 선택 해제.
    expect(resolveSelectedPartIdAfterDelete(PART_ID, PART_ID)).toBe('');
    // 다른 파트가 지워졌으면 선택 유지.
    expect(resolveSelectedPartIdAfterDelete(PART_ID, 'part-9')).toBe(PART_ID);
  });

  it('negative ⑥ — AdminView 재수출본과 직접 import 본이 값 심볼 8 개 모두 동일 참조다', () => {
    expect(reexportedCreateGroup).toBe(runCreateGroup);
    expect(reexportedCreatePart).toBe(runCreatePart);
    expect(reexportedDeleteGroup).toBe(runDeleteGroup);
    expect(reexportedDeletePart).toBe(runDeletePart);
    expect(reexportedResolveSelected).toBe(resolveSelectedPartIdAfterDelete);
    expect(reexportedBuildBumpRefresh).toBe(buildDeletePartBumpRefresh);
    expect(reexportedUpdateGroup).toBe(runUpdateGroup);
    expect(reexportedUpdatePart).toBe(runUpdatePart);
  });
});
