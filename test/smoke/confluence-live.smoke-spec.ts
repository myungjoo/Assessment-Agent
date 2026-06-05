// ConfluenceAdapter 실 live-endpoint round-trip smoke (T-0205, ADR-0021 Decision
// §(i)~(v) Confluence 측).
//
// 목적: 기존 두 layer — mocked-fetch unit(src/confluence/confluence-adapter.service.spec.ts,
// transport 건너뜀)과 localhost-stub round-trip smoke(test/smoke/
// confluence-adapter-roundtrip.smoke-spec.ts, T-0190 — transport 검증하나 외부 의존 0) —
// 위에, ConfluenceAdapter 가 *실 외부 endpoint*(Cloud `<ws>.atlassian.net/wiki/rest/api`
// 또는 Server `<host>/rest/api`)로 도달하는 live 경로를 검증한다(ADR-0021 Decision
// §(v) 3-layer 표 Confluence row).
//
// gating: 본 suite 는 ADR-0021 Decision §(i) 이 박제한 gating env(CONFLUENCE_LIVE_TEST
// + CONFLUENCE_LIVE_BASE_URL + CONFLUENCE_LIVE_TOKEN, optional CONFLUENCE_LIVE_AUTH_USER)
// 가 활성 조건을 만족할 때에만 활성화된다. 판정은 src/confluence/
// confluence-live-test-gating.ts 의 순수 helper resolveConfluenceLiveTestGating 에
// 위임하고(skip 본문에 분기를 묻지 않음 — R-112 entrypoint-helper 분리), enabled 가
// false 면 describe.skip 으로 전 suite 가 skip 된다 → public CI 는 gating env 부재라
// 항상 skip → 실 네트워크 호출 0 / secret 0 / 비용 0 으로 green 유지. auth scheme 는
// AUTH_USER 존재로 결정(Cloud Basic vs Server Bearer, ADR-0018 §3) — gating 이 그
// 분기까지 풀어 adapter 입력으로 흘려보낸다.
//
// 안전·격리(CLAUDE.md §9): 실 credential 값을 본 파일 어디에도 적지 않는다 — env
// 에서만 읽는다(resolveConfluenceLiveTestGating). adapter 는 default globalThis.fetch
// 로 실 endpoint 에 도달하고(fetchFn 인자 생략), emitter 는 no-op default. 새 외부
// dependency 0(Node 내장 fetch 만). gating skip 시 실 네트워크 0.
//
// 검증 invariant(ADR-0021 Decision §(iii)): 비결정 본문(page 본문/제목 의미)은
// assert 하지 않고, 응답이 도메인 매핑으로 정상 round-trip 되어 비어있지 않은 메타
// 1+(content id/title/type 등)가 존재함만 assert 한다. 실패(401/429) 재현은 layer 2
// stub 에 위임(Decision §(iv) — live 는 happy round-trip only).
import {
  ConfluenceAdapter,
  ConfluenceDomainError,
} from "../../src/confluence/confluence-adapter.service";
import { resolveConfluenceLiveTestGating } from "../../src/confluence/confluence-live-test-gating";
import { ConfluenceRequestInput } from "../../src/confluence/confluence-request.builder";

// gating 판정 — process.env 를 순수 helper 로 평가. enabled 가 describe 분기 입력.
const gating = resolveConfluenceLiveTestGating(process.env);
// gating env 부재(= public CI 기본 조건) 시 describe.skip → 전 it skip → CI green.
const describeLive = gating.enabled ? describe : describe.skip;

