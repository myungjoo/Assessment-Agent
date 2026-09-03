import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/apiClient';
import {
  describeCreateUserFailure,
  describeCreateUserFailureLines,
  hasCreateUserErrorLines,
  runCreateUser,
  CREATE_USER_ERROR_LINE_CLASS,
} from './AdminView';
import type { CreateUserDeps } from './AdminView';

// R-112 — T-1715 사용자 추가(POST /api/users) 실패 문구 배선 spec. 대상은 순수 함수
// describeCreateUserFailure 하나이며, 400 만 축별 구체 사유(REQ-068/REQ-069)로 교체하고 그 외
// 표면은 종전 toErrorMessage 결과를 그대로 흘려보내는지를 고정한다. 웹에 @testing-library/react
// 가 없어(ADR-0040 §5 새-dep 게이트) 상호작용 렌더 test 가 불가하므로, 컨테이너 배선 여부는
// 아래 drift guard 가 소스 대조로 확인한다(AdminView.userlist-wiring.test.tsx 선례와 같은 취지).

// 구분자 — AdminView 의 CREATE_USER_ERROR_SEPARATOR 와 같은 값(모듈 내부 상수라 값만 동기).
const SEPARATOR = ' / ';

// class-validator 400 응답 body 원문 형태(NestJS ValidationPipe 기본 shape).
function validationBody(messages: string[]): string {
  return JSON.stringify({
    message: messages,
    error: 'Bad Request',
    statusCode: 400,
  });
}

