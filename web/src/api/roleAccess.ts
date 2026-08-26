// 평가 대상(assessment target) 편집/조회 권한 판정 순수 모듈 — REQ-073 slice 2 (T-1719).
// REQ-073(requirements.md 92 행): "평가 대상 편집은 Admin 등급만, User 등급은 조회만 (RBAC 일관)".
// T-1718 이 연 role 정보원(`fetchCurrentUser(): Promise<CurrentUser | null>`) 위에, 그 role
// 문자열을 받아 권한을 판정하는 **규칙만** 담는다. 실제 UI 노출 차등 배선(nav 필터링 ·
// AdminView 패널 gating · 편집 버튼 비활성화)은 후속 slice 책임(본 task Out of Scope).
//
// 순수성 계약: 네트워크 호출 0 · module-level 가변 상태 0 · throw 0. 어떤 입력(null ·
// undefined · 빈 문자열 · 미지 role · 타입 우회 비문자열)에도 반드시 boolean 을 반환한다.
// signupError.ts 의 "어떤 입력에도 throw 하지 않는 순수 정책 모듈" 관례를 승계한다.

import type { CurrentUser } from './auth';

// 등급 서열 — 값이 클수록 상위 권한. backend 의 ROLE_HIERARCHY
// (src/auth/roles.guard.ts 41~45 행: SuperAdmin ⊇ Admin ⊇ User) 와 같은 서열을 web 쪽에
// mirror 한 것이다. web 과 backend 는 별도 package 라 공유 상수를 import 할 수 없어 값만
// 동기하며, 철자 drift 는 colocated spec 이 guard 한다(roleAccess.test.ts).
// 정본은 어디까지나 backend 이며 web 은 읽기만 한다 — 두 등급표를 하나의 공유 package 로
// 추출하는 일은 하지 않는다(ADR-0040 §5 새-dep 게이트).
export const ROLE_ORDER: Record<string, number> = {
  User: 1,
  Admin: 2,
  SuperAdmin: 3,
};

// 등급 문자열의 서열을 조회한다. 등급표에 없으면 null —
//  - 미지 role 을 "권한 있음" 으로 해석하지 않기 위한 fail-safe 다. 서버가 새 등급을
//    도입했는데 web 이 아직 모르는 상황에서, 모르는 값을 통과시키면 권한 상승이 된다.
//  - 대소문자는 backend 토큰과 **정확히 일치할 때만** 인정한다('admin' 은 미지 취급).
//    backend 의 ROLE_HIERARCHY 키 조회 역시 완전 일치이므로, 여기서 소문자를 관대하게
//    받아주면 web 판정과 서버 판정이 어긋나(화면은 편집 가능한데 API 는 403) 더 나쁘다.
// 비문자열(타입 우회로 들어온 숫자 등)도 같은 경로로 null 이 된다 — Record 조회 전에
// typeof 로 걸러 예외를 만들지 않는다.
function rankOf(role: string | null | undefined): number | null {
  if (typeof role !== 'string') {
    return null;
  }
  const rank = ROLE_ORDER[role];
  return typeof rank === 'number' ? rank : null;
}

// role 이 required 등급 **이상** 인지 판정한다.
// role 이 미지/누락이거나 required 가 미지 등급이면 false(거부 fail-safe) —
// 호출측 오타로 만들어진 미지 required 를 "조건 없음" 으로 해석하면 안 되기 때문이다.
export function hasRoleAtLeast(
  role: string | null | undefined,
  required: string,
): boolean {
  const actual = rankOf(role);
  const needed = rankOf(required);
  if (actual === null || needed === null) {
    return false;
  }
  return actual >= needed;
}

// 평가 대상 편집 권한 — Admin 이상(Admin · SuperAdmin) 만 true (REQ-073 "편집은 Admin 등급만").
// 미인증(user 가 null/undefined) 은 당연히 false.
export function canEditAssessmentTargets(
  user: CurrentUser | null | undefined,
): boolean {
  return hasRoleAtLeast(user?.role, 'Admin');
}

// 평가 대상 조회 권한 — User 이상, 즉 인증된 3 등급 모두 true (REQ-073 "User 등급은 조회만").
// 미인증은 false — 조회조차 인증을 전제로 한다.
export function canViewAssessmentTargets(
  user: CurrentUser | null | undefined,
): boolean {
  return hasRoleAtLeast(user?.role, 'User');
}
