import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { SetDefaultProviderDeps } from './adminLlmProviderMutationRunners';
import { runSetDefaultProvider } from './adminLlmProviderMutationRunners';
// 공용 invariant 추출기(T-1201) import — 공용과 **글자-동일한 7종만** 가져온다(T-1224 이관 판정과 동일 규약).
// 공용에 없는 richer 추출기(extractDtoFields·BackendContract/WebFire·diffContract·toFire·decoratorIndex)만 inline 유지.
import {
  composeRoute,
  extractControllerRoute,
  extractHandlerMethods,
  extractHandlerParams,
  normalizeRoute,
  pathSegments,
  stripComments,
} from './__contract-guard__/contract-extractors';

// R-112 — 전역 기본 LLM provider 재지정(PUT /api/llm/providers/default) web↔backend **계약 drift guard**
// (T-1902, 쓰기 축 B4). 형식은 선례 llm-provider-delete(T-1186)·llm-provider-create(T-1184) 를 1:1 mirror 한다
// (readFileSync 로 backend 소스를 읽는 정적 대조 — 새 devDependency 0, backend 런타임 import 0).
// 본 slice 로 LLM provider 5번째 mutation 에도 CRUD 4종과 같은 안전망이 붙는다. 특화 축 4개:
// (1) `api/llm/providers` 3-세그먼트 base + **정적** subPath `default` → path param 정확히 0개(create 의 bare
// `@Post()` 세그먼트 0 도, delete 의 `:id` param 1 도 아닌 조합). (2) `@Put` method(arc 최초). (3) `@Body`
// **존재** 축(단일 필수 키 llmProviderConfigId — forbidNonWhitelisted 라 초과 키 1개도 400). (4) **라우트 선언
// 순서** — 정적 `default` 가 `:id` 계열보다 앞이어야 `:id = "default"` 오매칭 회귀가 안 난다.

// DTO 클래스 본문에서 필드명을 추출한다(`llmProviderConfigId!: string` → required). `?` 접미는 optional.
// 공용 helper 에 없는 richer 추출기라 inline 유지(create 선례와 의미 동일).
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
      continue; // @IsString/@IsNotEmpty/@MaxLength 등 validator decorator 는 필드로 세지 않는다.
    }
    const field = /^[ \t]*(?:readonly\s+)?([A-Za-z_$][\w$]*)([!?]?)\s*[:=]/.exec(line);
    if (field) {
      (field[2] === '?' ? optional : required).add(field[1]);
    }
  }
  return { required, optional };
}
// 지정 handler 의 파라미터 시그니처에 `@Body` decorator 가 있는지 — 공용 extractHandlerParams(균형 괄호
// 슬라이스)로 서명만 잘라 판정한다(반환 타입 오염 없음). `setDefault`→true, `delete`→false.
function handlerHasBody(source: string, name: string): boolean {
  return /@Body\b/.test(extractHandlerParams(source, name) ?? '');
}
// stripComments 후 소스에서 decorator 선언 위치(문자 offset). 부재 시 -1. **주석 제거가 필수** — 실 controller
// 주석 블록이 `@Get(":id")`/`@Patch(":id")` 문구를 @Put("default") 보다 앞줄에 담고 있어, 안 지우면 순서 축이
// 거짓으로 뒤집힌다(주석 false-positive 방어).
function decoratorIndex(source: string, decorator: RegExp): number {
  const matched = decorator.exec(stripComments(source));
  return matched ? matched.index : -1;
}

