// realdata-e2e-result-issue-command-args-consistency.ts —
// 실 평가 e2e 결과 이슈 descriptor `{title, marker, body}` 를 gh issue 멱등
// search-or-update 명령-args 묶음으로 변환하는 순수 빌더
// `buildRealDataResultIssueCommandArgs`(T-0583,
// realdata-e2e-result-issue-command-args.ts) 의 산출이 descriptor 필드만으로
// **독립 재유도**한 expected 명령-args 와 필드별 byte-identical 정합한지 검증하는 순수
// 가드(T-1031 박제).
//
// 동기(두 축 parity 복원): daily-step 축(`daily-step-dual-leg-run-report-issue-*`)은
// full-object independent recomposition 오라클
// (`assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent`, T-0990) +
// body-marker + labels-title 삼중 defense-in-depth 를 갖췄으나, 요약축
// (`result-issue-*`)에는 body-marker(`...CommandArgsBodyPreservesDescriptor`, T-0649)·
// labels-title(`...CommandArgsLabelsTitleConsistent`, T-0651) 두 field-focused 가드만
// 있고 **full-object 독립 재합성 오라클이 부재**했다. 즉 요약축은 명령-args 를 field 별
// invariant 로만 검증하고 "전체 객체를 descriptor 만으로 독립 재조립해 통째로 대조"하는
// 축(shape/구조 drift·잉여 필드·조립 규칙 회귀를 잡는 축)이 없었다. 본 가드는 daily 원본을
// 요약축으로 mirror 해 두 축이 동일한 triple-oracle parity 를 갖도록 복원한다.
//
// 봉하는 회귀: 명령-args 빌더의 조립 규칙(searchQuery=descriptor.marker /
// createArgs={title, body, labels 결정론 상수 복제} / updateArgs={title, body} /
// create·update 양쪽 body 에 descriptor.body 그대로 전달해 marker 라인 보존 = 멱등성)이
// 오직 자기 colocated spec 이 그 조합을 커버할 때만 검증된다. 누군가 규칙을 편집
// (searchQuery 를 marker 아닌 title 로 바꾸기 / create·update body 를 서로 다르게 만들어
// 멱등성 파괴 / labels 상수 변경·복제 누락 / title·body pass-through 왜곡)하면서 spec 을
// 함께 고치지 않으면, mislabel/비멱등 명령-args 가 조용히 새어나갈 수 있다. 본 가드는
// descriptor 로부터 expected 명령-args 를 독립 재유도한 뒤 실제 산출과 필드별
// byte-identical 대조해, 값/구조 drift 가 상쇄되지 않고 fail-fast 로 잡히게 한다.
//
// oracle 독립성: **issue-command-args helper(T-0583)를 import 하지 않는다**(재호출은
// 양방향 drift 상쇄가 일어나므로 조립 규칙을 가드 안에 재현해야 회귀가 fail-fast). labels
// 상수 `["realdata-e2e", "result"]`(요약축값 — daily 의 `daily-step-dual-leg-run-report`
// 와 다르므로 반드시 요약축값 사용)도 가드 안에 독립 재현한다. descriptor·command-args
// 타입만 `import type` 로 재사용하므로(중복 정의 0), 이 가드가 나중에 producer 에 value
// import 로 배선돼도 런타임 순환 의존이 생기지 않는다(consistency → command-args value
// 엣지 0).
//
// 에러 정책(구조 결손 = TypeError / 값 drift = RangeError): commandArgs 가 null/undefined·
// 비-객체·searchQuery/createArgs/updateArgs 필드 부재·비-객체·createArgs.title/body 비-string·
// createArgs.labels 비-배열·요소 비-string·updateArgs.title/body 비-string → 한국어 TypeError.
// descriptor.title/marker 빈/공백-only 면 재유도 단계에서 producer(T-0583)와 동형 Error(비식별
// 이슈 명령 방지)를 던진다. 독립 재유도 expected 와 command-args drift(searchQuery≠marker /
// title·body 불일치 / labels 요소·순서·개수 불일치) → 한국어 RangeError(기대 vs 실측 노출).
// silent 통과 0, fail-fast. 공백·줄바꿈·대소문자·배열 순서 민감(trim·case-fold 0).
//
// 비변형 / 순수: descriptor·command-args 읽기·비교만(쓰기 0). 부수효과·`@Injectable`·Prisma·
// LLM·새 외부 dependency·env/네트워크/credential 0. 동일 입력 → 동일 동작. raw 활동 본문
// (commit/PR/issue payload) 미저장(R-59 / REQ-032) — descriptor·command-args 구조만 재유도.
//
// Out of Scope (T-1031): producer 본문 수정 / self-wire 배선(후속 slice, daily T-1024→T-1025
// create→self-wire cadence mirror) · descriptor 빌더(T-0582)·자매 가드(body-marker T-0649 /
// labels-title T-0651) 로직·signature 수정 · daily 축 파일 일체(read-only mirror source) ·
// 자동 복구/재합성/정규화 · zod·ajv 등 외부 validation 도입 — 전부 0. arg-order 는 T-1030 이
// daily 에서 확정한 artifact-first `(commandArgs, descriptor, label?)` 로 태어난다.
import type {
  RealDataResultIssueCommandArgs,
  RealDataResultIssueCreateArgs,
  RealDataResultIssueUpdateArgs,
} from "./realdata-e2e-result-issue-command-args";
import type { RealDataResultIssueDescriptor } from "./realdata-e2e-result-issue-descriptor";

