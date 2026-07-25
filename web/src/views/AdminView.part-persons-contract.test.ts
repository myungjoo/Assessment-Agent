import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPartPersonsPath } from './AdminView';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본 삭제·동작 무변경(T-1221 이관 slice).
// 이 spec 이 참조하는 export 중 **공용과 글자-동일한 5종만** import. richer extractHandlerMethods(5-field
// hasBody/hasParam/hasQuery)·HandlerDecorator(5-field)·pathParams·extractPersonsFireMethod/per-spec 타입/diffContract 는 inline 유지.
import {
  composeRoute,
  extractControllerRoute,
  normalizeRoute,
  stripComments,
  stripQuery,
} from './__contract-guard__/contract-extractors';

// R-112 — 파트 소속 인원 조회(GET /api/parts/:id/persons) web↔backend **계약 drift guard**.
// 직전 파트 GET-list slice(T-1191, @Get() findAll · bare base)의 mirror — 발사 대상을 findAll →
// findPersons(:id/persons)로 바꾸고 GET 패턴(GET method · `?_r=nonce` 무해 · 추출기/대조기 정규식)을
// 재적용하되 **새 발사 축 3종** 을 추가한다: (1) path-param `:id` + literal `persons` 세그먼트 합성
// (@Get(":id/persons") 는 세그먼트 2), (2) 조건부 null 발사(idle) — 미선택(falsy id) 시 web 이 아예
// 발사하지 않음(깨진 `/api/parts//persons` 404 예방)을 계약 무위반으로 명시, (3) encodeURIComponent
// path-param 안전 인코딩 — 비정상 id 도 세그먼트 구조를 안 깨뜨림. **판별 축(3-way GET)**: 같은 소스의
// @Get() findAll(세그먼트 0)·@Get(":id") findById(세그먼트 1)·@Get(":id/persons") findPersons(세그먼트 2)
// 를 추출기가 정확히 판별해야 한다. mutation(create/update/delete)은 method drift 대조군. 정규식 추출기만
// — 새 devDependency 0, 공용 helper 추출은 Out of Scope refactor slice.

interface HandlerDecorator {
  method: string;
  subPath: string;
  hasBody: boolean;
  hasParam: boolean;
  hasQuery: boolean;
}
// HTTP method + sub-path + 시그니처의 @Body/@Param/@Query 존재. 멀티라인 시그니처는 handler 줄부터
// 괄호 균형 0 까지 이어붙여 인자 decorator 를 탐지. GET findAll 은 인자 0, findById/findPersons 는 @Param 1 이 정답.
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
// AdminView 소속 인원 조회 call site 의 발사 method 추론. `useApiResource<PersonRow[]>(partPersonsPath)` 를
// 옵션 인자 없이(단일 인자) 호출 → request→fetch default GET. 인자 2+ (options 전달) 면 non-GET 가능.
// 제네릭 PersonRow[] + 소문자 partPersonsPath 변수(useMemo 결과)를 anchor — 형제 PartRow[] 발사와 자동 분리.
function extractPersonsFireMethod(source: string): string | null {
  const matched = /useApiResource<PersonRow\[\]>\(\s*(partPersonsPath[^)]*)\)/.exec(stripComments(source));
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
const pathParams = (route: string): string[] => route.split('/').filter((seg) => seg.startsWith(':'));
// route template 의 `:id` 를 실 id(web 과 동일하게 encodeURIComponent)로 치환한 기대 path. encodeURIComponent
// 는 `:`→`%3A`·`/`→`%2F` 로 인코딩하므로 치환 후 param 값이 literal `persons` 세그먼트를 삼키지 않는다.
function expectedPath(route: string, subPath: string, id: string): string {
  return composeRoute(route, subPath).replace(':id', encodeURIComponent(id));
}
// 불일치 사유 목록 — 빈 배열=계약 일치. 추출 실패도 통과가 아니라 사유 1건(선단언 방어). GET 조회는 body/query
// 계약이 없으므로 base 경로 + method 만 대조하되, query 는 strip 후 base 만 본다(진짜 세그먼트는 그대로 잡힘).
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
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/part.controller.ts', import.meta.url), 'utf8');
const ADMIN_VIEW_SOURCE = readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const FIND_ALL = HANDLERS.findAll ?? null;
const FIND_BY_ID = HANDLERS.findById ?? null;
const FIND_PERSONS = HANDLERS.findPersons ?? null;
const WEB_FIRE_METHOD = extractPersonsFireMethod(ADMIN_VIEW_SOURCE);
const PERSONS_CONTRACT: BackendContract = {
  route: ROUTE,
  method: FIND_PERSONS?.method ?? null,
  subPath: FIND_PERSONS?.subPath ?? '',
  hasBody: FIND_PERSONS?.hasBody ?? false,
  hasParam: FIND_PERSONS?.hasParam ?? false,
  hasQuery: FIND_PERSONS?.hasQuery ?? false,
};
const BASE = '/api/parts';
const PART_ID = 'p1';
// 발사 캡처 — 미선택(falsy id)이면 buildPartPersonsPath 가 null(idle)이라 발사가 없다. 발사가 있어야 하는
// 케이스에서만 호출하고, null 이면 명시적으로 throw(조건부 null 은 별도 idle 테스트에서 직접 검증).
function personsFire(id: string, nonce = 0): WebFire {
  const path = buildPartPersonsPath(id, nonce);
  if (path === null) {
    throw new Error(`발사가 없다(idle): id=${JSON.stringify(id)}`);
  }
  return { path, method: WEB_FIRE_METHOD ?? 'GET' };
}

