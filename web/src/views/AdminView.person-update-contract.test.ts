import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { PersonPatch, UpdatePersonDeps } from './AdminView';
import { runUpdatePerson } from './AdminView';

// R-112 — 인원 수정(PATCH /api/persons/:id) web↔backend **계약 drift guard**. 추출기/대조기 상세 주석은 선례
// group-update(T-1176, `@Patch(":id")` param 1 + encodeURIComponent + partial) · person-create(T-1178, base +
// `@Body` hasBody) 참조(정규식만 — 새 dep 0). 신규 축: `api/persons`+`@Patch(":id")`(param 1) · 다중 optional
// {fullName,email,active}(required ∅ + `active` boolean) · PATCH body/헤더 ↔ `@Body` 정합.
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
      continue; // 그 외 decorator(@HttpCode/@UsePipes/@Param)는 handler 로 오인하지 않는다.
    }
    const handler = /^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (handler && pending) {
      // 시그니처 여러 줄(예: `@Body` 가 다음 줄) 대비 — 본문 `{` 전까지 모아 @Body 존재를 본다.
      let signature = line;
      let j = i;
      while (!/\{/.test(signature) && j < lines.length - 1) {
        j += 1;
        signature += `\n${lines[j]}`;
      }
      found[handler[1]] = { method: pending.method, subPath: pending.subPath, hasBody: /@Body\b/.test(signature) };
      pending = null;
      i = j;
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
  body: Record<string, unknown>;
}
const normalizeRoute = (route: string): string => (route.startsWith('/') ? route : `/${route}`);
function composeRoute(route: string, subPath: string): string {
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${normalizeRoute(route)}/${trimmed}` : normalizeRoute(route);
}
const pathParams = (route: string): string[] => route.split('/').filter((seg) => seg.startsWith(':'));
function expectedPath(route: string, subPath: string, id: string): string { // `:id`→실 id(web 과 동일 encodeURIComponent)
  return composeRoute(route, subPath).replace(':id', encodeURIComponent(id));
}
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
  const extras = [...fire.bodyKeys].filter((key) => !declared.has(key)).sort(); // fired ⊄ declared → 400
  if (extras.length > 0) {
    issues.push(`body 초과 키: ${extras.join(',')}`);
  }
  const missing = [...backend.required].filter((key) => !fire.bodyKeys.has(key)).sort(); // required ⊄ fired → 400
  if (missing.length > 0) {
    issues.push(`body 필수 누락: ${missing.join(',')}`);
  }
  if (fire.hasBody !== backend.hasBody) { // web body/Content-Type ↔ backend @Body 존재 정합(T-1177 대비)
    issues.push(`body 존재 정합 위반: web=${fire.hasBody} backend=${backend.hasBody}`);
  }
  if (fire.hasBody && fire.contentType !== 'application/json') {
    issues.push(`Content-Type 부재/불일치: ${String(fire.contentType)}`);
  }
  return issues;
}
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/person.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/user/dto/update-person.dto.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'UpdatePersonDto');
const UPDATE_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).update ?? null;
const UPDATE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: UPDATE_HANDLER?.method ?? null,
  subPath: UPDATE_HANDLER?.subPath ?? '',
  hasBody: UPDATE_HANDLER?.hasBody ?? false,
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const PERSON_ID = 'p-1';
const HAPPY_PATCH: PersonPatch = { fullName: '홍길동', email: 'hong@example.com', active: false };
// options.body 부재/null 은 SyntaxError 대신 빈 키 집합 + hasBody=false 매핑(러너 발사 인자 캡처, ADR-0040 §5).
function toFire(path: string, options: RequestOptions): WebFire {
  const bodyKeys = new Set<string>();
  let body: Record<string, unknown> = {};
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody) {
    body = JSON.parse(String(options.body)) as Record<string, unknown>;
    for (const key of Object.keys(body)) {
      bodyKeys.add(key);
    }
  }
  const headers = (options.headers ?? {}) as Record<string, string>;
  return { path, method: String(options.method), bodyKeys, hasBody, contentType: headers['Content-Type'], body };
}
async function fireUpdatePerson(id: string, patch: PersonPatch = HAPPY_PATCH): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: UpdatePersonDeps = {
    update: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    updating: false,
    setUpdating: () => {},
    setUpdateError: () => {},
    bumpRefresh: () => {},
    closeEdit: () => {},
  };
  await runUpdatePerson(id, patch, deps);
  if (!fired) {
    throw new Error('인원 수정 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 인원 수정 web↔backend 계약 drift guard (T-1179)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(UPDATE_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size + DTO_FIELDS.optional.size).toBeGreaterThan(0); // required ∅ 라 declared 총합으로 방어
  });
  it('backend @Controller("api/persons") base route 를 /api/persons 로 정규화한다 (분기 — 인원 base 파싱)', () => {
    expect(ROUTE).toBe('api/persons');
    expect(normalizeRoute(String(ROUTE))).toBe('/api/persons');
  });
  it('backend @Patch(":id") 세그먼트를 api/persons base 와 합성해 path param 1개(:id) template 을 만든다 (분기 — :id 첫 결합)', () => {
    expect(UPDATE_CONTRACT.method).toBe('PATCH');
    expect(UPDATE_CONTRACT.subPath).toBe(':id');
    const composed = composeRoute(String(ROUTE), UPDATE_CONTRACT.subPath);
    expect(composed).toBe('/api/persons/:id');
    expect(pathParams(composed)).toEqual([':id']); // path param 정확히 1개
    expect(expectedPath(String(ROUTE), UPDATE_CONTRACT.subPath, PERSON_ID)).toBe('/api/persons/p-1');
  });
  it('인원 수정 발사(PATCH /api/persons/:id)가 backend update 계약과 완전 일치한다 (happy-path)', async () => {
    expect(diffContract(await fireUpdatePerson(PERSON_ID), UPDATE_CONTRACT, PERSON_ID)).toEqual([]);
  });
  it('web 러너가 id 를 encodeURIComponent 로 안전 인코딩해 path 세그먼트에 넣는다 (분기 — path 인코딩, 비정상 문자)', async () => {
    const weirdId = 'p 1/x?a';
    const fired = await fireUpdatePerson(weirdId);
    expect(fired.path).toBe(`/api/persons/${encodeURIComponent(weirdId)}`);
    expect(fired.path).toBe('/api/persons/p%201%2Fx%3Fa'); // 공백·/·? 가 모두 인코딩돼 path 가 안 깨진다
    expect(diffContract(fired, UPDATE_CONTRACT, weirdId)).toEqual([]);
  });
  it('발사 body 키가 declared 부분집합을 만족한다(초과 0 · required ∅ 누락 0, fullName·email·active) (happy-path — allowed 부분집합)', async () => {
    const fired = await fireUpdatePerson(PERSON_ID);
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...fired.bodyKeys].every((key) => declared.has(key))).toBe(true);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true); // required ∅ → vacuous true
    expect([...fired.bodyKeys].sort()).toEqual(['active', 'email', 'fullName']);
    expect(fired.body.active).toBe(false); // active boolean(false 도 유효 값) 매핑 분기
  });
  it('PATCH 발사에 JSON body 와 Content-Type: application/json 헤더가 존재하고 backend @Body 와 정합한다 (분기 — body/헤더 존재 대조)', async () => {
    const fired = await fireUpdatePerson(PERSON_ID);
    expect(fired.method).toBe('PATCH');
    expect(fired.hasBody).toBe(true);
    expect(fired.contentType).toBe('application/json');
    expect(fired.hasBody).toBe(UPDATE_CONTRACT.hasBody);
  });
  it('extractDtoFields 가 fullName·email·active 를 optional(required ∅)로 분류한다 (분기 — 다중 optional 추출)', () => {
    expect([...DTO_FIELDS.optional].sort()).toEqual(['active', 'email', 'fullName']);
    expect(DTO_FIELDS.required.size).toBe(0);
    const promoted = extractDtoFields(['export class PromotedDto {', '  fullName!: string;', '}'].join('\n'), 'PromotedDto');
    expect([...promoted.required].sort()).toEqual(['fullName']); // `x!` 승격 표기는 required
    expect(promoted.optional.size).toBe(0);
  });
  it('backend update 핸들러가 @Body decorator 있는 body-요구 핸들러임을 추출한다 (분기 — @Body 존재 추출)', () => {
    expect(UPDATE_CONTRACT.hasBody).toBe(true);
    const bodyless = extractHandlerMethods(['  @Patch(":id")', '  async update(@Param("id") id: string) {}'].join('\n')).update;
    expect(bodyless).toEqual({ method: 'PATCH', subPath: ':id', hasBody: false });
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합 + hasBody=false 로 매핑된다 (분기 — body 부재)', () => {
    const fire = toFire('/api/persons/p-1', { method: 'PATCH' } as RequestOptions);
    expect(fire.bodyKeys.size).toBe(0);
    expect(fire.hasBody).toBe(false);
  });
  it.each<[string, () => BackendContract]>([ // Negative (a) base 오타 · (b) param 제거 · (c) 세그먼트 추가 → path 불일치
    ['(a) backend base 를 api/person(오타)로', () => ({ ...UPDATE_CONTRACT, route: 'api/person' })],
    ["(a') backend base 를 api/people 로", () => ({ ...UPDATE_CONTRACT, route: 'api/people' })],
    ['(b) @Patch(":id") 를 bare @Patch()(param 제거)로', () => ({ ...UPDATE_CONTRACT, subPath: extractHandlerMethods(['  @Patch()', '  async update() {}'].join('\n')).update.subPath })],
    ['(c) @Patch(":id") 를 @Patch("archive/:id")(세그먼트 추가)로', () => ({ ...UPDATE_CONTRACT, subPath: extractHandlerMethods(['  @Patch("archive/:id")', '  async update() {}'].join('\n')).update.subPath })],
  ])('%s 면 path 불일치로 잡힌다 (negative — path drift, 404 예방)', async (_label, build) => {
    expect(diffContract(await fireUpdatePerson(PERSON_ID), build(), PERSON_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Put/@Post 로 바꿨는데 web 은 PATCH 발사 → method 불일치로 잡힌다 (negative (f) — method drift)', async () => {
    const fired = await fireUpdatePerson(PERSON_ID);
    for (const src of ['  @Put(":id")', '  @Post(":id")']) {
      const handler = extractHandlerMethods([src, '  async update(@Body() d: any) {}'].join('\n')).update;
      const drifted: BackendContract = { ...UPDATE_CONTRACT, method: handler.method };
      expect(diffContract(fired, drifted, PERSON_ID)).toEqual([expect.stringContaining('method 불일치')]);
    }
  });
  it.each<[string, BackendContract, (base: WebFire) => Set<string>]>([ // Negative (d) rename 후 옛 key · (e) 미허용 key → 부분집합 위반
    ['(d) backend 가 fullName→name rename 했는데 web 은 fullName 발사', { ...UPDATE_CONTRACT, optional: new Set(['name', 'email', 'active']) }, (base) => base.bodyKeys],
    ['(e) web 이 backend 미허용 key role 을 담음', UPDATE_CONTRACT, (base) => new Set([...base.bodyKeys, 'role'])],
  ])('web body 가 %s 면 allowed 부분집합 위반으로 잡힌다 (negative — 400 예방)', async (_label, backend, mutate) => {
    const fired = await fireUpdatePerson(PERSON_ID);
    expect(diffContract({ ...fired, bodyKeys: mutate(fired) }, backend, PERSON_ID)).toEqual([expect.stringContaining('body 초과 키')]);
  });
  it('backend 가 @Body decorator 를 제거(body-less)했는데 web 은 body 발사 → body 존재 정합 위반으로 잡힌다 (negative (g) — @Body 제거 drift)', async () => {
    const drifted: BackendContract = { ...UPDATE_CONTRACT, hasBody: false };
    expect(diffContract(await fireUpdatePerson(PERSON_ID), drifted, PERSON_ID)).toEqual([expect.stringContaining('body 존재 정합 위반')]);
  });
  it('web 이 Content-Type 헤더를 빼고 body 만 발사하면 Content-Type 존재 대조가 fail 한다 (negative (h) — 헤더 누락 → 400/415)', () => {
    const fire = toFire('/api/persons/p-1', { method: 'PATCH', body: JSON.stringify({ fullName: '홍길동' }) } as RequestOptions);
    expect(diffContract(fire, UPDATE_CONTRACT, PERSON_ID)).toEqual([expect.stringContaining('Content-Type 부재/불일치')]);
  });
  it('주석 줄의 "@Patch(":id")"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (i) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/persons") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Patch(":id") — 주석뿐, decorator 없음', '  async update() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).update).toBeUndefined();
    const drifted: BackendContract = {
      ...UPDATE_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).update?.method ?? null,
    };
    expect(diffContract(await fireUpdatePerson(PERSON_ID), drifted, PERSON_ID)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const emptyFields = extractDtoFields('', 'UpdatePersonDto');
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').update?.method ?? null,
      subPath: '',
      hasBody: false,
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireUpdatePerson(PERSON_ID), empty, PERSON_ID)).toEqual(['backend 계약 추출 실패']);
  });
});
