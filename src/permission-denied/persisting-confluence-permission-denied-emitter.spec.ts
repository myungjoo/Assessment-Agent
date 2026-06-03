// PersistingConfluencePermissionDeniedEmitter spec — T-0212 acceptance (R-112: happy /
// error / branch / negative 4 카테고리 + coverage line/function ≥ 80%). ADR-0022 §6
// emitter 패턴 / §1 정규화 (baseUrl→instanceRef 비대칭) / §6.3 fire-and-forget 흡수
// 위상을 검증한다. T-0211 GitHub 판 spec 을 mirror 하되 Confluence 이벤트 shape
// (baseUrl) + provider:"confluence" + 추가 negative (비-401/403 forward, 동기 throw) 만
// 다르다.
//
// 본 spec 은 PermissionDeniedRecordService 를 Jest mock(`jest.fn()`)으로 대체해
// PostgreSQL container 없이 isolated 하게 실행된다. 검증 포인트:
//   - happy: emit({baseUrl,path,status}) 가 record(...)를 1 회, provider:"confluence" +
//     instanceRef===baseUrl + resourceRef===path + httpStatus===status 로 호출.
//   - error: record reject(DB 장애 모사) 시 emit 이 그 reject 를 흡수하고 throw 하지
//     않음(fire-and-forget + swallow, ADR-0022 §6.3).
//   - negative: token 평문이 record 입력 어디에도 새지 않음(baseUrl/path/status 만 매핑) /
//     비-401/403 status(404/429) 도 받은 값 그대로 정규화 forward(emit 경계는 adapter
//     책임) / record 동기 throw 도 흡수.
import { Logger } from "@nestjs/common";

import type {
  PermissionDeniedEmitter,
  PermissionDeniedEvent,
} from "../confluence/confluence-adapter.service";

import { PersistingConfluencePermissionDeniedEmitter } from "./persisting-confluence-permission-denied-emitter";

// service mock factory — record 메서드만 mock. 각 test 마다 새 instance 로 호출
// 카운터를 격리한다. emitter 는 record 만 호출하므로 list 는 mock 불요.
function buildEmitter(): {
  emitter: PersistingConfluencePermissionDeniedEmitter;
  record: jest.Mock;
} {
  const record = jest.fn();
  const emitter = new PersistingConfluencePermissionDeniedEmitter({
    record,
  } as never);
  return { emitter, record };
}

// 대표 Confluence 권한 거부 이벤트 fixture — baseUrl / path / status 만(token 평문
// 부재). baseUrl 은 풀 REST API base URL(host 단독이 아님 — ADR-0018 §2 비대칭).
function buildEvent(
  overrides: Partial<PermissionDeniedEvent> = {},
): PermissionDeniedEvent {
  return {
    baseUrl: "https://acme.atlassian.net/wiki/rest/api",
    path: "/content",
    status: 403,
    ...overrides,
  };
}

