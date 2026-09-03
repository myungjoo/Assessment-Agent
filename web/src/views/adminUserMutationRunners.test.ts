import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/apiClient';

// R-112 — T-1872 순수 추출로 신설된 모듈의 **경계 spec**. runCreateUser 의 backend 계약 대조와
// describeCreateUserFailure(Lines) 의 축별 사유 문구 검증은 이미
// AdminView.create-user-contract.test.ts · AdminView.create-user-failure.test.ts 가
// `from './AdminView'` 경로로 cover 하고 있어 여기서 그것을 복제하지 않는다. 본 파일이 검증하는
// 것은 그 spec 들이 볼 수 없는 **새 모듈 자신의 공개 표면** 이다 — 즉 (a) 값 심볼이 새 모듈에서
// 직접 import 되는가, (b) AdminView 재수출을 거치지 않은 직접 import 경로에서도 러너의 정상 /
// 실패 / 미발사 계약이 같은가, (c) 재수출본과 직접 import 본이 **동일 함수 참조** 인가(기존 계약
// spec 들의 위임 검증이 이동 후에도 계속 유효함의 근거). 이동 전에는 존재할 수 없던 검증이라
// 기존 spec 과 중복이 아니다(adminScheduleRunners.test.ts 선례 동형).
import {
  CREATE_USER_ERROR_LINE_CLASS,
  CREATE_USER_ERROR_SEPARATOR,
  USERS_PATH,
  USER_DUPLICATE_ERROR,
  describeCreateUserFailure,
  describeCreateUserFailureLines,
  hasCreateUserErrorLines,
  runCreateUser,
} from './adminUserMutationRunners';
import type { CreateUserDeps } from './adminUserMutationRunners';
import {
  CREATE_USER_ERROR_LINE_CLASS as reexportedLineClass,
  describeCreateUserFailure as reexportedDescribeCreateUserFailure,
  describeCreateUserFailureLines as reexportedDescribeCreateUserFailureLines,
  hasCreateUserErrorLines as reexportedHasCreateUserErrorLines,
  runCreateUser as reexportedRunCreateUser,
} from './AdminView';

const EMAIL = 'new@example.com';
const PASSWORD = 'pw12345678';

// class-validator 400 응답 body 원문 형태(NestJS ValidationPipe 기본 shape).
function validationBody(messages: string[]): string {
  return JSON.stringify({
    message: messages,
    error: 'Bad Request',
    statusCode: 400,
  });
}

// 400 두 축 위반이 만드는 사유 줄 2 개 — 줄 배열 축과 join 파생 축이 같은 값을 쓰는지 대조한다.
const TWO_AXIS_BODY = validationBody([
  'email must be an email',
  'password should not be empty',
]);
const TWO_AXIS_LINES = [
  '아이디: 아이디는 email 형식이어야 합니다 (예: admin@example.com).',
  '비밀번호: 비밀번호를 입력해 주세요 — 빈 값은 사용할 수 없습니다.',
];

interface Harness {
  deps: CreateUserDeps;
  calls: { path: string; options: unknown }[];
  errors: (string | undefined)[];
  lines: (string[] | undefined)[];
  creatingLog: boolean[];
  bumped: number;
  reset: number;
  describeCalls: number;
}

