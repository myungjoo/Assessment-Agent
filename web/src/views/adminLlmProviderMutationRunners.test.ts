import { describe, expect, it, vi } from 'vitest';

// R-112 — T-1857 순수 추출로 신설된 모듈의 **경계 spec**. 러너 3 개의 상세 행동(가드 · 전이 ·
// 인코딩 · 부분 갱신 body 조립)은 이미 AdminView.llm-provider-{create,update,delete}-contract
// .test.ts 3 개가 `from './AdminView'` 경로로 전량 cover 하고 있어 여기서 그것을 복제하지 않는다.
// 본 파일이 검증하는 것은 그 3 spec 이 볼 수 없는 **새 모듈 자신의 공개 표면** 이다 — 즉 (a) 8 심볼
// 중 값 심볼 3 개 + path 상수 1 개가 새 모듈에서 직접 import 되는가, (b) AdminView 재수출을 거치지
// 않은 직접 import 경로에서도 각 러너의 정상 / 실패 / 미발사 계약이 같은가, (c) 재수출본과 직접
// import 본이 **동일 함수 참조** 인가(기존 계약 spec 들의 위임 검증이 이동 후에도 계속 유효함의
// 근거). 이동 전에는 존재할 수 없던 검증이라 기존 spec 과 중복이 아니다.
import {
  LLM_PROVIDERS_PATH,
  runCreateProvider,
  runDeleteProvider,
  runUpdateProvider,
} from './adminLlmProviderMutationRunners';
import {
  runCreateProvider as reexportedRunCreateProvider,
  runDeleteProvider as reexportedRunDeleteProvider,
  runUpdateProvider as reexportedRunUpdateProvider,
} from './AdminView';

const PROVIDER_ID = 'provider-1';
const BOOM = new Error('boom');
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// 공통 문구 파생 — 실패 경로 단언을 위해 입력을 그대로 되비추는 결정적 함수를 쓴다.
const describeError = (e: unknown) => `문구:${String(e)}`;

// 생성 러너의 유효 입력 4 필드 — 각 test 는 필요한 축만 스프레드로 덮어쓴다.
const VALID_CREATE_FIELDS = {
  provider: 'openai',
  endpointUrl: 'https://api.example.com',
  apiKey: 'sk-secret',
  modelId: 'gpt-x',
};

// 3 러너의 deps 를 한 번에 조립하는 헬퍼 — 진행 플래그(creating / deleting / updating)는 러너마다
// 이름이 달라 공통 override 인자를 두지 않고 호출부에서 덮는다.
function makeDeps() {
  return {
    createProvider: {
      create: vi.fn(async () => undefined),
      describeError,
      creating: false,
      setCreating: vi.fn(),
      setCreateError: vi.fn(),
      bumpRefresh: vi.fn(),
      resetInput: vi.fn(),
    },
    deleteProvider: {
      remove: vi.fn(async () => undefined),
      describeError,
      deleting: false,
      setDeleting: vi.fn(),
      setDeleteError: vi.fn(),
      bumpRefresh: vi.fn(),
    },
    updateProvider: {
      update: vi.fn(async () => undefined),
      describeError,
      id: PROVIDER_ID,
      updating: false,
      setUpdating: vi.fn(),
      setUpdateError: vi.fn(),
      bumpRefresh: vi.fn(),
      closeEdit: vi.fn(),
    },
  };
}

