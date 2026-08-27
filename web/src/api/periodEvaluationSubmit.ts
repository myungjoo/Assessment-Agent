// 기간 지정 평가 요청(`POST /api/assessment-evaluation/period`) 실행 · 응답 정규화 순수
// 모듈 — REQ-077 (PLAN 131 행 ④) slice 3 (T-1734).
//
// slice 1 (evaluationPeriod.ts) 이 조립한 `PeriodEvaluationRequest` 를 실제로 전송하고, role 에
// 따라 body shape 이 갈리는 응답(User → `EvaluationResult[]` ephemeral, Admin →
// `PeriodBridgeAdminResponse`)을 하나의 표시용 shape 으로 정규화한다. 배선(DashboardView 의 상태
// 소유 · 렌더 · 재조회)은 slice 4 책임이라 본 모듈은 react import 0 · fetch 직접 호출 0
// (apiClient.request 주입) · 계약 literal 재선언 0 · throw 0 — 모든 실패를 판별 가능한 outcome
// 값으로 흡수한다. `useApiResource` 의 `toErrorMessage` 를 쓰지 않는 이유는 그것이
// react hook 모듈에 묶여 순수 모듈에 react 를 유입시키고, 문구도 `HTTP 400: ...` generic 이라
// REQ-077 이 요구하는 status 별 사유 구분(네트워크/입력값/인증 만료/권한)을 못 만들기 때문이다.

import { ApiError, request as apiRequest, type RequestOptions } from './apiClient';
import type { PeriodEvaluationRequest } from './evaluationPeriod';

// 주입 의존성 — exportJobFlow.ts 관례 승계. 기본값이 apiClient 의 request 라 호출측은 생략 가능,
// spec 은 mock 주입으로 네트워크 없이 전 분기를 cover 한다.
export interface PeriodEvaluationSubmitDeps {
  request: (path: string, options?: RequestOptions) => Promise<unknown>;
}

// role 분기 응답을 하나로 접은 표시용 shape. 그 분기에 애초에 없는 값은 `null` 이다 — Admin
// 분기엔 건수(resultCount)가, User 분기엔 영속 식별자(assessmentId/created)가 없다.
export interface PeriodEvaluationSummary {
  assessmentId: string | null;
  created: boolean | null;
  resultCount: number | null;
}

export type PeriodEvaluationOk = PeriodEvaluationSummary & { status: 'ok' };

export interface PeriodEvaluationFailure {
  status: 'error';
  message: string;
}

export type PeriodEvaluationOutcome = PeriodEvaluationOk | PeriodEvaluationFailure;

// status 별 한국어 사유 — REQ-077 의 "왜 실패했는지" 구분 축.
const FAILURE_MESSAGES: Readonly<Record<number, string>> = {
  0: '네트워크 오류로 평가 요청을 보내지 못했습니다. 연결 상태를 확인해 주세요.',
  400: '요청 값이 올바르지 않습니다. 기간 · 시작일 · 대상자를 다시 확인해 주세요.',
  401: '인증이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.',
  403: '해당 대상자의 기간 평가를 요청할 권한이 없습니다.',
  404: '대상자를 찾을 수 없습니다. 대상자 선택을 확인해 주세요.',
};

const SERVER_FAILURE_MESSAGE = '서버 오류로 평가 요청이 처리되지 않았습니다. 잠시 후 다시 시도해 주세요.';
const UNKNOWN_FAILURE_MESSAGE = '알 수 없는 오류로 평가 요청이 실패했습니다.';
const INVALID_REQUEST_MESSAGE = '요청을 조립하지 못했습니다. 기간 · 시작일 · 대상자를 모두 선택해 주세요.';

/**
 * reject 표면을 한국어 사유로 매핑한다. `ApiError` 면 status 별 구분 문구, 5xx 는 서버 오류
 * 공통 문구, 매핑 밖 status 는 status 를 보존한 일반 문구, 비-`ApiError`(문자열 등 어떤 표면
 * 이든)는 알 수 없는 오류로 흡수한다.
 */
export function toPeriodEvaluationFailureMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return UNKNOWN_FAILURE_MESSAGE;
  }
  const mapped = FAILURE_MESSAGES[error.status];
  if (mapped !== undefined) {
    return mapped;
  }
  return error.status >= 500
    ? SERVER_FAILURE_MESSAGE
    : `평가 요청이 실패했습니다 (HTTP ${error.status}).`;
}

/**
 * role 분기 응답을 표시용 shape 으로 정규화한다(순수 · 입력 mutation 0 · throw 0). (a) 배열 →
 * ephemeral 결과로 보고 건수만 보존, (b) `assessmentId` 가 문자열인 객체 → Admin 영속 응답으로
 * 보고 식별자 + `created` 보존(비-boolean `created` 는 null), (c) 그 외(null · 원시값 · 식별자
 * 없는 객체) → 건수/식별자 모두 null 인 일반 성공.
 */
export function normalizePeriodEvaluationResponse(
  response: unknown,
): PeriodEvaluationSummary {
  if (Array.isArray(response)) {
    return { assessmentId: null, created: null, resultCount: response.length };
  }
  const source = (response ?? {}) as Record<string, unknown>;
  if (typeof source === 'object' && typeof source.assessmentId === 'string') {
    return {
      assessmentId: source.assessmentId,
      created: typeof source.created === 'boolean' ? source.created : null,
      resultCount: null,
    };
  }
  return { assessmentId: null, created: null, resultCount: null };
}

// 전송 가능한 계약인지 — slice 1 이 무효 입력에 `null` 을 돌려주므로 호출측이 그 `null` 을
// 그대로 넘기는 경우까지 값으로 흡수한다.
function isSendable(value: unknown): value is PeriodEvaluationRequest {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const source = value as Record<string, unknown>;
  return (
    typeof source.path === 'string' &&
    source.path !== '' &&
    source.body !== null &&
    typeof source.body === 'object'
  );
}

/**
 * 기간 지정 평가 요청을 전송하고 결과를 outcome 으로 반환한다. 어떤 실패(무효 요청 · 네트워크 ·
 * 비-2xx · 알 수 없는 reject 표면)에도 throw 하지 않으며, 성공 시 정규화된 요약을 반환한다.
 */
export async function submitPeriodEvaluation(
  request: PeriodEvaluationRequest | null | undefined,
  deps: PeriodEvaluationSubmitDeps = { request: apiRequest },
): Promise<PeriodEvaluationOutcome> {
  if (!isSendable(request)) {
    return { status: 'error', message: INVALID_REQUEST_MESSAGE };
  }
  try {
    const response = await deps.request(request.path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
    });
    return { status: 'ok', ...normalizePeriodEvaluationResponse(response) };
  } catch (e) {
    return { status: 'error', message: toPeriodEvaluationFailureMessage(e) };
  }
}