// 러너가 요구하는 deps 를 결정적 stub 으로 채운다. 옵션으로 실패 주입 · 409 분기 · in-flight ·
// 줄 배열 축 미주입(optional 필드 부재)을 갈아끼워 분기마다 같은 harness 를 재사용한다.
function makeHarness(options?: {
  failWith?: unknown;
  conflict?: boolean;
  creating?: boolean;
  withLines?: boolean;
}): Harness {
  const shouldFail = options !== undefined && 'failWith' in options;
  const withLines = options?.withLines !== false;
  const state: Harness = {
    deps: undefined as unknown as CreateUserDeps,
    calls: [],
    errors: [],
    lines: [],
    creatingLog: [],
    bumped: 0,
    reset: 0,
    describeCalls: 0,
  };
  const deps: CreateUserDeps = {
    create: (path, requestOptions) => {
      state.calls.push({ path, options: requestOptions });
      return shouldFail
        ? Promise.reject(options?.failWith)
        : Promise.resolve(undefined);
    },
    describeError: (e) => {
      state.describeCalls += 1;
      return '문구:' + String(e);
    },
    isConflict: () => options?.conflict === true,
    creating: options?.creating === true,
    setCreating: (next) => {
      state.creatingLog.push(next);
    },
    setCreateError: (next) => {
      state.errors.push(next);
    },
    bumpRefresh: () => {
      state.bumped += 1;
    },
    resetInput: () => {
      state.reset += 1;
    },
  };
  if (withLines) {
    deps.describeErrorLines = (e) => ['줄:' + String(e)];
    deps.setCreateErrorLines = (next) => {
      state.lines.push(next);
    };
  }
  state.deps = deps;
  return state;
}

