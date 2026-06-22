// realdata-e2e-seed-collect-input.ts — 실 평가 e2e seed descriptor → CollectForPersonInput
// 순수 매퍼 (T-0576 박제).
//
// 책임:
//   - T-0573 의 `buildRealDataE2eSeed()` 가 산출하는 `RealDataSeedDescriptor[]` 를
//     수집 경계(`CollectionEntryService.collectForPerson`)가 받는 입력 contract
//     `CollectForPersonInput[]` 로 변환한다. 실제 수집 호출은 하지 않는다 — 입력
//     객체 트리만 결정론적으로 반환.
//   - 실 평가 e2e bullet(PLAN.md 109행)의 step ②(수집) 경계를 메운다. 직전 chain
//     (T-0574 upsert-args / T-0575 person-id 치환)이 영속 경계를 닫았다면, 본 slice
//     는 같은 seed descriptor 를 수집 입력 쪽으로 변환한다. step ②(실 수집,
//     LAN/credential gate)가 이 입력을 `collectForPerson(person, ...)` 의 첫 인자로
//     넘기면, buildCollectionSpec 의 instance 매칭(`service`)과 author 귀속 필터
//     (`externalId`)가 둘 다 동작한다(ADR-0030 §2 — author 귀속 key 는 externalId).
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0.
//   - 순수 함수 — 입력 외 상태 의존 0, 호출마다 새 객체 트리 반환(공유 mutable 노출 0).
//
// 🔥 raw 활동 데이터 없음 (R-59):
//   - service / externalId 식별자만 추려 넘긴다. CollectForPersonInput 자체가
//     serviceIdentities 의 `service`+`externalId` 만 보유하는 최소 shape 이라
//     commit/PR/issue 본문 등 raw 외부 활동 데이터는 구조적으로 포함될 수 없다.
//
// 🔥 type 재사용 (중복 정의 0):
//   - 출력 element 타입 `CollectForPersonInput` 은 production 소스에서 import 한다.
//     본 helper 가 별도 interface 를 복제하면 production 계약과 drift 할 수 있어
//     import 재사용으로 단일 진실 원천(SSOT)을 유지한다.
//
// Out of Scope (task T-0576):
//   - 실 github.com 네트워크 fetch / `assessment-collection` 의 실 활동 수집 호출
//     (step ② 의 live 부분 — LAN/credential gate).
//   - 로컬 Ollama 실 LLM 평가 (step ③, ADR-0045).
//   - CollectionEntryService / production `src/` 코드 변경(타입은 import 재사용만).
import type { CollectForPersonInput } from "../../src/assessment-collection/collection-entry.service";

import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// buildRealDataCollectInput — seed descriptor 배열을 수집 입력 contract 배열로
// 변환하는 순수 함수. 각 descriptor 의 `serviceIdentities` 에서 `service` 와
// `externalId` 만 추려 `CollectForPersonInput.serviceIdentities` 로 매핑한다
// (`isPrimary` 등 수집 입력에 불필요한 필드는 제외 — CollectForPersonInput shape
// 정합).
//
// 분기:
//   - 빈 입력 배열 → 빈 배열 반환(throw 0).
//   - serviceIdentities 가 빈 descriptor → 빈 serviceIdentities 보존(throw 0).
//   - externalId 가 빈/공백 문자열 → 명시적 throw(조용한 통과 차단 — 수집 단계의
//     author 귀속 key 가 비면 귀속 필터가 무력화되므로 build-time 에 막는다).
//
// 순수성:
//   - 매 호출마다 **새 객체 트리**를 생성한다(공유 mutable 상수 노출 0). 입력
//     descriptor 배열·중첩 객체를 변형하지 않으며, 반환값을 호출 측이 mutate 해도
//     입력에 영향이 없다.
export function buildRealDataCollectInput(
  seeds: RealDataSeedDescriptor[],
): CollectForPersonInput[] {
  return seeds.map((seed) => ({
    serviceIdentities: seed.serviceIdentities.map((identity) => {
      const externalId = identity.externalId;
      if (externalId.trim() === "") {
        throw new Error(
          `buildRealDataCollectInput: externalId 가 비어있거나 공백뿐입니다 (service=${identity.service}). 수집 author 귀속 key 가 비면 안 됩니다.`,
        );
      }
      return {
        service: identity.service,
        externalId,
      };
    }),
  }));
}
