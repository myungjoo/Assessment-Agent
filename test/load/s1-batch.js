// test/load/s1-batch.js
// — R-91 / REQ-047 의 S1 시나리오("평가 배치 소요시간 ≤ 1h") k6 스크립트 골격 (T-1631).
// 계획 docs/ops/load-resilience-test-plan.md §2 S1 의 유일한 미착수 축이고, 결정은 ADR-0057 이
// 이미 박제했다 — 본 스크립트는 D2·D3·D4 를 집행만 한다.
//   D2 진입점: 신규 route 를 열지 않고 실재하는 배치성 route 하나
//              `POST /api/assessment-evaluation/unevaluated-fill-run`(RBAC Admin+) 만 때린다.
//   D3 tag  : batch(대상 route) / seed(준비 write · 정리) / auth(signup · login) 3 종 분리 —
//              임계는 batch 에만 걸어 준비·인증 왕복이 판정 지표에 섞이지 않게 한다.
//   D4 게이트: 133명 full run 대신 축소 표본(K6_S1_PERSONS 기본 10) 1 회를 재 선형 외삽 한다.
//   D5 전제: 대상 route 는 orchestrator 위임 전에 LlmProviderConfigResolver 를 await 하고 그
//            resolver 가 0-row 와 2+row 를 모두 throw(→ 503) 로 막는다. 그래서 setup() 이 실
//            등록 경로(POST /api/llm/providers)로 provider row 를 정확히 1 개로 수렴시킨다.
// 대상 route 가 Admin+ 라 이 run 의 첫 user 가 SuperAdmin 이어야 하고(src/user/user.controller.ts
// 9~11 행), 그 전제는 workflow step 순서 smoke → S1 → S2 → S3 이 보장한다. 규약 승계(s2-read.js):
// __ENV 기본값 · route tag 분리 · signup → login → cookie · setup/teardown 자기 정리 · 분기 0.
// 범위 밖(후속 slice): load-k6.yml step · package.json script · 133명 full seed.
import http from "k6/http";

// __ENV 기본값 2 종 — base URL 은 workflow 주입값과 동형(smoke.js · s2-read.js · s3-concurrent.js),
// 축소 표본 인원은 ADR-0057 D4 의 기본 10.
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";
const SAMPLE_PERSONS = Number(__ENV.K6_S1_PERSONS || 10);
// 외삽 기준 — realdata-scale-devset.md 6 행의 실 devset 133명 + REQ-047 1h 예산(§3 표) 그대로.
const EXTRAPOLATION_PERSONS = 133;
const FULL_RUN_BUDGET_MS = 3600000;
// 환산 임계 = 3,600,000ms × (표본 인원 / 133) — 리터럴로 굳히지 않고 스크립트가 계산한다(D4).
const BATCH_P95_MS = Math.round(
  FULL_RUN_BUDGET_MS * (SAMPLE_PERSONS / EXTRAPOLATION_PERSONS),
);

// D3 tag 3 종 — seed(준비 write · 정리 DELETE) · auth(signup · login) 는 대상 route 와 다른
// 이름을 써 batch 지표를 오염시키지 않는다(S2·S3 오염 차단 규약 승계).
const JSON_HEADERS = { "Content-Type": "application/json" };
const SEED_PARAMS = { headers: JSON_HEADERS, tags: { route: "seed" } };
const SEED_DELETE_PARAMS = { tags: { route: "seed" } };
const AUTH_PARAMS = { headers: JSON_HEADERS, tags: { route: "auth" } };

export const options = {
  // 배치는 1 회 호출이 곧 1 회 측정이라 반복(S2) · 동시성 단계 상승(S3) 프로파일을 쓰지 않는다.
  vus: 1,
  iterations: 1,
  thresholds: {
    // 판정 게이트 — 대상 route 에만. 단일 표본에서 p(95) 는 그 표본값 자체다.
    "http_req_duration{route:batch}": [`p(95)<${BATCH_P95_MS}`],
    // 배치 실패·재시도율 — 계획 §3 표 그대로, 재산정 0.
    http_req_failed: ["rate<0.01"],
  },
  // 서버 내부 단계별(수집 / LLM / 저장) 분해는 k6 가 볼 수 없어 임계 없이 남긴다(D3 — 후속).
};

