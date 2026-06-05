// GrantInstanceAccessDto — grant/revoke binding WRITE endpoint 의 request body 검증
// 책임 DTO (ADR-0027 Decision §2). grant(`POST /api/users/{id}/instance-access`)와
// revoke(`DELETE .../instance-access` + body) 는 둘 다 `{ instanceRef: string }`
// 동일 shape 를 받으므로 단일 DTO 를 양쪽에서 재사용한다 (ADR-0027 §2 — grant/revoke
// 양쪽이 동일 DTO shape). controller slice (ADR-0027 후속 chain row (2)) 가 본 DTO
// 를 `@Body()` 로 사용한다 — 본 slice 는 DTO + service 만, controller 0.
//
// validation rule 은 CreateLlmProviderConfigDto / AssignDifficultyMappingDto 의
// string 검증 패턴 1:1 mirror (ADR-0027 §2):
//   - @IsString — string type 강제 (number / boolean / null 거부).
//   - @IsNotEmpty — 빈 문자열 / null / undefined 거부 (정규화 전 1차 차단 — 빈/공백
//     instanceRef 는 유효 binding 아님, ADR-0024 §4(iv)). 공백-only 는 @IsNotEmpty
//     가 trim 하지 않아 통과할 수 있으나, service → repository.create() 의
//     normalizeInstanceRef() 가 공백을 trim 후 빈 문자열로 만들어 Error 로 거부
//     (정규화 단일 source — DTO 는 형식, 정규화 결과 무효는 service/repo 책임).
//   - @MaxLength(2048) — 과대 입력 방어 cap. instanceRef 는 GitHub configured host
//     또는 Confluence 풀 REST base URL (CreateLlmProviderConfigDto.endpointUrl 의
//     @MaxLength(2048) 와 동형 — 같은 성격의 URL/host 길이 cap, record schema 의
//     instanceRef String 컬럼과 정합).
//
// 책임 경계 (Out of Scope — ADR-0027 후속 chain):
//   - host/URL well-formedness (scheme 유무 / host 형식) 의 추가 형식 검증은 본 DTO
//     책임 외 — normalizeInstanceRef() 의 정규화 결과(정규화 후 빈 문자열 = 무효)에
//     위임 (ADR-0027 §2). 본 DTO 는 비어있지 않은 string + 길이 cap 만 검증.
//   - whitelist + forbidNonWhitelisted (extra-property 거부) 는 controller-scope
//     ValidationPipe 책임 — 본 DTO 의 decorator 만으로는 cover 안 됨 (controller slice).
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class GrantInstanceAccessDto {
  // 부여/회수 대상 instance 식별자 — GitHub 의 configured host (예:
  // github.sec.samsung.net) 또는 Confluence 의 풀 REST base URL (예:
  // https://acme.atlassian.net/wiki/rest/api). ADR-0022 §1 / ADR-0024 §1 정의
  // 그대로 — 신규 식별자 개념 도입 0.
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  instanceRef!: string;
}
