import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildAssessmentsPath } from './DashboardView';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본 없이 named import 로 재사용(중복 정의 0).
// alphabetical: composeRoute·extractControllerRoute·extractHandlerMethods·extractHandlerParams·
// normalizeRoute·pathSegments·stripComments·stripQuery. assessments-전용 추출(query param 이름 집합·
// 발사 method·diffContract)만 이 spec 로컬에 정의한다(helper 확장은 Out of Scope — Follow-up).
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

// R-112 — 시계열 평가 결과 조회(GET /api/assessments) web↔backend **계약 drift guard**(T-1233,
// DashboardView 4 GET 중 첫 slice). 선례 AdminView.persons-list-contract.test.ts(T-1190) 의
// bare @Get() vs @Get(":id") 판별 축을 그대로 mirror 하되 **소비처는 DashboardView.tsx**
// (buildAssessmentsPath) 이고, backend 는 assessment.controller.ts 의 findByPerson(@Get() list) vs
// findOne(@Get(":id") detail) 다. persons 와의 결정적 차이: findByPerson 은 **@Query("personId")·
// @Query("period") 두 optional query 를 받는다** — 그래서 본 spec 은 route/method 축에 더해
// **query param 이름 집합** 축을 추가로 대조한다(web 이 fire 하는 ?personId=&period= 가 backend
// @Query 인자와 정확히 일치해야 함). 판별 핵심: web 이 fire 하는 bare-route list 는 findByPerson 에
// 매핑돼야 하며 :id detail(findOne) 로 오인되면 안 된다. 정규식 추출기만 — 새 devDependency 0.

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

// backend 핸들러 서명에서 @Query("name") 인자 이름을 모두 추출(정렬). findByPerson 은
// {personId, period}, findOne 은 @Param 만이라 [] 를 낸다 — query 축 판별의 근거.
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

// fired path 의 query string 에서 param 이름 집합을 추출(정렬). `?personId=p1&period=week`
// → [period, personId]. query 부재 시 빈 배열. web 이 실제로 실어 보내는 param 이름을 낸다.
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

// DashboardView 조회 call site 의 발사 method 추론. `useApiResource<EvaluationResultRow[]>(path)` 를
// 옵션 인자 없이(단일 인자) 호출 → request→fetch default GET. 인자 2+ (options 전달)면 non-GET 가능.
// 형제 조회(useApiResource<SummaryRow[]>·<ContributionRow[]>·<PermissionDeniedRecordRow[]>)와
// 섞이지 않도록 <EvaluationResultRow[]> 타입 인자를 명시 anchor 로 슬라이스한다.
function extractAssessmentsFireMethod(source: string): string | null {
  const matched = /useApiResource<EvaluationResultRow\[\]>\(\s*([^)]*)\)/.exec(
    stripComments(source),
  );
  if (!matched) {
    return null;
  }
  const args = matched[1].split(',').map((arg) => arg.trim()).filter(Boolean);
  return args.length === 1 ? 'GET' : `NON-GET(args=${args.length})`;
}

// 불일치 사유 목록 — 빈 배열=계약 일치. 추출 실패도 통과가 아니라 사유 1건(선단언 방어). GET 시계열
// 조회는 base 경로 + method + query param 이름 집합을 대조한다(query 는 route 대조 시 strip 후 base 만
// 보되, param 이름 집합은 별도 축으로 정확 대조 — personId→userId·period 제거 drift 검출).
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
  new URL('../../../src/user/assessment.controller.ts', import.meta.url),
  'utf8',
);
const DASHBOARD_VIEW_SOURCE = readFileSync(
  new URL('./DashboardView.tsx', import.meta.url),
  'utf8',
);
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const FIND_BY_PERSON = HANDLERS.findByPerson ?? null;
const FIND_ONE = HANDLERS.findOne ?? null;
const FIND_BY_PERSON_PARAMS = extractHandlerParams(CONTROLLER_SOURCE, 'findByPerson');
const FIND_ONE_PARAMS = extractHandlerParams(CONTROLLER_SOURCE, 'findOne');
const WEB_FIRE_METHOD = extractAssessmentsFireMethod(DASHBOARD_VIEW_SOURCE);
const BACKEND_QUERY_PARAMS = extractQueryDecoratorNames(FIND_BY_PERSON_PARAMS);
const LIST_CONTRACT: BackendContract = {
  route: ROUTE,
  method: FIND_BY_PERSON?.method ?? null,
  subPath: FIND_BY_PERSON?.subPath ?? '',
  queryParams: BACKEND_QUERY_PARAMS,
};
const BASE = '/api/assessments';

