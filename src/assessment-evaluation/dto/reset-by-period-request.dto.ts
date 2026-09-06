// ResetByPeriodRequestDto — P5 bullet 106(R-64 / REQ-037 "Reset & Reeval")의 디버깅용
// **명시적 partial-reset** endpoint(후속 controller wiring slice)의 request body 검증 DTO.
// ADR-0033 §Decision §3 / ADR-0035 98 행이 박제한 "partial reset = key prefix 부분 일치
// delete" 의 2 축 — personId + period — 를 HTTP boundary 에서 **형식만** 검증한다.
//
// `UnevaluatedFillPlanRequestDto`(T-0544) / `PeriodBridgeDto`(T-0317) 패턴 mirror —
// class-validator decorator 로 형식만 검증하고, 허용 literal 값(period 의 day/week/month)
// 검증은 service 책임이다(@IsIn 미적용, 기존 evaluation DTO 관행 정합). 실제 literal 게이트는
// `summary-persist.service.ts` 144 행 `resetByPeriod` 가 첫 줄에서 호출하는
// `assertValidPeriod(period)` 와 `evaluation-result-persist.service.ts` 145 행 동명 메서드가
// 소유하므로, DTO 가 같은 판정을 중복 소유하면 허용 literal 정본이 두 곳으로 갈라진다.
//
// 본 DTO 는 후속 controller endpoint slice(Follow-up (a))의 @Body() 로 사용되어
// `evaluationResultPersist.resetByPeriod(personId, period)` 와
// `summaryPersist.resetByPeriod(personId, period)` 로 그대로 흘러간다. controller-scope
// ValidationPipe(whitelist + forbidNonWhitelisted + transform)와 결합돼 다음을 자동 강제한다:
//   - 정의되지 않은 필드 → 400 BadRequest(forbidNonWhitelisted) — 오타 필드로 인한
//     "의도보다 넓은 삭제" 를 boundary 에서 차단(reset 은 파괴적 연산이라 특히 중요).
//   - decorator 위반(필수 누락 / 빈 문자열 / wrong type) → 400.
//
// 책임 경계(task Out of Scope 정합):
//   - controller route(@Post("reset")) 실배선 · RBAC guard · 삭제 건수 응답 형태는 본 DTO
//     밖(Follow-up (a) slice 2/2).
//   - 허용 period literal 검증은 service 의 `assertValidPeriod` 책임(@IsIn 미적용).
//   - 공백-only 문자열은 형식상 통과한다 — `@IsNotEmpty` 는 trim 하지 않으며, trim/정규화
//     정책을 DTO 가 발명하면 personId 정규화 정본(service/domain)과 갈라지기 때문이다.
//   - 새 외부 dependency 0 — class-validator 는 이미 의존(같은 디렉토리 DTO 들이 사용 중,
//     package.json 박제). nested DTO 0(2 축 모두 primitive string 이라 `@Type` 불요).
import { IsNotEmpty, IsString } from "class-validator";

export class ResetByPeriodRequestDto {
  // personId — partial-reset 대상 person 식별자(`resetByPeriod` 의 첫 인자, prisma
  // `deleteMany({ where: { personId, period } })` 의 leading-edge 축). 형식만 검증 —
  // 실 Person row 존재 여부·정규화는 본 DTO 밖(service 책임).
  @IsString()
  @IsNotEmpty()
  personId!: string;

  // period — 삭제 대상 period 종류(day/week/month enum-as-String, `resetByPeriod` 의 둘째
  // 인자). 형식만 검증하고 허용 literal 값은 service 의 `assertValidPeriod` 책임
  // (@IsIn 미적용 — unevaluated-fill-plan-request.dto 의 period 관행 정합).
  @IsString()
  @IsNotEmpty()
  period!: string;
}
