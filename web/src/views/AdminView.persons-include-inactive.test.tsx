import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1804 "휴직 인원 포함 토글" 축 전용 spec. 검증 대상은 (1) 순수 빌더
// buildPersonsPath 의 4 분기(nonce 0/양수 × includeInactive false/true)와 query 구분자 조립,
// (2) 컨테이너가 그 값을 소유해 personsPath = useApiResource 조회 path 로 실제 발사하는 배선,
// (3) 인원 관리 섹션에 접근 가능한 이름을 가진 controlled checkbox 가 렌더되는지,
// (4) 배선을 되돌리는 mutation 을 잡는 소스 guard(useMemo 인자·의존성). 새 dependency 0.
//
// 렌더 검증은 renderToStaticMarkup + initial* 주입 affordance 로 한다(@testing-library 미도입 —
// web devDependencies 그대로). 토글 ON 상태는 initialPersonsIncludeInactive 주입이 재현한다.

import type { ApiResourceState } from '../api/useApiResource';

const useApiResourceMock = vi.fn();
vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: (e: unknown) => String(e),
}));

import AdminView, { buildPersonsPath } from './AdminView';

const BASE = '/api/persons';
const LABEL = '휴직 인원 포함';
const SOURCE = readFileSync(
  new URL('./AdminView.tsx', import.meta.url),
  'utf-8',
);
const EMPTY_OK: ApiResourceState<unknown> = {
  data: [],
  loading: false,
  error: undefined,
};

// AdminView 를 정적 렌더하고 (a) useApiResource 로 발사된 전체 path 목록과 (b) markup 을 돌려준다.
// personsFailed=true 면 인원 조회만 error 상태로 주입해 실패 분기를 재현한다(그 외 path 는 빈 성공).
function renderAdmin(
  options: { includeInactive?: boolean; personsFailed?: boolean } = {},
) {
  const paths: string[] = [];
  useApiResourceMock.mockImplementation((path: string | null) => {
    if (typeof path === 'string') {
      paths.push(path);
    }
    if (
      options.personsFailed === true &&
      typeof path === 'string' &&
      path.startsWith(BASE)
    ) {
      return { data: undefined, loading: false, error: '조회 실패(500)' };
    }
    return EMPTY_OK;
  });
  const html = renderToStaticMarkup(
    <AdminView initialPersonsIncludeInactive={options.includeInactive} />,
  );
  return { paths, html, personsPaths: paths.filter((p) => p.startsWith(BASE)) };
}

describe('buildPersonsPath — includeInactive 인자 (T-1804 순수 빌더)', () => {
  // 분기 4종 — nonce 0/양수 × includeInactive false/true. `_r` 과 동시에 실릴 때 구분자가
  // `?`(첫 항목) / `&`(둘째 항목)로 정확히 조립돼야 한다.
  it.each<[number, boolean, string]>([
    [0, false, BASE],
    [5, false, `${BASE}?_r=5`],
    [0, true, `${BASE}?includeInactive=true`],
    [5, true, `${BASE}?_r=5&includeInactive=true`],
  ])(
    'buildPersonsPath(%s, %s) === %s (분기 — 4 조합 · query 구분자 조립)',
    (nonce, includeInactive, expected) => {
      expect(buildPersonsPath(nonce, includeInactive)).toBe(expected);
    },
  );

  // negative (d) — 두 번째 인자를 생략한 기존 호출부(default 인자)는 종전 path 를 그대로 낸다.
  // 이것이 AdminView.persons-list-contract.test.ts 의 기존 단언(회귀 0) 기준선이다.
  it('두 번째 인자를 생략하면 종전 path 를 그대로 낸다 (negative (d) — default 인자 회귀 0)', () => {
    expect(buildPersonsPath(0)).toBe(BASE);
    expect(buildPersonsPath(5)).toBe(`${BASE}?_r=5`);
    expect(buildPersonsPath(0)).toBe(buildPersonsPath(0, false));
    expect(buildPersonsPath(5)).toBe(buildPersonsPath(5, false));
  });

  // negative (a)(c) — OFF 는 `includeInactive` 문자열 자체를 만들지 않는다. backend 는
  // `=== "true"` 만 보므로 `includeInactive=false` 같은 거짓 값 query 는 무의미하며 금지다.
  it.each<[number]>([[0], [5]])(
    'nonce %s 에서 토글 OFF 면 path 에 includeInactive 문자열이 등장하지 않는다 (negative (a)(c) — 무의미 query 금지)',
    (nonce) => {
      const path = buildPersonsPath(nonce, false);
      expect(path).not.toContain('includeInactive');
      expect(path).not.toContain('includeInactive=false');
    },
  );

  // negative (b) — ON 이었다가 다시 OFF 로 되돌리면 query 가 제거된다(빌더는 순수 — 잔류 0).
  it('ON 이후 다시 OFF 로 되돌리면 query 가 제거된다 (negative (b) — 잔류 상태 0)', () => {
    expect(buildPersonsPath(0, true)).toBe(`${BASE}?includeInactive=true`);
    expect(buildPersonsPath(0, false)).toBe(BASE);
    expect(buildPersonsPath(3, true)).toBe(`${BASE}?_r=3&includeInactive=true`);
    expect(buildPersonsPath(3, false)).toBe(`${BASE}?_r=3`);
  });

  // negative — 경계값/비정상 nonce(음수·0)는 종전대로 `_r` 을 만들지 않으며, 토글 값만 반영된다.
  it('nonce 가 음수여도 `_r` 을 만들지 않고 토글 값만 반영한다 (negative — 경계값)', () => {
    expect(buildPersonsPath(-1, false)).toBe(BASE);
    expect(buildPersonsPath(-1, true)).toBe(`${BASE}?includeInactive=true`);
  });
});

