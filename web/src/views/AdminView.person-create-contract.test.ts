import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { CreatePersonDeps } from './AdminView';
import { runCreatePerson } from './AdminView';

// R-112 — 인원 생성(POST /api/persons) web↔backend **계약 drift guard**. 추출기/대조기 상세 주석은
// 선례 AdminView.create-user-contract.test.ts(T-1172, 다중 required) · AdminView.group-create-
// contract.test.ts(T-1175, api base + POST body/Content-Type 존재) 참조(AST 대신 정규식 → 새 dep 0).
// endpoint-특화 축 4개: (1) `@Controller("api/persons")` 신규 domain base + bare `@Post()` 합성 →
// `/api/persons`(세그먼트 0). (2) `CreatePersonDto` fullName+email **2 required** body 부분집합.
// (3) POST JSON body + Content-Type 존재 ↔ backend `@Body` 존재 정합(T-1177 DELETE body 부재와 대비).
// (4) POST method ↔ `@Post`. base 오타·세그먼트 추가·method/DTO/`@Body` 변경 시 fail.

// 주석 제거 — 추출이 주석 문구를 잡으면 guard 무력화(negative (h)).
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
// method decorator — HTTP method + sub-path(`@Post()`→''; `@Post(":id")`→':id') + 시그니처의
// `@Body` 존재 여부(body-요구 핸들러 대조 근거). 인자 부재가 bare route(세그먼트 0) 정규화 근거.
interface HandlerDecorator {
  method: string;
  subPath: string;
  hasBody: boolean;
}
function extractHandlerMethods(source: string): Record<string, HandlerDecorator> {
  const found: Record<string, HandlerDecorator> = {};
  let pending: { method: string; subPath: string } | null = null;
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
      found[handler[1]] = { method: pending.method, subPath: pending.subPath, hasBody: /@Body\b/.test(line) };
      pending = null;
    }
  }
  return found;
}
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
  hasBody: boolean;
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
function composeRoute(route: string, subPath: string): string {
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${normalizeRoute(route)}/${trimmed}` : normalizeRoute(route);
}
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
  // web body/Content-Type 존재 ↔ backend @Body 존재 정합(T-1177 DELETE body 부재와 대비).
  if (fire.hasBody !== backend.hasBody) {
    issues.push(`body 존재 정합 위반: web=${fire.hasBody} backend=${backend.hasBody}`);
  }
  if (fire.hasBody && fire.contentType !== 'application/json') {
    issues.push(`Content-Type 부재/불일치: ${String(fire.contentType)}`);
  }
  return issues;
}

const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/person.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/user/dto/create-person.dto.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'CreatePersonDto');
const CREATE_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).create ?? null;
const CREATE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: CREATE_HANDLER?.method ?? null,
  subPath: CREATE_HANDLER?.subPath ?? '',
  hasBody: CREATE_HANDLER?.hasBody ?? false,
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
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
// 러너를 mock deps 로 직접 호출해 실 발사 인자를 캡처(ADR-0040 §5 — RTL/jsdom 없음).
async function fireCreatePerson(fullName: string, email: string): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: CreatePersonDeps = {
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
  await runCreatePerson({ fullName, email }, deps);
  if (!fired) {
    throw new Error('인원 생성 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 인원 생성 web↔backend 계약 drift guard (T-1178)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(CREATE_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size).toBeGreaterThan(0);
  });
  it('backend @Controller("api/persons") base route 를 /api/persons 로 정규화한다 (분기 — 인원 base 파싱)', () => {
    expect(ROUTE).toBe('api/persons');
    expect(normalizeRoute(String(ROUTE))).toBe('/api/persons');
  });
  it('backend @Post() bare route(인자 부재)를 base 자체와 합성해 세그먼트 0 template 을 만든다 (분기 — bare 합성, path param 0)', () => {
    expect(CREATE_CONTRACT.method).toBe('POST');
    expect(CREATE_CONTRACT.subPath).toBe('');
    expect(composeRoute(String(ROUTE), CREATE_CONTRACT.subPath)).toBe('/api/persons');
  });
  it('backend @Post(":id") 처럼 인자가 있으면 base 와 합성한다 (분기 — 인자 합성, bare 대비)', () => {
    const handler = extractHandlerMethods(['  @Post(":id")', '  async create() {}'].join('\n')).create;
    expect(handler).toEqual({ method: 'POST', subPath: ':id', hasBody: false });
    expect(composeRoute('api/persons', handler.subPath)).toBe('/api/persons/:id');
  });
  it('backend create 핸들러가 @Body decorator 있는 body-요구 핸들러임을 추출한다 (분기 — @Body 존재 추출)', () => {
    expect(CREATE_CONTRACT.hasBody).toBe(true);
    const bodyless = extractHandlerMethods(['  @Post()', '  async create(dto: CreatePersonDto) {}'].join('\n')).create;
    expect(bodyless).toEqual({ method: 'POST', subPath: '', hasBody: false });
  });
  it('인원 생성 발사(POST /api/persons)가 backend create 계약과 완전 일치한다 (happy-path)', async () => {
    expect(diffContract(await fireCreatePerson('홍길동', 'hong@example.com'), CREATE_CONTRACT)).toEqual([]);
  });
  it('발사 body 키가 declared 부분집합을 만족한다(초과 0·필수 누락 0, fullName·email 둘 다) (happy-path — body 부분집합)', async () => {
    const fired = await fireCreatePerson('홍길동', 'hong@example.com');
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...fired.bodyKeys].every((key) => declared.has(key))).toBe(true);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true);
    expect([...fired.bodyKeys].sort()).toEqual(['email', 'fullName']);
  });
  it('POST 발사에 JSON body 와 Content-Type: application/json 헤더가 존재하고 backend @Body 와 정합한다 (분기 — body/헤더 존재 대조)', async () => {
    const fired = await fireCreatePerson('홍길동', 'hong@example.com');
    expect(fired.method).toBe('POST');
    expect(fired.hasBody).toBe(true);
    expect(fired.contentType).toBe('application/json');
    expect(fired.hasBody).toBe(CREATE_CONTRACT.hasBody);
  });
  it('extractDtoFields 가 fullName·email 을 required 로 분류하고 optional 은 비어있다 (분기 — 다중 required 추출)', () => {
    expect([...DTO_FIELDS.required].sort()).toEqual(['email', 'fullName']);
    expect(DTO_FIELDS.optional.size).toBe(0);
  });
  it('extractDtoFields 가 `x?` 표기 필드를 optional 집합으로 수집한다 (분기 — optional 수집, 합성 DTO)', () => {
    // 실 CreatePersonDto 는 optional 0 → 합성 소스로 분기 직접 구동.
    const synthetic = ['export class SyntheticDto {', '  fullName!: string;', '  department?: string;', '}'].join('\n');
    const fields = extractDtoFields(synthetic, 'SyntheticDto');
    expect([...fields.required].sort()).toEqual(['fullName']);
    expect([...fields.optional].sort()).toEqual(['department']);
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합 + hasBody=false 로 매핑된다 (분기 — body 부재)', () => {
    const fire = toFire('/api/persons', { method: 'POST' } as RequestOptions);
    expect(fire.bodyKeys.size).toBe(0);
    expect(fire.hasBody).toBe(false);
  });

  it('backend 가 base 를 api/person(오타)/api/people 로 바꾸면 web 의 /api/persons 발사가 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', async () => {
    const fired = await fireCreatePerson('홍길동', 'hong@example.com');
    for (const base of ['api/person', 'api/people']) {
      const drifted: BackendContract = { ...CREATE_CONTRACT, route: base };
      expect(diffContract(fired, drifted)).toEqual([expect.stringContaining('path 불일치')]);
    }
  });
  it('backend 가 bare @Post() 에 세그먼트를 붙이면(@Post("bulk")) web 의 base 발사가 path 불일치로 잡힌다 (negative (b) — 세그먼트 초과 drift)', async () => {
    const drifted: BackendContract = { ...CREATE_CONTRACT, subPath: 'bulk' };
    expect(diffContract(await fireCreatePerson('홍길동', 'hong@example.com'), drifted)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Patch/@Put 로 바꿨는데 web 은 POST 발사 → method 불일치로 잡힌다 (negative (e) — method drift)', async () => {
    const fired = await fireCreatePerson('홍길동', 'hong@example.com');
    for (const src of ['  @Patch()', '  @Put()']) {
      const handler = extractHandlerMethods([src, '  async create() {}'].join('\n')).create;
      const drifted: BackendContract = { ...CREATE_CONTRACT, method: handler.method };
      expect(diffContract(fired, drifted)).toEqual([expect.stringContaining('method 불일치')]);
    }
  });

  // (c) required 추가 후 미발사·(d) web 이 email 빠뜨림 → required 부분집합 위반(400 예방).
  it.each<[string, BackendContract | ((base: WebFire) => Set<string>), string]>([
    ['(c) backend DTO 가 required department 추가했는데 web body 는 fullName·email 만', { ...CREATE_CONTRACT, required: new Set(['fullName', 'email', 'department']) }, 'body 필수 누락'],
    ['(d) web body 가 required email 을 빠뜨림(fullName 만)', (base) => new Set([...base.bodyKeys].filter((key) => key !== 'email')), 'body 필수 누락'],
  ])('web/backend 가 %s 면 부분집합 위반으로 잡힌다 (negative — 400 예방)', async (_label, mutate, expected) => {
    const fired = await fireCreatePerson('홍길동', 'hong@example.com');
    const [fire, backend] =
      typeof mutate === 'function'
        ? [{ ...fired, bodyKeys: mutate(fired) }, CREATE_CONTRACT]
        : [fired, mutate];
    expect(diffContract(fire, backend)).toEqual([expect.stringContaining(expected)]);
  });

  it('backend 가 @Body decorator 를 제거(body-less)했는데 web 은 body 발사 → body 존재 정합 위반으로 잡힌다 (negative (f) — @Body 제거 drift)', async () => {
    const drifted: BackendContract = { ...CREATE_CONTRACT, hasBody: false };
    expect(diffContract(await fireCreatePerson('홍길동', 'hong@example.com'), drifted)).toEqual([expect.stringContaining('body 존재 정합 위반')]);
  });
  it('web 이 Content-Type 헤더를 빼고 body 만 발사하면 Content-Type 존재 대조가 fail 한다 (negative (g) — 헤더 누락 → 400)', () => {
    const fire = toFire('/api/persons', { method: 'POST', body: JSON.stringify({ fullName: '홍길동', email: 'hong@example.com' }) } as RequestOptions);
    expect(diffContract(fire, CREATE_CONTRACT)).toEqual([expect.stringContaining('Content-Type 부재/불일치')]);
  });
  it('주석 줄의 "@Post()"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (h) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/persons") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Post() — 주석뿐, decorator 없음', '  async create() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).create).toBeUndefined();
    const drifted: BackendContract = {
      ...CREATE_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).create?.method ?? null,
    };
    expect(diffContract(await fireCreatePerson('홍길동', 'hong@example.com'), drifted)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const emptyFields = extractDtoFields('', 'CreatePersonDto');
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').create?.method ?? null,
      subPath: '',
      hasBody: false,
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireCreatePerson('홍길동', 'hong@example.com'), empty)).toEqual(['backend 계약 추출 실패']);
  });
});
