import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { Difficulty } from '../components/DifficultyModelSelector';
import type { AssignDeps } from './AdminView';
import { runAssign } from './AdminView';

// R-112 — 난이도-모델 매핑 지정(PATCH /api/llm/difficulty-mappings/:difficulty) web↔backend **계약 drift guard**.
// 추출기 상세는 선례 llm-provider-update(T-1185) 참조(정규식만 → 새 dep 0). 신규 축: 3-세그먼트 base `api/llm/difficulty-mappings`
// + `@Patch(":difficulty")` semantic path param + 단일 required body `llmProviderConfigId`(부분갱신 아닌 필수 지정) + 200 with-body.

function stripComments(source: string): string { // 주석 제거 — 추출이 주석 문구를 잡으면 guard 무력화(negative (h)).
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
  hasBody: boolean;
}
// HTTP method + sub-path + 시그니처 `@Body` 존재. 멀티라인 시그니처는 handler 줄부터 괄호 균형 0 까지 이어붙여 @Body 탐지(T-1185 동형).
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
// `:difficulty`→실 난이도(web 과 동일 encodeURIComponent — runAssign 이 `${difficulty}` 를 그대로 삽입하므로 정합 확인).
const expectedPath = (route: string, subPath: string, difficulty: string): string =>
  composeRoute(route, subPath).replace(':difficulty', encodeURIComponent(difficulty));
