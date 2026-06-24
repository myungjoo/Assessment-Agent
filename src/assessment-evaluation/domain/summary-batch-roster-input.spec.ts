// summary-batch-roster-input.spec — R-61 요약 batch roster→orchestrator-input 순수
// composer 검증. 순수 함수라 시스템 시계 미사용 — `now` 는 고정 Date instance 주입으로
// 결정성 확보. happy / error / branch / negative 케이스를 박제한다(R-112). coordinates
// 산출 oracle 은 enumerate 본체를 재구현하지 않고 `enumerateSummaryDueCoordinates` 를
// 직접 호출해 비교한다(boundary 산술 전사 오류 차단 — composer 가 위임 호출하는 것과
// 동일 함수). resultsByCoordinate/mode/options/now 는 형태만 충족하는 최소 stub 사용.

import type { PersistMode } from "../evaluation-result-persist.service";
import type { SummaryBatchOrchestratorInput } from "../summary-batch-orchestrator.service";
import type { SummaryPersistOptions } from "../summary-persist.service";

import type { EvaluationResult } from "./evaluation-result";
import type { PeriodGranularity } from "./period-evaluable";
import {
  buildSummaryBatchOrchestratorInput,
  type SummaryBatchRosterInput,
} from "./summary-batch-roster-input";
import { enumerateSummaryDueCoordinates } from "./summary-due-coordinates";

// 최소 EvaluationResult stub — 형태만 충족(실 LLM/DB 0). unitId 로 reference 추적.
function stubResult(unitId: string): EvaluationResult {
  return {
    unitId,
    narrative: `narrative-${unitId}`,
    difficulty: "medium",
    contribution: "medium",
    volume: 1,
  };
}

const MODE: PersistMode = "reeval";
const OPTIONS: SummaryPersistOptions = { modelId: "test-model" };

// 결정성 확보용 고정 기준 시각. day/week/month 직전 period 좌표는 enumerate 가 산출.
const NOW = new Date("2026-06-14T15:00:00Z");

describe("buildSummaryBatchOrchestratorInput — happy path (roster × granularity 조립)", () => {
  it("roster 2명 × granularity 2종 → coordinates 가 enumerate 산출과 동일(순서 보존) + 4 필드 그대로 부착", () => {
    const personIds = ["alice", "bob"];
    const granularities: PeriodGranularity[] = ["day", "week"];
    const map = new Map<string, EvaluationResult[]>([
      ["k1", [stubResult("a1")]],
    ]);
    const input: SummaryBatchRosterInput = {
      personIds,
      granularities,
      resultsByCoordinate: map,
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    };

    const result = buildSummaryBatchOrchestratorInput(input);

    // coordinates 는 enumerate 산출과 깊은 값 동일(등장 순서 보존).
    const expectedCoords = enumerateSummaryDueCoordinates(
      personIds,
      granularities,
      NOW,
    );
    expect(result.coordinates).toEqual(expectedCoords);
    // 2명 × 2종 = 4 좌표.
    expect(result.coordinates).toHaveLength(4);
    // 등장 순서: roster 외부 루프 × granularity 내부 루프.
    expect(result.coordinates.map((c) => [c.personId, c.period])).toEqual([
      ["alice", "day"],
      ["alice", "week"],
      ["bob", "day"],
      ["bob", "week"],
    ]);
    // 나머지 4 필드는 변형 0 으로 동일 reference 부착.
    expect(result.resultsByCoordinate).toBe(map);
    expect(result.mode).toBe(MODE);
    expect(result.options).toBe(OPTIONS);
    expect(result.now).toBe(NOW);
  });

  it("산출은 SummaryBatchOrchestratorInput 5 필드 surface 를 정확히 갖춘다(coordinates 추가, source 필드 미노출)", () => {
    const input: SummaryBatchRosterInput = {
      personIds: ["carol"],
      granularities: ["month"],
      resultsByCoordinate: new Map(),
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    };
    const result: SummaryBatchOrchestratorInput =
      buildSummaryBatchOrchestratorInput(input);
    // 산출 객체 key 는 정확히 5 필드(source 의 personIds/granularities 미노출).
    expect(Object.keys(result).sort()).toEqual(
      ["coordinates", "mode", "now", "options", "resultsByCoordinate"].sort(),
    );
  });
});

