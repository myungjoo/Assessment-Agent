// GithubInstanceClient — instance key 하나로 실제 인증 GitHub REST 요청을 보내는
// 얇은 orchestrator (T-0180, ADR-0017 Decision §3 token JIT decrypt → adapter wire,
// REQ-005~008/REQ-044). 지금까지 고립돼 있던 3 primitive 를 잇는다:
//   - resolveGithubInstances (T-0178) — env → instance-keyed config 배열.
//   - decryptGithubInstanceConfigToken (T-0179) — config.tokenEnc → 평문 token JIT 복호.
//   - GithubAdapter.request / requestAllPages (T-0175/T-0176) — 단일/다중 page dispatch.
// configured instance 가 자기 암호화 token 을 호출 직전에만 복호화해 auth header 로
// 실어 단일/다중 page 요청을 보낼 수 있게 한다.
//
// 흐름: requestForInstance(key, path, query?)
//   (1) resolveGithubInstances(env) 결과에서 key 에 해당하는 GithubInstanceConfig 탐색
//       (미존재/비활성 key → 평문 미포함 도메인 Error throw).
//   (2) 그 config 의 tokenEnc 를 decryptGithubInstanceConfigToken 으로 호출 직전 JIT
//       복호화 (eager 전체 복호화 금지 — never-read-back, ADR-0014 §3).
//   (3) GithubRequestInput { host, token, path, query } 조립 → GithubAdapter 위임.
//
// 보안 invariant (CLAUDE.md §9 / ADR-0014 §3 never-read-back):
//   - 복호된 평문 token 은 GithubRequestInput.token 으로만 흘려보낸다. 로그 / 직렬화 /
//     error message / 반환값 어디에도 평문 token 을 싣지 않는다. token 변수는
//     in-memory transient 로 adapter 호출에만 사용하고 즉시 버린다.
//   - cipher.decrypt 의 throw (깨진 envelope / 키 부재·길이 미달 / 변조) 와 adapter 의
//     GithubDomainError (permission-denied / not-found / rate-limited 등) 는 swallow
//     하지 않고 그대로 전파한다 (무결성/권한 위반 표면화).
//
// 책임 경계 (Out of Scope — task §Out of Scope 박제):
//   - PermissionDeniedRecord entity 의 실 persistence — §5 게이트, 본 client 는
//     GithubAdapter 의 기존 emitter port 를 바꾸지 않는다.
//   - live-run (실 GitHub token + 실 네트워크) — §5 credential 게이트. 본 client 는
//     주입 fetch (GithubAdapter @Optional) + fake-encrypted-token fixture 만 가정.
//   - 새 외부 dependency / 새 master key 신설 금지 — Node 내장 fetch + 기존
//     LlmApiKeyCipher (ADR-0014, LLM_APIKEY_ENC_KEY) 재사용.
//   - 다중 instance 순회 / since 증분 / rate-limit backoff — 상위 orchestrator 책임.
//     본 client 는 단일 instance key 의 단일 endpoint 요청까지만.
import { Injectable, Optional } from "@nestjs/common";

import { LlmApiKeyCipher } from "../llm/llm-apikey-cipher.service";

import { GithubAdapter } from "./github-adapter.service";
import {
  GithubInstanceConfig,
  resolveGithubInstances,
} from "./github-instance-config";
import { GithubRequestInput } from "./github-request.builder";
import { decryptGithubInstanceConfigToken } from "./github-token-decrypt";

