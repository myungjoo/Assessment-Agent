import { describe, expect, it, vi } from 'vitest';

// R-112 — T-1869 순수 추출로 신설된 모듈의 **경계 spec**. runApply 의 backend 계약 대조(경로 ·
// method · body 키 · DTO 정합)와 deriveScheduleMessage 의 렌더 배선 검증은 이미
// AdminView.schedule-apply-contract.test.ts · AdminView.schedules-list-contract.test.ts ·
// AdminView.test.tsx 의 스케줄 축 describe 군이 `from './AdminView'` 경로로 cover 하고 있어 여기서
// 그것을 복제하지 않는다. 본 파일이 검증하는 것은 그 spec 들이 볼 수 없는 **새 모듈 자신의 공개
// 표면** 이다 — 즉 (a) 값 심볼이 새 모듈에서 직접 import 되는가, (b) AdminView 재수출을 거치지 않은
// 직접 import 경로에서도 러너의 정상 / 실패 / 미발사 계약이 같은가, (c) 재수출본과 직접 import 본이
// **동일 함수 참조** 인가(기존 계약 spec 들의 위임 검증이 이동 후에도 계속 유효함의 근거).
// 이동 전에는 존재할 수 없던 검증이라 기존 spec 과 중복이 아니다.
//
// T-1870 이 같은 모듈로 옮긴 trigger · 재평가 축 4 심볼(runTrigger · buildRecentDeletionPath ·
// ReEvaluationDeps · runReEvaluate)에 대해서도 같은 (a)(b)(c) 축으로 경계 spec 을 확장한다.
import {
  APPLY_DONE_TEXT,
  DEFAULT_SCHEDULE_NAME,
  NO_SCHEDULE_TEXT,
  SCHEDULES_PATH,
  SCHEDULE_LIST_PREFIX,
  SCHEDULE_LOADING_TEXT,
  SCHEDULE_TRIGGER_PATH,
  TRIGGER_DONE_TEXT,
  buildRecentDeletionPath,
  deriveScheduleMessage,
  runApply,
  runReEvaluate,
  runTrigger,
} from './adminScheduleRunners';
import type { ReEvaluationDeps, ScheduleMutationDeps } from './adminScheduleRunners';
import {
  buildRecentDeletionPath as reexportedBuildRecentDeletionPath,
  deriveScheduleMessage as reexportedDeriveScheduleMessage,
  runApply as reexportedRunApply,
  runReEvaluate as reexportedRunReEvaluate,
  runTrigger as reexportedRunTrigger,
} from './AdminView';

const CRON = '0 3 * * *';
const BOOM = new Error('boom');
// 실패 문구 파생 — 입력을 그대로 되비추는 결정적 함수로 error 표면화 경로를 단언 가능하게 한다.
const describeError = (e: unknown) => `문구:${String(e)}`;

interface Harness {
  deps: ScheduleMutationDeps;
  request: ReturnType<typeof vi.fn>;
  setBusy: ReturnType<typeof vi.fn>;
  setError: ReturnType<typeof vi.fn>;
  setMessage: ReturnType<typeof vi.fn>;
}
// deps 주입 harness — 발사 primitive 와 setter 를 전부 spy 로 갈아끼워 러너 본체만 관측한다.
function harness(options: { busy?: boolean; reject?: boolean } = {}): Harness {
  const request = vi.fn(async () =>
    options.reject ? Promise.reject(BOOM) : undefined,
  );
  const setBusy = vi.fn();
  const setError = vi.fn();
  const setMessage = vi.fn();
  return {
    request,
    setBusy,
    setError,
    setMessage,
    deps: {
      request,
      describeError,
      busy: options.busy ?? false,
      setBusy,
      setError,
      setMessage,
    },
  };
}

