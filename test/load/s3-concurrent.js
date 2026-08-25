// test/load/s3-concurrent.js
// — R-91 / REQ-047·REQ-048 의 S3 시나리오("동시 요청 내성") k6 스크립트 (T-1625).
// 계획 docs/ops/load-resilience-test-plan.md §2 S3 — "평가 작성 진행 중 조회" 같은 read + write
// 혼합 부하를 동시성 수준을 올려가며 인가 — 를 처음 실발화시킨다(§3 표 S3 행: error rate < 1%).
// 규약(S2 승계): ① guard-free `/api/persons` 만 타격(401 이 http_req_failed 임계 오염 차단)
// ② 한 iteration 이 만든 row 는 같은 iteration 이 지운다(DB 무한 성장 차단) ③ read / write 는
// 별도 route tag(지표 오염 차단) ④ 임계는 §3 표 그대로 재산정 0(ADR-0054) ⑤ 조건 분기 로직 0.
//
// T-1682 — persons 행 수 로그 배선: setup / teardown 이 `GET /api/persons` 를 각 1 회 더 때리므로
// `http_reqs` 항등식이 `3 × iterations` → `3 × iterations + 2` 로 바뀐다. `#### S3 1 회차` 가
// 자기정리 판정 근거로 쓴 배수 관계를 다음 회차 분석자가 그대로 적용하면 2 건만큼 어긋난다.
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

// (T-1682) 표본 왕복 전용 tag — 판정 tag read / write 와 겹치지 않는 별도 이름이라
// `http_req_duration{route:read}` · `{route:write}` p95 가 준비/정리 조회에 오염되지 않는다
// (s2-read.js 의 seed / teardown 동형). 새 tag 용 임계는 추가하지 않는다(§3 표 재산정 0).
const SEED_PARAMS = { tags: { route: "seed" } };
const TEARDOWN_PARAMS = { tags: { route: "teardown" } };

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

export function setup() {
  // (T-1682) 부하 시작 시점의 persons 행 수를 조회 1 회로 직접 센다 — S2 teardown 뒤 공유 dataset
  // 이 보존됐는지를 `data_received` 같은 정황이 아니라 run log 에서 그대로 회수한다. 수치만 싣고
  // email 원문 · cookie · 자격증명 · 경로 리터럴은 출력하지 않으며, 조건 없이 매 run 1 회(분기 0).
  const startRows = http
    .get(`${BASE_URL}/api/persons`, SEED_PARAMS)
    .json().length;
  console.log(`[s3-concurrent] persons 행 수 시작 ${startRows}행`);
  // 반환값은 teardown 으로 그대로 전달되므로 JSON 직렬화 가능한 형태만 담는다.
  return { startRows };
}

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

export function teardown(data) {
  // (T-1682) 종료 시점의 persons 행 수를 조회 1 회로 직접 세고, 시작 행 수와 한 줄에 담는다 —
  // 두 수치의 차이가 곧 iteration 자기 정리(규약 ②)의 잔여라 `http_reqs` 배수 같은 간접 증거로
  // 잔여 0 을 추정하지 않아도 된다. 여기서도 수치 2 개만 싣고 조건 없이 run 당 1 회다(분기 0).
  const endRows = http
    .get(`${BASE_URL}/api/persons`, TEARDOWN_PARAMS)
    .json().length;
  console.log(
    `[s3-concurrent] persons 행 수 종료 ${endRows}행 / 시작 ${data.startRows}행`,
  );
}
