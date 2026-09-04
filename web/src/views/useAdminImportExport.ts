// AdminView import/export 축 hook(T-1884) — AdminView 본문 `1479 행` ~ `1649 행` 의 import/export
// 축 prelude(export 상태 4 + import 상태 5 + 핸들러 5 + 패널 props 파생 1 = 15 선언)를 선행 주석까지
// 본문 무변경으로 옮긴 순수 추출 모듈이다. 동작 변경 0 — 옮긴 선언의 본문 · `useCallback` deps 배열 ·
// 러너 주입 키가 이동 전과 한 글자도 다르지 않고, 새로 쓴 것은 함수 시그니처와 반환 literal 뿐이다.
//
// 반환 3 심볼(`selectedScope` · `handleScopeChange` · `importExportPanelProps`)만 공개하고 내부 setter 는
// 노출하지 않는다(캡슐화 — 축 밖에서 이 축의 state 를 직접 갱신할 경로를 만들지 않는다). 외부 의존
// (러너 · job client · 문구 helper · 패널 props 타입)은 전부 모듈 최상위 import 로 해결하므로 hook 은
// 주입 파라미터를 받지 않는다 — 단 하나의 예외가 `initialImportConfirmText` 로, 이동 대상 안의
// `useState` 초기값이 AdminView props 에서 오던 test affordance(T-1309)라 그 계약을 보존하려고
// optional 파라미터로 승계했다(전달하지 않으면 이동 전과 같은 `undefined` 초기값).
//
// 본 모듈은 AdminView 배럴에 추가하지 않는다 — 기존 공개 표면 무변경이 순수 추출의 전제다.
import { useCallback, useState } from 'react';
import { toErrorMessage } from '../api/useApiResource';
import { request } from '../api/apiClient';
import {
  createExportJob,
  getExportJob,
  downloadExportJob,
} from '../api/exportJob';
import {
  browserDownloadDeps,
  clearImportConfirm,
  runAdminExportJob,
  runConfirmedImport,
  runImportPreview,
} from './adminImportExportRunners';
import type { DataImportExportPanelProps } from '../components/DataImportExportPanel';

