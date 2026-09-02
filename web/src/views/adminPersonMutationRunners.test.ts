import { describe, expect, it, vi } from 'vitest';

// R-112 — T-1856 순수 추출로 신설된 모듈의 **경계 spec**. 러너 3 개와 helper 2 개의 상세 행동
// (가드 · 전이 · 인코딩 · 후속 훅 · 편집 종료)은 이미 AdminView.person-{create,delete,update}-
// contract.test.ts 3 개와 두 identity-autoselect spec 이 `from './AdminView'` 경로로 전량 cover
// 하고 있어 여기서 그것을 복제하지 않는다. 본 파일이 검증하는 것은 그 spec 들이 볼 수 없는
// **새 모듈 자신의 공개 표면** 이다 — 즉 (a) 11 심볼 중 값 심볼 5 개 + path 상수 1 개가 새 모듈에서
// 직접 import 되는가, (b) AdminView 재수출을 거치지 않은 직접 import 경로에서도 각 러너의 정상 /
// 실패 / 미발사 계약이 같은가, (c) 재수출본과 직접 import 본이 **동일 함수 참조** 인가(기존 계약
// spec 들의 검증이 이동 후에도 계속 유효함의 근거). 이동 전에는 존재할 수 없던 검증이라 기존
// spec 과 중복이 아니다.
import {
  PERSONS_PATH,
  extractCreatedPersonId,
  runCreatePerson,
  runDeletePerson,
  buildPersonPatch,
  runUpdatePerson,
} from './adminPersonMutationRunners';
import {
  extractCreatedPersonId as reexportedExtractCreatedPersonId,
  runCreatePerson as reexportedRunCreatePerson,
  runDeletePerson as reexportedRunDeletePerson,
  buildPersonPatch as reexportedBuildPersonPatch,
  runUpdatePerson as reexportedRunUpdatePerson,
} from './AdminView';

const PERSON_ID = 'person-1';
const BOOM = new Error('boom');

// 공통 문구 파생 — 실패 경로 단언을 위해 입력을 그대로 되비추는 결정적 함수를 쓴다.
const describeError = (e: unknown) => `문구:${String(e)}`;

// 3 러너의 deps 를 한 번에 조립하는 헬퍼 — 각 test 는 필요한 축만 스프레드로 덮어쓴다.
// 진행 플래그(creating / deleting / updating)는 러너마다 이름이 달라 공통 override 인자를 두지
// 않고 호출부에서 덮는다.
function makeDeps() {
  return {
    createPerson: {
      create: vi.fn(async () => ({ id: PERSON_ID })),
      describeError,
      creating: false,
      setCreating: vi.fn(),
      setCreateError: vi.fn(),
      bumpRefresh: vi.fn(),
      resetInput: vi.fn(),
      onCreated: vi.fn(),
    },
    deletePerson: {
      remove: vi.fn(async () => undefined),
      describeError,
      deleting: false,
      setDeleting: vi.fn(),
      setDeleteError: vi.fn(),
      bumpRefresh: vi.fn(),
    },
    updatePerson: {
      update: vi.fn(async () => undefined),
      describeError,
      updating: false,
      setUpdating: vi.fn(),
      setUpdateError: vi.fn(),
      bumpRefresh: vi.fn(),
      closeEdit: vi.fn(),
      onUpdated: vi.fn(),
    },
  };
}

