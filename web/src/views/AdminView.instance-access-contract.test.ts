import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// R-112 — 인스턴스 접근(부여 POST / 회수 DELETE) 의 web↔backend **계약 drift guard** 전용 spec.
//
// (a) 왜 별도 spec 파일인가: 본 spec 만 `../../../src/**` 즉 **backend 패키지 소스** 를 읽는다(web
//     spec 이 교차 패키지 파일을 읽는 첫 사례 — AdminView.test.tsx 의 drift guard 는 같은 패키지의
//     AdminView.tsx 만 읽는다). 그 새 패턴(경로 의존 + 정규식 추출기)을 한 파일에 격리한다 —
//     AdminView.userlist-wiring.test.tsx 의 "별도 파일" 선례와 같은 취지. 렌더 0 이라 JSX 불요 →
//     `.ts`(root jest testRegex `.*\.spec\.ts$` 와도 충돌 없음).
// (b) 이 guard 가 막는 결함: T-1166/T-1167 러너는 path(`/api/users/:id/instance-access`)·
//     method(`POST`/`DELETE`)·body 필드명(`instanceRef`)을 web 소스의 문자열 리터럴로 하드코딩한다.
//     기존 web test 는 그 리터럴을 **자기 자신과** 대조할 뿐이라, backend 가 route 를 옮기거나 DTO
//     필드를 rename 하면 web test 는 전부 green 인 채로 런타임 404(경로 소실) / 400(controller 의
//     `whitelist + forbidNonWhitelisted` ValidationPipe 가 미지 키를 거부)이 된다. 여기서는 backend
//     소스에서 계약을 추출해 web 이 **실제로 발사하는** 인자와 대조한다.
//
// (c) T-1170 정밀화(3건, T-1169 reviewer round 1 지적 집행):
//     (1) method decorator 의 **인자까지 파싱**해 base @Controller route 와 합성한다 —
//         `@Post('grant')` 는 `.../instance-access/grant` 로 합성돼 실 route shape 를 재구성한다
//         (인자 없는 `@Post()` 는 base 그대로). 이전엔 인자를 무시해 sub-path 추가가 런타임 404 로
//         빠져도 green 이었다.
//     (2) DTO 필드를 `required`(`!`)/`optional`(`?`) 로 구분해, body 키 대조를 정확-일치가 아니라
//         **`fired ⊆ declared`(초과 키 없음 — forbidNonWhitelisted 근거) AND `required ⊆ fired`
//         (필수 누락 없음)** 부분집합으로 완화한다. 이는 assertion 약화가 아니라 계약 정정이다 —
//         backend 가 하위호환 optional 필드를 추가해도 web 이 유효하면 통과시켜 정상 진화의 오탐을
//         제거한다(초과·누락은 여전히 fail).
//     (3) `options.body` 부재 시 `JSON.parse(String(undefined))` 로 SyntaxError 를 던지지 않고
//         **빈 키 집합** 으로 매핑해, 실패가 "body 필수 누락" 으로 명확히 떨어지게 한다.
//
// 추출기는 공용 helper 로 빼지 않고 본 파일 로컬 함수로 둔다(사용처 1곳 — YAGNI). AST 파서 대신
// 문자열/정규식만 쓰고(새 devDependency 0) 주석을 먼저 제거해 false-positive 를 막는다.

import type { RequestOptions } from '../api/apiClient';
import type { GrantInstanceAccessDeps, RevokeInstanceAccessDeps } from './AdminView';
import {
  buildInstanceAccessPath,
  runGrantInstanceAccess,
  runRevokeInstanceAccess,
} from './AdminView';
// 공용 invariant 추출기(T-1201 신설) import — inline 복사본 삭제·동작 무변경(T-1228 이관 slice).
// 공용과 글자-동일한 3종만 import. handler 추출기 family(extractHandlerMethods·extractDtoFields)·
// per-spec 발사기/타입·변형 composeRoute(const base) 는 inline 유지.
import {
  extractControllerRoute,
  normalizeRoute,
  stripComments,
} from './__contract-guard__/contract-extractors';

