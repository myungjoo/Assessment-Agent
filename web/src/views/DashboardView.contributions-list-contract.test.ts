import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildContributionsPath } from './DashboardView';
// 공용 invariant 추출기(T-1201)를 alphabetical named import 로 재사용(중복 inline 0); contributions-전용 추출만 spec 로컬 정의.
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

// R-112 — 평가 상세 조회(GET /api/contributions) web↔backend **계약 drift guard**(T-1235,
// DashboardView 4 GET 중 세 번째 slice). T-1234(summaries)의 bare @Get() vs @Get(":id") 판별
// 축을 mirror 하되 소비처는 buildContributionsPath, backend 는 contribution.controller.ts 다.
// 결정적 차이: buildContributionsPath 는 assessmentId falsy 시 **null 반환**(조회 미수행 가드)하는
// null-gate 분기를 명시 대조하고, query param 은 assessmentId **단일**이다(summaries 의 2 param 보다
// 단순). web bare-route list 는 findByAssessment 에 매핑돼야 하며 :id detail·@Post() create 로
// 오인 금지. 정규식만 — 런타임 import·backend 기동 없이 소스 텍스트 대조.

interface BackendContract {
  route: string | null;
  method: string | null;
  subPath: string;
  queryParams: string[]; // @Query("...") 인자 이름 집합(정렬)
}
interface WebFire {
  path: string;
  method: string;
  queryParams: string[]; // fired path 의 query param 이름 집합(정렬)
}

// path param(: 로 시작하는 세그먼트) 목록 — bare list(0개)와 :id detail(1개) 판별 보조.
const pathParams = (route: string): string[] =>
  pathSegments(route).filter((seg) => seg.startsWith(':'));

// backend 핸들러 서명에서 @Query("name") 인자 이름을 모두 추출(정렬) — query 축 판별의 근거.
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

// DashboardView 조회 call site 의 발사 method 추론. useApiResource<ContributionRow[]>(path) 를
// 옵션 인자 없이(단일 인자) 호출 → fetch default GET. 인자 2+ 면 non-GET. <ContributionRow[]> 타입
// 인자로 형제 조회(<SummaryRow[]> 등)와 섞이지 않게 anchor 슬라이스한다.
function extractContributionsFireMethod(source: string): string | null {
  const matched = /useApiResource<ContributionRow\[\]>\(\s*([^)]*)\)/.exec(
    stripComments(source),
  );
  if (!matched) {
    return null;
  }
  const args = matched[1].split(',').map((arg) => arg.trim()).filter(Boolean);
  return args.length === 1 ? 'GET' : `NON-GET(args=${args.length})`;
}

// 불일치 사유 목록 — 빈 배열=계약 일치. 추출 실패도 통과가 아니라 사유 1건(선단언 방어). base 경로 +
// method + query param 이름 집합을 대조한다(query 는 route 대조 시 strip, param 이름은 별도 축).
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
  if (fire.queryParams.join(',') !== backend.queryParams.join(',')) {
    issues.push(
      `query param 불일치: ${fire.queryParams.join(',')} vs ${backend.queryParams.join(',')}`,
    );
  }
  return issues;
}

const CONTROLLER_SOURCE = readFileSync(
  new URL('../../../src/user/contribution.controller.ts', import.meta.url),
  'utf8',
);
const DASHBOARD_VIEW_SOURCE = readFileSync(
  new URL('./DashboardView.tsx', import.meta.url),
  'utf8',
);
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const FIND_BY_ASSESSMENT = HANDLERS.findByAssessment ?? null;
const FIND_ONE = HANDLERS.findOne ?? null;
const FIND_BY_ASSESSMENT_PARAMS = extractHandlerParams(CONTROLLER_SOURCE, 'findByAssessment');
const FIND_ONE_PARAMS = extractHandlerParams(CONTROLLER_SOURCE, 'findOne');
const WEB_FIRE_METHOD = extractContributionsFireMethod(DASHBOARD_VIEW_SOURCE);
const BACKEND_QUERY_PARAMS = extractQueryDecoratorNames(FIND_BY_ASSESSMENT_PARAMS);
const LIST_CONTRACT: BackendContract = {
  route: ROUTE,
  method: FIND_BY_ASSESSMENT?.method ?? null,
  subPath: FIND_BY_ASSESSMENT?.subPath ?? '',
  queryParams: BACKEND_QUERY_PARAMS,
};
const BASE = '/api/contributions';

