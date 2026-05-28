// JwtAuthGuard spec — T-0083 acceptance §C 박제. R-112 4 카테고리 (happy / error /
// branch / negative).
//
// 본 spec 의 검증 표면:
//   - JwtAuthGuard 가 AuthGuard("jwt") 의 instance — strategy name "jwt" wiring 정합.
//   - instantiation 정상 (constructor wiring throw 안 함).
//   - canActivate 의 실 verify 동작은 JwtStrategy 의 spec 이 cover — 본 spec 은 단순
//     extends 관계만 검증 (AuthGuard 의 default 동작 위임).
//
// Note: AuthGuard 의 canActivate 가 실 passport.authenticate 호출 → JwtStrategy →
// jsonwebtoken verify chain 은 e2e (T-0089 candidate) 가 cover. 본 unit spec 은
// guard wiring (class hierarchy + instantiation) 만.
import { AuthGuard } from "@nestjs/passport";

import { JwtAuthGuard } from "./jwt-auth.guard";

describe("JwtAuthGuard", () => {
  it("instantiation 시 throw 하지 않는다 (happy)", () => {
    expect(() => new JwtAuthGuard()).not.toThrow();
  });

  it("AuthGuard('jwt') 의 instance (branch — class hierarchy)", () => {
    const guard = new JwtAuthGuard();
    // AuthGuard("jwt") 의 factory 결과는 NestJS 의 dynamic class.
    // instanceof AuthGuard 직접 비교는 dynamic class 의 prototype 한계로 못 함 —
    // 대신 prototype chain 의 parent class name 검증 (NestJS 의 AuthGuard factory
    // 결과 가 MixinAuthGuard / 또는 _Mixin* 이름의 dynamic class 가 됨).
    const protoChain: string[] = [];
    let proto = Object.getPrototypeOf(guard);
    while (proto !== null && proto.constructor !== Object) {
      protoChain.push(proto.constructor.name);
      proto = Object.getPrototypeOf(proto);
    }
    // chain 의 어느 단계에 AuthGuard factory 의 결과 class 가 포함되어야 함.
    // 실제로는 "JwtAuthGuard" → (dynamic AuthGuard class) → "PassportStrategyMixin"
    // 또는 유사 — 단순히 chain 길이 ≥ 2 임을 검증 (extends 관계 보장).
    expect(protoChain.length).toBeGreaterThanOrEqual(2);
    expect(protoChain[0]).toBe("JwtAuthGuard");
  });

  it("AuthGuard factory 호출 결과는 함수형 (function) (branch — factory contract)", () => {
    // AuthGuard("jwt") 자체가 class 를 반환 — typeof === "function".
    expect(typeof AuthGuard("jwt")).toBe("function");
  });

  it("canActivate 메서드가 존재한다 (happy — wired method)", () => {
    const guard = new JwtAuthGuard();
    expect(typeof guard.canActivate).toBe("function");
  });

  it("동일 strategy name 으로 호출한 AuthGuard 결과 prototype 와 JwtAuthGuard 가 연결 (branch — strategy name 정합)", () => {
    // AuthGuard("jwt") 결과 class 가 JwtAuthGuard 의 parent 이므로,
    // JwtAuthGuard.prototype 의 chain 안에 그 class 의 prototype 이 존재.
    const ParentClass = AuthGuard("jwt");
    const guard = new JwtAuthGuard();
    expect(guard instanceof ParentClass).toBe(true);
  });

  it("여러 instance 가 독립적으로 생성된다 (negative — no shared singleton-state 가설)", () => {
    const g1 = new JwtAuthGuard();
    const g2 = new JwtAuthGuard();
    expect(g1).not.toBe(g2);
    expect(g1).toBeInstanceOf(JwtAuthGuard);
    expect(g2).toBeInstanceOf(JwtAuthGuard);
  });
});
