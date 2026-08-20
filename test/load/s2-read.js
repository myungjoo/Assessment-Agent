// test/load/s2-read.js
// — R-91 / REQ-048 의 S2 시나리오("조회 API 응답 지연") k6 스크립트 (T-1622).
//
// T-1620 이 골격을, T-1621 이 부하 대상 기동을 열었고 본 스크립트가 처음으로 **DB round-trip 을
// 실제로 타는 조회 route** 를 반복 타격해 계획 §3 의 p95 < 3s 게이트를 실발화시킨다.
// 타격 대상은 `@UseGuards` 가 없는 guard-free 목록 GET 3 종뿐이다 — assessment / contribution /
// summary / user 의 조회는 JwtAuthGuard 가 붙어 토큰 없이는 401 이고, 그 401 이
// http_req_failed 임계를 오염시킨다(인증 획득 배선은 후속 slice). id 파라미터 경로도 빈 DB 에서
// 404 가 되므로 타격하지 않는다.
// 임계는 docs/ops/load-resilience-test-plan.md §3 표 그대로 — 재산정 0 (ADR-0054).
// 조건 분기 로직 0 — 분기가 필요해지면 unit-testable helper 로 분리한다 (T-1620 규약 승계).
import http from "k6/http";

// 대상 base URL. workflow 의 K6_BASE_URL 주입값과 동일한 기본값을 들고 있다 (smoke.js 와 동형).
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";

export const options = {
  // 반복 조회 프로파일 — smoke(1 VU × 1 iteration) 보다 큰 지속 부하. ramping stages 는
  // S3(동시성 내성) 소관이라 쓰지 않는다. 수동 발화 job 이라 비용은 1 회 실행에 국한.
  vus: 5,
  duration: "20s",
  thresholds: {
    // 전역 게이트 — 계획 §3 값 그대로.
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.01"],
    // route 별 게이트 — 한 route 만 느려지는 국지 저하가 전역 p95 에 묻히지 않도록 동일 3000ms.
    "http_req_duration{route:persons}": ["p(95)<3000"],
    "http_req_duration{route:groups}": ["p(95)<3000"],
    "http_req_duration{route:parts}": ["p(95)<3000"],
  },
  // p50 / throughput 은 "baseline 후 fix" 라 임계 없이 k6 기본 summary 로 관찰만 한다.
};

export default function () {
  // 한 iteration = guard-free 목록 GET 3 종 각 1 회. route tag 로 지표를 분리 집계한다.
  http.get(`${BASE_URL}/api/persons`, { tags: { route: "persons" } });
  http.get(`${BASE_URL}/api/groups`, { tags: { route: "groups" } });
  http.get(`${BASE_URL}/api/parts`, { tags: { route: "parts" } });
}
