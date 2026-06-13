// P6 composition wiring ③a (T-0381, ADR-0041 Decision 3) — thin custom fetch hook.
// `apiClient.request` 위에 loading/error/data 상태 보유만 얹는 얇은 React hook 이다.
// credentials 동반·401→refresh→retry 는 apiClient 가 이미 담당하므로 본 hook 은
// (1) mount/`path` 변경 시 조건부 조회, (2) loading/error/data 상태 노출, (3) unmount/
// 재요청 race 가드(stale 응답 무시) 세 가지 책임만 진다 (ADR-0041 Decision 3 loading/
// error → props 경계). 새 dependency 0 — react hooks + apiClient.request 만 사용한다
// (ADR-0040 §5 게이트). axios/react-query 미도입.
//
// 조건부 조회: `path === null`(또는 falsy) 이면 fetch 를 수행하지 않는다 — personId
// 미선택 시 `GET /api/assessments` 의 400(personId 누락) 을 회피하기 위한 컨테이너
// 측 가드(api.md 89–96)를 hook 레벨에서 받는다.

import { useEffect, useState } from 'react';
import { ApiError, request } from './apiClient';
import type { RequestOptions } from './apiClient';

// hook 이 호출 컨테이너에 노출하는 상태 — controlled lift-up 의 데이터/loading/error 묶음.
interface ApiResourceState<T> {
  // 조회 성공 시의 응답 body. 미조회/진행 중/실패 시 undefined.
  data?: T;
  // 진행 중 플래그 — path 가 truthy 인 동안 fetch 완료 전까지 true.
  loading: boolean;
  // 실패 시의 사람-친화 에러 문구(status + 메시지). 성공 시 undefined.
  error?: string;
}

// ApiError → 사람-친화 문구 파생(순수 함수, 테스트 용이). status 0 은 네트워크 실패로
// 구분 표기하고, 그 외는 "HTTP <status>: <message>" 형태로 외화한다. 비-ApiError 예외도
// 안전하게 문자열화한다(throw 표면이 무엇이든 컨테이너가 string error 만 받도록).
function toErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) {
      return `네트워크 오류: ${e.message}`;
    }
    return `HTTP ${e.status}: ${e.message}`;
  }
  if (e instanceof Error) {
    return e.message;
  }
  return '알 수 없는 오류';
}

// 초기/미조회 상태 — path 가 falsy 면 loading=false 로 둔다(진행 중 아님).
function idleState<T>(): ApiResourceState<T> {
  return { data: undefined, loading: false, error: undefined };
}

// fetch 실행 + race 가드를 캡슐화한 순수 async 러너(테스트 가능성 — jsdom 없이 effect
// 본체를 직접 검증). `isCancelled()` 가 true 면 도착 응답을 무시하고 `commit` 을 호출하지
// 않는다(stale/unmount 가드). path 가 falsy 면 즉시 idle 을 commit 하고 return.
// hook 의 useEffect 본체는 이 러너를 호출하기만 한다.
async function runFetch<T>(
  path: string | null,
  options: RequestOptions | undefined,
  isCancelled: () => boolean,
  commit: (next: ApiResourceState<T>) => void,
): Promise<void> {
  if (!path) {
    commit(idleState<T>());
    return;
  }
  try {
    const data = await request<T>(path, options);
    if (isCancelled()) {
      return;
    }
    commit({ data, loading: false, error: undefined });
  } catch (e) {
    if (isCancelled()) {
      return;
    }
    commit({ data: undefined, loading: false, error: toErrorMessage(e) });
  }
}

// thin custom fetch hook. path 가 truthy 면 mount/path 변경 시 request<T> 를 호출하고,
// 도착 응답을 cancelled 가드로 보호하며 state 에 반영한다. path 가 falsy 면 조회를
// 수행하지 않고 idle 상태를 유지한다(조건부 조회).
function useApiResource<T = unknown>(
  path: string | null,
  options?: RequestOptions,
): ApiResourceState<T> {
  // path 가 truthy 면 진행 중(loading=true)으로 시작, falsy 면 idle.
  const [state, setState] = useState<ApiResourceState<T>>(() =>
    path ? { data: undefined, loading: true, error: undefined } : idleState<T>(),
  );

  useEffect(() => {
    // 조건부 조회 — path 가 falsy 면 fetch 미수행 + idle 상태로 되돌린다(이전
    // 조회 결과가 남아 stale 표시되지 않도록 초기화). cleanup 불요.
    if (!path) {
      setState(idleState<T>());
      return;
    }

    // race 가드 — 본 effect 가 cleanup(unmount 또는 path 변경) 되면 cancelled 로
    // 표시해, 뒤늦게 도착한 응답이 새 state 를 덮어쓰지 않도록 한다.
    let cancelled = false;
    setState({ data: undefined, loading: true, error: undefined });

    void runFetch<T>(
      path,
      options,
      () => cancelled,
      (next) => setState(next),
    );

    return () => {
      cancelled = true;
    };
    // deps: path 만 — options 객체 신원 변화로 인한 무한 refetch 를 피한다(컨테이너는
    // path 에 query string 을 실어 보내므로 path 변경이 곧 조회 조건 변경이다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return state;
}

export { useApiResource, toErrorMessage, runFetch };
export type { ApiResourceState };