// producer(T-0583)의 고정 labels 상수 미러링 — command-args helper 를 import 하지 않고
// 규칙만 독립 재현한다(재호출은 양방향 drift 상쇄가 일어나므로 재구현해야 회귀가 fail-fast).
// 요약축 라벨은 daily 의 `daily-step-dual-leg-run-report` 와 다르니 반드시 요약축값 사용.
const RESULT_ISSUE_LABELS: readonly string[] = ["realdata-e2e", "result"];

// 에러 메시지 접두 — 선택 label 을 붙여 어느 대조 지점에서 drift/결손이 났는지 식별한다.
function contextPrefix(label?: string): string {
  return label !== undefined && label.length > 0 ? `[${label}] ` : "";
}

// assertCommandArgsStructure — `commandArgs` 객체와 searchQuery/createArgs/updateArgs
// 슬롯(+ 하위 필드)이 구조적으로 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가
// 아니라 TypeError 로 구분한다(값 drift 와 분리). 필드별 byte-identical 대조가 undefined
// 접근으로 던지기 전에 명세형 한국어 메시지로 먼저 차단하는 역할이다.
function assertCommandArgsStructure(
  commandArgs: RealDataResultIssueCommandArgs | null | undefined,
  label?: string,
): asserts commandArgs is RealDataResultIssueCommandArgs {
  const ctx = contextPrefix(label);
  if (commandArgs === null || commandArgs === undefined) {
    throw new TypeError(
      `${ctx}commandArgs 가 null/undefined 일 수 없다 — RealDataResultIssueCommandArgs 객체가 필요하다.`,
    );
  }
  if (typeof commandArgs !== "object") {
    throw new TypeError(
      `${ctx}commandArgs 가 객체가 아니다(타입: ${typeof commandArgs}) — issue 명령-args 객체가 필요하다.`,
    );
  }
  if (typeof commandArgs.searchQuery !== "string") {
    throw new TypeError(
      `${ctx}commandArgs.searchQuery 가 string 이 아니다(타입: ${typeof commandArgs.searchQuery}) — 필드별 정합 대조를 진행할 수 없다.`,
    );
  }
  assertCreateArgsStructure(commandArgs.createArgs, label);
  assertUpdateArgsStructure(commandArgs.updateArgs, label);
}

