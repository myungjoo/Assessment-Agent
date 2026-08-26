// signup(POST /api/users) 실패 응답을 "어떤 입력이 어떤 조건을 위반했는지" 로 분류하는
// 순수 helper — REQ-068(구체 사유 표시 · 포괄 문구 금지) / REQ-069(중복 vs 형식·길이 구분).
// 부수효과 0 · 네트워크 접근 0. auth.signup 시그니처와 AppShell / AdminView 배선 교체는
// 후속 slice 책임(T-1712 Out of Scope).

// 비밀번호 최소 길이 — 정본은 backend 의 src/user/dto/add-user.dto.ts 의 동명 상수이며 web 은
// 별도 package 라 값만 동기한다(components/SuperAdminSetupForm.tsx 의 동명 상수와 같아야 하고
// spec 이 그 일치를 guard 한다).
export const PASSWORD_MIN_LENGTH = 8;

// 실패의 대분류 — 409 중복 / 400 입력 위반 / 그 외. REQ-069 는 앞 둘의 혼동을 금지한다.
export type SignupFailureKind = 'duplicate-username' | 'invalid-input' | 'unknown';

// 축별 한국어 사유 목록. 어느 축에도 매핑하지 못한 사유는 other 에 보존해 정보 유실을 막는다.
export interface SignupFailure {
  kind: SignupFailureKind;
  username: string[];
  password: string[];
  other: string[];
}

// 중복 전용 문구 — 형식/길이 문구와 어휘가 겹치지 않아야 한다(REQ-069 구분 축).
const DUPLICATE_USERNAME_REASON = '이미 등록된 아이디입니다. 다른 아이디로 다시 시도해 주세요.';

// class-validator 문구 → 축 + 한국어 사유 매핑표. 대상은 AddUserDto 의 decorator 4 종이 실제로
// 만들어 내는 6 패턴뿐이며(마지막 1 종은 아래 prefix 분기), 그 너머 확장은 Out of Scope.
const MESSAGE_MAP: Record<string, { axis: 'username' | 'password'; reason: string }> = {
  'email must be an email': { axis: 'username', reason: '아이디는 email 형식이어야 합니다 (예: admin@example.com).' },
  'email should not be empty': { axis: 'username', reason: '아이디를 입력해 주세요 — 빈 값은 사용할 수 없습니다.' },
  'password must be longer than or equal to 8 characters': { axis: 'password', reason: `비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.` },
  'password should not be empty': { axis: 'password', reason: '비밀번호를 입력해 주세요 — 빈 값은 사용할 수 없습니다.' },
  'password must be a string': { axis: 'password', reason: '비밀번호는 문자열이어야 합니다.' },
};

// 서버가 준 원문을 한 줄로 정규화한다 — 공백 축약 + 길이 상한(과도한 본문 표시 방지).
function normalize(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > 120 ? `${collapsed.slice(0, 120)}…` : collapsed;
}

// 응답 body 에서 class-validator message 항목들을 뽑는다. JSON 이 아니거나 message 키가 없거나
// 형태가 비정상이면 throw 없이 빈 목록 + parsed=false 로 흡수한다(호출측이 원문을 보존).
function extractMessages(body: string): { items: string[]; parsed: boolean } {
  let payload: unknown;
  try {
    payload = JSON.parse(body.trim());
  } catch {
    return { items: [], parsed: false };
  }
  if (payload === null || typeof payload !== 'object') {
    return { items: [], parsed: false };
  }
  const message = (payload as { message?: unknown }).message;
  if (typeof message === 'string') {
    return { items: [message], parsed: true };
  }
  if (Array.isArray(message)) {
    // 배열 안의 비문자열 요소도 버리지 않고 문자열화해 보존한다.
    return {
      items: message.map((entry) => (typeof entry === 'string' ? entry : String(JSON.stringify(entry)))),
      parsed: true,
    };
  }
  return { items: [], parsed: false };
}

// HTTP status + 응답 body 원문을 축별 구체 사유로 분류한다. 어떤 입력에도 throw 하지 않는다.
export function classifySignupFailure(status: number, body: string): SignupFailure {
  const failure: SignupFailure = { kind: 'unknown', username: [], password: [], other: [] };

  if (status === 409) {
    // 중복 축 — 형식/길이 사유를 절대 섞지 않는다(REQ-069).
    failure.kind = 'duplicate-username';
    failure.username.push(DUPLICATE_USERNAME_REASON);
    return failure;
  }

  if (status === 400) {
    // 입력 위반 축 — 중복 문구를 절대 섞지 않는다(REQ-069).
    failure.kind = 'invalid-input';
    const { items, parsed } = extractMessages(body);
    for (const item of items) {
      const mapped = MESSAGE_MAP[item];
      if (mapped !== undefined) {
        failure[mapped.axis].push(mapped.reason);
      } else if (item.startsWith('email')) {
        failure.username.push(`아이디 조건을 확인해 주세요: ${normalize(item)}`);
      } else if (item.startsWith('password')) {
        failure.password.push(`비밀번호 조건을 확인해 주세요: ${normalize(item)}`);
      } else {
        // 축 미상 — 원문을 그대로 보존해 정보 유실을 막는다.
        failure.other.push(normalize(item));
      }
    }
    if (!parsed) {
      const raw = normalize(body);
      failure.other.push(
        raw === '' ? '입력값을 다시 확인해 주세요 — 서버가 상세 사유를 주지 않았습니다.' : `서버 응답: ${raw}`,
      );
    }
    return failure;
  }

  // 그 외 status(0 네트워크 · 401 · 5xx 등) — 축별 사유를 지어내지 않고 other 1 줄만 남긴다.
  failure.other.push(`요청을 처리하지 못했습니다 (응답 상태 ${status}). 잠시 후 다시 시도해 주세요.`);
  return failure;
}

// 화면 표시용 줄 목록으로 변환한다 — 각 줄이 어느 입력의 문제인지 접두사로 드러낸다.
// 여러 사유를 하나의 포괄 문구로 병합하지 않는다(REQ-068 금지 조항).
export function formatSignupFailure(failure: SignupFailure): string[] {
  return [
    ...failure.username.map((reason) => `아이디: ${reason}`),
    ...failure.password.map((reason) => `비밀번호: ${reason}`),
    ...failure.other.map((reason) => `기타: ${reason}`),
  ];
}
