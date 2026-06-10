// PeriodBridgeEphemeralService — period→collect→evaluate ephemeral orchestration
// bridge service (T-0316, ADR-0037 §Decision1 User self-only ephemeral 경로 +
// §Decision4 fresh in-memory collect source-of). ADR-0037 의 **FIRM 결정만** compose
// 하는 ephemeral 산출-반환 service 다 — 한 (resolved) Person + 기간으로부터 활동을
// 새로 수집(in-memory)·귀속 필터·평가해 `EvaluationResult[]` 를 **DB write 0** 로
// 반환한다. README R-9(임의 기간 평가문 요청, PLAN P5 L98)의 User 경로를 충족한다.
//
// 흐름(ADR-0037 §Decision1 ephemeral 4 단계 compose):
//   (1) buildCollectionSpec(person, since) → CollectionSpec(GitHub mode B+A + Confluence).
//   (2) collectActivities(spec) → Activity[](GitHub+Confluence aggregate, in-memory,
//       persist-free orchestrator — orchestrator 자체는 throw 0, 부분 가용성 흡수).
//   (3) filterActivitiesByAuthor(activities, person.serviceIdentities) → Person 귀속
//       활동만(순수 함수, ADR-0030 §2 author 귀속).
//   (4) evaluateActivities(filtered, options) → EvaluationResult[](in-memory scoring,
//       DB write 0). 반환값을 그대로 응답으로 흘려보낸다(persist 0).
//
// 구조적 write-0 보장(ADR-0037 §Decision1, §Consequences "ephemeral write-0 의 구조적
// 강제"): 본 service 는 어떤 persist symbol 도 **생성자 주입조차 하지 않는다** —
// `EvaluationResultPersistService` / `CollectionPersistenceService` /
// `CollectForPersonInput.collectForPerson`(persistActivities 포함) / `PrismaService` /
// `$transaction` 에 대한 참조가 0 이다. persist 도달 불가가 "호출 안 하면 된다" 는
// 약속이 아니라 **구조적 분기**(주입 부재 → 도달 경로 부재)로 강제되므로 회귀에
// 안전하다. 본 service 는 아래 3 개 collaborator 만 주입받는다(persist-free 만 compose):
//   - CollectionSpecService(buildCollectionSpec)
//   - CollectionOrchestratorService(collectActivities, persist-free)
//   - EvaluationOrchestratorService(evaluateActivities, in-memory)
//
// 책임 경계(Out of Scope — task §Out of Scope / ADR-0037):
//   - Admin full-persist 경로(§Decision2 double-write 경계 / §Decision3 idempotency)는
//     PROPOSE 상태(사용자 ADR PR 검토 대기)라 본 service 가 일절 baking 하지 않는다 —
//     persist 호출·`@@unique`·P2002→Conflict 매핑·mode(fill|reeval) 분기 0.
//   - personId → ServiceIdentity DB 조회 / Person row 존재 검증 / self-only RBAC
//     (personId 동등성) 강제는 slice 3(controller) / slice 4(RBAC guard) 책임 — 본
//     service 는 호출처가 넘긴 **resolved** `person` 입력을 받는다.
//   - controller endpoint(POST /api/assessment-evaluation/period) 신설은 slice 3.
//   - e2e / 실 PostgreSQL / 동시 호출 idempotency 검증은 slice 5(ADR-0004).
//   - live LLM round-trip 은 §Decision5 credential 게이트 deferred — mocked-LLM unit 만.
import { Injectable } from "@nestjs/common";
import type { ServiceIdentity } from "@prisma/client";

import { CollectionOrchestratorService } from "../assessment-collection/collection-orchestrator.service";
import { CollectionSpecService } from "../assessment-collection/collection-spec.service";
import { filterActivitiesByAuthor } from "../assessment-collection/domain/author-filter";

import type { EvaluationResult } from "./domain/evaluation-result";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import type { ScoringOptions } from "./evaluation-scoring.service";

// PeriodBridgePersonInput — generateEphemeral 의 person 입력 contract.
// `CollectForPersonInput`(collection-entry.service.ts) 을 mirror 한다 —
// `serviceIdentities` 의 `service`(buildCollectionSpec 의 GitHub instance 매칭용) +
// `externalId`(filterActivitiesByAuthor 의 author 귀속 key, ADR-0030 §2) 를 둘 다
// 보유한다. 전체 Prisma Person row 불요. personId→ServiceIdentity resolve / self-only
// RBAC 는 본 service 밖(slice 3/4) — 호출처가 resolved person 을 넘긴다.
export interface PeriodBridgePersonInput {
  serviceIdentities: Pick<ServiceIdentity, "service" | "externalId">[];
}

