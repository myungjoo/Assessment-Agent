import { describe, expect, it } from 'vitest';

// R-112 — T-1882 순수 추출로 신설된 모듈의 **경계 spec**. 렌더 비의존 정적 표면(문구 · DOM id
// 상수 군 + 폼 옵션 · in-flight 게이트 축)이 AdminView 안에 있었을 때는 컨테이너 렌더 spec 이
// 간접적으로만 훑던 fallback · 순서 계약을, 이동 후에는 모듈 경계에서 직접 검증할 수 있다.
// 본 파일이 검증하는 것은 (a) 값 · 타입 심볼이 새 모듈에서 직접 import 되는가, (b) 각 helper 의
// happy / error(안전 fallback) / 분기 / negative 계약이 무엇인가, (c) 재수출본과 직접 import 본이
// **동일 참조** 인가(기존 계약 spec 들의 `from './AdminView'` 위임 검증이 이동 후에도 계속
// 유효함의 근거) 다. 이동 전에는 존재할 수 없던 검증이라 기존 spec 과 중복이 아니다
// (adminProviderDifficultyDerivations.test.ts 선례 동형).
import {
  AUTH_ME_PATH,
  EXPORT_SCOPE_OPTIONS,
  LLM_PROVIDER_OPTIONS,
  LLM_PROVIDER_PLACEHOLDER_LABEL,
  NOT_ADMIN_NOTICE_TEXT,
  REEVAL_WINDOW_OPTIONS,
  SERVICE_IDENTITY_NOT_ADMIN_NOTICE_TEXT,
  createInFlightIdGate,
  resolveProviderSelectValue,
} from './adminViewConstants';
import type { InFlightIdGate } from './adminViewConstants';
import {
  LLM_PROVIDER_OPTIONS as reexportedLlmProviderOptions,
  createInFlightIdGate as reexportedCreateInFlightIdGate,
  resolveProviderSelectValue as reexportedResolveProviderSelectValue,
} from './AdminView';

// 실 provider 5 종의 canonical 식별자(server `LlmProvider` enum 과 수동 동기 — 모듈 주석 참조).
const EXPECTED_PROVIDER_VALUES = [
  'custom',
  'azure_openai',
  'anthropic',
  'google_gemini',
  'openai',
];

// gate 를 렌더 없이 세우기 위한 최소 test double — ref 는 평범한 가변 객체, setState 는 호출
// 인자와 **호출 시점의 ref 값** 을 함께 기록해 "ref 먼저 · setState 뒤" 순서를 관측 가능하게 한다.
function makeGate(initial?: string): {
  gate: InFlightIdGate;
  ref: { current: string | undefined };
  calls: Array<{ next: string | undefined; refAtCall: string | undefined }>;
} {
  const ref: { current: string | undefined } = { current: initial };
  const calls: Array<{ next: string | undefined; refAtCall: string | undefined }> = [];
  const gate = createInFlightIdGate(ref, (next) => {
    calls.push({ next, refAtCall: ref.current });
  });
  return { gate, ref, calls };
}

describe('adminViewConstants — 폼 옵션 배열 계약 (T-1882)', () => {
  it('EXPORT_SCOPE_OPTIONS 가 빈 선택(전체) 선두 + 3 후보의 값 집합과 일치한다 (happy-path)', () => {
    expect(EXPORT_SCOPE_OPTIONS.map((option) => option.value)).toEqual([
      '',
      'assessments',
      'questions',
      'persons',
    ]);
    // 선두가 빈 value 여야 "query 미부착 = 전체" 기본 동작이 유지된다(값 순서도 계약).
    expect(EXPORT_SCOPE_OPTIONS[0]).toEqual({ value: '', label: '전체' });
    expect(EXPORT_SCOPE_OPTIONS).toHaveLength(4);
  });

  it('LLM_PROVIDER_OPTIONS 가 server enum 5 멤버와 같은 canonical 식별자 집합이고 placeholder(빈 value)를 담지 않는다 (happy-path)', () => {
    expect(LLM_PROVIDER_OPTIONS.map((option) => option.value)).toEqual(
      EXPECTED_PROVIDER_VALUES,
    );
    // placeholder 는 컨테이너가 선두에 따로 배치한다 — 본 상수는 실 provider 만 담는 계약.
    expect(LLM_PROVIDER_OPTIONS.some((option) => option.value === '')).toBe(false);
    expect(LLM_PROVIDER_PLACEHOLDER_LABEL).toBe('provider 선택');
  });

  it('REEVAL_WINDOW_OPTIONS 가 최근 1일/1주/30일 3 후보의 days 값 집합과 일치한다 (happy-path)', () => {
    expect(REEVAL_WINDOW_OPTIONS.map((option) => option.days)).toEqual([1, 7, 30]);
    expect(REEVAL_WINDOW_OPTIONS.map((option) => option.label)).toEqual([
      '최근 1일',
      '최근 1주',
      '최근 30일',
    ]);
  });

  it('세 옵션 배열 모두 중복 value(또는 days)가 없고 빈 label 이 없다 (negative — 경계값 · 중복 방어)', () => {
    const exportValues = EXPORT_SCOPE_OPTIONS.map((option) => option.value);
    expect(new Set(exportValues).size).toBe(exportValues.length);
    const providerValues = LLM_PROVIDER_OPTIONS.map((option) => option.value);
    expect(new Set(providerValues).size).toBe(providerValues.length);
    const windowDays = REEVAL_WINDOW_OPTIONS.map((option) => option.days);
    expect(new Set(windowDays).size).toBe(windowDays.length);
    // 빈 label 은 <select> 에서 사람이 고를 수 없는 옵션을 만든다(접근성 회귀).
    for (const label of [
      ...EXPORT_SCOPE_OPTIONS.map((option) => option.label),
      ...LLM_PROVIDER_OPTIONS.map((option) => option.label),
      ...REEVAL_WINDOW_OPTIONS.map((option) => option.label),
    ]) {
      expect(label.trim()).not.toBe('');
    }
    // days 는 backend RecentDeletionDto 의 양수 정수 계약 — 0 · 음수 · 소수는 계약 위반이다.
    for (const days of windowDays) {
      expect(Number.isInteger(days)).toBe(true);
      expect(days).toBeGreaterThan(0);
    }
  });
});

