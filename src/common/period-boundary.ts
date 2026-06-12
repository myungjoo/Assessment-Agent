// ADR-0039 KST boundary helper — boundary 계산 timezone = Asia/Seoul 1 점 집중 (§Decision5).
// 입출력 Date 는 전부 UTC instant (ADR-0012 §1 저장 UTC 보존) — KST 는 계산 내부에만 존재.
// 새 dependency 0: Node 내장 Intl.DateTimeFormat 만 사용. hardcoded +09:00 산술 금지 (§Decision1).

// IANA tz database 표준 식별자 (§Decision1 — 단순 "KST" string 박제 금지).
export const KST_TIMEZONE = "Asia/Seoul";

// 지원 granularity 3 종 (ADR-0035 §Decision3 / ADR-0039 §Decision3).
export const PERIOD_GRANULARITIES = ["daily", "weekly", "monthly"] as const;
export type PeriodGranularity = (typeof PERIOD_GRANULARITIES)[number];

// 반열림 구간 [start, end) — start 포함, end 배타 (§Decision3 부수).
export interface PeriodRange {
  start: Date;
  end: Date;
}

// KST wall-clock 달력 구성요소 (month 는 1~12).
type WallClock = Record<
  "year" | "month" | "day" | "hour" | "minute" | "second",
  number
>;

// Intl formatter 는 생성 비용이 커 module-level 캐시. h23 = 자정을 "24" 아닌 "0" 으로.
const kstFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: KST_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

// Invalid Date / 비-Date 입력은 명시적 error (R-112 negative 분기).
function assertValidDate(value: Date, fnName: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`${fnName}: 유효한 Date instance 가 필요합니다`);
  }
}

// UTC instant → Asia/Seoul wall-clock (Intl 경유 — offset 산술 0).
function toKstWallClock(instant: Date): WallClock {
  const acc: Partial<Record<string, number>> = {};
  for (const { type, value } of kstFormatter.formatToParts(instant)) {
    if (type !== "literal") acc[type] = Number(value);
  }
  return acc as unknown as WallClock;
}

// instant 시점의 Asia/Seoul UTC offset(ms) — IANA rule 변경에 자동 대응하는 산출식.
function kstOffsetMs(instant: Date): number {
  const w = toKstWallClock(instant);
  return (
    Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) -
    Math.floor(instant.getTime() / 1000) * 1000
  );
}

// Asia/Seoul wall-clock → UTC instant (t = [hour, minute, second, ms] 선택).
// guess-and-correct 2 회 수렴 — DST 류 rule 변경 경계까지 일반 대응 (표준 기법).
// Date.UTC 의 0~99년 → 1900+y 매핑은 미방어 — parse 경로는 round-trip 이 거부하고, Intl 산출
// wall-clock 은 도메인(현대 연도)상 0~99 도달 불가 (본 파일 모든 Date.UTC 달력 산술 공통).
function kstToUtc(y: number, mo: number, d: number, t: number[] = []): Date {
  const [h = 0, mi = 0, s = 0, ms = 0] = t;
  const candidate = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const firstPass = candidate - kstOffsetMs(new Date(candidate));
  return new Date(candidate - kstOffsetMs(new Date(firstPass)));
}

// instant 가 속한 KST 달력일의 자정 (R-61 "자정" = KST 자정, §Decision3 (a)).
export function startOfKstDay(instant: Date): Date {
  assertValidDate(instant, "startOfKstDay");
  const w = toKstWallClock(instant);
  return kstToUtc(w.year, w.month, w.day);
}

// instant 가 속한 KST 주의 시작 = KST 월요일 00:00 (§Decision3 (b) — 일요일 시작 금지).
export function startOfKstWeek(instant: Date): Date {
  assertValidDate(instant, "startOfKstWeek");
  const w = toKstWallClock(instant);
  // 달력일 요일 도출 — 달력 산술이므로 Date.UTC 사용은 offset 산술이 아님. 월=0 … 일=6.
  const day = new Date(Date.UTC(w.year, w.month - 1, w.day));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return kstToUtc(
    day.getUTCFullYear(),
    day.getUTCMonth() + 1,
    day.getUTCDate(),
  );
}

