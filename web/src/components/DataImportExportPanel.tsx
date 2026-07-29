// REQ-046 / REQ-047 Admin 패널 (인원·그룹·재평가·import/export·스케줄) 의 "import/export"
// building block (ADR-0040 §1). backend 의 import/export API 는 후속 배선 대상이라, 본
// 컴포넌트는 그 위에 올라가는 순수 presentational controlled component 다 — 진행 상태·에러·
// 안내 문구·export/import 콜백을 props 로만 받아 렌더하고, export 버튼 클릭·파일 선택 시
// 콜백만 호출한다. 실제 파일 업로드 파싱(CSV/JSON)·export 다운로드 요청(GET /api/.../export)·
// 진행률 polling·전역 상태·라우팅·App.tsx 배선은 후속 container slice 책임 (Out of Scope).
// import 확인 단계는 T-1307 에서 책임이 갈렸다 — 파괴적 경고·영향 범위 요약·실행/취소 버튼의
// "표시" 는 본 컴포넌트 책임이고, preview 호출(POST /api/admin/import/preview)·선택 파일
// 보관·요약 문구 합성·확정 후 실제 import 발사는 여전히 컨테이너 책임이다.
// 직전 7개 P6 컴포넌트 (EvaluationGuardBanner, LoginForm,
// EvaluationResultTable, DifficultyModelSelector, SuperAdminSetupForm, GroupMemberList,
// ReEvaluationTriggerPanel) 와 동일한 props/분기/named·default export convention 을 차용한다.

// busy=true 일 때 노출할 기본 한국어 진행 문구.
const BUSY_TEXT = '처리 중…';
// export 버튼 기본 라벨 (exportLabel 미전달/빈 문자열 시 fallback — 빈 라벨 방지).
const DEFAULT_EXPORT_LABEL = '내보내기';
// import 파일 입력 기본 라벨 (importLabel 미전달/빈 문자열 시 fallback — 빈 라벨 방지).
const DEFAULT_IMPORT_LABEL = '가져오기';
// 파괴적(기존 데이터 삭제 후 대체) import 확인 단계의 기본 한국어 경고 문구.
// ReEvaluationTriggerPanel 의 DEFAULT_CONFIRM_TEXT 어조를 그대로 차용한다.
const DEFAULT_IMPORT_CONFIRM_TEXT =
  '주의: 가져오기를 실행하면 기존 데이터를 삭제하고 파일 내용으로 대체합니다. 되돌릴 수 없습니다.';
// 확인 단계의 실행(확정) 버튼 라벨.
const CONFIRM_LABEL = '실행';
// 확인 단계의 취소 버튼 라벨.
const CANCEL_LABEL = '취소';

interface DataImportExportPanelProps {
  // export(내보내기) 트리거 콜백(선택) — 주어졌을 때만 export 버튼을 활성 렌더하고
  // 클릭 시 호출한다. 미전달이면 버튼을 비활성화한다(의미 없는 트리거 방지).
  onExport?: () => void;
  // import(가져오기) 파일 선택 콜백(선택) — 주어졌을 때만 파일 입력을 활성 렌더하고
  // 파일 선택(change) 시 선택된 첫 File 로 호출한다. 미전달이면 파일 입력을 비활성화한다.
  onImportFile?: (file: File) => void;
  // 진행 중 플래그 — true 면 error·콜백 유무와 무관하게 진행 표시 우선(busy 우선 정책).
  // 트리거(버튼·파일 입력)는 미렌더해 중복 트리거를 막는다.
  busy?: boolean;
  // 에러 문구(선택) — busy 가 아니고 truthy 면 role="alert" 영역에 렌더, 없으면 미렌더.
  error?: string;
  // 안내/성공 문구(선택) — busy/error 가 아닌 정상 상태에서 truthy 면 별도 영역에 렌더.
  message?: string;
  // export 버튼 라벨(선택). 빈 문자열이면 기본 라벨로 fallback(빈 라벨 방지).
  exportLabel?: string;
  // import 파일 입력 라벨(선택). 빈 문자열이면 기본 라벨로 fallback(빈 라벨 방지).
  importLabel?: string;
  // import 실행 전 확인 단계에 표시할 영향 범위 요약 문구(선택). truthy 면 기본 패널 대신
  // 확인 단계를 렌더한다(빈 문자열은 falsy 라 진입하지 않는다 — 경계값).
  // 컨테이너가 preview 응답(RestorePlanSummary + mode)으로 합성해 내려준다.
  importConfirmText?: string;
  // import 실행 확정 콜백(선택) — 확인 단계의 실행 버튼 클릭 시 호출한다.
  // 미전달이면 실행 버튼을 비활성화한다(의미 없는 확정 방지).
  onConfirmImport?: () => void;
  // import 취소 콜백(선택) — 확인 단계의 취소 버튼 클릭 시 호출한다.
  // 미전달이면 취소 버튼을 비활성화한다(의미 없는 취소 방지).
  onCancelImport?: () => void;
}