describe("buildSummaryBatchOrchestratorInput — error path (fail-fast)", () => {
  it("input 이 null 이면 한국어 TypeError", () => {
    expect(() =>
      buildSummaryBatchOrchestratorInput(
        null as unknown as SummaryBatchRosterInput,
      ),
    ).toThrow("input 이 null/undefined 일 수 없다.");
  });

  it("input 이 undefined 이면 한국어 TypeError", () => {
    expect(() =>
      buildSummaryBatchOrchestratorInput(
        undefined as unknown as SummaryBatchRosterInput,
      ),
    ).toThrow(TypeError);
  });

  it("personIds 가 null 이면 enumerate 위임 TypeError 전파", () => {
    const input = {
      personIds: null as unknown as string[],
      granularities: ["day"] as PeriodGranularity[],
      resultsByCoordinate: new Map<string, EvaluationResult[]>(),
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    };
    expect(() => buildSummaryBatchOrchestratorInput(input)).toThrow(
      "personIds 배열이 null/undefined 일 수 없다.",
    );
  });

  it("granularities 가 undefined 이면 enumerate 위임 TypeError 전파", () => {
    const input = {
      personIds: ["alice"],
      granularities: undefined as unknown as PeriodGranularity[],
      resultsByCoordinate: new Map<string, EvaluationResult[]>(),
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    };
    expect(() => buildSummaryBatchOrchestratorInput(input)).toThrow(
      "granularities 배열이 null/undefined 일 수 없다.",
    );
  });

  it("now 가 Invalid Date 이면 helper TypeError 전파(NaN 비결정성 차단)", () => {
    const input: SummaryBatchRosterInput = {
      personIds: ["alice"],
      granularities: ["day"],
      resultsByCoordinate: new Map(),
      mode: MODE,
      options: OPTIONS,
      now: new Date("not-a-date"),
    };
    expect(() => buildSummaryBatchOrchestratorInput(input)).toThrow(TypeError);
  });

  it("알 수 없는 granularity 이면 helper RangeError 전파", () => {
    const input = {
      personIds: ["alice"],
      granularities: ["fortnight"] as unknown as PeriodGranularity[],
      resultsByCoordinate: new Map<string, EvaluationResult[]>(),
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    };
    expect(() => buildSummaryBatchOrchestratorInput(input)).toThrow(RangeError);
  });
});

describe("buildSummaryBatchOrchestratorInput — flow / branch 분기 cover", () => {
  it("(a) 빈 personIds → 빈 coordinates 부착(throw 0)", () => {
    const result = buildSummaryBatchOrchestratorInput({
      personIds: [],
      granularities: ["day", "week"],
      resultsByCoordinate: new Map(),
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    });
    expect(result.coordinates).toEqual([]);
  });

  it("(b) 빈 granularities → 빈 coordinates 부착(throw 0)", () => {
    const result = buildSummaryBatchOrchestratorInput({
      personIds: ["alice", "bob"],
      granularities: [],
      resultsByCoordinate: new Map(),
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    });
    expect(result.coordinates).toEqual([]);
  });

  it("(c) 비어있지 않은 roster × granularity → 비어있지 않은 coordinates(좌표 ≥ 1)", () => {
    const result = buildSummaryBatchOrchestratorInput({
      personIds: ["alice"],
      granularities: ["day"],
      resultsByCoordinate: new Map(),
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    });
    expect(result.coordinates).toHaveLength(1);
    expect(result.coordinates[0].personId).toBe("alice");
    expect(result.coordinates[0].period).toBe("day");
  });
});

