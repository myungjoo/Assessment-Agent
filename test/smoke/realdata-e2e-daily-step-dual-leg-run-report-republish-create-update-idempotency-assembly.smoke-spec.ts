// realdata-e2e-daily-step-dual-leg-run-report-republish-create-update-
// idempotency-assembly.smoke-spec.ts —
// 실 평가 e2e daily-step dual-leg run report 를 **같은 run 으로 두 번(그리고 멱등
// 확인용 세 번) 연속 publish** 할 때, 1차 publish(빈 검색→create)의 create-output
// issueNumber M 이 2차 publish 의 search-hit 로 다시 관통해 2차 resolve 가 그 동일
// M 을 update(신규 create 아님)로 좁힘을 박제하는 re-publish create→update
// state-transition idempotency non-gated build-time smoke (T-0922 박제, PLAN.md
// 109행 🟢 실 평가 e2e step ④, REQ-009 멱등성).
//
// 절단면 — create→update cross-publish 상태 전이(멱등성의 실체):
//   REQ-009 멱등("동일 run 의 기존 이슈를 찾아 갱신, 중복 생성 안 함")은 한 publish
//   chain 안이 아니라 **두 publish cycle 에 걸친 상태 전이**로만 성립한다:
//     - 1차 publish — 아직 이슈가 없어 marker 검색이 **빈 hit("[]")** 을 반환 →
//       resolve 가 `create` 분기로 좁히고 `gh issue create ...` argv 를 낸다. 이 create
//       를 실행하면 github 이 새 이슈 번호 M 을 URL(`.../issues/M`)로 돌려주고,
//       output-parse 가 그 M 을 `{issueNumber: M}` 로 뽑는다.
//     - 2차 publish(같은 run 재-publish) — 1차가 만든 이슈(번호 M)는 **같은 marker 를
//       body 에 담고 있으므로** 이번엔 marker 검색이 **번호 M 인 hit** 을 반환 →
//       resolve 가 `update` 분기로 좁히고 `plan.action.update.issueNumber === M`,
//       `plan.argv[2] === String(M)`(=`gh issue edit M ...`) 를 낸다. 즉 2차는 1차가
//       만든 **그 이슈 M 을 정확히 갱신**하며 새 이슈를 만들지 않는다.
//   이 **1차 create-output 의 M 이 2차 search-input 으로 다시 관통(threading)** 하는
//   축이 본 spec 의 핵심 — literal 하드코딩이 아니라 1차 create-output 파서 결과에서
//   뽑은 M 을 2차 search-hit number 로 재사용한다.
//
// 형제 smoke 와의 차별(= cycle threading):
//   * T-0921(dual-medium orthogonal) — 단일 publish 안에서 marker(search 매체)·
//     issueNumber(edit 매체) 직교와 create 분기 격리(빈 검색→create)를 박제하나,
//     create-output 의 M 을 후속 publish 의 search-hit 로 threading 하지 않는다
//     (create 와 update 를 같은 run 의 두 cycle 로 잇지 않음). 그 직교/격리 자체
//     재단언 금지.
//   * T-0920(execute-side issueNumber) — 주어진 hit N 으로부터 update.issueNumber·
//     editArgv[2] 수렴만. hit 의 N 이 **어디서 왔는지**(=1차 create-output)는 무관.
//     그 4지점 수렴 자체 재단언 금지.
//   * T-0919(search-side marker) — marker→searchArgv 원소·검색 매체 관통. 그 자체
//     재단언 금지.
//   본 spec 은 1차 create-output 의 M 을 2차 search-input 으로 연결하는 **cross-publish
//   상태 전이**만 박제한다.
//
// 따라서 본 spec 은:
//    🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic leg
//       outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest spawn 0).
//    🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//    🔥 실 gh 실행 0 — search / issue create / issue edit 실 실행 0. execFile('gh', …) 0.
//       실 github 재-publish 부작용(실제 이슈 생성/갱신) 0 — create-exec 의 URL·M 은
//       synthetic stdout literal 로 대체.
//    🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//    🔥 새 외부 dependency 0 — 기존 build*/resolve*/parse* 컴포저 import 재사용만
//       (consistency-guard·helper·type 신설 0 — value-consistency sweep 종결, T-0911).
//    🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0922):
//   - 형제 dual-medium orthogonal(T-0921)·execute-side(T-0920)·search-side(T-0919)·
//     triple-boundary(T-0918)·round-trip(T-0913) 절단면 자체 재단언 — 본 spec 은 두
//     publish cycle 을 잇는 create→update 상태 전이만.
//   - searchArgv 원소 순서/`--match body`/`--limit`·gh-argv 의 `--title`/`--body`/labels
//     형식 재단언(각 가드 cover).
//   - 새 컴포저 / consistency 가드 / helper / type 신설 — 기존 helper import·호출만.
//   - production src/ 코드 / package.json / lockfile / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-output-parse";
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 1차 create-exec 이 돌려줄 synthetic 이슈 번호(raw) — github 이 새 이슈에 부여한 번호를
// 흉내낸다. marker(`${dateToken}@${gitSha}` 조각)와 substring 관계가 없는 양수로 골라
// threading 축이 우연 매칭이 아님을 보장한다("4271" 은 RUN_A marker·searchArgv 어느 원소의
// substring 도 아님). 이 M 은 literal 로 단언에 직접 쓰지 않고 **1차 create-output 파서
// 결과에서 뽑아** 2차 search-hit 로 threading 한다.
const CREATE_ASSIGNED_RAW_M = 4271;

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인
// 타입 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// marker 를 body 에 포함한 synthetic search stdout(1+ hit) — 2차 이후 update 분기 유도.
// gh search issues --json number,title,body 응답을 흉내낸 literal. number=n 이 search-hit
// 단일 source(2차 이후엔 1차 create-output 의 M 을 threading 해 넣는다).
function searchHitStdout(marker: string, ...numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n) => ({
      number: n,
      title: `기존 dual-leg run report 이슈 #${n}`,
      body: `${marker}\n\n본문 일부`,
    })),
  );
}

