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
//
// T-1623 — seed 배선: 부하 job 의 PostgreSQL 은 run 마다 새로 만들어진 빈 DB 라, seed 없이는
// 위 3 종 조회가 전부 0 행 목록이라 p95 게이트가 통과해도 아무것도 입증하지 못한다. setup() 이
// 조회 대상 row 를 부하 직전에 만들고 teardown(data) 가 정리한다. seed / 정리 요청은 별도
// route tag 를 달아 조회 지연 지표(persons / groups / parts) 를 오염시키지 않는다.
import http from "k6/http";

// 대상 base URL. workflow 의 K6_BASE_URL 주입값과 동일한 기본값을 들고 있다 (smoke.js 와 동형).
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";

// seed 인원 수. workflow 의 K6_SEED_PERSONS 주입값을 읽고 미지정 시 30 (BASE_URL 과 동형의
// __ENV 기본값 규약). 조회 목록이 비지 않을 정도의 합성 소규모 fixture — 133명 실 seed 는 S1 소관.
const SEED_PERSONS = Number(__ENV.K6_SEED_PERSONS || 30);

// seed / 정리 요청 파라미터. route tag 는 조회 3 종(persons / groups / parts) 과 겹치지 않는
// 별도 이름이라, route tag 별 p95 임계 3 종이 조회 지연만 측정한다 (지표 오염 차단).
const SEED_PARAMS = {
  headers: { "Content-Type": "application/json" },
  tags: { route: "seed" },
};
const TEARDOWN_PARAMS = { tags: { route: "teardown" } };

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

export function setup() {
  // run 마다 유일한 접미사 — Person.email / Part.name 의 @unique 충돌(409)이 전역
  // http_req_failed 임계를 오염시키지 않도록 한다 (로컬 반복 실행 포함).
  const stamp = Date.now();
  const personIds = [];
  for (let i = 0; i < SEED_PERSONS; i += 1) {
    const created = http.post(
      `${BASE_URL}/api/persons`,
      JSON.stringify({
        fullName: `부하 대상 ${stamp}-${i}`,
        email: `load-${stamp}-${i}@example.com`,
      }),
      SEED_PARAMS,
    );
    personIds.push(created.json("id"));
  }
  const group = http.post(
    `${BASE_URL}/api/groups`,
    JSON.stringify({ name: `부하 그룹 ${stamp}` }),
    SEED_PARAMS,
  );
  const part = http.post(
    `${BASE_URL}/api/parts`,
    JSON.stringify({ name: `부하 파트 ${stamp}` }),
    SEED_PARAMS,
  );
  // 반환값은 teardown 으로 그대로 전달되므로 JSON 직렬화 가능한 형태만 담는다.
  return {
    personIds,
    groupIds: [group.json("id")],
    partIds: [part.json("id")],
  };
}

export default function () {
  // 한 iteration = guard-free 목록 GET 3 종 각 1 회. route tag 로 지표를 분리 집계한다.
  http.get(`${BASE_URL}/api/persons`, { tags: { route: "persons" } });
  http.get(`${BASE_URL}/api/groups`, { tags: { route: "groups" } });
  http.get(`${BASE_URL}/api/parts`, { tags: { route: "parts" } });
}

export function teardown(data) {
  // CI 의 DB 는 run 마다 폐기되지만, 로컬 반복 실행에서 데이터가 누적되지 않도록 setup 이
  // 만든 row 를 모두 지운다. 카운트 기반 반복문만 쓰고 조건 분기는 두지 않는다.
  for (let i = 0; i < data.personIds.length; i += 1) {
    http.del(
      `${BASE_URL}/api/persons/${data.personIds[i]}`,
      null,
      TEARDOWN_PARAMS,
    );
  }
  for (let i = 0; i < data.groupIds.length; i += 1) {
    http.del(
      `${BASE_URL}/api/groups/${data.groupIds[i]}`,
      null,
      TEARDOWN_PARAMS,
    );
  }
  for (let i = 0; i < data.partIds.length; i += 1) {
    http.del(`${BASE_URL}/api/parts/${data.partIds[i]}`, null, TEARDOWN_PARAMS);
  }
}
