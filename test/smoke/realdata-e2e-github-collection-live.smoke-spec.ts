// realdata-e2e-github-collection-live.smoke-spec.ts — 실 평가 e2e github.com 수집 leg
// env-gated live smoke (T-0806, PLAN.md 109행 🟢 실 평가 e2e gate 2 collection leg).
//
// 배경: `realdata-e2e-live.smoke-spec.ts`(T-0610)의 LLM 평가 leg 은 이미 env-gated live 로
// 박제됐으나, 그 spec header 가 collection leg 를 synthetic Activity 1 건으로 stub 하며
// "실 github 네트워크 수집 배선은 후속 slice" 라 명시 deferred 했다. 본 smoke 는 그
// deferred 된 collection leg 를 메운다 — 실 github.com 공개 활동(myungjoo/leemgs)을 1 회
// round-trip 수집하는 env-gated skip-by-default 실행 spec 이다. `github-live.smoke-spec.ts`
// (T-0204, ADR-0021)의 실 endpoint round-trip mirror 를 realdata-e2e 축으로 옮긴 것이다.
//
// gating: 본 suite 는 realdata-e2e 전용 gating env(REALDATA_E2E_LIVE_TEST + Ollama 5 종 +
// github read PAT)가 *모두* set 된 경우에만 활성화된다. 판정은
// test/helpers/realdata-e2e-live-gating.ts 의 순수 helper resolveRealDataE2eLiveGating 에
// 위임하고, enabled 가 false 면 describe.skip 으로 전 suite 가 skip 된다 → public CI 는
// gating env 부재라 항상 skip → 실 네트워크 호출 0 / secret 0 / 비용 0 으로 green 유지
// (R-113). 실 credential 주입 자체는 §5 게이트(ops 책임, 오너 승인됨)라 본 task 밖.
//
// 수집 요청 구조: 실 round-trip 이 어느 username 을 어떤 endpoint/헤더로 칠지는 순수 helper
// buildRealDataGithubCollectionPlan(gating, seeds)(unit spec 별도 검증)이 결정론적으로
// 조립한다. 본 spec 은 그 plan 을 받아 GithubAdapter.request(default globalThis.fetch)로
// 실 endpoint 에 도달한다.
//
// 검증 invariant(github-live.smoke §(iii) mirror): 비결정 본문(commit/PR/issue 내용,
// repo 이름 등)은 assert 하지 않고, 응답이 도메인 매핑으로 정상 round-trip 되어 비어있지
// 않은 메타 1+(활동/repo 식별자)가 존재함만 assert 한다. raw 외부 활동 데이터는 파일/변수로
// 보관하지 않는다(R-59) — 식별자/메타 존재만 검증.
//
// 안전·격리(CLAUDE.md §9): 실 credential 값(github PAT)을 본 파일 어디에도 적지 않는다 —
// env(resolveRealDataE2eLiveGating 의 gating.githubPat)에서만 읽는다. adapter 는 default
// globalThis.fetch 로 실 endpoint 에 도달하고(fetchFn 인자 생략). persist symbol 주입 0
// (in-memory 검증만 — DB write 0). 새 외부 dependency 0(Node 내장 fetch 만).
import { GithubAdapter } from "../../src/github/github-adapter.service";
import { GithubRequestInput } from "../../src/github/github-request.builder";
import {
  buildRealDataGithubCollectionPlan,
  type RealDataE2eGithubCollectionPlanEntry,
} from "../helpers/realdata-e2e-github-collection-live";
import { resolveRealDataE2eLiveGating } from "../helpers/realdata-e2e-live-gating";
import { buildRealDataE2eSeed } from "../helpers/realdata-e2e-seed-fixture";

// gating 판정 — process.env 를 순수 helper 로 평가(realdata-e2e 7 종 완전성).
// enabled 가 describe 분기 입력. unit 검증은 realdata-e2e-live-gating.spec.ts.
const gating = resolveRealDataE2eLiveGating(process.env);
// gating env 부재(= public CI 기본 조건) 시 describe.skip → 전 it skip → CI green.
const describeLive = gating.enabled ? describe : describe.skip;

