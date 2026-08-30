// CreateCollectionTargetDto — 수집 대상 등록 endpoint(POST /api/collection-targets)의
// payload 검증 DTO. ADR-0059 §Decision 4 필드 표(7 종) · §Decision 5(POST 201 / 검증
// 실패 400 = 오류 표 e 행) 박제. CreateServiceIdentityDto(ADR-0058) 패턴 mirror.
//
// controller-scope ValidationPipe(whitelist + forbidNonWhitelisted + transform)와 결합되어
// 다음을 자동 강제한다:
//   - 여기 정의되지 않은 필드(대표적으로 `id` · `createdAt` · `updatedAt` 같은 서버 생성
//     축과 `token` · `password` 계열)는 forbidNonWhitelisted 가 400 으로 거부한다.
//   - decorator 위반(필수 누락 · 빈 값 · 길이 초과 · type 불일치)도 400.
//
// 필드가 `type` · `instanceKey` · `endpoint` · `orgs` · `repos` · `spaces` · `active`
// 7 개뿐인 이유 — `id` · `createdAt` · `updatedAt` 는 Prisma 가 소유하는 서버 생성 축이라
// body 로 받지 않는다(받으면 클라이언트가 PK 와 시각을 위조할 경로가 생긴다).
//
// credential 경계(ADR-0059 §Decision 2) — `instanceKey` 는 env 의 credential
// (`GITHUB_<KEY>_TOKEN_ENC` 등)을 가리키는 **참조 key 일 뿐 자격증명 값이 아니다**.
// token · 암호문 · 계정 비밀번호 계열 필드는 본 DTO 의 허용 축이 아니며, 받지 않으므로
// 실수로 저장될 경로 자체가 없다.
//
// 책임 경계(Out of Scope):
//   - `type` 별 조건부 필수성(GITHUB 은 `orgs`, CONFLUENCE 는 `spaces`)은 **본 DTO 가
//     강제하지 않는다**. 단일 model 채택의 대가로 ADR-0059 §Consequences (c) 가 명시한
//     부분이며, 그 검증은 service layer 로 밀린다.
//   - `UpdateCollectionTargetDto`(정체성 축 제외 + 전 필드 optional) · `CollectionTarget
//     Controller` · 5 route · `@UseGuards(JwtAuthGuard, RolesGuard)` / `@Roles` 배선은
//     ADR-0059 §Follow-ups (c) 의 후속 slice.
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

// 허용 대상 종류 — ADR-0059 §Decision 4 의 enum-as-String 축. Prisma enum 으로 격상하지
// 않은 이유는 `type` 이 adapter 추가마다 늘어나는 **확장 축**이라 값 추가마다 migration 을
// 부르기 때문이다(기존 `User.role` · `ServiceIdentity.service` 의 enum-as-String 관례 승계).
export const COLLECTION_TARGET_TYPES = ["GITHUB", "CONFLUENCE"] as const;

export class CreateCollectionTargetDto {
  // 대상 종류. 허용 literal 은 위 상수 2 종뿐이며 대소문자도 구분한다(DB 저장 표기가
  // 대문자로 고정돼야 `@@unique([type, instanceKey])` 가 의도대로 작동한다).
  @IsString()
  @IsIn([...COLLECTION_TARGET_TYPES])
  type!: string;

  // 좌표 식별 key 이자 credential 참조 key(§Decision 2) — 실 token 값이 아니라 env 이름
  // 조립에 쓰이는 식별자다. 값 집합의 정본이 배포 env 라 서버 allowlist 를 두지 않고
  // 형식(비어있지 않은 string · 길이 상한)만 강제한다.
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  instanceKey!: string;

  // 대상 좌표 — GITHUB 은 host(예: `github.com`), CONFLUENCE 는 풀 REST base URL.
  // 두 표기가 한 필드를 공유해 URL 정규식을 두지 않고 길이 상한만 건다.
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  endpoint!: string;

  // org 목록(GITHUB 축). 미전달 시 DB default 인 빈 배열로 위임된다.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  orgs?: string[];

  // repo allowlist. 빈 배열이면 org 전체 수집(ADR-0030 모드 A). 미전달 시 DB default 위임.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  repos?: string[];

  // SPACE allowlist(CONFLUENCE 축, ADR-0013 §2). 미전달 시 DB default 인 빈 배열 위임.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  spaces?: string[];

  // 수집 대상 활성 여부 — 삭제 없이 제외하는 축. 미전달 시 DB default(`true`) 위임.
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
