import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { AddDeps } from './AdminView';
import { runAdd } from './AdminView';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본 삭제·동작 무변경(T-1213 이관 slice, mutation stream group-member-add).
// 이 spec 이 참조하는 export 중 **공용과 글자-동일한 4종만** import(stripQuery/extractHandlerParams/pathSegments 제외 — 부재/미사용). richer
// extractHandlerMethods(주석 상이)·HandlerDecorator·BackendContract/WebFire·fillParams·diffContract·toFire 는 inline 유지.
import {
  composeRoute,
  extractControllerRoute,
  normalizeRoute,
  stripComments,
} from './__contract-guard__/contract-extractors';

// R-112 — 그룹 멤버 추가(POST /api/groups/:id/members) web↔backend **계약 drift guard**. 선례
// AdminView.create-user-contract.test.ts(T-1172) · AdminView.role-change-contract.test.ts(T-1171)
// 의 "backend 소스에서 계약을 추출해 web 발사 인자와 대조" 패턴 차용(추출기/대조기 상세 주석은 그
// 파일들; 로컬 재정의는 use site 4 곳이라 아직 YAGNI — 공용 helper 추출은 Out of Scope, AST 대신
// 정규식만 → 새 devDependency 0). endpoint-특화 신규 축 2개: (1) base route 도메인이 `api/groups`
// 로 바뀌어 base 파싱·합성 대조가 그룹 도메인 첫 대상. (2) method 인자 `:id/members` 가 param(`:id`)
// + trailing static(`members`) 조합이라, 발사 concrete path 의 `:id` 자리에 실 groupId 를 치환해
// template 을 복원·대조한다. backend 가 base 를 `api/group`(오타)/`api/teams` 로, 또는 method 인자를
// `:id/persons` 로 바꾸면 route 불일치 fail. body 는 `personId` 단일 required(optional 0).

