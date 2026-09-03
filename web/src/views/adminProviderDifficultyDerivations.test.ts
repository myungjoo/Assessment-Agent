import { describe, expect, it } from 'vitest';

// R-112 — T-1880 순수 추출로 신설된 모듈의 **경계 spec**. provider · 난이도 파생 helper 4 가
// AdminView 안에 있었을 때는 컨테이너 렌더 spec 이 간접적으로만 훑던 보수적 fallback 분기들을,
// 이동 후에는 모듈 경계에서 직접 검증할 수 있다. 본 파일이 검증하는 것은 (a) 값 · 타입 심볼이 새
// 모듈에서 직접 import 되는가, (b) 각 helper 의 happy / error(안전 fallback) / 분기 / negative
// 계약이 무엇인가, (c) 재수출본과 직접 import 본이 **동일 함수 참조** 인가(기존 계약 spec 들의
// `from './AdminView'` 위임 검증이 이동 후에도 계속 유효함의 근거) 다. 이동 전에는 존재할 수 없던
// 검증이라 기존 spec 과 중복이 아니다(adminMembershipDerivations.test.ts 선례 동형).
import {
  deriveDifficultyMapping,
  deriveProviderConfigs,
  deriveProviders,
  mergeMapping,
} from './adminProviderDifficultyDerivations';
import type {
  DifficultyMappingRow,
  LlmProviderRow,
} from './adminProviderDifficultyDerivations';
import {
  deriveDifficultyMapping as reexportedDeriveDifficultyMapping,
  deriveProviderConfigs as reexportedDeriveProviderConfigs,
  deriveProviders as reexportedDeriveProviders,
  mergeMapping as reexportedMergeMapping,
} from './AdminView';

// 이동한 모듈-private 상수 DIFFICULTY_KEYS 의 기대값 — 상수 자체는 export 되지 않으므로(이동 전
// AdminView 배럴에도 없던 심볼) spec 은 그 **관측 가능한 결과값**(세 슬롯 골격)으로 계약을 고정한다.
const EMPTY_MAPPING = { easy: null, medium: null, hard: null };

describe('deriveProviders', () => {
  it('id/provider/modelId 를 그대로 ProviderOption 으로 매핑한다', () => {
    const rows: LlmProviderRow[] = [
      { id: 'c-1', provider: 'openai', modelId: 'gpt-4o' },
      { id: 'c-2', provider: 'anthropic', modelId: 'claude' },
    ];

    expect(deriveProviders(rows)).toEqual([
      { id: 'c-1', provider: 'openai', modelId: 'gpt-4o' },
      { id: 'c-2', provider: 'anthropic', modelId: 'claude' },
    ]);
  });

  it('배열이 아닌 입력(undefined/null)에서 throw 없이 빈 배열을 반환한다', () => {
    expect(() => deriveProviders(undefined)).not.toThrow();
    expect(deriveProviders(undefined)).toEqual([]);
    expect(
      deriveProviders(null as unknown as LlmProviderRow[] | undefined),
    ).toEqual([]);
  });

  it('빈 배열 입력에서는 빈 배열을 반환한다(경계값)', () => {
    expect(deriveProviders([])).toEqual([]);
  });

  it('id 가 있으면 그대로 쓰고 누락되면 index 합성 key 로 채운다(양쪽 분기)', () => {
    const rows: LlmProviderRow[] = [
      { provider: 'openai' },
      { id: 'c-9', provider: 'anthropic' },
      { provider: 'google' },
    ];

    expect(deriveProviders(rows).map((option) => option.id)).toEqual([
      'p1',
      'c-9',
      'p3',
    ]);
  });

  it('provider/modelId 누락 row 를 undefined 가 아닌 빈 문자열로 채운다(negative)', () => {
    const [option] = deriveProviders([{ id: 'c-1' }]);

    expect(option).toEqual({ id: 'c-1', provider: '', modelId: '' });
    expect(option.provider).not.toBeUndefined();
    expect(option.modelId).not.toBeUndefined();
  });
});

