// EvaluationTickRunnerService — cron tick 과 manual trigger 가 공유하는 단일 실행 함수
// (ADR-0042 §Decision 2, README 64 · 72~74 행, REQ-037/039/040). 활성 인원의 닫힌 기간
// 미평가 좌표를 기존 경로(planner → generateAndPersist)로 순차 평가한다.
import { Injectable, Logger } from "@nestjs/common";

import type { EvaluationPersistContext } from "../assessment-evaluation/domain/evaluation-result.persist.mapper";
import { EvaluationUnevaluatedFillPlanner } from "../assessment-evaluation/evaluation-unevaluated-fill-planner.service";
import { PeriodBridgeAdminPersistService } from "../assessment-evaluation/period-bridge-admin-persist.service";
import { getKstPeriodRangeByPeriod } from "../common/period-boundary";
import { LlmProviderConfigResolver } from "../llm/llm-provider-config-resolver.service";
import { RunStatusService } from "../run-status/run-status.service";
import type { PersonWithIdentities } from "../user/person.repository";
import { PersonService } from "../user/person.service";

// README 61~62 행: 진행 중인 기간은 평가하지 않는다. 일은 최근 7 일, 주 · 월은 직전 1 개.
const CLOSED_WINDOWS = [
  { period: "day", count: 7 },
  { period: "week", count: 1 },
  { period: "month", count: 1 },
];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class EvaluationTickRunnerService {
  private readonly logger = new Logger(EvaluationTickRunnerService.name);
  private current: Promise<void> | null = null;
  private tally = { evaluated: 0, failed: 0 };

  constructor(
    private readonly resolver: LlmProviderConfigResolver,
    private readonly persons: PersonService,
    private readonly planner: EvaluationUnevaluatedFillPlanner,
    private readonly persist: PeriodBridgeAdminPersistService,
    private readonly runStatus: RunStatusService,
  ) {}

  /**
   * tick 1 회 실행. 절대 reject 하지 않는다 — cron callback 의 reject 는 unhandled 가 되고,
   * 전체 실행은 최대 1 시간이라 호출자는 기다리지 않는다. 실행 중 재호출은 무시한다.
   */
  run(): Promise<void> {
    if (this.current !== null) {
      this.logger.warn("이전 평가 실행이 진행 중이라 이번 tick 을 건너뛴다");
      return this.current;
    }
    this.current = this.execute().finally(() => {
      this.current = null;
    });
    return this.current;
  }

  private async execute(): Promise<void> {
    this.runStatus.begin("evaluation");
    try {
      const modelId = await this.resolver.resolveDefaultModelId();
      const persons = await this.persons.findActive();
      if (persons.length === 0) {
        return;
      }
      this.tally = { evaluated: 0, failed: 0 };
      const gaps = await this.planGaps(persons.map((person) => person.id));
      for (const [personId, coordinates] of gaps) {
        await this.fillPerson(personId, coordinates, modelId);
      }
      const { evaluated, failed } = this.tally;
      this.logger.log(
        `평가 실행 완료: evaluated=${evaluated} failed=${failed}`,
      );
    } catch (error) {
      this.logger.error(`평가 실행 중단: ${errorMessage(error)}`);
    } finally {
      this.runStatus.end("evaluation");
    }
  }

  // person 별 미평가 좌표. 한 기간 축의 계획 실패는 그 축만 포기한다.
  private async planGaps(
    personIds: string[],
  ): Promise<Map<string, EvaluationPersistContext[]>> {
    const now = new Date();
    const gaps = new Map<string, EvaluationPersistContext[]>();
    for (const { period, count } of CLOSED_WINDOWS) {
      const rangeEnd = getKstPeriodRangeByPeriod(period, now).start;
      let rangeStart = rangeEnd;
      for (let i = 0; i < count; i += 1) {
        const lastMs = new Date(rangeStart.getTime() - 1);
        rangeStart = getKstPeriodRangeByPeriod(period, lastMs).start;
      }
      try {
        const plan = await this.planner.planUnevaluatedFill({
          personIds,
          period,
          scope: "aggregate",
          rangeStart,
          rangeEnd,
        });
        for (const { personId, periods } of plan.batches) {
          gaps.set(personId, [...(gaps.get(personId) ?? []), ...periods]);
        }
      } catch (error) {
        this.tally.failed += 1;
        this.logger.error(
          `미평가 계획 실패: period=${period} — ${errorMessage(error)}`,
        );
      }
    }
    return gaps;
  }

  private async fillPerson(
    personId: string,
    coordinates: EvaluationPersistContext[],
    modelId: string,
  ): Promise<void> {
    let person: PersonWithIdentities;
    try {
      person = await this.persons.findByIdWithIdentities(personId);
    } catch (error) {
      this.tally.failed += coordinates.length;
      this.logger.error(
        `인원 평가 준비 실패: personId=${personId} — ${errorMessage(error)}`,
      );
      return;
    }

    for (const context of coordinates) {
      const { start, end } = getKstPeriodRangeByPeriod(
        context.period,
        context.periodStart,
      );
      const since = start.toISOString();
      try {
        await this.persist.generateAndPersist(
          person,
          { since, until: end.toISOString() },
          { modelId },
          context,
        );
        this.tally.evaluated += 1;
      } catch (error) {
        this.tally.failed += 1;
        this.logger.error(
          `좌표 평가 실패: personId=${personId} period=${context.period} since=${since} — ${errorMessage(error)}`,
        );
      }
    }
  }
}
