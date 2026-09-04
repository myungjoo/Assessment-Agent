import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// R-112 — T-1889 useAdminSchedule(AdminView 스케줄 · 재평가 축 순수 추출) 전용 colocated spec.
//
// harness 는 T-1884 useAdminImportExport.test.ts → T-1886 → T-1887 → T-1888
// useAdminServiceIdentities.test.ts 선례를 그대로 승계한다(신규 dependency 0 — RTL ·
// react-test-renderer 미도입): probe 컴포넌트가 hook 을 호출하고 renderToStaticMarkup 으로 1 회
// 렌더한 뒤, 렌더마다 sink 에 쌓인 반환값을 단언한다. 상태 전이가 필요한 분기(cron 입력 · window
// 선택 · person 선택 · mutation 실패 문구)는 "렌더 단계에서 핸들러 또는 러너에 주입된 setter 를
// 호출한다" 는 방식으로 만든다 — 렌더 중인 컴포넌트에서 setState 를 부르면 React 가 즉시 재렌더
// 하므로(render-phase update) 서버 렌더 harness 에서도 갱신된 반환값을 관측할 수 있다.
//
// 러너 3 종(runApply · runTrigger · runReEvaluate)과 조회 hook · api primitive 만 vi.mock 으로
// 대체하고, 안내 문구 helper(deriveScheduleMessage)는 인자를 기록하되 **원본 구현에 그대로 위임**
// 한다 — 본 spec 의 검증 대상은 "hook 이 어떤 인자를 어떤 러너 · helper 에 넘기는가(주입 계약)" 와
// "hook 이 어떤 값을 합성해 반환하는가" 이고, 러너 본문 동작은 adminScheduleRunners 쪽 spec 의
// 책임이다.

// vi.mock factory 는 파일 최상단으로 hoist 되므로 factory 가 참조하는 값도 vi.hoisted 로 함께
// 끌어올린다(일반 const 는 TDZ 라 mocking 시점에 접근 불가).
const {
  runApplyMock,
  runTriggerMock,
  runReEvaluateMock,
  deriveMessageMock,
  useApiResourceMock,
  toErrorMessageStub,
  requestStub,
} = vi.hoisted(() => ({
  runApplyMock: vi.fn(),
  runTriggerMock: vi.fn(),
  runReEvaluateMock: vi.fn(),
  deriveMessageMock: vi.fn(),
  useApiResourceMock: vi.fn(),
  // 이동 전 deps 에 실리던 describeError: toErrorMessage · request/post: request 배선을 identity
  // 로 잠그기 위해 식별 가능한 stub 을 주입한다(키만 맞고 값이 뒤바뀌는 배선 사고 방지).
  toErrorMessageStub: vi.fn(() => '문구'),
  requestStub: vi.fn(),
}));

vi.mock('../api/useApiResource', () => ({
  useApiResource: (...args: unknown[]) => useApiResourceMock(...args),
  toErrorMessage: toErrorMessageStub,
}));

// 부분 mock — apiClient 의 ApiError 등 나머지 export 는 원본을 남기고 발사 primitive 만 stub 으로
// 갈아끼운다(hook 은 request 를 두 축 deps 에 주입만 한다).
vi.mock('../api/apiClient', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  request: requestStub,
}));

// 부분 mock — SCHEDULES_PATH 등 상수는 원본을 그대로 쓰고 러너 3 종 + 문구 helper 만 관측 가능한
// 대체물로 바꾼다(helper 는 아래 beforeEach 에서 원본 구현으로 위임한다).
vi.mock('./adminScheduleRunners', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  runApply: (...args: unknown[]) => runApplyMock(...args),
  runTrigger: (...args: unknown[]) => runTriggerMock(...args),
  runReEvaluate: (...args: unknown[]) => runReEvaluateMock(...args),
  deriveScheduleMessage: (...args: unknown[]) => deriveMessageMock(...args),
}));

import {
  SCHEDULES_PATH,
  NO_SCHEDULE_TEXT,
  SCHEDULE_LOADING_TEXT,
  SCHEDULE_LIST_PREFIX,
} from './adminScheduleRunners';
import { useAdminSchedule } from './useAdminSchedule';
import type { UseAdminScheduleParams } from './useAdminSchedule';

