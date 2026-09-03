// AdminView 의 import/export 러너 군(④d ~ ④f · T-1132 · T-1246 · T-1308 ~ T-1310)을 담는 모듈 —
// T-1860 순수 추출. AdminView.tsx 가 5,044 줄로 남아있는 god component 부채(PLAN 183 행)를 갚는
// 일곱째 실분할이며, 본 모듈의 심볼은 AdminView 에서 **본문 한 줄도 바꾸지 않고** 옮겨온 것이다
// (동작 · 계약 · spec 무변경 — 선언 앞 export 키워드만 붙였다). 각 선언 위의 주석 블록은 그 러너가
// 막는 결함의 가드 근거 정본이라 함께 옮겼다. 배치를 web/src/views/ 아래로 잡은 이유는 이동 블록이
// 발사 primitive(post / create / get / download)와 DOM/URL 부수효과를 전부 deps 로 주입받아 외부
// 값 import 가 export job-flow 두 모듈로 한정되기 때문이다. JSX 가 없으므로 확장자는 .ts 다.
//
// AdminView 와의 방향: AdminView → 본 모듈(값 의존) 의 **단방향** import 만 만든다. 본 모듈은
// AdminView 를 import 하지 않는다(역방향이 필요해지면 이동 범위를 잘못 잡았다는 신호 — 범위를
// 넓히지 말고 Follow-ups 로 남긴다). AdminView 파일 끝 export 목록은 임포트한 값 9 개
// (buildExportInput · runAdminExportJob · runImport · runImportPreview · runConfirmedImport ·
// clearImportConfirm · formatImportJobDetail · formatRestoreTotalsPhrase · formatRestorePlanConfirmText)
// 를 그대로 re-export 하고, deps 타입 5 개(DownloadDeps · RunAdminExportJobDeps · ImportDeps ·
// ImportPreviewDeps · ConfirmImportDeps)도 이동 전부터 `export type {` 표면이었으므로 그대로
// re-export 한다(공개 표면 무변경). 이동 전 export 가 아니던 browserDownloadDeps 와 경로/문구 상수
// 5 개는 AdminView 에서 새로 export 하지 않는다. 덕분에 기존 spec(AdminView.test.tsx 의 export/
// import 축 describe 군)의 `from './AdminView'` 가 import 경로 수정 없이 그대로 산다.
//
// 이동 범위 보정 — 러너가 직접 참조하는 모듈 상수·helper 도 본문 무변경으로 함께 옮겼다
// (ADMIN_IMPORT_PATH · ADMIN_IMPORT_PREVIEW_PATH · IMPORT_FILE_FIELD · IMPORT_DONE_TEXT ·
// IMPORT_RESULT_SUMMARY_PREFIX · formatRestoreTotalsPhrase · formatImportJobDetail). AdminView 에
// 남겨두면 본 모듈 → AdminView 역방향 import 가 생겨 위 단방향 규약을 깨뜨리기 때문이다
// (GROUPS_PATH 를 옮긴 T-1854 · PERSONS_PATH 를 옮긴 T-1856 · LLM_PROVIDERS_PATH 를 옮긴 T-1857
// 선례 동형). 여기에 더해 formatRestorePlanConfirmText 와 그 fallback 문구 IMPORT_PREVIEW_UNKNOWN_TEXT
// 도 함께 옮겼다 — task 정의서는 이 둘을 "소비처가 컨테이너 렌더 경로" 로 보고 잔류 대상으로 적었으나
// 실측(origin/main cb4aff3f)에서 formatRestorePlanConfirmText 의 유일한 호출자는 함께 이동하는
// runImportPreview 한 곳뿐이었다. 잔류시키면 정확히 그 역방향 import 가 생겨 위 규약이 깨지므로
// 경계를 보정해 함께 옮겼고, 이 보정 사실은 task 파일 Follow-ups 에 박제한다. 컨테이너 렌더 경로가
// 소비하는 것은 함수가 아니라 importConfirmText state 값이라 렌더 배선은 영향받지 않는다.

import type { RequestOptions } from '../api/apiClient';
import { runExportJobDownload } from '../api/exportJobDownload';
import type { RunExportJobDownloadDeps } from '../api/exportJobDownload';
import { runExportJob } from '../api/exportJobFlow';
import type { RunExportJobOptions } from '../api/exportJobFlow';
import type { CreateExportInput, ExportJob } from '../api/exportJob';

