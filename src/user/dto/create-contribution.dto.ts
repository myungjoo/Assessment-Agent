// CreateContributionDto — REQ-029/033 개별 commit/PR/문서 단위 기여 데이터 영속의
// POST /api/contributions payload 검증 DTO. T-0118 acceptance 박제. CreateAssessmentDto
// (T-0117) 패턴 1:1 mirror — 단 Contribution 은 periodStart / narrative 부재 (Contribution
// 은 외부 본문을 가리키는 pointer + 정량 수치만 보유, ADR-0006 §2).
//
// 본 DTO 는 ContributionController 의 POST /api/contributions 엔드포인트의 @Body() 로 사용된다.
// ValidationPipe (controller-scope @UsePipes, ContributionController 결정) 의
// whitelist + forbidNonWhitelisted + transform 옵션과 결합되어 다음을 자동 강제한다:
//   - 정의되지 않은 필드 (예: raw 본문 키 `rawBody` / `content` / `diff` / `message` 등) 는 400 BadRequest.
//   - decorator 위반 (필수 field 누락 / wrong type / 음수 volume 등) 도 400.
//   - transform=true 가 plain JSON 을 본 class 의 instance 로 변환 (contributionScore 의
//     numeric 변환 등). Contribution 은 Date 컬럼이 없어 @Type(() => Date) 불요.
//
// ContributionCreateInput (contribution.repository.ts L54-69) 의 7 키와 정합 (ADR-0006 §2
// 허용 입력 컬럼). 본 DTO 는 형식 검증만 — sourceType / difficulty 의 enum-as-String
// 허용 literal 값 검증은 ContributionService 책임 (service 의 BadRequestException, 형식과
// 중복 방지 위해 DTO 는 @IsIn 미적용 — create-assessment.dto.ts 정합).
//
// raw 미저장 (R-59 / REQ-032 / ADR-0006 Decision §4) DTO-level 정합:
//   - 본 DTO 는 raw 본문 키 (commit body / diff / 문서 본문 / rawBody / content /
//     message 등) 를 절대 정의하지 않는다 — schema-level 강제 (Contribution 모델에 raw
//     컬럼 부재) 의 DTO-level mirror. sourceUrl + sourceRef 는 외부 본문을 가리키는
//     pointer (참조 식별자) 일 뿐 본문 자체가 아니다 (REQ-031 재수집 backbone).
//     whitelist + forbidNonWhitelisted 가 정의 외 필드를 400 으로 reject.
//
// 책임 경계 (Out of Scope):
//   - SummaryCreateDto — 별도 후속 slice.
//   - update payload (PATCH) DTO — Contribution 은 immutable (ADR-0006 §2, update 미박제).
import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from "class-validator";

export class CreateContributionDto {
  // assessmentId — 본 Contribution 이 속한 Assessment 의 N:1 FK. 존재 검증 (실
  // Assessment row) 은 Prisma FK / service (P2003 → BadRequest) 책임 — DTO 는 형식
  // (비어있지 않은 string) 만 검증.
  @IsString()
  @IsNotEmpty()
  assessmentId!: string;

  // sourceType — "commit" / "pr" / "document" enum-as-String. 허용 literal 값 검증은
  // ContributionService (BadRequestException) 책임 — DTO 는 형식 (비어있지 않은 string) 만.
  @IsString()
  @IsNotEmpty()
  sourceType!: string;

  // sourceUrl — 외부 GitHub / Confluence URL. 본문이 아닌 pointer (참조 식별자, R-59).
  // DTO 는 형식 (비어있지 않은 string) 만 검증 — URL 형식 정밀 검증은 별도 책임.
  @IsString()
  @IsNotEmpty()
  sourceUrl!: string;

  // sourceRef — commit SHA / PR number / page version ID. 본문이 아닌 pointer (R-59).
  @IsString()
  @IsNotEmpty()
  sourceRef!: string;

  // difficulty — "easy" / "medium" / "hard" enum-as-String. 허용 literal 값 검증은
  // service 책임 — DTO 는 형식만.
  @IsString()
  @IsNotEmpty()
  difficulty!: string;

  // contributionScore — 기여도 정규화 수치 (REQ-036). Prisma 의 Decimal 컬럼.
  // transform=true 가 numeric 입력을 number 로 변환, @IsNumber 가 형식 검증.
  // Prisma 가 number 를 Decimal 로 내부 변환 (contribution.repository.ts L66 정합).
  @IsNumber()
  contributionScore!: number;

  // volume — 양 (변경 line 수 / 문서 단어 수 등 단일 Contribution 의 정량 수치). 음수 불가.
  @IsInt()
  @Min(0)
  volume!: number;
}
