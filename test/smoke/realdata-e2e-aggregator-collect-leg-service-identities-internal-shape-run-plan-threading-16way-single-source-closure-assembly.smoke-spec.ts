// realdata-e2e-aggregator-collect-leg-service-identities-internal-shape-run-plan-threading-16way-single-source-closure-assembly.smoke-spec.ts
// — 실 평가 e2e step④ aggregator collect-leg serviceIdentities 내부-shape 1:1 thread 합류
// 16-way single-source closure:
// 최외곽 진입 `buildRealDataE2eRunPlan(seeds, modelId, run)` → `{pipeline, run}` 가
// 산출하는 collect-leg `runPlan.pipeline.collectCallArgs[i].person.serviceIdentities`
// (실 step② `collectForPerson(person, since, assessmentId)` 의 첫 인자 `person` 안
// ServiceIdentity 배열, 각 원소 `{service, externalId}` — `CollectForPersonInput
// .serviceIdentities = Pick<ServiceIdentity,"service"|"externalId">[]`)가, 검증 source
// `seeds[i].serviceIdentities` 를 `{service, externalId}` 로 추린 배열과 **원소별·필드별
// (service+externalId 동시) byte-identical 1:1**(길이 동일·순서 보존, multi-identity Person
// 의 모든 원소 보존, isPrimary 같은 비-수집 필드 미surface)임을 16번째 축으로 합류시킨다.
//
// collect-leg serviceIdentities 내부-shape 축(Person → ServiceIdentity 배열 깊이)은
// T-0784 15-way 가 잡은 collect-leg call-args **top-level deep-equal**(축 15) 및 T-0783
// 14-way 가 잡은 `collectCallArgs[i].person.serviceIdentities[0].externalId` scalar
// (첫 identity·externalId 단일 필드 sanity)와 distinct surface 다 — 본 spec 은 그것을
// serviceIdentities **배열 전체·service 필드 동시·multi-identity 원소별·필드별 1:1 byte-
// identical** + isPrimary 미surface boundary 로 확장한다. 본 spec 은 그 1:1 축이 collect-
// leg top-level·evaluate-leg·publish-leg·resolve·post 와 같은 검증 source(seeds+modelId+
// run+activities+results)의 산물임을 한 chain 동시-호출로 closure 에 합류시킨다:
//   (축 16, 새 표면) runPlan.pipeline.collectCallArgs[i].person.serviceIdentities ==
//       seeds[i].serviceIdentities.map(si => ({service, externalId})) (원소별·필드별
//       byte-identical, 길이 동일·순서 보존, multi-identity Person 모든 원소 1:1,
//       isPrimary 미surface — Object.keys set == {service, externalId}).
//   (축 15) runPlan.pipeline.collectCallArgs == buildRealDataCollectCallArgs(seeds)
//       top-level 재유도(since==undefined·assessmentId==ASSESSMENT_ID_PLACEHOLDER·길이).
//   (축 14~15) set(searchArgv[6] split) == set(PARSE_SHAPE_KEYS) == set(Object.keys(hit))
//       set-equal + parse-shape number → resolve → argv[2] → post thread.
//   (축 13) collect/evaluate modelId 공유.
//   (축 12) searchArgv 전체-벡터 위치-정합.
//   (축 11) resolvePlan.argv 위치-정합(update/create 두 분기).
//   (축 9~10) command-args createArgs.labels 고정상수 + {create,update}Args.{title,body}
//       두 경로 == descriptor.{title,body}.
//   (축 6~8) descriptor.{title,body}·summary command-plan 경유 재유도 byte-identical.
//   (축 4~5) evaluation.inputs == buildRealDataEvaluationInputs(activities), callArgs[i]
//       .input === inputs[i].
//   (축 2~3) marker 3-축 — descriptor.marker / commandArgs.searchQuery / searchArgv[4] 동일.
//   (축 1, 종단) marker → resolve issueNumber → post run-identity(동일 runPlan.run 전파).
//
// 이 16-way 가 검증 source `(seeds, modelId, run, activities, results)` single-source 에서
// 한 chain 동시-호출로 수렴함이 search-or-update 멱등성(REQ-009)·1 Person 당 1 primary
// identity invariant 의 수집-경계 정합(REQ-024)·raw 미보유 평가 입력/결과 집계 정합
// (REQ-032)·author 귀속 key(externalId) 정합(REQ-047)·credential 미보유(REQ-059)의
// aggregator-level "aggregator 가 step② 로 넘길 Person 식별자(service+externalId 쌍, ADR-0030
// §2 author 귀속 key)가 검증 source seed 와 원소별·필드별 어긋남 0, isPrimary 같은 비-수집
// 필드는 호출-args 로 새지 않음" 의 종단 닫음이다. e2e 의 collect-leg 가 검증 source seed 의
// Person → ServiceIdentity 배열 깊이까지 단일 검증 source 에서 1:1 로 맞물리는 seam slice.
// (T-0785 박제, PLAN.md 109행 🟢 실 평가 e2e step④).
//
// 본 spec 의 존재 이유 — public CI gap 해소(collect-leg serviceIdentities 내부-shape 1:1 축 합류):
//   - aggregator-* sweep smoke 15파일(4~15-way) 중 serviceIdentities 참조는 14-way(T-0783)
//     1파일뿐이고 그 안 단언은 `collectCallArgs[i].person.serviceIdentities[0].externalId`
//     scalar(첫 identity·externalId 단일 필드 sanity)만 — serviceIdentities 배열 전체(모든
//     원소)·service 필드 동시·multi-identity Person 의 원소별·필드별 byte-identical 1:1 단언 0.
//   - collect-input/collect-call-args self-guard(buildRealDataCollectInput, T-0581 +
//     assertRealDataCollectCallArgsConsistentWithSources, T-0688) 가 serviceIdentities
//     {service, externalId} 매핑·빈-가드를 박제했으나 aggregator(buildRealDataE2eStepArgs/
//     buildRealDataE2eRunPlan) chain 진입·resolve·post 미합류(빌더/매퍼 단독 self-guard).
//   - seed-fixture spec 은 RealDataServiceIdentitySeed shape 단독 — aggregator collect-leg
//     로의 1:1 thread 미합류.
//   - 본 spec 은 그 빈 자리를 채워 aggregator 가 산출한 collect-leg collectCallArgs[i].person
//     .serviceIdentities 가 검증 source seeds[i].serviceIdentities 의 {service,externalId}
//     쌍 배열과 원소별·필드별 1:1(multi-identity Person 포함, isPrimary 미surface) byte-
//     identical 임을 collect-leg top-level·evaluate-leg·publish-leg·resolve·post 와 묶어
//     closure 에 합류시킨다.
//   - live leg(실 prisma·실 collectForPerson·실 github.com fetch·실 LLM scoring·실 gh CLI
//     실행·DB·LAN gate)는 복제하지 않고, synthetic seeds/modelId/run + activities/results
//     literal + search-stdout/exec-stdout literal 을 컴포저들에 직접 공급해 live leg 를
//     우회한다(조립 surface 만 검증). 따라서 본 spec 은:
//
//      🔥 실 collectForPerson 호출 0 — collectCallArgs[].person.serviceIdentities 는
//         collectForPerson 호출-args Person 식별자 묶음 build-time 정합만 검증(실 수집 0).
//         실 gh / fetch / LLM / DB 0.
//      🔥 실 네트워크 호출 0 — github / Ollama / gh 호출 0. fetch 0. process.env 읽기 0.
//      🔥 credential 0 / secret 0 / 비용 0 — public CI 에서 항상 green 발화(R-113).
//      🔥 새 외부 dependency 0 — 기존 helper export 재사용만(가드/helper 신설 0).
//      🔥 gating / describe.skip 배선 0 — 순수 build-time in-memory 검증만.
//
// Out of Scope (T-0785):
//   - src 변경 0(src/, prisma/, package.json, CI workflow, 환경 변수 추가 등 모두 금지). test-only.
//   - 실 collectForPerson 호출 / 실 prisma person·serviceIdentity write / 실 gh search·exec /
//     실 LLM scoreUnit 호출. in-memory 합성 collectCallArgs / search-stdout / exec-stdout 만.
//   - aggregator 15-way(search-json-fields↔parse-shape set-equal + number→resolve→post +
//     collect-leg top-level 재유도 + collect/evaluate modelId + search-argv + resolve-argv +
//     command-args + descriptor + summary + inputs + marker + resolve + post) 자체 재단언
//     (T-0784 cover). 본 task 는 collectCallArgs[i].person.serviceIdentities ↔ seeds[i]
//     .serviceIdentities {service,externalId} 원소별·필드별 1:1(multi-identity·isPrimary
//     미surface 포함)을 16번째 축으로 합류시킨 부분만(15축은 16-way 묶음 표현용 동시-성립).
//   - collect-input self-guard(buildRealDataCollectInput 매핑 로직·externalId 빈-가드) /
//     collect-call-args self-guard(assertRealDataCollectCallArgsConsistentWithSources,
//     T-0688) 자체 재단언(매퍼/빌더 spec cover). aggregator chain 진입 후 산출 person
//     .serviceIdentities ↔ seed 1:1 만(가드 내부 로직 재검증 0).
//   - seed-fixture(buildRealDataE2eSeed/RealDataServiceIdentitySeed) shape 정책 자체 재단언
//     (seed-fixture spec cover). 합성 seed 의 serviceIdentities 를 source 로 1:1 비교에만 사용.
//   - REQ-024 의 "1 Person 당 정확히 1 primary" invariant 의 DB-level 강제 검증 0 — 본 task 는
//     isPrimary 가 수집 호출-args 로 새지 않는 boundary(미surface)만 단언.
//   - 난이도별 modelId routing(R-97 deferred) 0 — 단일 modelId 동형(ADR-0048)만.
//   - RESULT_ISSUE_LABELS·PARSE_SHAPE_KEYS·ASSESSMENT_ID_PLACEHOLDER 값 정책 변경/재정의 0.
//   - DB 의존 / live-LLM·실 fetch·실 gh CLI·실 collectForPerson 0.
//   - 새 helper 모듈 신설 / 기존 helper 수정 — test-only(신규 smoke spec 1 파일).
import type { CollectForPersonInput } from "../../src/assessment-collection/collection-entry.service";
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";
import type { EvaluationResult } from "../../src/assessment-evaluation/domain/evaluation-result";
import { buildRealDataEvaluationInputs } from "../helpers/realdata-e2e-evaluation-inputs";
import { buildRealDataResultIssueCommandPlan } from "../helpers/realdata-e2e-result-issue-command-plan";
import { resolveRealDataResultIssueGhCommandPlan } from "../helpers/realdata-e2e-result-issue-gh-command-plan";
import { REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS } from "../helpers/realdata-e2e-result-issue-search-argv";
import { REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS } from "../helpers/realdata-e2e-result-issue-search-json-fields";
import { parseRealDataResultIssueSearchOutput } from "../helpers/realdata-e2e-result-issue-search-parse";
import { buildRealDataResultOutcomeStepArgs } from "../helpers/realdata-e2e-result-outcome-step-args";
import { buildRealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import type { RealDataE2eRunPlan } from "../helpers/realdata-e2e-run-plan";
import {
  ASSESSMENT_ID_PLACEHOLDER,
  buildRealDataCollectCallArgs,
} from "../helpers/realdata-e2e-seed-collect-call-args";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";
import type { RealDataSeedDescriptor } from "../helpers/realdata-e2e-seed-fixture";
import { buildRealDataE2eStepArgs } from "../helpers/realdata-e2e-step-args";

// 결정론 owner/repo — 합성 issue URL 의 path segment source(public CI 에서 항상 green
// 발화). token/secret/PAT/--auth 어휘 미포함.
const OWNER = "myungjoo";
const REPO = "assessment-agent";

// 결정론 modelId fixture — runPlan 의 pipeline 측 입력. collect-leg modelId(runPlan.pipeline
// .modelId) AND evaluation callArgs[].options.modelId 두 leg 가 공유하는 단일 source.
const MODEL_ID =
  "cfg-realdata-e2e-aggregator-collect-leg-service-identities-run-plan-threading-smoke";

const INSTANCE_KEY = "github.com";

// 고정 결정론 분류 라벨 — command-args.ts RESULT_ISSUE_LABELS = ["realdata-e2e","result"]
// 가 박제한 현재 값. create 분기 argv 의 `--label` flag-pair 로 전개될 expected.
const EXPECTED_RESULT_ISSUE_LABELS = ["realdata-e2e", "result"];

// CollectForPersonInput.serviceIdentities 의 정규 키 집합({service, externalId}) — 본 task 의
// 새 표면(축 16) 의 isPrimary 미surface boundary expected. CollectForPersonInput(collection-
// entry.service.ts 25행) = Pick<ServiceIdentity,"service"|"externalId">[] 시그니처로 확인.
const COLLECT_IDENTITY_KEYS = ["service", "externalId"];

// search-argv helper 가 산출하는 canonical 9-원소 전체-벡터(marker 위치만 입력 종속). 16-way
// 묶음 표현용 동시-성립 항(축 12). marker(index 4)는 chain 시점에 commandArgs.searchQuery 로 채움.
function expectedSearchArgv(marker: string): string[] {
  return [
    "search",
    "issues",
    "--match",
    "body",
    marker,
    "--json",
    "number,title,body",
    "--limit",
    "30",
  ];
}

// spec 로컬 set-equal 비교 — 양방향 포함으로 비교(크기 동일 AND 한쪽 원소가 모두 다른 쪽에
// 존재 — 순서·중복 무관 set-equality).
function setOf(tokens: Iterable<string>): Set<string> {
  return new Set<string>(tokens);
}

function isSetEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const token of a) {
    if (!b.has(token)) {
      return false;
    }
  }
  return true;
}

