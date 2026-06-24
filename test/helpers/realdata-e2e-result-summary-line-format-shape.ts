// realdata-e2e-result-summary-line-format-shape — 실 평가 e2e 결과 요약 "한 줄
// 요약" 라인 형태 불변식 검증 순수 가드(PLAN.md P5 109행 step ④ 표현 surface 무결성
// 조각 / REQ-005). `formatRealDataResultSummaryLine`(T-0642)는 JSDoc 으로 "결정적
// 한국어 단일 라인 — prefix `실 평가 e2e 결과: ` + `count=N` + `· volume=V` +
// `난이도(easy/medium/hard)=a/b/c` 슬롯 + `기여도(zero/low/medium/high)=p/q/r/s`
// 슬롯 · 개행 0" 이라는 출력 형태 불변식을 문서로만 박제했고, 그 한 줄은 자연
// 후속 caller surface(이슈 title·rolling 이슈 본문 상단 한 줄·journal/log·CI
// step_eval stdout)로 외화될 예정이다. 그러나 그 단일 라인 형태를 런타임에서
// fail-fast 로 강제하는 가드가 없어, 미래 회귀(개행 혼입·prefix drift·count/volume
// 토큰 누락·슬롯 누락·슬롯 순서 뒤바뀜·빈 라인 위장)가 발생하면 손상된 결과 라인이
// 표현 surface 로 silent leak 한다. 본 가드가 그 빈칸을 채운다 — 결과 라인이 형태
// 불변식을 위반하면 한국어 명세형 에러를 던져 손상 결과 라인이 표현 surface 로 새는
// 것을 차단한다. summary-batch 측 `assertSummaryBatchOutcomeFormatShape`(T-0638,
// outcome 라인 형태 가드)의 정확한 realdata-e2e-side mirror — 이번엔 realdata-e2e
// 결과 단일 라인 형태 가드.
//
// 부수효과 0 / 외부 의존 0 / `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0 /
// 입력 비변형(line 문자열 읽기만 — split/match/test/includes 결과로 원본 변형 0) /
// 동일 입력 → 동일 동작(정상 line 이면 항상 void 반환, 손상 line 이면 항상 동일 위치
// throw). raw 미저장(R-59 — 형태 검증만, 평가 본문·narrative 미접촉). 새 외부
// dependency 0, DB write·migration 0, live LLM 호출 0.
//
// 책임 경계(task Out of Scope):
//   - `realdata-e2e-result-summary-line.ts` 의 formatter 본문·출력 변경 0 — prefix
//     상수(`RESULT_LINE_PREFIX`)만 import 소비(single-source 정합, 라벨 drift 방지).
//   - 난이도/기여도 슬롯 라벨은 `DIFFICULTIES`(src/llm/difficulty.ts) /
//     `CONTRIBUTION_LEVELS`(evaluation-result.ts) import 사용(자체 정의 금지 —
//     single-source 고정 순서 정합).
//   - 자동 복구 / line 정규화 / drop / 재렌더 0 — 손상 line 을 고치거나 잘라내지
//     않는다(fail-fast throw 만). 복구는 호출처 책임.
//   - 산출 경로 자동 배선(이슈 title·body·journal·CI stdout 안에서 본 가드 호출) 0 —
//     순수 함수까지(호출처 배선은 별도 wiring follow-up — T-0636/T-0637 패턴 mirror).
//   - JSON schema / 외부 validation 라이브러리(zod·ajv) 도입 0 — 순수 문자열 검사만.
//
// 패턴 mirror: summary-batch-outcome-format-shape.ts(T-0638) 가드(순수 함수 /
// 구조·타입 결손은 TypeError / 값·형태 위반은 RangeError 구분 / 한국어 JSDoc·메시지 /
// 입력 비변형 / 결정성). 본 가드는 그 에러 정책·문구 톤·구조를 그대로 mirror 하되
// 대상이 outcome 한 줄이 아니라 realdata-e2e 결과 한 줄이다.

import { CONTRIBUTION_LEVELS } from "../../src/assessment-evaluation/domain/evaluation-result";
import { DIFFICULTIES } from "../../src/llm/difficulty";

import { RESULT_LINE_PREFIX } from "./realdata-e2e-result-summary-line";

// 개행 문자 — 결과 라인은 단일 라인이므로 `\n` 이 0개여야 한다
// (formatRealDataResultSummaryLine 산출 형태 정합 — 개행 0).
const LINE_SEP = "\n";

