import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { CreatePartDeps } from './AdminView';
import { runCreatePart } from './AdminView';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본 삭제·동작 무변경(T-1218 이관 slice, mutation stream part-create).
// 이 spec 이 참조하는 export 중 **공용과 글자-동일한 4종만** import(stripQuery/extractHandlerParams/pathSegments 제외 — 부재/미사용). richer
// extractHandlerMethods(hasBody·주석 상이)·HandlerDecorator·extractDtoFields·BackendContract/WebFire·pathParams·diffContract·toFire 는 inline 유지.
import {
  composeRoute,
  extractControllerRoute,
  normalizeRoute,
  stripComments,
} from './__contract-guard__/contract-extractors';

// R-112 — 파트 생성(POST /api/parts) web↔backend **계약 drift guard**. 추출기/대조기 상세 주석은 선례
// person-create(T-1178, api base + bare @Post() 세그먼트 0 + POST body/헤더 존재) · group-create(T-1175,
// name 단일 required) 참조(AST 대신 정규식 → 새 dep 0). endpoint-특화 축 4개: (1) `@Controller("api/parts")`
// base + bare `@Post()` → `/api/parts`(세그먼트 0). (2) `CreatePartDto` name **단일 required** body 부분집합
// (required=allowed={name}). (3) POST body/Content-Type ↔ `@Body` 존재 정합. (4) POST method ↔ `@Post`.

// HTTP method + sub-path + 시그니처 `@Body` 존재. 인자 부재가 bare route(세그먼트 0) 정규화 근거. 상세는 선례 참조.
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

