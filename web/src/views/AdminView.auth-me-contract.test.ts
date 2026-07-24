import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// R-112 — 현재 사용자 조회(GET /api/auth/me) web↔backend **계약 drift guard**. mirror 선례
// AdminView.schedules-list-contract.test.ts(T-1199, cron-schedule.controller.ts read-side guard)를
// 대상만 `cron-schedule.controller.list`(bare `@Get()`)에서 `auth.controller.me`(`@Get("me")` —
// literal subpath 보유)로 바꾼 mirror. GET-발사기 추출 축은 AdminView.users-list-contract.test.ts
// (T-1195)의 `useApiResource<...>(PATH)` 발사(default GET · 무-body·무-param) + `?_r` nonce 무해
// 방식을 재적용. **본 slice 판별 축(schedules 와 세 가지 차이)**: (1) **2-세그먼트 base+literal
// subpath 합성** — `@Controller("api/auth")` base + `@Get("me")` literal subpath → `/api/auth/me`
// (schedules 의 bare-base subpath 없음과 대조). (2) **형제 method+세그먼트 판별** — 같은 base 위
// 형제 `@Post("login")`/`@Post("logout")`/`@Post("refresh")`(전부 POST + 다른 subpath)를 `@Get("me")`
// 로 오인하지 않음. (3) **@Req 배제** — me 핸들러가 `@Req()`(request 주입)를 갖지만 body·path-param 이
// 아니므로 hasBody === false && hasParam === false — @Req 를 body/param 으로 오분류하지 않는 판별을
// 새 축으로 고정. 정규식 추출기만 — 새 devDependency 0, 공용 helper 추출은 Out of Scope refactor slice.

