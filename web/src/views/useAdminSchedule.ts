// AdminView 스케줄 · 재평가 축 hook(T-1889) — AdminView 본문 `1050 행` ~ `1080 행`(스케줄 패널
// 배선)과 `1490 행` ~ `1598 행`(스케줄 파생 · 핸들러 + 재평가 트리거 패널 배선) 두 구역의 19 선언
// (상태 9 + 조회 1 + 파생 3 + 핸들러 6)을 선행 · 꼬리 주석까지 본문 무변경으로 옮긴 순수 추출
// 모듈이다. 동작 변경 0 — 옮긴 선언의 본문 · `useMemo`/`useCallback` deps 배열 · 러너 주입 키가
// 이동 전과 한 글자도 다르지 않고, 새로 쓴 것은 함수 시그니처와 반환 literal 뿐이다.
//
// 외부 의존(스케줄 · 재평가 러너 3 종 · 안내 문구 helper · 조회 경로 상수 · 조회 hook · api
// primitive)은 전부 모듈 최상위 import 로 해결하고, 축이 참조하는 props 유래 초기값 5 개
// (`initialCronExpression` · `initialScheduleBusy` · `initialSelectedPersonId` ·
// `initialSelectedDays` · `initialReevalSubmitting`)와 축 밖 값 `members`(그룹 축 파생 —
// `personOptions` 한 줄이 그대로 재사용한다)만 단일 파라미터 object 로 받는다. 기본값 로직은
// AdminView 의 props destructure 가 계속 소유한다(hook 안 분기 · 기본값 신설 0).
//
// 반환은 JSX 소비처 두 덩어리(SchedulePanel props · 재평가 인원 <select> + 재평가 패널 props)가
// 실제로 쓰는 15 심볼만 공개하고 내부 setter(`setScheduleBusy` · `setSelectedDays` 등)와 조회 원본
// (`scheduleData` · `scheduleLoading` · `scheduleGetError`)은 노출하지 않는다(캡슐화 —
// T-1884/T-1886/T-1887/T-1888 선례 승계).
//
// 본 모듈은 AdminView 배럴에 추가하지 않는다 — 기존 공개 표면 무변경이 순수 추출의 전제다.
import { useCallback, useMemo, useState } from 'react';
import { useApiResource, toErrorMessage } from '../api/useApiResource';
import { request } from '../api/apiClient';
import {
  SCHEDULES_PATH,
  deriveScheduleMessage,
  runApply,
  runReEvaluate,
  runTrigger,
} from './adminScheduleRunners';
import type { Member } from '../components/GroupMemberList';

export interface UseAdminScheduleParams {
  // AdminView props 유래 초기값 5 개 — 기본값 자체는 AdminView 의 destructure 가 소유한다.
  initialCronExpression: string;
  initialScheduleBusy: boolean;
  initialSelectedPersonId: string;
  initialSelectedDays: number;
  initialReevalSubmitting: boolean;
  // 축 밖 값 — 그룹 축이 파생한 선택 그룹 멤버. `personOptions` 가 그대로 재사용한다.
  members: Member[];
}

