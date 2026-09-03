import { describe, expect, it } from 'vitest';
import type { PersonRow } from '../components/PersonList';

// R-112 — T-1876 순수 추출로 신설된 모듈의 **경계 spec**. 멤버십 파생 helper 5 가 AdminView 안에
// 있었을 때는 컨테이너 렌더 spec 이 간접적으로만 훑던 분기들을, 이동 후에는 모듈 경계에서 직접
// 검증할 수 있다. 본 파일이 검증하는 것은 (a) 값 · 타입 심볼이 새 모듈에서 직접 import 되는가,
// (b) 각 helper 의 happy / error(안전 fallback) / 분기 / negative 계약이 무엇인가,
// (c) 재수출본과 직접 import 본이 **동일 함수 참조** 인가(기존 계약 spec 들의 `from './AdminView'`
// 위임 검증이 이동 후에도 계속 유효함의 근거) 다. 이동 전에는 존재할 수 없던 검증이라 기존 spec 과
// 중복이 아니다(adminMembershipRunners.test.ts · adminUserMutationRunners.test.ts 선례 동형).
import {
  buildGroupMembersPath,
  deriveAddCandidates,
  deriveMembers,
  deriveMembersFromMemberships,
  findGroup,
} from './adminMembershipDerivations';
import type {
  GroupMemberRow,
  GroupRow,
  MembershipRow,
} from './adminMembershipDerivations';
import {
  buildGroupMembersPath as reexportedBuildGroupMembersPath,
  deriveAddCandidates as reexportedDeriveAddCandidates,
  deriveMembers as reexportedDeriveMembers,
  deriveMembersFromMemberships as reexportedDeriveMembersFromMemberships,
  findGroup as reexportedFindGroup,
} from './AdminView';

// 이동한 모듈-private 상수 FALLBACK_MEMBER_NAME 의 기대값 — 상수 자체는 export 되지 않으므로
// (이동 전 AdminView 배럴에도 없던 심볼) spec 은 그 **관측 가능한 결과값** 으로 계약을 고정한다.
const FALLBACK = '이름 미상';

// 표준 그룹 fixture — members 키(우선 후보)로 멤버 2 명을 담는다.
const GROUP: GroupRow = {
  id: 'g-1',
  name: '1팀',
  members: [
    { id: 'p-1', name: '김철수', role: 'Member' },
    { id: 'p-2', fullName: '이영희' },
  ],
};

// 전체 인원 fixture — deriveAddCandidates 의 후보 모집단.
const PERSONS: PersonRow[] = [
  { id: 'p-1', fullName: '김철수', email: 'a@x.com', active: true },
  { id: 'p-2', fullName: '이영희', email: 'b@x.com', active: true },
  { id: 'p-3', fullName: '박민수', email: 'c@x.com', active: false },
];

describe('findGroup', () => {
  // happy — id 가 일치하는 그룹 row 를 그대로(동일 참조) 돌려준다.
  it('id 가 일치하는 그룹을 반환한다', () => {
    const other: GroupRow = { id: 'g-2', name: '2팀' };
    expect(findGroup([other, GROUP], 'g-1')).toBe(GROUP);
  });

  // 분기 1 — groups 가 배열이 아니면(미도착 undefined) undefined.
  it('groups 가 배열이 아니면 undefined 를 반환한다', () => {
    expect(findGroup(undefined, 'g-1')).toBeUndefined();
    expect(findGroup({} as unknown as GroupRow[], 'g-1')).toBeUndefined();
  });

  // 분기 2 + negative (a) — falsy 선택 id(undefined · 빈 문자열)면 탐색하지 않고 undefined.
  it('선택 id 가 falsy 면 undefined 를 반환한다', () => {
    expect(findGroup([GROUP], undefined)).toBeUndefined();
    expect(findGroup([GROUP], '')).toBeUndefined();
  });

  // 분기 3 (error path) — stale 선택(목록에 없는 id)이어도 throw 없이 undefined.
  it('미발견(stale 선택)이면 throw 없이 undefined 를 반환한다', () => {
    expect(() => findGroup([GROUP], 'g-없음')).not.toThrow();
    expect(findGroup([GROUP], 'g-없음')).toBeUndefined();
  });
});

