import { describe, expect, it } from 'vitest';

// R-112 — T-1879 순수 추출로 신설된 모듈의 **경계 spec**. 여덟 경로 빌더가 AdminView 안에 있었을
// 때는 컨테이너 렌더 계약 spec 이 "무엇이 발사되는가" 로만 간접 검증하던 nonce 분기 · null 가드 ·
// query 조립을, 이동 후에는 모듈 경계에서 직접 고정할 수 있다. 본 파일이 검증하는 것은
// (a) 여덟 심볼이 새 모듈에서 직접 import 되는가, (b) 각 빌더의 happy / error(null idle) / 분기 /
// negative 계약이 무엇인가, (c) 재수출본과 직접 import 본이 **동일 함수 참조** 인가(기존 계약 spec
// 의 AdminView 배럴 위임 검증이 이동 후에도 유효함의 근거, 재선언 · 복제 회귀 차단) 다.
// adminMembershipDerivations.test.ts(T-1876) 선례 동형이며 이동 전에는 존재할 수 없던 검증이라
// 기존 spec 과 중복이 아니다.
import {
  buildGroupsPath,
  buildMappingsPath,
  buildPartPersonsPath,
  buildPartsPath,
  buildPersonsPath,
  buildProvidersPath,
  buildServiceIdentitiesPath,
  buildUsersPath,
} from './adminResourcePathBuilders';
import {
  buildGroupsPath as reexportedBuildGroupsPath,
  buildMappingsPath as reexportedBuildMappingsPath,
  buildPartPersonsPath as reexportedBuildPartPersonsPath,
  buildPartsPath as reexportedBuildPartsPath,
  buildPersonsPath as reexportedBuildPersonsPath,
  buildProvidersPath as reexportedBuildProvidersPath,
  buildServiceIdentitiesPath as reexportedBuildServiceIdentitiesPath,
  buildUsersPath as reexportedBuildUsersPath,
} from './AdminView';

// 여덟 빌더의 base path 기대값 — 상수 자체는 각 mutation runner 모듈이 정본으로 들고 있으므로
// spec 은 그 **관측 가능한 결과값** 으로 계약을 고정한다(상수를 다시 import 하면 같은 값을 두 번
// 읽는 셈이라 오히려 회귀를 못 잡는다).
const MAPPINGS_BASE = '/api/llm/difficulty-mappings';
const PROVIDERS_BASE = '/api/llm/providers';
const PERSONS_BASE = '/api/persons';
const GROUPS_BASE = '/api/groups';
const PARTS_BASE = '/api/parts';
const USERS_BASE = '/api/users';

// nonce 단일 인자 빌더 6 종 — 계약이 글자-동일(nonce ≤ 0 → base, > 0 → `?_r=<nonce>`)하므로
// happy / 분기 / negative 를 표로 돌려 여덟 심볼 중 6 개를 전수 cover 한다.
const NONCE_BUILDERS: ReadonlyArray<
  readonly [string, (nonce: number) => string, string]
> = [
  ['buildMappingsPath', buildMappingsPath, MAPPINGS_BASE],
  ['buildProvidersPath', buildProvidersPath, PROVIDERS_BASE],
  ['buildPersonsPath', buildPersonsPath, PERSONS_BASE],
  ['buildGroupsPath', buildGroupsPath, GROUPS_BASE],
  ['buildPartsPath', buildPartsPath, PARTS_BASE],
  ['buildUsersPath', buildUsersPath, USERS_BASE],
];

// 형제 자원 오발사 방지용 — 각 빌더 결과가 자기 base 외의 다른 자원 base 를 품지 않아야 한다.
const ALL_BASES = [
  MAPPINGS_BASE,
  PROVIDERS_BASE,
  PERSONS_BASE,
  GROUPS_BASE,
  PARTS_BASE,
  USERS_BASE,
];