// assertCreateArgsStructure — createArgs 객체와 title/body/labels 슬롯 구조 검증.
function assertCreateArgsStructure(
  createArgs: RealDataResultIssueCreateArgs | null | undefined,
  label?: string,
): asserts createArgs is RealDataResultIssueCreateArgs {
  const ctx = contextPrefix(label);
  if (createArgs === null || createArgs === undefined) {
    throw new TypeError(
      `${ctx}commandArgs.createArgs 가 null/undefined 일 수 없다 — {title, body, labels} 객체가 필요하다.`,
    );
  }
  if (typeof createArgs !== "object") {
    throw new TypeError(
      `${ctx}commandArgs.createArgs 가 객체가 아니다(타입: ${typeof createArgs}) — {title, body, labels} 객체가 필요하다.`,
    );
  }
  if (typeof createArgs.title !== "string") {
    throw new TypeError(
      `${ctx}commandArgs.createArgs.title 가 string 이 아니다(타입: ${typeof createArgs.title}) — 필드별 정합 대조를 진행할 수 없다.`,
    );
  }
  if (typeof createArgs.body !== "string") {
    throw new TypeError(
      `${ctx}commandArgs.createArgs.body 가 string 이 아니다(타입: ${typeof createArgs.body}) — 필드별 정합 대조를 진행할 수 없다.`,
    );
  }
  if (!Array.isArray(createArgs.labels)) {
    throw new TypeError(
      `${ctx}commandArgs.createArgs.labels 가 배열이 아니다(타입: ${typeof createArgs.labels}) — labels 정합 대조를 진행할 수 없다.`,
    );
  }
  createArgs.labels.forEach((entry, index) => {
    if (typeof entry !== "string") {
      throw new TypeError(
        `${ctx}commandArgs.createArgs.labels[${index}] 가 string 이 아니다(타입: ${typeof entry}) — labels 요소 정합 대조를 진행할 수 없다.`,
      );
    }
  });
}

// assertUpdateArgsStructure — updateArgs 객체와 title/body 슬롯 구조 검증(labels 없음).
function assertUpdateArgsStructure(
  updateArgs: RealDataResultIssueUpdateArgs | null | undefined,
  label?: string,
): asserts updateArgs is RealDataResultIssueUpdateArgs {
  const ctx = contextPrefix(label);
  if (updateArgs === null || updateArgs === undefined) {
    throw new TypeError(
      `${ctx}commandArgs.updateArgs 가 null/undefined 일 수 없다 — {title, body} 객체가 필요하다.`,
    );
  }
  if (typeof updateArgs !== "object") {
    throw new TypeError(
      `${ctx}commandArgs.updateArgs 가 객체가 아니다(타입: ${typeof updateArgs}) — {title, body} 객체가 필요하다.`,
    );
  }
  if (typeof updateArgs.title !== "string") {
    throw new TypeError(
      `${ctx}commandArgs.updateArgs.title 가 string 이 아니다(타입: ${typeof updateArgs.title}) — 필드별 정합 대조를 진행할 수 없다.`,
    );
  }
  if (typeof updateArgs.body !== "string") {
    throw new TypeError(
      `${ctx}commandArgs.updateArgs.body 가 string 이 아니다(타입: ${typeof updateArgs.body}) — 필드별 정합 대조를 진행할 수 없다.`,
    );
  }
}

// assertNonBlank — producer(T-0583)의 `assertNonBlank` 규약과 동형(plain Error).
// descriptor.title/marker 가 빈/공백-only 면 비식별 이슈 명령으로 간주해 재유도 단계에서
// 명시 throw(조용한 통과 차단). producer 가 이 경우 명령-args 산출을 거부하므로, 정합
// 명령-args 가 존재할 수 없는 비식별 입력을 가드가 필드 대조 전에 producer 와 동형 Error 로
// 먼저 차단한다.
function assertNonBlank(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(
      `RealDataResultIssueDescriptor.${fieldName} 가 비어있습니다 — 비식별 결과 이슈 명령 생성 방지를 위해 빈/공백-only 값은 허용되지 않습니다.`,
    );
  }
}

