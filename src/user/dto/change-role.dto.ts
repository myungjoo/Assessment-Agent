// ChangeRoleDto — `PATCH /api/users/:id/role` payload 검증 책임 DTO. T-0087 acceptance
// §A 박제. UserService.changeRole (T-0086) 의 invariant 2 (UserRole literal union)
// 를 HTTP boundary 에 미리 박제 — DTO 차원에서 잘못된 type / 빈 문자열 / enum 외
// 값을 400 BadRequest 로 자동 reject (controller / service layer 진입 0).
//
// 본 DTO 는 UserController.changeRole 의 @Body() 로 사용된다. UserController 의
// controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform,
// AuthController / GroupController / PersonController 정공법 정합) 와 결합되어:
//   - 정의되지 않은 필드 (예: 임의 `foo` 등) 는 400 BadRequest (forbidNonWhitelisted).
//   - decorator 위반 (missing role / wrong type / 빈 string / enum 외) 도 400 BadRequest.
//   - transform=true 가 plain JSON 을 본 class 의 instance 로 변환 — decorator 작동 보장.
//
// VALID_ROLES 값 enum 박제 — UserService 의 `VALID_ROLES` 와 의미 정합 의무. 직접
// import 0 (DTO 가 production HTTP boundary 라 service layer 와 독립 박제 — schema
// drift 시 spec 의 round-trip 검증이 catch). invariant 2 의 DB boundary 정합.
//
// 책임 경계 (Out of Scope):
//   - 다른 user mutation field (email / password / fullName 등) 없음 — 본 DTO 는
//     role 단일 필드. signup payload 는 T-0089 candidate (SignupDto) 책임.
//   - role string 의 case-insensitive 처리 없음 — "admin" / "user" 같은 소문자도
//     enum 외로 reject. case-sensitive invariant.
import { IsIn, IsNotEmpty, IsString } from "class-validator";

// role 값 enum — UserService.VALID_ROLES 와 의미 정합 의무. invariant 2 의 DB
// boundary 정합. const assertion 으로 IsIn decorator 의 type narrowing 보장.
export const VALID_ROLE_VALUES = ["SuperAdmin", "Admin", "User"] as const;

export class ChangeRoleDto {
  // role — 새 role 값. UserRole literal union ("SuperAdmin" / "Admin" / "User") 외 reject.
  // @IsString 은 number / boolean / object 등 wrong type reject (R-112 negative case backbone).
  // @IsNotEmpty 는 빈 문자열 reject. @IsIn 은 enum 외 값 reject — UserService 의
  // invariant 2 와 의미 정합 (소문자 "user" / "Owner" 등 모두 reject).
  @IsString()
  @IsNotEmpty()
  @IsIn(VALID_ROLE_VALUES as unknown as string[])
  role!: string;
}
