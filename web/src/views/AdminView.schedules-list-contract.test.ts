import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본 삭제·동작 무변경(T-1202 이관 slice 1).
// 이 spec 이 실제 참조하는 export 만 골라 import(HandlerDecorator·normalizeRoute 는 삭제된 추출기 안에서만
// 쓰이던 것이라 미참조 → unused-import 방지 위해 제외). per-spec 발사기·타입·diffContract 는 아래 inline 유지.
import {
  composeRoute,
  extractControllerRoute,
  extractHandlerMethods,
  extractHandlerParams,
  pathSegments,
  stripComments,
  stripQuery,
} from './__contract-guard__/contract-extractors';

// R-112 — 스케줄 목록 조회(GET /api/schedules) web↔backend **계약 drift guard**. mirror 선례
// AdminView.schedule-apply-contract.test.ts(T-1198, 같은 cron-schedule.controller.ts 형제 handler)를
// upsert(@Put() bare + @Body) → list(@Get() bare + 인자 0)로 되돌린 read-side mirror. GET-발사기
// 추출 축은 AdminView.users-list-contract.test.ts(T-1195)의 `useApiResource<...>(PATH)` 발사(default
// GET · 무-body·무-param) + `?_r` nonce 무해 방식을 재적용. **판별 축**: (1) method GET(upsert 의 PUT
// 대신) · (2) 무-body(upsert 의 @Body 대조 — list 는 인자 0) · (3) read-only. 핵심은 **같은 base
// `api/schedules` 위 method 만 다른 형제(@Get() list vs @Put() upsert)** 를 method 로 정확히 판별하는 것
// — 세그먼트가 아니라 method 축으로 갈리는 첫 read-vs-mutation 대조. 형제 handler(@Delete remove ·
// @Post trigger · 별도 파일 recent-deletion · backfill)도 base-혼동 대조군으로 함께 고정. 정규식
// 추출기만 — 새 devDependency 0, 공용 helper 추출은 Out of Scope refactor slice.

// AdminView 조회 call site 의 발사 method 추론. `useApiResource<string[]>(SCHEDULES_PATH)` 를 옵션
// 인자 없이(단일 인자) 호출 → request→fetch default GET. 인자 2+ (options 전달)면 non-GET 가능.
// 주석 속 "GET /api/schedules" 문자열(소스 다수)·deps.request(SCHEDULES_PATH, {...}) mutation 발사와
// 섞이지 않도록 `useApiResource<string[]>(SCHEDULES_PATH...)` 명시 anchor 로 슬라이스.
function extractSchedulesFireMethod(source: string): string | null {
  const matched = /useApiResource<string\[\]>\(\s*(SCHEDULES_PATH[^)]*)\)/.exec(stripComments(source));
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

const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/scheduling/cron-schedule.controller.ts', import.meta.url), 'utf8');
const RECENT_DELETION_SOURCE = readFileSync(new URL('../../../src/scheduling/recent-deletion.controller.ts', import.meta.url), 'utf8');
const BACKFILL_SOURCE = readFileSync(new URL('../../../src/scheduling/backfill.controller.ts', import.meta.url), 'utf8');
const ADMIN_VIEW_SOURCE = readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const LIST = HANDLERS.list ?? null;
const LIST_PARAMS = extractHandlerParams(CONTROLLER_SOURCE, 'list');
const WEB_FIRE_METHOD = extractSchedulesFireMethod(ADMIN_VIEW_SOURCE);
const LIST_CONTRACT: BackendContract = {
  route: ROUTE,
  method: LIST?.method ?? null,
  subPath: LIST?.subPath ?? '',
  hasBody: /@Body\b/.test(LIST_PARAMS ?? ''), // handler 서명 안에서만 판정(형제 upsert/remove 오염 방지)
  hasParam: /@Param\b/.test(LIST_PARAMS ?? ''),
};
const BASE = '/api/schedules';
const ROUTE_TEMPLATE = '/api/schedules'; // bare base — literal subPath 없음
const SCHEDULES_PATH_DECL = "const SCHEDULES_PATH = '/api/schedules';";
// 조회 발사기. base(+선택적 `?_r` cache-buster query). 발사 method 는 call site 추론값(GET).
const schedulesFire = (query = ''): WebFire => {
  const path = `${BASE}${query}`;
  return { path, method: WEB_FIRE_METHOD ?? 'GET', hasParamSegment: stripQuery(path).includes(':') };
};