describe('AdminView — 사용자 추가 실패 문구 축별 사유 배선 (T-1715 describeCreateUserFailure)', () => {
  it('happy path — 400 + email 형식 위반이면 `아이디:` 접두의 구체 사유 1 줄을 반환한다', () => {
    const message = describeCreateUserFailure(
      new ApiError(400, validationBody(['email must be an email'])),
    );

    expect(message).toBe(
      '아이디: 아이디는 email 형식이어야 합니다 (예: admin@example.com).',
    );
    expect(message.includes(SEPARATOR)).toBe(false);
  });

  it('error path — email·password 두 위반이 동시에 오면 두 사유가 모두 남고 순서는 아이디 → 비밀번호다', () => {
    const message = describeCreateUserFailure(
      new ApiError(
        400,
        validationBody([
          'password must be longer than or equal to 8 characters',
          'email must be an email',
        ]),
      ),
    );

    const lines = message.split(SEPARATOR);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      '아이디: 아이디는 email 형식이어야 합니다 (예: admin@example.com).',
    );
    expect(lines[1]).toBe('비밀번호: 비밀번호는 최소 8자 이상이어야 합니다.');
    // 병합 금지 — 두 사유가 하나의 포괄 문구로 접히지 않았다(REQ-068).
    expect(message).toContain('email 형식');
    expect(message).toContain('8자 이상');
  });

  it('분기 ① — ApiError 400 은 분류 경로를 타서 HTTP 접두(toErrorMessage 형태)를 쓰지 않는다', () => {
    const message = describeCreateUserFailure(
      new ApiError(400, validationBody(['email should not be empty'])),
    );

    expect(message).toBe('아이디: 아이디를 입력해 주세요 — 빈 값은 사용할 수 없습니다.');
    expect(message.startsWith('HTTP 400')).toBe(false);
  });

  it('분기 ② — ApiError 400 이지만 body 가 JSON 이 아니면 분류기의 최소 1 줄 보장이 그대로 표면화된다', () => {
    const message = describeCreateUserFailure(new ApiError(400, 'Bad Request'));

    expect(message).toBe('기타: 서버 응답: Bad Request');
    expect(message.startsWith('기타: ')).toBe(true);
  });

  it('분기 ③ — ApiError 비-400(500 · status 0 네트워크)은 toErrorMessage 경로를 그대로 쓴다', () => {
    expect(describeCreateUserFailure(new ApiError(500, 'boom'))).toBe(
      'HTTP 500: boom',
    );
    expect(describeCreateUserFailure(new ApiError(0, 'offline'))).toBe(
      '네트워크 오류: offline',
    );
  });

  it('분기 ④ — 비-ApiError throw 표면은 Error 메시지 / 알 수 없는 오류로 종전과 동일하게 파생된다', () => {
    expect(describeCreateUserFailure(new Error('unexpected'))).toBe(
      'unexpected',
    );
    expect(describeCreateUserFailure({ status: 400 })).toBe('알 수 없는 오류');
  });

  it('negative ① — 400 결과 문자열에 응답 원문 JSON 조각이 남지 않는다', () => {
    const message = describeCreateUserFailure(
      new ApiError(
        400,
        validationBody(['email must be an email', 'password should not be empty']),
      ),
    );

    expect(message).not.toContain('{"message"');
    expect(message).not.toContain('statusCode');
    expect(message).not.toContain('Bad Request');
    expect(message).not.toContain('[');
  });

  it('negative ② — null · undefined · 문자열 · 숫자 입력에도 throw 없이 문자열을 반환한다', () => {
    for (const input of [null, undefined, 'boom', 42, 0, false, []]) {
      expect(() => describeCreateUserFailure(input)).not.toThrow();
      expect(typeof describeCreateUserFailure(input)).toBe('string');
      expect(describeCreateUserFailure(input).length).toBeGreaterThan(0);
    }
  });

  it('negative ③ — 결과 문자열에 사용자가 입력한 비밀번호 값이 섞이지 않는다', () => {
    const secret = 'hunter2-super-secret';
    const message = describeCreateUserFailure(
      new ApiError(
        400,
        validationBody(['password must be longer than or equal to 8 characters']),
      ),
    );

    expect(message).not.toContain(secret);
    expect(message).toBe('비밀번호: 비밀번호는 최소 8자 이상이어야 합니다.');
  });

  it('negative ④ — 409 를 직접 넘겨도 형식/길이 어휘가 섞이지 않는다(REQ-069 구분 축)', () => {
    const message = describeCreateUserFailure(
      new ApiError(409, '{"message":"Email already exists"}'),
    );

    // 400 이 아니므로 분류 경로를 타지 않고 toErrorMessage 결과 그대로다(러너의 409 분기는
    // 이 함수에 도달하기 전 USER_DUPLICATE_ERROR 로 처리한다 — 본 helper 는 409 에 무관여).
    expect(message).toBe('HTTP 409: {"message":"Email already exists"}');
    expect(message).not.toContain('email 형식');
    expect(message).not.toContain('8자 이상');
  });

  it('negative ⑤ — 미매핑 message 원문이 `기타:` 축에 유실 없이 남는다', () => {
    const message = describeCreateUserFailure(
      new ApiError(400, validationBody(['nickname must be a string'])),
    );

    expect(message).toBe('기타: nickname must be a string');
  });
});

