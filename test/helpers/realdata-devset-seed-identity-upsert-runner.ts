// realdata-devset-seed-identity-upsert-runner.ts — R-91 dataset(133 명) upsert-args 의
// **ServiceIdentity leg 실행 runner** (T-1654). 입력은 Person leg(T-1653) 가 회수한
// `email → person.id` map 으로 `resolveRealDataPersonId`(T-0575) 가 이미 치환한
// `RealDataUpsertArgs[]` — 각 Person 의 `identityUpsertsByEmail` 을 평탄화해 순차 upsert
// 하고 `` `${personId}::${service}` `` → identity id map 을 회수한다.
// 🔥 slice 경계 — identity leg 하나(두 leg 를 묶는 진입점 · 워크플로 배선은 다음 slice).
// 🔥 client 주입형 — `@prisma/client` 값 import 0 · 새 dep 0 · env 0 · 실 DB/네트워크 0.
// 🔥 순차 실행 — `Promise.all` 금지(`@@unique([personId, service])` 경합 + 순서 결정론).
//   🔥 args 무변형(R-59) — identity args 를 동일 참조 그대로 전달(새 필드 0).
// 🔥 에러 정책 — 구조 결손 `TypeError` / 값 정합 위반 `RangeError`(T-1651~T-1653 승계).
//   client rejection 은 그대로 전파(fail-fast).
import { PERSON_ID_PLACEHOLDER } from "./realdata-e2e-seed-upsert";
import type {
  RealDataUpsertArgs,
  ServiceIdentityUpsertArgs,
} from "./realdata-e2e-seed-upsert";

// DevsetSeedIdentityClient — 최소 구조적 client 계약(실 `PrismaClient` 는 상위집합).
export interface DevsetSeedIdentityClient {
  serviceIdentity: {
    upsert(args: ServiceIdentityUpsertArgs): Promise<{ id: string }>;
  };
}

type Planned = { key: string; args: ServiceIdentityUpsertArgs };
const PREFIX = "devset seed identity upsert";

// 구조 검증 — 객체 아님/null `TypeError`. 값 검증 — 비-문자열/빈·공백 `RangeError`.
function obj(value: unknown, at: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(`${PREFIX}: ${at} 가 객체 아님 (${String(value)})`);
  }
  return value as Record<string, unknown>;
}

function text(v: unknown, at: string): string {
  if (typeof v !== "string" || v.trim() === "") {
    throw new RangeError(`${PREFIX}: ${at} 가 빈 값 (${String(v)})`);
  }
  return v;
}

// client 구조 검증 — undefined/null · `serviceIdentity` 결손 · `upsert` 비-함수 `TypeError`.
function checkClient(client: unknown): DevsetSeedIdentityClient {
  const at = "client.serviceIdentity";
  const delegate = obj(obj(client, "client").serviceIdentity, at);
  if (typeof delegate.upsert !== "function") {
    const got = String(delegate.upsert);
    throw new TypeError(`${PREFIX}: ${at}.upsert 가 함수 아님 (${got})`);
  }
  return client as DevsetSeedIdentityClient;
}

// flattenPlan — 입력 전체를 검증하며 실행 계획으로 평탄화(검증이 첫 upsert 이전에 완결 →
// 결손 입력의 부분 적재 0). 구조 결손 `TypeError` / 빈·공백 personId·service · placeholder
// 잔존 · compound 키 중복(map 이 덮어써 적재 건수가 주는 결손) `RangeError`.
function flattenPlan(list: unknown): Planned[] {
  if (!Array.isArray(list)) {
    throw new TypeError(
      `${PREFIX}: upsertArgsList 가 배열 아님 (${String(list)})`,
    );
  }
  const plan: Planned[] = [];
  const seen = new Map<string, string>();
  list.forEach((args, index) => {
    const person = `upsertArgsList[${index}]`;
    const ids = obj(args, person).identityUpsertsByEmail;
    const idsAt = `${person}.identityUpsertsByEmail`;
    if (!Array.isArray(ids)) {
      throw new TypeError(`${PREFIX}: ${idsAt} 가 배열 아님 (${String(ids)})`);
    }
    ids.forEach((identity, i) => {
      const at = `${idsAt}[${i}]`;
      const where = obj(obj(identity, at).where, `${at}.where`);
      const pair = obj(where.personId_service, `${at}.where.personId_service`);
      const personId = text(pair.personId, `${at} 의 personId`);
      const service = text(pair.service, `${at} 의 service`);
      if (personId === PERSON_ID_PLACEHOLDER) {
        throw new RangeError(
          `${PREFIX}: personId placeholder 미치환 — ${at} (${service}). T-0575 치환을 건너뛰었다`,
        );
      }
      const key = `${personId}::${service}`;
      const first = seen.get(key);
      if (first !== undefined) {
        throw new RangeError(
          `${PREFIX}: 키 중복 — ${at} 이 ${first} 와 같은 (${key}) 를 upsert 한다`,
        );
      }
      seen.set(key, at);
      // R-59 — 입력 원소를 동일 참조 그대로 계획에 싣는다(새 필드 0).
      plan.push({ key, args: identity as ServiceIdentityUpsertArgs });
    });
  });
  return plan;
}

// readId — upsert 결과의 실 identity id. 결과 비-객체 · `id` 결손/비-문자열 · 빈 값·공백은
// 모두 compound 키 담은 메시지로 명시 throw(빈 id 가 map 에 실리는 결손 차단).
function readId(result: unknown, key: string): string {
  const id = (result as { id?: unknown } | null | undefined)?.id;
  if (typeof id !== "string" || id.trim() === "") {
    throw new Error(`${PREFIX}: 결과 id 결손 — key "${key}" (${String(id)})`);
  }
  return id;
}

// upsertDevsetSeedServiceIdentities — identity leg 를 입력 순서대로 **순차 실행**. 계약:
// 빈 배열(또는 identity 0 개 Person 만) → 호출 0 회 + 빈 Map + throw 0, 각 호출은 입력
// 원소를 그대로 전달, client rejection 은 전파 + 후속 원소 미호출(fail-fast), 반환 Map 은
// 매 호출 새 객체(caller mutate 무전파).
export async function upsertDevsetSeedServiceIdentities(
  client: DevsetSeedIdentityClient,
  resolvedUpsertArgsList: RealDataUpsertArgs[],
): Promise<Map<string, string>> {
  const plan = flattenPlan(resolvedUpsertArgsList);
  const checked = checkClient(client); // 두 검증 모두 첫 upsert 이전 — 부분 적재 0
  const keyToIdentityId = new Map<string, string>();
  // 순차 await — 동시 실행 금지(@@unique([personId, service]) 경합 + 순서 비결정론).
  for (const { key, args } of plan) {
    const result = await checked.serviceIdentity.upsert(args);
    keyToIdentityId.set(key, readId(result, key));
  }
  return keyToIdentityId;
}