describe('AdminView — 스케줄 목록 조회(GET /api/schedules) web↔backend 계약 drift guard (T-1199)', () => {
  it('backend route/method/handler/param 추출이 비지 않고, 빈 소스면 추출기가 빈 값을 내 대조가 실패한다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(LIST).not.toBeNull();
    expect(LIST_CONTRACT.method).not.toBeNull();
    expect(LIST_PARAMS).not.toBeNull();
    expect(WEB_FIRE_METHOD).not.toBeNull();
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractHandlerParams('', 'list')).toBeNull();
    expect(extractSchedulesFireMethod('')).toBeNull();
    const empty: BackendContract = { ...LIST_CONTRACT, route: extractControllerRoute(''), method: extractHandlerMethods('').list?.method ?? null };
    expect(diffContract(schedulesFire(), empty)).toEqual(['backend 계약 추출 실패']);
  });
  it('@Controller("api/schedules") + @Get()(빈 subPath)를 bare base 단일 세그먼트로 합성하고 : 동적 세그먼트가 없다 (분기 — bare base 세그먼트 파싱)', () => {
    expect(ROUTE).toBe('api/schedules');
    expect(LIST?.subPath).toBe(''); // literal subPath 없음(trigger 의 'trigger' 2세그먼트와 대조)
    const composed = composeRoute(String(ROUTE), LIST_CONTRACT.subPath);
    expect(composed).toBe(ROUTE_TEMPLATE);
    expect(composed).not.toContain(':'); // 치환 세그먼트 없음(무-param read)
    expect(pathSegments(composed)).toEqual(['api', 'schedules']); // 2세그먼트, trigger 의 3세그먼트와 대조
  });
  it('list 핸들러가 @Body·@Param 을 둘 다 갖지 않는다 (분기 — 핸들러 인자 판별, 인자-0 read)', () => {
    expect(LIST_PARAMS).toBe(''); // 인자 0 — 빈 서명(upsert @Body·remove @Param 과 대조)
    expect(LIST_CONTRACT.hasBody).toBe(false); // GET 조회 — body 계약 없음
    expect(LIST_CONTRACT.hasParam).toBe(false); // path param 없음
  });
  it('같은 base `api/schedules` 위 형제 @Get() list 와 @Put() upsert 를 method 로 정확히 판별한다 (분기 — 같은 base method 판별, 핵심 축)', () => {
    expect(HANDLERS.list).toEqual({ method: 'GET', subPath: '' }); // list 는 bare base GET
    expect(HANDLERS.upsert).toEqual({ method: 'PUT', subPath: '' }); // upsert 는 같은 bare base but PUT
    // 두 형제는 세그먼트(path)가 동일 — method 축으로만 갈린다(read-vs-mutation).
    expect(composeRoute(String(ROUTE), HANDLERS.list.subPath)).toBe(composeRoute(String(ROUTE), HANDLERS.upsert.subPath));
    expect(HANDLERS.list.method).not.toBe(HANDLERS.upsert.method);
    // web GET 발사는 list(GET)에 정확히 매칭, upsert(PUT)로 대조하면 method 불일치로 잡힌다.
    expect(diffContract(schedulesFire(), LIST_CONTRACT)).toEqual([]);
    expect(diffContract(schedulesFire(), { ...LIST_CONTRACT, method: HANDLERS.upsert.method })).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('web 발사(GET /api/schedules)가 backend @Get() list 계약과 완전 일치한다 (happy-path — 경로 정합)', () => {
    expect(ADMIN_VIEW_SOURCE).toContain(SCHEDULES_PATH_DECL); // SCHEDULES_PATH 상수값 확정(export 아님 — 소스 대조)
    const fired = schedulesFire();
    expect(fired.path).toBe(ROUTE_TEMPLATE);
    expect(fired.hasParamSegment).toBe(false);
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([]);
  });
  it('web 조회 call site 가 옵션 인자 없이 useApiResource 를 호출해 default GET 이고 backend 도 @Get 이다 (happy-path — method 정합)', () => {
    expect(WEB_FIRE_METHOD).toBe('GET'); // 단일 인자 호출 → fetch default GET
    expect(LIST_CONTRACT.method).toBe('GET'); // backend 는 @Get(PUT/POST/DELETE 아님)
    expect(schedulesFire().method).toBe(LIST_CONTRACT.method); // 양측 method == GET
  });
  it('backend list 가 무-body·무-param 이고 web 조회도 body·path-param 없는 고정 base 상수 path 를 쓴다 (happy-path — 무-body·무-param 정합)', () => {
    expect(LIST_CONTRACT.hasBody).toBe(false);
    expect(LIST_CONTRACT.hasParam).toBe(false);
    expect(schedulesFire().hasParamSegment).toBe(false); // web 발사에 : 세그먼트 없음
    expect(diffContract(schedulesFire(), LIST_CONTRACT)).toEqual([]); // 인자-0 read 계약 정합
  });
  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it.each<[string, string]>([
    ['(a) base 단수 오타 api/schedule', 'api/schedule'],
    ['(a) base 접미 drift api/schedules-x', 'api/schedules-x'],
  ])('backend base 를 %s 로 바꾸면 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', (_label, route) => {
    expect(diffContract(schedulesFire(), { ...LIST_CONTRACT, route })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, string]>([
    ['(b) @Put 으로(형제 upsert method drift)', '  @Put()'],
    ['(b) @Post 로', '  @Post()'],
    ['(b) @Delete 로', '  @Delete()'],
  ])('list 가 %s drift 하면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 GET 발사)', (_label, decorator) => {
    const handler = extractHandlerMethods([decorator, '  list() {}'].join('\n')).list;
    expect(diffContract(schedulesFire(), { ...LIST_CONTRACT, method: handler.method })).toEqual([expect.stringContaining('method 불일치')]);
  });
  it.each<[string, string]>([
    ['(c) literal 추가 list', 'list'],
    ['(c) path-param 추가 :name', ':name'],
  ])('list 가 @Get("%s") 로 drift 하면 web 발사(bare base)와 세그먼트 불일치로 잡힌다 (negative (c) — 세그먼트 추가 drift)', (_label, subPath) => {
    const handler = extractHandlerMethods([`  @Get("${subPath}")`, '  list() {}'].join('\n')).list;
    expect(handler.subPath).toBe(subPath);
    expect(diffContract(schedulesFire(), { ...LIST_CONTRACT, subPath: handler.subPath })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, Partial<BackendContract>]>([
    ['list 핸들러에 @Body 추가(mutation 오변질)', { hasBody: true }],
    ['list 핸들러에 @Param 추가(단건 오변질)', { hasParam: true }],
  ])('%s 하면 무-body·무-param read 계약 불일치가 회귀로 검출된다 (negative (d) — 인자 추가 오인 방지)', (_label, override) => {
    expect(diffContract(schedulesFire(), { ...LIST_CONTRACT, ...override })).toEqual([expect.stringContaining('인자 계약 불일치')]);
  });
  it('형제 api/schedules controller(base 만 공유)를 list 로 오인하지 않는다 (negative (e) — 형제 base 혼동)', () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(['list', 'remove', 'trigger', 'upsert']);
    expect(HANDLERS.upsert).toEqual({ method: 'PUT', subPath: '' }); // @Put() upsert(같은 bare base but PUT)
    expect(HANDLERS.remove).toEqual({ method: 'DELETE', subPath: ':name' }); // @Delete(":name")
    expect(HANDLERS.trigger).toEqual({ method: 'POST', subPath: 'trigger' }); // @Post("trigger")
    expect(LIST).toEqual({ method: 'GET', subPath: '' }); // 정확히 list 선택
    // 별도 파일 형제 controller(같은 api/schedules prefix)도 list 로 오확장하지 않음.
    expect(extractHandlerMethods(RECENT_DELETION_SOURCE).recentDeletion).toEqual({ method: 'POST', subPath: 'recent-deletion/:personId' });
    expect(extractHandlerMethods(BACKFILL_SOURCE).backfill).toEqual({ method: 'POST', subPath: 'backfill/:personId' });
    // web GET 발사를 각 형제 계약에 대면 method/path/param 불일치로 잡힌다.
    expect(diffContract(schedulesFire(), { ...LIST_CONTRACT, method: HANDLERS.upsert.method })).toEqual([expect.stringContaining('method 불일치')]);
    expect(diffContract(schedulesFire(), { ...LIST_CONTRACT, method: HANDLERS.remove.method, subPath: HANDLERS.remove.subPath, hasParam: true })).toEqual(
      expect.arrayContaining([expect.stringContaining('path 불일치'), expect.stringContaining('method 불일치'), expect.stringContaining('인자 계약 불일치')]),
    );
    expect(diffContract(schedulesFire(), { ...LIST_CONTRACT, method: HANDLERS.trigger.method, subPath: HANDLERS.trigger.subPath })).toEqual(
      expect.arrayContaining([expect.stringContaining('path 불일치'), expect.stringContaining('method 불일치')]),
    );
  });
  it('web 조회 path 에 `?_r=n` cache-buster 가 붙어도 route 대조가 base 기준으로 통과한다 (negative (f) — nonce 무해)', () => {
    const fired = schedulesFire('?_r=7');
    expect(fired.path).toBe(`${BASE}?_r=7`);
    expect(stripQuery(fired.path)).toBe(BASE); // `_r` strip 후 base 동일
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([]); // query 는 drift 아님(부수효과 0)
    // 단 진짜 추가 세그먼트(@Get(":name"))는 query strip 후에도 path 불일치로 잡힘 — query 와 세그먼트 구분.
    expect(diffContract(fired, { ...LIST_CONTRACT, subPath: ':name' })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('주석 줄의 "@Get(...)"/"@Controller(...)"/"GET /api/schedules" 를 실 decorator 로 오인하지 않는다 (negative (g) — 주석 false-positive)', () => {
    expect(extractControllerRoute(['  // @Controller("api/schedules") — 주석뿐', 'export class X {}'].join('\n'))).toBeNull();
    expect(extractHandlerMethods(['  // @Get() — 주석뿐', '  list() {}'].join('\n')).list).toBeUndefined();
    expect(ROUTE).toBe('api/schedules'); // 실 소스는 주석에 다수 "GET /api/schedules" 문자열이 있어도 정확 추출
    expect(LIST?.method).toBe('GET');
    expect(LIST?.subPath).toBe('');
  });
  it('web call site 가 옵션 인자를 전달하면(단일 인자 아님) GET 추론이 깨져 method 불일치로 잡힌다 (negative — 발사 override drift)', () => {
    const overridden = extractSchedulesFireMethod(
      ["const x = useApiResource<string[]>(SCHEDULES_PATH, { method: 'POST' });"].join('\n'),
    );
    expect(overridden).toBe('NON-GET(args=2)'); // 옵션 인자 존재 → GET 아님
    const fired: WebFire = { path: BASE, method: overridden ?? 'GET', hasParamSegment: false };
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([expect.stringContaining('method 불일치')]);
  });
});
