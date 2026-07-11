// realdata-e2e-daily-step-dual-leg-run-report-descriptor-identity-confluence-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report → descriptor title·marker identity-side
// (공유 run-token) confluence 조립 체인 non-gated build-time smoke (T-0916 박제,
// PLAN.md 109행 🟢 실 평가 e2e step ④).
//
// 본 spec 의 존재 이유 — descriptor identity-side confluence gap 해소(요약 축 T-0751 mirror):
//   - PLAN 109행 step ④(daily-test dual-leg run 결과 rolling-issue 박제) 경계의 종단
//     descriptor 빌더 `buildRealDataDailyStepDualLegRunReportIssueDescriptor(report)`
//     (T-0896)는 `{title, marker, body}` 3 필드를 **두 개의 독립 confluence 축** 으로
//     합성한다:
//       1. body-side — `body = [marker, "", markdown].join("\n")`. 이 marker↔markdown
//          2-블록 합류는 **T-0915** 가 직접-체인 smoke 로 박제 완결했다.
//       2. identity-side(본 spec) — `title = ${ISSUE_TITLE_PREFIX} ${token}` 와
//          `marker = ${ISSUE_MARKER_PREFIX} ${token} -->` 가 **동일한
//          `runToken(report) = ${report.dateToken}@${report.gitSha}` 단일 source** 로부터
//          서로 다른 고정 prefix 로 합성된다. title·marker 는 leg outcome 무관(동일 run +
//          다른 eval/collect outcome → 동일 title·marker, body 만 변함)이며, 멱등
//          search-or-update 의 기반(동일 run → 동일 marker → 같은 이슈 갱신, 서로 다른
//          run → 다른 marker → 다른 이슈)이다.
//   - T-0915 의 confluence smoke 는 `descriptor.body` 의 2-블록(marker 라인 포함)만
//     검증할 뿐, title·marker 가 같은 `dateToken@gitSha` 토큰을 공유한다는 단언·
//     title·marker 의 leg outcome-독립성·run-identifier 단일 source threading(서로 다른
//     run → 서로 다른 title·marker, 동일 run → 동일)은 부재다. 본 spec 이 그
//     identity-side gap 을 public CI 그물로 박제해, descriptor 의 두 축(body·identity)을
//     모두 직접-체인으로 닫는다.
//   - nightly 의 실 jest spawn(eval leg + collect leg)은 복제하지 않고, 두 leg 의 run
//     outcome 을 synthetic literal 로 직접 공급한다. 따라서 본 spec 은:
//
//      🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic
//         leg outcome literal 을 조립 체인 첫 단계에 직접 공급.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 실행 0. fetch 0. process.env 읽기 0.
//      🔥 실 gh 실행 0 — issue create / edit 실 실행 0. 순수 descriptor 문자열 조립만.
//      🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 build* 컴포저 import 재사용만
//         (consistency-guard·helper 신설 금지 — sweep 종결, T-0911).
//      🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//      🔥 ISSUE_TITLE_PREFIX / ISSUE_MARKER_PREFIX 는 private const(export 0) — literal
//         prefix 하드코딩 대신 token 경계 split 로 **구조적 단언**만 한다.
//
// Out of Scope (T-0916):
//   - descriptor.body 2-블록 confluence(T-0915, marker↔markdown byte-identical) — 본
//     task 는 title·marker identity-side(run-token 공유)만 책임(중복 0).
//   - T-0914(markdown 고립)·T-0912/T-0913(publish 조립) 의 기존 단언 중복 복제 — 별개 절단면.
//   - 실 LLM round-trip / 실 github 네트워크 / 실 gh issue create·edit·comment 실행
//     (step ④ live wiring — credential gate).
//   - 새 컴포저 / 가드 / helper / type 신설 — 기존 build* 컴포저 import 재사용만.
//   - dual-leg 축 컴포저·렌더러·descriptor 소스
//     (test/helpers/realdata-e2e-daily-step-dual-leg-run-report*.ts) 수정 — read-only 검증 대상.
//   - ISSUE_TITLE_PREFIX / ISSUE_MARKER_PREFIX 를 export 로 바꾸거나 literal 비교 —
//     private const 유지, 구조적(token 경계 split) 단언만.
//   - command-args / search-argv / action resolver 후속 leg / production src/ 코드 변경 —
//     본 task 범위 밖.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 본 smoke 공통 fixture — 결정론 run 식별자(gitSha + dateToken 비공백). 매 it 가
// validRun() 으로 spread 복제를 받아 입력 RUN_REF mutate 누설 0.
const RUN_REF: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 입력 RUN_REF 의 무공유 복제본 — happy/flow/결정론 case 의 공통 진입.
function validRun(): RealDataResultIssueRunRef {
  return { ...RUN_REF };
}

