// AdminView 의 스케줄 apply 축 러너 · 안내 문구 파생 helper(T-0885)를 담는 모듈 — T-1869 순수
// 추출. AdminView.tsx 가 4,688 줄로 남아있는 god component 부채(PLAN 183 행)를 갚는 여덟째
// 실분할이며, 본 모듈의 심볼은 AdminView 에서 **본문 한 줄도 바꾸지 않고** 옮겨온 것이다
// (동작 · 계약 · spec 무변경 — 선언 앞 export 키워드만 붙였다). 각 선언 위의 주석 블록은 그 러너가
// 막는 결함의 가드 근거 정본이라 함께 옮겼다. 배치를 web/src/views/ 아래로 잡은 이유는 이동 블록이
// 발사 primitive(request)와 상태 setter 를 전부 deps 로 주입받아 외부 값 import 가 0 이고 타입
// import 하나(RequestOptions)만 남기 때문이다. JSX 가 없으므로 확장자는 .ts 다.
//
// 경계를 apply 축으로 좁힌 이유 — 스케줄 축 심볼은 AdminView **소스 텍스트를 읽어 단언하는**
// drift-guard spec 4 개(schedule-apply · schedule-trigger · schedules-list · recent-deletion)에
// 묶여 있어, 옮긴 심볼마다 그 spec 의 읽기 대상 파일이 따라 바뀐다. 7 심볼을 한 slice 로 옮기면
// 고칠 spec 이 4 개라 파일 7 개가 되어 파일 cap(≤ 5)을 넘긴다(cap 은 LOC 만 면제되고 파일 수는
// 예외가 없다 — .claude/agents/planner.md § Estimate model). apply 축만 옮기면 고칠 spec 이 2 개라
// 총 5 파일로 cap 안에 들어온다. 잔여 심볼(runTrigger · 재평가 축)은 후속 slice 로 넘긴다.
//
// AdminView 와의 방향: AdminView → 본 모듈(값 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를
// 넓히지 말고 Follow-ups 로 남긴다). AdminView 파일 끝 export 목록은 임포트한 값 2 개
// (runApply · deriveScheduleMessage)를 그대로 re-export 하고, deps 타입 ScheduleMutationDeps 도
// 이동 전부터 `export type {` 표면이었으므로 그대로 re-export 한다(공개 표면 무변경). 이동 전
// export 가 아니던 상수 6 개는 AdminView 에서 새로 export 하지 않는다. 덕분에 기존 spec
// (AdminView.test.tsx 의 deriveScheduleMessage describe 군 · AdminView.schedule-apply-contract
// .test.ts 의 runApply · ScheduleMutationDeps import)의 `from './AdminView'` 가 import 경로 수정
// 없이 그대로 산다.
//
// 이동 범위 보정 — 러너가 직접 참조하는 모듈 상수 6 개도 본문 무변경으로 함께 옮겼다
// (SCHEDULES_PATH · DEFAULT_SCHEDULE_NAME · APPLY_DONE_TEXT · SCHEDULE_LOADING_TEXT ·
// NO_SCHEDULE_TEXT · SCHEDULE_LIST_PREFIX). AdminView 에 남겨두면 본 모듈 → AdminView 역방향
// import 가 생겨 위 단방향 규약을 깨뜨리기 때문이다(GROUPS_PATH 를 옮긴 T-1854 · PERSONS_PATH 를
// 옮긴 T-1856 · LLM_PROVIDERS_PATH 를 옮긴 T-1857 선례 동형). 반대로 SCHEDULE_TRIGGER_PATH 와
// TRIGGER_DONE_TEXT 는 AdminView 에 잔류하는 runTrigger 전용이라 함께 옮기지 않았다. 잔류
// 심볼(runTrigger · buildRecentDeletionPath · 조회 call site)은 필요한 값을 본 모듈에서 import 해
// 쓴다 — 정본 1 개 유지 · 재선언 0.

import type { RequestOptions } from '../api/apiClient';

// 스케줄 조회/upsert path — 고정 endpoint(GET/PUT /api/schedules, ADR-0042 Admin+). GET 은
// 등록된 schedule name string[] 을 반환하고, PUT 은 `{ name, cronExpression }` body 로 이름
// 붙은 cron 주기를 등록/교체한다(T-0885). Admin+ 라 User 등급은 403 — 그 403 은 error props
// 로 안전 표시(throw 없음). personId 같은 필수 query 가 없어 무조건 조회한다.
export const SCHEDULES_PATH = '/api/schedules';

// PUT body 에 공급할 단일 default schedule name 상수(T-0885). SchedulePanel 은 cronExpression
// 만 노출하고 name 은 노출하지 않으므로, 본 컨테이너가 단일 default name 1 개를 upsert 대상으로
// 고정한다(다중-named schedule 관리 UI 는 Out of Scope / Follow-up).
export const DEFAULT_SCHEDULE_NAME = 'daily-evaluation';

// apply(PUT) 성공 시 SchedulePanel 의 message props 로 내려보낼 사람-친화 완료 안내.
export const APPLY_DONE_TEXT = '스케줄 주기를 적용했습니다';