// composeExpectedCommandArgs — descriptor 필드만으로 expected 명령-args 를 독립 재유도한다.
// producer(T-0583)의 조립 규칙(searchQuery=marker / createArgs={title, body, labels 상수
// 복제} / updateArgs={title, body})을 가드 안에 재구현(producer 재호출 0). assertNonBlank
// 통과 후에만 호출되므로 식별자 비-공백이 보장된다.
function composeExpectedCommandArgs(
  descriptor: RealDataResultIssueDescriptor,
): RealDataResultIssueCommandArgs {
  return {
    searchQuery: descriptor.marker,
    createArgs: {
      title: descriptor.title,
      body: descriptor.body,
      labels: [...RESULT_ISSUE_LABELS],
    },
    updateArgs: {
      title: descriptor.title,
      body: descriptor.body,
    },
  };
}

// assertLabelsConsistent — createArgs.labels 배열이 expected 상수 복제와 요소·순서·개수까지
// byte-identical 정합한지 대조(RangeError 분기). 개수 불일치 → 먼저 throw, 이후 요소별 대조.
function assertLabelsConsistent(
  actual: string[],
  expected: string[],
  ctx: string,
): void {
  if (actual.length !== expected.length) {
    throw new RangeError(
      `${ctx}정합 위반(createArgs.labels 개수): descriptor 로부터 독립 재유도한 expected labels 와 개수가 다르다 — 기대=${expected.length}개(${JSON.stringify(expected)}), 실측=${actual.length}개(${JSON.stringify(actual)}). labels 상수 집합이 drift 했다.`,
    );
  }
  expected.forEach((expectedLabel, index) => {
    if (actual[index] !== expectedLabel) {
      throw new RangeError(
        `${ctx}정합 위반(createArgs.labels[${index}]): descriptor 로부터 독립 재유도한 expected labels 요소와 byte-identical 하지 않다 — 기대='${expectedLabel}', 실측='${actual[index]}'. labels 상수 요소·순서가 drift 했다.`,
      );
    }
  });
}

/**
 * 실 평가 e2e 결과 이슈 박제 **명령-args** `commandArgs` 의 searchQuery / createArgs /
 * updateArgs 각 필드가 `descriptor` 필드만으로 독립 재유도한 명령-args 와 byte-identical
 * 정합함을 런타임에서 검증하는 순수 가드(PLAN.md P5 109행 step ④ 결과-박제 surface 무결성
 * 조각 / REQ-059·REQ-032). producer `buildRealDataResultIssueCommandArgs`(T-0583)의
 * 값·구조-정합 full-object 오라클 — 그 producer 를 재호출하면 조립 로직 자체의 drift 가
 * 양방향 상쇄로 통과하므로, 본 가드는 조립 규칙(searchQuery=marker·createArgs 3필드·
 * updateArgs 2필드·labels 상수)을 독립 재구현해 searchQuery 대체·멱등성 파괴(create·update
 * body 불일치)·labels 변조·pass-through 왜곡 회귀를 fail-fast 로 잡는다. daily 원본
 * `assertRealDataDailyStepDualLegRunReportIssueCommandArgsConsistent`(T-0990)의 요약축
 * mirror — 두 축 triple-oracle parity 복원.
 *
 * 불변식: expected = (searchQuery=descriptor.marker + createArgs={descriptor.title,
 * descriptor.body, ["realdata-e2e", "result"]} + updateArgs={descriptor.title,
 * descriptor.body})를 descriptor 필드만으로 재유도 후 `commandArgs` 와 필드별
 * byte-identical(===, labels 는 요소·순서·개수). command-args helper 재호출 0.
 *
 * 에러 정책: commandArgs null/undefined·비-객체·searchQuery/createArgs/updateArgs 필드
 * 부재·비-객체·createArgs.title/body 비-string·createArgs.labels 비-배열·요소 비-string·
 * updateArgs.title/body 비-string → TypeError. descriptor.title/marker 빈/공백-only(비식별
 * 이슈 명령) → producer 와 동형 Error. 독립 재유도 expected 와 commandArgs drift(searchQuery·
 * title·body·labels) → RangeError(기대 vs 실측 노출). silent 통과 0, fail-fast. 공백·줄바꿈·
 * 대소문자·배열 순서 민감(trim·case-fold 0).
 *
 * @param commandArgs 검증 대상 issue 명령-args(producer 산출). 변형하지 않는다(읽기·비교만).
 * @param descriptor 명령-args 의 single source. 변형하지 않는다(읽기·비교만).
 * @param label 선택 — 에러 메시지에 붙일 대조 지점 식별자.
 * @returns 정합하면 정상 반환(void).
 * @throws {TypeError} commandArgs 구조 결손(null/비-객체·필드 부재·비-string·labels 비-배열).
 * @throws {Error} descriptor.title/marker 빈/공백-only(producer 와 동형).
 * @throws {RangeError} 독립 재유도 expected 와 commandArgs drift(기대 vs 실측 포함).
 */
