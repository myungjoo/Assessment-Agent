// github-live-test-gating — GitHub live-integration smoke 의 gating 판정 순수 함수
// 모듈 (T-0204, ADR-0021 Decision §(i)·§(ii)). live smoke spec 의 describe /
// describe.skip 분기를 spec 본문에서 분리해 unit-testable 하게 만든다 (CLAUDE.md
// §3.2 R-112 entrypoint-helper 분리 원칙 mirror — skip 본문에 분기를 묻으면 test
// 불가하므로). milestone-1 의 src/llm/llm-live-test-gating.ts(T-0171) 의
// resolveLiveTestGating 패턴을 GitHub 의 *3 host per-host token* 으로 일반화한다.
//
// LLM 과의 차이(일반화 지점):
//   - LLM 은 단일 baseUrl/apiKey 라 gating 이 전부-set 또는 전부-skip 의 binary.
//   - GitHub 은 3 host variant(public / sec / ecode) 가 각각 독립 token 을 가지며,
//     ADR-0021 Decision §(i) 가 *부분 활성* 을 자연 지원한다 — 예: public token 만
//     주어지면 public host 만 활성, Enterprise 2 host 는 skip. 그래서 반환은 host
//     별 활성 여부 + (활성 host 의) 평문 token 목록 + 전체 enabled(활성 host 1+) +
//     reason 을 담는다.
//
// 책임 경계:
//   - resolveGithubLiveTestGating: process.env(또는 임의 env map)를 읽어 host 별
//     live 활성 여부와 활성 host 의 token / skip 사유(reason)를 계산하는 부수효과 0
//     순수 함수. 실 네트워크 호출 0 / 실 credential 0 — env 의 *존재·비어있지 않음*
//     만 검사한다(실값을 코드에 적지 않는다, CLAUDE.md §9).
//   - gating 완전성 규칙(ADR-0021 Decision §(i)): GITHUB_LIVE_TEST AND 해당 host
//     의 per-host token 이 *모두* non-empty(trim 후 길이 > 0)일 때만 그 host 활성.
//     flag 부재면 전 host skip(host token 유무 무관). flag 는 있으나 host token 만
//     부재면 그 host 만 skip(나머지 host 영향 0 = 부분 활성).
//   - reason 은 어느 host 가 어느 env 부재로 skip 됐는지 사람에게 보고한다 — 실
//     token 값은 절대 포함하지 않는다(env 이름만, CLAUDE.md §9).
//   - 외부 의존 0(Node 내장 타입만), 새 dependency 0.

// gating 에 필요한 env 변수 이름 (ADR-0021 Decision §(i) 박제). 실값 0 — 이름 상수만.
export const GITHUB_LIVE_TEST_ENV = "GITHUB_LIVE_TEST";
export const GITHUB_LIVE_TOKEN_PUBLIC_ENV = "GITHUB_LIVE_TOKEN_PUBLIC";
export const GITHUB_LIVE_TOKEN_SEC_ENV = "GITHUB_LIVE_TOKEN_SEC";
export const GITHUB_LIVE_TOKEN_ECODE_ENV = "GITHUB_LIVE_TOKEN_ECODE";

// host variant 식별 key (ADR-0017 enumerable instance-key `public`/`sec`/`ecode`
// 정합). reason / 반환 map 의 안정 키로 쓰인다.
export type GithubLiveHostKey = "public" | "sec" | "ecode";

// 각 host variant 의 메타 — instance key, 그 host 의 token env 이름, 그리고 실
// 라우팅에 쓰일 configured host(buildGithubRequest 의 input.host 로 전달).
// public 은 resolveGithubApiBaseUrl 이 api.github.com 으로 라우팅하고, Enterprise
// 2 host 는 <host>/api/v3 로 라우팅한다(ADR-0016 Decision §2).
export interface GithubLiveHostSpec {
  // ADR-0017 instance key.
  key: GithubLiveHostKey;
  // 그 host 의 per-host token 을 담는 env 변수 이름(실값 0 — 이름만).
  tokenEnv: string;
  // configured host 문자열(GithubRequestInput.host 입력값). resolveGithubApiBaseUrl
  // 이 base URL 로 라우팅한다.
  host: string;
}

// 3 host variant 의 고정 사양(ADR-0021 Decision §(i) 표). 선언 순서가 reason /
// 순회 순서를 결정한다(public → sec → ecode).
export const GITHUB_LIVE_HOST_SPECS: readonly GithubLiveHostSpec[] = [
  {
    key: "public",
    tokenEnv: GITHUB_LIVE_TOKEN_PUBLIC_ENV,
    host: "github.com",
  },
  {
    key: "sec",
    tokenEnv: GITHUB_LIVE_TOKEN_SEC_ENV,
    host: "github.sec.samsung.net",
  },
  {
    key: "ecode",
    tokenEnv: GITHUB_LIVE_TOKEN_ECODE_ENV,
    host: "github.ecodesamsung.com",
  },
];

