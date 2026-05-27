// UpdatePartDto — PATCH /api/parts/:id payload 검증 책임 DTO.
// T-0069 acceptance §A 박제 — UpdateGroupDto (T-0066) 의 1:1 mirror, 단 Part
// 도메인은 `name` 단일 필드만 cover (Part 의 다른 컬럼 createdAt/updatedAt 은
// schema 의 `@default(now())` / `@updatedAt` directive 가 자동 갱신).
//
// 구현 방식: manual decorate — `@nestjs/mapped-types` 추가 의존성 회피.
// PartialType 의 reflection 없이 각 필드에 `@IsOptional()` 을 직접 박아 PATCH
// 의 부분 update semantics 를 명시한다 (UpdateGroupDto / UpdatePersonDto 와
// 동일 패턴).
//
// validation rule 은 CreatePartDto (T-0046 박제) 의 name field 1:1 mirror +
// `@IsOptional()` 추가:
//   - @IsString — string type 강제 (number / boolean / null 거부).
//   - @IsNotEmpty — 빈 문자열 / 공백만 string 거부 (도메인 invariant).
//   - @MaxLength(255) — schema 의 String column 길이 정책 정합 (application
//     layer 의 255 byte cap — UpdateGroupDto.name 의 동일 cap 정합).
//   - @IsOptional — PATCH partial semantics 박제. payload 에 `name` 미포함 시
//     validation pass (Prisma 의 update 가 partial data 를 no-op 처리). class-
//     validator 의 `@IsOptional()` 은 `undefined` + `null` 모두 skip — `null`
//     명시 시에도 isString 검사 우회 (spec 의 negative #3 박제).
//
// Group precedent 와의 차이 (T-0069 의 핵심 분기 박제):
//   - Part.name 은 prisma/schema.prisma L108 에서 `@unique` directive **정의**.
//     동명 Part 의 update 시 schema-level enforce 가 Prisma `P2002` (unique
//     constraint failed) 를 raise → PartRepository.update 가 raw propagate →
//     후속 PartService.update (T-0070) 가 `ConflictException` 변환 책임.
//   - 반면 UpdateGroupDto 의 Group.name 은 `@unique` 미정의 → P2002 분기 부재
//     (raw forward 만). 본 DTO 의 payload validation 자체는 두 도메인 동일,
//     P2002 분기는 repository/service layer 에서 박제.
//
// 책임 경계 (Out of Scope):
//   - P2002 (name unique 위반) → ConflictException 변환은 PartService.update
//     (후속 T-0070) 책임. 본 DTO 는 payload validation 만 cover.
//   - P2025 (row 부재) → NotFoundException 변환은 PartService.update (후속
//     T-0070) 책임.
//   - controller PATCH endpoint 신설은 후속 T-0071 책임. 본 DTO 는 payload
//     contract 만 박제 (controller @Body() 로 binding 될 후보 type).
//   - whitelist + forbidNonWhitelisted (extra-property 거부) 는 controller-scope
//     ValidationPipe 책임 — 본 DTO 의 decorator 만으로는 cover 안 됨.
//   - REQ-028 의 "1 Person 정확히 1 Part" invariant 는 PartService / schema
//     layer 책임 — 본 DTO 의 책임 외.
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdatePartDto {
  // Part 표시명 부분 수정. 미지정 시 변경 안 함 (Prisma update 의 partial
  // semantics — PATCH no-op). 빈 문자열 / 공백만 string 은 @IsNotEmpty 가 거부.
  // schema 차원 `@unique` (prisma/schema.prisma L108) 가 동명 Part 중복 시
  // Prisma P2002 raise — 후속 PartService.update 의 ConflictException 변환
  // 분기로 이어짐 (Group 도메인과의 핵심 차이 박제).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;
}