// instant 가 속한 KST 월의 시작 = KST 매월 1일 00:00 (§Decision3 (c)).
export function startOfKstMonth(instant: Date): Date {
  assertValidDate(instant, "startOfKstMonth");
  const w = toKstWallClock(instant);
  return kstToUtc(w.year, w.month, 1);
}

const PERIOD_STARTS: Record<PeriodGranularity, (instant: Date) => Date> = {
  daily: startOfKstDay,
  weekly: startOfKstWeek,
  monthly: startOfKstMonth,
};

// granularity + 임의 instant → 반열림 { start, end }. end = start + 1 granularity
// (ADR-0035 §Decision3 정합). 월 28~31 일 가변 길이는 Date.UTC 달력 overflow 로 도출.
export function getKstPeriodRange(
  g: PeriodGranularity,
  instant: Date,
): PeriodRange {
  // Object.hasOwn — prototype 상속 키 ("constructor" 등) 의 우회 진입 차단.
  if (!Object.hasOwn(PERIOD_STARTS, g)) {
    throw new RangeError(`getKstPeriodRange: 미지원 granularity "${g}"`);
  }
  assertValidDate(instant, "getKstPeriodRange");
  const start = PERIOD_STARTS[g](instant);
  const w = toKstWallClock(start);
  const end =
    g === "monthly"
      ? kstToUtc(w.year, w.month + 1, 1)
      : kstToUtc(w.year, w.month, w.day + (g === "daily" ? 1 : 7));
  return { start, end };
}

// R-9 입력 ISO-8601 extended 패턴 — 날짜 필수 + 시각 선택 + offset(Z / ±hh:mm) 선택.
// offset 은 범위까지 강제 (시 00~23 / 분 00~59) — "+09:60" 류가 Date 에 닿기 전에 거부.
const ISO_INPUT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/;

// R-9 사용자 지정 기간 입력 해석 (§Decision3 (d)). offset 명시 (Z / +09:00) → 그대로.
// 미명시 → Asia/Seoul 해석 (예: "2026-06-10T15:00" → 2026-06-10T06:00:00Z). 날짜만 → KST 자정.
// malformed (비문자열 / 빈 문자열 / 형식 위반 / 달력상 불가능 값) → 명시적 error.
export function parseKstPeriodInput(input: string): Date {
  if (typeof input !== "string" || input.trim() === "") {
    throw new TypeError("parseKstPeriodInput: 문자열 입력이 필요합니다");
  }
  const match = ISO_INPUT_PATTERN.exec(input.trim());
  if (!match) {
    throw new RangeError(`parseKstPeriodInput: 형식 위반 입력 "${input}"`);
  }
  const [, y, mo, d, h, mi, s, ms, offset] = match;
  const n = (v?: string) => Number(v ?? 0);
  const [year, month, day] = [n(y), n(mo), n(d)];
  const [hour, minute, second] = [n(h), n(mi), n(s)];
  const milli = n(ms?.padEnd(3, "0")); // ISO 소수초 → ms 보간 (".5" = 500ms)

  // 달력상 불가능한 값 (2/30, 25시 등) 은 round-trip 으로 명시 거부 —
  // Date.UTC 의 silent overflow (2/30 → 3/2) 를 허용하지 않는다.
  const p2 = (v: number) => String(v).padStart(2, "0");
  const rt = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const wall = `${y}-${mo}-${d}T${p2(hour)}:${p2(minute)}:${p2(second)}`;
  if (!rt.toISOString().startsWith(wall)) {
    throw new RangeError(`parseKstPeriodInput: 불가능한 시각 "${input}"`);
  }
  // offset 명시 → JS 표준 ISO parser 위임. 달력 값은 round-trip, offset 범위는 regex 가
  // 검증. 아래 guard 는 방어 깊이 — engine 별 거부 입력의 Invalid Date silent 반환 차단.
  if (offset !== undefined) {
    const result = new Date(input.trim().replace(" ", "T"));
    if (Number.isNaN(result.getTime())) {
      throw new RangeError(`parseKstPeriodInput: 불가능한 offset "${input}"`);
    }
    return result;
  }
  return kstToUtc(year, month, day, [hour, minute, second, milli]);
}