// ── backend 계약 추출기(로컬) ───────────────────────────────────────────────────────────────
// method decorator 1건 — HTTP method 와 그 인자 sub-path(`@Post('grant')` 의 `'grant'`; 인자
// 없으면 `''`). Follow-up (1): 인자를 route 합성에 써야 실 route shape 를 재구성한다.
interface HandlerDecorator {
  method: string;
  subPath: string;
}

// handler 이름 → {method, subPath} 매핑(`grant` → {POST, ''}). decorator 없는 handler 는 미수록.
function extractHandlerMethods(source: string): Record<string, HandlerDecorator> {
  const found: Record<string, HandlerDecorator> = {};
  let pending: HandlerDecorator | null = null;
  for (const line of stripComments(source).split('\n')) {
    // 인자 없는 `@Post()` 는 subPath ''(그룹 미매칭), `@Post('grant')` 는 'grant' 를 캡처한다.
    const decorator = /^[ \t]*@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:['"`]([^'"`]*)['"`]\s*)?\)/.exec(line);
    if (decorator) {
      pending = { method: decorator[1].toUpperCase(), subPath: decorator[2] ?? '' };
      continue;
    }
    // 그 외 decorator(@HttpCode/@UseGuards/@Roles …)는 handler 로 오인하지 않고 건너뛴다.
    if (/^[ \t]*@/.test(line)) {
      continue;
    }
    const handler = /^[ \t]*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(line);
    if (handler && pending) {
      found[handler[1]] = pending;
      pending = null;
    }
  }
  return found;
}

// DTO 필드 집합 — `required`(`instanceRef!` 또는 표기 없음)와 `optional`(`note?`) 로 나눈다.
// Follow-up (2): 부분집합 대조의 입력. 클래스가 없으면 둘 다 빈 집합.
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

// ── 대조기(로컬) ───────────────────────────────────────────────────────────────────────────
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
}

// base route 에 handler decorator 인자(sub-path)를 합성한다 — Follow-up (1). subPath 가 비면
// base 그대로, 있으면 `<base>/<subPath>`(중복 `/` 정리).
function composeRoute(route: string, subPath: string): string {
  const base = normalizeRoute(route);
  const trimmed = subPath.replace(/^\//, '');
  return trimmed ? `${base}/${trimmed}` : base;
}

// backend route 의 `:id` 자리에 사용자 id 를 넣은 기대 path(선행 `/` 유무 차이만 정규화).
function expectedPath(route: string, subPath: string, userId: string): string {
  return composeRoute(route, subPath).replace(':id', encodeURIComponent(userId));
}

// 불일치 사유 목록을 돌려준다 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과가 아니라 사유 1건이다.
function diffContract(fire: WebFire, backend: BackendContract, userId: string): string[] {
  const declaredCount = backend.required.size + backend.optional.size;
  if (!backend.route || !backend.method || declaredCount === 0) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== expectedPath(backend.route, backend.subPath, userId)) {
    issues.push(`path 불일치: ${fire.path}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  // Follow-up (2) 부분집합 대조: 초과 키(fired ⊄ declared) — forbidNonWhitelisted 400 예방.
  const declared = new Set([...backend.required, ...backend.optional]);
  const extras = [...fire.bodyKeys].filter((key) => !declared.has(key)).sort();
  if (extras.length > 0) {
    issues.push(`body 초과 키: ${extras.join(',')}`);
  }
  // 필수 누락(required ⊄ fired) — DTO @IsNotEmpty 검증 실패(400) 예방.
  const missing = [...backend.required].filter((key) => !fire.bodyKeys.has(key)).sort();
  if (missing.length > 0) {
    issues.push(`body 필수 누락: ${missing.join(',')}`);
  }
  return issues;
}

// ── 실제 소스 로드 + web 발사 캡처 harness ─────────────────────────────────────────────────
const CONTROLLER_SOURCE = readFileSync(
  new URL('../../../src/user-instance-access/user-instance-access.controller.ts', import.meta.url),
  'utf8',
);
const DTO_SOURCE = readFileSync(
  new URL('../../../src/user-instance-access/grant-instance-access.dto.ts', import.meta.url),
  'utf8',
);

const ROUTE = extractControllerRoute(CONTROLLER_SOURCE);
const HANDLER_METHODS = extractHandlerMethods(CONTROLLER_SOURCE);
const DTO_FIELDS = extractDtoFields(DTO_SOURCE, 'GrantInstanceAccessDto');
const GRANT_HANDLER = HANDLER_METHODS.grant ?? null;
const REVOKE_HANDLER = HANDLER_METHODS.revoke ?? null;
const GRANT_CONTRACT: BackendContract = {
  route: ROUTE,
  method: GRANT_HANDLER?.method ?? null,
  subPath: GRANT_HANDLER?.subPath ?? '',
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};
const REVOKE_CONTRACT: BackendContract = {
  route: ROUTE,
  method: REVOKE_HANDLER?.method ?? null,
  subPath: REVOKE_HANDLER?.subPath ?? '',
  required: DTO_FIELDS.required,
  optional: DTO_FIELDS.optional,
};

const USER_ID = 'u-1';
const INSTANCE = 'https://gerrit.example.com';

// Follow-up (3): options.body 부재/undefined 는 SyntaxError 대신 빈 키 집합으로 매핑한다.
function toFire(path: string, options: RequestOptions): WebFire {
  const bodyKeys = new Set<string>();
  if (options.body !== undefined && options.body !== null) {
    const parsed = JSON.parse(String(options.body)) as Record<string, unknown>;
    for (const key of Object.keys(parsed)) {
      bodyKeys.add(key);
    }
  }
  return { path, method: String(options.method), bodyKeys };
}

// 러너를 mock deps 로 직접 호출해 **실제 발사 인자** 를 캡처한다(ADR-0040 §5 — RTL/jsdom 없음).
async function fireGrant(userId: string): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: GrantInstanceAccessDeps = {
    grant: async (path, options) => {
      fired = toFire(path, options);
    },
    describeError: () => '',
    isConflict: () => false,
    granting: false,
    setGranting: () => {},
    setGrantError: () => {},
    setGrantNotice: () => {},
    resetInput: () => {},
  };
  await runGrantInstanceAccess(userId, INSTANCE, deps);
  if (!fired) {
    throw new Error('부여 러너가 발사하지 않았다');
  }
  return fired;
}

async function fireRevoke(userId: string): Promise<WebFire> {
  let fired: WebFire | undefined;
  const deps: RevokeInstanceAccessDeps = {
    revoke: async (path, options) => {
      fired = toFire(path, options);
    },
    describeError: () => '',
    revoking: false,
    setRevoking: () => {},
    setRevokeError: () => {},
    setRevokeNotice: () => {},
    resetInput: () => {},
  };
  await runRevokeInstanceAccess(userId, INSTANCE, deps);
  if (!fired) {
    throw new Error('회수 러너가 발사하지 않았다');
  }
  return fired;
}

describe('AdminView — 인스턴스 접근 web↔backend 계약 drift guard (T-1169/T-1170)', () => {
  // error path — 추출기가 깨지면 대조가 "전부 통과" 로 보이므로, 추출 결과 자체를 먼저 못박는다.
  it('backend route / method / DTO 필드 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(GRANT_CONTRACT.method).not.toBeNull();
    expect(REVOKE_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.required.size).toBeGreaterThan(0);
  });

  // 현재 backend 는 인자 없는 decorator(@Post()/@Delete()) 라 subPath 는 '' 여야 한다(base route).
  it('현재 backend grant/revoke decorator 는 인자 없이 base route 를 그대로 쓴다 (Follow-up (1) — base)', () => {
    expect(GRANT_CONTRACT.subPath).toBe('');
    expect(REVOKE_CONTRACT.subPath).toBe('');
    expect(composeRoute(String(ROUTE), '')).toBe(normalizeRoute(String(ROUTE)));
  });

  // happy-path — web 이 조립하는 path 가 backend route 의 `:id` 치환형과 같다.
  it('buildInstanceAccessPath 가 backend @Controller route 의 :id 치환형과 같다 (happy-path)', () => {
    expect(buildInstanceAccessPath(USER_ID)).toBe(expectedPath(String(ROUTE), '', USER_ID));
  });

  // 분기 cover(grant 방향) — POST 발사가 backend grant decorator 계약과 완전 일치.
  it('부여 발사(POST)가 backend grant handler 계약과 일치한다 (happy-path — grant 방향)', async () => {
    expect(diffContract(await fireGrant(USER_ID), GRANT_CONTRACT, USER_ID)).toEqual([]);
  });

  // 분기 cover(revoke 방향) — DELETE 발사가 backend revoke decorator 계약과 완전 일치.
  it('회수 발사(DELETE)가 backend revoke handler 계약과 일치한다 (happy-path — revoke 방향)', async () => {
    expect(diffContract(await fireRevoke(USER_ID), REVOKE_CONTRACT, USER_ID)).toEqual([]);
  });

  // ADR-0027 §2 — grant/revoke 는 같은 path·같은 DTO(=같은 body shape) 를 쓰고 method 만 다르다.
  it('부여·회수가 같은 path 와 같은 body 키 집합을 쓰고 method 만 다르다 (ADR-0027 §2 단일 DTO 공유)', async () => {
    const grant = await fireGrant(USER_ID);
    const revoke = await fireRevoke(USER_ID);
    expect(grant.path).toBe(revoke.path);
    expect([...grant.bodyKeys].sort()).toEqual([...revoke.bodyKeys].sort());
    expect(grant.method).not.toBe(revoke.method);
  });

  // 현재 상태(단일 required 필드)에서 web 발사 body 는 declared 부분집합 계약을 만족한다.
  it.each<[string, (userId: string) => Promise<WebFire>]>([
    ['부여', fireGrant],
    ['회수', fireRevoke],
  ])('%s body 키가 declared 부분집합 계약을 만족한다(초과 0 · 필수 누락 0)', async (_label, fire) => {
    const fired = await fire(USER_ID);
    const declared = new Set([...DTO_FIELDS.required, ...DTO_FIELDS.optional]);
    expect([...fired.bodyKeys].every((key) => declared.has(key))).toBe(true);
    expect([...DTO_FIELDS.required].every((key) => fired.bodyKeys.has(key))).toBe(true);
  });

  // ── Follow-up (1) — decorator 인자 합성 분기 ──────────────────────────────────────────────
  // 인자 있음(sub-path 합성): `@Post('grant')` 는 `.../instance-access/grant` 로 합성된다.
  it('method decorator 인자 @Post(\'grant\') 를 파싱해 base route 와 합성한다 (Follow-up (1) — 인자 있음)', () => {
    const fake = ["  @Post('grant')", '  async grant() {}'].join('\n');
    const handler = extractHandlerMethods(fake).grant;
    expect(handler).toEqual({ method: 'POST', subPath: 'grant' });
    expect(composeRoute(String(ROUTE), handler.subPath)).toBe(`${normalizeRoute(String(ROUTE))}/grant`);
  });

  // negative (a) — backend 가 sub-path(@Post('grant')) 를 붙였는데 web 은 base path 로 발사 → 불일치.
  it('backend 가 @Post(\'grant\') sub-path 를 붙였는데 web 은 base path 로 발사하면 path 불일치로 잡힌다 (negative — sub-path drift, 런타임 404 예방)', async () => {
    const fake = ["  @Post('grant')", '  async grant() {}'].join('\n');
    const handler = extractHandlerMethods(fake).grant;
    const drifted: BackendContract = { ...GRANT_CONTRACT, method: handler.method, subPath: handler.subPath };
    expect(diffContract(await fireGrant(USER_ID), drifted, USER_ID)).toEqual([
      expect.stringContaining('path 불일치'),
    ]);
  });

  // ── Follow-up (2) — 부분집합 대조 분기 ───────────────────────────────────────────────────
  // negative (b) — web 이 declared 에 없는 초과 키를 보내면 fired ⊄ declared 위반으로 fail.
  it('web 이 DTO 에 없는 초과 키(instance_ref 오타 등)를 보내면 body 초과 키로 잡힌다 (negative — forbidNonWhitelisted 400 예방)', async () => {
    const fired = await fireGrant(USER_ID);
    const drifted: WebFire = { ...fired, bodyKeys: new Set([...fired.bodyKeys, 'instance_ref']) };
    expect(diffContract(drifted, GRANT_CONTRACT, USER_ID)).toEqual([
      expect.stringContaining('body 초과 키'),
    ]);
  });

  // negative (c) — web 이 required 필드를 누락하면 required ⊄ fired 위반으로 fail.
  it('web 이 required instanceRef 를 누락하면 body 필수 누락으로 잡힌다 (negative — @IsNotEmpty 400 예방)', async () => {
    const fired = await fireGrant(USER_ID);
    const drifted: WebFire = { ...fired, bodyKeys: new Set<string>() };
    expect(diffContract(drifted, GRANT_CONTRACT, USER_ID)).toEqual([
      expect.stringContaining('body 필수 누락'),
    ]);
  });

  // negative (d) — backend 가 하위호환 optional 필드를 추가해도 web 발사는 유효 → 통과(오탐 제거).
  it('backend 가 하위호환 optional 필드(note?)를 추가해도 web 의 기존 발사는 유효해 통과한다 (negative — 정상 진화 오탐 제거)', async () => {
    const withOptional: BackendContract = { ...GRANT_CONTRACT, optional: new Set(['note']) };
    expect(diffContract(await fireGrant(USER_ID), withOptional, USER_ID)).toEqual([]);
  });

  // extractDtoFields 가 required(`!`)/optional(`?`) 를 실제로 구분하는지 직접 못박는다.
  it('extractDtoFields 가 instanceRef!(required) 와 note?(optional) 를 분리한다 (Follow-up (2) — 표기 구분)', () => {
    const fake = 'class D {\n  @IsString()\n  instanceRef!: string;\n  note?: string;\n}';
    const fields = extractDtoFields(fake, 'D');
    expect([...fields.required]).toEqual(['instanceRef']);
    expect([...fields.optional]).toEqual(['note']);
  });

  // ── Follow-up (3) — body 미전송 진단 분기 ────────────────────────────────────────────────
  // options.body 부재면 SyntaxError 없이 빈 키 집합으로 매핑된다.
  it('options.body 부재면 JSON.parse SyntaxError 없이 빈 키 집합으로 매핑된다 (Follow-up (3) — body 부재)', () => {
    const fire = toFire(buildInstanceAccessPath(USER_ID), { method: 'POST' } as RequestOptions);
    expect(fire.bodyKeys.size).toBe(0);
  });

  // negative (e) — body 부재 발사는 SyntaxError 가 아니라 "body 필수 누락" 으로 명확히 판정된다.
  it('body 부재 발사는 SyntaxError 없이 body 필수 누락으로 판정된다 (negative — body 부재 진단)', () => {
    const fire = toFire(buildInstanceAccessPath(USER_ID), { method: 'POST' } as RequestOptions);
    expect(diffContract(fire, GRANT_CONTRACT, USER_ID)).toEqual([
      expect.stringContaining('body 필수 누락'),
    ]);
  });

  // ── 기존 T-1169 계약 회귀 방어(유효 assertion 유지) ───────────────────────────────────────
  // negative — backend route 가 옮겨진 가짜 소스면 대조가 path 불일치를 보고한다(런타임 404 예방).
  it('backend route 가 달라진 가짜 소스에 대해 path 불일치를 보고한다 (negative — route 이동)', async () => {
    const fake = '@Controller("api/users/:id/instances")\nexport class C {}\n';
    const drifted: BackendContract = { ...GRANT_CONTRACT, route: extractControllerRoute(fake) };
    expect(drifted.route).toBe('api/users/:id/instances');
    expect(diffContract(await fireGrant(USER_ID), drifted, USER_ID)).toEqual([
      expect.stringContaining('path 불일치'),
    ]);
  });

  // negative — grant/revoke decorator 가 뒤바뀐 가짜 소스면 method 불일치로 판정된다.
  it('grant/revoke method 가 뒤바뀐 가짜 소스를 불일치로 판정한다 (negative — POST↔DELETE swap)', async () => {
    const fake = ['  @Delete()', '  async grant() {}', '  @Post()', '  async revoke() {}'].join('\n');
    const swapped = extractHandlerMethods(fake);
    expect(swapped).toEqual({ grant: { method: 'DELETE', subPath: '' }, revoke: { method: 'POST', subPath: '' } });
    const drifted: BackendContract = { ...GRANT_CONTRACT, method: swapped.grant.method };
    expect(diffContract(await fireGrant(USER_ID), drifted, USER_ID)).toEqual([
      expect.stringContaining('method 불일치'),
    ]);
  });

  // negative — id 에 `/` · 공백 등이 섞여도 encodeURIComponent 로 안전 조립된다(경로 주입 방어).
  it.each([
    ['슬래시', 'a/../b'],
    ['공백', 'u 1'],
    ['물음표', 'u?x=1'],
  ])('사용자 id 의 %s 를 encodeURIComponent 로 escape 해 path 를 조립한다 (negative — 경로 주입)', async (_label, rawId) => {
    const fired = await fireGrant(rawId);
    expect(fired.path).toBe(expectedPath(String(ROUTE), '', rawId));
    expect(fired.path).toBe(buildInstanceAccessPath(rawId));
    // 사용자 입력이 path segment 경계를 새로 만들지 못한다 — segment 수가 원본 route 와 같다.
    expect(fired.path.split('/').length).toBe(normalizeRoute(String(ROUTE)).split('/').length);
    expect(diffContract(fired, GRANT_CONTRACT, rawId)).toEqual([]);
  });

  // negative (f) — 주석 줄에만 method 문구가 있고 decorator 가 없으면 추출은 실패해야 한다.
  it('주석 줄의 "POST /api/users/:id/instance-access" 를 method 로 오인하지 않는다 (negative — 주석 false-positive)', async () => {
    const fake = ['  // POST /api/users/:id/instance-access — 주석뿐, decorator 없음', '  async grant() {}'].join('\n');
    expect(extractHandlerMethods(fake).grant).toBeUndefined();
    const drifted: BackendContract = { ...GRANT_CONTRACT, method: extractHandlerMethods(fake).grant?.method ?? null };
    expect(diffContract(await fireGrant(USER_ID), drifted, USER_ID)).toEqual(['backend 계약 추출 실패']);
  });

  // negative — 빈 소스면 추출기가 null / 빈 집합을 돌려주고 대조는 통과하지 않는다.
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    const emptyFields = extractDtoFields('', 'GrantInstanceAccessDto');
    expect(emptyFields.required.size).toBe(0);
    expect(emptyFields.optional.size).toBe(0);
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').grant?.method ?? null,
      subPath: '',
      required: emptyFields.required,
      optional: emptyFields.optional,
    };
    expect(diffContract(await fireGrant(USER_ID), empty, USER_ID)).toEqual(['backend 계약 추출 실패']);
  });
});
