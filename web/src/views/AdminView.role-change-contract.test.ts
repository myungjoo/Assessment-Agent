import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { ChangeRoleDeps } from './AdminView';
import { runChangeRole } from './AdminView';

// R-112 — 역할 변경(PATCH /api/users/:id/role) web↔backend **계약 drift guard**. 선례
// AdminView.instance-access-contract.test.ts(T-1169+T-1170)의 "backend 소스에서 계약을 추출해 web
// 발사 인자와 대조" 패턴 차용(추출기/대조기 주석 상세는 그 파일; 로컬 재정의는 use site 2 곳 YAGNI,
// AST 대신 정규식만 — 새 devDependency 0). endpoint-특화 신규 축(enum 부분집합): ChangeRoleDto
// `@IsIn(VALID_ROLE_VALUES)` 상 web fired-role 이 backend enum 부분집합 아니면 런타임 400 → ⊆ 단언.

// 주석 제거 — 추출이 주석 문구를 잡으면 guard 가 무력해진다(아래 negative (g)).
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}
// `@Controller("api/users")` 인자 route. 없으면 null.
function extractControllerRoute(source: string): string | null {
  const matched = /^[ \t]*@Controller\(\s*['"`]([^'"`]+)['"`]\s*\)/m.exec(stripComments(source));
  return matched ? matched[1] : null;
}
// method decorator — HTTP method + 인자 sub-path(`@Patch(':id/role')`→`':id/role'`; 없으면 '').
interface HandlerDecorator {
  method: string;
  subPath: string;
}
// handler 이름 → {method, subPath}(`changeRole`→{PATCH, ':id/role'}). decorator 없는 handler 미수록.
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
      continue; // 그 외 decorator(@UseGuards/@Roles)는 handler 로 오인하지 않는다.
    }
    const handler = /^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (handler && pending) {
      found[handler[1]] = pending;
      pending = null;
    }
  }
  return found;
}
// DTO 필드 — required(`role!`/표기 없음)/optional(`x?`). 클래스 없으면 둘 다 빈 집합.
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
// backend role enum — `VALID_ROLE_VALUES = [...]` 배열 리터럴의 문자열 집합(enum 축 backend-side 입력).
function extractRoleEnum(source: string): Set<string> {
  const arr = /VALID_ROLE_VALUES\s*=\s*\[([\s\S]*?)\]/.exec(stripComments(source));
  const values = new Set<string>();
  if (arr) {
    for (const matched of arr[1].matchAll(/['"`]([^'"`]+)['"`]/g)) {
      values.add(matched[1]);
    }
  }
  return values;
}
// web fired-role — UserList.resolveRoleAction 의 `nextRole: '...'` 리터럴 집합(enum 축 web-side 입력).
function extractWebFiredRoles(source: string): Set<string> {
  const values = new Set<string>();
  for (const matched of stripComments(source).matchAll(/nextRole:\s*['"`]([^'"`]+)['"`]/g)) {
    values.add(matched[1]);
  }
  return values;
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
  body: Record<string, unknown>;
}
const normalizeRoute = (route: string): string => (route.startsWith('/') ? route : `/${route}`);
// base route 에 sub-path 합성(빈 subPath 는 base 그대로).
function composeRoute(route: string, subPath: string): string {
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${normalizeRoute(route)}/${trimmed}` : normalizeRoute(route);
}
// backend route 의 `:id` 를 사용자 id 로 치환한 기대 path.
function expectedPath(route: string, subPath: string, userId: string): string {
  return composeRoute(route, subPath).replace(':id', encodeURIComponent(userId));
}
// 불일치 사유 목록 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과가 아니라 사유 1건이다.
function diffContract(fire: WebFire, backend: BackendContract, userId: string): string[] {
  if (!backend.route || !backend.method || backend.required.size + backend.optional.size === 0) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== expectedPath(backend.route, backend.subPath, userId)) {
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
  return issues;
}
// role enum 부분집합 대조(endpoint-특화 축) — webRoles ⊆ backendEnum. 추출 실패는 통과가 아니다.
function diffRoleEnum(webRoles: Set<string>, backendEnum: Set<string>): string[] {
  if (backendEnum.size === 0) {
    return ['backend role enum 추출 실패'];
  }
  if (webRoles.size === 0) {
    return ['web role 후보 추출 실패'];
  }
  const outside = [...webRoles].filter((role) => !backendEnum.has(role)).sort();
  return outside.length > 0 ? [`enum 밖 role: ${outside.join(',')}`] : [];
}

// 실 소스 로드 + web 발사 캡처 harness.
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/user.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/user/dto/change-role.dto.ts', import.meta.url), 'utf8');
const USERLIST_SOURCE = readFileSync(new URL('../components/UserList.tsx', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'ChangeRoleDto');
const BACKEND_ENUM = extractRoleEnum(DTO_SOURCE);
const WEB_FIRED_ROLES = extractWebFiredRoles(USERLIST_SOURCE);
const CHANGE_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).changeRole ?? null;
const CHANGE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: CHANGE_HANDLER?.method ?? null,
  subPath: CHANGE_HANDLER?.subPath ?? '',
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const USER_ID = 'u-1';
// options.body 부재/undefined 는 SyntaxError 대신 빈 키 집합으로 매핑한다(선례 Follow-up (3)).
function toFire(path: string, options: RequestOptions): WebFire {
  const bodyKeys = new Set<string>();
  let body: Record<string, unknown> = {};
  if (options.body !== undefined && options.body !== null) {
    body = JSON.parse(String(options.body)) as Record<string, unknown>;
    for (const key of Object.keys(body)) {
      bodyKeys.add(key);
    }
  }
  return { path, method: String(options.method), bodyKeys, body };
}
// 러너를 mock deps 로 직접 호출해 **실제 발사 인자** 를 캡처한다(ADR-0040 §5 — RTL/jsdom 없음).
async function fireChangeRole(userId: string, role: string): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: ChangeRoleDeps = {
    patch: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    isForbidden: () => false,
    changingId: undefined,
    setChangingId: () => {},
    setChangeError: () => {},
    bumpRefresh: () => {},
  };
  await runChangeRole(userId, role, deps);
  if (!fired) {
    throw new Error('역할 변경 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 역할 변경 web↔backend 계약 drift guard (T-1171)', () => {
  it('backend route/method/DTO/role enum/web role 후보 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(CHANGE_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size).toBeGreaterThan(0);
    expect(BACKEND_ENUM.size).toBeGreaterThan(0);
    expect(WEB_FIRED_ROLES.size).toBeGreaterThan(0);
  });
  it('backend @Patch(":id/role") 인자를 base route 와 합성해 최종 route/method 를 재구성한다 (분기 — 인자 합성)', () => {
    expect(CHANGE_CONTRACT.subPath).toBe(':id/role');
    expect(CHANGE_CONTRACT.method).toBe('PATCH');
    expect(composeRoute(String(ROUTE), CHANGE_CONTRACT.subPath)).toBe('/api/users/:id/role');
    expect(expectedPath(String(ROUTE), CHANGE_CONTRACT.subPath, USER_ID)).toBe('/api/users/u-1/role');
  });
  it('역할 변경 발사(PATCH)가 backend changeRole 계약과 완전 일치한다 (happy-path)', async () => {
    expect(diffContract(await fireChangeRole(USER_ID, 'Admin'), CHANGE_CONTRACT, USER_ID)).toEqual([]);
  });
  it('발사 body 키가 declared 부분집합 계약을 만족한다(초과 0 · 필수 누락 0) (happy-path — body)', async () => {
    const fired = await fireChangeRole(USER_ID, 'User');
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...fired.bodyKeys].every((key) => declared.has(key))).toBe(true);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true);
    expect([...fired.bodyKeys]).toEqual(['role']);
  });
  it('web fired-role 집합이 backend VALID_ROLE_VALUES 의 부분집합이다 (happy-path — enum 부분집합)', () => {
    expect(diffRoleEnum(WEB_FIRED_ROLES, BACKEND_ENUM)).toEqual([]);
  });
  it.each([...WEB_FIRED_ROLES])('실제 발사 role "%s" 이 backend enum 안에 든다 (분기 — enum 통과·실 발사 tie)', async (role) => {
    const fired = await fireChangeRole(USER_ID, role);
    expect(fired.body.role).toBe(role);
    expect(BACKEND_ENUM.has(String(fired.body.role))).toBe(true);
  });
  it('extractDtoFields 가 role!(required) 를 required 로 분류하고 optional 은 비어있다 (분기 — 표기 구분)', () => {
    expect([...DTO_FIELDS.required]).toEqual(['role']);
    expect(DTO_FIELDS.optional.size).toBe(0);
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합으로 매핑된다 (분기 — body 부재)', () => {
    expect(toFire('/api/users/u-1/role', { method: 'PATCH' } as RequestOptions).bodyKeys.size).toBe(0);
  });

  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it('backend 가 sub-path 를 ":id/change-role" 로 바꾸면 web 의 ".../role" 발사가 path 불일치로 잡힌다 (negative (a) — route drift, 404 예방)', async () => {
    const drifted: BackendContract = { ...CHANGE_CONTRACT, subPath: ':id/change-role' };
    expect(diffContract(await fireChangeRole(USER_ID, 'Admin'), drifted, USER_ID)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Put 으로 바꾸면 web 의 PATCH 발사가 method 불일치로 잡힌다 (negative (b) — method drift)', async () => {
    const handler = extractHandlerMethods(['  @Put(":id/role")', '  async changeRole() {}'].join('\n')).changeRole;
    expect(handler).toEqual({ method: 'PUT', subPath: ':id/role' });
    const drifted: BackendContract = { ...CHANGE_CONTRACT, method: handler.method };
    expect(diffContract(await fireChangeRole(USER_ID, 'Admin'), drifted, USER_ID)).toEqual([expect.stringContaining('method 불일치')]);
  });

  // (c) 초과 키, (d) 필수 누락 — web body 가 declared 부분집합을 벗어나면 잡힌다(400 예방).
  it.each<[string, (base: WebFire) => Set<string>, string]>([
    ['(c) 초과 키(newRole 오타 등)', (base) => new Set([...base.bodyKeys, 'newRole']), 'body 초과 키'],
    ['(d) required role 누락', () => new Set<string>(), 'body 필수 누락'],
  ])('web body 가 %s 면 부분집합 위반으로 잡힌다 (negative — 400 예방)', async (_label, mutate, expected) => {
    const fired = await fireChangeRole(USER_ID, 'Admin');
    expect(diffContract({ ...fired, bodyKeys: mutate(fired) }, CHANGE_CONTRACT, USER_ID)).toEqual([expect.stringContaining(expected)]);
  });

  // (e) backend enum rename, (e') web enum 밖 role — 어느 쪽이 drift 해도 부분집합 위반으로 잡힌다.
  it.each<[string, Set<string>, Set<string>]>([
    ['(e) backend enum 이 ["Owner","Member"] 로 rename', WEB_FIRED_ROLES, new Set(['Owner', 'Member'])],
    ['(e\') web 이 enum 밖 role(SuperUser 오타) 제시', new Set(['Admin', 'SuperUser']), BACKEND_ENUM],
  ])('%s 면 enum 부분집합 위반으로 잡힌다 (negative — enum drift, 400 예방)', (_label, webRoles, backendEnum) => {
    expect(diffRoleEnum(webRoles, backendEnum)).toEqual([expect.stringContaining('enum 밖 role')]);
  });
  it('body 부재 발사는 SyntaxError 없이 body 필수 누락으로 판정된다 (negative (f) — body 부재 진단)', () => {
    const fire = toFire('/api/users/u-1/role', { method: 'PATCH' } as RequestOptions);
    expect(diffContract(fire, CHANGE_CONTRACT, USER_ID)).toEqual([expect.stringContaining('body 필수 누락')]);
  });
  it('주석 줄의 "@Patch(":id/role")" 를 method 로 오인하지 않는다 (negative (g) — 주석 false-positive)', async () => {
    const fake = ['  // @Patch(":id/role") — 주석뿐, decorator 없음', '  async changeRole() {}'].join('\n');
    expect(extractHandlerMethods(fake).changeRole).toBeUndefined();
    const drifted: BackendContract = { ...CHANGE_CONTRACT, method: extractHandlerMethods(fake).changeRole?.method ?? null };
    expect(diffContract(await fireChangeRole(USER_ID, 'Admin'), drifted, USER_ID)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractRoleEnum('').size).toBe(0);
    expect(extractWebFiredRoles('').size).toBe(0);
    const emptyFields = extractDtoFields('', 'ChangeRoleDto');
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').changeRole?.method ?? null,
      subPath: '',
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireChangeRole(USER_ID, 'Admin'), empty, USER_ID)).toEqual(['backend 계약 추출 실패']);
    expect(diffRoleEnum(WEB_FIRED_ROLES, extractRoleEnum(''))).toEqual(['backend role enum 추출 실패']);
    expect(diffRoleEnum(extractWebFiredRoles(''), BACKEND_ENUM)).toEqual(['web role 후보 추출 실패']);
  });
});