// aggregator 산출 searchArgv[6](`--json` 요청-필드 토큰)을 spec 로컬에서 콤마 split·trim 한 집합.
function splitJsonFieldsToken(token: string): Set<string> {
  return setOf(token.split(",").map((field) => field.trim()));
}

// 본 task 의 핵심 새 표면(축 16) projection helper — seed 의 serviceIdentities 를 collect-input
// helper(realdata-e2e-seed-collect-input.ts 59~69행)의 매핑 규칙({service, externalId} 만 추림,
// isPrimary 제외)과 동형으로 spec 로컬에서 재유도. collectCallArgs[i].person.serviceIdentities
// 와 byte-identical deep-equal 의 expected.
function projectSeedIdentities(
  seed: RealDataSeedDescriptor,
): CollectForPersonInput["serviceIdentities"] {
  return seed.serviceIdentities.map((si) => ({
    service: si.service,
    externalId: si.externalId,
  }));
}

// 합성 run-token — descriptor 컴포저 내부 runToken(run) = `${dateToken}@${gitSha}` 규칙으로
// test 측에서 재유도한 expected 공유 substring.
function expectedToken(run: RealDataE2eRunPlan["run"]): string {
  return `${run.dateToken}@${run.gitSha}`;
}

// 기본 seeds — fixed 2-Person(myungjoo/leemgs) descriptor 배열에 더해 multi-identity Person
// 1개(serviceIdentities 2+)를 합성해 추가한 single-source. 본 task 의 새 표면(축 16, multi-
// identity 원소별 1:1)을 cover 하려면 2+ identity Person 이 1개 이상 필요(Acceptance 명시).
// seed-fixture 시그니처(person/serviceIdentities) 그대로 literal 합성. 매 호출 새 객체 트리.
function defaultSeeds(): RealDataSeedDescriptor[] {
  return [
    ...buildRealDataE2eSeed(),
    {
      person: {
        fullName: "multi-identity-person",
        email: "multi-identity-person@e2e.realdata.test",
        active: true,
      },
      // multi-identity Person — serviceIdentities 2개(첫 원소만이 아닌 모든 원소 1:1 검증용).
      // service 는 "github.com" literal 만 산출(seed-fixture RealDataServiceIdentitySeed
      // .service: "github.com" 시그니처 정합), externalId 는 distinct username.
      serviceIdentities: [
        {
          service: "github.com" as const,
          externalId: "multi-primary",
          isPrimary: true,
        },
        {
          service: "github.com" as const,
          externalId: "multi-secondary",
          isPrimary: false,
        },
      ],
    },
  ];
}

