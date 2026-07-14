// realdata-e2e-daily-step-dual-leg-run-report-issue-command-args.ts — 실 평가 e2e
// daily-step dual-leg run report 이슈 descriptor → gh issue 멱등 search-or-update
// 명령-args 순수 빌더 (T-0897 박제).
//
// 책임:
//   - T-0896 의 `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 가 dual-leg run
//     report 를 daily-test rolling-issue 의 식별/본문 descriptor
//     (`RealDataDailyStepDualLegRunReportIssueDescriptor` {title, marker, body})로
//     묶었다. PLAN.md 109행 step ④ 는 그 결과를 "daily-test result/rolling 이슈에
//     박제"하라 지시한다 — 실 gh issue 호출(create/edit) 직전에 **어떤 명령으로 / 어떤
//     인자로 / 어떤 search query 로** 이슈를 멱등 박제할지를 결정하는 순수 명령-args
//     descriptor 가 필요하다. 본 helper 가 그 명령 layer 다(T-0896 Out of Scope
//     "gh issue 실 호출 / 실 이슈 검색·갱신" 의 그 직전 slice).
//   - summary 축(T-0582 이슈 descriptor → **T-0583** 명령-args 빌더)의 선례와 정확히
//     동형. dual-leg 축은 descriptor(T-0896)까지만 있고 그 명령 layer(T-0583 mirror)가
//     없었다. 본 task 가 그 gap 을 순수 함수로 메운다.
//
// 🔥 marker 멱등 정합 (later live wiring 의 search-or-update 기반):
//   - `searchQuery` 는 descriptor.marker 를 그대로 담는다 — later live wiring slice 가
//     이 marker 로 동일 run 의 기존 이슈를 검색(`gh search issues`/`gh issue list`)할 수
//     있다. `createArgs.body` 와 `updateArgs.body` 양쪽 모두 descriptor.body 를 그대로
//     전달하므로(marker 라인 보존), 새로 만들든 갱신하든 멱등 검색 토큰이 두 경로 모두에
//     남는다 — search-or-update 멱등성을 떠받친다.
//
// 🔥 raw 미저장 정합 (R-59 / REQ-032, data-model.md §4):
//   - 본 명령-args 는 descriptor 의 title / marker / body 만 전달한다. narrative 본문·raw
//     활동 본문은 입력 descriptor 에 부재하므로(받지도 못함) 명령-args 로 raw 본문이 새지
//     않는다(불변 보존). step ④ 박제 경계의 명령 layer.
//
// 🔥 결정론적 출력 (동일 입력 → byte-identical):
//   - 입력 외 상태(시각·난수·env) 의존 0. searchQuery / createArgs / updateArgs 전부
//     입력만의 함수. labels 는 고정 결정론 상수 집합(호출마다 동일). 동일 descriptor 두
//     번 호출 → 동일 명령-args(단, 무공유 — 새 객체/새 배열).
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 gh issue 호출은 deferred(본 helper 는 명령-args 만 산출 — 부수효과 0). 실
//     네트워크 호출 0, env 읽기 0(`process.env` 0), DB 접근 0, live-LLM 0, credential 0.
//     외부 템플릿/해시/CLI 라이브러리 0 — 내장 string 합성만. 순수 함수.
//
// 🔥 무공유 보장 (입력 mutate 0):
//   - 본 빌더는 입력 `descriptor` 객체를 변형하지 않는다(읽기만). 호출마다 새 명령-args
//     객체(중첩 createArgs / updateArgs / labels 배열 포함 새로 생성)를 반환 — 입력 /
//     다음 호출 결과와 무공유다(반환 labels 배열 mutate 가 누설되지 않음).
//
// 🔥 type 재사용 (중복 정의 0):
//   - 입력 `RealDataDailyStepDualLegRunReportIssueDescriptor` 는
//     `realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts`(T-0896)에서
//     `import type` 재사용한다(중복 정의 0). 신규 type 은 본 helper 의 출력
//     `RealDataDailyStepDualLegRunReportIssueCommandArgs`(+ 내부 createArgs / updateArgs
//     shape) 만 정의. enum/키 토큰은 영어 유지(§12), 본문 설명 문구는 한국어(§12).
//
// Out of Scope (task T-0897):
//   - gh issue 실 호출 / `gh issue create` / `gh issue edit` / `gh issue list` /
//     `gh search issues` 실 실행(step ④ live wiring — credential gate). 본 helper 는
//     명령-args descriptor 만 산출(부수효과 0).
//   - `deploy/daily-test.sh` 의 dual-leg step wiring / 실 jest 프로세스 spawn
//     (step ④ live wiring, ADR-0045 LAN gate).
//   - search-or-update 의 실 분기 실행(기존 이슈 존재 여부 판단·실 issue number 해석 —
//     본 helper 는 create / update 양쪽 args 를 모두 산출만; 어느 쪽을 실행할지는 caller
//     의 live wiring 책임).
//   - T-0894 컴포저 / T-0895 렌더러 / T-0896 descriptor 수정 / marker·title·body 재계산·
//     재렌더(이미 확정 — 본 빌더는 descriptor 전달 + searchQuery/labels 합성만. import
//     재사용만).
//   - repo slug(`owner/repo`) 결정 / `--repo` 인자 / gh auth — 실 wiring 의 환경 책임.
//   - summary 축(T-0580~T-0583) / 단일 issue-post outcome-report(T-0590) 수정.
//   - 외부 템플릿/해시/CLI 라이브러리 도입(새 dependency 0, 내장 string 합성만).
//   - production `src/` 코드 변경 — test helper 단독(타입 import 재사용만).
//
// 🔥 self-wire drift-guard (T-0991): T-0990 이 봉한 독립 oracle 가드
//   `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent`
//   (`-issue-command-args-consistency.ts`)를 빌더 반환 직전 스스로 호출해 매 산출
//   명령-args 를 즉시 자가 검증한다. consistency 모듈은 descriptor·command-args 타입만
//   `import type` 로 참조하고 본 빌더를 value import 하지 않으므로(consistency →
//   command-args value 엣지 0) 런타임 순환 의존이 없다(command-args → consistency 만
//   런타임 엣지). T-0982/T-0983/T-0985/T-0987/T-0989 self-wire mirror.
import { assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-body-marker";
import { assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-consistency";
import { assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-command-args-labels-title";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";

// dual-leg run report 이슈 고정 labels — 결정론적 상수 집합. 호출마다 동일하며,
// `gh issue create` 의 `--label` 인자로 쓰인다. 빌더는 매 호출 이 상수의 **복제본**을
// 반환해 무공유를 보존한다.
const DUAL_LEG_RUN_REPORT_ISSUE_LABELS: readonly string[] = [
  "realdata-e2e",
  "daily-step-dual-leg-run-report",
];

// RealDataDailyStepDualLegRunReportIssueCreateArgs — `gh issue create` 의 인자 묶음.
//   - title: descriptor.title 그대로(결정론적 이슈 제목).
//   - body: descriptor.body 그대로(marker 라인 + 렌더 본문 — 멱등 검색 토큰 보존).
//   - labels: 고정 결정론 labels 의 새 배열(무공유).
export interface RealDataDailyStepDualLegRunReportIssueCreateArgs {
  title: string;
  body: string;
  labels: string[];
}

// RealDataDailyStepDualLegRunReportIssueUpdateArgs — 기존 이슈 발견 시 `gh issue edit`
// 의 인자 묶음.
//   - title: descriptor.title 그대로.
//   - body: descriptor.body 그대로(marker 라인 보존 — 갱신 후에도 멱등 검색 가능).
export interface RealDataDailyStepDualLegRunReportIssueUpdateArgs {
  title: string;
  body: string;
}

// RealDataDailyStepDualLegRunReportIssueCommandArgs — daily-test dual-leg run report
// 이슈의 멱등 search-or-update 명령-args 묶음. caller(live wiring)는 searchQuery 로
// 기존 이슈를 검색해 없으면 createArgs 로 생성, 있으면 updateArgs 로 갱신한다(어느 쪽을
// 실행할지는 caller 책임).
//   - searchQuery: descriptor.marker 기반 검색 문자열(동일 run 의 기존 이슈 식별).
//   - createArgs: `gh issue create` 인자({title, body, labels}).
//   - updateArgs: `gh issue edit` 인자({title, body}).
export interface RealDataDailyStepDualLegRunReportIssueCommandArgs {
  searchQuery: string;
  createArgs: RealDataDailyStepDualLegRunReportIssueCreateArgs;
  updateArgs: RealDataDailyStepDualLegRunReportIssueUpdateArgs;
}

// 빈/공백-only 식별자 guard — 비식별 이슈 명령 생성(잘못된 제목·검색 토큰)을 방지하기
// 위해 title / marker 가 빈 문자열·공백-only 면 명시적 throw 한다(조용한 통과 차단).
// T-0583 command-args 빌더·T-0896 descriptor 빌더의 `assertNonBlank` 규약과 동형.
function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `RealDataDailyStepDualLegRunReportIssueDescriptor.${fieldName} 가 비어있습니다 — 비식별 dual-leg run report 이슈 명령 생성 방지를 위해 빈/공백-only 값은 허용되지 않습니다.`,
    );
  }
}