describe('adminScheduleRunners — runApply (T-1869 경계 spec)', () => {
  it('직접 import 경로에서 PUT /api/schedules 를 1 회 발사하고 body 가 { name, cronExpression } 이며 완료 문구를 message 로 표면화한다 (happy-path)', async () => {
    const h = harness();
    await runApply(CRON, h.deps);
    expect(h.request).toHaveBeenCalledTimes(1);
    const [path, options] = h.request.mock.calls[0] as [string, { method: string; body: string }];
    expect(path).toBe(SCHEDULES_PATH);
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ name: DEFAULT_SCHEDULE_NAME, cronExpression: CRON });
    expect(h.setMessage).toHaveBeenLastCalledWith(APPLY_DONE_TEXT);
    expect(h.setError).toHaveBeenCalledTimes(1); // 시작 시 undefined 정리 1 회뿐(실패 표면화 없음)
    expect(h.setError).toHaveBeenCalledWith(undefined);
  });
  it('발사 시작 시 진행 플래그를 켜고 직전 error·message 를 비운 뒤 finally 로 진행을 되돌린다 (분기 — 성공 경로 state 전이 순서)', async () => {
    const h = harness();
    await runApply(CRON, h.deps);
    expect(h.setBusy.mock.calls).toEqual([[true], [false]]);
    expect(h.setError).toHaveBeenNthCalledWith(1, undefined);
    expect(h.setMessage).toHaveBeenNthCalledWith(1, undefined);
    expect(h.setMessage).toHaveBeenNthCalledWith(2, APPLY_DONE_TEXT);
  });
  it('주입 request 가 reject 하면 throw 없이 describeError 파생 문구를 error 로 표면화한다 (error path)', async () => {
    const h = harness({ reject: true });
    await expect(runApply(CRON, h.deps)).resolves.toBeUndefined();
    expect(h.setError).toHaveBeenLastCalledWith(describeError(BOOM));
  });
  // ── Negative cases 충분 cover ─────────────────────────────────────────────────────────────
  it('빈 문자열 cronExpression 이면 request 를 0 회 발사하고 어떤 state 도 건드리지 않는다 (negative ① — falsy-cron 가드)', async () => {
    const h = harness();
    await runApply('', h.deps);
    expect(h.request).not.toHaveBeenCalled();
    expect(h.setBusy).not.toHaveBeenCalled();
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.setMessage).not.toHaveBeenCalled();
  });
  it('busy: true 로 재호출하면 이중 PUT 이 나가지 않는다 (negative ② — in-flight 가드)', async () => {
    const h = harness({ busy: true });
    await runApply(CRON, h.deps);
    expect(h.request).not.toHaveBeenCalled();
    expect(h.setBusy).not.toHaveBeenCalled();
  });
  it('실패 경로에서는 완료 문구가 message 로 설정되지 않는다 (negative ③ — 실패를 성공으로 오인하지 않음)', async () => {
    const h = harness({ reject: true });
    await runApply(CRON, h.deps);
    expect(h.setMessage).not.toHaveBeenCalledWith(APPLY_DONE_TEXT);
    expect(h.setMessage).toHaveBeenCalledTimes(1); // 시작 시 정리 1 회뿐
  });
  it('실패한 뒤에도 setBusy(false) 가 반드시 호출된다 (negative ⑥ — finally 보장, 진행 플래그 고착 방지)', async () => {
    const h = harness({ reject: true });
    await runApply(CRON, h.deps);
    expect(h.setBusy.mock.calls).toEqual([[true], [false]]);
  });
});

describe('adminScheduleRunners — deriveScheduleMessage (T-1869 경계 spec)', () => {
  it('등록 이름 1+ 건이면 접두 문구와 이름 목록을 합성한다 (happy-path)', () => {
    expect(deriveScheduleMessage(['a', 'b'], false, undefined)).toBe(`${SCHEDULE_LIST_PREFIX}a, b`);
  });
  it('mutationMessage 가 있으면 그것을 최우선으로 낸다 (분기 — 사용자 조작 피드백 우선)', () => {
    expect(deriveScheduleMessage(['a'], false, APPLY_DONE_TEXT)).toBe(APPLY_DONE_TEXT);
  });
  it('mutationMessage 가 없고 loading 이면 로딩 안내를 낸다 (분기 — GET 진행 중)', () => {
    expect(deriveScheduleMessage(undefined, true, undefined)).toBe(SCHEDULE_LOADING_TEXT);
  });
  it('등록 0 건이면 빈 상태 안내를 낸다 (분기 — 빈 목록)', () => {
    expect(deriveScheduleMessage([], false, undefined)).toBe(NO_SCHEDULE_TEXT);
  });
  it('null·비배열 입력에서도 throw 없이 빈 상태 안내를 낸다 (negative ④ — 방어적 narrowing)', () => {
    expect(deriveScheduleMessage(null as unknown as string[], false, undefined)).toBe(NO_SCHEDULE_TEXT);
    expect(deriveScheduleMessage('a' as unknown as string[], false, undefined)).toBe(NO_SCHEDULE_TEXT);
    expect(deriveScheduleMessage(undefined, false, undefined)).toBe(NO_SCHEDULE_TEXT);
  });
  it('loading: true 여도 mutationMessage 가 있으면 로딩 안내가 아니라 그것을 낸다 (negative ⑤ — 우선순위 역전 방지)', () => {
    expect(deriveScheduleMessage(undefined, true, APPLY_DONE_TEXT)).toBe(APPLY_DONE_TEXT);
  });
});

const PERSON_ID = 'p-1';
const DAYS = 7;

