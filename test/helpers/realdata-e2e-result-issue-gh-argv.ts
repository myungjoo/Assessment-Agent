// realdata-e2e-result-issue-gh-argv.ts — 실 평가 e2e 결과 이슈 action + 명령-args →
// gh 인자-벡터(argv) 순수 빌더 (T-0585 박제).
//
// 책임:
//   - T-0584 의 `resolveRealDataResultIssueAction` 은 어느 분기(create/update)를 어느
//     이슈 번호에 실행할지를 결정했고(`RealDataResultIssueAction`), T-0583 의
//     `buildRealDataResultIssueCommandArgs` 는 create/update 양쪽 인자 묶음을 모두
//     산출했다(`RealDataResultIssueCommandArgs`). PLAN.md 109행 step ④ 는 그 결과를
//     "daily-test result/rolling 이슈에 박제"하라 지시한다 — 실 gh 호출 직전에 두
//     산출물을 결합해 **실제 `gh` 명령에 그대로 넘길 인자-벡터(argv)** 를 만드는 단계가
//     아직 비어있다. 본 helper 가 그 마지막 build-time layer(argv 합성) 다.
//   - caller(live wiring)는 (1) T-0583 명령-args + (2) T-0584 action 을 본 빌더에
//     입력해 완성된 argv 를 받고, (3) 그 argv 를 `execFile('gh', argv)` 로 실 호출한다.
//     본 helper 는 (3) 직전의 argv 합성만 순수 함수로 박제 — 실 gh 실행은 여전히
//     deferred(본 helper 는 argv 합성만; credential gate).
//
// 🔥 인자 분리 정합 (shell 미경유 · 인젝션 방지):
//   - 반환 argv 는 `gh` 실행 파일명을 **포함하지 않는다**(caller 가 `execFile('gh', argv)`
//     형태로 실행 파일과 인자를 분리 전달). title / body 값에 공백·특수문자(예: `"; rm
//     -rf"`)가 들어가도 **단일 argv 원소**로 유지된다 — shell 문자열 합성·따옴표 escape 가
//     불필요하고 인젝션이 불가하다.
//
// 🔥 raw 미저장 정합 (R-59 / REQ-032, data-model.md §4):
//   - 본 빌더는 commandArgs 의 title / body 를 그대로 argv 로 옮길 뿐 raw 활동 본문·
//     narrative 본문을 추가하지 않는다(애초에 입력에 부재). step ④ 박제 경계의 argv layer.
//
// 🔥 결정론적 출력 (동일 입력 → byte-identical):
//   - 입력 외 상태(시각·난수·env) 의존 0. argv 원소·순서 전부 입력만의 함수. 동일 action +
//     commandArgs 두 번 호출 → 원소·순서까지 동일한 argv(단, 무공유 — 새 배열).
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0, gh 실행 0.
//     외부 CLI 라이브러리(execa 등) 0 — 내장 배열 연산만. 순수 함수.
//
// 🔥 무공유 보장 (입력 mutate 0):
//   - 본 빌더는 입력 `action` / `commandArgs`(중첩 createArgs.labels 배열 포함)를
//     변형하지 않는다(읽기만). 호출마다 새 argv 배열을 반환 — 반환 argv mutate 가 입력에
//     누설되지 않는다.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `RealDataResultIssueAction` 은 `./realdata-e2e-result-issue-action`(T-0584)에서,
//     `RealDataResultIssueCommandArgs` 는 `./realdata-e2e-result-issue-command-args`
//     (T-0583)에서 `import type` 재사용한다. 신규 type 정의 없음 — 두 기존 타입을
//     입력받아 `string[]` 만 산출.
//
// Out of Scope (task T-0585):
//   - 실 gh 호출 / `execFile('gh', argv)` / `gh issue create` / `gh issue edit` /
//     `gh search issues` 실 실행(step ④ live wiring — credential gate). 본 빌더는 argv
//     합성만 산출(부수효과 0).
//   - `--repo owner/repo` 인자 / repo slug 결정 / gh auth — 실 wiring 의 환경 책임(본
//     빌더는 issue create/edit 의 핵심 인자만; repo 컨텍스트는 caller 의 cwd/env 또는
//     별도 wiring slice).
//   - create vs update 분기 결정 자체(T-0584 resolver 위임만 — 본 빌더는 주어진 action 을
//     소비만; resolver 재구현 금지).
//   - 명령-args 합성 자체(T-0583 위임만 — searchQuery / createArgs / updateArgs 재합성
//     금지).
//   - `deploy/daily-test.sh` 의 `step_eval` wiring / `latest-result.json` 연동(step ④
//     live wiring, ADR-0045 LAN gate).
//   - 실 `EvaluationScoringService.scoreUnit` 호출 / Ollama 실 LLM round-trip(step ③
//     live — ADR-0045 LAN gate).
//   - shell 문자열 합성 / 따옴표 escape / `gh ... --json` 옵션 합성 — 본 빌더는 분리된
//     argv 배열만 산출(shell 미경유, escape 불요).
//   - 외부 CLI 라이브러리(execa 등) 도입 — 새 dependency 0, 내장 배열 연산만.
//   - production `src/` 코드 변경 — test helper 단독(타입 import 재사용만).
import type { RealDataResultIssueAction } from "./realdata-e2e-result-issue-action";
import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";

