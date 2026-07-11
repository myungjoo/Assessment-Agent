// realdata-e2e-daily-step-dual-leg-run-report-update-branch-searchargv-marker-
// editbody-single-source-convergence-assembly.smoke-spec.ts — 실 평가 e2e
// daily-step dual-leg run report 의 **update 분기(marker-매칭 hit)** 에서 두 개의
// 서로 다른 gh 호출이 **동일 descriptor.marker 단일 source 로부터 byte-identical
// 하게 관통** 함을 박제하는 update-branch cross-call marker single-source
// convergence non-gated build-time smoke (T-0929 박제, PLAN.md 109행 🟢 실 평가
// e2e step ④).
//
// 두 gh 호출(update 분기 절단면):
//   - call 1 (search) — buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(
//     commandArgs)(T-0900) 가 산출한 argv `["search","issues","--match","body",
//     searchQuery,"--json",...]`. `--match body` 다음 원소 = searchQuery(= descriptor.
//     marker) 가 **검색 marker** — "이 run 의 이슈가 이미 있는가?" 를 검색한다.
//   - call 2 (edit) — 검색이 marker-매칭 hit(1+건)를 반환하면 action 이 update 로
//     해소되어 종단 컴포저 resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
//     stdout, commandArgs)(T-0902) 가 argv `["issue","edit",String(N),"--title",title,
//     "--body",body]` 를 산출한다. `--body` 다음 원소 body 의 **선두 라인**(body.split(
//     "\n")[0]) = descriptor.marker(descriptor helper: body = [marker,"",...markdown]).
//
// 본 spec 의 존재 이유 — update-branch cross-call marker single-source seam 봉합:
//   검색하는 marker(call 1)와 갱신 이슈 body 에 다시 심는 marker(call 2)가 **동일
//   descriptor.marker 단일 source 로부터 byte-identical 하게 관통** 해야 step ④ 의
//   update-side 멱등(REQ-009 — "동일 run 의 이슈를 찾아 갱신")이 성립한다: 오늘 밤
//   run 이 marker M 으로 검색해 기존 이슈를 찾으면 그 이슈를 edit 하며 body 선두에
//   다시 marker M 을 심고, 내일 밤 run 이 다시 marker M 으로 검색하면 그 이슈를
//   **여전히** 찾아 중복 생성 대신 재갱신한다. 만약 검색 marker 와 edit body marker 가
//   어긋나면(silent drift) — 갱신이 자기 marker 를 지워 **다음 밤부터 이슈를 못 찾아
//   중복 양산** 한다.
//
//   형제 smoke 들이 각기 다른 축만 닫았다:
//     * T-0928(create-branch cross-call marker single-source) 은 **create 분기**(빈
//       search) 의 검색 marker(call 1) ↔ create body 선두 marker(call 2) 관통만
//       자산화하고 **update/edit 분기** 는 명시적으로 격리 대상(재단언 금지). update
//       분기의 edit body marker 는 다루지 않는다.
//     * T-0921(update-branch marker⊥issueNumber orthogonal) 은 **update 분기** 의
//       marker(=search 매체) ⊥ issueNumber(=edit 매체) 직교성만 자산화한다 — marker 와
//       issueNumber 가 서로 다른 매체임을 박제할 뿐, edit body 에 다시 심는 marker 가
//       검색 marker 와 동일 source 로부터 byte-identical 함(single-source cross-call
//       수렴)은 미단언. 직교 축과 다른 축(marker single-source cross-call 수렴)이다.
//     * T-0920(edit-argv issueNumber) 은 edit argv 의 issueNumber 원소만, T-0927(gh-
//       command-plan argv single-source) 은 plan.argv 가 single-source 빌더 산출과
//       byte-identical 함만 자산화(searchArgv 를 다루지 않아 cross-call marker 수렴 미단언).
//
//   본 spec 은 T-0928 의 **update-side 대칭 sibling** 으로, `report → descriptor →
//   commandArgs → (1) searchArgv, (2) marker-매칭 hit stdout 에 종단 컴포저 → edit
//   plan.argv` 조립에서 두 gh 호출의 marker 가 동일 descriptor.marker 로부터 byte-
//   identical 하게 관통함을 public CI 그물로 박제한다. 따라서 본 spec 은:
//
//    🔥 실 LLM 호출 0 — orchestrator / scoring service / gateway 미사용. synthetic leg
//       outcome / run / stdout literal 을 조립 체인에 직접 공급(실 평가·수집·jest spawn 0).
//    🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//    🔥 실 gh 실행 0 — search / issue edit 실 실행 0. execFile('gh', …) 0.
//    🔥 credential 0 / secret 0 / DB 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//    🔥 새 외부 dependency 0 — 기존 build*/resolve* 컴포저 import 재사용만
//       (consistency-guard·helper·type 신설 0).
//    🔥 gating / describe.skip / env-gating 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0929):
//   - 형제 T-0928 의 create-branch 검색 marker(call 1) ↔ create body 선두 marker
//     (call 2) single-source cross-call 수렴 축 재단언 — 본 spec 은 update 분기 검색
//     marker(call 1) ↔ edit body 선두 marker(call 2) single-source 수렴만(create 분기는
//     격리 확인만).
//   - 형제 T-0921 의 update-branch marker(=search 매체) ⊥ issueNumber(=edit 매체) 직교
//     축 재단언 — 본 spec 은 직교가 아니라 검색 marker ↔ edit body marker 동일 source
//     관통(single-source 수렴) 축.
//   - 형제 T-0919 의 search-argv marker 4-boundary single-source closure 축·T-0920 의
//     edit-argv issueNumber 축·T-0927 의 gh-command-plan argv single-source byte-
//     identical 축 자체 재단언 — 본 spec 은 두 gh 호출을 결합한 update-side cross-call
//     marker 수렴 단일 축.
//   - descriptor body 의 markdown 본문 렌더(marker 이후 블록)·title 형식·issueNumber
//     해석·labels 형식 재단언 — 각 helper/smoke 가 이미 cover. 본 spec 은 marker 라인
//     (검색·갱신 두 지점) single-source 수렴만.
//   - 새 컴포저 / consistency 가드 / helper / type 신설 — 기존 helper import·호출만.
//   - production src/ 코드 / package.json / lockfile / test/jest-smoke.json 변경.
import {
  buildRealDataDailyStepDualLegRunReport,
  type RealDataDailyStepLegRunOutcome,
} from "../helpers/realdata-e2e-daily-step-dual-leg-run-report";
import { buildRealDataDailyStepDualLegRunReportIssueCommandArgs } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-command-args";
import { buildRealDataDailyStepDualLegRunReportIssueDescriptor } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";
import { resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-gh-command-plan";
import { buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv } from "../helpers/realdata-e2e-daily-step-dual-leg-run-report-issue-search-argv";
import type { RealDataResultIssueRunRef } from "../helpers/realdata-e2e-result-issue-descriptor";

// 결정론 run 식별자 fixture — gitSha + dateToken 비공백 안정 토큰. 매 it 가 spread 복제로
// 받아 입력 mutate 누설 0. token/secret/raw narrative 어휘 미포함(credential 누출 0 단언
// fixture 전제).
const RUN_A: RealDataResultIssueRunRef = {
  gitSha: "abc1234",
  dateToken: "2026-07-11",
};

// 서로 다른 run — gitSha·dateToken 이 RUN_A 와 서로 substring 이 아닌 구별 가능 값(run
// 분포 변별 단언용 — run 을 바꾸면 두 지점 marker 가 함께 변한다).
const RUN_B: RealDataResultIssueRunRef = {
  gitSha: "def5678",
  dateToken: "2026-07-12",
};

// 기존 이슈 번호 fixture — marker-매칭 hit stdout 의 number(= update 분기 issueNumber).
const EXISTING_ISSUE_NUMBER = 77;

// synthetic leg outcome fixture — eval / collect 각 leg 의 run outcome literal. 조립
// 체인은 leg outcome 을 report → descriptor 로 흘려보내는 surface 만 검증하므로 도메인
// 타입 정합만 만족하는 minimal literal 로 충분하다(실 jest spawn 0).
function evalOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "eval", action: "run", passed: true };
}

