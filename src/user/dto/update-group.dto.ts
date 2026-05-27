// UpdateGroupDto — PATCH /api/groups/:id payload 검증 책임 DTO.
// T-0066 acceptance §A 박제 — UpdatePersonDto (T-0036) 의 1:1 mirror, 단 Group
// 도메인은 `name` 단일 필드만 cover (Group 의 다른 컬럼 createdAt/updatedAt 은
// schema 의 `@default(now())` / `@updatedAt` directive 가 자동 갱신).
//
// 구현 방식: manual decorate — `@nestjs/mapped-types` 추가 의존성 회피.
// PartialType 의 reflection 없이 각 필드에 `@IsOptional()` 을 직접 박아 PATCH
// 의 부분 update semantics 를 명시한다 (UpdatePersonDto 와 동일 패턴).
//
// validation rule 은 CreateGroupDto (T-0055 박제) 의 name field 1:1 mirror +
// `@IsOptional()` 추가:
//   - @IsString — string type 강제 (number / boolean / null 거부).
//   - @IsNotEmpty — 빈 문자열 / 공백만 string 거부 (도메인 invariant).
//   - @MaxLength(255) — schema 의 String column 길이 정책 정합 (DB 차원 한도는
//     없지만 application layer 에서 255 byte cap, UpdatePersonDto.fullName 의
//     동일 cap 정합).
//   - @IsOptional — PATCH partial semantics 박제. payload 에 `name` 미포함 시
//     validation pass (Prisma 의 update 가 partial data 를 no-op 처리). class-
//     validator 의 `@IsOptional()` 은 `undefined` + `null` 모두 skip — `null`
//     명시 시에도 isString 검사 우회 (spec 의 negative #3 박제).
//
// 책임 경계 (Out of Scope):
//   - P2025 (row 부재) → NotFoundException 변환은 GroupService.update (후속
//     T-0067) 책임. 본 DTO 는 payload validation 만 cover.
//   - controller PATCH endpoint 신설은 후속 T-0068 책임. 본 DTO 는 payload
//     contract 만 박제 (controller @Body() 로 binding 될 후보 type).
//   - whitelist + forbidNonWhitelisted (extra-property 거부) 는 controller-scope
//     ValidationPipe 책임 — 본 DTO 의 decorator 만으로는 cover 안 됨.
//   - REQ-028 의 "한 인원 다중 group 소속" / "Group.name 중복 허용" invariant 는
//     PersonGroupMembership / GroupService 책임, 본 DTO 의 책임 외.
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateGroupDto {
  // Group 표시명 부분 수정. 미지정 시 변경 안 함 (Prisma update 의 partial
  // semantics — PATCH no-op). 빈 문자열 / 공백만 string 은 @IsNotEmpty 가 거부.
  // schema 차원 @unique 미정의 따라 동명 Group 허용 — service-layer 의 P2002
  // 변환 분기는 GroupService 에 부재 (raw forward).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;
}