describe('deriveProviderConfigs', () => {
  it('sanitized view 4 필드를 그대로 매핑한다', () => {
    const rows: LlmProviderRow[] = [
      {
        id: 'c-1',
        provider: 'openai',
        modelId: 'gpt-4o',
        endpointUrl: 'https://api.example.com',
      },
    ];

    expect(deriveProviderConfigs(rows)).toEqual([
      {
        id: 'c-1',
        provider: 'openai',
        modelId: 'gpt-4o',
        endpointUrl: 'https://api.example.com',
      },
    ]);
  });

  it('배열이 아닌 입력(undefined/null)에서 throw 없이 빈 배열을 반환한다', () => {
    expect(() => deriveProviderConfigs(undefined)).not.toThrow();
    expect(deriveProviderConfigs(undefined)).toEqual([]);
    expect(
      deriveProviderConfigs(null as unknown as LlmProviderRow[] | undefined),
    ).toEqual([]);
  });

  it('id 가 있으면 그대로 쓰고 누락되면 index 합성 key 로 채운다(양쪽 분기)', () => {
    const rows: LlmProviderRow[] = [{ provider: 'openai' }, { id: 'c-7' }];

    expect(deriveProviderConfigs(rows).map((config) => config.id)).toEqual([
      'p1',
      'c-7',
    ]);
  });

  it('modelId/endpointUrl 이 falsy 면 키 자체를 생략한다(선택 필드 계약, negative)', () => {
    const [config] = deriveProviderConfigs([
      { id: 'c-1', provider: 'openai', modelId: '', endpointUrl: '' },
    ]);

    expect('modelId' in config).toBe(false);
    expect('endpointUrl' in config).toBe(false);
    expect(config).toEqual({ id: 'c-1', provider: 'openai' });
  });

  it('modelId/endpointUrl 이 truthy 면 각각 키로 실린다(반대 분기)', () => {
    const [onlyModel] = deriveProviderConfigs([
      { id: 'c-1', provider: 'openai', modelId: 'gpt-4o' },
    ]);
    const [onlyEndpoint] = deriveProviderConfigs([
      { id: 'c-2', provider: 'openai', endpointUrl: 'https://api.example.com' },
    ]);

    expect('modelId' in onlyModel).toBe(true);
    expect('endpointUrl' in onlyModel).toBe(false);
    expect('endpointUrl' in onlyEndpoint).toBe(true);
    expect('modelId' in onlyEndpoint).toBe(false);
  });

  it('provider 누락 row 를 빈 문자열로 채운다(negative)', () => {
    expect(deriveProviderConfigs([{ id: 'c-1' }])).toEqual([
      { id: 'c-1', provider: '' },
    ]);
  });

  it('입력 row 에 secret apiKey 가 있어도 결과에 실리지 않는다(sanitized view, negative)', () => {
    const rows = [
      { id: 'c-1', provider: 'openai', apiKey: 'sk-super-secret' },
    ] as unknown as LlmProviderRow[];

    const [config] = deriveProviderConfigs(rows);

    expect('apiKey' in config).toBe(false);
    expect(JSON.stringify(config)).not.toContain('sk-super-secret');
  });
});

