// CreateGroupDto — REQ-028 의 임의 Group 신규 등록 payload 검증 책임 DTO.
// T-0055 acceptance §B 박제 (CreatePartDto 1:1 mirror — 같은 shape / 같은 decorator).
//
// 본 DTO 는 GroupController 의 POST /api/groups 엔드포인트 의 @Body() 로 사용된다.
// GroupController 의 controller-scope ValidationPipe (whitelist + forbidNonWhitelisted +
// transform) 와 결합하여 다음을 자동 강제한다:
//   - 정의되지 않은 필드 (예: 임의 `foo` 등) 는 400 BadRequest (forbidNonWhitelisted).
//   - decorator 위반 (missing name / wrong type / 빈 string) 도 400 BadRequest.
//   - transform=true 가 plain JSON 을 본 class 의 instance 로 변환 — decorator 작동 보장.
//
// Prisma 의 Group model (prisma/schema.prisma L84-97) 컬럼과 정합:
//   - name String (non-null, @unique 미정의 — 동명 Group 허용) → @IsString + @IsNotEmpty
//
// CreatePartDto 와의 차이점 (Out of Scope):
//   - **P2002 (unique 위반) 변환 service-layer enforce 부재** — Group.name 에 @unique
//     미정의 따라 GroupService.create 가 raw forward. CreatePartDto 의 동일 decorator
//     shape 임에도 service-layer 의 P2002 → 409 변환 분기는 GroupService 에 없다.
//
// 책임 경계 (Out of Scope):
//   - name 의 trim / regex (한글/영문/숫자 only) / case-insensitive 중복 검증 등 정교한
//     invariant 는 후속 task 책임. 본 DTO 는 기본 타입 / 빈값 차단만.
//   - UpdateGroupDto 신설 안 함 — GroupController 가 PATCH endpoint 노출 안 함 (task
//     §Acceptance §A "PATCH endpoint 미노출" 박제, 별도 후속 task 책임).
//   - REQ-028 의 "한 인원 다중 group 소속 가능" invariant 는 PersonGroupMembership
//     schema (composite PK) / service layer 책임.
import { IsNotEmpty, IsString } from "class-validator";

export class CreateGroupDto {
  // Group 의 표시명. 빈 문자열 / 공백만 도 invalid — @IsNotEmpty 가 cover.
  // schema 차원 @unique 미정의 따라 동명 Group 허용 — service-layer 의 P2002 변환
  // 분기는 GroupService 에 부재 (raw forward).
  @IsString()
  @IsNotEmpty()
  name!: string;
}