// method decorator — HTTP method + 인자 sub-path(`@Post(":id/members")`→':id/members'). @HttpCode 등
// 사이 decorator 는 pending 을 리셋하지 않고 continue.
interface HandlerDecorator {
  method: string;
  subPath: string;
}
// handler 이름 → {method, subPath}(`addMember`→{POST, ':id/members'}). decorator 없는 handler 미수록.
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
// DTO 필드 — required(`personId!`/표기 없음)/optional(`x?`). 클래스 없으면 둘 다 빈 집합.
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
  body: Record<string, unknown>;
}
// template 의 `:key` 세그먼트를 실 param 값으로 치환한다. 세그먼트 단위 치환이라 param 위치(base
// 다음 세그먼트) + 뒤따르는 static `members` 세그먼트가 함께 검증된다(전체 문자열 대조).
function fillParams(template: string, params: Record<string, string>): string {
  return template
    .split('/')
    .map((seg) => (seg.startsWith(':') ? (params[seg.slice(1)] ?? seg) : seg))
    .join('/');
}
// 불일치 사유 목록 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과가 아니라 사유 1건이다.
function diffContract(fire: WebFire, backend: BackendContract, params: Record<string, string>): string[] {
  if (!backend.route || !backend.method || backend.required.size + backend.optional.size === 0) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== fillParams(composeRoute(backend.route, backend.subPath), params)) {
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

// 실 소스 로드 + web 발사 캡처 harness.
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/group.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/user/dto/add-member.dto.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'AddMemberDto');
const ADD_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).addMember ?? null;
const ADD_CONTRACT: BackendContract = {
  route: ROUTE,
  method: ADD_HANDLER?.method ?? null,
  subPath: ADD_HANDLER?.subPath ?? '',
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const GROUP_ID = 'grp-1'; // encodeURIComponent 무변 — 발사 path 의 :id 자리에 그대로 나타난다.
const PARAMS = { id: GROUP_ID };
// options.body 부재/undefined 는 SyntaxError 대신 빈 키 집합으로 매핑한다(선례 Follow-up).
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
async function fireAddMember(personId: string): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: AddDeps = {
    add: async (path, options) => {
      fired = toFire(path, options);
      return undefined;
    },
    describeError: () => '',
    groupId: GROUP_ID,
    adding: false,
    setAdding: () => {},
    setAddError: () => {},
    bumpRefresh: () => {},
    resetInput: () => {},
  };
  await runAdd(personId, deps);
  if (!fired) {
    throw new Error('멤버 추가 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 그룹 멤버 추가 web↔backend 계약 drift guard (T-1173)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(ADD_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size).toBeGreaterThan(0);
  });
  it('backend @Controller("api/groups") base route 를 /api/groups 로 정규화한다 (분기 — 그룹 base 파싱)', () => {
    expect(ROUTE).toBe('api/groups');
    expect(normalizeRoute(String(ROUTE))).toBe('/api/groups');
  });
  it('backend @Post(":id/members") 인자를 base 와 합성해 param+trailing static template 을 만든다 (분기 — 인자 합성)', () => {
    expect(ADD_CONTRACT.method).toBe('POST');
    expect(ADD_CONTRACT.subPath).toBe(':id/members');
    const template = composeRoute(String(ROUTE), ADD_CONTRACT.subPath);
    expect(template).toBe('/api/groups/:id/members');
    expect(fillParams(template, PARAMS)).toBe('/api/groups/grp-1/members'); // :id 세그먼트 + trailing members 함께 검증
  });
  it('멤버 추가 발사(POST /api/groups/grp-1/members)가 backend addMember 계약과 완전 일치한다 (happy-path)', async () => {
    expect(diffContract(await fireAddMember('person-9'), ADD_CONTRACT, PARAMS)).toEqual([]);
  });
  it('발사 body 키가 declared 부분집합을 만족한다(초과 0·필수 누락 0, personId 단일) (happy-path — body)', async () => {
    const fired = await fireAddMember('person-9');
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...fired.bodyKeys].every((key) => declared.has(key))).toBe(true);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true);
    expect([...fired.bodyKeys].sort()).toEqual(['personId']);
  });
  it('extractDtoFields 가 personId 를 required 로 분류하고 optional 은 비어있다 (분기 — 단일 required)', () => {
    expect([...DTO_FIELDS.required].sort()).toEqual(['personId']);
    expect(DTO_FIELDS.optional.size).toBe(0);
  });
  it('extractDtoFields 가 `x?` 표기 필드를 optional 집합으로 수집한다 (분기 — optional 수집, 합성 DTO)', () => {
    // 실 AddMemberDto 는 optional 0 이라 optional-수집 분기가 미실행 → 합성 소스로 분기 직접 구동.
    const synthetic = ['export class SyntheticDto {', '  personId!: string;', '  note?: string;', '}'].join('\n');
    const fields = extractDtoFields(synthetic, 'SyntheticDto');
    expect([...fields.required].sort()).toEqual(['personId']);
    expect([...fields.optional].sort()).toEqual(['note']);
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합으로 매핑된다 (분기 — body 부재)', () => {
    expect(toFire('/api/groups/grp-1/members', { method: 'POST' } as RequestOptions).bodyKeys.size).toBe(0);
  });

  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it('backend 가 base 를 api/group(오타)/api/teams 로 바꾸면 web 의 /api/groups 발사가 path 불일치로 잡힌다 (negative (a) — base drift, 404 예방)', async () => {
    const fired = await fireAddMember('person-9');
    for (const base of ['api/group', 'api/teams']) {
      const drifted: BackendContract = { ...ADD_CONTRACT, route: base };
      expect(diffContract(fired, drifted, PARAMS)).toEqual([expect.stringContaining('path 불일치')]);
    }
  });
  it('backend 가 method 인자를 :id/persons/:id 로 바꾸면 route 세그먼트 불일치로 잡힌다 (negative (b) — sub-path drift)', async () => {
    const fired = await fireAddMember('person-9');
    for (const subPath of [':id/persons', ':id']) {
      const drifted: BackendContract = { ...ADD_CONTRACT, subPath };
      expect(diffContract(fired, drifted, PARAMS)).toEqual([expect.stringContaining('path 불일치')]);
    }
  });
  it('backend 가 method 를 @Put/@Delete 로 바꿨는데 web 은 POST 발사 → method 불일치로 잡힌다 (negative (c) — method drift)', async () => {
    const fired = await fireAddMember('person-9');
    for (const src of ['  @Put(":id/members")', '  @Delete(":id/members")']) {
      const handler = extractHandlerMethods([src, '  async addMember() {}'].join('\n')).addMember;
      const drifted: BackendContract = { ...ADD_CONTRACT, method: handler.method };
      expect(diffContract(fired, drifted, PARAMS)).toEqual([expect.stringContaining('method 불일치')]);
    }
  });

  // (d) 초과 키(groupId body/memberId 오타), (e) required personId 누락 — declared 부분집합 위반(400 예방).
  it.each<[string, (base: WebFire) => Set<string>, string]>([
    ['(d) 초과 키 groupId(path param 을 body 로 오발사)', (base) => new Set([...base.bodyKeys, 'groupId']), 'body 초과 키'],
    ['(d) 초과 키 memberId(personId 오타)', (base) => new Set([...base.bodyKeys, 'memberId']), 'body 초과 키'],
    ['(e) required personId 누락', () => new Set<string>(), 'body 필수 누락'],
  ])('web body 가 %s 면 부분집합 위반으로 잡힌다 (negative — 400 예방)', async (_label, mutate, expected) => {
    const fired = await fireAddMember('person-9');
    expect(diffContract({ ...fired, bodyKeys: mutate(fired) }, ADD_CONTRACT, PARAMS)).toEqual([expect.stringContaining(expected)]);
  });

  it('backend DTO 가 personId 를 memberId 로 rename 했는데 web 은 여전히 personId 발사 → 초과 키로 잡힌다 (negative (f) — DTO rename drift)', async () => {
    const renamed: BackendContract = { ...ADD_CONTRACT, required: new Set(['memberId']) };
    // personId(초과) + memberId(누락) 둘 다 잡혀야 한다.
    expect(diffContract(await fireAddMember('person-9'), renamed, PARAMS).sort()).toEqual([
      expect.stringContaining('body 초과 키'),
      expect.stringContaining('body 필수 누락'),
    ]);
  });
  it('body 부재 발사는 SyntaxError 없이 body 필수 누락(personId)으로 판정된다 (negative (g) — body 부재 진단)', () => {
    const fire = toFire('/api/groups/grp-1/members', { method: 'POST' } as RequestOptions);
    expect(diffContract(fire, ADD_CONTRACT, PARAMS)).toEqual([expect.stringContaining('body 필수 누락')]);
  });
  it('주석 줄의 "@Post(...)"/"@Controller(...)" 를 실 decorator 로 오인하지 않는다 (negative (h) — 주석 false-positive)', async () => {
    const fakeController = ['  // @Controller("api/groups") — 주석뿐', 'export class X {}'].join('\n');
    const fakeHandler = ['  // @Post(":id/members") — 주석뿐, decorator 없음', '  async addMember() {}'].join('\n');
    expect(extractControllerRoute(fakeController)).toBeNull();
    expect(extractHandlerMethods(fakeHandler).addMember).toBeUndefined();
    const drifted: BackendContract = {
      ...ADD_CONTRACT,
      route: extractControllerRoute(fakeController),
      method: extractHandlerMethods(fakeHandler).addMember?.method ?? null,
    };
    expect(diffContract(await fireAddMember('person-9'), drifted, PARAMS)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const emptyFields = extractDtoFields('', 'AddMemberDto');
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').addMember?.method ?? null,
      subPath: '',
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireAddMember('person-9'), empty, PARAMS)).toEqual(['backend 계약 추출 실패']);
  });
});
