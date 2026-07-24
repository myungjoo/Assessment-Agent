import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { ScheduleMutationDeps } from './AdminView';
import { runTrigger } from './AdminView';

// R-112 — 수동 재평가 즉시 실행 트리거(POST /api/schedules/trigger) web↔backend **계약 drift
// guard**. mirror 선례 AdminView.recent-deletion-contract.test.ts(T-1196)를 대상만 trigger(POST +
// body·param 없는 202 fire-and-forget)로 교체. 판별 축: method=POST · literal `trigger` 단일
// 세그먼트(path-param 없음) · @Body·@Param 부재 · busy 이중발사 미발사 guard · 형제 controller base-혼동. 정규식 추출기만(새 devDependency 0).
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
// handler 이름 → {method, subPath}. 비-method decorator(@HttpCode/@UseGuards/@Roles)는 pending 보존(list/upsert/remove/trigger 4개 추출).
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
// handler 파라미터 목록을 균형 괄호 매칭으로 슬라이스 — @Body/@Param 을 handler 서명 안에서만 판정(upsert/remove 인자 오귀속 방지). 부재 null.
function extractHandlerParams(source: string, handlerName: string): string | null {
  const stripped = stripComments(source);
  const re = new RegExp(`(?:public\\s+|private\\s+|protected\\s+)?(?:async\\s+)?\\b${handlerName}\\s*\\(`);
  const m = re.exec(stripped);
  if (!m) {
    return null;
  }
  let depth = 0;
  const start = m.index + m[0].length; // 여는 '(' 바로 다음
  for (let i = start - 1; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return stripped.slice(start, i);
      }
    }
  }
  return null;
}
// runTrigger 함수 영역만 슬라이스 — method:'POST'·busy guard 를 다른 발사기와 섞지 않고 대조한다.
function sliceTriggerRunner(source: string): string {
  const stripped = stripComments(source);
  const from = stripped.indexOf('async function runTrigger');
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
}
interface WebFire {
  path: string;
  method: string;
  bodyKeys: Set<string>;
  hasParamSegment: boolean;
}
const normalizeRoute = (route: string): string => (route.startsWith('/') ? route : `/${route}`);
function composeRoute(route: string, subPath: string): string {
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${normalizeRoute(route)}/${trimmed}` : normalizeRoute(route);
}
const pathSegments = (route: string): string[] => route.split('/').filter(Boolean);
// 불일치 사유 목록 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과 아닌 사유 1건(선단언 방어). trigger 는 body 필드 대신 인자 부재를 대조.
function diffContract(fire: WebFire, backend: BackendContract): string[] {
  if (!backend.route || !backend.method) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  const expected = composeRoute(backend.route, backend.subPath);
  if (fire.path !== expected) {
    issues.push(`path 불일치: ${fire.path}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  // body/param 부재 정합 — backend 인자 또는 web 발사에 body·치환세그먼트가 있으면 불일치(fire-and-forget 위반).
  if (backend.hasBody || fire.bodyKeys.size > 0) {
    issues.push('body 계약 불일치(무-body fire-and-forget 위반)');
  }
  if (backend.hasParam || fire.hasParamSegment) {
    issues.push('param 계약 불일치(무-param literal path 위반)');
  }
  return issues;
}

