import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/apiClient';
import { describeCreateUserFailure } from './AdminView';

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
});