describe('AdminView — 사용자 추가 실패 문구 배선 drift guard (T-1715)', () => {
  // cwd 에 의존하지 않도록 spec 파일 기준 상대 URL 로 읽는다(create-user-contract spec 선례).
  const source = readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8');
  // T-1872 순수 추출로 CREATE_USER_ERROR_SEPARATOR 정의가 adminUserMutationRunners 로 옮겨갔다 —
  // 읽기 대상 pointer 만 새 모듈로 바꾸고 단언 내용은 그대로 둔다(배선 · 배럴 단언은 AdminView 잔류).
  const runners = readFileSync(
    new URL('./adminUserMutationRunners.ts', import.meta.url),
    'utf8',
  );

  it('handleCreateUser 의 deps 가 describeError 로 describeCreateUserFailure 를 넘긴다', () => {
    const call = /runCreateUser\(\s*userEmailInput,\s*userPasswordInput,\s*\{([\s\S]*?)\n {6}\}\)/.exec(
      source,
    );

    expect(call).not.toBeNull();
    expect(call?.[1]).toContain('describeError: describeCreateUserFailure');
    expect(call?.[1]).not.toContain('describeError: toErrorMessage');
  });

  it('describeCreateUserFailure 가 named export 로 노출된다', () => {
    expect(source).toContain('\n  describeCreateUserFailure,\n');
  });

  // Nit-1 closure (round 2) — 두 계정 생성 화면의 구분자 값이 갈리지 않게 고정한다. 둘 다 각자
  // 모듈 내부 상수라(공통 helper 추출은 본 slice Out of Scope) 소스 대조 외에는 묶을 방법이 없다.
  it('CREATE_USER_ERROR_SEPARATOR 가 AppShell 의 SETUP_ERROR_SEPARATOR 와 같은 값이다', () => {
    const appShell = readFileSync(
      new URL('../AppShell.tsx', import.meta.url),
      'utf8',
    );
    const literal = (text: string, name: string): string | undefined =>
      new RegExp(`const ${name} = '([^']*)';`).exec(text)?.[1];

    const here = literal(runners, 'CREATE_USER_ERROR_SEPARATOR');
    const there = literal(appShell, 'SETUP_ERROR_SEPARATOR');

    expect(here).toBeDefined();
    expect(there).toBeDefined();
    expect(here).toBe(there);
    // 값이 실제로 spec 이 쓰는 SEPARATOR 와도 같아야 위쪽 단언들이 유효하다.
    expect(here).toBe(SEPARATOR);
  });
});