// 실 소스 로드 + web 발사 캡처 harness(ADR-0040 §5 — RTL/jsdom 없음).
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/scheduling/cron-schedule.controller.ts', import.meta.url), 'utf8');
const RECENT_DELETION_SOURCE = readFileSync(new URL('../../../src/scheduling/recent-deletion.controller.ts', import.meta.url), 'utf8');
const BACKFILL_SOURCE = readFileSync(new URL('../../../src/scheduling/backfill.controller.ts', import.meta.url), 'utf8');
const ADMIN_VIEW_SOURCE = readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const TRIGGER = HANDLERS.trigger ?? null;
const TRIGGER_PARAMS = extractHandlerParams(CONTROLLER_SOURCE, 'trigger');
const RUNNER_SRC = sliceTriggerRunner(ADMIN_VIEW_SOURCE);
const TRIGGER_CONTRACT: BackendContract = {
  route: ROUTE,
  method: TRIGGER?.method ?? null,
  subPath: TRIGGER?.subPath ?? '',
  // handler 서명 안에서만 @Body/@Param 판정(형제 upsert/remove 인자 오염 방지).
  hasBody: /@Body\b/.test(TRIGGER_PARAMS ?? ''),
  hasParam: /@Param\b/.test(TRIGGER_PARAMS ?? ''),
};
const BASE = '/api/schedules';
const LITERAL = 'trigger';
const ROUTE_TEMPLATE = '/api/schedules/trigger';
// SCHEDULE_TRIGGER_PATH 는 export 되지 않으므로(모듈 내부 상수) 소스 문자열 대조로 값 확정한다.
const TRIGGER_PATH_DECL = "const SCHEDULE_TRIGGER_PATH = '/api/schedules/trigger';";
// options.body 부재는 빈 키 집합으로 매핑한다(recent-deletion 선례 차용).
function toFire(path: string, options: RequestOptions): WebFire {
  const bodyKeys = new Set<string>();
  if (options.body !== undefined && options.body !== null) {
    const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    for (const key of Object.keys(body)) {
      bodyKeys.add(key);
    }
  }
  return {
    path,
    method: String(options.method),
    bodyKeys,
    hasParamSegment: path.includes(':'),
  };
}
// runTrigger 를 mock deps 로 직접 호출해 실 발사 인자를 캡처한다. busy=true 는 미발사(undefined).
async function fireTrigger(busy: boolean): Promise<WebFire | undefined> {
  let fired: WebFire | undefined;
  const deps: ScheduleMutationDeps = {
    request: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    busy,
    setBusy: () => {},
    setError: () => {},
    setMessage: () => {},
  };
  await runTrigger(deps);
  return fired;
}

