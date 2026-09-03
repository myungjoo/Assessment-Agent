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
