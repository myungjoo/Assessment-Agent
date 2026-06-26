// realdata-e2e-result-issue-gh-command-plan-consistency.ts — 실 평가 e2e **step④
// 결과 박제 종단 컴포저** 산출 ↔ 입력 (stdout, commandArgs) single-source 재유도
// 정합 순수 가드 (T-0695 박제).
//
// 책임:
//   - `resolveRealDataResultIssueGhCommandPlan(stdout, commandArgs)`(T-0588,
//     `realdata-e2e-result-issue-gh-command-plan.ts`)는 (1) `parseRealDataResultIssue-
//     SearchOutput(stdout)` → (2) `resolveRealDataResultIssueAction(hits, searchQuery)`
//     → (3) `buildRealDataResultIssueGhArgv(action, commandArgs)` 3-단계를 합성해
//     `{action, argv}`(`RealDataResultIssueGhCommandPlan`) plan 을 산출하는 **step④
//     결과 박제 종단 컴포저**다. 본 가드 신설 전 이 컴포저에는 **독립 정합 가드가
//     부재했다**(origin/main grep 0 — `assertRealDataResultIssueGhCommandPlan*` 심볼·
//     `*-gh-command-plan-consistency.ts` 파일 0). 합성 회귀 — action 분기 오매핑
//     (create/update 뒤바뀜)·argv 동사 drift(`issue create`↔`issue edit`)·title/body 위치
//     drift·label flag-pair 길이/순서 어긋남·update issueNumber drift·argv 잉여/누락 원소·
//     hits 재해석 drift·marker(=searchQuery) 재합성 — 을 build-time 에 잡을 장치가
//     없었다. 본 가드는 합성 회귀로 손상된 plan 이 caller(live wiring, `execFile('gh',
//     argv)`)로 새기 전 build-time 에 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — 입력 `(stdout, commandArgs)` 의 3 위임 helper 재유도):
//   - 입력 `(stdout, commandArgs)` 로 동일 3 위임 helper(`parseRealDataResultIssue-
//     SearchOutput` → `resolveRealDataResultIssueAction` → `buildRealDataResultIssueGhArgv`)
//     를 재호출해 expected `{action, argv}` 를 single-source 재유도한다(합성 규칙 재구현
//     0 — 위임만).
//   - `plan.action` ↔ 재유도 action: 분기 종류(create/update) 일치 + update 시
//     `issueNumber` 일치(deep equal).
//   - `plan.argv` ↔ 재유도 argv: 배열 길이 + 각 원소 byte-identical 정합.
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError — T-0691/T-0693 mirror):
//   - `plan` 비-객체(null/undefined/배열/원시 포함) → 한국어 TypeError.
//   - `plan.argv` 비-배열(null/undefined/객체/원시 포함) → 한국어 TypeError.
//   - `plan.action` 이 `'create'`/`'update'` 외 값 → 한국어 TypeError(구조 분기값 결손).
//   - `stdout` 비-문자열(null/undefined/객체/배열/원시 포함) → 한국어 TypeError(재유도
//     자체가 불가).
//   - `commandArgs` 비-객체(null/undefined/배열/원시 포함) → 한국어 TypeError.
//   - 분기 오매핑(create 인데 plan.action 이 update 또는 그 반대) → RangeError.
//   - update 시 issueNumber 가 재유도 최소 number 와 다름 → RangeError.
//   - argv 길이가 재유도 argv 와 다름 → RangeError(잉여/누락 원소).
//   - argv 임의 위치 원소가 재유도 argv 와 byte-identical 하지 않음 → RangeError(동사
//     drift / title↔body 뒤바뀜 / label flag-pair 어긋남 등 한 메시지로 포착).
//   - silent 통과(위반인데 정상 void) 0. fail-fast(가장 먼저 위반한 지점에서 throw).
//
// 비변형 / 순수: `plan` / `stdout` / `commandArgs` 읽기·비교만(mutate 0). 부수효과 0 ·
// `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0 · env/네트워크/credential 0.
// 동일 입력 → 동일 동작(정합 plan 이면 항상 void, drift 면 항상 동일 지점에서 throw).
// raw 미저장(R-59) — argv 의 title/body/label string 만 비교(narrative 본문 미접촉).
// 가드는 3 위임 helper 를 재호출하지만, 각 helper 자체가 순수 함수라 가드 또한 결정론을
// 유지한다.
//
// 책임 경계(task Out of Scope):
//   - 컴포저 본문 수정 / 반환 직전 self-wire 배선 — 본 가드는 외부 독립 검증만. self-wire
//     는 별도 후속 task(T-0694 패턴 mirror).
//   - 위임 helper(parse / resolveAction / buildGhArgv) 수정 — 본 가드는 호출(재유도)만.
//     각 helper 의 합성 규칙·시그니처·throw 정책 불변.
//   - argv-leaf 가드(`gh-argv-consistency.ts`, T-0653)가 이미 cover 하는 argv↔commandArgs
//     round-trip 의 내부 위치 정합 세부(C0/C1/C2/C3/U0/U1/U2/U3/U4 단위 검증) — 본 가드는
//     plan 전체(action + argv) 의 (stdout, commandArgs) single-source 재유도 정합에 집중.
//     단 재유도 argv 와 plan.argv 의 byte-identical 대조는 본 가드 책임(argv-leaf 가드는
//     `(action, commandArgs)` 만 입력으로 받지 stdout 은 받지 않음).
//   - 자동 복구 / 정규화 / 기본값 채움 / argv 재합성 0 — 손상 plan 을 silent 수선 0.
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 0 — 순수 비교만.
//   - 실 execFile / 실 gh spawn / 실 issue create/edit / Ollama / live-LLM(ADR-0045) /
//     credential wiring 0 — build-time 순수 가드만.
//   - gh repo slug / `--repo owner/repo` 인자 정합 — 컴포저가 산출하는 argv 범위만(repo
//     컨텍스트는 caller 책임).
//   - 다른 leaf 가드 신설/배선 — 본 task 는 gh-command-plan 종단 컴포저 가드 단일 신설만.
//
// 패턴 mirror: `assertRealDataDailyStepEvalCommandPlanConsistentWithGating`(T-0693,
// step④ 진입측 leaf 종단 컴포저 가드)의 result-issue-side mirror — 차이점:
//   (a) 재유도 source 가 단일 helper 위임이 아니라 **3-단계 합성 위임**(parse →
//       resolveAction → buildGhArgv)이라 합성 순서·throw 전파 정책을 재현한다(각 layer
//       throw 는 가드도 try/catch 없이 그대로 전파).
//   (b) 분기 enum 이 `"create"`/`"update"` 이고 update 분기는 issueNumber 도 deep
//       equal 비교(`{action, issueNumber}` 전체).
//   (c) argv 가 canonical 고정 벡터가 아니라 입력 `(stdout, commandArgs)` 의존이라
//       expected 값을 재유도해 동적으로 만든다(상수 import 0 — 위임 재호출 결과 사용).
import type { RealDataResultIssueAction } from "./realdata-e2e-result-issue-action";
import { resolveRealDataResultIssueAction } from "./realdata-e2e-result-issue-action";
import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";
import { buildRealDataResultIssueGhArgv } from "./realdata-e2e-result-issue-gh-argv";
import type { RealDataResultIssueGhCommandPlan } from "./realdata-e2e-result-issue-gh-command-plan";
import { parseRealDataResultIssueSearchOutput } from "./realdata-e2e-result-issue-search-parse";

