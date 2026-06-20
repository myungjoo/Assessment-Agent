// unevaluated-fill-plan-request.mapper — P5 bullet 106(R-64 / REQ-037 "평가 없는 부분
// 일괄 평가" / REQ-038)의 미평가 fill 계획 요청 HTTP boundary 와 순수-도메인 enumeration
// 입구 사이를 잇는 순수 변환 함수. `UnevaluatedFillPlanRequestDto`(T-0544, 5 축 string
// surface) → `IntendedPeriodCoordinatesInput`(evaluation-intended-period-coordinates.ts
// L41~47, rangeStart/rangeEnd 가 Date 축)으로 변환한다.
//
// 책임(string→Date 변환 slice 만):
//   - personIds / period / scope 3 축은 그대로 전사(passthrough). personIds 는 새 배열로
//     복사해 입력 dto.personIds 를 비변형 — 도메인 helper 가 입력 비변형을 기대하므로 안전.
//   - rangeStart / rangeEnd 2 축만 string → Date 로 변환한다. **변환은 raw `new Date(...)`
//     가 아니라 `parseKstPeriodInput`(common/period-boundary.ts L211) single-source helper
//     를 경유**한다(R-9 / ADR-0039 §Decision3 (d)/§Decision5 정합 — offset 미명시 시 KST
//     해석, malformed 입력 명시적 error). controller 의 `EvaluateActivitiesDto.periodStart`
//     변환·`normalizeKstPeriodStart` 가 같은 helper 를 경유하는 관행 mirror — opaque
//     Invalid Date 가 planner 로 흘러드는 500 을 차단하고 timezone drift 를 구조적으로 막는다.
//
// 경계(task Out of Scope 정합):
//   - KST boundary snap / 범위 검증(rangeStart < rangeEnd) / 허용 literal 값 검증
//     (period day/week/month, scope commit/document/aggregate)은 본 mapper 밖
//     (domain helper / service / controller 책임). 본 mapper 는 instant 변환만(snap·검증 0).
//   - controller endpoint 실배선(@Get/@Post)·RBAC(@Roles)·ValidationPipe 결합·planner
//     실호출은 본 mapper 밖(후속 wiring slice).
//   - 순수 함수 — `@Injectable` 0, NestJS / Prisma / LLM import 0, 부수효과 0, 입력 비변형.
//     import 는 입력 타입 + 출력 타입 + `parseKstPeriodInput` 3 종만. 새 외부 dependency 0.

import { parseKstPeriodInput } from "../../common/period-boundary";
import type { IntendedPeriodCoordinatesInput } from "../domain/evaluation-intended-period-coordinates";

import type { UnevaluatedFillPlanRequestDto } from "./unevaluated-fill-plan-request.dto";

/**
 * 미평가 fill 계획 요청 DTO(string 축) → `IntendedPeriodCoordinatesInput`(Date 축) 순수
 * 변환(P5 bullet 106 / R-64 / REQ-037 detection 사슬의 HTTP→도메인 bridge).
 *
 * 변환 규칙:
 *   - personIds : 새 배열로 복사해 전사(입력 dto.personIds 비변형 — 도메인 helper 가 입력
 *                 비변형을 기대). 빈 배열은 빈 배열로 그대로 전사(빈 배열 → 빈 plan 정책).
 *   - period / scope : 그대로 전사(허용 literal 검증 0 — domain helper / service 책임).
 *   - rangeStart / rangeEnd : `parseKstPeriodInput` single-source helper 경유로 string →
 *                 Date 변환(raw `new Date(...)` 금지). offset 미명시 입력은 KST 로 해석된다.
 *
 * 형식 위반은 `parseKstPeriodInput` 의 `TypeError`(비문자열/빈 문자열)·`RangeError`(형식
 * 위반/달력 불가능 값)가 **자연 전파**된다 — mapper 가 재던지지 않아 single-source error
 * 메시지를 보존한다. 정상 경로에서는 DTO ValidationPipe(@IsISO8601)가 ISO 형식을 이미
 * 강제하므로 본 helper error 는 방어 그물(opaque Invalid Date 의 planner 유입 차단).
 *
 * @param dto 미평가 fill 계획 요청 DTO. 변형하지 않는다(personIds 는 복사 전사).
 * @returns `IntendedPeriodCoordinatesInput` — rangeStart/rangeEnd 가 Date 로 변환된 좌표 입력.
 * @throws {TypeError} `dto` 가 null/undefined 이거나, rangeStart/rangeEnd 가 비문자열/빈
 *   문자열일 때(후자는 `parseKstPeriodInput` 자연 전파).
 * @throws {RangeError} rangeStart/rangeEnd 가 ISO 형식 위반/달력 불가능 값일 때
 *   (`parseKstPeriodInput` 자연 전파).
 */
export function toIntendedPeriodCoordinatesInput(
  dto: UnevaluatedFillPlanRequestDto,
): IntendedPeriodCoordinatesInput {
  // dto 자체 방어 — null/undefined 면 한국어 메시지 TypeError 로 fail-fast(silent 진행
  // 시 속성 접근에서 opaque TypeError 가 나므로, 명시적 메시지로 조기 노출).
  if (dto === null || dto === undefined) {
    throw new TypeError(
      "toIntendedPeriodCoordinatesInput: dto 가 null/undefined 일 수 없다.",
    );
  }

  return {
    // personIds 는 새 배열로 복사 전사 — 입력 dto.personIds 비변형(도메인 helper 안전).
    personIds: [...dto.personIds],
    // period / scope 는 그대로 전사(허용 literal 검증은 domain helper / service 책임).
    period: dto.period,
    scope: dto.scope,
    // rangeStart / rangeEnd 만 single-source helper 경유로 string → Date 변환.
    rangeStart: parseKstPeriodInput(dto.rangeStart),
    rangeEnd: parseKstPeriodInput(dto.rangeEnd),
  };
}
