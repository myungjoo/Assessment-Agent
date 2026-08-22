// realdata-devset-seed-person-upsert-runner.ts — R-91 dataset(133 명) upsert-args 의
// **Person leg 실행 runner** (T-1653 박제). T-1652 의 `resolveDevsetSeedUpsertArgs` 산출
// `RealDataUpsertArgs[]` 를 주입 client 로 순차 upsert 하고, 다음 leg
// (`resolveRealDataPersonId`, T-0575)가 소비할 `email → person.id` map 을 회수한다.
// 🔥 slice 경계 — Person leg 하나만(identity leg 실행 · placeholder 치환 · seed 진입점 ·
//   워크플로 step 은 다음 slice). 🔥 client 주입형 — `@prisma/client` 값 import 0 · 새
//   dependency 0 · env 읽기 0 · 실 네트워크/DB 0(실행처는 실 `PrismaClient`, spec 은 mock).
// 🔥 순차 실행 강제 — `Promise.all` 금지(`email @unique` write 경합 P2002 + 순서 비결정론).
//   🔥 args 무변형(R-59) — `args.personUpsert` 를 그대로 넘겨 새 필드를 만들지 않는다.
// 🔥 에러 정책 — 구조 결손 `TypeError` / 값 정합 위반 `RangeError` 로 chain 선례
//   (T-1651/T-1652) 승계. client rejection 은 그대로 전파(fail-fast).
import type {
  PersonUpsertArgs,
  RealDataUpsertArgs,
} from "./realdata-e2e-seed-upsert";

// DevsetSeedPersonClient — 최소 구조적 client 계약(실 `PrismaClient` 는 상위집합).
export interface DevsetSeedPersonClient {
  person: {
    upsert(args: PersonUpsertArgs): Promise<{ id: string }>;
  };
}

const PREFIX = "devset seed person upsert";

// 구조 검증 공통 — 객체 아님/null 은 `TypeError`.
function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new TypeError(
      `${PREFIX}: ${label} 가 객체가 아니다 (${String(value)})`,
    );
  }
  return value as Record<string, unknown>;
}

// client 구조 검증 — undefined/null · `person` 결손 · `upsert` 비-함수 = `TypeError`.
function assertClientStructure(client: unknown): DevsetSeedPersonClient {
  const person = requireObject(
    requireObject(client, "client").person,
    "client.person delegate",
  );
  if (typeof person.upsert !== "function") {
    throw new TypeError(
      `${PREFIX}: client.person.upsert 가 함수가 아니다 (${String(person.upsert)})`,
    );
  }
  return client as DevsetSeedPersonClient;
}

// upsert-args 배열 검증 — 배열/원소/`personUpsert.where.email` 구조 결손은 `TypeError`,
// email 중복은 `RangeError`(map 이 조용히 덮어써 133 건이 132 건으로 주는 결손 차단).
function assertUpsertArgsList(upsertArgsList: unknown): RealDataUpsertArgs[] {
  if (!Array.isArray(upsertArgsList)) {
    throw new TypeError(
      `${PREFIX}: upsertArgsList 가 배열이 아니다 (${String(upsertArgsList)})`,
    );
  }
  const seen = new Map<string, number>();
  upsertArgsList.forEach((args, index) => {
    const email = readEmail(args, index);
    const first = seen.get(email);
    if (first !== undefined) {
      throw new RangeError(
        `${PREFIX}: email 중복 — upsertArgsList[${index}] 이 [${first}] 와 같은 email (${email}) 을 upsert 한다`,
      );
    }
    seen.set(email, index);
  });
  return upsertArgsList as RealDataUpsertArgs[];
}

// readEmail — 1 원소에서 `personUpsert.where.email` 을 구조 검증과 함께 읽는다.
function readEmail(args: unknown, index: number): string {
  const at = `upsertArgsList[${index}]`;
  const personUpsert = requireObject(
    requireObject(args, at).personUpsert,
    `${at}.personUpsert`,
  );
  const where = requireObject(personUpsert.where, `${at}.personUpsert.where`);
  if (typeof where.email !== "string" || where.email.trim() === "") {
    throw new TypeError(
      `${PREFIX}: ${at}.personUpsert.where.email 이 비어 있거나 문자열이 아니다 (${String(where.email)})`,
    );
  }
  return where.email;
}

// readPersonId — upsert 결과의 실 `person.id`. 결과 비-객체 · `id` 결손 · 빈 값/공백은
// email 담은 메시지로 명시 throw(빈 id 치환으로 compound-unique 가 깨지는 일 차단).
function readPersonId(result: unknown, email: string): string {
  const at = `email "${email}"`;
  if (typeof result !== "object" || result === null) {
    throw new Error(
      `${PREFIX}: upsert 결과가 객체가 아니다 — ${at} (${String(result)})`,
    );
  }
  const id = (result as { id?: unknown }).id;
  if (typeof id !== "string") {
    throw new Error(
      `${PREFIX}: upsert 결과에 id 가 없다 — ${at} (${String(id)})`,
    );
  }
  if (id.trim() === "") {
    throw new Error(`${PREFIX}: upsert 결과의 id 가 빈 값/공백 — ${at}`);
  }
  return id;
}

// upsertDevsetSeedPersons — Person leg 를 입력 순서대로 **순차 실행** 하고 `email →
// person.id` map 을 회수한다. 계약: 빈 배열 → 루프 0 회전 → 빈 Map + client 호출 0 회 +
// throw 0, 각 호출은 `args.personUpsert` 를 그대로 전달(새 필드 0), client rejection 은
// 그대로 전파하고 후속 원소를 호출하지 않음(fail-fast), 두 인자 검증은 첫 upsert 이전이라
// 검증 실패 시 부분 적재 0, 반환 Map 은 매 호출 새 객체(caller mutate 무전파).
export async function upsertDevsetSeedPersons(
  client: DevsetSeedPersonClient,
  upsertArgsList: RealDataUpsertArgs[],
): Promise<Map<string, string>> {
  const checkedArgs = assertUpsertArgsList(upsertArgsList);
  const checkedClient = assertClientStructure(client);
  const emailToPersonId = new Map<string, string>();
  for (const args of checkedArgs) {
    const email = args.personUpsert.where.email;
    // 순차 await — 동시 실행 금지(email @unique 경합 회피 + 호출 순서 결정론).
    const result = await checkedClient.person.upsert(args.personUpsert);
    emailToPersonId.set(email, readPersonId(result, email));
  }
  return emailToPersonId;
}
