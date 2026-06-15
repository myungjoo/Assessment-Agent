// AssessmentBackfillChecker unit test (CLAUDE.md §3.2 R-112 — happy / error / branch /
// negative 충분 cover). SinceDerivationService 를 jest mock 으로 주입 — 실 수집·실 DB·실
// token 0(Q-0025 deferred 정합). 본 판정자의 분기(deriveSince 반환값의 정의 여부 판정)·
// error 전파(fail-fast)·인자 위임만 검증한다. deriveSince 자체의 도출 정확성은
// since-derivation.service.spec.ts 가 cover — 본 spec 은 checker 의 판정 결선만.
import type { SinceDerivationService } from "../assessment-collection/since-derivation.service";

import { AssessmentBackfillChecker } from "./assessment-backfill-checker.service";

// makeChecker — mock SinceDerivationService(deriveSince spy) 주입한 checker.
function makeChecker(deriveSinceSpy: jest.Mock): {
  checker: AssessmentBackfillChecker;
  deriveSinceSpy: jest.Mock;
} {
  const sinceService = {
    deriveSince: deriveSinceSpy,
  } as unknown as SinceDerivationService;
  const checker = new AssessmentBackfillChecker(sinceService);
  return { checker, deriveSinceSpy };
}

describe("AssessmentBackfillChecker.isAlreadyBackfilled — happy-path", () => {
  it("deriveSince 가 ISO 문자열을 반환하면(직전 Assessment 존재) true 를 반환한다", async () => {
    const spy = jest.fn().mockResolvedValue("2026-06-04T00:00:00.000Z");
    const { checker } = makeChecker(spy);

    await expect(checker.isAlreadyBackfilled("person-1")).resolves.toBe(true);
  });

  it("deriveSince 가 undefined 를 반환하면(신규 인원, Assessment 0건) false 를 반환한다", async () => {
    const spy = jest.fn().mockResolvedValue(undefined);
    const { checker } = makeChecker(spy);

    await expect(checker.isAlreadyBackfilled("person-1")).resolves.toBe(false);
  });

  it("deriveSince 를 정확히 1회, 전달된 personId 인자로 호출한다", async () => {
    const spy = jest.fn().mockResolvedValue(undefined);
    const { checker } = makeChecker(spy);

    await checker.isAlreadyBackfilled("person-42");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("person-42");
  });
});

describe("AssessmentBackfillChecker.isAlreadyBackfilled — branch cover", () => {
  it("정의된 값 분기(true)와 undefined 분기(false)의 두 반환 경로를 모두 cover 한다", async () => {
    // 정의된 값 → true
    const definedSpy = jest.fn().mockResolvedValue("2026-01-01T00:00:00.000Z");
    const { checker: c1 } = makeChecker(definedSpy);
    await expect(c1.isAlreadyBackfilled("p")).resolves.toBe(true);

    // undefined → false
    const undefSpy = jest.fn().mockResolvedValue(undefined);
    const { checker: c2 } = makeChecker(undefSpy);
    await expect(c2.isAlreadyBackfilled("p")).resolves.toBe(false);
  });
});

describe("AssessmentBackfillChecker.isAlreadyBackfilled — error-path", () => {
  it("deriveSince 가 reject(의존성 실패)하면 에러를 삼키지 않고 그대로 전파한다(fail-fast)", async () => {
    const err = new Error("findByPerson 실패");
    const spy = jest.fn().mockRejectedValue(err);
    const { checker } = makeChecker(spy);

    await expect(checker.isAlreadyBackfilled("person-1")).rejects.toThrow(
      "findByPerson 실패",
    );
  });
});

describe("AssessmentBackfillChecker.isAlreadyBackfilled — negative cases", () => {
  it('deriveSince 가 빈 문자열 ""(falsy 이지만 undefined 아님)을 반환하면 true(Assessment 존재) 로 판정한다', async () => {
    // 경계: 판정은 truthiness 가 아니라 `!== undefined` 기준 — 빈 문자열도 "정의됨"이다.
    const spy = jest.fn().mockResolvedValue("");
    const { checker } = makeChecker(spy);

    await expect(checker.isAlreadyBackfilled("person-1")).resolves.toBe(true);
  });

  it("personId 가 빈 문자열이어도 검증 없이 deriveSince 로 그대로 전달한다(판정자는 검증 책임 없음)", async () => {
    const spy = jest.fn().mockResolvedValue(undefined);
    const { checker } = makeChecker(spy);

    await checker.isAlreadyBackfilled("");

    expect(spy).toHaveBeenCalledWith("");
  });

  it("personId 가 공백/비정상 문자열이어도 검증 없이 deriveSince 로 그대로 전달한다", async () => {
    const spy = jest.fn().mockResolvedValue(undefined);
    const { checker } = makeChecker(spy);

    await checker.isAlreadyBackfilled("  \t ");

    expect(spy).toHaveBeenCalledWith("  \t ");
  });
});