function collectOutcome(): RealDataDailyStepLegRunOutcome {
  return { leg: "collect", action: "run", passed: true };
}

// run-token 계산 — literal prefix 하드코딩이 아니라 helper 규약 `${dateToken}@${gitSha}`
// 를 재계산해 marker substring 을 구조적으로 검증한다(prefix const 는 export 0).
function runTokenOf(run: RealDataResultIssueRunRef): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// searchArgv 의 검색 marker 추출 — `--match body` 다음 원소(index of "--match" + 2).
// 형식 규약(원소 순서·`--json` 필드) 자체 재단언은 T-0919 cover — 본 spec 은 검색 marker
// 원소 추출에만 사용.
function searchMarkerOf(searchArgv: string[]): string {
  const matchIdx = searchArgv.indexOf("--match");
  // `--match` → `body` → <searchQuery=검색 marker> 순서(T-0900 규약). 방어적 추출.
  return searchArgv[matchIdx + 2];
}

// edit-branch plan.argv 의 body 원소 추출 — `--body` 다음 원소. body 선두 라인이 marker.
function editBodyOf(argv: string[]): string {
  const bodyIdx = argv.indexOf("--body");
  return argv[bodyIdx + 1];
}

// edit body 선두 라인 = marker(descriptor helper: body = [marker,"",...markdown]).
function editBodyHeadLineOf(argv: string[]): string {
  return editBodyOf(argv).split("\n")[0];
}

