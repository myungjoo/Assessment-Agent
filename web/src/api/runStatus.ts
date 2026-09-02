// 실행 상태(run-status) 조회 클라이언트 — T-1848,
// [ADR-0060](../../../docs/decisions/ADR-0060-evaluation-run-status-endpoint.md)
// §Follow-ups (e) 의 (e1) slice. backend 는 이미 `GET /api/run-status` 를 서빙하고
// (T-1846) 실 HTTP 계약도 e2e 로 고정돼 있다(T-1847). 본 파일은 그 endpoint 를 "한 번
// 조회하는" 순수 client 이며, 5 초 interval · 탭 가시성 중단 같은 타이머 소유는 컴포넌트
// lifecycle 책임이라 여기에 두지 않는다(§Decision 5, (e2) slice 소관).
//
// 계약 정본은 `src/run-status/run-status.service.ts` `23~40 행` 과 ADR-0060 §Decision 2 —
// 응답은 항상 200, body 는 `{ active, evaluation, collection, observedAt }`, 최상위
// `active` 는 두 축의 OR, 축마다 불변식 `active === (runningCount > 0)`, RBAC 은 `User+`
// 이고 미인증은 401(§Decision 3) 이다. cookie 동반은 apiClient 책임이다.
//
// **모든 실패를 `false` 로 흡수하고 절대 reject 하지 않는다.** 이유 둘: (1) 소비처가 5 초
// 주기 polling 이라 조회가 reject 되면 탭이 열려 있는 내내 unhandled rejection 이 쌓인다.
// (2) 조회 실패는 "평가가 진행 중" 이라는 판단의 근거가 될 수 없다 — 401 · 5xx · 네트워크
// 단절 어느 쪽이든 아는 것은 "모른다" 뿐이고, 그때 배너를 띄우면 존재하지 않는 진행 상태를
// 보여주게 된다. 모를 때는 배너를 접는 쪽(`false`)이 안전하다. `auth.ts` 의 logout()/
// refresh() 가 실패를 boolean 으로 흡수하는 선례와 동형이다. 새 dependency 0 · 새
// credential 0 — credentials 동반 · 401→refresh→재시도 · 비-2xx/네트워크 실패 →
// `ApiError` 변환은 전부 apiClient 가 담당한다.

import { request } from './apiClient';

/** 실행 상태 조회 endpoint 경로. 함수 안에 문자열을 하드코딩하지 않는다(auth.ts 선례). */
export const RUN_STATUS_PATH = '/api/run-status';

/** 한 축의 실행 상태 — backend `RunAxisStatus`(run-status.service.ts `23~30 행`)와 1:1. */
export interface RunAxisStatusView {
  /** 해당 축이 실행 중인지 여부. 불변식: `active === (runningCount > 0)`. */
  active: boolean;
  /** 해당 축의 동시 실행 건수 (정수 ≥ 0). */
  runningCount: number;
  /** 실행 중인 것들 중 가장 이른 시작 시각 (ISO-8601 UTC). 비실행 시 `null`. */
  startedAt: string | null;
}

/**
 * `GET /api/run-status` 응답 body — backend `RunStatusSnapshot`
 * (run-status.service.ts `32~40 행`)과 1:1 이며 새 필드를 발명하지 않는다.
 */
export interface RunStatusSnapshotView {
  /** 두 축 중 하나라도 실행 중이면 `true` — 배너 토글의 단일 축. */
  active: boolean;
  evaluation: RunAxisStatusView;
  collection: RunAxisStatusView;
  /** 서버가 snapshot 을 만든 시각 (ISO-8601 UTC). */
  observedAt: string;
}

/**
 * 임의의 payload 에서 "지금 실행 중인가" 를 판정하는 순수 helper.
 *
 * 최상위 `active` 가 **엄격히 `true`** 일 때만 `true` 다. 문자열 `"true"` · 숫자 `1`
 * 같은 truthy 값은 `false` 로 본다 — 느슨한 비교를 쓰면 서버 shape 가 바뀌었을 때 배너가
 * 조용히 잘못 켜지고, 그 오류는 화면상 "평가 중" 문구로만 드러나 추적이 어렵다. 축별
 * `evaluation.active` 는 보지 않는다: 두 축의 OR 는 backend 가 이미 최상위 `active` 로
 * 계산하므로(§Decision 2) 클라이언트가 같은 규칙을 두 번 구현하면 규칙이 갈라진다.
 *
 * 어떤 입력에도 throw 하지 않는다(`null` · 원시값 · 배열 포함).
 */
export function isRunActive(payload: unknown): boolean {
  // `typeof null === 'object'` 이므로 null 을 먼저 걸러낸다. 배열도 객체지만
  // `active` 프로퍼티가 없어 아래 엄격 비교에서 자연히 false 가 된다.
  if (payload === null || typeof payload !== 'object') {
    return false;
  }
  return (payload as { active?: unknown }).active === true;
}

/**
 * 실행 상태를 1 회 조회한다. 성공하면 응답의 최상위 `active`, 실패하면 `false` — 파일
 * 헤더대로 401 · 403 · 5xx 의 `ApiError`, 네트워크 단절, 판정 불가 payload 를 모두
 * 흡수하고 reject 하지 않는다. 호출측은 반환값을 그대로 배너의 `active` prop 에 대입하면
 * 된다. method · body 를 지정하지 않아 apiClient 가 기본 `GET` 으로 호출하며, 조회가
 * 부수효과를 만들지 않음이 시그니처에서 보장된다.
 */
export async function fetchRunStatus(): Promise<boolean> {
  try {
    return isRunActive(await request(RUN_STATUS_PATH));
  } catch {
    return false;
  }
}
