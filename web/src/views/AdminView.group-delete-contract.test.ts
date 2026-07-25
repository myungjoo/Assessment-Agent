import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { DeleteGroupDeps } from './AdminView';
import { runDeleteGroup } from './AdminView';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본 삭제·동작 무변경(T-1212 이관 slice, mutation stream group-delete).
// 이 spec 이 참조하는 export 중 **공용과 글자-동일한 4종만** import(stripQuery 제외 — DELETE fire 라 부재). richer
// extractHandlerMethods(주석 상이)·HandlerDecorator·handlerHasBody·BackendContract/WebFire·pathParams·diffContract 는 inline 유지.
import {
  composeRoute,
  extractControllerRoute,
  normalizeRoute,
  stripComments,
} from './__contract-guard__/contract-extractors';

// R-112 — 그룹 삭제(DELETE /api/groups/:id) web↔backend **계약 drift guard**. 추출기/대조기 패턴은
// 선례 group-member-remove(T-1174, DELETE+body 부재+`api/groups` base) · group-update(T-1176, `:id`
// 단일 세그먼트+encodeURIComponent) 차용(상세 주석은 그 파일들; 정규식만 — 새 devDependency 0, 공용
// helper 추출은 Out of Scope refactor slice). 신규 축: (1) `@Controller("api/groups")` + `@Delete(":id")`
// → path param **정확히 1개**(T-1174 의 2 param 과 대조). (2) DELETE + body/Content-Type 부재 AND
// backend `@Body` decorator **부재**(T-1176 PATCH body 존재 축과 대비). (3) `@Delete` method decorator 대조.

// method decorator — HTTP method + 인자 sub-path(`@Delete(":id")`→':id'; bare `@Delete()`→''). 인자
// 부재=세그먼트 0, `:id`=path param 1 세그먼트 정규화 근거. 사이 decorator(@HttpCode)는 pending 유지 continue.
interface HandlerDecorator {
  method: string;
  subPath: string;
}
// handler 이름 → {method, subPath}(`delete`→{DELETE, ':id'}). decorator 없는 handler 미수록.
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
// 지정 handler 의 파라미터 시그니처에 `@Body` decorator 가 있는지 판정한다(body-less 핸들러 대조 근거).
// handler 이름 선언부터 body `{` 직전까지의 시그니처 텍스트(멀티라인 파라미터 포함)를 잘라 `@Body` 존재만
// 본다 — 반환 타입(`Promise<void>`)에는 @Body 가 없으므로 안전. `delete`→false, `update`→true.
function handlerHasBody(source: string, name: string): boolean {
  const stripped = stripComments(source);
  const declared = new RegExp(`\\b${name}\\s*\\(`).exec(stripped);
  if (!declared) {
    return false;
  }
  const rest = stripped.slice(declared.index);
  const brace = rest.indexOf('{');
  const signature = brace === -1 ? rest : rest.slice(0, brace);
  return /@Body\b/.test(signature);
}

