// BackfillRunnerService — 신규 인원 1년치 backfill "실행" runner (T-0419, P7 ⑤ slice 2
// 1차 sub-slice, R-50 / REQ-027). slice 1(T-0418, buildBackfillPlan)이 "무엇을 평가할지"
// (주 단위 window 목록)를 산출하는 순수 helper 였다면, 본 service 는 그 출력을 **실제로
// 실행**한다 — buildBackfillPlan 으로 산출한 각 주 window 를 CollectionTriggerService.
// triggerCollection 으로 순차 소비하고, "신규 인원 1회만 backfill"(중복 backfill 방지)
// idempotency 결정을 담당한다.
//
// 책임 경계(Out of Scope, task §Out of Scope):
//   - building block 재구현 0 — buildBackfillPlan(boundary 산술) / triggerCollection
//     (수집 6단계)은 호출만(시그니처 불변). 본 service 는 조립·순회·idempotency 분기만.
//   - "신규 인원 추가" 이벤트 hook(PersonService create 연동) / manual REST endpoint /
//     DB persistence(backfill 완료 표식 영속) 는 후속 sub-slice. 본 service 는 personId 를
//     인자로만 받고 schema 무변경.
//   - 실 live/credentialed 수집은 Q-0025 deferred — 본 service 는 mock-testable(triggerCollection
//     mock 주입), 실 token·실 DB 0.
import { Inject, Injectable, Optional } from "@nestjs/common";

import { CollectionTriggerService } from "../assessment-collection/collection-trigger.service";

import { buildBackfillPlan } from "./backfill-plan";

// backfill 호출의 도메인 period — 일반 인원의 매주 1회 평가와 정합하는 "주 단위"(R-50).
// triggerCollection → AssessmentService.create 가 검증하는 enum-as-String 허용 집합은
// ["day","week","month"](VALID_PERIODS)이므로 helper granularity "weekly" 가 아니라 도메인
// 라벨 "week" 를 박제한다(helper 출력은 주 단위지만 DB 저장값은 "week"). 다른 값을 넘기면
// triggerCollection 내부에서 BadRequestException 으로 거부된다.
const BACKFILL_PERIOD = "week";
// backfill 의 평가 scope — 1년 회고는 특정 채널 단건이 아니라 활동 전반을 합산하는 성격이라
// "aggregate" 를 기본값으로 박제한다(VALID_SCOPES = ["commit","document","aggregate"]).
const BACKFILL_SCOPE = "aggregate";

// AlreadyBackfilledChecker — "이 personId 가 이미 backfill 됐는가" 판정자 인터페이스.
// 영속 flag/DB 기반 실 판정(예: 직전 Assessment 존재 여부 조회)은 schema 게이트 동반
// 별도 sub-slice 이므로, 본 task 는 판정을 **주입형 인터페이스**로 분리해 분기를 단위
// 테스트 가능하게 한다. 미주입 시 기본은 "skip 안 함"(항상 false) — 신규 인원이라 가정.
export interface AlreadyBackfilledChecker {
  // true 면 이미 backfill 됨 → triggerCollection 0회 호출하고 skip 결과 반환(REQ-027 "1회").
  isAlreadyBackfilled(personId: string): Promise<boolean>;
}

// DI token — 실 영속 판정자를 후속 sub-slice 가 이 token 으로 override 주입한다.
export const ALREADY_BACKFILLED_CHECKER = Symbol("ALREADY_BACKFILLED_CHECKER");

// BackfillRunResult — runBackfill 의 반환 요약 shape. 전문 Contribution/Assessment 반환
// 대신 요약만(slice 1·triggerCollection 의 요약 반환 convention 동형). skipped=true 면
// idempotency 판정으로 backfill 을 건너뛴 것(triggeredCount=0).
export interface BackfillRunResult {
  personId: string;
  // 산출된 총 window 수(skip 시에도 plan 길이를 보고하려 했으나, skip 은 plan 산출 전
  // 단축 회로이므로 0). triggeredCount 와 동일(부분 실패 없이 전수 처리 — fail-fast).
  totalWindows: number;
  // 실제 triggerCollection 호출(성공)한 window 수. skip 시 0, 정상 시 totalWindows 와 동일.
  triggeredCount: number;
  // idempotency 판정으로 backfill 을 건너뛰었는지.
  skipped: boolean;
}

