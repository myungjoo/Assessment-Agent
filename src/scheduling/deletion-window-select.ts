// deletion-window-select — 삭제 window [start, end) 내 평가 결과 instant 선별 순수 helper
// (T-0425, P7 ⑤ slice 1b, R-74 / REQ-041). slice 1(T-0424, buildRecentDeletionWindow)
// 이 "어느 기간을 지울지"([start, end) PeriodRange)를 산출했다면, 본 slice 는 그 window
// 를 인자로 받아 "주어진 결과 instant 들 중 무엇이 그 기간에 드는가"를 순수 선별한다.
// 실 삭제 runner(slice 2)가 본 출력을 소비한다 — 본 helper 는 DB·trigger·repository
// 호출 0 이며 자체 timezone/offset 산술도 두지 않는다 (경계 의미는 호출자가 넘긴
// window 가 이미 KST 일 경계에 snap 돼 있으므로 instant 끼리 getTime() 비교만 한다).
//
// buildRecentDeletionWindow 를 직접 호출하지 않고 PeriodRange 만 인자로 받는다 — 두
// helper 의 조립은 후속 runner 책임 (backfill-plan → backfill runner 분리와 동형).
import { PeriodRange } from "../common/period-boundary";

// 선별 결과 — 입력 instants 를 window 반열림 규칙 [start, end) 으로 분류한 두 배열.
// 두 배열 모두 입력 순서를 보존하며, 둘의 합집합은 입력 instants 와 동일(중복/누락 0).
export interface DeletionWindowSelection {
  // window.start <= instant < window.end 를 만족하는 instant (start 포함, end 배타).
  inWindow: Date[];
  // 그 외 (instant < window.start 또는 instant >= window.end).
  outOfWindow: Date[];
}

// Invalid Date / 비-Date 입력은 명시적 error (period-boundary.ts 의 assertValidDate 와
// 동형 메시지 convention — 해당 helper 가 export 되지 않아 본 파일에 mirror 한다).
function assertValidDate(value: unknown, label: string): asserts value is Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(
      `selectInDeletionWindow: ${label} 은(는) 유효한 Date instance 여야 합니다`,
    );
  }
}

// window 검증 — start/end 가 유효 Date 인지(TypeError) + 반열림 구간이 비어있지 않은지
// (start < end, RangeError) 확인. start >= end(역전/빈 구간)는 선별 대상이 없으므로
// 호출자 오류로 보고 거부한다.
function assertValidWindow(window: PeriodRange): void {
  assertValidDate(window?.start, "window.start");
  assertValidDate(window?.end, "window.end");
  if (window.start.getTime() >= window.end.getTime()) {
    throw new RangeError(
      `selectInDeletionWindow: window 는 start < end 인 반열림 구간이어야 합니다 ` +
        `(start=${window.start.toISOString()}, end=${window.end.toISOString()})`,
    );
  }
}

// selectInDeletionWindow — 주어진 instants 를 window 반열림 규칙 [start, end) 으로
// in-window / out-of-window 두 그룹으로 분류한다. instant === window.start 는 in-window,
// instant === window.end 는 out-of-window (end 배타). 입력 배열을 변형하지 않고 새 배열을
// 반환하며, 각 결과 배열의 순서는 입력 순서를 보존한다. 빈 배열 입력은 빈 분류(error 아님).
//
// window.start/window.end 가 비-Date / Invalid Date 면 TypeError, start >= end 면
// RangeError. instants 가 배열이 아니면 TypeError, 원소 중 비-Date / Invalid Date 가
// 있으면 그 index 를 메시지에 담아 TypeError 를 throw 한다.
export function selectInDeletionWindow(
  window: PeriodRange,
  instants: ReadonlyArray<Date>,
): DeletionWindowSelection {
  assertValidWindow(window);

  if (!Array.isArray(instants)) {
    throw new TypeError(
      `selectInDeletionWindow: instants 는 Date 배열이어야 합니다 (받음: ${typeof instants})`,
    );
  }

  const startMs = window.start.getTime();
  const endMs = window.end.getTime();

  const inWindow: Date[] = [];
  const outOfWindow: Date[] = [];

  for (let index = 0; index < instants.length; index += 1) {
    const instant = instants[index];
    assertValidDate(instant, `instants[${index}]`);
    const t = instant.getTime();
    // 반열림 [start, end) — start 포함, end 배타. getTime() 비교만(offset 산술 0).
    if (t >= startMs && t < endMs) {
      inWindow.push(instant);
    } else {
      outOfWindow.push(instant);
    }
  }

  return { inWindow, outOfWindow };
}