// buildRealDataDailyStepDualLegRunReportIssueCommandArgs — dual-leg run report 이슈
// descriptor 를 gh issue 멱등 search-or-update 명령-args 묶음으로 변환하는 **순수 함수**.
//
// 분기:
//   - guard: descriptor.title 빈/공백 → throw, descriptor.marker 빈/공백 → throw(각
//     필드 별 분기). 비식별 이슈 명령 생성을 차단한다.
//   - 정상: searchQuery(marker) / createArgs({title, body, labels 복제}) /
//     updateArgs({title, body}) 합성. create/update 양쪽 body 에 descriptor.body 그대로
//     전달 — marker 라인이 두 경로 모두에 보존된다(멱등성).
//
// 순수성·무공유:
//   - 입력 `descriptor` 를 읽기만 한다(mutate 0). 매 호출이 새 명령-args 객체 +
//     새 createArgs / updateArgs + 새 labels 배열을 반환 — 입력 / 다음 호출 결과와 무공유.
export function buildRealDataDailyStepDualLegRunReportIssueCommandArgs(
  descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor,
): RealDataDailyStepDualLegRunReportIssueCommandArgs {
  // 식별자 guard — 필드별·빈/공백별 분기마다 명시적 throw.
  assertNonBlank(descriptor.title, "title");
  assertNonBlank(descriptor.marker, "marker");

  const commandArgs: RealDataDailyStepDualLegRunReportIssueCommandArgs = {
    // searchQuery — marker 그대로(later live wiring 의 동일 run 검색 토큰).
    searchQuery: descriptor.marker,
    createArgs: {
      title: descriptor.title,
      body: descriptor.body,
      // 매 호출 새 배열 복제 — 반환 labels mutate 가 상수·다음 호출에 누설되지 않음.
      labels: [...DUAL_LEG_RUN_REPORT_ISSUE_LABELS],
    },
    updateArgs: {
      title: descriptor.title,
      body: descriptor.body,
    },
  };

  // 🔥 self-wire drift-guard (T-0991): 명령-args 를 반환하기 **직전** 독립 oracle 가드를
  //   스스로 호출해 산출 즉시 자가 검증한다. 정합 산출이면 tautology(항상 void)라 정상
  //   동작을 바꾸지 않고, 조립 규칙(searchQuery=marker·createArgs 3필드·updateArgs 2필드·
  //   labels 상수 복제)과 oracle 규칙이 어긋나는 순간 모든 호출 경로(unit spec·이슈 박제
  //   재사용)에서 즉시 throw 하는 live 트립와이어가 된다 — spec 커버리지에 의존하지 않는다.
  assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent(
    descriptor,
    commandArgs,
  );

  // 🔥 self-wire body marker-first 정합 가드 (T-1009, 요약축 T-0650 mirror): 명령-args 를
  //   반환하기 **직전** T-1008 이 신설한 body 축 불변식 가드를 스스로 호출해 산출 즉시 자가
  //   검증한다. createArgs/updateArgs body 가 descriptor.body 와 byte-identical 하고 두 body
  //   가 marker-first 이며 searchQuery 가 descriptor.marker 와 일치하는지의 4 불변식을 강제한다.
  //   정합 산출이면 tautology(항상 void)라 정상 동작·반환값을 byte-identical 로 보존하고, body
  //   전파 회귀(createArgs/updateArgs body drift·marker-first 위반·searchQuery drift)가 생기는
  //   순간 손상 명령-args 를 caller(live wiring)로 반환하기 전에 fail-fast throw 한다 — spec
  //   커버리지에 의존하지 않는 live 트립와이어. 기존 Consistent 가드(T-0991)와 축이 다르며(body
  //   marker-first 좁은 축) 나란히 배선한다. 같은 `test/helpers/` 디렉토리 함수 호출이라 runtime
  //   cycle 0.
  assertRealDataDailyStepDualLegRunReportIssueCommandArgsBodyPreservesDescriptor(
    commandArgs,
    descriptor,
  );

  // 🔥 self-wire labels·title 정합 가드 (T-1011, 요약축 T-0652 mirror): 명령-args 를
  //   반환하기 **직전** T-1010 이 신설한 labels·title 축 불변식 가드를 스스로 호출해 산출
  //   즉시 자가 검증한다. create/update title 이 descriptor.title 과 byte-identical 하고
  //   createArgs.labels 가 고정 상수 `DUAL_LEG_RUN_REPORT_ISSUE_LABELS` 와 순서·원소·개수까지
  //   exact match 이며 상수 참조와 무공유(복제)인지의 4 불변식을 강제한다. 정합 산출이면
  //   tautology(항상 void)라 정상 동작·반환값을 byte-identical 로 보존하고, title 전파 회귀
  //   (create/update title 이 descriptor.title 과 drift)나 labels 배선 회귀(상수와 어긋난
  //   순서·원소, 또는 상수 참조를 복제 없이 반환한 무공유 위반)가 생기는 순간 손상 명령-args 를
  //   caller(live wiring)로 반환하기 전에 fail-fast throw 한다 — spec 커버리지에 의존하지 않는
  //   live 트립와이어. 기존 Consistent 가드(T-0991)·body marker-first 가드(T-1009)와 축이
  //   다르며(labels·title 좁은 축) 그 옆에 세 번째로 나란히 배선한다. 빌더가 보유한 고정 labels
  //   상수를 expectedLabels 로 넘긴다. 같은 `test/helpers/` 디렉토리 함수 호출이라 runtime
  //   cycle 0.
  assertRealDataDailyStepDualLegRunReportIssueCommandArgsLabelsTitleConsistent(
    commandArgs,
    descriptor,
    DUAL_LEG_RUN_REPORT_ISSUE_LABELS,
  );

  return commandArgs;
}
