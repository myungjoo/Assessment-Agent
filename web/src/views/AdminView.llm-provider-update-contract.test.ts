import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { UpdateProviderDeps, UpdateProviderFields } from './AdminView';
import { runUpdateProvider } from './AdminView';

// R-112 — LLM provider 수정(PATCH /api/llm/providers/:id) web↔backend **계약 drift guard**. 추출기 상세는 선례
// part-update(T-1182) · llm-provider-create(T-1184) 참조(정규식만 → 새 dep 0). 신규 축: 3-세그먼트 base +
// `@Patch(":id")` path param 결합 · 4 all-optional allowed-subset(required ∅ PATCH partial) · body/헤더 ↔ @Body 정합.

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
// HTTP method + sub-path + 시그니처 `@Body` 존재. 멀티라인 시그니처는 handler 줄부터 괄호 균형 0 까지 이어붙여 @Body 탐지(T-1184 동형).
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
// `:id`→실 id(web 과 동일 encodeURIComponent).
const expectedPath = (route: string, subPath: string, id: string): string => composeRoute(route, subPath).replace(':id', encodeURIComponent(id));
// 불일치 사유 목록 — 빈 배열=계약 일치. 추출 실패도 통과가 아니라 사유 1건(선단언 방어). PATCH partial → required ∅(≠∅=drift).
function diffContract(fire: WebFire, backend: BackendContract, id: string): string[] {
  if (!backend.route || !backend.method || backend.required.size + backend.optional.size === 0) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== expectedPath(backend.route, backend.subPath, id)) {
    issues.push(`path 불일치: ${fire.path}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  const declared = new Set([...backend.required, ...backend.optional]);
  const extras = [...fire.bodyKeys].filter((key) => !declared.has(key)).sort(); // fired ⊄ declared(allow-set) → 400
  if (extras.length > 0) {
    issues.push(`body 초과 키: ${extras.join(',')}`);
  }
  if (backend.required.size > 0) { // PATCH partial → required 집합은 ∅ 이어야 한다(≠∅ = @IsOptional 제거 drift)
    issues.push(`partial 위반: required=${[...backend.required].sort().join(',')}`);
  }
  if (fire.hasBody !== backend.hasBody) { // web body/Content-Type ↔ backend @Body 존재 정합
    issues.push(`body 존재 정합 위반: web=${fire.hasBody} backend=${backend.hasBody}`);
  }
  if (fire.hasBody && fire.contentType !== 'application/json') {
    issues.push(`Content-Type 부재/불일치: ${String(fire.contentType)}`);
  }
  return issues;
}
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/llm/llm-provider-config.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/llm/dto/update-llm-provider-config.dto.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'UpdateLlmProviderConfigDto');
const UPDATE_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).update ?? null;
const UPDATE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: UPDATE_HANDLER?.method ?? null,
  subPath: UPDATE_HANDLER?.subPath ?? '',
  hasBody: UPDATE_HANDLER?.hasBody ?? false,
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const PROVIDER_ID = 'lp-1';
const ALLOW_SET = ['apiKey', 'endpointUrl', 'modelId', 'provider']; // 정렬된 4 all-optional allow-set
// 러너는 trim 후 비어있지 않은 필드만 담으므로 '' 필드는 미발사(MODEL_ONLY 는 modelId 만 발사).
const ALL_FIELDS: UpdateProviderFields = { provider: 'openai', endpointUrl: 'https://api.openai.com/v1', apiKey: 'sk-test-key', modelId: 'gpt-4o' };
const MODEL_ONLY: UpdateProviderFields = { provider: '', endpointUrl: '', apiKey: '', modelId: 'gpt-4o' };
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
async function fireUpdateProvider(id: string, fields: UpdateProviderFields = ALL_FIELDS): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: UpdateProviderDeps = {
    update: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    id,
    updating: false,
    setUpdating: () => {},
    setUpdateError: () => {},
    bumpRefresh: () => {},
    closeEdit: () => {},
  };
  await runUpdateProvider(fields, deps);
  if (!fired) {
    throw new Error('provider 수정 러너가 발사하지 않았다');
  }
  return fired;
}
describe('AdminView — LLM provider 수정 web↔backend 계약 drift guard (T-1185)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(UPDATE_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size + DTO_FIELDS.optional.size).toBeGreaterThan(0); // required ∅ 라 declared 총합으로 방어
  });
  it('backend @Controller("api/llm/providers") 3-세그먼트 base 를 /api/llm/providers 로 정규화한다 (분기 — 다중 세그먼트 base 파싱)', () => {
    expect(ROUTE).toBe('api/llm/providers');
    expect(String(ROUTE).split('/')).toHaveLength(3); // arc 최초의 3-세그먼트 base + path param 결합
    expect(normalizeRoute(String(ROUTE))).toBe('/api/llm/providers');
  });
  it('backend @Patch(":id") 세그먼트를 3-세그먼트 base 와 합성해 path param 1개(:id, 세그먼트 4) template 을 만든다 (분기 — 3-세그먼트 base + :id 결합)', () => {
    expect(UPDATE_CONTRACT.method).toBe('PATCH');
    expect(UPDATE_CONTRACT.subPath).toBe(':id');
    const composed = composeRoute(String(ROUTE), UPDATE_CONTRACT.subPath);
    expect(composed).toBe('/api/llm/providers/:id');
    expect(composed.split('/').filter(Boolean)).toHaveLength(4); // 세그먼트 4개(api·llm·providers·:id)
    expect(pathParams(composed)).toEqual([':id']); // path param 정확히 1개
    expect(expectedPath(String(ROUTE), UPDATE_CONTRACT.subPath, PROVIDER_ID)).toBe('/api/llm/providers/lp-1');
  });
  it('provider 수정 발사(PATCH /api/llm/providers/:id, 4 필드 전부)가 backend update 계약과 완전 일치한다 (happy-path)', async () => {
    expect(diffContract(await fireUpdateProvider(PROVIDER_ID), UPDATE_CONTRACT, PROVIDER_ID)).toEqual([]);
  });
  it('provider 수정 발사(modelId 단일 부분집합)도 allowed-subset 대조를 통과한다 (happy-path — 부분 갱신 subset)', async () => {
    const fired = await fireUpdateProvider(PROVIDER_ID, MODEL_ONLY);
    expect([...fired.bodyKeys].sort()).toEqual(['modelId']); // 담긴 필드만(빈 3 필드는 미발사)
    expect(diffContract(fired, UPDATE_CONTRACT, PROVIDER_ID)).toEqual([]);
  });
  it('web 러너가 id 를 encodeURIComponent 로 안전 인코딩해 path 세그먼트에 넣는다 (분기 — path 인코딩, 비정상 문자)', async () => {
    const weirdId = 'lp 1/x?a';
    const fired = await fireUpdateProvider(weirdId);
    expect(fired.path).toBe(`/api/llm/providers/${encodeURIComponent(weirdId)}`);
    expect(fired.path).toBe('/api/llm/providers/lp%201%2Fx%3Fa'); // 공백·/·? 가 모두 인코딩돼 path 가 안 깨진다
    expect(diffContract(fired, UPDATE_CONTRACT, weirdId)).toEqual([]);
  });
  it('발사 body 키가 declared allow-set 의 부분집합을 만족한다(초과 0 · required ∅ 누락 0, 4 필드) (happy-path — allowed 부분집합)', async () => {
    const fired = await fireUpdateProvider(PROVIDER_ID);
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...fired.bodyKeys].every((key) => declared.has(key))).toBe(true);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true); // required ∅ → vacuous true
    expect([...fired.bodyKeys].sort()).toEqual(ALLOW_SET);
  });
  it('PATCH 발사에 JSON body 와 Content-Type: application/json 헤더가 존재하고 backend @Body 와 정합한다 (분기 — body/헤더 존재 대조)', async () => {
    const fired = await fireUpdateProvider(PROVIDER_ID);
    expect(fired.method).toBe('PATCH');
    expect(fired.hasBody).toBe(true);
    expect(fired.contentType).toBe('application/json');
    expect(fired.hasBody).toBe(UPDATE_CONTRACT.hasBody);
  });
  it('extractDtoFields 가 4 필드를 전부 optional(required ∅)로 분류한다 (분기 — 4 all-optional 추출, partial)', () => {
    expect([...DTO_FIELDS.optional].sort()).toEqual(ALLOW_SET);
    expect(DTO_FIELDS.required.size).toBe(0); // PATCH partial — required 공집합(4 필드 전부 @IsOptional)
    const promoted = extractDtoFields(['export class PromotedDto {', '  provider!: string;', '  modelId?: string;', '}'].join('\n'), 'PromotedDto');
    expect([...promoted.required].sort()).toEqual(['provider']); // `x!` 승격 표기는 required
    expect([...promoted.optional].sort()).toEqual(['modelId']);
  });
  it('backend update 핸들러가 멀티라인 시그니처의 @Body decorator(별도 줄)를 추출한다 (분기 — @Body 존재 추출)', () => {
    expect(UPDATE_CONTRACT.hasBody).toBe(true); // 실 controller 는 @Body 가 async update( 다음다음 줄
    const multiline = extractHandlerMethods(['  @Patch(":id")', '  async update(', '    @Param("id") id: string,', '    @Body() dto: Dto,', '  ): Promise<View> {'].join('\n')).update;
    expect(multiline).toEqual({ method: 'PATCH', subPath: ':id', hasBody: true });
    const bodyless = extractHandlerMethods(['  @Patch(":id")', '  async update(@Param("id") id: string) {}'].join('\n')).update;
    expect(bodyless).toEqual({ method: 'PATCH', subPath: ':id', hasBody: false });
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합 + hasBody=false 로 매핑된다 (분기 — body 부재)', () => {
    const fire = toFire('/api/llm/providers/lp-1', { method: 'PATCH' } as RequestOptions);
    expect(fire.bodyKeys.size).toBe(0);
    expect(fire.hasBody).toBe(false);
  });
  it.each<[string, () => BackendContract]>([ // Negative (a) base 오타/축소 · (b) param 제거(세그먼트 0) → path 불일치
    ['(a) backend base 를 api/llm/provider(오타)로', () => ({ ...UPDATE_CONTRACT, route: 'api/llm/provider' })],
    ['(a) backend base 를 api/providers(세그먼트 축소)로', () => ({ ...UPDATE_CONTRACT, route: 'api/providers' })],
    ['(b) @Patch(":id") 를 bare @Patch()(param 제거, 세그먼트 0)로', () => ({ ...UPDATE_CONTRACT, subPath: extractHandlerMethods(['  @Patch()', '  async update(@Body() d: any) {}'].join('\n')).update.subPath })],
  ])('%s 면 path 불일치로 잡힌다 (negative (a)(b) — path drift, 404 예방)', async (_label, build) => {
    expect(diffContract(await fireUpdateProvider(PROVIDER_ID), build(), PROVIDER_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  // negative (c) method · (d) allow-set 축소 · (e) 밖 필드 · required 승격 partial · (g) @Body 제거 — it.each 압축.
  it.each<[string, (f: WebFire) => WebFire, (c: BackendContract) => BackendContract, string]>([
    ['(c) method 를 @Put 로 바꿈', (f) => f, (c) => ({ ...c, method: extractHandlerMethods(['  @Put(":id")', '  async update(@Body() d: any) {}'].join('\n')).update.method }), 'method 불일치'],
    ['(c) method 를 @Post 로 바꿈', (f) => f, (c) => ({ ...c, method: extractHandlerMethods(['  @Post(":id")', '  async update(@Body() d: any) {}'].join('\n')).update.method }), 'method 불일치'],
    ['(d) allow-set 에서 endpointUrl 제거', (f) => f, (c) => ({ ...c, optional: new Set(['provider', 'apiKey', 'modelId']) }), 'body 초과 키'],
    ['(e) web 이 allow-set 밖 region 발사', (f) => ({ ...f, bodyKeys: new Set([...f.bodyKeys, 'region']) }), (c) => c, 'body 초과 키'],
    ['필드 하나를 required 로 승격(@IsOptional 제거)', (f) => f, (c) => ({ ...c, required: new Set(['provider']), optional: new Set(['endpointUrl', 'apiKey', 'modelId']) }), 'partial 위반'],
    ['(g) @Body decorator 제거(body-less)', (f) => f, (c) => ({ ...c, hasBody: false }), 'body 존재 정합 위반'],
  ])('%s 면 대조가 fail 한다 (negative (c)(d)(e)(g)+partial — drift 잡힘)', async (_label, mutateFire, mutateContract, expected) => {
    const fired = await fireUpdateProvider(PROVIDER_ID);
    expect(diffContract(mutateFire(fired), mutateContract(UPDATE_CONTRACT), PROVIDER_ID)).toEqual([expect.stringContaining(expected)]);
  });
  it('web 이 Content-Type 헤더를 빼고 body 만 발사하면 Content-Type 존재 대조가 fail 한다 (negative (f) — 헤더 누락 → 400/415)', () => {
    const fire = toFire('/api/llm/providers/lp-1', { method: 'PATCH', body: JSON.stringify({ modelId: 'gpt-4o' }) } as RequestOptions);
    expect(diffContract(fire, UPDATE_CONTRACT, PROVIDER_ID)).toEqual([expect.stringContaining('Content-Type 부재/불일치')]);
  });
  it('주석 줄의 "@Patch(":id")"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (h) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/llm/providers") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Patch(":id") — 주석뿐, decorator 없음', '  async update() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).update).toBeUndefined();
    const drifted: BackendContract = {
      ...UPDATE_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).update?.method ?? null,
    };
    expect(diffContract(await fireUpdateProvider(PROVIDER_ID), drifted, PROVIDER_ID)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const emptyFields = extractDtoFields('', 'UpdateLlmProviderConfigDto');
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').update?.method ?? null,
      subPath: '',
      hasBody: false,
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireUpdateProvider(PROVIDER_ID), empty, PROVIDER_ID)).toEqual(['backend 계약 추출 실패']);
  });
});