// 스케줄 목록 조회(GET) 진행 중 표시할 안내 문구 — busy(적용/실행 in-flight)가 아닌 정상
// 상태에서 message props 로 내려보낸다(초기 loading 안전 표시 — crash 없이).
export const SCHEDULE_LOADING_TEXT = '스케줄 정보를 불러오는 중…';

// 등록된 스케줄이 0 건일 때 표시할 빈 상태 안내 문구(GET 이 빈 배열 반환 — seed 전 정상).
export const NO_SCHEDULE_TEXT = '등록된 스케줄이 없습니다';

// 등록 스케줄 목록을 message 로 요약할 때 붙일 접두 문구(예: "등록된 스케줄: daily-evaluation").
export const SCHEDULE_LIST_PREFIX = '등록된 스케줄: ';

// SchedulePanel 의 apply(PUT)·manual trigger(POST) mutation + state-전이 로직에 주입하는 deps
// (T-0885 — ④c runAssign / ④e runImport 의 *Deps 주입 convention 차용. jsdom/렌더러 없이
// mutation 본체를 직접 검증한다). apply·trigger 는 SchedulePanel 의 단일 busy 슬롯을 공유하므로
// (패널이 busy=true 면 두 컨트롤 모두 억제) 하나의 busy 플래그·error·message setter 를 공유한다.
export interface ScheduleMutationDeps {
  // mutation 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  request: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 apply/trigger in-flight 여부 — true 면 미발사(동시 재호출·이중 발사 가드).
  busy: boolean;
  setBusy: (next: boolean) => void;
  setError: (next: string | undefined) => void;
  setMessage: (next: string | undefined) => void;
}

// onApply 의 PUT /api/schedules + state-전이 로직을 캡슐화한 순수 async 러너(T-0885 — runImport
// 캡슐화 패턴 차용). 컨테이너의 handleApply 는 이 러너에 현재 cron 입력값과 in-flight 여부(busy)·
// 상태 setter 를 주입해 호출만 한다. 동작:
//  - 빈/falsy cronExpression → 미발사(빈 값으로 apply 시 잘못된 body·400 회피 — 발사 억제 택1).
//  - busy(이전 apply/trigger 미완) → 미발사(이중 PUT·state 경합 차단 — runImport importing 가드 동형).
//  - 발사 시 진행 on + 이전 error·message 비움 → PUT `{ name: <default 상수>, cronExpression }` →
//    성공(완료 message 설정) / 실패(error 문구 표면화 — throw 없이) → 진행 off(공통).
export async function runApply(
  cronExpression: string,
  deps: ScheduleMutationDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/falsy cron 식은 PUT 미발사(잘못된 body 회피 — 발사 억제 구현 택1).
  if (!cronExpression) {
    return;
  }
  // 동시 재호출 가드 — 이전 apply/trigger 미완 중이면 미발사(이중 PUT·state 경합 차단).
  if (deps.busy) {
    return;
  }
  deps.setBusy(true);
  // 재발화 시작 시 직전 error·message 를 비운다(실패 후 재시도 시 직전 error 정리 + 직전 완료
  // 안내 정리 — 새 apply 의 진행 표시만 남도록, runImport 의 시작 정리 동형).
  deps.setError(undefined);
  deps.setMessage(undefined);
  try {
    // PUT /api/schedules — 단일 default schedule name + 현재 cron 입력값을 body 로 전송. name 은
    // SchedulePanel 이 노출하지 않으므로 컨테이너가 default 상수를 공급한다(다중-named 관리는 후속).
    await deps.request(SCHEDULES_PATH, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: DEFAULT_SCHEDULE_NAME,
        cronExpression,
      }),
    });
    // 성공 — 사람-친화 완료 안내를 message 로 표면화(SchedulePanel 의 정상 message 분기).
    deps.setMessage(APPLY_DONE_TEXT);
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 403 Admin+ 미만 / 400 유효하지
    // 않은 cron 식·빈 name / 404 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생.
    deps.setError(deps.describeError(e));
  } finally {
    deps.setBusy(false);
  }
}

// 등록 schedule name 목록 → SchedulePanel 의 message props 로 내려보낼 안내 문구 파생(순수
// helper, T-0885). 사용자 조작 결과(mutationMessage: apply/trigger 완료 안내)가 있으면 그것을
// 우선하고(최신 피드백), 없으면 GET 상태를 파생한다: loading 중이면 로딩 안내, 등록 0 건이면
// 빈 상태 안내, 1+ 건이면 이름 목록 요약("등록된 스케줄: a, b"). 비배열/undefined 입력도 빈
// 배열로 간주해 throw 없이 빈 상태 안내를 낸다(안전 처리).
export function deriveScheduleMessage(
  names: string[] | undefined,
  loading: boolean,
  mutationMessage: string | undefined,
): string {
  if (mutationMessage) {
    return mutationMessage;
  }
  if (loading) {
    return SCHEDULE_LOADING_TEXT;
  }
  if (!Array.isArray(names) || names.length === 0) {
    return NO_SCHEDULE_TEXT;
  }
  return `${SCHEDULE_LIST_PREFIX}${names.join(', ')}`;
}
