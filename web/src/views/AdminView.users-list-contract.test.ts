import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildUsersPath } from './AdminView';

// R-112 — 사용자 목록 조회(GET /api/users) web↔backend **계약 drift guard**.
// 형제 GET-list slice groups-list(T-1193) mirror — 발사 대상을 groups → users 로 바꾸고
// GET 패턴(GET method · bare @Get() 세그먼트 0 · 핸들러 인자 0 · `?_r=nonce` cache-buster 무해)을
// 재적용. **판별 축(2-way)**: user controller 는 같은 소스에 두 GET 핸들러 — @Get() list(목록,
// 세그먼트 0, bare base — web 목록 발사 대상)·@Get(":id") detail(단건, 세그먼트 1) — 를 가진다.
// 추출기가 web 목록 발사(bare base)에 대응하는 @Get() list 를 detail(세그먼트 1)과 혼동하지 않고
// 정확히 판별해야 한다(세그먼트 0 GET vs 세그먼트 1 GET). 추가로 같은 소스의 @Patch(":id/role")
// changeRole(세그먼트 2 mutation)·@Post() signup(bare base, 다른 method)은 method drift 대조군.
// 정규식 추출기만 — 새 devDependency 0, 공용 helper 추출은 Out of Scope refactor slice.

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
// HTTP method + sub-path + 시그니처의 @Body/@Param/@Query 존재. 멀티라인 시그니처는 handler 줄부터
// 괄호 균형 0 까지 이어붙여 인자 decorator 를 탐지. GET list 는 인자 0, detail/changeRole 은 @Param 1 이 정답.
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
// AdminView 조회 call site 의 발사 method 추론. `useApiResource<UserRow[]>(usersPath)` 를
// 옵션 인자 없이(단일 인자) 호출 → request→fetch default GET. 인자 2+ (options 전달) 면 non-GET 가능.
// 상수 USERS_PATH 나 주석 속 useApiResource<UserRow[]>(USERS_PATH) 와 섞이지 않도록 소문자
// usersPath 변수(useMemo 결과)를 명시 anchor.
function extractUsersFireMethod(source: string): string | null {
  const matched = /useApiResource<UserRow\[\]>\(\s*(usersPath[^)]*)\)/.exec(stripComments(source));
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
// 불일치 사유 목록 — 빈 배열=계약 일치. 추출 실패도 통과가 아니라 사유 1건(선단언 방어). GET 조회는 body/param
// 계약이 없으므로 base 경로 + method 만 대조하되, query 는 strip 후 base 만 본다(진짜 세그먼트는 그대로 잡힘).
function diffContract(fire: WebFire, backend: BackendContract): string[] {
  if (!backend.route || !backend.method) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (stripQuery(fire.path) !== composeRoute(backend.route, backend.subPath)) {
    issues.push(`path 불일치: ${stripQuery(fire.path)}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  return issues;
}
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/user.controller.ts', import.meta.url), 'utf8');
const ADMIN_VIEW_SOURCE = readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const LIST = HANDLERS.list ?? null;
const DETAIL = HANDLERS.detail ?? null;
const CHANGE_ROLE = HANDLERS.changeRole ?? null;
const SIGNUP = HANDLERS.signup ?? null;
const WEB_FIRE_METHOD = extractUsersFireMethod(ADMIN_VIEW_SOURCE);
const LIST_CONTRACT: BackendContract = {
  route: ROUTE,
  method: LIST?.method ?? null,
  subPath: LIST?.subPath ?? '',
  hasBody: LIST?.hasBody ?? false,
  hasParam: LIST?.hasParam ?? false,
  hasQuery: LIST?.hasQuery ?? false,
};
const BASE = '/api/users';
// nonce ≤ 0 은 base 그대로, nonce > 0 은 `?_r=n` cache-buster query. 조회 발사 method 는 call site 추론값(GET).
const usersFire = (nonce: number): WebFire => ({ path: buildUsersPath(nonce), method: WEB_FIRE_METHOD ?? 'GET' });

describe('AdminView — 사용자 목록 조회 web↔backend 계약 drift guard (T-1195)', () => {
  it('backend route/method 와 web 발사 method 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(LIST_CONTRACT.method).not.toBeNull();
    expect(WEB_FIRE_METHOD).not.toBeNull();
  });
  it('backend @Controller("api/users") 2-세그먼트 base 를 /api/users 로 정규화한다 (분기 — base 파싱)', () => {
    expect(ROUTE).toBe('api/users');
    expect(String(ROUTE).split('/')).toHaveLength(2); // api·users
    expect(normalizeRoute(String(ROUTE))).toBe(BASE);
  });
  it('backend bare @Get()(세그먼트 0)를 base 와 합성해 path param 0개 template 을 만든다 (분기 — bare @Get 세그먼트 0 합성)', () => {
    expect(LIST_CONTRACT.method).toBe('GET');
    expect(LIST_CONTRACT.subPath).toBe(''); // @Get() bare — 추가 세그먼트 0
    const composed = composeRoute(String(ROUTE), LIST_CONTRACT.subPath);
    expect(composed).toBe(BASE);
    expect(composed.split('/').filter(Boolean)).toHaveLength(2); // 세그먼트 정확히 2개(추가 0)
    expect(pathParams(composed)).toEqual([]); // path param 정확히 0개
  });
  it('list 핸들러가 @Body·@Param·@Query 를 하나도 갖지 않는다 (분기 — 핸들러 인자 부재)', () => {
    expect(LIST).not.toBeNull();
    expect(LIST_CONTRACT.hasBody).toBe(false); // GET 조회 — body 계약 없음
    expect(LIST_CONTRACT.hasParam).toBe(false); // path/query param 없음
    expect(LIST_CONTRACT.hasQuery).toBe(false); // @Query 미선언 — `_r` 무시 근거
  });
  it('같은 소스의 @Get(":id") detail(세그먼트 1)를 @Get() list(세그먼트 0)와 2-way 로 정확히 판별한다 (분기 — 2-way GET 판별, 핵심 축)', () => {
    expect(DETAIL).not.toBeNull();
    expect(DETAIL?.method).toBe('GET'); // detail 도 GET — method 만으로는 구분 불가
    expect(DETAIL?.subPath).toBe(':id'); // 세그먼트 1
    expect(DETAIL?.hasParam).toBe(true); // @Param("id") 존재
    // 두 GET 이 서로 다른 route 로 정확히 추출 — 병합/오축소 금지.
    expect(composeRoute(String(ROUTE), LIST?.subPath ?? '')).toBe(BASE);
    expect(composeRoute(String(ROUTE), DETAIL?.subPath ?? '')).toBe(`${BASE}/:id`);
    // 둘이 서로 다른 route(pairwise 상이).
    const routes = new Set([
      composeRoute(String(ROUTE), LIST?.subPath ?? ''),
      composeRoute(String(ROUTE), DETAIL?.subPath ?? ''),
    ]);
    expect(routes.size).toBe(2);
  });
  it('buildUsersPath(0) 발사(GET /api/users)가 backend list 계약과 완전 일치한다 (happy-path — 경로 정합)', () => {
    const fired = usersFire(0);
    expect(buildUsersPath(0)).toBe(BASE);
    expect(fired.path).toBe(BASE);
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([]);
  });
  it('web 조회 call site 가 옵션 인자 없이 useApiResource 를 호출해 default GET 이고 backend 도 @Get 이다 (happy-path — method 정합)', () => {
    expect(WEB_FIRE_METHOD).toBe('GET'); // 단일 인자 호출 → fetch default GET
    expect(LIST_CONTRACT.method).toBe('GET'); // backend 는 @Get(POST/PATCH/DELETE 아님)
    expect(usersFire(0).method).toBe(LIST_CONTRACT.method); // 양측 method == GET
  });
  it('buildUsersPath(7) 은 `?_r=7` cache-buster 를 붙이되 base 는 backend route 와 여전히 일치한다 (happy-path — query 무해)', () => {
    const fired = usersFire(7);
    expect(fired.path).toBe(`${BASE}?_r=7`);
    expect(stripQuery(fired.path)).toBe(BASE); // `_r` strip 후 base 동일
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([]); // query 는 drift 아님(부수효과 0)
  });
  it.each<[string, () => BackendContract]>([
    ['(a) backend base 를 api/user(단수 오타)로', () => ({ ...LIST_CONTRACT, route: 'api/user' })],
    ['(a) backend base 를 api/users-x(접미 drift)로', () => ({ ...LIST_CONTRACT, route: 'api/users-x' })],
    ['(c) @Get(":id")(세그먼트 1)로', () => ({ ...LIST_CONTRACT, subPath: extractHandlerMethods(['  @Get(":id")', '  async list() {}'].join('\n')).list.subPath })],
    ['(c) @Get("all")(literal 세그먼트 추가)로', () => ({ ...LIST_CONTRACT, subPath: extractHandlerMethods(['  @Get("all")', '  async list() {}'].join('\n')).list.subPath })],
  ])('%s 면 path 불일치로 잡힌다 (negative (a)(c) — path drift, 404 예방)', (_label, build) => {
    expect(diffContract(usersFire(0), build())).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, () => BackendContract]>([
    ['(b) backend 가 @Post 로', () => ({ ...LIST_CONTRACT, method: extractHandlerMethods(['  @Post()', '  async list() {}'].join('\n')).list.method })],
    ['(b) backend 가 @Patch 로', () => ({ ...LIST_CONTRACT, method: extractHandlerMethods(['  @Patch()', '  async list() {}'].join('\n')).list.method })],
    ['(b) backend 가 @Delete 로', () => ({ ...LIST_CONTRACT, method: extractHandlerMethods(['  @Delete()', '  async list() {}'].join('\n')).list.method })],
  ])('%s 바뀌면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 GET 발사)', (_label, build) => {
    expect(diffContract(usersFire(0), build())).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('추출기가 `?_r=n` query 를 path 세그먼트로 착각하지 않되 진짜 추가 세그먼트는 여전히 잡는다 (negative (c) — query vs 세그먼트 구분)', () => {
    // nonce>0 의 query 는 무해(base 일치) — strip 후 통과.
    expect(diffContract(usersFire(7), LIST_CONTRACT)).toEqual([]);
    // 진짜 추가 세그먼트(@Get(":id"))는 query strip 후에도 path 불일치로 잡힘 — query 와 세그먼트를 구분.
    const withSegment: BackendContract = { ...LIST_CONTRACT, subPath: ':id' };
    expect(diffContract(usersFire(7), withSegment)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('@Patch(":id/role") changeRole(세그먼트 2 mutation)를 GET 목록 핸들러로 오인하지 않는다 — method·세그먼트 이중 불일치 (negative (d) — :id/role mutation 대조군 혼동)', () => {
    expect(CHANGE_ROLE).not.toBeNull();
    expect(CHANGE_ROLE?.method).toBe('PATCH'); // changeRole 은 PATCH — GET 조회로 오인 금지
    expect(CHANGE_ROLE?.subPath).toBe(':id/role'); // 세그먼트 2 mutation — bare base 아님
    expect(LIST?.method).toBe('GET'); // list 만 목록 GET
    expect(LIST_CONTRACT.subPath).toBe(''); // list 의 bare @Get — 세그먼트 0 유지(changeRole 세그먼트 흡수 금지)
    // web 목록 발사(GET bare base)를 changeRole 계약에 대면 method·path 이중 불일치로 잡힘.
    const changeRoleContract: BackendContract = { ...LIST_CONTRACT, method: CHANGE_ROLE?.method ?? null, subPath: CHANGE_ROLE?.subPath ?? '' };
    expect(diffContract(usersFire(0), changeRoleContract)).toEqual(
      expect.arrayContaining([expect.stringContaining('path 불일치'), expect.stringContaining('method 불일치')]),
    );
  });
  it('@Post() signup(같은 bare base, 다른 method)을 GET list 로 오인하지 않는다 — bare base 가 같아도 method 로 판별 (negative (e) — 형제 mutation 대조군 혼동)', () => {
    expect(SIGNUP).not.toBeNull();
    expect(SIGNUP?.method).toBe('POST'); // signup 은 POST — GET 조회로 오인 금지
    expect(SIGNUP?.subPath).toBe(''); // signup 도 bare base(세그먼트 0) — path 는 list 와 동일
    expect(LIST?.method).toBe('GET'); // list 는 GET — bare base 가 같아도 method 로 구분
    // signup 은 bare base 라 path 는 일치하지만 method 로 잡힘(GET vs POST).
    const signupContract: BackendContract = { ...LIST_CONTRACT, method: SIGNUP?.method ?? null, subPath: SIGNUP?.subPath ?? '' };
    expect(diffContract(usersFire(0), signupContract)).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('주석 줄의 "@Get()"/"@Controller(...)"/"GET /api/users" 를 실 decorator 로 오인하지 않는다 (negative (f) — 주석 false-positive)', () => {
    const fakeController = ['  // @Controller("api/users") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Get() — 주석뿐, decorator 없음', '  async list() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).list).toBeUndefined();
    const drifted: BackendContract = { ...LIST_CONTRACT, route: extractControllerRoute(fakeController), method: extractHandlerMethods(fakeHandler).list?.method ?? null };
    expect(diffContract(usersFire(0), drifted)).toEqual(['backend 계약 추출 실패']);
  });
  it('buildUsersPath 가 nonce ≤ 0 과 nonce > 0 두 분기 모두에서 /api/users base 를 유지하며 형제 자원(/api/groups·/api/parts)으로 오발사하지 않는다 (negative (g) — 형제 GET-list 발사기 오용 방지)', () => {
    // 두 분기 모두 base 는 /api/users — 형제 buildGroupsPath/buildPartsPath 와 base 만 다른 동형.
    expect(stripQuery(buildUsersPath(0))).toBe(BASE); // nonce ≤ 0 분기
    expect(stripQuery(buildUsersPath(7))).toBe(BASE); // nonce > 0 분기(`?_r` strip 후)
    expect(buildUsersPath(0)).not.toContain('/api/groups');
    expect(buildUsersPath(0)).not.toContain('/api/parts');
    expect(buildUsersPath(7)).not.toContain('/api/groups');
    expect(buildUsersPath(7)).not.toContain('/api/parts');
    // 형제 자원 base 로 대조하면 path 불일치로 잡힘 — 오발사 회귀 검출.
    expect(diffContract(usersFire(0), { ...LIST_CONTRACT, route: 'api/groups' })).toEqual([expect.stringContaining('path 불일치')]);
    expect(diffContract(usersFire(0), { ...LIST_CONTRACT, route: 'api/parts' })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('web call site 가 옵션 인자를 전달하면(단일 인자 아님) GET 추론이 깨져 method 불일치로 잡힌다 (negative — 발사 override drift)', () => {
    const overridden = extractUsersFireMethod(
      ["const x = useApiResource<UserRow[]>(usersPath, { method: 'POST' });"].join('\n'),
    );
    expect(overridden).toBe('NON-GET(args=2)'); // 옵션 인자 존재 → GET 아님
    const fired: WebFire = { path: BASE, method: overridden ?? 'GET' };
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('빈 소스 입력이면 추출기가 null·빈 객체를 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractUsersFireMethod('')).toBeNull();
    const empty: BackendContract = { route: extractControllerRoute(''), method: extractHandlerMethods('').list?.method ?? null, subPath: '', hasBody: false, hasParam: false, hasQuery: false };
    expect(diffContract(usersFire(0), empty)).toEqual(['backend 계약 추출 실패']);
  });
});