// 합성 run-token — 컴포저 내부 `runToken(report) = ${dateToken}@${gitSha}` 와 동일 규칙으로
// test 측에서 재유도한 expected 공유 substring. literal prefix 는 private 이라 만지지
// 않고, 이 token 만 title·marker 양쪽에 등장(공유)함을 구조적으로 단언한다.
function expectedToken(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 confluence surface 만
// 검증하므로, 도메인 타입 정합(leg 라벨·action·passed 정합)만 만족하는 minimal literal 로
// 충분하다.
function evalLeg(
  action: "run" | "skip",
  passed?: boolean,
): RealDataDailyStepLegRunOutcome {
  return passed === undefined
    ? { leg: "eval", action }
    : { leg: "eval", action, passed };
}

function collectLeg(
  action: "run" | "skip",
  passed?: boolean,
): RealDataDailyStepLegRunOutcome {
  return passed === undefined
    ? { leg: "collect", action }
    : { leg: "collect", action, passed };
}

// assembleViaChain — 본 smoke 의 종단 조립 진입. outcome+run → report → descriptor 한 호출.
function assembleViaChain(
  evalOutcome: RealDataDailyStepLegRunOutcome,
  collectOutcome: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
) {
  const report = buildRealDataDailyStepDualLegRunReport(
    evalOutcome,
    collectOutcome,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  return { report, descriptor };
}

describe("Smoke(non-gated): 실 평가 e2e dual-leg run report → descriptor title·marker identity-side(공유 run-token) confluence 조립 체인(outcome→report→descriptor) live-LLM 0·gh 실행 0 검증", () => {
  describe("happy path — title·marker 가 공유 run-token 으로 합성", () => {
    it("유효 두 leg outcome + 유효 run → descriptor.title·descriptor.marker 가 string·non-empty 이고 둘 다 합성 run-token(${dateToken}@${gitSha})을 포함(공유 source)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const { descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      );

      expect(typeof descriptor.title).toBe("string");
      expect(typeof descriptor.marker).toBe("string");
      expect(descriptor.title.length).toBeGreaterThan(0);
      expect(descriptor.marker.length).toBeGreaterThan(0);
      // title·marker 가 같은 합성 run-token 을 thread(단일 source).
      expect(descriptor.title).toContain(token);
      expect(descriptor.marker).toContain(token);
    });

    it("title !== marker(서로 다른 prefix·서로 다른 문자열) 이면서 동일 token 을 공유(공유 substring 이 양쪽에 등장)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const { descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("skip"),
        run,
      );

      // title 과 marker 는 서로 다른 고정 prefix 라 문자열 자체는 다르다.
      expect(descriptor.title).not.toBe(descriptor.marker);
      // 그러나 둘 다 동일 token 을 공유(공유 source — title·marker 합류).
      expect(descriptor.title).toContain(token);
      expect(descriptor.marker).toContain(token);
    });

    it("descriptor.marker 가 descriptor.body 첫 줄로 정확히 1 회 등장(identity↔body 정합 — marker round-token)", () => {
      const run = validRun();

      const { descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", false),
        run,
      );

      // marker 가 body 첫 줄로 등장(identity 축이 body 축으로 합류하는 round-token).
      expect(descriptor.body.split("\n")[0]).toBe(descriptor.marker);
      // marker 가 body 에 정확히 1 회(멱등 — 중복 0).
      expect(descriptor.body.split(descriptor.marker)).toHaveLength(2);
    });
  });

  describe("identity-confluence 단일 source — token 경계 split 로 고정 prefix 구조 검증", () => {
    it("title.split(token) / marker.split(token) 가 token 을 사이에 둔 고정 prefix(+marker suffix) 로 분해되고, 양쪽이 동일 token substring 을 thread(literal prefix 하드코딩 0)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const { descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      );

      // token 경계로 쪼개면 [고정 prefix, 나머지] 2 조각 — token 이 양쪽에 정확히 1 회.
      const titleParts = descriptor.title.split(token);
      const markerParts = descriptor.marker.split(token);
      expect(titleParts).toHaveLength(2);
      expect(markerParts).toHaveLength(2);

      // title 은 prefix + token(뒤 잔여 0): split 의 두 번째 조각이 빈 문자열.
      expect(titleParts[1]).toBe("");
      // title 의 고정 prefix(token 앞부분)는 비어있지 않음(prefix 존재).
      expect(titleParts[0].length).toBeGreaterThan(0);
      // marker 는 prefix + token + suffix: 두 조각 모두 비어있지 않음(suffix `-->` 존재).
      expect(markerParts[0].length).toBeGreaterThan(0);
      expect(markerParts[1].length).toBeGreaterThan(0);
      // title prefix 와 marker prefix 는 서로 다름(서로 다른 고정 머리).
      expect(titleParts[0]).not.toBe(markerParts[0]);
    });

    it("동일 run·서로 다른 leg outcome 반복 호출 시 token 을 제거한 고정 prefix(title)·prefix+suffix(marker)가 불변(결정론적 고정 prefix)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const a = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      ).descriptor;
      const b = assembleViaChain(
        evalLeg("skip"),
        collectLeg("run", false),
        run,
      ).descriptor;

      // 서로 다른 leg outcome 여도 token 경계 split 의 고정 부분(prefix/suffix)이 동일.
      expect(a.title.split(token)).toEqual(b.title.split(token));
      expect(a.marker.split(token)).toEqual(b.marker.split(token));
    });
  });

  describe("leg outcome-독립성(핵심) — 동일 run + 서로 다른 leg outcome → 동일 title·marker, 다른 body", () => {
    it("동일 run·서로 다른 leg outcome(eval=pass/collect=pass vs eval=fail/collect=skip) → title·marker 동일(leg outcome 무관·run 만의 함수)", () => {
      const run = validRun();

      const da = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      ).descriptor;
      const db = assembleViaChain(
        evalLeg("run", false),
        collectLeg("skip"),
        run,
      ).descriptor;

      expect(da.title).toBe(db.title);
      expect(da.marker).toBe(db.marker);
    });

    it("동일 run·서로 다른 leg outcome → body 는 달라야 함(leg outcome 이 body 에는 반영 — title/marker 와 body 의 의존 분리)", () => {
      const run = validRun();

      const da = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      ).descriptor;
      const db = assembleViaChain(
        evalLeg("run", false),
        collectLeg("skip"),
        run,
      ).descriptor;

      // title·marker 는 같지만(위 test) body 는 leg outcome(overallStatus·per-leg) 차이로 달라짐.
      expect(da.body).not.toBe(db.body);
    });
  });

  describe("run-별 멱등·분리 — 동일 run 멱등 / 서로 다른 run 분리", () => {
    it("동일 run 두 번(leg outcome 무관) → title·marker byte-identical(멱등 search-or-update 토큰 안정)", () => {
      const da = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        validRun(),
      ).descriptor;
      const db = assembleViaChain(
        evalLeg("skip"),
        collectLeg("run", false),
        validRun(),
      ).descriptor;

      expect(da.title).toBe(db.title);
      expect(da.marker).toBe(db.marker);
    });

    it("서로 다른 run(gitSha 만 다름) → title·marker 서로 다름(다른 run 의 이슈를 잘못 갱신하지 않음 — 분리)", () => {
      const runA: RealDataResultIssueRunRef = {
        gitSha: "aaa1111",
        dateToken: "2026-07-11",
      };
      const runB: RealDataResultIssueRunRef = {
        gitSha: "bbb2222",
        dateToken: "2026-07-11",
      };

      const da = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        runA,
      ).descriptor;
      const db = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        runB,
      ).descriptor;

      expect(da.title).not.toBe(db.title);
      expect(da.marker).not.toBe(db.marker);
    });

    it("서로 다른 run(dateToken 만 다름) → title·marker 서로 다름(날짜 축 분리 — gitSha 만 다른 경우와 별개 분기)", () => {
      const runA: RealDataResultIssueRunRef = {
        gitSha: "same9999",
        dateToken: "2026-07-10",
      };
      const runB: RealDataResultIssueRunRef = {
        gitSha: "same9999",
        dateToken: "2026-07-11",
      };

      const da = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        runA,
      ).descriptor;
      const db = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        runB,
      ).descriptor;

      expect(da.title).not.toBe(db.title);
      expect(da.marker).not.toBe(db.marker);
    });
  });

  describe("negative cases — run 결손 guard 전파(각 필드 독립 분기, 단일 negative 금지)", () => {
    it("run.gitSha 빈 문자열 → 조립 첫 단계(build) gitSha guard throw 가 그대로 전파(자체 try/catch 0)", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: "",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("run.gitSha 공백만 → gitSha guard throw 전파(공백-only 분기)", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: "   ",
          dateToken: RUN_REF.dateToken,
        }),
      ).toThrow();
    });

    it("run.dateToken 빈 문자열 → dateToken guard throw 전파(gitSha 유효해도 — 필드별 독립 분기)", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: RUN_REF.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("run.dateToken 공백만 → dateToken guard throw 전파(공백-only 분기)", () => {
      expect(() =>
        assembleViaChain(evalLeg("run", true), collectLeg("run", true), {
          gitSha: RUN_REF.gitSha,
          dateToken: "   ",
        }),
      ).toThrow();
    });
  });

  describe("flow / branch — raw specPath 누출 0 / overallStatus 각 분기에서 title·marker 불변", () => {
    it("raw specPath / credential 누출 0 — synthetic leg outcome specPath 에 sentinel 주입해도 title·marker 에 미등장(title·marker 는 run-token 만, specPath/narrative 무관 — R-59/REQ-059)", () => {
      const sentinel = "SENTINEL_RAW_LEAK_PROBE_T_0916";
      const evalOutcome: RealDataDailyStepLegRunOutcome = {
        leg: "eval",
        action: "run",
        passed: true,
        specPath: `${sentinel}/eval.spec.ts`,
      };
      const collectOutcome: RealDataDailyStepLegRunOutcome = {
        leg: "collect",
        action: "run",
        passed: true,
        specPath: `${sentinel}/collect.spec.ts`,
      };

      const { descriptor } = assembleViaChain(
        evalOutcome,
        collectOutcome,
        validRun(),
      );

      expect(descriptor.title).not.toContain(sentinel);
      expect(descriptor.marker).not.toContain(sentinel);
      expect(descriptor.title).not.toContain(".spec.ts");
      expect(descriptor.marker).not.toContain(".spec.ts");
      expect(descriptor.title.toLowerCase()).not.toContain("secret");
      expect(descriptor.marker.toLowerCase()).not.toContain("secret");
    });

    it("(i) all-pass 분기(eval=pass·collect=pass) → 동일 run 이면 title·marker 가 기준(all-pass)과 불변(overallStatus 무관)", () => {
      const run = validRun();
      const token = expectedToken(run);

      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      );

      expect(report.overallStatus).toBe("all-pass");
      expect(descriptor.title).toContain(token);
      expect(descriptor.marker).toContain(token);
    });

    it("(ii) some-fail 분기(eval=pass·collect=fail) → 동일 run 이면 title·marker 가 all-pass 기준과 불변(overallStatus 무관)", () => {
      const run = validRun();

      const base = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      ).descriptor;
      const { report, descriptor } = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", false),
        run,
      );

      expect(report.overallStatus).toBe("some-fail");
      expect(descriptor.title).toBe(base.title);
      expect(descriptor.marker).toBe(base.marker);
    });

    it("(iii) all-skip 분기(eval=skip·collect=skip) → 동일 run 이면 title·marker 가 all-pass 기준과 불변(overallStatus 무관)", () => {
      const run = validRun();

      const base = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      ).descriptor;
      const { report, descriptor } = assembleViaChain(
        evalLeg("skip"),
        collectLeg("skip"),
        run,
      );

      expect(report.overallStatus).toBe("all-skip");
      expect(descriptor.title).toBe(base.title);
      expect(descriptor.marker).toBe(base.marker);
    });

    it("(iv) partial 분기(eval=skip·collect=pass) → 동일 run 이면 title·marker 가 all-pass 기준과 불변(overallStatus 무관)", () => {
      const run = validRun();

      const base = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", true),
        run,
      ).descriptor;
      const { report, descriptor } = assembleViaChain(
        evalLeg("skip"),
        collectLeg("run", true),
        run,
      );

      expect(report.overallStatus).toBe("partial");
      expect(descriptor.title).toBe(base.title);
      expect(descriptor.marker).toBe(base.marker);
    });
  });

  describe("결정론 · 무공유 · no-mutation — 동일 입력 반복 조립 + 입력 불변", () => {
    it("동일 (evalOutcome, collectOutcome, run) 두 번 chain → title·marker byte-identical + 매 호출 새 descriptor 객체(반환 참조 비동일)", () => {
      const a = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", false),
        validRun(),
      ).descriptor;
      const b = assembleViaChain(
        evalLeg("run", true),
        collectLeg("run", false),
        validRun(),
      ).descriptor;

      // 결정론 — 입력만의 함수.
      expect(a.title).toBe(b.title);
      expect(a.marker).toBe(b.marker);
      // 무공유 — 매 호출 새 객체 참조.
      expect(a).not.toBe(b);
    });

    it("조립이 입력 evalOutcome / collectOutcome / run 객체를 mutate 하지 않음(before/after deep-equal 스냅샷 비교)", () => {
      const evalOutcome = evalLeg("run", true);
      const collectOutcome = collectLeg("run", false);
      const run = validRun();
      const evalBefore = JSON.parse(JSON.stringify(evalOutcome));
      const collectBefore = JSON.parse(JSON.stringify(collectOutcome));
      const runBefore = JSON.parse(JSON.stringify(run));

      assembleViaChain(evalOutcome, collectOutcome, run);

      expect(evalOutcome).toEqual(evalBefore);
      expect(collectOutcome).toEqual(collectBefore);
      expect(run).toEqual(runBefore);
    });
  });
});
