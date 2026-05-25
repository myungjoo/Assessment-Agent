// CreatePersonDto — REQ-023 / REQ-025 의 신규 인원 추가 payload 검증 책임 DTO.
// T-0036 acceptance B 항목 박제.
//
// 본 DTO 는 PersonController 의 POST /api/persons 엔드포인트 의 @Body() 로 사용된다.
// ValidationPipe (controller-scope @UsePipes, T-0036 의 controller 결정) 의
// whitelist + forbidNonWhitelisted + transform 옵션과 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 필드 (예: 임의 `foo` 등) 는 400 BadRequest.
//   - decorator 위반 (missing fullName / wrong type / 잘못된 email 형식 / 길이 초과) 도 400.
//   - transform=true 가 plain JSON 을 본 class 의 instance 로 변환 — decorator 작동 보장.
//
// Prisma 의 Person model (prisma/schema.prisma §33) 컬럼과 정합:
//   - fullName String  → @IsString + @IsNotEmpty + @MaxLength(255)
//   - email    String  → @IsEmail + @MaxLength(255)
//   - active   Boolean → DTO 차원에서 미설정 (default true 는 Prisma 의 @default(true) cover).
//
// 책임 경계 (Out of Scope):
//   - ServiceIdentity 매핑 (서비스 ID 추가 + primary key 지정) 은 후속 task (T-0036.5+).
//   - Group / Part 소속 정보 는 후속 task (T-0037+).
//   - 동명이인 처리 / disambiguator 같은 invariant 는 후속 service-layer.
import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreatePersonDto {
  // 본명 (full name). 빈 문자열 / 공백만 도 invalid — @IsNotEmpty 가 cover.
  // 길이 상한 255 — Prisma 의 String default 는 PostgreSQL TEXT 라 무한이지만,
  // application-layer 에서 합리적 상한 박제 (REQ-023 의 사람-친화 데이터).
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;

  // email — RFC 5322 형식 검증. Prisma 의 `email String @unique` 와 정합.
  // unique constraint 위반 (중복 email) 은 service-layer 에서 ConflictException 변환.
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