// 평가 자료 import path — 고정 endpoint(POST /api/admin/import, api.md 123 Admin+, multipart
// file upload). Admin+ 라 User 등급은 403 — 그 403 은 runImport 의 catch 가 error props 로 안전
// 표시(throw 없음). backup/restore(api.md 124·125) 는 본 slice Out of Scope(import 만).
export const ADMIN_IMPORT_PATH = '/api/admin/import';

// import dry-run(preview) path — 고정 endpoint(POST /api/admin/import/preview, api.md 126
// Admin+). 복원 미실행으로 영향 요약만 산출하며(DB write 0 · ImportJob row 미생성) 요청은 실행
// 경로와 동일한 multipart, 응답 200(T-1332 — dry-run 이라 201 Created 가 아님) key 집합은
// 정확히 deleted/inserted/kept/mode 4 개.
export const ADMIN_IMPORT_PREVIEW_PATH = '/api/admin/import/preview';

// preview 응답이 기대 shape 이 아닐 때(비객체 · 3 그룹 total 이 하나도 number 아님) 쓰는 fallback
// 문구 — 미확인 사실 + 진행 시 대체 경고를 함께 명시해 수치 부재가 "안전"으로 오독되지 않게 한다.
export const IMPORT_PREVIEW_UNKNOWN_TEXT =
  '영향 범위를 확인할 수 없습니다 — 그대로 진행하면 기존 데이터가 파일 내용으로 대체될 수 있습니다.';

// import multipart FormData 의 file field 이름 — api.md 123 이 multipart field 키를 명시하지
// 않으므로 가장 표준적인 'file' 을 쓴다(NestJS FileInterceptor 의 기본 field 명 관례 정합).
// backend import controller 가 다른 키를 요구하면 후속 정정한다(현 src/ 에 미구현 — ④d export
// 와 동일하게 api.md 계약 기준 선배선). 컴포넌트/apiClient 수정 0 — native FormData body.
export const IMPORT_FILE_FIELD = 'file';

// import 성공 시 DataImportExportPanel 의 message props 로 내려보낼 사람-친화 안내.
// POST 응답이 기대 shape(ImportJob) 가 아닐 때의 안전 fallback 문구로도 쓰인다(응답 형태 변화·
// 비정상 응답 방어 — formatImportJobDetail 참조). 상세 소비는 T-1132 에서 도입.
export const IMPORT_DONE_TEXT = '가져오기 완료';

// 실행 응답의 restoreSummary 를 결과 문구 뒤에 덧붙일 때 쓰는 접두 문구(T-1310). 확인 단계의
// preview 문구('가져오기 영향 범위 — ')와 구분되도록 "반영 결과" 로 실행 후 사실임을 명시한다.
// 상수로 박제해 spec 이 같은 문자열을 참조하도록 한다(문구 drift 차단).
export const IMPORT_RESULT_SUMMARY_PREFIX = '반영 결과 — ';

// RestorePlanSummary 3 그룹(deleted / inserted / kept)의 total 을 훑어 `삭제 N 건 / 삽입 N 건 /
// 보존 N 건` 조각을 만드는 공유 순수 helper(T-1310 — T-1308 formatRestorePlanConfirmText 안의
// 스캔 루프를 추출한 것. 확인 단계 preview 와 실행 결과 두 소비자가 같은 스캔을 공유해 복제 0).
// 규약: (a) 비객체 · null · 배열 → undefined(소비 불가), (b) 그룹이 비객체면 그 그룹만 생략,
// (c) total 이 유한 number 일 때만 노출, (d) 어느 그룹도 못 읽으면 undefined, (e) throw 0.
export function formatRestoreTotalsPhrase(value: unknown): string | undefined {
  // (a) 비객체(null · undefined · string · number) 및 배열 → 요약 envelope 아님, 소비 불가.
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  // 3 그룹 key ↔ 한국어 라벨 — api.md 126 의 deleted/inserted/kept 순서 그대로 표기한다.
  for (const [key, label] of [
    ['deleted', '삭제'],
    ['inserted', '삽입'],
    ['kept', '보존'],
  ] as const) {
    // (b) 그룹이 비객체면 그 그룹만 생략(부분 정보라도 안전 표시 — 다른 그룹은 계속 합성).
    const group = record[key] as Record<string, unknown> | null;
    const total = group && typeof group === 'object' ? group.total : undefined;
    // (c) total 이 유한 number 일 때만 노출 — 0 은 유효 수치라 falsy 로 흘리지 않는다(경계값).
    // NaN · Infinity · 문자열 '3' 은 수치로 신뢰할 수 없으므로 그 그룹만 생략한다.
    if (typeof total === 'number' && Number.isFinite(total)) {
      parts.push(`${label} ${total} 건`);
    }
  }
  // (d) 어느 그룹도 수치를 못 읽었으면 수치 없는 조각은 오독 위험 → 호출자에게 부재를 알린다.
  return parts.length === 0 ? undefined : parts.join(' / ');
}