describe('adminUserMutationRunners — 새 모듈 직접 import 경계 (T-1872)', () => {
  it('happy path — runCreateUser 가 POST /api/users 를 1 회 발사하고 성공 전이를 낸다', async () => {
    const h = makeHarness();

    await runCreateUser(EMAIL, PASSWORD, h.deps);

    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].path).toBe(USERS_PATH);
    expect(USERS_PATH).toBe('/api/users');
    const sent = h.calls[0].options as {
      method: string;
      headers: Record<string, string>;
      body: string;
    };
    expect(sent.method).toBe('POST');
    expect(sent.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(sent.body)).toEqual({ email: EMAIL, password: PASSWORD });
    expect(h.bumped).toBe(1);
    expect(h.reset).toBe(1);
    expect(h.creatingLog).toEqual([true, false]);
  });

  it('happy path — describeCreateUserFailureLines 가 400 이 아닌 입력에 toErrorMessage 1 줄을 준다', () => {
    expect(describeCreateUserFailureLines(new ApiError(500, 'boom'))).toEqual([
      'HTTP 500: boom',
    ]);
    expect(describeCreateUserFailureLines(new ApiError(0, 'offline'))).toEqual([
      '네트워크 오류: offline',
    ]);
  });

  it('error path — create 가 reject 해도 throw 0 이고 finally 가 진행 off 를 보장한다', async () => {
    const h = makeHarness({ failWith: new Error('boom') });

    await expect(
      runCreateUser(EMAIL, PASSWORD, h.deps),
    ).resolves.toBeUndefined();

    expect(h.errors).toEqual([undefined, '문구:Error: boom']);
    expect(h.creatingLog).toEqual([true, false]);
  });

  it('분기 — 409(isConflict true)는 USER_DUPLICATE_ERROR 1 줄로 갈린다', async () => {
    const h = makeHarness({
      failWith: new ApiError(409, 'dup'),
      conflict: true,
    });

    await runCreateUser(EMAIL, PASSWORD, h.deps);

    expect(h.errors).toEqual([undefined, USER_DUPLICATE_ERROR]);
    expect(h.lines).toEqual([undefined, [USER_DUPLICATE_ERROR]]);
    // 중복 축은 describeError 를 타지 않는다(형식 · 길이 어휘와 섞이지 않음 — REQ-069).
    expect(h.describeCalls).toBe(0);
  });

  it('분기 — 400 ApiError 는 축별 사유 줄들로, 그 외는 파생 1 줄로 갈린다', () => {
    expect(
      describeCreateUserFailureLines(new ApiError(400, TWO_AXIS_BODY)),
    ).toEqual(TWO_AXIS_LINES);
    // 단일 문자열 파생은 같은 줄들을 구분자로 이은 값이다(join 계약 등가).
    expect(describeCreateUserFailure(new ApiError(400, TWO_AXIS_BODY))).toBe(
      TWO_AXIS_LINES.join(CREATE_USER_ERROR_SEPARATOR),
    );
    expect(CREATE_USER_ERROR_SEPARATOR).toBe(' / ');
    // 400 이 아닌 표면은 줄 1 개라 구분자가 끼어들지 않는다.
    expect(describeCreateUserFailure(new ApiError(503, 'down'))).toBe(
      'HTTP 503: down',
    );
  });

  it('분기 — describeErrorLines 주입 유무로 줄 배열 출처가 갈린다', async () => {
    const injected = makeHarness({ failWith: new Error('boom') });
    await runCreateUser(EMAIL, PASSWORD, injected.deps);
    expect(injected.lines).toEqual([undefined, ['줄:Error: boom']]);

    // optional 축 미주입 — setCreateErrorLines 자체가 없어 optional chaining 이 no-op 이고,
    // 문자열 축만 표면화되며 throw 0 이다(기존 deps literal 하위 호환).
    const bare = makeHarness({ failWith: new Error('boom'), withLines: false });
    await expect(
      runCreateUser(EMAIL, PASSWORD, bare.deps),
    ).resolves.toBeUndefined();
    expect(bare.lines).toEqual([]);
    expect(bare.errors).toEqual([undefined, '문구:Error: boom']);
  });

  it('negative ① — 빈 email(공백만 포함)이면 미발사 · 상태 전이 0', async () => {
    const blank = makeHarness();
    await runCreateUser('', PASSWORD, blank.deps);
    const spaces = makeHarness();
    await runCreateUser('   ', PASSWORD, spaces.deps);

    for (const h of [blank, spaces]) {
      expect(h.calls).toHaveLength(0);
      expect(h.creatingLog).toEqual([]);
      expect(h.errors).toEqual([]);
      expect(h.bumped).toBe(0);
    }
  });

  it('negative ② — 빈 password 면 미발사 · 상태 전이 0', async () => {
    const h = makeHarness();

    await runCreateUser(EMAIL, '', h.deps);

    expect(h.calls).toHaveLength(0);
    expect(h.creatingLog).toEqual([]);
    expect(h.errors).toEqual([]);
  });

  it('negative ③ — creating: true 재호출은 이중 POST 0', async () => {
    const h = makeHarness({ creating: true });

    await runCreateUser(EMAIL, PASSWORD, h.deps);

    expect(h.calls).toHaveLength(0);
    expect(h.creatingLog).toEqual([]);
  });

  it('negative ④ — hasCreateUserErrorLines 가 비정상 입력에 throw 0 으로 false', () => {
    expect(hasCreateUserErrorLines(undefined)).toBe(false);
    expect(hasCreateUserErrorLines([])).toBe(false);
    // 타입을 우회한 비배열 입력(문자열 · null · 유사 배열 객체)도 Array.isArray 로 걸러낸다.
    expect(hasCreateUserErrorLines('보통 문자열' as unknown as string[])).toBe(
      false,
    );
    expect(hasCreateUserErrorLines(null as unknown as string[])).toBe(false);
    expect(
      hasCreateUserErrorLines({ length: 2 } as unknown as string[]),
    ).toBe(false);
    expect(hasCreateUserErrorLines(['한 줄'])).toBe(true);
  });

  it('negative ⑤ — 실패 경로는 bumpRefresh · resetInput 을 부르지 않는다', async () => {
    const h = makeHarness({ failWith: new ApiError(500, 'boom') });

    await runCreateUser(EMAIL, PASSWORD, h.deps);

    expect(h.bumped).toBe(0);
    expect(h.reset).toBe(0);
  });

  it('negative ⑥ — describeError 는 실패 1 회당 정확히 1 회만 호출된다', async () => {
    const h = makeHarness({ failWith: new ApiError(500, 'boom') });

    await runCreateUser(EMAIL, PASSWORD, h.deps);

    expect(h.describeCalls).toBe(1);
  });

  it('AdminView 재수출본이 새 모듈 심볼과 동일 참조다(공개 표면 무변경)', () => {
    expect(reexportedRunCreateUser).toBe(runCreateUser);
    expect(reexportedDescribeCreateUserFailure).toBe(describeCreateUserFailure);
    expect(reexportedDescribeCreateUserFailureLines).toBe(
      describeCreateUserFailureLines,
    );
    expect(reexportedHasCreateUserErrorLines).toBe(hasCreateUserErrorLines);
    expect(reexportedLineClass).toBe(CREATE_USER_ERROR_LINE_CLASS);
  });
});