export function useAdminImportExport(initialImportConfirmText?: string) {
  // export in-flight 플래그(④d) — export GET 진행 중 true. 진행 표시(busy)와 동시 재호출 가드
  // (이전 export 미완 중 재호출 차단)에 함께 쓴다(④c assigning 동형).
  const [exporting, setExporting] = useState<boolean>(false);

  // export 완료 안내 문구(④d) — export 성공 시 사람-친화 완료 안내를 보관해 message props 로
  // 표시한다. 재발화 시작·실패 시 비운다.
  const [exportMessage, setExportMessage] = useState<string | undefined>(
    undefined,
  );

  // export 실패 문구(④d) — export 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error
  // props 로 안전 표시한다(throw 없음). 재발화 시작 시 비운다.
  const [exportError, setExportError] = useState<string | undefined>(undefined);

  // export scope 선택 상태(④g) — controlled lift-up(컨테이너 소유). 컨테이너가 직접 렌더하는
  // scope <select> 가 이 값을 갱신하고, handleExport 가 runAdminExportJob 으로 넘겨 job-flow
  // 입력(CreateExportInput)에 반영한다. 빈 문자열(전체) 이 초기값 = scope 미부착 POST body {}
  // (④f 동작 유지). DataImportExportPanel 은 scope
  // 를 모른다(ADR-0041 Decision 1 — scope 선택은 컨테이너 책임, 패널 props 계약 불변).
  const [selectedScope, setSelectedScope] = useState<string>('');

  // onExport 실 핸들러(④d, ④g 확장) — export job-flow 를 컨테이너 내부 async 로 발사한다
  // (신규 fetch hook 미작성 — ④c runAssign 정합, useApiResource 는 read-on-mount 라 클릭 발화에
  // 부적합). 동작(runAdminExportJob 위임):
  //  1) 이전 export 미완(exporting) 중 재호출이면 미발사(이중 호출·state 깨짐 차단).
  //  2) 진행 표시 on + 직전 error·message 비움(실패 후 재시도 시 직전 error 정리).
  //  3) POST create → status poll → download 성공 → response.blob() → Content-Disposition filename
  //     (없으면 기본명) → 가상 <a download> 클릭으로 실제 파일 저장(createObjectURL/revokeObjectURL/anchor
  //     부수효과 deps 주입) → 완료 message.
  //  4) job-flow 실패 → toErrorMessage 문구를 error props 로 안전 표시(403/404/비-2xx/네트워크 0 모두, throw 없음).
  //  5) 마지막에 진행 표시 off(성공·실패 공통).
  // ④g: buildExportInput(selectedScope) 로 현재 scope 선택값을 POST body 에 반영해 주입한다(scope
  // 미선택 시 빈 body {} = backend 기본 scope 위임 = ④f 동작). selectedScope 를 deps 의존성에 포함해
  // 변경된 scope 가 stale 없이 반영되도록 한다(이전 선택값 캡처 방지).
  const handleExport = useCallback(
    () =>
      runAdminExportJob(selectedScope, {
        // job 계약 client 3-primitive(POST create → poll status → download) 주입.
        createExportJob,
        getExportJob,
        downloadExportJob,
        // 브라우저 표준 URL/DOM 부수효과 — 런타임 기본 구현 주입(테스트는 mock 주입).
        ...browserDownloadDeps,
        describeError: toErrorMessage,
        exporting,
        setExporting,
        setExportError,
        setExportMessage,
      }),
    [exporting, selectedScope],
  );

  // scope 선택 변경(④g) — scope <select> 가 선택값을 컨테이너 상태로 올린다(빈 값 = 전체 =
  // query 미부착). 그룹 선택 handleSelectChange 동형. DataImportExportPanel 은 모른다(Decision 1).
  const handleScopeChange = (event: { target: { value: string } }) => {
    setSelectedScope(event.target.value);
  };

  // import in-flight 플래그(④e) — import POST 진행 중 true. 진행 표시(busy)와 동시 재호출 가드
  // (이전 import 미완 중 재호출 차단)에 함께 쓴다(④d exporting 동형).
  const [importing, setImporting] = useState<boolean>(false);

  // import 완료 안내 문구(④e) — import 성공 시 사람-친화 완료 안내를 보관해 message props 로
  // 표시한다. 재발화 시작·실패 시 비운다(④d exportMessage 동형).
  const [importMessage, setImportMessage] = useState<string | undefined>(
    undefined,
  );

  // import 실패 문구(④e) — import 실패 시 사람-친화 문구(toErrorMessage 파생)를 보관해 error
  // props 로 안전 표시한다(throw 없음). 재발화 시작 시 비운다(④d exportError 동형).
  const [importError, setImportError] = useState<string | undefined>(undefined);

  // import 확인 문구(T-1309) — preview 성공 시 영향 범위 요약 1 줄을 보관해 패널의 확인 단계
  // props 로 내려보낸다. 컨테이너가 소유하는 이유: 확인 단계 진입 여부를 판정하는 유일한 근거이고
  // (truthy → 패널이 alertdialog 분기), preview 러너·확정 러너·취소 helper 세 곳이 함께 쓰는
  // 상태라 패널이 아닌 컨테이너에 있어야 한다(controlled lift-up — 패널은 표시만 한다).
  const [importConfirmText, setImportConfirmText] = useState<string | undefined>(
    initialImportConfirmText,
  );

  // 확인 대기 중인 선택 파일(T-1309) — 확정 시 파일 재선택 없이 그대로 실행 러너에 넘기기 위해
  // 컨테이너가 보관한다. File 객체는 렌더에 쓰이지 않고 확정 시점의 실행 인자로만 소비된다.
  const [pendingImportFile, setPendingImportFile] = useState<File | undefined>(
    undefined,
  );

  // onImportFile 실 핸들러(④e) — import POST(/api/admin/import, multipart) 를 컨테이너 내부
  // async 로 발사한다(신규 fetch hook 미작성 — ④d runExport 정합, useApiResource 는 read-on-mount
  // 라 파일 선택 발화에 부적합). 동작:
  //  1) 빈/falsy file 또는 이전 import 미완(importing) 중 재호출이면 미발사(빈 선택 방어 +
  //     이중 호출·state 깨짐 차단).
  //  2) 진행 표시 on + 직전 error·message 비움(실패 후 재시도 시 직전 error 정리).
  //  3) FormData 에 file append → POST 성공 → 완료 안내(message) 표면화.
  //  4) POST 실패 → toErrorMessage 문구를 error props 로 안전 표시(403/400/404/비-2xx/네트워크 0 모두, throw 없음).
  //  5) 마지막에 진행 표시 off(성공·실패 공통).
  // T-1309 부터 파일 선택은 실행이 아니라 preview 를 먼저 발사한다(UC-07 §5 64 — 파괴적 복원은
  // 영향 범위 표시 + 명시 확인 후에만 실행). 선택 파일은 확정 시 재선택 없이 넘기려고 보관하고,
  // 실제 POST /api/admin/import 는 확인 단계의 실행 버튼(handleConfirmImport)에서만 나간다.
  const handleImport = useCallback(
    (file: File) => {
      // 선택 파일 보관 — 확인 단계 진입 여부는 오직 importConfirmText 가 결정하므로, preview 가
      // 실패하거나 가드로 no-op 이면 보관 파일은 도달 불가한 채로 남고(확정 버튼 자체가 렌더되지
      // 않는다 — 무해) 다음 파일 선택 시 덮어써진다.
      setPendingImportFile(file);
      return runImportPreview(file, {
        post: request,
        describeError: toErrorMessage,
        importing,
        setImporting,
        setImportError,
        setImportMessage,
        setImportConfirmText,
      });
    },
    [importing],
  );

  // 확인 단계 실행(확정) 핸들러(T-1309) — 보관 파일로 실제 import 를 발사한다. 확인 문구·보관
  // 파일을 비운 뒤 기존 runImport 에 위임하므로 실행 경로는 T-1309 이전과 동일하다.
  const handleConfirmImport = useCallback(
    () =>
      runConfirmedImport(pendingImportFile, {
        post: request,
        describeError: toErrorMessage,
        importing,
        setImporting,
        setImportError,
        setImportMessage,
        setImportConfirmText,
        setPendingImportFile,
      }),
    [importing, pendingImportFile],
  );

  // 확인 단계 취소 핸들러(T-1309) — 확인 문구·보관 파일만 비워 기본 패널로 복귀한다(POST 0).
  const handleCancelImport = useCallback(
    () => clearImportConfirm({ setImportConfirmText, setPendingImportFile }),
    [],
  );

  // DataImportExportPanel 의 busy/error/message props — busy 우선 → error → message 순으로
  // 패널이 렌더 분기하므로(컴포넌트 박제), 컨테이너는 export·import 두 작업의 진행/실패/완료
  // 상태를 단일 패널 props 로 합성한다(④e 결정 근거): DataImportExportPanel 이 export·import 를
  // 한 패널로 표현하므로(버튼+파일입력 + 단일 busy/error/message 슬롯), 컨테이너도 작업별 state 를
  // 분리 보유(exporting/importing 등 — 가드·전이는 독립)하되 패널로는 단일 슬롯으로 OR 합성해
  // 내려보낸다. 우선순위는 패널 렌더 분기 정합으로 busy(둘 중 하나라도 진행) → error(export
  // error 우선, 없으면 import error) → message(export message 우선, 없으면 import message). 동시
  // 발화는 각 가드가 차단하므로 한 시점에 한 작업만 진행한다(우선순위 충돌 표면 최소). 타입은 패널
  // props 에서 파생해 시그니처 정합을 강제한다(컴포넌트 props 재정의 금지).
  const importExportPanelProps: Pick<
    DataImportExportPanelProps,
    | 'onExport'
    | 'onImportFile'
    | 'busy'
    | 'error'
    | 'message'
    | 'importConfirmText'
    | 'onConfirmImport'
    | 'onCancelImport'
  > = {
    onExport: handleExport,
    onImportFile: handleImport,
    busy: exporting || importing,
    error: exportError ?? importError,
    message: exportMessage ?? importMessage,
    // 확인 단계 3 props(T-1309) — 문구가 truthy 일 때만 패널이 확인 단계로 분기하고, 콜백 2 개가
    // 전달되므로 실행/취소 버튼이 활성 렌더된다(패널은 콜백 미전달 시 버튼을 비활성화한다).
    importConfirmText,
    onConfirmImport: handleConfirmImport,
    onCancelImport: handleCancelImport,
  };

  return { selectedScope, handleScopeChange, importExportPanelProps };
}