// import 성공 시 POST /api/admin/import 응답(ImportJob) 을 사람-친화 한국어 상세 문구로 합성하는
// 순수 helper(T-1132). backend @Post() 은 생성된 ImportJob(id / status(PENDING) / mode) 을
// 그대로 반환하므로(src/import/import.controller.ts L109~120) 그 job 을 소비해 실제 상태를 표면화한다.
// job 은 즉시 완료가 아니라 PENDING(비동기 큐잉) 이므로 정적 "가져오기 완료" 대신 상태를 명시한다.
// apiClient.request 반환 타입은 unknown 이라 응답 형태가 보장되지 않으므로 방어적 narrowing 필수 —
// 기대 shape(최소 id string) 가 아니면(null · 비객체 · id 부재) 정적 IMPORT_DONE_TEXT 로 안전
// fallback(throw · '[object Object]' 노출 0). status · mode 는 string 일 때만 노출(누락 시 생략).
export function formatImportJobDetail(job: unknown): string {
  // 비객체(null · undefined · string · number 등) → 소비 불가, 완료 문구 fallback.
  if (typeof job !== 'object' || job === null) {
    return IMPORT_DONE_TEXT;
  }
  const record = job as Record<string, unknown>;
  // 최소 식별자 id(비어있지 않은 string) 부재 → 상세 합성 불가, fallback.
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return IMPORT_DONE_TEXT;
  }
  // id 는 필수, status · mode 는 있을 때만 덧붙인다(부분 정보라도 안전 표시 — 누락 필드 생략).
  const parts: string[] = [`job ${record.id}`];
  if (typeof record.status === 'string' && record.status.length > 0) {
    parts.push(`상태 ${record.status}`);
  }
  if (typeof record.mode === 'string' && record.mode.length > 0) {
    parts.push(`모드 ${record.mode}`);
  }
  const detail = `가져오기 요청됨 — ${parts.join(', ')}`;
  // T-1296 이 응답에 additive 로 실은 restoreSummary(3 그룹 수치) 를 실제 반영 결과 한 조각으로
  // 덧붙인다(T-1310) — 사용자가 확인 단계에서 본 preview 수치와 실행 후 실제 수치를 대조할 수 있다.
  const phrase = formatRestoreTotalsPhrase(record.restoreSummary);
  // 요약이 없거나 판독 불가면 아무것도 덧붙이지 않는다 — preview 와 달리 경고 fallback 을 쓰지
  // 않는 이유는, 실행은 이미 발사된 뒤라 수치 부재가 사용자에게 위험 신호가 아니기 때문이다
  // (되돌릴 판단 지점이 아님 — 경고 문구는 오히려 실패로 오독된다).
  if (phrase === undefined) {
    return detail;
  }
  return `${detail} (${IMPORT_RESULT_SUMMARY_PREFIX}${phrase})`;
}