// synthetic gh issue create stdout — 지정 이슈 번호의 유효 issue URL 한 줄(trailing 개행
// 포함). 실 gh create round-trip 없이 파서에 직접 주입해 1차 create-output 의 M 을 뽑는다.
function issueUrlStdout(n: number): string {
  return `https://github.com/myungjoo/assessment-agent/issues/${n}\n`;
}

// 단일 publish cycle 조립 — report → descriptor → commandArgs → searchArgv → resolve 를
// 주어진 searchStdout 로 한 번 관통시킨다. searchStdout="[]" 면 create 분기, marker hit 이면
// update 분기. 각 stage 의 guard throw 는 자체 try/catch 없이 그대로 전파된다.
function publishCycle(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  searchStdout: string,
) {
  const report = buildRealDataDailyStepDualLegRunReport(
    evalLeg,
    collectLeg,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  const searchArgv =
    buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
  const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout,
    commandArgs,
  );
  return { report, descriptor, commandArgs, searchArgv, searchStdout, plan };
}

// re-publish threading 조립 — 같은 run·같은 leg outcome 으로 여러 publish cycle 을 잇되,
// **1차 create-output 의 issueNumber M 을 2차 이후 search-hit number 로 threading** 한다.
//   (1) 1차: 빈 검색("[]") → create 분기.
//   (2) 1차 create-exec stdout(URL 안 raw 번호) → output-parse 로 M 추출(threading source).
//   (3) 2차: 같은 run 의 marker + M 을 담은 hit → update 분기(M 을 향함).
//   (4) 3차(멱등 확인): 2차와 동일하게 marker + M hit → update 분기(같은 M fixed-point).
// literal M 하드코딩 0 — M 은 항상 1차 create-output 파서 결과에서 나온다.
function republishThread(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  rawAssignedNumber: number = CREATE_ASSIGNED_RAW_M,
) {
  // (1) 1차 publish — 빈 검색 → create 분기.
  const first = publishCycle(evalLeg, collectLeg, run, "[]");
  // (2) 1차 create-exec output → M 추출(threading source).
  const createOutcome =
    parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
      issueUrlStdout(rawAssignedNumber),
    );
  const M = createOutcome.issueNumber;
  // (3) 2차 publish — 1차가 만든 M 을 같은 marker hit 으로 threading → update 분기.
  const second = publishCycle(
    evalLeg,
    collectLeg,
    run,
    searchHitStdout(first.commandArgs.searchQuery, M),
  );
  // (4) 3차 publish — 같은 M 재-hit(멱등 fixed-point 확인).
  const third = publishCycle(
    evalLeg,
    collectLeg,
    run,
    searchHitStdout(first.commandArgs.searchQuery, M),
  );
  return { first, createOutcome, M, second, third };
}