interface BackendContract {
  route: string | null;
  method: string | null;
  subPath: string;
  hasBody: boolean; // @Body decorator 존재 여부 — body-less endpoint 는 false.
}
interface WebFire {
  path: string;
  method: string;
  bodyKeys: Set<string>;
  hasContentType: boolean;
}
// route template 의 `:param` 세그먼트 목록(`:id` 정확히 1개 검증용).
const pathParams = (route: string): string[] => route.split('/').filter((seg) => seg.startsWith(':'));
// `:id` 를 실 id 로 치환한 기대 path(id 는 web 과 동일하게 encodeURIComponent).
function expectedPath(route: string, subPath: string, id: string): string {
  return composeRoute(route, subPath).replace(':id', encodeURIComponent(id));
}
// 불일치 사유 목록 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과가 아니라 사유 1건(선단언 방어).
// body 부재 endpoint 라 backend `@Body` 부재(hasBody=false)와 web 발사 body/Content-Type 부재를 대조한다.
function diffContract(fire: WebFire, backend: BackendContract, id: string): string[] {
  if (!backend.route || !backend.method) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== expectedPath(backend.route, backend.subPath, id)) {
    issues.push(`path 불일치: ${fire.path}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  // backend 가 @Body 를 요구하는데(hasBody=true) web 은 body 미발사 → 정합 위반(negative (e)).
  if (backend.hasBody && fire.bodyKeys.size === 0) {
    issues.push('backend @Body 요구 vs web body 부재');
  }
  // body-less endpoint(hasBody=false)인데 web 이 body 를 붙임 → 초과(negative (f)).
  const extras = [...fire.bodyKeys].sort();
  if (!backend.hasBody && extras.length > 0) {
    issues.push(`body 부재 위반(초과 키): ${extras.join(',')}`);
  }
  // body-less endpoint 인데 web 이 Content-Type 헤더를 붙임 → 초과(negative (f)).
  if (!backend.hasBody && fire.hasContentType) {
    issues.push('Content-Type 부재 위반');
  }
  return issues;
}

// 실 controller 소스 로드 + web 발사 캡처 harness.
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/group.controller.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DELETE_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).delete ?? null;
const DELETE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: DELETE_HANDLER?.method ?? null,
  subPath: DELETE_HANDLER?.subPath ?? '',
  hasBody: handlerHasBody(CONTROLLER_SOURCE, 'delete'),
};
const GROUP_ID = 'g-1';
// options.body 부재/null 은 SyntaxError 대신 빈 키 집합 + hasContentType=false 로 매핑한다.
function toFire(path: string, options: RequestOptions): WebFire {
  const bodyKeys = new Set<string>();
  if (options.body !== undefined && options.body !== null) {
    const body = JSON.parse(String(options.body)) as Record<string, unknown>;
    for (const key of Object.keys(body)) {
      bodyKeys.add(key);
    }
  }
  const headers = (options.headers ?? {}) as Record<string, string>;
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
  return { path, method: String(options.method), bodyKeys, hasContentType };
}
// 러너를 mock deps 로 직접 호출해 **실제 발사 인자** 를 캡처한다(ADR-0040 §5 — RTL/jsdom 없음).
async function fireDeleteGroup(id: string): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: DeleteGroupDeps = {
    remove: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    deleting: false,
    setDeleting: () => {},
    setDeleteError: () => {},
    bumpRefresh: () => {},
  };
  await runDeleteGroup(id, deps);
  if (!fired) {
    throw new Error('그룹 삭제 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 그룹 삭제 web↔backend 계약 drift guard (T-1177)', () => {
  it('backend route/method 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(DELETE_CONTRACT.method).not.toBeNull();
    expect(DELETE_CONTRACT.subPath).toBe(':id');
  });
  it('backend @Controller("api/groups") base route 를 /api/groups 로 정규화한다 (분기 — base 파싱)', () => {
    expect(ROUTE).toBe('api/groups');
    expect(normalizeRoute(String(ROUTE))).toBe('/api/groups');
  });
  it('backend @Delete(":id") 세그먼트를 base 와 합성해 path param 정확히 1개(:id) template 을 만든다 (분기 — :id 단일 합성)', () => {
    expect(DELETE_CONTRACT.method).toBe('DELETE');
    expect(DELETE_CONTRACT.subPath).toBe(':id');
    const composed = composeRoute(String(ROUTE), DELETE_CONTRACT.subPath);
    expect(composed).toBe('/api/groups/:id');
    expect(pathParams(composed)).toEqual([':id']); // path param 정확히 1개(T-1174 의 2 param 과 대조)
    expect(expectedPath(String(ROUTE), DELETE_CONTRACT.subPath, GROUP_ID)).toBe('/api/groups/g-1');
  });
  it('backend delete 핸들러가 @Body decorator 없는 body-less 핸들러다 (분기 — @Body 부재 판정)', () => {
    expect(DELETE_CONTRACT.hasBody).toBe(false);
    // 대조군 — 같은 소스의 update 핸들러는 @Body 를 가진다(추출기가 실제로 구분함을 입증).
    expect(handlerHasBody(CONTROLLER_SOURCE, 'update')).toBe(true);
  });
  it('그룹 삭제 발사(DELETE /api/groups/:id)가 backend delete 계약과 완전 일치한다 (happy-path)', async () => {
    const fired = await fireDeleteGroup(GROUP_ID);
    expect(diffContract(fired, DELETE_CONTRACT, GROUP_ID)).toEqual([]);
    expect(fired.path).toBe('/api/groups/g-1');
    expect(fired.method).toBe('DELETE');
  });
  it('web 러너가 id 를 encodeURIComponent 로 안전 인코딩해 path 세그먼트에 넣는다 (분기 — path 인코딩, 비정상 문자)', async () => {
    const weirdId = 'g 1/x?a';
    const fired = await fireDeleteGroup(weirdId);
    expect(fired.path).toBe(`/api/groups/${encodeURIComponent(weirdId)}`);
    expect(fired.path).toBe('/api/groups/g%201%2Fx%3Fa'); // 공백·/·? 가 모두 인코딩돼 path 가 안 깨진다
    expect(diffContract(fired, DELETE_CONTRACT, weirdId)).toEqual([]);
  });
  it('DELETE 발사 init 에 body 키가 부재하고 Content-Type 헤더도 없다 (happy-path — DELETE body/헤더 부재)', async () => {
    const fired = await fireDeleteGroup(GROUP_ID);
    expect(fired.method).toBe('DELETE');
    expect(fired.bodyKeys.size).toBe(0);
    expect(fired.hasContentType).toBe(false);
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합 + hasContentType=false 로 매핑된다 (분기 — options → body/헤더 부재 매핑)', () => {
    const fired = toFire('/api/groups/g-1', { method: 'DELETE' } as RequestOptions);
    expect(fired.bodyKeys.size).toBe(0);
    expect(fired.hasContentType).toBe(false);
  });

  // ── Negative cases 충분 cover — (a) base 오타 · (b) 세그먼트 추가 · (c) bare 세그먼트 0 · (g) encode 누락: 모두 path 불일치(404 예방).
  it.each<[string, () => Promise<{ fire: WebFire; backend: BackendContract; id: string }>]>([
    ['(a) backend base 를 api/group(오타)로', async () => ({ fire: await fireDeleteGroup(GROUP_ID), backend: { ...DELETE_CONTRACT, route: 'api/group' }, id: GROUP_ID })],
    ["(a') backend base 를 api/teams 로", async () => ({ fire: await fireDeleteGroup(GROUP_ID), backend: { ...DELETE_CONTRACT, route: 'api/teams' }, id: GROUP_ID })],
    ['(b) @Delete(":id") 를 @Delete(":id/members/:membershipId")(세그먼트 추가, param 2)로', async () => ({ fire: await fireDeleteGroup(GROUP_ID), backend: { ...DELETE_CONTRACT, subPath: extractHandlerMethods(['  @Delete(":id/members/:membershipId")', '  async delete() {}'].join('\n')).delete.subPath }, id: GROUP_ID })],
    ['(c) @Delete(":id") 를 bare @Delete()(세그먼트 0)로', async () => ({ fire: await fireDeleteGroup(GROUP_ID), backend: { ...DELETE_CONTRACT, subPath: extractHandlerMethods(['  @Delete()', '  async delete() {}'].join('\n')).delete.subPath }, id: GROUP_ID })],
    ['(g) web 이 id 를 encodeURIComponent 없이 raw 삽입', async () => { const f = await fireDeleteGroup('g 1/x'); return { fire: { ...f, path: '/api/groups/g 1/x' }, backend: DELETE_CONTRACT, id: 'g 1/x' }; }],
  ])('%s 면 path 불일치로 잡힌다 (negative — path drift, 404 예방)', async (_label, build) => {
    const { fire, backend, id } = await build();
    expect(diffContract(fire, backend, id)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Patch/@Post 로 바꿨는데 web 은 DELETE 발사 → method 불일치로 잡힌다 (negative (d) — method drift)', async () => {
    const fired = await fireDeleteGroup(GROUP_ID);
    for (const src of ['  @Patch(":id")', '  @Post(":id")']) {
      const handler = extractHandlerMethods([src, '  async delete() {}'].join('\n')).delete;
      const drifted: BackendContract = { ...DELETE_CONTRACT, method: handler.method };
      expect(diffContract(fired, drifted, GROUP_ID)).toEqual([expect.stringContaining('method 불일치')]);
    }
  });
  it('backend 가 @Body() dto 를 추가했는데 web 은 body 미발사 → body-less 정합 위반으로 잡힌다 (negative (e) — @Body 추가 drift)', async () => {
    const fired = await fireDeleteGroup(GROUP_ID);
    const bodyfulSrc = ['  async delete(', '    @Param("id") id: string,', '    @Body() dto: DeleteGroupDto,', '  ): Promise<void> {}'].join('\n');
    expect(handlerHasBody(bodyfulSrc, 'delete')).toBe(true);
    const drifted: BackendContract = { ...DELETE_CONTRACT, hasBody: true };
    expect(diffContract(fired, drifted, GROUP_ID)).toEqual([expect.stringContaining('backend @Body 요구 vs web body 부재')]);
  });
  it('web 이 불필요한 body/Content-Type 를 붙이면 body-less 대조가 fail 한다 (negative (f) — 초과 body/헤더 400/415 예방)', async () => {
    const fired = await fireDeleteGroup(GROUP_ID);
    const withBody: WebFire = { ...fired, bodyKeys: new Set(['reason']), hasContentType: true };
    const issues = diffContract(withBody, DELETE_CONTRACT, GROUP_ID);
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining('body 부재 위반')]));
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining('Content-Type 부재 위반')]));
  });
  it('주석 줄의 "@Delete(":id")"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (h) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/groups") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Delete(":id") — 주석뿐, decorator 없음', '  async delete() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).delete).toBeUndefined();
    const drifted: BackendContract = {
      ...DELETE_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).delete?.method ?? null,
    };
    expect(diffContract(await fireDeleteGroup(GROUP_ID), drifted, GROUP_ID)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null 을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(handlerHasBody('', 'delete')).toBe(false);
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').delete?.method ?? null,
      subPath: extractHandlerMethods('').delete?.subPath ?? '',
      hasBody: handlerHasBody('', 'delete'),
    };
    expect(diffContract(await fireDeleteGroup(GROUP_ID), empty, GROUP_ID)).toEqual(['backend 계약 추출 실패']);
  });
});
