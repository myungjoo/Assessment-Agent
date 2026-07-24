import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { ReEvaluationDeps } from './AdminView';
import { buildRecentDeletionPath, runReEvaluate } from './AdminView';

// R-112 — 재평가 트리거(POST /api/schedules/recent-deletion/:personId) web↔backend **계약 drift
// guard**. mirror 선례 AdminView.role-change-contract.test.ts(T-1171)를 대상만 recentDeletion(POST +
// @Body RecentDeletionDto)으로 교체. 판별 축: method=POST · @Body{instants 필수/days optional} ·
// literal `recent-deletion` + `:personId` 합성 · encodeURIComponent · falsy-personId 미발사 guard ·
// 형제 api/schedules base-혼동. 정규식 추출기만 — 새 devDependency 0(공용 helper 추출은 Out of Scope).
function stripComments(source: string): string {
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
// handler 이름 → {method, subPath}(`recentDeletion`→{POST,'recent-deletion/:personId'}). @HttpCode/
// @UseGuards/@Roles 등 비-method decorator 는 handler 로 오인하지 않고 pending 을 보존한다.
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
      continue;
    }
    const handler = /^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (handler && pending) {
      found[handler[1]] = pending;
      pending = null;
    }
  }
  return found;
}
interface DtoFields {
  required: Set<string>;
  optional: Set<string>;
}
// DTO 필드 — required(`instants!`/표기 없음)/optional(`days?`). 클래스 없으면 둘 다 빈 집합.
function extractDtoFields(source: string, className: string): DtoFields {
  const body = new RegExp(`class\\s+${className}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(stripComments(source));
  const required = new Set<string>();
  const optional = new Set<string>();
  if (!body) {
    return { required, optional };
  }
  for (const line of body[1].split('\n')) {
    if (/^[ \t]*@/.test(line)) {
      continue;
    }
    const field = /^[ \t]*(?:readonly\s+)?([A-Za-z_$][\w$]*)([!?]?)\s*[:=]/.exec(line);
    if (field) {
      (field[2] === '?' ? optional : required).add(field[1]);
    }
  }
  return { required, optional };
}
// runReEvaluate 함수 영역만 슬라이스(선언 ~ 다음 async function) — method:'POST'·falsy guard 를 상위
// 소스의 다른 발사기(create 러너 등)와 섞지 않고 이 러너 안에서만 소스 대조한다.
function sliceReEvaluateRunner(source: string): string {
  const stripped = stripComments(source);
  const from = stripped.indexOf('async function runReEvaluate');
  if (from < 0) {
    return '';
  }
  const next = stripped.indexOf('async function ', from + 20);
  return stripped.slice(from, next < 0 ? undefined : next);
}
interface BackendContract {
  route: string | null;
  method: string | null;
  subPath: string;
  hasBody: boolean;
  hasParam: boolean;
  required: Set<string>;
  optional: Set<string>;
}
interface WebFire {
  path: string;
  method: string;
  bodyKeys: Set<string>;
  body: Record<string, unknown>;
}
const normalizeRoute = (route: string): string => (route.startsWith('/') ? route : `/${route}`);
function composeRoute(route: string, subPath: string): string {
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${normalizeRoute(route)}/${trimmed}` : normalizeRoute(route);
}
const pathSegments = (route: string): string[] => route.split('/').filter(Boolean);
const expectedPath = (route: string, subPath: string, personId: string): string =>
  composeRoute(route, subPath).replace(':personId', encodeURIComponent(personId));
// 불일치 사유 목록 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과가 아니라 사유 1건이다(선단언 방어).
function diffContract(fire: WebFire, backend: BackendContract, personId: string): string[] {
  if (!backend.route || !backend.method || backend.required.size + backend.optional.size === 0) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== expectedPath(backend.route, backend.subPath, personId)) {
    issues.push(`path 불일치: ${fire.path}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  const declared = new Set([...backend.required, ...backend.optional]);
  const extras = [...fire.bodyKeys].filter((key) => !declared.has(key)).sort(); // fired ⊄ declared → 400
  if (extras.length > 0) {
    issues.push(`body 초과 키: ${extras.join(',')}`);
  }
  const missing = [...backend.required].filter((key) => !fire.bodyKeys.has(key)).sort(); // required ⊄ fired → 400
  if (missing.length > 0) {
    issues.push(`body 필수 누락: ${missing.join(',')}`);
  }
  return issues;
}

// 실 소스 로드 + web 발사 캡처 harness(ADR-0040 §5 — RTL/jsdom 없음).
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/scheduling/recent-deletion.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/scheduling/dto/recent-deletion.dto.ts', import.meta.url), 'utf8');
const ADMIN_VIEW_SOURCE = readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const RD = HANDLERS.recentDeletion ?? null;
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'RecentDeletionDto');
const RUNNER_SRC = sliceReEvaluateRunner(ADMIN_VIEW_SOURCE);
// 단일 handler controller — 핸들러 인자 존재는 소스 전체 정규식으로 판별(@Param/@Body 는 recentDeletion 뿐).
const CONTROLLER_STRIPPED = stripComments(CONTROLLER_SOURCE);
const RD_CONTRACT: BackendContract = {
  route: ROUTE,
  method: RD?.method ?? null,
  subPath: RD?.subPath ?? '',
  hasBody: /@Body\b/.test(CONTROLLER_STRIPPED),
  hasParam: /@Param\b/.test(CONTROLLER_STRIPPED),
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const BASE = '/api/schedules';
const LITERAL = 'recent-deletion';
const ROUTE_TEMPLATE = '/api/schedules/recent-deletion/:personId';
const PERSON_ID = 'p1';
// options.body 부재는 SyntaxError 대신 빈 키 집합으로 매핑한다(role-change 선례 차용).
function toFire(path: string, options: RequestOptions): WebFire {
  const bodyKeys = new Set<string>();
  let body: Record<string, unknown> = {};
  if (options.body !== undefined && options.body !== null) {
    body = JSON.parse(String(options.body)) as Record<string, unknown>;
    for (const key of Object.keys(body)) {
      bodyKeys.add(key);
    }
  }
  return { path, method: String(options.method), bodyKeys, body };
}
// 러너를 mock deps 로 직접 호출해 **실 발사 인자** 를 캡처한다. falsy personId 는 미발사(undefined).
async function fireReEvaluate(personId: string, days: number): Promise<WebFire | undefined> {
  let fired: WebFire | undefined;
  const deps: ReEvaluationDeps = {
    post: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    submitting: false,
    setSubmitting: () => {},
    setError: () => {},
  };
  await runReEvaluate(personId, days, deps);
  return fired;
}

describe('AdminView — 재평가 트리거 web↔backend 계약 drift guard (T-1196)', () => {
  it('backend route/method/handler/DTO 추출이 하나도 비어있지 않고, 빈 소스면 추출기가 빈 값을 내 대조가 실패한다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(RD_CONTRACT.method).not.toBeNull();
    expect(RD).not.toBeNull();
    expect(DTO_FIELDS.required.size).toBeGreaterThan(0);
    // 빈 소스 입력 시 추출기는 null·빈 집합을 내고, 대조는 통과가 아니라 '추출 실패' 사유를 낸다.
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractDtoFields('', 'RecentDeletionDto').required.size).toBe(0);
    expect(sliceReEvaluateRunner('')).toBe('');
    const empty: BackendContract = { ...RD_CONTRACT, route: extractControllerRoute('') };
    const fired = { path: BASE, method: 'POST', bodyKeys: new Set(['instants']), body: {} } as WebFire;
    expect(diffContract(fired, empty, PERSON_ID)).toEqual(['backend 계약 추출 실패']);
  });
  it('backend @Controller("api/schedules") + @Post("recent-deletion/:personId") 를 base+literal+path-param 3요소로 합성한다 (분기 — 세그먼트 파싱)', () => {
    expect(ROUTE).toBe('api/schedules');
    expect(RD?.subPath).toBe('recent-deletion/:personId');
    const composed = composeRoute(String(ROUTE), RD_CONTRACT.subPath);
    expect(composed).toBe(ROUTE_TEMPLATE);
    expect(pathSegments(composed)).toEqual(['api', 'schedules', LITERAL, ':personId']);
  });
  it(':personId 가 literal recent-deletion 뒤 마지막 세그먼트에 있다 (분기 — path-param 위치)', () => {
    const segs = pathSegments(composeRoute(String(ROUTE), RD_CONTRACT.subPath));
    expect(segs[segs.length - 1]).toBe(':personId');
    expect(segs[segs.length - 2]).toBe(LITERAL);
  });
  it('recentDeletion 핸들러가 @Param("personId") + @Body() RecentDeletionDto 를 갖는다 (분기 — 핸들러 인자, mutation)', () => {
    expect(RD_CONTRACT.hasParam).toBe(true); // path-param 존재
    expect(RD_CONTRACT.hasBody).toBe(true); // body 계약 존재(read GET 의 body 부재와 대조)
  });
  it('buildRecentDeletionPath("p1") 발사(POST /api/schedules/recent-deletion/p1)가 backend 계약과 완전 일치한다 (happy-path — 경로 정합)', async () => {
    expect(buildRecentDeletionPath(PERSON_ID)).toBe(`${BASE}/${LITERAL}/${PERSON_ID}`);
    const fired = await fireReEvaluate(PERSON_ID, 7);
    expect(fired).toBeDefined();
    expect(fired?.path).toBe(`${BASE}/${LITERAL}/${PERSON_ID}`);
    expect(diffContract(fired as WebFire, RD_CONTRACT, PERSON_ID)).toEqual([]);
  });
  it('web 재평가 발사 method 가 POST 이고 backend recentDeletion 도 @Post 다 (happy-path — method 정합)', async () => {
    const fired = await fireReEvaluate(PERSON_ID, 7);
    expect(fired?.method).toBe('POST'); // 실 발사 method
    expect(RUNNER_SRC).toContain("method: 'POST'"); // runReEvaluate 소스 명시(GET default 아님)
    expect(RD_CONTRACT.method).toBe('POST'); // backend @Post(GET/PATCH/DELETE 아님)
    expect(fired?.method).toBe(RD_CONTRACT.method);
  });
  it('web 발사 body({instants,days})가 backend RecentDeletionDto 필드 집합과 정합한다 — instants 필수·days optional (happy-path — body 필드 정합)', async () => {
    const fired = await fireReEvaluate(PERSON_ID, 7);
    expect([...DTO_FIELDS.required]).toEqual(['instants']);
    expect([...DTO_FIELDS.optional]).toEqual(['days']);
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...(fired as WebFire).bodyKeys].every((key) => declared.has(key))).toBe(true); // 초과 키 0
    expect([...DTO_FIELDS.required].every((key) => (fired as WebFire).bodyKeys.has(key))).toBe(true); // 필수 누락 0
    expect([...(fired as WebFire).bodyKeys].sort()).toEqual(['days', 'instants']);
  });
  it('buildRecentDeletionPath("a/b") 가 personId 를 encodeURIComponent 로 인코딩해 세그먼트가 깨지지 않는다 (happy-path — 인코딩)', () => {
    expect(buildRecentDeletionPath('a/b')).toBe(`${BASE}/${LITERAL}/a%2Fb`);
    expect(pathSegments(buildRecentDeletionPath('a/b'))).toEqual(['api', 'schedules', LITERAL, 'a%2Fb']);
  });
  it('runReEvaluate 가 falsy personId(인원 미선택)이면 조기 return 으로 POST 를 미발사한다 (분기 — falsy-personId 미발사 guard)', async () => {
    expect(RUNNER_SRC).toContain('if (!personId)'); // 소스 대조 — 조기 return guard 존재
    expect(await fireReEvaluate('', 7)).toBeUndefined(); // 빈 personId → 미발사(깨진 base POST 안 남)
    expect(await fireReEvaluate(PERSON_ID, 7)).toBeDefined(); // truthy → 실 발사(두 분기 대조)
  });
  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it.each<[string, string]>([
    ['(a) base 단수 오타 api/schedule', 'api/schedule'],
    ['(a) base 접미 drift api/schedules-x', 'api/schedules-x'],
  ])('backend base 를 %s 로 바꾸면 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', async (_label, route) => {
    const fired = await fireReEvaluate(PERSON_ID, 7);
    expect(diffContract(fired as WebFire, { ...RD_CONTRACT, route }, PERSON_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, string]>([
    ['(b) @Get 으로', '  @Get("recent-deletion/:personId")'],
    ['(b) @Patch 로', '  @Patch("recent-deletion/:personId")'],
    ['(b) @Delete 로', '  @Delete("recent-deletion/:personId")'],
  ])('recentDeletion 이 %s drift 하면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 POST 발사)', async (_label, decorator) => {
    const handler = extractHandlerMethods([decorator, '  async recentDeletion() {}'].join('\n')).recentDeletion;
    const fired = await fireReEvaluate(PERSON_ID, 7);
    expect(diffContract(fired as WebFire, { ...RD_CONTRACT, method: handler.method }, PERSON_ID)).toEqual([expect.stringContaining('method 불일치')]);
  });
  it.each<[string, string]>([
    ['(c) literal 오타 recent-delete', 'recent-delete/:personId'],
    ['(c) 다른 literal reeval', 'reeval/:personId'],
    ['(d) path-param 소실 recent-deletion', 'recent-deletion'],
    ['(d) 세그먼트 추가 recent-deletion/:personId/instants', 'recent-deletion/:personId/instants'],
  ])('recentDeletion 이 %s 로 drift 하면 path 불일치로 잡힌다 (negative (c)(d) — literal/path-param drift)', async (_label, subPath) => {
    const fired = await fireReEvaluate(PERSON_ID, 7);
    expect(diffContract(fired as WebFire, { ...RD_CONTRACT, subPath }, PERSON_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('형제 api/schedules controller(base 만 공유)를 recentDeletion 으로 오인하지 않는다 (negative (e) — 형제 base 혼동)', async () => {
    expect(Object.keys(HANDLERS)).toEqual(['recentDeletion']); // 추출기가 단일 handler 를 정확히 선택
    expect(RD?.subPath).toBe('recent-deletion/:personId');
    const fired = await fireReEvaluate(PERSON_ID, 7);
    // base(api/schedules)만 같고 literal 없는 형제(cron/backfill bare handler) 계약이면 path 불일치.
    expect(diffContract(fired as WebFire, { ...RD_CONTRACT, subPath: '' }, PERSON_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, (fired: WebFire) => WebFire | BackendContract, string]>([
    ['backend DTO 에서 instants 필수 소실(web 은 여전히 instants 발사)', () => ({ ...RD_CONTRACT, required: new Set(['days']), optional: new Set<string>() }), 'body 초과 키'],
    ['web 이 필수 instants 를 누락', (fired) => ({ ...fired, bodyKeys: new Set(['days']) }), 'body 필수 누락'],
  ])('%s 하면 body 필드 대조가 불일치로 잡힌다 (negative (f) — body 필드 drift)', async (_label, mutate, expected) => {
    const fired = await fireReEvaluate(PERSON_ID, 7);
    const mutated = mutate(fired as WebFire);
    const result = 'route' in mutated
      ? diffContract(fired as WebFire, mutated as BackendContract, PERSON_ID)
      : diffContract(mutated as WebFire, RD_CONTRACT, PERSON_ID);
    expect(result).toEqual([expect.stringContaining(expected)]);
  });
  it('주석 줄의 "@Post(...)"/"@Controller(...)"/"POST /api/schedules/..." 를 실 decorator 로 오인하지 않는다 (negative (g) — 주석 false-positive)', () => {
    const fakeController = ['  // @Controller("api/schedules") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Post("recent-deletion/:personId") — 주석뿐', '  async recentDeletion() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).recentDeletion).toBeUndefined();
    // 실 소스는 상단·endpoint 주석에 다수 POST /api/schedules/... 문자열이 있어도 정확히 추출된다.
    expect(ROUTE).toBe('api/schedules');
    expect(RD?.method).toBe('POST');
  });
});