describe('AdminView — 휴직 인원 포함 토글 배선 (T-1804)', () => {
  beforeEach(() => {
    useApiResourceMock.mockReset();
  });

  // happy-path — 토글 OFF 기본 상태(주입 없음)는 종전과 동일하게 bare base 를 조회한다.
  it('기본 상태에서는 /api/persons 를 그대로 조회한다 (happy-path — 회귀 0)', () => {
    const { personsPaths } = renderAdmin();
    expect(personsPaths).toContain(BASE);
    expect(personsPaths.some((p) => p.includes('includeInactive'))).toBe(false);
  });

  // happy-path — 토글 ON 이면 같은 조회가 `includeInactive=true` 실린 path 로 재조회된다.
  // (배선을 지우면 이 test 가 fail 한다 — 비-공허성 1/2.)
  it('토글 ON 이면 includeInactive=true 가 실린 path 로 조회한다 (happy-path — 재조회 트리거)', () => {
    const { personsPaths } = renderAdmin({ includeInactive: true });
    expect(personsPaths).toContain(`${BASE}?includeInactive=true`);
    expect(personsPaths).not.toContain(BASE);
  });

  // negative (b) — ON 으로 렌더한 뒤 OFF 로 다시 렌더하면 query 가 사라진다(되돌림 경로).
  it('ON → OFF 로 되돌리면 조회 path 에서 query 가 제거된다 (negative (b) — 되돌림)', () => {
    expect(renderAdmin({ includeInactive: true }).personsPaths).toContain(
      `${BASE}?includeInactive=true`,
    );
    const off = renderAdmin({ includeInactive: false }).personsPaths;
    expect(off).toContain(BASE);
    expect(off.some((p) => p.includes('includeInactive'))).toBe(false);
  });

  // happy-path — 인원 관리 섹션에 접근 가능한 이름을 가진 controlled checkbox 가 렌더된다.
  it.each<[string, boolean]>([
    ['OFF', false],
    ['ON', true],
  ])(
    '토글 %s 상태에서 접근 가능한 이름을 가진 checkbox 가 렌더되고 checked 가 %s 다 (분기 — controlled 표면)',
    (_label, includeInactive) => {
      const { html } = renderAdmin({ includeInactive });
      expect(html).toContain(`aria-label="${LABEL}"`);
      expect(html).toContain('type="checkbox"');
      expect(html).toContain(LABEL); // 시각 label 문구도 함께 렌더(보조기술/눈 동일 문구)
      // controlled 값이 markup 에 반영된다 — ON 일 때만 checked 속성이 실린다.
      const checkbox = /<input[^>]*type="checkbox"[^>]*>/.exec(html)?.[0] ?? '';
      expect(checkbox).not.toBe('');
      expect(checkbox.includes('checked')).toBe(includeInactive);
    },
  );

  // error path — 인원 조회가 실패한 상태에서도 throw 없이 토글이 렌더된다(목록은 `?? []` 유지).
  it.each<[string, boolean]>([
    ['OFF', false],
    ['ON', true],
  ])(
    '인원 조회 실패 + 토글 %s 여도 throw 없이 토글이 렌더된다 (error path — 안전 렌더)',
    (_label, includeInactive) => {
      const run = () =>
        renderAdmin({ includeInactive, personsFailed: true }).html;
      expect(run).not.toThrow();
      expect(run()).toContain(`aria-label="${LABEL}"`);
    },
  );
});

describe('AdminView 소스 guard — personsPath 배선 (T-1804 비-공허성)', () => {
  // 배선을 되돌리는 mutation(토글 값을 빌더/의존성에서 빼는 변경)을 소스로 잠근다
  // — 비-공허성 2/2. renderToStaticMarkup 은 state 전이를 재현하지 않으므로 소스로 보강한다.
  it('personsPath useMemo 가 토글 값을 빌더 인자와 의존성 배열에 모두 싣는다', () => {
    const memo = /const personsPath = useMemo\(([\s\S]*?)\);\n/.exec(SOURCE);
    expect(memo).not.toBeNull();
    const body = memo?.[1] ?? '';
    expect(body).toContain(
      'buildPersonsPath(personsRefreshNonce, personsIncludeInactive)',
    );
    expect(body).toContain('[personsRefreshNonce, personsIncludeInactive]');
  });

  // checkbox 가 컨테이너 상태를 controlled 로 읽고 쓰는지(값 소유 축)를 잠근다.
  it('checkbox 가 컨테이너 상태를 controlled 로 읽고 setter 로 갱신한다', () => {
    expect(SOURCE).toContain('checked={personsIncludeInactive}');
    expect(SOURCE).toContain('setPersonsIncludeInactive(event.target.checked)');
  });
});
