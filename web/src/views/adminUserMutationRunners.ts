// AdminView 의 사용자 생성(POST /api/users) mutation 러너와 그 실패 문구 파생 helper 군을 담는
// 모듈 — T-1872 순수 추출. AdminView.tsx 가 4,497 줄로 남아있는 god component 부채(PLAN 183 행)를
// 갚는 열째 실분할이며, 본 모듈의 심볼은 AdminView 에서 **본문 한 줄도 바꾸지 않고** 옮겨온 것이다
// (동작 · 계약 · spec 무변경 — 선언 앞 export 키워드만 붙였다). 각 선언 위의 주석 블록은 그 러너가
// 막는 결함의 가드 근거 정본이라 함께 옮겼다. 배치를 web/src/views/ 아래로 잡은 이유는 이동 블록이
// 발사 primitive(create)와 상태 setter 를 전부 deps 로 주입받아 남는 외부 의존이 분류기 · 문구
// 파생 helper 3 개뿐이기 때문이다. JSX 가 없으므로 확장자는 .ts 다(adminScheduleRunners 선례 동형).
//
// 축 마감 이력 — 사용자 관리 mutation 축 17 심볼은 두 slice 로 나눠 옮겼다. T-1872 가 생성 축 7
// 심볼 + 동반 상수 2 를, 이어서 T-1873 이 잔여인 권한 · 역할 축 10 심볼(buildInstanceAccessPath ·
// InstanceAccessFormInput · InstanceAccessFormFlags · deriveInstanceAccessFormFlags ·
// GrantInstanceAccessDeps · runGrantInstanceAccess · RevokeInstanceAccessDeps ·
// runRevokeInstanceAccess · ChangeRoleDeps · runChangeRole) + 동반 상수 4 를 같은 규약(본문 무변경 ·
// 선언 앞 export 부착만)으로 옮겨 축을 마감했다. 두 slice 로 나눈 이유는 한 번에 옮기면 동반 갱신할
// drift-guard spec 이 늘어 파일 cap(≤ 5)을 넘길 위험이 있었기 때문이다(cap 은 LOC 만 면제되고 파일
// 수는 예외가 없다 — .claude/agents/planner.md § Estimate model).
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
// 이동 범위 보정 — 러너가 직접 참조하는 모듈 상수도 본문 무변경으로 함께 옮겼다. T-1872 가
// USERS_PATH · USER_DUPLICATE_ERROR 를, T-1873 이 USER_ROLE_FORBIDDEN_ERROR ·
// INSTANCE_ACCESS_DUPLICATE_ERROR · INSTANCE_ACCESS_GRANTED_TEXT · INSTANCE_ACCESS_REVOKED_TEXT 를
// 옮겼다. AdminView 에 남겨두면 본 모듈 → AdminView 역방향 import 가 생겨 위 단방향 규약을 깨뜨리기
// 때문이다(GROUPS_PATH 를 옮긴 T-1854 · PERSONS_PATH 를 옮긴 T-1856 · SCHEDULES_PATH 를 옮긴 T-1869
// 선례 동형). USERS_PATH 는 잔류 소비처(buildUsersPath)도 쓰므로 AdminView 가 본 모듈에서 import 해
// 쓴다. 반대로 INSTANCE_ACCESS_NO_USER_LABEL 은 markup 의 select 빈 선택지 라벨이라 러너가 쓰지
// 않으므로 AdminView 에 잔류시켰다 — 아래 "부여 문구 3종" 주석의 셋째 문구가 그것이다.
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

// 역할 변경 403(권한 부족) 전용 문구(T-1162 — USER_DUPLICATE_ERROR 동형). PATCH /api/users/:id/role
// 은 @Roles("SuperAdmin") 이라 비-SuperAdmin actor 는 403 이 확정이다. UI 는 SuperAdmin 에게만
// 콜백을 내려 사전 차단하지만(gating), 등급 stale·backend self-demote 금지 같은 잔여 403 은
// "HTTP 403: …" 일반 문구 대신 원인이 분명한 전용 문구로 표면화한다. §12 한국어.
export const USER_ROLE_FORBIDDEN_ERROR = '역할을 변경할 권한이 없습니다';