@Injectable()
export class PeriodBridgeEphemeralService {
  // 3 개 collaborator 만 주입 — 전부 persist-free / in-memory(구조적 write-0 보장).
  // persist service(EvaluationResultPersistService / CollectionPersistenceService) /
  // collectForPerson / PrismaService 는 의도적으로 주입하지 않는다(ADR-0037 §Decision1).
  // test 는 이 3 자리에 mock 을 주입해 실 LLM / 실 DB / 실 네트워크 0 으로 compose 정합만
  // 검증한다.
  constructor(
    private readonly specService: CollectionSpecService,
    private readonly orchestrator: CollectionOrchestratorService,
    private readonly evaluation: EvaluationOrchestratorService,
  ) {}

  /**
   * 한 (resolved) Person + 기간으로부터 평가문을 **ephemeral(DB write 0)** 로 산출해
   * `EvaluationResult[]` 를 반환한다 (ADR-0037 §Decision1 User self-only ephemeral +
   * §Decision4 fresh in-memory collect).
   *
   * 흐름(persist-free 4 단계 compose):
   *   (1) buildCollectionSpec(person, period.since) → CollectionSpec.
   *   (2) collectActivities(spec) → Activity[](in-memory, persist-free, throw 0).
   *   (3) filterActivitiesByAuthor(activities, person.serviceIdentities) → 귀속 활동만.
   *   (4) evaluateActivities(filtered, options) → EvaluationResult[](in-memory) → 반환.
   *
   * 정책:
   *   - persist 호출 0 — 산출물은 반환값으로만 흐르고 저장되지 않는다(read-only 모델
   *     보존, §Decision1). 어떤 write path(Contribution FK / EvaluationResult / Summary)
   *     도 타지 않는다(주입 부재로 구조적 보장).
   *   - period.since 는 도출 없이 (1)로 pass-through 한다(undefined 면 undefined 그대로 —
   *     collection-side 가 전체 기간으로 해석). since 외 추가 분기 0(분기 최소화).
   *   - 빈 수집 흡수: (2)가 빈 Activity[] 또는 (3) 귀속 0 건이면 (4)가 빈
   *     EvaluationResult[] 를 반환(throw 0 — evaluateActivities 의 빈 입력 경계).
   *   - 실패 전파(swallow 0): buildCollectionSpec / evaluateActivities 가 reject 하면 그
   *     error 를 swallow 없이 그대로 전파한다(fail-fast, 부분 결과 위장 0). collectActivities
   *     는 자체적으로 부분 가용성을 흡수하므로(orchestrator throw 0) 별도 try 0.
   *
   * @param person resolved Person 입력(serviceIdentities — service + externalId).
   * @param period 평가 기간 — `since` 미지정 시 전체 기간(collection-side 해석).
   * @param options scoring 옵션 — evaluateActivities 에 그대로 전달(`ScoringOptions`).
   * @returns in-memory `EvaluationResult[]`(DB write 0).
   */
  async generateEphemeral(
    person: PeriodBridgePersonInput,
    period: { since?: string },
    options: ScoringOptions,
  ): Promise<EvaluationResult[]> {
    // (1) 수집 spec 조립 — since 는 pass-through(도출 0). reject 는 전파(fail-fast).
    const spec = await this.specService.buildCollectionSpec(
      person,
      period.since,
    );

    // (2) in-memory 수집(persist-free orchestrator) — GitHub+Confluence aggregate.
    //     orchestrator 는 부분 가용성을 자체 흡수하므로 throw 0(별도 try 불요).
    const activities = await this.orchestrator.collectActivities(spec);

    // (3) author 귀속 필터(순수 함수) — Person 기여만 남긴다(타인 활동 제외).
    const filtered = filterActivitiesByAuthor(
      activities,
      person.serviceIdentities,
    );

    // (4) in-memory 평가(DB write 0) — 결과를 그대로 반환(persist 0). reject 는 전파.
    return this.evaluation.evaluateActivities(filtered, options);
  }
}
