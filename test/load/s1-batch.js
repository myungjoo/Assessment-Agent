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
// 실 dataset 전제(T-1661): 평가 대상 person 은 이 스크립트가 만들지 않는다 — workflow 의
//   `pnpm seed:devset-logins` step(load-k6.yml)이 선행해 적재한 실 devset 인원을 setup() 이
//   조회해 표본 수만큼 취하고, 공유 dataset 이라 teardown() 은 그중 하나도 지우지 않는다.
// 대상 route 가 Admin+ 라 이 run 의 첫 user 가 SuperAdmin 이어야 하고(src/user/user.controller.ts
// 9~11 행), 그 전제는 workflow step 순서 smoke → S1 → S2 → S3 이 보장한다. 규약 승계(s2-read.js):
// __ENV 기본값 · route tag 분리 · signup → login → cookie · setup/teardown 자기 정리 · 분기 0.
// 범위 밖(후속 slice): 133명 full seed · 실 scale baseline 재실측 · 서버 단계별 분해 지표.
// (load-k6.yml step · package.json test:load:s1 은 T-1633 으로 배선 완료 — 후속 아님.)
import http from "k6/http";

// __ENV 기본값 2 종 — base URL 은 workflow 주입값과 동형(smoke.js · s2-read.js · s3-concurrent.js),
// 축소 표본 인원은 ADR-0057 D4 의 기본 10.
const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:3000";
// 표본 인원은 오입력(비수치 · 빈 문자열 · 단위 접미사 · 0 이하)을 기본값 · 양의 정수로 정규화한다
// — 값 재산정이 아니라 방어일 뿐이라 ADR-0057 D4 산식과 계획 §3 임계는 무변경이다(분기 0 표현).
const SAMPLE_PERSONS = Math.max(
  1,
  Math.trunc(Number(__ENV.K6_S1_PERSONS)) || 10,
);
// 외삽 기준 — realdata-scale-devset.md 6 행의 실 devset 133명 + REQ-047 1h 예산(§3 표) 그대로.
const EXTRAPOLATION_PERSONS = 133;
const FULL_RUN_BUDGET_MS = 3600000;
// 환산 임계 = 3,600,000ms × (표본 인원 / 133) — 리터럴로 굳히지 않고 스크립트가 계산한다(D4).
const BATCH_P95_MS = Math.round(
  FULL_RUN_BUDGET_MS * (SAMPLE_PERSONS / EXTRAPOLATION_PERSONS),
);
// stub 조건 baseline — T-1644 가 계획 §3 표에 확정한 stub(ADR-0057 D1) · 표본 133 관찰 임계다.
// REQ-047 판정 임계(위 외삽 산식) 가 아니라 회귀 감시용이라 둘을 합치지 않고 병기하며, 표본이
// 133 일 때만 얹는다(축소 표본에 적용하면 근거 없는 red). 조건은 분기문 0 규약대로 식으로만 쓴다.
// T-1668 규칙 ①-(a) 트리거가 S1 11 회차 실 run 에서 처음 충족돼 T-1675 가 재확정했다 — 실 scale
// 표본 전량(outlier 제거 0)의 평균 + 3σ = 1030.18ms 를 100ms 올림한 값이며, 성격은 그대로 관찰용
// 회귀 감시 임계다(REQ-047 판정 게이트 아님).
const STUB_BASELINE_PERSONS = 133;
const STUB_BASELINE_P95_MS = 1100;

// 실 devset seed 가 만드는 email 도메인 — 정본은 test/helpers/realdata-devset-seed-descriptors.ts
// 의 DEVSET_EMAIL_DOMAIN 이다. 한쪽만 바뀌면 조회가 0 건이 되어 부하가 조용히 빈 run 이 된다.
const DEVSET_EMAIL_DOMAIN = "load.devset.test";

// D3 tag 3 종 — seed(준비 write · 조회 · 정리) · auth(signup · login) 는 대상 route 와 다른
// 이름을 써 batch 지표를 오염시키지 않는다(S2·S3 오염 차단 규약 승계).
const JSON_HEADERS = { "Content-Type": "application/json" };
const SEED_PARAMS = { headers: JSON_HEADERS, tags: { route: "seed" } };
const AUTH_PARAMS = { headers: JSON_HEADERS, tags: { route: "auth" } };

export const options = {
  // (T-1688) 종료 요약 percentile 열 — k6 기본 6 종을 전부 보존한 위에 p(99) 만 더해
  // 계획 §3 "집계" 셋째 항의 미확보(설계 문제 (a))를 run log 에서 회수한다. 관찰 전용이라
  // 아래 thresholds 판정면은 문자 단위 0 변경이다(설계 조항 ②).
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
  // 배치는 1 회 호출이 곧 1 회 측정이라 반복(S2) · 동시성 단계 상승(S3) 프로파일을 쓰지 않는다.
  vus: 1,
  iterations: 1,
  thresholds: {
    // 판정 게이트 — 대상 route 에만. 단일 표본에서 p(95) 는 그 표본값 자체다.
    // 둘째 원소는 표본 133 일 때만 활성화되는 stub baseline(위 상수 주석) — filter 콜백이
    // 조건 표현이라 분기문 0 규약과 삼항 0 규약을 둘 다 유지한다.
    "http_req_duration{route:batch}": [`p(95)<${BATCH_P95_MS}`].concat(
      [`p(95)<${STUB_BASELINE_P95_MS}`].filter(
        () => SAMPLE_PERSONS === STUB_BASELINE_PERSONS,
      ),
    ),
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
  // (c) 평가 대상 person 을 만들지 않고 **조회** 한다(생성 0) — workflow 의 seed step 이 적재한
  // 실 devset 인원 중 email 이 devset 도메인으로 끝나는 원소만 골라 표본 수만큼 취한다. 표본이
  // 조회 결과보다 많든 적든 slice 한 식이 그대로 처리하므로 분기문 0 규약을 유지한다.
  const persons = http.get(`${BASE_URL}/api/persons`, SEED_PARAMS);
  const personIds = persons
    .json()
    .filter((row) => `${row.email}`.endsWith(`@${DEVSET_EMAIL_DOMAIN}`))
    .slice(0, SAMPLE_PERSONS)
    .map((row) => row.id);
  // (T-1666) 취한 표본 수와 요청 표본 수를 로그 1 줄로 남긴다 — 9 회차부터의 실측이 seed 적재
  // 건수 · 서비스 구현 · p95 대역 같은 간접 증거로 표본을 추론하지 않고 run log 에서 직접
  // 회수한다. 표본 부족(seed 미적재 · 도메인 불일치)도 같은 줄에서 드러난다. 수치 2 개만 싣고
  // 자격증명 · cookie · email 원문은 출력하지 않으며, 조건 없이 매 run 1 회라 분기 0 규약 유지.
  console.log(
    `[s1-batch] devset 표본 취득 ${personIds.length}명 / 요청 ${SAMPLE_PERSONS}명`,
  );
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
  // person 회수 0 — setup 이 조회만 했고 그 인원은 workflow seed step 이 적재한 공유 dataset 이라
  // 지우면 다음 run 이 빈 DB 위에서 돈다(T-1661). 여기서 되돌릴 것은 setup 이 만든 row 뿐이다.
  // D5 의 단일-row invariant 회수 — setup 이 만든 provider row 를 같은 DELETE 로 되돌린다.
  http.del(`${BASE_URL}/api/llm/providers/${data.providerId}`, null, {
    headers: { Cookie: data.authCookie },
    tags: { route: "seed" },
  });
}