// ── T-1873 권한 · 역할 축 이동분 경계 spec ────────────────────────────────────────────────────
// R-112 — 위 T-1872 describe 와 같은 취지다. 인스턴스 접근 부여 / 회수 · 역할 변경의 backend 계약
// 대조는 이미 AdminView.instance-access-contract.test.ts · AdminView.role-change-contract.test.ts 가
// `from './AdminView'` 경로로 cover 하므로 복제하지 않는다. 본 describe 가 검증하는 것은 그 spec 들이
// 볼 수 없는 **새 모듈 자신의 직접 import 경계** — 즉 (a) 이동한 값 심볼이 새 모듈에서 직접 import
// 되는가, (b) AdminView 재수출을 거치지 않은 경로에서도 러너 3 종의 정상 / 실패 / 분기 / 미발사
// 계약이 같은가, (c) 재수출본과 직접 import 본이 동일 함수 참조인가(위임 검증이 이동 후에도 유효함의
// 근거) 다. 이동 전에는 존재할 수 없던 검증이라 기존 spec 과 중복이 아니다.
import {
  INSTANCE_ACCESS_DUPLICATE_ERROR,
  INSTANCE_ACCESS_GRANTED_TEXT,
  INSTANCE_ACCESS_REVOKED_TEXT,
  USER_ROLE_FORBIDDEN_ERROR,
  buildInstanceAccessPath,
  deriveInstanceAccessFormFlags,
  runChangeRole,
  runGrantInstanceAccess,
  runRevokeInstanceAccess,
} from './adminUserMutationRunners';
import type {
  ChangeRoleDeps,
  GrantInstanceAccessDeps,
  RevokeInstanceAccessDeps,
} from './adminUserMutationRunners';
import {
  buildInstanceAccessPath as reexportedBuildInstanceAccessPath,
  deriveInstanceAccessFormFlags as reexportedDeriveInstanceAccessFormFlags,
  runChangeRole as reexportedRunChangeRole,
  runGrantInstanceAccess as reexportedRunGrantInstanceAccess,
  runRevokeInstanceAccess as reexportedRunRevokeInstanceAccess,
} from './AdminView';

const USER_ID = 'u1';
const INSTANCE_REF = 'https://jira.example.com';
const ACCESS_PATH = '/api/users/u1/instance-access';
const NEXT_ROLE = 'Admin';

// 부여 / 회수 두 방향이 같은 shape 의 로그를 남기도록 공유하는 관측 상태. 방향별 deps 는 필드명이
// 다르지만(setGranting / setRevoking 등) 관측 축은 동일해 단언을 한 형태로 묶을 수 있다.
interface AccessHarness<D> {
  deps: D;
  calls: { path: string; options: unknown }[];
  errors: (string | undefined)[];
  notices: (string | undefined)[];
  busyLog: boolean[];
  reset: number;
}

function makeGrantHarness(options?: {
  failWith?: unknown;
  conflict?: boolean;
  granting?: boolean;
}): AccessHarness<GrantInstanceAccessDeps> {
  const shouldFail = options !== undefined && 'failWith' in options;
  const state: AccessHarness<GrantInstanceAccessDeps> = {
    deps: undefined as unknown as GrantInstanceAccessDeps,
    calls: [],
    errors: [],
    notices: [],
    busyLog: [],
    reset: 0,
  };
  state.deps = {
    grant: (path, requestOptions) => {
      state.calls.push({ path, options: requestOptions });
      return shouldFail
        ? Promise.reject(options?.failWith)
        : Promise.resolve(undefined);
    },
    describeError: (e) => '문구:' + String(e),
    isConflict: () => options?.conflict === true,
    granting: options?.granting === true,
    setGranting: (next) => {
      state.busyLog.push(next);
    },
    setGrantError: (next) => {
      state.errors.push(next);
    },
    setGrantNotice: (next) => {
      state.notices.push(next);
    },
    resetInput: () => {
      state.reset += 1;
    },
  };
  return state;
}

