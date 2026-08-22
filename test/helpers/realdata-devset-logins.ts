// realdata-devset-logins.ts — R-91 실데이터 규모 검증 dataset(133 명)의 github login 을
// 기계 판독 가능한 fixture 에서 읽어 검증하는 순수 로더 (T-1648 박제).
//
// 책임:
//   - 정본 문서 `docs/ops/realdata-scale-devset.md` 의 §A(nnstreamer + nntrainer 33 명) ·
//     §B(Samsung org top 100) 표를 사람이 읽는 markdown 에서 옮겨 담은 fixture
//     `test/load/realdata-devset-logins.json` 을 읽고, 구조·개수·중복·형식을 fail-fast 로
//     검증해 `{ a, b, all }` 을 돌려준다.
//   - 본 slice 는 데이터 + 로더까지만 — 실제 Person / ServiceIdentity seed 나 k6 배선은
//     소비자 축(다음 slice)이며 여기서는 건드리지 않는다.
//
// 🔥 결정론·무공유: 입력 외 상태(시각·난수·전역 env) 의존 0. 매 호출 새 배열을 만들어
//   반환하므로 caller 가 결과를 mutate 해도 다음 호출에 전파되지 않는다.
// 🔥 외부 의존 0 — Node 내장 `node:fs` / `node:path` 만 사용한다(새 dependency 0).
import { readFileSync } from "node:fs";
import { join } from "node:path";

// github login 규칙: 영숫자로 시작하고 영숫자/하이픈만, 총 39 자 이하.
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
// 정본 문서가 못 박은 규모 — §A 33 명 + §B 100 명 = 합집합 133 명.
const EXPECTED_A_COUNT = 33;
const EXPECTED_B_COUNT = 100;
const EXPECTED_TOTAL = EXPECTED_A_COUNT + EXPECTED_B_COUNT;
const FIXTURE_PATH = join(
  __dirname,
  "..",
  "load",
  "realdata-devset-logins.json",
);

type DevsetLogins = { a: string[]; b: string[]; all: string[] };

// 값이 문자열 배열인지 확인하고, 아니면 사유가 담긴 Error 를 던진다.
function assertLoginArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`realdata devset fixture: '${key}' 키가 배열이 아니다`);
  }
  value.forEach((login, index) => {
    if (typeof login !== "string" || !GITHUB_LOGIN_PATTERN.test(login)) {
      throw new Error(
        `realdata devset fixture: '${key}[${index}]' 가 github login 형식 위반 (${String(login)})`,
      );
    }
  });
  return value as string[];
}

// fixture 원본(JSON.parse 결과 등)을 검증해 `{ a, b, all }` 로 정규화한다.
export function parseDevsetLogins(raw: unknown): DevsetLogins {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("realdata devset fixture: 최상위가 객체가 아니다");
  }
  const record = raw as Record<string, unknown>;
  const a = assertLoginArray(record.a, "a");
  const b = assertLoginArray(record.b, "b");
  if (a.length !== EXPECTED_A_COUNT) {
    throw new Error(
      `realdata devset fixture: 'a' 는 ${EXPECTED_A_COUNT} 개여야 하는데 ${a.length} 개다`,
    );
  }
  if (b.length !== EXPECTED_B_COUNT) {
    throw new Error(
      `realdata devset fixture: 'b' 는 ${EXPECTED_B_COUNT} 개여야 하는데 ${b.length} 개다`,
    );
  }
  const all = [...a, ...b];
  const seen = new Set<string>();
  for (const login of all) {
    if (seen.has(login)) {
      throw new Error(`realdata devset fixture: login 중복 (${login})`);
    }
    seen.add(login);
  }
  return { a: [...a], b: [...b], all };
}

// fixture 파일을 읽어 검증된 `{ a, b, all }` 을 반환한다.
export function loadRealdataDevsetLogins(): DevsetLogins {
  return parseDevsetLogins(JSON.parse(readFileSync(FIXTURE_PATH, "utf8")));
}

// 합집합 앞에서부터 `count` 개 login 을 잘라 반환한다(기본 133 = 전량).
export function resolveRealdataDevsetLogins(
  count: number = EXPECTED_TOTAL,
): string[] {
  if (!Number.isInteger(count) || count < 1 || count > EXPECTED_TOTAL) {
    throw new RangeError(
      `realdata devset logins: count 는 1~${EXPECTED_TOTAL} 정수여야 하는데 ${String(count)} 이다`,
    );
  }
  return loadRealdataDevsetLogins().all.slice(0, count);
}
