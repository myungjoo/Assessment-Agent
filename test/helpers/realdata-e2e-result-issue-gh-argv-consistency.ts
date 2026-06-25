// realdata-e2e-result-issue-gh-argv-consistency.ts — 실 평가 e2e 결과 이슈 gh 인자-벡터
// (argv)가 입력 action + 명령-args 의 title/body/labels 를 argv 위치로 정합 round-trip
// 했는지 검증하는 순수 가드(T-0653 박제).
//
// 책임:
//   - `buildRealDataResultIssueGhArgv`(T-0585, `realdata-e2e-result-issue-gh-argv.ts`)
//     는 `RealDataResultIssueAction`(create/update) + `RealDataResultIssueCommandArgs`
//     를 실 `gh` 명령에 그대로 넘길 인자-벡터(argv, `string[]`)로 합성한다. create 분기는
//     `["issue", "create", "--title", title, "--body", body, ...("--label", <label>) 전개]`,
//     update 분기는 `["issue", "edit", String(issueNumber), "--title", title, "--body",
//     body]` 를 산출한다. 이 빌더는 `assertNonBlank`·`assertPositiveIssueNumber` 같은
//     inline 식별자 guard 만 보유하고, **산출 argv 가 명령-args 의 title/body/labels 를
//     argv 의 올바른 위치로 정합 전파했는지 검증하는 독립 불변식 가드는 부재** 하다. 즉
//     빌더가 회귀(예: `--title` 뒤 값이 body 와 뒤바뀜, label flag-pair 의 순서·개수 어긋남,
//     create 분기인데 `issue edit` argv 가 나옴)해도 argv 구조 불변식을 런타임에서 강제하는
//     가드가 없어, 손상 argv 가 `execFile('gh', argv)` live wiring 으로 새면 잘못된 gh
//     명령이 실행된다. 본 가드가 그 빈칸을 채운다.
//
// 🔥 command-args single-source(argv-side mirror):
//   - 본 가드는 `assertRealDataResultIssueCommandArgsBodyPreservesDescriptor`(T-0649)·
//     `assertRealDataResultIssueCommandArgsLabelsTitleConsistent`(T-0651) 의 argv-side
//     mirror 다. 그 두 가드는 command-args 가 descriptor 를 보존하는지(한 단계 upstream)를
//     검증했고, 본 가드는 그 한 단계 downstream 인 argv 가 command-args 를 보존하는지를
//     검증한다. action(create/update) + commandArgs 를 single-source 로 삼아 argv 의 동사·
//     title/body/labels 위치 정합만 비교한다(descriptor 재유도 0 — upstream 가드가 cover).
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(argv·action·commandArgs 읽기·비교만) / 동일 입력 → 동일 동작(정상 argv 면
// 항상 void 반환, 부정합 argv 면 항상 동일 위치 throw). raw 미저장(R-59) — argv 의
// title/body/label string 만 비교(narrative/raw 본문 미접촉). 새 외부 dependency 0,
// DB write·migration 0, live LLM 호출 0. 같은 디렉토리 타입 import 라 runtime cycle 0.
//
// 책임 경계(task Out of Scope):
//   - `buildRealDataResultIssueGhArgv` 본문·출력 타입 변경 0(타입만 `import type` 소비,
//     재정의 0). 본 가드는 import·비교·throw 만.
//   - 자동 복구 / argv 재합성 / 정규화 / 기본값 채움 0 — 부정합 argv 를 고치거나 silent
//     수선하지 않는다(fail-fast). 복구는 호출처 책임.
//   - 산출 경로 자동 배선(`buildRealDataResultIssueGhArgv` 산출 직전 self-wire) 0 — 순수
//     가드 helper 까지. self-wire 는 별도 follow-up slice(T-0650/T-0652 self-wire 의
//     argv-side mirror).
//   - `--repo owner/repo` 인자 / repo slug 정합 검증 0 — 빌더가 issue create/edit 핵심
//     인자만 산출하고 repo 컨텍스트는 caller 책임(본 가드는 빌더가 실제 산출하는 argv 범위만).
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 배열·string 비교만.
//
// 패턴 mirror: `realdata-e2e-result-issue-command-args-body-marker.ts`(T-0649, 순수 함수 /
// null·undefined fail-fast 한국어 TypeError / 구조 결손=TypeError·값 정합 위반=RangeError
// 구분 / single-source 비교 / 한국어 JSDoc·책임 경계 주석 / 자동 복구 0 / 산출 경로 자동
// 배선 0). 본 가드는 그 에러 정책·가드 관례·JSDoc 톤을 mirror 하되, command-args 측이 아닌
// argv 측 round-trip 정합을 검증한다.

import type { RealDataResultIssueAction } from "./realdata-e2e-result-issue-action";
import type { RealDataResultIssueCommandArgs } from "./realdata-e2e-result-issue-command-args";

// assertArgvStructure — argv 가 구조적으로 온전한지(배열 + 모든 원소 string) fail-fast
// 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다(값 정합 위반과 분리).
function assertArgvStructure(
  argv: string[] | null | undefined,
): asserts argv is string[] {
  if (argv === null || argv === undefined) {
    throw new TypeError(
      "argv 가 null/undefined 일 수 없다 — string[] argv 가 필요하다.",
    );
  }
  if (!Array.isArray(argv)) {
    throw new TypeError(
      `argv 가 배열이 아니다(타입: ${typeof argv}) — gh argv 정합 비교를 진행할 수 없다.`,
    );
  }
  for (let i = 0; i < argv.length; i += 1) {
    if (typeof argv[i] !== "string") {
      throw new TypeError(
        `argv[${i}] 가 문자열이 아니다(타입: ${typeof argv[i]}) — argv 원소는 모두 string 이어야 한다.`,
      );
    }
  }
}

// assertActionStructure — action 객체가 구조적으로 온전한지 fail-fast 검증(분기 판정
// 기준). action 종류와 update 시 issueNumber 의 타입 결손을 TypeError 로 구분한다.
function assertActionStructure(
  action: RealDataResultIssueAction | null | undefined,
): asserts action is RealDataResultIssueAction {
  if (action === null || action === undefined) {
    throw new TypeError(
      "action 이 null/undefined 일 수 없다 — RealDataResultIssueAction 객체가 필요하다.",
    );
  }
  const actionKind: string = (action as { action: string }).action;
  if (actionKind !== "create" && actionKind !== "update") {
    throw new TypeError(
      `action.action 이 'create' | 'update' 가 아니다(값: ${String(
        actionKind,
      )}) — 분기 정합 판정을 진행할 수 없다.`,
    );
  }
  if (action.action === "update" && typeof action.issueNumber !== "number") {
    throw new TypeError(
      `update action 의 issueNumber 가 number 가 아니다(타입: ${typeof action.issueNumber}) — issueNumber 문자열화 정합 비교를 진행할 수 없다.`,
    );
  }
}

// assertCommandArgsStructure — commandArgs 객체와 분기별 필수 string 필드가 구조적으로
// 온전한지 fail-fast 검증. 구조/타입 결손은 TypeError 로 구분한다. action 종류에 따라
// 어느 하위 묶음(createArgs / updateArgs)을 검사할지를 좁힌다.
function assertCommandArgsStructure(
  commandArgs: RealDataResultIssueCommandArgs | null | undefined,
  action: RealDataResultIssueAction,
): asserts commandArgs is RealDataResultIssueCommandArgs {
  if (commandArgs === null || commandArgs === undefined) {
    throw new TypeError(
      "commandArgs 가 null/undefined 일 수 없다 — RealDataResultIssueCommandArgs 객체가 필요하다.",
    );
  }
  if (action.action === "create") {
    if (
      commandArgs.createArgs === null ||
      commandArgs.createArgs === undefined
    ) {
      throw new TypeError(
        "commandArgs.createArgs 가 null/undefined 일 수 없다 — create argv 정합 검증을 진행할 수 없다.",
      );
    }
    if (typeof commandArgs.createArgs.title !== "string") {
      throw new TypeError(
        `commandArgs.createArgs.title 이 문자열이 아니다(타입: ${typeof commandArgs
          .createArgs.title}) — title 정합 비교를 진행할 수 없다.`,
      );
    }
    if (typeof commandArgs.createArgs.body !== "string") {
      throw new TypeError(
        `commandArgs.createArgs.body 가 문자열이 아니다(타입: ${typeof commandArgs
          .createArgs.body}) — body 정합 비교를 진행할 수 없다.`,
      );
    }
    if (!Array.isArray(commandArgs.createArgs.labels)) {
      throw new TypeError(
        `commandArgs.createArgs.labels 가 배열이 아니다(타입: ${typeof commandArgs
          .createArgs.labels}) — labels flag-pair 정합 비교를 진행할 수 없다.`,
      );
    }
    for (let i = 0; i < commandArgs.createArgs.labels.length; i += 1) {
      if (typeof commandArgs.createArgs.labels[i] !== "string") {
        throw new TypeError(
          `commandArgs.createArgs.labels[${i}] 가 문자열이 아니다(타입: ${typeof commandArgs
            .createArgs.labels[i]}) — labels 원소는 모두 string 이어야 한다.`,
        );
      }
    }
    return;
  }
  // update 분기 — updateArgs.title / updateArgs.body 만 검사.
  if (commandArgs.updateArgs === null || commandArgs.updateArgs === undefined) {
    throw new TypeError(
      "commandArgs.updateArgs 가 null/undefined 일 수 없다 — update argv 정합 검증을 진행할 수 없다.",
    );
  }
  if (typeof commandArgs.updateArgs.title !== "string") {
    throw new TypeError(
      `commandArgs.updateArgs.title 이 문자열이 아니다(타입: ${typeof commandArgs
        .updateArgs.title}) — title 정합 비교를 진행할 수 없다.`,
    );
  }
  if (typeof commandArgs.updateArgs.body !== "string") {
    throw new TypeError(
      `commandArgs.updateArgs.body 가 문자열이 아니다(타입: ${typeof commandArgs
        .updateArgs.body}) — body 정합 비교를 진행할 수 없다.`,
    );
  }
}

/**
 * 실 평가 e2e 결과 이슈 gh 인자-벡터(argv)가 입력 action + 명령-args 의 title/body/labels 를
 * argv 위치로 정합 round-trip 했는지 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ④
 * 결과 박제 chain 의 argv-layer 무결성 조각). `assertRealDataResultIssueCommandArgsBody-
 * PreservesDescriptor`(T-0649)·`assertRealDataResultIssueCommandArgsLabelsTitleConsistent`
 * (T-0651) command-args 가드의 argv-side mirror — argv 가 한 단계 upstream 인 command-args 를
 * 보존하는지 검증한다.
 *
 * 검증하는 불변식(single source — action + commandArgs, 빌더 T-0585 의 argv 합성 규칙 강제):
 *   create 분기(action.action === 'create'):
 *     (C0) argv 동사가 `["issue", "create", ...]` — create action 인데 `issue edit` 면 위반.
 *     (C1) argv[2]==='--title' 이고 argv[3]===commandArgs.createArgs.title (byte-identical).
 *     (C2) argv[4]==='--body' 이고 argv[5]===commandArgs.createArgs.body (byte-identical).
 *     (C3) argv[6..] 가 `("--label", <label>)` flag-pair 의 순서·개수·원소까지
 *          commandArgs.createArgs.labels 와 정확히 일치(부분/초과/순서변경 거부).
 *   update 분기(action.action === 'update'):
 *     (U0) argv 동사가 `["issue", "edit", ...]` — update action 인데 `issue create` 면 위반.
 *     (U1) argv[2]===String(action.issueNumber) (issueNumber 문자열화 정합).
 *     (U2) argv[3]==='--title' 이고 argv[4]===commandArgs.updateArgs.title (byte-identical).
 *     (U3) argv[5]==='--body' 이고 argv[6]===commandArgs.updateArgs.body (byte-identical).
 *     (U4) argv 길이가 7 — update argv 에 잉여 원소가 없음.
 *
 * 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError):
 *   - `argv`(null/undefined·비배열·원소 비-string) / `action`(null/undefined·분기값 오류·
 *     update 시 issueNumber 비-number) / `commandArgs`(null/undefined·필수 하위 필드 비-string·
 *     labels 비배열·원소 비-string) → 한국어 TypeError.
 *   - 불변식 위반 → 한국어 RangeError. 메시지에 어느 위치·어느 값이 drift 했는지 포함
 *     (기대값 vs 실측값 노출).
 *   - silent 통과(위반인데 정상 반환) 0.
 *
 * 검사 순서: 구조(argv / action / commandArgs) → 동사 분기 판정 → 각 위치 정합. 가장 먼저
 * 위반한 지점에서 throw(fail-fast).
 *
 * 비변형 / 순수: `argv` / `action` / `commandArgs` 를 읽기·비교만 한다(쓰기 0). 부수효과 0 ·
 * `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작(정상
 * argv 면 항상 void 반환, 부정합 argv 면 항상 동일 위치 throw). 공백·대소문자 민감
 * (byte-identical 비교 — trim·case-fold 0). raw 미저장(R-59) — title/body/label string 만 비교.
 *
 * @param argv 검증 대상 gh 인자-벡터. 변형하지 않는다(읽기·비교만). 모든 원소가 string 인
 *   배열이어야 한다.
 * @param action 분기(create/update) 판정 기준 action. 변형하지 않는다. update 시 issueNumber 가
 *   number 여야 한다.
 * @param commandArgs argv 가 보존해야 할 title/body/labels 의 single-source 명령-args.
 *   변형하지 않는다(읽기·비교만).
 * @returns argv round-trip 정합 불변식을 모두 만족하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `argv` / `action` / `commandArgs` 구조/타입 결손.
 * @throws {RangeError} 동사 분기 불일치 또는 title/body/labels/issueNumber 위치 정합 위반.
 *   메시지에 위반 위치·기대값 vs 실측값을 포함.
 */
export function assertRealDataResultIssueGhArgvPreservesCommandArgs(
  argv: string[],
  action: RealDataResultIssueAction,
  commandArgs: RealDataResultIssueCommandArgs,
): void {
  // 구조 검증(TypeError 분기) — argv 배열·원소 string / action 분기값·issueNumber /
  // commandArgs 분기별 필수 필드. action 구조를 먼저 검증해야 commandArgs 분기 검사가 안전.
  assertActionStructure(action);
  assertArgvStructure(argv);
  assertCommandArgsStructure(commandArgs, action);

  if (action.action === "create") {
    const { title, body, labels } = commandArgs.createArgs;

    // (C0) 동사 분기 — create action 은 `["issue", "create", ...]` 로 시작해야 한다.
    if (argv[0] !== "issue" || argv[1] !== "create") {
      throw new RangeError(
        `불변식(C0) 위반: create action 인데 argv 동사가 'issue create' 가 아니다 — 기대=['issue','create'], 실측=['${String(
          argv[0],
        )}','${String(argv[1])}']. 동사 분기가 action 과 어긋났다.`,
      );
    }

    // (C1) --title flag + title 값 정합.
    if (argv[2] !== "--title") {
      throw new RangeError(
        `불변식(C1) 위반: argv[2] 가 '--title' 이 아니다 — 기대='--title', 실측='${String(
          argv[2],
        )}'. create argv 의 title flag 위치가 drift 됐다.`,
      );
    }
    if (argv[3] !== title) {
      throw new RangeError(
        `불변식(C1) 위반: argv[3](--title 값)이 createArgs.title 과 byte-identical 하지 않다 — 기대='${title}', 실측='${String(
          argv[3],
        )}'.`,
      );
    }

    // (C2) --body flag + body 값 정합.
    if (argv[4] !== "--body") {
      throw new RangeError(
        `불변식(C2) 위반: argv[4] 가 '--body' 가 아니다 — 기대='--body', 실측='${String(
          argv[4],
        )}'. create argv 의 body flag 위치가 drift 됐다(title↔body 뒤바뀜 의심).`,
      );
    }
    if (argv[5] !== body) {
      throw new RangeError(
        `불변식(C2) 위반: argv[5](--body 값)가 createArgs.body 와 byte-identical 하지 않다 — 기대='${body}', 실측='${String(
          argv[5],
        )}'.`,
      );
    }

    // (C3) labels flag-pair 정합 — argv[6..] 가 `("--label", <label>)` 의 순서·개수·원소까지
    // labels 와 정확히 일치. argv 잔여 길이가 labels 의 2배(flag-pair)여야 한다.
    const labelTail = argv.slice(6);
    if (labelTail.length !== labels.length * 2) {
      throw new RangeError(
        `불변식(C3) 위반: label flag-pair 개수가 createArgs.labels 와 불일치한다 — 기대 ${
          labels.length
        }개(argv 잔여 ${labels.length * 2}원소), 실측 argv 잔여 ${
          labelTail.length
        }원소. 부분/초과 labels 거부(정확 일치만 통과).`,
      );
    }
    for (let i = 0; i < labels.length; i += 1) {
      const flag = labelTail[i * 2];
      const value = labelTail[i * 2 + 1];
      if (flag !== "--label") {
        throw new RangeError(
          `불변식(C3) 위반: ${i}번째 label flag 가 '--label' 이 아니다 — 기대='--label', 실측='${String(
            flag,
          )}'. flag-pair 구조가 drift 됐다.`,
        );
      }
      if (value !== labels[i]) {
        throw new RangeError(
          `불변식(C3) 위반: ${i}번째 label 값이 createArgs.labels[${i}] 와 byte-identical 하지 않다 — 기대='${
            labels[i]
          }', 실측='${String(value)}'. labels 순서/원소가 drift 됐다.`,
        );
      }
    }
    return;
  }

  // update 분기.
  const { title, body } = commandArgs.updateArgs;
  const expectedIssueNumber = String(action.issueNumber);

  // (U0) 동사 분기 — update action 은 `["issue", "edit", ...]` 로 시작해야 한다.
  if (argv[0] !== "issue" || argv[1] !== "edit") {
    throw new RangeError(
      `불변식(U0) 위반: update action 인데 argv 동사가 'issue edit' 가 아니다 — 기대=['issue','edit'], 실측=['${String(
        argv[0],
      )}','${String(argv[1])}']. 동사 분기가 action 과 어긋났다.`,
    );
  }

  // (U1) issueNumber 문자열화 정합.
  if (argv[2] !== expectedIssueNumber) {
    throw new RangeError(
      `불변식(U1) 위반: argv[2](issueNumber 문자열)이 String(action.issueNumber) 와 불일치한다 — 기대='${expectedIssueNumber}', 실측='${String(
        argv[2],
      )}'.`,
    );
  }

  // (U2) --title flag + title 값 정합.
  if (argv[3] !== "--title") {
    throw new RangeError(
      `불변식(U2) 위반: argv[3] 이 '--title' 이 아니다 — 기대='--title', 실측='${String(
        argv[3],
      )}'. update argv 의 title flag 위치가 drift 됐다.`,
    );
  }
  if (argv[4] !== title) {
    throw new RangeError(
      `불변식(U2) 위반: argv[4](--title 값)이 updateArgs.title 과 byte-identical 하지 않다 — 기대='${title}', 실측='${String(
        argv[4],
      )}'.`,
    );
  }

  // (U3) --body flag + body 값 정합.
  if (argv[5] !== "--body") {
    throw new RangeError(
      `불변식(U3) 위반: argv[5] 가 '--body' 가 아니다 — 기대='--body', 실측='${String(
        argv[5],
      )}'. update argv 의 body flag 위치가 drift 됐다(title↔body 뒤바뀜 의심).`,
    );
  }
  if (argv[6] !== body) {
    throw new RangeError(
      `불변식(U3) 위반: argv[6](--body 값)가 updateArgs.body 와 byte-identical 하지 않다 — 기대='${body}', 실측='${String(
        argv[6],
      )}'.`,
    );
  }

  // (U4) update argv 잉여 원소 거부 — 정확히 7 원소여야 한다(issue edit + 번호 + title/body).
  if (argv.length !== 7) {
    throw new RangeError(
      `불변식(U4) 위반: update argv 길이가 7 이 아니다 — 기대=7, 실측=${argv.length}. update argv 에 잉여 원소가 끼었다.`,
    );
  }
}