@Injectable()
export class GithubInstanceClient {
  // env 는 생성자 인자로 주입 가능하게 둔다 (unit testability — 기본값은
  // process.env). resolveGithubInstances 는 부수효과 0 순수 함수라 매 요청마다
  // 호출해도 안전하며, env 의 *존재·비어있지 않음* 만 검사한다 (실값 미접근, §9).
  // env 는 @Optional 로 표시한다 — NodeJS.ProcessEnv 는 reflect 시 Object 토큰이라
  // DI 가 module context 에서 해석을 시도하면 실패하므로(GithubAdapter 의 fetch/
  // emitter 패턴 mirror), default process.env 를 쓰도록 주입을 skip 시킨다.
  constructor(
    private readonly adapter: GithubAdapter,
    private readonly cipher: LlmApiKeyCipher,
    @Optional()
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  // requestForInstance — 주어진 instance key 로 단일 GitHub REST 요청을 dispatch 한다.
  // config 해석 → token JIT 복호 → input 조립 → GithubAdapter.request 위임 후 반환값을
  // 그대로 전파한다 (endpoint 별 응답 shape parser 는 도메인 task 책임 — unknown).
  async requestForInstance(
    key: string,
    path: string,
    query?: Record<string, string>,
  ): Promise<unknown> {
    const input = this.buildInput(key, path, query);
    return this.adapter.request(input);
  }

  // requestAllPagesForInstance — 주어진 instance key 로 list endpoint 의 전 page 를
  // GithubAdapter.requestAllPages 로 순회 수집한다. 동일 config 해석 + JIT 복호 +
  // input 조립 후 위임 → flatten 된 unknown[] 를 반환한다.
  async requestAllPagesForInstance(
    key: string,
    path: string,
    query?: Record<string, string>,
  ): Promise<unknown[]> {
    const input = this.buildInput(key, path, query);
    return this.adapter.requestAllPages(input);
  }

  // buildInput — instance key → config 해석 → token JIT 복호 → GithubRequestInput
  // 조립을 한 곳에 모은 private helper. request / requestAllPages 가 공유한다.
  // 복호된 평문 token 은 반환되는 input.token 으로만 흘려보내며, 이 메서드는 token 을
  // 로그 / 직렬화 / error message 에 노출하지 않는다 (never-read-back).
  private buildInput(
    key: string,
    path: string,
    query?: Record<string, string>,
  ): GithubRequestInput {
    const config = this.resolveConfig(key);

    // JIT decrypt — 호출 직전에만 복호화한다 (eager 전체 복호화 금지). cipher.decrypt
    // 의 throw (깨진 envelope / 키 부재·길이 미달 / 변조) 는 swallow 없이 전파된다.
    const token = decryptGithubInstanceConfigToken(this.cipher, config);

    // GithubRequestInput 조립 — 복호된 평문 token 은 token 필드로만 흘려보낸다.
    // query 가 undefined 면 그대로 두어 builder 가 query 미append 분기를 타게 한다.
    return {
      host: config.host,
      token,
      path,
      query,
    };
  }

  // resolveConfig — env 를 읽어 활성 instance config 배열을 계산한 뒤 주어진 key 에
  // 해당하는 GithubInstanceConfig 를 찾는다. key 매칭은 resolveGithubInstances 의
  // 대소문자 정규화 (dedupe 시 toUpperCase) 와 정합하게 case-insensitive 로 한다.
  //   - 빈/공백-only key → fail-fast throw (token 평문 미포함 진단).
  //   - 미존재/비활성 key (GITHUB_INSTANCES 미열거 / 필수 env 부재로 reject) → throw.
  // 진단 메시지에는 key 이름만 담고 token 평문은 절대 싣지 않는다 (§9).
  private resolveConfig(key: string): GithubInstanceConfig {
    // 빈/공백-only key 방어 — 애초에 매칭 불가하므로 명확한 진단으로 fail-fast.
    if (typeof key !== "string" || key.trim().length === 0) {
      throw new Error(
        "github instance 요청 실패: instance key 가 비어있거나 string 이 아님",
      );
    }

    const normalized = key.trim().toUpperCase();
    const { instances } = resolveGithubInstances(this.env);
    const config = instances.find((i) => i.key.toUpperCase() === normalized);

    // 미존재/비활성 key — GITHUB_INSTANCES 에 미열거됐거나 필수 env 부재로 reject 됨.
    // 활성 instance 0 (빈 GITHUB_INSTANCES) 케이스도 여기서 throw 로 흡수한다.
    if (config === undefined) {
      throw new Error(
        `github instance 요청 실패: 활성 instance 가 아니거나 미존재하는 key (key: ${key.trim()})`,
      );
    }

    return config;
  }
}
