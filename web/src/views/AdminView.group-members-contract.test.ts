import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildGroupMembersPath } from './AdminView';

// R-112 — 그룹 멤버십 조회(GET /api/groups/:id/members) web↔backend **계약 drift guard**. 직접 mirror
// 선례 part-persons(T-1192) 재적용 — findPersons(/api/parts/:id/persons)에서 findMembers 로 대상 교체.
// path-param `:id` + literal 세그먼트 + 조건부 null(idle) + encodeURIComponent + GET 패턴을 그룹 자원에
// 재적용. **핵심 판별 축**: 같은 소스의 @Get(":id/persons") findPersons(literal persons)와 @Get(":id/members")
// findMembers(literal members)를 추출기가 같은 깊이·다른 literal 로 판별해 web 멤버십 발사(:id/members)를
// findMembers 에 매칭하고 findPersons 와 **혼동하지 않아야** 한다. mutation(@Post/@Delete :id/members) 은 대조군.

function stripComments(source: string): string { // 주석 제거 — 추출이 주석 문구를 잡으면 guard 무력화(negative (f)).
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}
function extractControllerRoute(source: string): string | null {
  const matched = /^[ \t]*@Controller\(\s*['"`]([^'"`]+)['"`]\s*\)/m.exec(stripComments(source));
  return matched ? matched[1] : null;
}
interface HandlerDecorator {
  method: string;
  subPath: string;
  hasBody: boolean;
  hasParam: boolean;
  hasQuery: boolean;
}
// HTTP method + sub-path + @Body/@Param/@Query 존재. 멀티라인 시그니처는 괄호 균형 0 까지 이어붙여 탐지 — findMembers 는 @Param 1.
function extractHandlerMethods(source: string): Record<string, HandlerDecorator> {
  const found: Record<string, HandlerDecorator> = {};
  const lines = stripComments(source).split('\n');
  let pending: { method: string; subPath: string } | null = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const decorator = /^[ \t]*@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:['"`]([^'"`]*)['"`]\s*)?\)/.exec(line);
    if (decorator) {
      pending = { method: decorator[1].toUpperCase(), subPath: decorator[2] ?? '' };
      continue;
    }
    if (/^[ \t]*@/.test(line)) {
      continue; // 그 외 decorator(@HttpCode/@UsePipes/@UseGuards/@Roles)는 handler 로 오인하지 않는다.
    }
    const handler = /^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (handler && pending) {
      let signature = line;
      let depth = (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
      let j = i;
      while (depth > 0 && j + 1 < lines.length) {
        j += 1;
        signature += `\n${lines[j]}`;
        depth += (lines[j].match(/\(/g) ?? []).length - (lines[j].match(/\)/g) ?? []).length;
      }
      found[handler[1]] = {
        method: pending.method,
        subPath: pending.subPath,
        hasBody: /@Body\b/.test(signature),
        hasParam: /@Param\b/.test(signature),
        hasQuery: /@Query\b/.test(signature),
      };
      pending = null;
    }
  }
  return found;
}
// AdminView 멤버십 조회 call site 발사 method 추론. `useApiResource<MembershipRow[]>(groupMembersPath)` 를
// 옵션 인자 없이(단일 인자) 호출 → fetch default GET. 인자 2+ 면 non-GET. 소문자 groupMembersPath anchor.
function extractMembersFireMethod(source: string): string | null {
  const matched = /useApiResource<MembershipRow\[\]>\(\s*(groupMembersPath[^)]*)\)/.exec(stripComments(source));
  if (!matched) {
    return null;
  }
  const args = matched[1].split(',').map((arg) => arg.trim()).filter(Boolean);
  return args.length === 1 ? 'GET' : `NON-GET(args=${args.length})`;
}
interface BackendContract {
  route: string | null;
  method: string | null;
  subPath: string;
  hasBody: boolean;
  hasParam: boolean;
  hasQuery: boolean;
}
interface WebFire {
  path: string;
  method: string;
}
const normalizeRoute = (route: string): string => (route.startsWith('/') ? route : `/${route}`);
function composeRoute(route: string, subPath: string): string {
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${normalizeRoute(route)}/${trimmed}` : normalizeRoute(route);
}
const pathParams = (route: string): string[] => route.split('/').filter((seg) => seg.startsWith(':'));
const stripQuery = (path: string): string => path.split('?')[0]; // `?_r=n` cache-buster 제거 — base 만 대조.
// route template 의 `:id` 를 web 과 동일하게 encodeURIComponent 로 치환한 기대 path(`/`→`%2F` 라 literal `members` 세그먼트를 안 삼킴).
function expectedPath(route: string, subPath: string, id: string): string {
  return composeRoute(route, subPath).replace(':id', encodeURIComponent(id));
}
// 불일치 사유 목록 — 빈 배열=계약 일치. 추출 실패도 사유 1건(선단언 방어). base 경로 + method 만 대조하되 query 는 strip 후 base 만 본다.
function diffContract(fire: WebFire, backend: BackendContract, id: string): string[] {
  if (!backend.route || !backend.method) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (stripQuery(fire.path) !== expectedPath(backend.route, backend.subPath, id)) {
    issues.push(`path 불일치: ${stripQuery(fire.path)}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  return issues;
}
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/group.controller.ts', import.meta.url), 'utf8');
const ADMIN_VIEW_SOURCE = readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const FIND_ALL = HANDLERS.findAll ?? null;
const FIND_BY_ID = HANDLERS.findById ?? null;
const FIND_PERSONS = HANDLERS.findPersons ?? null;
const FIND_MEMBERS = HANDLERS.findMembers ?? null;
const WEB_FIRE_METHOD = extractMembersFireMethod(ADMIN_VIEW_SOURCE);
const MEMBERS_CONTRACT: BackendContract = {
  route: ROUTE,
  method: FIND_MEMBERS?.method ?? null,
  subPath: FIND_MEMBERS?.subPath ?? '',
  hasBody: FIND_MEMBERS?.hasBody ?? false,
  hasParam: FIND_MEMBERS?.hasParam ?? false,
  hasQuery: FIND_MEMBERS?.hasQuery ?? false,
};
const BASE = '/api/groups';
const GROUP_ID = 'g1';
function membersFire(id: string, nonce = 0): WebFire { // 발사 캡처 — 미선택(falsy id)이면 null(idle) → throw(idle 은 별도 테스트).
  const path = buildGroupMembersPath(id, nonce);
  if (path === null) {
    throw new Error(`발사가 없다(idle): id=${JSON.stringify(id)}`);
  }
  return { path, method: WEB_FIRE_METHOD ?? 'GET' };
}

describe('AdminView — 그룹 멤버십 조회 web↔backend 계약 drift guard (T-1194)', () => {
  it('backend route/method 와 web 발사 method 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(MEMBERS_CONTRACT.method).not.toBeNull();
    expect(MEMBERS_CONTRACT.subPath).toBe(':id/members');
    expect(WEB_FIRE_METHOD).not.toBeNull();
  });
  it('backend @Controller("api/groups") 2-세그먼트 base 를 /api/groups 로 정규화한다 (분기 — base 파싱)', () => {
    expect(ROUTE).toBe('api/groups');
    expect(String(ROUTE).split('/')).toHaveLength(2); // api·groups
    expect(normalizeRoute(String(ROUTE))).toBe(BASE);
  });
  it('backend @Get(":id/members") 를 base 와 합성해 base + param + literal 3요소 template 을 만들고 :id 는 세그먼트 3(index 2)·literal members 는 그 뒤(index 3) 위치임을 검증한다 (분기 — base+literal 세그먼트 파싱 + path-param 위치)', () => {
    expect(MEMBERS_CONTRACT.method).toBe('GET');
    expect(MEMBERS_CONTRACT.subPath).toBe(':id/members'); // @Get(":id/members") — 세그먼트 2
    const composed = composeRoute(String(ROUTE), MEMBERS_CONTRACT.subPath);
    expect(composed).toBe(`${BASE}/:id/members`);
    const segments = composed.split('/').filter(Boolean); // api·groups·:id·members
    expect(segments).toHaveLength(4);
    expect(pathParams(composed)).toEqual([':id']); // path param 정확히 1개(:id 슬롯)
    expect(segments[1]).toBe('groups'); // base 세그먼트
    expect(segments[2]).toBe(':id'); // path-param 슬롯이 세그먼트 3번째(index 2)
    expect(segments[3]).toBe('members'); // literal 이 param 뒤(index 3)
    const firedSegments = stripQuery(membersFire(GROUP_ID, 0).path).split('/').filter(Boolean);
    expect(firedSegments[2]).toBe(GROUP_ID);
    expect(firedSegments[3]).toBe('members');
  });
  it('findMembers 핸들러가 @Param("id") 1개를 갖고 @Body·@Query 는 하나도 갖지 않는다 (분기 — 핸들러 인자)', () => {
    expect(FIND_MEMBERS).not.toBeNull();
    expect(MEMBERS_CONTRACT.hasParam).toBe(true); // @Param("id") 존재 — path param 계약
    expect(MEMBERS_CONTRACT.hasBody).toBe(false); // GET 조회 — body 계약 없음
    expect(MEMBERS_CONTRACT.hasQuery).toBe(false); // @Query 미선언 — `_r` 무시 근거
  });
  it('같은 소스의 @Get(":id/persons") findPersons(literal persons)와 @Get(":id/members") findMembers(literal members)를 같은 세그먼트 깊이에서 정확히 판별한다 (분기 — literal 세그먼트 판별, 핵심 축)', () => {
    expect(FIND_PERSONS).not.toBeNull();
    expect(FIND_MEMBERS).not.toBeNull();
    expect(FIND_PERSONS?.method).toBe('GET'); // 둘 다 GET — method 만으로는 구분 불가
    expect(FIND_MEMBERS?.method).toBe('GET');
    expect(FIND_PERSONS?.subPath).toBe(':id/persons'); // 세그먼트 2, literal persons
    expect(FIND_MEMBERS?.subPath).toBe(':id/members'); // 세그먼트 2, literal members
    expect(FIND_PERSONS?.subPath).not.toBe(FIND_MEMBERS?.subPath);
    const personsRoute = composeRoute(String(ROUTE), FIND_PERSONS?.subPath ?? '');
    const membersRoute = composeRoute(String(ROUTE), FIND_MEMBERS?.subPath ?? '');
    expect(personsRoute).toBe(`${BASE}/:id/persons`);
    expect(membersRoute).toBe(`${BASE}/:id/members`);
    expect(personsRoute).not.toBe(membersRoute);
    expect(personsRoute.split('/').filter(Boolean)).toHaveLength(4);
    expect(membersRoute.split('/').filter(Boolean)).toHaveLength(4);
    expect(FIND_ALL?.subPath).toBe('');
    expect(FIND_BY_ID?.subPath).toBe(':id');
    const routes = new Set([
      composeRoute(String(ROUTE), FIND_ALL?.subPath ?? ''),
      composeRoute(String(ROUTE), FIND_BY_ID?.subPath ?? ''),
      personsRoute,
      membersRoute,
    ]);
    expect(routes.size).toBe(4);
  });
  it('buildGroupMembersPath("g1", 0) 발사(GET /api/groups/g1/members)가 backend findMembers 계약과 완전 일치한다 (happy-path — 경로 정합)', () => {
    const fired = membersFire(GROUP_ID, 0);
    expect(buildGroupMembersPath(GROUP_ID, 0)).toBe(`${BASE}/g1/members`);
    expect(fired.path).toBe(`${BASE}/g1/members`);
    expect(diffContract(fired, MEMBERS_CONTRACT, GROUP_ID)).toEqual([]);
  });
  it('web 조회 call site 가 옵션 인자 없이 useApiResource 를 호출해 default GET 이고 backend 도 @Get 이다 (happy-path — method 정합)', () => {
    expect(WEB_FIRE_METHOD).toBe('GET'); // 단일 인자 호출 → fetch default GET
    expect(MEMBERS_CONTRACT.method).toBe('GET'); // backend 는 @Get(POST/PATCH/DELETE 아님)
    expect(membersFire(GROUP_ID, 0).method).toBe(MEMBERS_CONTRACT.method); // 양측 method == GET
  });
  it('buildGroupMembersPath("g1", 4) 은 `?_r=4` cache-buster 를 붙이되 base 는 backend route 와 여전히 일치하고, "a/b" 는 encodeURIComponent 로 인코딩된다 (happy-path — query 무해 + 인코딩)', () => {
    const fired = membersFire(GROUP_ID, 4);
    expect(fired.path).toBe(`${BASE}/g1/members?_r=4`);
    expect(stripQuery(fired.path)).toBe(`${BASE}/g1/members`); // `_r` strip 후 base 동일
    expect(diffContract(fired, MEMBERS_CONTRACT, GROUP_ID)).toEqual([]); // query 는 drift 아님(부수효과 0)
    expect(buildGroupMembersPath('a/b', 0)).toBe(`${BASE}/a%2Fb/members`);
    expect(diffContract(membersFire('a/b', 0), MEMBERS_CONTRACT, 'a/b')).toEqual([]);
  });
  it('buildGroupMembersPath(undefined)/("") 가 null 을 반환해 미선택 시 아예 발사하지 않는다 (분기 — 조건부 null idle 발사, 깨진 /api/groups//members 예방)', () => {
    expect(buildGroupMembersPath(undefined, 0)).toBeNull(); // 미선택 → idle
    expect(buildGroupMembersPath('')).toBeNull(); // 빈 선택 → idle(깨진 /api/groups//members 예방)
    expect(buildGroupMembersPath(undefined, 5)).toBeNull(); // nonce 가 있어도 falsy id 면 idle
    expect(buildGroupMembersPath(GROUP_ID, 0)).toBe(`${BASE}/g1/members`);
    expect(() => membersFire('')).toThrow(/idle/);
  });
  it('buildGroupMembersPath("a b/c") 가 encodeURIComponent 로 안전 인코딩하되 param 값이 literal members 세그먼트를 침범하지 않는다 (분기 — path-param 인코딩)', () => {
    const weirdId = 'a b/c';
    const fired = membersFire(weirdId, 0);
    expect(fired.path).toBe(`${BASE}/a%20b%2Fc/members`); // 공백·/ 가 인코딩돼 세그먼트가 안 깨진다
    expect(fired.path.split('/').filter(Boolean)).toHaveLength(4); // api·groups·<enc>·members — 세그먼트 4 유지
    expect(fired.path.endsWith('/members')).toBe(true); // literal members 세그먼트가 침범당하지 않음
    expect(diffContract(fired, MEMBERS_CONTRACT, weirdId)).toEqual([]); // 인코딩 후에도 route 정합
  });

  // ── Negative cases 충분 cover ──
  it.each<[string, () => BackendContract]>([
    ['(a) backend base 를 api/group(단수 오타)로', () => ({ ...MEMBERS_CONTRACT, route: 'api/group' })],
    ['(a) backend base 를 api/groups-x(접미 drift)로', () => ({ ...MEMBERS_CONTRACT, route: 'api/groups-x' })],
    ['(c) @Get(":id/member")(단수 literal 오타)로', () => ({ ...MEMBERS_CONTRACT, subPath: extractHandlerMethods(['  @Get(":id/member")', '  async findMembers() {}'].join('\n')).findMembers.subPath })],
    ['(c) @Get(":id/persons")(persons literal 혼동)로', () => ({ ...MEMBERS_CONTRACT, subPath: extractHandlerMethods(['  @Get(":id/persons")', '  async findMembers() {}'].join('\n')).findMembers.subPath })],
    ['(d) @Get(":id")(literal 소실 세그먼트 축소)로', () => ({ ...MEMBERS_CONTRACT, subPath: extractHandlerMethods(['  @Get(":id")', '  async findMembers() {}'].join('\n')).findMembers.subPath })],
    ['(d) @Get(":id/members/all")(세그먼트 추가)로', () => ({ ...MEMBERS_CONTRACT, subPath: extractHandlerMethods(['  @Get(":id/members/all")', '  async findMembers() {}'].join('\n')).findMembers.subPath })],
  ])('%s 면 path 불일치로 잡힌다 (negative (a)(c)(d) — path/literal 세그먼트 drift, members vs persons 오인 검출)', (_label, build) => {
    expect(diffContract(membersFire(GROUP_ID, 0), build(), GROUP_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, () => BackendContract]>([
    ['(b) backend 가 @Post 로', () => ({ ...MEMBERS_CONTRACT, method: extractHandlerMethods(['  @Post(":id/members")', '  async findMembers() {}'].join('\n')).findMembers.method })],
    ['(b) backend 가 @Patch 로', () => ({ ...MEMBERS_CONTRACT, method: extractHandlerMethods(['  @Patch(":id/members")', '  async findMembers() {}'].join('\n')).findMembers.method })],
    ['(b) backend 가 @Delete 로', () => ({ ...MEMBERS_CONTRACT, method: extractHandlerMethods(['  @Delete(":id/members")', '  async findMembers() {}'].join('\n')).findMembers.method })],
  ])('%s 바뀌면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 GET 발사)', (_label, build) => {
    expect(diffContract(membersFire(GROUP_ID, 0), build(), GROUP_ID)).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('추출기가 `?_r=n` query 를 path 세그먼트로 착각하지 않되 진짜 세그먼트 drift 는 여전히 잡는다 (negative (d) — query vs 세그먼트 구분)', () => {
    expect(diffContract(membersFire(GROUP_ID, 4), MEMBERS_CONTRACT, GROUP_ID)).toEqual([]);
    const drifted: BackendContract = { ...MEMBERS_CONTRACT, subPath: ':id/persons' };
    expect(diffContract(membersFire(GROUP_ID, 4), drifted, GROUP_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('web 멤버십 발사(:id/members)를 같은 route prefix 의 mutation(@Post(":id/members") addMember / @Delete(":id/members/:membershipId") removeMember)으로 오인하지 않고 findMembers 를 정확히 선택한다 (negative (e) — 형제 mutation 대조군 혼동)', () => {
    expect(FIND_MEMBERS?.subPath).toBe(':id/members'); // findMembers 만 GET :id/members
    expect(HANDLERS.addMember.method).toBe('POST'); // addMember 는 POST — GET 조회로 오인 금지
    expect(HANDLERS.addMember.subPath).toBe(':id/members'); // 같은 route, 다른 method
    expect(HANDLERS.removeMember.method).toBe('DELETE'); // removeMember 는 DELETE
    expect(HANDLERS.removeMember.subPath).toBe(':id/members/:membershipId'); // 세그먼트 추가 + DELETE
    const addContract: BackendContract = { ...MEMBERS_CONTRACT, method: HANDLERS.addMember.method, subPath: HANDLERS.addMember.subPath };
    const removeContract: BackendContract = { ...MEMBERS_CONTRACT, method: HANDLERS.removeMember.method, subPath: HANDLERS.removeMember.subPath };
    expect(diffContract(membersFire(GROUP_ID, 0), addContract, GROUP_ID)).toEqual([expect.stringContaining('method 불일치')]);
    expect(diffContract(membersFire(GROUP_ID, 0), removeContract, GROUP_ID)).toEqual(
      expect.arrayContaining([expect.stringContaining('path 불일치'), expect.stringContaining('method 불일치')]),
    );
  });
  it('주석 줄의 "@Get(":id/members")"/"@Controller(...)"/"GET /api/groups/:id/members" 를 실 decorator 로 오인하지 않는다 (negative (f) — 주석 false-positive)', () => {
    const fakeController = ['  // @Controller("api/groups") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Get(":id/members") — 주석뿐, decorator 없음', '  async findMembers() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).findMembers).toBeUndefined();
    const drifted: BackendContract = { ...MEMBERS_CONTRACT, route: extractControllerRoute(fakeController), method: extractHandlerMethods(fakeHandler).findMembers?.method ?? null };
    expect(diffContract(membersFire(GROUP_ID, 0), drifted, GROUP_ID)).toEqual(['backend 계약 추출 실패']);
  });
  it('buildGroupMembersPath(undefined, 0) === null 을 "계약 일치"로 오판하지 않는다 — null 은 발사 부재(idle)이지 drift 대조 통과가 아니다 (negative (g) — idle 을 통과로 오인 방지)', () => {
    const idle = buildGroupMembersPath(undefined, 0);
    expect(idle).toBeNull(); // 미선택 → idle, 발사 없음
    expect(() => membersFire('')).toThrow(/idle/);
    expect(diffContract(membersFire(GROUP_ID, 0), MEMBERS_CONTRACT, GROUP_ID)).toEqual([]);
  });
  it('web call site 가 옵션 인자를 전달하면(단일 인자 아님) GET 추론이 깨져 method 불일치로 잡힌다 (negative — 발사 override drift)', () => {
    const overridden = extractMembersFireMethod(
      ["const x = useApiResource<MembershipRow[]>(groupMembersPath, { method: 'POST' });"].join('\n'),
    );
    expect(overridden).toBe('NON-GET(args=2)'); // 옵션 인자 존재 → GET 아님
    const fired: WebFire = { path: `${BASE}/g1/members`, method: overridden ?? 'GET' };
    expect(diffContract(fired, MEMBERS_CONTRACT, GROUP_ID)).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('빈 소스 입력이면 추출기가 null·빈 객체를 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractMembersFireMethod('')).toBeNull();
    const empty: BackendContract = { route: extractControllerRoute(''), method: extractHandlerMethods('').findMembers?.method ?? null, subPath: '', hasBody: false, hasParam: false, hasQuery: false };
    expect(diffContract(membersFire(GROUP_ID, 0), empty, GROUP_ID)).toEqual(['backend 계약 추출 실패']);
  });
});