// preview 응답(RestorePlanSummary 3 그룹 + 해석된 mode) 을 사람-친화 한국어 요약 1 줄로 합성하는
// 순수 helper(T-1308). DataImportExportPanel 의 importConfirmText props 로 내려가 확인 단계의
// "영향 범위" 문구가 된다(T-1307 신설분). request 반환 타입이 unknown 이라 응답 형태가 보장되지
// 않으므로 formatImportJobDetail 의 방어적 narrowing 을 따른다 — 비객체·배열이거나 3 그룹 total
// 이 하나도 number 가 아니면 fallback 문구로 안전 회피(throw 0). perEntity 는 미노출.
export function formatRestorePlanConfirmText(preview: unknown): string {
  // 3 그룹 스캔은 공유 helper 에 위임한다(T-1310 추출 — 외부 동작 변경 0). 비객체 · 배열이거나
  // 어느 그룹도 수치를 못 읽으면 undefined 가 돌아오고, 수치 없는 요약은 오독 위험이라 경고
  // fallback 으로 안전 회피한다(추출 전 두 분기가 같은 fallback 을 쓰던 것과 동일 결과).
  const phrase = formatRestoreTotalsPhrase(preview);
  if (phrase === undefined) {
    return IMPORT_PREVIEW_UNKNOWN_TEXT;
  }
  const record = preview as Record<string, unknown>;
  // mode 는 요약 수치가 어느 mode 기준인지를 알려주는 값 — 비어있지 않은 string 일 때만 덧붙인다.
  const mode = record.mode;
  const modeSuffix =
    typeof mode === 'string' && mode.length > 0 ? ` (모드 ${mode})` : '';
  return `가져오기 영향 범위 — ${phrase}${modeSuffix}`;
}

// 가상 <a download> 클릭으로 실제 파일 저장을 수행하는 부수효과 추상화(④f). DOM/URL primitive
// (createObjectURL/revokeObjectURL/anchor 생성·클릭)을 주입 가능한 한 객체로 묶어 jsdom 없이
// 직접 검증한다(④c~④e 의 *Deps 주입 convention 정합 — 테스트는 mock 주입, 런타임은 기본
// 브라우저 구현 주입). blob → objectURL → anchor click → revokeObjectURL 정리까지의 한 단위
// 실행은 이제 web/src/api/exportJobDownload.ts 활성본이 담당하고(click 예외 시에도 finally 로
// object URL 을 회수해 자원 누수를 막는다), AdminView 는 이 DownloadDeps 를 handleExport 에 주입만 한다.
export interface DownloadDeps {
  // Blob → object URL 생성(런타임 기본: URL.createObjectURL). 다운로드 anchor 의 href.
  createObjectURL: (blob: Blob) => string;
  // object URL 해제(런타임 기본: URL.revokeObjectURL). 다운로드 트리거 후 자원 회수.
  revokeObjectURL: (url: string) => void;
  // anchor 생성·download 속성 설정·DOM 부착·click·제거를 수행하는 부수효과(런타임 기본:
  // document.createElement('a') + body append/click/remove). 테스트는 호출만 단언한다.
  clickAnchor: (url: string, filename: string) => void;
}

// 런타임 기본 DownloadDeps — 브라우저 표준 URL/DOM API 로 구현(④f). 컨테이너 handleExport 가
// 주입한다. createObjectURL/revokeObjectURL 는 URL 정적 메서드, clickAnchor 는 document 로
// 가상 <a download> 를 만들어 클릭·정리한다(브라우저 표준 — file-saver 등 새 dependency 0).
export const browserDownloadDeps: DownloadDeps = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  clickAnchor: (url, filename) => {
    // 가상 <a download> 생성 — href 에 object URL, download 속성에 파일명을 실어 클릭하면
    // 브라우저가 파일을 저장한다. 일부 브라우저는 anchor 가 DOM 에 부착돼야 click 이 동작하므로
    // body 에 append 후 click, 즉시 remove 한다(보이지 않게 — 즉시 제거).
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  },
};

// scope 선택값 → export job 생성 입력(CreateExportInput) 매퍼(T-1246, 순수 helper). 구
// buildExportPath 의 job-flow 판 — job 계약은 scope 를 query 대신 POST body(api.md 124
// CreateExportDto)로 싣는다. truthy → { scope }, 빈 문자열(전체 선택) → {}(미부착, backend 기본
// scope 위임 = 구 ④f 동작 유지). CreateExportInput 은 ../api/exportJob 에서 import(재정의 금지).
export function buildExportInput(selectedScope: string): CreateExportInput {
  if (!selectedScope) {
    return {};
  }
  return { scope: selectedScope };
}

