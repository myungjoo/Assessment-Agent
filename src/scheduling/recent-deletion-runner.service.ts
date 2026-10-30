// RecentDeletionRunnerService — 최근 N일 결과 manual delete "실행" runner (T-0427, P7 ⑤
// slice 2, R-74 / REQ-041). 순수-helper 3 slice — slice 1(T-0424,
// buildRecentDeletionWindow) + slice 1b(T-0425, selectInDeletionWindow) + slice 1c
// (T-0426, buildRecentDeletionPlan)가 "무엇을 지우고 무엇을 남길지"({window, toDelete,
// toKeep} plan)를 산출하는 순수 building block 을 박제했다면, 본 service 는 그 plan 을
// **실제로 실행**한다 — buildRecentDeletionPlan 의 toDelete 를 주입형 deleter 로 삭제하고,
// 삭제 후 같은 기간을 CollectionTriggerService.triggerCollection 으로 재수집한다
// (REQ-041 "delete → 재수집").
//
// 책임 경계(Out of Scope, task §Out of Scope):
//   - building block 재구현 0 — buildRecentDeletionPlan(boundary/필터 산술) /
//     triggerCollection(수집 6단계)은 호출만(시그니처 불변). 본 service 는 조립·삭제 위임·
//     재수집 결선·분기만.
//   - 실 repository delete provider 바인딩(Prisma 로 Assessment/Contribution row 삭제) /
//     manual delete REST endpoint / PersonService 연동 / DB persistence·schema 변경 은
//     후속 sub-slice. 본 service 는 personId/instants 를 인자로만 받고 schema 무변경.
//   - 실 live/credentialed 삭제·수집은 Q-0022 deferred — 본 service 는 mock-testable
//     (deleter / triggerCollection mock 주입), 실 token·실 DB 0.
// (T-0419 BackfillRunnerService 패턴을 그대로 mirror — 주입형 인터페이스로 schema/cycle
//  게이트를 회피.)
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  Optional,
} from "@nestjs/common";

import { CollectionTriggerService } from "../assessment-collection/collection-trigger.service";
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
import { buildRecentDeletionPlan } from "./recent-deletion-plan";

// days 기본값 = 1 — recent-deletion-window.ts 의 DEFAULT_DAYS(1, R-74 명시 예 중 최소)와
// 동일 의미를 박제한다. 그 상수는 helper 의 module-private 라 export 되지 않으므로 동일
// 도메인 근거("최근 하루" 호출의 합리적 기본값)로 본 runner 에 명시한다. days 미지정 시
// 이 값으로 helper 에 위임한다(helper 의 assertValidDays 가 검증 — 1 은 항상 유효).
const DEFAULT_DAYS = 1;

// 재수집 호출의 도메인 period — 최근 N일 결과를 다시 수집하므로 일 단위 평가와 정합하는
// "day" 를 박제한다(window 가 KST 일 경계 snap, R-74 "최근 1일/7일/30일"). triggerCollection
// → AssessmentService.create 가 검증하는 enum-as-String 허용 집합은 ["day","week","month"]
// (VALID_PERIODS)이므로 그 중 "day" 를 택한다. 다른 값을 넘기면 triggerCollection 내부에서
// BadRequestException 으로 거부된다.
const RECOLLECT_PERIOD = "day";
// 재수집 scope — 삭제→재수집은 특정 채널 단건이 아니라 해당 기간 활동 전반을 다시 합산하는
// 성격이라 "aggregate" 를 박제한다(VALID_SCOPES = ["commit","document","aggregate"]).
const RECOLLECT_SCOPE = "aggregate";

// RecentDeletionDeleter — "주어진 personId 의 instant 결과들을 삭제" 위임 인터페이스.
// 실 repository delete(Prisma 로 Assessment/Contribution row 삭제)는 schema 게이트 동반
// 별도 sub-slice 이므로, 본 task 는 삭제를 **주입형 인터페이스**로 분리해 분기를 단위
// 테스트 가능하게 한다(T-0419 의 AlreadyBackfilledChecker 동형). 미주입 시 기본은 삭제 0.
export interface RecentDeletionDeleter {
  // 삭제 위임 — 주어진 instant 집합에 해당하는 결과를 삭제하고 삭제한 결과 수를 반환한다.
  deleteInstants(
    personId: string,
    instants: ReadonlyArray<Date>,
  ): Promise<number>;
}

// DI token — 실 repository delete provider 를 후속 sub-slice 가 이 token 으로 override
// 주입한다(진입점).
export const RECENT_DELETION_DELETER = Symbol("RECENT_DELETION_DELETER");

