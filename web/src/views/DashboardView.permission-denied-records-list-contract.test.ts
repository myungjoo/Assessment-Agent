import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// 공용 invariant 추출기(T-1201)를 alphabetical named import 로 재사용(중복 inline 0);
// permission-denied-records-전용 추출(상수 경로·query subset 판정)만 spec 로컬 정의.
import {
  composeRoute,
  extractControllerRoute,
  extractHandlerMethods,
  extractHandlerParams,
  normalizeRoute,
  pathSegments,
  stripComments,
  stripQuery,
} from './__contract-guard__/contract-extractors';

// R-112 — 권한 부족 감사 조회(GET /api/permission-denied-records) web↔backend **계약 drift guard**
// (T-1236, DashboardView 4 GET 중 마지막 slice). T-1235(contributions)의 bare @Get() list 판별
// 축을 mirror 하되 **결정적 차이 3종**: (1) 소비처가 함수(buildContributionsPath)가 아니라 **고정
// 상수** PERMISSION_DENIED_RECORDS_PATH — null-gate 분기가 없어 **무조건 조회**(관련 null test 제거),
// (2) controller 는 permission-denied-record.controller.ts 로 유일 route 가 bare @Get() list —
// @Get(":id") detail·@Post() create 자체가 없다, (3) web-fire query 집합은 ∅ 이고 backend optional
// query 는 3종({instanceRef,provider,httpStatus}) 이라 **∅ ⊆ 3종** 이라는 subset 호환 축을 새로
// 대조한다(T-1235 의 집합 상등 대조와 대비). 정규식만 — 런타임 import·backend 기동 없이 소스 대조.

interface BackendContract {
  route: string | null;
  method: string | null;
  subPath: string;
  queryParams: string[]; // @Query("...") 인자 이름 집합(정렬) — 모두 optional
}
interface WebFire {
  path: string;
  method: string;
  queryParams: string[]; // fired path 의 query param 이름 집합(정렬) — 현 main 은 ∅
}

// path param(: 로 시작하는 세그먼트) 목록 — bare list(0개)와 :id detail(1개) 판별 보조.
const pathParams = (route: string): string[] =>
  pathSegments(route).filter((seg) => seg.startsWith(':'));

// a ⊆ b 판정 — web-fire query 집합이 backend optional query 집합의 subset 인지(호환) 검사.
const isSubset = (a: string[], b: string[]): boolean =>
  a.every((x) => b.includes(x));

// backend 핸들러 서명에서 @Query("name") 인자 이름을 모두 추출(정렬) — subset 축 판별의 근거.
function extractQueryDecoratorNames(signature: string | null): string[] {
  if (!signature) {
    return [];
  }
  const names: string[] = [];
  const re = /@Query\(\s*['"`]([^'"`]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(signature)) !== null) {
    names.push(m[1]);
  }
  return [...names].sort();
}

// fired path 의 query string 에서 param 이름 집합을 추출(정렬). query 부재 시 빈 배열.
function extractPathQueryParams(path: string): string[] {
  const query = path.split('?')[1];
  if (!query) {
    return [];
  }
  return query
    .split('&')
    .map((pair) => pair.split('=')[0])
    .filter(Boolean)
    .sort();
}

// DashboardView 상수 소비처 경로를 소스 텍스트에서 추출(정규식). 상수는 export 되지 않으므로(계약
// 대조 표면만, production 변경 0) 런타임 import 대신 소스에서 추출한다. 주석 줄의 경로 언급을
// 실 상수로 오인하지 않도록 stripComments 선처리(negative false-positive 방어).
function extractConstantPath(source: string, name: string): string | null {
  const matched = new RegExp(
    `(?:const|let)\\s+${name}\\s*=\\s*['"\`]([^'"\`]+)['"\`]`,
  ).exec(stripComments(source));
  return matched ? matched[1] : null;
}

// DashboardView 조회 call site 의 발사 method 추론. useApiResource<PermissionDeniedRecordRow[]>(path)
// 를 옵션 인자 없이(단일 인자) 호출 → fetch default GET. 인자 2+ 면 non-GET. <PermissionDeniedRecordRow[]>
// 타입 인자로 형제 조회(<ContributionRow[]> 등)와 섞이지 않게 anchor 슬라이스한다.
function extractPermissionDeniedFireMethod(source: string): string | null {
  const matched = /useApiResource<PermissionDeniedRecordRow\[\]>\(\s*([^)]*)\)/.exec(
    stripComments(source),
  );
  if (!matched) {
    return null;
  }
  const args = matched[1].split(',').map((arg) => arg.trim()).filter(Boolean);
  return args.length === 1 ? 'GET' : `NON-GET(args=${args.length})`;
}

