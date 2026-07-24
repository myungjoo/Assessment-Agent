import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { CreateGroupDeps } from './AdminView';
import { runCreateGroup } from './AdminView';

// R-112 — 그룹 생성(POST /api/groups) web↔backend **계약 drift guard**. 선례
// AdminView.create-user-contract.test.ts(T-1172, bare-route + 단일 required body) ·
// AdminView.group-member-add-contract.test.ts(T-1173, api/groups base)의 "backend 소스에서
// 계약을 추출해 web 발사 인자와 대조" 패턴 차용(추출기/대조기 상세 주석은 그 파일들; 로컬 재정의는
// use site 6 곳 도달 — 공용 helper 추출은 Out of Scope 별도 refactor slice, AST 대신 정규식만 →
// 새 devDependency 0). endpoint-특화 축 3개: (1) `@Controller("api/groups")` base + bare `@Post()`
// (인자 부재) 합성 → 최종 template `/api/groups`(추가 세그먼트 0, T-1173/T-1174 의 `:id/members`
// 세그먼트와 대조). (2) `CreateGroupDto` name 단일 required body 부분집합. (3) POST + JSON body +
// Content-Type 헤더 존재(T-1174 의 DELETE body 부재 축과 대비). backend 가 base 를 `api/group`(오타)
// 로, `@Post()` 에 세그먼트를 붙이거나, method/DTO 를 바꾸면 fail.

