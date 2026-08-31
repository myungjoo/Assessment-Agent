// UpdateCollectionTargetDto — 수집 대상 편집 endpoint(PATCH /api/collection-targets/:id)의
// payload 검증 DTO. ADR-0059 §Decision 5 PATCH 행(200 / RFC-7396 merge patch / 검증 실패
// 400 = 오류 표 e 행) 박제. 구현 관례는 UpdateServiceIdentityDto(ADR-0058) 와 동일한
// manual decorate — `@nestjs/mapped-types`(PartialType)를 새 dependency 로 들이지 않고
// 각 필드에 @ValidateIf((_o, value) => value !== undefined) 를 직접 박아 "전달된 필드만
// 적용, 미전달 필드 보존" 을 표현한다.
//
// optional 표현에 @IsOptional 대신 @ValidateIf 를 쓰는 이유 — @IsOptional 은 `undefined`
// 와 `null` 을 **둘 다** 검증에서 skip 해서 `{ "endpoint": null }` 같은 명시적 null 이
// DTO 를 그대로 통과해 repository / Prisma 층까지 내려간다. 그러면 §Decision 5 오류 표
// e 행(형식 검증 실패 = 400)이 조용히 새므로, "키가 없을 때만 skip" 을 뜻하는
// @ValidateIf((_o, value) => value !== undefined) 로 바꿔 미전달은 0 error, 명시적 null
// 은 후속 decorator(@IsString · @IsArray · @IsBoolean) 위반 400 이 되게 못박는다
// (UpdateServiceIdentityDto — ADR-0058 — 선례 승계). null 로의 삭제 semantic 은 본 DTO
// 의 계약이 아니다.
//
// 허용 축이 `endpoint` · `orgs` · `repos` · `spaces` · `active` 5 개뿐인 이유 —
// `CollectionTargetUpdateInput`(collection-target.repository.ts)과 1:1 로 맞춘 것이다.
// 정체성 축(`type` · `instanceKey`)은 **본 DTO 의 허용 축이 아니다**: ADR-0059
// §Decision 5 PATCH 행이 "정체성 축 — 변경은 DELETE + POST" 로 못박았고, 두 필드는
// `@@unique([type, instanceKey])` 의 구성 요소라 갱신하면 대상의 정체성 자체가 바뀐다.
// 두 축이 body 로 오면 controller-scope ValidationPipe 의 forbidNonWhitelisted 가 400 을
// 낸다 — 여기에 필드를 추가하는 순간 그 400 게이트가 조용히 열린다.
//
// credential 경계(§Decision 2) — token · 암호문 · 계정 비밀번호 계열 필드는 Create 축과
// 마찬가지로 허용 축이 아니며, 받지 않으므로 실수로 저장될 경로 자체가 없다.
//
// 빈 객체 `{}` 도 valid 다 — merge patch 의 no-field 요청이며 Prisma 가 `@updatedAt` 만
// 갱신한다(no-op 아님. repository 의 `CollectionTargetUpdateInput` 주석과 동일 계약).
//
// 책임 경계(Out of Scope): `CollectionTargetController` · 5 route(GET 목록 · GET 단건 ·
// POST · PATCH · DELETE) · `@UseGuards(JwtAuthGuard, RolesGuard)` · `@Roles` 배선은
// ADR-0059 §Follow-ups (c) 의 후속 slice. `type` 별 조건부 필수성 검증은 §Consequences (c)
// 대로 service layer 몫이다.
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from "class-validator";

export class UpdateCollectionTargetDto {
  // 대상 좌표 부분 갱신. 두 의미가 겹치는 필드라 decorator 조합으로 구분 박제한다 —
  // @ValidateIf 는 "미전달 = 미변경"(키가 없거나 값이 undefined 면 나머지 decorator 평가
  // 자체를 skip. null 은 skip 대상이 아니라 @IsString 위반),
  // @IsNotEmpty 는 "전달했다면 빈 값 불가"(빈 문자열로 좌표를 지울 수 없다).
  @ValidateIf((_o, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  endpoint?: string;

  // org 목록(GITHUB 축) 교체. merge patch 라 배열은 원소 병합이 아니라 전량 교체다.
  @ValidateIf((_o, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  orgs?: string[];

  // repo allowlist 교체. 빈 배열이면 org 전체 수집(ADR-0030 모드 A)으로 되돌린다.
  @ValidateIf((_o, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  repos?: string[];

  // SPACE allowlist(CONFLUENCE 축, ADR-0013 §2) 교체.
  @ValidateIf((_o, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  spaces?: string[];

  // 수집 대상 활성 여부 — 삭제 없이 제외하는 축(§Decision 5 DELETE 행의 "일시 제외는
  // `active=false` PATCH").
  @ValidateIf((_o, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
