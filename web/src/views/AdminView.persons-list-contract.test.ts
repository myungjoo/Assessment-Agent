import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPersonsPath } from './AdminView';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본 삭제·동작 무변경(T-1203 이관 slice 2).
// 이 spec 이 참조하는 export 중 **공용과 글자-동일한 5종만** import. richer extractHandlerMethods(5-field
// hasBody/hasParam/hasQuery)·HandlerDecorator(5-field)·pathParams·per-spec 발사기/타입/diffContract 는 inline 유지.
import {
  composeRoute,
  extractControllerRoute,
  normalizeRoute,
  stripComments,
  stripQuery,
} from './__contract-guard__/contract-extractors';

// R-112 — 인원 목록 조회(GET /api/persons) web↔backend **계약 drift guard**.
// 직전 GET-list slice llm-provider-list(T-1189) mirror — 발사 대상을 providers → persons 로
// 바꾸고 GET 패턴(GET method · bare @Get() 세그먼트 0 · 핸들러 인자 0 · `?_r=nonce` cache-buster 무해)을
// 재적용. **판별 축**: person controller 는 같은 소스에 두 GET 핸들러 — @Get() findActive(목록) 과
// @Get(":id") findOne(단건) — 를 가진다. 추출기가 web 목록 발사(bare base)에 대응하는 @Get() findActive 를
// @Get(":id") findOne 대조군에서 정확히 판별해야 한다(세그먼트 0 GET vs 세그먼트 1 GET). create @Post()·
// update @Patch(":id")·remove @Delete(":id") 는 method drift 대조군. 정규식 추출기만 — 새 devDependency 0,
// 공용 helper 추출은 Out of Scope refactor slice.

interface HandlerDecorator {
  method: string;
  subPath: string;
  hasBody: boolean;
  hasParam: boolean;
  hasQuery: boolean;
}
// HTTP method + sub-path + 시그니처의 @Body/@Param/@Query 존재. 멀티라인 시그니처는 handler 줄부터
// 괄호 균형 0 까지 이어붙여 인자 decorator 를 탐지. GET findActive 는 인자 0, findOne 은 @Param 1 이 정답.
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
// AdminView 조회 call site 의 발사 method 추론. `useApiResource<PersonRow[]>(personsPath)` 를
// 옵션 인자 없이(단일 인자) 호출 → request→fetch default GET. 인자 2+ (options 전달) 면 non-GET 가능.
// partPersonsPath call site(형제)와 섞이지 않도록 personsPath 인자를 명시 anchor.
function extractPersonsFireMethod(source: string): string | null {
  const matched = /useApiResource<PersonRow\[\]>\(\s*(personsPath[^)]*)\)/.exec(stripComments(source));
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
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/person.controller.ts', import.meta.url), 'utf8');
const ADMIN_VIEW_SOURCE = readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const FIND_ACTIVE = HANDLERS.findActive ?? null;
const FIND_ONE = HANDLERS.findOne ?? null;
const WEB_FIRE_METHOD = extractPersonsFireMethod(ADMIN_VIEW_SOURCE);
const LIST_CONTRACT: BackendContract = {
  route: ROUTE,
  method: FIND_ACTIVE?.method ?? null,
  subPath: FIND_ACTIVE?.subPath ?? '',
  hasBody: FIND_ACTIVE?.hasBody ?? false,
  hasParam: FIND_ACTIVE?.hasParam ?? false,
  hasQuery: FIND_ACTIVE?.hasQuery ?? false,
};
const BASE = '/api/persons';
// nonce ≤ 0 은 base 그대로, nonce > 0 은 `?_r=n` cache-buster query. 조회 발사 method 는 call site 추론값(GET).
const personsFire = (nonce: number): WebFire => ({ path: buildPersonsPath(nonce), method: WEB_FIRE_METHOD ?? 'GET' });

