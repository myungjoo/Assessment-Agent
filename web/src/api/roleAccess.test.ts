import { describe, expect, it } from 'vitest';
import {
  ROLE_ORDER,
  canEditAssessmentTargets,
  canViewAssessmentTargets,
  hasRoleAtLeast,
} from './roleAccess';
import type { CurrentUser } from './auth';

// R-112 — 평가 대상 편집/조회 권한 판정 모듈(T-1719, REQ-073) 검증. 순수 함수라 mock 0.
// 등급 토큰 정본은 backend 의 ROLE_HIERARCHY(src/auth/roles.guard.ts 41~45 행) 이며,
// 아래 drift guard 가 web 쪽 철자가 그것과 어긋나는 순간 fail 하게 한다.

// role 만 바꿔 가며 쓰는 CurrentUser 픽스처 helper.
const userWith = (role: string): CurrentUser => ({
  id: 'u-1',
  email: 'a@b.com',
  role,
});

describe('roleAccess — happy path', () => {
  it('Admin 사용자는 평가 대상을 편집할 수 있다', () => {
    expect(canEditAssessmentTargets(userWith('Admin'))).toBe(true);
  });

  it('SuperAdmin 사용자도 편집할 수 있다 (Admin 이상)', () => {
    expect(canEditAssessmentTargets(userWith('SuperAdmin'))).toBe(true);
  });

  it('User 사용자는 평가 대상을 조회할 수 있다', () => {
    expect(canViewAssessmentTargets(userWith('User'))).toBe(true);
  });

  it('인증된 3 등급 모두 조회는 허용된다', () => {
    for (const role of ['User', 'Admin', 'SuperAdmin']) {
      expect(canViewAssessmentTargets(userWith(role))).toBe(true);
    }
  });
});

describe('roleAccess — error path (입력 결손 · 미인증)', () => {
  it('user 가 null(미인증) 이면 두 함수 모두 throw 없이 false 를 반환한다', () => {
    expect(() => canEditAssessmentTargets(null)).not.toThrow();
    expect(canEditAssessmentTargets(null)).toBe(false);
    expect(canViewAssessmentTargets(null)).toBe(false);
  });

  it('user 가 undefined 여도 두 함수 모두 throw 없이 false 를 반환한다', () => {
    expect(() => canViewAssessmentTargets(undefined)).not.toThrow();
    expect(canEditAssessmentTargets(undefined)).toBe(false);
    expect(canViewAssessmentTargets(undefined)).toBe(false);
  });

  it('role 필드가 결손된 객체(타입 우회) 여도 throw 없이 false 다', () => {
    const broken = { id: 'u-1', email: 'a@b.com' } as unknown as CurrentUser;
    expect(() => canEditAssessmentTargets(broken)).not.toThrow();
    expect(canEditAssessmentTargets(broken)).toBe(false);
    expect(canViewAssessmentTargets(broken)).toBe(false);
  });
});

describe('hasRoleAtLeast — 분기 cover', () => {
  it('(a) role 이 required 보다 상위면 true', () => {
    expect(hasRoleAtLeast('SuperAdmin', 'Admin')).toBe(true);
    expect(hasRoleAtLeast('Admin', 'User')).toBe(true);
  });

  it('(b) role 이 required 와 동일하면 true', () => {
    expect(hasRoleAtLeast('Admin', 'Admin')).toBe(true);
    expect(hasRoleAtLeast('User', 'User')).toBe(true);
    expect(hasRoleAtLeast('SuperAdmin', 'SuperAdmin')).toBe(true);
  });

  it('(c) role 이 required 보다 하위면 false', () => {
    expect(hasRoleAtLeast('User', 'Admin')).toBe(false);
    expect(hasRoleAtLeast('Admin', 'SuperAdmin')).toBe(false);
  });

  it('(d) role 이 미지 문자열이면 false (권한 있음으로 해석하지 않는다)', () => {
    expect(hasRoleAtLeast('Root', 'User')).toBe(false);
    expect(hasRoleAtLeast('', 'User')).toBe(false);
  });

  it('(e) required 가 미지 문자열이면 false (조건 없음으로 해석하지 않는다)', () => {
    expect(hasRoleAtLeast('SuperAdmin', 'Root')).toBe(false);
    expect(hasRoleAtLeast('SuperAdmin', '')).toBe(false);
  });

  it('(f) role 이 null 또는 undefined 면 false', () => {
    expect(hasRoleAtLeast(null, 'User')).toBe(false);
    expect(hasRoleAtLeast(undefined, 'User')).toBe(false);
  });
});

describe('roleAccess — negative cases (거부 fail-safe)', () => {
  it('① User 등급은 편집 판정이 false 다 (조회만 가능)', () => {
    expect(canEditAssessmentTargets(userWith('User'))).toBe(false);
  });

  it('② role 이 빈 문자열이면 편집·조회 모두 false', () => {
    expect(canEditAssessmentTargets(userWith(''))).toBe(false);
    expect(canViewAssessmentTargets(userWith(''))).toBe(false);
  });

  it('③ 소문자 admin 은 인정하지 않는다 (backend 토큰과 정확히 일치할 때만)', () => {
    expect(canEditAssessmentTargets(userWith('admin'))).toBe(false);
    expect(canViewAssessmentTargets(userWith('user'))).toBe(false);
    expect(hasRoleAtLeast('ADMIN', 'Admin')).toBe(false);
  });

  it('④ 미지 등급(Root · Guest) 은 편집·조회 모두 false', () => {
    expect(canEditAssessmentTargets(userWith('Root'))).toBe(false);
    expect(canViewAssessmentTargets(userWith('Guest'))).toBe(false);
  });

  it('⑤ user 가 null 이면 편집·조회 모두 false', () => {
    expect(canEditAssessmentTargets(null)).toBe(false);
    expect(canViewAssessmentTargets(null)).toBe(false);
  });

  it('⑥ role 이 비문자열(타입 우회) 이어도 throw 없이 false', () => {
    const numeric = userWith(42 as unknown as string);
    expect(() => canEditAssessmentTargets(numeric)).not.toThrow();
    expect(canEditAssessmentTargets(numeric)).toBe(false);
    expect(canViewAssessmentTargets(numeric)).toBe(false);
    expect(hasRoleAtLeast(42 as unknown as string, 'User')).toBe(false);
    // prototype 오염 경로(toString 등) 도 등급으로 해석되면 안 된다.
    expect(hasRoleAtLeast('toString', 'User')).toBe(false);
    expect(hasRoleAtLeast('SuperAdmin', 'constructor')).toBe(false);
  });
});

describe('ROLE_ORDER — backend ROLE_HIERARCHY 동기 회귀 방지', () => {
  it('등급 토큰 3 종의 철자가 backend 키와 정확히 같다', () => {
    // backend src/auth/roles.guard.ts 41~45 행의 ROLE_HIERARCHY 키 집합과 동일해야 한다.
    expect(Object.keys(ROLE_ORDER).sort()).toEqual(['Admin', 'SuperAdmin', 'User']);
  });

  it('서열이 User < Admin < SuperAdmin 이다', () => {
    expect(ROLE_ORDER.User).toBeLessThan(ROLE_ORDER.Admin);
    expect(ROLE_ORDER.Admin).toBeLessThan(ROLE_ORDER.SuperAdmin);
  });
});