describe('adminLlmProviderMutationRunners 모듈 경계(T-1857 순수 추출)', () => {
  it('LLM provider 조회 base path 상수를 새 모듈에서 직접 노출한다', () => {
    expect(LLM_PROVIDERS_PATH).toBe('/api/llm/providers');
  });

  describe('runCreateProvider — 직접 import 경로', () => {
    it('happy-path: POST 1 회 + 재조회 트리거 · 입력 초기화', async () => {
      const deps = makeDeps().createProvider;
      await runCreateProvider(
        { ...VALID_CREATE_FIELDS, provider: ' openai ', modelId: ' gpt-x ' },
        deps,
      );
      expect(deps.create).toHaveBeenCalledTimes(1);
      expect(deps.create).toHaveBeenCalledWith(LLM_PROVIDERS_PATH, {
        method: 'POST',
        headers: JSON_HEADERS,
        // 4 필드 모두 trim 된 값이 body 로 나간다(공백 잔존 금지).
        body: JSON.stringify(VALID_CREATE_FIELDS),
      });
      expect(deps.bumpRefresh).toHaveBeenCalledTimes(1);
      expect(deps.resetInput).toHaveBeenCalledTimes(1);
      expect(deps.setCreating.mock.calls).toEqual([[true], [false]]);
      expect(deps.setCreateError.mock.calls).toEqual([[undefined]]);
    });

    it('error path: primitive reject 시 throw 없이 문구 표면화 + 진행 플래그 복귀', async () => {
      const deps = makeDeps().createProvider;
      deps.create = vi.fn(async () => {
        throw BOOM;
      });
      await expect(
        runCreateProvider(VALID_CREATE_FIELDS, deps),
      ).resolves.toBeUndefined();
      expect(deps.setCreateError).toHaveBeenLastCalledWith(describeError(BOOM));
      // negative ④ — 실패 경로에서는 재조회 · 입력 초기화 후속 훅이 돌지 않는다.
      expect(deps.bumpRefresh).not.toHaveBeenCalled();
      expect(deps.resetInput).not.toHaveBeenCalled();
      expect(deps.setCreating.mock.calls).toEqual([[true], [false]]);
    });

    it.each([
      ['provider', { provider: '   ' }],
      ['endpointUrl', { endpointUrl: '' }],
      ['apiKey', { apiKey: '  ' }],
      ['modelId', { modelId: ' ' }],
    ])(
      'negative ① — %s 가 빈/공백이면 POST 미발사(빈 필드 가드 분기)',
      async (_label, override) => {
        const deps = makeDeps().createProvider;
        await runCreateProvider(
          { ...VALID_CREATE_FIELDS, ...override },
          deps,
        );
        expect(deps.create).not.toHaveBeenCalled();
        expect(deps.setCreating).not.toHaveBeenCalled();
      },
    );

    it('negative ③ — creating in-flight 중 재호출은 이중 POST 를 내지 않는다', async () => {
      const deps = { ...makeDeps().createProvider, creating: true };
      await runCreateProvider(VALID_CREATE_FIELDS, deps);
      expect(deps.create).not.toHaveBeenCalled();
      expect(deps.setCreating).not.toHaveBeenCalled();
    });
  });

  describe('runDeleteProvider — 직접 import 경로', () => {
    it('happy-path: DELETE 1 회 + 재조회 트리거', async () => {
      const deps = makeDeps().deleteProvider;
      await runDeleteProvider(PROVIDER_ID, deps);
      expect(deps.remove).toHaveBeenCalledTimes(1);
      expect(deps.remove).toHaveBeenCalledWith(
        `${LLM_PROVIDERS_PATH}/${PROVIDER_ID}`,
        { method: 'DELETE' },
      );
      expect(deps.bumpRefresh).toHaveBeenCalledTimes(1);
      expect(deps.setDeleting.mock.calls).toEqual([[true], [false]]);
    });

    it('error path: primitive reject 시 throw 없이 문구 표면화 + 진행 플래그 복귀', async () => {
      const deps = makeDeps().deleteProvider;
      deps.remove = vi.fn(async () => {
        throw BOOM;
      });
      await expect(
        runDeleteProvider(PROVIDER_ID, deps),
      ).resolves.toBeUndefined();
      expect(deps.setDeleteError).toHaveBeenLastCalledWith(describeError(BOOM));
      // negative ④ — 실패 시 재조회 트리거는 돌지 않는다(목록 그대로 유지).
      expect(deps.bumpRefresh).not.toHaveBeenCalled();
      expect(deps.setDeleting.mock.calls).toEqual([[true], [false]]);
    });

    it.each([['', '빈 id'], ['   ', '공백만 든 id']])(
      'negative ② — %s(%s)면 DELETE 미발사',
      async (id) => {
        const deps = makeDeps().deleteProvider;
        await runDeleteProvider(id, deps);
        expect(deps.remove).not.toHaveBeenCalled();
        expect(deps.setDeleting).not.toHaveBeenCalled();
      },
    );

    it('negative ③ — deleting in-flight 중 재호출은 이중 DELETE 를 내지 않는다', async () => {
      const deps = { ...makeDeps().deleteProvider, deleting: true };
      await runDeleteProvider(PROVIDER_ID, deps);
      expect(deps.remove).not.toHaveBeenCalled();
      expect(deps.setDeleting).not.toHaveBeenCalled();
    });

    it('negative ⑥ — 비정상 문자가 든 id 는 encodeURIComponent 로 안전 인코딩된다', async () => {
      const deps = makeDeps().deleteProvider;
      await runDeleteProvider('a/b?c d', deps);
      expect(deps.remove).toHaveBeenCalledWith(
        `${LLM_PROVIDERS_PATH}/a%2Fb%3Fc%20d`,
        { method: 'DELETE' },
      );
    });
  });

  describe('runUpdateProvider — 직접 import 경로', () => {
    it('happy-path: PATCH 1 회 + 재조회 트리거 · 편집 종료', async () => {
      const deps = makeDeps().updateProvider;
      await runUpdateProvider({ ...VALID_CREATE_FIELDS }, deps);
      expect(deps.update).toHaveBeenCalledTimes(1);
      expect(deps.update).toHaveBeenCalledWith(
        `${LLM_PROVIDERS_PATH}/${PROVIDER_ID}`,
        {
          method: 'PATCH',
          headers: JSON_HEADERS,
          body: JSON.stringify(VALID_CREATE_FIELDS),
        },
      );
      expect(deps.bumpRefresh).toHaveBeenCalledTimes(1);
      expect(deps.closeEdit).toHaveBeenCalledTimes(1);
      expect(deps.setUpdating.mock.calls).toEqual([[true], [false]]);
    });

    it('분기 — 입력된 필드만 body 에 담기고 빈 apiKey 는 제외된다(부분 갱신)', async () => {
      const deps = makeDeps().updateProvider;
      await runUpdateProvider(
        { provider: '', endpointUrl: ' https://new ', apiKey: '  ', modelId: '' },
        deps,
      );
      expect(deps.update).toHaveBeenCalledWith(
        `${LLM_PROVIDERS_PATH}/${PROVIDER_ID}`,
        {
          method: 'PATCH',
          headers: JSON_HEADERS,
          // 빈 apiKey 는 body 에서 빠져 기존 ciphertext 가 유지되는 갈래.
          body: JSON.stringify({ endpointUrl: 'https://new' }),
        },
      );
    });

    it('error path: primitive reject 시 throw 없이 문구 표면화 + 진행 플래그 복귀', async () => {
      const deps = makeDeps().updateProvider;
      deps.update = vi.fn(async () => {
        throw BOOM;
      });
      await expect(
        runUpdateProvider(VALID_CREATE_FIELDS, deps),
      ).resolves.toBeUndefined();
      expect(deps.setUpdateError).toHaveBeenLastCalledWith(describeError(BOOM));
      // negative ④ — 실패 시 재조회 · 편집 종료는 돌지 않는다(편집 상태 유지).
      expect(deps.bumpRefresh).not.toHaveBeenCalled();
      expect(deps.closeEdit).not.toHaveBeenCalled();
      expect(deps.setUpdating.mock.calls).toEqual([[true], [false]]);
    });

    it.each([['', '빈 id'], ['   ', '공백만 든 id']])(
      'negative ② — %s(%s)면 PATCH 미발사',
      async (id) => {
        const deps = { ...makeDeps().updateProvider, id };
        await runUpdateProvider(VALID_CREATE_FIELDS, deps);
        expect(deps.update).not.toHaveBeenCalled();
        expect(deps.setUpdating).not.toHaveBeenCalled();
      },
    );

    it('negative ③ — updating in-flight 중 재호출은 이중 PATCH 를 내지 않는다', async () => {
      const deps = { ...makeDeps().updateProvider, updating: true };
      await runUpdateProvider(VALID_CREATE_FIELDS, deps);
      expect(deps.update).not.toHaveBeenCalled();
      expect(deps.setUpdating).not.toHaveBeenCalled();
    });

    it('negative ⑤ — 변경 필드 0(4 필드 전부 공백)이면 빈 body PATCH 미발사', async () => {
      const deps = makeDeps().updateProvider;
      await runUpdateProvider(
        { provider: ' ', endpointUrl: '', apiKey: '   ', modelId: ' ' },
        deps,
      );
      expect(deps.update).not.toHaveBeenCalled();
      expect(deps.setUpdating).not.toHaveBeenCalled();
    });

    it('negative ⑥ — 비정상 문자가 든 id 는 encodeURIComponent 로 안전 인코딩된다', async () => {
      const deps = { ...makeDeps().updateProvider, id: 'a/b?c d' };
      await runUpdateProvider({ ...VALID_CREATE_FIELDS }, deps);
      expect(deps.update).toHaveBeenCalledWith(
        `${LLM_PROVIDERS_PATH}/a%2Fb%3Fc%20d`,
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('negative ⑦ — AdminView 재수출 identity 보존', () => {
    it('값 심볼 3 개가 새 모듈의 함수와 동일 참조다', () => {
      expect(reexportedRunCreateProvider).toBe(runCreateProvider);
      expect(reexportedRunDeleteProvider).toBe(runDeleteProvider);
      expect(reexportedRunUpdateProvider).toBe(runUpdateProvider);
    });
  });
});