// 불일치 사유 목록 — 빈 배열=계약 일치. 추출 실패도 통과가 아니라 사유 1건(선단언 방어). assign 은 required 를 빠짐없이 채우고 allow-set 초과 금지.
function diffContract(fire: WebFire, backend: BackendContract, difficulty: string): string[] {
  if (!backend.route || !backend.method || backend.required.size + backend.optional.size === 0) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== expectedPath(backend.route, backend.subPath, difficulty)) {
    issues.push(`path 불일치: ${fire.path}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  const declared = new Set([...backend.required, ...backend.optional]);
  const extras = [...fire.bodyKeys].filter((key) => !declared.has(key)).sort(); // fired ⊄ declared(allow-set) → 400 whitelist reject
  if (extras.length > 0) {
    issues.push(`body 초과 키: ${extras.join(',')}`);
  }
  const missing = [...backend.required].filter((key) => !fire.bodyKeys.has(key)).sort(); // required 누락 → 400(@IsNotEmpty)
  if (missing.length > 0) {
    issues.push(`required 누락: ${missing.join(',')}`);
  }
  if (fire.hasBody !== backend.hasBody) { // web body/Content-Type ↔ backend @Body 존재 정합
    issues.push(`body 존재 정합 위반: web=${fire.hasBody} backend=${backend.hasBody}`);
  }
  if (fire.hasBody && fire.contentType !== 'application/json') {
    issues.push(`Content-Type 부재/불일치: ${String(fire.contentType)}`);
  }
  return issues;
}
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/llm/difficulty-mapping.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/llm/dto/assign-difficulty-mapping.dto.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLERS = extractHandlerMethods(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'AssignDifficultyMappingDto');
const ASSIGN_HANDLER = HANDLERS.assign ?? null;
const ASSIGN_CONTRACT: BackendContract = {
  route: ROUTE,
  method: ASSIGN_HANDLER?.method ?? null,
  subPath: ASSIGN_HANDLER?.subPath ?? '',
  hasBody: ASSIGN_HANDLER?.hasBody ?? false,
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const DIFFICULTY: Difficulty = 'easy';
const PROVIDER_ID = 'lp-1';
const REQUIRED_SET = ['llmProviderConfigId']; // 단일 required 필드
// options.body 부재/null 은 빈 키 집합 + hasBody=false 매핑(러너 발사 인자 캡처, ADR-0040 §5).
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
async function fireAssign(difficulty: Difficulty, providerId: string = PROVIDER_ID): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: AssignDeps = {
    patch: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    assigning: false,
    setAssigning: () => {},
    setAssignError: () => {},
    setOptimistic: () => {},
    bumpRefresh: () => {},
  };
  await runAssign(difficulty, providerId, deps);
  if (!fired) {
    throw new Error('assign 러너가 발사하지 않았다');
  }
  return fired;
}
describe('AdminView — 난이도-모델 매핑 지정 web↔backend 계약 drift guard (T-1187)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(ASSIGN_CONTRACT.method).not.toBeNull();
    expect(ASSIGN_CONTRACT.subPath).not.toBe('');
    expect(DTO_FIELDS.required.size + DTO_FIELDS.optional.size).toBeGreaterThan(0);
  });
  it('backend @Controller("api/llm/difficulty-mappings") 3-세그먼트 base 를 /api/llm/difficulty-mappings 로 정규화한다 (분기 — base 파싱)', () => {
    expect(ROUTE).toBe('api/llm/difficulty-mappings');
    expect(String(ROUTE).split('/')).toHaveLength(3); // api·llm·difficulty-mappings
    expect(normalizeRoute(String(ROUTE))).toBe('/api/llm/difficulty-mappings');
  });
  it('backend @Patch(":difficulty") 세그먼트를 base 와 합성해 path param 1개(:difficulty) template 을 만든다 (분기 — :difficulty 합성)', () => {
    expect(ASSIGN_CONTRACT.method).toBe('PATCH');
    expect(ASSIGN_CONTRACT.subPath).toBe(':difficulty');
    const composed = composeRoute(String(ROUTE), ASSIGN_CONTRACT.subPath);
    expect(composed).toBe('/api/llm/difficulty-mappings/:difficulty');
    expect(composed.split('/').filter(Boolean)).toHaveLength(4); // 세그먼트 4개(api·llm·difficulty-mappings·:difficulty)
    expect(pathParams(composed)).toEqual([':difficulty']); // path param 정확히 1개
    expect(expectedPath(String(ROUTE), ASSIGN_CONTRACT.subPath, DIFFICULTY)).toBe('/api/llm/difficulty-mappings/easy');
  });
  it("runAssign('easy','lp-1') 발사(PATCH /api/llm/difficulty-mappings/easy)가 backend assign 계약과 완전 일치한다 (happy-path)", async () => {
    const fired = await fireAssign(DIFFICULTY);
    expect(fired.path).toBe('/api/llm/difficulty-mappings/easy');
    expect(fired.method).toBe('PATCH');
    expect(diffContract(fired, ASSIGN_CONTRACT, DIFFICULTY)).toEqual([]);
  });
  it("PATCH 발사가 Content-Type: application/json 헤더 + body { llmProviderConfigId: 'lp-1' } 를 담고 backend required 집합과 정합한다 (happy-path — body/헤더 정합)", async () => {
    const fired = await fireAssign(DIFFICULTY);
    expect(fired.hasBody).toBe(true);
    expect(fired.contentType).toBe('application/json');
    expect([...fired.bodyKeys].sort()).toEqual(REQUIRED_SET); // 정확히 llmProviderConfigId 1개
    expect([...DTO_FIELDS.required].sort()).toEqual(REQUIRED_SET);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true); // required 빠짐없이 채움
    expect([...fired.bodyKeys].every((key) => new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]).has(key))).toBe(true); // ⊆ allow-set
    expect(fired.hasBody).toBe(ASSIGN_CONTRACT.hasBody);
  });
  it('extractDtoFields 가 llmProviderConfigId 를 단일 required 로 분류한다(@IsOptional 부재) (분기 — @Body 존재 + required subset)', () => {
    expect([...DTO_FIELDS.required].sort()).toEqual(REQUIRED_SET);
    expect(DTO_FIELDS.optional.size).toBe(0); // assign 은 필수 지정 — optional 공집합
    expect(ASSIGN_CONTRACT.hasBody).toBe(true); // 실 controller assign 은 멀티라인 시그니처의 @Body 보유
    const multiline = extractHandlerMethods(
      ['  @Patch(":difficulty")', '  async assign(', '    @Param("difficulty") difficulty: string,', '    @Body() dto: Dto,', '  ): Promise<View> {'].join('\n'),
    ).assign;
    expect(multiline).toEqual({ method: 'PATCH', subPath: ':difficulty', hasBody: true });
  });
  it('같은 소스의 findAll 핸들러는 body-less(hasBody=false)로 추출된다 (분기 — @Body 부재 대조군)', () => {
    expect(HANDLERS.findAll).toBeDefined();
    expect(HANDLERS.findAll.method).toBe('GET');
    expect(HANDLERS.findAll.subPath).toBe(''); // @Get() bare
    expect(HANDLERS.findAll.hasBody).toBe(false); // 추출기가 실제로 body 유무를 구분함 입증
  });
  it('valid difficulty(easy/medium/hard)는 특수문자가 없어 runAssign 의 raw 삽입 path 가 안 깨진다 (분기 — difficulty 인코딩)', async () => {
    for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) {
      expect(encodeURIComponent(d)).toBe(d); // 유효 난이도 도메인은 encodeURIComponent identity — raw 삽입이 안전
      const fired = await fireAssign(d);
      expect(fired.path).toBe(`/api/llm/difficulty-mappings/${d}`);
      expect(fired.path).toBe(expectedPath(String(ROUTE), ASSIGN_CONTRACT.subPath, d)); // raw == 인코딩 기대값
      expect(diffContract(fired, ASSIGN_CONTRACT, d)).toEqual([]);
    }
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합 + hasBody=false 로 매핑된다 (분기 — body 부재)', () => {
    const fire = toFire('/api/llm/difficulty-mappings/easy', { method: 'PATCH' } as RequestOptions);
    expect(fire.bodyKeys.size).toBe(0);
    expect(fire.hasBody).toBe(false);
  });
  it.each<[string, () => BackendContract]>([
    ['(a) backend base 를 api/llm/difficulty-mapping(단수 오타)로', () => ({ ...ASSIGN_CONTRACT, route: 'api/llm/difficulty-mapping' })],
    ['(a) backend base 를 api/llm/difficulty-mappings-x(접미 drift)로', () => ({ ...ASSIGN_CONTRACT, route: 'api/llm/difficulty-mappings-x' })],
    ['(b) @Patch(":difficulty/reset")(세그먼트 추가)로', () => ({ ...ASSIGN_CONTRACT, subPath: extractHandlerMethods(['  @Patch(":difficulty/reset")', '  async assign(@Body() d: any) {}'].join('\n')).assign.subPath })],
    ['(c) bare @Patch()(세그먼트 0)로', () => ({ ...ASSIGN_CONTRACT, subPath: extractHandlerMethods(['  @Patch()', '  async assign(@Body() d: any) {}'].join('\n')).assign.subPath })],
  ])('%s 면 path 불일치로 잡힌다 (negative (a)(b)(c) — path drift, 404 예방)', async (_label, build) => {
    expect(diffContract(await fireAssign(DIFFICULTY), build(), DIFFICULTY)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it.each<[string, (f: WebFire) => WebFire, (c: BackendContract) => BackendContract, string]>([
    ['(d) method 를 @Put 로 바꿈', (f) => f, (c) => ({ ...c, method: extractHandlerMethods(['  @Put(":difficulty")', '  async assign(@Body() d: any) {}'].join('\n')).assign.method }), 'method 불일치'],
    ['(d) method 를 @Post 로 바꿈', (f) => f, (c) => ({ ...c, method: extractHandlerMethods(['  @Post(":difficulty")', '  async assign(@Body() d: any) {}'].join('\n')).assign.method }), 'method 불일치'],
    ['(e) required 필드 rename(llmProviderConfigId→providerConfigId)', (f) => f, (c) => ({ ...c, required: new Set(['providerConfigId']) }), 'required 누락'],
    ['(f) web 이 allow-set 밖 provider 키 발사', (f) => ({ ...f, bodyKeys: new Set([...f.bodyKeys, 'provider']) }), (c) => c, 'body 초과 키'],
    ['(f) web 이 required llmProviderConfigId 를 누락', (f) => ({ ...f, bodyKeys: new Set<string>() }), (c) => c, 'required 누락'],
    ['(i) @Body decorator 제거(body-less)', (f) => f, (c) => ({ ...c, hasBody: false }), 'body 존재 정합 위반'],
  ])('%s 면 대조가 fail 한다 (negative (d)(e)(f)(i) — drift 잡힘)', async (_label, mutateFire, mutateContract, expected) => {
    const fired = await fireAssign(DIFFICULTY);
    // rename drift 처럼 한 변조가 복수 사유(초과 키 + required 누락)를 유발할 수 있으므로 arrayContaining 으로 해당 drift 포착만 단언.
    expect(diffContract(mutateFire(fired), mutateContract(ASSIGN_CONTRACT), DIFFICULTY)).toEqual(
      expect.arrayContaining([expect.stringContaining(expected)]),
    );
  });
  it('web 이 difficulty 를 encodeURIComponent 없이 raw 삽입하면 비정상 문자 케이스에서 path 불일치로 잡힌다 (negative (g) — encode 누락)', async () => {
    const weird = 'ea sy/x?a';
    const fired = await fireAssign(weird as Difficulty); // runAssign 은 ${difficulty} 를 raw 삽입 → 미인코딩 path
    expect(fired.path).toBe(`/api/llm/difficulty-mappings/${weird}`); // 실제로 인코딩 안 됨
    expect(diffContract(fired, ASSIGN_CONTRACT, weird)).toEqual([expect.stringContaining('path 불일치')]); // 인코딩 기대값과 불일치로 잡힘
  });
  it('web 이 Content-Type 헤더를 빼고 body 만 발사하면 Content-Type 존재 대조가 fail 한다 (negative — 헤더 누락 → 400/415)', () => {
    const fire = toFire('/api/llm/difficulty-mappings/easy', { method: 'PATCH', body: JSON.stringify({ llmProviderConfigId: 'lp-1' }) } as RequestOptions);
    expect(diffContract(fire, ASSIGN_CONTRACT, DIFFICULTY)).toEqual([expect.stringContaining('Content-Type 부재/불일치')]);
  });
  it('주석 줄의 "@Patch(":difficulty")"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (h) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/llm/difficulty-mappings") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Patch(":difficulty") — 주석뿐, decorator 없음', '  async assign() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).assign).toBeUndefined();
    const drifted: BackendContract = { ...ASSIGN_CONTRACT, route: extractControllerRoute(fakeController), method: extractHandlerMethods(fakeHandler).assign?.method ?? null };
    expect(diffContract(await fireAssign(DIFFICULTY), drifted, DIFFICULTY)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const ef = extractDtoFields('', 'AssignDifficultyMappingDto');
    const empty: BackendContract = { route: extractControllerRoute(''), method: extractHandlerMethods('').assign?.method ?? null, subPath: '', hasBody: false, required: ef.required, optional: ef.optional };
    expect(diffContract(await fireAssign(DIFFICULTY), empty, DIFFICULTY)).toEqual(['backend 계약 추출 실패']);
  });
});
