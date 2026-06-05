// GithubAdapter 실 live-endpoint round-trip smoke (T-0204, ADR-0021 Decision
// §(i)~(iv) GitHub 측).
//
// 목적: 기존 두 layer — mocked-fetch unit(src/github/github-adapter.service.spec.ts,
// transport 건너뜀)과 localhost-stub round-trip smoke(test/smoke/
// github-adapter-roundtrip.smoke-spec.ts, T-0182 — transport 검증하나 외부 의존 0) —
// 위에, GithubAdapter 가 *실 외부 endpoint*(api.github.com / Enterprise <host>/api/v3)
// 로 도달하는 live 경로를 검증한다(ADR-0021 Decision §(v) 3-layer 표 GitHub row).
//
// gating: 본 suite 는 ADR-0021 Decision §(i) 이 박제한 gating env(GITHUB_LIVE_TEST
// + per-host token GITHUB_LIVE_TOKEN_PUBLIC / _SEC / _ECODE)가 활성 host 1+ 를
// 만들 때에만 활성화된다. 판정은 src/github/github-live-test-gating.ts 의 순수
// helper resolveGithubLiveTestGating 에 위임하고(skip 본문에 분기를 묻지 않음 —
// R-112 entrypoint-helper 분리), enabled 가 false 면 describe.skip 으로 전 suite 가
// skip 된다 → public CI 는 gating env 부재라 항상 skip → 실 네트워크 호출 0 /
// secret 0 / 비용 0 으로 green 유지. host 별 부분 활성을 자연 지원 — 활성 host 만
// it.each 로 순회한다(부재 host 는 enabledHosts 에서 빠짐).
//
// 안전·격리(CLAUDE.md §9): 실 credential 값을 본 파일 어디에도 적지 않는다 — env
// 에서만 읽는다(resolveGithubLiveTestGating). adapter 는 default globalThis.fetch 로
// 실 endpoint 에 도달하고(fetchFn 인자 생략), emitter 는 no-op default. 새 외부
// dependency 0(Node 내장 fetch 만). gating skip 시 실 네트워크 0.
//
// 검증 invariant(ADR-0021 Decision §(iii)): 비결정 본문은 assert 하지 않고, 응답이
// 도메인 매핑으로 정상 round-trip 되어 비어있지 않은 메타 1+(repo 식별자)가 존재함만
// assert 한다. 실패(401/429) 재현은 layer 2 stub 에 위임(Decision §(iv) — live 는
// happy round-trip only).
import {
  GithubAdapter,
  GithubDomainError,
} from "../../src/github/github-adapter.service";
import {
  GithubLiveHostGating,
  resolveGithubLiveTestGating,
} from "../../src/github/github-live-test-gating";
import { GithubRequestInput } from "../../src/github/github-request.builder";

// gating 판정 — process.env 를 순수 helper 로 평가. enabled 가 describe 분기 입력.
const gating = resolveGithubLiveTestGating(process.env);
// gating env 부재(= public CI 기본 조건) 시 describe.skip → 전 it skip → CI green.
const describeLive = gating.enabled ? describe : describe.skip;

describeLive("Smoke(live): GithubAdapter 실 외부 endpoint round-trip", () => {
  // live endpoint hang 위험 대비 — jest 기본보다 넉넉한 상한(ADR-0021 §(iv): 명시
  // AbortController timeout 코드는 별도 hardening task, 여기서는 jest 차원 상한만).
  // gating skip 시 미발화.
  jest.setTimeout(30000);

  // 활성 host(enabledHosts)만 순회한다 — 부분 활성 시 token 없는 host 는 빠진다.
  // gating.enabled 가 true 이므로 enabledHosts 는 1+ 임이 보장된다.
  it.each(gating.enabledHosts.map((host) => [host.key, host] as const))(
    "happy(%s): 실 외부 endpoint 에 1 회 호출해 list 응답이 도메인 매핑으로 round-trip 된다",
    async (_key: string, host: GithubLiveHostGating) => {
      // default globalThis.fetch 로 실 endpoint 도달(fetchFn 생략) + no-op emitter.
      const adapter = new GithubAdapter();

      // 공개 read-only list endpoint — repos 목록. host 는 gating 이 라우팅한
      // configured host(github.com → api.github.com, Enterprise → <host>/api/v3).
      // token 은 env 출처(gating.token) — 코드에 실값 기재 0(§9).
      const input: GithubRequestInput = {
        host: host.host,
        token: host.token as string,
        path: host.key === "public" ? "/repositories" : "/repos",
        query: { per_page: "1" },
      };

      // 단일 bounded round-trip — request() 로 단 1 회만 호출한다(T-0245).
      // 과거에는 requestAllPages 를 썼으나 /repositories 같은 unbounded list 는
      // 항상 Link rel=next 를 실어줘 MAX_PAGES=100 까지 순차 추종 → 30s timeout
      // fail 했다. live SMOKE 는 실 transport/auth/URL/headers/parse 를 1 회만
      // 증명하면 충분하고, 다중 page cursor 추종은 layer-2 stub spec 이 cover
      // 한다(ADR-0021 §(iv) live=happy round-trip only, §(v) 3-layer 표 layer-2).
      const body = await adapter.request(input);

      // 검증 invariant(§(iii)) — 비결정 본문(repo 이름/소유자)은 assert 하지 않고,
      // 응답이 array 로 정상 파싱되고 비어있지 않은 메타 1+ 가 존재함만 assert.
      // GitHub /repositories 는 단일 page 응답이 top-level array.
      expect(Array.isArray(body)).toBe(true);
      const pages = body as unknown[];
      expect(pages.length).toBeGreaterThan(0);
      // 첫 항목이 repo 식별 메타(id 또는 full_name 등 1+)를 가진 객체인지 — 도메인
      // 매핑 합치(raw 미저장 invariant 정합, REQ-059). 값 자체는 환경별 비결정.
      const first = pages[0] as Record<string, unknown>;
      expect(typeof first).toBe("object");
      expect(first).not.toBeNull();
      const hasMeta =
        first.id !== undefined ||
        first.full_name !== undefined ||
        first.name !== undefined ||
        first.node_id !== undefined;
      expect(hasMeta).toBe(true);
    },
  );

  it("gating helper 가 활성 host 1+ 를 식별했다(describe 활성 전제 sanity)", () => {
    // describe 가 활성이려면 enabledHosts 가 1+ 여야 한다 — gating 분기 정합 확인.
    expect(gating.enabledHosts.length).toBeGreaterThan(0);
    // 활성 host 는 token 이 채워져 있어야 실 호출이 가능하다(§9: 값은 env 출처).
    for (const host of gating.enabledHosts) {
      expect(typeof host.token).toBe("string");
      expect((host.token as string).length).toBeGreaterThan(0);
    }
    // GithubDomainError 가 live 경로에서도 동일 매핑 위상으로 import 가능함을 박제
    // (실패 재현은 layer 2 stub — Decision §(iv), 여기서는 타입 참조만).
    expect(typeof GithubDomainError).toBe("function");
  });
});
