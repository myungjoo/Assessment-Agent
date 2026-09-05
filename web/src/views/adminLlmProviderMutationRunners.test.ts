import { describe, expect, it, vi } from 'vitest';

// R-112 — T-1857 순수 추출로 신설된 모듈의 **경계 spec**. 러너 3 개의 상세 행동(가드 · 전이 ·
// 인코딩 · 부분 갱신 body 조립)은 이미 AdminView.llm-provider-{create,update,delete}-contract
// .test.ts 3 개가 `from './AdminView'` 경로로 전량 cover 하고 있어 여기서 그것을 복제하지 않는다.
// 본 파일이 검증하는 것은 그 3 spec 이 볼 수 없는 **새 모듈 자신의 공개 표면** 이다 — 즉 (a) 8 심볼
// 중 값 심볼 3 개 + path 상수 1 개가 새 모듈에서 직접 import 되는가, (b) AdminView 재수출을 거치지
// 않은 직접 import 경로에서도 각 러너의 정상 / 실패 / 미발사 계약이 같은가, (c) 재수출본과 직접
// import 본이 **동일 함수 참조** 인가(기존 계약 spec 들의 위임 검증이 이동 후에도 계속 유효함의
// 근거). 이동 전에는 존재할 수 없던 검증이라 기존 spec 과 중복이 아니다.
// T-1877 합류분(난이도 매핑 assign 축) 도 같은 취지로 검증한다 — runAssign 의 상세 행동 자체는
// AdminView.difficulty-mapping-assign-contract.test.ts 가 `from './AdminView'` 경로로 이미 cover
// 하지만, 새 모듈에서 **직접 import** 한 경로의 계약 · 상수 정본 값 · 재수출 identity 는 이동 전에는
// 검증할 수 없던 축이라 중복이 아니다.
import {
  LLM_PROVIDERS_PATH,
  LLM_MAPPINGS_PATH,
  runCreateProvider,
  runDeleteProvider,
  runUpdateProvider,
  runSetDefaultProvider,
  runAssign,
} from './adminLlmProviderMutationRunners';
import {
  runCreateProvider as reexportedRunCreateProvider,
  runDeleteProvider as reexportedRunDeleteProvider,
  runUpdateProvider as reexportedRunUpdateProvider,
  runAssign as reexportedRunAssign,
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

// 기본 provider 재지정 러너(T-1898 쓰기 축 A)의 deps — 진행 플래그 settingDefault 는 호출부에서
// 덮는다. 대상 id 는 deps 가 아니라 러너 인자로 가므로(정적 path + body 발사) 여기 없다.
function makeSetDefaultDeps() {
  return {
    update: vi.fn(async () => undefined),
    describeError,
    settingDefault: false,
    setSettingDefault: vi.fn(),
    setDefaultError: vi.fn(),
    bumpRefresh: vi.fn(),
  };
}

// 난이도 매핑 assign 러너(T-1877 합류)의 deps — 진행 플래그 assigning 은 호출부에서 덮는다.
// setOptimistic 은 updater 함수를 받으므로, mock 이 받은 updater 를 test 가 직접 적용해
// 낙관 반영 / 롤백 결과를 관찰한다(렌더러 없이 상태 전이를 확인하는 방식).
function makeAssignDeps() {
  return {
    patch: vi.fn(async () => undefined),
    describeError,
    assigning: false,
    setAssigning: vi.fn(),
    setAssignError: vi.fn(),
    setOptimistic: vi.fn(),
    bumpRefresh: vi.fn(),
  };
}

// setOptimistic 이 받은 updater 들을 순서대로 빈 override 에 적용한 결과 목록.
function appliedOptimistic(
  setOptimistic: ReturnType<typeof vi.fn>,
): Record<string, unknown>[] {
  return setOptimistic.mock.calls.map(([updater]) =>
    (updater as (prev: Record<string, unknown>) => Record<string, unknown>)({}),
  );
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

  describe('runSetDefaultProvider — 직접 import 경로(T-1898 쓰기 축 A)', () => {
    // status 별 한국어 문구 파생 — 컨테이너가 주입하는 toErrorMessage 를 결정적으로 축약 mirror
    // 한 것이라, 어떤 실패 status 든 사람-친화 한국어가 setDefaultError 로 실리는지 관찰할 수 있다.
    const describeStatusError = (e: unknown) => {
      const status = (e as { status?: number }).status;
      if (status === 404) {
        return '해당 provider 를 찾을 수 없습니다.';
      }
      if (status === 403) {
        return '권한이 없습니다.';
      }
      if (status === 500) {
        return '서버 오류가 발생했습니다.';
      }
      return '네트워크 오류가 발생했습니다.';
    };
    // ApiError 를 모듈 밖으로 내보내지 않으므로 status 를 단 Error 로 그 표면만 재현한다.
    const withStatus = (status: number) =>
      Object.assign(new Error(`HTTP ${status}`), { status });

    it('happy-path: PUT 1 회(정적 path + body 단일 키) + 재조회 트리거', async () => {
      const deps = makeSetDefaultDeps();
      await runSetDefaultProvider(PROVIDER_ID, deps);
      expect(deps.update).toHaveBeenCalledTimes(1);
      // 정적 path(:id 세그먼트가 아니라 body 로 대상 지정 — api.md 134 행) + PUT + JSON 헤더 +
      // SetDefaultLlmProviderDto 정본 body 를 한 번에 잠근다.
      expect(deps.update).toHaveBeenCalledWith('/api/llm/providers/default', {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ llmProviderConfigId: PROVIDER_ID }),
      });
      // body 는 파싱해서도 정확히 일치 — 키 1 개(forbidNonWhitelisted 라 extra 키는 400).
      const sent = JSON.parse(
        (deps.update.mock.calls[0] as unknown as [string, { body: string }])[1]
          .body,
      ) as Record<string, unknown>;
      expect(sent).toEqual({ llmProviderConfigId: PROVIDER_ID });
      expect(Object.keys(sent)).toHaveLength(1);
      expect(deps.bumpRefresh).toHaveBeenCalledTimes(1);
      // 직전 error 비움은 발사 전에 1 회 — 성공 경로에서 문구가 실리지 않는다.
      expect(deps.setDefaultError.mock.calls).toEqual([[undefined]]);
      expect(deps.setSettingDefault.mock.calls).toEqual([[true], [false]]);
    });

    it('negative ⑦ / 분기 — 이미 기본인 id 재지정도 성공 경로 그대로다(멱등)', async () => {
      // backend 는 단일 슬롯 upsert 라 같은 id 재지정도 200 이다(api.md 134 행 "멱등").
      // 러너에 "이미 기본" 사전 분기를 두지 않았음을 잠근다 — 호출한 만큼 발사도 재조회도 그대로 이어진다.
      const deps = makeSetDefaultDeps();
      await runSetDefaultProvider(PROVIDER_ID, deps);
      await runSetDefaultProvider(PROVIDER_ID, deps);
      expect(deps.update).toHaveBeenCalledTimes(2);
      expect(deps.bumpRefresh).toHaveBeenCalledTimes(2);
      expect(deps.setDefaultError).not.toHaveBeenCalledWith(
        expect.any(String),
      );
    });

    it('error path: primitive reject 시 throw 없이 문구 표면화 + 진행 플래그 복귀', async () => {
      const deps = makeSetDefaultDeps();
      deps.update = vi.fn(async () => {
        throw BOOM;
      });
      await expect(
        runSetDefaultProvider(PROVIDER_ID, deps),
      ).resolves.toBeUndefined();
      expect(deps.setDefaultError).toHaveBeenLastCalledWith(describeError(BOOM));
      // negative ④ — 실패 시 재조회 트리거는 돌지 않는다(목록·배지 그대로 유지).
      expect(deps.bumpRefresh).not.toHaveBeenCalled();
      // finally 보장 — 실패해도 진행 플래그는 반드시 false 로 복귀한다.
      expect(deps.setSettingDefault.mock.calls).toEqual([[true], [false]]);
    });

    it.each([['', '빈 id'], ['   ', '공백만 든 id']])(
      'negative ② — %s(%s)면 PUT 미발사',
      async (id) => {
        const deps = makeSetDefaultDeps();
        await runSetDefaultProvider(id, deps);
        expect(deps.update).not.toHaveBeenCalled();
        expect(deps.setSettingDefault).not.toHaveBeenCalled();
        expect(deps.setDefaultError).not.toHaveBeenCalled();
        expect(deps.bumpRefresh).not.toHaveBeenCalled();
      },
    );

    it('negative ③ — settingDefault in-flight 중 재호출은 이중 PUT 을 내지 않는다', async () => {
      const deps = { ...makeSetDefaultDeps(), settingDefault: true };
      await runSetDefaultProvider(PROVIDER_ID, deps);
      expect(deps.update).not.toHaveBeenCalled();
      expect(deps.setSettingDefault).not.toHaveBeenCalled();
      expect(deps.setDefaultError).not.toHaveBeenCalled();
    });

    it.each([
      [404, '해당 provider 를 찾을 수 없습니다.', '부재 id'],
      [403, '권한이 없습니다.', 'Admin+ 미만'],
      [500, '서버 오류가 발생했습니다.', '서버 오류'],
    ])(
      'negative ⑧ — %i(%s / %s) reject 는 한국어 문구로 표면화된다',
      async (status, message) => {
        const deps = {
          ...makeSetDefaultDeps(),
          describeError: describeStatusError,
        };
        deps.update = vi.fn(async () => {
          throw withStatus(status as number);
        });
        await expect(
          runSetDefaultProvider(PROVIDER_ID, deps),
        ).resolves.toBeUndefined();
        expect(deps.setDefaultError).toHaveBeenLastCalledWith(message);
        expect(deps.bumpRefresh).not.toHaveBeenCalled();
      },
    );

    it('negative ⑨ — 네트워크 실패(Failed to fetch)도 문구 표면화 + 진행 플래그 clear', async () => {
      const deps = {
        ...makeSetDefaultDeps(),
        describeError: describeStatusError,
      };
      deps.update = vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      });
      await expect(
        runSetDefaultProvider(PROVIDER_ID, deps),
      ).resolves.toBeUndefined();
      expect(deps.setDefaultError).toHaveBeenLastCalledWith(
        '네트워크 오류가 발생했습니다.',
      );
      expect(deps.setSettingDefault).toHaveBeenLastCalledWith(false);
    });
  });

  describe('runAssign — 직접 import 경로(T-1877 합류)', () => {
    it('난이도 매핑 조회 base path 상수를 새 모듈에서 직접 노출한다', () => {
      // negative ⑤ — 경로 drift 방지(상수 정본 값이 backend endpoint 와 어긋나면 즉시 fail).
      expect(LLM_MAPPINGS_PATH).toBe('/api/llm/difficulty-mappings');
    });

    it('happy-path: PATCH 1 회 + 낙관 반영 → 재조회 트리거 · override 비움', async () => {
      const deps = makeAssignDeps();
      await runAssign('medium', PROVIDER_ID, deps);
      expect(deps.patch).toHaveBeenCalledTimes(1);
      expect(deps.patch).toHaveBeenCalledWith(
        `${LLM_MAPPINGS_PATH}/medium`,
        {
          method: 'PATCH',
          headers: JSON_HEADERS,
          body: JSON.stringify({ llmProviderConfigId: PROVIDER_ID }),
        },
      );
      // 발사 전 낙관 반영(해당 슬롯만 새 provider) → 성공 후 override 비움(권위 데이터로 대체).
      expect(appliedOptimistic(deps.setOptimistic)).toEqual([
        { medium: PROVIDER_ID },
        {},
      ]);
      expect(deps.bumpRefresh).toHaveBeenCalledTimes(1);
      expect(deps.setAssigning.mock.calls).toEqual([[true], [false]]);
      expect(deps.setAssignError.mock.calls).toEqual([[undefined]]);
    });

    it('error path: primitive reject 시 throw 없이 문구 표면화 + 낙관 롤백 · 재조회 미발사', async () => {
      const deps = makeAssignDeps();
      deps.patch = vi.fn(async () => {
        throw BOOM;
      });
      await expect(
        runAssign('hard', PROVIDER_ID, deps),
      ).resolves.toBeUndefined();
      expect(deps.setAssignError).toHaveBeenLastCalledWith(describeError(BOOM));
      // 실패 — 낙관 override 롤백(빈 객체) 후 권위 재조회는 돌지 않는다(목록 그대로 유지).
      expect(appliedOptimistic(deps.setOptimistic)).toEqual([
        { hard: PROVIDER_ID },
        {},
      ]);
      expect(deps.bumpRefresh).not.toHaveBeenCalled();
      // negative ④ — 실패해도 finally 로 진행 플래그가 반드시 false 로 복귀한다.
      expect(deps.setAssigning.mock.calls).toEqual([[true], [false]]);
    });

    it('negative ③ — primitive 가 ApiError 아닌 임의 값을 throw 해도 문구 파생이 안전하다', async () => {
      const deps = makeAssignDeps();
      deps.patch = vi.fn(async () => {
        // ApiError 가 아닌 원시 값 throw — describeError 가 String() 파생으로 흡수해야 한다.
        throw 'plain-string-throw';
      });
      await expect(
        runAssign('easy', PROVIDER_ID, deps),
      ).resolves.toBeUndefined();
      expect(deps.setAssignError).toHaveBeenLastCalledWith(
        describeError('plain-string-throw'),
      );
      expect(deps.bumpRefresh).not.toHaveBeenCalled();
      expect(deps.setAssigning.mock.calls).toEqual([[true], [false]]);
    });

    it('분기 ① / negative ① — providerId 가 빈 문자열이면 PATCH 미발사', async () => {
      const deps = makeAssignDeps();
      await runAssign('easy', '', deps);
      expect(deps.patch).not.toHaveBeenCalled();
      // 미발사 경로에서는 진행 플래그조차 건드리지 않는다(state 잡음 0).
      expect(deps.setAssigning).not.toHaveBeenCalled();
      expect(deps.setOptimistic).not.toHaveBeenCalled();
      expect(deps.setAssignError).not.toHaveBeenCalled();
    });

    it('분기 ② / negative ② — assigning in-flight 중 재호출은 이중 PATCH 를 내지 않는다', async () => {
      const deps = { ...makeAssignDeps(), assigning: true };
      await runAssign('easy', PROVIDER_ID, deps);
      expect(deps.patch).not.toHaveBeenCalled();
      expect(deps.setAssigning).not.toHaveBeenCalled();
      expect(deps.setOptimistic).not.toHaveBeenCalled();
      expect(deps.setAssignError).not.toHaveBeenCalled();
    });
  });

  describe('negative ⑦ — AdminView 재수출 identity 보존', () => {
    it('값 심볼 3 개가 새 모듈의 함수와 동일 참조다', () => {
      expect(reexportedRunCreateProvider).toBe(runCreateProvider);
      expect(reexportedRunDeleteProvider).toBe(runDeleteProvider);
      expect(reexportedRunUpdateProvider).toBe(runUpdateProvider);
    });

    it('T-1877 합류분 runAssign 도 새 모듈의 함수와 동일 참조다', () => {
      // 기존 계약 spec(`from './AdminView'`)의 위임 검증이 이동 후에도 유효함의 근거.
      expect(reexportedRunAssign).toBe(runAssign);
    });
  });
});