export function useAdminSchedule({
  initialCronExpression,
  initialScheduleBusy,
  initialSelectedPersonId,
  initialSelectedDays,
  initialReevalSubmitting,
  members,
}: UseAdminScheduleParams) {
  // === 스케줄 패널 배선(T-0885) — 다섯 번째 패널 ==========================================
  // cron 식 입력 상태 — controlled lift-up(컨테이너 소유). SchedulePanel 의 onCronChange 가
  // 이 값을 갱신하고, handleApply 가 PUT body 의 cronExpression 으로 공급한다.
  const [cronExpression, setCronExpression] =
    useState<string>(initialCronExpression);

  // apply/trigger in-flight 플래그 — SchedulePanel 이 단일 busy 슬롯으로 두 컨트롤을 억제하므로
  // (busy=true 면 입력·버튼 미렌더 → 중복 트리거 원천 차단) 하나의 busy 상태를 공유한다. 진행 표시
  // (busy 우선)와 이중 발사 가드(runApply/runTrigger 의 busy 가드)에 함께 쓴다(④d exporting 동형).
  const [scheduleBusy, setScheduleBusy] = useState<boolean>(initialScheduleBusy);

  // apply/trigger 완료 안내 문구 — 성공 시 사람-친화 완료 안내를 보관해 message props 로 표시한다.
  // 재발화 시작·실패 시 비운다(④d exportMessage 동형). GET 파생 안내보다 우선(최신 피드백).
  const [scheduleMessage, setScheduleMessage] = useState<string | undefined>(
    undefined,
  );

  // apply/trigger 실패 문구 — 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error props 로
  // 안전 표시한다(throw 없음). 재발화 시작 시 비운다(④d exportError 동형).
  const [scheduleError, setScheduleError] = useState<string | undefined>(
    undefined,
  );

  // 등록 스케줄 목록 조회(GET /api/schedules, Admin+) — useApiResource 다섯 번째 호출. 응답
  // string[](등록 schedule name 목록)·loading·error 를 컨테이너가 받아 message/error props 로
  // 내려보낸다(Decision 1 — 패널은 fetch 를 모른다). Admin+ 라 User 는 403→error props 안전 표시.
  const {
    data: scheduleData,
    loading: scheduleLoading,
    error: scheduleGetError,
  } = useApiResource<string[]>(SCHEDULES_PATH);

  // SchedulePanel 로 내려보낼 안내 message 파생 — apply/trigger 완료 안내 우선, 없으면 GET 상태
  // (loading/빈 목록/이름 목록 요약)를 파생한다(deriveScheduleMessage). 초기 loading 도 안전 안내.
  const schedulePanelMessage = useMemo(
    () =>
      deriveScheduleMessage(scheduleData, scheduleLoading, scheduleMessage),
    [scheduleData, scheduleLoading, scheduleMessage],
  );

  // SchedulePanel 로 내려보낼 error 파생 — mutation 실패(scheduleError)를 최우선 노출하고(방금
  // 사용자가 한 apply/trigger 의 실패가 가장 최신 피드백), 없으면 GET 실패(scheduleGetError)를
  // 표시한다. 둘 다 없으면 undefined. Admin+ 미만 403 도 이 경로로 안전 표시(throw 없음). busy 중
  // 에는 패널이 error 를 무시하고 진행 표시를 우선한다(busy 우선 정책).
  const schedulePanelError = scheduleError ?? scheduleGetError;

  // onApply 실 핸들러(T-0885) — apply PUT 을 컨테이너 내부 async 로 발사한다(runImport 정합 —
  // useApiResource 는 read-on-mount 라 클릭 발화에 부적합). 빈 cron 식 발사 억제 + 이중 발사 가드 +
  // 성공/실패 message·error 전이는 runApply 가 캡슐화한다. busy 를 deps 의존성에 포함해 stale 가드
  // 방지, cronExpression 을 포함해 최신 입력값을 발사한다.
  const handleApply = useCallback(
    () =>
      runApply(cronExpression, {
        request,
        describeError: toErrorMessage,
        busy: scheduleBusy,
        setBusy: setScheduleBusy,
        setError: setScheduleError,
        setMessage: setScheduleMessage,
      }),
    [cronExpression, scheduleBusy],
  );

  // onManualTrigger 실 핸들러(T-0885) — manual trigger POST 를 컨테이너 내부 async 로 발사한다.
  // 이중 발사 가드 + 성공/실패 전이는 runTrigger 가 캡슐화한다(body 없는 202 Accepted).
  const handleManualTrigger = useCallback(
    () =>
      runTrigger({
        request,
        describeError: toErrorMessage,
        busy: scheduleBusy,
        setBusy: setScheduleBusy,
        setError: setScheduleError,
        setMessage: setScheduleMessage,
      }),
    [scheduleBusy],
  );

  // cron 식 변경 — SchedulePanel 의 cron 입력이 값을 컨테이너 상태로 올린다(controlled lift-up).
  // 그룹 선택 handleSelectChange 동형. SchedulePanel 은 이 값의 저장처를 모른다(Decision 1).
  const handleCronChange = useCallback((value: string) => {
    setCronExpression(value);
  }, []);
  // === /스케줄 패널 배선(T-0885) =========================================================

  // === 재평가 트리거 패널 배선(T-0886) — 여섯 번째 패널 ==================================
  // 선택 person 상태 — controlled lift-up(컨테이너 소유). person <select> 선택이 이 값을 갱신하고,
  // handleReevalTrigger 가 POST path param 으로 공급한다. 옵션은 선택 그룹의 파생 members 를 쓴다
  // (기존 deriveMembers 결과 재사용 — 별도 fetch 0). 그룹 선택 <select> 동형의 controlled lift-up.
  const [selectedPersonId, setSelectedPersonId] = useState<string>(
    initialSelectedPersonId,
  );

  // 선택 재수집 window(days) 상태 — controlled lift-up. ReEvaluationTriggerPanel 의 onSelect 가 이
  // 값을 갱신하고, onTrigger 가 이 값을 body.days 로 발사한다. 0(windows 미매칭)이면 panel 이
  // placeholder 로 fallback + 트리거 버튼 비활성(경계값 안전 — 의미 없는 기간 트리거 방지).
  const [selectedDays, setSelectedDays] = useState<number>(initialSelectedDays);

  // 재평가 in-flight 플래그 — POST 진행 중 true. 진행 표시(submitting 우선)와 이중 발사 가드
  // (runReEvaluate 의 submitting 가드)에 함께 쓴다(scheduleBusy 동형).
  const [reevalSubmitting, setReevalSubmitting] = useState<boolean>(
    initialReevalSubmitting,
  );

  // 재평가 실패 문구 — 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error props 로 안전
  // 표시한다(throw 없음). 재발화 시작 시 비운다(scheduleError 동형). 성공 시 error 는 undefined 유지.
  const [reevalError, setReevalError] = useState<string | undefined>(undefined);

  // person 선택 옵션 — 선택 그룹의 파생 members 를 재사용한다(deriveMembers 결과). 그룹 미선택/멤버
  // 0 이면 빈 옵션(placeholder 만) — 재평가 트리거는 person 미선택 가드로 안전하게 억제된다.
  const personOptions = members;

  // onTrigger 실 핸들러(T-0886) — 재평가 POST 를 컨테이너 내부 async 로 발사한다(runTrigger 정합 —
  // useApiResource 는 read-on-mount 라 클릭 발화에 부적합). 선택 personId(path param)·days(body)·
  // in-flight 여부·상태 setter 를 runReEvaluate 에 주입한다. person 미선택 발사 억제 + 이중 발사
  // 가드 + 성공/실패 전이는 runReEvaluate 가 캡슐화한다. selectedPersonId·reevalSubmitting 을 deps
  // 의존성에 포함해 stale 없이 최신값을 발사·가드한다.
  const handleReevalTrigger = useCallback(
    (days: number) =>
      runReEvaluate(selectedPersonId, days, {
        post: request,
        describeError: toErrorMessage,
        submitting: reevalSubmitting,
        setSubmitting: setReevalSubmitting,
        setError: setReevalError,
      }),
    [selectedPersonId, reevalSubmitting],
  );

  // onSelect 실 핸들러(T-0886) — panel 의 window 선택이 selectedDays 를 컨테이너 상태로 올린다
  // (controlled lift-up). handleCronChange 동형. panel 은 이 값의 저장처를 모른다(Decision 1).
  const handleReevalSelect = useCallback((days: number) => {
    setSelectedDays(days);
  }, []);

  // person 선택 변경 — person <select> 가 선택 person id 를 컨테이너 상태로 올린다(빈 값 = 미선택
  // 으로 되돌림). 그룹 선택 handleSelectChange 동형. panel 은 person 선택을 모른다(Decision 1).
  const handlePersonChange = (event: { target: { value: string } }) => {
    setSelectedPersonId(event.target.value);
  };
  // === /재평가 트리거 패널 배선(T-0886) ================================================

  // 반환 표면 — JSX 소비처 두 덩어리(SchedulePanel props · 재평가 인원 <select> + 재평가 패널
  // props)가 실제로 소비하는 15 심볼만 공개한다. 내부 전용(조회 원본 3 종 · mutation 문구 상태 ·
  // 나머지 setter)은 의도적으로 빼 축 밖에서 이 축의 내부 상태를 건드릴 경로를 만들지 않는다.
  return {
    cronExpression,
    scheduleBusy,
    schedulePanelMessage,
    schedulePanelError,
    handleCronChange,
    handleApply,
    handleManualTrigger,
    selectedPersonId,
    selectedDays,
    reevalSubmitting,
    reevalError,
    personOptions,
    handleReevalTrigger,
    handleReevalSelect,
    handlePersonChange,
  };
}