function stripComments(source: string): string { // 주석 제거 — 추출이 주석 문구를 잡으면 guard 무력화(negative (g)).
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
}
function extractHandlerMethods(source: string): Record<string, HandlerDecorator> {
  const found: Record<string, HandlerDecorator> = {};
  let pending: HandlerDecorator | null = null;
  for (const line of stripComments(source).split('\n')) {
    const decorator = /^[ \t]*@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:['"`]([^'"`]*)['"`]\s*)?\)/.exec(line);
    if (decorator) {
      pending = { method: decorator[1].toUpperCase(), subPath: decorator[2] ?? '' };
      continue;
    }
    if (/^[ \t]*@/.test(line)) {
      continue; // 그 외 decorator(@HttpCode/@UseGuards/@Roles)는 handler 로 오인하지 않는다.
    }
    const handler = /^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (handler && pending) {
      found[handler[1]] = pending;
      pending = null;
    }
  }
  return found;
}
// handler 파라미터를 균형 괄호 매칭으로 슬라이스 — @Body/@Param 을 handler 서명 안에서만 판정. 부재 null.
// me() 는 `@Req() req: Request` 만 가짐 → hasBody/hasParam 둘 다 false(형제 login @Body·refresh @Req/@Res
// 와 대조). @Req 는 body/param 이 아니므로 인자-0 read 계약을 위반하지 않는다.
function extractHandlerParams(source: string, handlerName: string): string | null {
  const stripped = stripComments(source);
  const m = new RegExp(`(?:public\\s+|private\\s+|protected\\s+)?(?:async\\s+)?\\b${handlerName}\\s*\\(`).exec(stripped);
  if (!m) {
    return null;
  }
  let depth = 0;
  const start = m.index + m[0].length;
  for (let i = start - 1; i < stripped.length; i++) {
    if (stripped[i] === '(') {
      depth++;
    } else if (stripped[i] === ')' && --depth === 0) {
      return stripped.slice(start, i);
    }
  }
  return null;
}
// AdminView 조회 call site 의 발사 method 추론. `useApiResource<MeRow>(AUTH_ME_PATH)` 를 옵션
// 인자 없이(단일 인자) 호출 → request→fetch default GET. 인자 2+ (options 전달)면 non-GET 가능.
// 주석 속 "GET /api/auth/me" 문자열(소스 다수)과 섞이지 않도록 `useApiResource<MeRow>(AUTH_ME_PATH...)`
// 명시 anchor 로 슬라이스(call site 가 2줄에 걸쳐 있어도 stripComments 후 개행 무관 매칭).
function extractMeFireMethod(source: string): string | null {
  const matched = /useApiResource<MeRow>\(\s*(AUTH_ME_PATH[^)]*)\)/.exec(stripComments(source));
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
}
interface WebFire {
  path: string;
  method: string;
  hasParamSegment: boolean;
}
const normalizeRoute = (route: string): string => (route.startsWith('/') ? route : `/${route}`);
function composeRoute(route: string, subPath: string): string {
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${normalizeRoute(route)}/${trimmed}` : normalizeRoute(route);
}
const pathSegments = (route: string): string[] => route.split('/').filter(Boolean);
const stripQuery = (path: string): string => path.split('?')[0]; // `?_r=n` cache-buster 제거 — base 만 대조.
// 불일치 사유 목록 — 빈 배열=계약 일치. 추출 실패도 통과가 아니라 사유 1건(선단언 방어). GET 조회는 body/param
// 계약이 없으므로 base 경로 + method 만 대조하되, backend 가 @Body/@Param 을 보유(무-body·무-param read 위반)하거나
// web 발사에 : 동적 세그먼트가 있으면 인자 계약 불일치로 잡는다(mutation 으로 오변질 방지). query 는 strip 후 base 대조.
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
  if (backend.hasBody || backend.hasParam || fire.hasParamSegment) {
    issues.push('인자 계약 불일치(무-body·무-param read 위반)');
  }
  return issues;
}

const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/auth/auth.controller.ts', import.meta.url), 'utf8');
const ADMIN_VIEW_SOURCE = readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const ME = HANDLERS.me ?? null;
const ME_PARAMS = extractHandlerParams(CONTROLLER_SOURCE, 'me');
const WEB_FIRE_METHOD = extractMeFireMethod(ADMIN_VIEW_SOURCE);
const ME_CONTRACT: BackendContract = {
  route: ROUTE,
  method: ME?.method ?? null,
  subPath: ME?.subPath ?? '',
  hasBody: /@Body\b/.test(ME_PARAMS ?? ''), // handler 서명 안에서만 판정(형제 login @Body 오염 방지)
  hasParam: /@Param\b/.test(ME_PARAMS ?? ''),
};
const BASE = '/api/auth/me';
const ROUTE_TEMPLATE = '/api/auth/me'; // base api/auth(2세그먼트) + literal subPath me(1세그먼트)
const AUTH_ME_PATH_DECL = "const AUTH_ME_PATH = '/api/auth/me';";
// 조회 발사기. base(+선택적 `?_r` cache-buster query). 발사 method 는 call site 추론값(GET).
const meFire = (query = ''): WebFire => {
  const path = `${BASE}${query}`;
  return { path, method: WEB_FIRE_METHOD ?? 'GET', hasParamSegment: stripQuery(path).includes(':') };
};

describe('AdminView — 현재 사용자 조회(GET /api/auth/me) web↔backend 계약 drift guard (T-1200)', () => {
  it('backend route/method/handler/param 추출이 비지 않고, 빈 소스면 추출기가 빈 값을 내 대조가 실패한다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ME).not.toBeNull();
    expect(ME_CONTRACT.method).not.toBeNull();
    expect(ME_PARAMS).not.toBeNull();
    expect(WEB_FIRE_METHOD).not.toBeNull();
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractHandlerParams('', 'me')).toBeNull();
    expect(extractMeFireMethod('')).toBeNull();
    const empty: BackendContract = { ...ME_CONTRACT, route: extractControllerRoute(''), method: extractHandlerMethods('').me?.method ?? null };
    expect(diffContract(meFire(), empty)).toEqual(['backend 계약 추출 실패']);
  });
  it('@Controller("api/auth") + @Get("me")(literal subPath)를 2-세그먼트 base + 1-세그먼트 subpath 로 합성하고 : 동적 세그먼트가 없다 (분기 — base+literal subpath 세그먼트 파싱)', () => {
    expect(ROUTE).toBe('api/auth');
    expect(ME?.subPath).toBe('me'); // literal subPath 보유(schedules 의 bare-base subpath 없음과 대조)
    const composed = composeRoute(String(ROUTE), ME_CONTRACT.subPath);
    expect(composed).toBe(ROUTE_TEMPLATE);
    expect(composed).not.toContain(':'); // 치환 세그먼트 없음(무-param read)
    expect(pathSegments(composed)).toEqual(['api', 'auth', 'me']); // base 2세그먼트 + literal 1세그먼트 = 3세그먼트
  });
  it('me 핸들러가 @Body·@Param 을 둘 다 갖지 않고 @Req() 만 주입한다 (분기 — 핸들러 인자 판별, @Req 케이스)', () => {
    expect(ME_PARAMS).toContain('@Req'); // @Req() 는 주입되지만
    expect(ME_CONTRACT.hasBody).toBe(false); // GET 조회 — body 계약 없음(@Req 를 @Body 로 오분류 안 함)
    expect(ME_CONTRACT.hasParam).toBe(false); // path param 없음(@Req 를 @Param 으로 오분류 안 함)
  });
  it('같은 base `api/auth` 위 형제 @Get("me")(GET) 와 @Post(login/logout/refresh)(POST)를 method+세그먼트로 정확히 판별한다 (분기 — 형제 method+세그먼트 판별, 핵심 축)', () => {
    expect(HANDLERS.me).toEqual({ method: 'GET', subPath: 'me' }); // me 는 GET + literal me
    expect(HANDLERS.login).toEqual({ method: 'POST', subPath: 'login' }); // 형제는 POST + 다른 subpath
    expect(HANDLERS.logout).toEqual({ method: 'POST', subPath: 'logout' });
    expect(HANDLERS.refresh).toEqual({ method: 'POST', subPath: 'refresh' });
    // web GET 발사는 me(GET)에 정확히 매칭. 형제 POST 계약으로 대조하면 method+path 불일치로 잡힌다.
    expect(diffContract(meFire(), ME_CONTRACT)).toEqual([]);
    expect(diffContract(meFire(), { ...ME_CONTRACT, method: HANDLERS.login.method, subPath: HANDLERS.login.subPath })).toEqual(
      expect.arrayContaining([expect.stringContaining('path 불일치'), expect.stringContaining('method 불일치')]),
    );
  });
  it('web 발사(GET /api/auth/me)가 backend @Get("me") me 계약과 완전 일치한다 (happy-path — 경로 정합)', () => {
    expect(ADMIN_VIEW_SOURCE).toContain(AUTH_ME_PATH_DECL); // AUTH_ME_PATH 상수값 확정(export 아님 — 소스 대조)
    const fired = meFire();
    expect(fired.path).toBe(ROUTE_TEMPLATE);
    expect(fired.hasParamSegment).toBe(false);
    expect(diffContract(fired, ME_CONTRACT)).toEqual([]);
  });
  it('web 조회 call site 가 옵션 인자 없이 useApiResource 를 호출해 default GET 이고 backend 도 @Get 이다 (happy-path — method 정합)', () => {
    expect(WEB_FIRE_METHOD).toBe('GET'); // 단일 인자 호출 → fetch default GET
    expect(ME_CONTRACT.method).toBe('GET'); // backend 는 @Get(PUT/POST/DELETE 아님)
    expect(meFire().method).toBe(ME_CONTRACT.method); // 양측 method == GET
  });
  it('backend me 가 무-body·무-param(@Req 배제)이고 web 조회도 body·path-param 없는 고정 base 상수 path 를 쓴다 (happy-path — 무-body·무-param 정합, @Req 배제)', () => {
    expect(ME_CONTRACT.hasBody).toBe(false);
    expect(ME_CONTRACT.hasParam).toBe(false);
    expect(meFire().hasParamSegment).toBe(false); // web 발사에 : 세그먼트 없음
    expect(diffContract(meFire(), ME_CONTRACT)).toEqual([]); // 인자-0 read 계약 정합(@Req 만 허용)
  });
  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it.each<[string, Partial<BackendContract>]>([
    ['(a) base 절단 오타 api/au', { route: 'api/au' }],
    ['(a) base 접미 drift api/authx', { route: 'api/authx' }],
    ['(a) subpath 접미 오타 mee', { subPath: 'mee' }],
    ['(a) subpath 절단 오타 m', { subPath: 'm' }],
  ])('backend 를 %s 로 바꾸면 path 불일치로 잡힌다 (negative (a) — base/subpath drift, 404 예방)', (_label, override) => {
    expect(diffContract(meFire(), { ...ME_CONTRACT, ...override })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, string]>([
    ['(b) @Post 으로(형제 login/logout/refresh method drift)', '  @Post("me")'],
    ['(b) @Put 으로', '  @Put("me")'],
    ['(b) @Delete 로', '  @Delete("me")'],
  ])('me 가 %s drift 하면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 GET 발사)', (_label, decorator) => {
    const handler = extractHandlerMethods([decorator, '  me() {}'].join('\n')).me;
    expect(diffContract(meFire(), { ...ME_CONTRACT, method: handler.method, subPath: handler.subPath })).toEqual([expect.stringContaining('method 불일치')]);
  });
  it.each<[string, string]>([
    ['(c) path-param 추가 me/:id', 'me/:id'],
    ['(c) subpath 제거 bare-base 로 축소', ''],
  ])('me 가 @Get("%s") 로 drift 하면 web 발사(/api/auth/me)와 세그먼트 불일치로 잡힌다 (negative (c) — 세그먼트 drift)', (_label, subPath) => {
    const handler = extractHandlerMethods([`  @Get("${subPath}")`, '  me() {}'].join('\n')).me;
    expect(handler.subPath).toBe(subPath);
    expect(diffContract(meFire(), { ...ME_CONTRACT, subPath: handler.subPath })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, Partial<BackendContract>]>([
    ['me 핸들러에 @Body 추가(mutation 오변질)', { hasBody: true }],
    ['me 핸들러에 @Param 추가(단건 오변질)', { hasParam: true }],
  ])('%s 하면 무-body·무-param read 계약 불일치가 회귀로 검출된다 (negative (d) — 인자 추가 오인 방지, @Req-only 고정)', (_label, override) => {
    expect(diffContract(meFire(), { ...ME_CONTRACT, ...override })).toEqual([expect.stringContaining('인자 계약 불일치')]);
  });
  it('같은 api/auth prefix 를 공유하는 형제 handler(login/logout/refresh)를 me 로 오인하지 않는다 (negative (e) — 형제 api/auth handler 혼동)', () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(['login', 'logout', 'me', 'refresh']);
    expect(ME).toEqual({ method: 'GET', subPath: 'me' }); // 정확히 me 선택
    // 형제 3종은 전부 @Post + 다른 literal subpath — me(GET/me)로 오확장하지 않음.
    for (const sibling of [HANDLERS.login, HANDLERS.logout, HANDLERS.refresh]) {
      expect(sibling.method).toBe('POST');
      expect(sibling.subPath).not.toBe('me');
      // web GET 발사를 각 형제 계약에 대면 method+path 불일치로 잡힌다.
      expect(diffContract(meFire(), { ...ME_CONTRACT, method: sibling.method, subPath: sibling.subPath })).toEqual(
        expect.arrayContaining([expect.stringContaining('path 불일치'), expect.stringContaining('method 불일치')]),
      );
    }
  });
  it('web 조회 path 에 `?_r=n` cache-buster 가 붙어도 route 대조가 base 기준으로 통과한다 (negative (f) — nonce 무해)', () => {
    const fired = meFire('?_r=7');
    expect(fired.path).toBe(`${BASE}?_r=7`);
    expect(stripQuery(fired.path)).toBe(BASE); // `_r` strip 후 base 동일
    expect(diffContract(fired, ME_CONTRACT)).toEqual([]); // query 는 drift 아님(부수효과 0)
    // 단 진짜 추가 세그먼트(@Get("me/:id"))는 query strip 후에도 path 불일치로 잡힘 — query 와 세그먼트 구분.
    expect(diffContract(fired, { ...ME_CONTRACT, subPath: 'me/:id' })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('주석 줄의 "@Get(...)"/"@Post(...)"/"@Controller(...)"/"GET /api/auth/me" 를 실 decorator 로 오인하지 않는다 (negative (g) — 주석 false-positive)', () => {
    expect(extractControllerRoute(['  // @Controller("api/auth") — 주석뿐', 'export class X {}'].join('\n'))).toBeNull();
    expect(extractHandlerMethods(['  // @Get("me") — 주석뿐', '  me() {}'].join('\n')).me).toBeUndefined();
    expect(ROUTE).toBe('api/auth'); // 실 소스는 주석에 다수 "GET /api/auth/me" 문자열이 있어도 정확 추출
    expect(ME?.method).toBe('GET');
    expect(ME?.subPath).toBe('me');
  });
  it('web call site 가 옵션 인자를 전달하면(단일 인자 아님) GET 추론이 깨져 method 불일치로 잡힌다 (negative — 발사 override drift)', () => {
    const overridden = extractMeFireMethod(
      ["const x = useApiResource<MeRow>(AUTH_ME_PATH, { method: 'POST' });"].join('\n'),
    );
    expect(overridden).toBe('NON-GET(args=2)'); // 옵션 인자 존재 → GET 아님
    const fired: WebFire = { path: BASE, method: overridden ?? 'GET', hasParamSegment: false };
    expect(diffContract(fired, ME_CONTRACT)).toEqual([expect.stringContaining('method 불일치')]);
  });
});
