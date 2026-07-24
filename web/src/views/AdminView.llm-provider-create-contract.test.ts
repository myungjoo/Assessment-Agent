import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { CreateProviderDeps, CreateProviderFields } from './AdminView';
import { runCreateProvider } from './AdminView';

// R-112 — LLM provider 생성(POST /api/llm/providers) web↔backend **계약 drift guard**. 추출기 상세는 선례
// part-create(T-1181, 1 required)·person-create(T-1178, 2 required) 참조(정규식 → 새 dep 0). 특화 축 4개:
// (1) `@Controller("api/llm/providers")` **3-세그먼트 base**(arc 최초) + bare `@Post()` → `/api/llm/providers`
// (세그먼트 0). (2) 4 required(provider·endpointUrl·apiKey·modelId, arc 최대) 부분집합. (3) POST body/Content-
// Type ↔ 멀티라인 `@Body`(별도 줄) 존재 정합. (4) POST method ↔ `@Post`.

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
// HTTP method + sub-path + 시그니처 `@Body` 존재. 인자 부재가 bare route(세그먼트 0) 근거. LLM controller 는
// 시그니처가 여러 줄(@Body 별도 줄)이라 handler 이름 줄부터 괄호 균형(depth) 0 까지 이어붙여 @Body 를 탐지한다.
interface HandlerDecorator {
  method: string;
  subPath: string;
  hasBody: boolean;
}
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
      continue; // 그 외 decorator(@HttpCode/@UsePipes/@UseGuards/@Roles/@Param)는 handler 로 오인하지 않는다.
    }
    const handler = /^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (handler && pending) {
      // 시그니처가 여러 줄일 수 있다 — 괄호 균형(depth)이 0 이 될 때까지 이어붙여 @Body 를 탐지한다.
      let signature = line;
      let depth = (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
      let j = i;
      while (depth > 0 && j + 1 < lines.length) {
        j += 1;
        signature += `\n${lines[j]}`;
        depth += (lines[j].match(/\(/g) ?? []).length - (lines[j].match(/\)/g) ?? []).length;
      }
      found[handler[1]] = { method: pending.method, subPath: pending.subPath, hasBody: /@Body\b/.test(signature) };
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
const pathParams = (route: string): string[] => route.split('/').filter((seg) => seg.startsWith(':'));
// 불일치 사유 목록 — 빈 배열=계약 일치. 추출 실패도 통과가 아니라 사유 1건(선단언 방어).
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
  if (fire.hasBody !== backend.hasBody) {
    issues.push(`body 존재 정합 위반: web=${fire.hasBody} backend=${backend.hasBody}`);
  }
  if (fire.hasBody && fire.contentType !== 'application/json') {
    issues.push(`Content-Type 부재/불일치: ${String(fire.contentType)}`);
  }
  return issues;
}
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/llm/llm-provider-config.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/llm/dto/create-llm-provider-config.dto.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'CreateLlmProviderConfigDto');
const CREATE_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).create ?? null;
const CREATE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: CREATE_HANDLER?.method ?? null,
  subPath: CREATE_HANDLER?.subPath ?? '',
  hasBody: CREATE_HANDLER?.hasBody ?? false,
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const REQUIRED_FIELDS = ['apiKey', 'endpointUrl', 'modelId', 'provider']; // 정렬된 4 required
const VALID_FIELDS: CreateProviderFields = { provider: 'openai', endpointUrl: 'https://api.openai.com/v1', apiKey: 'sk-test-key', modelId: 'gpt-4o' };
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
async function fireCreateProvider(fields: CreateProviderFields = VALID_FIELDS): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: CreateProviderDeps = {
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
  await runCreateProvider(fields, deps);
  if (!fired) {
    throw new Error('provider 생성 러너가 발사하지 않았다');
  }
  return fired;
}
describe('AdminView — LLM provider 생성 web↔backend 계약 drift guard (T-1184)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(CREATE_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size).toBeGreaterThan(0);
  });
  it('backend @Controller("api/llm/providers") 3-세그먼트 base 를 /api/llm/providers 로 정규화한다 (분기 — 다중 세그먼트 base 파싱)', () => {
    expect(ROUTE).toBe('api/llm/providers');
    expect(String(ROUTE).split('/')).toHaveLength(3); // arc 최초의 3-세그먼트 base
    expect(normalizeRoute(String(ROUTE))).toBe('/api/llm/providers');
  });
  it('backend @Post() bare route(인자 부재)를 3-세그먼트 base 와 합성해 path param 정확히 0개 template 을 만든다 (분기 — bare 세그먼트 0 합성)', () => {
    expect(CREATE_CONTRACT.method).toBe('POST');
    expect(CREATE_CONTRACT.subPath).toBe('');
    const composed = composeRoute(String(ROUTE), CREATE_CONTRACT.subPath);
    expect(composed).toBe('/api/llm/providers');
    expect(pathParams(composed)).toEqual([]); // path param 정확히 0개(컬렉션 루트 POST)
  });
  it('backend create 핸들러가 멀티라인 시그니처의 @Body decorator(별도 줄)를 추출한다 (분기 — @Body 존재 추출)', () => {
    expect(CREATE_CONTRACT.hasBody).toBe(true); // 실 controller 는 @Body 가 async create( 다음 줄
    const multiline = extractHandlerMethods(['  @Post()', '  async create(', '    @Body() dto: Dto,', '  ): Promise<View> {'].join('\n')).create;
    expect(multiline).toEqual({ method: 'POST', subPath: '', hasBody: true });
    const bodyless = extractHandlerMethods(['  @Post()', '  async create(dto: CreateLlmProviderConfigDto) {}'].join('\n')).create;
    expect(bodyless).toEqual({ method: 'POST', subPath: '', hasBody: false });
  });
  it('provider 생성 발사(POST /api/llm/providers)가 backend create 계약과 완전 일치하고 4 required 부분집합을 만족한다 (happy-path — 초과 0·필수 누락 0)', async () => {
    const fired = await fireCreateProvider();
    expect(diffContract(fired, CREATE_CONTRACT)).toEqual([]);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true);
    expect([...fired.bodyKeys].sort()).toEqual(REQUIRED_FIELDS);
  });
  it('POST 발사에 JSON body 와 Content-Type: application/json 헤더가 존재하고 backend @Body 와 정합한다 (분기 — body/헤더 존재 대조)', async () => {
    const fired = await fireCreateProvider();
    expect(fired.method).toBe('POST');
    expect(fired.hasBody).toBe(true);
    expect(fired.contentType).toBe('application/json');
    expect(fired.hasBody).toBe(CREATE_CONTRACT.hasBody);
  });
  it('extractDtoFields 가 4 필드를 required 로 분류하고 `x?` 표기는 optional 로 수집한다 (분기 — 4 required 추출·optional 수집)', () => {
    expect([...DTO_FIELDS.required].sort()).toEqual(REQUIRED_FIELDS);
    expect(DTO_FIELDS.optional.size).toBe(0);
    const synthetic = ['export class SyntheticDto {', '  provider!: string;', '  region?: string;', '}'].join('\n'); // 실 DTO optional 0 → 합성 구동
    const fields = extractDtoFields(synthetic, 'SyntheticDto');
    expect([...fields.required].sort()).toEqual(['provider']);
    expect([...fields.optional].sort()).toEqual(['region']);
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합 + hasBody=false 로 매핑된다 (분기 — body 부재)', () => {
    const fire = toFire('/api/llm/providers', { method: 'POST' } as RequestOptions);
    expect(fire.bodyKeys.size).toBe(0);
    expect(fire.hasBody).toBe(false);
  });
  it.each<[string, string]>([
    ['(a) base 오타 api/llm/provider', 'api/llm/provider'],
    ['(a) 세그먼트 축소 api/providers', 'api/providers'],
  ])('backend 가 base 를 %s 로 바꾸면 web 의 /api/llm/providers 발사가 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', async (_label, base) => {
    const drifted: BackendContract = { ...CREATE_CONTRACT, route: base };
    expect(diffContract(await fireCreateProvider(), drifted)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 bare @Post() 를 @Post(":id")(세그먼트 추가, param 1)로 바꾸면 web 의 base 발사가 path 불일치로 잡힌다 (negative (b) — 세그먼트 초과 drift)', async () => {
    const handler = extractHandlerMethods(['  @Post(":id")', '  async create() {}'].join('\n')).create;
    const drifted: BackendContract = { ...CREATE_CONTRACT, subPath: handler.subPath };
    expect(pathParams(composeRoute(String(ROUTE), drifted.subPath))).toEqual([':id']); // 세그먼트 1개로 초과
    expect(diffContract(await fireCreateProvider(), drifted)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Patch/@Delete 로 바꿨는데 web 은 POST 발사 → method 불일치로 잡힌다 (negative (c) — method drift)', async () => {
    const fired = await fireCreateProvider();
    for (const src of ['  @Patch()', '  @Delete()']) {
      const handler = extractHandlerMethods([src, '  async create() {}'].join('\n')).create;
      const drifted: BackendContract = { ...CREATE_CONTRACT, method: handler.method };
      expect(diffContract(fired, drifted)).toEqual([expect.stringContaining('method 불일치')]);
    }
  });
  it.each<[string, BackendContract | ((base: WebFire) => Set<string>), string]>([
    ['(d) backend DTO 가 required region 추가했는데 web body 는 4 필드만', { ...CREATE_CONTRACT, required: new Set([...REQUIRED_FIELDS, 'region']) }, 'body 필수 누락'],
    ['(e) web body 가 required modelId 를 누락함', (base) => new Set([...base.bodyKeys].filter((key) => key !== 'modelId')), 'body 필수 누락'],
    ['(e2) web body 가 whitelist 밖 필드 region 을 추가함', (base) => new Set([...base.bodyKeys, 'region']), 'body 초과 키'],
  ])('web/backend 가 %s 면 부분집합/allowed 위반으로 잡힌다 (negative (d)(e) — 400 예방)', async (_label, mutate, expected) => {
    const fired = await fireCreateProvider();
    const [fire, backend] =
      typeof mutate === 'function' ? [{ ...fired, bodyKeys: mutate(fired) }, CREATE_CONTRACT] : [fired, mutate];
    expect(diffContract(fire, backend)).toEqual([expect.stringContaining(expected)]);
  });
  it('backend 가 @Body decorator 를 제거(body-less)했는데 web 은 body 발사 → body 존재 정합 위반으로 잡힌다 (negative (g) — @Body 제거 drift)', async () => {
    const drifted: BackendContract = { ...CREATE_CONTRACT, hasBody: false };
    expect(diffContract(await fireCreateProvider(), drifted)).toEqual([expect.stringContaining('body 존재 정합 위반')]);
  });
  it('web 이 Content-Type 헤더를 빼고 body 만 발사하면 Content-Type 존재 대조가 fail 한다 (negative (f) — 헤더 누락 → 400)', () => {
    const fire = toFire('/api/llm/providers', { method: 'POST', body: JSON.stringify(VALID_FIELDS) } as RequestOptions);
    expect(diffContract(fire, CREATE_CONTRACT)).toEqual([expect.stringContaining('Content-Type 부재/불일치')]);
  });
  it('주석 줄의 "@Post()"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (h) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/llm/providers") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Post() — 주석뿐, decorator 없음', '  async create() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).create).toBeUndefined();
    const drifted: BackendContract = {
      ...CREATE_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).create?.method ?? null,
    };
    expect(diffContract(await fireCreateProvider(), drifted)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const emptyFields = extractDtoFields('', 'CreateLlmProviderConfigDto');
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').create?.method ?? null,
      subPath: '',
      hasBody: false,
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireCreateProvider(), empty)).toEqual(['backend 계약 추출 실패']);
  });
});
