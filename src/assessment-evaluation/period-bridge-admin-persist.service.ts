// PeriodBridgeAdminPersistService — period→collect→evaluate **Admin full-persist**
// orchestration bridge service (T-0321, ADR-0037 slice 2). §Decision1 Admin full path
// (임의 personId, collect→evaluate→persist, DB write 有) + §Decision2 evaluation-side
// single-writer(collection-side persist 우회) + amended §Decision3 first-write-wins
// read-through(create-if-absent-else-read) + §Decision4 fresh in-memory collect 를
// compose 한다. 머지된 User ephemeral 경로(PeriodBridgeEphemeralService, T-0316)의
// **sibling** 이다 — ephemeral 의 구조적 write-0 보장을 훼손하지 않는다.
//
// 흐름(ADR-0037 §Decision1 Admin 5 단계 compose):
//   (1) buildCollectionSpec(person, since) → CollectionSpec(GitHub mode B+A + Confluence).
//   (2) collectActivities(spec) → Activity[](in-memory, persist-free orchestrator —
//       부분 가용성 자체 흡수, throw 0; §Decision2 collection-side persist 우회).
//   (3) filterActivitiesByAuthor(activities, person.serviceIdentities) → Person 귀속만
//       (순수 함수, ADR-0030 §2 author 귀속).
//   (4) evaluateActivities(filtered, options) → EvaluationResult[](in-memory scoring).
//   (5) **first-write-wins read-through persist**(create-if-absent-else-read):
//       persist(context, results, "fill") → 좌표 부재 시 create(영속화), 존재 시 no-op.
//       반환된 assessmentId 로 영속 Assessment 를 read-back 해 caller 에게 반환한다.
//       persist 가 P2002(`@@unique` race loser)를 ConflictException 으로 던지면 catch
//       후 같은 좌표 read 경로로 fall-through 해 winner 의 저장본을 반환한다(409 전파 0).
//
// 구조적 경계(ADR-0037 §Decision1 sibling 분리 — load-bearing):
//   - 본 Admin service 는 `EvaluationResultPersistService` 를 **주입한다**(persist 도달
//     가능 — Admin 경로 한정). 반대로 PeriodBridgeEphemeralService 는 어떤 persist
//     symbol 도 주입조차 안 함으로써 write-0 을 **구조적으로** 보장한다. 두 service 를
//     분리(sibling)함으로써 ephemeral 경로의 persist 도달 불가가 그대로 유지되고,
//     persist 도달 가능성은 본 Admin service 에 국소화된다. 본 task 는 ephemeral service
//     에 role/mode 분기를 추가하지 않는다(ephemeral 의 write-0 보장 보존).
//   - 본 service 는 `reeval`(overwrite) 모드를 **호출하지 않는다** — first-write-wins
//     read-through 는 좌표 존재 시 기존 저장본을 read 반환하며 덮어쓰지 않는다(amended
//     §Decision3, overwrite DEFERRED §Follow-ups). mode 는 항상 "fill".
//
// 책임 경계(Out of Scope — task §Out of Scope / ADR-0037):
//   - controller endpoint(POST /api/assessment-evaluation/period Admin 분기)는 slice 3.
//   - RBAC(Admin 임의 personId 허용 / User self-only personId 동등성 강제)는 slice 4 —
//     본 service 는 호출처가 넘긴 resolved `context`/`person` 입력을 받는다.
//   - e2e / 실 PostgreSQL / 동시 호출 idempotency 실측은 slice 5(ADR-0004).
//   - live LLM round-trip 은 §Decision5 credential 게이트 deferred — mocked-LLM unit 만.
import { ConflictException, Injectable } from "@nestjs/common";
import type { Assessment } from "@prisma/client";

import { CollectionOrchestratorService } from "../assessment-collection/collection-orchestrator.service";
import { CollectionSpecService } from "../assessment-collection/collection-spec.service";
import { filterActivitiesByAuthor } from "../assessment-collection/domain/author-filter";
import { AssessmentRepository } from "../user/assessment.repository";

import type { EvaluationPersistContext } from "./domain/evaluation-result.persist.mapper";
import { EvaluationOrchestratorService } from "./evaluation-orchestrator.service";
import { EvaluationResultPersistService } from "./evaluation-result-persist.service";
import type { ScoringOptions } from "./evaluation-scoring.service";
import type { PeriodBridgePersonInput } from "./period-bridge-ephemeral.service";