describe('AdminView — 수동 재평가 즉시 실행 web↔backend 계약 drift guard (T-1197)', () => {
  it('backend route/method/handler 추출이 하나도 비어있지 않고, 빈 소스면 추출기가 빈 값을 내 대조가 실패한다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(TRIGGER_CONTRACT.method).not.toBeNull();
    expect(TRIGGER).not.toBeNull();
    expect(RUNNER_SRC).not.toBe('');
    expect(extractControllerRoute('')).toBeNull(); // 빈 소스 → null·빈 값, 대조는 '추출 실패' 사유
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractHandlerParams('', 'trigger')).toBeNull();
    expect(sliceTriggerRunner('')).toBe('');
    const empty: BackendContract = { ...TRIGGER_CONTRACT, route: extractControllerRoute('') };
    const fired = { path: BASE, method: 'POST', bodyKeys: new Set<string>(), hasParamSegment: false } as WebFire;
    expect(diffContract(fired, empty)).toEqual(['backend 계약 추출 실패']);
  });
  it('backend @Controller("api/schedules") + @Post("trigger") 를 base+literal 2세그먼트로 합성한다 (분기 — base+literal 세그먼트 파싱)', () => {
    expect(ROUTE).toBe('api/schedules');
    expect(TRIGGER?.subPath).toBe('trigger');
    const composed = composeRoute(String(ROUTE), TRIGGER_CONTRACT.subPath);
    expect(composed).toBe(ROUTE_TEMPLATE);
    expect(pathSegments(composed)).toEqual(['api', 'schedules', LITERAL]);
  });
  it('trigger 핸들러가 @Param·@Body 를 둘 다 갖지 않는다 (분기 — 핸들러 인자 부재, fire-and-forget)', () => {
    expect(TRIGGER_PARAMS).not.toBeNull();
    expect(TRIGGER_PARAMS?.trim()).toBe(''); // 빈 파라미터 목록
    expect(TRIGGER_CONTRACT.hasParam).toBe(false); // path-param 없음(remove 의 @Param 과 대조)
    expect(TRIGGER_CONTRACT.hasBody).toBe(false); // body 없음(upsert 의 @Body 와 대조)
  });
  it('trigger route 에 : 동적 세그먼트가 없다 — literal trigger 단일 세그먼트 (happy-path — path-param 부재 정합)', () => {
    const composed = composeRoute(String(ROUTE), TRIGGER_CONTRACT.subPath);
    expect(composed).not.toContain(':'); // 치환 세그먼트 없음
    expect(pathSegments(composed).at(-1)).toBe(LITERAL);
  });
  it('web 발사(POST /api/schedules/trigger)가 backend 계약과 완전 일치한다 (happy-path — 경로 정합)', async () => {
    expect(ADMIN_VIEW_SOURCE).toContain(TRIGGER_PATH_DECL); // SCHEDULE_TRIGGER_PATH 상수값 확정
    const fired = await fireTrigger(false);
    expect(fired).toBeDefined();
    expect(fired?.path).toBe(ROUTE_TEMPLATE);
    expect(fired?.hasParamSegment).toBe(false);
    expect(diffContract(fired as WebFire, TRIGGER_CONTRACT)).toEqual([]);
  });
  it('web trigger 발사 method 가 POST 이고 backend trigger 도 @Post 다 (happy-path — method 정합)', async () => {
    const fired = await fireTrigger(false);
    expect(fired?.method).toBe('POST'); // 실 발사 method
    expect(RUNNER_SRC).toContain("method: 'POST'"); // runTrigger 소스 명시(GET default 아님)
    expect(TRIGGER_CONTRACT.method).toBe('POST'); // backend @Post(GET/PUT/DELETE 아님)
    expect(fired?.method).toBe(TRIGGER_CONTRACT.method);
  });
  it('web trigger 발사에 body 키가 없다 — fire-and-forget (happy-path — body 부재 정합)', async () => {
    const fired = await fireTrigger(false);
    expect(fired?.bodyKeys.size).toBe(0); // 실 발사 options 에 body 없음
    expect(RUNNER_SRC).not.toContain('body:'); // runTrigger 소스에 body 키 없음
    expect(TRIGGER_CONTRACT.hasBody).toBe(false); // backend 도 @Body 없음
    expect(diffContract(fired as WebFire, TRIGGER_CONTRACT)).toEqual([]);
  });
  it('runTrigger 가 busy(이전 apply/trigger 미완)면 조기 return 으로 POST 를 미발사한다 (분기 — busy 이중발사 미발사 guard)', async () => {
    expect(RUNNER_SRC).toContain('if (deps.busy)'); // 소스 대조 — 조기 return guard 존재
    expect(await fireTrigger(true)).toBeUndefined(); // busy=true → 미발사(이중 POST 안 남)
    expect(await fireTrigger(false)).toBeDefined(); // busy=false → 실 발사(두 분기 대조)
  });
  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it.each<[string, string]>([
    ['(a) base 단수 오타 api/schedule', 'api/schedule'],
    ['(a) base 접미 drift api/schedules-x', 'api/schedules-x'],
  ])('backend base 를 %s 로 바꾸면 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', async (_label, route) => {
    const fired = await fireTrigger(false);
    expect(diffContract(fired as WebFire, { ...TRIGGER_CONTRACT, route })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, string]>([
    ['(b) @Get 으로', '  @Get("trigger")'],
    ['(b) @Put 으로', '  @Put("trigger")'],
    ['(b) @Delete 로', '  @Delete("trigger")'],
  ])('trigger 가 %s drift 하면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 POST 발사)', async (_label, decorator) => {
    const handler = extractHandlerMethods([decorator, '  async trigger() {}'].join('\n')).trigger;
    const fired = await fireTrigger(false);
    expect(diffContract(fired as WebFire, { ...TRIGGER_CONTRACT, method: handler.method })).toEqual([expect.stringContaining('method 불일치')]);
  });
  it.each<[string, string]>([
    ['(c) literal 오타 triggr', 'triggr'],
    ['(c) 다른 literal run', 'run'],
    ['(d) literal 소실(bare base)', ''],
    ['(d) path-param 추가 trigger/:id', 'trigger/:id'],
  ])('trigger 가 %s 로 drift 하면 path 불일치로 잡힌다 (negative (c)(d) — literal/세그먼트 drift)', async (_label, subPath) => {
    const fired = await fireTrigger(false);
    expect(diffContract(fired as WebFire, { ...TRIGGER_CONTRACT, subPath })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('형제 api/schedules controller(base 만 공유)를 trigger 로 오인하지 않는다 (negative (e) — 형제 base 혼동)', () => {
    // 같은 파일 형제 handler(list/upsert/remove)가 모두 추출되지만 method·subPath 로 판별된다.
    expect(Object.keys(HANDLERS).sort()).toEqual(['list', 'remove', 'trigger', 'upsert']);
    expect(HANDLERS.list).toEqual({ method: 'GET', subPath: '' }); // @Get() list
    expect(HANDLERS.upsert.method).toBe('PUT'); // @Put() upsert(@Body)
    expect(HANDLERS.remove).toEqual({ method: 'DELETE', subPath: ':name' }); // @Delete(":name")
    expect(TRIGGER).toEqual({ method: 'POST', subPath: 'trigger' }); // 정확히 trigger 선택
    // 별도 파일 형제 POST(recent-deletion/backfill)는 method 는 POST 로 같지만 literal 이 다르다.
    const rd = extractHandlerMethods(RECENT_DELETION_SOURCE).recentDeletion;
    const bf = extractHandlerMethods(BACKFILL_SOURCE).backfill;
    expect(rd).toEqual({ method: 'POST', subPath: 'recent-deletion/:personId' });
    expect(bf).toEqual({ method: 'POST', subPath: 'backfill/:personId' });
    // 형제 POST 계약으로 대조하면 literal/param 불일치로 잡힌다(web 은 trigger literal 발사).
    expect(diffContract({ path: ROUTE_TEMPLATE, method: 'POST', bodyKeys: new Set<string>(), hasParamSegment: false }, { ...TRIGGER_CONTRACT, subPath: rd.subPath })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, Partial<BackendContract>, WebFire | null, string]>([
    ['backend trigger 에 @Body dto 가 추가되면', { hasBody: true }, null, 'body 계약 불일치'],
    ['backend trigger 에 @Param("x") 가 추가되면', { hasParam: true }, null, 'param 계약 불일치'],
    ['web 이 body 를 실어 발사하면', {}, { path: ROUTE_TEMPLATE, method: 'POST', bodyKeys: new Set(['mode']), hasParamSegment: false }, 'body 계약 불일치'],
    ['web path 에 치환 세그먼트가 붙으면', {}, { path: `${ROUTE_TEMPLATE}/:id`, method: 'POST', bodyKeys: new Set<string>(), hasParamSegment: true }, 'param 계약 불일치'],
  ])('%s 인자 계약 불일치가 회귀로 검출된다 (negative (f) — body/param drift 오인 방지)', async (_label, patch, webFire, expected) => {
    const fired = webFire ?? (await fireTrigger(false));
    const result = diffContract(fired as WebFire, { ...TRIGGER_CONTRACT, ...patch });
    expect(result.some((issue) => issue.includes(expected))).toBe(true);
  });
  it('주석 줄의 "@Post(...)"/"@Controller(...)"/"POST /api/schedules/trigger" 를 실 decorator 로 오인하지 않는다 (negative (g) — 주석 false-positive)', () => {
    const fakeController = ['  // @Controller("api/schedules") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Post("trigger") — 주석뿐', '  async trigger() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).trigger).toBeUndefined();
    // 실 소스는 상단·endpoint 주석에 다수 "POST /api/schedules/trigger" 문자열이 있어도 정확히 추출된다.
    expect(ROUTE).toBe('api/schedules');
    expect(TRIGGER?.method).toBe('POST');
    expect(TRIGGER?.subPath).toBe('trigger');
  });
});
