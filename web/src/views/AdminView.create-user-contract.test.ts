import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { RequestOptions } from '../api/apiClient';
import type { CreateUserDeps } from './AdminView';
import { runCreateUser } from './AdminView';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본 삭제·동작 무변경(T-1210 이관 slice, mutation).
// inline 추출기 5종(stripComments·extractControllerRoute·extractHandlerMethods·normalizeRoute·composeRoute)을
// 삭제했다(extractHandlerMethods 포함 — 함수 본문+inline 주석까지 byte-identical). 그중 normalizeRoute 는 이
// spec 에서 직접 참조가 없고 composeRoute 내부에서만 쓰이므로(공용 composeRoute 가 공용 normalizeRoute 를
// 전이적으로 사용) import 하지 않는다 — HandlerDecorator 와 동일한 "잔여 참조 없으면 미import" 규칙(tsc 검증).
// 전용 extractDtoFields/diffContract·per-spec 타입은 inline 유지. stripQuery·extractHandlerParams·pathSegments
// 는 이 spec 에 부재/미사용이라 import 하지 않는다.
import {
  composeRoute,
  extractControllerRoute,
  extractHandlerMethods,
  stripComments,
} from './__contract-guard__/contract-extractors';

// R-112 — 사용자 생성(POST /api/users) web↔backend **계약 drift guard**. 선례
// AdminView.role-change-contract.test.ts(T-1171) · AdminView.instance-access-contract.test.ts
// (T-1169+T-1170)의 "backend 소스에서 계약을 추출해 web 발사 인자와 대조" 패턴 차용(추출기/대조기
// 상세 주석은 그 두 파일; 로컬 재정의는 use site 3 곳이라 아직 YAGNI — 공용 helper 추출은 Out of
// Scope, AST 대신 정규식만 → 새 devDependency 0). endpoint-특화 신규 축(bare route): user.controller
// 의 `@Post()` 은 인자가 비어 최종 route == base route(`/api/users`, param 위치 0)라, decorator 인자
// 부재 → base route 정규화를 대조한다. backend 가 실수로 `@Post(":id")`/`@Post("signup")` 를 붙이면
// route 불일치 fail. 또 required 가 2개(email+password)라 `required ⊆ fired` 다중 필드 대조가 실효.

// DTO 필드 — required(`email!`/표기 없음)/optional(`x?`). 클래스 없으면 둘 다 빈 집합.
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
// 불일치 사유 목록 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과가 아니라 사유 1건이다.
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
  return issues;
}