describe("buildSummaryBatchOrchestratorInput — negative cases 충분 cover", () => {
  it("(1) 빈 roster → coordinates 빈 배열", () => {
    const result = buildSummaryBatchOrchestratorInput({
      personIds: [],
      granularities: ["day"],
      resultsByCoordinate: new Map(),
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    });
    expect(result.coordinates).toEqual([]);
  });

  it("(2) 중복 personId roster → 좌표도 중복 보존(de-dup 0, enumerate 계약 상속)", () => {
    const personIds = ["alice", "alice"];
    const granularities: PeriodGranularity[] = ["day"];
    const result = buildSummaryBatchOrchestratorInput({
      personIds,
      granularities,
      resultsByCoordinate: new Map(),
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    });
    // 중복 personId 가 등장 횟수만큼 좌표 중복 산출.
    expect(result.coordinates).toHaveLength(2);
    expect(result.coordinates[0]).toEqual(result.coordinates[1]);
    // enumerate 산출과 동일.
    expect(result.coordinates).toEqual(
      enumerateSummaryDueCoordinates(personIds, granularities, NOW),
    );
  });

  it("(3) 입력 객체·배열·now 비변형(원본 reference 미변형 단언)", () => {
    const personIds = ["alice", "bob"];
    const granularities: PeriodGranularity[] = ["day", "week"];
    const map = new Map<string, EvaluationResult[]>([
      ["k", [stubResult("r1")]],
    ]);
    const personIdsSnapshot = [...personIds];
    const granularitiesSnapshot = [...granularities];
    const mapSizeBefore = map.size;
    const nowInstant = NOW.getTime();

    buildSummaryBatchOrchestratorInput({
      personIds,
      granularities,
      resultsByCoordinate: map,
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    });

    // 입력 배열 비변형(원소·길이 동일).
    expect(personIds).toEqual(personIdsSnapshot);
    expect(granularities).toEqual(granularitiesSnapshot);
    // 입력 map 비변형(size 동일).
    expect(map.size).toBe(mapSizeBefore);
    // now 비변형(instant 동일).
    expect(NOW.getTime()).toBe(nowInstant);
  });

  it("(4) 2 회 호출 결정성(같은 입력 → 깊은 값 동일)", () => {
    const input: SummaryBatchRosterInput = {
      personIds: ["alice", "bob"],
      granularities: ["day", "month"],
      resultsByCoordinate: new Map([["k", [stubResult("r")]]]),
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    };
    const a = buildSummaryBatchOrchestratorInput(input);
    const b = buildSummaryBatchOrchestratorInput(input);
    // coordinates 깊은 값 동일(결정성).
    expect(a.coordinates).toEqual(b.coordinates);
    // 4 필드는 동일 reference pass-through.
    expect(a.resultsByCoordinate).toBe(b.resultsByCoordinate);
    expect(a.mode).toBe(b.mode);
    expect(a.options).toBe(b.options);
    expect(a.now).toBe(b.now);
  });

  it("(5) resultsByCoordinate map 미부착 좌표가 있어도 composer 는 map 을 변형 0 으로 그대로 전달", () => {
    // 좌표는 2개(alice/day, bob/day) 생기지만 map 은 비어 있음 — composer 는 좌표별 빈
    // 배열 기본 주입을 하지 않는다(그건 buildSummaryBatchPlan 책임). map 그대로 부착.
    const map = new Map<string, EvaluationResult[]>();
    const result = buildSummaryBatchOrchestratorInput({
      personIds: ["alice", "bob"],
      granularities: ["day"],
      resultsByCoordinate: map,
      mode: MODE,
      options: OPTIONS,
      now: NOW,
    });
    expect(result.coordinates).toHaveLength(2);
    // map 은 변형 0 으로 동일 reference + 동일 size(빈 채로 전달).
    expect(result.resultsByCoordinate).toBe(map);
    expect(result.resultsByCoordinate.size).toBe(0);
  });
});
