// realdata-e2e-result-issue-action.ts — 실 평가 e2e 결과 이슈 search response →
// create-or-update action 순수 resolver (T-0584 박제).
//
// 책임:
//   - T-0583 의 `buildRealDataResultIssueCommandArgs` 가 결과 이슈 descriptor 를
//     멱등 search-or-update 명령-args 묶음({searchQuery, createArgs, updateArgs})으로
//     산출했다. PLAN.md 109행 step ④ 는 그 결과를 "daily-test result/rolling 이슈에
//     박제"하라 지시한다 — 실 gh issue 호출(create/edit) 직전에 **기존 이슈가 있는지·
//     어느 이슈를 갱신할지** 를 결정하는 분기가 필요하다. 본 helper 가 그 분기 layer 다.
//   - caller(live wiring)는 (1) `gh search issues --json number,title,body` 를 실
//     호출해 JSON 응답을 얻고, (2) 본 resolver 에 그 응답 + marker 를 입력해 action
//     descriptor 를 받고, (3) action 에 따라 T-0583 의 createArgs / updateArgs 중
//     하나로 `gh issue create` 또는 `gh issue edit <issueNumber>` 를 실행한다. 본
//     helper 는 (2) 만 순수 함수로 박제 — 실 gh search 는 여전히 deferred(분기 결정만).
//
// 🔥 멱등 회귀 보호 (최소 번호 update):
//   - 후보(body 가 marker 를 포함하는 hit) 0건 → create(신규 생성).
//   - 후보 1건 → 그 이슈 update.
//   - 후보 2+ 건 → 가장 작은 number(= 가장 오래된 이슈) 를 update — gh search 가
//     우연히 marker 매칭 이슈를 다수 반환해도 신규를 만들지 않고 항상 최초 박제분에
//     누적 갱신해 이슈 중복을 막는다.
//
// 🔥 raw 미저장 정합 (R-59 / REQ-032, data-model.md §4):
//   - 본 resolver 는 hit 의 body 를 marker 포함 여부 판정에만 쓰고 **반환하지 않는다**.
//     출력 action descriptor 는 분기 종류(create/update)와 update 시 issueNumber 만
//     담는다(body / title 보유 0). narrative 본문·raw 활동 본문이 action 으로 새지
//     않는다(불변 보존). step ④ 박제 경계의 분기 layer.
//
// 🔥 결정론적 출력 (동일 입력 → byte-identical):
//   - 입력 외 상태(시각·난수·env) 의존 0. action / issueNumber 전부 입력만의 함수.
//     후보 다수 시 입력 순서가 달라져도 동일 issueNumber(최소값)를 산출한다.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0. 외부 템플릿/
//     해시/CLI 라이브러리 0 — 내장 string/배열 연산만. 순수 함수.
//
// 🔥 무공유 보장 (입력 mutate 0):
//   - 본 resolver 는 입력 `searchHits` 배열·각 hit 객체를 변형하지 않는다(읽기만).
//     호출마다 새 action 객체를 반환 — 입력 / 다음 호출 결과와 무공유.
//
// 🔥 type 분리 (descriptor import 불요):
//   - 본 resolver 는 marker 를 문자열로만 보고 hit body 의 포함 여부만 판정하므로
//     descriptor 타입을 import 하지 않는다(분리 책임). 신규 type 은 입력
//     `RealDataResultIssueSearchHit` + 출력 `RealDataResultIssueAction` 만 정의.
//
// Out of Scope (task T-0584):
//   - gh issue 실 호출 / `gh search issues` / `gh issue create` / `gh issue edit` 실
//     실행(step ④ live wiring — credential gate). 본 resolver 는 분기 결정만 산출.
//   - gh search response 의 실 JSON 파싱 / `--json` 옵션 합성(caller 가 `JSON.parse`
//     해서 `RealDataResultIssueSearchHit[]` 로 전달하는 책임).
//   - `deploy/daily-test.sh` 의 `step_eval` wiring / `latest-result.json` 연동
//     (step ④ live wiring, ADR-0045 LAN gate).
//   - 명령-args 합성 자체(T-0583 위임만 — searchQuery / createArgs / updateArgs 재합성
//     금지). 본 resolver 는 action 분기 + issueNumber 결정만.
//   - title / labels 매칭 — marker(body 안의 안정 문자열) 단일 기준만(분리 책임).
//   - repo slug(`owner/repo`) 결정 / `--repo` 인자 / gh auth — 실 wiring 의 환경 책임.
//   - 외부 템플릿/해시/CLI 라이브러리 도입(새 dependency 0, 내장 string 합성만).
//   - production `src/` 코드 변경 — test helper 단독.