describe("Smoke(non-gated): dual-leg run report re-publish create→update 상태 전이 멱등(1차 create-output M 을 2차 search-hit 로 threading) live-gh 0 검증", () => {
  describe("happy path — 1차 publish(빈 검색→create) + create-output M 추출", () => {
    it("1차 chain: 빈 hit('[]') → plan1.action create 분기 AND plan1.argv[0]==='issue' AND plan1.argv[1]==='create' AND issueNumber 원소 부재. create-exec stdout(URL 안 raw M) → parse → {issueNumber: M} 정상 추출(threading source)", () => {
      const first = publishCycle(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        "[]",
      );
      // 빈 검색 → create 분기.
      expect(first.plan.action).toEqual({ action: "create" });
      expect(first.plan.argv[0]).toBe("issue");
      expect(first.plan.argv[1]).toBe("create");

      // create-exec output → M 추출.
      const createOutcome =
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(CREATE_ASSIGNED_RAW_M),
        );
      expect(createOutcome.issueNumber).toBe(CREATE_ASSIGNED_RAW_M);
      expect(Object.keys(createOutcome).sort()).toEqual(["issueNumber", "url"]);

      // create argv 어느 원소도 뒤 단계 M 문자열과 매칭 안 함(create 는 issueNumber 미보유).
      expect(first.plan.argv.includes(String(createOutcome.issueNumber))).toBe(
        false,
      );
    });
  });

  describe("핵심 threading — 2차 publish 는 1차가 만든 M 을 update(state transition)", () => {
    it("1차 create-output 의 M 을 2차 search-hit 로 threading → (a) plan2.action update 분기 AND (b) plan2.action.update.issueNumber === M(1차가 만든 그 번호) AND (c) plan2.argv[2] === String(M)(=gh issue edit M)를 한 test 안에서 동시 단언 — 2차는 새 create 가 아니라 1차 이슈 M 을 정확히 update", () => {
      const { M, second } = republishThread(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      // (a) update 분기.
      expect(second.plan.action.action).toBe("update");
      // (b) update.issueNumber === 1차가 만든 M.
      if (second.plan.action.action === "update") {
        expect(second.plan.action.issueNumber).toBe(M);
      }
      // (c) editArgv[2] === String(M) (=gh issue edit M).
      expect(second.plan.argv[0]).toBe("issue");
      expect(second.plan.argv[1]).toBe("edit");
      expect(second.plan.argv[2]).toBe(String(M));
    });
  });

  describe("검색 매체 불변(idempotency — searchArgv 두 cycle deep-equal)", () => {
    it("1차·2차 chain 의 searchArgv 는 서로 deep-equal — 같은 run 의 같은 marker 로 검색하므로 검색 매체는 hit 유무·상태 전이(create→update)와 무관하게 불변. 상태 전이는 resolve 산출(action/edit-argv)만 바꾸고 검색 argv 는 안 바꿈", () => {
      const { first, second } = republishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(first.plan.action.action).toBe("create");
      expect(second.plan.action.action).toBe("update");
      // 검색 매체는 두 cycle 불변(같은 marker).
      expect(first.searchArgv).toEqual(second.searchArgv);
      expect(first.searchArgv.includes(first.descriptor.marker)).toBe(true);
      expect(second.searchArgv.includes(second.descriptor.marker)).toBe(true);
    });
  });

  describe("중복 생성 부재(idempotency 핵심 — 신규 create 아님)", () => {
    it("2차 plan2.argv[1] !== 'create'(즉 ['issue','create',...] 형태 아님) AND plan2.action.action !== 'create' — 같은 run 재-publish 가 두 번째 이슈를 만들지 않음을 명시 박제", () => {
      const { second } = republishThread(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(second.plan.argv[1]).not.toBe("create");
      expect(second.plan.action.action).not.toBe("create");
      // 대칭 확인 — update 분기임.
      expect(second.plan.argv[1]).toBe("edit");
      expect(second.plan.action.action).toBe("update");
    });
  });

  describe("multi-cycle 멱등(3회째도 동일 M — 안정 fixed-point)", () => {
    it("3차 chain(같은 marker + 같은 M hit) → plan3.action.update.issueNumber === M AND plan3.argv[2] === String(M) AND plan3.argv 가 plan2.argv 와 deep-equal(같은 run·M·leg → editArgv byte-identical). N≥2 재-publish 는 모두 같은 M 을 향함", () => {
      const { M, second, third } = republishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(third.plan.action.action).toBe("update");
      if (third.plan.action.action === "update") {
        expect(third.plan.action.issueNumber).toBe(M);
      }
      expect(third.plan.argv[2]).toBe(String(M));
      // 2차·3차 editArgv byte-identical(안정 fixed-point).
      expect(third.plan.argv).toEqual(second.plan.argv);
    });
  });

  describe("leg outcome 무관 — 상태 전이 축 격리(branch)", () => {
    it("동일 run·동일 M 고정 + leg outcome 조합만 다르게(pass/pass vs fail/skip) 두 2차-publish → 두 chain 의 plan.action.update.issueNumber === M AND plan.argv[2] === String(M) 동일 — 상태 전이·타겟 이슈는 leg status 무관", () => {
      const passThread = republishThread(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
      );
      const mixedThread = republishThread(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
      );
      // 두 thread 의 1차 create-output M 동일(같은 raw 번호 threading).
      expect(passThread.M).toBe(mixedThread.M);
      // 두 2차의 상태 전이 타겟 M 불변.
      expect(passThread.second.plan.action.action).toBe("update");
      expect(mixedThread.second.plan.action.action).toBe("update");
      if (
        passThread.second.plan.action.action === "update" &&
        mixedThread.second.plan.action.action === "update"
      ) {
        expect(passThread.second.plan.action.issueNumber).toBe(passThread.M);
        expect(mixedThread.second.plan.action.issueNumber).toBe(mixedThread.M);
      }
      expect(passThread.second.plan.argv[2]).toBe(String(passThread.M));
      expect(mixedThread.second.plan.argv[2]).toBe(String(mixedThread.M));
      expect(passThread.second.plan.argv[2]).toBe(
        mixedThread.second.plan.argv[2],
      );
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+", () => {
    it("(a) run.gitSha 빈/공백 → descriptor(stage 1, report 합성) guard throw 로 1차 chain 시작 차단", () => {
      expect(() =>
        publishCycle(
          evalOutcome(),
          collectOutcome(),
          { gitSha: "   ", dateToken: RUN_A.dateToken },
          "[]",
        ),
      ).toThrow();
    });

    it("(b) run.dateToken 빈/공백 → descriptor(stage 1) guard throw 대칭(gitSha 유효해도 필드별 독립 분기)", () => {
      expect(() =>
        publishCycle(
          evalOutcome(),
          collectOutcome(),
          { gitSha: RUN_A.gitSha, dateToken: "" },
          "[]",
        ),
      ).toThrow();
    });

    it("(c-i) 1차 create-output stdout 이 issue URL 미발견(무관/비-github/`/pull/`) → output-parse throw — 잘못된 M 이 2차 search-hit 로 threading 되는 것 원천 차단(URL-미발견 분기)", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "no url at all\n",
        ),
      ).toThrow();
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://gitlab.com/myungjoo/assessment-agent/issues/9\n",
        ),
      ).toThrow();
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/myungjoo/assessment-agent/pull/9\n",
        ),
      ).toThrow();
    });

    it("(c-ii) 1차 create-output URL 안 issueNumber 비양수(/issues/0·선행0·비정수) → output-parse throw(비양수 분기 — c-i 과 분리)", () => {
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          issueUrlStdout(0),
        ),
      ).toThrow();
      expect(() =>
        parseRealDataDailyStepDualLegRunReportIssueCreateEditOutput(
          "https://github.com/myungjoo/assessment-agent/issues/007\n",
        ),
      ).toThrow();
    });

    it("(d-i) 2차 searchStdout 의 hit number 비양수(number:0) → resolve(stage 4) 위임 throw — 비정상 number 가 update.issueNumber/editArgv 원소로 새는 것 차단", () => {
      // 1차 create-output 은 정상(M 추출)이지만 2차 hit 이 오염된 경우를 별도로 재현.
      const first = publishCycle(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        "[]",
      );
      expect(() =>
        publishCycle(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          searchHitStdout(first.commandArgs.searchQuery, 0),
        ),
      ).toThrow();
    });

    it("(d-ii) 2차 searchStdout 비JSON/비배열('not json') → resolve(stage 4) 파서 위임 throw(marker/argv 정상이어도 hits 추출 실패로 update 차단)", () => {
      expect(() =>
        publishCycle(evalOutcome(), collectOutcome(), { ...RUN_A }, "not json"),
      ).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, raw M) 입력으로 re-publish threading 두 번 → M 및 first/second/third plan(및 searchArgv·plan.argv 배열)이 두 번 deep-equal(byte-identical)", () => {
      const a = republishThread(evalOutcome(), collectOutcome(), { ...RUN_A });
      const b = republishThread(evalOutcome(), collectOutcome(), { ...RUN_A });
      expect(a.M).toBe(b.M);
      expect(a.first.searchArgv).toEqual(b.first.searchArgv);
      expect(a.first.plan).toEqual(b.first.plan);
      expect(a.second.plan).toEqual(b.second.plan);
      expect(a.second.plan.argv).toEqual(b.second.plan.argv);
      expect(a.third.plan).toEqual(b.third.plan);
    });

    it("no-mutation — 입력 run/leg outcome literal 이 threading 호출 후 mutate 0(원본 deep-equal 유지, snapshot 대조)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      republishThread(evalLeg, collectLeg, run);

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
    });

    it("무공유 — 1차·2차 searchArgv·plan.argv 배열이 서로 및 재호출 결과와 referential identity 분리(not.toBe)", () => {
      const a = republishThread(evalOutcome(), collectOutcome(), { ...RUN_A });
      const b = republishThread(evalOutcome(), collectOutcome(), { ...RUN_A });
      // 같은 thread 안 1차·2차 배열 분리(deep-equal 이지만 다른 배열 인스턴스).
      expect(a.first.searchArgv).not.toBe(a.second.searchArgv);
      expect(a.first.plan.argv).not.toBe(a.second.plan.argv);
      // 재호출 결과와도 분리.
      expect(a.second.plan).not.toBe(b.second.plan);
      expect(a.second.plan.argv).not.toBe(b.second.plan.argv);
      expect(a.createOutcome).not.toBe(b.createOutcome);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("두 cycle 어디에서도(descriptor.{title,marker,body} / searchQuery / 1차·2차 searchArgv 전체 / plan1.argv·plan2.argv 전체 / createOutcome.url) token/secret/raw narrative 어휘 미등장", () => {
      const { first, second, createOutcome } = republishThread(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const joined = [
        first.descriptor.title,
        first.descriptor.marker,
        first.descriptor.body,
        first.commandArgs.searchQuery,
        ...first.searchArgv,
        ...first.plan.argv,
        second.descriptor.title,
        second.descriptor.marker,
        second.descriptor.body,
        ...second.searchArgv,
        ...second.plan.argv,
        createOutcome.url,
      ].join(" ");

      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toContain("narrative");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 1차·2차 searchArgv/plan.argv 표면에 sentinel 미누출(run-token·issueNumber 표면은 run 식별자·M 파생만)", () => {
      const sentinel = "ghp_SENTINELsecret1234";
      const evalLeg: RealDataDailyStepLegRunOutcome = {
        leg: "eval",
        action: "run",
        passed: true,
        specPath: sentinel,
      };
      const collectLeg: RealDataDailyStepLegRunOutcome = {
        leg: "collect",
        action: "run",
        passed: true,
        specPath: sentinel,
      };
      const { first, second, createOutcome } = republishThread(
        evalLeg,
        collectLeg,
        { ...RUN_A },
      );
      expect(first.searchArgv.join(" ")).not.toContain(sentinel);
      expect(first.plan.argv.join(" ")).not.toContain(sentinel);
      expect(second.searchArgv.join(" ")).not.toContain(sentinel);
      expect(second.plan.argv.join(" ")).not.toContain(sentinel);
      expect(String(createOutcome.issueNumber)).not.toContain(sentinel);
      expect(createOutcome.url).not.toContain(sentinel);
    });
  });
});
