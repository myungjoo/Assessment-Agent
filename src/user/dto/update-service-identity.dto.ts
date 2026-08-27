// UpdateServiceIdentityDto — PATCH /api/persons/:personId/identities/:identityId 의
// payload 검증 DTO. ADR-0058 §Decision 3 ("PATCH 는 externalId 단일 축") 박제.
//
// 구현 관례는 update-person.dto.ts 와 동일한 manual decorate — `@nestjs/mapped-types`
// (PartialType) 를 새 dependency 로 들이지 않고 각 필드에 @IsOptional 을 직접 박아
// RFC-7396 merge patch semantic(전달된 필드만 적용, 미전달 필드 보존)을 표현한다.
//
// 금지 축을 필드로 정의하지 않는 이유(ADR §Decision 3):
//   - `isPrimary` — primary 전이는 repository setPrimary 의 2 op transaction 이 유일한
//     안전 경로다. body 로 열면 그 transaction 을 우회하고 `{isPrimary:false}` 가
//     "N ≥ 1 인데 primary 0" 상태를 만든다.
//   - `service` — @@unique([personId, service]) 의 구성 요소이자 수집 매칭 키라 갱신하면
//     identity 의 정체성이 바뀐다. DELETE 후 POST 로 표현한다.
//   두 축이 body 로 오면 controller-scope ValidationPipe 의 forbidNonWhitelisted 가
//   400 을 낸다 — 여기에 필드를 추가하는 순간 그 400 게이트가 조용히 열린다.
//
// 허용 축이 1 개뿐이라 `null` 로의 삭제 semantic 도 지원하지 않는다(ADR §Decision 3 —
// `null` 전달 시 400). optional 표현에 @IsOptional 대신 @ValidateIf 를 쓰는 이유가
// 여기 있다 — @IsOptional 은 undefined 와 null 을 **둘 다** skip 해서 null 이 조용히
// 통과한다. @ValidateIf((_o, v) => v !== undefined) 는 "키가 없을 때만 skip" 이라
// 미전달은 0 error, 명시적 null 은 @IsString 위반 400 이 되어 ADR 과 정합한다.
//
// 책임 경계 (Out of Scope):
//   - primary invariant 강제 · ServiceIdentityRepository.update 확장 · controller /
//     guard 배선 · e2e 스위트는 전부 후속 slice.
import { IsNotEmpty, IsString, MaxLength, ValidateIf } from "class-validator";

export class UpdateServiceIdentityDto {
  // externalId 부분 갱신. 미전달(undefined) 이면 검증 skip — 값 보존.
  // 제약은 create 와 동일(@IsString · @IsNotEmpty · @MaxLength(255)).
  @ValidateIf((_o, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  externalId?: string;
}
