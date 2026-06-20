// EvaluationUnevaluatedFillPlanner — 미평가 fill 계획 impure compose service
// (PLAN.md P5 bullet 106 / R-64 / REQ-037 "평가 없는 부분 일괄 평가"의 detection 사슬을
// 닫는 wiring slice). 순수-도메인 4 조각(enumerate / project / select / batch-plan)을
// 잇는 순수 compose helper `composeUnevaluatedFillPlan`(T-0540)과 그 `persisted` 입력을
// 실제 DB 에서 길어 오는 read-adapter `EvaluationPersistedRecordsReader`(T-0541) 사이를
// 잇는 **얇은 @Injectable service** 다.
//
// 책임(REQ-037 detection 사슬의 impure compose 완결 — 조립만):
//   `IntendedPeriodCoordinatesInput`(의도 좌표 enumeration 입력)을 받아 —
//     (1) 그 입력의 `personIds`(+ 선택적 `period`)로 reader.readForPersons 를 await 호출해
//         `PersistedAssessmentRecord[]`(이미 평가된 영속 레코드)를 읽고,
//     (2) `{ intended, persisted }` 로 `UnevaluatedFillPlanInput` 을 조립한 뒤,
//     (3) 순수 `composeUnevaluatedFillPlan` 을 호출해 `UnevaluatedFillBatchPlan` 을 반환한다.
//   compose 결과 가공/필터/정렬 추가 0 — 순수 helper 의 결정성·순서 정책을 그대로 전파한다.
//
// 경계(task Out of Scope):
//   - 새 repository 메서드 / 새 query 표면 / 새 ADR / schema 변경 0 — 기존 reader(T-0541)와
//     기존 순수 helper(T-0540)를 조립할 뿐이다.
//   - `intended` range/person 외부 source(스케줄러·요청 DTO 등) 결정은 본 service 밖 —
//     이미 결정된 `IntendedPeriodCoordinatesInput` 을 받기만 한다.
//   - orchestrator/controller 실배선(산출 plan → 실 일괄 평가 실행)·module provider 등록은
//     후속 wiring slice(실 소비처가 생길 때 함께). 본 service 는 class 만(등록 없이도
//     unit test 는 독립 통과).
//
// 패턴 mirror: evaluation-result-persist.service.ts / evaluation-persisted-records-reader
// .service.ts 의 constructor DI 패턴(@Injectable + constructor private readonly 주입) +
// 도메인 helper 들의 fail-fast 방어(명시적 null/undefined 한국어 메시지 `TypeError`). 본
// service 는 wrapper level 에서 1 차 fail-fast 하고, 각 조각(reader / 순수 4 조각)의 내부
// 방어는 그대로 자연 전파한다(single-source — 재던지지 않는다).
import { Injectable } from "@nestjs/common";

import type { IntendedPeriodCoordinatesInput } from "./domain/evaluation-intended-period-coordinates";
import type { UnevaluatedFillBatchPlan } from "./domain/evaluation-unevaluated-fill-batch-plan";
import { composeUnevaluatedFillPlan } from "./domain/evaluation-unevaluated-fill-plan";
import { EvaluationPersistedRecordsReader } from "./evaluation-persisted-records-reader.service";

@Injectable()
export class EvaluationUnevaluatedFillPlanner {
  constructor(private readonly reader: EvaluationPersistedRecordsReader) {}

  // planUnevaluatedFill — 의도 좌표 입력으로 미평가 fill batch plan 을 impure compose 한다
  // (REQ-037 detection 사슬의 impure compose 완결).
  //
  // 흐름:
  //   (1) intended 입력 1 차 fail-fast 방어(null/undefined → 한국어 메시지 `TypeError`).
  //       reader / 순수 조각에 위임하기 전 wrapper 1 차 차단(silent skip 시 일괄 평가
  //       누락을 유발하므로 fail-fast 가 안전 — R-112 negative). intended.personIds 등
  //       내부 field 의 정밀 방어는 reader / 순수 조각이 자연 전파한다(중복 검증 0).
  //   (2) intended.personIds(+ 선택적 intended.period)로 reader.readForPersons 를 await 호출.
  //       period 가 지정돼 있으면 `{ period }` 옵션으로 forward, 미지정(undefined)이면
  //       옵션 자체를 undefined 로 넘겨 reader 의 전체 period 분기를 탄다.
  //   (3) 읽은 영속 레코드를 `{ intended, persisted }` 로 조립해 순수 compose 호출 → 반환.
  //       reader reject(의존성 실패) 시 await 가 그대로 throw → 호출자에 자연 전파.
  //
  // 비변형: 전달받은 intended 객체를 mutate 하지 않는다(읽기만 — reader 에 field 를 전달하고
  // compose 입력 wrapper 에 그대로 참조로 담을 뿐, 새 상태를 intended 에 쓰지 않는다).
  //
  // @param intended 의도 좌표 enumeration 입력. 변형하지 않는다.
  // @returns 미평가 gap 좌표를 person 별로 요약한 `UnevaluatedFillBatchPlan`(compose 출력
  //   그대로 — 가공 0).
  // @throws {TypeError} intended 가 null/undefined 일 때(wrapper 1 차 방어). reader 의
  //   rejection(의존성 실패) 및 순수 조각의 내부 방어 예외(personIds 원소 타입 / 미지원
  //   period / Invalid Date 등)는 그대로 자연 전파된다.
  async planUnevaluatedFill(
    intended: IntendedPeriodCoordinatesInput,
  ): Promise<UnevaluatedFillBatchPlan> {
    if (intended === null || intended === undefined) {
      throw new TypeError("intended 가 null/undefined 일 수 없다.");
    }

    // period 지정 분기: 지정 시 `{ period }` 옵션으로 forward, 미지정 시 undefined 로 forward
    // (reader 의 전체 period 분기). personIds 의 정밀 방어는 reader 가 수행(중복 검증 0).
    const options =
      intended.period === undefined ? undefined : { period: intended.period };
    const persisted = await this.reader.readForPersons(
      intended.personIds,
      options,
    );

    // 읽은 영속 레코드를 순수 compose 입력 wrapper 로 조립 → 순수 helper 가 4 조각을 잇는다.
    return composeUnevaluatedFillPlan({ intended, persisted });
  }
}
