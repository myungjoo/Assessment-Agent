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
// 추출기는 공용 helper 로 빼지 않고 본 파일 로컬 함수로 둔다(사용처 1곳 — YAGNI). AST 파서 대신
// 문자열/정규식만 쓰고(새 devDependency 0) 주석을 먼저 제거해 false-positive 를 막는다.

import type { RequestOptions } from '../api/apiClient';
import type { GrantInstanceAccessDeps, RevokeInstanceAccessDeps } from './AdminView';
import {
  buildInstanceAccessPath,
  runGrantInstanceAccess,
  runRevokeInstanceAccess,
} from './AdminView';

// ── backend 계약 추출기(로컬) ───────────────────────────────────────────────────────────────
// 줄 주석 / 블록 주석 제거 — 추출이 주석 문구를 잡으면 guard 가 무력해진다(아래 negative (e)).
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

// `@Controller("api/users/:id/instance-access")` 의 인자 route. 없으면 null.
function extractControllerRoute(source: string): string | null {
  const matched = /^[ \t]*@Controller\(\s*['"`]([^'"`]+)['"`]\s*\)/m.exec(stripComments(source));
  return matched ? matched[1] : null;
}

// handler 이름 → HTTP method decorator 매핑(`grant` → `POST`). decorator 없는 handler 는 미수록.
function extractHandlerMethods(source: string): Record<string, string> {
  const found: Record<string, string> = {};
  let pending: string | null = null;
  for (const line of stripComments(source).split('\n')) {
    const decorator = /^[ \t]*@(Get|Post|Put|Patch|Delete)\s*\(/.exec(line);
    if (decorator) {
      pending = decorator[1].toUpperCase();
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

// DTO 클래스 본문의 필드명 집합(`instanceRef`). 클래스가 없으면 빈 집합.
function extractDtoFields(source: string, className: string): Set<string> {
  const body = new RegExp(`class\\s+${className}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(stripComments(source));
  const fields = new Set<string>();
  if (!body) {
    return fields;
  }
  for (const line of body[1].split('\n')) {
    if (/^[ \t]*@/.test(line)) {
      continue;
    }
    const field = /^[ \t]*(?:readonly\s+)?([A-Za-z_$][\w$]*)[!?]?\s*[:=]/.exec(line);
    if (field) {
      fields.add(field[1]);
    }
  }
  return fields;
}

// ── 대조기(로컬) ───────────────────────────────────────────────────────────────────────────
interface BackendContract {
  route: string | null;
  method: string | null;
  fields: Set<string>;
}

interface WebFire {
  path: string;
  method: string;
  bodyKeys: Set<string>;
}

const normalizeRoute = (route: string): string => (route.startsWith('/') ? route : `/${route}`);

// backend route 의 `:id` 자리에 사용자 id 를 넣은 기대 path(선행 `/` 유무 차이만 정규화).
function expectedPath(route: string, userId: string): string {
  return normalizeRoute(route).replace(':id', encodeURIComponent(userId));
}

// 불일치 사유 목록을 돌려준다 — 빈 배열이 곧 "계약 일치". 추출 실패도 통과가 아니라 사유 1건이다.
function diffContract(fire: WebFire, backend: BackendContract, userId: string): string[] {
  if (!backend.route || !backend.method || backend.fields.size === 0) {
    return ['backend 계약 추출 실패'];
  }
  const issues: string[] = [];
  if (fire.path !== expectedPath(backend.route, userId)) {
    issues.push(`path 불일치: ${fire.path}`);
  }
  if (fire.method !== backend.method) {
    issues.push(`method 불일치: ${fire.method}`);
  }
  const fired = [...fire.bodyKeys].sort().join(',');
  const declared = [...backend.fields].sort().join(',');
  if (fired !== declared) {
    issues.push(`body 키 불일치: ${fired} ≠ ${declared}`);
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
const GRANT_CONTRACT: BackendContract = { route: ROUTE, method: HANDLER_METHODS.grant ?? null, fields: DTO_FIELDS };
const REVOKE_CONTRACT: BackendContract = { route: ROUTE, method: HANDLER_METHODS.revoke ?? null, fields: DTO_FIELDS };

const USER_ID = 'u-1';
const INSTANCE = 'https://gerrit.example.com';

function toFire(path: string, options: RequestOptions): WebFire {
  const parsed = JSON.parse(String(options.body)) as Record<string, unknown>;
  return { path, method: String(options.method), bodyKeys: new Set(Object.keys(parsed)) };
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

describe('AdminView — 인스턴스 접근 web↔backend 계약 drift guard (T-1169)', () => {
  // error path — 추출기가 깨지면 대조가 "전부 통과" 로 보이므로, 추출 결과 자체를 먼저 못박는다.
  it('backend route / method / DTO 필드 추출이 하나도 비어있지 않다 (error path — 추출기 무력화 방어)', () => {
    expect(ROUTE).not.toBeNull();
    expect(ROUTE).not.toBe('');
    expect(GRANT_CONTRACT.method).not.toBeNull();
    expect(REVOKE_CONTRACT.method).not.toBeNull();
    expect(DTO_FIELDS.size).toBeGreaterThan(0);
  });

  // happy-path — web 이 조립하는 path 가 backend route 의 `:id` 치환형과 같다.
  it('buildInstanceAccessPath 가 backend @Controller route 의 :id 치환형과 같다 (happy-path)', () => {
    expect(buildInstanceAccessPath(USER_ID)).toBe(expectedPath(String(ROUTE), USER_ID));
  });

  // 분기 cover(grant 방향) — POST 발사가 backend grant decorator 계약과 완전 일치.
  it('부여 발사(POST)가 backend grant handler 계약과 일치한다 (분기 — grant 방향)', async () => {
    expect(diffContract(await fireGrant(USER_ID), GRANT_CONTRACT, USER_ID)).toEqual([]);
  });

  // 분기 cover(revoke 방향) — DELETE 발사가 backend revoke decorator 계약과 완전 일치.
  it('회수 발사(DELETE)가 backend revoke handler 계약과 일치한다 (분기 — revoke 방향)', async () => {
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

  // body 키 집합 정확 일치 — 부족(400 검증 실패)도 초과(forbidNonWhitelisted 400)도 허용 안 된다.
  it.each<[string, (userId: string) => Promise<WebFire>]>([
    ['부여', fireGrant],
    ['회수', fireRevoke],
  ])('%s body 키 집합이 GrantInstanceAccessDto 필드 집합과 정확히 같다', async (_label, fire) => {
    const fired = await fire(USER_ID);
    expect([...fired.bodyKeys].sort()).toEqual([...DTO_FIELDS].sort());
  });

  // negative (a) — web 이 필드명을 snake_case 로 바꾼 가짜 발사는 대조에서 반드시 fail 한다.
  it('body 필드명이 instance_ref 로 바뀐 가짜 발사는 대조에서 불일치로 잡힌다 (negative — DTO 필드 rename)', async () => {
    const fired = await fireGrant(USER_ID);
    const drifted: WebFire = { ...fired, bodyKeys: new Set(['instance_ref']) };
    expect(diffContract(drifted, GRANT_CONTRACT, USER_ID)).toEqual([expect.stringContaining('body 키 불일치')]);
  });

  // negative (b) — backend route 가 옮겨진 가짜 소스면 대조가 path 불일치를 보고한다(런타임 404 예방).
  it('backend route 가 달라진 가짜 소스에 대해 path 불일치를 보고한다 (negative — route 이동)', async () => {
    const fake = '@Controller("api/users/:id/instances")\nexport class C {}\n';
    const drifted: BackendContract = { ...GRANT_CONTRACT, route: extractControllerRoute(fake) };
    expect(drifted.route).toBe('api/users/:id/instances');
    expect(diffContract(await fireGrant(USER_ID), drifted, USER_ID)).toEqual([
      expect.stringContaining('path 불일치'),
    ]);
  });

  // negative (c) — grant/revoke decorator 가 뒤바뀐 가짜 소스면 method 불일치로 판정된다.
  it('grant/revoke method 가 뒤바뀐 가짜 소스를 불일치로 판정한다 (negative — POST↔DELETE swap)', async () => {
    const fake = ['  @Delete()', '  async grant() {}', '  @Post()', '  async revoke() {}'].join('\n');
    const swapped = extractHandlerMethods(fake);
    expect(swapped).toEqual({ grant: 'DELETE', revoke: 'POST' });
    const drifted: BackendContract = { ...GRANT_CONTRACT, method: swapped.grant };
    expect(diffContract(await fireGrant(USER_ID), drifted, USER_ID)).toEqual([
      expect.stringContaining('method 불일치'),
    ]);
  });

  // negative (d) — id 에 `/` · 공백 등이 섞여도 encodeURIComponent 로 안전 조립된다(경로 주입 방어).
  it.each([
    ['슬래시', 'a/../b'],
    ['공백', 'u 1'],
    ['물음표', 'u?x=1'],
  ])('사용자 id 의 %s 를 encodeURIComponent 로 escape 해 path 를 조립한다 (negative — 경로 주입)', async (_label, rawId) => {
    const fired = await fireGrant(rawId);
    expect(fired.path).toBe(expectedPath(String(ROUTE), rawId));
    expect(fired.path).toBe(buildInstanceAccessPath(rawId));
    // 사용자 입력이 path segment 경계를 새로 만들지 못한다 — segment 수가 원본 route 와 같다.
    expect(fired.path.split('/').length).toBe(normalizeRoute(String(ROUTE)).split('/').length);
    expect(diffContract(fired, GRANT_CONTRACT, rawId)).toEqual([]);
  });

  // negative (e) — 주석 줄에만 method 문구가 있고 decorator 가 없으면 추출은 실패해야 한다.
  it('주석 줄의 "POST /api/users/:id/instance-access" 를 method 로 오인하지 않는다 (negative — 주석 false-positive)', async () => {
    const fake = ['  // POST /api/users/:id/instance-access — 주석뿐, decorator 없음', '  async grant() {}'].join('\n');
    expect(extractHandlerMethods(fake).grant).toBeUndefined();
    const drifted: BackendContract = { ...GRANT_CONTRACT, method: extractHandlerMethods(fake).grant ?? null };
    expect(diffContract(await fireGrant(USER_ID), drifted, USER_ID)).toEqual(['backend 계약 추출 실패']);
  });

  // negative (f) — 빈 소스면 추출기가 null / 빈 집합을 돌려주고 대조는 통과하지 않는다.
  it('빈 소스 입력이면 추출기가 null·빈 집합을 반환하고 대조가 통과하지 않는다 (negative — 소스 유실)', async () => {
    expect(extractControllerRoute('')).toBeNull();
    expect(extractHandlerMethods('')).toEqual({});
    expect(extractDtoFields('', 'GrantInstanceAccessDto').size).toBe(0);
    const empty: BackendContract = {
      route: extractControllerRoute(''),
      method: extractHandlerMethods('').grant ?? null,
      fields: extractDtoFields('', 'GrantInstanceAccessDto'),
    };
    expect(diffContract(await fireGrant(USER_ID), empty, USER_ID)).toEqual(['backend 계약 추출 실패']);
  });
});