describe('AdminView — 인원 목록 조회 web↔backend 계약 drift guard (T-1190)', () => {
  it('backend route/method 와 web 발사 method 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(LIST_CONTRACT.method).not.toBeNull();
    expect(WEB_FIRE_METHOD).not.toBeNull();
  });
  it('backend @Controller("api/persons") 2-세그먼트 base 를 /api/persons 로 정규화한다 (분기 — base 파싱)', () => {
    expect(ROUTE).toBe('api/persons');
    expect(String(ROUTE).split('/')).toHaveLength(2); // api·persons
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
  it('findActive 핸들러가 @Body·@Param·@Query 를 하나도 갖지 않는다 (분기 — 핸들러 인자 부재)', () => {
    expect(FIND_ACTIVE).not.toBeNull();
    expect(LIST_CONTRACT.hasBody).toBe(false); // GET 조회 — body 계약 없음
    expect(LIST_CONTRACT.hasParam).toBe(false); // path/query param 없음
    expect(LIST_CONTRACT.hasQuery).toBe(false); // @Query 미선언 — `_r` 무시 근거
  });
  it('같은 소스의 @Get(":id") findOne 은 세그먼트 1 + @Param 을 가져 @Get() findActive 와 정확히 판별된다 (분기 — GET-vs-GET 판별, 핵심 축)', () => {
    expect(FIND_ONE).not.toBeNull();
    expect(FIND_ONE?.method).toBe('GET'); // findOne 도 GET — method 만으로는 구분 불가
    expect(FIND_ONE?.subPath).toBe(':id'); // 세그먼트 1 — findActive(세그먼트 0)과 구분되는 핵심
    expect(FIND_ONE?.hasParam).toBe(true); // @Param("id") 존재
    // 추출기가 두 GET 을 서로 다른 route 로 정확히 추출 — 병합/오축소 금지.
    expect(composeRoute(String(ROUTE), FIND_ACTIVE?.subPath ?? '')).toBe(BASE);
    expect(composeRoute(String(ROUTE), FIND_ONE?.subPath ?? '')).toBe(`${BASE}/:id`);
    expect(composeRoute(String(ROUTE), FIND_ACTIVE?.subPath ?? '')).not.toBe(
      composeRoute(String(ROUTE), FIND_ONE?.subPath ?? ''),
    );
  });
  it('buildPersonsPath(0) 발사(GET /api/persons)가 backend findActive 계약과 완전 일치한다 (happy-path — 경로 정합)', () => {
    const fired = personsFire(0);
    expect(buildPersonsPath(0)).toBe(BASE);
    expect(fired.path).toBe(BASE);
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([]);
  });
  it('web 조회 call site 가 옵션 인자 없이 useApiResource 를 호출해 default GET 이고 backend 도 @Get 이다 (happy-path — method 정합)', () => {
    expect(WEB_FIRE_METHOD).toBe('GET'); // 단일 인자 호출 → fetch default GET
    expect(LIST_CONTRACT.method).toBe('GET'); // backend 는 @Get(POST/PATCH/DELETE 아님)
    expect(personsFire(0).method).toBe(LIST_CONTRACT.method); // 양측 method == GET
  });
  it('buildPersonsPath(5) 은 `?_r=5` cache-buster 를 붙이되 base 는 backend route 와 여전히 일치한다 (happy-path — query 무해)', () => {
    const fired = personsFire(5);
    expect(fired.path).toBe(`${BASE}?_r=5`);
    expect(stripQuery(fired.path)).toBe(BASE); // `_r` strip 후 base 동일
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([]); // query 는 drift 아님(부수효과 0)
  });
  it.each<[string, () => BackendContract]>([
    ['(a) backend base 를 api/person(단수 오타)로', () => ({ ...LIST_CONTRACT, route: 'api/person' })],
    ['(a) backend base 를 api/persons-x(접미 drift)로', () => ({ ...LIST_CONTRACT, route: 'api/persons-x' })],
    ['(c) @Get(":id")(세그먼트 1)로', () => ({ ...LIST_CONTRACT, subPath: extractHandlerMethods(['  @Get(":id")', '  async findActive() {}'].join('\n')).findActive.subPath })],
    ['(c) @Get("all")(세그먼트 1)로', () => ({ ...LIST_CONTRACT, subPath: extractHandlerMethods(['  @Get("all")', '  async findActive() {}'].join('\n')).findActive.subPath })],
  ])('%s 면 path 불일치로 잡힌다 (negative (a)(c) — path drift, 404 예방)', (_label, build) => {
    expect(diffContract(personsFire(0), build())).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, () => BackendContract]>([
    ['(b) backend 가 @Post 로', () => ({ ...LIST_CONTRACT, method: extractHandlerMethods(['  @Post()', '  async findActive() {}'].join('\n')).findActive.method })],
    ['(b) backend 가 @Patch 로', () => ({ ...LIST_CONTRACT, method: extractHandlerMethods(['  @Patch()', '  async findActive() {}'].join('\n')).findActive.method })],
    ['(b) backend 가 @Delete 로', () => ({ ...LIST_CONTRACT, method: extractHandlerMethods(['  @Delete()', '  async findActive() {}'].join('\n')).findActive.method })],
  ])('%s 바뀌면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 GET 발사)', (_label, build) => {
    expect(diffContract(personsFire(0), build())).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('추출기가 `?_r=n` query 를 path 세그먼트로 착각하지 않되 진짜 추가 세그먼트는 여전히 잡는다 (negative (d) — query vs 세그먼트 구분)', () => {
    // nonce>0 의 query 는 무해(base 일치) — strip 후 통과.
    expect(diffContract(personsFire(5), LIST_CONTRACT)).toEqual([]);
    // 진짜 추가 세그먼트(@Get(":id"))는 query strip 후에도 path 불일치로 잡힘 — query 와 세그먼트를 구분.
    const withSegment: BackendContract = { ...LIST_CONTRACT, subPath: ':id' };
    expect(diffContract(personsFire(5), withSegment)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('mutation 대조군(create @Post()/update @Patch(":id")/remove @Delete(":id"))을 GET 목록 핸들러로 오인하지 않고 @Get() findActive 를 정확히 선택한다 (negative (e) — 대조군 혼동)', () => {
    expect(FIND_ACTIVE?.method).toBe('GET'); // findActive 만 목록 GET
    expect(HANDLERS.create.method).toBe('POST'); // create 는 POST — GET 조회로 오인 금지
    expect(HANDLERS.update.method).toBe('PATCH'); // update 는 PATCH
    expect(HANDLERS.remove.method).toBe('DELETE'); // remove 는 DELETE
    expect(HANDLERS.update.subPath).toBe(':id'); // mutation 의 :id 를 findActive 가 끌어오지 않음
    expect(LIST_CONTRACT.subPath).toBe(''); // findActive 의 bare @Get — 세그먼트 0 유지
  });
  it('@Get(":id") findOne 을 세그먼트 0 로 오축소하거나 @Get() findActive 로 병합하지 않는다 (negative (g) — findOne 판별 실패 방지)', () => {
    // 두 GET 핸들러가 서로 다른 route 로 정확히 추출됨 — findActive 는 bare base, findOne 은 :id 세그먼트.
    expect(FIND_ACTIVE?.subPath).toBe(''); // findActive 가 findOne 의 :id 를 흡수하지 않음
    expect(FIND_ONE?.subPath).toBe(':id'); // findOne 이 세그먼트 0 로 오축소되지 않음
    expect(composeRoute(String(ROUTE), FIND_ONE?.subPath ?? '')).toBe(`${BASE}/:id`);
    expect(pathParams(composeRoute(String(ROUTE), FIND_ONE?.subPath ?? ''))).toEqual([':id']);
    // web 목록 발사(bare base)를 findOne 계약에 대면 path 불일치로 잡힘(잘못 매칭 시의 회귀 검출).
    const findOneContract: BackendContract = { ...LIST_CONTRACT, subPath: FIND_ONE?.subPath ?? '' };
    expect(diffContract(personsFire(0), findOneContract)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('주석 줄의 "@Get()"/"@Controller(...)"/"GET /api/persons" 를 실 decorator 로 오인하지 않는다 (negative (f) — 주석 false-positive)', () => {
    const fakeController = ['  // @Controller("api/persons") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Get() — 주석뿐, decorator 없음', '  async findActive() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).findActive).toBeUndefined();
    const drifted: BackendContract = { ...LIST_CONTRACT, route: extractControllerRoute(fakeController), method: extractHandlerMethods(fakeHandler).findActive?.method ?? null };
    expect(diffContract(personsFire(0), drifted)).toEqual(['backend 계약 추출 실패']);
  });
  it('web call site 가 옵션 인자를 전달하면(단일 인자 아님) GET 추론이 깨져 method 불일치로 잡힌다 (negative — 발사 override drift)', () => {
    const overridden = extractPersonsFireMethod(
      ["const x = useApiResource<PersonRow[]>(personsPath, { method: 'POST' });"].join('\n'),
    );
    expect(overridden).toBe('NON-GET(args=2)'); // 옵션 인자 존재 → GET 아님
    const fired: WebFire = { path: BASE, method: overridden ?? 'GET' };
    expect(diffContract(fired, LIST_CONTRACT)).toEqual([expect.stringContaining('method 불일치')]);
  });
  it('빈 소스 입력이면 추출기가 null·빈 객체를 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractPersonsFireMethod('')).toBeNull();
    const empty: BackendContract = { route: extractControllerRoute(''), method: extractHandlerMethods('').findActive?.method ?? null, subPath: '', hasBody: false, hasParam: false, hasQuery: false };
    expect(diffContract(personsFire(0), empty)).toEqual(['backend 계약 추출 실패']);
  });
});