// 주석 제거 — 추출이 주석 문구를 잡으면 guard 가 무력해진다(아래 negative (g)).
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}
// `@Controller("api/groups")` 인자 route. 없으면 null.
function extractControllerRoute(source: string): string | null {
  const matched = /^[ \t]*@Controller\(\s*['"`]([^'"`]+)['"`]\s*\)/m.exec(stripComments(source));
  return matched ? matched[1] : null;
}
// method decorator — HTTP method + 인자 sub-path(`@Post()`→''; `@Post(":id")`→':id'). 인자 부재가 곧
// bare route(추가 세그먼트 0) 정규화의 근거다. @HttpCode 등 사이 decorator 는 pending 리셋 없이 continue.
interface HandlerDecorator {
  method: string;
  subPath: string;
}
// handler 이름 → {method, subPath}(`create`→{POST, ''}). decorator 없는 handler 미수록.
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
      continue; // 그 외 decorator(@HttpCode/@UsePipes/@Param)는 handler 로 오인하지 않는다.
    }
    const handler = /^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (handler && pending) {
      found[handler[1]] = pending;
      pending = null;
    }
  }
  return found;
}
// DTO 필드 — required(`name!`/표기 없음)/optional(`x?`). 클래스 없으면 둘 다 빈 집합.
interface DtoFields {
  required: Set<string>;
  optional: Set<string>;
}
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

interface BackendContract {
  route: string | null;
  method: string | null;
  subPath: string;
  required: Set<string>;
  optional: Set<string>;
}
interface WebFire {
  path: string;
  method: string;
  bodyKeys: Set<string>;
  hasBody: boolean;
  contentType: string | undefined;
}
const normalizeRoute = (route: string): string => (route.startsWith('/') ? route : `/${route}`);
// base route 에 sub-path 합성(빈 subPath 는 base 그대로 — bare route 정규화의 핵심).
function composeRoute(route: string, subPath: string): string {
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${normalizeRoute(route)}/${trimmed}` : normalizeRoute(route);
}
// 불일치 사유 목록 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과가 아니라 사유 1건이다.
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
  const declared = new Set([...backend.required, ...backend.optional]);
  const extras = [...fire.bodyKeys].filter((key) => !declared.has(key)).sort(); // fired ⊄ declared → 400
  if (extras.length > 0) {
    issues.push(`body 초과 키: ${extras.join(',')}`);
  }
  const missing = [...backend.required].filter((key) => !fire.bodyKeys.has(key)).sort(); // required ⊄ fired → 400
  if (missing.length > 0) {
    issues.push(`body 필수 누락: ${missing.join(',')}`);
  }
  // POST 는 JSON body + Content-Type 을 반드시 발사한다(T-1174 의 DELETE body 부재 축과 대비).
  if (!fire.hasBody) {
    issues.push('body 부재');
  }
  if (fire.contentType !== 'application/json') {
    issues.push(`Content-Type 부재/불일치: ${String(fire.contentType)}`);
  }
  return issues;
}

// 실 소스 로드 + web 발사 캡처 harness.
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/group.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/user/dto/create-group.dto.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'CreateGroupDto');
const CREATE_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).create ?? null;
const CREATE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: CREATE_HANDLER?.method ?? null,
  subPath: CREATE_HANDLER?.subPath ?? '',
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
// options.body 부재/undefined 는 SyntaxError 대신 빈 키 집합 + hasBody=false 로 매핑한다.
function toFire(path: string, options: RequestOptions): WebFire {
  const bodyKeys = new Set<string>();
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody) {
    for (const key of Object.keys(JSON.parse(String(options.body)) as Record<string, unknown>)) {
      bodyKeys.add(key);
    }
  }
  const headers = (options.headers ?? {}) as Record<string, string>;
  return { path, method: String(options.method), bodyKeys, hasBody, contentType: headers['Content-Type'] };
}
// 러너를 mock deps 로 직접 호출해 **실제 발사 인자** 를 캡처한다(ADR-0040 §5 — RTL/jsdom 없음).
async function fireCreateGroup(name: string): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: CreateGroupDeps = {
    create: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    creating: false,
    setCreating: () => {},
    setCreateError: () => {},
    bumpRefresh: () => {},
    resetInput: () => {},
  };
  await runCreateGroup(name, deps);
  if (!fired) {
    throw new Error('그룹 생성 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 그룹 생성 web↔backend 계약 drift guard (T-1175)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(CREATE_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size).toBeGreaterThan(0);
  });
  it('backend @Controller("api/groups") base route 를 /api/groups 로 정규화한다 (분기 — 그룹 base 파싱)', () => {
    expect(ROUTE).toBe('api/groups');
    expect(normalizeRoute(String(ROUTE))).toBe('/api/groups');
  });
  it('backend @Post() bare route(인자 부재)를 base 자체와 합성해 세그먼트 0 template 을 만든다 (분기 — bare 합성)', () => {
    expect(CREATE_CONTRACT.method).toBe('POST');
    expect(CREATE_CONTRACT.subPath).toBe('');
    expect(composeRoute(String(ROUTE), CREATE_CONTRACT.subPath)).toBe('/api/groups');
  });
  it('backend @Post(":id") 처럼 인자가 있으면 base 와 합성한다 (분기 — 인자 합성, bare 대비)', () => {
    const handler = extractHandlerMethods(['  @Post(":id")', '  async create() {}'].join('\n')).create;
    expect(handler).toEqual({ method: 'POST', subPath: ':id' });
    expect(composeRoute('api/groups', handler.subPath)).toBe('/api/groups/:id');
  });
  it('그룹 생성 발사(POST /api/groups)가 backend create 계약과 완전 일치한다 (happy-path)', async () => {
    expect(diffContract(await fireCreateGroup('평가 A조'), CREATE_CONTRACT)).toEqual([]);
  });
  it('발사 body 키가 declared 부분집합을 만족한다(초과 0·필수 누락 0, name 단일) (happy-path — body 부분집합)', async () => {
    const fired = await fireCreateGroup('평가 A조');
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...fired.bodyKeys].every((key) => declared.has(key))).toBe(true);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true);
    expect([...fired.bodyKeys].sort()).toEqual(['name']);
  });
  it('POST 발사에 JSON body 와 Content-Type: application/json 헤더가 존재한다 (분기 — body/헤더 존재 대조)', async () => {
    const fired = await fireCreateGroup('평가 A조');
    expect(fired.method).toBe('POST');
    expect(fired.hasBody).toBe(true);
    expect(fired.contentType).toBe('application/json');
  });
  it('extractDtoFields 가 name 을 required 로 분류하고 optional 은 비어있다 (분기 — 단일 required 추출)', () => {
    expect([...DTO_FIELDS.required].sort()).toEqual(['name']);
    expect(DTO_FIELDS.optional.size).toBe(0);
  });
  it('extractDtoFields 가 `x?` 표기 필드를 optional 집합으로 수집한다 (분기 — optional 수집, 합성 DTO)', () => {
    // 실 CreateGroupDto 는 optional 0 이라 optional-수집 분기가 미실행 → 합성 소스로 분기 직접 구동.
    const synthetic = ['export class SyntheticDto {', '  name!: string;', '  description?: string;', '}'].join('\n');
    const fields = extractDtoFields(synthetic, 'SyntheticDto');
    expect([...fields.required].sort()).toEqual(['name']);
    expect([...fields.optional].sort()).toEqual(['description']);
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합 + hasBody=false 로 매핑된다 (분기 — body 부재)', () => {
    const fire = toFire('/api/groups', { method: 'POST' } as RequestOptions);
    expect(fire.bodyKeys.size).toBe(0);
    expect(fire.hasBody).toBe(false);
  });

  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it('backend 가 base 를 api/group(오타)/api/teams 로 바꾸면 web 의 /api/groups 발사가 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', async () => {
    const fired = await fireCreateGroup('평가 A조');
    for (const base of ['api/group', 'api/teams']) {
      const drifted: BackendContract = { ...CREATE_CONTRACT, route: base };
      expect(diffContract(fired, drifted)).toEqual([expect.stringContaining('path 불일치')]);
    }
  });
  it('backend 가 bare @Post() 에 세그먼트를 붙이면(@Post(":id")) web 의 base 발사가 path 불일치로 잡힌다 (negative (b) — 세그먼트 초과 drift)', async () => {
    const drifted: BackendContract = { ...CREATE_CONTRACT, subPath: ':id' };
    expect(diffContract(await fireCreateGroup('평가 A조'), drifted)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Patch/@Put 로 바꿨는데 web 은 POST 발사 → method 불일치로 잡힌다 (negative (c) — method drift)', async () => {
    const fired = await fireCreateGroup('평가 A조');
    for (const src of ['  @Patch()', '  @Put()']) {
      const handler = extractHandlerMethods([src, '  async create() {}'].join('\n')).create;
      const drifted: BackendContract = { ...CREATE_CONTRACT, method: handler.method };
      expect(diffContract(fired, drifted)).toEqual([expect.stringContaining('method 불일치')]);
    }
  });

  // (d) required 추가 후 web 미발사 → 누락, (e) web 초과 키 → 초과 — declared 부분집합 위반(400 예방).
  it.each<[string, BackendContract | ((base: WebFire) => Set<string>), string]>([
    ['(d) backend DTO 가 required description 추가했는데 web body 는 name 만', { ...CREATE_CONTRACT, required: new Set(['name', 'description']) }, 'body 필수 누락'],
    ['(e) web 이 정의 밖 필드 foo 를 붙임', (base) => new Set([...base.bodyKeys, 'foo']), 'body 초과 키'],
  ])('web body 가 %s 면 부분집합 위반으로 잡힌다 (negative — 400 예방)', async (_label, mutate, expected) => {
    const fired = await fireCreateGroup('평가 A조');
    const [fire, backend] =
      typeof mutate === 'function'
        ? [{ ...fired, bodyKeys: mutate(fired) }, CREATE_CONTRACT]
        : [fired, mutate];
    expect(diffContract(fire, backend)).toEqual([expect.stringContaining(expected)]);
  });

  it('web 이 Content-Type/body 를 누락하면 body 존재 대조가 fail 한다 (negative (f) — 헤더/body 누락 → 400)', () => {
    const fire = toFire('/api/groups', { method: 'POST' } as RequestOptions);
    // 필수 name 누락 + body 부재 + Content-Type 부재 — 최소 body 존재 대조 사유가 포함된다.
    const issues = diffContract(fire, CREATE_CONTRACT);
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining('body 부재')]));
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining('Content-Type 부재/불일치')]));
  });
  it('주석 줄의 "@Post()"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (g) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/groups") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Post() — 주석뿐, decorator 없음', '  async create() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).create).toBeUndefined();
    const drifted: BackendContract = {
      ...CREATE_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).create?.method ?? null,
    };
    expect(diffContract(await fireCreateGroup('평가 A조'), drifted)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const emptyFields = extractDtoFields('', 'CreateGroupDto');
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').create?.method ?? null,
      subPath: '',
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireCreateGroup('평가 A조'), empty)).toEqual(['backend 계약 추출 실패']);
  });
});
