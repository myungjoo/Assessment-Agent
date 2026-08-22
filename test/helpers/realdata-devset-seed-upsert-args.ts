// realdata-devset-seed-upsert-args.ts — R-91 실데이터 규모 검증 dataset(133 명)의 github
// login 을 Prisma upsert-args(`RealDataUpsertArgs[]`) 까지 밀어 올리는 **순수 조립 함수**
// (T-1652 박제). 조립은 기존 두 helper 를 **호출만** 한다 — 변환 로직 재구현 0:
//   1. `buildDevsetSeedDescriptors` / `resolveDevsetSeedDescriptors` (T-1651) 로
//      login → `RealDataSeedDescriptor[]`,
//   2. `buildRealDataUpsertArgs` (T-0716/T-0574) 로 descriptor → `RealDataUpsertArgs[]`.
//
// 🔥 본 slice 경계 — DB write 0 · 워크플로 배선 0. 산출물은 다음 slice 의 runner 가
//   `resolveRealDataPersonId` (T-0575) 로 personId placeholder 만 치환하면 그대로
//   `prisma.person.upsert` / `prisma.serviceIdentity.upsert` 에 넣을 수 있는 형태다.
// 🔥 결정론·무공유 — 입력 외 상태 의존 0. 두 하위 helper 가 모두 매 호출 새 객체 트리를
//   만들므로 caller 의 mutate 가 다음 호출로 전파되지 않는다.
// 🔥 에러 정책 재정의 0 — 구조 결손 `TypeError`(T-1651) · 값 정합 위반 `RangeError`
//   (T-1651 파생 email 중복 · 빈 배열, T-1648 count 범위) 를 **그대로 전파** 한다.
//   본 모듈은 새 throw 를 추가하지 않는다.
// 🔥 외부 의존 0 — 새 dependency 없이 기존 helper 재사용만. 타입은 `import type` 으로만
//   가져와 값 import 를 재사용 함수 3 개로 한정한다(CommonJS 순환 의존 0).
import {
  buildDevsetSeedDescriptors,
  resolveDevsetSeedDescriptors,
} from "./realdata-devset-seed-descriptors";
import { buildRealDataUpsertArgs } from "./realdata-e2e-seed-upsert";
import type { RealDataUpsertArgs } from "./realdata-e2e-seed-upsert";

// buildDevsetSeedUpsertArgs — login 배열 → Prisma upsert-args 배열 순수 함수.
// descriptor 조립과 upsert-args 매핑을 각각 정본 helper 에 위임하므로 본 함수에는
// 조립 규칙이 없다(불변식은 두 helper 의 것을 그대로 승계). 입력 순서를 보존하고
// 매 호출 새 객체 트리를 반환한다.
export function buildDevsetSeedUpsertArgs(
  logins: string[],
): RealDataUpsertArgs[] {
  return buildRealDataUpsertArgs(buildDevsetSeedDescriptors(logins));
}

// resolveDevsetSeedUpsertArgs — fixture 에서 login 을 읽어 같은 매퍼에 통과시킨다.
// 무인자 호출은 133 개(정본 dataset 전량) args. `count` 범위 위반은 T-1648 로더의
// `RangeError` 전파.
export function resolveDevsetSeedUpsertArgs(
  count?: number,
): RealDataUpsertArgs[] {
  return buildRealDataUpsertArgs(resolveDevsetSeedDescriptors(count));
}
