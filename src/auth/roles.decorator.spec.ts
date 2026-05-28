// @Roles() decorator spec — T-0083 acceptance §D 박제. R-112 4 카테고리 (happy /
// error / branch / negative) + negative cases 충분 cover.
//
// 본 spec 의 검증 표면:
//   - ROLES_METADATA_KEY 의 const 값 박제.
//   - Roles(...roles) 호출 결과가 SetMetadata decorator factory — 적용 시 target 의
//     metadata 에 ROLES_METADATA_KEY 로 roles 배열 저장.
//   - 빈 인자 호출 시 빈 배열 metadata 박제.
//   - 다중 인자 / 단일 인자 / 한글 role 값 등 분기 cover.
import "reflect-metadata";

import { Roles, ROLES_METADATA_KEY } from "./roles.decorator";

describe("@Roles() decorator", () => {
  it('ROLES_METADATA_KEY === "roles" (invariant — RolesGuard 가 동일 const import)', () => {
    expect(ROLES_METADATA_KEY).toBe("roles");
  });

  it("단일 role 인자 시 metadata 에 ['Admin'] 박제 (happy)", () => {
    class TestController {}
    Roles("Admin")(TestController);
    const metadata = Reflect.getMetadata(ROLES_METADATA_KEY, TestController);
    expect(metadata).toEqual(["Admin"]);
  });

  it("다중 role 인자 시 metadata 에 인자 순서대로 박제 (happy — multi-role)", () => {
    class TestController {}
    Roles("Admin", "SuperAdmin")(TestController);
    const metadata = Reflect.getMetadata(ROLES_METADATA_KEY, TestController);
    expect(metadata).toEqual(["Admin", "SuperAdmin"]);
  });

  it("3 종 role 인자 시 metadata 에 3 개 박제 (happy — multi-role 3+)", () => {
    class TestController {}
    Roles("User", "Admin", "SuperAdmin")(TestController);
    const metadata = Reflect.getMetadata(ROLES_METADATA_KEY, TestController);
    expect(metadata).toEqual(["User", "Admin", "SuperAdmin"]);
  });

  it("빈 인자 호출 시 metadata 에 빈 배열 박제 (negative — empty args, RolesGuard 가 public 처리)", () => {
    class TestController {}
    Roles()(TestController);
    const metadata = Reflect.getMetadata(ROLES_METADATA_KEY, TestController);
    expect(metadata).toEqual([]);
  });

  it("decorator 미적용 class 의 metadata 는 undefined (branch — 미적용 endpoint)", () => {
    class UnDecorated {}
    const metadata = Reflect.getMetadata(ROLES_METADATA_KEY, UnDecorated);
    expect(metadata).toBeUndefined();
  });

  it("method-level 적용도 정상 metadata 박제 (branch — method 적용)", () => {
    class TestController {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      method(): void {}
    }
    // @Roles 는 SetMetadata 래핑 — class method 에도 적용 가능.
    // descriptor 받는 형태로 호출 — TypeScript decorator signature 정합.
    const descriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      "method",
    );
    if (descriptor !== undefined) {
      Roles("Admin")(TestController.prototype, "method", descriptor);
      const metadata = Reflect.getMetadata(
        ROLES_METADATA_KEY,
        TestController.prototype.method,
      );
      expect(metadata).toEqual(["Admin"]);
    }
  });

  it("동일 class 에 두 번 적용 시 마지막 호출이 우선 (branch — overwrite)", () => {
    class TestController {}
    Roles("User")(TestController);
    Roles("SuperAdmin")(TestController);
    const metadata = Reflect.getMetadata(ROLES_METADATA_KEY, TestController);
    expect(metadata).toEqual(["SuperAdmin"]);
  });

  it("Roles(...) 호출 결과는 함수 (decorator factory) (branch — type contract)", () => {
    const dec = Roles("Admin");
    expect(typeof dec).toBe("function");
  });

  it("한글 role 값도 metadata 에 박제 (branch — string literal 무관)", () => {
    // 본 시점 role 값은 SuperAdmin/Admin/User 의 영문 literal 만 사용하나
    // decorator 자체는 string 무관 — invariant 박제.
    class TestController {}
    Roles("관리자")(TestController);
    const metadata = Reflect.getMetadata(ROLES_METADATA_KEY, TestController);
    expect(metadata).toEqual(["관리자"]);
  });

  it("빈 문자열 role 값도 metadata 에 박제 (negative — empty string, RolesGuard 차원 검증)", () => {
    // decorator layer 는 string 값 검증 0 — RolesGuard 의 ROLE_HIERARCHY 가 unknown 값
    // 처리 책임.
    class TestController {}
    Roles("")(TestController);
    const metadata = Reflect.getMetadata(ROLES_METADATA_KEY, TestController);
    expect(metadata).toEqual([""]);
  });
});
