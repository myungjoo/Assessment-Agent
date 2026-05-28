// ChangeRoleDto — `PATCH /api/users/:id/role` payload 검증 책임 DTO.
// T-0087 acceptance §A 박제 (REQ-044 의 HTTP layer payload 검증, LoginDto /
// AddMemberDto 정공법 정합).
//
// 본 DTO 는 UserController.changeRole 의 @Body() 로 사용된다. UserController 의
// controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform)
// 와 결합하여 다음을 자동 강제한다:
//   - 정의되지 않은 필드 (예: 임의 `extra` 등) 는 400 BadRequest (forbidNonWhitelisted).
//   - decorator 위반 (missing role / wrong type / 빈 string / enum 외 값) 도 400.
//   - transform=true 가 plain JSON 을 본 class 의 instance 로 변환.
//
// 책임 경계 (Out of Scope):
//   - 다른 user mutation field 부재 — `role` 단일 필드만. PATCH /api/users/:id/password
//     등 별도 DTO 책임 (별도 task chain).
//   - SignupDto / AddUserDto 등 신규 user 등록 책임은 별도 task (T-0089 candidate).
//   - service-layer 의 5 invariant (actor 권한 / target lookup / self-demote 차단 /
//     race window) 는 UserService.changeRole (T-0086 박제) 책임 — DTO 는 payload
//     형식 backbone 만.
import { IsIn, IsNotEmpty, IsString } from "class-validator";

// VALID_ROLE_VALUES — UserRole literal union ("SuperAdmin" / "Admin" / "User") 의
// HTTP boundary 박제. UserService.VALID_ROLES 와 의미 정합 의무 — invariant 2 의
// DB boundary. 직접 import 0 — DTO 가 production HTTP boundary 의 독립 박제
// (service-layer 의 enum 변경 시 본 const 동기 갱신 의무).
const VALID_ROLE_VALUES = ["SuperAdmin", "Admin", "User"] as const;

export class ChangeRoleDto {
  // role — 변경 대상 user 의 새 role 값. UserService.changeRole 의 invariant 2
  // 정합 (UserRole literal union 외 reject). @IsIn 이 enum 외 값을 400 자동 변환,
  // @IsString + @IsNotEmpty 가 wrong type / 빈 문자열 reject.
  @IsString()
  @IsNotEmpty()
  @IsIn(VALID_ROLE_VALUES)
  role!: string;
}
