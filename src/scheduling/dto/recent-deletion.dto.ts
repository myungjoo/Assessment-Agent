// RecentDeletionDto — POST /api/schedules/recent-deletion/:personId 본문 형식 검증 (R-74 / REQ-041).
// 본문은 { days } 만 받는다. 대상 row 는 서버가 찾으므로 instants 같은 다른 키는
// controller-scope ValidationPipe (forbidNonWhitelisted) 가 400 으로 거부한다.
// days 의 상한은 buildRecentDeletionWindow 가 검증한다. 미지정 시 runner 기본값을 쓴다.
import { IsInt, IsOptional, IsPositive } from "class-validator";

export class RecentDeletionDto {
  // 최근 며칠을 삭제 대상으로 삼을지(선택). 미지정 시 runner 기본값(DEFAULT_DAYS=1).
  // @IsOptional 로 미지정 허용, @IsInt + @IsPositive 로 정수·양수 기본 검증만 한다.
  // 실 상한/하한(예: 최대 일수) 검증은 buildRecentDeletionWindow 의 assertValidDays 에
  // 위임한다 — 본 DTO 에서 중복 검증하지 않는다(책임 경계 단일화).
  @IsOptional()
  @IsInt()
  @IsPositive()
  days?: number;
}