describe('nonce 단일 인자 경로 빌더 6 종', () => {
  describe.each(NONCE_BUILDERS)('%s', (_name, build, base) => {
    it('happy — nonce 0 이면 query 없는 base path 를 그대로 낸다', () => {
      expect(build(0)).toBe(base);
    });

    it('분기 — nonce 1+ 이면 cache-busting `_r` query 를 붙인다', () => {
      expect(build(1)).toBe(`${base}?_r=1`);
      expect(build(7)).toBe(`${base}?_r=7`);
    });

    it('negative — 음수 nonce 는 base path 로 떨어진다(깨진 query 미발사)', () => {
      expect(build(-1)).toBe(base);
      expect(build(-99)).toBe(base);
    });

    it('negative — nonce 가 바뀌면 path 문자열도 반드시 달라진다(재조회 트리거 계약)', () => {
      expect(build(1)).not.toBe(build(2));
    });

    it('negative — 형제 자원 base 를 섞어 발사하지 않는다', () => {
      const built = build(3);
      for (const other of ALL_BASES) {
        if (other === base || base.startsWith(other) || other.startsWith(base)) {
          continue;
        }
        expect(built).not.toContain(other);
      }
    });
  });
});

describe('buildPersonsPath — nonce × includeInactive 2 축 조립', () => {
  it('happy / 분기 — 4 조합을 전수 고정한다', () => {
    expect(buildPersonsPath(0, false)).toBe(PERSONS_BASE);
    expect(buildPersonsPath(0, true)).toBe(
      `${PERSONS_BASE}?includeInactive=true`,
    );
    expect(buildPersonsPath(2, false)).toBe(`${PERSONS_BASE}?_r=2`);
    expect(buildPersonsPath(2, true)).toBe(
      `${PERSONS_BASE}?_r=2&includeInactive=true`,
    );
  });

  it('분기 — query 구분자는 첫 항목만 `?`, 이후는 `&` 다', () => {
    const both = buildPersonsPath(5, true);
    expect(both.indexOf('?')).toBe(PERSONS_BASE.length);
    expect((both.match(/\?/g) ?? []).length).toBe(1);
    expect((both.match(/&/g) ?? []).length).toBe(1);
    expect(buildPersonsPath(5, false)).not.toContain('&');
  });

  it('negative — includeInactive=false 는 무의미한 query 로 실리지 않는다', () => {
    expect(buildPersonsPath(0, false)).not.toContain('includeInactive');
    expect(buildPersonsPath(3, false)).not.toContain('includeInactive');
  });

  it('negative — 두 번째 인자 생략은 default false 와 글자-동일하다(기존 호출부 회귀 0)', () => {
    expect(buildPersonsPath(0)).toBe(buildPersonsPath(0, false));
    expect(buildPersonsPath(4)).toBe(buildPersonsPath(4, false));
  });

  it('negative — 음수 nonce + includeInactive 조합도 `_r` 을 싣지 않는다', () => {
    expect(buildPersonsPath(-1, true)).toBe(
      `${PERSONS_BASE}?includeInactive=true`,
    );
  });
});

describe('buildPartPersonsPath — 선택 파트 소속 인원 조회 path', () => {
  it('happy — 선택 파트가 있고 nonce 0 이면 query 없는 base path 를 낸다', () => {
    expect(buildPartPersonsPath('part-1')).toBe('/api/parts/part-1/persons');
    expect(buildPartPersonsPath('part-1', 0)).toBe('/api/parts/part-1/persons');
  });

  it('분기 — nonce 1+ 이면 `_r` query 를 붙인다', () => {
    expect(buildPartPersonsPath('part-1', 2)).toBe(
      '/api/parts/part-1/persons?_r=2',
    );
  });

  it('error — 미선택(undefined)이면 null 을 반환해 조건부 조회 idle 을 유발한다', () => {
    expect(buildPartPersonsPath(undefined)).toBeNull();
    expect(buildPartPersonsPath(undefined, 5)).toBeNull();
  });

  it('negative — 빈 문자열도 null 이라 깨진 `/api/parts//persons` 를 발사하지 않는다', () => {
    expect(buildPartPersonsPath('')).toBeNull();
    expect(buildPartPersonsPath('', 3)).toBeNull();
  });

  it('negative — 음수 nonce 는 base path 로 떨어진다', () => {
    expect(buildPartPersonsPath('part-1', -1)).toBe('/api/parts/part-1/persons');
  });

  it('negative — partId 를 encodeURIComponent 로 인코딩해 persons 세그먼트를 침범시키지 않는다', () => {
    const built = buildPartPersonsPath('a/b c');
    expect(built).toBe('/api/parts/a%2Fb%20c/persons');
    expect(built?.split('/').length).toBe(5);
    expect(built?.endsWith('/persons')).toBe(true);
  });

  it('negative — 형제 자원(그룹 · 인원 컬렉션) base 로 새지 않는다', () => {
    const built = buildPartPersonsPath('part-1', 1) ?? '';
    expect(built).not.toContain(GROUPS_BASE);
    expect(built.startsWith(`${PARTS_BASE}/`)).toBe(true);
  });
});

