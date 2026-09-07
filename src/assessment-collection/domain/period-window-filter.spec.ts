// period-window-filter spec — T-1939. 반열림 `[since, until)` Activity 창 필터의
// R-112 4 종(happy / branch / error / negative, CLAUDE.md §3.2) 검증. 순수 함수라
// mock / DI / DB 0 — 입력 Activity[] 와 창 좌표만으로 판정한다. 경계 의미론의 근거
// 좌표(ADR-0050 · period-evaluable.ts 40~59 행 computePeriodEnd)는 구현 파일 head
// 주석에 있고, 본 spec 은 그 의미론이 코드로 지켜지는지만 박제한다.
import type { Activity } from "./activity";
import {
  filterActivitiesByPeriodWindow,
  type ActivityPeriodWindow,
} from "./period-window-filter";

// GithubActivity fixture — 본 필터는 timestamp 만 읽으므로 나머지 필드는 고정.
function activityAt(timestamp: string, externalId = timestamp): Activity {
  return {
    sourceType: "github",
    externalId,
    instanceKey: "com",
    author: "octocat",
    timestamp,
    metadata: {},
    repoRef: "octo-org/octo-repo",
    kind: "commit",
  } as Activity;
}

// 판정 결과를 externalId 로 축약해 비교 — 순서 보존 확인에 그대로 쓴다.
function ids(activities: Activity[]): string[] {
  return activities.map((activity) => activity.externalId);
}

const JUNE = "2026-06-01T00:00:00Z";
const JULY = "2026-07-01T00:00:00Z";