// 인스턴스 접근 권한 부여 문구 3종(T-1166 — USER_DUPLICATE_ERROR 동형). 409 는 prisma 의 model
// UserInstanceAccess @@unique([userId, instanceRef]) → P2002 → ConflictException 확정이라 전용 문구.
// 조회 계약 부재 — instance-access 는 GET(목록) endpoint 가 없어 재조회 nonce bump 로 결과를 보여줄
// 수 없으므로 성공은 role="status" 안내 문구로만 피드백한다(usersRefreshNonce 는 건드리지 않는다).
export const INSTANCE_ACCESS_DUPLICATE_ERROR = '이미 부여된 인스턴스 접근 권한입니다';
export const INSTANCE_ACCESS_GRANTED_TEXT = '인스턴스 접근 권한을 부여했습니다';
// 회수 성공 문구(T-1167). revoke 는 부재 binding 도 idempotent no-op(삭제 count 0 이어도 에러 없이
// 204, ADR-0027 §4)이라 "원래 없던 권한" 을 회수해도 이 문구가 뜬다 — 최종 상태(그 권한 없음)가
// 사용자가 원한 상태와 같으므로 성공 표면으로 통일한다(별도 "이미 없음" 분기 신설 0).
export const INSTANCE_ACCESS_REVOKED_TEXT = '인스턴스 접근 권한을 회수했습니다';

// 부여 path 빌더(T-1166) — runChangeRole 의 role path 조립 동형(id 는 encodeURIComponent 인코딩).
export function buildInstanceAccessPath(userId: string): string {
  return `${USERS_PATH}/${encodeURIComponent(userId)}/instance-access`;
}

// 인스턴스 접근 폼 비활성 파생 입력(T-1168) — 부여 POST·회수 DELETE 의 in-flight 플래그와 폼 입력
// 2 개(userId 미선택 / instanceRef 공백만은 각각 빈 값과 동치).
export interface InstanceAccessFormInput {
  granting: boolean;
  revoking: boolean;
  userId: string;
  instanceRef: string;
}

// 파생 결과(T-1168) — select·input 은 busy(어느 방향이든 진행 중)를, 부여·회수 버튼은 공통
// actionDisabled(busy 또는 미선택 또는 주소 미입력)를 쓴다.
export interface InstanceAccessFormFlags {
  busy: boolean;
  actionDisabled: boolean;
}

// (a) 결함: 이 파생을 컨테이너 본문·markup 안 인라인 식으로 두면(`granting || revoking` 과 버튼마다
// 반복되는 `busy || !userId || !instanceRef.trim()`) 한쪽 진행 플래그 누락·`||`→`&&` 오타·trim 누락이
// 어떤 test 도 깨지 않고 지나간다 — 실제 결과는 부여 발사 중에 회수 버튼이 살아 있어 같은 사용자에게
// 두 방향 mutation 이 동시에 나가는 교차 발사 창이다(러너 자체 가드는 각자 방향만 막는다).
// (b) 그래서 파생만 인자 → 반환 순수 helper 로 뽑는다 — ADR-0040 §5 로 jsdom/RTL 상태 구동 렌더
// test 가 불가한 현 harness 에서는 helper 직접 호출만이 진리표 전량을 고정할 수 있고, 컨테이너가 그
// 결과를 실제로 쓰는지는 소스 문자열 drift guard(T-1165 선례)가 받친다. React import·state·부수효과
// 0 이라 같은 인자면 항상 같은 결과다(인자 객체도 변형하지 않는다).
export function deriveInstanceAccessFormFlags(input: InstanceAccessFormInput): InstanceAccessFormFlags {
  const busy = input.granting || input.revoking;
  return {
    busy,
    // 두 버튼은 이 한 값을 공유한다(비활성 조건 분화 금지 — 한쪽만 살아나는 창을 원천 차단).
    actionDisabled: busy || !input.userId || !input.instanceRef.trim(),
  };
}