// mock 되지 않은 원본 문구 helper — deriveMessageMock 이 이 구현에 위임해 "이동 전 파생 결과와
// 글자-동일" 을 실제 값으로 대조한다.
const actualRunners = await vi.importActual<
  typeof import('./adminScheduleRunners')
>('./adminScheduleRunners');

type Hook = ReturnType<typeof useAdminSchedule>;
type Deps = Record<string, unknown>;

const MEMBER_A = { id: 'p1', name: '김하나' };
const MEMBER_B = { id: 'p2', name: '이두리' };
const MEMBERS = [MEMBER_A, MEMBER_B];

// 반환 표면 계약 — JSX 소비처 두 덩어리가 쓰는 15 심볼(그 이상도 이하도 아니다).
const RETURN_KEYS = [
  'cronExpression',
  'handleApply',
  'handleCronChange',
  'handleManualTrigger',
  'handlePersonChange',
  'handleReevalSelect',
  'handleReevalTrigger',
  'personOptions',
  'reevalError',
  'reevalSubmitting',
  'schedulePanelError',
  'schedulePanelMessage',
  'scheduleBusy',
  'selectedDays',
  'selectedPersonId',
].sort();

const BASE_PARAMS: UseAdminScheduleParams = {
  initialCronExpression: '0 3 * * *',
  initialScheduleBusy: false,
  initialSelectedPersonId: 'p1',
  initialSelectedDays: 7,
  initialReevalSubmitting: false,
  members: MEMBERS,
};

interface ResourceState {
  data?: unknown;
  loading?: boolean;
  error?: string;
}

/** useApiResource mock 이 돌려줄 조회 상태를 갈아끼운다(hook 은 이 축 조회를 단 1 회 부른다). */
function setApiState(state: ResourceState): void {
  useApiResourceMock.mockImplementation(() => ({
    data: state.data,
    loading: state.loading ?? false,
    error: state.error,
  }));
}

/** 렌더 단계에서 hook 을 호출하고 매 렌더의 반환값을 sink 에 적재하는 probe. */
function Probe({
  sink,
  params,
  fire,
}: {
  sink: Hook[];
  params: UseAdminScheduleParams;
  fire?: (hook: Hook, renderIndex: number) => void;
}) {
  const hook = useAdminSchedule(params);
  sink.push(hook);
  fire?.(hook, sink.length);
  return null;
}

/**
 * probe 를 1 회 정적 렌더하고 렌더별 반환값 배열을 돌려준다. fire 는 렌더 단계에서 호출되므로
 * 여기서 setter 를 건드리면 render-phase update 가 일어나 다음 렌더가 이어진다(무한 루프를 피하려고
 * 호출자가 renderIndex 로 발화 시점을 스스로 제한한다).
 */
function renderProbe(
  overrides: Partial<UseAdminScheduleParams> = {},
  fire?: (hook: Hook, renderIndex: number) => void,
): Hook[] {
  const sink: Hook[] = [];
  // JSX 대신 createElement 를 쓰는 이유: 본 spec 이 순수 .ts 모듈의 colocated spec 이라
  // scripts/check-spec-presence.sh 가 기대하는 <모듈명>.test.ts 이름을 지켜야 한다(.tsx 는
  // 대응 spec 으로 인식되지 않는다). probe 는 null 만 반환하므로 JSX 가 실제로 필요하지 않다.
  renderToStaticMarkup(
    createElement(Probe, {
      sink,
      params: { ...BASE_PARAMS, ...overrides },
      fire,
    }),
  );
  return sink;
}

/** 마지막 렌더(= 모든 render-phase update 반영 후)의 반환값. */
function lastOf(sink: Hook[]): Hook {
  return sink[sink.length - 1];
}

/** 마지막 러너 호출이 받은 deps 객체(러너별 인자 위치가 달라 index 로 고른다). */
function lastDeps(mock: ReturnType<typeof vi.fn>, index: number): Deps {
  const calls = mock.mock.calls;
  return calls[calls.length - 1][index] as Deps;
}

beforeEach(() => {
  vi.clearAllMocks();
  setApiState({ data: ['daily-evaluation'] });
  runApplyMock.mockReturnValue(Promise.resolve());
  runTriggerMock.mockReturnValue(Promise.resolve());
  runReEvaluateMock.mockReturnValue(Promise.resolve());
  // 문구 helper 는 원본 구현에 위임한다 — 인자만 관측하고 값은 이동 전과 동일하게 파생된다.
  deriveMessageMock.mockImplementation((...args: unknown[]) =>
    (actualRunners.deriveScheduleMessage as (...a: unknown[]) => string)(
      ...args,
    ),
  );
});

