// UpdatePersonDto — PATCH /api/persons/:id payload 검증 책임 DTO.
// T-0036 acceptance B 항목 박제.
//
// 구현 옵션 (task 본문 §B-87): manual decorate (권장) — `@nestjs/mapped-types`
// 추가 dep 회피. PartialType 의 메타데이터 reflection 없이도 각 필드에 @IsOptional 을
// 함께 박아 PATCH semantics (부분 수정) 를 명시한다.
//
// active 필드는 PATCH 의 soft-deactivate / reactivate 경로를 cover 한다
// (api.md L74 — `active=false` payload 의 PATCH 가 soft deactivate, `active=true` 가
// reactivate 의 의미). UC-03 §6.1 의 Deactivate vs Delete 분리와 정합.
//
// 책임 경계 (Out of Scope):
//   - ServiceIdentity / Group / Part 의 부분 수정은 후속 task 책임.
//   - id 자체는 path param 이므로 본 DTO 에 포함 안 함.
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdatePersonDto {
  // 본명 부분 수정. 미지정 시 변경 안 함 (Prisma update 의 partial semantics).
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName?: string;

  // email 부분 수정. 미지정 시 변경 안 함.
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  // active flag — PATCH `{active:false}` 가 soft deactivate, `{active:true}` 가
  // reactivate 의미 (api.md L74 박제). controller 는 본 필드 유무에 따라
  // PersonService.deactivate / reactivate / update 분기로 routing.
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
