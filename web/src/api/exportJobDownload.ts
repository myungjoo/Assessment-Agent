// export job-flow 다운로드 러너(T-1245) — T-1243 `runExportJob`(create→poll→download)이 내는
// 다운로드 `Response` 를 blob → 파일명 파싱 → 파일 저장 + export state 전이로 합성하는 격리
// deps-주입 순수 async 러너. AdminView.tsx(hub) 무접촉 file-disjoint 로 R-112 완전 cover. 구 GET
// 모델 `runExport`(T-1247 로 AdminView 에서 삭제)를 대체한 job-flow 다운로드 러너 — GET 대신
// job-flow(`runJob` deps 주입, 강결합 금지)로 Response 획득만 다르다. filename helper·기본명·
// 완료문구는 본 파일이 canonical 정의처(구 AdminView 사본은 T-1249 로 삭제 완료 — dedup 종결).

import type { CreateExportInput } from './exportJob';

// export 성공 message·filename 부재 시 기본명(각각 EXPORT_DONE_TEXT/DEFAULT_EXPORT_FILENAME
// 의 canonical 정의처 — 구 AdminView 상수는 T-1247 로 삭제됨).
const EXPORT_DONE_TEXT = '내보내기 완료';
const DEFAULT_EXPORT_FILENAME = 'export.json';

// Content-Disposition 에서 filename 추출(본 파일이 parseFilename 의 canonical 정의처). RFC 6266 두 형태:
// (1) filename*=UTF-8''<percent-encoded> 우선(비-ASCII 안전) (2) 일반 filename="...". 빈/누락/
// null 은 throw 없이 undefined(호출측이 기본명 fallback — 안전 파싱).
function parseFilename(disposition: string | null): string | undefined {
  if (!disposition) {
    return undefined;
  }
  const extMatch = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(disposition);
  if (extMatch && extMatch[1]) {
    const raw = extMatch[1].trim();
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded) {
        return decoded;
      }
    } catch {
      // 잘못된 percent-encoding — 일반 filename 분기로 fallthrough(throw 없이).
    }
  }
  const match = /filename=("?)([^";]+)\1/i.exec(disposition);
  if (match && match[2]) {
    const name = match[2].trim();
    return name || undefined;
  }
  return undefined;
}

// 주입 의존성 — job-flow 실행(runJob: 배선 slice 가 runExportJob bind 주입, 본 러너는 Response
// 만 소비)과 파일 저장 부수효과(createObjectURL/revokeObjectURL/clickAnchor 는 AdminView
// DownloadDeps 동형) + error 문구 파생(describeError) + export state setter.
interface RunExportJobDownloadDeps {
  runJob: (input: CreateExportInput) => Promise<Response>;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  clickAnchor: (url: string, filename: string) => void;
  describeError: (e: unknown) => string;
  exporting: boolean; // 현재 export in-flight — true 면 미발사(동시 재호출 가드).
  setExporting: (next: boolean) => void;
  setExportError: (next: string | undefined) => void;
  setExportMessage: (next: string | undefined) => void;
}

// blob 을 가상 <a download> 클릭으로 저장(본 파일이 triggerDownload 의 canonical 정의처). click 성공·예외
// 무관 finally 로 revokeObjectURL 정리 보장(URL 누수 0).
function triggerDownload(
  blob: Blob,
  filename: string,
  deps: Pick<
    RunExportJobDownloadDeps,
    'createObjectURL' | 'revokeObjectURL' | 'clickAnchor'
  >,
): void {
  const url = deps.createObjectURL(blob);
  try {
    deps.clickAnchor(url, filename);
  } finally {
    deps.revokeObjectURL(url);
  }
}

// export job-flow 다운로드 러너 — 구 GET 모델 runExport 를 대체(GET→job-flow 만 교체): (1) exporting →
// 미발사(이중 job·중복 다운로드 차단) (2) 진행 on + 직전 error·message 비움 (3) runJob→blob→
// filename(없으면 기본명)→파일 저장→완료 message (4) catch: error throw 없이 표면화 (5) finally:
// 진행 off(공통).
async function runExportJobDownload(
  input: CreateExportInput,
  deps: RunExportJobDownloadDeps,
): Promise<void> {
  if (deps.exporting) {
    return;
  }
  deps.setExporting(true);
  // 재발화 시작 시 직전 error·message 정리(새 export 진행 표시만 남도록).
  deps.setExportError(undefined);
  deps.setExportMessage(undefined);
  try {
    const response = await deps.runJob(input);
    const blob = await response.blob(); // 빈/0-byte body 도 빈 Blob 안전 수용.
    const filename =
      parseFilename(response.headers.get('content-disposition')) ??
      DEFAULT_EXPORT_FILENAME;
    triggerDownload(blob, filename, deps);
    deps.setExportMessage(EXPORT_DONE_TEXT);
  } catch (e) {
    // runJob reject(timeout/FAILED/403)·blob() reject·click 예외 모두 error 로 표면화(throw 없이).
    deps.setExportError(deps.describeError(e));
  } finally {
    deps.setExporting(false);
  }
}

export {
  runExportJobDownload,
  parseFilename,
  DEFAULT_EXPORT_FILENAME,
  EXPORT_DONE_TEXT,
};
export type { RunExportJobDownloadDeps };
