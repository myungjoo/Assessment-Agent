// realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor-identity-consistency.ts —
// 실 평가 e2e daily-step dual-leg run report 의 issue descriptor 의 title·marker 가 run
// 식별자(`${dateToken}@${gitSha}`)로부터 **독립 재유도**한 expected title·marker 와
// byte-identical 정합한지 검증하는 순수 가드 (T-1024 박제, 요약축 T-0709 mirror).
//
// 동기: leaf 빌더 `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(T-0896,
// `realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts`)은 daily-test dual-leg
// run report 를 rolling-issue 박제용 `{ title, marker, body }` descriptor 로 합성한다.
// daily 축은 그 descriptor 정합을 `assertRealDataDailyStepDualLegRunReportIssueDescriptorBodyConsistent`
// (`-issue-descriptor-body-consistency.ts`; T-0988 당시엔 단일 **combined** 가드로 `{title,
// marker, body}` 를 한꺼번에 재유도·대조했다가 T-1026 에서 body-focus 로 축소·T-1027 에서 개명)
// 로 지킨다. 반면 요약축(`result-issue-*`)은 descriptor 정합을 2 개의 disjoint 가드로
// 나눈다:
//   - `assertRealDataResultIssueDescriptorBodyConsistent`(T-0646) — body 3 블록 구조만.
//   - `assertRealDataResultIssueDescriptorIdentityConsistent`(T-0709) — title·marker 의
//     멱등 식별자(run token 공유) 재유도 정합만 검증하는 **전용 identity oracle**.
// 즉 요약축이 body 축과 분리해 유지하는 idempotency(identity) 전용 oracle 이 daily 축에는
// 부재했다(genuine 구조 미동형 gap — origin/main daily helper 에 `DescriptorIdentityConsistent`
// 심볼 부재 확인). 본 가드가 그 빈칸을 채운다.
//
// 본 가드는 producer `buildRealDataDailyStepDualLegRunReportIssueDescriptor`(T-0896)를
// **재호출하지 않고**, combined 가드(T-0988)를 **import 하지 않고**, `report` 의 gitSha·
// dateToken 만으로 expected title·marker 를 **독립 재구현 재유도**한 뒤 실제 descriptor 의
// title·marker 와 byte-identical 대조한다. body 3 블록 구조는 본 가드의 관심사가
// 아니다(combined 가드 T-0988 및 마크다운 renderer T-0895 domain — 본 identity oracle 은
// title·marker 축만). 손상된 식별자(title 과 marker 의 run token 이 어긋나거나, marker 가
// 다른 run token 을 담아 멱등 검색이 깨지는) descriptor 가 실 gh issue search-or-update
// 분기로 새기 전 fail-fast throw 로 차단한다.
//
// 검증하는 불변식(single source — producer 재호출 0, title·marker 합성 규칙 독립 재구현):
//   ① descriptor.title  === `${ISSUE_TITLE_PREFIX} ${dateToken}@${gitSha}` (재유도 byte-identical).
//   ② descriptor.marker === `${ISSUE_MARKER_PREFIX} ${dateToken}@${gitSha} -->` (재유도 byte-identical).
//   ③ title 과 marker 가 **동일 run token** 을 담는다(멱등 불변식) — ①∧② 가 둘을 각각 동일
//      expectedToken 기반 expected 와 대조하므로 token 동치는 ①∧② 에 의해 함의(서로 다른
//      token 이면 ① 또는 ② 가 먼저 catch). 별도 교차 비교 분기는 dead branch 라 두지 않는다.
//   ④ report.gitSha / report.dateToken 이 빈/공백-only 면 비식별 박제 방지로 거부(producer
//      assertNonBlank 규칙 mirror) — 그런 report 는 정상 통과시키지 않는다.
//
// 에러 정책(구조 결손 = TypeError / 값 정합 위반 = RangeError / 비식별 식별자 = producer 동형 Error):
//   - `descriptor` / `report` null/undefined·비객체·title/marker/gitSha/dateToken 비-string
//     (구조/타입 결손) → 한국어 TypeError.
//   - report.gitSha / report.dateToken 빈/공백-only(비식별 식별자) → producer(T-0896)와 동형
//     Error(daily 축 combined 가드 T-0988 규약 동형, ④).
//   - 독립 재유도 expected 와 입력 drift(title mismatch / marker mismatch / title·marker run
//     token 불일치 / prefix·닫는 `-->` 어긋남) → 한국어 RangeError(기대 vs 실측 노출).
//   - silent 통과 0. 검사 순서: 구조(descriptor / report) → 빈/공백 거부 → 재유도 →
//     title·marker byte-identical 대조. 가장 먼저 위반한 지점에서 throw(fail-fast).
//
// 비변형 / 순수: `descriptor`(읽기·비교만) / `report`(읽기만, mutate 0). 재유도용 새 string 만
// 생성. 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM·실 네트워크 0 · 새 외부 dependency 0 ·
// env/credential 0 · zod·ajv 등 외부 validation 0. 동일 입력 → 동일 동작(정상 descriptor 면
// 항상 void, 손상 descriptor 면 항상 동일 위치 throw). raw 활동 본문 미저장(R-59 / REQ-032) —
// title·marker 식별자 문자열만 재유도·대조(narrative/raw 미접촉).
//
// prefix·token 합성 규칙 single source 정합(중복 정의 회피):
//   - `RealDataDailyStepDualLegRunReportIssueDescriptor` / `RealDataDailyStepDualLegRunReport`
//     타입은 producer(T-0896)에서 import 재사용한다(타입 재정의 0). producer 의
//     `ISSUE_TITLE_PREFIX`/`ISSUE_MARKER_PREFIX` 상수는 모듈 private(export 부재)이라 import
//     할 수 없으므로(producer 본문 수정은 task Out of Scope), 본 가드는 prefix 와 token 합성
//     규칙을 **독립 재구현**한다. producer 출력과의 drift 위험은 colocated spec 이 실
//     `buildRealDataDailyStepDualLegRunReportIssueDescriptor` 산출물을 happy-path fixture 로
//     재사용하는 paired 교차 검증으로 차단한다(재유도가 producer 와 byte-identical 함을 spec 이 증명).
//
// Out of Scope (T-1024): producer 본문 수정 / self-wire 배선(가드를 producer return 직전 호출 —
// 후속 별도 slice) · combined 가드(T-0988)를 body-focus 로 좁히기(후속 slice) · prefix 값·token
// 합성 규칙 변경 · body 3 블록 구조 재검증(T-0988·T-0895 담당) · production src 변경 · 자동
// 복구/descriptor 재합성/정규화 · zod·ajv 등 외부 validation 도입 — 전부 0.
import type { RealDataDailyStepDualLegRunReport } from "./realdata-e2e-daily-step-dual-leg-run-report";
import type { RealDataDailyStepDualLegRunReportIssueDescriptor } from "./realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor";

