import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH, classifySignupFailure, formatSignupFailure } from './signupError';
import { PASSWORD_MIN_LENGTH as FORM_PASSWORD_MIN_LENGTH } from '../components/SuperAdminSetupForm';

// R-112 — signup 실패 사유 분류기(T-1712, REQ-068/069) 검증. 순수 함수라 mock 0.
// 오너가 금지한 포괄 문구 — 어떤 출력에도 등장하면 안 된다(REQ-068).
const FORBIDDEN_PHRASE = '이미 등록된 사용자이거나 입력이 올바르지 않습니다';

// class-validator 위반을 담은 Nest 400 응답 body 를 만든다.
const badRequest = (message: unknown): string =>
  JSON.stringify({ statusCode: 400, message, error: 'Bad Request' });

// 분류 → 표시 줄 목록까지 한 번에 통과시켜 한 문자열로 합친다(문구 혼입 검사용).
const allLines = (status: number, body: string): string =>
  formatSignupFailure(classifySignupFailure(status, body)).join('\n');

describe('classifySignupFailure — happy path', () => {
  it('409 는 중복 전용 사유 1 줄을 아이디 축에 담는다', () => {
    const failure = classifySignupFailure(409, JSON.stringify({ message: 'email already exists: a@b.com' }));
    expect(failure.kind).toBe('duplicate-username');
    expect(failure.username).toHaveLength(1);
    expect(failure.username[0]).toContain('이미 등록된 아이디');
    expect(failure.password).toEqual([]);
  });

  it('400 email 형식 위반을 아이디 축 사유로 매핑한다', () => {
    const failure = classifySignupFailure(400, badRequest(['email must be an email']));
    expect(failure.kind).toBe('invalid-input');
    expect(failure.username[0]).toContain('email 형식');
    expect(failure.password).toEqual([]);
    expect(failure.other).toEqual([]);
  });

  it('400 password 길이 위반을 비밀번호 축 사유로 매핑한다', () => {
    const failure = classifySignupFailure(400, badRequest(['password must be longer than or equal to 8 characters']));
    expect(failure.password[0]).toContain(`최소 ${PASSWORD_MIN_LENGTH}자`);
    expect(failure.username).toEqual([]);
  });

  it('400 두 축 동시 위반이면 축별로 각각 사유가 담긴다', () => {
    const failure = classifySignupFailure(
      400,
      badRequest(['email should not be empty', 'password should not be empty', 'password must be a string']),
    );
    expect(failure.username).toHaveLength(1);
    expect(failure.password).toHaveLength(2);
    expect(failure.other).toEqual([]);
  });
});

describe('classifySignupFailure — error path (비정상 body 흡수)', () => {
  it('빈 body 여도 throw 하지 않고 kind 를 유지한 채 other 로 흡수한다', () => {
    const failure = classifySignupFailure(400, '');
    expect(failure.kind).toBe('invalid-input');
    expect(failure.other).toEqual(['입력값을 다시 확인해 주세요 — 서버가 상세 사유를 주지 않았습니다.']);
  });

  it('JSON 이 아닌 텍스트 body 는 원문을 other 에 보존한다', () => {
    const failure = classifySignupFailure(400, 'HTTP 400');
    expect(failure.kind).toBe('invalid-input');
    expect(failure.other[0]).toContain('HTTP 400');
  });

  it('message 키 부재 · message 가 객체인 비정상 형태도 흡수한다', () => {
    for (const body of [JSON.stringify({ statusCode: 400 }), badRequest({ email: '이상' })]) {
      const failure = classifySignupFailure(400, body);
      expect(failure.kind).toBe('invalid-input');
      expect(failure.other).toHaveLength(1);
    }
  });

  it('message 가 빈 배열이어도 표시할 사유 1 줄을 보장한다', () => {
    const failure = classifySignupFailure(400, badRequest([]));
    expect(failure.kind).toBe('invalid-input');
    expect(formatSignupFailure(failure)).toHaveLength(1);
    expect(allLines(400, badRequest([]))).not.toContain(FORBIDDEN_PHRASE);
  });

  it('message 배열 안의 비문자열 요소도 버리지 않는다', () => {
    expect(classifySignupFailure(400, badRequest([{ nested: 1 }])).other.join(' ')).toContain('nested');
  });
});