// 불일치 사유 목록 — 빈 배열=계약 일치. 추출 실패도 통과가 아니라 사유 1건(선단언 방어). base 경로 +
// method + **query subset 호환**(web-fire ⊆ backend optional) 3축을 대조한다. T-1235 의 query 집합
// 상등과 달리, 여기선 web 이 backend 미선언 key 를 보내지 않는 한(subset) 정합이다.
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
  const notDeclared = fire.queryParams.filter((q) => !backend.queryParams.includes(q));
  if (notDeclared.length > 0) {
    issues.push(`query subset 위반: ${notDeclared.join(',')}`);
  }
  return issues;
}

const CONTROLLER_SOURCE = readFileSync(
  new URL('../../../src/permission-denied/permission-denied-record.controller.ts', import.meta.url),
  'utf8',
);
const DASHBOARD_VIEW_SOURCE = readFileSync(
  new URL('./DashboardView.tsx', import.meta.url),
  'utf8',
);
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const LIST = HANDLERS.list ?? null;
const LIST_PARAMS = extractHandlerParams(CONTROLLER_SOURCE, 'list');
const WEB_CONST_PATH = extractConstantPath(DASHBOARD_VIEW_SOURCE, 'PERMISSION_DENIED_RECORDS_PATH');
const WEB_FIRE_METHOD = extractPermissionDeniedFireMethod(DASHBOARD_VIEW_SOURCE);
const BACKEND_QUERY_PARAMS = extractQueryDecoratorNames(LIST_PARAMS);
const LIST_CONTRACT: BackendContract = {
  route: ROUTE,
  method: LIST?.method ?? null,
  subPath: LIST?.subPath ?? '',
  queryParams: BACKEND_QUERY_PARAMS,
};
const BASE = '/api/permission-denied-records';

// 조회 발사기 — 고정 상수 경로(null-gate 없음)를 감싼다(발사 method 는 GET, query ∅).
const permissionDeniedFire = (): WebFire => {
  const path = WEB_CONST_PATH ?? '';
  return {
    path,
    method: WEB_FIRE_METHOD ?? 'GET',
    queryParams: extractPathQueryParams(path),
  };
};