// host 별 gating 결정 — 활성 여부 + (활성 시) 평문 token + configured host.
export interface GithubLiveHostGating {
  // ADR-0017 instance key.
  key: GithubLiveHostKey;
  // configured host(GithubRequestInput.host 로 전달할 값).
  host: string;
  // true 면 이 host 의 live 호출 활성(flag AND host token 모두 present).
  enabled: boolean;
  // enabled 시에만 채워지는 평문 token(trim 된 값). skip 시 undefined.
  token?: string;
}

// resolveGithubLiveTestGating 의 반환 — spec 의 describe 분기 + 활성 host 호출 파라미터.
export interface GithubLiveTestGating {
  // 활성 host 가 1+ 이면 true(describe), 0 이면 false(describe.skip).
  enabled: boolean;
  // host 별 gating 결정(선언 순서: public → sec → ecode). 비활성 host 도 포함되며
  // enabled === false / token === undefined 로 채워진다(부분 활성 진단).
  hosts: GithubLiveHostGating[];
  // 활성 host(enabled === true)만 추린 편의 목록 — spec 이 순회 대상으로 쓴다.
  enabledHosts: GithubLiveHostGating[];
  // skip / run 사유를 사람이 읽을 수 있게 보고 — 어느 host 가 어느 env 부재로 skip
  // 됐는지 등. 실 token 값은 절대 포함하지 않는다(env 이름만, CLAUDE.md §9).
  reason: string;
}

// env 값이 "존재하고 trim 후 비어있지 않은 string" 인지 검사하는 내부 guard.
// 부재(undefined) / 빈 문자열 / 공백-only 를 모두 false 로 본다(부분-set·malformed 방어).
function isPresent(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// resolveGithubLiveTestGating — env map 을 읽어 host 별 live gating 결정을 계산한다
// (순수 함수). GITHUB_LIVE_TEST flag 가 부재면 전 host skip. flag present 시 각
// host 의 per-host token 이 present 인 host 만 활성한다(부분 활성). 어느 host 가
// 어느 env 부재로 skip 됐는지 reason 에 박제한다(사람 보고용 — 실 token 값 미포함).
export function resolveGithubLiveTestGating(
  env: NodeJS.ProcessEnv,
): GithubLiveTestGating {
  const flag = env[GITHUB_LIVE_TEST_ENV];
  const flagOk = isPresent(flag);

  // skip 사유 누적 — 부재한 env 이름만 담는다(실값 미포함, §9).
  const skipReasons: string[] = [];

  // flag 부재면 host token 유무와 무관하게 전 host skip(ADR-0021 §(i) — flag 단독
  // 으로 부족하나, flag 부재면 그 자체로 전 host 비활성).
  if (!flagOk) {
    skipReasons.push(GITHUB_LIVE_TEST_ENV);
  }

  // host 별 판정 — flag present 일 때만 host token 의 present 여부로 활성 결정.
  const hosts: GithubLiveHostGating[] = GITHUB_LIVE_HOST_SPECS.map((spec) => {
    const tokenRaw = env[spec.tokenEnv];
    const tokenOk = isPresent(tokenRaw);

    // 활성 조건: flag present AND 이 host token present. type guard(tokenOk)가
    // tokenRaw 를 string 으로 narrowing 해 trim 값을 안전히 쓴다.
    if (flagOk && tokenOk) {
      return {
        key: spec.key,
        host: spec.host,
        enabled: true,
        token: tokenRaw.trim(),
      };
    }

    // skip — flag 부재면 위에서 이미 GITHUB_LIVE_TEST 를 reason 에 담았고, 여기서는
    // host token 부재인 host 의 token env 이름을 추가한다(flag 가 present 인데
    // token 만 없는 경우 그 host 만 skip = 부분 활성 진단).
    if (flagOk && !tokenOk) {
      skipReasons.push(spec.tokenEnv);
    }
    return {
      key: spec.key,
      host: spec.host,
      enabled: false,
    };
  });

  const enabledHosts = hosts.filter((host) => host.enabled);
  const enabled = enabledHosts.length > 0;

  // reason 박제 — 활성 host 가 1+ 면 활성 host 목록을, 아니면 skip 사유(부재 env
  // 이름)를 사람이 읽도록 보고한다. 실 token 값은 절대 넣지 않는다(§9).
  const reason = enabled
    ? `live smoke 활성 — 활성 host: ${enabledHosts
        .map((host) => host.key)
        .join(", ")}` +
      (skipReasons.length > 0 ? ` (skip env: ${skipReasons.join(", ")})` : "")
    : `live smoke skip — gating env 부재: ${skipReasons.join(", ")}`;

  return { enabled, hosts, enabledHosts, reason };
}