describe('AdminView — 파트 소속 인원 조회 web↔backend 계약 drift guard (T-1192)', () => {
  it('backend route/method 와 web 발사 method 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(PERSONS_CONTRACT.method).not.toBeNull();
    expect(PERSONS_CONTRACT.subPath).toBe(':id/persons');
    expect(WEB_FIRE_METHOD).not.toBeNull();
  });
  it('backend @Controller("api/parts") 2-세그먼트 base 를 /api/parts 로 정규화한다 (분기 — base 파싱)', () => {
    expect(ROUTE).toBe('api/parts');
    expect(String(ROUTE).split('/')).toHaveLength(2); // api·parts
    expect(normalizeRoute(String(ROUTE))).toBe(BASE);
  });
  it('backend @Get(":id/persons") 를 base 와 합성해 param 1 + literal persons 세그먼트(세그먼트 2) template 을 만든다 (분기 — path-param + literal 세그먼트 합성, 핵심 축)', () => {
    expect(PERSONS_CONTRACT.method).toBe('GET');
    expect(PERSONS_CONTRACT.subPath).toBe(':id/persons'); // @Get(":id/persons") — 세그먼트 2
    const composed = composeRoute(String(ROUTE), PERSONS_CONTRACT.subPath);
    expect(composed).toBe(`${BASE}/:id/persons`);
    const segments = composed.split('/').filter(Boolean); // api·parts·:id·persons
    expect(segments).toHaveLength(4);
    expect(pathParams(composed)).toEqual([':id']); // path param 정확히 1개(:id 슬롯)
    expect(segments[3]).toBe('persons'); // literal 세그먼트 정확히 'persons'
  });
  it('findPersons 핸들러가 @Param("id") 1개를 갖고 @Body·@Query 는 하나도 갖지 않는다 (분기 — 핸들러 인자)', () => {
    expect(FIND_PERSONS).not.toBeNull();
    expect(PERSONS_CONTRACT.hasParam).toBe(true); // @Param("id") 존재 — path param 계약
    expect(PERSONS_CONTRACT.hasBody).toBe(false); // GET 조회 — body 계약 없음
    expect(PERSONS_CONTRACT.hasQuery).toBe(false); // @Query 미선언 — `_r` 무시 근거
  });
  it('같은 소스의 @Get() findAll(세그먼트 0)·@Get(":id") findById(세그먼트 1)를 findPersons(세그먼트 2)와 3-way 로 정확히 판별한다 (분기 — 3-way GET 판별)', () => {
    expect(FIND_ALL).not.toBeNull();
    expect(FIND_BY_ID).not.toBeNull();
    expect(FIND_ALL?.method).toBe('GET'); // 셋 다 GET — method 만으로는 구분 불가
    expect(FIND_BY_ID?.method).toBe('GET');
    expect(FIND_PERSONS?.method).toBe('GET');
    expect(FIND_ALL?.subPath).toBe(''); // 세그먼트 0
    expect(FIND_BY_ID?.subPath).toBe(':id'); // 세그먼트 1
    expect(FIND_PERSONS?.subPath).toBe(':id/persons'); // 세그먼트 2
    // 세 GET 이 서로 다른 route 로 정확히 추출 — 병합/오축소 금지.
    expect(composeRoute(String(ROUTE), FIND_ALL?.subPath ?? '')).toBe(BASE);
    expect(composeRoute(String(ROUTE), FIND_BY_ID?.subPath ?? '')).toBe(`${BASE}/:id`);
    expect(composeRoute(String(ROUTE), FIND_PERSONS?.subPath ?? '')).toBe(`${BASE}/:id/persons`);
    const routes = new Set([
      composeRoute(String(ROUTE), FIND_ALL?.subPath ?? ''),
      composeRoute(String(ROUTE), FIND_BY_ID?.subPath ?? ''),
      composeRoute(String(ROUTE), FIND_PERSONS?.subPath ?? ''),
    ]);
    expect(routes.size).toBe(3); // pairwise 상이
  });
  it('buildPartPersonsPath("p1", 0) 발사(GET /api/parts/p1/persons)가 backend findPersons 계약과 완전 일치한다 (happy-path — 경로 정합)', () => {
    const fired = personsFire(PART_ID, 0);
    expect(buildPartPersonsPath(PART_ID, 0)).toBe(`${BASE}/p1/persons`);
    expect(fired.path).toBe(`${BASE}/p1/persons`);
    expect(diffContract(fired, PERSONS_CONTRACT, PART_ID)).toEqual([]);
  });
  it('web 조회 call site 가 옵션 인자 없이 useApiResource 를 호출해 default GET 이고 backend 도 @Get 이다 (happy-path — method 정합)', () => {
    expect(WEB_FIRE_METHOD).toBe('GET'); // 단일 인자 호출 → fetch default GET
    expect(PERSONS_CONTRACT.method).toBe('GET'); // backend 는 @Get(POST/PATCH/DELETE 아님)
    expect(personsFire(PART_ID, 0).method).toBe(PERSONS_CONTRACT.method); // 양측 method == GET
  });
  it('buildPartPersonsPath("p1", 5) 은 `?_r=5` cache-buster 를 붙이되 base 는 backend route 와 여전히 일치한다 (happy-path — query 무해)', () => {
    const fired = personsFire(PART_ID, 5);
    expect(fired.path).toBe(`${BASE}/p1/persons?_r=5`);
    expect(stripQuery(fired.path)).toBe(`${BASE}/p1/persons`); // `_r` strip 후 base 동일
    expect(diffContract(fired, PERSONS_CONTRACT, PART_ID)).toEqual([]); // query 는 drift 아님(부수효과 0)
  });
  it('buildPartPersonsPath(undefined)/("") 가 null 을 반환해 미선택 시 아예 발사하지 않는다 (분기 — 조건부 null 발사, idle 계약 무위반)', () => {
    expect(buildPartPersonsPath(undefined)).toBeNull(); // 미선택 → idle
    expect(buildPartPersonsPath('')).toBeNull(); // 빈 선택 → idle(깨진 /api/parts//persons 예방)
    expect(buildPartPersonsPath(undefined, 5)).toBeNull(); // nonce 가 있어도 falsy id 면 idle
    // idle 은 발사 부재 — drift 가 아니라 조회 부재이므로 diffContract 대상이 아니다.
    expect(() => personsFire('')).toThrow(/idle/);
  });
  it('buildPartPersonsPath("a b/c") 가 encodeURIComponent 로 안전 인코딩하되 param 값이 literal persons 세그먼트를 침범하지 않는다 (분기 — path-param 인코딩)', () => {
    const weirdId = 'a b/c';
    const fired = personsFire(weirdId, 0);
    expect(fired.path).toBe(`${BASE}/a%20b%2Fc/persons`); // 공백·/ 가 인코딩돼 세그먼트가 안 깨진다
    expect(fired.path.split('/').filter(Boolean)).toHaveLength(4); // api·parts·<enc>·persons — 세그먼트 4 유지
    expect(fired.path.endsWith('/persons')).toBe(true); // literal persons 세그먼트가 침범당하지 않음
    expect(diffContract(fired, PERSONS_CONTRACT, weirdId)).toEqual([]); // 인코딩 후에도 route 정합
  });

  // ── Negative cases 충분 cover ─────────────────────────────────────────────
  it.each<[string, () => BackendContract]>([
    ['(a) backend base 를 api/part(단수 오타)로', () => ({ ...PERSONS_CONTRACT, route: 'api/part' })],
    ['(a) backend base 를 api/parts-x(접미 drift)로', () => ({ ...PERSONS_CONTRACT, route: 'api/parts-x' })],
    ['(c) @Get(":id/members")(literal drift)로', () => ({ ...PERSONS_CONTRACT, subPath: extractHandlerMethods(['  @Get(":id/members")', '  async findPersons() {}'].join('\n')).findPersons.subPath })],
    ['(c) @Get(":id")(literal 제거)로', () => ({ ...PERSONS_CONTRACT, subPath: extractHandlerMethods(['  @Get(":id")', '  async findPersons() {}'].join('\n')).findPersons.subPath })],
    ['(c) @Get("persons/:id")(순서 뒤집힘)로', () => ({ ...PERSONS_CONTRACT, subPath: extractHandlerMethods(['  @Get("persons/:id")', '  async findPersons() {}'].join('\n')).findPersons.subPath })],
  ])('%s 면 path 불일치로 잡힌다 (negative (a)(c) — path/literal 세그먼트 drift, 404 예방)', (_label, build) => {
    expect(diffContract(personsFire(PART_ID, 0), build(), PART_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, () => BackendContract]>([
    ['(b) backend 가 @Post 로', () => ({ ...PERSONS_CONTRACT, method: extractHandlerMethods(['  @Post(":id/persons")', '  async findPersons() {}'].join('\n')).findPersons.method })],
    ['(b) backend 가 @Patch 로', () => ({ ...PERSONS_CONTRACT, method: extractHandlerMethods(['  @Patch(":id/persons")', '  async findPersons() {}'].join('\n')).findPersons.method })],
    ['(b) backend 가 @Delete 로', () => ({ ...PERSONS_CONTRACT, method: extractHandlerMethods(['  @Delete(":id/persons")', '  async findPersons() {}'].join('\n')).findPersons.method })],
  ])('%s 바뀌면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 GET 발사)', (_label, build) => {
    expect(diffContract(personsFire(PART_ID, 0), build(), PART_ID)).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('추출기가 `?_r=n` query 를 path 세그먼트로 착각하지 않되 진짜 세그먼트 drift 는 여전히 잡는다 (negative (d) — query vs 세그먼트 구분)', () => {
    // nonce>0 의 query 는 무해(base 일치) — strip 후 통과.
    expect(diffContract(personsFire(PART_ID, 5), PERSONS_CONTRACT, PART_ID)).toEqual([]);
    // 진짜 literal drift(:id/members)는 query strip 후에도 path 불일치로 잡힘 — query 와 세그먼트를 구분.
    const drifted: BackendContract = { ...PERSONS_CONTRACT, subPath: ':id/members' };
    expect(diffContract(personsFire(PART_ID, 5), drifted, PART_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('encodeURIComponent 로 인코딩된 %2F(슬래시)를 추출기/대조기가 실 세그먼트 구분자로 오인하지 않는다 (negative (e) — 인코딩 param 세그먼트 경계 오인 방지)', () => {
    const slashId = 'x/y/z'; // 슬래시 다수 — raw 였으면 세그먼트가 3개로 쪼개져 persons 를 삼킴
    const fired = personsFire(slashId, 0);
    expect(fired.path).toBe(`${BASE}/x%2Fy%2Fz/persons`); // 모든 / 가 %2F — 단일 param 세그먼트 유지
    expect(fired.path.split('/').filter(Boolean)).toHaveLength(4); // api·parts·<enc>·persons(추가 세그먼트 0)
    expect(diffContract(fired, PERSONS_CONTRACT, slashId)).toEqual([]); // literal persons 세그먼트 보존 → 정합
    // 인코딩을 빠뜨린 raw 삽입이면(가상 drift) 세그먼트가 쪼개져 path 불일치로 잡힘.
    const rawFire: WebFire = { path: `${BASE}/x/y/z/persons`, method: 'GET' };
    expect(diffContract(rawFire, PERSONS_CONTRACT, slashId)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('web 발사(:id/persons)를 @Get() findAll(세그먼트 0)·@Get(":id") findById(세그먼트 1)·mutation 으로 오인하지 않고 findPersons 를 정확히 선택한다 (negative (f) — 형제 GET/mutation 혼동)', () => {
    expect(FIND_PERSONS?.subPath).toBe(':id/persons'); // findPersons 만 세그먼트 2
    expect(HANDLERS.create.method).toBe('POST'); // create 는 POST — GET 조회로 오인 금지
    expect(HANDLERS.update.method).toBe('PATCH'); // update 는 PATCH
    expect(HANDLERS.delete.method).toBe('DELETE'); // delete 는 DELETE
    // web 발사(:id/persons)를 findAll·findById 계약에 각각 대면 path 불일치로 잡힘(오매칭 시의 회귀 검출).
    const findAllContract: BackendContract = { ...PERSONS_CONTRACT, subPath: FIND_ALL?.subPath ?? '' };
    const findByIdContract: BackendContract = { ...PERSONS_CONTRACT, subPath: FIND_BY_ID?.subPath ?? '' };
    expect(diffContract(personsFire(PART_ID, 0), findAllContract, PART_ID)).toEqual([expect.stringContaining('path 불일치')]);
    expect(diffContract(personsFire(PART_ID, 0), findByIdContract, PART_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('주석 줄의 "@Get(":id/persons")"/"@Controller(...)"/"GET /api/parts/:id/persons" 를 실 decorator 로 오인하지 않는다 (negative (g) — 주석 false-positive)', () => {
    const fakeController = ['  // @Controller("api/parts") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Get(":id/persons") — 주석뿐, decorator 없음', '  async findPersons() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).findPersons).toBeUndefined();
    const drifted: BackendContract = { ...PERSONS_CONTRACT, route: extractControllerRoute(fakeController), method: extractHandlerMethods(fakeHandler).findPersons?.method ?? null };
    expect(diffContract(personsFire(PART_ID, 0), drifted, PART_ID)).toEqual(['backend 계약 추출 실패']);
  });
  it('web call site 가 옵션 인자를 전달하면(단일 인자 아님) GET 추론이 깨져 method 불일치로 잡힌다 (negative — 발사 override drift)', () => {
    const overridden = extractPersonsFireMethod(
      ["const x = useApiResource<PersonRow[]>(partPersonsPath, { method: 'POST' });"].join('\n'),
    );
    expect(overridden).toBe('NON-GET(args=2)'); // 옵션 인자 존재 → GET 아님
    const fired: WebFire = { path: `${BASE}/p1/persons`, method: overridden ?? 'GET' };
    expect(diffContract(fired, PERSONS_CONTRACT, PART_ID)).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('빈 소스 입력이면 추출기가 null·빈 객체를 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractPersonsFireMethod('')).toBeNull();
    const empty: BackendContract = { route: extractControllerRoute(''), method: extractHandlerMethods('').findPersons?.method ?? null, subPath: '', hasBody: false, hasParam: false, hasQuery: false };
    expect(diffContract(personsFire(PART_ID, 0), empty, PART_ID)).toEqual(['backend 계약 추출 실패']);
  });
});