interface ReEvalHarness {
  deps: ReEvaluationDeps;
  post: ReturnType<typeof vi.fn>;
  setSubmitting: ReturnType<typeof vi.fn>;
  setError: ReturnType<typeof vi.fn>;
}
// 재평가 deps 주입 harness — POST 발사 primitive 와 setter 를 spy 로 갈아끼워 러너 본체만 관측한다
// (위 apply harness 동형. 재평가는 message setter 가 없고 submitting 슬롯을 쓴다).
function reEvalHarness(
  options: { submitting?: boolean; reject?: boolean } = {},
): ReEvalHarness {
  const post = vi.fn(async () =>
    options.reject ? Promise.reject(BOOM) : undefined,
  );
  const setSubmitting = vi.fn();
  const setError = vi.fn();
  return {
    post,
    setSubmitting,
    setError,
    deps: {
      post,
      describeError,
      submitting: options.submitting ?? false,
      setSubmitting,
      setError,
    },
  };
}

describe('adminScheduleRunners — runTrigger (T-1870 경계 spec)', () => {
  it('직접 import 경로에서 POST /api/schedules/trigger 를 1 회 발사하고 body 를 싣지 않으며 완료 문구를 message 로 표면화한다 (happy-path)', async () => {
    const h = harness();
    await runTrigger(h.deps);
    expect(h.request).toHaveBeenCalledTimes(1);
    const [path, options] = h.request.mock.calls[0] as [
      string,
      { method: string; body?: string },
    ];
    expect(path).toBe(SCHEDULE_TRIGGER_PATH);
    expect(options.method).toBe('POST');
    expect(options.body).toBeUndefined(); // body 없는 202 Accepted fire-and-forget
    expect(h.setMessage).toHaveBeenLastCalledWith(TRIGGER_DONE_TEXT);
  });
  it('발사 시작 시 진행 플래그를 켜고 직전 error·message 를 비운 뒤 finally 로 진행을 되돌린다 (분기 — 성공 경로 state 전이 순서)', async () => {
    const h = harness();
    await runTrigger(h.deps);
    expect(h.setBusy.mock.calls).toEqual([[true], [false]]);
    expect(h.setError).toHaveBeenNthCalledWith(1, undefined);
    expect(h.setMessage).toHaveBeenNthCalledWith(1, undefined);
    expect(h.setMessage).toHaveBeenNthCalledWith(2, TRIGGER_DONE_TEXT);
  });
  it('주입 request 가 reject 하면 throw 없이 describeError 파생 문구를 error 로 표면화한다 (error path)', async () => {
    const h = harness({ reject: true });
    await expect(runTrigger(h.deps)).resolves.toBeUndefined();
    expect(h.setError).toHaveBeenLastCalledWith(describeError(BOOM));
  });
  // ── Negative cases 충분 cover ─────────────────────────────────────────
  it('busy: true 로 재호출하면 이중 POST 가 나가지 않고 어떤 state 도 건드리지 않는다 (negative ① — in-flight 가드)', async () => {
    const h = harness({ busy: true });
    await runTrigger(h.deps);
    expect(h.request).not.toHaveBeenCalled();
    expect(h.setBusy).not.toHaveBeenCalled();
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.setMessage).not.toHaveBeenCalled();
  });
  it('실패 경로에서는 완료 문구가 message 로 설정되지 않는다 (negative ② — 실패를 성공으로 오인하지 않음)', async () => {
    const h = harness({ reject: true });
    await runTrigger(h.deps);
    expect(h.setMessage).not.toHaveBeenCalledWith(TRIGGER_DONE_TEXT);
    expect(h.setMessage).toHaveBeenCalledTimes(1); // 시작 시 정리 1 회뿐
  });
  it('실패한 뒤에도 setBusy(false) 가 반드시 호출된다 (negative ③ — finally 보장, 진행 플래그 고착 방지)', async () => {
    const h = harness({ reject: true });
    await runTrigger(h.deps);
    expect(h.setBusy.mock.calls).toEqual([[true], [false]]);
  });
});