// describe — 에러 메시지용 타입 라벨. typeof 가 null/array 를 'object' 로 뭉뚱그리는
// 것을 분리 노출(디버깅 가독성). T-0691/T-0693 mirror 와 동형 helper.
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// assertPlanStructure — `plan` 의 최소 형태 fail-fast 검증. 객체여야 `.action`/`.argv`
// 접근 시 타입 충돌이 차단된다. 구조/타입 결손은 TypeError 로 값 정합 위반(RangeError)
// 과 분리.
function assertPlanStructure(
  plan: RealDataResultIssueGhCommandPlan | null | undefined,
): asserts plan is RealDataResultIssueGhCommandPlan {
  if (
    plan === null ||
    plan === undefined ||
    typeof plan !== "object" ||
    Array.isArray(plan)
  ) {
    throw new TypeError(
      `plan 이 객체가 아니다(타입: ${describe(plan)}) — (stdout, commandArgs) 재유도 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertPlanArgvStructure — `plan.argv` 가 배열인지 fail-fast 검증. plan 통과 후에만
// 호출(plan 객체 보장). 비배열이면 재유도 argv 와의 length/원소 대조 자체가 불가.
function assertPlanArgvStructure(argv: unknown): asserts argv is string[] {
  if (argv === null || argv === undefined || !Array.isArray(argv)) {
    throw new TypeError(
      `plan.argv 가 배열이 아니다(타입: ${describe(argv)}) — argv 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertPlanActionEnum — `plan.action` 분기 종류가 `'create'`/`'update'` enum 안에
// 있는지 fail-fast 검증. 다른 값이면 deep equal 비교 자체가 무의미하므로 TypeError 로
// 구조 결손 분류(컴포저 type RealDataResultIssueAction 의 discriminated union 위반).
function assertPlanActionEnum(
  action: RealDataResultIssueAction | null | undefined,
): asserts action is RealDataResultIssueAction {
  if (action === null || action === undefined || typeof action !== "object") {
    throw new TypeError(
      `plan.action 이 객체가 아니다(타입: ${describe(action)}) — RealDataResultIssueAction discriminated union 이 필요하다.`,
    );
  }
  const kind: unknown = (action as { action: unknown }).action;
  if (kind !== "create" && kind !== "update") {
    throw new TypeError(
      `plan.action.action 이 'create'|'update' 외 값이다(실측=${JSON.stringify(kind)}) — 분기 정합 판정을 진행할 수 없다.`,
    );
  }
}

// assertStdoutStructure — 재유도 source(stdout) 최소 형태 fail-fast 검증. parse helper
// 가 string 인자를 가정하므로 비-string(null/undefined/객체/배열/원시) 은 재유도 자체가
// 불가. TypeError 로 분류.
function assertStdoutStructure(
  stdout: string | null | undefined,
): asserts stdout is string {
  if (typeof stdout !== "string") {
    throw new TypeError(
      `stdout 이 문자열이 아니다(타입: ${describe(stdout)}) — parse 재유도를 진행할 수 없다.`,
    );
  }
}

// assertCommandArgsStructure — 재유도 source(commandArgs) 최소 형태 fail-fast 검증.
// resolveAction / buildGhArgv 가 객체 인자를 가정(searchQuery / createArgs / updateArgs
// 접근). 비-객체는 재유도 자체가 불가. TypeError 로 분류. 하위 필드 세부 검증은
// 위임 helper(가드 재유도 호출) throw 로 자연 전파된다.
function assertCommandArgsStructure(
  commandArgs: RealDataResultIssueCommandArgs | null | undefined,
): asserts commandArgs is RealDataResultIssueCommandArgs {
  if (
    commandArgs === null ||
    commandArgs === undefined ||
    typeof commandArgs !== "object" ||
    Array.isArray(commandArgs)
  ) {
    throw new TypeError(
      `commandArgs 가 객체가 아니다(타입: ${describe(commandArgs)}) — resolveAction/buildGhArgv 재유도를 진행할 수 없다.`,
    );
  }
}

/**
 * 실 평가 e2e **step④ 결과 박제 종단 컴포저**(`resolveRealDataResultIssueGhCommandPlan`)
 * 산출 plan 이, 주입된 입력 `(stdout, commandArgs)` 로 동일 3 위임 helper(parse →
 * resolveAction → buildGhArgv)를 재호출해 single-source 재유도한 expected plan 과
 * 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ④ build-time chain 의
 * 결과 박제 종단 seam 무결성 조각). `assertRealDataDailyStepEvalCommandPlanConsistent-
 * WithGating`(T-0693, step④ 진입측 leaf 종단 가드)의 result-issue-side mirror.
 *
 * 검증하는 불변식(single source — 입력 (stdout, commandArgs) 의 3 helper 재유도):
 *   - plan.action 이 재유도 action 과 deep equal(분기 종류 create/update + update 시
 *     issueNumber 일치).
 *   - plan.argv 가 재유도 argv 와 배열 길이 + 각 원소 byte-identical 정합.
 *
 * 검사 순서(fail-fast): 구조(plan 객체 → plan.argv 배열 → plan.action enum → stdout
 * 문자열 → commandArgs 객체) → 재유도(3 위임 helper 호출 — 각 layer throw 그대로 전파)
 * → action 분기 매핑(create/update + issueNumber) → argv 길이 → argv 각 원소. 가장
 * 먼저 어긋난 지점에서 throw.
 *
 * @param plan 종단 컴포저 산출 `RealDataResultIssueGhCommandPlan`. 변형하지 않는다.
 * @param stdout 재유도 source — `parseRealDataResultIssueSearchOutput(stdout)` 재호출에
 *   사용. 변형 불가(문자열).
 * @param commandArgs 재유도 source — `resolveRealDataResultIssueAction` /
 *   `buildRealDataResultIssueGhArgv` 재호출에 사용. 변형하지 않는다(읽기·전달만).
 * @returns 정합이면 void.
 * @throws {TypeError} `plan` 비-객체 / `plan.argv` 비-배열 / `plan.action` 분기값
 *   결손 / `stdout` 비-문자열 / `commandArgs` 비-객체(구조·타입 결손).
 * @throws {RangeError} action 분기 오매핑 / update issueNumber drift / argv 길이 불일치 /
 *   argv 원소 byte 불일치(동사 drift · title↔body 뒤바뀜 · label flag-pair 어긋남 ·
 *   잉여/누락 원소). 메시지에 어긋난 필드 / 기대값 / 실측값 포함.
 *   또한 위임 helper(parse/resolveAction/buildGhArgv)의 throw(예: 비JSON stdout · 빈
 *   marker · 빈 title/body · 비양수 issueNumber)는 가드 자체 try/catch 없이 그대로 전파.
 */
export function assertRealDataResultIssueGhCommandPlanConsistentWithInputs(
  plan: RealDataResultIssueGhCommandPlan,
  stdout: string,
  commandArgs: RealDataResultIssueCommandArgs,
): void {
  // (1) 구조 검증(TypeError 분기) — plan / plan.argv / plan.action / stdout / commandArgs.
  // plan 객체부터 검사해야 .argv/.action 접근이 안전하고, stdout/commandArgs 도 재유도
  // 호출 직전에 검사해 helper 에 비정상 입력을 넘기지 않는다.
  assertPlanStructure(plan);
  assertPlanArgvStructure(plan.argv);
  assertPlanActionEnum(plan.action);
  assertStdoutStructure(stdout);
  assertCommandArgsStructure(commandArgs);

  // (2) single-source 재유도 — 동일 3 위임 helper 를 재호출. 각 layer 의 throw(비JSON
  // stdout · 빈 marker · 빈 title/body 등)는 자체 try/catch 없이 그대로 위로 전파한다
  // (컴포저 throw 전파 정책과 동형 — 조용한 통과 차단).
  const expectedHits = parseRealDataResultIssueSearchOutput(stdout);
  const expectedAction = resolveRealDataResultIssueAction(
    expectedHits,
    commandArgs.searchQuery,
  );
  const expectedArgv = buildRealDataResultIssueGhArgv(
    expectedAction,
    commandArgs,
  );

  // (3) action 분기 매핑 — create/update 종류 일치.
  if (plan.action.action !== expectedAction.action) {
    throw new RangeError(
      `정합 위반: plan.action.action 이 재유도 action 과 분기가 어긋난다 — 기대=${JSON.stringify(
        expectedAction.action,
      )}, 실측=${JSON.stringify(plan.action.action)}. stdout 후보 유무와 action 분기가 어긋났다(create/update 뒤바뀜 의심).`,
    );
  }

  // (4) update 분기면 issueNumber 일치(최소 number — 멱등 회귀 보호의 single-source).
  if (
    expectedAction.action === "update" &&
    plan.action.action === "update" &&
    plan.action.issueNumber !== expectedAction.issueNumber
  ) {
    throw new RangeError(
      `정합 위반: plan.action.issueNumber 가 재유도 최소 number 와 다르다 — 기대=${expectedAction.issueNumber}, 실측=${plan.action.issueNumber}. resolveRealDataResultIssueAction 의 최소 number 멱등 회귀 보호와 어긋났다.`,
    );
  }

  // (5) argv 길이 정합 — 잉여/누락 원소 차단.
  if (plan.argv.length !== expectedArgv.length) {
    throw new RangeError(
      `정합 위반: plan.argv 길이가 재유도 argv 와 다르다 — 기대=${expectedArgv.length}, 실측=${plan.argv.length}. argv 에 잉여/누락 원소가 있다.`,
    );
  }

  // (6) argv 각 원소 byte-identical 정합 — 동사 drift / title↔body 뒤바뀜 / label
  // flag-pair 길이/순서/원소 어긋남 / issueNumber 문자열 drift 등 위치 정합 위반을 한
  // 메시지로 포착. 가장 먼저 어긋난 index 에서 throw(fail-fast).
  for (let i = 0; i < expectedArgv.length; i += 1) {
    if (plan.argv[i] !== expectedArgv[i]) {
      throw new RangeError(
        `정합 위반: plan.argv[${i}] 가 재유도 argv 와 byte-identical 하지 않다 — 기대=${JSON.stringify(
          expectedArgv[i],
        )}, 실측=${JSON.stringify(plan.argv[i])}.`,
      );
    }
  }
}
