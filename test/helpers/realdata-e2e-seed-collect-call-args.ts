// realdata-e2e-seed-collect-call-args.ts — 실 평가 e2e seed descriptor →
// collectForPerson 호출-args 묶음 순수 빌더 (T-0577 박제).
//
// 책임:
//   - T-0576 의 `buildRealDataCollectInput()` 는 seed descriptor 를
//     `CollectForPersonInput`(= `collectForPerson` 의 첫 인자 `person`)로만 매핑했다.
//     그러나 `CollectionEntryService.collectForPerson(person, since, assessmentId)` 는
//     **3 개 인자**를 받는다 — `person` 외에 `since`(incremental 하한)와
//     `assessmentId`(영속화 대상 FK)도 필요하다.
//   - 본 빌더는 그 **완전한 호출-args 묶음**(`{ person, since, assessmentId }`)을
//     build-time 결정론적으로 산출한다. step ②(실 수집 runner)가 받을 호출-args 형태를
//     미리 고정해 build-time 에 검증 가능하게 만든다.
//
// since / assessmentId 결정 근거:
//   - `since=undefined` — 실 seed Person 은 직전 Assessment 가 없는 신규 인원이다.
//     `SinceDerivationService` §4 의 신규-인원 계약(직전 Assessment 부재 → undefined =
//     full collection)과 정합한다. 본 빌더는 DB 접근 없이 신규-인원 `since=undefined`
//     만 build-time 산출한다(실 deriveSince 호출은 Out of Scope).
//   - `assessmentId=ASSESSMENT_ID_PLACEHOLDER` — assessment.id 는 DB write 시점에
//     결정되므로 placeholder 로 둔다(T-0575 의 personId placeholder 치환 패턴과 동형).
//     실 assessment.id 치환 runner 는 별도 후속 slice.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0.
//   - 순수 함수 — 입력 외 상태 의존 0, 호출마다 새 객체 트리 반환(공유 mutable 노출 0).
//
// 🔥 raw 활동 데이터 없음 (R-59):
//   - 본 빌더는 기존 `buildRealDataCollectInput` 결과 위에 since/assessmentId 만
//     얹는다. commit/PR/issue 본문 등 raw 외부 활동 데이터는 구조적으로 포함될 수 없다.
//
// 🔥 type 재사용 (중복 정의 0):
//   - `CollectForPersonInput` 은 production 소스에서, `RealDataSeedDescriptor` /
//     `buildRealDataCollectInput` 은 기존 helper 에서 import 재사용한다. 본 helper 가
//     별도 매핑을 복제하지 않고 기존 매퍼 위에 조립해 단일 진실 원천(SSOT)을 유지한다.
//
// Out of Scope (task T-0577):
//   - 실 github.com 네트워크 fetch / 실 활동 수집 호출(step ② live, LAN/credential gate).
//   - 실 SinceDerivationService.deriveSince 호출(DB 접근 — 본 빌더는 since=undefined 만).
//   - ASSESSMENT_ID_PLACEHOLDER → 실 assessment.id 치환 runner(별도 후속 slice).
//   - CollectionEntryService / SinceDerivationService / production `src/` 코드 변경.
import type { CollectForPersonInput } from "../../src/assessment-collection/collection-entry.service";

import { buildRealDataCollectInput } from "./realdata-e2e-seed-collect-input";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// ASSESSMENT_ID_PLACEHOLDER — assessment.id 는 DB write 시점에 결정되므로 build-time
// 에는 placeholder 로 둔다. step ② runner 가 Assessment row 생성 후 이 placeholder 를
// 실 assessment.id 로 치환한다(T-0575 의 PERSON_ID_PLACEHOLDER 치환 패턴과 동형).
export const ASSESSMENT_ID_PLACEHOLDER = "ASSESSMENT_ID_PLACEHOLDER";

// RealDataCollectCallArgs — `collectForPerson(person, since, assessmentId)` 의 호출-args
// 묶음. 필드 모양은 production 시그니처와 1:1 정합:
//   - person: CollectForPersonInput (production import 재사용, 중복 정의 0).
//   - since: 신규 seed 인원이므로 undefined(full collection). 타입은 production
//     시그니처(`string | undefined`)와 동일.
//   - assessmentId: ASSESSMENT_ID_PLACEHOLDER(DB write 후 치환).
export interface RealDataCollectCallArgs {
  person: CollectForPersonInput;
  since: string | undefined;
  assessmentId: string;
}

// buildRealDataCollectCallArgs — seed descriptor 배열을 collectForPerson 호출-args
// 묶음 배열로 변환하는 **순수 함수**. `person` 은 기존 `buildRealDataCollectInput()`
// 결과를 재사용하고(중복 매핑 0), `since` 는 신규-인원이므로 undefined, `assessmentId`
// 는 ASSESSMENT_ID_PLACEHOLDER 로 둔다.
//
// 분기:
//   - 빈 입력 배열 → 빈 배열 반환(throw 0).
//   - serviceIdentities 빈 descriptor → 빈 serviceIdentities 보존(throw 0, 하위 매퍼 정합).
//   - externalId 가 빈/공백 → 하위 `buildRealDataCollectInput` 의 throw 가 그대로 전파.
//
// 순수성:
//   - 매 호출마다 **새 객체 트리**(배열·중첩 person)를 생성한다(공유 mutable 노출 0).
//     `buildRealDataCollectInput` 이 새 person 트리를 반환하므로 그 결과를 그대로 감싸도
//     입력 seed·다음 호출 결과와 무공유다. ASSESSMENT_ID_PLACEHOLDER 는 string 원시값이라
//     공유돼도 mutate 불가.
export function buildRealDataCollectCallArgs(
  seeds: RealDataSeedDescriptor[],
): RealDataCollectCallArgs[] {
  // person 매핑은 기존 매퍼에 위임(중복 정의 0). buildRealDataCollectInput 이 매
  // 호출 새 트리를 반환하므로 element 단위로 1:1 감싸면 무공유가 보존된다.
  const persons = buildRealDataCollectInput(seeds);
  return persons.map((person) => ({
    person,
    // 신규 seed 인원 — 직전 Assessment 부재 → full collection(SinceDerivationService §4).
    since: undefined,
    // DB write 시점 치환 대상 placeholder.
    assessmentId: ASSESSMENT_ID_PLACEHOLDER,
  }));
}
