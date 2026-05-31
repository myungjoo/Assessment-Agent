// @CurrentUser() param decorator spec — T-0125 acceptance 박제. R-112 4 카테고리
// (happy / error / branch / negative + negative cases 충분 cover).
//
// 본 spec 의 검증 표면:
//   - currentUserFactory (createParamDecorator wrapping 전 raw factory) 의 직접
//     호출. NestJS createParamDecorator 가 반환한 ParameterDecorator 는 factory
//     를 외부에 노출하지 않으므로 named export 로 분리한 factory 를 직접 test.
//   - CurrentUser (decorator) 가 ParameterDecorator (함수) 인지 contract 확인.
//   - data 분기 (undefined 시 전체 payload / "sub" / "role" / 존재하지 않는 key).
//   - request.user 분기 (정상 object / undefined / null / non-object).
//   - ctx.switchToHttp().getRequest() 가 undefined 반환 시 안전 처리.
//
// ExecutionContext mock 패턴:
//   - 본 factory 는 ctx.switchToHttp().getRequest() 의 결과만 사용 — 다른 ctx
//     method 는 호출 0. 그래서 최소 shape (switchToHttp → { getRequest }) 만 mock.
//   - request 객체의 user 필드만 의미 있음 — 다른 Express request 속성 mock 불요.
import type { ExecutionContext } from "@nestjs/common";

import type { JwtPayload } from "./auth.service";
import { CurrentUser, currentUserFactory } from "./current-user.decorator";

// buildCtx — ExecutionContext mock helper. switchToHttp().getRequest() 가 인자로
// 받은 request 를 반환하는 최소 shape. request 가 undefined 인 경우 (방어 분기)도
// 표현 가능하도록 undefined 허용.
function buildCtx(request: unknown): ExecutionContext {
  return {
    switchToHttp: (): { getRequest: <T = unknown>() => T } => ({
      getRequest: <T = unknown>(): T => request as T,
    }),
  } as unknown as ExecutionContext;
}