describe('buildServiceIdentitiesPath — 선택 인원 service identity 조회 path', () => {
  it('happy — 선택 인원이 있고 nonce 0 이면 query 없는 base path 를 낸다', () => {
    expect(buildServiceIdentitiesPath('p-1')).toBe(
      '/api/persons/p-1/identities',
    );
    expect(buildServiceIdentitiesPath('p-1', 0)).toBe(
      '/api/persons/p-1/identities',
    );
  });

  it('분기 — nonce 1+ 이면 `_r` query 를 붙인다', () => {
    expect(buildServiceIdentitiesPath('p-1', 3)).toBe(
      '/api/persons/p-1/identities?_r=3',
    );
  });

  it('error — 미선택(undefined)이면 null 을 반환해 조건부 조회 idle 을 유발한다', () => {
    expect(buildServiceIdentitiesPath(undefined)).toBeNull();
    expect(buildServiceIdentitiesPath(undefined, 9)).toBeNull();
  });

  it('negative — 빈 문자열 · 공백뿐인 id 는 null 이라 깨진 조회 path 를 막는다', () => {
    expect(buildServiceIdentitiesPath('')).toBeNull();
    expect(buildServiceIdentitiesPath('   ')).toBeNull();
    expect(buildServiceIdentitiesPath('\t\n')).toBeNull();
  });

  it('negative — 음수 nonce 는 base path 로 떨어진다', () => {
    expect(buildServiceIdentitiesPath('p-1', -2)).toBe(
      '/api/persons/p-1/identities',
    );
  });

  it('negative — id 인코딩은 client 정본(serviceIdentityCollectionPath)에 위임돼 안전하다', () => {
    expect(buildServiceIdentitiesPath('a/b')).toBe(
      '/api/persons/a%2Fb/identities',
    );
  });

  it('negative — 형제 자원(파트 · 사용자) base 로 새지 않는다', () => {
    const built = buildServiceIdentitiesPath('p-1', 1) ?? '';
    expect(built).not.toContain(PARTS_BASE);
    expect(built).not.toContain(USERS_BASE);
  });
});

describe('모듈 경계 — AdminView 배럴 재수출본이 정본과 동일 참조', () => {
  it('여덟 심볼 모두 새 모듈의 함수 그 자체다(재선언 · 복제 회귀 차단)', () => {
    expect(reexportedBuildMappingsPath).toBe(buildMappingsPath);
    expect(reexportedBuildProvidersPath).toBe(buildProvidersPath);
    expect(reexportedBuildPersonsPath).toBe(buildPersonsPath);
    expect(reexportedBuildGroupsPath).toBe(buildGroupsPath);
    expect(reexportedBuildPartsPath).toBe(buildPartsPath);
    expect(reexportedBuildUsersPath).toBe(buildUsersPath);
    expect(reexportedBuildPartPersonsPath).toBe(buildPartPersonsPath);
    expect(reexportedBuildServiceIdentitiesPath).toBe(
      buildServiceIdentitiesPath,
    );
  });
});
