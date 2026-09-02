// RunStatusService — 평가 · 수집 두 축의 "지금 실행 중인가" 를 프로세스 메모리에만
// 보유하는 in-memory 실행 카운터 provider (ADR-0060 §Decision 1 채택안 (a)).
//
// 보유 실체는 축마다 "아직 끝나지 않은 begin 의 시작 시각 목록" 하나뿐이며 DB · 파일 ·
// 외부 store 를 일절 쓰지 않는다. 상태의 수명이 실행의 수명과 정확히 같으므로 프로세스
// 재시작이 곧 복구 수단이다 (ADR-0060 §Decision 4 "프로세스 재시작 시 복구").
import { Injectable, Logger } from "@nestjs/common";

/** 실행 상태를 추적하는 축. ADR-0060 §Decision 2 응답 표의 두 축과 1:1 대응. */
export type RunAxis = "evaluation" | "collection";

/** 런타임 검사와 순회에 쓰는 축 목록 (후속 slice 의 controller 도 재사용). */
export const RUN_AXES: readonly RunAxis[] = ["evaluation", "collection"];

/** 값이 유효한 `RunAxis` 인지 판정하는 런타임 type guard. */
export function isRunAxis(value: unknown): value is RunAxis {
  return (
    typeof value === "string" && (RUN_AXES as readonly string[]).includes(value)
  );
}

/** 한 축의 실행 상태. ADR-0060 §Decision 2 표의 `evaluation.*` · `collection.*` 그대로. */
export interface RunAxisStatus {
  /** 해당 축이 실행 중인지 여부. 불변식: `active === (runningCount > 0)`. */
  active: boolean;
  /** 해당 축의 동시 실행 건수 (정수 ≥ 0). */
  runningCount: number;
  /** 실행 중인 것들 중 가장 이른 시작 시각 (ISO-8601 UTC). 비실행 시 `null`. */
  startedAt: string | null;
}

/** `GET /api/run-status` 응답 body shape (ADR-0060 §Decision 2). */
export interface RunStatusSnapshot {
  /** 두 축 중 하나라도 실행 중이면 `true` — 배너 토글의 단일 축. */
  active: boolean;
  evaluation: RunAxisStatus;
  collection: RunAxisStatus;
  /** 서버가 이 snapshot 을 만든 시각 (ISO-8601 UTC). 클라이언트 stale 판정 근거. */
  observedAt: string;
}

@Injectable()
export class RunStatusService {
  private readonly logger = new Logger(RunStatusService.name);

  /**
   * 축별로 "아직 `end` 되지 않은 `begin` 의 시작 시각(epoch ms)" 을 오름차순으로 보유한다.
   * `begin` 이 항상 현재 시각을 push 하므로 배열은 자연히 오름차순을 유지한다.
   *
   * `end(axis)` 는 어느 실행이 끝났는지 식별자를 받지 않으므로 **가장 늦게 시작한 것**
   * (배열 끝) 을 짝지어 제거한다 — `begin` 직후 `try/finally { end }` 로 감싸는
   * ADR-0060 §Decision 4 의 호출 규약에서 중첩 실행은 LIFO 로 풀리기 때문이다. 그래서
   * 나중에 시작한 실행이 먼저 끝나도 `startedAt` 은 아직 실행 중인 것들의 실제 최솟값을
   * 그대로 가리킨다.
   */
  private readonly startedAtMs: Record<RunAxis, number[]> = {
    evaluation: [],
    collection: [],
  };

  /**
   * 실행 시작을 기록한다 — 해당 축의 `runningCount` 를 1 증가시키고 시작 시각을 남긴다.
   * 알 수 없는 axis 는 경고만 남기고 무시한다 (관측 보조 자산이 실제 실행 경로를
   * 깨뜨리지 않게 하기 위한 선택 — 호출자는 `finally` 안에서 `end` 를 부른다).
   */
  begin(axis: RunAxis): void {
    if (!isRunAxis(axis)) {
      this.logger.warn(
        `알 수 없는 axis 로 begin 호출 — 무시한다: ${String(axis)}`,
      );
      return;
    }
    this.startedAtMs[axis].push(Date.now());
  }

  /**
   * 실행 종료를 기록한다 — 해당 축의 `runningCount` 를 1 감소시킨다.
   * `begin` 없이 호출돼도 카운터는 음수가 되지 않고 0 으로 유지된다.
   */
  end(axis: RunAxis): void {
    if (!isRunAxis(axis)) {
      this.logger.warn(
        `알 수 없는 axis 로 end 호출 — 무시한다: ${String(axis)}`,
      );
      return;
    }
    const running = this.startedAtMs[axis];
    if (running.length === 0) {
      this.logger.warn(
        `짝 없는 end 호출 — ${axis} 축 카운터를 0 으로 유지한다`,
      );
      return;
    }
    running.pop();
  }

  /** 현재 실행 상태의 snapshot 을 만든다. 호출 시점마다 `observedAt` 이 갱신된다. */
  snapshot(): RunStatusSnapshot {
    const evaluation = this.axisStatus("evaluation");
    const collection = this.axisStatus("collection");
    return {
      active: evaluation.active || collection.active,
      evaluation,
      collection,
      observedAt: new Date().toISOString(),
    };
  }

  /** 한 축의 파생 필드 3 종을 계산한다 (불변식 `active === runningCount > 0` 유지). */
  private axisStatus(axis: RunAxis): RunAxisStatus {
    const running = this.startedAtMs[axis];
    const runningCount = running.length;
    return {
      active: runningCount > 0,
      runningCount,
      startedAt: runningCount > 0 ? new Date(running[0]).toISOString() : null,
    };
  }
}