describe("@CurrentUser() param decorator", () => {
  // -----------------------------------------------------------------------
  // CurrentUser contract — ParameterDecorator (함수) 임을 확인.
  // -----------------------------------------------------------------------
  it("CurrentUser 는 함수 (NestJS createParamDecorator 반환 contract)", () => {
    expect(typeof CurrentUser).toBe("function");
  });

  // -----------------------------------------------------------------------
  // happy — data 인자 분기 cover (undefined / "sub" / "role")
  // -----------------------------------------------------------------------
  it("happy — data 인자 없이 (undefined) 호출 시 전체 JwtPayload 반환", () => {
    const payload: JwtPayload = {
      sub: "user-1",
      role: "Admin",
      iat: 1700000000,
      exp: 1700009999,
    };
    const ctx = buildCtx({ user: payload });
    const result = currentUserFactory(undefined, ctx);
    expect(result).toEqual(payload);
  });

  it('happy — data="sub" 호출 시 sub claim string 반환', () => {
    const payload: JwtPayload = { sub: "user-42", role: "User" };
    const ctx = buildCtx({ user: payload });
    const result = currentUserFactory("sub", ctx);
    expect(result).toBe("user-42");
  });

  it('happy — data="role" 호출 시 role claim string 반환', () => {
    const payload: JwtPayload = { sub: "user-x", role: "SuperAdmin" };
    const ctx = buildCtx({ user: payload });
    const result = currentUserFactory("role", ctx);
    expect(result).toBe("SuperAdmin");
  });

  it('happy — data="iat" 호출 시 iat claim number 반환 (optional claim 분기)', () => {
    const payload: JwtPayload = { sub: "u", role: "User", iat: 1234567 };
    const ctx = buildCtx({ user: payload });
    const result = currentUserFactory("iat", ctx);
    expect(result).toBe(1234567);
  });

  // -----------------------------------------------------------------------
  // error path — request.user undefined / null 시 undefined 반환 (throw 0).
  // -----------------------------------------------------------------------
  it("error — request.user 가 undefined 일 때 (JwtAuthGuard 미통과 가정) undefined 반환 (throw 0)", () => {
    const ctx = buildCtx({ user: undefined });
    const result = currentUserFactory(undefined, ctx);
    expect(result).toBeUndefined();
  });

  it("error — request.user 가 null 일 때 (방어 분기) undefined 반환 (throw 0)", () => {
    const ctx = buildCtx({ user: null });
    const result = currentUserFactory(undefined, ctx);
    expect(result).toBeUndefined();
  });

  it("error — data 인자가 payload 에 없는 key (예: 'missing') 일 때 undefined 반환 (throw 0)", () => {
    const payload: JwtPayload = { sub: "u", role: "User" };
    const ctx = buildCtx({ user: payload });
    // payload 에 "missing" key 부재 — keyof JwtPayload 외 cast.
    const result = currentUserFactory("missing" as keyof JwtPayload, ctx);
    expect(result).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // branch — data truthy 분기 × user truthy 분기 cross-product 4 case cover
  // -----------------------------------------------------------------------
  it("branch 1 — data=undefined + user=present → 전체 payload (full payload 분기)", () => {
    const payload: JwtPayload = { sub: "a", role: "Admin" };
    const ctx = buildCtx({ user: payload });
    const result = currentUserFactory(undefined, ctx);
    expect(result).toEqual(payload);
  });

  it('branch 2 — data="sub" + user=present → single claim (single claim 분기)', () => {
    const payload: JwtPayload = { sub: "b", role: "User" };
    const ctx = buildCtx({ user: payload });
    const result = currentUserFactory("sub", ctx);
    expect(result).toBe("b");
  });

  it("branch 3 — data=undefined + user=absent → undefined (request.user 부재 분기)", () => {
    const ctx = buildCtx({ user: undefined });
    const result = currentUserFactory(undefined, ctx);
    expect(result).toBeUndefined();
  });

  it('branch 4 — data="sub" + user=absent → undefined (request.user 부재 + data 무관)', () => {
    const ctx = buildCtx({ user: undefined });
    const result = currentUserFactory("sub", ctx);
    expect(result).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // negative cases 충분 cover — 단일 negative 가 아니라 예외 분기마다 각 1+.
  // -----------------------------------------------------------------------

  // type mismatch #1 — request 객체에 user 키 자체 부재 ({} shape).
  it("negative — request 가 빈 객체 (user 키 부재) 시 undefined 반환 (type mismatch — missing key)", () => {
    const ctx = buildCtx({});
    const result = currentUserFactory(undefined, ctx);
    expect(result).toBeUndefined();
  });

  it('negative — request 가 빈 객체 + data="sub" 시 undefined 반환 (type mismatch — missing key + data)', () => {
    const ctx = buildCtx({});
    const result = currentUserFactory("sub", ctx);
    expect(result).toBeUndefined();
  });

  // type mismatch #2 — request.user 가 string / number / boolean 등 non-object.
  it("negative — request.user 가 string 일 때 undefined 반환 (type mismatch — non-object string)", () => {
    const ctx = buildCtx({ user: "not-an-object" });
    const result = currentUserFactory(undefined, ctx);
    expect(result).toBeUndefined();
  });

  it("negative — request.user 가 number 일 때 undefined 반환 (type mismatch — non-object number)", () => {
    const ctx = buildCtx({ user: 12345 });
    const result = currentUserFactory(undefined, ctx);
    expect(result).toBeUndefined();
  });

  it("negative — request.user 가 boolean 일 때 undefined 반환 (type mismatch — non-object boolean)", () => {
    const ctx = buildCtx({ user: true });
    const result = currentUserFactory(undefined, ctx);
    expect(result).toBeUndefined();
  });

  it('negative — request.user 가 string + data="sub" 시 undefined 반환 (type mismatch — non-object string + data)', () => {
    const ctx = buildCtx({ user: "not-an-object" });
    const result = currentUserFactory("sub", ctx);
    expect(result).toBeUndefined();
  });

  // 의존성 실패 #1 — ctx.switchToHttp().getRequest() 가 undefined 반환.
  it("negative — ctx.switchToHttp().getRequest() 가 undefined 반환 시 undefined 반환 (dependency 방어 분기)", () => {
    const ctx = buildCtx(undefined);
    const result = currentUserFactory(undefined, ctx);
    expect(result).toBeUndefined();
  });

  it("negative — ctx.switchToHttp().getRequest() 가 null 반환 시 undefined 반환 (dependency 방어 분기)", () => {
    const ctx = buildCtx(null);
    const result = currentUserFactory(undefined, ctx);
    expect(result).toBeUndefined();
  });

  it('negative — ctx.switchToHttp().getRequest() 가 undefined + data="sub" 시 undefined 반환', () => {
    const ctx = buildCtx(undefined);
    const result = currentUserFactory("sub", ctx);
    expect(result).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // sanity — payload 에 추가 claim 박제 시 통과 (JwtPayload schema 확장 forward-compat).
  // -----------------------------------------------------------------------
  it("sanity — payload 가 추가 claim 박제 시 전체 payload 그대로 반환 (forward-compat)", () => {
    // schema 가 확장되어도 본 decorator 가 unknown claim 을 박탈하지 않음을 보장.
    const payload = {
      sub: "u",
      role: "User",
      extra: "future-claim",
    } as unknown as JwtPayload;
    const ctx = buildCtx({ user: payload });
    const result = currentUserFactory(undefined, ctx);
    expect(result).toEqual(payload);
  });
});
