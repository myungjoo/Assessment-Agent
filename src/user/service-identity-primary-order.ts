// ServiceIdentity 의 **primary 재승격 대상 선택** 순수 모듈.
//
// 담당 범위는 ADR-0058 §Decision 2 마지막 항의 **정렬 계약 하나** 뿐이다 — "잔여 row 중
// `createdAt` 오름차순(동률이면 `id` 오름차순) 첫 row" 를 고르는 규칙. 실제 삭제 · 승격
// 실행(`repository.setPrimary` 호출) · Person 선검사 404 · 소유 검사 404 · `P2025` 404
// 변환은 전부 **후속 `ServiceIdentityService.delete` slice 의 책임**이며 본 모듈은 그
// 어느 것도 알지 못한다(의존성 0 — `@prisma/client` 의 타입만 `import type` 으로 참조).
//
// **소비처는 현재 0 이다.** 다음 slice 가 `ServiceIdentityService.delete` 안에서 잔여 row
// 목록을 넘겨 호출하도록 배선한다. 규칙을 값 수준 순수 함수로 먼저 고정해 두면 그 slice 는
// 3 단 패턴(선검사 · 소유 검사 · 오류 변환) spec 에만 집중할 수 있다.
import type { ServiceIdentity } from "@prisma/client";

// 두 row 의 우선순위를 비교한다. 음수면 `a` 가 앞선다.
//
// `createdAt` 은 `Date` 인스턴스이므로 참조가 아니라 `getTime()` 의 epoch ms 로 비교한다 —
// 서로 다른 인스턴스라도 같은 시각이면 동률로 취급해야 tie-break 이 발동한다.
// `id` 비교는 `localeCompare` 를 쓰지 않는다 — locale 에 따라 대소문자 · 숫자 정렬 순서가
// 달라지면 같은 데이터에 대해 실행 환경마다 다른 row 가 승격되기 때문이다. cuid 는 ASCII
// 부분집합이라 `<` · `>` 의 코드포인트 순서로 충분하고 결정적이다.
function comparePrimaryOrder(a: ServiceIdentity, b: ServiceIdentity): number {
  const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime();
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }
  if (a.id < b.id) {
    return -1;
  }
  if (a.id > b.id) {
    return 1;
  }
  return 0;
}

/**
 * 잔여 identity row 중 primary 로 승격할 row 를 고른다.
 *
 * 규칙은 ADR-0058 §Decision 2 그대로 — `createdAt` 오름차순, 동률이면 `id` 오름차순의
 * 첫 row. 잔여가 0 이면 `null` 을 돌려주며(승격 없이 `N = 0` 정상 상태로 끝남) 어떤
 * 입력에도 throw 하지 않는다.
 *
 * `isPrimary` 값은 선택에 영향을 주지 않는다. 정상 호출 시점은 primary 를 방금 지운
 * 직후라 primary 가 0 개이고, 잘못 primary 인 row 가 남은 복구 상황에서도 같은 입력이면
 * 같은 row 를 고르는 결정성이 우선이기 때문이다.
 *
 * 입력 배열은 변형하지 않는다 — 원본에 `sort` 를 걸지 않고 단일 순회로 최소값만 고른다.
 * 반환값은 입력 원소와 **동일 참조**다(복사본을 만들지 않으므로 호출부가 그대로 `id` 를
 * 꺼내 쓸 수 있다).
 */
export function selectNextPrimaryIdentity(
  rows: readonly ServiceIdentity[],
): ServiceIdentity | null {
  let selected: ServiceIdentity | null = null;
  for (const row of rows) {
    if (selected === null || comparePrimaryOrder(row, selected) < 0) {
      selected = row;
    }
  }
  return selected;
}