describe('adminViewConstants — resolveProviderSelectValue (T-1882)', () => {
  it('목록에 있는 provider 값 5 종을 모두 그대로 돌려준다 (happy-path — 인식 분기)', () => {
    for (const value of EXPECTED_PROVIDER_VALUES) {
      expect(resolveProviderSelectValue(value)).toBe(value);
    }
  });

  it('undefined · 빈 문자열 · 미지 provider 를 모두 placeholder(빈 문자열)로 환원한다 (error / negative — 미인식 분기)', () => {
    expect(resolveProviderSelectValue(undefined)).toBe('');
    expect(resolveProviderSelectValue('')).toBe('');
    // 과거 free-text 로 저장된 레거시 값 · 대소문자 불일치 · 공백 오염은 전부 미인식이다.
    expect(resolveProviderSelectValue('legacy-free-text')).toBe('');
    expect(resolveProviderSelectValue('OpenAI')).toBe('');
    expect(resolveProviderSelectValue(' openai ')).toBe('');
  });

  it('인식 / 미인식 두 분기가 서로 다른 결과를 낸다 — 미인식이 인식 값을 오염시키지 않는다 (분기 cover)', () => {
    // 같은 접두를 공유하는 미지 값이 인식 값으로 새지 않는다(부분 일치가 아니라 정확 일치 계약).
    expect(resolveProviderSelectValue('openai_v2')).toBe('');
    expect(resolveProviderSelectValue('openai')).toBe('openai');
  });
});

describe('adminViewConstants — createInFlightIdGate (T-1882)', () => {
  it('write 직후 같은 tick 의 read 가 방금 쓴 값을 돌려준다 (happy-path — 동기 반영)', () => {
    const { gate, ref } = makeGate();
    expect(gate.read()).toBeUndefined();
    gate.write('row-1');
    expect(gate.read()).toBe('row-1');
    expect(ref.current).toBe('row-1');
  });

  it('undefined 로 해제하면 read 가 undefined 를 돌려준다 (error / negative — 해제 경로)', () => {
    const { gate, calls } = makeGate('row-1');
    expect(gate.read()).toBe('row-1');
    gate.write(undefined);
    expect(gate.read()).toBeUndefined();
    expect(calls.at(-1)?.next).toBeUndefined();
  });

  it('write 가 ref 를 먼저 동기 갱신한 뒤 setState 를 호출한다 (분기 / 순서 계약 — 이중 발사 창 차단)', () => {
    const { gate, calls } = makeGate();
    gate.write('row-1');
    expect(calls).toHaveLength(1);
    // setState 가 불릴 때 ref 는 이미 새 값이어야 한다 — 순서가 뒤집히면 첫 클릭 직후의 두 번째
    // 클릭이 stale 한 undefined 를 읽어 PATCH 가 2 회 발사된다(T-1165 가 막은 결함).
    expect(calls[0]).toEqual({ next: 'row-1', refAtCall: 'row-1' });
  });

  it('연속 write 가 매번 ref 와 setState 를 같은 순서로 갱신하고 read 는 항상 최신 ref 를 본다 (flow cover)', () => {
    const { gate, calls } = makeGate();
    gate.write('row-1');
    gate.write('row-2');
    gate.write(undefined);
    expect(calls.map((call) => call.next)).toEqual(['row-1', 'row-2', undefined]);
    expect(calls.map((call) => call.refAtCall)).toEqual(['row-1', 'row-2', undefined]);
    expect(gate.read()).toBeUndefined();
  });

  it('두 gate 인스턴스가 서로의 ref 를 공유하지 않는다 (negative — 인스턴스 격리)', () => {
    const first = makeGate();
    const second = makeGate();
    first.gate.write('row-1');
    expect(second.gate.read()).toBeUndefined();
    expect(second.calls).toHaveLength(0);
  });
});

describe('adminViewConstants — 문구 · 경로 상수와 AdminView 배럴 재수출 (T-1882)', () => {
  it('이동한 경로 · 안내 문구 상수의 값이 이동 전과 동일하다 (happy-path — 값 무변경)', () => {
    expect(AUTH_ME_PATH).toBe('/api/auth/me');
    expect(NOT_ADMIN_NOTICE_TEXT).toBe(
      'Admin 권한이 필요한 기능입니다 (현재 등급으로는 표시되지 않습니다)',
    );
    // 두 안내 문구는 한 화면에 동시에 뜰 수 있어 서로 달라야 한다(어느 패널 이야기인지 구분).
    expect(SERVICE_IDENTITY_NOT_ADMIN_NOTICE_TEXT).not.toBe(NOT_ADMIN_NOTICE_TEXT);
  });

  it('AdminView 배럴 재수출본이 새 모듈의 직접 import 본과 동일 참조다 (계약 — 기존 spec 의 위임 유효성)', () => {
    expect(reexportedResolveProviderSelectValue).toBe(resolveProviderSelectValue);
    expect(reexportedCreateInFlightIdGate).toBe(createInFlightIdGate);
    expect(reexportedLlmProviderOptions).toBe(LLM_PROVIDER_OPTIONS);
  });
});