// 이슈 제목 prefix — producer(`realdata-e2e-daily-step-dual-leg-run-report-issue-descriptor.ts`
// L84)의 ISSUE_TITLE_PREFIX 와 동형이되 의도적으로 독립 재정의한다(producer 상수가 module
// private 라 import 불가 + 본 가드는 합성 규칙을 재호출이 아니라 재구현해야 drift 를 잡는다).
// producer 와의 byte-identical 정합은 spec 의 paired 교차 검증이 보장한다.
const EXPECTED_ISSUE_TITLE_PREFIX =
  "실 평가 e2e daily-step dual-leg run report";

// 멱등 marker prefix — producer L88 의 ISSUE_MARKER_PREFIX 독립 재정의(위와 동일 이유).
const EXPECTED_ISSUE_MARKER_PREFIX =
  "<!-- realdata-e2e-daily-step-dual-leg-run-report-issue:";

// marker 의 닫는 토큰 — producer L147 `${ISSUE_MARKER_PREFIX} ${token} -->` 의 trailing ` -->`.
// expected marker 합성에 쓰인다(닫는 '-->' 누락 손상도 ② 재유도 대조가 catch).
const MARKER_CLOSE_TOKEN = " -->";

// describe — 에러 메시지용 타입 라벨. null/array 를 typeof 가 뭉뚱그리는 'object' 대신 구분해
// 노출한다(디버깅 가독성). 요약축 identity 가드(T-0709) 동형.
function describe(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

// isPlainRecord — value 가 plain 객체(Record)인지 판정. null/array 는 제외한다(descriptor /
// report 구조 검증용).
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// isBlank — string 이 빈 문자열·공백-only 인지 판정. producer assertNonBlank(L115~121)의
// `value.trim().length === 0` 규칙을 mirror 재구현한다(비식별 식별자 거부 — ④).
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

// assertDescriptorStructure — descriptor 객체와 필수 string 필드(title / marker)가 구조적으로
// 온전한지 fail-fast 검증. 구조/타입 결손은 RangeError 가 아니라 TypeError 로 구분한다. body
// 는 identity 축의 관심사가 아니므로 검증하지 않는다(combined 가드 T-0988 domain).
function assertDescriptorStructure(
  descriptor:
    | RealDataDailyStepDualLegRunReportIssueDescriptor
    | null
    | undefined,
): asserts descriptor is RealDataDailyStepDualLegRunReportIssueDescriptor {
  if (!isPlainRecord(descriptor)) {
    throw new TypeError(
      `descriptor 가 객체가 아니다(타입: ${describe(descriptor)}) — RealDataDailyStepDualLegRunReportIssueDescriptor 가 필요하다.`,
    );
  }
  const title = (descriptor as { title?: unknown }).title;
  if (typeof title !== "string") {
    throw new TypeError(
      `descriptor.title 이 문자열이 아니다(타입: ${describe(title)}) — title 재유도 대조를 진행할 수 없다.`,
    );
  }
  const marker = (descriptor as { marker?: unknown }).marker;
  if (typeof marker !== "string") {
    throw new TypeError(
      `descriptor.marker 가 문자열이 아니다(타입: ${describe(marker)}) — marker 재유도 대조를 진행할 수 없다.`,
    );
  }
}

// assertReportStructure — report 객체와 필수 string 필드(gitSha / dateToken)가 구조적으로
// 온전한지 fail-fast 검증. 구조/타입 결손은 TypeError(빈/공백 거부 Error 와 분리 — 타입은
// 맞지만 값이 비식별인 경우는 producer 와 동형 Error). identity 재유도에 필요한 두 식별자
// 필드만 검사한다(eval/collect/overallStatus/summaryLine 는 identity 축 무관).
function assertReportStructure(
  report: RealDataDailyStepDualLegRunReport | null | undefined,
): asserts report is RealDataDailyStepDualLegRunReport {
  if (!isPlainRecord(report)) {
    throw new TypeError(
      `report 가 객체가 아니다(타입: ${describe(report)}) — RealDataDailyStepDualLegRunReport 가 필요하다.`,
    );
  }
  const gitSha = (report as { gitSha?: unknown }).gitSha;
  if (typeof gitSha !== "string") {
    throw new TypeError(
      `report.gitSha 가 문자열이 아니다(타입: ${describe(gitSha)}) — run token 재유도를 진행할 수 없다.`,
    );
  }
  const dateToken = (report as { dateToken?: unknown }).dateToken;
  if (typeof dateToken !== "string") {
    throw new TypeError(
      `report.dateToken 이 문자열이 아니다(타입: ${describe(dateToken)}) — run token 재유도를 진행할 수 없다.`,
    );
  }
}

// assertNonBlank — producer(T-0896)/combined 가드(T-0988)의 `assertNonBlank` 규약과 동형(plain
// Error). gitSha/dateToken 이 빈/공백-only 면 비식별 이슈 박제로 간주해 재유도 단계에서 명시
// throw(조용한 통과 차단). producer 가 이 경우 descriptor 산출을 거부하므로, 정합 descriptor 가
// 존재할 수 없는 비식별 입력을 가드가 재유도(및 대조) 전에 producer 와 동형 Error 로 먼저
// 차단한다(④).
function assertNonBlank(value: string, fieldName: string): void {
  if (isBlank(value)) {
    throw new Error(
      `RealDataDailyStepDualLegRunReport.${fieldName} 가 비어있습니다 — 비식별 dual-leg run report 이슈 박제 방지를 위해 빈/공백-only 식별자는 허용되지 않습니다.`,
    );
  }
}

/**
 * 실 평가 e2e daily-step dual-leg run report 의 issue descriptor 의 title·marker 가 run
 * 식별자로부터 독립 재유도한 expected title·marker 와 byte-identical 정합함을 런타임에서
 * 검증하는 순수 가드(PLAN.md P5 L109 실 평가 e2e daily-step 결과 박제 chain 의 identity-layer
 * 무결성 조각 / REQ-032·REQ-059). 요약축 `assertRealDataResultIssueDescriptorIdentityConsistent`
 * (T-0709)의 daily-step mirror — daily combined 가드(T-0988)가 title·marker·body 를 한꺼번에
 * 검증하는 것과 별개로, title·marker 의 멱등 식별자 재유도만 focused 하게 지키는 전용 oracle.
 *
 * 검증하는 불변식(single source — producer 재호출 0, title·marker 합성 규칙 독립 재구현):
 *   ① descriptor.title  === `${ISSUE_TITLE_PREFIX} ${dateToken}@${gitSha}`.
 *   ② descriptor.marker === `${ISSUE_MARKER_PREFIX} ${dateToken}@${gitSha} -->`.
 *   ③ title 과 marker 가 동일 run token 을 담는다(멱등 불변식 — ①∧② 에 의해 함의).
 *   ④ report.gitSha / report.dateToken 빈/공백-only 거부(비식별 박제 방지, producer assertNonBlank mirror).
 *
 * 에러 정책(구조 결손 = TypeError / 비식별 식별자 = producer 동형 Error / 값 정합 위반 = RangeError):
 *   - `descriptor` / `report` null/undefined·비객체·title/marker/gitSha/dateToken 비-string → 한국어 TypeError.
 *   - report.gitSha / report.dateToken 빈/공백-only → producer 와 동형 Error(④).
 *   - 재유도 drift(title/marker mismatch·prefix·닫는 `-->` 어긋남) → 한국어 RangeError(기대 vs 실측 노출).
 *   - silent 통과 0. 검사 순서: 구조 → 빈/공백 거부 → 재유도 → byte-identical 대조. fail-fast.
 *
 * 비변형 / 순수: `descriptor`/`report` 를 읽기·비교만 한다(쓰기 0). 재유도용 새 string 만
 * 생성. 부수효과 0 · 새 외부 dependency 0. 동일 입력 → 동일 동작.
 *
 * @param descriptor 검증 대상 producer 산출 descriptor. 변형하지 않는다(읽기·비교만). title /
 *   marker 가 문자열이어야 하며 재유도 expected 와 byte-identical 해야 한다. body 는 미검증.
 * @param report 본 가드가 expected title·marker 를 재유도할 single-source run report. 변형하지
 *   않는다(읽기만). gitSha / dateToken 이 non-blank string 이어야 한다.
 * @returns 불변식 ①~④ 를 모두 만족하면 정상 반환(void).
 * @throws {TypeError} `descriptor` / `report` 구조·타입 결손.
 * @throws {Error} report.gitSha / report.dateToken 빈/공백-only(비식별 식별자, producer 동형).
 * @throws {RangeError} 독립 재유도 expected 와 입력 drift(값 정합 위반).
 */
export function assertRealDataDailyStepDualLegRunReportIssueDescriptorIdentityConsistent(
  descriptor: RealDataDailyStepDualLegRunReportIssueDescriptor,
  report: RealDataDailyStepDualLegRunReport,
): void {
  // 구조 검증(TypeError 분기) — descriptor / report 객체 + title/marker/gitSha/dateToken string.
  assertDescriptorStructure(descriptor);
  assertReportStructure(report);

  // 빈/공백 식별자 거부(producer 동형 Error 분기, 불변식 ④) — producer assertNonBlank mirror.
  // 비식별 식별자는 정상 통과시키지 않는다(필드별 분기).
  assertNonBlank(report.gitSha, "gitSha");
  assertNonBlank(report.dateToken, "dateToken");

  // run token 독립 재유도 — producer runToken(L108~110) `${dateToken}@${gitSha}` 재구현(재호출 0).
  const expectedToken = `${report.dateToken}@${report.gitSha}`;
  const expectedTitle = `${EXPECTED_ISSUE_TITLE_PREFIX} ${expectedToken}`;
  const expectedMarker = `${EXPECTED_ISSUE_MARKER_PREFIX} ${expectedToken}${MARKER_CLOSE_TOKEN}`;

  // 불변식 ① — title 재유도 대조(byte-identical). prefix·token 어느 쪽이 drift 해도 catch.
  if (descriptor.title !== expectedTitle) {
    throw new RangeError(
      `정합 위반: descriptor.title 이 report 로부터 재유도한 expected title 과 다르다 — 기대='${expectedTitle}', 실측='${descriptor.title}'. prefix 또는 run token 합성이 drift 했다.`,
    );
  }

  // 불변식 ② — marker 재유도 대조(byte-identical). prefix·token·닫는 `-->` 어느 쪽이 drift 해도 catch.
  if (descriptor.marker !== expectedMarker) {
    throw new RangeError(
      `정합 위반: descriptor.marker 가 report 로부터 재유도한 expected marker 와 다르다 — 기대='${expectedMarker}', 실측='${descriptor.marker}'. prefix·run token·닫는 '-->' 중 하나가 drift 했다.`,
    );
  }

  // 불변식 ③(멱등 token 동치)은 ①∧② 에 의해 함의된다 — title 과 marker 가 각각 동일
  // `expectedToken`(= `${dateToken}@${gitSha}`)으로부터 재유도한 expected 와 byte-identical
  // 하므로, 둘이 담은 run token 도 필연적으로 동일하다(서로 다른 token 이면 ① 또는 ② 가 먼저
  // catch). 별도 교차 추출·비교 분기는 ①∧② 통과 시 항상 참인 dead branch 라 두지 않는다
  // (요약축 T-0709 의 dead-branch 제거 정신 mirror). 멱등 search-or-update 불변식은 ①∧② 가
  // 직접 보장한다(동일 run → 동일 title·marker, leg status/overallStatus 무관).
}
