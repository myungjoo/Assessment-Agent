import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { AddDeps, MembershipRow } from './AdminView';
import { deriveAddCandidates, runAdd } from './AdminView';
import type { PersonRow } from '../components/PersonList';
import type { Member } from '../components/GroupMemberList';
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

// ── T-1238 — AdminView 멤버 추가 컨테이너 배선 (deriveAddCandidates 파생 + onAdd 주입) ─────────────
// T-1237 이 신설한 presentational onAdd/addCandidates 계약을 컨테이너가 소비한다. 본 블록은 (1) 순수
// helper deriveAddCandidates(persons − 현재 멤버) 파생과 (2) 그 후보를 선택해 onAdd 로 넘겼을 때의 실
// 발사(runAdd)를 RTL/jsdom 없이 pure-function 으로 검증한다(ADR-0040 §5 — 위 drift-guard 와 동일 관례).

// PersonRow 팩토리 — 필수 4 필드를 채운다(id/fullName/email/active). 후보 파생은 id/fullName 만 쓴다.
function person(id: string, fullName: string): PersonRow {
  return { id, fullName, email: `${id}@example.com`, active: true };
}
// membership 팩토리 — 제외 키로 쓰는 personId 만 관심 대상(id/groupId 는 편의 채움).
function membership(personId: string): MembershipRow {
  return { id: `mem-${personId}`, personId, groupId: GROUP_ID };
}

// onAdd → runAdd 발사 캡처(가드로 미발사되는 negative 도 수용 — fireAddMember 와 달리 throw 없음).
async function tryAdd(
  personId: string,
  opts: { groupId?: string; adding?: boolean; failAdd?: boolean } = {},
): Promise<{ fired: boolean; firedBody: unknown; addError: string | undefined }> {
  let fired = false;
  let firedBody: unknown;
  let addError: string | undefined;
  const deps: AddDeps = {
    add: async (_path, options) => {
      fired = true;
      firedBody =
        options.body !== undefined && options.body !== null
          ? (JSON.parse(String(options.body)) as unknown)
          : undefined;
      if (opts.failAdd) {
        throw new Error('네트워크 0'); // 비-2xx/네트워크 실패 시뮬 — catch 경로 진입.
      }
      return undefined;
    },
    describeError: () => '멤버 추가에 실패했습니다',
    groupId: opts.groupId ?? GROUP_ID,
    adding: opts.adding ?? false,
    setAdding: () => {},
    setAddError: (next) => {
      addError = next;
    },
    bumpRefresh: () => {},
    resetInput: () => {},
  };
  await runAdd(personId, deps);
  return { fired, firedBody, addError };
}

