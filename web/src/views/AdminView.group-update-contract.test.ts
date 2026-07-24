import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { UpdateGroupDeps } from './AdminView';
import { runUpdateGroup } from './AdminView';

// R-112 — 그룹 수정(PATCH /api/groups/:id) web↔backend **계약 drift guard**. 추출기/대조기 패턴은 선례
// role-change(T-1171, `:id`+PATCH+encodeURIComponent) · group-create(T-1175, `api/groups` base+body/헤더)
// 차용(상세 주석 그 파일들; 정규식만 — 새 devDependency 0, 공용 helper 추출은 Out of Scope refactor slice).
// 신규 축: (1) `@Controller("api/groups")` + `@Patch(":id")` → path param 1(T-1175 bare 0 과 대조; id
// encodeURIComponent). (2) `UpdateGroupDto` name **단일 optional — required ∅**. (3) PATCH + body/헤더 존재.

// 주석 제거 — 추출이 주석 문구를 잡으면 guard 가 무력해진다(아래 negative (h)).
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
// method decorator — HTTP method + 인자 sub-path(`@Patch(":id")`→':id'; 없으면 ''). 인자 부재=bare
// route(세그먼트 0), `:id`=path param 1 세그먼트 정규화 근거. 사이 decorator 는 pending 유지 continue.
interface HandlerDecorator {
  method: string;
  subPath: string;
}
// handler 이름 → {method, subPath}(`update`→{PATCH, ':id'}). decorator 없는 handler 미수록.
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
// DTO 필드 — required(`name!`/표기 없음)/optional(`x?`). 클래스 없으면 둘 다 빈 집합. UpdateGroupDto
// 는 `name?` 단일 → required ∅ · optional {name}(partial update 대조 근거).
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
  body: Record<string, unknown>;
}
const normalizeRoute = (route: string): string => (route.startsWith('/') ? route : `/${route}`);
// base route 에 sub-path 합성(빈 subPath 는 base 그대로 — bare route 정규화 핵심).
function composeRoute(route: string, subPath: string): string {
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${normalizeRoute(route)}/${trimmed}` : normalizeRoute(route);
}
// route template 의 `:param` 세그먼트 목록(`:id` 정확히 1개 검증용).
const pathParams = (route: string): string[] => route.split('/').filter((seg) => seg.startsWith(':'));
// `:id` 를 실 id 로 치환한 기대 path(id 는 web 과 동일하게 encodeURIComponent).
function expectedPath(route: string, subPath: string, id: string): string {
  return composeRoute(route, subPath).replace(':id', encodeURIComponent(id));
}
// 불일치 사유 목록 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과가 아니라 사유 1건. required ∅ 여도
// declared 총합(optional 포함)이 0 이면 추출 실패로 본다(partial DTO 는 optional 만 있음).
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
  // PATCH 는 JSON body + Content-Type 을 반드시 발사한다(T-1174 의 DELETE body 부재 축과 대비).
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
const DTO_SOURCE = readFileSync(new URL('../../../src/user/dto/update-group.dto.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'UpdateGroupDto');
const UPDATE_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).update ?? null;
const UPDATE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: UPDATE_HANDLER?.method ?? null,
  subPath: UPDATE_HANDLER?.subPath ?? '',
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const GROUP_ID = 'g-1';
// options.body 부재/null 은 SyntaxError 대신 빈 키 집합 + hasBody=false 로 매핑한다.
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
// 러너를 mock deps 로 직접 호출해 **실제 발사 인자** 를 캡처한다(ADR-0040 §5 — RTL/jsdom 없음).
// 러너는 name 이 originalName 과 다를 때만 발사하므로 서로 다른 기본값을 준다.
async function fireUpdateGroup(id: string, name = '평가 B조', originalName = '평가 A조'): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: UpdateGroupDeps = {
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
  await runUpdateGroup(id, name, originalName, deps);
  if (!fired) {
    throw new Error('그룹 수정 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 그룹 수정 web↔backend 계약 drift guard (T-1176)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(UPDATE_CONTRACT.method).not.toBeNull();
    // partial DTO 는 required ∅ 이므로 declared 총합(optional 포함)으로 무력화를 방어한다.
    expect(DTO_FIELDS.required.size + DTO_FIELDS.optional.size).toBeGreaterThan(0);
  });
  it('backend @Controller("api/groups") base route 를 /api/groups 로 정규화한다 (분기 — 그룹 base 파싱)', () => {
    expect(ROUTE).toBe('api/groups');
    expect(normalizeRoute(String(ROUTE))).toBe('/api/groups');
  });
  it('backend @Patch(":id") 세그먼트를 base 와 합성해 path param 1개(:id) template 을 만든다 (분기 — :id 합성)', () => {
    expect(UPDATE_CONTRACT.method).toBe('PATCH');
    expect(UPDATE_CONTRACT.subPath).toBe(':id');
    const composed = composeRoute(String(ROUTE), UPDATE_CONTRACT.subPath);
    expect(composed).toBe('/api/groups/:id');
    expect(pathParams(composed)).toEqual([':id']); // path param 정확히 1개
    expect(expectedPath(String(ROUTE), UPDATE_CONTRACT.subPath, GROUP_ID)).toBe('/api/groups/g-1');
  });
  it('그룹 수정 발사(PATCH /api/groups/:id)가 backend update 계약과 완전 일치한다 (happy-path)', async () => {
    expect(diffContract(await fireUpdateGroup(GROUP_ID), UPDATE_CONTRACT, GROUP_ID)).toEqual([]);
  });
  it('web 러너가 id 를 encodeURIComponent 로 안전 인코딩해 path 세그먼트에 넣는다 (분기 — path 인코딩, 비정상 문자)', async () => {
    const weirdId = 'g 1/x?a';
    const fired = await fireUpdateGroup(weirdId);
    expect(fired.path).toBe(`/api/groups/${encodeURIComponent(weirdId)}`);
    expect(fired.path).toBe('/api/groups/g%201%2Fx%3Fa'); // 공백·/·? 가 모두 인코딩돼 path 가 안 깨진다
    expect(diffContract(fired, UPDATE_CONTRACT, weirdId)).toEqual([]);
  });
  it('발사 body 키가 declared 부분집합을 만족한다(초과 0 · required ∅ 누락 0, name 단일 optional) (happy-path — body 부분집합)', async () => {
    const fired = await fireUpdateGroup(GROUP_ID);
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...fired.bodyKeys].every((key) => declared.has(key))).toBe(true);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true); // required ∅ → vacuous true
    expect([...fired.bodyKeys].sort()).toEqual(['name']);
    expect(fired.body.name).toBe('평가 B조'); // web body JSON 파싱 → 값 매핑 분기
  });
  it('PATCH 발사에 JSON body 와 Content-Type: application/json 헤더가 존재한다 (분기 — body/헤더 존재 대조)', async () => {
    const fired = await fireUpdateGroup(GROUP_ID);
    expect(fired.method).toBe('PATCH');
    expect(fired.hasBody).toBe(true);
    expect(fired.contentType).toBe('application/json');
  });
  it('extractDtoFields 가 실 DTO 의 name 은 optional(required ∅), `name!` 승격 표기는 required 로 분류한다 (분기 — optional/required 표기 구분)', () => {
    expect([...DTO_FIELDS.optional].sort()).toEqual(['name']);
    expect(DTO_FIELDS.required.size).toBe(0);
    const promoted = extractDtoFields(['export class PromotedDto {', '  name!: string;', '}'].join('\n'), 'PromotedDto');
    expect([...promoted.required].sort()).toEqual(['name']);
    expect(promoted.optional.size).toBe(0);
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합 + hasBody=false 로 매핑된다 (분기 — body 부재)', () => {
    const fire = toFire('/api/groups/g-1', { method: 'PATCH' } as RequestOptions);
    expect(fire.bodyKeys.size).toBe(0);
    expect(fire.hasBody).toBe(false);
  });

  // ── Negative cases 충분 cover — (a) base 오타 · (b) @Patch(":id")→bare @Patch() 세그먼트 제거 · (g) id encode 누락: 모두 path 불일치(404 예방).
  it.each<[string, () => Promise<{ fire: WebFire; backend: BackendContract; id: string }>]>([
    ['(a) backend base 를 api/group(오타)로', async () => ({ fire: await fireUpdateGroup(GROUP_ID), backend: { ...UPDATE_CONTRACT, route: 'api/group' }, id: GROUP_ID })],
    ["(a') backend base 를 api/teams 로", async () => ({ fire: await fireUpdateGroup(GROUP_ID), backend: { ...UPDATE_CONTRACT, route: 'api/teams' }, id: GROUP_ID })],
    ['(b) @Patch(":id") 를 bare @Patch()(세그먼트 0)로', async () => ({ fire: await fireUpdateGroup(GROUP_ID), backend: { ...UPDATE_CONTRACT, subPath: extractHandlerMethods(['  @Patch()', '  async update() {}'].join('\n')).update.subPath }, id: GROUP_ID })],
    ['(g) web 이 id 를 encodeURIComponent 없이 raw 삽입', async () => { const f = await fireUpdateGroup('g 1/x'); return { fire: { ...f, path: '/api/groups/g 1/x' }, backend: UPDATE_CONTRACT, id: 'g 1/x' }; }],
  ])('%s 면 path 불일치로 잡힌다 (negative — path drift, 404 예방)', async (_label, build) => {
    const { fire, backend, id } = await build();
    expect(diffContract(fire, backend, id)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Put/@Post 로 바꿨는데 web 은 PATCH 발사 → method 불일치로 잡힌다 (negative (c) — method drift)', async () => {
    const fired = await fireUpdateGroup(GROUP_ID);
    for (const src of ['  @Put(":id")', '  @Post(":id")']) {
      const handler = extractHandlerMethods([src, '  async update() {}'].join('\n')).update;
      const drifted: BackendContract = { ...UPDATE_CONTRACT, method: handler.method };
      expect(diffContract(fired, drifted, GROUP_ID)).toEqual([expect.stringContaining('method 불일치')]);
    }
  });
  // (d) required 승격 후 미발사 → 누락, (e) 초과 키 → 초과. declared/required 부분집합 위반(400 예방).
  it.each<[string, BackendContract, (base: WebFire) => Set<string>, string]>([
    ['(d) backend DTO 가 name 을 required 로 승격했는데 web body 는 name 미발사', { ...UPDATE_CONTRACT, required: new Set(['name']), optional: new Set() }, () => new Set<string>(), 'body 필수 누락'],
    ['(e) web 이 정의 밖 필드 foo 를 붙임', UPDATE_CONTRACT, (base) => new Set([...base.bodyKeys, 'foo']), 'body 초과 키'],
  ])('web body 가 %s 면 부분집합 위반으로 잡힌다 (negative — 400 예방)', async (_label, backend, mutate, expected) => {
    const fired = await fireUpdateGroup(GROUP_ID);
    expect(diffContract({ ...fired, bodyKeys: mutate(fired) }, backend, GROUP_ID)).toEqual([expect.stringContaining(expected)]);
  });
  it('web 이 Content-Type/body 를 누락하면 body 존재 대조가 fail 한다 (negative (f) — 헤더/body 누락 → 400/415)', () => {
    const fire = toFire('/api/groups/g-1', { method: 'PATCH' } as RequestOptions);
    const issues = diffContract(fire, UPDATE_CONTRACT, GROUP_ID);
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining('body 부재')]));
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining('Content-Type 부재/불일치')]));
  });
  it('주석 줄의 "@Patch(":id")"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (h) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/groups") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Patch(":id") — 주석뿐, decorator 없음', '  async update() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).update).toBeUndefined();
    const drifted: BackendContract = {
      ...UPDATE_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).update?.method ?? null,
    };
    expect(diffContract(await fireUpdateGroup(GROUP_ID), drifted, GROUP_ID)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const emptyFields = extractDtoFields('', 'UpdateGroupDto');
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').update?.method ?? null,
      subPath: '',
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireUpdateGroup(GROUP_ID), empty, GROUP_ID)).toEqual(['backend 계약 추출 실패']);
  });
});