describe('deriveDifficultyMapping', () => {
  it('세 슬롯을 응답값으로 채운다', () => {
    const rows: DifficultyMappingRow[] = [
      { difficulty: 'easy', llmProviderConfigId: 'c-1' },
      { difficulty: 'medium', llmProviderConfigId: 'c-2' },
      { difficulty: 'hard', llmProviderConfigId: 'c-3' },
    ];

    expect(deriveDifficultyMapping(rows)).toEqual({
      easy: 'c-1',
      medium: 'c-2',
      hard: 'c-3',
    });
  });

  it('배열이 아닌 입력에서 throw 없이 세 슬롯 null 기본 매핑을 반환한다', () => {
    expect(() => deriveDifficultyMapping(undefined)).not.toThrow();
    expect(deriveDifficultyMapping(undefined)).toEqual(EMPTY_MAPPING);
    expect(
      deriveDifficultyMapping(
        null as unknown as DifficultyMappingRow[] | undefined,
      ),
    ).toEqual(EMPTY_MAPPING);
  });

  it('빈 배열 입력에서도 세 슬롯 null 기본 매핑을 반환한다(경계값)', () => {
    expect(deriveDifficultyMapping([])).toEqual(EMPTY_MAPPING);
  });

  it('일부 슬롯만 응답에 있으면 나머지 슬롯은 null 로 남는다(분기)', () => {
    expect(
      deriveDifficultyMapping([
        { difficulty: 'medium', llmProviderConfigId: 'c-2' },
      ]),
    ).toEqual({ easy: null, medium: 'c-2', hard: null });
  });

  it('미지의 난이도 키는 결과 매핑에 키로도 등장하지 않는다(negative)', () => {
    const mapping = deriveDifficultyMapping([
      { difficulty: 'expert', llmProviderConfigId: 'c-9' },
      { difficulty: 'easy', llmProviderConfigId: 'c-1' },
    ]);

    expect('expert' in mapping).toBe(false);
    expect(Object.keys(mapping).sort()).toEqual(['easy', 'hard', 'medium']);
    expect(mapping.easy).toBe('c-1');
  });

  it('difficulty 키 자체가 없는 row 는 무시한다(negative)', () => {
    expect(deriveDifficultyMapping([{ llmProviderConfigId: 'c-1' }])).toEqual(
      EMPTY_MAPPING,
    );
  });

  it('llmProviderConfigId 가 빈 문자열/null 이면 null 로 보정한다(negative)', () => {
    expect(
      deriveDifficultyMapping([
        { difficulty: 'easy', llmProviderConfigId: '' },
        { difficulty: 'medium', llmProviderConfigId: null },
        { difficulty: 'hard' },
      ]),
    ).toEqual(EMPTY_MAPPING);
  });
});

describe('mergeMapping', () => {
  it('override 슬롯이 base 를 덮는다', () => {
    expect(
      mergeMapping(
        { easy: 'c-1', medium: 'c-2', hard: 'c-3' },
        { medium: 'c-9' },
      ),
    ).toEqual({ easy: 'c-1', medium: 'c-9', hard: 'c-3' });
  });

  it('override 슬롯이 undefined 면 base 를 유지한다(부분 override 분기)', () => {
    expect(
      mergeMapping(
        { easy: 'c-1', medium: 'c-2', hard: 'c-3' },
        { medium: undefined, hard: null },
      ),
    ).toEqual({ easy: 'c-1', medium: 'c-2', hard: null });
  });

  it('override 가 비면 base 와 값은 같되 참조는 다른 객체를 반환한다(negative)', () => {
    const base = { easy: 'c-1', medium: null, hard: 'c-3' };

    const merged = mergeMapping(base, {});

    expect(merged).toEqual(base);
    expect(merged).not.toBe(base);
  });

  it('base 객체를 mutate 하지 않는다(negative)', () => {
    const base = { easy: 'c-1', medium: 'c-2', hard: 'c-3' };

    mergeMapping(base, { easy: 'c-9', medium: null });

    expect(base).toEqual({ easy: 'c-1', medium: 'c-2', hard: 'c-3' });
  });
});

describe('모듈 경계 정본', () => {
  it('AdminView 배럴 재수출본과 새 모듈 직접 import 본이 동일 참조다', () => {
    expect(reexportedDeriveProviders).toBe(deriveProviders);
    expect(reexportedDeriveProviderConfigs).toBe(deriveProviderConfigs);
    expect(reexportedDeriveDifficultyMapping).toBe(deriveDifficultyMapping);
    expect(reexportedMergeMapping).toBe(mergeMapping);
  });
});
