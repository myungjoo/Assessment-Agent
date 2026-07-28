// import-restore-error — UC-07 Import 복원 실패의 Prisma error → HTTP exception 매핑 순수 helper
// (T-1277, REQ-030 / REQ-032). ADR-0055 §Follow-up (b) 복원 엔진 chain 의 실행 조각 **3b-2c-1** —
// "어떤 Prisma code 를 어떤 HTTP exception 으로 볼 것인가" 라는 **판정 한 겹만** 담는다.
// 하지 않는 것: service 배선 0 (`ImportRestoreTransactionService.restore()` 의 try/catch 는
// 3b-2c-2 몫) · throw 0 (던질지 말지는 호출측 결정) · 로깅 0 · 관측 metric 0 · 재시도 0 ·
// T-1276 e2e 의 "감싸지 않음" pin 단언 갱신 0 · Prisma / DB / NestJS DI 의존 0.
// REQ-032 (raw 미노출): 반환 exception 의 메시지는 본 helper 가 조립한 한국어 문구뿐이다 —
// 원본 `error.message` · `meta.cause` · stack · record `fields` 값 · plan payload 를 싣지 않고,
// 원본 error 를 `cause` 로도 붙이지 않는다 (직렬화 경로로 Prisma 문구가 새는 것 차단).
// 유일한 예외가 `meta.target` 이 `string[]` 인 경우의 **컬럼명** 인데, 이는 위반한 값이 아니라
// 스키마 이름이라 노출해도 안전하며 사용자가 dump 를 고치는 데 필요한 최소 단서다.
// 순수성 계약: 입력 비변형 · 부수효과 0 · 매 호출 새 exception 인스턴스 (공유 싱글턴 0) ·
// Prisma known error 형태의 입력에는 throw 0 (접근자가 throw 하는 입력은 계약 밖 — 아래 참조).
import {
  BadRequestException,
  ConflictException,
  type HttpException,
} from "@nestjs/common";

// 매핑 표 — 복원 경로에서 실제로 관측되는 3 종만 닫는다. 무차별 흡수 금지가 본 표의 핵심이라
// 표에 없는 code (`P2028` transaction timeout · `P1001` 연결 실패 등) · code 없는 error ·
// non-object · null / undefined 는 전부 `undefined` 로 떨어뜨려 호출측이 원본을 그대로
// 전파(→ 500)하게 둔다. 확장은 별도 slice.
//   P2002 unique 위반  (dump 가 이미 있는 행을 다시 넣음)      → ConflictException   409
//   P2003 FK 위반      (참조 대상 부재)                        → BadRequestException 400
//   P2025 대상 row 부재 (복원 도중 경합)                        → ConflictException   409

// Prisma known error 의 `code` 만 duck typing 으로 추출한다 (`PrismaClientKnownRequestError`
// 인스턴스 생성 cost 0 — import-job.service 등 기존 service 의 동일 패턴 mirror).
// `typeof === "string"` 을 엄격히 요구하므로 `{ code: 42 }` · `{ code: { toString: () => "P2002" } }`
// 처럼 문자열로 위장한 입력은 매핑을 우회하지 못한다.
function getPrismaErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

// `meta.target` 이 컬럼명 배열일 때만 그 목록을 돌려준다. 원소가 하나라도 문자열이 아니거나
// 배열이 아니거나 비어 있으면 무시한다 — 그 외 형태의 `meta` (문자열 target · cause · fields)
// 는 값이 실릴 수 있어 REQ-032 상 절대 읽지 않는다.
function readTargetColumns(error: unknown): string[] | undefined {
  if (typeof error !== "object" || error === null || !("meta" in error)) {
    return undefined;
  }
  const meta = (error as { meta: unknown }).meta;
  if (typeof meta !== "object" || meta === null || !("target" in meta)) {
    return undefined;
  }
  const target = (meta as { target: unknown }).target;
  if (
    !Array.isArray(target) ||
    target.length === 0 ||
    !target.every((column): column is string => typeof column === "string")
  ) {
    return undefined;
  }
  return [...target];
}

// 컬럼명 단서 접미사 — 없으면 빈 문자열이라 문구가 자연스럽게 닫힌다.
// 안전 가정: target 원소를 길이 제한 · 정제 없이 그대로 싣는 것은 **호출처가 실제 Prisma error 만
// 넘긴다** 는 전제 위에 있다 (Prisma 는 여기에 스키마 컬럼명만 채운다). 임의 사용자 입력이 이
// 자리에 흘러드는 호출처가 생기면 그 전제가 깨지므로 정제 계층을 그때 추가한다.
function columnHint(error: unknown): string {
  const columns = readTargetColumns(error);
  return columns === undefined ? "" : ` (관련 컬럼: ${columns.join(", ")})`;
}

// toImportRestoreHttpException — 매핑 대상이면 **새** HTTP exception 인스턴스를, 아니면
// `undefined` 를 돌려준다. Prisma known error 형태의 입력 (plain data property) 에는 throw 0 —
// `code` / `meta` / `meta.target` 접근자 자체가 throw 하는 입력은 **계약 밖** 이라 그 throw 가
// 그대로 전파된다 (방어적으로 삼키지 않는다 — 삼키면 진짜 결함이 undefined 로 위장된다).
export function toImportRestoreHttpException(
  error: unknown,
): HttpException | undefined {
  switch (getPrismaErrorCode(error)) {
    case "P2002":
      return new ConflictException(
        `복원 dump 에 이미 존재하는 값이 있어 고유 제약을 위반했습니다${columnHint(error)}. 중복 항목을 정리한 뒤 다시 시도하세요.`,
      );
    case "P2003":
      return new BadRequestException(
        `복원 dump 가 참조하는 대상이 존재하지 않아 관계 제약을 위반했습니다${columnHint(error)}. dump 의 참조 무결성을 확인하세요.`,
      );
    case "P2025":
      return new ConflictException(
        `복원 대상 데이터가 처리 도중 변경되어 복원을 완료하지 못했습니다${columnHint(error)}. 다른 작업이 끝난 뒤 다시 시도하세요.`,
      );
    default:
      return undefined;
  }
}
