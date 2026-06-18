// CreateImportDto — POST /api/admin/import 의 request body 검증 DTO (T-0489,
// ADR-0044 §1/§2). CreateExportDto (T-0488) 의 class-validator decorator 패턴
// mirror — controller-scope ValidationPipe (whitelist + forbidNonWhitelisted +
// transform) 와 결합해 형식 검증을 boundary 에서 강제한다.
//
// 본 DTO 가 보유하지 않는 것 (ADR-0044 §2 raw 미저장 정합):
//   - raw payload 필드 0 — ImportJob 의 어떤 필드도 raw 외부 본문을 보유하지 않으며
//     DTO 입력도 동일하다. whitelist + forbidNonWhitelisted 가 정의되지 않은 키 (raw
//     본문 키 등) 를 400 으로 거부해 raw 본문 0 구조를 type 차원에서 보존한다.
//   - requestedById 부재 — 누가 import 를 발화했는지는 인증 actor (req.user.sub) 에서
//     추출하므로 DTO 에 박제하지 않는다 (client 가 임의 발화자 위장 불가, REQ-045).
//   - multipart file / artifact raw 본문 부재 — 실 artifact upload 는 T-0489 §Out of
//     Scope (새 infra 표면). 본 DTO 는 mode 만 받는 JSON body 이며 file 입력 0.
//
// mode 분기 (ImportJobService.assertModeInvariant 가 실 검증 — DTO 는 형식만):
//   - mode 미지정 → service 가 schema @default(REPLACE) 적용 (DTO 가 default 강제 0).
//   - mode=REPLACE / MERGE → @IsEnum(ImportMode) 통과. 그 외 (예: "PATCH" / 소문자
//     "replace" / 빈 값) 는 ValidationPipe 가 boundary 에서 400 으로 거부.
//
// 책임 경계 (Out of Scope — T-0489 §Out of Scope):
//   - multipart 파일 수신 / 실 artifact upload·파싱 — 후속 slice (새 infra 표면).
//   - 새 외부 dependency 0 — class-validator 는 이미 의존 (전 DTO 가 사용 중).
import { ImportMode } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

export class CreateImportDto {
  // mode — 복원 모드 (REPLACE / MERGE). 선택적 — @IsOptional 로 미지정 허용하고
  // 지정 시 @IsEnum(ImportMode) 으로 유효 멤버만 통과 (예: "PATCH" / 소문자
  // "replace" / number 등 비유효 값은 400). 미지정 시 service 가 schema
  // @default(REPLACE) 를 적용하므로 DTO 는 default 를 강제하지 않는다.
  @IsOptional()
  @IsEnum(ImportMode)
  mode?: ImportMode;
}