const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/part.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/user/dto/create-part.dto.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'CreatePartDto');
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
async function fireCreatePart(name: string): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: CreatePartDeps = {
    create: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    isConflict: () => false,
    creating: false,
    setCreating: () => {},
    setCreateError: () => {},
    bumpRefresh: () => {},
    resetInput: () => {},
  };
  await runCreatePart(name, deps);
  if (!fired) {
    throw new Error('파트 생성 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 파트 생성 web↔backend 계약 drift guard (T-1181)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(CREATE_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size).toBeGreaterThan(0);
  });
  it('backend @Controller("api/parts") base route 를 /api/parts 로 정규화한다 (분기 — 파트 base 파싱)', () => {
    expect(ROUTE).toBe('api/parts');
    expect(normalizeRoute(String(ROUTE))).toBe('/api/parts');
  });
  it('backend @Post() bare route(인자 부재)를 base 자체와 합성해 path param 정확히 0개 template 을 만든다 (분기 — bare 세그먼트 0 합성)', () => {
    expect(CREATE_CONTRACT.method).toBe('POST');
    expect(CREATE_CONTRACT.subPath).toBe('');
    const composed = composeRoute(String(ROUTE), CREATE_CONTRACT.subPath);
    expect(composed).toBe('/api/parts');
    expect(pathParams(composed)).toEqual([]); // path param 정확히 0개(컬렉션 루트 POST)
  });
  it('backend @Post(":id") 처럼 인자가 있으면 base 와 합성한다 (분기 — 인자 합성, bare 대비)', () => {
    const handler = extractHandlerMethods(['  @Post(":id")', '  async create() {}'].join('\n')).create;
    expect(handler).toEqual({ method: 'POST', subPath: ':id', hasBody: false });
    expect(composeRoute('api/parts', handler.subPath)).toBe('/api/parts/:id');
  });
  it('backend create 핸들러가 @Body decorator 있는 body-요구 핸들러임을 추출한다 (분기 — @Body 존재 추출)', () => {
    expect(CREATE_CONTRACT.hasBody).toBe(true);
    const bodyless = extractHandlerMethods(['  @Post()', '  async create(dto: CreatePartDto) {}'].join('\n')).create;
    expect(bodyless).toEqual({ method: 'POST', subPath: '', hasBody: false });
  });
  it('파트 생성 발사(POST /api/parts)가 backend create 계약과 완전 일치한다 (happy-path)', async () => {
    expect(diffContract(await fireCreatePart('개발팀'), CREATE_CONTRACT)).toEqual([]);
  });
  it('발사 body 키가 declared 부분집합을 만족한다(초과 0·필수 누락 0, name 단일) (happy-path — body 부분집합)', async () => {
    const fired = await fireCreatePart('개발팀');
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...fired.bodyKeys].every((key) => declared.has(key))).toBe(true);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true);
    expect([...fired.bodyKeys].sort()).toEqual(['name']);
  });
  it('POST 발사에 JSON body 와 Content-Type: application/json 헤더가 존재하고 backend @Body 와 정합한다 (분기 — body/헤더 존재 대조)', async () => {
    const fired = await fireCreatePart('개발팀');
    expect(fired.method).toBe('POST');
    expect(fired.hasBody).toBe(true);
    expect(fired.contentType).toBe('application/json');
    expect(fired.hasBody).toBe(CREATE_CONTRACT.hasBody);
  });
  it('extractDtoFields 가 name 을 단일 required 로 분류하고 optional 은 비어있다 (분기 — 단일 required 추출)', () => {
    expect([...DTO_FIELDS.required].sort()).toEqual(['name']);
    expect(DTO_FIELDS.optional.size).toBe(0);
  });
  it('extractDtoFields 가 `x?` 표기 필드를 optional 집합으로 수집한다 (분기 — optional 수집, 합성 DTO)', () => {
    const synthetic = ['export class SyntheticDto {', '  name!: string;', '  code?: string;', '}'].join('\n'); // 실 DTO optional 0 → 합성 구동
    const fields = extractDtoFields(synthetic, 'SyntheticDto');
    expect([...fields.required].sort()).toEqual(['name']);
    expect([...fields.optional].sort()).toEqual(['code']);
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합 + hasBody=false 로 매핑된다 (분기 — body 부재)', () => {
    const fire = toFire('/api/parts', { method: 'POST' } as RequestOptions);
    expect(fire.bodyKeys.size).toBe(0);
    expect(fire.hasBody).toBe(false);
  });

  it('backend 가 base 를 api/part(오타)/api/parties 로 바꾸면 web 의 /api/parts 발사가 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', async () => {
    const fired = await fireCreatePart('개발팀');
    for (const base of ['api/part', 'api/parties']) {
      const drifted: BackendContract = { ...CREATE_CONTRACT, route: base };
      expect(diffContract(fired, drifted)).toEqual([expect.stringContaining('path 불일치')]);
    }
  });
  it('backend 가 bare @Post() 를 @Post(":id")(세그먼트 추가, param 1)로 바꾸면 web 의 base 발사가 path 불일치로 잡힌다 (negative (b) — 세그먼트 초과 drift)', async () => {
    const handler = extractHandlerMethods(['  @Post(":id")', '  async create() {}'].join('\n')).create;
    const drifted: BackendContract = { ...CREATE_CONTRACT, subPath: handler.subPath };
    expect(pathParams(composeRoute(String(ROUTE), drifted.subPath))).toEqual([':id']); // 세그먼트 1개로 초과
    expect(diffContract(await fireCreatePart('개발팀'), drifted)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Patch/@Delete 로 바꿨는데 web 은 POST 발사 → method 불일치로 잡힌다 (negative (c) — method drift)', async () => {
    const fired = await fireCreatePart('개발팀');
    for (const src of ['  @Patch()', '  @Delete()']) {
      const handler = extractHandlerMethods([src, '  async create() {}'].join('\n')).create;
      const drifted: BackendContract = { ...CREATE_CONTRACT, method: handler.method };
      expect(diffContract(fired, drifted)).toEqual([expect.stringContaining('method 불일치')]);
    }
  });
  it.each<[string, BackendContract | ((base: WebFire) => Set<string>), string]>([ // (d) required 추가 미발사·(e) whitelist 밖 필드 → 400 예방
    ['(d) backend DTO 가 required code 추가했는데 web body 는 name 만', { ...CREATE_CONTRACT, required: new Set(['name', 'code']) }, 'body 필수 누락'],
    ['(e) web body 가 whitelist 밖 필드 foo 를 추가함', (base) => new Set([...base.bodyKeys, 'foo']), 'body 초과 키'],
  ])('web/backend 가 %s 면 부분집합/allowed 위반으로 잡힌다 (negative — 400 예방)', async (_label, mutate, expected) => {
    const fired = await fireCreatePart('개발팀');
    const [fire, backend] =
      typeof mutate === 'function'
        ? [{ ...fired, bodyKeys: mutate(fired) }, CREATE_CONTRACT]
        : [fired, mutate];
    expect(diffContract(fire, backend)).toEqual([expect.stringContaining(expected)]);
  });
  it('backend 가 @Body decorator 를 제거(body-less)했는데 web 은 body 발사 → body 존재 정합 위반으로 잡힌다 (negative (f) — @Body 제거 drift)', async () => {
    const drifted: BackendContract = { ...CREATE_CONTRACT, hasBody: false };
    expect(diffContract(await fireCreatePart('개발팀'), drifted)).toEqual([expect.stringContaining('body 존재 정합 위반')]);
  });
  it('web 이 Content-Type 헤더를 빼고 body 만 발사하면 Content-Type 존재 대조가 fail 한다 (negative (g) — 헤더 누락 → 400)', () => {
    const fire = toFire('/api/parts', { method: 'POST', body: JSON.stringify({ name: '개발팀' }) } as RequestOptions);
    expect(diffContract(fire, CREATE_CONTRACT)).toEqual([expect.stringContaining('Content-Type 부재/불일치')]);
  });
  it('주석 줄의 "@Post()"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (h) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/parts") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Post() — 주석뿐, decorator 없음', '  async create() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).create).toBeUndefined();
    const drifted: BackendContract = {
      ...CREATE_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).create?.method ?? null,
    };
    expect(diffContract(await fireCreatePart('개발팀'), drifted)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const emptyFields = extractDtoFields('', 'CreatePartDto');
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').create?.method ?? null,
      subPath: '',
      hasBody: false,
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireCreatePart('개발팀'), empty)).toEqual(['backend 계약 추출 실패']);
  });
});