describe('useAdminSchedule — happy path(초기 반환 · 조회 · 파생 계약)', () => {
  it('조회를 SCHEDULES_PATH 단일 인자로 1 회만 호출한다(default GET 유지)', () => {
    renderProbe();

    expect(useApiResourceMock).toHaveBeenCalledTimes(1);
    expect(useApiResourceMock.mock.calls[0]).toEqual([SCHEDULES_PATH]);
  });

  it('props 유래 초기값 5 개와 members 를 이동 전 그대로 반환에 싣는다', () => {
    const hook = lastOf(renderProbe());

    expect(hook.cronExpression).toBe('0 3 * * *');
    expect(hook.scheduleBusy).toBe(false);
    expect(hook.selectedPersonId).toBe('p1');
    expect(hook.selectedDays).toBe(7);
    expect(hook.reevalSubmitting).toBe(false);
    // personOptions = members 한 줄이 글자-동일로 남아 참조까지 그대로다(복사 · 가공 0).
    expect(hook.personOptions).toBe(MEMBERS);
    expect(hook.reevalError).toBeUndefined();
  });

  it('JSX 소비처가 쓰는 15 심볼만 공개하고 내부 setter 는 노출하지 않는다', () => {
    const hook = lastOf(renderProbe());

    expect(Object.keys(hook).sort()).toEqual(RETURN_KEYS);
    for (const fn of [
      hook.handleCronChange,
      hook.handleApply,
      hook.handleManualTrigger,
      hook.handleReevalTrigger,
      hook.handleReevalSelect,
      hook.handlePersonChange,
    ]) {
      expect(typeof fn).toBe('function');
    }
    // 내부 setter · 조회 원본은 캡슐화된다(축 밖에서 상태를 건드릴 경로 없음).
    for (const hidden of [
      'setScheduleBusy',
      'setScheduleMessage',
      'setScheduleError',
      'setSelectedDays',
      'setSelectedPersonId',
      'setReevalSubmitting',
      'scheduleData',
      'scheduleLoading',
      'scheduleGetError',
    ]) {
      expect(hook).not.toHaveProperty(hidden);
    }
  });

  it('schedulePanelMessage 가 deriveScheduleMessage(조회 data, loading, mutation 문구) 결과 그대로다', () => {
    setApiState({ data: ['daily-evaluation', 'weekly'], loading: false });

    const hook = lastOf(renderProbe());

    expect(deriveMessageMock).toHaveBeenCalledWith(
      ['daily-evaluation', 'weekly'],
      false,
      undefined,
    );
    expect(hook.schedulePanelMessage).toBe(
      `${SCHEDULE_LIST_PREFIX}daily-evaluation, weekly`,
    );
  });

  it('handleApply 가 runApply 를 (현재 cron 식, 주입 키 6 개) 로 1 회 호출한다', async () => {
    const hook = lastOf(renderProbe());

    await hook.handleApply();

    expect(runApplyMock).toHaveBeenCalledTimes(1);
    expect(runApplyMock.mock.calls[0][0]).toBe('0 3 * * *');
    const deps = lastDeps(runApplyMock, 1);
    expect(Object.keys(deps).sort()).toEqual([
      'busy',
      'describeError',
      'request',
      'setBusy',
      'setError',
      'setMessage',
    ]);
    expect(deps.request).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.busy).toBe(false);
  });

  it('handleManualTrigger 가 runTrigger 를 주입 키 6 개 단일 인자로 1 회 호출한다', async () => {
    const hook = lastOf(renderProbe());

    await hook.handleManualTrigger();

    expect(runTriggerMock).toHaveBeenCalledTimes(1);
    expect(runTriggerMock.mock.calls[0]).toHaveLength(1);
    const deps = lastDeps(runTriggerMock, 0);
    expect(Object.keys(deps).sort()).toEqual([
      'busy',
      'describeError',
      'request',
      'setBusy',
      'setError',
      'setMessage',
    ]);
    expect(deps.request).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
  });

  it('handleReevalTrigger 가 runReEvaluate 를 (선택 personId, days, 주입 키 5 개) 로 1 회 호출한다', async () => {
    const hook = lastOf(renderProbe());

    await hook.handleReevalTrigger(30);

    expect(runReEvaluateMock).toHaveBeenCalledTimes(1);
    expect(runReEvaluateMock.mock.calls[0][0]).toBe('p1');
    expect(runReEvaluateMock.mock.calls[0][1]).toBe(30);
    const deps = lastDeps(runReEvaluateMock, 2);
    // 재평가 축은 발사 primitive 키가 request 가 아니라 post 다(러너 계약 — 교차 배선 방지).
    expect(Object.keys(deps).sort()).toEqual([
      'describeError',
      'post',
      'setError',
      'setSubmitting',
      'submitting',
    ]);
    expect(deps.post).toBe(requestStub);
    expect(deps.describeError).toBe(toErrorMessageStub);
    expect(deps.submitting).toBe(false);
  });
});

