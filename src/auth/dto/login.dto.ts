// LoginDto — `POST /api/auth/login` payload 검증 책임 DTO. T-0082 acceptance §C 박제.
//
// 본 DTO 는 AuthController.login 의 @Body() 로 사용된다. ValidationPipe
// (controller-scope @UsePipes, T-0082 의 AuthController 결정) 의 whitelist +
// forbidNonWhitelisted + transform 옵션과 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 필드 (예: 임의 `foo` 등) 는 400 BadRequest.
//   - decorator 위반 (missing email / wrong type / 잘못된 email 형식 / empty password) 도 400.
//   - transform=true 가 plain JSON 을 본 class 의 instance 로 변환 — decorator 작동 보장.
//
// Prisma 의 User model (prisma/schema.prisma User) 컬럼과의 관계:
//   - email    String  @unique  → @IsEmail + @IsNotEmpty
//   - password String           → DTO 차원의 password 는 **plain** (login payload).
//     UserRepository.findByEmail 의 결과 row 의 hashedPassword 와 AuthService.
//     verifyPassword 가 bcrypt compare 로 검증.
//
// 책임 경계 (Out of Scope):
//   - role / userId 등 추가 필드 없음 — login 은 email + password 의 2 필드 cover.
//   - email confirmation / MFA / captcha 등 추가 invariant 후속 task.
//   - rate limiting / brute-force lockout 후속 task.
//   - SignupDto / AddUserDto 등 신규 user 등록 책임은 T-0083 SuperAdmin RBAC scope.
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginDto {
  // email — RFC 5322 형식 검증 + 빈 문자열 reject. ADR-0008 Decision §1 의
  // login flow 의 identifier (User entity 의 `email @unique` 컬럼과 정합).
  // class-validator 의 @IsEmail 은 빈 문자열 도 reject (formal email format 위반).
  // 단 명시적 @IsNotEmpty 박제 — error message 의 명확성 보존.
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  // password — plain password 문자열 (HTTPS 전송 보호, ADR-0003 §4 HTTPS-only 정합).
  // 빈 문자열 reject — @IsNotEmpty. @IsString 은 number / boolean / object 등 wrong
  // type reject (R-112 negative case 의 backbone). 길이 상한 / 복잡도 (정책) 는
  // 후속 task — 본 시점은 형식 backbone 박제만.
  @IsString()
  @IsNotEmpty()
  password!: string;
}