// COUNT_TOKENS — 전역 카운트 토큰들(`count=`·`· volume=`). formatter head 의
// `${RESULT_LINE_PREFIX}count=${count} · volume=${totalVolume}` 렌더 식과 정합. 각
// 토큰이 모두 등장해야 한다(하나라도 누락 시 ④ RangeError).
const COUNT_TOKENS = ["count=", "· volume="] as const;

// SLOT_VALUE — 슬롯 값 한 칸의 패턴(정수, 음수 허용 — formatter 가 음수 자릿수도
// silent drop 없이 그대로 렌더하므로 `-?\d+`). 슬롯 블록 regex 합성에 사용.
const SLOT_VALUE = "-?\\d+";

// DIFFICULTY_BLOCK — 난이도 슬롯 블록 regex. 라벨 키(easy/medium/hard)와 슬롯 개수는
// `DIFFICULTIES` single-source 배열로 합성(슬롯 키·순서 hard-code 0). 형태:
// `난이도(easy/medium/hard)=<N>/<N>/<N>`. 정규식 메타문자(`/`·`(`·`)`)는 escape.
const DIFFICULTY_BLOCK = new RegExp(
  `난이도\\(${DIFFICULTIES.join("/")}\\)=` +
    DIFFICULTIES.map(() => SLOT_VALUE).join("/"),
);

// CONTRIBUTION_BLOCK — 기여도 슬롯 블록 regex. 라벨 키(zero/low/medium/high)와 슬롯
// 개수는 `CONTRIBUTION_LEVELS` single-source 배열로 합성. 형태:
// `기여도(zero/low/medium/high)=<N>/<N>/<N>/<N>`.
const CONTRIBUTION_BLOCK = new RegExp(
  `기여도\\(${CONTRIBUTION_LEVELS.join("/")}\\)=` +
    CONTRIBUTION_LEVELS.map(() => SLOT_VALUE).join("/"),
);

/**
 * 실 평가 e2e 결과 요약 "한 줄 요약" 라인의 문서화된 형태 불변식을 런타임에서
 * 검증하는 순수 가드(PLAN.md P5 109행 / REQ-005). `assertSummaryBatchOutcomeFormatShape`
 * (T-0638, outcome 라인 형태 가드)의 정확한 realdata-e2e-side mirror.
 *
 * 검증하는 불변식(single source — realdata-e2e-result-summary-line.ts JSDoc·본문의
 * 코드 강제. prefix 상수 `RESULT_LINE_PREFIX`·슬롯 라벨 `DIFFICULTIES` /
 * `CONTRIBUTION_LEVELS` 는 각 모듈에서 import — drift 방지):
 *   ① `line` 은 string 이어야 한다(null/undefined/비-string 금지).
 *   ② 개행(`\n`)이 0개여야 한다(= 정확히 단일 라인). 1개 이상이면 위반.
 *   ③ prefix `실 평가 e2e 결과: `(`RESULT_LINE_PREFIX`)로 시작해야 한다. 빈 문자열·
 *     공백만은 여기서 차단(빈 라인 위장 차단).
 *   ④ 전역 카운트 토큰 `count=`·`· volume=` 가 모두 등장해야 한다. 누락 시 위반.
 *   ⑤ 난이도 슬롯 블록 — `난이도(easy/medium/hard)=<N>/<N>/<N>` 가 `DIFFICULTIES`
 *     single-source 고정 순서로 등장해야 한다(각 N 은 정수). 슬롯 누락·순서 drift 시 위반.
 *   ⑥ 기여도 슬롯 블록 — `기여도(zero/low/medium/high)=<N>/<N>/<N>/<N>` 가
 *     `CONTRIBUTION_LEVELS` single-source 고정 순서로 등장해야 한다. 슬롯 누락·순서
 *     drift 시 위반.
 *
 * 에러 정책(구조/타입 결손 = TypeError / 형태 정합 위반 = RangeError):
 *   - `line` 이 string 이 아님(①) → 한국어 TypeError.
 *   - 개행 혼입(②)·prefix 위반(③)·카운트 토큰 위반(④)·난이도 슬롯 위반(⑤)·기여도
 *     슬롯 위반(⑥) → 한국어 RangeError. 메시지에 어느 불변식이 깨졌는지 포함.
 *   - silent 통과(위반인데 정상 반환) 0.
 *
 * 검사 순서: ① string → ② 개행 0 → ③ prefix → ④ 카운트 토큰 → ⑤ 난이도 슬롯 → ⑥
 * 기여도 슬롯. 가장 먼저 위반한 지점에서 throw(fail-fast). prefix 를 토큰·슬롯 검사보다
 * 먼저 검사해 prefix drift 가 ④⑤⑥ 가 아니라 ③ 으로 정확히 진단되게 한다.
 *
 * 비변형 / 순수: `line` 문자열을 읽기만 한다(split/match/test/includes 는 새 값 생성 —
 * 원본 변형 0). 부수효과 0 · `@Injectable` 0 · Prisma 0 · LLM 0 · 새 외부 dependency 0.
 * 동일 line → 동일 동작(정상 line 이면 항상 void 반환, 손상 line 이면 항상 동일 위치 throw).
 *
 * @param line 검증 대상 결과 한 줄 요약 문자열(`formatRealDataResultSummaryLine` 산출).
 *   변형하지 않는다(읽기만).
 * @returns 형태 불변식 ①~⑥ 를 모두 만족하면 아무 일도 하지 않고 정상 반환(void).
 * @throws {TypeError} `line` 이 string 이 아님(null/undefined/비-string — 구조/타입 결손).
 * @throws {RangeError} 개행 혼입(②)·prefix 위반(③)·카운트 토큰 위반(④)·난이도 슬롯
 *   위반(⑤)·기여도 슬롯 위반(⑥). 메시지에 어느 불변식이 깨졌는지 포함.
 */