// RealDataResultIssueSearchHit — `gh search issues --json number,title,body` 응답의
// 최소 shape. caller 가 실 호출 결과를 `JSON.parse` 해 본 resolver 에 전달한다.
//   - number: 이슈 번호(gh 응답이 정상이면 항상 양수).
//   - title: 이슈 제목(본 resolver 는 매칭에 쓰지 않음 — marker 단일 기준).
//   - body: 이슈 본문(marker 포함 여부 판정 대상).
export interface RealDataResultIssueSearchHit {
  number: number;
  title: string;
  body: string;
}

// RealDataResultIssueAction — create-or-update 분기 결정의 discriminated union.
//   - {action: 'create'}: 후보 0건 → 신규 이슈 생성.
//   - {action: 'update', issueNumber}: 후보 1+ 건 → 해당(최소 번호) 이슈 갱신.
export type RealDataResultIssueAction =
  | { action: "create" }
  | { action: "update"; issueNumber: number };

// 빈/공백-only marker guard — marker 가 빈/공백-only 면 `body.includes(marker)` 가 모든
// hit 에 매칭되어 의미 없는(전체 매칭) 결과가 나오므로 명시적 throw(조용한 통과 차단).
function assertMarkerNonBlank(marker: string): void {
  if (marker.trim().length === 0) {
    throw new Error(
      "marker 가 비어있습니다 — 빈/공백-only marker 는 모든 hit 에 매칭되어 잘못된 분기를 유발하므로 허용되지 않습니다.",
    );
  }
}

// issue number guard — gh 응답이 정상이면 number 는 항상 양수다. 0 이하면 파싱 사고로
// 간주하고 명시적 throw(비정상 number 가 update issueNumber 로 새는 것을 차단).
function assertPositiveNumber(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `RealDataResultIssueSearchHit.number 가 양의 정수가 아닙니다(${value}) — gh 응답 파싱 사고 방지를 위해 0 이하/비정수 number 는 허용되지 않습니다.`,
    );
  }
}

// resolveRealDataResultIssueAction — gh search 응답(searchHits) + 멱등 marker 를 입력
// 받아 create-or-update 분기를 결정하는 **순수 함수**.
//
// 분기:
//   - guard: marker 빈/공백 → throw. 각 hit 의 number 가 0 이하/비정수 → throw.
//   - 후보(body 가 marker 를 포함하는 hit) 추출:
//       0건 → {action: 'create'}.
//       1+ 건 → {action: 'update', issueNumber: 최소 number}(가장 오래된 이슈, 멱등
//               회귀 보호).
//
// 순수성·무공유:
//   - 입력 `searchHits` 배열·각 hit 객체를 읽기만 한다(mutate 0). 매 호출이 새 action
//     객체를 반환 — 입력 / 다음 호출 결과와 무공유. 후보 다수 시 입력 순서 무관하게
//     동일 issueNumber(최소값)를 산출한다(결정론).
export function resolveRealDataResultIssueAction(
  searchHits: RealDataResultIssueSearchHit[],
  marker: string,
): RealDataResultIssueAction {
  // marker guard — 빈/공백 전체 매칭 사고 차단.
  assertMarkerNonBlank(marker);

  // number guard — 모든 hit 의 number 가 양의 정수임을 선검사(파싱 사고 차단).
  for (const hit of searchHits) {
    assertPositiveNumber(hit.number);
  }

  // 후보 추출 — body 가 marker 를 부분 문자열로 포함하는 hit(읽기만, 입력 mutate 0).
  const candidateNumbers = searchHits
    .filter((hit) => hit.body.includes(marker))
    .map((hit) => hit.number);

  // 후보 0건 → 신규 생성.
  if (candidateNumbers.length === 0) {
    return { action: "create" };
  }

  // 후보 1+ 건 → 최소 번호(가장 오래된 이슈) 갱신(멱등 회귀 보호 — 입력 순서 무관).
  return { action: "update", issueNumber: Math.min(...candidateNumbers) };
}