// 조회 발사기 — assessmentId(필수)로 buildContributionsPath 산출을 감싼다(발사 method 는 GET).
const contributionsFire = (assessment = 'a1'): WebFire => {
  const path = buildContributionsPath(assessment) ?? '';
  return {
    path,
    method: WEB_FIRE_METHOD ?? 'GET',
    queryParams: extractPathQueryParams(path),
  };
};

describe('DashboardView — 평가 상세 조회(GET /api/contributions) web↔backend 계약 drift guard (T-1235)', () => {
  it('backend route/method/handler/param 과 web 발사 method 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(FIND_BY_ASSESSMENT).not.toBeNull();
    expect(LIST_CONTRACT.method).not.toBeNull();
    expect(FIND_BY_ASSESSMENT_PARAMS).not.toBeNull();
    expect(WEB_FIRE_METHOD).not.toBeNull();
  });
  it('backend @Controller("api/contributions") 2-세그먼트 base 를 /api/contributions 로 정규화한다 (분기 — base 파싱)', () => {
    expect(ROUTE).toBe('api/contributions');
    expect(String(ROUTE).split('/')).toHaveLength(2); // api·contributions
    expect(normalizeRoute(String(ROUTE))).toBe(BASE);
  });
  it('backend bare @Get() findByAssessment(세그먼트 0)를 base 와 합성해 path param 0개 template 을 만든다 (분기 — bare @Get 세그먼트 0 합성)', () => {
    expect(LIST_CONTRACT.method).toBe('GET');
    expect(LIST_CONTRACT.subPath).toBe(''); // @Get() bare — 추가 세그먼트 0
    const composed = composeRoute(String(ROUTE), LIST_CONTRACT.subPath);
    expect(composed).toBe(BASE);
    expect(pathSegments(composed)).toEqual(['api', 'contributions']); // 세그먼트 정확히 2개(추가 0)
    expect(pathParams(composed)).toEqual([]); // path param 정확히 0개
  });
  it('findByAssessment 이 @Query("assessmentId") 단일 optional query 를 받고 @Body 는 없다 (분기 — query 인자 집합 판별)', () => {
    expect(FIND_BY_ASSESSMENT_PARAMS).not.toBeNull();
    expect(/@Body\b/.test(FIND_BY_ASSESSMENT_PARAMS ?? '')).toBe(false); // GET 상세 조회 — body 계약 없음
    expect(BACKEND_QUERY_PARAMS).toEqual(['assessmentId']); // 단일 query 인자 정확 추출
  });
  it('같은 소스의 @Get(":id") findOne 은 세그먼트 1 + @Param 을 가져 @Get() findByAssessment(list)과 정확히 판별된다 (분기 — list-vs-detail 판별, 핵심 축)', () => {
    expect(FIND_ONE).not.toBeNull();
    expect(FIND_ONE?.method).toBe('GET'); // findOne 도 GET — method 만으로는 구분 불가
    expect(FIND_ONE?.subPath).toBe(':id'); // 세그먼트 1 — findByAssessment(세그먼트 0)과 구분되는 핵심
    expect(/@Param\b/.test(FIND_ONE_PARAMS ?? '')).toBe(true); // findOne 은 @Param("id")
    expect(extractQueryDecoratorNames(FIND_ONE_PARAMS)).toEqual([]); // detail 은 @Query 없음(list 와 대조)
    // 두 GET 을 서로 다른 route 로 정확히 추출 — 병합/오축소 금지.
    expect(composeRoute(String(ROUTE), FIND_BY_ASSESSMENT?.subPath ?? '')).toBe(BASE);
    expect(composeRoute(String(ROUTE), FIND_ONE?.subPath ?? '')).toBe(`${BASE}/:id`);
    expect(composeRoute(String(ROUTE), FIND_BY_ASSESSMENT?.subPath ?? '')).not.toBe(
      composeRoute(String(ROUTE), FIND_ONE?.subPath ?? ''),
    );
  });
  it('buildContributionsPath("a1") 발사(GET /api/contributions?assessmentId=)가 backend findByAssessment 계약과 완전 일치한다 (happy-path — 경로·query 정합)', () => {
    const fired = contributionsFire('a1');
    expect(fired.path).toBe(`${BASE}?assessmentId=a1`);
    expect(stripQuery(fired.path)).toBe(BASE); // query strip 후 base 는 backend route 와 일치
    expect(fired.queryParams).toEqual(['assessmentId']); // web fire query 집합 == backend @Query 집합
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([]);
  });
  it('web 조회 call site 가 옵션 인자 없이 useApiResource 를 호출해 default GET 이고 backend 도 @Get 이다 (happy-path — method 정합)', () => {
    expect(WEB_FIRE_METHOD).toBe('GET'); // 단일 인자 호출 → fetch default GET
    expect(LIST_CONTRACT.method).toBe('GET'); // backend 는 @Get(POST/DELETE 아님)
    expect(contributionsFire().method).toBe(LIST_CONTRACT.method); // 양측 method == GET
  });
  it('assessmentId truthy 면 /api/contributions?... 문자열을 반환(조회 fire)하고, 그 base 는 backend 계약과 일치한다 (branch — assessmentId 有 → fire)', () => {
    const fired = buildContributionsPath('a1');
    expect(fired).not.toBeNull();
    expect(typeof fired).toBe('string');
    expect(fired).toBe(`${BASE}?assessmentId=a1`);
    expect(stripQuery(String(fired))).toBe(composeRoute(String(ROUTE), LIST_CONTRACT.subPath));
  });
  it.each<[string, string | undefined]>([
    ['assessmentId=undefined', undefined],
    ['assessmentId="" (빈 문자열)', ''],
  ])('assessmentId 가 falsy(%s)면 null 을 반환(조회 미수행)하고, 발사 자체가 없어 계약 대조 대상에서 제외된다 (branch — null-gate, 드리프트 불가)', (_label, assessment) => {
    const gated = buildContributionsPath(assessment);
    // null 은 fire 가 아니므로 web↔backend 드리프트가 성립하지 않는다(대조 대상 제외 명시).
    expect(gated).toBeNull(); // 조회 path 미생성 → useApiResource(null) → fetch skip
    expect(gated).not.toBe(`${BASE}?assessmentId=`); // 빈 assessmentId 를 실어 보내지 않음(400 회피)
  });
  it('query 유무는 route 판정을 바꾸지 않는다 — ?assessmentId= 는 stripQuery 로 제거돼 base 대조에 영향이 없다 (branch — query 무해)', () => {
    const fired = contributionsFire('a1');
    expect(fired.path).toBe(`${BASE}?assessmentId=a1`); // query 有 fire
    expect(stripQuery(fired.path)).toBe(BASE); // strip 후 base 만 남음
    expect(stripQuery(`${BASE}?assessmentId=zzz`)).toBe(stripQuery(fired.path)); // query 값이 달라도 base 동일
    expect(stripQuery(BASE)).toBe(BASE); // query 부재 path 도 동일 base
  });
  it('extractPathQueryParams 는 ? query 가 없는 path 에 빈 배열을 반환한다 (branch — null-query 방어 분기)', () => {
    expect(extractPathQueryParams(BASE)).toEqual([]); // query 부재 → 빈 집합(방어 분기 cover)
    expect(extractPathQueryParams(`${BASE}?assessmentId=a1`)).toEqual(['assessmentId']); // query 有 → 정상 추출
  });
  it.each<[string, () => BackendContract]>([
    ['(a) base 를 api/contribution(단수 오타)로', () => ({ ...LIST_CONTRACT, route: 'api/contribution' })],
    ['(a) base 를 api/commits(오리엔트 drift)로', () => ({ ...LIST_CONTRACT, route: 'api/commits' })],
  ])('backend base 가 %s 바뀌면 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', (_label, build) => {
    expect(diffContract(contributionsFire(), build())).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, string]>([
    ['(b) @Post 로', '  @Post()'],
    ['(b) @Delete 로', '  @Delete()'],
  ])('findByAssessment 이 %s method 로 drift 하면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 GET 발사)', (_label, decorator) => {
    const handler = extractHandlerMethods([decorator, '  async findByAssessment() {}'].join('\n')).findByAssessment;
    expect(diffContract(contributionsFire(), { ...LIST_CONTRACT, method: handler.method })).toEqual([expect.stringContaining('method 불일치')]);
  });
  it.each<[string, string]>([
    ['(c) @Get(":id")(detail 세그먼트 1)로', ':id'],
    ['(c) @Get("all")(literal 세그먼트 1)로', 'all'],
  ])('web bare list 발사를 findByAssessment 이 @Get("%s") 로 오변형된 계약에 대면 path 불일치로 잡힌다 — list 가 detail 로 오인되지 않음 (negative (c) — bare vs :id 혼동)', (_label, subPath) => {
    const handler = extractHandlerMethods([`  @Get("${subPath}")`, '  async findByAssessment() {}'].join('\n')).findByAssessment;
    expect(handler.subPath).toBe(subPath);
    expect(diffContract(contributionsFire(), { ...LIST_CONTRACT, subPath: handler.subPath })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('web 이 /api/contributions/:id detail 또는 create(POST) 를 fire 하도록 오변형되면 bare list(findByAssessment) 매핑이 깨져 불일치로 잡힌다 (negative (c) — web 측 :id/create 혼동)', () => {
    const detailFire: WebFire = { path: `${BASE}/:id?assessmentId=a1`, method: 'GET', queryParams: ['assessmentId'] };
    expect(stripQuery(detailFire.path)).toBe(`${BASE}/:id`); // detail 세그먼트는 query strip 후에도 남음
    expect(diffContract(detailFire, LIST_CONTRACT)).toEqual([expect.stringContaining('path 불일치')]);
    // create(@Post()) 계약에 web GET list 발사를 대면 method·query 불일치 — list GET 이 create POST 로 오인되지 않음.
    const createContract: BackendContract = { ...LIST_CONTRACT, method: HANDLERS.create?.method ?? null, queryParams: [] };
    expect(diffContract(contributionsFire(), createContract)).toEqual(expect.arrayContaining([expect.stringContaining('method 불일치'), expect.stringContaining('query param 불일치')]));
    // 역으로, bare list fire 를 findOne(:id) 계약에 대면 path·query 불일치 — 서로 오인되지 않음.
    const findOneContract: BackendContract = { ...LIST_CONTRACT, subPath: FIND_ONE?.subPath ?? '', queryParams: [] };
    expect(diffContract(contributionsFire(), findOneContract)).toEqual(expect.arrayContaining([expect.stringContaining('path 불일치'), expect.stringContaining('query param 불일치')]));
  });
  it.each<[string, string[]]>([
    ['(d) assessmentId → assessment 로 rename', ['assessment']],
    ['(d) query 제거(빈 집합)', []],
  ])('backend @Query 집합이 %s 로 drift 하면 query param 불일치로 잡힌다 (negative (d) — query param 이름 drift)', (_label, queryParams) => {
    expect(diffContract(contributionsFire('a1'), { ...LIST_CONTRACT, queryParams })).toEqual([expect.stringContaining('query param 불일치')]);
  });
  it('@Get() findByAssessment(list handler)가 소스에서 제거되면 매핑 대상 소멸을 backend 추출 실패로 검출한다 (negative (e) — list handler 부재)', () => {
    // findByAssessment 핸들러가 없는(=list 제거된) 소스에서 추출하면 handler 미검출 → 계약 method null.
    const withoutList = extractHandlerMethods(['  @Get(":id")', '  async findOne() {}', '  @Post()', '  async create() {}'].join('\n'));
    expect(withoutList.findByAssessment).toBeUndefined(); // list 매핑 대상 소멸
    const orphan: BackendContract = { ...LIST_CONTRACT, method: withoutList.findByAssessment?.method ?? null, subPath: withoutList.findByAssessment?.subPath ?? '' };
    expect(orphan.method).toBeNull();
    expect(diffContract(contributionsFire(), orphan)).toEqual(['backend 계약 추출 실패']);
  });
  it('mutation/detail 대조군(create @Post()/findOne @Get(":id")/remove @Delete(":id"))을 list 핸들러로 오인하지 않고 @Get() findByAssessment 을 정확히 선택한다 (negative (f) — 대조군 혼동)', () => {
    expect(FIND_BY_ASSESSMENT?.method).toBe('GET'); // findByAssessment 만 목록 GET(세그먼트 0)
    expect(HANDLERS.findOne).toEqual({ method: 'GET', subPath: ':id' }); // detail GET(세그먼트 1)
    expect(HANDLERS.create).toEqual({ method: 'POST', subPath: '' }); // create 는 POST — GET 조회로 오인 금지
    expect(HANDLERS.remove).toEqual({ method: 'DELETE', subPath: ':id' }); // remove 는 DELETE(:id)
    expect(LIST_CONTRACT.subPath).toBe(''); // findByAssessment 의 bare @Get — 세그먼트 0 유지(mutation :id 흡수 안 함)
  });
  it('주석 줄의 "@Get()"/"@Controller(...)"/"GET /api/contributions" 를 실 decorator 로 오인하지 않는다 (negative (g) — 주석 false-positive)', () => {
    const fakeController = ['  // @Controller("api/contributions") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Get() — 주석뿐, decorator 없음', '  async findByAssessment() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).findByAssessment).toBeUndefined();
    const drifted: BackendContract = { ...LIST_CONTRACT, route: extractControllerRoute(fakeController), method: extractHandlerMethods(fakeHandler).findByAssessment?.method ?? null };
    expect(diffContract(contributionsFire(), drifted)).toEqual(['backend 계약 추출 실패']);
  });
  it('web call site 가 옵션 인자를 전달하면(단일 인자 아님) GET 추론이 깨져 method 불일치로 잡힌다 (negative — 발사 override drift)', () => {
    const overridden = extractContributionsFireMethod("const x = useApiResource<ContributionRow[]>(path, { method: 'POST' });");
    expect(overridden).toBe('NON-GET(args=2)'); // 옵션 인자 존재 → GET 아님
    const fired: WebFire = { path: `${BASE}?assessmentId=a1`, method: overridden ?? 'GET', queryParams: ['assessmentId'] };
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('빈 소스 입력이면 추출기가 null·빈 객체를 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractHandlerParams('', 'findByAssessment')).toBeNull();
    expect(extractContributionsFireMethod('')).toBeNull();
    expect(extractQueryDecoratorNames(null)).toEqual([]);
    const empty: BackendContract = { route: extractControllerRoute(''), method: extractHandlerMethods('').findByAssessment?.method ?? null, subPath: '', queryParams: [] };
    expect(diffContract(contributionsFire(), empty)).toEqual(['backend 계약 추출 실패']);
  });
});
