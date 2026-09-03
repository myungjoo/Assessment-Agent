// AdminView 의 사용자 생성(POST /api/users) mutation 러너와 그 실패 문구 파생 helper 군을 담는
// 모듈 — T-1872 순수 추출. AdminView.tsx 가 4,497 줄로 남아있는 god component 부채(PLAN 183 행)를
// 갚는 열째 실분할이며, 본 모듈의 심볼은 AdminView 에서 **본문 한 줄도 바꾸지 않고** 옮겨온 것이다
// (동작 · 계약 · spec 무변경 — 선언 앞 export 키워드만 붙였다). 각 선언 위의 주석 블록은 그 러너가
// 막는 결함의 가드 근거 정본이라 함께 옮겼다. 배치를 web/src/views/ 아래로 잡은 이유는 이동 블록이
// 발사 primitive(create)와 상태 setter 를 전부 deps 로 주입받아 남는 외부 의존이 분류기 · 문구
// 파생 helper 3 개뿐이기 때문이다. JSX 가 없으므로 확장자는 .ts 다(adminScheduleRunners 선례 동형).
//
// 경계를 생성 축으로 좁힌 이유 — 재지목된 사용자 관리 mutation 축은 17 심볼이라 한 slice 로 옮기면
// 동반 갱신할 drift-guard spec 이 늘어 파일 cap(≤ 5)을 넘길 위험이 있다(cap 은 LOC 만 면제되고 파일
// 수는 예외가 없다 — .claude/agents/planner.md § Estimate model). PLAN 183 행 bullet 이 제시한
// 절단선대로 생성 축 7 심볼 + 동반 상수 2 만 옮기면 고칠 spec 이 1 개라 총 4 파일로 cap 안에 든다.
// 잔여 권한 · 역할 축 10 심볼(buildInstanceAccessPath · runGrantInstanceAccess ·
// runRevokeInstanceAccess · runChangeRole 등)은 후속 slice 로 넘기고, 본 slice 는 그들이 아래
// USERS_PATH 를 import 하도록 배선만 갈아끼운다.
//
// AdminView 와의 방향: AdminView → 본 모듈(값 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를
// 넓히지 말고 Follow-ups 로 남긴다). AdminView 파일 끝 export 배럴은 임포트한 값 5 개
// (runCreateUser · describeCreateUserFailure · describeCreateUserFailureLines ·
// hasCreateUserErrorLines · CREATE_USER_ERROR_LINE_CLASS)를 그대로 re-export 하고, deps 타입
// CreateUserDeps 도 이동 전부터 `export type {` 표면이었으므로 그대로 re-export 한다(공개 표면
// 무변경). 이동 전 export 가 아니던 상수 3 개(USERS_PATH · USER_DUPLICATE_ERROR ·
// CREATE_USER_ERROR_SEPARATOR)는 AdminView 에서 새로 export 하지 않는다. 덕분에 기존 spec
// (AdminView.create-user-contract · AdminView.create-user-failure · AdminView.test.tsx 등)의
// AdminView 배럴 import 경로가 수정 없이 그대로 산다(역방향 import 탐지 grep 이 본 주석에
// 걸리지 않도록 모듈 경로 리터럴은 적지 않는다).
//
// 이동 범위 보정 — 러너가 직접 참조하는 모듈 상수 2 개(USERS_PATH · USER_DUPLICATE_ERROR)도 본문
// 무변경으로 함께 옮겼다. AdminView 에 남겨두면 본 모듈 → AdminView 역방향 import 가 생겨 위
// 단방향 규약을 깨뜨리기 때문이다(GROUPS_PATH 를 옮긴 T-1854 · PERSONS_PATH 를 옮긴 T-1856 ·
// SCHEDULES_PATH 를 옮긴 T-1869 선례 동형). USERS_PATH 는 잔류 소비처(buildUsersPath ·
// buildInstanceAccessPath · runChangeRole)도 쓰므로 AdminView 가 본 모듈에서 import 해 쓴다.
import { ApiError } from '../api/apiClient';
import type { RequestOptions } from '../api/apiClient';
import { toErrorMessage } from '../api/useApiResource';
import { classifySignupFailure, formatSignupFailure } from '../api/signupError';

