// AddUserDto — `POST /api/users` signup payload 검증 책임 DTO. T-0092 acceptance §A 박제.
//
// 본 DTO 는 UserController.signup 의 @Body() 로 사용된다. UserController 의
// controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform,
// LoginDto / ChangeRoleDto / CreatePersonDto 정공법 정합) 와 결합되어:
//   - 정의되지 않은 필드 (예: 임의 `role` / `foo` 등) 는 400 BadRequest (forbidNonWhitelisted).
//     특히 `role` 필드 reject — 첫 user SuperAdmin 자동 분기 invariant 의 외부 우회 차단.
//   - decorator 위반 (missing email / missing password / 잘못된 email 형식 / 빈 string /
//     wrong type / password 8 char 미만) 도 400 BadRequest.
//   - transform=true 가 plain JSON 을 본 class 의 instance 로 변환 — decorator 작동 보장.
//
// Prisma 의 User model (prisma/schema.prisma User) 컬럼과의 관계:
//   - email    String  @unique  → @IsEmail + @IsNotEmpty
//   - password String           → DTO 차원의 password 는 **plain** (signup payload).
//     UserService.signup 이 AuthService.hashPassword (bcrypt 10 rounds, ADR-0008 §6)
//     호출 후 hashedPassword 컬럼에 저장. plain password DB write 0.
//
// 책임 경계 (Out of Scope, task §Out of Scope 박제):
//   - role 필드 0 — signup 은 service-layer 의 첫 user 분기 (countAll === 0 → SuperAdmin,
//     아니면 User) 자동. role 외부 지정 우회는 forbidNonWhitelisted 가 차단.
//   - fullName / displayName / 추가 user profile 필드 0 — 별도 task.
//   - email confirmation / MFA / captcha / rate limiting 후속 task.
//   - password 복잡도 (대문자 / 숫자 / 특수문자) / blacklist / breach API check 등 별도 task.
//   - LoginDto 와 동일 2 필드 cover — login 은 verify, signup 은 create.
//
// LoginDto + ChangeRoleDto cross-ref:
//   - LoginDto (src/auth/dto/login.dto.ts) — email + password 2 필드 동일 패턴,
//     @IsEmail + @IsNotEmpty + @IsString. signup 은 추가로 @MinLength(8) — password
//     정책 첫 박제 (login 은 verify path 라 길이 제약 무의미).
//   - ChangeRoleDto (src/user/dto/change-role.dto.ts) — controller-scope ValidationPipe
//     의 forbidNonWhitelisted invariant mirror.
//
// ADR-0008 §6 정합:
//   - plain password HTTPS 전송 보호 (ADR-0003 §4 HTTPS-only 정합).
//   - service-layer bcrypt 10 rounds hash (AuthService.hashPassword) — DB 의
//     hashedPassword 컬럼은 항상 bcrypt hash, plain 컬럼 0.
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

// PASSWORD_MIN_LENGTH — signup password 의 최소 길이 박제. const 노출로 spec 에서
// boundary 검증 anchor 로 활용. 향후 정책 강화 시 본 const 만 변경.
export const PASSWORD_MIN_LENGTH = 8;

export class AddUserDto {
  // email — RFC 5322 형식 검증 + 빈 문자열 reject. User entity 의 `email @unique`
  // 컬럼과 정합 (prisma/schema.prisma L164). 중복 email 은 service-layer 의 P2002
  // → ConflictException 변환 (UserService.signup 책임). class-validator 의 @IsEmail
  // 은 빈 문자열도 reject (formal email format 위반) — 명시적 @IsNotEmpty 박제로
  // error message 의 명확성 보존.
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  // password — plain password 문자열 (HTTPS 전송 보호, ADR-0003 §4 HTTPS-only 정합).
  // 빈 문자열 reject — @IsNotEmpty. @IsString 은 number / boolean / object 등 wrong
  // type reject (R-112 negative case backbone). @MinLength(8) 은 signup 정책 첫 박제 —
  // login 은 verify path 라 길이 제약 무의미 (LoginDto 와의 차이).
  @IsString()
  @IsNotEmpty()
  @MinLength(PASSWORD_MIN_LENGTH)
  password!: string;
}