@Injectable()
export class BackfillRunnerService {
  constructor(
    private readonly collectionTriggerService: CollectionTriggerService,
    // @Optional() — 판정자 미주입(기본) 시 항상 "skip 안 함". 후속 sub-slice 가 실 영속
    // 판정자를 ALREADY_BACKFILLED_CHECKER token 으로 주입하면 그 결과를 따른다.
    @Optional()
    @Inject(ALREADY_BACKFILLED_CHECKER)
    private readonly alreadyBackfilledChecker?: AlreadyBackfilledChecker,
  ) {}

  // runBackfill — 신규 인원 personId 의 1년치(weeks 주) backfill 을 1회 실행한다.
  //   1) idempotency 게이트: 이미 backfill 됨으로 판정되면 triggerCollection 0회 + skip 반환.
  //   2) buildBackfillPlan 으로 주 window 목록 산출(boundary 산술 직접 금지 — helper 위임).
  //      weeks 미지정 시 helper 기본값(52) 위임. weeks 검증 throw(RangeError)는 전파.
  //   3) window 를 시간순(가장 오래된 주부터, plan index 0)으로 **순차** 순회하며 각각
  //      triggerCollection 1회 호출. 순차(for...of + await)인 이유: 동일 personId 의 동시
  //      다중 Assessment 생성 race(P2002 동일 경계 충돌) 회피.
  // error 정책: 중간 window 의 triggerCollection 이 throw(Person 404 / P2002 409 / collect
  // reject)하면 **잡지 않고 그대로 전파(fail-fast)** — triggerService 의 fail-fast 동형이고,
  // 부분 backfill 상태(일부 주만 생성)의 모호함을 회피한다(중단 시점까지의 Assessment 는
  // 남되 호출자가 실패를 인지하고 재시도/조사). 부분-성공 후 계속 정책은 채택하지 않는다.
  async runBackfill(
    personId: string,
    reference?: Date,
    weeks?: number,
  ): Promise<BackfillRunResult> {
    // (1) idempotency 게이트 — 판정자 미주입이면 기본 false(신규 인원 가정, skip 안 함).
    if (await this.isAlreadyBackfilled(personId)) {
      return {
        personId,
        totalWindows: 0,
        triggeredCount: 0,
        skipped: true,
      };
    }

    // (2) 주 window 목록 산출 — boundary 는 전적으로 helper 위임. reference 미지정 시 현재
    // 시각, weeks 미지정 시 undefined 를 넘기지 않고 helper 기본값(52)을 쓰도록 분기한다
    // (명시 시 그 값을 helper 의 assertValidWeeks 가 검증 — RangeError 전파).
    const effectiveReference = reference ?? new Date();
    const plan =
      weeks === undefined
        ? buildBackfillPlan(effectiveReference)
        : buildBackfillPlan(effectiveReference, weeks);

    // (3) 시간순 순차 순회 — plan index 0(가장 오래된 주)부터. 각 window.start 를 ISO 로
    // 변환해 periodStart 로 매핑(boundary 산술 0 — helper 출력의 start 만 직렬화).
    let triggeredCount = 0;
    for (const window of plan) {
      await this.collectionTriggerService.triggerCollection({
        personId,
        period: BACKFILL_PERIOD,
        scope: BACKFILL_SCOPE,
        periodStart: window.start.toISOString(),
      });
      triggeredCount += 1;
    }

    return {
      personId,
      totalWindows: plan.length,
      triggeredCount,
      skipped: false,
    };
  }

  // isAlreadyBackfilled — 주입형 판정자 위임. 미주입(@Optional 기본 undefined)이면 항상
  // false(신규 인원 가정 — 실 영속 판정 배선은 Follow-up). 분리된 메서드라 분기 단위 테스트
  // 가능(판정자 주입 true / false / 미주입 3 경로).
  private async isAlreadyBackfilled(personId: string): Promise<boolean> {
    if (!this.alreadyBackfilledChecker) {
      return false;
    }
    return this.alreadyBackfilledChecker.isAlreadyBackfilled(personId);
  }
}
