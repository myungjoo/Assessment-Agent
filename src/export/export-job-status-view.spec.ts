// export-job-status-view.spec — describeExportJobStatus 의 R-112(happy / error / branch / negative
// 충분 cover) 단위 test (T-0468). 신규 파일 100% line·function·branch coverage 목표.
import { ExportJobStatus } from "./export-job-plan";
import { describeExportJobStatus } from "./export-job-status-view";

describe("describeExportJobStatus", () => {
  describe("happy-path — 4 상태별 전체 필드 매핑", () => {
    it("queued → 1/3 단계(stepIndex=0) · next=running · non-terminal · 다운로드 불가", () => {
      const view = describeExportJobStatus("queued");
      expect(view).toEqual({
        status: "queued",
        phaseLabel: "대기 중",
        stepIndex: 0,
        totalSteps: 3,
        nextStatus: "running",
        terminal: false,
        downloadable: false,
        message:
          "Export job 이 대기 중입니다 (1/3 단계). 곧 처리가 시작되며 상태를 계속 polling 합니다.",
      });
    });

    it("running → 2/3 단계(stepIndex=1) · next=ready · non-terminal · 다운로드 불가", () => {
      const view = describeExportJobStatus("running");
      expect(view).toEqual({
        status: "running",
        phaseLabel: "처리 중",
        stepIndex: 1,
        totalSteps: 3,
        nextStatus: "ready",
        terminal: false,
        downloadable: false,
        message:
          "Export job 을 처리 중입니다 (2/3 단계). 준비가 끝나면 다운로드할 수 있습니다.",
      });
    });

    it("ready → 3/3 단계(stepIndex=2) · next=null · terminal · 다운로드 가능", () => {
      const view = describeExportJobStatus("ready");
      expect(view).toEqual({
        status: "ready",
        phaseLabel: "다운로드 가능",
        stepIndex: 2,
        totalSteps: 3,
        nextStatus: null,
        terminal: true,
        downloadable: true,
        message:
          "Export job 이 완료되어 다운로드할 수 있습니다 (3/3 단계). 지금 dump 를 내려받으세요.",
      });
    });

    it("failed → 정상 흐름 밖(stepIndex=-1) · next=null · terminal · 다운로드 불가", () => {
      const view = describeExportJobStatus("failed");
      expect(view).toEqual({
        status: "failed",
        phaseLabel: "실패",
        stepIndex: -1,
        totalSteps: 3,
        nextStatus: null,
        terminal: true,
        downloadable: false,
        message:
          "Export job 이 실패했습니다. 정상 진행 흐름을 벗어난 종단 상태이며 job 을 다시 생성해야 합니다.",
      });
    });
  });

  describe("error path — 부적합 입력 종류별 throw", () => {
    it("미정의 status 문자열('cancelled') → RangeError(받은 값 박제)", () => {
      expect(() =>
        describeExportJobStatus("cancelled" as unknown as ExportJobStatus),
      ).toThrow(RangeError);
      expect(() =>
        describeExportJobStatus("cancelled" as unknown as ExportJobStatus),
      ).toThrow(/cancelled/);
    });

    it("빈 문자열 → RangeError(허용 4 종 밖)", () => {
      expect(() =>
        describeExportJobStatus("" as unknown as ExportJobStatus),
      ).toThrow(RangeError);
    });

    it("대문자 'READY' → RangeError(대소문자 mismatch)", () => {
      expect(() =>
        describeExportJobStatus("READY" as unknown as ExportJobStatus),
      ).toThrow(RangeError);
      expect(() =>
        describeExportJobStatus("READY" as unknown as ExportJobStatus),
      ).toThrow(/READY/);
    });

    it("null → TypeError(비-string)", () => {
      expect(() =>
        describeExportJobStatus(null as unknown as ExportJobStatus),
      ).toThrow(TypeError);
      expect(() =>
        describeExportJobStatus(null as unknown as ExportJobStatus),
      ).toThrow(/null/);
    });

    it("undefined → TypeError(비-string)", () => {
      expect(() =>
        describeExportJobStatus(undefined as unknown as ExportJobStatus),
      ).toThrow(TypeError);
      expect(() =>
        describeExportJobStatus(undefined as unknown as ExportJobStatus),
      ).toThrow(/undefined/);
    });

    it("숫자(2) → TypeError(비-string, 받은 값 박제)", () => {
      expect(() =>
        describeExportJobStatus(2 as unknown as ExportJobStatus),
      ).toThrow(TypeError);
      expect(() =>
        describeExportJobStatus(2 as unknown as ExportJobStatus),
      ).toThrow(/2/);
    });

    it("객체({}) → TypeError(비-string)", () => {
      expect(() =>
        describeExportJobStatus({} as unknown as ExportJobStatus),
      ).toThrow(TypeError);
      expect(() =>
        describeExportJobStatus({} as unknown as ExportJobStatus),
      ).toThrow(/object/);
    });

    it("배열([]) → TypeError(비-string)", () => {
      expect(() =>
        describeExportJobStatus([] as unknown as ExportJobStatus),
      ).toThrow(TypeError);
      expect(() =>
        describeExportJobStatus([] as unknown as ExportJobStatus),
      ).toThrow(/array/);
    });
  });

  describe("flow / branch 분리", () => {
    it("terminal 분기: ready·failed 는 terminal=true, queued·running 은 false", () => {
      expect(describeExportJobStatus("ready").terminal).toBe(true);
      expect(describeExportJobStatus("failed").terminal).toBe(true);
      expect(describeExportJobStatus("queued").terminal).toBe(false);
      expect(describeExportJobStatus("running").terminal).toBe(false);
    });

    it("downloadable 분기: ready 만 true, 나머지 3 상태는 false", () => {
      expect(describeExportJobStatus("ready").downloadable).toBe(true);
      expect(describeExportJobStatus("queued").downloadable).toBe(false);
      expect(describeExportJobStatus("running").downloadable).toBe(false);
      expect(describeExportJobStatus("failed").downloadable).toBe(false);
    });

    it("nextStatus null/non-null 분기: queued·running 은 non-null, ready·failed 는 null", () => {
      expect(describeExportJobStatus("queued").nextStatus).toBe("running");
      expect(describeExportJobStatus("running").nextStatus).toBe("ready");
      expect(describeExportJobStatus("ready").nextStatus).toBeNull();
      expect(describeExportJobStatus("failed").nextStatus).toBeNull();
    });
  });

  describe("negative cases — 불변·순수성·종단 명시", () => {
    const ALL_STATUSES: ExportJobStatus[] = [
      "queued",
      "running",
      "ready",
      "failed",
    ];

    it("불변: downloadable === true ⟹ status === 'ready' (4 상태 전수)", () => {
      for (const status of ALL_STATUSES) {
        const view = describeExportJobStatus(status);
        if (view.downloadable) {
          expect(view.status).toBe("ready");
        }
      }
    });

    it("불변: terminal === (status === 'ready' || status === 'failed') (4 상태 전수)", () => {
      for (const status of ALL_STATUSES) {
        const view = describeExportJobStatus(status);
        expect(view.terminal).toBe(status === "ready" || status === "failed");
      }
    });

    it("불변: nextStatus === null ⟺ terminal === true (4 상태 전수)", () => {
      for (const status of ALL_STATUSES) {
        const view = describeExportJobStatus(status);
        expect(view.nextStatus === null).toBe(view.terminal);
      }
    });

    it("non-mutating: 동일 입력 두 호출은 새 인스턴스(!==)이면서 deep-equal", () => {
      const a = describeExportJobStatus("running");
      const b = describeExportJobStatus("running");
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });

    it("non-mutating: 반환 객체 변형이 다음 호출 결과에 영향 없음", () => {
      const first = describeExportJobStatus("queued");
      first.stepIndex = 999;
      first.message = "변조됨";
      const second = describeExportJobStatus("queued");
      expect(second.stepIndex).toBe(0);
      expect(second.message).not.toBe("변조됨");
    });

    it("failed 는 stepIndex=-1 로 정상 흐름(0..2) 밖임을 명시", () => {
      const view = describeExportJobStatus("failed");
      expect(view.stepIndex).toBe(-1);
      expect(view.stepIndex).toBeLessThan(0);
      expect(view.totalSteps).toBe(3);
    });

    it("totalSteps 는 4 상태 모두 3 으로 고정", () => {
      for (const status of ALL_STATUSES) {
        expect(describeExportJobStatus(status).totalSteps).toBe(3);
      }
    });
  });
});