describe('useAdminSchedule — error path', () => {
  it('러너가 reject 해도 hook 이 throw 를 삼키지 않고 그대로 전달하며 반환 표면이 무너지지 않는다', async () => {
    const boom = new Error('발사 실패');
    runApplyMock.mockReturnValue(Promise.reject(boom));
    runTriggerMock.mockReturnValue(Promise.reject(boom));
    runReEvaluateMock.mockReturnValue(Promise.reject(boom));
    const hook = lastOf(renderProbe());

    // 러너 계약 그대로 전달 — hook 은 try/catch 를 새로 만들지 않는다(본문 무변경).
    await expect(hook.handleApply()).rejects.toBe(boom);
    await expect(hook.handleManualTrigger()).rejects.toBe(boom);
    await expect(hook.handleReevalTrigger(7)).rejects.toBe(boom);
    // 반환 표면은 15 심볼 그대로 유지된다.
    expect(Object.keys(hook).sort()).toEqual(RETURN_KEYS);
  });

  it('조회가 error 를 돌려주면 schedulePanelError 가 그 값을 노출한다(throw 없음)', () => {
    setApiState({ data: undefined, error: '스케줄 조회 실패(403)' });

    const hook = lastOf(renderProbe());

    expect(hook.schedulePanelError).toBe('스케줄 조회 실패(403)');
    // 파생 문구는 여전히 안전 안내를 낸다(빈 목록 경로).
    expect(hook.schedulePanelMessage).toBe(NO_SCHEDULE_TEXT);
  });
});

describe('useAdminSchedule — branch cover', () => {
  it('schedulePanelError 3 분기 — mutation 실패 우선', () => {
    setApiState({ data: [], error: 'GET 실패' });
    // 러너가 주입받은 setError 를 렌더 단계에서 호출해 mutation 실패 상태를 만든다.
    runApplyMock.mockImplementation((_cron: unknown, deps: Deps) => {
      (deps.setError as (next: string) => void)('apply 실패');
      return Promise.resolve();
    });

    const sink = renderProbe({}, (hook, renderIndex) => {
      if (renderIndex === 1) {
        void hook.handleApply();
      }
    });

    expect(sink.length).toBeGreaterThan(1);
    expect(lastOf(sink).schedulePanelError).toBe('apply 실패');
  });

  it('schedulePanelError 3 분기 — mutation 실패가 없으면 GET 실패로 fallback', () => {
    setApiState({ data: [], error: 'GET 실패' });

    expect(lastOf(renderProbe()).schedulePanelError).toBe('GET 실패');
  });

  it('schedulePanelError 3 분기 — 둘 다 없으면 undefined', () => {
    setApiState({ data: ['daily-evaluation'] });

    expect(lastOf(renderProbe()).schedulePanelError).toBeUndefined();
  });

  it('handleCronChange 가 cron 입력값을 상태로 올려 다음 발사에 실린다', async () => {
    const sink = renderProbe({}, (hook, renderIndex) => {
      if (renderIndex === 1) {
        hook.handleCronChange('*/5 * * * *');
      }
    });

    const hook = lastOf(sink);
    expect(hook.cronExpression).toBe('*/5 * * * *');
    await hook.handleApply();
    expect(runApplyMock.mock.calls[0][0]).toBe('*/5 * * * *');
  });

  it('handleReevalSelect 가 선택 window(days)를 상태로 올린다', () => {
    const sink = renderProbe({}, (hook, renderIndex) => {
      if (renderIndex === 1) {
        hook.handleReevalSelect(30);
      }
    });

    expect(lastOf(sink).selectedDays).toBe(30);
  });

  it('handlePersonChange 가 <select> 이벤트 값을 선택 personId 로 올린다(빈 값이면 미선택 복귀)', async () => {
    const sink = renderProbe({}, (hook, renderIndex) => {
      if (renderIndex === 1) {
        hook.handlePersonChange({ target: { value: 'p2' } });
      }
      if (renderIndex === 2) {
        hook.handlePersonChange({ target: { value: '' } });
      }
    });

    expect(sink[1].selectedPersonId).toBe('p2');
    const hook = lastOf(sink);
    expect(hook.selectedPersonId).toBe('');
    // 미선택 복귀 후 발사해도 hook 은 값을 가공하지 않고 러너 가드에 맡긴다.
    await hook.handleReevalTrigger(7);
    expect(runReEvaluateMock.mock.calls[0][0]).toBe('');
  });
});