describeLive(
  "Smoke(live): ConfluenceAdapter 실 외부 endpoint round-trip",
  () => {
    // live endpoint hang 위험 대비 — jest 기본보다 넉넉한 상한(ADR-0021 §(iv): 명시
    // AbortController timeout 코드는 별도 hardening task, 여기서는 jest 차원 상한만).
    // gating skip 시 미발화.
    jest.setTimeout(30000);

    it(`happy(${gating.scheme}): 실 외부 endpoint 에 호출해 content list 응답이 도메인 매핑으로 round-trip 된다`, async () => {
      // default globalThis.fetch 로 실 endpoint 도달(fetchFn 생략) + no-op emitter.
      const adapter = new ConfluenceAdapter();

      // content list endpoint — gating 이 푼 baseUrl + auth scheme(Cloud Basic 의
      // authUser / Server Bearer 의 null) + token(env 출처, 코드에 실값 기재 0, §9).
      // 단일 page 만 받으면 충분하므로 query 는 비워 둔다(Confluence 기본 limit).
      const input: ConfluenceRequestInput = {
        baseUrl: gating.baseUrl as string,
        authUser: gating.authUser,
        token: gating.token as string,
        path: "/content",
      };

      // 단일 bounded round-trip — request() 로 단 1 회만 호출한다(T-0245).
      // 과거에는 requestAllPages 를 썼으나 /content 같은 unbounded list 는 항상
      // body `_links.next` cursor 를 실어줘 MAX_PAGES 까지 순차 추종 → 30s timeout
      // fail 했다. live SMOKE 는 실 transport/auth/URL/headers/parse 를 1 회만
      // 증명하면 충분하고, 다중 page cursor 추종은 layer-2 stub spec 이 cover
      // 한다(ADR-0021 §(iv) live=happy round-trip only, §(v) 3-layer 표 layer-2).
      const body = await adapter.request(input);

      // 검증 invariant(§(iii)) — 비결정 본문(page 제목/본문)은 assert 하지 않고,
      // 응답이 도메인 매핑으로 정상 round-trip 되어 비어있지 않은 메타 1+ 가 존재함만
      // assert. Confluence /content 는 단일 page 응답이 { results: [...] } 객체.
      expect(typeof body).toBe("object");
      expect(body).not.toBeNull();
      const results = (body as { results?: unknown }).results;
      expect(Array.isArray(results)).toBe(true);
      const pages = results as unknown[];
      expect(pages.length).toBeGreaterThan(0);
      // 첫 항목이 content 식별 메타(id 또는 title/type 등 1+)를 가진 객체인지 — 도메인
      // 매핑 합치(raw 미저장 invariant 정합, REQ-059). 값 자체는 환경별 비결정.
      const first = pages[0] as Record<string, unknown>;
      expect(typeof first).toBe("object");
      expect(first).not.toBeNull();
      const hasMeta =
        first.id !== undefined ||
        first.title !== undefined ||
        first.type !== undefined ||
        first.status !== undefined;
      expect(hasMeta).toBe(true);
    });

    it("gating helper 가 live 활성 조건을 식별했다(describe 활성 전제 sanity)", () => {
      // describe 가 활성이려면 enabled 가 true 여야 한다 — gating 분기 정합 확인.
      expect(gating.enabled).toBe(true);
      // 활성 시 baseUrl/token 이 채워져 있어야 실 호출이 가능하다(§9: 값은 env 출처).
      expect(typeof gating.baseUrl).toBe("string");
      expect((gating.baseUrl as string).length).toBeGreaterThan(0);
      expect(typeof gating.token).toBe("string");
      expect((gating.token as string).length).toBeGreaterThan(0);
      // scheme 분기 정합 — Cloud Basic 이면 authUser 가 string, Server Bearer 면 null.
      if (gating.scheme === "cloud-basic") {
        expect(typeof gating.authUser).toBe("string");
      } else {
        expect(gating.authUser).toBeNull();
      }
      // ConfluenceDomainError 가 live 경로에서도 동일 매핑 위상으로 import 가능함을 박제
      // (실패 재현은 layer 2 stub — Decision §(iv), 여기서는 타입 참조만).
      expect(typeof ConfluenceDomainError).toBe("function");
    });
  },
);