describe('deriveMembers', () => {
  // happy — group.members 를 Member[] 로 매핑한다(id · name · role).
  it('선택 그룹의 members 를 Member[] 로 매핑한다', () => {
    expect(deriveMembers([GROUP], 'g-1')).toEqual([
      { id: 'p-1', name: '김철수', role: 'Member' },
      { id: 'p-2', name: '이영희', role: undefined },
    ]);
  });

  // 분기 1 — 그룹 미발견(stale/미선택)이면 빈 배열.
  it('그룹 미발견이면 빈 배열을 반환한다', () => {
    expect(deriveMembers([GROUP], 'g-없음')).toEqual([]);
    expect(deriveMembers(undefined, 'g-1')).toEqual([]);
  });

  // 분기 2 (error path) — 멤버 배열 후보가 비배열/부재면 throw 없이 빈 배열.
  it('members · persons 가 모두 배열이 아니면 빈 배열을 반환한다', () => {
    const broken = { id: 'g-1', members: 'nope' } as unknown as GroupRow;
    expect(() => deriveMembers([broken], 'g-1')).not.toThrow();
    expect(deriveMembers([broken], 'g-1')).toEqual([]);
    expect(deriveMembers([{ id: 'g-1' }], 'g-1')).toEqual([]);
  });

  // 분기 3 — members 가 있으면 persons 보다 우선한다.
  it('members 키가 persons 보다 우선한다', () => {
    const both: GroupRow = {
      id: 'g-1',
      members: [{ id: 'p-1', name: '우선' }],
      persons: [{ id: 'p-9', name: '무시' }],
    };
    expect(deriveMembers([both], 'g-1')).toEqual([
      { id: 'p-1', name: '우선', role: undefined },
    ]);
  });

  // 분기 4 — members 부재 시 persons 로 fallback 한다.
  it('members 부재 시 persons 로 fallback 한다', () => {
    const only: GroupRow = { id: 'g-1', persons: [{ id: 'p-7', name: '대체' }] };
    expect(deriveMembers([only], 'g-1')).toEqual([
      { id: 'p-7', name: '대체', role: undefined },
    ]);
  });

  // negative (c)(d) — id 누락 row 는 index 기반 합성 key, 이름 누락 · 빈 문자열은 fallback 라벨.
  it('id 누락은 m<n> 합성 key, 이름 누락 · 빈 이름은 fallback 라벨로 안전 매핑한다', () => {
    const messy: GroupRow = {
      id: 'g-1',
      members: [{ name: '이름만' }, {}, { id: 'p-3', name: '' }],
    };
    expect(deriveMembers([messy], 'g-1')).toEqual([
      { id: 'm1', name: '이름만', role: undefined },
      { id: 'm2', name: FALLBACK, role: undefined },
      { id: 'p-3', name: FALLBACK, role: undefined },
    ]);
  });

  // error path 보수 — 부분 손상 row 가 있어도 나머지 row 매핑이 계속된다.
  it('부분 손상 row 가 섞여도 나머지 row 매핑이 계속된다', () => {
    const messy: GroupRow = {
      id: 'g-1',
      members: [{}, { id: 'p-2', name: '정상' }],
    };
    expect(deriveMembers([messy], 'g-1')).toHaveLength(2);
    expect(deriveMembers([messy], 'g-1')[1]).toEqual({
      id: 'p-2',
      name: '정상',
      role: undefined,
    });
  });
});

describe('buildGroupMembersPath', () => {
  // happy + 분기 2 — nonce 기본값(0)이면 query 없는 깨끗한 base path.
  it('선택 그룹이 있고 nonce 가 0 이면 query 없는 base path 를 만든다', () => {
    expect(buildGroupMembersPath('g-1')).toBe('/api/groups/g-1/members');
    expect(buildGroupMembersPath('g-1', 0)).toBe('/api/groups/g-1/members');
  });

  // 분기 3 — nonce 1+ 면 cache-busting query 를 부착한다.
  it('nonce 가 1 이상이면 ?_r=<nonce> 를 부착한다', () => {
    expect(buildGroupMembersPath('g-1', 3)).toBe('/api/groups/g-1/members?_r=3');
  });

  // 분기 1 + negative (a) — 미선택(undefined · 빈 문자열)이면 null(조건부 미조회 유발).
  it('선택 그룹이 falsy 면 null 을 반환한다', () => {
    expect(buildGroupMembersPath(undefined)).toBeNull();
    expect(buildGroupMembersPath('')).toBeNull();
    expect(buildGroupMembersPath('', 5)).toBeNull();
  });

  // negative (b) — 비정상 문자가 든 id 도 encodeURIComponent 로 안전 인코딩된다.
  it('비정상 문자가 든 groupId 를 안전 인코딩한다', () => {
    expect(buildGroupMembersPath('a/b?c d')).toBe(
      '/api/groups/a%2Fb%3Fc%20d/members',
    );
  });

  // negative (f) — 음수 nonce 는 query 없는 base 로 떨어진다(경계값 안전).
  it('음수 nonce 는 query 없는 base 로 떨어진다', () => {
    expect(buildGroupMembersPath('g-1', -1)).toBe('/api/groups/g-1/members');
  });

  // error path — 비정상 타입 nonce 를 넣어도 throw 하지 않는다.
  it('비정상 nonce 를 넣어도 throw 하지 않는다', () => {
    expect(() =>
      buildGroupMembersPath('g-1', undefined as unknown as number),
    ).not.toThrow();
  });
});

