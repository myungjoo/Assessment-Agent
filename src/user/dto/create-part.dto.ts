// CreatePartDto — REQ-028 의 조직도 Part 신규 등록 payload 검증 책임 DTO.
// T-0046 acceptance §Part DTO 박제.
//
// 본 DTO 는 PartController 의 POST /api/parts 엔드포인트 의 @Body() 로 사용된다.
// PartController 의 controller-scope ValidationPipe (whitelist + forbidNonWhitelisted +
// transform) 와 결합하여 다음을 자동 강제한다:
//   - 정의되지 않은 필드 (예: 임의 `foo` 등) 는 400 BadRequest.
//   - decorator 위반 (missing name / wrong type / 빈 string) 도 400.
//   - transform=true 가 plain JSON 을 본 class 의 instance 로 변환 — decorator 작동 보장.
//
// Prisma 의 Part model (prisma/schema.prisma) 컬럼과 정합:
//   - name String @unique → @IsString + @IsNotEmpty
//
// 책임 경계 (Out of Scope):
//   - name 의 trim / regex (한글/영문/숫자 only) / case-insensitive 중복 검증 등 정교한
//     invariant 는 후속 task 책임. 본 DTO 는 기본 타입 / 빈값 차단만.
//   - UpdatePartDto 신설 안 함 — PartController 가 PATCH endpoint 노출 안 함 (task
//     §Acceptance §controller "Update endpoint (PATCH) 신설 0" 박제).
//   - REQ-028 의 "정확히 1 Part" / FK 보호 invariant 는 service / schema layer 책임.
import { IsNotEmpty, IsString } from "class-validator";

export class CreatePartDto {
  // Part 의 표시명. 빈 문자열 / 공백만 도 invalid — @IsNotEmpty 가 cover.
  // schema 차원 @unique 위반 시 Prisma `P2002` 가 PartService 에서 ConflictException
  // 으로 변환된다 (REQ-028 invariant 의 service-layer enforce).
  @IsString()
  @IsNotEmpty()
  name!: string;
}
