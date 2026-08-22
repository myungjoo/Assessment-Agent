// realdata-devset-seed-descriptors.ts — R-91 실데이터 규모 검증 dataset(133 명)의 github
// login 을 기존 seed descriptor 계약(`RealDataSeedDescriptor`, T-0573 박제)으로 옮기는
// **순수 빌더** (T-1651 박제). 산출 shape 는 `realdata-e2e-seed-upsert.ts` 의
// `buildRealDataUpsertArgs`(T-0716 박제) 입력과 그대로 맞으므로, 다음 slice 는 변환 로직
// 재구현 0 으로 prisma upsert args 를 얻는다.
//
// 🔥 본 slice 경계 — DB write 0 · 워크플로 배선 0(실제 upsert 호출 / seed runner /
//   `.github/workflows/load-k6.yml` step 은 다음 slice). 결정론·무공유 — 입력 외 상태
//   의존 0, 매 호출 **새 객체 트리** 라 caller 의 mutate 가 다음 호출에 전파되지 않는다.
// 🔥 외부 의존 0 — 새 dependency 없이 기존 helper 재사용만. 타입은 `import type` 으로만
//   가져와 value import 0 → CommonJS 순환 의존 0 (T-0714/T-0718 type-only import mirror).
import { resolveRealdataDevsetLogins } from "./realdata-devset-logins";
import type { RealDataSeedDescriptor } from "./realdata-e2e-seed-fixture";

// github login 규칙: 영숫자로 시작, 영숫자/하이픈만, 39 자 이하 (T-1648 로더와 같은 규칙 —
// 로더는 fixture 를, 본 빌더는 자기 입력을 각각 독립 검증한다).
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
// 이메일 도메인 — 실 평가 e2e seed 의 `@e2e.realdata.test` 와 **다른** 도메인을 써서, 두
// seed 가 한 DB 에 공존해도 `model Person` 의 `email @unique` 충돌이 0 이 되게 한다.
const DEVSET_EMAIL_DOMAIN = "load.devset.test";

function toDevsetEmail(login: string): string {
  return `${login}@${DEVSET_EMAIL_DOMAIN}`;
}

// 입력의 **구조** 검증 — 배열 아님 · 원소가 문자열 아님 · github login 형식 위반은
// `TypeError`. 값 정합 위반(`RangeError`)과 종류를 나눠 caller 가 원인을 구분하게 한다.
function assertLoginsStructure(logins: unknown): string[] {
  if (!Array.isArray(logins)) {
    throw new TypeError(
      `devset seed descriptors: logins 가 배열이 아니다 (${String(logins)})`,
    );
  }
  logins.forEach((login, index) => {
    if (typeof login !== "string") {
      throw new TypeError(
        `devset seed descriptors: logins[${index}] 가 문자열이 아니다 (${String(login)})`,
      );
    }
    if (!GITHUB_LOGIN_PATTERN.test(login)) {
      throw new TypeError(
        `devset seed descriptors: logins[${index}] 가 github login 형식 위반 (${login})`,
      );
    }
  });
  return logins as string[];
}

// 입력의 **값 정합** 검증 — 빈 배열 · 파생 email 중복(대소문자 무시)은 `RangeError`.
// DB 에 넣기 전 `email @unique` 위반을 build-time 에 차단한다.
function assertLoginsValues(logins: string[]): void {
  if (logins.length === 0) {
    throw new RangeError(
      "devset seed descriptors: logins 가 비어 있다 (최소 1 개 필요)",
    );
  }
  const seenEmails = new Map<string, number>();
  logins.forEach((login, index) => {
    // `"Foo"` 와 `"foo"` 는 다른 github login 이지만 파생 email 이 사실상 같은 사서함이라
    // seed 로는 충돌로 본다(대소문자 무시 판정).
    const key = toDevsetEmail(login).toLowerCase();
    const first = seenEmails.get(key);
    if (first !== undefined) {
      throw new RangeError(
        `devset seed descriptors: 파생 email 중복 — logins[${index}] (${login}) 이 logins[${first}] 와 같은 email (${key}) 을 만든다`,
      );
    }
    seenEmails.set(key, index);
  });
}

// buildDevsetSeedDescriptors — login 배열 → seed descriptor 배열 순수 함수. 불변식:
// fullName = login(실명 미보유 — 공개 username 을 표시명으로), email = 파생 distinct 값
// (`email @unique` 정합), active = true, serviceIdentities 는 정확히 github.com 1 개
// (`@@unique([personId, service])` 정합) + externalId = login + isPrimary = true.
// 입력 순서를 보존하고 매 호출 새 객체 트리를 반환한다.
export function buildDevsetSeedDescriptors(
  logins: string[],
): RealDataSeedDescriptor[] {
  const checked = assertLoginsStructure(logins);
  assertLoginsValues(checked);
  return checked.map((login) => ({
    person: { fullName: login, email: toDevsetEmail(login), active: true },
    serviceIdentities: [
      { service: "github.com" as const, externalId: login, isPrimary: true },
    ],
  }));
}

// resolveDevsetSeedDescriptors — fixture 에서 login 을 읽어 위 빌더에 통과시킨다. 무인자
// 호출은 133 개(정본 dataset 전량). `count` 범위 위반은 T-1648 로더의 RangeError 전파.
export function resolveDevsetSeedDescriptors(
  count?: number,
): RealDataSeedDescriptor[] {
  const logins =
    count === undefined
      ? resolveRealdataDevsetLogins()
      : resolveRealdataDevsetLogins(count);
  return buildDevsetSeedDescriptors(logins);
}