export function assertRealDataResultIssueCommandArgsConsistent(
  commandArgs: RealDataResultIssueCommandArgs,
  descriptor: RealDataResultIssueDescriptor,
  label?: string,
): void {
  const ctx = contextPrefix(label);

  // 구조 검증(TypeError 분기) — commandArgs 존재·searchQuery/createArgs/updateArgs 필드 타입.
  assertCommandArgsStructure(commandArgs, label);

  // 비식별 식별자 guard(producer 동형 Error) — producer 가 산출을 거부하는 빈/공백-only
  // 식별자는 정합 명령-args 가 존재할 수 없으므로 재유도(및 필드 대조) 전에 먼저 차단한다.
  assertNonBlank(descriptor.title, "title");
  assertNonBlank(descriptor.marker, "marker");

  // 독립 재유도(producer 재호출 0) — descriptor 필드만으로 expected 를 직접 합성.
  const expected = composeExpectedCommandArgs(descriptor);

  // searchQuery 대조(RangeError 분기) — marker 기반 검색 토큰.
  if (commandArgs.searchQuery !== expected.searchQuery) {
    throw new RangeError(
      `${ctx}정합 위반(searchQuery): commandArgs.searchQuery 가 descriptor 로부터 독립 재유도한 expected 와 byte-identical 하지 않다 — 기대='${expected.searchQuery}', 실측='${commandArgs.searchQuery}'. searchQuery=descriptor.marker 규칙이 drift 했다(marker 아닌 값으로 대체된 의심).`,
    );
  }

  // createArgs 대조(RangeError 분기) — title / body / labels 각 byte-identical.
  if (commandArgs.createArgs.title !== expected.createArgs.title) {
    throw new RangeError(
      `${ctx}정합 위반(createArgs.title): commandArgs.createArgs.title 이 descriptor.title 과 byte-identical 하지 않다 — 기대='${expected.createArgs.title}', 실측='${commandArgs.createArgs.title}'. title pass-through 가 drift 했다.`,
    );
  }
  if (commandArgs.createArgs.body !== expected.createArgs.body) {
    throw new RangeError(
      `${ctx}정합 위반(createArgs.body): commandArgs.createArgs.body 가 descriptor.body 와 byte-identical 하지 않다 — 기대='${expected.createArgs.body}', 실측='${commandArgs.createArgs.body}'. body pass-through(marker 라인 보존) 가 drift 했다.`,
    );
  }
  assertLabelsConsistent(
    commandArgs.createArgs.labels,
    expected.createArgs.labels,
    ctx,
  );

  // updateArgs 대조(RangeError 분기) — title / body 각 byte-identical. create·update body
  // 가 서로 다르면(멱등성 파괴) 이 지점 또는 위 createArgs.body 지점에서 잡힌다.
  if (commandArgs.updateArgs.title !== expected.updateArgs.title) {
    throw new RangeError(
      `${ctx}정합 위반(updateArgs.title): commandArgs.updateArgs.title 이 descriptor.title 과 byte-identical 하지 않다 — 기대='${expected.updateArgs.title}', 실측='${commandArgs.updateArgs.title}'. title pass-through 가 drift 했다.`,
    );
  }
  if (commandArgs.updateArgs.body !== expected.updateArgs.body) {
    throw new RangeError(
      `${ctx}정합 위반(updateArgs.body): commandArgs.updateArgs.body 가 descriptor.body 와 byte-identical 하지 않다 — 기대='${expected.updateArgs.body}', 실측='${commandArgs.updateArgs.body}'. body pass-through(create·update body 동일 = 멱등성) 가 drift 했다.`,
    );
  }
}