describe("filterActivitiesByPeriodWindow", () => {
  describe("happy-path — 창 안 활동만 순서 보존해 남는다", () => {
    it("창 앞/안/뒤가 섞인 Activity[] 에서 [since, until) 안의 활동만 입력 순서대로 남는다", () => {
      const activities = [
        activityAt("2026-05-31T23:59:59Z", "before"),
        activityAt("2026-06-15T12:00:00Z", "in-1"),
        activityAt("2026-07-01T00:00:01Z", "after"),
        activityAt("2026-06-02T00:00:00Z", "in-2"),
      ];

      const result = filterActivitiesByPeriodWindow(activities, {
        since: JUNE,
        until: JULY,
      });

      // 창 밖 2 건 제외 + 입력에 등장한 순서(in-1 → in-2) 그대로 보존.
      expect(ids(result)).toEqual(["in-1", "in-2"]);
    });
  });

  describe("branch — bound 지정 조합 4 분기", () => {
    const activities = [
      activityAt("2026-05-01T00:00:00Z", "may"),
      activityAt("2026-06-15T00:00:00Z", "june"),
      activityAt("2026-08-01T00:00:00Z", "august"),
    ];

    it("since 만 지정하면 하한만 적용된다(상한 없음)", () => {
      const result = filterActivitiesByPeriodWindow(activities, {
        since: JUNE,
      });

      expect(ids(result)).toEqual(["june", "august"]);
    });

    it("until 만 지정하면 상한만 적용된다(하한 없음)", () => {
      const result = filterActivitiesByPeriodWindow(activities, {
        until: JULY,
      });

      expect(ids(result)).toEqual(["may", "june"]);
    });

    it("since + until 둘 다 지정하면 양쪽 경계가 모두 적용된다", () => {
      const result = filterActivitiesByPeriodWindow(activities, {
        since: JUNE,
        until: JULY,
      });

      expect(ids(result)).toEqual(["june"]);
    });

    it("둘 다 미지정이면 무필터 — 전량이 순서 보존돼 남는다", () => {
      const result = filterActivitiesByPeriodWindow(activities, {});

      expect(ids(result)).toEqual(["may", "june", "august"]);
    });
  });

  describe("경계값 — 반열림 [since, until)", () => {
    it("timestamp === since 는 포함(inclusive), timestamp === until 은 제외(exclusive)", () => {
      const activities = [
        activityAt(JUNE, "at-since"),
        activityAt(JULY, "at-until"),
      ];

      const result = filterActivitiesByPeriodWindow(activities, {
        since: JUNE,
        until: JULY,
      });

      expect(ids(result)).toEqual(["at-since"]);
    });

    it("동일 시각을 다른 offset 표기로 준 경계도 시점 동등으로 판정된다(문자열 비교 아님)", () => {
      // 2026-06-01T09:00:00+09:00 === 2026-06-01T00:00:00Z (KST 자정 경계).
      const activities = [activityAt("2026-06-01T00:00:00Z", "kst-midnight")];

      const result = filterActivitiesByPeriodWindow(activities, {
        since: "2026-06-01T09:00:00+09:00",
      });

      expect(ids(result)).toEqual(["kst-midnight"]);
    });
  });

  describe("error path — 파싱 불가 bound 는 RangeError(fail-fast)", () => {
    it("파싱 불가 since 는 RangeError 를 throw 한다", () => {
      expect(() =>
        filterActivitiesByPeriodWindow([activityAt(JUNE)], {
          since: "not-a-date",
        }),
      ).toThrow(RangeError);
    });

    it("파싱 불가 until 은 RangeError 를 throw 한다", () => {
      expect(() =>
        filterActivitiesByPeriodWindow([activityAt(JUNE)], {
          until: "2026-13-45",
        }),
      ).toThrow(RangeError);
    });

    it("RangeError 메시지에 어느 bound 가 잘못됐는지와 그 값이 담긴다", () => {
      expect(() =>
        filterActivitiesByPeriodWindow([], { until: "oops" }),
      ).toThrow(/until.*oops/);
    });

    it("bound 검증은 활동 순회 전 — 빈 입력이어도 파싱 불가 bound 면 throw 한다", () => {
      expect(() =>
        filterActivitiesByPeriodWindow([], { since: "nope" }),
      ).toThrow(RangeError);
    });
  });

  describe("negative — 예외 분기별 방어", () => {
    it("빈 입력 배열은 창 지정 여부와 무관하게 빈 배열을 반환한다", () => {
      expect(
        filterActivitiesByPeriodWindow([], { since: JUNE, until: JULY }),
      ).toEqual([]);
      expect(filterActivitiesByPeriodWindow([], {})).toEqual([]);
    });

    it("파싱 불가 timestamp 활동은 폐기하지 않고 보존한다(누락 < 과다 포함)", () => {
      const activities = [
        activityAt("garbage-timestamp", "unparsable"),
        activityAt("2026-01-01T00:00:00Z", "out-of-window"),
      ];

      const result = filterActivitiesByPeriodWindow(activities, {
        since: JUNE,
        until: JULY,
      });

      expect(ids(result)).toEqual(["unparsable"]);
    });

    it("since > until(빈 창)은 throw 하지 않고 빈 배열을 반환한다", () => {
      const activities = [activityAt("2026-06-15T00:00:00Z", "june")];

      const result = filterActivitiesByPeriodWindow(activities, {
        since: JULY,
        until: JUNE,
      });

      expect(result).toEqual([]);
    });

    it("입력 배열을 변형하지 않는다(length·원소 참조 동일, 반환은 새 배열)", () => {
      const kept = activityAt("2026-06-15T00:00:00Z", "june");
      const dropped = activityAt("2026-01-01T00:00:00Z", "january");
      const activities = [kept, dropped];

      const result = filterActivitiesByPeriodWindow(activities, {
        since: JUNE,
        until: JULY,
      });

      expect(activities).toHaveLength(2);
      expect(activities[0]).toBe(kept);
      expect(activities[1]).toBe(dropped);
      expect(result).not.toBe(activities);
      // 보존된 원소는 복제가 아니라 원본 참조 그대로(불필요한 복사 0).
      expect(result[0]).toBe(kept);
    });

    it("무필터 분기도 입력과 다른 새 배열을 반환한다(원본 공유 0)", () => {
      const activities = [activityAt(JUNE, "june")];

      const result = filterActivitiesByPeriodWindow(activities, {});

      expect(result).not.toBe(activities);
      expect(result).toEqual(activities);
    });

    it("동일 입력 2 회 호출은 동일 결과를 낸다(결정성, 부수효과 0)", () => {
      const activities = [
        activityAt("2026-06-15T00:00:00Z", "june"),
        activityAt("2026-08-01T00:00:00Z", "august"),
      ];
      const window: ActivityPeriodWindow = { since: JUNE, until: JULY };

      const first = filterActivitiesByPeriodWindow(activities, window);
      const second = filterActivitiesByPeriodWindow(activities, window);

      expect(ids(first)).toEqual(["june"]);
      expect(ids(second)).toEqual(ids(first));
    });
  });
});
