// EvaluationTickRunnerService — cron tick 과 manual trigger 가 공유하는 단일 실행 함수
// (ADR-0042 §Decision 2, README 64 · 72~74 행). 활성 인원의 닫힌 기간 미평가 좌표를
// 기존 경로(planner → generateAndPersistIfCollected)로 순차 평가한다.
import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";

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

const emptyTally = () => ({
  evaluated: 0,
  skipped: 0,
  failed: 0,
  incomplete: [] as IncompleteRecord[],
});
type IncompleteRecord = Parameters<
  RunStatusService["recordEvaluationRun"]
>[0]["incomplete"][number];

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// cron · manual 공용 tick handler. POST 는 즉시 202 여야 하므로 실행을 기다리지 않는다.
export function createCronTickHandler(
  runner: Pick<EvaluationTickRunnerService, "run">,
): () => void {
  return () => {
    void runner.run();
  };
}

@Injectable()
export class EvaluationTickRunnerService implements OnModuleDestroy {
  private readonly logger = new Logger(EvaluationTickRunnerService.name);
  private current: Promise<void> | null = null;
  private stopping = false;
  private tally = emptyTally();

  constructor(
    private readonly resolver: LlmProviderConfigResolver,
    private readonly persons: PersonService,
    private readonly planner: EvaluationUnevaluatedFillPlanner,
    private readonly persist: PeriodBridgeAdminPersistService,
    private readonly runStatus: RunStatusService,
  ) {}

  /**
   * tick 1 회 실행. 절대 reject 하지 않는다 — cron callback 의 reject 는 unhandled 가 된다.
   * 인원 수에 비례해 오래 걸리므로 호출자는 기다리지 않는다. 실행 중 재호출은 무시한다.
   */
  run(): Promise<void> {
    if (this.stopping) {
      return Promise.resolve();
    }
    if (this.current !== null) {
      this.logger.warn("이전 평가 실행이 진행 중이라 이번 tick 을 건너뛴다");
      return this.current;
    }
    this.current = this.execute().finally(() => {
      this.current = null;
    });
    return this.current;
  }

  // app 종료 시 새 좌표 진입을 막고 진행 중 좌표까지만 기다린다.
  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    await this.current;
  }

  private async execute(): Promise<void> {
    this.runStatus.begin("evaluation");
    this.tally = emptyTally();
    try {
      const modelId = await this.resolver.resolveDefaultModelId();
      const persons = await this.persons.findActive();
      if (persons.length === 0) {
        this.logger.log("평가 실행 완료: 활성 인원 없음");
        return;
      }
      const gaps = await this.planGaps(persons.map((person) => person.id));
      for (const [personId, coordinates] of gaps) {
        if (this.stopping) {
          this.logger.warn("app 종료로 평가 실행을 중단한다");
          return;
        }
        await this.fillPerson(personId, coordinates, modelId);
      }
      this.logger.log(
        `평가 실행 완료: evaluated=${this.tally.evaluated} skipped=${this.tally.skipped} failed=${this.tally.failed}`,
      );
    } catch (error) {
      this.tally.failed += 1;
      this.logger.error(`평가 실행 중단: ${errorMessage(error)}`);
    } finally {
      this.runStatus.end("evaluation");
      this.runStatus.recordEvaluationRun({
        source: "tick",
        evaluatedCount: this.tally.evaluated,
        skippedCount: this.tally.skipped,
        failedCount: this.tally.failed,
        incomplete: this.tally.incomplete,
      });
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

    // 빈 평가 row 는 first-write-wins 때문에 식별자가 추가된 뒤의 평가를 영구히 막는다.
    if (person.serviceIdentities.length === 0) {
      this.tally.skipped += coordinates.length;
      return;
    }

    for (const context of coordinates) {
      if (this.stopping) {
        return;
      }
      try {
        const { start, end } = getKstPeriodRangeByPeriod(
          context.period,
          context.periodStart,
        );
        const persisted = await this.persist.generateAndPersistIfCollected(
          person,
          { since: start.toISOString(), until: end.toISOString() },
          { modelId },
          context,
        );
        this.tally[persisted === null ? "skipped" : "evaluated"] += 1;
        if (persisted === null) {
          this.tally.incomplete.push({
            personId,
            period: context.period,
            scope: context.scope,
            periodStart: new Date(context.periodStart).toISOString(),
          });
        }
      } catch (error) {
        this.tally.failed += 1;
        this.logger.error(
          `좌표 평가 실패: personId=${personId} period=${context.period} periodStart=${String(context.periodStart)} — ${errorMessage(error)}`,
        );
      }
    }
  }
}