describe('deriveMembersFromMemberships', () => {
  const MEMBERSHIPS: MembershipRow[] = [
    { id: 'ms-1', personId: 'p-1', groupId: 'g-1' },
    { id: 'ms-2', personId: 'p-2', groupId: 'g-1' },
  ];

  // happy — Member.id 는 membershipId, 이름은 매칭 person 에서 채운다.
  it('membership id 를 Member.id 로, 매칭 person 이름을 Member.name 으로 매핑한다', () => {
    expect(deriveMembersFromMemberships(MEMBERSHIPS, GROUP)).toEqual([
      { id: 'ms-1', name: '김철수', role: 'Member' },
      { id: 'ms-2', name: '이영희', role: undefined },
    ]);
  });

  // 분기 1 (error path) — memberships 가 배열이 아니면 throw 없이 빈 배열.
  it('memberships 가 배열이 아니면 throw 없이 빈 배열을 반환한다', () => {
    expect(() =>
      deriveMembersFromMemberships(undefined, GROUP),
    ).not.toThrow();
    expect(deriveMembersFromMemberships(undefined, GROUP)).toEqual([]);
    expect(
      deriveMembersFromMemberships(
        {} as unknown as MembershipRow[],
        GROUP,
      ),
    ).toEqual([]);
  });

  // 분기 2 — group 이 undefined 면 person 모집단이 빈 배열이라 전원 fallback 이름.
  it('group 이 undefined 면 전원 fallback 이름으로 매핑한다', () => {
    expect(deriveMembersFromMemberships(MEMBERSHIPS, undefined)).toEqual([
      { id: 'ms-1', name: FALLBACK, role: undefined },
      { id: 'ms-2', name: FALLBACK, role: undefined },
    ]);
  });

  // 분기 3 — personId 매칭 성공 / 실패가 한 배열 안에서 갈린다(persons fallback 키 포함).
  it('personId 매칭 실패 row 만 fallback 이름이 된다', () => {
    const viaPersons: GroupRow = {
      id: 'g-1',
      persons: [{ id: 'p-1', fullName: '김철수' }],
    };
    expect(
      deriveMembersFromMemberships(
        [
          { id: 'ms-1', personId: 'p-1' },
          { id: 'ms-2', personId: 'p-없음' },
        ],
        viaPersons,
      ),
    ).toEqual([
      { id: 'ms-1', name: '김철수', role: undefined },
      { id: 'ms-2', name: FALLBACK, role: undefined },
    ]);
  });

  // negative (a)(c)(d) — 빈 personId 는 매칭 시도조차 안 하고, id 누락은 합성 key,
  // 빈 이름 person 은 fallback 라벨로 대체된다.
  it('빈 personId · id 누락 · 빈 이름 person 을 안전 매핑한다', () => {
    const emptyNamed: GroupRow = {
      id: 'g-1',
      members: [{ id: 'p-1', name: '' } as GroupMemberRow],
    };
    expect(
      deriveMembersFromMemberships(
        [{ personId: '' }, { personId: 'p-1' }],
        emptyNamed,
      ),
    ).toEqual([
      { id: 'm1', name: FALLBACK, role: undefined },
      { id: 'm2', name: FALLBACK, role: undefined },
    ]);
  });

  // error path — group.members 가 비배열이어도 throw 없이 fallback 이름으로 계속 매핑한다.
  it('group.members 가 비배열이어도 throw 없이 매핑을 계속한다', () => {
    const broken = { id: 'g-1', members: 42 } as unknown as GroupRow;
    expect(() =>
      deriveMembersFromMemberships(MEMBERSHIPS, broken),
    ).not.toThrow();
    expect(deriveMembersFromMemberships(MEMBERSHIPS, broken)).toEqual([
      { id: 'ms-1', name: FALLBACK, role: undefined },
      { id: 'ms-2', name: FALLBACK, role: undefined },
    ]);
  });
});

