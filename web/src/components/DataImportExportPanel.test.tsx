import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DataImportExportPanel from './DataImportExportPanel';

// R-112 — REQ-046/REQ-047 데이터 import/export 패널(ADR-0040 §1) 검증.
// GroupMemberList.test.tsx / ReEvaluationTriggerPanel.test.tsx 와 동일 패턴: jsdom·
// @testing-library 없이 react-dom/server 의 renderToStaticMarkup 으로 정적 렌더 문자열만
// 검증해 dep 표면을 최소화한다 (ADR-0040 §5 게이트). renderToStaticMarkup 은 이벤트를
// 발화하지 않으므로 onExport/onImportFile 콜백 자체는 검증 대상이 아니다 — 분기별 markup
// (role="status"/"alert", <button>/<input type="file">, 라벨 텍스트, disabled 속성 유무)
// 만 assert 한다. 파일명은 .test.tsx 고정 — root jest 의 testRegex(.*\.spec\.ts$)
// pickup 충돌 회피.

// 진행 문구 식별 토큰 (구현의 BUSY_TEXT 와 정합 — 말줄임표는 U+2026 …).
const BUSY_TOKEN = '처리 중';
// export 기본 라벨 (구현의 DEFAULT_EXPORT_LABEL 과 정합).
const DEFAULT_EXPORT = '내보내기';
// import 기본 라벨 (구현의 DEFAULT_IMPORT_LABEL 과 정합).
const DEFAULT_IMPORT = '가져오기';

const noop = () => undefined;
// onImportFile 시그니처용 noop (File 인자 — 정적 렌더라 실제 호출되진 않는다).
const noopFile = (_file: File) => undefined;