describe('DashboardView — 권한 부족 감사 조회(GET /api/permission-denied-records) web↔backend 계약 drift guard (T-1236)', () => {
  it('backend route/method/handler/param 과 web 상수 경로·발사 method 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(LIST).not.toBeNull();
    expect(LIST_CONTRACT.method).not.toBeNull();
    expect(LIST_PARAMS).not.toBeNull();
    expect(WEB_CONST_PATH).not.toBeNull();
    expect(WEB_FIRE_METHOD).not.toBeNull();
  });
  it('backend @Controller("api/permission-denied-records") 2-세그먼트 base 를 /api/permission-denied-records 로 정규화한다 (분기 — base 파싱)', () => {
    expect(ROUTE).toBe('api/permission-denied-records');
    expect(String(ROUTE).split('/')).toHaveLength(2); // api·permission-denied-records
    expect(normalizeRoute(String(ROUTE))).toBe(BASE);
  });
  it('backend bare @Get() list(세그먼트 0)를 base 와 합성해 path param 0개 template 을 만든다 (분기 — bare @Get 세그먼트 0 합성)', () => {
    expect(LIST_CONTRACT.method).toBe('GET');
    expect(LIST_CONTRACT.subPath).toBe(''); // @Get() bare — 추가 세그먼트 0
    const composed = composeRoute(String(ROUTE), LIST_CONTRACT.subPath);
    expect(composed).toBe(BASE);
    expect(pathSegments(composed)).toEqual(['api', 'permission-denied-records']); // 세그먼트 정확히 2개
    expect(pathParams(composed)).toEqual([]); // path param 정확히 0개
  });
  it('이 controller 의 유일 route 는 bare @Get() list — @Get(":id") detail·@Post() create 가 아예 없다 (flow — 단일 route 축, list-vs-detail 판별)', () => {
    expect(Object.keys(HANDLERS)).toEqual(['list']); // handler 정확히 1종(list)
    expect(HANDLERS.list).toEqual({ method: 'GET', subPath: '' }); // bare @Get() list
    expect(HANDLERS.findOne).toBeUndefined(); // :id detail route 부재(T-1235 와의 구조 차이)
    expect(HANDLERS.create).toBeUndefined(); // @Post() create route 부재
    expect(pathParams(composeRoute(String(ROUTE), LIST_CONTRACT.subPath))).toEqual([]); // :id 흡수 안 함
  });
  it('list 가 @Query("instanceRef")·@Query("provider")·@Query("httpStatus") 3종 optional query 를 받고 @Body 는 없다 (분기 — query 인자 집합 판별)', () => {
    expect(LIST_PARAMS).not.toBeNull();
    expect(/@Body\b/.test(LIST_PARAMS ?? '')).toBe(false); // GET 조회 — body 계약 없음
    expect(BACKEND_QUERY_PARAMS).toEqual(['httpStatus', 'instanceRef', 'provider']); // 3종 정렬 추출
  });
  it('고정 상수 PERMISSION_DENIED_RECORDS_PATH 발사(GET /api/permission-denied-records, query ∅)가 backend list 계약과 완전 일치한다 (happy-path — 경로·subset 정합)', () => {
    const fired = permissionDeniedFire();
    expect(fired.path).toBe(BASE); // 상수 그대로 — query string 부착 없음
    expect(stripQuery(fired.path)).toBe(BASE);
    expect(fired.queryParams).toEqual([]); // web-fire query 집합 ∅
    expect(isSubset(fired.queryParams, LIST_CONTRACT.queryParams)).toBe(true); // ∅ ⊆ 3종(subset 호환)
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([]);
  });
  it('web 조회 call site 가 옵션 인자 없이 useApiResource 를 호출해 default GET 이고 backend 도 @Get 이다 (happy-path — method 정합)', () => {
    expect(WEB_FIRE_METHOD).toBe('GET'); // 단일 인자 호출 → fetch default GET
    expect(LIST_CONTRACT.method).toBe('GET'); // backend 는 @Get(POST/DELETE 아님)
    expect(permissionDeniedFire().method).toBe(LIST_CONTRACT.method); // 양측 method == GET
  });
  it('소비처가 고정 상수(함수 아님)라 null-gate 분기가 없다 — 무조건 조회하며 상수는 항상 base 문자열이다 (branch — null-gate 부재 명시, summaries/contributions 와의 구조 차이)', () => {
    // T-1235(contributions)·T-1234(summaries)는 falsy 인자 시 null 반환(조회 미수행) 가드가 있었으나,
    // 본 slice 는 상수라 그런 분기가 없다 — 항상 base 문자열을 발사(무조건 조회).
    expect(typeof WEB_CONST_PATH).toBe('string');
    expect(WEB_CONST_PATH).toBe(BASE);
    expect(WEB_CONST_PATH).not.toBeNull();
    expect(permissionDeniedFire().path).toBe(BASE); // 조건 없이 항상 동일 경로
  });
  it('web-fire query 집합이 backend optional 집합의 subset 이면 pass, subset 이 아니면(미선언 key 주입) fail 이다 (branch — subset 호환 분기 각 1+)', () => {
    // 현 main: ∅ ⊆ {instanceRef,provider,httpStatus} → 호환.
    expect(isSubset([], LIST_CONTRACT.queryParams)).toBe(true);
    expect(isSubset(['instanceRef'], LIST_CONTRACT.queryParams)).toBe(true); // 선언된 key 는 여전히 subset
    expect(isSubset(['instanceRef', 'provider'], LIST_CONTRACT.queryParams)).toBe(true);
    // 미선언 key 주입 → subset 아님.
    expect(isSubset(['personId'], LIST_CONTRACT.queryParams)).toBe(false);
    const violating: WebFire = { path: `${BASE}?personId=p1`, method: 'GET', queryParams: ['personId'] };
    expect(diffContract(violating, LIST_CONTRACT)).toEqual([expect.stringContaining('query subset 위반')]);
  });
  it('backend 가 optional query 3종을 선언해도 web 이 query 0 으로 발사하는 것은 정합이다 — optional 선언이 web-fire(query ∅) 를 깨지 않는다 (query 무해성)', () => {
    expect(LIST_CONTRACT.queryParams.length).toBeGreaterThan(0); // backend 는 optional query 有
    expect(permissionDeniedFire().queryParams).toEqual([]); // web 은 아무 query 도 안 보냄
    // 모두 optional 이므로 web 이 안 보내도(subset) 계약 일치 — 사유 0.
    expect(diffContract(permissionDeniedFire(), LIST_CONTRACT)).toEqual([]);
  });
  it('extractPathQueryParams 는 ? query 가 없는 path 에 빈 배열을 반환한다 (branch — null-query 방어 분기)', () => {
    expect(extractPathQueryParams(BASE)).toEqual([]); // query 부재 → 빈 집합
    expect(extractPathQueryParams(`${BASE}?instanceRef=i1`)).toEqual(['instanceRef']); // query 有 → 정상 추출
  });
  it.each<[string, () => BackendContract]>([
    ['(a) base 를 api/permission-denied-record(단수 오타)로', () => ({ ...LIST_CONTRACT, route: 'api/permission-denied-record' })],
    ['(a) base 를 api/denied-records(어휘 drift)로', () => ({ ...LIST_CONTRACT, route: 'api/denied-records' })],
  ])('backend base 가 %s 바뀌면 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', (_label, build) => {
    expect(diffContract(permissionDeniedFire(), build())).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, string]>([
    ['(b) @Post 로', '  @Post()'],
    ['(b) @Delete 로', '  @Delete()'],
  ])('list 가 %s method 로 drift 하면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 GET 발사)', (_label, decorator) => {
    const handler = extractHandlerMethods([decorator, '  async list() {}'].join('\n')).list;
    expect(diffContract(permissionDeniedFire(), { ...LIST_CONTRACT, method: handler.method })).toEqual([expect.stringContaining('method 불일치')]);
  });
  it.each<[string, string]>([
    ['(c) @Get(":id")(detail 세그먼트 1)로', ':id'],
    ['(c) @Get("all")(literal 세그먼트 1)로', 'all'],
  ])('web bare list 발사를 list 가 @Get("%s") 로 오변형된 계약에 대면 path 불일치로 잡힌다 — bare list 가 detail 로 오인되지 않음 (negative (c) — bare vs :id 혼동)', (_label, subPath) => {
    const handler = extractHandlerMethods([`  @Get("${subPath}")`, '  async list() {}'].join('\n')).list;
    expect(handler.subPath).toBe(subPath);
    expect(diffContract(permissionDeniedFire(), { ...LIST_CONTRACT, subPath: handler.subPath })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('web 이 /api/permission-denied-records/:id detail 을 fire 하도록 오변형되면 — 이 controller 는 detail route 자체가 없으므로 — bare list 매핑이 깨져 path 불일치로 잡힌다 (negative (c) — web 측 :id 혼동)', () => {
    const detailFire: WebFire = { path: `${BASE}/:id`, method: 'GET', queryParams: [] };
    expect(stripQuery(detailFire.path)).toBe(`${BASE}/:id`); // detail 세그먼트가 남음
    expect(pathParams(stripQuery(detailFire.path))).toEqual([':id']); // path param 주입 = 계약 위반
    expect(diffContract(detailFire, LIST_CONTRACT)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, string[]]>([
    ['(d) ?personId= 미선언 key 주입', ['personId']],
    ['(d) ?foo= 임의 key 주입', ['foo']],
  ])('web 이 backend 미선언 query %s 를 fire 하도록 오변형되면 subset 위반으로 잡힌다 (negative (d) — query subset 위반, ∅ 였던 web query 오염)', (_label, queryParams) => {
    const fired: WebFire = { path: `${BASE}?${queryParams[0]}=x`, method: 'GET', queryParams };
    expect(isSubset(queryParams, LIST_CONTRACT.queryParams)).toBe(false);
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([expect.stringContaining('query subset 위반')]);
  });
  it('@Get() list handler 가 소스에서 제거되면 매핑 대상 소멸을 backend 추출 실패로 검출한다 (negative (e) — list handler 부재)', () => {
    // 유일 route 인 list 가 없는(=제거된) 소스에서 추출하면 handler 미검출 → 계약 method null.
    const withoutList = extractHandlerMethods(['  @UseGuards(JwtAuthGuard)', '  async somethingElse() {}'].join('\n'));
    expect(withoutList.list).toBeUndefined(); // list 매핑 대상 소멸
    const orphan: BackendContract = { ...LIST_CONTRACT, method: withoutList.list?.method ?? null, subPath: withoutList.list?.subPath ?? '' };
    expect(orphan.method).toBeNull();
    expect(diffContract(permissionDeniedFire(), orphan)).toEqual(['backend 계약 추출 실패']);
  });
  it('주석 줄의 "@Get()"/"@Controller(...)"/상수 경로 언급을 실 decorator·상수로 오인하지 않는다 (negative (f) — 주석 false-positive)', () => {
    const fakeController = ['  // @Controller("api/permission-denied-records") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Get() — 주석뿐, decorator 없음', '  async list() {}'].join('\n');
    const fakeConst = ['// const PERMISSION_DENIED_RECORDS_PATH = "/api/spoofed";', 'export const y = 1;'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).list).toBeUndefined();
    expect(extractConstantPath(fakeConst, 'PERMISSION_DENIED_RECORDS_PATH')).toBeNull(); // 주석 상수 무시
    const drifted: BackendContract = { ...LIST_CONTRACT, route: extractControllerRoute(fakeController), method: extractHandlerMethods(fakeHandler).list?.method ?? null };
    expect(diffContract(permissionDeniedFire(), drifted)).toEqual(['backend 계약 추출 실패']);
  });
  it('web call site 가 옵션 인자를 전달하면(단일 인자 아님) GET 추론이 깨져 method 불일치로 잡힌다 (negative — 발사 override drift)', () => {
    const overridden = extractPermissionDeniedFireMethod("const x = useApiResource<PermissionDeniedRecordRow[]>(path, { method: 'POST' });");
    expect(overridden).toBe('NON-GET(args=2)'); // 옵션 인자 존재 → GET 아님
    const fired: WebFire = { path: BASE, method: overridden ?? 'GET', queryParams: [] };
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('빈 소스 입력이면 추출기가 null·빈 객체를 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractHandlerParams('', 'list')).toBeNull();
    expect(extractConstantPath('', 'PERMISSION_DENIED_RECORDS_PATH')).toBeNull();
    expect(extractPermissionDeniedFireMethod('')).toBeNull();
    expect(extractQueryDecoratorNames(null)).toEqual([]);
    const empty: BackendContract = { route: extractControllerRoute(''), method: extractHandlerMethods('').list?.method ?? null, subPath: '', queryParams: [] };
    expect(diffContract(permissionDeniedFire(), empty)).toEqual(['backend 계약 추출 실패']);
  });
});
