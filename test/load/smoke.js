// test/load/smoke.js
// — R-91 / REQ-047 부하 harness 의 최소 k6 스크립트 (T-1620).
//
// 본 slice 가 여는 것은 "k6 가 CI runner 위에서 돌고 임계 위반 시 non-zero exit 로 끝난다" 는
// 골격뿐이다(133명 실 seed · 1h 실측 게이트 · S1/S2/S3 시나리오는 후속 slice). 임계는
// docs/ops/load-resilience-test-plan.md §3 표 그대로 — 게이트가 도구에 내재화된다 (ADR-0054).
// 조건 분기 로직 0 — 분기가 필요해지면 unit-testable helper 로 분리한다 (T-1620 AC (9)).
import http from "k6/http";

// 대상 base URL. 현재는 기본값만 들고 있다 — 실 인스턴스 기동 배선은 후속 slice.
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";

export const options = {
  // smoke 수준 — 1 VU × 1 iteration. 실 부하 프로파일(ramping VUs 등)은 후속 slice.
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  // sanity 엔드포인트(GET /api — src/app.controller.ts) 1회 타격. 배선 확인용 최소 요청.
  http.get(`${BASE_URL}/api`);
}
