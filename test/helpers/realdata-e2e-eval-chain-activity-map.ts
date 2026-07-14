// realdata-e2e-eval-chain-activity-map.ts — 실 평가 e2e full-chain live smoke 의 github
// event → 도메인 Activity 매핑 순수 함수 모듈 (T-0978 박제, PLAN.md 109행 leg).
//
// 배경:
//   - `realdata-e2e-eval-chain-live.smoke-spec.ts`(T-0975)는 실 github
//     `/users/{user}/events/public` 응답 1 건을 도메인 `GithubActivity` 로 매핑하는
//     `mapEventToActivity` 를 **spec 파일 안 inline 로컬 함수**로 두고 있었다. 이 함수는
//     event type → kind 사영(PullRequestEvent→pr / IssuesEvent→issue / else→commit) +
//     raw 본문 폐기 후 typed scalar 만 추출(R-59)이라는 **결정론적 분기 로직**을 담지만,
//     오직 env-gated `describeLive` 분기 안에서만 실행돼 public CI 에서는 skip-by-default —
//     항상-실행 unit test 가 이 분기를 전혀 커버하지 않았다. T-0975 reviewer 가 이 지점을
//     MINOR("mapEventToActivity live-only branch")로 catch 했다. 본 모듈은 그 매핑 로직을
//     순수 함수로 분리해 R-112 로 봉한다(항상 CI 실행 — env-gating 무관). live/skip 여부와
//     무관하게 CI 가 매 실행마다 이 경계를 검증한다(T-0975 producer 추출 패턴 mirror).
//
// 책임:
//   - 실 github events API 1 건(raw `Record<string, unknown>`)을 도메인 `GithubActivity` 로
//     변환한다. event type 을 3 종(commit/pr/issue)으로 사영하고, externalId / timestamp /
//     repoRef 는 방어적 fallback 을 둔다(malformed / 부분 응답 방어). author 는 결정론적
//     귀속을 위해 수집 대상 username 을 쓴다(수집 대상 = 그 username 의 공개 활동이므로).
//
// 🔥 §9 / R-59 격리:
//   - raw 본문(payload 전문·commit message·diff·issue body 등)을 필드로 보유하지 않는다.
//     `metadata` 에는 volume 산출용 typed scalar(titleLength 등)만 담는다(REQ-032).
//   - 실 credential / secret 은 본 모듈이 다루지 않는다 — 입력은 username(비시크릿) + raw
//     event 뿐이다.
//
// 🔥 순수성: `process.env` 읽기 0 · 네트워크/DB 호출 0 · 입력 event mutate 0(매 호출마다
//   새 `GithubActivity` 객체를 반환 — 입력 객체 참조를 되돌려주지 않는다).
//
// 🔥 외부 dependency 0 — Node 내장 타입 + `GithubActivity` 타입 read-only import 만.
//   production `src/` 변경 0.
import type { GithubActivity } from "../../src/assessment-collection/domain/activity";

// mapRealDataGithubEventToActivity — 실 github events API 응답 1 건을 도메인
// `GithubActivity` 로 매핑하는 순수 함수. inline 원본(T-0975 spec-local mapEventToActivity)과
// 동일 계약을 단일 source-of-truth 로 승격한다.
//
// 분기:
//   - kind 사영: event.type === "PullRequestEvent" → "pr", "IssuesEvent" → "issue",
//     그 외(비string 포함) → "commit".
//   - externalId: event.id 가 string 이면 그대로, 아니면 String(event.id) 변환(null/undefined
//     이면 "unknown" fallback).
//   - timestamp: event.created_at 이 string 이면 그대로, 아니면 epoch("1970-01-01T00:00:00Z")
//     fallback.
//   - repoRef: event.repo.name 이 string 이면 그대로, 아니면 `${username}/unknown-repo`
//     fallback(repo 누락 방어 포함).
//
// 순수성: 입력 event 를 읽기만 하고 mutate 하지 않는다. 매 호출마다 새 객체를 반환한다.
//
// @param username 수집 대상 username(author 귀속 key — 비시크릿).
// @param event 실 github events API 응답 1 건(raw, typed 되지 않은 map).
// @returns 도메인 `GithubActivity`(typed 참조 필드만 — raw 본문 미포함, R-59).
export function mapRealDataGithubEventToActivity(
  username: string,
  event: Record<string, unknown>,
): GithubActivity {
  const type = typeof event.type === "string" ? event.type : "";
  const kind: GithubActivity["kind"] =
    type === "PullRequestEvent"
      ? "pr"
      : type === "IssuesEvent"
        ? "issue"
        : "commit";
  const repo = event.repo as { name?: unknown } | undefined;
  return {
    sourceType: "github",
    externalId:
      typeof event.id === "string" ? event.id : String(event.id ?? "unknown"),
    instanceKey: "github.com",
    author: username,
    timestamp:
      typeof event.created_at === "string"
        ? event.created_at
        : "1970-01-01T00:00:00Z",
    // typed scalar 만 — raw 본문 미포함(R-59). event type 문자열 길이 등 volume 산출용.
    metadata: { titleLength: type.length },
    repoRef:
      repo && typeof repo.name === "string"
        ? repo.name
        : `${username}/unknown-repo`,
    kind,
  };
}