interface BackendContract {
  route: string | null;
  method: string | null;
  subPath: string;
  hasBody: boolean; // @Body decorator 존재 여부 — 본 endpoint 는 true 여야 한다.
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
// 불일치 사유 목록 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과가 아니라 사유 1건(선단언 방어).
function diffContract(fire: WebFire, backend: BackendContract): string[] {
  if (!backend.route || !backend.method || backend.required.size + backend.optional.size === 0) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== composeRoute(backend.route, backend.subPath)) {
    issues.push(`path 불일치: ${fire.path}`); // base 오타·subPath 드리프트 → 404 예방.
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  const declared = new Set([...backend.required, ...backend.optional]);
  const extras = [...fire.bodyKeys].filter((key) => !declared.has(key)).sort(); // fired ⊄ declared → forbidNonWhitelisted 400.
  if (extras.length > 0) {
    issues.push(`body 초과 키: ${extras.join(',')}`);
  }
  const missing = [...backend.required].filter((key) => !fire.bodyKeys.has(key)).sort(); // required ⊄ fired → 400.
  if (missing.length > 0) {
    issues.push(`body 필수 누락: ${missing.join(',')}`);
  }
  if (fire.hasBody !== backend.hasBody) {
    issues.push(`body 존재 정합 위반: web=${fire.hasBody} backend=${backend.hasBody}`);
  }
  if (fire.hasBody && fire.contentType !== 'application/json') {
    issues.push(`Content-Type 부재/불일치: ${String(fire.contentType)}`); // 415 예방.
  }
  return issues;
}

// 실 backend 소스 로드 + web 발사 캡처 harness.
const CONTROLLER_SOURCE = readFileSync(
  new URL('../../../src/llm/llm-provider-config.controller.ts', import.meta.url),
  'utf8',
);
const DTO_SOURCE = readFileSync(
  new URL('../../../src/llm/dto/set-default-llm-provider.dto.ts', import.meta.url),
  'utf8',
);
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'SetDefaultLlmProviderDto');
const SET_DEFAULT_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).setDefault ?? null;
const SET_DEFAULT_CONTRACT: BackendContract = {
  route: ROUTE,
  method: SET_DEFAULT_HANDLER?.method ?? null,
  subPath: SET_DEFAULT_HANDLER?.subPath ?? '',
  hasBody: handlerHasBody(CONTROLLER_SOURCE, 'setDefault'),
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const PROVIDER_ID = 'lp-1';
// options.body 부재/null 은 SyntaxError 대신 빈 키 집합 + hasBody=false 로 매핑한다.
function toFire(path: string, options: RequestOptions): WebFire {
  const bodyKeys = new Set<string>();
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody) {
    for (const key of Object.keys(JSON.parse(String(options.body)) as Record<string, unknown>)) {
      bodyKeys.add(key);
    }
  }
  const headers = (options.headers ?? {}) as Record<string, string>;
  const contentTypeKey = Object.keys(headers).find((key) => key.toLowerCase() === 'content-type');
  return {
    path,
    method: String(options.method),
    bodyKeys,
    hasBody,
    contentType: contentTypeKey ? headers[contentTypeKey] : undefined,
  };
}
// 러너를 mock deps 로 직접 호출해 **실제 발사 인자** 를 캡처한다(ADR-0040 §5 — RTL/jsdom 없음).
// `./AdminView` 배럴이 아니라 러너 모듈을 직접 import 한다 — runSetDefaultProvider 는 배럴에 re-export 되지 않는다.
async function fireSetDefaultProvider(id: string): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: SetDefaultProviderDeps = {
    update: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    settingDefault: false,
    setSettingDefault: () => {},
    setDefaultError: () => {},
    bumpRefresh: () => {},
  };
  await runSetDefaultProvider(id, deps);
  if (!fired) {
    throw new Error('기본 provider 재지정 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 기본 LLM provider 재지정 web↔backend 계약 drift guard (T-1902)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(SET_DEFAULT_CONTRACT.method).not.toBeNull();
    expect(SET_DEFAULT_CONTRACT.method).not.toBe('');
    expect(SET_DEFAULT_CONTRACT.subPath).toBe('default');
    expect(SET_DEFAULT_CONTRACT.required.size).toBeGreaterThan(0);
  });
  it('backend @Controller("api/llm/providers") 3-세그먼트 base 를 /api/llm/providers 로 정규화한다 (분기 1 — base 파싱)', () => {
    expect(ROUTE).toBe('api/llm/providers');
    expect(pathSegments(String(ROUTE))).toEqual(['api', 'llm', 'providers']); // 3-세그먼트 base
    expect(normalizeRoute(String(ROUTE))).toBe('/api/llm/providers');
  });
  it('backend @Put("default") 정적 세그먼트를 base 와 합성하면 path param 이 정확히 0개다 (분기 2 — 정적 subPath 합성)', () => {
    expect(SET_DEFAULT_CONTRACT.method).toBe('PUT');
    const composed = composeRoute(String(ROUTE), SET_DEFAULT_CONTRACT.subPath);
    expect(composed).toBe('/api/llm/providers/default');
    // path param 0 — 치환·encodeURIComponent 대상이 없다(대상 id 는 body 로 간다).
    expect(composed.split('/').filter((seg) => seg.startsWith(':'))).toEqual([]);
  });
  it('backend setDefault 핸들러가 @Body decorator 를 가진다 — 같은 소스의 delete 는 부재 (분기 3 — @Body 존재 판정)', () => {
    expect(SET_DEFAULT_CONTRACT.hasBody).toBe(true);
    expect(handlerHasBody(CONTROLLER_SOURCE, 'delete')).toBe(false); // 대조군 — 추출기가 실제로 구분함을 입증.
    expect([...SET_DEFAULT_CONTRACT.required]).toEqual(['llmProviderConfigId']); // 필수 키 정확히 1개.
    expect(SET_DEFAULT_CONTRACT.optional.size).toBe(0);
  });
  it('@Put("default") 가 @Get(":id")·@Patch(":id")·@Delete(":id") 보다 앞에 선언돼 있다 (분기 4 — 라우트 순서, :id="default" 오매칭 회귀 방지)', () => {
    const putDefault = decoratorIndex(CONTROLLER_SOURCE, /@Put\(\s*"default"\s*\)/);
    expect(putDefault).toBeGreaterThan(-1);
    for (const later of [/@Get\(\s*":id"\s*\)/, /@Patch\(\s*":id"\s*\)/, /@Delete\(\s*":id"\s*\)/]) {
      const idx = decoratorIndex(CONTROLLER_SOURCE, later);
      expect(idx).toBeGreaterThan(-1); // 대조 대상이 실재해야 순서 단언이 의미를 갖는다.
      expect(putDefault).toBeLessThan(idx);
    }
  });
  it('기본 재지정 발사(PUT /api/llm/providers/default)가 backend setDefault 계약과 완전 일치한다 (happy-path)', async () => {
    const fired = await fireSetDefaultProvider(PROVIDER_ID);
    expect(diffContract(fired, SET_DEFAULT_CONTRACT)).toEqual([]); // drift 0
    expect(fired.path).toBe('/api/llm/providers/default');
    expect(fired.method).toBe('PUT');
    expect([...fired.bodyKeys]).toEqual(['llmProviderConfigId']); // 단일 키 — 초과 키는 400.
    expect(fired.contentType).toBe('application/json');
  });
  it('러너가 id 를 path 가 아니라 body 값으로 싣는다 (happy-path — 정적 path 고정, 비정상 문자도 path 불변)', async () => {
    const weirdId = 'lp 1/x?a';
    const fired = await fireSetDefaultProvider(weirdId);
    expect(fired.path).toBe('/api/llm/providers/default'); // id 가 어떤 문자든 path 는 정적이다.
    expect(diffContract(fired, SET_DEFAULT_CONTRACT)).toEqual([]);
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합 + Content-Type undefined 로 매핑된다 (분기 — options 매핑)', () => {
    const fired = toFire('/api/llm/providers/default', { method: 'PUT' } as RequestOptions);
    expect(fired.bodyKeys.size).toBe(0);
    expect(fired.hasBody).toBe(false);
    expect(fired.contentType).toBeUndefined();
  });

  // ── Negative (a)(b)(c) — base 오타 · 정적 세그먼트 드리프트 · bare @Put(): 모두 path 불일치(404 예방).
  it.each<[string, () => BackendContract]>([
    ['(a) backend base 를 api/llm/provider(오타)로', () => ({ ...SET_DEFAULT_CONTRACT, route: 'api/llm/provider' })],
    ['(b) @Put("default") 를 @Put(":id") 로 드리프트', () => ({ ...SET_DEFAULT_CONTRACT, subPath: extractHandlerMethods(['  @Put(":id")', '  async setDefault() {}'].join('\n')).setDefault.subPath })],
    ['(c) @Put("default") 를 bare @Put()(세그먼트 0)로', () => ({ ...SET_DEFAULT_CONTRACT, subPath: extractHandlerMethods(['  @Put()', '  async setDefault() {}'].join('\n')).setDefault.subPath })],
  ])('%s 면 path 불일치로 잡힌다 (negative — path drift, 404 예방)', async (_label, build) => {
    expect(diffContract(await fireSetDefaultProvider(PROVIDER_ID), build())).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Patch/@Post 로 바꿨는데 web 은 PUT 발사 → method 불일치로 잡힌다 (negative (d) — method drift)', async () => {
    const fired = await fireSetDefaultProvider(PROVIDER_ID);
    for (const src of ['  @Patch("default")', '  @Post("default")']) {
      const handler = extractHandlerMethods([src, '  async setDefault() {}'].join('\n')).setDefault;
      expect(diffContract(fired, { ...SET_DEFAULT_CONTRACT, method: handler.method })).toEqual([expect.stringContaining('method 불일치')]);
    }
  });
  it('backend 가 @Body 를 제거했는데 web 은 body 발사 → body 존재 정합 위반으로 잡힌다 (negative (e) — @Body 제거 drift)', async () => {
    const bodylessSrc = ['  async setDefault(', '    @Param("id") id: string,', '  ): Promise<void> {}'].join('\n');
    expect(handlerHasBody(bodylessSrc, 'setDefault')).toBe(false);
    const issues = diffContract(await fireSetDefaultProvider(PROVIDER_ID), { ...SET_DEFAULT_CONTRACT, hasBody: false });
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining('body 존재 정합 위반')]));
  });
  it('web 이 body 에 초과 키를 실으면 키 집합 불일치로 잡힌다 (negative (f) — forbidNonWhitelisted 400 예방)', async () => {
    const fired = await fireSetDefaultProvider(PROVIDER_ID);
    const withExtra: WebFire = { ...fired, bodyKeys: new Set([...fired.bodyKeys, 'isDefault']) };
    expect(diffContract(withExtra, SET_DEFAULT_CONTRACT)).toEqual([expect.stringContaining('body 초과 키: isDefault')]);
    // 반대 축 — 필수 키를 빠뜨리면 누락으로 잡힌다(@IsNotEmpty 400 예방).
    expect(diffContract({ ...fired, bodyKeys: new Set() }, SET_DEFAULT_CONTRACT)).toEqual([expect.stringContaining('body 필수 누락: llmProviderConfigId')]);
  });
  it('web 이 Content-Type 헤더를 빠뜨리면 헤더 부재 위반으로 잡힌다 (negative (g) — 415 예방)', async () => {
    const fired = await fireSetDefaultProvider(PROVIDER_ID);
    const noHeader: WebFire = { ...fired, contentType: undefined };
    expect(diffContract(noHeader, SET_DEFAULT_CONTRACT)).toEqual([expect.stringContaining('Content-Type 부재/불일치')]);
  });
  it('주석 줄의 @Put("default")/@Controller(...) 를 실 decorator 로 오인하지 않는다 (negative (h) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/llm/providers") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Put("default") — 주석뿐, decorator 없음', '  async setDefault() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).setDefault).toBeUndefined();
    expect(decoratorIndex(fakeHandler, /@Put\(\s*"default"\s*\)/)).toBe(-1);
    const drifted: BackendContract = {
      ...SET_DEFAULT_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).setDefault?.method ?? null,
    };
    expect(diffContract(await fireSetDefaultProvider(PROVIDER_ID), drifted)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null/{} 을 반환하고 대조가 "계약 추출 실패" 로 떨어진다 (error path — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(handlerHasBody('', 'setDefault')).toBe(false);
    expect(extractDtoFields('', 'SetDefaultLlmProviderDto')).toEqual({ required: new Set(), optional: new Set() });
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').setDefault?.method ?? null,
      subPath: extractHandlerMethods('').setDefault?.subPath ?? '',
      hasBody: handlerHasBody('', 'setDefault'),
      required: extractDtoFields('', 'SetDefaultLlmProviderDto').required,
      optional: extractDtoFields('', 'SetDefaultLlmProviderDto').optional,
    };
    expect(diffContract(await fireSetDefaultProvider(PROVIDER_ID), empty)).toEqual(['backend 계약 추출 실패']);
  });
});