// marker-매칭 hit stdout 합성 — 기존 이슈 검색이 이 run 의 marker 를 body 에 담은 이슈
// 1건을 반환하는 상황을 synthetic literal 로 재현한다(실 gh search 실행 0). body 에 marker
// 를 담아야 action resolver 가 update 로 해소한다.
function hitStdoutOf(marker: string, issueNumber: number): string {
  return JSON.stringify([
    {
      number: issueNumber,
      title: "기존 dual-leg run report 이슈",
      body: `${marker}\n\n기존 본문 일부`,
    },
  ]);
}

// update-branch cross-call 조립 진입점 — 단일 source(run + 두 leg outcome) 로부터 report
// → descriptor → commandArgs 를 관통시켜 유효 commandArgs 를 얻고, (1) searchArgv 를,
// (2) marker-매칭 hit stdout 에 종단 컴포저를 적용해 update plan 을 산출한다. 각 stage 의
// guard throw 는 자체 try/catch 없이 그대로 전파된다. opts.searchStdout 으로 create 분기
// 격리·파서 negative test 도 같은 진입점을 재사용한다.
function assembleUpdateBranch(
  evalLeg: RealDataDailyStepLegRunOutcome,
  collectLeg: RealDataDailyStepLegRunOutcome,
  run: RealDataResultIssueRunRef,
  opts?: { searchStdout?: string; issueNumber?: number },
) {
  // (1) pre-execution descriptor.
  const report = buildRealDataDailyStepDualLegRunReport(
    evalLeg,
    collectLeg,
    run,
  );
  const descriptor =
    buildRealDataDailyStepDualLegRunReportIssueDescriptor(report);
  // (2) command-args — searchQuery = descriptor.marker, updateArgs.body = descriptor.body.
  const commandArgs =
    buildRealDataDailyStepDualLegRunReportIssueCommandArgs(descriptor);
  // (3) call 1 — searchArgv(검색 marker = `--match body` 다음 원소).
  const searchArgv =
    buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
  // (4) call 2 — marker-매칭 hit stdout → update 분기 plan.argv(edit body 선두 = marker).
  //     opts.searchStdout 이 없으면 이 run 의 descriptor.marker 를 담은 hit 를 합성한다.
  const issueNumber = opts?.issueNumber ?? EXISTING_ISSUE_NUMBER;
  const searchStdout =
    opts?.searchStdout ?? hitStdoutOf(descriptor.marker, issueNumber);
  const plan = resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
    searchStdout,
    commandArgs,
  );
  return { report, descriptor, commandArgs, searchArgv, searchStdout, plan };
}