// runAdminExportJob 주입 의존성(T-1246) — client 3-primitive(create/get/download)와 파일 저장
// 부수효과(DownloadDeps 동형 createObjectURL/revokeObjectURL/clickAnchor) + error 문구 파생 +
// export state setter 를 받는다. delay/options 는 poll 제어 passthrough(테스트가 실 타이머
// 대기를 회피하도록 주입, 미주입 시 job-flow 기본).
export interface RunAdminExportJobDeps {
  createExportJob: (input: CreateExportInput) => Promise<ExportJob>;
  getExportJob: (id: string) => Promise<ExportJob>;
  downloadExportJob: (id: string) => Promise<Response>;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  clickAnchor: (url: string, filename: string) => void;
  describeError: (e: unknown) => string;
  exporting: boolean;
  setExporting: (next: boolean) => void;
  setExportError: (next: string | undefined) => void;
  setExportMessage: (next: string | undefined) => void;
  // poll 제어 passthrough(테스트는 delay 즉시 resolve 로 실 타이머 미대기). 미주입 시 job-flow 기본.
  delay?: (ms: number) => Promise<void>;
  options?: RunExportJobOptions;
}

// export job-flow 배선 헬퍼(T-1246) — 구 runExport(GET Blob 모델)를 대체하는 실 배선 지점.
// handleExport 는 이 헬퍼를 1회 호출로 축약한다(useCallback 내부 로직을 exported 순수 async 로
// 뽑아 렌더 없이 R-112 full cover). 조립: buildExportInput(selectedScope)를 입력으로, T-1245
// runExportJobDownload 의 runJob dep 에 runExportJob(client 3-primitive 주입)을 bind 한다. 가드·
// 진행 on/off·error·완료 message 전이는 runExportJobDownload 담당(재구현 0). backend GET 부재
// 404 버그를 job 계약(POST create→poll→download)로 해소한다.
export async function runAdminExportJob(
  selectedScope: string,
  deps: RunAdminExportJobDeps,
): Promise<void> {
  const downloadDeps: RunExportJobDownloadDeps = {
    // runExportJob 을 client 3-primitive + poll 제어와 함께 bind — runExportJobDownload 는
    // 이 runJob 이 내는 다운로드 Response 만 소비한다(create/poll 세부는 몰라도 됨 — 관심사 분리).
    runJob: (input) =>
      runExportJob(
        input,
        {
          createExportJob: deps.createExportJob,
          getExportJob: deps.getExportJob,
          downloadExportJob: deps.downloadExportJob,
          delay: deps.delay,
        },
        deps.options,
      ),
    createObjectURL: deps.createObjectURL,
    revokeObjectURL: deps.revokeObjectURL,
    clickAnchor: deps.clickAnchor,
    describeError: deps.describeError,
    exporting: deps.exporting,
    setExporting: deps.setExporting,
    setExportError: deps.setExportError,
    setExportMessage: deps.setExportMessage,
  };
  return runExportJobDownload(buildExportInput(selectedScope), downloadDeps);
}

// onImportFile 의 POST(multipart) + state-전이 로직을 캡슐화한 순수 async 러너(④e — ④d
// runExport 캡슐화 패턴 차용. jsdom/렌더러 없이 import 본체를 직접 검증한다 — ExportDeps 와
// 동형의 ImportDeps 주입). 컨테이너의 handleImport 는 이 러너에 현재 in-flight 여부(importing)와
// 상태 setter 들을 주입해 호출만 한다. 동작:
//  - 빈/falsy file → 미발사(빈 선택 방어 — DataImportExportPanel.handleFileChange 도 falsy file
//    시 미호출이나 러너 자체도 방어해 직접 호출/비정상 입력에 안전).
//  - importing(이전 import 미완) → 미발사(이중 POST·state 경합 차단 — runExport 의 exporting 가드 동형).
//  - 발사 시 진행 on + 이전 error·message 비움 → FormData 에 file append → POST /api/admin/import →
//    성공(완료 message 설정) / 실패(error 문구 표면화 — throw 없이) → 진행 off(공통).
export interface ImportDeps {
  // import POST 발사 primitive — apiClient.request 를 주입한다(테스트는 mock 주입).
  post: (path: string, options: RequestOptions) => Promise<unknown>;
  // ApiError 등 throw 표면 → 사람-친화 문구 파생(toErrorMessage 주입).
  describeError: (e: unknown) => string;
  // 현재 import in-flight 여부 — true 면 미발사(동시 재호출 가드).
  importing: boolean;
  setImporting: (next: boolean) => void;
  setImportError: (next: string | undefined) => void;
  setImportMessage: (next: string | undefined) => void;
}

