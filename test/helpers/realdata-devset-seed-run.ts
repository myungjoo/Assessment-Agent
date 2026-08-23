// realdata-devset-seed-run.ts — R-91 실데이터 규모 검증 dataset(133 명) seed 실행 경로의
// **top-level 진입점** (T-1655 박제). 앞선 네 slice 가 박은 조각을 정해진 순서로 호출만
// 한다 — 변환·검증 로직 재구현 0:
//   ① `resolveDevsetSeedUpsertArgs`(T-1652) 로 fixture login → `RealDataUpsertArgs[]`,
//   ② `upsertDevsetSeedPersons`(T-1653) 로 Person leg 실행 + `email → person.id` 회수,
//   ③ `resolveRealDataPersonId`(T-0575) 로 identity args 의 personId placeholder 치환,
//   ④ `upsertDevsetSeedServiceIdentities`(T-1654) 로 ServiceIdentity leg 실행.
//
// 🔥 순서 근거 — identity 의 `where.personId_service.personId` 는 Person leg 결과(런타임
//   생성 id) 없이는 실값이 될 수 없다. 그래서 ② → ③ → ④ 를 뒤집거나 병렬화할 수 없다.
// 🔥 slice 경계 — 조립 층 하나만(워크플로 배선 · `s1-batch.js` dataset 교체 ·
//   `daily-test.sh` leg · teardown 은 다음 slice). 🔥 client 주입형 — `@prisma/client`
//   값 import 0 · 새 dep 0 · env 0 · 실 DB/네트워크 0(spec 은 mock client).
// 🔥 에러 정책 재정의 0 — 하위 helper 의 `TypeError`/`RangeError`/`Error` 를 **가공 없이
//   그대로 전파**(본 모듈은 새 throw 0 — T-1652 선례 승계). 어느 단계가 throw/reject 하면
//   이후 단계는 호출되지 않는다(fail-fast). 단 client 의 `serviceIdentity` 결손은 ④ 진입
//   시점 검출이라 그때 Person leg 는 이미 적재됐을 수 있다(identity 적재는 0 — 부분 적재의
//   경계가 leg 단위. ①~③ 검증 실패는 client 호출 0 회).
// 🔥 args 무변형(R-59) — 두 반환 Map 은 하위 helper 가 돌려준 그 객체를 그대로 싣는다
//   (재복사 0 · 새 필드 0 · raw 활동 데이터 0).
import { upsertDevsetSeedServiceIdentities } from "./realdata-devset-seed-identity-upsert-runner";
import type { DevsetSeedIdentityClient } from "./realdata-devset-seed-identity-upsert-runner";
import { upsertDevsetSeedPersons } from "./realdata-devset-seed-person-upsert-runner";
import type { DevsetSeedPersonClient } from "./realdata-devset-seed-person-upsert-runner";
import { resolveDevsetSeedUpsertArgs } from "./realdata-devset-seed-upsert-args";
import { resolveRealDataPersonId } from "./realdata-e2e-seed-resolve-person-id";

// DevsetSeedClient — 두 leg runner 의 최소 구조적 계약 교차. 자체 필드 재선언 0 이라
// 실 `PrismaClient` 는 그대로 상위집합으로 대입된다.
export type DevsetSeedClient = DevsetSeedPersonClient &
  DevsetSeedIdentityClient;

// DevsetSeedRunResult — 1 회 seed 실행 요약. 두 count 는 각 leg 반환 Map 의 size(= 실제
// 적재 건수, 입력 건수가 아니다).
export interface DevsetSeedRunResult {
  personCount: number;
  identityCount: number;
  emailToPersonId: Map<string, string>;
  identityKeyToId: Map<string, string>;
}

// runDevsetSeed — 위 ①~④ 를 이 순서대로 호출하는 조립 함수. `count` 무인자면 133 개(정본
// dataset 전량), 범위 위반은 T-1648 로더의 `RangeError` 가 첫 client 호출 이전에 전파된다.
export async function runDevsetSeed(
  client: DevsetSeedClient,
  count?: number,
): Promise<DevsetSeedRunResult> {
  const upsertArgsList = resolveDevsetSeedUpsertArgs(count);
  const emailToPersonId = await upsertDevsetSeedPersons(client, upsertArgsList);
  // ③ 은 ② 이후여야 한다 — placeholder 를 실 person.id 로 바꿀 재료가 ② 의 반환 Map 뿐.
  const resolved = resolveRealDataPersonId(upsertArgsList, emailToPersonId);
  const identityKeyToId = await upsertDevsetSeedServiceIdentities(
    client,
    resolved,
  );
  return {
    personCount: emailToPersonId.size,
    identityCount: identityKeyToId.size,
    emailToPersonId,
    identityKeyToId,
  };
}