describe("PersistingConfluencePermissionDeniedEmitter", () => {
  // logger.warn 는 reject 흡수 자리에서만 호출 — 매 test console 오염 방지 + 호출
  // 검증을 위해 spy 로 silent 처리한다.
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => {
      // 의도적 no-op — 테스트 중 로그 출력 억제.
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
    jest.clearAllMocks();
  });

  // PermissionDeniedEmitter port 를 implements 하는지 — adapter 가 본 emitter 를
  // port 로 주입받을 수 있음의 타입-수준 보증(컴파일 + 런타임 shape).
  it("PermissionDeniedEmitter port 를 만족한다 (emit 메서드 존재)", () => {
    const { emitter } = buildEmitter();
    // port 타입에 대입 가능해야 한다(컴파일 게이트) + emit 이 함수.
    const asPort: PermissionDeniedEmitter = emitter;
    expect(typeof asPort.emit).toBe("function");
  });

  // ------------------------------------------------------------------
  // Happy path — emit 이 record 를 1 회, confluence 정규화 매핑으로 호출
  // ------------------------------------------------------------------
  it("emit 이 record 를 1 회 provider:'confluence' + instanceRef:baseUrl + resourceRef:path + httpStatus:status 로 호출한다 (happy — baseUrl→instanceRef 정규화)", async () => {
    const { emitter, record } = buildEmitter();
    record.mockResolvedValueOnce({ id: "pdr-c1" });
    const event = buildEvent();

    emitter.emit(event);
    // fire-and-forget — record 호출은 동기적으로 발생하나 Promise 는 microtask 에서
    // settle 한다. 다음 microtask tick 까지 flush 해 .catch 미부착 없음을 보장.
    await Promise.resolve();

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({
      provider: "confluence",
      instanceRef: "https://acme.atlassian.net/wiki/rest/api",
      resourceRef: "/content",
      httpStatus: 403,
    });
  });

  // Branch — 401 도 동일 경로(provider/정규화 동일, status 만 다름)인지 401≠403 별도 확인.
  it("401 이벤트도 동일 정규화로 record 를 호출한다 (branch — 401 status 분기)", async () => {
    const { emitter, record } = buildEmitter();
    record.mockResolvedValueOnce({ id: "pdr-c2" });

    emitter.emit(buildEvent({ status: 401 }));
    await Promise.resolve();

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "confluence", httpStatus: 401 }),
    );
  });

  // emit 이 동기 void 반환(fire-and-forget)임을 명시 검증 — record 가 pending 이어도
  // emit 은 즉시 반환해 adapter 의 emit→throw 흐름을 막지 않는다(ADR-0022 §6.3).
  it("emit 은 record 가 pending 이어도 즉시 동기 반환(void)한다 (branch — fire-and-forget)", () => {
    const { emitter, record } = buildEmitter();
    // 영원히 settle 하지 않는 Promise — await 했다면 emit 이 hang 했을 것.
    record.mockReturnValueOnce(new Promise<never>(() => undefined));

    const result = emitter.emit(buildEvent());

    expect(result).toBeUndefined();
    expect(record).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // Error path — record reject(DB 장애 모사) 흡수, throw 전파 금지
  // ------------------------------------------------------------------
  it("record 가 reject 해도 emit 은 throw 하지 않고 흡수한다 (error — DB-write 실패 swallow, ADR-0022 §6.3)", async () => {
    const { emitter, record } = buildEmitter();
    const dbError = new Error("DB 연결 끊김");
    record.mockRejectedValueOnce(dbError);

    // emit 자체가 throw 하지 않아야 한다(동기 경로).
    expect(() => emitter.emit(buildEvent())).not.toThrow();
    // .catch 가 reject 를 흡수 — unhandled rejection 없이 settle.
    await Promise.resolve();
    await Promise.resolve();

    // 흡수 흔적: logger.warn 1 회 호출(조용한 유실 방지).
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  // record 가 동기적으로 throw(Promise 가 아닌 즉시 throw)하는 비정상 의존성도
  // emit 경계를 깨지 않아야 한다 — 의존성 실패(service 오동작) 경로 방어. GitHub 판은
  // rejected Promise 였으나 본 Confluence 판은 진짜 동기 throw 를 별도 cover(§6.3 방어
  // 강화 — try/catch 동기 경로 분기).
  it("record 가 동기 throw 하는 비정상 의존성에서도 emit 이 흡수한다 (error/negative — 동기 throw 방어)", () => {
    const { emitter, record } = buildEmitter();
    // record 가 Promise 가 아니라 호출 즉시 동기적으로 throw.
    record.mockImplementationOnce(() => {
      throw new Error("service 동기 내부 오류");
    });

    expect(() => emitter.emit(buildEvent())).not.toThrow();
    // 동기 throw 흡수 흔적: logger.warn 1 회.
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  // record 가 rejected Promise 를 반환하는(가장 흔한 async throw 형태) 경로도 흡수.
  it("record 가 rejected Promise 를 반환해도 emit 이 흡수한다 (error — async reject 흡수)", async () => {
    const { emitter, record } = buildEmitter();
    record.mockReturnValueOnce(Promise.reject(new Error("service 내부 오류")));

    expect(() => emitter.emit(buildEvent())).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------
  // Negative cases (각 1+)
  // ------------------------------------------------------------------
  // (token 비노출) 이벤트에 token 평문이 부재하므로 record 입력에도 baseUrl/path/status
  // 만 흐른다 — record 입력 key 가 정확히 4 개(provider/instanceRef/resourceRef/
  // httpStatus)이고 그 어떤 값에도 token 류 secret 이 섞이지 않음(ADR-0022 §1 invariant).
  it("record 입력에 baseUrl/path/status 외 secret/principal/reason 이 섞이지 않는다 (negative — token 비노출 §1 invariant)", async () => {
    const { emitter, record } = buildEmitter();
    record.mockResolvedValueOnce({ id: "pdr-c3" });

    emitter.emit(buildEvent());
    await Promise.resolve();

    const callArg = record.mock.calls[0][0] as Record<string, unknown>;
    // 정확히 4 key 만 — principal / reason 등 추가 필드를 emitter 가 주입하지 않는다
    // (service 가 도출/null). token 류 key 부재.
    expect(Object.keys(callArg).sort()).toEqual([
      "httpStatus",
      "instanceRef",
      "provider",
      "resourceRef",
    ]);
    // 값 어디에도 token-like 문자열 부재(이벤트에 token 자체가 없음).
    expect(JSON.stringify(callArg)).not.toMatch(/token|secret|bearer|basic /i);
  });

  // (비-401/403 status 방어적 forward) emit 경계 판정(어떤 status 를 emit 할지)은
  // adapter 책임이고 emitter 는 받은 값을 그대로 정규화 forward 한다 — 비정상적으로
  // 404/429 가 흘러와도 crash 없이 그 status 그대로 record 호출(reason 도출은 service).
  it("비-401/403 status(404)가 흘러와도 받은 값 그대로 정규화 forward 하고 crash 하지 않는다 (negative — emit 경계는 adapter 책임)", async () => {
    const { emitter, record } = buildEmitter();
    record.mockResolvedValueOnce({ id: "pdr-c4" });

    expect(() => emitter.emit(buildEvent({ status: 404 }))).not.toThrow();
    await Promise.resolve();

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "confluence", httpStatus: 404 }),
    );
  });

  it("비-401/403 status(429)도 동일하게 방어적 forward 한다 (negative — 경계값/추가 status)", async () => {
    const { emitter, record } = buildEmitter();
    record.mockResolvedValueOnce({ id: "pdr-c5" });

    expect(() => emitter.emit(buildEvent({ status: 429 }))).not.toThrow();
    await Promise.resolve();

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ httpStatus: 429 }),
    );
  });

  // (reject 후 후속 emit 정상) 한 번 reject 가 흡수돼도 emitter 인스턴스는 손상되지
  // 않고 다음 emit 이 정상 동작한다(상태 비보존 — 매 emit 독립).
  it("reject 1 회 흡수 후에도 후속 emit 이 정상 record 호출한다 (negative — 흡수 후 인스턴스 무손상)", async () => {
    const { emitter, record } = buildEmitter();
    record.mockRejectedValueOnce(new Error("일시적 DB 장애"));
    record.mockResolvedValueOnce({ id: "pdr-c6" });

    emitter.emit(buildEvent({ status: 401 }));
    emitter.emit(buildEvent({ status: 403 }));
    await Promise.resolve();
    await Promise.resolve();

    expect(record).toHaveBeenCalledTimes(2);
    // 첫 호출 reject 흡수 → warn 1 회, 둘째 호출 정상.
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