// 변별용 seeds 합성 헬퍼 — defaultSeeds 와 원소 수/serviceIdentities 가 다른 seeds 로
// collectCallArgs serviceIdentities 1:1 매핑 변별을 박제(seeds 종속 변별 chain). 각 username
// 당 single-identity Person 합성.
function customSeeds(usernames: string[]): RealDataSeedDescriptor[] {
  return usernames.map((username) => ({
    person: {
      fullName: username,
      email: `${username}@e2e.realdata.test`,
      active: true,
    },
    serviceIdentities: [
      { service: "github.com" as const, externalId: username, isPrimary: true },
    ],
  }));
}

// synthetic runPlan 합성 — buildRealDataE2eRunPlan(seeds, modelId, run) 호출로 검증된 단일
// `{pipeline, run}` 을 만든다(modelId·run guard 통과 비공백 토큰). 매 호출 새 객체 트리.
function buildRunPlan(
  seeds: RealDataSeedDescriptor[] = defaultSeeds(),
  modelId = MODEL_ID,
  gitSha = "abc1234",
  dateToken = "2026-06-29",
): RealDataE2eRunPlan {
  return buildRealDataE2eRunPlan(seeds, modelId, { gitSha, dateToken });
}

// synthetic GithubActivity 1 건 — aggregator 의 evaluation leg 입력. callArgs 가 1+ 원소를
// 갖도록 보장(collect-leg modelId thread 도착지).
function syntheticActivity(
  author: string,
  externalId = "realdata-e2e-aggregator-collect-leg-service-identities-c1",
  kind: GithubActivity["kind"] = "commit",
): GithubActivity {
  return {
    sourceType: "github",
    externalId,
    instanceKey: INSTANCE_KEY,
    author,
    timestamp: "2026-06-01T12:00:00Z",
    metadata: { titleLength: 42 },
    repoRef: `${author}/sample-repo`,
    kind,
  };
}

// 유효 activities fixture — aggregator 의 evaluation leg 입력(Activity[]). seed 의 첫
// username 을 author 로 매칭. 다양한 kind 분포로 inputs 재유도 검증.
function defaultActivities(
  seeds: RealDataSeedDescriptor[] = defaultSeeds(),
): GithubActivity[] {
  const firstUsername = seeds[0].serviceIdentities[0].externalId;
  return [
    syntheticActivity(
      firstUsername,
      "aggregator-collect-leg-service-identities-c1",
      "commit",
    ),
    syntheticActivity(
      firstUsername,
      "aggregator-collect-leg-service-identities-p1",
      "pr",
    ),
    syntheticActivity(
      firstUsername,
      "aggregator-collect-leg-service-identities-i1",
      "issue",
    ),
  ];
}

// synthetic EvaluationResult 1 건 — aggregator 의 publish leg 입력(summary 집계 + body 렌더
// + command-args title/body source).
function syntheticResult(
  unitId: string,
  difficulty: EvaluationResult["difficulty"],
  contribution: EvaluationResult["contribution"],
  volume: number,
): EvaluationResult {
  return {
    unitId,
    narrative:
      "synthetic evaluation narrative — aggregator collect-leg serviceIdentities(collectCallArgs[i].person.serviceIdentities == seeds[i].serviceIdentities.map(→{service,externalId}) 원소별·필드별 1:1·multi-identity·isPrimary 미surface)+collect-leg top-level 재유도+search-json-fields↔parse-shape set-equal+number→resolve→post thread+collect/evaluate modelId+search-argv+resolve-argv+command-args-{title,body,labels}+descriptor-{title,body}+results-summary+evaluation-inputs+marker run-plan-threading 16-way closure smoke fixture",
    difficulty,
    contribution,
    volume,
  };
}

// 유효 results fixture(분포 X) — aggregator 의 publish leg summary 집계 + body 렌더 source.
function defaultResults(): EvaluationResult[] {
  return [
    syntheticResult("github:github.com:c1", "easy", "low", 3),
    syntheticResult("github:github.com:c2", "medium", "high", 5),
    syntheticResult("github:github.com:c3", "hard", "medium", 2),
  ];
}

// marker(=searchQuery, = searchArgv[4])를 body 에 포함한 hit 1+건 search stdout 합성 헬퍼
// — 동일 run 이슈가 이미 존재하는 경우(resolve update 분기 유발). 정규 {number,title,body} 만.
function multiHitStdout(marker: string, numbers: number[]): string {
  return JSON.stringify(
    numbers.map((n, i) => ({
      number: n,
      title: `결과 이슈(#${i})`,
      body: `본문 ${i}\n${marker}\n끝`,
    })),
  );
}

// synthetic gh issue edit stdout 합성 헬퍼 — `gh issue edit <N>` 의 stdout 은
// https://github.com/<owner>/<repo>/issues/<N> URL 한 줄을 포함.
function execStdout(n: number, noisePrefix = ""): string {
  return `${noisePrefix}https://github.com/${OWNER}/${REPO}/issues/${n}\n`;
}

// 최외곽 진입 buildRealDataE2eRunPlan(seeds, modelId, run) → aggregator buildRealDataE2eStepArgs
// (runPlan, activities, results) → searchStdout(N 담은 hit JSON 배열) → parseRealDataResultIssue
// SearchOutput(searchStdout) → resolve(searchStdout + stepArgs.publish.commandArgs) → post
// (buildRealDataResultOutcomeStepArgs(runPlan, execStdout))를 single-source(동일 seeds + modelId
// + run + activities + results + N)로 묶어 한 chain 으로 호출하는 헬퍼. 핵심 새 표면(축 16) =
// runPlan.pipeline.collectCallArgs[i].person.serviceIdentities ↔ seeds[i].serviceIdentities 1:1.
function runChain(
  hitsNumbers: number[],
  seeds: RealDataSeedDescriptor[] = defaultSeeds(),
  runPlan: RealDataE2eRunPlan = buildRunPlan(seeds),
  activities: GithubActivity[] = defaultActivities(seeds),
  results: EvaluationResult[] = defaultResults(),
  noisePrefix = "",
): {
  resolvedN: number;
  seeds: RealDataSeedDescriptor[];
  runPlan: RealDataE2eRunPlan;
  activities: GithubActivity[];
  results: EvaluationResult[];
  stepArgs: ReturnType<typeof buildRealDataE2eStepArgs>;
  searchStdout: string;
  parsedHits: ReturnType<typeof parseRealDataResultIssueSearchOutput>;
  resolvePlan: ReturnType<typeof resolveRealDataResultIssueGhCommandPlan>;
  outcomeReport: ReturnType<typeof buildRealDataResultOutcomeStepArgs>;
} {
  // stage 1(pre boundary, aggregator dual-leg threaded) — stepArgs: {evaluation, publish}.
  // collect-leg 는 runPlan.pipeline 으로 옆을 흐른다(aggregator 가 surface 안 함).
  const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);

  // stage 2(search-parse) — searchStdout(marker hit 1+) → parsedHits({number,title,body}만).
  const searchStdout = multiHitStdout(
    stepArgs.publish.commandArgs.searchQuery,
    hitsNumbers,
  );
  const parsedHits = parseRealDataResultIssueSearchOutput(searchStdout);

  // stage 3(resolve) — searchStdout + stepArgs.publish.commandArgs → {action(update), argv}.
  const resolvePlan = resolveRealDataResultIssueGhCommandPlan(
    searchStdout,
    stepArgs.publish.commandArgs,
  );
  if (resolvePlan.action.action !== "update") {
    throw new Error("update action 기대 — 후보 1+건 입력");
  }
  const resolvedN = resolvePlan.action.issueNumber;

  // stage 4(post boundary, run-plan-threaded) — 동일 runPlan 한 객체를 post 컴포저에 직접 공급.
  const outcomeReport = buildRealDataResultOutcomeStepArgs(
    runPlan,
    execStdout(resolvedN, noisePrefix),
  );

  return {
    resolvedN,
    seeds,
    runPlan,
    activities,
    results,
    stepArgs,
    searchStdout,
    parsedHits,
    resolvePlan,
    outcomeReport,
  };
}