describe('classifySignupFailure — 분기 cover', () => {
  it('kind 3 값이 status 에 따라 각각 나온다', () => {
    expect(classifySignupFailure(409, '').kind).toBe('duplicate-username');
    expect(classifySignupFailure(400, '').kind).toBe('invalid-input');
    expect(classifySignupFailure(500, '').kind).toBe('unknown');
  });

  it('message 가 string 인 경우와 string[] 인 경우 모두 매핑된다', () => {
    const single = classifySignupFailure(400, badRequest('email must be an email'));
    const list = classifySignupFailure(400, badRequest(['email must be an email']));
    expect(single.username).toEqual(list.username);
    expect(single.other).toEqual([]);
  });

  it('매핑 안 되는 email/password prefix 항목은 각 축의 일반 사유가 된다', () => {
    const failure = classifySignupFailure(400, badRequest(['email must be shorter than 200 characters', 'password is too weak']));
    expect(failure.username[0]).toContain('아이디 조건');
    expect(failure.password[0]).toContain('비밀번호 조건');
    expect(failure.other).toEqual([]);
  });

  it('축 미상 항목은 other 에 원문 그대로 보존된다', () => {
    expect(classifySignupFailure(400, badRequest(['role should not exist'])).other).toEqual(['role should not exist']);
  });
});

describe('negative cases', () => {
  it('① 409 결과에 형식/길이 문구가 섞이지 않는다', () => {
    const lines = allLines(409, badRequest('email already exists: a@b.com'));
    expect(lines).not.toContain('형식');
    expect(lines).not.toContain(`${PASSWORD_MIN_LENGTH}자`);
  });

  it('② 400 결과에 중복 문구가 섞이지 않는다', () => {
    expect(allLines(400, badRequest(['email must be an email']))).not.toContain('이미 등록');
  });

  it('③ 금지된 포괄 문구가 어떤 출력에도 없다', () => {
    const cases: [number, string][] = [
      [409, badRequest('dup')],
      [400, badRequest(['email must be an email', 'password should not be empty'])],
      [400, 'not-json'],
      [0, ''],
      [500, badRequest('boom')],
    ];
    for (const [status, body] of cases) {
      expect(allLines(status, body)).not.toContain(FORBIDDEN_PHRASE);
    }
  });

  it('④ 사용자가 입력한 비밀번호 값이 결과 문자열에 노출되지 않는다', () => {
    const secret = 'hunter2-super-secret';
    expect(allLines(400, badRequest(['password must be longer than or equal to 8 characters']))).not.toContain(secret);
  });

  it('⑤ 미지 status 에서는 축별 배열이 비고 other 만 채워진다', () => {
    for (const status of [0, 500]) {
      const failure = classifySignupFailure(status, '');
      expect(failure.kind).toBe('unknown');
      expect(failure.username).toEqual([]);
      expect(failure.password).toEqual([]);
      expect(failure.other).toHaveLength(1);
      expect(failure.other[0]).toContain(`${status}`);
    }
  });
});

describe('formatSignupFailure', () => {
  it('각 줄이 어느 입력의 문제인지 접두사로 드러낸다', () => {
    const lines = formatSignupFailure({
      kind: 'invalid-input',
      username: ['아이디 사유'],
      password: ['비밀번호 사유'],
      other: ['기타 사유'],
    });
    expect(lines).toEqual(['아이디: 아이디 사유', '비밀번호: 비밀번호 사유', '기타: 기타 사유']);
  });

  it('사유가 하나도 없으면 빈 목록을 반환한다(문구를 지어내지 않는다)', () => {
    expect(formatSignupFailure({ kind: 'unknown', username: [], password: [], other: [] })).toEqual([]);
  });

  it('비밀번호 최소 길이 상수가 셋업 폼 안내 문구의 정본 값과 어긋나지 않는다', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(FORM_PASSWORD_MIN_LENGTH);
  });
});