// R-112 — T-1835 (REQ-084) 사용자 추가 실패 사유 **줄 단위** 표시 spec. 검증 대상은 (a) 줄 배열
// 정본 describeCreateUserFailureLines, (b) 러너의 줄 배열 표면화 분기, (c) 렌더 판정 helper
// hasCreateUserErrorLines, (d) join 파생 계약 등가다. 컨테이너 state 와 JSX 분기는 RTL 부재
// (ADR-0040 §5)로 직접 렌더할 수 없어 파일 말미 drift guard 가 소스 대조로 고정한다.
describe('AdminView — 사용자 추가 실패 사유 줄 단위 표시 (T-1835 describeCreateUserFailureLines, REQ-084)', () => {
  const DUP = '이미 존재하는 이메일입니다';
  const EMAIL = 'new-user@example.com';
  const PASSWORD = 'pass1234';

  // 러너가 표면화한 문자열/줄 배열을 그대로 캡처하는 deps harness. 줄 배열 축 2 필드는
  // optional 이므로, 주입 여부를 인자로 갈라 "기존 deps literal 무회귀" 도 같이 잠근다.
  function makeDeps(options: { fail?: unknown; withLines?: boolean }): {
    deps: CreateUserDeps;
    seen: { error: (string | undefined)[]; lines: (string[] | undefined)[] };
  } {
    const seen: {
      error: (string | undefined)[];
      lines: (string[] | undefined)[];
    } = { error: [], lines: [] };
    const deps: CreateUserDeps = {
      create: async () => {
        if (options.fail !== undefined) {
          throw options.fail;
        }
        return undefined;
      },
      describeError: describeCreateUserFailure,
      isConflict: (e: unknown) => e instanceof ApiError && e.status === 409,
      creating: false,
      setCreating: () => {},
      setCreateError: (next) => seen.error.push(next),
      bumpRefresh: () => {},
      resetInput: () => {},
    };
    if (options.withLines !== false) {
      deps.describeErrorLines = describeCreateUserFailureLines;
      deps.setCreateErrorLines = (next) => seen.lines.push(next);
    }
    return { deps, seen };
  }

  it('happy path — 사유 2 줄짜리 400 실패가 2 원소 배열로 나오고 줄 원문이 그대로 보존된다', () => {
    const lines = describeCreateUserFailureLines(
      new ApiError(
        400,
        validationBody([
          'password must be longer than or equal to 8 characters',
          'email must be an email',
        ]),
      ),
    );

    expect(lines).toEqual([
      '아이디: 아이디는 email 형식이어야 합니다 (예: admin@example.com).',
      '비밀번호: 비밀번호는 최소 8자 이상이어야 합니다.',
    ]);
    // 어느 줄에도 구분자가 섞이지 않는다 — 한 줄 합침으로 되돌아가지 않았다는 뜻.
    lines.forEach((line) => expect(line).not.toContain(SEPARATOR));
  });

  it('error path — 400 이 아닌 실패(500 · 네트워크 · 비-ApiError)는 1 줄 배열로 되돌아가고 throw 하지 않는다', () => {
    for (const input of [
      new ApiError(500, 'boom'),
      new ApiError(0, 'offline'),
      new Error('unexpected'),
    ]) {
      expect(() => describeCreateUserFailureLines(input)).not.toThrow();
      expect(describeCreateUserFailureLines(input)).toHaveLength(1);
    }
    expect(describeCreateUserFailureLines(new ApiError(500, 'boom'))).toEqual([
      'HTTP 500: boom',
    ]);
    expect(describeCreateUserFailureLines(new ApiError(0, 'offline'))).toEqual([
      '네트워크 오류: offline',
    ]);
  });

  it('분기 (a) — 400 축별 사유는 분류 경로를 타서 HTTP 접두를 쓰지 않는다', () => {
    const lines = describeCreateUserFailureLines(
      new ApiError(400, validationBody(['email should not be empty'])),
    );

    expect(lines).toEqual([
      '아이디: 아이디를 입력해 주세요 — 빈 값은 사용할 수 없습니다.',
    ]);
    expect(lines[0].startsWith('HTTP 400')).toBe(false);
  });

  it('분기 (b) — 409 중복 실패는 줄 배열도 중복 문구 1 줄로 표면화된다', async () => {
    const { deps, seen } = makeDeps({
      fail: new ApiError(409, '{"message":"Email already exists"}'),
    });

    await runCreateUser(EMAIL, PASSWORD, deps);

    expect(seen.error).toEqual([undefined, DUP]);
    expect(seen.lines).toEqual([undefined, [DUP]]);
    // 중복 축에 형식/길이 어휘가 섞이지 않는다(REQ-069 구분 축).
    expect(seen.lines[1]?.join('')).not.toContain('email 형식');
  });

  it('분기 (c) — 409 가 아닌 실패는 describeErrorLines 결과가 그대로 줄 배열이 된다', async () => {
    const failure = new ApiError(
      400,
      validationBody(['email must be an email', 'password should not be empty']),
    );
    const { deps, seen } = makeDeps({ fail: failure });

    await runCreateUser(EMAIL, PASSWORD, deps);

    expect(seen.lines[1]).toEqual(describeCreateUserFailureLines(failure));
    expect(seen.lines[1]).toHaveLength(2);
    // 문자열 축은 종전 계약(join 표현) 그대로 함께 갱신된다.
    expect(seen.error[1]).toBe(describeCreateUserFailure(failure));
  });

  it('분기 (d) — 렌더 3 분기 판정: 줄 배열 있음 / 문자열만 있음 / 둘 다 없음', () => {
    // ① 줄 배열이 있으면 줄 단위 렌더를 택한다.
    expect(hasCreateUserErrorLines(['아이디: 사유', '비밀번호: 사유'])).toBe(true);
    expect(hasCreateUserErrorLines(['한 줄'])).toBe(true);
    // ② 줄 배열이 없으면(=undefined) 단일 문자열 fallback 으로 내려간다.
    expect(hasCreateUserErrorLines(undefined)).toBe(false);
    // ③ 빈 배열도 렌더 대상이 아니다 — 빈 alert 가 자리를 차지하지 않는다.
    expect(hasCreateUserErrorLines([])).toBe(false);
  });

  it('join 파생 계약 — describeCreateUserFailure(e) 가 줄 배열 join 과 항상 같다', () => {
    const inputs: unknown[] = [
      new ApiError(400, validationBody(['email must be an email'])),
      new ApiError(
        400,
        validationBody([
          'email must be an email',
          'password must be longer than or equal to 8 characters',
        ]),
      ),
      new ApiError(400, 'Bad Request'),
      new ApiError(409, 'dup'),
      new ApiError(500, 'boom'),
      new Error('unexpected'),
      null,
      undefined,
    ];

    inputs.forEach((input) => {
      expect(describeCreateUserFailure(input)).toBe(
        describeCreateUserFailureLines(input).join(SEPARATOR),
      );
    });
  });

  it('negative ① — 타입을 우회한 비정상 값(문자열 · null)에도 렌더 판정이 throw 없이 false 다', () => {
    const bogus = ['', null, 0, {}, 'lines'] as unknown as (
      | string[]
      | undefined
    )[];
    bogus.forEach((value) => {
      expect(() => hasCreateUserErrorLines(value)).not.toThrow();
      expect(hasCreateUserErrorLines(value)).toBe(false);
    });
  });

  it('negative ② — null · undefined · 원시값 입력에도 무-throw 로 1 줄 이상을 돌려준다', () => {
    for (const input of [null, undefined, 'boom', 42, 0, false, []]) {
      expect(() => describeCreateUserFailureLines(input)).not.toThrow();
      const lines = describeCreateUserFailureLines(input);
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach((line) => expect(typeof line).toBe('string'));
    }
  });

  it('negative ③ — 성공하면 직전 실패의 줄 배열이 비워진다(옛 사유 잔류 0)', async () => {
    const { deps, seen } = makeDeps({});

    await runCreateUser(EMAIL, PASSWORD, deps);

    expect(seen.lines).toEqual([undefined]);
    expect(seen.error).toEqual([undefined]);
  });

  it('negative ④ — 어떤 줄에도 사용자가 입력한 비밀번호 원문이 새지 않는다', async () => {
    const secret = 'hunter2-super-secret';
    const { deps, seen } = makeDeps({
      fail: new ApiError(
        400,
        validationBody([
          'password must be longer than or equal to 8 characters',
        ]),
      ),
    });

    await runCreateUser(EMAIL, secret, deps);

    expect(seen.lines[1]).toEqual([
      '비밀번호: 비밀번호는 최소 8자 이상이어야 합니다.',
    ]);
    seen.lines[1]?.forEach((line) => expect(line).not.toContain(secret));
    expect(seen.error[1]).not.toContain(secret);
  });

  it('negative ⑤ — 줄 원문이 요약·병합되지 않는다(줄 수 = 사유 수, 응답 JSON 조각 잔류 0)', () => {
    const lines = describeCreateUserFailureLines(
      new ApiError(
        400,
        validationBody([
          'email must be an email',
          'password should not be empty',
          'nickname must be a string',
        ]),
      ),
    );

    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe('기타: nickname must be a string');
    lines.forEach((line) => {
      expect(line).not.toContain('{"message"');
      expect(line).not.toContain('statusCode');
      expect(line).not.toContain(SEPARATOR);
    });
  });

  it('negative ⑥ — 줄 배열 축을 주입하지 않은 기존 deps literal 도 무회귀로 동작한다', async () => {
    const { deps, seen } = makeDeps({
      fail: new ApiError(500, 'boom'),
      withLines: false,
    });

    await expect(runCreateUser(EMAIL, PASSWORD, deps)).resolves.toBeUndefined();
    expect(seen.error).toEqual([undefined, 'HTTP 500: boom']);
    // optional 축을 주입하지 않았으므로 줄 배열 setter 는 한 번도 호출되지 않는다.
    expect(seen.lines).toEqual([]);
  });
  it('negative ⑧ — 실패 1 건당 describeError 를 정확히 1 회만 호출한다(줄 축 추가로 중복 호출 0)', async () => {
    let describeCalls = 0;
    const deps: CreateUserDeps = {
      create: async () => {
        throw new ApiError(500, 'boom');
      },
      describeError: (e) => {
        describeCalls += 1;
        return describeCreateUserFailure(e);
      },
      describeErrorLines: undefined,
      isConflict: () => false,
      creating: false,
      setCreating: () => {},
      setCreateError: () => {},
      setCreateErrorLines: () => {},
      bumpRefresh: () => {},
      resetInput: () => {},
    };

    await runCreateUser(EMAIL, PASSWORD, deps);

    expect(describeCalls).toBe(1);
  });
});