describe('adminPersonMutationRunners 모듈 경계(T-1856 순수 추출)', () => {
  it('인원 조회 base path 상수를 새 모듈에서 직접 노출한다', () => {
    expect(PERSONS_PATH).toBe('/api/persons');
  });

  describe('runCreatePerson — 직접 import 경로', () => {
    it('happy-path: POST 1 회 + 재조회 · 입력 초기화 · onCreated 후속 훅', async () => {
      const deps = makeDeps().createPerson;
      await runCreatePerson({ fullName: ' 홍길동 ', email: ' a@b.c ' }, deps);
      expect(deps.create).toHaveBeenCalledTimes(1);
      expect(deps.create).toHaveBeenCalledWith(PERSONS_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 두 필드 모두 trim 된 값이 body 로 나간다(공백 잔존 금지).
        body: JSON.stringify({ fullName: '홍길동', email: 'a@b.c' }),
      });
      expect(deps.bumpRefresh).toHaveBeenCalledTimes(1);
      expect(deps.resetInput).toHaveBeenCalledTimes(1);
      expect(deps.onCreated).toHaveBeenCalledWith(PERSON_ID);
      expect(deps.setCreating.mock.calls).toEqual([[true], [false]]);
    });

    it('error path: primitive reject 시 throw 없이 문구 표면화 + 진행 플래그 복귀', async () => {
      const deps = makeDeps().createPerson;
      deps.create = vi.fn(async () => {
        throw BOOM;
      });
      await expect(
        runCreatePerson({ fullName: '홍길동', email: 'a@b.c' }, deps),
      ).resolves.toBeUndefined();
      expect(deps.setCreateError).toHaveBeenLastCalledWith(
        describeError(BOOM),
      );
      // negative ④ — 실패 경로에서는 재조회 · 입력 초기화 · 후속 훅이 모두 0 회다.
      expect(deps.bumpRefresh).not.toHaveBeenCalled();
      expect(deps.resetInput).not.toHaveBeenCalled();
      expect(deps.onCreated).not.toHaveBeenCalled();
      expect(deps.setCreating).toHaveBeenLastCalledWith(false);
    });

    it('negative ①: fullName 또는 email 이 공백뿐이면 POST 0 회', async () => {
      const blankName = makeDeps().createPerson;
      await runCreatePerson({ fullName: '   ', email: 'a@b.c' }, blankName);
      expect(blankName.create).not.toHaveBeenCalled();
      const blankEmail = makeDeps().createPerson;
      await runCreatePerson({ fullName: '홍길동', email: '  ' }, blankEmail);
      expect(blankEmail.create).not.toHaveBeenCalled();
      expect(blankEmail.setCreating).not.toHaveBeenCalled();
    });

    it('negative ③: creating in-flight 중 재호출은 이중 POST 0 회', async () => {
      const deps = { ...makeDeps().createPerson, creating: true };
      await runCreatePerson({ fullName: '홍길동', email: 'a@b.c' }, deps);
      expect(deps.create).not.toHaveBeenCalled();
      expect(deps.setCreating).not.toHaveBeenCalled();
    });

    it('분기: 응답에서 id 추출 실패면 성공 전이는 유지하고 onCreated 만 0 회', async () => {
      const deps = makeDeps().createPerson;
      deps.create = vi.fn(async () => ({ id: '   ' }));
      await runCreatePerson({ fullName: '홍길동', email: 'a@b.c' }, deps);
      expect(deps.bumpRefresh).toHaveBeenCalledTimes(1);
      expect(deps.onCreated).not.toHaveBeenCalled();
    });
  });

  describe('runDeletePerson — 직접 import 경로', () => {
    it('happy-path: DELETE 1 회(id 인코딩) + 재조회 트리거', async () => {
      const deps = makeDeps().deletePerson;
      await runDeletePerson('p/1', deps);
      expect(deps.remove).toHaveBeenCalledTimes(1);
      expect(deps.remove).toHaveBeenCalledWith('/api/persons/p%2F1', {
        method: 'DELETE',
      });
      expect(deps.bumpRefresh).toHaveBeenCalledTimes(1);
      expect(deps.setDeleting.mock.calls).toEqual([[true], [false]]);
    });

    it('error path: reject 시 throw 없이 문구 표면화 + 재조회 미호출', async () => {
      const deps = makeDeps().deletePerson;
      deps.remove = vi.fn(async () => {
        throw BOOM;
      });
      await expect(runDeletePerson(PERSON_ID, deps)).resolves.toBeUndefined();
      expect(deps.setDeleteError).toHaveBeenLastCalledWith(describeError(BOOM));
      expect(deps.bumpRefresh).not.toHaveBeenCalled();
      expect(deps.setDeleting).toHaveBeenLastCalledWith(false);
    });

    it('negative ②: 공백뿐인 id 면 DELETE 0 회', async () => {
      const deps = makeDeps().deletePerson;
      await runDeletePerson('   ', deps);
      expect(deps.remove).not.toHaveBeenCalled();
      expect(deps.setDeleting).not.toHaveBeenCalled();
    });

    it('negative ③: deleting in-flight 중 재호출은 이중 DELETE 0 회', async () => {
      const deps = { ...makeDeps().deletePerson, deleting: true };
      await runDeletePerson(PERSON_ID, deps);
      expect(deps.remove).not.toHaveBeenCalled();
      expect(deps.setDeleting).not.toHaveBeenCalled();
    });
  });

  describe('runUpdatePerson — 직접 import 경로', () => {
    it('happy-path: PATCH 1 회(변경 필드만) + 재조회 · 편집 종료 · onUpdated', async () => {
      const deps = makeDeps().updatePerson;
      await runUpdatePerson(` ${PERSON_ID} `, { active: false }, deps);
      expect(deps.update).toHaveBeenCalledTimes(1);
      expect(deps.update).toHaveBeenCalledWith(
        `/api/persons/${encodeURIComponent(` ${PERSON_ID} `)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: false }),
        },
      );
      expect(deps.bumpRefresh).toHaveBeenCalledTimes(1);
      expect(deps.closeEdit).toHaveBeenCalledTimes(1);
      // 후속 훅은 path 인코딩 원본이 아니라 trim 된 정규화 id 를 받는다.
      expect(deps.onUpdated).toHaveBeenCalledWith(PERSON_ID);
    });

    it('error path: reject 시 throw 없이 문구 표면화 + 편집 유지 · 후속 훅 0 회', async () => {
      const deps = makeDeps().updatePerson;
      deps.update = vi.fn(async () => {
        throw BOOM;
      });
      await expect(
        runUpdatePerson(PERSON_ID, { fullName: '새이름' }, deps),
      ).resolves.toBeUndefined();
      expect(deps.setUpdateError).toHaveBeenLastCalledWith(describeError(BOOM));
      expect(deps.bumpRefresh).not.toHaveBeenCalled();
      expect(deps.closeEdit).not.toHaveBeenCalled();
      expect(deps.onUpdated).not.toHaveBeenCalled();
      expect(deps.setUpdating).toHaveBeenLastCalledWith(false);
    });

    it('negative ②: 공백뿐인 id 면 PATCH 0 회', async () => {
      const deps = makeDeps().updatePerson;
      await runUpdatePerson('  ', { active: true }, deps);
      expect(deps.update).not.toHaveBeenCalled();
      expect(deps.setUpdating).not.toHaveBeenCalled();
    });

    it('negative ③: updating in-flight 중 재호출은 이중 PATCH 0 회', async () => {
      const deps = { ...makeDeps().updatePerson, updating: true };
      await runUpdatePerson(PERSON_ID, { active: true }, deps);
      expect(deps.update).not.toHaveBeenCalled();
      expect(deps.setUpdating).not.toHaveBeenCalled();
    });

    it('negative ⑤: 변경 필드가 없어 patch 가 비면 PATCH 0 회', async () => {
      const deps = makeDeps().updatePerson;
      await runUpdatePerson(PERSON_ID, {}, deps);
      expect(deps.update).not.toHaveBeenCalled();
      expect(deps.setUpdating).not.toHaveBeenCalled();
      expect(deps.onUpdated).not.toHaveBeenCalled();
    });
  });

  describe('순수 helper 2 개 — 직접 import 경로', () => {
    it('extractCreatedPersonId: 정상 문자열 id 는 정규화해 돌려준다', () => {
      expect(extractCreatedPersonId({ id: `  ${PERSON_ID}  ` })).toBe(
        PERSON_ID,
      );
    });

    it('extractCreatedPersonId: id 부재 · 비문자열 · 비객체 · 공백 id 는 undefined', () => {
      expect(extractCreatedPersonId({})).toBeUndefined();
      expect(extractCreatedPersonId({ id: 7 })).toBeUndefined();
      expect(extractCreatedPersonId(null)).toBeUndefined();
      expect(extractCreatedPersonId([{ id: PERSON_ID }])).toBeUndefined();
      expect(extractCreatedPersonId('문자열')).toBeUndefined();
      expect(extractCreatedPersonId({ id: '   ' })).toBeUndefined();
    });

    it('buildPersonPatch: 변경된 필드만 담고 미변경 필드는 skip 한다', () => {
      const original = { fullName: '홍길동', email: 'a@b.c', active: true };
      expect(
        buildPersonPatch(
          { fullName: ' 김철수 ', email: 'a@b.c', active: false },
          original,
        ),
      ).toEqual({ fullName: '김철수', active: false });
    });

    it('buildPersonPatch: 전부 미변경(공백-only 입력 포함)이면 빈 patch', () => {
      const original = { fullName: '홍길동', email: 'a@b.c', active: true };
      expect(buildPersonPatch({ ...original }, original)).toEqual({});
      expect(
        buildPersonPatch(
          { fullName: '  ', email: '  ', active: true },
          original,
        ),
      ).toEqual({});
    });
  });

  // negative ⑥ — 재수출 identity 보존. AdminView 가 새 모듈에서 import 한 심볼을 그대로
  // re-export 하므로 두 경로의 참조가 동일해야 한다. 이것이 성립해야 기존 계약 spec 6 개의
  // `from './AdminView'` 검증이 이동 후에도 새 모듈 본체를 검증하는 것과 같아진다.
  describe('AdminView 재수출본과 동일 함수 참조(값 심볼 5 개)', () => {
    it('러너 3 개 · helper 2 개 모두 toBe 로 동일 참조다', () => {
      expect(reexportedRunCreatePerson).toBe(runCreatePerson);
      expect(reexportedRunDeletePerson).toBe(runDeletePerson);
      expect(reexportedRunUpdatePerson).toBe(runUpdatePerson);
      expect(reexportedExtractCreatedPersonId).toBe(extractCreatedPersonId);
      expect(reexportedBuildPersonPatch).toBe(buildPersonPatch);
    });
  });
});