export async function runImport(file: File, deps: ImportDeps): Promise<void> {
  // 비정상 호출 가드 — 빈/falsy file 은 POST 미발사(빈 선택 방어 — 잘못된 body 회피).
  if (!file) {
    return;
  }
  // 동시 재호출 가드 — 이전 import 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (deps.importing) {
    return;
  }
  deps.setImporting(true);
  // 재발화 시작 시 직전 error·message 를 비운다(실패 후 재시도 시 직전 error 정리 + 직전 완료
  // 안내 정리 — 새 import 의 진행 표시만 남도록, runExport 의 시작 정리 동형).
  deps.setImportError(undefined);
  deps.setImportMessage(undefined);
  try {
    // 선택 File 을 multipart FormData 로 동봉 — body 가 FormData 면 브라우저가 multipart
    // Content-Type boundary 를 자동 설정하므로 수동 헤더 미지정(boundary 누락 방지). apiClient
    // .request 가 RequestInit.body 를 native 수용 → apiClient.ts 수정 0.
    const formData = new FormData();
    formData.append(IMPORT_FILE_FIELD, file);
    // POST /api/admin/import — multipart body. 응답은 생성된 ImportJob(id / status(PENDING) /
    // mode) 이므로(import.controller.ts L109~120) 그 job 을 소비해 상세 문구로 합성한다(T-1132).
    const job = await deps.post(ADMIN_IMPORT_PATH, { method: 'POST', body: formData });
    // 성공 — 응답 ImportJob 을 사람-친화 상세 문구로 합성해 message 로 표면화한다(방어적 narrowing —
    // 기대 shape 아니면 IMPORT_DONE_TEXT 로 안전 fallback). job 은 PENDING 이라 "완료" 대신 상태 명시.
    deps.setImportMessage(formatImportJobDetail(job));
  } catch (e) {
    // 실패 — 사람-친화 문구를 error props 로 안전 표시(throw 없이). 403 Admin+ 미만 / 400 잘못된
    // 파일 / 404 / 비-2xx / 네트워크 0 모두 ApiError.status → toErrorMessage 파생으로 표면화.
    deps.setImportError(deps.describeError(e));
  } finally {
    deps.setImporting(false);
  }
}

// 파일 선택 시 실행 전 dry-run(preview) 을 발사하는 러너의 주입 계약(T-1308 — ImportDeps 동형).
// 실행 러너(runImport)와 같은 in-flight 슬롯(importing)·error·message 를 공유하되 산출한 확인
// 문구를 내려보낼 setImportConfirmText 하나가 더 있다. 컨테이너 배선은 후속 slice 책임.
export interface ImportPreviewDeps {
  // preview POST 발사 primitive — apiClient.request 주입(테스트는 mock). 실패 문구 파생은
  // describeError(toErrorMessage 주입), importing 은 in-flight 여부(true 면 미발사 가드).
  post: (path: string, options: RequestOptions) => Promise<unknown>;
  describeError: (e: unknown) => string;
  importing: boolean;
  setImporting: (next: boolean) => void;
  setImportError: (next: string | undefined) => void;
  setImportMessage: (next: string | undefined) => void;
  setImportConfirmText: (next: string | undefined) => void;
}