// 조회 발사기 — personId(필수)·period(선택)로 buildAssessmentsPath 산출을 그대로 감싼다.
// period 미지정이면 web 은 personId 만 실어 보낸다. 발사 method 는 call site 추론값(GET).
const assessmentsFire = (
  person = 'p1',
  period: string | undefined = 'week',
): WebFire => {
  const path = buildAssessmentsPath(person, period) ?? '';
  return {
    path,
    method: WEB_FIRE_METHOD ?? 'GET',
    queryParams: extractPathQueryParams(path),
  };
};

describe('DashboardView — 시계열 평가 결과 조회(GET /api/assessments) web↔backend 계약 drift guard (T-1233)', () => {
  it('backend route/method/handler/param 과 web 발사 method 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(FIND_BY_PERSON).not.toBeNull();
    expect(LIST_CONTRACT.method).not.toBeNull();
    expect(FIND_BY_PERSON_PARAMS).not.toBeNull();
    expect(WEB_FIRE_METHOD).not.toBeNull();
  });
  it('backend @Controller("api/assessments") 2-세그먼트 base 를 /api/assessments 로 정규화한다 (분기 — base 파싱)', () => {
    expect(ROUTE).toBe('api/assessments');
    expect(String(ROUTE).split('/')).toHaveLength(2); // api·assessments
    expect(normalizeRoute(String(ROUTE))).toBe(BASE);
  });
  it('backend bare @Get() findByPerson(세그먼트 0)를 base 와 합성해 path param 0개 template 을 만든다 (분기 — bare @Get 세그먼트 0 합성)', () => {
    expect(LIST_CONTRACT.method).toBe('GET');
    expect(LIST_CONTRACT.subPath).toBe(''); // @Get() bare — 추가 세그먼트 0
    const composed = composeRoute(String(ROUTE), LIST_CONTRACT.subPath);
    expect(composed).toBe(BASE);
    expect(pathSegments(composed)).toEqual(['api', 'assessments']); // 세그먼트 정확히 2개(추가 0)
    expect(pathParams(composed)).toEqual([]); // path param 정확히 0개
  });
  it('findByPerson 이 @Query("personId")·@Query("period") 두 optional query 를 받고 @Body 는 없다 (분기 — query 인자 집합 판별)', () => {
    expect(FIND_BY_PERSON_PARAMS).not.toBeNull();
    expect(/@Body\b/.test(FIND_BY_PERSON_PARAMS ?? '')).toBe(false); // GET 시계열 조회 — body 계약 없음
    expect(BACKEND_QUERY_PARAMS).toEqual(['period', 'personId']); // 정렬된 두 query 인자 정확 추출
  });
  it('같은 소스의 @Get(":id") findOne 은 세그먼트 1 + @Param 을 가져 @Get() findByPerson(list)과 정확히 판별된다 (분기 — list-vs-detail 판별, 핵심 축)', () => {
    expect(FIND_ONE).not.toBeNull();
    expect(FIND_ONE?.method).toBe('GET'); // findOne 도 GET — method 만으로는 구분 불가
    expect(FIND_ONE?.subPath).toBe(':id'); // 세그먼트 1 — findByPerson(세그먼트 0)과 구분되는 핵심
    expect(/@Param\b/.test(FIND_ONE_PARAMS ?? '')).toBe(true); // findOne 은 @Param("id")
    expect(extractQueryDecoratorNames(FIND_ONE_PARAMS)).toEqual([]); // detail 은 @Query 없음(list 와 대조)
    // 두 GET 을 서로 다른 route 로 정확히 추출 — 병합/오축소 금지.
    expect(composeRoute(String(ROUTE), FIND_BY_PERSON?.subPath ?? '')).toBe(BASE);
    expect(composeRoute(String(ROUTE), FIND_ONE?.subPath ?? '')).toBe(`${BASE}/:id`);
    expect(composeRoute(String(ROUTE), FIND_BY_PERSON?.subPath ?? '')).not.toBe(
      composeRoute(String(ROUTE), FIND_ONE?.subPath ?? ''),
    );
  });
  it('buildAssessmentsPath("p1","week") 발사(GET /api/assessments?personId=&period=)가 backend findByPerson 계약과 완전 일치한다 (happy-path — 경로·query 정합)', () => {
    const fired = assessmentsFire('p1', 'week');
    expect(fired.path).toBe(`${BASE}?personId=p1&period=week`);
    expect(stripQuery(fired.path)).toBe(BASE); // query strip 후 base 는 backend route 와 일치
    expect(fired.queryParams).toEqual(['period', 'personId']); // web fire query 집합 == backend @Query 집합
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([]);
  });
  it('web 조회 call site 가 옵션 인자 없이 useApiResource 를 호출해 default GET 이고 backend 도 @Get 이다 (happy-path — method 정합)', () => {
    expect(WEB_FIRE_METHOD).toBe('GET'); // 단일 인자 호출 → fetch default GET
    expect(LIST_CONTRACT.method).toBe('GET'); // backend 는 @Get(POST/DELETE 아님)
    expect(assessmentsFire().method).toBe(LIST_CONTRACT.method); // 양측 method == GET
  });
  it('period 미지정(personId 만) fire 도 base route 는 backend 와 동일하다 — query 유무는 route 판정을 바꾸지 않는다 (happy-path/branch — query 무해)', () => {
    const withPeriod = assessmentsFire('p1', 'week');
    // period 미지정 fire — 래퍼의 기본 인자('week')가 개입하지 않도록 buildAssessmentsPath 를 직접 감싼다.
    const withoutPath = buildAssessmentsPath('p1', undefined) ?? '';
    const withoutPeriod: WebFire = {
      path: withoutPath,
      method: WEB_FIRE_METHOD ?? 'GET',
      queryParams: extractPathQueryParams(withoutPath),
    };
    expect(withoutPeriod.path).toBe(`${BASE}?personId=p1`); // period 없으면 personId 만 실림
    expect(stripQuery(withoutPeriod.path)).toBe(stripQuery(withPeriod.path)); // strip 후 base 동일
    expect(stripQuery(withoutPeriod.path)).toBe(BASE); // query 유무와 무관하게 base 일치
    // period 는 optional 이므로 personId 만 fire 해도 web param 은 backend @Query 집합의 부분집합.
    expect(withoutPeriod.queryParams.every((p) => BACKEND_QUERY_PARAMS.includes(p))).toBe(true);
  });
  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it.each<[string, () => BackendContract]>([
    ['(a) base 를 api/evaluations(오리엔트 drift)로', () => ({ ...LIST_CONTRACT, route: 'api/evaluations' })],
    ['(a) base 를 api/assessment(단수 오타)로', () => ({ ...LIST_CONTRACT, route: 'api/assessment' })],
    ['(a) base 를 api/assessments-x(접미 drift)로', () => ({ ...LIST_CONTRACT, route: 'api/assessments-x' })],
  ])('backend base 가 %s 바뀌면 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', (_label, build) => {
    expect(diffContract(assessmentsFire(), build())).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, string]>([
    ['(b) @Post 로', '  @Post()'],
    ['(b) @Put 으로', '  @Put()'],
    ['(b) @Delete 로', '  @Delete()'],
  ])('findByPerson 이 %s method 로 drift 하면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 GET 발사)', (_label, decorator) => {
    const handler = extractHandlerMethods([decorator, '  async findByPerson() {}'].join('\n')).findByPerson;
    expect(diffContract(assessmentsFire(), { ...LIST_CONTRACT, method: handler.method })).toEqual([expect.stringContaining('method 불일치')]);
  });
  it.each<[string, string]>([
    ['(c) @Get(":id")(detail 세그먼트 1)로', ':id'],
    ['(c) @Get("all")(literal 세그먼트 1)로', 'all'],
  ])('web bare list 발사를 findByPerson 이 @Get("%s") 로 오변형된 계약에 대면 path 불일치로 잡힌다 — list 가 detail 로 오인되지 않음 (negative (c) — bare vs :id 혼동)', (_label, subPath) => {
    const handler = extractHandlerMethods([`  @Get("${subPath}")`, '  async findByPerson() {}'].join('\n')).findByPerson;
    expect(handler.subPath).toBe(subPath);
    expect(diffContract(assessmentsFire(), { ...LIST_CONTRACT, subPath: handler.subPath })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('web 이 /api/assessments/:id detail 을 fire 하도록 오변형되면 bare list(findByPerson) 매핑이 깨져 path 불일치로 잡힌다 (negative (c) — web 측 :id 혼동)', () => {
    const detailFire: WebFire = { path: `${BASE}/:id?personId=p1&period=week`, method: 'GET', queryParams: ['period', 'personId'] };
    expect(stripQuery(detailFire.path)).toBe(`${BASE}/:id`); // detail 세그먼트는 query strip 후에도 남음
    expect(diffContract(detailFire, LIST_CONTRACT)).toEqual([expect.stringContaining('path 불일치')]);
    // 역으로, bare list fire 를 findOne(:id) 계약에 대면 path 불일치 — 서로 오인되지 않음.
    const findOneContract: BackendContract = { ...LIST_CONTRACT, subPath: FIND_ONE?.subPath ?? '', queryParams: [] };
    expect(diffContract(assessmentsFire(), findOneContract)).toEqual(
      expect.arrayContaining([expect.stringContaining('path 불일치'), expect.stringContaining('query param 불일치')]),
    );
  });
  it.each<[string, string[]]>([
    ['(d) personId → userId 로 rename', ['period', 'userId']],
    ['(d) period 제거(personId 만)', ['personId']],
    ['(d) 무관 param(groupId) 추가', ['groupId', 'period', 'personId']],
  ])('backend @Query 집합이 %s 로 drift 하면 query param 불일치로 잡힌다 (negative (d) — query param 이름 drift)', (_label, queryParams) => {
    expect(diffContract(assessmentsFire('p1', 'week'), { ...LIST_CONTRACT, queryParams })).toEqual([expect.stringContaining('query param 불일치')]);
  });
  it('@Get() findByPerson(list handler)가 소스에서 제거되면 매핑 대상 소멸을 backend 추출 실패로 검출한다 (negative (e) — list handler 부재)', () => {
    // findByPerson 핸들러가 없는(=list 제거된) 소스에서 추출하면 handler 미검출 → 계약 method null.
    const withoutList = extractHandlerMethods(
      ['  @Get(":id")', '  async findOne() {}', '  @Post()', '  async create() {}'].join('\n'),
    );
    expect(withoutList.findByPerson).toBeUndefined(); // list 매핑 대상 소멸
    const orphan: BackendContract = { ...LIST_CONTRACT, method: withoutList.findByPerson?.method ?? null, subPath: withoutList.findByPerson?.subPath ?? '' };
    expect(orphan.method).toBeNull();
    expect(diffContract(assessmentsFire(), orphan)).toEqual(['backend 계약 추출 실패']);
  });
  it('mutation/detail 대조군(create @Post()/findOne @Get(":id")/remove @Delete(":id"))을 list 핸들러로 오인하지 않고 @Get() findByPerson 을 정확히 선택한다 (negative (f) — 대조군 혼동)', () => {
    expect(FIND_BY_PERSON?.method).toBe('GET'); // findByPerson 만 목록 GET(세그먼트 0)
    expect(HANDLERS.findOne).toEqual({ method: 'GET', subPath: ':id' }); // detail GET(세그먼트 1)
    expect(HANDLERS.create).toEqual({ method: 'POST', subPath: '' }); // create 는 POST — GET 조회로 오인 금지
    expect(HANDLERS.remove).toEqual({ method: 'DELETE', subPath: ':id' }); // remove 는 DELETE(:id)
    expect(LIST_CONTRACT.subPath).toBe(''); // findByPerson 의 bare @Get — 세그먼트 0 유지(mutation :id 흡수 안 함)
  });
  it('주석 줄의 "@Get()"/"@Controller(...)"/"GET /api/assessments" 를 실 decorator 로 오인하지 않는다 (negative (g) — 주석 false-positive)', () => {
    const fakeController = ['  // @Controller("api/assessments") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Get() — 주석뿐, decorator 없음', '  async findByPerson() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).findByPerson).toBeUndefined();
    const drifted: BackendContract = { ...LIST_CONTRACT, route: extractControllerRoute(fakeController), method: extractHandlerMethods(fakeHandler).findByPerson?.method ?? null };
    expect(diffContract(assessmentsFire(), drifted)).toEqual(['backend 계약 추출 실패']);
  });
  it('web call site 가 옵션 인자를 전달하면(단일 인자 아님) GET 추론이 깨져 method 불일치로 잡힌다 (negative — 발사 override drift)', () => {
    const overridden = extractAssessmentsFireMethod(
      ["const x = useApiResource<EvaluationResultRow[]>(path, { method: 'POST' });"].join('\n'),
    );
    expect(overridden).toBe('NON-GET(args=2)'); // 옵션 인자 존재 → GET 아님
    const fired: WebFire = { path: `${BASE}?personId=p1&period=week`, method: overridden ?? 'GET', queryParams: ['period', 'personId'] };
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('빈 소스 입력이면 추출기가 null·빈 객체를 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractHandlerParams('', 'findByPerson')).toBeNull();
    expect(extractAssessmentsFireMethod('')).toBeNull();
    expect(extractQueryDecoratorNames(null)).toEqual([]);
    const empty: BackendContract = { route: extractControllerRoute(''), method: extractHandlerMethods('').findByPerson?.method ?? null, subPath: '', queryParams: [] };
    expect(diffContract(assessmentsFire(), empty)).toEqual(['backend 계약 추출 실패']);
  });
});