describe("Smoke(non-gated): dual-leg run report update-branch(marker-매칭 hit) cross-call marker(searchArgv 검색 marker + edit body 선두 marker) single-source convergence live-gh 0 검증", () => {
  describe("happy path — update-branch marker cross-call 수렴", () => {
    it("단일 source(run + 두 leg outcome) → marker-매칭 hit → plan.action.action === 'update' 이고 issueNumber === N, searchArgv 검색 marker 와 edit body 선두 라인이 각각 descriptor.marker 와 byte-identical(===) AND 서로도 byte-identical", () => {
      const { descriptor, searchArgv, plan } = assembleUpdateBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );

      // update 분기 해소.
      expect(plan.action.action).toBe("update");
      if (plan.action.action === "update") {
        expect(plan.action.issueNumber).toBe(EXISTING_ISSUE_NUMBER);
      }

      const searchMarker = searchMarkerOf(searchArgv);
      const editBodyHead = editBodyHeadLineOf(plan.argv);

      // (1) 두 지점이 각각 descriptor.marker 와 byte-identical.
      expect(searchMarker).toBe(descriptor.marker);
      expect(editBodyHead).toBe(descriptor.marker);

      // (2) 두 지점이 서로도 byte-identical(단일 source 관통).
      expect(searchMarker).toBe(editBodyHead);
    });

    it("update plan.argv 는 issue edit argv 형(argv[0]==='issue', argv[1]==='edit', argv[2]===String(N))이고 `--body` 원소를 보유 — edit body 선두 marker 추출 전제 확인", () => {
      const { plan } = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("edit");
      expect(plan.argv[2]).toBe(String(EXISTING_ISSUE_NUMBER));
      expect(plan.argv.includes("--body")).toBe(true);
    });
  });

  describe("핵심 1 — marker 등장 지점 유일성", () => {
    it("searchArgv 에서 marker 는 정확히 검색질의 1원소로만 등장 — 다른 원소(search/issues/--match/body/--json/필드/--limit)에는 marker 온전체 부재", () => {
      const { descriptor, searchArgv } = assembleUpdateBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const marker = descriptor.marker;
      // 정확히 1원소가 marker.
      expect(searchArgv.filter((el) => el === marker).length).toBe(1);
      // 그 외 원소에는 marker 온전체 부재.
      expect(
        searchArgv
          .filter((el) => el !== marker)
          .every((el) => !el.includes(marker)),
      ).toBe(true);
    });

    it("edit plan.argv 에서 marker(온전체)는 edit body 원소 안에서만 등장 — issue/edit/String(N)/title 원소에는 marker 온전체 부재(title 은 body 선두 marker 라인과 !==)", () => {
      const { descriptor, plan } = assembleUpdateBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const marker = descriptor.marker;
      const body = editBodyOf(plan.argv);
      const titleIdx = plan.argv.indexOf("--title");
      const title = plan.argv[titleIdx + 1];

      // body 는 marker 온전체를 포함, title 은 미포함.
      expect(body.includes(marker)).toBe(true);
      expect(title.includes(marker)).toBe(false);
      // title 은 body 선두 marker 라인과 서로 다른 문자열.
      expect(title).not.toBe(editBodyHeadLineOf(plan.argv));

      // body 를 제외한 나머지 argv 원소(issue/edit/String(N)/--title/title/--body)
      // 어디에도 marker 온전체 부재.
      const nonBodyElems = plan.argv.filter((el) => el !== body);
      expect(nonBodyElems.every((el) => !el.includes(marker))).toBe(true);
    });

    it("edit body 안에서 marker 라인은 정확히 1회만 등장(body.split(marker).length === 2, 중복 0)", () => {
      const { descriptor, plan } = assembleUpdateBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const body = editBodyOf(plan.argv);
      expect(body.split(descriptor.marker).length).toBe(2);
    });
  });

  describe("핵심 2 — run 분포 변별(두 지점 동반 변화 + 여전히 상호 byte-identical)", () => {
    it("(a) 서로 다른 run(A/B) 각각 update-branch chain → 각 run 안에서 (searchMarker, editBodyHead) 는 서로 byte-identical", () => {
      const chainA = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const chainB = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
        ...RUN_B,
      });

      const searchMarkerA = searchMarkerOf(chainA.searchArgv);
      const editHeadA = editBodyHeadLineOf(chainA.plan.argv);
      const searchMarkerB = searchMarkerOf(chainB.searchArgv);
      const editHeadB = editBodyHeadLineOf(chainB.plan.argv);

      expect(searchMarkerA).toBe(editHeadA);
      expect(searchMarkerB).toBe(editHeadB);
      // 각 marker 는 자기 run 의 run-token 보유(구조 검증).
      expect(searchMarkerA).toContain(runTokenOf(RUN_A));
      expect(searchMarkerB).toContain(runTokenOf(RUN_B));
    });

    it("(b) run A ≠ run B → searchMarker 두 값 서로 다름 AND editBodyHead 두 값 서로 다름(두 지점이 run 에 따라 함께 변함 — run-token 단일 source 동반 관통)", () => {
      const chainA = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const chainB = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
        ...RUN_B,
      });

      expect(searchMarkerOf(chainA.searchArgv)).not.toBe(
        searchMarkerOf(chainB.searchArgv),
      );
      expect(editBodyHeadLineOf(chainA.plan.argv)).not.toBe(
        editBodyHeadLineOf(chainB.plan.argv),
      );
    });
  });

  describe("핵심 3 — leg outcome 무관 marker 안정(멱등 근거)", () => {
    it("동일 run + leg outcome 조합만 다르게(pass/pass vs fail/skip) → searchMarker 와 editBodyHead 가 서로 byte-identical 하고, 두 값 모두 leg outcome 변경 전과 동일(marker 는 run-token 만의 함수)", () => {
      const passChain = assembleUpdateBranch(
        { leg: "eval", action: "run", passed: true },
        { leg: "collect", action: "run", passed: true },
        { ...RUN_A },
      );
      const mixedChain = assembleUpdateBranch(
        { leg: "eval", action: "run", passed: false },
        { leg: "collect", action: "skip" },
        { ...RUN_A },
      );

      const passSearch = searchMarkerOf(passChain.searchArgv);
      const passEdit = editBodyHeadLineOf(passChain.plan.argv);
      const mixedSearch = searchMarkerOf(mixedChain.searchArgv);
      const mixedEdit = editBodyHeadLineOf(mixedChain.plan.argv);

      // 각 chain 안에서 두 지점 상호 identical.
      expect(passSearch).toBe(passEdit);
      expect(mixedSearch).toBe(mixedEdit);
      // leg outcome 변경 전후 두 지점 모두 불변.
      expect(mixedSearch).toBe(passSearch);
      expect(mixedEdit).toBe(passEdit);
    });
  });

  describe("branch — create 분기 격리(edit body argv 미산출)", () => {
    it("빈 search stdout('[]') → plan.action.action === 'create' AND plan.argv 가 issue create argv(argv[0]==='issue', argv[1]==='create')로 edit body argv(argv[1]==='edit') 미산출", () => {
      const { plan } = assembleUpdateBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
        { searchStdout: "[]" },
      );

      expect(plan.action.action).toBe("create");
      expect(plan.argv[0]).toBe("issue");
      expect(plan.argv[1]).toBe("create");
      // update-branch 의 issue edit argv 는 create 분기에서 생성되지 않는다.
      expect(plan.argv[1]).not.toBe("edit");
    });
  });

  describe("핵심 4 — single-source 독립 재유도 + 결정론", () => {
    it("컴포저·searchArgv 빌더 재호출 없이 descriptor.marker 를 진실의 원천으로 삼아 searchMarker·editBodyHead 가 그 descriptor.marker 와 각각 deep-equal — 두 지점 marker 가 하드코딩이 아니라 descriptor.marker 파생", () => {
      const { descriptor, searchArgv, plan } = assembleUpdateBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      expect(searchMarkerOf(searchArgv)).toEqual(descriptor.marker);
      expect(editBodyHeadLineOf(plan.argv)).toEqual(descriptor.marker);
    });

    it("결정론 — 동일 입력(+ 동일 hit stdout) 두 번 chain → 두 (searchMarker, editBodyHead) 쌍 deep-equal(byte-identical)", () => {
      const first = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const second = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(searchMarkerOf(first.searchArgv)).toEqual(
        searchMarkerOf(second.searchArgv),
      );
      expect(editBodyHeadLineOf(first.plan.argv)).toEqual(
        editBodyHeadLineOf(second.plan.argv),
      );
    });
  });

  describe("error path / negative cases — 예외 분기마다 각 1+", () => {
    it("(a) searchArgv 검색 marker drift 검출 — chain 산출 searchArgv 를 복제해 검색 marker 원소를 변형한 synthetic argv 의 검색 marker 가 edit body 선두 marker 와 !==(cross-call byte-identical 위반 검출)", () => {
      const { searchArgv, plan } = assembleUpdateBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const editHead = editBodyHeadLineOf(plan.argv);
      // 검색 marker 원소 위치를 변형한 synthetic 복제.
      const matchIdx = searchArgv.indexOf("--match");
      const drifted = [...searchArgv];
      drifted[matchIdx + 2] = `${drifted[matchIdx + 2]}-DRIFT`;
      expect(searchMarkerOf(drifted)).not.toBe(editHead);
    });

    it("(b) edit body 선두 marker drift 검출 — edit plan.argv 의 body 원소를 복제해 선두 marker 라인을 변형(token 한 글자 변경)한 synthetic body 의 선두 라인이 searchArgv 검색 marker 와 !==", () => {
      const { searchArgv, plan } = assembleUpdateBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const searchMarker = searchMarkerOf(searchArgv);
      const body = editBodyOf(plan.argv);
      const lines = body.split("\n");
      // 선두 marker 라인 token 한 글자 변경.
      lines[0] = `${lines[0]}X`;
      const driftedBody = lines.join("\n");
      expect(driftedBody.split("\n")[0]).not.toBe(searchMarker);
    });

    it("(c) descriptor guard 상류 차단 — run.gitSha 빈/공백이면 descriptor guard throw 로 marker·searchQuery·body 자체 미산출(chain 조립 차단)", () => {
      expect(() =>
        assembleUpdateBranch(evalOutcome(), collectOutcome(), {
          gitSha: "   ",
          dateToken: RUN_A.dateToken,
        }),
      ).toThrow();
    });

    it("(c') descriptor guard 상류 차단 대칭 — run.dateToken 빈/공백이면 descriptor guard throw(필드별 독립 분기)", () => {
      expect(() =>
        assembleUpdateBranch(evalOutcome(), collectOutcome(), {
          gitSha: RUN_A.gitSha,
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(d) searchArgv 빌더 guard 상류 차단 — commandArgs.searchQuery(= marker) 빈/공백인 commandArgs 를 searchArgv 빌더에 직접 넣으면 throw(빈 검색질의 전체 매칭 사고 차단)", () => {
      // 유효 chain 으로 commandArgs 골격을 얻은 뒤 searchQuery 만 공백으로 오염한 synthetic.
      const { commandArgs } = assembleUpdateBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const badArgs = { ...commandArgs, searchQuery: "   " };
      expect(() =>
        buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(badArgs),
      ).toThrow();
    });

    it("(e) 컴포저 파서 guard 상류 차단(update 분기 argv 미산출) — 비-JSON('{')/비배열 JSON('{}')/number 비양수 hit('[{number:0}]') stdout → 파서/빌더 throw 전파로 plan(및 edit body argv) 미산출", () => {
      expect(() =>
        assembleUpdateBranch(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          { searchStdout: "{" },
        ),
      ).toThrow();
      expect(() =>
        assembleUpdateBranch(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          { searchStdout: "{}" },
        ),
      ).toThrow();
      // marker-매칭 hit 이지만 number 비양수(0) → 빌더 issueNumber guard throw 전파.
      expect(() => {
        const base = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
          ...RUN_A,
        });
        const badHit = JSON.stringify([
          {
            number: 0,
            title: "기존 이슈",
            body: `${base.descriptor.marker}\n\n본문`,
          },
        ]);
        assembleUpdateBranch(
          evalOutcome(),
          collectOutcome(),
          { ...RUN_A },
          { searchStdout: badHit },
        );
      }).toThrow();
    });
  });

  describe("결정론 · 무공유 · no-mutation", () => {
    it("동일 (run, leg outcomes, hit stdout) 입력 chain 두 번 → searchArgv·plan.argv 가 두 번 deep-equal(byte-identical)", () => {
      const first = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const second = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(first.searchArgv).toEqual(second.searchArgv);
      expect(first.plan.argv).toEqual(second.plan.argv);
    });

    it("무공유 — 두 chain 의 searchArgv·plan.argv 배열이 referential identity 분리(not.toBe)", () => {
      const first = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      const second = assembleUpdateBranch(evalOutcome(), collectOutcome(), {
        ...RUN_A,
      });
      expect(first.searchArgv).not.toBe(second.searchArgv);
      expect(first.plan).not.toBe(second.plan);
      expect(first.plan.argv).not.toBe(second.plan.argv);
    });

    it("no-mutation — chain 호출이 commandArgs(중첩 updateArgs 포함) 및 run 을 mutate 0(호출 전후 JSON snapshot deep-equal)", () => {
      const run: RealDataResultIssueRunRef = { ...RUN_A };
      const evalLeg = evalOutcome();
      const collectLeg = collectOutcome();
      const runBefore = JSON.parse(JSON.stringify(run));
      const evalBefore = JSON.parse(JSON.stringify(evalLeg));
      const collectBefore = JSON.parse(JSON.stringify(collectLeg));

      const { commandArgs, descriptor } = assembleUpdateBranch(
        evalLeg,
        collectLeg,
        run,
      );
      const commandArgsSnapshot = JSON.parse(JSON.stringify(commandArgs));

      // 산출 후 searchArgv/plan 재조립(같은 commandArgs 재사용) — 입력 mutate 유발 여부 확인.
      buildRealDataDailyStepDualLegRunReportIssueSearchGhArgv(commandArgs);
      resolveRealDataDailyStepDualLegRunReportIssueGhCommandPlan(
        hitStdoutOf(descriptor.marker, EXISTING_ISSUE_NUMBER),
        commandArgs,
      );

      expect(run).toEqual(runBefore);
      expect(evalLeg).toEqual(evalBefore);
      expect(collectLeg).toEqual(collectBefore);
      expect(commandArgs).toEqual(commandArgsSnapshot);
    });
  });

  describe("raw / credential 누출 0(R-59 / REQ-059)", () => {
    it("searchArgv·update-branch plan.argv 의 어느 원소도 GH_TOKEN/PAT/ghp_/--token/GITHUB_TOKEN 어휘 미포함", () => {
      const { searchArgv, plan } = assembleUpdateBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const joined = [...searchArgv, ...plan.argv].join(" ");
      expect(joined).not.toContain("--token");
      expect(joined).not.toContain("GITHUB_TOKEN");
      expect(joined).not.toContain("GH_TOKEN");
      expect(joined).not.toContain("ghp_");
      expect(joined).not.toMatch(/ghp_[A-Za-z0-9]/);
    });

    it("marker(= 검색질의·edit body 선두 라인)가 안정 run-token(`${dateToken}@${gitSha}` + 고정 prefix)만 담고 raw 활동 narrative·credential 미포함", () => {
      const { descriptor, searchArgv, plan } = assembleUpdateBranch(
        evalOutcome(),
        collectOutcome(),
        { ...RUN_A },
      );
      const searchMarker = searchMarkerOf(searchArgv);
      const editHead = editBodyHeadLineOf(plan.argv);
      // 두 지점 marker 는 run-token 보유.
      expect(searchMarker).toContain(runTokenOf(RUN_A));
      expect(editHead).toContain(runTokenOf(RUN_A));
      // narrative·credential 어휘 미포함.
      expect(searchMarker).not.toContain("narrative");
      expect(editHead).not.toContain("narrative");
      expect(descriptor.marker).not.toContain("ghp_");
    });

    it("leg outcome.specPath 에 sentinel 을 넣어도 searchArgv 검색 marker·edit body 선두 marker 에 sentinel 미누출(marker 는 run-token 파생만)", () => {
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
      const { searchArgv, plan } = assembleUpdateBranch(evalLeg, collectLeg, {
        ...RUN_A,
      });
      expect(searchMarkerOf(searchArgv)).not.toContain(sentinel);
      expect(editBodyHeadLineOf(plan.argv)).not.toContain(sentinel);
    });

    it("descriptor guard throw 메시지가 raw 활동 본문·credential 미노출(필드명·유효성만)", () => {
      const sentinel = "ghp_SENTINELsecret1234";
      let message = "";
      try {
        assembleUpdateBranch(
          { leg: "eval", action: "run", passed: true, specPath: sentinel },
          { leg: "collect", action: "run", passed: true, specPath: sentinel },
          { gitSha: "   ", dateToken: RUN_A.dateToken },
        );
      } catch (err) {
        message = err instanceof Error ? err.message : String(err);
      }
      expect(message.length).toBeGreaterThan(0);
      expect(message).not.toContain(sentinel);
      expect(message).not.toContain("ghp_");
    });
  });
});
