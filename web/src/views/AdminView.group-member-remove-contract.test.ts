import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { RemoveDeps } from './AdminView';
import { runRemove } from './AdminView';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본 삭제·동작 무변경(T-1214 이관 slice, mutation stream group-member-remove).
// 이 spec 이 참조하는 export 중 **공용과 글자-동일한 4종만** import(stripQuery/extractHandlerParams/pathSegments 제외 — 부재/미사용). richer
// extractHandlerMethods(주석 상이)·HandlerDecorator·BackendContract/WebFire·subPathSegments·fillParams·diffContract·toFire 는 inline 유지.
import {
  composeRoute,
  extractControllerRoute,
  normalizeRoute,
  stripComments,
} from './__contract-guard__/contract-extractors';

// R-112 — 그룹 멤버 제거(DELETE /api/groups/:id/members/:membershipId) web↔backend **계약 drift
// guard**. 선례 AdminView.group-member-add-contract.test.ts(T-1173) 등 4 slice 의 "backend 소스에서
// 계약을 추출해 web 발사 인자와 대조" 패턴 차용(추출기/대조기 상세 주석은 선례 파일; 로컬 재정의는
// use site 5 곳이라 아직 YAGNI — 공용 helper 추출은 Out of Scope, AST 대신 정규식만 → 새 devDependency
// 0). endpoint-특화 신규 축 3개: (1) two path param 합성 — base(api/groups) → :id(param) → members
// (static) → :membershipId(param) 4 세그먼트를 static 세그먼트가 낀 채 합성·대조하는 첫 다중-param
// guard. (2) DELETE + body 완전 부재 — 발사 init 에 body 키가 없어야(빈 집합) 정상, 붙으면 초과 fail.
// (3) :membershipId(≠:personId) param 명 대조 — 원안 :personId 회귀를 잡는다.

// method decorator — HTTP method + 인자 sub-path(`@Delete(":id/members/:membershipId")` →
// {DELETE, ':id/members/:membershipId'}). @HttpCode 등 사이 decorator 는 pending 을 리셋하지 않고 continue.
interface HandlerDecorator {
  method: string;
  subPath: string;
}
// handler 이름 → {method, subPath}(`removeMember`→{DELETE, ':id/members/:membershipId'}).
// decorator 없는 handler 미수록.
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

