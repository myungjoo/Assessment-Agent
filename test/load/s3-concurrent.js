// test/load/s3-concurrent.js
// — R-91 / REQ-047·REQ-048 의 S3 시나리오("동시 요청 내성") k6 스크립트 (T-1625).
// 계획 docs/ops/load-resilience-test-plan.md §2 S3 — "평가 작성 진행 중 조회" 같은 read + write
// 혼합 부하를 동시성 수준을 올려가며 인가 — 를 처음 실발화시킨다(§3 표 S3 행: error rate < 1%).
// 규약(S2 승계): ① guard-free `/api/persons` 만 타격(401 이 http_req_failed 임계 오염 차단)
// ② 한 iteration 이 만든 row 는 같은 iteration 이 지운다(DB 무한 성장 차단) ③ read / write 는
// 별도 route tag(지표 오염 차단) ④ 임계는 §3 표 그대로 재산정 0(ADR-0054) ⑤ 조건 분기 로직 0.
import http from "k6/http";

// 대상 base URL — workflow 의 K6_BASE_URL 주입값과 동일한 기본값 (smoke.js · s2-read.js 동형).
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";

// 생성 POST 와 정리 DELETE 는 같은 write tag 를, 조회는 read tag 를 단다 (지표 분리 집계).
const WRITE_PARAMS = {
  headers: { "Content-Type": "application/json" },
  tags: { route: "write" },
};
const DELETE_PARAMS = { tags: { route: "write" } };
const READ_PARAMS = { tags: { route: "read" } };

export const options = {
  // 동시성 단계 상승 프로파일 — 고정 vus 는 S2 소관이고 본 시나리오는 ramping 이다.
  // 총 25s 로 묶어 수동 job 비용을 제한한다.
  stages: [
    { duration: "10s", target: 5 },
    { duration: "10s", target: 20 },
    { duration: "5s", target: 0 },
  ],
  thresholds: {
    // 계획 §3 표 값 그대로 — 전역 2 종 + route 별 2 종(국지 저하가 전역 p95 에 묻히지 않도록).
    http_req_duration: ["p(95)<3000"],
    http_req_failed: ["rate<0.01"],
    "http_req_duration{route:read}": ["p(95)<3000"],
    "http_req_duration{route:write}": ["p(95)<3000"],
  },
  // 단계별 latency cliff 곡선은 "baseline 후 fix" 라 임계 없이 k6 기본 summary 로 관찰만 한다.
};

export default function () {
  // run · VU · iteration 조합 접미사 — Person.email @unique 충돌(409)이 동시 실행에서도 전역
  // http_req_failed 임계를 오염시키지 않게 한다 (T-1623 stamp 규약 승계).
  const stamp = `${Date.now()}-${__VU}-${__ITER}`;
  const created = http.post(
    `${BASE_URL}/api/persons`,
    JSON.stringify({
      fullName: `동시 부하 ${stamp}`,
      email: `load-s3-${stamp}@example.com`,
    }),
    WRITE_PARAMS,
  );
  // 그 write 와 동시에 도는 목록 조회(혼합 부하의 read 절반) 후 자기 정리.
  http.get(`${BASE_URL}/api/persons`, READ_PARAMS);
  http.del(
    `${BASE_URL}/api/persons/${created.json("id")}`,
    null,
    DELETE_PARAMS,
  );
}
