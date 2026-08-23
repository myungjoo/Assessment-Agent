// realdata-devset-seed-client.ts — R-91 실데이터 dataset(133 명) seed 의 **실
// PrismaClient 팩토리**(T-1657). 직전 slice T-1656 이 박은 `runDevsetSeedCli(deps)` 는
// `deps.client` 를 주입받기만 할 뿐 스스로 만들지 않는다 — 지금 그 계약을 만족하는 값은
// spec 의 mock 뿐이라, 실행 경로를 잇는 유일한 결손이 "실 client 를 만들어 주는 주체" 다.
// 본 파일이 그 한 조각만 담당한다.
//
// 🔥 분기는 여기, entrypoint 는 얇게 — `DATABASE_URL` 결손은 첫 query 의 모호한 connection
//   실패가 아니라 **호출 즉시 명확한 메시지로 fail-fast** 해야 한다
//   (`test/helpers/jest-smoke-setup.ts` 가 세운 정책 승계). 이 검증이 곧 **분기** 이므로
//   CLAUDE.md §3.2 R-112 "entrypoint 안에 분기 두지 말고 unit-testable helper 로 분리"
//   룰에 따라 entrypoint 가 아니라 본 helper 가 가져간다. 🔥 env 0 — connection string 은
//   **인자 주입**이며 본 파일은 `process.env` · `process.argv` · `console.*` 를 만지지
//   않는다(다음 slice 의 entrypoint 몫). 🔥 실 접속 0 — 인스턴스 생성만 하고 `$connect()` ·
//   query · 마이그레이션을 호출하지 않는다(Prisma 의 lazy connection 전제). 🔥 seed 로직
//   재구현 0 — `runDevsetSeed` · upsert · placeholder 치환을 본 파일에서 부르지 않는다.
//   🔥 새 dep 0 — `@prisma/adapter-pg` · `@prisma/client` 는 기존 의존이며 조립 형태는
//   `src/persistence/prisma.service.ts` 의 `buildPrismaAdapter()` 정본과 동일하다
//   (그 파일은 env 를 직접 읽으므로 재사용 대신 같은 형태로 조립 — 기존 파일 수정 0).
//   🔥 CLAUDE.md §9 — connection string 은 자격증명이라 에러 메시지에 입력값을 **절대
//   echo 하지 않는다**(비-string 입력의 `String(value)` 덤프도 금지 — toString 이 URL 을
//   품고 있을 수 있다). 남기는 단서는 `typeof` 뿐.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import type { DevsetSeedCliClient } from "./realdata-devset-seed-cli";

const PREFIX = "devset seed client";
const REMEDY =
  "DATABASE_URL 설정 필요 (예: postgresql://<user>:<password>@<host>:5432/<db>)";

// connection string 검증 — 비-string 이거나 trim 후 빈 문자열이면 `TypeError`.
// 통과 시 **trim 된** 문자열을 반환한다(앞뒤 공백이 붙은 유효 URL 은 그대로 통과시키되
// 공백이 adapter 로 새어 들어가지 않게 한다).
function requireConnectionString(databaseUrl: unknown): string {
  if (typeof databaseUrl !== "string") {
    // 값 자체는 남기지 않는다 — `typeof` 만으로 원인 진단이 충분하다(§9).
    throw new TypeError(
      `${PREFIX}: DATABASE_URL 이 문자열이 아니다 (typeof ${typeof databaseUrl}) — ${REMEDY}`,
    );
  }
  const trimmed = databaseUrl.trim();
  if (trimmed === "") {
    throw new TypeError(
      `${PREFIX}: DATABASE_URL 이 비어 있다(공백만 있는 문자열 포함) — ${REMEDY}`,
    );
  }
  return trimmed;
}

// createDevsetSeedClient — seed CLI 본체(`runDevsetSeedCli`)에 그대로 주입할 실
// `PrismaClient` 를 만드는 팩토리. 매 호출마다 **새 인스턴스**를 반환한다(싱글턴 캐싱 0 —
// 캐싱은 호출부가 모르는 사이 연결 수명을 공유시켜 `$disconnect` 정책을 깬다).
//
//   - `databaseUrl` 이 유효 → `PrismaPg` adapter 를 물린 `PrismaClient` 반환(접속 0).
//   - `undefined` · 비-string · 공백만 → `TypeError`(입력값 echo 0).
export function createDevsetSeedClient(
  databaseUrl: string | undefined,
): DevsetSeedCliClient {
  const connectionString = requireConnectionString(databaseUrl);
  const adapter = new PrismaPg({ connectionString });
  const client = new PrismaClient({ adapter });
  // 유일한 cast — 실 `PrismaClient` 의 delegate 메서드는 generic(`upsert<T extends ...>`)
  // 이라 `DevsetSeedCliClient` 의 단형 시그니처와 구조적으로 곧바로 겹치지 않는다. 런타임
  // shape(`person.upsert` · `serviceIdentity.upsert` · `$disconnect`) 은 상위집합이므로
  // 안전하며, spec 이 그 세 멤버가 실제 함수임을 단언해 cast 를 뒷받침한다.
  return client as unknown as DevsetSeedCliClient;
}