describe('AdminView — deriveAddCandidates 파생 (T-1238)', () => {
  it('전체 인원 중 1인이 멤버면 나머지 2인만 후보로 남긴다(멤버 제외, id=personId, name=fullName) (happy-path)', () => {
    const candidates = deriveAddCandidates(
      [person('p1', '김하나'), person('p2', '이두리'), person('p3', '박세찬')],
      [membership('p2')],
    );
    expect(candidates).toEqual<Member[]>([
      { id: 'p1', name: '김하나' },
      { id: 'p3', name: '박세찬' },
    ]);
  });
  it('전체 인원 중 일부만 멤버면 후보는 비멤버만이다 (flow/branch — 제외 로직 분기)', () => {
    const candidates = deriveAddCandidates(
      [person('p1', 'A'), person('p2', 'B'), person('p3', 'C'), person('p4', 'D')],
      [membership('p1'), membership('p3')],
    );
    expect(candidates.map((c) => c.id)).toEqual(['p2', 'p4']);
  });
  it('모든 인원이 이미 멤버면 후보는 빈 배열이다 (flow/branch — 빈 후보 안전 표시 분기)', () => {
    const candidates = deriveAddCandidates(
      [person('p1', 'A'), person('p2', 'B')],
      [membership('p1'), membership('p2')],
    );
    expect(candidates).toEqual([]);
  });
  it('membershipData 가 undefined 면 전원이 후보다(제외 집합 없음) (분기 — 멤버십 미도착)', () => {
    const candidates = deriveAddCandidates([person('p1', 'A'), person('p2', 'B')], undefined);
    expect(candidates.map((c) => c.id)).toEqual(['p1', 'p2']);
  });
  it('personData 가 undefined/비배열이면 빈 배열을 반환한다(throw 없음) (negative (d) — 조회 전 안전 수용)', () => {
    expect(deriveAddCandidates(undefined, [membership('p1')])).toEqual([]);
    expect(deriveAddCandidates(null as unknown as PersonRow[], undefined)).toEqual([]);
    expect(deriveAddCandidates({} as unknown as PersonRow[], undefined)).toEqual([]);
  });
  it('membershipData 가 비배열이면 제외 없이 전원 후보다(throw 없음) (negative — 비정상 멤버십)', () => {
    const candidates = deriveAddCandidates(
      [person('p1', 'A')],
      'oops' as unknown as MembershipRow[],
    );
    expect(candidates.map((c) => c.id)).toEqual(['p1']);
  });
  it('personId 가 빈/누락인 membership 은 제외 키로 쓰지 않는다(정상 인원 유실 방지) (negative — 잘못된 제외 키)', () => {
    const candidates = deriveAddCandidates(
      [person('p1', 'A'), person('p2', 'B')],
      [
        { id: 'm1', personId: '', groupId: GROUP_ID },
        { id: 'm2', groupId: GROUP_ID }, // personId 누락
      ],
    );
    expect(candidates.map((c) => c.id)).toEqual(['p1', 'p2']);
  });
  it('id 누락 인원은 index 기반 합성 key(p<n>)로 안전 매핑한다 (negative — id 누락)', () => {
    const candidates = deriveAddCandidates(
      [{ fullName: '무명' } as unknown as PersonRow],
      undefined,
    );
    expect(candidates).toEqual<Member[]>([{ id: 'p1', name: '무명' }]);
  });
  it('fullName 누락/빈 문자열 인원은 FALLBACK 이름으로 안전 매핑한다 (negative — 이름 누락)', () => {
    const candidates = deriveAddCandidates(
      [
        { id: 'p1' } as unknown as PersonRow,
        { id: 'p2', fullName: '' } as unknown as PersonRow,
      ],
      undefined,
    );
    expect(candidates).toEqual<Member[]>([
      { id: 'p1', name: '이름 미상' },
      { id: 'p2', name: '이름 미상' },
    ]);
  });
});

describe('AdminView — onAdd 주입(handleAdd → runAdd) 발사 (T-1238)', () => {
  it('후보 선택 → onAdd(personId) 시 POST body {personId} 가 정확히 1회 발사된다 (happy-path)', async () => {
    const candidates = deriveAddCandidates(
      [person('p1', 'A'), person('p2', 'B'), person('p3', 'C')],
      [membership('p2')],
    );
    const selected = candidates[0].id; // 후보에서 첫 인원 선택(p1).
    const result = await tryAdd(selected);
    expect(result.fired).toBe(true);
    expect(result.firedBody).toEqual({ personId: 'p1' });
  });
  it('그룹 미선택(빈 groupId)이면 add 미발사(POST 0) (negative (a) — 그룹 미선택 가드)', async () => {
    const result = await tryAdd('p1', { groupId: '' });
    expect(result.fired).toBe(false);
  });
  it('후보 미선택(빈 personId)이면 add 미발사(POST 0) (negative (b) — 빈 personId 차단)', async () => {
    const result = await tryAdd('');
    expect(result.fired).toBe(false);
    expect((await tryAdd('   ')).fired).toBe(false); // 공백만도 차단.
  });
  it('POST 실패(네트워크/비-2xx) 시 addError 를 사람-친화 문구로 안전 표시하고 throw 하지 않는다 (negative (c) — 실패 안전 표시)', async () => {
    const result = await tryAdd('p1', { failAdd: true });
    expect(result.fired).toBe(true);
    expect(result.addError).toBe('멤버 추가에 실패했습니다');
  });
  it('add in-flight(adding=true) 중 재발사는 미발사(이중 POST 미발사) (flow/branch — adding 가드)', async () => {
    const result = await tryAdd('p1', { adding: true });
    expect(result.fired).toBe(false);
  });
});