// 사용자 조회 path(T-1159) — 고정 endpoint(GET /api/users, user.controller @Get() 이 Admin+ RBAC
// 로 UserResponseDto[] 를 envelope 없이 직반환). AdminView 는 사용자를 전혀 조회하지 않아 재사용할
// fetch 가 없으므로 신규 상수로 둔다. 생성·역할 변경 slice 가 아직 없어 refresh nonce 빌더 없이
// 단순 상수 path 로 조회한다(PARTS_PATH 동형 — nonce-aware buildUsersPath 전환은 후속 mutation
// slice 책임). personId 같은 필수 query 없음.
export const USERS_PATH = '/api/users';

// 사용자 생성 409(중복 이메일) 전용 문구(T-1160 — PART_DUPLICATE_ERROR mirror. User.email @unique).
export const USER_DUPLICATE_ERROR = '이미 존재하는 이메일입니다';

// 사용자 추가 실패 사유 줄들을 하나의 error 문자열로 이을 때 쓰는 구분자 (T-1715).
// 값은 AppShell 의 SETUP_ERROR_SEPARATOR 선례와 같다. T-1835 이후 실 표시 경로는 줄 배열
// (createUserErrorLines)을 쓰므로 이 구분자는 화면에 나타나지 않는다 — 단일 문자열 표현이
// 필요한 호출자(describeCreateUserFailure)를 위해서만 남는다. 각 줄의 사유 문장 자체는
// 원문 그대로 보존하며 요약·병합하지 않는다 (REQ-068 포괄 문구 금지).
export const CREATE_USER_ERROR_SEPARATOR = ' / ';

// role="alert" 영역에 붙는 줄 element 의 안정 식별 className (T-1835) — SuperAdminSetupForm 의
// SETUP_ERROR_LINE_CLASS 선례와 같은 취지로, 배선 drift guard 가 이 토큰으로 줄 element 를 짚는다.
export const CREATE_USER_ERROR_LINE_CLASS = 'admin-create-user-error-line';

// 줄 단위 목록이 실제로 렌더할 값을 가졌는지 판정한다 (T-1835 — hasErrorLines mirror).
// 타입을 우회한 비정상 입력(문자열·null 등)도 Array.isArray 로 걸러 throw 0 을 보장한다
// (빈 배열 = 렌더 안 함).
export function hasCreateUserErrorLines(lines: string[] | undefined): boolean {
  return Array.isArray(lines) && lines.length > 0;
}

// 사용자 추가 실패 표면을 화면 문구 **줄 배열** 로 바꾸는 순수 함수 (T-1835 — REQ-084).
// 본 함수가 사유 산출의 정본이며, 아래 describeCreateUserFailure 는 이 결과를 잇기만 한다
// (중복 구현 0 — AppShell 의 buildSetupErrorLines / buildSetupErrorMessage 쌍과 같은 형태).
// 400(AddUserDto 검증 실패)만 축별 구체 사유 줄들로 교체하고, 그 외 모든 입력은 종전
// toErrorMessage 결과 1 줄을 돌려준다. 409(중복)는 러너의 isConflict 분기가 USER_DUPLICATE_ERROR
// 로 먼저 처리하므로 본 함수에 도달하지 않는다 — 도달하더라도 형식/길이 어휘를 섞지 않는다
// (분류기가 409 를 중복 축으로만 매핑한다, REQ-069 구분 축).
// ApiError.message 가 비-2xx 응답 body 원문이라는 apiClient 계약 위에서 성립한다.
// 어떤 입력에도 throw 하지 않으며(분류기·formatter 모두 순수·무-throw) 항상 1 줄 이상을 준다.
export function describeCreateUserFailureLines(e: unknown): string[] {
  if (e instanceof ApiError && e.status === 400) {
    // 분류기가 400 에 대해 최소 1 줄을 보장하므로 결과가 빈 배열이 되지 않는다.
    return formatSignupFailure(classifySignupFailure(e.status, e.message));
  }
  return [toErrorMessage(e)];
}