describeLive(
  "Smoke(live): 실 평가 e2e github.com 공개 활동 수집 leg round-trip",
  () => {
    // live endpoint hang 위험 대비 — jest 기본보다 넉넉한 상한(github-live.smoke 동형).
    // gating skip 시 미발화.
    jest.setTimeout(30000);

    // 수집 요청 plan — gating(enabled/githubPat) + seed(myungjoo/leemgs)로부터 순수 helper
    // 가 결정론적으로 조립. describeLive 활성 = enabled 이므로 entries 1+ 임이 보장된다.
    const plan = buildRealDataGithubCollectionPlan(
      gating,
      buildRealDataE2eSeed(),
    );

    it.each(plan.entries.map((entry) => [entry.username, entry] as const))(
      "happy(%s): 실 github.com 공개 이벤트를 1 회 round-trip 수집해 도메인 매핑된다",
      async (
        _username: string,
        entry: RealDataE2eGithubCollectionPlanEntry,
      ) => {
        // default globalThis.fetch 로 실 endpoint 도달(fetchFn 생략). token 은 env 출처
        // (gating.githubPat) — 코드에 실값 기재 0(§9). plan.hasAuthorizationHeader 가
        // true 이므로(gating enabled), PAT 를 Authorization 헤더로 싣는다.
        const adapter = new GithubAdapter();

        const input: GithubRequestInput = {
          host: entry.host,
          token: gating.githubPat as string,
          path: entry.path,
          // bounded single round-trip — per_page=1 로 최소 요청(github-live.smoke mirror,
          // rate-limit 여유). 다중 page cursor 순회는 하지 않는다(T-0245 bounded).
          query: { per_page: "1" },
        };

        // 단일 bounded round-trip — request() 로 정확히 1 회만 호출한다(requestAllPages
        // 미사용 — /events/public 은 unbounded list 라 순회 시 timeout risk).
        const body = await adapter.request(input);

        // 검증 invariant(github-live.smoke §(iii) mirror) — 비결정 본문은 assert 하지
        // 않고, 응답이 array 로 정상 파싱되고(공개 이벤트 목록) 비어있지 않은 메타 1+ 가
        // 존재함만 assert. raw 활동 본문은 변수/파일로 보관하지 않는다(R-59) — 식별자/메타
        // 존재만 검증. 공개 활동이 0 건인 계정도 있을 수 있어 array 파싱만 필수 assert,
        // 메타 검증은 항목이 있을 때만.
        expect(Array.isArray(body)).toBe(true);
        const events = body as unknown[];
        if (events.length > 0) {
          const first = events[0] as Record<string, unknown>;
          expect(typeof first).toBe("object");
          expect(first).not.toBeNull();
          // 활동 식별 메타(id / type / repo 등 1+) — 도메인 매핑 합치(R-59: 식별자 존재만,
          // 값 자체는 환경별 비결정이라 미assert).
          const hasMeta =
            first.id !== undefined ||
            first.type !== undefined ||
            first.repo !== undefined ||
            first.created_at !== undefined;
          expect(hasMeta).toBe(true);
        }
      },
    );

    it("gating helper 가 수집 대상 1+ 를 식별했다(describe 활성 전제 sanity)", () => {
      // describe 가 활성이려면 plan.enabled 가 true 이고 entries 가 1+ 여야 한다.
      expect(plan.enabled).toBe(true);
      expect(plan.entries.length).toBeGreaterThan(0);
      // 활성 시 각 entry 는 Authorization 헤더를 실도록 판정돼야 한다(§9: PAT 는 env 출처).
      for (const entry of plan.entries) {
        expect(entry.hasAuthorizationHeader).toBe(true);
        expect(entry.host).toBe("github.com");
      }
      // gating.githubPat 이 실 호출에 쓸 non-empty string 이어야 한다(값은 env 출처).
      expect(typeof gating.githubPat).toBe("string");
      expect((gating.githubPat as string).length).toBeGreaterThan(0);
    });
  },
);