describe('AdminView — 사용자 추가 실패 줄 단위 렌더 배선 drift guard (T-1835)', () => {
  const source = readFileSync(new URL('./AdminView.tsx', import.meta.url), 'utf8');
  // T-1872 순수 추출로 CREATE_USER_ERROR_LINE_CLASS 정의가 adminUserMutationRunners 로 옮겨갔다 —
  // 리터럴 대조만 새 모듈 소스를 읽고, 렌더 분기 · 배럴 단언은 AdminView 소스를 계속 읽는다.
  const runners = readFileSync(
    new URL('./adminUserMutationRunners.ts', import.meta.url),
    'utf8',
  );

  it('handleCreateUser 의 deps 가 줄 배열 정본과 setter 를 함께 넘긴다', () => {
    const call =
      /runCreateUser\(\s*userEmailInput,\s*userPasswordInput,\s*\{([\s\S]*?)\n {6}\}\)/.exec(
        source,
      );

    expect(call).not.toBeNull();
    expect(call?.[1]).toContain(
      'describeErrorLines: describeCreateUserFailureLines',
    );
    expect(call?.[1]).toContain('setCreateErrorLines: setCreateUserErrorLines');
  });

  it('표시 지점이 줄 배열 우선 3 분기이며 줄마다 별도 element 를 만든다', () => {
    // 줄 배열 분기 → 문자열 fallback → 미렌더 순서가 소스에 그대로 남아 있어야 한다.
    expect(source).toContain('hasCreateUserErrorLines(createUserErrorLines) ? (');
    expect(source).toContain(
      '(createUserErrorLines as string[]).map((line, index) => (',
    );
    expect(source).toContain('className={CREATE_USER_ERROR_LINE_CLASS}');
    expect(source).toContain(') : createUserError ? (');
    expect(source).toContain('<p role="alert">{createUserError}</p>');
    // 줄 배열 분기 안에서도 role="alert" 를 잃지 않는다(스크린리더 고지 유지).
    const branch =
      /hasCreateUserErrorLines\(createUserErrorLines\) \? \(([\s\S]*?)\) : createUserError \? \(/.exec(
        source,
      );
    expect(branch?.[1]).toContain('<div role="alert">');
    // 줄들을 join 으로 합치는 코드가 렌더 분기에 남아 있지 않다(REQ-084 한 줄 합침 금지).
    expect(branch?.[1]).not.toContain('join(');
  });

  it('줄 element className 이 셋업 폼의 값과 겹치지 않는 화면 고유 토큰이다', () => {
    expect(CREATE_USER_ERROR_LINE_CLASS).toBe('admin-create-user-error-line');
    expect(CREATE_USER_ERROR_LINE_CLASS).not.toBe('superadmin-setup-error-line');
    expect(runners).toContain(
      `const CREATE_USER_ERROR_LINE_CLASS = '${CREATE_USER_ERROR_LINE_CLASS}';`,
    );
  });

  it('줄 배열 정본과 렌더 판정 helper 가 named export 로 노출된다', () => {
    expect(source).toContain('\n  describeCreateUserFailureLines,\n');
    expect(source).toContain('\n  hasCreateUserErrorLines,\n');
  });
});