// 실 소스 로드 + web 발사 캡처 harness.
const CONTROLLER_SOURCE = readFileSync(new URL('../../../src/user/user.controller.ts', import.meta.url), 'utf8');
const DTO_SOURCE = readFileSync(new URL('../../../src/user/dto/add-user.dto.ts', import.meta.url), 'utf8');
const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'AddUserDto');
const SIGNUP_HANDLER = extractHandlerMethods(CONTROLLER_SOURCE).signup ?? null;
const CREATE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: SIGNUP_HANDLER?.method ?? null,
  subPath: SIGNUP_HANDLER?.subPath ?? '',
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
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
async function fireCreateUser(email: string, password: string): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: CreateUserDeps = {
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
  await runCreateUser(email, password, deps);
  if (!fired) {
    throw new Error('사용자 생성 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 사용자 생성 web↔backend 계약 drift guard (T-1172)', () => {
  it('backend route/method/DTO 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(CREATE_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size).toBeGreaterThan(0);
  });
  it('backend @Post() bare route(인자 부재)를 base route 자체로 정규화한다 (분기 — bare route, param 위치 0)', () => {
    expect(CREATE_CONTRACT.subPath).toBe('');
    expect(CREATE_CONTRACT.method).toBe('POST');
    expect(composeRoute(String(ROUTE), CREATE_CONTRACT.subPath)).toBe('/api/users');
  });
  it('backend @Post(":id") 처럼 인자가 있으면 base route 와 합성한다 (분기 — 인자 합성, bare 대비)', () => {
    const handler = extractHandlerMethods(['  @Post(":id")', '  async signup() {}'].join('\n')).signup;
    expect(handler).toEqual({ method: 'POST', subPath: ':id' });
    expect(composeRoute('api/users', handler.subPath)).toBe('/api/users/:id');
  });
  it('사용자 생성 발사(POST /api/users)가 backend signup 계약과 완전 일치한다 (happy-path)', async () => {
    expect(diffContract(await fireCreateUser('user@example.com', 'password8'), CREATE_CONTRACT)).toEqual([]);
  });
  it('발사 body 키가 declared 부분집합을 만족한다(초과 0·필수 누락 0, email·password 둘 다) (happy-path — body)', async () => {
    const fired = await fireCreateUser('user@example.com', 'password8');
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...fired.bodyKeys].every((key) => declared.has(key))).toBe(true);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true);
    expect([...fired.bodyKeys].sort()).toEqual(['email', 'password']);
  });
  it('extractDtoFields 가 email·password 를 required 로 분류하고 optional 은 비어있다 (분기 — 다중 required)', () => {
    expect([...DTO_FIELDS.required].sort()).toEqual(['email', 'password']);
    expect(DTO_FIELDS.optional.size).toBe(0);
  });
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합으로 매핑된다 (분기 — body 부재)', () => {
    expect(toFire('/api/users', { method: 'POST' } as RequestOptions).bodyKeys.size).toBe(0);
  });

  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it('backend 가 @Post(":id") 로 바꾸면 web 의 /api/users bare 발사가 path 불일치로 잡힌다 (negative (a) — route drift, 404 예방)', async () => {
    const drifted: BackendContract = { ...CREATE_CONTRACT, subPath: ':id' };
    expect(diffContract(await fireCreateUser('user@example.com', 'password8'), drifted)).toEqual([expect.stringContaining('path 불일치')]);
  });
  it('backend 가 method 를 @Put 으로 바꾸면 web 의 POST 발사가 method 불일치로 잡힌다 (negative (b) — method drift)', async () => {
    const handler = extractHandlerMethods(['  @Put()', '  async signup() {}'].join('\n')).signup;
    expect(handler).toEqual({ method: 'PUT', subPath: '' });
    const drifted: BackendContract = { ...CREATE_CONTRACT, method: handler.method };
    expect(diffContract(await fireCreateUser('user@example.com', 'password8'), drifted)).toEqual([expect.stringContaining('method 불일치')]);
  });

  // (c) 초과 키, (d) 필수 누락 — web body 가 declared 부분집합을 벗어나면 잡힌다(400 예방).
  it.each<[string, (base: WebFire) => Set<string>, string]>([
    ['(c) 초과 키(role 우회/username 오타 등)', (base) => new Set([...base.bodyKeys, 'role']), 'body 초과 키'],
    ['(d) required password 누락', (base) => new Set([...base.bodyKeys].filter((key) => key !== 'password')), 'body 필수 누락'],
  ])('web body 가 %s 면 부분집합 위반으로 잡힌다 (negative — 400 예방)', async (_label, mutate, expected) => {
    const fired = await fireCreateUser('user@example.com', 'password8');
    expect(diffContract({ ...fired, bodyKeys: mutate(fired) }, CREATE_CONTRACT)).toEqual([expect.stringContaining(expected)]);
  });

  it('backend DTO 가 password 를 제거했는데 web 은 여전히 password 발사 → 초과 키로 잡힌다 (negative (e) — DTO 축소 drift)', async () => {
    const shrunk: BackendContract = { ...CREATE_CONTRACT, required: new Set(['email']) };
    expect(diffContract(await fireCreateUser('user@example.com', 'password8'), shrunk)).toEqual([expect.stringContaining('body 초과 키')]);
  });
  it('body 부재 발사는 SyntaxError 없이 body 필수 누락(email·password)으로 판정된다 (negative (f) — body 부재 진단)', () => {
    const fire = toFire('/api/users', { method: 'POST' } as RequestOptions);
    expect(diffContract(fire, CREATE_CONTRACT)).toEqual([expect.stringContaining('body 필수 누락')]);
  });
  it('주석 줄의 "@Post()" 를 method 로 오인하지 않는다 (negative (g) — 주석 false-positive)', async () => {
    const fake = ['  // @Post() — 주석뿐, decorator 없음', '  async signup() {}'].join('\n');
    expect(extractHandlerMethods(fake).signup).toBeUndefined();
    const drifted: BackendContract = { ...CREATE_CONTRACT, method: extractHandlerMethods(fake).signup?.method ?? null };
    expect(diffContract(await fireCreateUser('user@example.com', 'password8'), drifted)).toEqual(['backend 계약 추출 실패']);
  });
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const emptyFields = extractDtoFields('', 'AddUserDto');
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').signup?.method ?? null,
      subPath: '',
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireCreateUser('user@example.com', 'password8'), empty)).toEqual(['backend 계약 추출 실패']);
  });
});