describe('useAdminSchedule — negative cases 충분 cover', () => {
  it('(i) members 가 빈 배열이면 personOptions 도 빈 배열이다(placeholder 경계값)', () => {
    const empty: { id: string; name: string }[] = [];

    const hook = lastOf(renderProbe({ members: empty }));

    expect(hook.personOptions).toEqual([]);
    expect(hook.personOptions).toBe(empty);
  });

  it('(ii) scheduleData 가 undefined 여도 파생이 throw 하지 않고 안전 안내를 낸다', () => {
    setApiState({ data: undefined, loading: true });

    expect(() => renderProbe()).not.toThrow();
    setApiState({ data: undefined, loading: true });
    expect(lastOf(renderProbe()).schedulePanelMessage).toBe(
      SCHEDULE_LOADING_TEXT,
    );
  });

  it('(ii) scheduleData 가 빈 배열이어도 파생이 throw 하지 않고 빈 목록 안내를 낸다', () => {
    setApiState({ data: [], loading: false });

    const hook = lastOf(renderProbe());

    expect(hook.schedulePanelMessage).toBe(NO_SCHEDULE_TEXT);
    expect(deriveMessageMock).toHaveBeenCalledWith([], false, undefined);
  });

  it('(iii) in-flight 초기값이 러너 deps 의 busy · submitting 으로 그대로 주입돼 이중 발사 가드가 산다', async () => {
    const hook = lastOf(
      renderProbe({ initialScheduleBusy: true, initialReevalSubmitting: true }),
    );

    await hook.handleApply();
    await hook.handleManualTrigger();
    await hook.handleReevalTrigger(7);

    expect(lastDeps(runApplyMock, 1).busy).toBe(true);
    expect(lastDeps(runTriggerMock, 0).busy).toBe(true);
    expect(lastDeps(runReEvaluateMock, 2).submitting).toBe(true);
    // 반환 표면에도 in-flight 가 그대로 실려 패널이 진행 표시를 유지한다.
    expect(hook.scheduleBusy).toBe(true);
    expect(hook.reevalSubmitting).toBe(true);
  });

  it('(iv) handleReevalTrigger 에 days = 0 을 넘겨도 hook 이 가공 없이 러너에 그대로 전달한다', async () => {
    const hook = lastOf(renderProbe());

    await hook.handleReevalTrigger(0);

    expect(runReEvaluateMock.mock.calls[0][1]).toBe(0);
  });

  it('(v) 초기 person 미선택(빈 문자열)에서도 반환 15 심볼이 정상 형태다', () => {
    const hook = lastOf(
      renderProbe({ initialSelectedPersonId: '', initialSelectedDays: 0 }),
    );

    expect(Object.keys(hook).sort()).toEqual(RETURN_KEYS);
    expect(hook.selectedPersonId).toBe('');
    expect(hook.selectedDays).toBe(0);
    expect(hook.reevalError).toBeUndefined();
  });

  it('(v) 빈 cron 식 초기값에서도 발사 인자가 가공 없이 그대로 러너로 간다', async () => {
    const hook = lastOf(renderProbe({ initialCronExpression: '' }));

    await hook.handleApply();

    expect(runApplyMock.mock.calls[0][0]).toBe('');
  });
});