// RecentDeletionRunResult — runRecentDeletion 의 반환 요약 shape. 전문 Assessment 반환
// 대신 요약만(slice 1c·triggerCollection 의 요약 반환 convention 동형). toDelete 가 비면
// recollected=false + deletedCount=0(no-op, error 아님).
export interface RecentDeletionRunResult {
  personId: string;
  // 실제 삭제된 결과 수. deleter 위임 반환값 집계(미주입 기본 deleter 는 항상 0).
  deletedCount: number;
  // 삭제 후 재수집(triggerCollection)을 1회 호출했는지. toDelete 가 비면 false(no-op).
  recollected: boolean;
}

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
    private readonly collectionTriggerService: CollectionTriggerService,
    private readonly resolver: LlmProviderConfigResolver,
    private readonly persons: PersonService,
    private readonly records: EvaluationPersistedRecordsReader,
    private readonly persist: PeriodBridgeAdminPersistService,
    private readonly runStatus: RunStatusService,
    // @Optional() — deleter 미주입(기본) 시 삭제 0(skip — 신규/미배선 환경 안전 기본값).
    // 후속 sub-slice 가 실 repository delete provider 를 RECENT_DELETION_DELETER token 으로
    // 주입하면 그 결과를 따른다.
    @Optional()
    @Inject(RECENT_DELETION_DELETER)
    private readonly deleter?: RecentDeletionDeleter,
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
      const modelId = await this.resolver.resolveDefaultModelId();
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
        if (await this.refreshCoordinate(person, coordinate, modelId)) {
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
    modelId: string,
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
        { modelId },
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

  // runRecentDeletion — personId 의 최근 days 일 결과를 manual delete → 재수집 1회 실행.
  //   1) buildRecentDeletionPlan 으로 {window, toDelete, toKeep} 산출(slice 1c helper 재사용
  //      — boundary/필터 산술 직접 금지). reference 미지정 시 현재 시각, days 미지정 시
  //      DEFAULT_DAYS(1). days/reference/instants 검증 throw(RangeError/TypeError)는 전파.
  //   2) toDelete 가 비면 삭제/재수집 없이 빈 요약 반환(no-op, error 아님).
  //   3) toDelete 가 있으면 deleter.deleteInstants 로 삭제 위임 → 삭제 수 집계.
  //   4) 삭제 후 같은 기간을 재수집 — triggerCollection 1회 호출(periodStart = window.start ISO).
  // error 정책: deleteInstants 또는 triggerCollection 이 throw(Person 404 / 삭제 실패 /
  // collect reject)하면 **잡지 않고 그대로 전파(fail-fast)** — triggerService 의 fail-fast
  // 동형. 삭제 후 재수집 사이 부분 상태(삭제는 성공했으나 재수집 실패 = 해당 기간 결과
  // 부재)의 모호함은 호출자가 실패를 인지하고 재시도/조사하도록 표면화한다. 부분-성공 후
  // 계속(에러 삼킴) 정책은 채택하지 않는다.
  async runRecentDeletion(
    personId: string,
    instants: ReadonlyArray<Date>,
    reference?: Date,
    days?: number,
  ): Promise<RecentDeletionRunResult> {
    // (1) 삭제 plan 산출 — boundary/필터는 전적으로 helper 위임. reference 미지정 시 현재
    // 시각, days 미지정 시 DEFAULT_DAYS(1). days/reference/instants 검증은 helper 가 throw
    // (RangeError/TypeError)하며 본 메서드는 잡지 않고 전파한다.
    const plan = buildRecentDeletionPlan(
      reference ?? new Date(),
      days ?? DEFAULT_DAYS,
      instants,
    );

    // (2) toDelete 빈 케이스 — 삭제/재수집 없이 no-op 요약 반환(error 아님).
    if (plan.toDelete.length === 0) {
      return {
        personId,
        deletedCount: 0,
        recollected: false,
      };
    }

    // (3) 삭제 위임 — deleter 미주입(@Optional 기본 undefined)이면 삭제 0(안전 기본값).
    // deleteInstants reject 시 (4) 재수집 전에 전파(fail-fast).
    const deletedCount = await this.deleteInstants(personId, plan.toDelete);

    // (4) 삭제 후 같은 기간 재수집 — window.start 만 ISO 로 직렬화해 periodStart 로 매핑
    // (boundary 산술 0 — helper 출력의 start 만 직렬화). reject 시 전파(fail-fast).
    await this.collectionTriggerService.triggerCollection({
      personId,
      period: RECOLLECT_PERIOD,
      scope: RECOLLECT_SCOPE,
      periodStart: plan.window.start.toISOString(),
    });

    return {
      personId,
      deletedCount,
      recollected: true,
    };
  }

  // deleteInstants — 주입형 deleter 위임. 미주입(@Optional 기본 undefined)이면 삭제 0
  // (skip — 신규/미배선 환경 안전 기본값. 실 repository delete 배선은 Follow-up). 분리된
  // 메서드라 분기 단위 테스트 가능(deleter 주입 / 미주입 2 경로).
  private async deleteInstants(
    personId: string,
    instants: ReadonlyArray<Date>,
  ): Promise<number> {
    if (!this.deleter) {
      return 0;
    }
    return this.deleter.deleteInstants(personId, instants);
  }
}