// PeriodBridgeAdminPersistResult — Admin full-persist 의 반환 shape. first-write-wins
// read-through 로 수렴한 영속 Assessment(read-back 결과) + 본 호출이 좌표를 새로
// create 했는지 여부(create=true / read-through=false). controller slice 가 식별자
// (assessment.id)·결과를 응답으로 흘려보낸다. 좌표 부재였든 존재였든 동일 read-back
// 으로 수렴하므로 caller 는 항상 영속본을 받는다(409 전파 0).
export interface PeriodBridgeAdminPersistResult {
  assessment: Assessment;
  created: boolean;
}

@Injectable()
export class PeriodBridgeAdminPersistService {
  // 5 개 collaborator 주입 — (1~4)는 ephemeral sibling 과 동일한 persist-free compose
  // 3 종(spec/orchestrator/evaluation), (5)는 Admin 한정 persist 도달 경로를 여는 2 종
  // (persistService — 영속화 진입 / assessmentRepository — read-back). ephemeral service
  // 는 (5)의 두 collaborator 를 주입조차 하지 않는다(구조적 write-0). test 는 이 5 자리에
  // mock 을 주입해 실 LLM / 실 DB / 실 네트워크 0 으로 compose + read-through 분기를 검증한다.
  constructor(
    private readonly specService: CollectionSpecService,
    private readonly orchestrator: CollectionOrchestratorService,
    private readonly evaluation: EvaluationOrchestratorService,
    private readonly persistService: EvaluationResultPersistService,
    private readonly assessmentRepository: AssessmentRepository,
  ) {}

  /**
   * 한 (resolved) Person + 기간으로부터 평가문을 산출해 **Admin full-persist**(DB write 有)
   * 로 영속화하고, first-write-wins read-through 로 수렴한 영속 Assessment 를 반환한다
   * (ADR-0037 §Decision1 Admin + amended §Decision3 create-if-absent-else-read +
   * §Decision4 fresh in-memory collect).
   *
   * 흐름(persist-bearing 5 단계 compose):
   *   (1) buildCollectionSpec(person, period.since) → CollectionSpec.
   *   (2) collectActivities(spec) → Activity[](in-memory, persist-free, throw 0).
   *   (3) filterActivitiesByAuthor(activities, person.serviceIdentities) → 귀속 활동만.
   *   (4) evaluateActivities(filtered, options) → EvaluationResult[](in-memory).
   *   (5) persistAndReadThrough(context, results) → 영속 Assessment(create or read-back).
   *
   * 정책(first-write-wins read-through):
   *   - 좌표 부재: persist("fill") 가 create → 반환 assessmentId 로 read-back → created=true.
   *   - 좌표 존재: persist("fill") 가 no-op(write 0) → 같은 assessmentId 로 read-back →
   *     created=false(기존 저장본 반환, 두 번째 write 미발생, 409 미발생).
   *   - race P2002: persist 가 ConflictException 던짐 → catch 후 좌표 read 경로로
   *     fall-through(winner 저장본 read) → created=false(409 caller 전파 0).
   *   - reeval(overwrite) 호출 0 — mode 는 항상 "fill"(amended §Decision3, DEFERRED).
   *   - period.since 는 도출 없이 (1)로 pass-through(undefined 면 undefined 그대로).
   *   - 빈 수집 흡수: (2) 빈 Activity[] 또는 (3) 귀속 0 건 → (4) 빈 EvaluationResult[] →
   *     persist 가 빈 입력을 처리(throw 0) → read-back 으로 수렴.
   *   - 실패 전파(swallow 0): buildCollectionSpec / evaluateActivities reject 는 그대로
   *     전파(fail-fast — persist 미도달). collectActivities 는 orchestrator 가 부분 가용성을
   *     자체 흡수하므로(throw 0) 별도 try 0. P2002 만 catch — 그 외 persist error 는 전파.
   *
   * @param person resolved Person 입력(serviceIdentities — service + externalId).
   * @param period 평가 기간 — `since` 미지정 시 전체 기간(collection-side 해석).
   * @param options scoring 옵션 — evaluateActivities 에 그대로 전달(`ScoringOptions`).
   * @param context 영속 식별 4-tuple(personId/period/scope/periodStart) — Admin 임의
   *   personId 허용(self-only 강제는 slice 4 — 본 service 는 resolved context 를 받는다).
   * @returns first-write-wins read-through 로 수렴한 영속 Assessment + created 플래그.
   */
  async generateAndPersist(
    person: PeriodBridgePersonInput,
    period: { since?: string },
    options: ScoringOptions,
    context: EvaluationPersistContext,
  ): Promise<PeriodBridgeAdminPersistResult> {
    // (1) 수집 spec 조립 — since pass-through(도출 0). reject 는 전파(fail-fast).
    const spec = await this.specService.buildCollectionSpec(
      person,
      period.since,
    );

    // (2) in-memory 수집(persist-free orchestrator) — §Decision2 collection-side persist
    //     우회. orchestrator 가 부분 가용성을 자체 흡수하므로 throw 0(별도 try 불요).
    const activities = await this.orchestrator.collectActivities(spec);

    // (3) author 귀속 필터(순수 함수) — Person 기여만 남긴다.
    const filtered = filterActivitiesByAuthor(
      activities,
      person.serviceIdentities,
    );

    // (4) in-memory 평가(scoring) — reject 는 전파(persist 미도달).
    const results = await this.evaluation.evaluateActivities(filtered, options);

    // (5) first-write-wins read-through 영속화 — create-if-absent-else-read.
    return this.persistAndReadThrough(context, results);
  }