describe('DataImportExportPanel', () => {
  // happy-path — 정상 상태(busy/error 없음 + 콜백 둘 다 전달) → export 버튼·파일 입력이
  // 활성(disabled 없음) 상태로 렌더되고 기본 라벨이 표시된다.
  it('정상 상태 + onExport/onImportFile 전달 시 export 버튼·파일 입력을 활성 렌더한다 (happy-path)', () => {
    const html = renderToStaticMarkup(
      <DataImportExportPanel onExport={noop} onImportFile={noopFile} />,
    );
    expect(html).toContain('<button');
    expect(html).toContain(DEFAULT_EXPORT);
    expect(html).toContain('type="file"');
    expect(html).toContain(DEFAULT_IMPORT);
    // 콜백이 모두 전달됐으므로 어떤 disabled 속성도 렌더되지 않는다(활성).
    expect(html).not.toContain('disabled');
  });

  // error path — error truthy → role="alert" 영역에 문구 렌더, 트리거(<button>/<input>) 미렌더.
  it('error truthy 전달 시 role="alert" 영역에 문구 렌더, 트리거 미렌더 (error path)', () => {
    const html = renderToStaticMarkup(
      <DataImportExportPanel error="가져오기에 실패했습니다" onExport={noop} onImportFile={noopFile} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('가져오기에 실패했습니다');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('type="file"');
  });

  // flow/branch — busy=true → role="status" + 진행 문구, 트리거 전부 미렌더.
  it('busy=true 면 role="status" + "처리 중…" 렌더, 트리거 미렌더 (branch — busy)', () => {
    const html = renderToStaticMarkup(
      <DataImportExportPanel busy={true} onExport={noop} onImportFile={noopFile} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(BUSY_TOKEN);
    // 말줄임표는 U+2026(…) 단일 문자여야 한다 — "..." 3 점이 아니다.
    expect(html).toContain('처리 중…');
    expect(html).not.toContain('처리 중...');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('type="file"');
  });

  // flow/branch — 정상 상태에서 export 버튼 렌더 분기 (onExport 전달 → 활성 버튼).
  it('정상 상태 + onExport 전달 → export 버튼을 활성으로 렌더한다 (branch — export 버튼)', () => {
    const html = renderToStaticMarkup(<DataImportExportPanel onExport={noop} onImportFile={noopFile} />);
    expect(html).toContain('<button');
    expect(html).toContain(DEFAULT_EXPORT);
    expect(html).not.toContain('disabled');
  });

  // flow/branch — 정상 상태에서 import 파일 입력 렌더 분기 (onImportFile 전달 → 활성 input).
  it('정상 상태 + onImportFile 전달 → 파일 입력을 활성으로 렌더한다 (branch — import 입력)', () => {
    const html = renderToStaticMarkup(<DataImportExportPanel onExport={noop} onImportFile={noopFile} />);
    expect(html).toContain('type="file"');
    expect(html).not.toContain('disabled');
  });

  // flow/branch — message 전달 → 안내 문구를 별도 role="status" 영역에 렌더한다.
  it('정상 상태 + message 전달 → 안내 문구를 렌더한다 (branch — message 전달)', () => {
    const html = renderToStaticMarkup(
      <DataImportExportPanel onExport={noop} onImportFile={noopFile} message="3건을 내보냈습니다" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('3건을 내보냈습니다');
    // 트리거는 정상 상태라 함께 렌더된다.
    expect(html).toContain('<button');
  });

  // flow/branch — message 미전달 → 안내 문구 영역(role="status") 미렌더(트리거만).
  it('정상 상태 + message 미전달 → 안내 문구 영역을 렌더하지 않는다 (branch — message 미전달)', () => {
    const html = renderToStaticMarkup(<DataImportExportPanel onExport={noop} onImportFile={noopFile} />);
    expect(html).toContain('<button');
    // 정상 상태에선 진행/안내 status 영역이 없다.
    expect(html).not.toContain('role="status"');
  });

  // negative — busy=true 가 error 보다 우선(busy 우선 정책 — error 동시 전달도 진행 표시만).
  it('error 전달 + busy=true → alert 대신 진행 표시 우선 (negative — busy 가 error 보다 우선)', () => {
    const html = renderToStaticMarkup(
      <DataImportExportPanel busy={true} error="에러 문구" onExport={noop} onImportFile={noopFile} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain(BUSY_TOKEN);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('에러 문구');
  });

  // negative — busy=true 가 콜백보다 우선(busy 우선 정책 — 트리거 미렌더로 중복 트리거 차단).
  it('onExport/onImportFile 전달 + busy=true → 트리거 미렌더·진행 표시 우선 (negative — busy 우선·중복 차단)', () => {
    const html = renderToStaticMarkup(
      <DataImportExportPanel busy={true} onExport={noop} onImportFile={noopFile} />,
    );
    expect(html).toContain(BUSY_TOKEN);
    expect(html).not.toContain('<button');
    expect(html).not.toContain('type="file"');
  });

  // negative — error 와 정상 콜백 동시 전달 시 error 우선, 트리거 영역 미렌더.
  it('error 와 정상 콜백 동시 전달 → error 우선·트리거 미렌더 (negative — error 우선)', () => {
    const html = renderToStaticMarkup(
      <DataImportExportPanel error="내보내기 실패" onExport={noop} onImportFile={noopFile} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain('내보내기 실패');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('type="file"');
  });

  // negative — onExport 미전달 → export 버튼이 비활성(disabled)으로 렌더된다.
  it('onExport 미전달 → export 버튼을 비활성(disabled)으로 렌더한다 (negative — export 콜백 미전달)', () => {
    const html = renderToStaticMarkup(<DataImportExportPanel onImportFile={noopFile} />);
    expect(html).toContain('<button');
    expect(html).toContain(DEFAULT_EXPORT);
    // 버튼은 비활성화돼야 한다(파일 입력은 onImportFile 전달이라 활성).
    expect(html).toContain('disabled');
  });

  // negative — onImportFile 미전달 → 파일 입력이 비활성(disabled)으로 렌더된다.
  it('onImportFile 미전달 → 파일 입력을 비활성(disabled)으로 렌더한다 (negative — import 콜백 미전달)', () => {
    const html = renderToStaticMarkup(<DataImportExportPanel onExport={noop} />);
    expect(html).toContain('type="file"');
    expect(html).toContain('disabled');
  });

  // negative — 콜백 둘 다 미전달 → 버튼·파일 입력 모두 비활성(disabled 2회).
  it('콜백 둘 다 미전달 → export 버튼·파일 입력 모두 비활성 (negative — 콜백 전부 미전달)', () => {
    const html = renderToStaticMarkup(<DataImportExportPanel />);
    const disabledCount = (html.match(/disabled/g) ?? []).length;
    expect(disabledCount).toBe(2);
  });

  // negative — exportLabel/importLabel 미전달 → 기본 한국어 라벨로 fallback.
  it('exportLabel/importLabel 미전달 → 기본 라벨로 fallback (negative — 기본 라벨 fallback)', () => {
    const html = renderToStaticMarkup(<DataImportExportPanel onExport={noop} onImportFile={noopFile} />);
    expect(html).toContain(DEFAULT_EXPORT);
    expect(html).toContain(DEFAULT_IMPORT);
  });

  // negative/edge — 빈 문자열 라벨 → 기본 라벨로 fallback(의미 없는 빈 라벨 방지).
  it('exportLabel=""/importLabel="" → 기본 라벨로 fallback (negative — 빈 문자열 라벨 경계값)', () => {
    const html = renderToStaticMarkup(
      <DataImportExportPanel onExport={noop} onImportFile={noopFile} exportLabel="" importLabel="" />,
    );
    expect(html).toContain(DEFAULT_EXPORT);
    expect(html).toContain(DEFAULT_IMPORT);
  });

  // happy/override — custom 라벨 전달 시 기본 라벨 대신 custom 라벨 렌더.
  it('custom exportLabel/importLabel 전달 → 기본 라벨 대신 custom 라벨 렌더 (override)', () => {
    const html = renderToStaticMarkup(
      <DataImportExportPanel
        onExport={noop}
        onImportFile={noopFile}
        exportLabel="CSV 내려받기"
        importLabel="CSV 올리기"
      />,
    );
    expect(html).toContain('CSV 내려받기');
    expect(html).toContain('CSV 올리기');
    expect(html).not.toContain(DEFAULT_EXPORT);
    expect(html).not.toContain(DEFAULT_IMPORT);
  });

  // negative/edge — 빈 문자열 error(falsy) → alert 미렌더·정상 패널 렌더.
  it('error="" (falsy) → alert 미렌더·정상 패널 렌더 (negative — 빈 문자열 error 경계값)', () => {
    const html = renderToStaticMarkup(
      <DataImportExportPanel error="" onExport={noop} onImportFile={noopFile} />,
    );
    expect(html).not.toContain('role="alert"');
    expect(html).toContain('<button');
    expect(html).toContain('type="file"');
  });

  // negative/edge — 빈 문자열 message(falsy) → 안내 문구 영역 미렌더(정상 패널만).
  it('message="" (falsy) → 안내 문구 영역 미렌더 (negative — 빈 문자열 message 경계값)', () => {
    const html = renderToStaticMarkup(
      <DataImportExportPanel message="" onExport={noop} onImportFile={noopFile} />,
    );
    expect(html).toContain('<button');
    expect(html).not.toContain('role="status"');
  });
});