// 빈/공백-only 식별자 guard — title / body 가 빈 문자열·공백-only 면 비식별 이슈 argv
// 생성을 방지하기 위해 명시적 throw 한다(조용한 통과 차단).
function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `${fieldName} 가 비어있습니다 — 비식별 이슈 argv 생성 방지를 위해 빈/공백-only 값은 허용되지 않습니다.`,
    );
  }
}

// issueNumber guard(update 분기) — update action 의 issueNumber 가 양의 정수가 아니면
// (0 이하·비정수) 비정상 number 가 argv 로 새는 것을 차단하기 위해 명시적 throw 한다.
function assertPositiveIssueNumber(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `update action 의 issueNumber 가 양의 정수가 아닙니다(${value}) — 비정상 number 가 argv 로 새는 것을 방지하기 위해 0 이하/비정수는 허용되지 않습니다.`,
    );
  }
}

// buildRealDataResultIssueGhArgv — action(create/update) + 명령-args 를 입력받아 실
// `gh` 명령에 그대로 넘길 인자-벡터(argv, `gh` 실행 파일명 제외)를 산출하는 **순수 함수**.
//
// 분기:
//   - action.action === 'create' → `["issue", "create", "--title", createArgs.title,
//     "--body", createArgs.body, ...labels 전개]`. labels 는 각 원소를 `"--label", <label>`
//     flag pair 로 순서 보존 전개(labels=["a","b"] → ..., "--label", "a", "--label", "b").
//     guard: createArgs.title / createArgs.body 빈/공백 → throw.
//   - action.action === 'update' → `["issue", "edit", String(issueNumber), "--title",
//     updateArgs.title, "--body", updateArgs.body]`. issueNumber 는 String(...) 으로
//     문자열화. guard: issueNumber 양의 정수 아니면 throw, updateArgs.title /
//     updateArgs.body 빈/공백 → throw.
//
// 순수성·무공유:
//   - 입력 `action` / `commandArgs`(중첩 createArgs.labels 포함)를 읽기만 한다(mutate 0).
//     매 호출이 새 argv 배열을 반환 — 반환 argv mutate 가 입력에 누설되지 않는다.
export function buildRealDataResultIssueGhArgv(
  action: RealDataResultIssueAction,
  commandArgs: RealDataResultIssueCommandArgs,
): string[] {
  if (action.action === "create") {
    const { title, body, labels } = commandArgs.createArgs;
    // 식별자 guard — 필드별·빈/공백별 분기마다 명시적 throw.
    assertNonBlank(title, "createArgs.title");
    assertNonBlank(body, "createArgs.body");

    // 기본 인자(title / body 는 각각 단일 argv 원소 — shell 미경유로 인젝션 불가).
    const argv = ["issue", "create", "--title", title, "--body", body];

    // labels 전개 — 각 원소를 `"--label", <label>` flag pair 로 순서 보존 전개.
    for (const label of labels) {
      argv.push("--label", label);
    }

    return argv;
  }

  // update 분기 — issueNumber guard + 식별자 guard 후 edit argv 합성.
  const { issueNumber } = action;
  assertPositiveIssueNumber(issueNumber);

  const { title, body } = commandArgs.updateArgs;
  assertNonBlank(title, "updateArgs.title");
  assertNonBlank(body, "updateArgs.body");

  // issueNumber 는 String(...) 으로 문자열화(argv 는 string[]).
  return [
    "issue",
    "edit",
    String(issueNumber),
    "--title",
    title,
    "--body",
    body,
  ];
}