describe("Smoke(non-gated): 실 평가 e2e step④ aggregator collect-leg serviceIdentities 내부-shape 1:1 thread 합류 16-way single-source closure buildRealDataE2eRunPlan → runPlan.pipeline.collectCallArgs[i].person.serviceIdentities == seeds[i].serviceIdentities.map(→{service,externalId})(원소별·필드별 byte-identical 1:1·길이 동일·순서 보존·multi-identity Person 모든 원소·isPrimary 미surface) + collect-leg top-level 재유도 + search-json-fields↔parse-shape set-equal + number→resolve→post + collect/evaluate modelId 공유 + search-argv 전체-벡터 + resolve-argv(update/create) + command-args labels 고정상수 + {title,body} 두 경로(=descriptor.{title,body}) + descriptor·summary 재유도 + evaluation inputs/callArgs 페어링 + marker 3-축 + resolve issueNumber + post run-identity ↔ 동일 (seeds, modelId, run, activities, results) 한 chain 동시-호출 16축 동시 수렴 live-collect/live-gh/live-LLM 0 검증", () => {
  describe("happy path — aggregator 16-way chain 합성(collectCallArgs 비어있지 않음·길이==seeds.length·각 person.serviceIdentities 비어있지 않음 + 산출물 정상)", () => {
    it("(a) 유효 seeds(multi-identity 포함) + modelId + run + activities + results + searchStdout + execStdout → runPlan.pipeline.collectCallArgs(비어있지 않음·길이==seeds.length, 각 person.serviceIdentities 비어있지 않은 배열) / stepArgs / parsedHits(비어있지 않음) / resolvePlan(update) / outcomeReport(5필드) 모두 정상", () => {
      const seeds = defaultSeeds();
      const { runPlan, stepArgs, parsedHits, resolvePlan, outcomeReport } =
        runChain([7, 13], seeds);

      // stage 0 — collect-leg(runPlan.pipeline.collectCallArgs) 정상 + 각 person 정상.
      expect(Array.isArray(runPlan.pipeline.collectCallArgs)).toBe(true);
      expect(runPlan.pipeline.collectCallArgs).toHaveLength(seeds.length);
      expect(runPlan.pipeline.collectCallArgs.length).toBeGreaterThan(0);
      runPlan.pipeline.collectCallArgs.forEach((args) => {
        expect(Array.isArray(args.person.serviceIdentities)).toBe(true);
        expect(args.person.serviceIdentities.length).toBeGreaterThan(0);
      });

      // stage 1 — stepArgs.publish 정상(searchArgv 길이 9).
      expect(Array.isArray(stepArgs.publish.searchArgv)).toBe(true);
      expect(stepArgs.publish.searchArgv).toHaveLength(9);

      // stage 2 — parsedHits 비어있지 않은 배열.
      expect(parsedHits.length).toBeGreaterThan(0);

      // stage 3 — resolve plan(update).
      expect(resolvePlan.action.action).toBe("update");

      // stage 4 — outcome step-args report(5필드).
      expect(outcomeReport.issueNumber).toBeGreaterThan(0);
      expect(outcomeReport.url.length).toBeGreaterThan(0);
      expect(outcomeReport.gitSha).toBe("abc1234");
      expect(outcomeReport.dateToken).toBe("2026-06-29");
      expect(outcomeReport.summaryLine.length).toBeGreaterThan(0);
    });
  });

  describe("collect-leg serviceIdentities 내부-shape 원소별·필드별 1:1 수렴(branch — 핵심 불변식 1, 본 task 의 새 표면 — 축 16)", () => {
    it("(b) 모든 i 에 대해 runPlan.pipeline.collectCallArgs[i].person.serviceIdentities deep-equal(toEqual) seeds[i].serviceIdentities.map(→{service,externalId}), 길이 == seeds[i].serviceIdentities.length(toHaveLength), 각 원소 service+externalId 둘 다 동일(toBe, forEach)·순서 보존(인덱스 정합)", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const collectCallArgs = runPlan.pipeline.collectCallArgs;

      expect(collectCallArgs).toHaveLength(seeds.length);
      collectCallArgs.forEach((args, i) => {
        const identities = args.person.serviceIdentities;
        // 핵심 — 원소별·필드별 byte-identical 1:1(collect-input 매핑 규칙과 동형 projection).
        expect(identities).toEqual(projectSeedIdentities(seeds[i]));
        // 길이 == seed 의 serviceIdentities 길이.
        expect(identities).toHaveLength(seeds[i].serviceIdentities.length);
        // 각 원소 service+externalId 둘 다 동일·순서 보존(인덱스 정합).
        identities.forEach((identity, k) => {
          expect(identity.service).toBe(seeds[i].serviceIdentities[k].service);
          expect(identity.externalId).toBe(
            seeds[i].serviceIdentities[k].externalId,
          );
        });
      });
    });
  });

  describe("multi-identity Person 의 모든 원소 1:1 수렴(branch — 핵심 불변식 2, [0] scalar(T-0783)과 distinct)", () => {
    it("(c) serviceIdentities 2+ 보유 Person seed → collectCallArgs[i].person.serviceIdentities 의 모든 원소(첫 원소만이 아님)가 1:1 보존 — 두 번째 이후 원소의 service+externalId 도 seed 와 동일·순서 동일", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);

      // multi-identity Person index 탐색(serviceIdentities 2+).
      const multiIndex = seeds.findIndex(
        (seed) => seed.serviceIdentities.length >= 2,
      );
      expect(multiIndex).toBeGreaterThanOrEqual(0);

      const seedIdentities = seeds[multiIndex].serviceIdentities;
      const collectIdentities =
        runPlan.pipeline.collectCallArgs[multiIndex].person.serviceIdentities;

      // 모든 원소 1:1(첫 원소만이 아님).
      expect(collectIdentities).toHaveLength(seedIdentities.length);
      expect(collectIdentities.length).toBeGreaterThanOrEqual(2);
      expect(collectIdentities).toEqual(
        projectSeedIdentities(seeds[multiIndex]),
      );
      // 두 번째 이후 원소(인덱스 1+)도 명시 — service+externalId 동일·순서 동일.
      for (let k = 1; k < seedIdentities.length; k++) {
        expect(collectIdentities[k].service).toBe(seedIdentities[k].service);
        expect(collectIdentities[k].externalId).toBe(
          seedIdentities[k].externalId,
        );
      }
    });
  });

  describe("isPrimary 비-수집 필드 미surface 수렴(branch — boundary, REQ-024 경계)", () => {
    it("(d) seeds[i].serviceIdentities[k].isPrimary(true) 가 collectCallArgs[i].person.serviceIdentities[k] 에 key 부재 — Object.keys set 이 {service,externalId} 와 set-equal, isPrimary/id/personId/createdAt/updatedAt 등 DB-only 필드도 미보유", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const collectKeySet = setOf(COLLECT_IDENTITY_KEYS);

      runPlan.pipeline.collectCallArgs.forEach((args, i) => {
        args.person.serviceIdentities.forEach((identity, k) => {
          const keySet = setOf(Object.keys(identity));
          // {service, externalId} 와 set-equal — isPrimary 미포함.
          expect(isSetEqual(keySet, collectKeySet)).toBe(true);
          expect(keySet.has("isPrimary")).toBe(false);
          // DB-only 필드도 미보유.
          expect(keySet.has("id")).toBe(false);
          expect(keySet.has("personId")).toBe(false);
          expect(keySet.has("createdAt")).toBe(false);
          expect(keySet.has("updatedAt")).toBe(false);
          // seed 측은 isPrimary 를 보유(boundary 대조 — 수집 호출-args 로 새지 않음).
          expect("isPrimary" in seeds[i].serviceIdentities[k]).toBe(true);
        });
      });
    });
  });

  describe("serviceIdentities 축 변별성 — seeds 종속·modelId/검색결과 비종속(branch)", () => {
    it("(e) 세 chain — (a)다른 seeds·(b)다른 modelId·(c)다른 searchStdout → collectCallArgs[i].person.serviceIdentities 가 (a)에서만 달라지고(seeds 1:1 반영), (b)·(c)에서는 두 chain byte-identical(modelId·검색결과 비종속)", () => {
      const baseSeeds = defaultSeeds();

      // (a) 다른 seeds — serviceIdentities 다름(다른 username·다른 identity 수).
      const altSeeds = customSeeds(["alice", "bob"]);
      const chainSeedsBase = buildRunPlan(baseSeeds);
      const chainSeedsAlt = buildRunPlan(altSeeds);
      expect(
        chainSeedsAlt.pipeline.collectCallArgs.map(
          (a) => a.person.serviceIdentities,
        ),
      ).not.toEqual(
        chainSeedsBase.pipeline.collectCallArgs.map(
          (a) => a.person.serviceIdentities,
        ),
      );

      // (b) 다른 modelId, 같은 seeds — serviceIdentities byte-identical(modelId 비종속).
      const chainModelA = buildRunPlan(baseSeeds, "model-alpha");
      const chainModelB = buildRunPlan(baseSeeds, "model-beta");
      chainModelA.pipeline.collectCallArgs.forEach((args, i) => {
        expect(args.person.serviceIdentities).toEqual(
          chainModelB.pipeline.collectCallArgs[i].person.serviceIdentities,
        );
      });

      // (c) 다른 searchStdout, 같은 seeds — serviceIdentities byte-identical(검색결과 비종속).
      const chainC1 = runChain([7], baseSeeds, buildRunPlan(baseSeeds));
      const chainC2 = runChain([3, 9, 15], baseSeeds, buildRunPlan(baseSeeds));
      chainC1.runPlan.pipeline.collectCallArgs.forEach((args, i) => {
        expect(args.person.serviceIdentities).toEqual(
          chainC2.runPlan.pipeline.collectCallArgs[i].person.serviceIdentities,
        );
      });
    });
  });

  describe("collect-leg call-args top-level 재유도 수렴(branch — 15-way 묶음 항 — 축 15)", () => {
    it("(f) runPlan.pipeline.collectCallArgs deep-equal(toEqual) buildRealDataCollectCallArgs(seeds), 원소별 since===undefined(toBeUndefined)·assessmentId===ASSESSMENT_ID_PLACEHOLDER(import const, toBe)·collectCallArgs.length === seeds.length", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const collectCallArgs = runPlan.pipeline.collectCallArgs;

      expect(collectCallArgs).toEqual(buildRealDataCollectCallArgs(seeds));
      expect(collectCallArgs).toHaveLength(seeds.length);
      collectCallArgs.forEach((args) => {
        expect(args.since).toBeUndefined();
        expect(args.assessmentId).toBe(ASSESSMENT_ID_PLACEHOLDER);
      });
    });
  });

  describe("search-json-fields↔parse-shape set-equal + number→resolve→post thread 수렴(branch — 묶음 항 — 축 14~15)", () => {
    it("(g) set(stepArgs.publish.searchArgv[6] split) == set(REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS) == set(Object.keys(parsedHits[0])) set-equal AND parsedHits[0].number(==N) === resolvePlan.action.update.issueNumber === Number(resolvePlan.argv[2]) === outcomeReport.issueNumber", () => {
      const N = 7;
      const { stepArgs, parsedHits, resolvePlan, outcomeReport } = runChain([
        N,
        13,
      ]);
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const splitSet = splitJsonFieldsToken(stepArgs.publish.searchArgv[6]);
      const parseShapeSet = setOf(
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );
      const hitKeySet = setOf(Object.keys(parsedHits[0]));

      expect(isSetEqual(splitSet, parseShapeSet)).toBe(true);
      expect(isSetEqual(parseShapeSet, hitKeySet)).toBe(true);
      expect(isSetEqual(splitSet, hitKeySet)).toBe(true);

      expect(parsedHits[0].number).toBe(N);
      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(resolvePlan.argv[2]).toBe(String(N));
      expect(outcomeReport.issueNumber).toBe(N);
    });
  });

  describe("collect/evaluate modelId 공유 수렴(branch — 묶음 항 — 축 13)", () => {
    it("(h) runPlan.pipeline.modelId === modelId(toBe) AND 모든 stepArgs.evaluation.callArgs[i].options.modelId === runPlan.pipeline.modelId(toBe, forEach)", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const { stepArgs } = runChain([7, 13], seeds, runPlan);

      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
      expect(stepArgs.evaluation.callArgs.length).toBeGreaterThan(0);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
        expect(c.options.modelId).toBe(MODEL_ID);
      });
    });
  });

  describe("search-argv 전체-벡터 위치-정합 수렴(branch — 묶음 항 — 축 12)", () => {
    it('(i) stepArgs.publish.searchArgv deep-equal(toEqual) ["search","issues","--match","body",commandArgs.searchQuery,"--json","number,title,body","--limit","30"], searchArgv[4]===commandArgs.searchQuery·searchArgv[6]===REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS(toBe)', () => {
      const { stepArgs } = runChain([7, 13]);
      const searchArgv = stepArgs.publish.searchArgv;
      const searchQuery = stepArgs.publish.commandArgs.searchQuery;

      expect(searchArgv).toEqual(expectedSearchArgv(searchQuery));
      expect(searchArgv[4]).toBe(searchQuery);
      expect(searchArgv[6]).toBe(REAL_DATA_RESULT_ISSUE_SEARCH_JSON_FIELDS);
    });
  });

  describe("resolve-argv update/create 위치-정합 수렴(branch — 묶음 항 — 축 11)", () => {
    it('(j) search hit N → resolvePlan.argv deep-equal ["issue","edit",String(N),"--title",updateArgs.title,"--body",updateArgs.body], search hit 0("[]") → ["issue","create","--title",createArgs.title,"--body",createArgs.body,"--label","realdata-e2e","--label","result"]', () => {
      const N = 7;
      const { stepArgs, resolvePlan } = runChain([N, 13]);
      const updateArgs = stepArgs.publish.commandArgs.updateArgs;
      const createArgs = stepArgs.publish.commandArgs.createArgs;

      expect(resolvePlan.argv).toEqual([
        "issue",
        "edit",
        String(N),
        "--title",
        updateArgs.title,
        "--body",
        updateArgs.body,
      ]);

      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );
      expect(resolveCreate.action.action).toBe("create");
      expect(resolveCreate.argv).toEqual([
        "issue",
        "create",
        "--title",
        createArgs.title,
        "--body",
        createArgs.body,
        "--label",
        "realdata-e2e",
        "--label",
        "result",
      ]);
    });
  });

  describe("publish-leg command-args-labels + title/body 두 경로 + descriptor·summary 재유도 수렴(branch — 묶음 항 — 축 6~10)", () => {
    it("(k) createArgs.labels deep-equal ['realdata-e2e','result'], createArgs/updateArgs.{title,body} 둘 다 === descriptor.{title,body}, descriptor.{title,body}·report.summary === buildRealDataResultIssueCommandPlan(results, runPlan.run).report.{descriptor.{title,body},summary} byte-identical", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const results = defaultResults();
      const { stepArgs } = runChain(
        [7, 13],
        seeds,
        runPlan,
        defaultActivities(seeds),
        results,
      );
      const descriptorTitle = stepArgs.publish.report.descriptor.title;
      const descriptorBody = stepArgs.publish.report.descriptor.body;

      expect(stepArgs.publish.commandArgs.createArgs.labels).toEqual(
        EXPECTED_RESULT_ISSUE_LABELS,
      );
      expect(stepArgs.publish.commandArgs.createArgs.title).toBe(
        descriptorTitle,
      );
      expect(stepArgs.publish.commandArgs.updateArgs.title).toBe(
        descriptorTitle,
      );
      expect(stepArgs.publish.commandArgs.createArgs.body).toBe(descriptorBody);
      expect(stepArgs.publish.commandArgs.updateArgs.body).toBe(descriptorBody);

      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      expect(stepArgs.publish.report.descriptor.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.report.descriptor.body).toBe(
        cmdPlan.report.descriptor.body,
      );
      expect(stepArgs.publish.report.summary).toEqual(cmdPlan.report.summary);
    });
  });

  describe("evaluation-leg inputs 재유도 + callArgs.input 페어링(branch — 묶음 항 — 축 4~5)", () => {
    it("(l) evaluation.inputs deep-equal buildRealDataEvaluationInputs(activities), 모든 callArgs[i].input === inputs[i](toBe, forEach)·길이 일치", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities(seeds);
      const { stepArgs } = runChain([7, 13], seeds, runPlan, activities);

      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      expect(stepArgs.evaluation.inputs).toHaveLength(activities.length);
      expect(stepArgs.evaluation.callArgs.length).toBe(
        stepArgs.evaluation.inputs.length,
      );
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });
    });
  });

  describe("marker 3-축 + resolve issueNumber + post run-identity 수렴(branch — 묶음 항 — 축 1~3)", () => {
    it("(m) descriptor.marker === commandArgs.searchQuery === searchArgv[4](세 지점 byte-identical) AND hit N → resolvePlan.action.update.issueNumber → outcomeReport.issueNumber 동일 N AND descriptor.marker 에 `${dateToken}@${gitSha}` 포함 AND outcomeReport.{gitSha,dateToken} === runPlan.run", () => {
      const N = 7;
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const { stepArgs, resolvePlan, outcomeReport } = runChain(
        [N, 13],
        seeds,
        runPlan,
      );
      if (resolvePlan.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const marker = stepArgs.publish.report.descriptor.marker;

      expect(stepArgs.publish.commandArgs.searchQuery).toBe(marker);
      expect(stepArgs.publish.searchArgv[4]).toBe(marker);
      expect(resolvePlan.action.issueNumber).toBe(N);
      expect(outcomeReport.issueNumber).toBe(N);
      expect(marker).toContain(expectedToken(runPlan.run));
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
    });
  });

  describe("16-way 단일-source 묶음 단언(branch — closure 종단, 본 task 의 종단 박제)", () => {
    it("(n) collectCallArgs[i].person.serviceIdentities == seeds[i].serviceIdentities.map(→{service,externalId})(원소별·필드별 1:1·multi-identity·isPrimary 미surface), collectCallArgs == buildRealDataCollectCallArgs(seeds), set(searchArgv[6] split)==set(PARSE_SHAPE_KEYS)==set(Object.keys(parsedHits[0])) 그 number==N==resolve issueNumber==argv[2]==post issueNumber, modelId==modelId==callArgs[].options.modelId, searchArgv==canonical, update argv==['issue','edit',String(N),...updateArgs], argv title/body==descriptor.{title,body}==command-plan, labels==createArgs.labels==['realdata-e2e','result'], summary==command-plan, inputs==buildRealDataEvaluationInputs(activities), callArgs[].input===inputs[i], marker run token==post {gitSha,dateToken} 가 검증 source single-source 에서 16-way 동시 성립", () => {
      const N = 7;
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities(seeds);
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;
      const token = expectedToken(runPlan.run);
      const cmdPlan = buildRealDataResultIssueCommandPlan(results, runPlan.run);
      const createArgs = stepArgs.publish.commandArgs.createArgs;
      const updateArgs = stepArgs.publish.commandArgs.updateArgs;
      const searchQuery = stepArgs.publish.commandArgs.searchQuery;

      const searchStdout = multiHitStdout(marker, [N, 13]);
      const parsedHits = parseRealDataResultIssueSearchOutput(searchStdout);
      const resolveUpdate = resolveRealDataResultIssueGhCommandPlan(
        searchStdout,
        stepArgs.publish.commandArgs,
      );
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );
      if (resolveUpdate.action.action !== "update") {
        throw new Error("update action 기대");
      }
      const outcomeReport = buildRealDataResultOutcomeStepArgs(
        runPlan,
        execStdout(resolveUpdate.action.issueNumber),
      );
      const collectKeySet = setOf(COLLECT_IDENTITY_KEYS);

      // axis 16(새 표면) — collect-leg serviceIdentities 내부-shape 1:1 + isPrimary 미surface.
      runPlan.pipeline.collectCallArgs.forEach((args, i) => {
        expect(args.person.serviceIdentities).toEqual(
          projectSeedIdentities(seeds[i]),
        );
        expect(args.person.serviceIdentities).toHaveLength(
          seeds[i].serviceIdentities.length,
        );
        args.person.serviceIdentities.forEach((identity, k) => {
          expect(identity.service).toBe(seeds[i].serviceIdentities[k].service);
          expect(identity.externalId).toBe(
            seeds[i].serviceIdentities[k].externalId,
          );
          expect(isSetEqual(setOf(Object.keys(identity)), collectKeySet)).toBe(
            true,
          );
        });
      });

      // axis 15 — collect-leg top-level 재유도.
      expect(runPlan.pipeline.collectCallArgs).toEqual(
        buildRealDataCollectCallArgs(seeds),
      );

      // axis 14~15 — set-equal 3-way + number thread.
      const splitSet = splitJsonFieldsToken(stepArgs.publish.searchArgv[6]);
      const parseShapeSet = setOf(
        REAL_DATA_RESULT_ISSUE_SEARCH_PARSE_SHAPE_KEYS,
      );
      const hitKeySet = setOf(Object.keys(parsedHits[0]));
      expect(isSetEqual(splitSet, parseShapeSet)).toBe(true);
      expect(isSetEqual(parseShapeSet, hitKeySet)).toBe(true);
      expect(parsedHits[0].number).toBe(N);
      expect(resolveUpdate.action.issueNumber).toBe(N);
      expect(resolveUpdate.argv[2]).toBe(String(N));
      expect(outcomeReport.issueNumber).toBe(N);

      // axis 13 — collect/evaluate modelId 공유.
      expect(runPlan.pipeline.modelId).toBe(MODEL_ID);
      stepArgs.evaluation.callArgs.forEach((c) => {
        expect(c.options.modelId).toBe(runPlan.pipeline.modelId);
      });

      // axis 12 — searchArgv 전체-벡터 위치-정합.
      expect(stepArgs.publish.searchArgv).toEqual(
        expectedSearchArgv(searchQuery),
      );
      expect(stepArgs.publish.searchArgv[4]).toBe(marker);
      // axis 11 — update/create 두 분기 argv 위치-정합.
      expect(resolveUpdate.argv).toEqual([
        "issue",
        "edit",
        String(N),
        "--title",
        updateArgs.title,
        "--body",
        updateArgs.body,
      ]);
      expect(resolveCreate.argv).toEqual([
        "issue",
        "create",
        "--title",
        createArgs.title,
        "--body",
        createArgs.body,
        "--label",
        "realdata-e2e",
        "--label",
        "result",
      ]);
      // axis 9~10 — argv title/body == descriptor.{title,body} == command-plan, labels 고정상수.
      expect(resolveUpdate.argv[4]).toBe(
        stepArgs.publish.report.descriptor.title,
      );
      expect(resolveUpdate.argv[6]).toBe(
        stepArgs.publish.report.descriptor.body,
      );
      expect(resolveCreate.argv[3]).toBe(cmdPlan.report.descriptor.title);
      expect(resolveCreate.argv[5]).toBe(cmdPlan.report.descriptor.body);
      expect(createArgs.labels).toEqual(EXPECTED_RESULT_ISSUE_LABELS);
      expect([resolveCreate.argv[7], resolveCreate.argv[9]]).toEqual(
        createArgs.labels,
      );
      // axis 6~8 — descriptor.{title,body}·summary command-plan 재유도.
      expect(stepArgs.publish.report.descriptor.title).toBe(
        cmdPlan.report.descriptor.title,
      );
      expect(stepArgs.publish.report.descriptor.body).toBe(
        cmdPlan.report.descriptor.body,
      );
      expect(stepArgs.publish.report.summary).toEqual(cmdPlan.report.summary);
      // axis 4~5 — evaluation.inputs deep-equal + callArgs 페어링.
      expect(stepArgs.evaluation.inputs).toEqual(
        buildRealDataEvaluationInputs(activities),
      );
      stepArgs.evaluation.callArgs.forEach((c, i) => {
        expect(c.input).toBe(stepArgs.evaluation.inputs[i]);
      });
      // axis 2~3 — marker 3-축.
      expect(stepArgs.publish.commandArgs.searchQuery).toBe(marker);
      expect(stepArgs.publish.searchArgv[4]).toBe(marker);
      // axis 1 — run token 전파.
      expect(marker).toContain(token);
      expect(outcomeReport.gitSha).toBe(runPlan.run.gitSha);
      expect(outcomeReport.dateToken).toBe(runPlan.run.dateToken);
      expect(`${runPlan.run.dateToken}@${runPlan.run.gitSha}`).toBe(token);
    });
  });

  describe("create/update 두 분기 격리 — serviceIdentities 는 분기 비종속(branch)", () => {
    it("(o) 동일 seeds·modelId·run·activities·results, searchStdout 만 (hit 1+ vs hit 0)으로 달리해 → 한쪽 update·다른 쪽 create. collectCallArgs[i].person.serviceIdentities 는 두 chain byte-identical(검색 결과가 collect-leg 를 바꾸지 0 — collect-leg 는 검색 실행 전 합성)", () => {
      const seeds = defaultSeeds();
      const runPlan = buildRunPlan(seeds);
      const activities = defaultActivities(seeds);
      const results = defaultResults();
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      const marker = stepArgs.publish.report.descriptor.marker;

      const resolveUpdate = resolveRealDataResultIssueGhCommandPlan(
        multiHitStdout(marker, [7, 13]),
        stepArgs.publish.commandArgs,
      );
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      // 분기 동사 차이(update vs create).
      expect(resolveUpdate.argv[1]).toBe("edit");
      expect(resolveCreate.argv[1]).toBe("create");

      // collect-leg serviceIdentities 는 검색 결과(update/create)와 무관하게 byte-identical.
      runPlan.pipeline.collectCallArgs.forEach((args, i) => {
        expect(args.person.serviceIdentities).toEqual(
          projectSeedIdentities(seeds[i]),
        );
      });
    });
  });

  describe("error path / negative cases — boundary 거부 대칭 박제(R-112 negative 충분 cover)", () => {
    it("(p) seed externalId 빈('') → buildRealDataE2eRunPlan 위임 buildRealDataCollectInput externalId 빈-가드 throw(serviceIdentities 1:1 도달 전 차단, service 정상이어도 externalId 결손으로 throw — 필드별 1:1 의 한쪽 위반 boundary)", () => {
      const badSeeds: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "x", email: "x@e2e.realdata.test", active: true },
          serviceIdentities: [
            // service 는 정상("github.com")이나 externalId 결손 → throw.
            { service: "github.com" as const, externalId: "", isPrimary: true },
          ],
        },
      ];
      expect(() =>
        buildRealDataE2eRunPlan(badSeeds, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(p') seed externalId 공백-only('  ') → externalId 빈-가드 throw 대칭(service 정상이어도 차단)", () => {
      const badSeeds: RealDataSeedDescriptor[] = [
        {
          person: { fullName: "x", email: "x@e2e.realdata.test", active: true },
          serviceIdentities: [
            {
              service: "github.com" as const,
              externalId: "  ",
              isPrimary: true,
            },
          ],
        },
      ];
      expect(() =>
        buildRealDataE2eRunPlan(badSeeds, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(q) modelId 빈('') → buildRealDataE2eRunPlan 위임 pipeline modelId guard throw(serviceIdentities 합성 도달 전 차단)", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(q') modelId 공백-only('   ') → pipeline modelId guard throw 대칭", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, "   ", {
          gitSha: "abc1234",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(r) run.gitSha 빈('') → buildRealDataE2eRunPlan run guard assertRunRefNonBlank('gitSha') throw", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "",
          dateToken: "2026-06-29",
        }),
      ).toThrow();
    });

    it("(r') run.dateToken 빈('') → run guard assertRunRefNonBlank('dateToken') throw 대칭", () => {
      const seeds = defaultSeeds();
      expect(() =>
        buildRealDataE2eRunPlan(seeds, MODEL_ID, {
          gitSha: "abc1234",
          dateToken: "",
        }),
      ).toThrow();
    });

    it("(s) searchStdout 비JSON/비배열('not json') → parseRealDataResultIssueSearchOutput throw", () => {
      expect(() => parseRealDataResultIssueSearchOutput("not json")).toThrow();
    });

    it("(t) searchStdout hit number 비양수([{number:0,...}]) → search-parse assertPositiveNumber throw", () => {
      const stepArgs = buildRealDataE2eStepArgs(
        buildRunPlan(),
        defaultActivities(),
        defaultResults(),
      );
      const marker = stepArgs.publish.report.descriptor.marker;
      const zeroStdout = JSON.stringify([
        { number: 0, title: "결과 이슈", body: `본문\n${marker}\n끝` },
      ]);
      expect(() => parseRealDataResultIssueSearchOutput(zeroStdout)).toThrow();
    });

    it("(u) searchStdout hit title/body 비문자열([{number:1,title:5,body:'b'}]) → search-parse 문자열 필드 guard throw", () => {
      const badStdout = JSON.stringify([{ number: 1, title: 5, body: "b" }]);
      expect(() => parseRealDataResultIssueSearchOutput(badStdout)).toThrow();
    });

    it("(v) execStdout URL 미발견(빈 문자열) → post 파서 throw(runPlan.run 정상이어도 차단)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(buildRunPlan(), ""),
      ).toThrow();
    });

    it("(v') execStdout /issues/0 → post 파서 assertPositiveIssueNumber throw(post 비식별)", () => {
      expect(() =>
        buildRealDataResultOutcomeStepArgs(
          buildRunPlan(),
          `https://github.com/${OWNER}/${REPO}/issues/0\n`,
        ),
      ).toThrow();
    });

    it("(w) serviceIdentities 빈 배열 boundary — seeds[i].serviceIdentities=[] → collectCallArgs[i].person.serviceIdentities 가 빈 배열 보존(throw 0, 빈 배열 == 빈 배열). 빈 외부ID 와 빈 배열은 distinct boundary(빈 배열 통과, 빈 externalId throw)", () => {
      const emptyIdSeeds: RealDataSeedDescriptor[] = [
        {
          person: {
            fullName: "empty-id",
            email: "empty-id@e2e.realdata.test",
            active: true,
          },
          serviceIdentities: [],
        },
      ];
      const runPlan = buildRealDataE2eRunPlan(emptyIdSeeds, MODEL_ID, {
        gitSha: "abc1234",
        dateToken: "2026-06-29",
      });
      // 빈 serviceIdentities 는 throw 0 — 빈 배열 보존(degenerate 1:1).
      expect(runPlan.pipeline.collectCallArgs).toHaveLength(1);
      expect(
        runPlan.pipeline.collectCallArgs[0].person.serviceIdentities,
      ).toEqual([]);
      expect(
        runPlan.pipeline.collectCallArgs[0].person.serviceIdentities,
      ).toEqual(projectSeedIdentities(emptyIdSeeds[0]));
    });
  });

  describe("결정론·무공유·no-mutation — chain 두 번 호출 + 입력 불변 + serviceIdentities 오염 0", () => {
    it("(x) 동일 (seeds, modelId, run, activities, results, searchStdout, execStdout) chain 두 번 → runPlan(serviceIdentities 포함)/stepArgs/parsedHits/resolvePlan/outcomeReport 모두 deep-equal(결정론)", () => {
      const seeds = defaultSeeds();
      const chain1 = runChain([7, 13], seeds, buildRunPlan(seeds));
      const chain2 = runChain([7, 13], seeds, buildRunPlan(seeds));

      expect(chain1.runPlan.pipeline.collectCallArgs).toEqual(
        chain2.runPlan.pipeline.collectCallArgs,
      );
      expect(chain1.stepArgs.evaluation).toEqual(chain2.stepArgs.evaluation);
      expect(chain1.stepArgs.publish).toEqual(chain2.stepArgs.publish);
      expect(chain1.parsedHits).toEqual(chain2.parsedHits);
      expect(chain1.resolvePlan).toEqual(chain2.resolvePlan);
      expect(chain1.outcomeReport).toEqual(chain2.outcomeReport);
    });

    it("(y) no-mutation — 입력 seeds(특히 serviceIdentities 배열)·activities·results·run chain 호출 후 deep-equal(원본 불변)", () => {
      const seeds = defaultSeeds();
      const activities = defaultActivities(seeds);
      const results = defaultResults();
      const run = { gitSha: "abc1234", dateToken: "2026-06-29" };
      const seedsBefore = JSON.parse(JSON.stringify(seeds));
      const activitiesBefore = JSON.parse(JSON.stringify(activities));
      const resultsBefore = JSON.parse(JSON.stringify(results));
      const runBefore = JSON.parse(JSON.stringify(run));

      const runPlan = buildRealDataE2eRunPlan(seeds, MODEL_ID, run);
      const stepArgs = buildRealDataE2eStepArgs(runPlan, activities, results);
      parseRealDataResultIssueSearchOutput(
        multiHitStdout(stepArgs.publish.report.descriptor.marker, [7]),
      );

      expect(seeds).toEqual(seedsBefore);
      expect(activities).toEqual(activitiesBefore);
      expect(results).toEqual(resultsBefore);
      expect(run).toEqual(runBefore);
    });

    it("(z) 무공유 — collectCallArgs[i].person.serviceIdentities.push(...) 후 새 chain 의 산출이 여전히 정상·seed 오염 0(매 호출 새 트리)", () => {
      const seeds = defaultSeeds();
      const first = buildRunPlan(seeds);
      const firstIdentities = first.pipeline.collectCallArgs[0].person
        .serviceIdentities as Array<{ service: string; externalId: string }>;
      const firstLen = firstIdentities.length;

      // 반환 serviceIdentities 배열 mutate(오염 시도).
      firstIdentities.push({ service: "github.com", externalId: "polluted" });
      expect(
        first.pipeline.collectCallArgs[0].person.serviceIdentities,
      ).toHaveLength(firstLen + 1);

      // 새 runPlan 의 serviceIdentities 는 여전히 정상(이전 호출 mutate 누설 0).
      const second = buildRunPlan(seeds);
      expect(
        second.pipeline.collectCallArgs[0].person.serviceIdentities,
      ).toEqual(projectSeedIdentities(seeds[0]));
      // seed 도 오염 0(원본 불변).
      expect(seeds[0].serviceIdentities).toEqual(
        buildRealDataE2eSeed()[0].serviceIdentities,
      );
    });
  });

  describe("credential 누출 0(branch — §9 / R-59 / REQ-059 정합)", () => {
    it("(aa) collectCallArgs(직렬화 — person.serviceIdentities {service,externalId})·searchArgv(join)·parsedHits·resolvePlan.argv(join)·commandArgs/{descriptor,summary}/evaluation.{inputs,callArgs}/outcomeReport.{url,summaryLine} 어디에도 credential 어휘 미등장(특히 person.serviceIdentities[].externalId(github username — author 귀속 key) 명시)", () => {
      const seeds = defaultSeeds();
      const { runPlan, stepArgs, parsedHits, resolvePlan, outcomeReport } =
        runChain([7, 13], seeds);
      const resolveCreate = resolveRealDataResultIssueGhCommandPlan(
        "[]",
        stepArgs.publish.commandArgs,
      );

      const surfaces: string[] = [
        JSON.stringify(runPlan.pipeline.collectCallArgs),
        runPlan.pipeline.modelId,
        stepArgs.publish.searchArgv.join(" "),
        JSON.stringify(parsedHits),
        resolvePlan.argv.join(" "),
        resolveCreate.argv.join(" "),
        stepArgs.publish.commandArgs.createArgs.labels.join(" "),
        stepArgs.publish.commandArgs.createArgs.title,
        stepArgs.publish.commandArgs.updateArgs.title,
        stepArgs.publish.commandArgs.createArgs.body,
        stepArgs.publish.commandArgs.updateArgs.body,
        stepArgs.publish.commandArgs.searchQuery,
        stepArgs.publish.report.descriptor.title,
        stepArgs.publish.report.descriptor.marker,
        stepArgs.publish.report.descriptor.body,
        JSON.stringify(stepArgs.publish.report.summary),
        JSON.stringify(stepArgs.evaluation.inputs),
        JSON.stringify(stepArgs.evaluation.callArgs),
        outcomeReport.url,
        outcomeReport.summaryLine,
      ];

      const credentialPattern =
        /(GH_TOKEN|GITHUB_TOKEN|Bearer|Authorization|x-access-token|x-github-token|--token|--auth|ghp_[A-Za-z0-9]|PAT)/i;
      for (const surface of surfaces) {
        expect(surface).not.toMatch(credentialPattern);
      }
      // person.serviceIdentities[].externalId(github username — author 귀속 key)에 credential
      // 어휘 미등장 명시.
      runPlan.pipeline.collectCallArgs.forEach((args) => {
        args.person.serviceIdentities.forEach((identity) => {
          expect(identity.externalId).not.toMatch(credentialPattern);
          expect(identity.service).not.toMatch(credentialPattern);
        });
      });
      // outcome url 은 issue 경로만.
      expect(outcomeReport.url).not.toMatch(/commit|pull request/i);
    });
  });
});