// 부여 POST + state-전이 deps(T-1166 — 위 CreateUserDeps 1:1 mirror, 필드 의미는 그쪽 주석). 조회
// endpoint 부재라 bumpRefresh 대신 성공 안내 setter(setGrantNotice — error 와 상호 배타)를 두고,
// resetInput 은 인스턴스 입력만 비운다(선택 사용자 유지 — 연속 부여 편의).
export interface GrantInstanceAccessDeps {
  grant: (path: string, options: RequestOptions) => Promise<unknown>;
  describeError: (e: unknown) => string;
  isConflict: (e: unknown) => boolean;
  granting: boolean;
  setGranting: (next: boolean) => void;
  setGrantError: (next: string | undefined) => void;
  setGrantNotice: (next: string | undefined) => void;
  resetInput: () => void;
}

// 부여 POST(body `{ instanceRef }`) + state-전이를 캡슐화한 순수 async 러너(T-1166 — 위
// runCreateUser mirror. backend user-instance-access.controller @Post() 은 @Roles("Admin") 이며
// 400/403(self-grant)/404/409(중복) 를 낸다). 성공 시 bump 대신 안내 문구 set 만 다르다.
export async function runGrantInstanceAccess(
  userId: string,
  instanceRef: string,
  deps: GrantInstanceAccessDeps,
): Promise<void> {
  // 발사 억제 가드(no-op — 상태 전이 0). 공백만 instanceRef 는 DTO @IsNotEmpty 로 400 확정.
  const trimmedId = userId?.trim();
  const trimmedRef = instanceRef?.trim();
  if (!trimmedId || !trimmedRef || deps.granting) {
    return;
  }
  deps.setGranting(true);
  deps.setGrantError(undefined);
  deps.setGrantNotice(undefined);
  try {
    await deps.grant(buildInstanceAccessPath(trimmedId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceRef: trimmedRef }),
    });
    deps.setGrantNotice(INSTANCE_ACCESS_GRANTED_TEXT);
    deps.resetInput();
  } catch (e) {
    if (deps.isConflict(e)) {
      deps.setGrantError(INSTANCE_ACCESS_DUPLICATE_ERROR);
    } else {
      deps.setGrantError(deps.describeError(e));
    }
  } finally {
    deps.setGranting(false);
  }
}

// 회수 DELETE + state-전이 deps(T-1167 — 위 GrantInstanceAccessDeps 1:1 mirror, 필드 의미는 그쪽
// 주석). 차이는 isConflict 부재 하나뿐 — service.revoke 는 부재 binding 을 idempotent 성공(204)
// 으로 처리해 409 자체가 발생하지 않으므로(ADR-0027 §4) 전용 분기·전용 문구를 두지 않는다.
export interface RevokeInstanceAccessDeps {
  revoke: (path: string, options: RequestOptions) => Promise<unknown>;
  describeError: (e: unknown) => string;
  revoking: boolean;
  setRevoking: (next: boolean) => void;
  setRevokeError: (next: string | undefined) => void;
  setRevokeNotice: (next: string | undefined) => void;
  resetInput: () => void;
}

// 회수 DELETE(body `{ instanceRef }`) + state-전이를 캡슐화한 순수 async 러너(T-1167 — 위
// runGrantInstanceAccess mirror. backend user-instance-access.controller @Delete() 은 grant 와
// 같은 path·같은 DTO 이고 @HttpCode(204) 라 성공 body 가 없어 반환값을 쓰지 않는다). 403(self-revoke)
// /404(대상 부재)/400 은 전용 문구 없이 전부 describeError 일반 경로로 표면화한다.
export async function runRevokeInstanceAccess(
  userId: string,
  instanceRef: string,
  deps: RevokeInstanceAccessDeps,
): Promise<void> {
  // 발사 억제 가드(no-op — 상태 전이 0). 공백만 instanceRef 는 DTO @IsNotEmpty 로 400 확정.
  const trimmedId = userId?.trim();
  const trimmedRef = instanceRef?.trim();
  if (!trimmedId || !trimmedRef || deps.revoking) {
    return;
  }
  deps.setRevoking(true);
  deps.setRevokeError(undefined);
  deps.setRevokeNotice(undefined);
  try {
    await deps.revoke(buildInstanceAccessPath(trimmedId), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceRef: trimmedRef }),
    });
    deps.setRevokeNotice(INSTANCE_ACCESS_REVOKED_TEXT);
    deps.resetInput();
  } catch (e) {
    deps.setRevokeError(deps.describeError(e));
  } finally {
    deps.setRevoking(false);
  }
}