interface BackendContract {
  route: string | null;
  method: string | null;
  subPath: string;
}
interface WebFire {
  path: string;
  method: string;
  bodyKeys: Set<string>;
  hasContentType: boolean;
}
// subPath 의 세그먼트 배열(`:id/members/:membershipId` → [':id','members',':membershipId']). param(`:`)/
// static 순서를 세그먼트 단위로 검증하기 위한 helper — 다중 param + 중간 static 구조 대조의 핵심.
function subPathSegments(subPath: string): string[] {
  return subPath.split('/').filter((seg) => seg.length > 0);
}
// template 의 `:key` 세그먼트를 실 param 값으로 치환한다. 세그먼트 단위 치환이라 두 param 위치(:id·
// :membershipId) + 사이의 static `members` 세그먼트가 함께 검증된다(전체 문자열 대조). params 에 없는
// param 키는 `:key` 리터럴로 남아 web 발사 concrete path 와 불일치한다(param 명 회귀 catch).
function fillParams(template: string, params: Record<string, string>): string {
  return template
    .split('/')
    .map((seg) => (seg.startsWith(':') ? (params[seg.slice(1)] ?? seg) : seg))
    .join('/');
}
// 불일치 사유 목록 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과가 아니라 사유 1건이다(선단언 방어).
// body 부재 endpoint 라 DTO 대조는 없고, 발사 body 키가 하나라도 있으면 초과(계약 위반)다.
function diffContract(fire: WebFire, backend: BackendContract, params: Record<string, string>): string[] {
  if (!backend.route || !backend.method || !backend.subPath) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== fillParams(composeRoute(backend.route, backend.subPath), params)) {
    issues.push(`path 불일치: ${fire.path}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  const extras = [...fire.bodyKeys].sort(); // body 부재 endpoint — 발사 키가 있으면 전부 초과.
  if (extras.length > 0) {
    issues.push(`body 부재 위반(초과 키): ${extras.join(',')}`);
  }
  return issues;
}

// 실 controller 소스 로드 + web 발사 캡처 harness.
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/group.controller.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const REMOVE_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).removeMember ?? null;
const REMOVE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: REMOVE_HANDLER?.method ?? null,
  subPath: REMOVE_HANDLER?.subPath ?? '',
};
const GROUP_ID = 'grp-1'; // encodeURIComponent 무변 — 발사 path 의 :id 자리에 그대로 나타난다.
const MEMBERSHIP_ID = 'mem-7'; // groupId 와 다른 값 — param 순서 뒤집힘(negative (c))이 문자열 대조로 드러난다.
const PARAMS = { id: GROUP_ID, membershipId: MEMBERSHIP_ID };
// options.body 부재/undefined 는 SyntaxError 대신 빈 키 집합으로 매핑한다(선례 Follow-up).
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
async function fireRemoveMember(membershipId: string): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: RemoveDeps = {
    remove: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    groupId: GROUP_ID,
    removing: false,
    setRemoving: () => {},
    setRemoveError: () => {},
    bumpRefresh: () => {},
  };
  await runRemove(membershipId, deps);
  if (!fired) {
    throw new Error('멤버 제거 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 그룹 멤버 제거 web↔backend 계약 drift guard (T-1174)', () => {
  it('backend route/method 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(REMOVE_CONTRACT.method).not.toBeNull();
    expect(REMOVE_CONTRACT.subPath).not.toBe('');
  });
  it('backend @Controller("api/groups") base route 를 /api/groups 로 정규화한다 (분기 — base 파싱)', () => {
    expect(ROUTE).toBe('api/groups');
    expect(normalizeRoute(String(ROUTE))).toBe('/api/groups');
  });
  it('backend @Delete(":id/members/:membershipId") 인자를 base 와 합성해 4 세그먼트 template 을 만든다 (분기 — 다중 param + static 합성)', () => {
    expect(REMOVE_CONTRACT.subPath).toBe(':id/members/:membershipId');
    // 세그먼트 순서 — :id(param) → members(static) → :membershipId(param).
    expect(subPathSegments(REMOVE_CONTRACT.subPath)).toEqual([':id', 'members', ':membershipId']);
    const template = composeRoute(String(ROUTE), REMOVE_CONTRACT.subPath);
    expect(template).toBe('/api/groups/:id/members/:membershipId');
    // 두 param 자리에 실 값 치환 + 사이의 static members 함께 검증.
    expect(fillParams(template, PARAMS)).toBe('/api/groups/grp-1/members/mem-7');
  });
  it('extractHandlerMethods 가 removeMember 를 DELETE 로 분류한다 (분기 — method 인자 대조)', () => {
    expect(REMOVE_CONTRACT.method).toBe('DELETE');
  });
  it('멤버 제거 발사(DELETE /api/groups/grp-1/members/mem-7)가 backend removeMember 계약과 완전 일치한다 (happy-path)', async () => {
    const fired = await fireRemoveMember(MEMBERSHIP_ID);
    expect(diffContract(fired, REMOVE_CONTRACT, PARAMS)).toEqual([]);
    expect(fired.path).toBe('/api/groups/grp-1/members/mem-7');
    expect(fired.method).toBe('DELETE');
  });
  it('발사 init 에 body 키가 부재하고 Content-Type 헤더도 없다 (happy-path — DELETE body 부재)', async () => {
    const fired = await fireRemoveMember(MEMBERSHIP_ID);
    expect(fired.bodyKeys.size).toBe(0);
    expect(fired.hasContentType).toBe(false);
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합으로 매핑된다 (분기 — body 부재 매핑)', () => {
    const fired = toFire('/api/groups/grp-1/members/mem-7', { method: 'DELETE' } as RequestOptions);
    expect(fired.bodyKeys.size).toBe(0);
    expect(fired.hasContentType).toBe(false);
  });

  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it('backend 가 base 를 api/group(오타)/api/teams 로 바꾸면 web 의 /api/groups 발사가 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', async () => {
    const fired = await fireRemoveMember(MEMBERSHIP_ID);
    for (const base of ['api/group', 'api/teams']) {
      const drifted: BackendContract = { ...REMOVE_CONTRACT, route: base };
      expect(diffContract(fired, drifted, PARAMS)).toEqual([expect.stringContaining('path 불일치')]);
    }
  });
  it('backend 가 static 세그먼트 members 를 persons 로 바꾸면 세그먼트 불일치로 잡힌다 (negative (b) — static 세그먼트 drift)', async () => {
    const fired = await fireRemoveMember(MEMBERSHIP_ID);
    const drifted: BackendContract = { ...REMOVE_CONTRACT, subPath: ':id/persons/:membershipId' };
    expect(subPathSegments(drifted.subPath)).toEqual([':id', 'persons', ':membershipId']);
    expect(diffContract(fired, drifted, PARAMS)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 param 순서를 뒤집으면(:membershipId/members/:id) 세그먼트 순서 불일치로 잡힌다 (negative (c) — param 순서 drift)', async () => {
    const fired = await fireRemoveMember(MEMBERSHIP_ID);
    const drifted: BackendContract = { ...REMOVE_CONTRACT, subPath: ':membershipId/members/:id' };
    // 순서가 뒤집혀 치환 결과가 /api/groups/mem-7/members/grp-1 → web 발사와 불일치.
    expect(diffContract(fired, drifted, PARAMS)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Post/@Patch 로 바꿨는데 web 은 DELETE 발사 → method 불일치로 잡힌다 (negative (d) — method drift)', async () => {
    const fired = await fireRemoveMember(MEMBERSHIP_ID);
    for (const src of ['  @Post(":id/members/:membershipId")', '  @Patch(":id/members/:membershipId")']) {
      const handler = extractHandlerMethods([src, '  async removeMember() {}'].join('\n')).removeMember;
      const drifted: BackendContract = { ...REMOVE_CONTRACT, method: handler.method };
      expect(diffContract(fired, drifted, PARAMS)).toEqual([expect.stringContaining('method 불일치')]);
    }
  });
  it('web 이 불필요한 body 를 발사하면(DELETE + body) body 부재 위반으로 잡힌다 (negative (e) — 초과 body 400 예방)', async () => {
    const fired = await fireRemoveMember(MEMBERSHIP_ID);
    const withBody: WebFire = { ...fired, bodyKeys: new Set(['membershipId', 'reason']) };
    expect(diffContract(withBody, REMOVE_CONTRACT, PARAMS)).toEqual([
      expect.stringContaining('body 부재 위반'),
    ]);
  });
  it('backend param 명이 :membershipId→:personId 로 되돌아가면(원안 회귀) param 명 대조로 잡힌다 (negative (f) — param 명 회귀)', async () => {
    const fired = await fireRemoveMember(MEMBERSHIP_ID);
    const drifted: BackendContract = { ...REMOVE_CONTRACT, subPath: ':id/members/:personId' };
    // :personId 는 PARAMS 에 없어 리터럴로 남는다 → /api/groups/grp-1/members/:personId ≠ 발사 path.
    expect(diffContract(fired, drifted, PARAMS)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('init.body 부재 발사는 SyntaxError/undefined 접근 없이 "body 없음"으로 정상 판정된다 (negative (g) — body 부재 진단)', async () => {
    const fired = await fireRemoveMember(MEMBERSHIP_ID);
    // body 키가 0 이므로 body 관련 사유가 전혀 발생하지 않는다(정상 계약).
    expect(diffContract(fired, REMOVE_CONTRACT, PARAMS)).toEqual([]);
    expect(fired.bodyKeys.size).toBe(0);
  });
  it('주석 줄의 "@Delete(...)"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (h) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/groups") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Delete(":id/members/:membershipId") — 주석뿐', '  async removeMember() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).removeMember).toBeUndefined();
    const drifted: BackendContract = {
      ...REMOVE_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).removeMember?.method ?? null,
      subPath: extractHandlerMethods(fakeHandler).removeMember?.subPath ?? '',
    };
    expect(diffContract(await fireRemoveMember(MEMBERSHIP_ID), drifted, PARAMS)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null 을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').removeMember?.method ?? null,
      subPath: extractHandlerMethods('').removeMember?.subPath ?? '',
    };
    expect(diffContract(await fireRemoveMember(MEMBERSHIP_ID), empty, PARAMS)).toEqual(['backend 계약 추출 실패']);
  });
});
