// CreateServiceIdentityDto — POST /api/persons/:personId/identities 의 payload 검증 DTO.
// ADR-0058 §Decision 1 route 표 (POST 201) · §Decision 5 표 (d) 행(검증 실패 400) 박제.
//
// controller-scope ValidationPipe (whitelist + forbidNonWhitelisted + transform) 와
// 결합되어 다음을 자동 강제한다:
//   - 여기 정의되지 않은 필드(대표적으로 `isPrimary`)는 forbidNonWhitelisted 가 400.
//   - decorator 위반(빈 값 · 형식 위반 · 길이 초과 · type 불일치)도 400.
//
// 필드가 `service` · `externalId` 두 개뿐인 이유:
//   - `personId` 는 nested route 의 path param 이므로 body 에 두지 않는다(ADR §Decision 1).
//   - `isPrimary` 는 받지 않는다 — ADR §Decision 2 가 primary 축을 전용 경로
//     POST /identities/:identityId/primary 하나로 단일화했고, 첫 row 자동 승격도
//     service layer 책임이라 body 로 열면 setPrimary transaction 을 우회하게 된다.
//
// 책임 경계 (Out of Scope):
//   - primary invariant 강제(첫 row 자동 승격 · 삭제 후 재승격)는 ServiceIdentityService.
//   - ServiceIdentityRepository.update 확장 · controller / guard 배선 · e2e 는 후속 slice.
import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class CreateServiceIdentityDto {
  // 수집 매칭 키 (ADR §Decision 6). 값 집합의 정본은 배포 환경의 GitHub instance key
  // (env GITHUB_INSTANCES) 라 서버 상수 allowlist(@IsIn) 를 쓰지 않고 형식만 막는다 —
  // 공백 · 제어문자 · 과길이 · 허용 문자 밖 기호를 4 decorator 로 차단.
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9._-]+$/)
  service!: string;

  // 해당 서비스에서의 계정 식별자. 서비스별 ID 표기가 자유로워(GitHub login · 사번 ·
  // 이메일 형태 등) 형식 정규식을 두지 않고 길이 상한만 강제한다.
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  externalId!: string;
}
