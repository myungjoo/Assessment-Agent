import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { ScheduleMutationDeps } from './AdminView';
import { runApply } from './AdminView';

// R-112 — 스케줄 주기 등록/교체(PUT /api/schedules) web↔backend **계약 drift guard**. mirror 선례
// AdminView.schedule-trigger-contract.test.ts(T-1197)를 upsert(@Put() bare + @Body)로 교체 + @Body 키
// 대조 축(extractDtoFields, T-1196) 재적용. 판별 축: PUT · bare base · @Body{name,cronExpression} 보유 ·
// @Param 부재 · falsy-cron/busy 미발사 guard · 형제 base-혼동. 정규식 추출기만 — 새 devDependency 0.
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
interface HandlerDecorator { method: string; subPath: string }
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
// handler 파라미터를 균형 괄호 매칭으로 슬라이스 — @Body/@Param 을 handler 서명 안에서만 판정. 부재 null.
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
interface DtoFields { required: Set<string>; optional: Set<string> }
function extractDtoFields(source: string, className: string): DtoFields {
  const body = new RegExp(`class\\s+${className}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(stripComments(source));
  const required = new Set<string>();
  const optional = new Set<string>();
  for (const line of body ? body[1].split('\n') : []) {
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
// runApply 함수 영역만 슬라이스 — guard·method·body 를 다른 발사기와 섞지 않고 이 러너 안에서만 대조.
function sliceApplyRunner(source: string): string {
  const stripped = stripComments(source);
  const from = stripped.indexOf('async function runApply');
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
interface WebFire { path: string; method: string; bodyKeys: Set<string>; hasParamSegment: boolean }
const normalizeRoute = (route: string): string => (route.startsWith('/') ? route : `/${route}`);
function composeRoute(route: string, subPath: string): string {
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${normalizeRoute(route)}/${trimmed}` : normalizeRoute(route);
}
const pathSegments = (route: string): string[] => route.split('/').filter(Boolean);
// 불일치 사유 목록 — 빈 배열이 곧 "계약 일치"(추출 실패도 사유 1건). upsert 는 양측 @Body 존재 + DTO 키 정합 대조.
function diffContract(fire: WebFire, backend: BackendContract): string[] {
  if (!backend.route || !backend.method || backend.required.size + backend.optional.size === 0) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== composeRoute(backend.route, backend.subPath)) {
    issues.push(`path 불일치: ${fire.path}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  if (!backend.hasBody || fire.bodyKeys.size === 0) {
    issues.push('body 계약 불일치(body-보유 mutation 위반)');
  }
  if (backend.hasParam || fire.hasParamSegment) {
    issues.push('param 계약 불일치(무-param bare base 위반)');
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

const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/scheduling/cron-schedule.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/scheduling/dto/upsert-cron-schedule.dto.ts', import.meta.url), 'utf8');
const RECENT_DELETION_SOURCE = readFileSync(new URL('../../../src/scheduling/recent-deletion.controller.ts', import.meta.url), 'utf8');
const BACKFILL_SOURCE = readFileSync(new URL('../../../src/scheduling/backfill.controller.ts', import.meta.url), 'utf8');
const ADMIN_VIEW_SOURCE = readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const UPSERT = HANDLERS.upsert ?? null;
const UPSERT_PARAMS = extractHandlerParams(CONTROLLER_SOURCE, 'upsert');
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'UpsertCronScheduleDto');
const RUNNER_SRC = sliceApplyRunner(ADMIN_VIEW_SOURCE);
const UPSERT_CONTRACT: BackendContract = {
  route: ROUTE,
  method: UPSERT?.method ?? null,
  subPath: UPSERT?.subPath ?? '',
  hasBody: /@Body\b/.test(UPSERT_PARAMS ?? ''), // handler 서명 안에서만 판정(형제 remove/trigger 오염 방지)
  hasParam: /@Param\b/.test(UPSERT_PARAMS ?? ''),
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const BASE = '/api/schedules';
const ROUTE_TEMPLATE = '/api/schedules'; // bare base — literal subPath 없음
const SCHEDULES_PATH_DECL = "const SCHEDULES_PATH = '/api/schedules';";
const DEFAULT_NAME_DECL = "const DEFAULT_SCHEDULE_NAME = 'daily-evaluation';";
const CRON = '0 3 * * *';
function toFire(path: string, options: RequestOptions): WebFire {
  const bodyKeys = new Set<string>();
  if (options.body !== undefined && options.body !== null) {
    for (const key of Object.keys(JSON.parse(String(options.body)) as Record<string, unknown>)) {
      bodyKeys.add(key);
    }
  }
  return { path, method: String(options.method), bodyKeys, hasParamSegment: path.includes(':') };
}
async function fireApply(cronExpression: string, busy: boolean): Promise<WebFire | undefined> {
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
  await runApply(cronExpression, deps);
  return fired;
}

describe('AdminView — 스케줄 주기 등록/교체 web↔backend 계약 drift guard (T-1198)', () => {
  it('backend route/method/handler/DTO 추출이 비지 않고, 빈 소스면 추출기가 빈 값을 내 대조가 실패한다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(UPSERT).not.toBeNull();
    expect(UPSERT_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size).toBeGreaterThan(0);
    expect(RUNNER_SRC).not.toBe('');
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractHandlerParams('', 'upsert')).toBeNull();
    expect(extractDtoFields('', 'UpsertCronScheduleDto').required.size).toBe(0);
    expect(sliceApplyRunner('')).toBe('');
    const empty: BackendContract = { ...UPSERT_CONTRACT, route: extractControllerRoute('') };
    const fired = { path: BASE, method: 'PUT', bodyKeys: new Set(['name', 'cronExpression']), hasParamSegment: false } as WebFire;
    expect(diffContract(fired, empty)).toEqual(['backend 계약 추출 실패']);
  });
  it('@Controller("api/schedules") + @Put()(빈 subPath)를 bare base 단일 세그먼트로 합성하고 : 동적 세그먼트가 없다 (분기 — bare base 세그먼트 파싱 + path-param 부재 정합)', () => {
    expect(ROUTE).toBe('api/schedules');
    expect(UPSERT?.subPath).toBe(''); // literal subPath 없음(trigger 의 'trigger' 와 대조)
    const composed = composeRoute(String(ROUTE), UPSERT_CONTRACT.subPath);
    expect(composed).toBe(ROUTE_TEMPLATE);
    expect(composed).not.toContain(':'); // 치환 세그먼트 없음(무-param mutation)
    expect(pathSegments(composed)).toEqual(['api', 'schedules']); // 2세그먼트, trigger 의 3세그먼트와 대조
  });
  it('upsert 핸들러가 @Body 는 갖고 @Param 은 갖지 않는다 (분기 — 핸들러 인자 판별, body-only mutation)', () => {
    expect(UPSERT_PARAMS).not.toBeNull();
    expect(UPSERT_CONTRACT.hasBody).toBe(true); // @Body 존재(trigger 부재·remove @Param 과 대조)
    expect(UPSERT_CONTRACT.hasParam).toBe(false);
  });
  it('web 발사(PUT /api/schedules)가 backend @Put() upsert 계약과 완전 일치한다 (happy-path — 경로/method 정합)', async () => {
    expect(ADMIN_VIEW_SOURCE).toContain(SCHEDULES_PATH_DECL); // SCHEDULES_PATH 상수값 확정
    const fired = await fireApply(CRON, false);
    expect(fired).toBeDefined();
    expect(fired?.path).toBe(ROUTE_TEMPLATE);
    expect(fired?.hasParamSegment).toBe(false);
    expect(fired?.method).toBe('PUT'); // 실 발사 method
    expect(RUNNER_SRC).toContain("method: 'PUT'"); // runApply 소스 명시(GET default 아님)
    expect(UPSERT_CONTRACT.method).toBe('PUT'); // backend @Put(GET/POST/DELETE 아님)
    expect(diffContract(fired as WebFire, UPSERT_CONTRACT)).toEqual([]);
  });
  it('web 발사 body 키({name,cronExpression})가 backend UpsertCronScheduleDto 필드와 정합한다 — 둘 다 필수 (happy-path — @Body 정합)', async () => {
    const fired = await fireApply(CRON, false);
    expect([...DTO_FIELDS.required].sort()).toEqual(['cronExpression', 'name']); // DTO 필수 필드
    expect([...DTO_FIELDS.optional]).toEqual([]);
    expect(ADMIN_VIEW_SOURCE).toContain(DEFAULT_NAME_DECL); // name 은 default 상수 공급
    expect(RUNNER_SRC).toContain('body:'); // runApply 소스에 body 존재(fire-and-forget 아님)
    expect([...(fired as WebFire).bodyKeys].sort()).toEqual(['cronExpression', 'name']); // 실 발사 키
  });
  it('runApply 가 falsy cron/busy 면 조기 return 으로 PUT 을 미발사한다 (분기 — falsy-cron·busy 이중발사 미발사 guard)', async () => {
    expect(RUNNER_SRC).toContain('if (!cronExpression)'); // falsy-cron guard 소스 대조
    expect(RUNNER_SRC).toContain('if (deps.busy)'); // busy guard 소스 대조
    expect(await fireApply('', false)).toBeUndefined(); // 빈 cron → 미발사(잘못된 body PUT 안 남)
    expect(await fireApply(CRON, true)).toBeUndefined(); // busy=true → 미발사(이중 PUT 안 남)
    expect(await fireApply(CRON, false)).toBeDefined(); // 유효 cron + busy=false → 실 발사(분기 대조)
  });
  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it.each<[string, string]>([
    ['(a) base 단수 오타 api/schedule', 'api/schedule'],
    ['(a) base 접미 drift api/schedules-x', 'api/schedules-x'],
  ])('backend base 를 %s 로 바꾸면 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', async (_label, route) => {
    const fired = await fireApply(CRON, false);
    expect(diffContract(fired as WebFire, { ...UPSERT_CONTRACT, route })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, string]>([
    ['(b) @Get 으로', '  @Get()'],
    ['(b) @Post 로', '  @Post()'],
    ['(b) @Delete 로', '  @Delete()'],
  ])('upsert 가 %s drift 하면 method 불일치로 잡힌다 (negative (b) — method drift, web 은 PUT 발사)', async (_label, decorator) => {
    const handler = extractHandlerMethods([decorator, '  upsert() {}'].join('\n')).upsert;
    const fired = await fireApply(CRON, false);
    expect(diffContract(fired as WebFire, { ...UPSERT_CONTRACT, method: handler.method })).toEqual([expect.stringContaining('method 불일치')]);
  });
  it.each<[string, string]>([
    ['(c) literal 추가 apply', 'apply'],
    ['(c) path-param 추가 :name', ':name'],
  ])('upsert 가 @Put("%s") 로 drift 하면 web 발사(bare base)와 세그먼트 불일치로 잡힌다 (negative (c) — 세그먼트 추가 drift)', async (_label, subPath) => {
    const fired = await fireApply(CRON, false);
    expect(diffContract(fired as WebFire, { ...UPSERT_CONTRACT, subPath })).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, BackendContract | null, WebFire | null, string]>([
    ['backend DTO 키를 cron(축약 오타)으로', { ...UPSERT_CONTRACT, required: new Set(['name', 'cron']), optional: new Set() }, null, 'body'],
    ['backend DTO 키를 expression(다른 키)으로', { ...UPSERT_CONTRACT, required: new Set(['name', 'expression']), optional: new Set() }, null, 'body'],
    ['web 이 cronExpression 을 누락', null, { path: ROUTE_TEMPLATE, method: 'PUT', bodyKeys: new Set(['name']), hasParamSegment: false }, 'body 필수 누락'],
    ['web 이 초과 키 mode 를 추가', null, { path: ROUTE_TEMPLATE, method: 'PUT', bodyKeys: new Set(['name', 'cronExpression', 'mode']), hasParamSegment: false }, 'body 초과 키'],
  ])('%s 바꾸면 body 키 대조가 불일치로 잡힌다 (negative (d) — body 키 drift)', async (_label, backend, webFire, expected) => {
    const fired = webFire ?? (await fireApply(CRON, false));
    expect(diffContract(fired as WebFire, backend ?? UPSERT_CONTRACT).some((issue) => issue.includes(expected))).toBe(true);
  });
  it('형제 api/schedules controller(base 만 공유)를 upsert 로 오인하지 않는다 (negative (e) — 형제 base 혼동)', async () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(['list', 'remove', 'trigger', 'upsert']);
    expect(HANDLERS.list).toEqual({ method: 'GET', subPath: '' }); // @Get() list(같은 bare base but GET)
    expect(HANDLERS.remove).toEqual({ method: 'DELETE', subPath: ':name' }); // @Delete(":name")
    expect(HANDLERS.trigger).toEqual({ method: 'POST', subPath: 'trigger' }); // @Post("trigger")
    expect(UPSERT).toEqual({ method: 'PUT', subPath: '' }); // 정확히 upsert 선택
    expect(extractHandlerMethods(RECENT_DELETION_SOURCE).recentDeletion).toEqual({ method: 'POST', subPath: 'recent-deletion/:personId' });
    expect(extractHandlerMethods(BACKFILL_SOURCE).backfill).toEqual({ method: 'POST', subPath: 'backfill/:personId' });
    const fired = await fireApply(CRON, false);
    expect(diffContract(fired as WebFire, { ...UPSERT_CONTRACT, method: HANDLERS.list.method })).toEqual([expect.stringContaining('method 불일치')]);
    expect(diffContract(fired as WebFire, { ...UPSERT_CONTRACT, subPath: HANDLERS.remove.subPath, hasParam: true })).toEqual([
      expect.stringContaining('path 불일치'),
      expect.stringContaining('param 계약 불일치'),
    ]);
  });
  it('upsert 에서 @Body 소실(또는 web body 소실) 시 body-보유 mutation 계약 불일치가 회귀로 검출된다 (negative (f) — @Body 소실 오인 방지)', async () => {
    const fired = await fireApply(CRON, false);
    expect(diffContract(fired as WebFire, { ...UPSERT_CONTRACT, hasBody: false })).toEqual([expect.stringContaining('body 계약 불일치')]);
    const noBody = { path: ROUTE_TEMPLATE, method: 'PUT', bodyKeys: new Set<string>(), hasParamSegment: false } as WebFire;
    expect(diffContract(noBody, UPSERT_CONTRACT).some((issue) => issue.includes('body 계약 불일치'))).toBe(true);
  });
  it('주석 줄의 "@Put(...)"/"@Controller(...)"/"PUT /api/schedules" 를 실 decorator 로 오인하지 않는다 (negative (g) — 주석 false-positive)', () => {
    expect(extractControllerRoute(['  // @Controller("api/schedules") — 주석뿐', 'export class X {}'].join('\n'))).toBeNull();
    expect(extractHandlerMethods(['  // @Put() — 주석뿐', '  upsert() {}'].join('\n')).upsert).toBeUndefined();
    expect(ROUTE).toBe('api/schedules'); // 실 소스는 주석에 다수 "PUT /api/schedules" 문자열이 있어도 정확 추출
    expect(UPSERT?.method).toBe('PUT');
    expect(UPSERT?.subPath).toBe('');
  });
});