function makeRevokeHarness(options?: {
  failWith?: unknown;
  revoking?: boolean;
}): AccessHarness<RevokeInstanceAccessDeps> {
  const shouldFail = options !== undefined && 'failWith' in options;
  const state: AccessHarness<RevokeInstanceAccessDeps> = {
    deps: undefined as unknown as RevokeInstanceAccessDeps,
    calls: [],
    errors: [],
    notices: [],
    busyLog: [],
    reset: 0,
  };
  state.deps = {
    revoke: (path, requestOptions) => {
      state.calls.push({ path, options: requestOptions });
      return shouldFail
        ? Promise.reject(options?.failWith)
        : Promise.resolve(undefined);
    },
    describeError: (e) => '문구:' + String(e),
    revoking: options?.revoking === true,
    setRevoking: (next) => {
      state.busyLog.push(next);
    },
    setRevokeError: (next) => {
      state.errors.push(next);
    },
    setRevokeNotice: (next) => {
      state.notices.push(next);
    },
    resetInput: () => {
      state.reset += 1;
    },
  };
  return state;
}

interface RoleHarness {
  deps: ChangeRoleDeps;
  calls: { path: string; options: unknown }[];
  errors: (string | undefined)[];
  changingLog: (string | undefined)[];
  bumped: number;
}

function makeRoleHarness(options?: {
  failWith?: unknown;
  forbidden?: boolean;
  changingId?: string;
}): RoleHarness {
  const shouldFail = options !== undefined && 'failWith' in options;
  const state: RoleHarness = {
    deps: undefined as unknown as ChangeRoleDeps,
    calls: [],
    errors: [],
    changingLog: [],
    bumped: 0,
  };
  state.deps = {
    patch: (path, requestOptions) => {
      state.calls.push({ path, options: requestOptions });
      return shouldFail
        ? Promise.reject(options?.failWith)
        : Promise.resolve(undefined);
    },
    describeError: (e) => '문구:' + String(e),
    isForbidden: () => options?.forbidden === true,
    changingId: options?.changingId,
    setChangingId: (next) => {
      state.changingLog.push(next);
    },
    setChangeError: (next) => {
      state.errors.push(next);
    },
    bumpRefresh: () => {
      state.bumped += 1;
    },
  };
  return state;
}

// 발사된 RequestOptions 를 단언 가능한 형태로 좁힌다(러너가 넘기는 3 필드 고정 계약).
function sentOf(options: unknown): {
  method: string;
  headers: Record<string, string>;
  body: string;
} {
  return options as {
    method: string;
    headers: Record<string, string>;
    body: string;
  };
}