// 사용자 역할 변경 PATCH + state-전이 deps(T-1162 — 위 CreateUserDeps 1:1 mirror, 필드 의미는 그쪽
// 주석). 생성과 달리 입력 폼이 없어 resetInput 이 없고, 409(중복) 대신 403(권한 부족)을 분기한다.
export interface ChangeRoleDeps {
  patch: (path: string, options: RequestOptions) => Promise<unknown>;
  describeError: (e: unknown) => string;
  isForbidden: (e: unknown) => boolean;
  // 현재 PATCH 진행 중인 사용자 id(T-1164 — 기존 boolean `changing` 을 대체). undefined 는 "진행
  // 없음" 을 뜻하며, truthy 면 그 id 의 역할 변경 요청이 in-flight 라는 사실을 그대로 표현한다.
  changingId: string | undefined;
  // 진행 중인 사용자 id setter — 발사 시작 시 대상 id, 종료 시 undefined("진행 없음")를 넣는다.
  setChangingId: (next: string | undefined) => void;
  setChangeError: (next: string | undefined) => void;
  bumpRefresh: () => void;
}

// 사용자 역할 변경 PATCH /api/users/:id/role(body `{ role }`) + state-전이를 캡슐화한 순수 async
// 러너(T-1162 — 위 runCreateUser mirror). backend(user.controller @Patch(":id/role"), @Roles
// ("SuperAdmin"), ChangeRoleDto 검증 실패 → 400, 비-SuperAdmin·self-demote → 403, 대상 부재 →
// 404, 응답 UserResponseDto)를 발사한다. 동작: 빈 인자·in-flight 면 미발사 / 발사 시 진행 on +
// 직전 error 비움 / 성공 시 재조회 bump(낙관 갱신 금지 — 권위 재조회) / 실패는 throw 없이 error
// state(403 전용 문구, 그 외 describeError 파생) / off 는 finally 공통.
export async function runChangeRole(
  id: string,
  nextRole: string,
  deps: ChangeRoleDeps,
): Promise<void> {
  // 발사 억제 가드(no-op — 상태 전이 0). id·nextRole 이 빈 값이면 `/api/users//role` 같은 깨진
  // path 나 400 확정 body 를 만들지 않는다.
  const trimmedId = id?.trim();
  const trimmedRole = nextRole?.trim();
  // 단일 in-flight 정책 — 진행 중인 id 가 무엇이든(다른 사용자 행이어도) 새 발사는 no-op.
  if (!trimmedId || !trimmedRole || deps.changingId) {
    return;
  }
  // 진행 id 로는 trim 하지 않은 원본 id 를 박제한다(T-1164) — UserList 는 `row.id === changingRoleId`
  // 원본 동등 비교로 진행 행을 찾으므로 trim 값을 넣으면 진행 표시가 매칭되지 않는다. 아래 PATCH
  // path 의 encodeURIComponent(trimmedId) 와 값이 의도적으로 다를 수 있다(각각 별개 계약).
  deps.setChangingId(id);
  deps.setChangeError(undefined);
  try {
    // id 는 encodeURIComponent 로 안전 인코딩(비정상 문자가 든 id 도 path 가 깨지지 않게).
    await deps.patch(`${USERS_PATH}/${encodeURIComponent(trimmedId)}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: trimmedRole }),
    });
    // 권위 재조회 — 응답 body 로 목록을 낙관 갱신하지 않고 nonce bump 로 GET 을 다시 발사한다.
    deps.bumpRefresh();
  } catch (e) {
    if (deps.isForbidden(e)) {
      deps.setChangeError(USER_ROLE_FORBIDDEN_ERROR);
    } else {
      deps.setChangeError(deps.describeError(e));
    }
  } finally {
    // 성공·실패 무관하게 진행 id 를 비운다(진행 표시 영구 잔류 0 — 기존 setChanging(false) 동형).
    deps.setChangingId(undefined);
  }
}