describe('deriveAddCandidates', () => {
  // happy + negative (g) — 이미 멤버인 인원은 후보에서 빠진다(중복 추가 UI 차단).
  it('현재 멤버를 제외한 미소속 인원만 후보로 반환한다', () => {
    expect(
      deriveAddCandidates(PERSONS, [{ id: 'ms-1', personId: 'p-1' }]),
    ).toEqual([
      { id: 'p-2', name: '이영희' },
      { id: 'p-3', name: '박민수' },
    ]);
  });

  // 분기 1 (error path) — personData 가 배열이 아니면 throw 없이 빈 배열.
  it('personData 가 배열이 아니면 throw 없이 빈 배열을 반환한다', () => {
    expect(() => deriveAddCandidates(undefined, [])).not.toThrow();
    expect(deriveAddCandidates(undefined, [])).toEqual([]);
    expect(
      deriveAddCandidates({} as unknown as PersonRow[], []),
    ).toEqual([]);
  });

  // 분기 2 — membershipData 가 배열이 아니면 제외 집합이 비어 전원이 후보가 된다.
  it('membershipData 가 배열이 아니면 전원이 후보가 된다', () => {
    expect(deriveAddCandidates(PERSONS, undefined)).toHaveLength(3);
    expect(
      deriveAddCandidates(PERSONS, 'nope' as unknown as MembershipRow[]),
    ).toHaveLength(3);
  });

  // 분기 3 — 전원이 이미 멤버면 후보가 없다(빈 배열).
  it('전원이 이미 멤버면 후보가 비어 있다', () => {
    expect(
      deriveAddCandidates(PERSONS, [
        { personId: 'p-1' },
        { personId: 'p-2' },
        { personId: 'p-3' },
      ]),
    ).toEqual([]);
  });

  // negative (e) — 빈/비문자열 personId 는 제외 키에서 걸러져 정상 인원이 사라지지 않는다.
  it('빈 · 비문자열 personId 는 제외 키에서 걸러진다', () => {
    const dirty = [
      { personId: '' },
      { personId: 42 },
      { personId: null },
      {},
    ] as unknown as MembershipRow[];
    expect(deriveAddCandidates(PERSONS, dirty)).toHaveLength(3);
  });

  // negative (c)(d) — id 누락은 p<n> 합성 key, fullName 누락 · 빈 문자열은 fallback 라벨.
  it('id 누락은 p<n> 합성 key, 이름 누락 · 빈 이름은 fallback 라벨로 안전 매핑한다', () => {
    const messy = [
      { fullName: '이름만', email: 'a@x.com', active: true },
      { id: 'p-2', email: 'b@x.com', active: true },
      { id: 'p-3', fullName: '', email: 'c@x.com', active: true },
    ] as unknown as PersonRow[];
    expect(deriveAddCandidates(messy, [])).toEqual([
      { id: 'p1', name: '이름만' },
      { id: 'p-2', name: FALLBACK },
      { id: 'p-3', name: FALLBACK },
    ]);
  });
});

describe('AdminView 배럴 재수출', () => {
  // 이동 후에도 기존 계약 spec 의 `from './AdminView'` 가 **사본이 아닌 동일 함수 참조** 를
  // 가리킴을 박제한다(무수정 통과의 근거).
  it('재수출본이 새 모듈의 심볼과 동일 참조다', () => {
    expect(reexportedFindGroup).toBe(findGroup);
    expect(reexportedDeriveMembers).toBe(deriveMembers);
    expect(reexportedBuildGroupMembersPath).toBe(buildGroupMembersPath);
    expect(reexportedDeriveMembersFromMemberships).toBe(
      deriveMembersFromMemberships,
    );
    expect(reexportedDeriveAddCandidates).toBe(deriveAddCandidates);
  });
});