// 데이터 import/export 패널. 실제 파일 파싱·다운로드 요청은 수행하지 않고 props 의 상태를
// 표시하며 onExport/onImportFile 콜백만 호출하는 presentational 책임만 진다 — 실제 요청·
// 진행률 polling·토스트는 상위 컨테이너가 수행한다.
function DataImportExportPanel({
  onExport,
  onImportFile,
  busy,
  error,
  message,
  exportLabel,
  importLabel,
  importConfirmText,
  onConfirmImport,
  onCancelImport,
}: DataImportExportPanelProps) {
  // busy 우선 정책 — 진행 중이면 error·콜백 유무와 무관하게 진행 표시만 렌더한다.
  // 트리거(버튼·파일 입력)를 아예 렌더하지 않아 중복 트리거를 원천 차단한다.
  if (busy === true) {
    return <div role="status">{BUSY_TEXT}</div>;
  }

  // 에러 분기 — busy 가 아니고 error 가 truthy 면 패널 대신 alert 영역만 렌더한다.
  // (빈 문자열 error 는 falsy 라 본 분기로 진입하지 않는다 — 경계값.)
  if (error) {
    return <div role="alert">{error}</div>;
  }

  // 확인 단계 분기 — busy·error 가 아니고 importConfirmText 가 truthy 면 기본 패널 대신
  // 파괴적 경고 + 영향 범위 요약 + 실행/취소 를 렌더한다. export 버튼·파일 입력·message 는
  // 렌더하지 않는다(busy 정책과 동형 — 확인 대기 중 새 파일 선택·동시 export 트리거 차단,
  // 직전 안내 문구가 파괴적 경고와 섞이는 것도 방지).
  if (importConfirmText) {
    return (
      <div role="alertdialog">
        {/* 파괴적 동작 경고 — 기존 데이터 삭제·복구 불가 사실을 항상 명시한다. */}
        <p>{DEFAULT_IMPORT_CONFIRM_TEXT}</p>

        {/* 영향 범위 요약 — 컨테이너가 preview 응답으로 합성한 문구를 그대로 표시한다.
            React 기본 escape 로 특수문자가 안전하게 렌더된다(raw HTML 주입 없음). */}
        <p>{importConfirmText}</p>

        {/* 실행(확정) 버튼 — onConfirmImport 미전달이면 비활성화. */}
        <button type="button" disabled={!onConfirmImport} onClick={() => onConfirmImport?.()}>
          {CONFIRM_LABEL}
        </button>

        {/* 취소 버튼 — onCancelImport 미전달이면 비활성화. */}
        <button type="button" disabled={!onCancelImport} onClick={() => onCancelImport?.()}>
          {CANCEL_LABEL}
        </button>
      </div>
    );
  }

  // 라벨 fallback — 빈 문자열/미전달이면 기본 한국어 라벨로 대체(의미 없는 빈 라벨 방지).
  const exportText = exportLabel ? exportLabel : DEFAULT_EXPORT_LABEL;
  const importText = importLabel ? importLabel : DEFAULT_IMPORT_LABEL;

  // 파일 입력 change 핸들러 — 선택된 첫 File 이 있고 onImportFile 이 주어졌을 때만 호출.
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onImportFile) {
      onImportFile(file);
    }
  };

  return (
    <div>
      {/* export 버튼 — onExport 미전달이면 비활성화(의미 없는 트리거 방지). */}
      <button type="button" disabled={!onExport} onClick={() => onExport?.()}>
        {exportText}
      </button>

      {/* import 파일 입력 — onImportFile 미전달이면 비활성화(파일 선택 무의미 방지). */}
      <label>
        {importText}
        <input type="file" disabled={!onImportFile} onChange={handleFileChange} />
      </label>

      {/* 안내/성공 문구 — 정상 상태에서 message 가 truthy 일 때만 렌더한다. */}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}

export type { DataImportExportPanelProps };
export default DataImportExportPanel;