export function setup() {
  // run 마다 유일한 접미사 — @unique 충돌(409)이 전역 http_req_failed 임계를 오염시키지 않게
  // 한다(stamp 규약 승계). (a) 인증 부트스트랩을 person seed 보다 먼저 끝낸다 — 뒤따르는 D5
  // provider seed 3 왕복이 전부 Admin+ gate 라 cookie 가 선행돼야 한다. signup(이 run 의 첫
  // user = SuperAdmin) → login → cookie. 자격증명은 stamp 로 매 run 새로 만든다(고정 리터럴 0).
  // user row 는 삭제 endpoint 자체가 없어 남긴다.
  const stamp = Date.now();
  const credentials = {
    email: `load-s1-auth-${stamp}@example.com`,
    password: `load-s1-pass-${stamp}`,
  };
  http.post(`${BASE_URL}/api/users`, JSON.stringify(credentials), AUTH_PARAMS);
  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify(credentials),
    AUTH_PARAMS,
  );
  // 토큰은 Set-Cookie 로만 온다 — response.cookies 는 이름별 배열이라 index 접근만(분기 0).
  const authCookie = `access_token=${login.cookies["access_token"][0].value}`;
  // (b) ADR-0057 D5 의 단일-row invariant — "있으면 된다" 가 아니라 "정확히 1" 이어야 하므로
  // 열거 → 전량 제거 → 1 회 생성의 멱등 3 단 왕복을 돈다. 세 왕복 모두 seed tag 라 batch 임계에
  // 섞이지 않는다. Admin+ gate 때문에 cookie 를 실은 seed params 2 종을 여기서 만든다.
  const providerParams = {
    headers: { "Content-Type": "application/json", Cookie: authCookie },
    tags: { route: "seed" },
  };
  const providerDeleteParams = {
    headers: { Cookie: authCookie },
    tags: { route: "seed" },
  };
  const listed = http.get(`${BASE_URL}/api/llm/providers`, providerParams);
  const existing = listed.json();
  for (let i = 0; i < existing.length; i += 1) {
    http.del(
      `${BASE_URL}/api/llm/providers/${existing[i].id}`,
      null,
      providerDeleteParams,
    );
  }
  // 더미 4 필드만 싣는다(allow-list 밖 키는 forbidNonWhitelisted 가 400). provider 만
  // LlmProvider 허용 집합 안의 값이어야 하고 나머지 3 개는 stamp 파생 더미다 — 실 endpoint ·
  // 실 key 0, 외부 호출 0(stub 이 켜진 부하 job 에서는 복호화조차 되지 않는다).
  const provider = http.post(
    `${BASE_URL}/api/llm/providers`,
    JSON.stringify({
      provider: "custom",
      endpointUrl: `http://load-s1-stub.invalid/${stamp}`,
      apiKey: `load-s1-dummy-${stamp}`,
      modelId: `load-s1-model-${stamp}`,
    }),
    providerParams,
  );
  // (c) 표본 인원만큼 평가 대상 person seed → id 수집.
  const personIds = [];
  for (let i = 0; i < SAMPLE_PERSONS; i += 1) {
    const created = http.post(
      `${BASE_URL}/api/persons`,
      JSON.stringify({
        fullName: `배치 부하 대상 ${stamp}-${i}`,
        email: `load-s1-${stamp}-${i}@example.com`,
      }),
      SEED_PARAMS,
    );
    personIds.push(created.json("id"));
  }
  return {
    personIds,
    providerId: provider.json("id"),
    authCookie,
    periodStart: new Date(stamp).toISOString(),
  };
}

export default function (data) {
  // 한 iteration = 표본 전원의 좌표를 실은 배치 호출 1 회. 좌표 4 축 = PeriodBridgeDto 필수 필드.
  const rawBridges = [];
  for (let i = 0; i < data.personIds.length; i += 1) {
    rawBridges.push({
      personId: data.personIds[i],
      period: "month",
      scope: "aggregate",
      periodStart: data.periodStart,
    });
  }
  // jwt.strategy 가 cookie 를 유일한 토큰 source 로 읽으므로 setup 의 cookie 를 header 로 싣는다.
  http.post(
    `${BASE_URL}/api/assessment-evaluation/unevaluated-fill-run`,
    JSON.stringify({ rawBridges }),
    {
      headers: { "Content-Type": "application/json", Cookie: data.authCookie },
      tags: { route: "batch" },
    },
  );
}

export function teardown(data) {
  // 로컬 반복 실행의 데이터 누적을 막으려 setup 이 만든 person 을 전량 회수한다(카운트 반복만).
  for (let i = 0; i < data.personIds.length; i += 1) {
    http.del(
      `${BASE_URL}/api/persons/${data.personIds[i]}`,
      null,
      SEED_DELETE_PARAMS,
    );
  }
  // D5 의 단일-row invariant 회수 — setup 이 만든 provider row 를 같은 DELETE 로 되돌린다.
  http.del(`${BASE_URL}/api/llm/providers/${data.providerId}`, null, {
    headers: { Cookie: data.authCookie },
    tags: { route: "seed" },
  });
}
