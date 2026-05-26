// AddMemberDto — REQ-028 의 PersonGroupMembership N:M middle row 신규 등록 시
// payload 검증 책임 DTO. T-0057 acceptance §B 박제 (CreateGroupDto / CreatePartDto
// 패턴 1:1 mirror — 같은 shape / 같은 decorator).
//
// 본 DTO 는 GroupController 의 POST /api/groups/:id/members 엔드포인트 의 @Body() 로
// 사용된다. GroupController 의 controller-scope ValidationPipe (whitelist +
// forbidNonWhitelisted + transform) 와 결합하여 다음을 자동 강제:
//   - 정의되지 않은 필드 (예: 임의 `foo` 등) 는 400 BadRequest (forbidNonWhitelisted).
//   - decorator 위반 (missing personId / wrong type / 빈 string) 도 400 BadRequest.
//   - transform=true 가 plain JSON 을 본 class 의 instance 로 변환 — decorator 작동 보장.
//
// **groupId 가 본 DTO 에 부재한 사유** — URL path param (`:id`) 으로 추출 (REST 정합).
// body 는 새로 추가될 Person 의 식별자 (personId) 만 보유. service-layer 호출 시
// `service.addMember(groupId, dto.personId)` 형태로 두 값을 결합.
//
// Prisma 의 PersonGroupMembership model (prisma/schema.prisma L123-133) 컬럼과 정합:
//   - personId String (non-null, @relation FK) → @IsString + @IsNotEmpty
//   - groupId  String — body 미포함, path param 추출 (위 책임 경계 박제).
//   - id / createdAt — Prisma default 생성, DTO 입력 0.
//   - `@@unique([personId, groupId])` invariant 의 P2002 → 409 변환은 service-layer
//     (group.service.ts addMember try/catch) 책임 — 본 DTO scope 외.
//
// CreateGroupDto / CreatePartDto 와의 차이점 (Out of Scope):
//   - **단일 필드의 의미만 다름** — 본 DTO 는 외부 Person 식별자, Create*Dto 는 신규
//     entity 의 표시명. shape / decorator 동일. service-layer 의 P2002 → 409 변환은
//     본 DTO 가 cover 하는 PersonGroupMembership 의 `@@unique([personId, groupId])`
//     만 발화 — Group / Part 의 name 충돌이 아닌 의미.
//
// 책임 경계 (Out of Scope):
//   - personId 의 UUID / cuid format regex 검증 부재 — Prisma 의 @default(cuid()) 가
//     생성한 정확한 식별자 format 강제는 service-layer + DB layer (FK 조회 fail = 404)
//     책임. 본 DTO 는 schema-level non-emptiness 만.
//   - Person 의 실재 검증 부재 — service.addMember 의 personRepository.findById 분기
//     책임 (group.service.ts L154-157 참조).
//   - Group 의 실재 검증도 본 DTO scope 외 — service.findById 가 cover.
//   - body 에 createdAt 등 임의 필드 추가 시 — controller-scope ValidationPipe 의
//     forbidNonWhitelisted 가 400 reject (DTO 변경 0, 의미는 controller 의 wire 책임).
import { IsNotEmpty, IsString } from "class-validator";

export class AddMemberDto {
  // 새로 group 에 등록될 Person 의 식별자. 빈 문자열 / 공백만 도 invalid — @IsNotEmpty
  // 가 cover. format (cuid / UUID) 강제는 후속 task (service-layer + DB FK 책임).
  @IsString()
  @IsNotEmpty()
  personId!: string;
}