  /**
   * first-write-wins read-through 영속화(create-if-absent-else-read) — ADR-0037 amended
   * §Decision3. "fill" 모드로 persist 한 뒤 영속 Assessment 를 read-back 해 반환한다.
   * P2002(race loser)는 catch 후 좌표 read 로 fall-through(409 전파 0).
   *
   * 좌표 부재(create) / 좌표 존재(no-op) 두 분기는 모두 persist 가 assessmentId 를
   * 반환하므로 동일 read-back(findById)으로 수렴한다 — `created` 는 contributionCount
   * 로 구분한다(create 시 contributionCount = results 매핑 수 ≥0, no-op 시 항상 0).
   * 단 빈 결과 create 도 contributionCount 0 이라, no-op 과의 구분은 본 v1 에서 보조적
   * (정확한 created 판정이 필요한 slice 3/5 는 e2e 에서 row 증가로 검증). 본 service 는
   * read-back 수렴(어느 분기든 영속본 반환)을 1 차 보장으로 둔다.
   */
  private async persistAndReadThrough(
    context: EvaluationPersistContext,
    results: Parameters<EvaluationResultPersistService["persist"]>[1],
  ): Promise<PeriodBridgeAdminPersistResult> {
    try {
      // "fill" — 좌표 부재 시 create+persist, 존재 시 no-op(write 0). reeval 미호출.
      const persisted = await this.persistService.persist(
        context,
        results,
        "fill",
      );
      // 반환 assessmentId 로 영속 Assessment 를 read-back(좌표 부재였든 존재였든 수렴).
      const assessment = await this.readBackById(persisted.assessmentId);
      // contributionCount > 0 이면 이번 호출이 새로 create 했음을 의미(no-op 은 항상 0).
      return { assessment, created: persisted.contributionCount > 0 };
    } catch (error) {
      // P2002(`@@unique` race loser → ConflictException) catch 후 좌표 read 로 fall-through
      // — winner 가 방금 영속화한 저장본을 read 반환한다(409 caller 전파 0). 그 외 error 는
      // 전파(빈 결과 create 의 다른 throw·매핑 검증 throw 등은 삼키지 않는다).
      if (error instanceof ConflictException) {
        const assessment = await this.readBackByCoordinate(context);
        return { assessment, created: false };
      }
      throw error;
    }
  }

  // readBackById — persist 가 반환한 assessmentId 로 영속 Assessment 를 read 한다. 방금
  // persist(또는 no-op 확인)한 직후라 부재는 비정상(레이스로 winner 가 삭제했거나 DB
  // 불일치) — null 이면 명시적 throw 로 조기 노출(silent 위장 0).
  private async readBackById(assessmentId: string): Promise<Assessment> {
    const assessment = await this.assessmentRepository.findById(assessmentId);
    if (assessment === null) {
      throw new Error(
        `영속화 직후 Assessment read-back 실패: assessmentId=${assessmentId}`,
      );
    }
    return assessment;
  }

  // readBackByCoordinate — P2002 race loser 경로의 read-back. winner 의 assessmentId 를
  // 모르므로 좌표 4-tuple 로 findByCoordinate 한다. winner 가 방금 commit 했으므로 부재는
  // 비정상 — null 이면 명시적 throw(레이스 윈도 밖의 부재는 조기 노출).
  private async readBackByCoordinate(
    context: EvaluationPersistContext,
  ): Promise<Assessment> {
    const assessment = await this.assessmentRepository.findByCoordinate({
      personId: context.personId,
      period: context.period,
      scope: context.scope,
      periodStart: context.periodStart,
    });
    if (assessment === null) {
      throw new Error(
        `P2002 read-through fall-through 후 좌표 read-back 실패: ` +
          `personId=${context.personId} period=${context.period} ` +
          `scope=${context.scope}`,
      );
    }
    return assessment;
  }
}