// 위 줄 배열을 단일 error 문자열로 잇는다 (T-1715 계약 유지 — 파생 표현).
// 단일 문자열 표현을 쓰는 소비처(줄 배열 미주입 러너 경로)가 아직 살아 있으므로 named export
// 계약을 유지한다 — 두 축이 모두 줄 단위로 전환된 뒤 제거 가능 여부를 재평가한다(T-1835 Follow-up).
// (named export 는 파일 말미의 export 블록에서 한다 — 본 파일의 기존 helper 들과 같은 방식.)
export function describeCreateUserFailure(e: unknown): string {
  return describeCreateUserFailureLines(e).join(CREATE_USER_ERROR_SEPARATOR);
}

// 사용자 생성 POST + state-전이 deps(T-1160 — 위 CreatePartDeps 1:1 mirror, 필드 의미는 그쪽 주석).
export interface CreateUserDeps {
  create: (path: string, options: RequestOptions) => Promise<unknown>;
  describeError: (e: unknown) => string;
  isConflict: (e: unknown) => boolean;
  creating: boolean;
  setCreating: (next: boolean) => void;
  setCreateError: (next: string | undefined) => void;
  // 실패 사유 줄 배열 축(T-1835, REQ-084) — optional 이라 기존 deps literal 은 그대로 유효하다.
  // 둘 다 주입되면 러너가 문자열 error 와 **함께** 줄 배열도 표면화한다(문자열 축은 유지).
  // describeErrorLines 가 없으면 [describeError(e)] 1 줄로 되돌아가 join 표현과 어긋나지 않는다.
  describeErrorLines?: (e: unknown) => string[];
  setCreateErrorLines?: (next: string[] | undefined) => void;
  bumpRefresh: () => void;
  resetInput: () => void;
}

// 사용자 생성 POST /api/users(body `{ email, password }`) + state-전이를 캡슐화한 순수 async 러너
// (T-1160 — 위 runCreatePart mirror). backend(user.controller @Post(), guard 없는 Public tier, 201
// Created, AddUserDto 검증 실패 → 400, email 중복 → 409)를 발사한다. 동작: 빈 입력·in-flight 면
// 미발사 / 발사 시 진행 on + 직전 error 비움 / 성공 시 재조회 bump + 입력 초기화 / 실패는 throw
// 없이 error state(409 전용 문구, 그 외 describeError 파생, 입력·nonce 유지) / off 는 finally 공통.
export async function runCreateUser(
  email: string,
  password: string,
  deps: CreateUserDeps,
): Promise<void> {
  // 발사 억제 가드(no-op — 상태 전이 0). password 는 공백도 유효 문자라 빈 문자열만 차단한다.
  const trimmedEmail = email?.trim();
  if (!trimmedEmail || !password || deps.creating) {
    return;
  }
  deps.setCreating(true);
  deps.setCreateError(undefined);
  // 직전 시도의 줄 배열도 함께 비운다 — 안 비우면 성공/새 실패 뒤에도 옛 사유 줄이 남는다.
  deps.setCreateErrorLines?.(undefined);
  try {
    await deps.create(USERS_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, password }),
    });
    deps.bumpRefresh();
    deps.resetInput();
  } catch (e) {
    if (deps.isConflict(e)) {
      deps.setCreateError(USER_DUPLICATE_ERROR);
      // 중복은 축이 하나뿐이라 줄 배열도 같은 문구 1 줄이다(문자열 축과 내용 동일).
      deps.setCreateErrorLines?.([USER_DUPLICATE_ERROR]);
    } else {
      // describeError 는 한 번만 호출한다 — 줄 배열 fallback 에서 다시 부르면 같은 입력에
      // 대해 호출 횟수가 2 배가 되어 호출 수를 세는 기존 spec 과 어긋난다.
      const message = deps.describeError(e);
      deps.setCreateError(message);
      deps.setCreateErrorLines?.(
        deps.describeErrorLines ? deps.describeErrorLines(e) : [message],
      );
    }
  } finally {
    deps.setCreating(false);
  }
}
