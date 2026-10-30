// RecentDeletionRunnerService — 최근 N일 결과를 다시 수집 · 평가해 좌표별로 교체하는 실행 (R-74 /
// REQ-041). 저장본을 먼저 지우지 않는다. 설계 결정은 docs/tasks/T-2069-recent-refresh-coordinates.md.
import {
  ConflictException,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common";

import { EvaluationPersistedRecordsReader } from "../assessment-evaluation/evaluation-persisted-records-reader.service";
import { PeriodBridgeAdminPersistService } from "../assessment-evaluation/period-bridge-admin-persist.service";
import { getKstPeriodRangeByPeriod } from "../common/period-boundary";
import { LlmProviderConfigResolver } from "../llm/llm-provider-config-resolver.service";
import { RunStatusService } from "../run-status/run-status.service";
import type { PersonWithIdentities } from "../user/person.repository";
import { PersonService } from "../user/person.service";

import {
  buildClosedDaysWindow,
  planRecentRefresh,
  type RefreshCoordinate,
} from "./recent-deletion-coordinates";

// 일수 미지정 시 가장 작은 창. recent-deletion-window.ts 의 기본값과 같은 의미다.
const DEFAULT_DAYS = 1;

/** 끝난 재수집 실행의 실제 결과. */
export interface RecentRefreshResult {
  /** 새 평가로 교체되어 사라진 이전 row 수. */
  deletedCount: number;
  /** 새 평가를 저장한 좌표 수 (이전 row 가 없던 좌표 포함). */
  refreshedCount: number;
  /** 이전 row 를 그대로 두었거나 저장하지 못한 좌표 수. */
  notRefreshedCount: number;
  /** 모델 조회 실패 · 앱 종료 등으로 끝까지 돌지 못했는지. 끝난 좌표의 교체는 유지된다. */
  aborted: boolean;
  finishedAt: string;
}

/** 인원 한 명의 재수집 상태. 프로세스 메모리에만 있어 재시작 시 사라진다. */
export interface RecentRefreshStatus {
  personId: string;
  running: boolean;
  result: RecentRefreshResult | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class RecentDeletionRunnerService implements OnModuleDestroy {
  private readonly logger = new Logger(RecentDeletionRunnerService.name);
  private current: { personId: string; done: Promise<void> } | null = null;
  private stopping = false;
  private readonly results = new Map<string, RecentRefreshResult>();

  constructor(
    private readonly resolver: LlmProviderConfigResolver,
    private readonly persons: PersonService,
    private readonly records: EvaluationPersistedRecordsReader,
    private readonly persist: PeriodBridgeAdminPersistService,
    private readonly runStatus: RunStatusService,
  ) {}

  /**
   * 어제까지의 닫힌 `days` 일을 좌표별로 다시 수집 · 평가해 교체하는 실행을 시작하고 바로 돌아온다.
   * 저장본을 먼저 지우지 않으므로 수집 실패 좌표의 이전 row 는 남는다. 결과는 `refreshStatus` 로 본다.
   *
   * @throws RangeError days 범위 위반.
   * @throws NotFoundException 인원 부재.
   * @throws ConflictException 다른 평가 실행이 진행 중 (tick · 다른 인원 재수집 포함) 이거나 앱 종료 중.
   */
  async startRefresh(
    personId: string,
    days: number = DEFAULT_DAYS,
  ): Promise<RecentRefreshStatus> {
    buildClosedDaysWindow(new Date(), days);
    const person = await this.persons.findByIdWithIdentities(personId);
    if (
      this.stopping ||
      this.current !== null ||
      this.runStatus.snapshot().evaluation.active
    ) {
      throw new ConflictException(
        "다른 평가 실행이 진행 중이거나 서버가 종료 중입니다. 잠시 뒤 다시 시도해 주세요.",
      );
    }

    this.results.delete(personId);
    this.runStatus.begin("evaluation");
    const done = this.executeRefresh(person, days).finally(() => {
      this.current = null;
    });
    this.current = { personId, done };
    return { personId, running: true, result: null };
  }

  refreshStatus(personId: string): RecentRefreshStatus {
    return {
      personId,
      running: this.current?.personId === personId,
      result: this.results.get(personId) ?? null,
    };
  }

  // app 종료 시 새 좌표 진입을 막고 진행 중 좌표까지만 기다린다.
  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    await this.current?.done;
  }

  // 절대 reject 하지 않는다 — 호출자가 기다리지 않는 실행이다.
  private async executeRefresh(
    person: PersonWithIdentities,
    days: number,
  ): Promise<void> {
    const tally = { deleted: 0, refreshed: 0, notRefreshed: 0 };
    let aborted = false;
    try {
      const configId = await this.resolver.resolveDefaultConfigId();
      const now = new Date();
      const stored = await this.records.readForPersons([person.id]);
      const { coordinates, openRowCount } = planRecentRefresh(
        person.id,
        stored,
        buildClosedDaysWindow(now, days),
        now,
      );
      tally.notRefreshed += openRowCount;
      // 빈 평가로 저장본을 덮지 않는다 — 식별자가 없으면 수집할 활동이 없다.
      if (person.serviceIdentities.length === 0) {
        tally.notRefreshed += coordinates.length;
        return;
      }
      for (const [index, coordinate] of coordinates.entries()) {
        if (this.stopping) {
          tally.notRefreshed += coordinates.length - index;
          aborted = true;
          return;
        }
        if (await this.refreshCoordinate(person, coordinate, configId)) {
          tally.refreshed += 1;
          tally.deleted += coordinate.hadRow ? 1 : 0;
        } else {
          tally.notRefreshed += 1;
        }
      }
    } catch (error) {
      aborted = true;
      this.logger.error(
        `재수집 중단: personId=${person.id} — ${errorMessage(error)}`,
      );
    } finally {
      this.runStatus.end("evaluation");
      this.results.set(person.id, {
        deletedCount: tally.deleted,
        refreshedCount: tally.refreshed,
        notRefreshedCount: tally.notRefreshed,
        aborted,
        finishedAt: new Date().toISOString(),
      });
    }
  }

  // 좌표 하나의 실패는 그 좌표만 포기한다. 교체는 저장 트랜잭션 안에서만 일어난다.
  private async refreshCoordinate(
    person: PersonWithIdentities,
    { personId, period, scope, periodStart }: RefreshCoordinate,
    configId: string,
  ): Promise<boolean> {
    const context = { personId, period, scope, periodStart };
    try {
      const { start, end } = getKstPeriodRangeByPeriod(
        context.period,
        context.periodStart,
      );
      const persisted = await this.persist.generateAndPersistIfCollected(
        person,
        { since: start.toISOString(), until: end.toISOString() },
        // gateway 는 difficulty 가 없으면 modelId 자리의 값을 config id 로 조회한다.
        { modelId: configId },
        context,
        true,
      );
      return persisted !== null;
    } catch (error) {
      this.logger.error(
        `좌표 재수집 실패: personId=${person.id} period=${context.period} periodStart=${context.periodStart.toISOString()} — ${errorMessage(error)}`,
      );
      return false;
    }
  }
}