describe('adminScheduleRunners — buildRecentDeletionPath (T-1870 경계 spec)', () => {
  it('정상 personId 를 recent-deletion path param 으로 부착한다 (happy-path)', () => {
    expect(buildRecentDeletionPath(PERSON_ID)).toBe(
      `${SCHEDULES_PATH}/recent-deletion/${PERSON_ID}`,
    );
  });
  // ── Negative cases 충분 cover ─────────────────────────────────────────
  it('슬래시가 든 personId 는 %2F 로 인코딩돼 path 세그먼트가 늘지 않는다 (negative ④ — path 주입 방어)', () => {
    const path = buildRecentDeletionPath('a/b');
    expect(path).toBe(`${SCHEDULES_PATH}/recent-deletion/a%2Fb`);
    expect(path.split('/')).toHaveLength(5); // ['', 'api', 'schedules', 'recent-deletion', param] — param 이 1 세그먼트로 고정
  });
  it('공백·한글·물음표가 든 personId 도 안전 인코딩된다 (negative ⑤ — 비정상 문자 query 오염 방지)', () => {
    expect(buildRecentDeletionPath('a b')).toBe(`${SCHEDULES_PATH}/recent-deletion/a%20b`);
    expect(buildRecentDeletionPath('가')).toBe(`${SCHEDULES_PATH}/recent-deletion/%EA%B0%80`);
    expect(buildRecentDeletionPath('a?x=1')).toBe(`${SCHEDULES_PATH}/recent-deletion/a%3Fx%3D1`);
  });
  it('빈 문자열이면 마지막 세그먼트가 비어 backend 라우트와 매칭되지 않는다 (negative ⑥ — 러너의 falsy 가드 필요성 근거)', () => {
    expect(buildRecentDeletionPath('')).toBe(`${SCHEDULES_PATH}/recent-deletion/`);
  });
});

describe('adminScheduleRunners — runReEvaluate (T-1870 경계 spec)', () => {
  it('직접 import 경로에서 POST /api/schedules/recent-deletion/:personId 를 1 회 발사하고 body 가 { instants: [], days } 다 (happy-path)', async () => {
    const h = reEvalHarness();
    await runReEvaluate(PERSON_ID, DAYS, h.deps);
    expect(h.post).toHaveBeenCalledTimes(1);
    const [path, options] = h.post.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(path).toBe(buildRecentDeletionPath(PERSON_ID));
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ instants: [], days: DAYS });
  });
  it('발사 시작 시 진행 플래그를 켜고 직전 error 를 비운 뒤 finally 로 진행을 되돌린다 (분기 — 성공 경로 state 전이 순서)', async () => {
    const h = reEvalHarness();
    await runReEvaluate(PERSON_ID, DAYS, h.deps);
    expect(h.setSubmitting.mock.calls).toEqual([[true], [false]]);
    expect(h.setError.mock.calls).toEqual([[undefined]]); // 시작 정리 1 회뿐(성공 — error 표면화 없음)
  });
  it('주입 post 가 reject 하면 throw 없이 describeError 파생 문구를 error 로 표면화한다 (error path)', async () => {
    const h = reEvalHarness({ reject: true });
    await expect(runReEvaluate(PERSON_ID, DAYS, h.deps)).resolves.toBeUndefined();
    expect(h.setError).toHaveBeenLastCalledWith(describeError(BOOM));
  });
  // ── Negative cases 충분 cover ─────────────────────────────────────────
  it('빈 문자열 personId 면 post 를 0 회 발사하고 어떤 state 도 건드리지 않는다 (negative ⑦ — 인원 미선택 가드)', async () => {
    const h = reEvalHarness();
    await runReEvaluate('', DAYS, h.deps);
    expect(h.post).not.toHaveBeenCalled();
    expect(h.setSubmitting).not.toHaveBeenCalled();
    expect(h.setError).not.toHaveBeenCalled();
  });
  it('submitting: true 로 재호출하면 이중 POST 가 나가지 않는다 (negative ⑧ — in-flight 가드)', async () => {
    const h = reEvalHarness({ submitting: true });
    await runReEvaluate(PERSON_ID, DAYS, h.deps);
    expect(h.post).not.toHaveBeenCalled();
    expect(h.setSubmitting).not.toHaveBeenCalled();
  });
  it('실패한 뒤에도 setSubmitting(false) 가 반드시 호출된다 (negative ⑨ — finally 보장, 진행 플래그 고착 방지)', async () => {
    const h = reEvalHarness({ reject: true });
    await runReEvaluate(PERSON_ID, DAYS, h.deps);
    expect(h.setSubmitting.mock.calls).toEqual([[true], [false]]);
  });
});

describe('adminScheduleRunners — AdminView 재수출 identity (T-1869 경계 spec)', () => {
  it('AdminView 재수출본과 직접 import 본이 동일 함수 참조다 (negative ⑦ — 재선언·래핑으로 갈리지 않음)', () => {
    expect(reexportedRunApply).toBe(runApply);
    expect(reexportedDeriveScheduleMessage).toBe(deriveScheduleMessage);
  });
  it('T-1870 이동분 3 심볼도 AdminView 재수출본이 동일 함수 참조다 (negative ⑧ — 이동 후 공개 표면 무변경 근거)', () => {
    expect(reexportedRunTrigger).toBe(runTrigger);
    expect(reexportedRunReEvaluate).toBe(runReEvaluate);
    expect(reexportedBuildRecentDeletionPath).toBe(buildRecentDeletionPath);
  });
});