// 선택 파일을 실행하지 않고 영향 범위만 조회하는 preview 러너(T-1308 — runImport 골격 차용).
// 가드 2 종(빈 file · in-flight)과 시작 정리·finally 해제는 runImport 와 동형이고 종착만 다르다:
// 성공 시 message 대신 확인 문구를 설정하고, 실패 시 error 표면화와 함께 확인 문구를 비워 확인
// 단계에 진입하지 않는다(throw 0). mode field 미부착 — 미지정 = backend REPLACE 해석(api.md
// 126)이라 실행 경로(runImport 도 mode 미지정)와 같은 기준의 수치가 나온다.
export async function runImportPreview(
  file: File,
  deps: ImportPreviewDeps,
): Promise<void> {
  // 비정상 호출 가드 — 빈/falsy file 은 POST 미발사(빈 선택 방어 — 잘못된 body 회피).
  // 동시 재호출 가드 — 이전 import/preview 미완 중이면 미발사(이중 POST·state 경합 차단).
  if (!file || deps.importing) {
    return;
  }
  deps.setImporting(true);
  // 재발화 시작 시 직전 error·message·확인 문구를 비운다(직전 결과가 새 preview 진행 중 남지
  // 않도록 — runImport 의 시작 정리에 확인 문구 정리를 더한 형태).
  deps.setImportError(undefined);
  deps.setImportMessage(undefined);
  deps.setImportConfirmText(undefined);
  try {
    // 선택 File 을 multipart FormData 로 동봉 — 실행 경로와 동일한 계약(file 필드, 수동 헤더 0).
    const formData = new FormData();
    formData.append(IMPORT_FILE_FIELD, file);
    const preview = await deps.post(ADMIN_IMPORT_PREVIEW_PATH, {
      method: 'POST',
      body: formData,
    });
    // 성공 — 3 그룹 total + mode 를 요약 1 줄로 합성해 확인 단계 문구로 표면화(방어적 narrowing).
    deps.setImportConfirmText(formatRestorePlanConfirmText(preview));
  } catch (e) {
    // 실패 — 문구를 error 로 안전 표시(throw 없이) + 확인 단계 미진입(문구 비움). 400 손상 dump /
    // 401 / 403 비-Admin / 413 크기 초과 / 네트워크 0 모두 같은 경로로 표면화한다.
    deps.setImportError(deps.describeError(e));
    deps.setImportConfirmText(undefined);
  } finally {
    deps.setImporting(false);
  }
}

// 확인 단계에서 "실행" 을 누른 뒤 실제 import 를 발사하는 확정 러너의 주입 계약(T-1309).
// 실행 본체는 기존 runImport 가 그대로 담당하므로 ImportDeps 를 확장(extends)해 재구현을 0 으로
// 두고, 확인 단계를 닫는 데 필요한 setter 2 개만 더한다.
export interface ConfirmImportDeps extends ImportDeps {
  // 확인 문구 slot — 확정 직전 undefined 로 비워 확인 단계를 닫는다(패널은 falsy 면 기본 패널).
  setImportConfirmText: (next: string | undefined) => void;
  // 보관 파일 slot — 확정 직전 undefined 로 비워 같은 파일의 재확정(이중 실행)을 막는다.
  setPendingImportFile: (next: File | undefined) => void;
}

// 확인 단계 확정 러너(T-1309) — 보관 파일로 실제 import 를 발사한다. 동작:
//  - 보관 파일 없음(!file) 또는 in-flight(importing) → 아무 setter 도 호출하지 않고 즉시 return
//    (확인 상태 보존 + 이중 확정 차단 — 여기서 확인 문구를 비우면 사용자가 확인 화면을 잃는다).
//  - 확인 단계 종료 — 확인 문구·보관 파일을 비운다(패널이 기본 패널로 복귀).
//  - 실행은 기존 runImport 에 위임한다 — 진행 표시·완료 문구·에러 표면화·finally 해제 전부
//    기존 러너 책임이라 재구현 0 이고, throw 도 그쪽에서 흡수한다(본 러너도 throw 0).
export async function runConfirmedImport(
  file: File | undefined,
  deps: ConfirmImportDeps,
): Promise<void> {
  if (!file || deps.importing) {
    return;
  }
  deps.setImportConfirmText(undefined);
  deps.setPendingImportFile(undefined);
  return runImport(file, deps);
}

// 확인 단계 취소 helper(T-1309) — 확인 문구·보관 파일만 비운다(POST 0). error·message 는 건드리지
// 않는다(직전 안내를 지울 이유가 없다 — 취소는 아무것도 실행하지 않은 상태로의 복귀일 뿐).
// deps 타입을 두 setter 로 좁혀 실행 관련 필드가 실수로 흘러드는 오용을 막는다.
export function clearImportConfirm(
  deps: Pick<ConfirmImportDeps, 'setImportConfirmText' | 'setPendingImportFile'>,
): void {
  deps.setImportConfirmText(undefined);
  deps.setPendingImportFile(undefined);
}