describe('adminUserMutationRunners — 권한 · 역할 축 직접 import 경계 (T-1873)', () => {
  it('happy path — runGrantInstanceAccess 가 부여 POST 를 1 회 발사하고 성공 안내로 전이한다', async () => {
    const h = makeGrantHarness();

    await runGrantInstanceAccess(USER_ID, INSTANCE_REF, h.deps);

    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].path).toBe(ACCESS_PATH);
    const sent = sentOf(h.calls[0].options);
    expect(sent.method).toBe('POST');
    expect(sent.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(sent.body)).toEqual({ instanceRef: INSTANCE_REF });
    // 성공은 안내 문구로만 표면화한다(조회 endpoint 부재 — bumpRefresh 축 자체가 deps 에 없다).
    expect(h.notices).toEqual([undefined, INSTANCE_ACCESS_GRANTED_TEXT]);
    expect(h.errors).toEqual([undefined]);
    expect(h.busyLog).toEqual([true, false]);
    expect(h.reset).toBe(1);
  });

  it('happy path — runRevokeInstanceAccess 가 같은 path 로 DELETE 를 1 회 발사하고 회수 안내로 전이한다', async () => {
    const h = makeRevokeHarness();

    await runRevokeInstanceAccess(USER_ID, INSTANCE_REF, h.deps);

    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].path).toBe(ACCESS_PATH);
    const sent = sentOf(h.calls[0].options);
    expect(sent.method).toBe('DELETE');
    expect(sent.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(sent.body)).toEqual({ instanceRef: INSTANCE_REF });
    expect(h.notices).toEqual([undefined, INSTANCE_ACCESS_REVOKED_TEXT]);
    expect(h.busyLog).toEqual([true, false]);
    expect(h.reset).toBe(1);
  });

  it('happy path — runChangeRole 이 역할 변경 PATCH 를 1 회 발사하고 권위 재조회를 bump 한다', async () => {
    const h = makeRoleHarness();

    await runChangeRole(USER_ID, NEXT_ROLE, h.deps);

    expect(h.calls).toHaveLength(1);
    expect(h.calls[0].path).toBe('/api/users/u1/role');
    const sent = sentOf(h.calls[0].options);
    expect(sent.method).toBe('PATCH');
    expect(JSON.parse(sent.body)).toEqual({ role: NEXT_ROLE });
    // 낙관 갱신 0 — 권위 재조회 nonce bump 만이 성공 표면이다.
    expect(h.bumped).toBe(1);
    // 진행 id 는 발사 시 원본 id, 종료 시 undefined 다(UserList 의 원본 동등 비교 계약).
    expect(h.changingLog).toEqual([USER_ID, undefined]);
    expect(h.errors).toEqual([undefined]);
  });

  it('error path — 부여 fetch 가 reject 해도 throw 0 이고 finally 가 진행 플래그를 해제한다', async () => {
    const h = makeGrantHarness({ failWith: new Error('boom') });

    await expect(
      runGrantInstanceAccess(USER_ID, INSTANCE_REF, h.deps),
    ).resolves.toBeUndefined();

    expect(h.errors).toEqual([undefined, '문구:Error: boom']);
    expect(h.notices).toEqual([undefined]);
    expect(h.busyLog).toEqual([true, false]);
  });

  it('error path — 회수 fetch 가 reject 해도 throw 0 이고 finally 가 진행 플래그를 해제한다', async () => {
    const h = makeRevokeHarness({ failWith: new ApiError(404, 'none') });

    await expect(
      runRevokeInstanceAccess(USER_ID, INSTANCE_REF, h.deps),
    ).resolves.toBeUndefined();

    expect(h.errors).toEqual([undefined, '문구:ApiError: none']);
    expect(h.notices).toEqual([undefined]);
    expect(h.busyLog).toEqual([true, false]);
  });

  it('error path — 역할 변경 fetch 가 reject 해도 throw 0 이고 finally 가 진행 id 를 비운다', async () => {
    const h = makeRoleHarness({ failWith: new Error('boom') });

    await expect(
      runChangeRole(USER_ID, NEXT_ROLE, h.deps),
    ).resolves.toBeUndefined();

    expect(h.errors).toEqual([undefined, '문구:Error: boom']);
    expect(h.changingLog).toEqual([USER_ID, undefined]);
    expect(h.bumped).toBe(0);
  });

  it('분기 — 부여 실패는 409(isConflict true)면 중복 전용 문구, 그 외면 describeError 파생으로 갈린다', async () => {
    const conflict = makeGrantHarness({
      failWith: new ApiError(409, 'dup'),
      conflict: true,
    });
    await runGrantInstanceAccess(USER_ID, INSTANCE_REF, conflict.deps);
    expect(conflict.errors).toEqual([
      undefined,
      INSTANCE_ACCESS_DUPLICATE_ERROR,
    ]);

    const other = makeGrantHarness({ failWith: new ApiError(500, 'boom') });
    await runGrantInstanceAccess(USER_ID, INSTANCE_REF, other.deps);
    expect(other.errors).toEqual([undefined, '문구:ApiError: boom']);
  });

  it('분기 — 역할 변경 실패는 403(isForbidden true)면 권한 전용 문구, 그 외면 describeError 파생으로 갈린다', async () => {
    const forbidden = makeRoleHarness({
      failWith: new ApiError(403, 'nope'),
      forbidden: true,
    });
    await runChangeRole(USER_ID, NEXT_ROLE, forbidden.deps);
    expect(forbidden.errors).toEqual([undefined, USER_ROLE_FORBIDDEN_ERROR]);

    const other = makeRoleHarness({ failWith: new ApiError(400, 'bad') });
    await runChangeRole(USER_ID, NEXT_ROLE, other.deps);
    expect(other.errors).toEqual([undefined, '문구:ApiError: bad']);
  });

  it('분기 — deriveInstanceAccessFormFlags 가 busy · actionDisabled 각 분기를 진리표대로 파생한다', () => {
    const base = {
      granting: false,
      revoking: false,
      userId: USER_ID,
      instanceRef: INSTANCE_REF,
    };

    // busy 분기 3 종 — 부여 진행 / 회수 진행 / 둘 다 idle.
    expect(deriveInstanceAccessFormFlags({ ...base, granting: true })).toEqual({
      busy: true,
      actionDisabled: true,
    });
    expect(deriveInstanceAccessFormFlags({ ...base, revoking: true })).toEqual({
      busy: true,
      actionDisabled: true,
    });
    // idle + 입력 완비 → 두 버튼 모두 활성.
    expect(deriveInstanceAccessFormFlags(base)).toEqual({
      busy: false,
      actionDisabled: false,
    });

    // actionDisabled 잔여 분기 2 종 — 사용자 미선택 / 주소 공백만(각각 busy 는 false 유지).
    expect(deriveInstanceAccessFormFlags({ ...base, userId: '' })).toEqual({
      busy: false,
      actionDisabled: true,
    });
    expect(
      deriveInstanceAccessFormFlags({ ...base, instanceRef: '   ' }),
    ).toEqual({ busy: false, actionDisabled: true });

    // 인자 객체를 변형하지 않는 순수 helper 다(같은 인자면 항상 같은 결과).
    const input = { ...base };
    deriveInstanceAccessFormFlags(input);
    expect(input).toEqual(base);
  });

  it('negative ① — 빈 userId(공백만 포함)면 세 러너 모두 미발사 · 상태 전이 0', async () => {
    const grant = makeGrantHarness();
    await runGrantInstanceAccess('   ', INSTANCE_REF, grant.deps);
    const revoke = makeRevokeHarness();
    await runRevokeInstanceAccess('', INSTANCE_REF, revoke.deps);

    for (const h of [grant, revoke]) {
      expect(h.calls).toHaveLength(0);
      expect(h.busyLog).toEqual([]);
      expect(h.errors).toEqual([]);
      expect(h.notices).toEqual([]);
    }

    const role = makeRoleHarness();
    await runChangeRole('   ', NEXT_ROLE, role.deps);
    expect(role.calls).toHaveLength(0);
    expect(role.changingLog).toEqual([]);
    expect(role.errors).toEqual([]);
  });

  it('negative ② — 빈 instanceRef(공백만 포함)면 부여 · 회수 모두 미발사 · 상태 전이 0', async () => {
    const grant = makeGrantHarness();
    await runGrantInstanceAccess(USER_ID, '   ', grant.deps);
    const revoke = makeRevokeHarness();
    await runRevokeInstanceAccess(USER_ID, '', revoke.deps);

    for (const h of [grant, revoke]) {
      expect(h.calls).toHaveLength(0);
      expect(h.busyLog).toEqual([]);
      expect(h.errors).toEqual([]);
      expect(h.reset).toBe(0);
    }
  });

  it('negative ③ — in-flight 중 재호출은 이중 발사 0 (부여 · 회수 · 역할 변경)', async () => {
    const grant = makeGrantHarness({ granting: true });
    await runGrantInstanceAccess(USER_ID, INSTANCE_REF, grant.deps);
    expect(grant.calls).toHaveLength(0);
    expect(grant.busyLog).toEqual([]);

    const revoke = makeRevokeHarness({ revoking: true });
    await runRevokeInstanceAccess(USER_ID, INSTANCE_REF, revoke.deps);
    expect(revoke.calls).toHaveLength(0);
    expect(revoke.busyLog).toEqual([]);

    // 단일 in-flight 정책 — 진행 중인 id 가 **다른 사용자** 여도 새 발사는 no-op 이다.
    const role = makeRoleHarness({ changingId: 'other-user' });
    await runChangeRole(USER_ID, NEXT_ROLE, role.deps);
    expect(role.calls).toHaveLength(0);
    expect(role.changingLog).toEqual([]);
  });

  it('negative ④ — 빈 role(공백만 포함)이면 runChangeRole 은 미발사 · 상태 전이 0', async () => {
    const blank = makeRoleHarness();
    await runChangeRole(USER_ID, '', blank.deps);
    const spaces = makeRoleHarness();
    await runChangeRole(USER_ID, '   ', spaces.deps);

    for (const h of [blank, spaces]) {
      expect(h.calls).toHaveLength(0);
      expect(h.changingLog).toEqual([]);
      expect(h.errors).toEqual([]);
      expect(h.bumped).toBe(0);
    }
  });

  it('negative ⑤ — buildInstanceAccessPath 가 특수문자 id 를 인코딩해 형제 자원으로 오발사하지 않는다', async () => {
    // 인코딩이 없으면 상위 경로 탈출이나 query 주입으로 형제 자원에 발사될 수 있다.
    expect(buildInstanceAccessPath('../groups')).toBe(
      '/api/users/..%2Fgroups/instance-access',
    );
    expect(buildInstanceAccessPath('a b?c#d')).toBe(
      '/api/users/a%20b%3Fc%23d/instance-access',
    );

    // 러너가 실제로 그 인코딩 path 로 발사한다(빌더만 안전하고 발사가 딴 path 인 회귀 차단).
    const h = makeGrantHarness();
    await runGrantInstanceAccess('../groups', INSTANCE_REF, h.deps);
    expect(h.calls[0].path).toBe('/api/users/..%2Fgroups/instance-access');
  });

  it('negative ⑥ — 실패 경로는 성공 표면(안내 문구 · 입력 초기화 · bumpRefresh)을 만들지 않는다', async () => {
    const grant = makeGrantHarness({ failWith: new ApiError(500, 'boom') });
    await runGrantInstanceAccess(USER_ID, INSTANCE_REF, grant.deps);
    expect(grant.reset).toBe(0);
    expect(grant.notices).toEqual([undefined]);

    const revoke = makeRevokeHarness({ failWith: new ApiError(500, 'boom') });
    await runRevokeInstanceAccess(USER_ID, INSTANCE_REF, revoke.deps);
    expect(revoke.reset).toBe(0);
    expect(revoke.notices).toEqual([undefined]);

    const role = makeRoleHarness({ failWith: new ApiError(500, 'boom') });
    await runChangeRole(USER_ID, NEXT_ROLE, role.deps);
    expect(role.bumped).toBe(0);
  });

  it('AdminView 재수출본이 새 모듈 심볼과 동일 참조다(공개 표면 무변경)', () => {
    expect(reexportedBuildInstanceAccessPath).toBe(buildInstanceAccessPath);
    expect(reexportedDeriveInstanceAccessFormFlags).toBe(
      deriveInstanceAccessFormFlags,
    );
    expect(reexportedRunGrantInstanceAccess).toBe(runGrantInstanceAccess);
    expect(reexportedRunRevokeInstanceAccess).toBe(runRevokeInstanceAccess);
    expect(reexportedRunChangeRole).toBe(runChangeRole);
  });
});