export function assertRealDataResultSummaryLineFormatShape(line: string): void {
  // ① string 타입 결손 — null/undefined/숫자/객체 등은 TypeError(구조 결손).
  if (typeof line !== "string") {
    throw new TypeError(
      `line 이 string 이 아니다(형태 검증 불가 — 값: ${String(line)}).`,
    );
  }

  // ② 개행 0 = 정확히 단일 라인. 개행이 하나라도 있으면 위반(후행/중간 무관).
  // split 으로 라인 수 산출(원본 비변형 — 새 배열 생성).
  const lineCount = line.split(LINE_SEP).length;
  if (lineCount !== 1) {
    throw new RangeError(
      `단일 라인 위반: line 은 개행(\`\\n\`) 0개(정확히 1 라인)여야 한다(실제 ${lineCount} 라인).`,
    );
  }

  // ③ prefix `실 평가 e2e 결과: ` 로 시작해야 한다. 빈 문자열·공백만은 여기서
  // 차단(빈 라인 위장 차단).
  if (!line.startsWith(RESULT_LINE_PREFIX)) {
    throw new RangeError(
      `prefix 위반: '${RESULT_LINE_PREFIX}' 라벨로 시작해야 한다(실제 시작: '${line.slice(0, RESULT_LINE_PREFIX.length)}').`,
    );
  }

  // ④ 전역 카운트 토큰 — `count=`·`· volume=` 가 모두 등장해야 한다. 하나라도 누락
  // 시 RangeError(카운트 토큰 누락).
  for (const token of COUNT_TOKENS) {
    if (!line.includes(token)) {
      throw new RangeError(
        `카운트 토큰 위반: '${token}' 토큰이 등장해야 한다(전역 카운트 토큰 누락).`,
      );
    }
  }

  // ⑤ 난이도 슬롯 블록 — DIFFICULTIES single-source 고정 순서로 모두 등장해야 한다
  // (`난이도(easy/medium/hard)=<N>/<N>/<N>`, 각 N 은 정수). 슬롯 누락·순서 drift 를
  // 한 정규식으로 검증(고정 순서 강제). 라벨/슬롯 개수는 배열에서 합성(자체 정의 0).
  if (!DIFFICULTY_BLOCK.test(line)) {
    throw new RangeError(
      `난이도 슬롯 위반: '난이도(${DIFFICULTIES.join("/")})=<N>/<N>/<N>' 슬롯이 고정 순서로 각 정수와 함께 등장해야 한다.`,
    );
  }

  // ⑥ 기여도 슬롯 블록 — CONTRIBUTION_LEVELS single-source 고정 순서로 모두 등장해야
  // 한다(`기여도(zero/low/medium/high)=<N>/<N>/<N>/<N>`). 슬롯 누락·순서 drift 위반.
  if (!CONTRIBUTION_BLOCK.test(line)) {
    throw new RangeError(
      `기여도 슬롯 위반: '기여도(${CONTRIBUTION_LEVELS.join("/")})=<N>/<N>/<N>/<N>' 슬롯이 고정 순서로 각 정수와 함께 등장해야 한다.`,
    );
  }
}
