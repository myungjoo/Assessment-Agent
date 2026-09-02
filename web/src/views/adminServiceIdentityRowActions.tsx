// AdminView 의 ServiceIdentity 행별 액션 helper 군(T-1771 ~ T-1776)을 담는 모듈 — T-1824 순수 추출.
// AdminView.tsx 가 6,087 줄 · top-level 선언 149 개까지 자란 god component 부채(PLAN 183 행)를
// 갚는 첫 실분할이며, 본 모듈의 12 심볼은 AdminView 에서 **본문 한 줄도 바꾸지 않고** 옮겨온 것이다
// (동작 · 계약 · spec 무변경). 각 선언 위의 주석 블록은 그 helper 가 막는 결함의 근거 정본이라
// 함께 옮겼다. 배치를 web/src/views/ 아래로 잡은 이유는 이동 블록의 상대 import 경로
// (`../api/...` · `../components/...`)가 그대로 유효해 본문 재작성이 0 이 되기 때문이다.
//
// AdminView 와의 방향: AdminView → 본 모듈(값 의존) 이 정방향이다. 아래 runDeleteServiceIdentity ·
// runSetPrimaryServiceIdentity 두 러너가 만들던 AdminView 로의 역방향 import 는 T-1852 순수 추출로
// **해소**됐다 — 두 러너의 정본이 adminServiceIdentityRunners.ts 로 옮겨져, 본 모듈은 그 러너 모듈만
// 단방향으로 바라본다(ESM 순환 0). InFlightIdGate 는 여전히 AdminView 에 있으나 type-only import 라
// 컴파일 시 지워져 값 의존을 만들지 않는다.

import type { ReactElement } from 'react';
import type { ServiceIdentityRow } from '../api/serviceIdentity';
import ServiceIdentityRowActions from '../components/ServiceIdentityRowActions';
import type { ServiceIdentityRowActionsProps } from '../components/ServiceIdentityRowActions';
import {
  runDeleteServiceIdentity,
  runSetPrimaryServiceIdentity,
} from './adminServiceIdentityRunners';
import type { InFlightIdGate } from './AdminView';

// ServiceIdentityRowActions 행별 플래그 파생 입력(T-1771) — 행 자신의 id 와, 컨테이너가 목록 전체에
// 대해 한 개씩만 들고 있는 "대상 행 id" 3 개(삭제 확인 단계 · 진행 중 · 실패 귀속) + 실패 문구다.
// 미선택은 undefined 뿐 아니라 빈 문자열 · 공백만도 동치로 본다(sentinel '' 이 전 행과 일치하는 사고 차단).
interface ServiceIdentityRowFlagsInput {
  identityId: string;
  confirmingDeleteId?: string;
  busyIdentityId?: string;
  errorIdentityId?: string;
  errorText?: string;
}

// 파생 결과(T-1771) — ServiceIdentityRowActions 의 confirmingDelete · loading · error props 와 1:1 이다
// (그 이상도 이하도 만들지 않는다). 소비처는 후속 RowActions 마운트 slice 이며 본 slice 는 helper 만 둔다.
interface ServiceIdentityRowActionsFlags {
  confirmingDelete: boolean;
  loading: boolean;
  error: string | undefined;
}

// (a) 결함: 이 판정을 마운트 JSX 의 행 map 안 인라인 식으로 두면(`confirmingDeleteId === identity.id` ·
// `busyId === identity.id` · `error` 그대로 전달) 비교 누락·잘못된 변수 참조·미선택 sentinel '' 미처리가
// 어떤 test 도 깨지 않고 지나간다 — 실제 결과는 (1) 한 행의 실패 문구가 모든 행에 복제돼 멀쩡한 행이
// 실패한 것처럼 보이거나, (2) 미선택 sentinel '' 이 id 없는 전 행과 일치해 목록 전체가 동시에 삭제 확인
// 단계로 열리는 창이다(확정 버튼이 전 행에 노출된다).
// (b) 그래서 판정만 인자 → 반환 순수 helper 로 뽑는다 — ADR-0040 §5 로 jsdom/RTL 상태 구동 렌더 test 가
// 불가한 현 harness 에서는 helper 직접 호출만이 진리표 전량을 고정할 수 있다. 비교는 항상 trim() 정규화
// 후 수행하고(양쪽 padding 차이가 같은 행을 다른 행으로 갈라놓지 않도록), 행 id 자체가 비면 세 값 모두
// 즉시 "꺼짐" 으로 단락한다. React import·state·부수효과 0 이라 같은 인자면 항상 같은 결과다
// (인자 객체도 변형하지 않는다).
function deriveServiceIdentityRowActionsFlags(
  input: ServiceIdentityRowFlagsInput,
): ServiceIdentityRowActionsFlags {
  // 비교의 기준이 되는 행 id. 정규화 결과가 비면 어떤 대상 id 와도 일치시키지 않는다.
  const rowId = normalizeRowId(input.identityId);
  if (!rowId) {
    return { confirmingDelete: false, loading: false, error: undefined };
  }
  // 대상 id 가 이 행을 가리키는지 — 미지정(undefined)·빈 값은 항상 false 다.
  const targetsThisRow = (candidate: string | undefined): boolean =>
    normalizeRowId(candidate) === rowId;
  return {
    confirmingDelete: targetsThisRow(input.confirmingDeleteId),
    // 다른 행의 진행은 이 행을 잠그지 않는다(행 단위 in-flight — createInFlightIdGate 가 든 id 를 읽기만 한다).
    loading: targetsThisRow(input.busyIdentityId),
    // 귀속 행이 일치하고 문구가 실제로 있을 때만 노출한다(문구 복제 차단).
    error: targetsThisRow(input.errorIdentityId) && input.errorText ? input.errorText : undefined,
  };
}

// 행 id 비교용 정규화 — undefined·빈 문자열·공백만을 모두 빈 값 하나로 접는다.
function normalizeRowId(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

// ServiceIdentityRowActions 행별 액션 어댑터가 받는 deps(T-1772) — 행 개념이 없는 두 러너의 boolean ·
// 문구 계약을, 컨테이너가 목록 전체에 하나씩만 들고 있는 "행 id 귀속" state 로 옮기는 데 필요한 최소
// 3 개다. gate 는 본 factory 가 만들지 않고 주입만 받아 read / write 한다(소유는 createInFlightIdGate).
interface ServiceIdentityRowActionBridgeDeps {
  // 진행 중인 행 id 의 단일 출처 — read() 는 render 캡처가 아니라 호출 시점 ref 값이다.
  gate: InFlightIdGate;
  // 실패 귀속 행 id + 실패 문구 — 목록 전체에 각각 하나뿐인 slot 이라 항상 짝으로 갱신한다.
  setErrorIdentityId: (next: string | undefined) => void;
  setErrorText: (next: string | undefined) => void;
}

// 어댑터 반환(T-1772) — DeleteServiceIdentityDeps 의 deleting / setDeleting / setDeleteError 와
// SetPrimaryServiceIdentityDeps 의 settingPrimary / setSettingPrimary / setPrimaryError 양쪽에 그대로
// 꽂히는 모양이다(두 deps 는 필드 이름만 다르고 형태가 같아 한 어댑터가 두 축을 모두 채운다).
interface ServiceIdentityRowActionBridge {
  busy: boolean;
  setBusy: (next: boolean) => void;
  setError: (next: string | undefined) => void;
}

// (a) 결함: 이 어댑터를 마운트 JSX 의 행 map 안에 인라인으로 쓰면 세 종류 사고가 어떤 test 도 깨지
// 않은 채 지나간다 — (1) 실패 경로에서 setErrorText 만 부르고 setErrorIdentityId 를 빠뜨리면 문구가
// 어느 행에도 뜨지 않는 무성(無聲) 실패가 되고, (2) setBusy(false) 가 소유 검사 없이 진행 id 를 지우면
// 늦게 끝난 요청이 남의 행 진행 표시를 꺼버리며, (3) 귀속 불가한 빈 · 공백뿐 행 id 가 그대로 state 에
// 박히면 미선택 sentinel '' 이 id 없는 전 행과 일치해 목록 전체가 물든다.
// (b) 그래서 러너의 boolean 계약 ↔ 플래그 helper 의 id-귀속 계약 사이의 변환만 인자 → 반환 순수
// factory 로 절단한다 — ADR-0040 §5 로 jsdom/RTL 상태 구동 렌더 test 가 불가한 현 harness 에서는
// helper 직접 호출만이 이 전이 표를 고정할 수 있다. 행 id 정규화는 deriveServiceIdentityRowActionsFlags
// 가 쓰는 normalizeRowId 를 그대로 재사용한다(같은 규칙을 두 번 구현하면 drift 가 난다).
// busy 는 호출 시점 gate.read() 스냅샷이므로 render 시점이 아니라 핸들러 호출 시점에 build 해야 한다.
// 소비처는 후속 ServiceIdentityRowActions 마운트 slice 이며 본 slice 는 factory 만 둔다.
function buildServiceIdentityRowActionBridge(
  identityId: string,
  deps: ServiceIdentityRowActionBridgeDeps,
): ServiceIdentityRowActionBridge {
  const rowId = normalizeRowId(identityId);
  // (a) 귀속 불가한 행 — busy 는 꺼짐이고 두 setter 는 어떤 주입 setter 도 부르지 않는 no-op 다.
  // 그런 행은 러너 가드(targetIdentityId 미선택)가 이미 no-op 이라 실패 자체가 발생하지 않는다.
  if (!rowId) {
    return { busy: false, setBusy: () => {}, setError: () => {} };
  }
  // gate 가 지금 이 행을 들고 있는지 — 호출 시점 값을 매번 다시 읽는다(양쪽 모두 trim 정규화).
  const ownsGate = (): boolean => normalizeRowId(deps.gate.read()) === rowId;
  return {
    // (b) 다른 행의 진행은 이 행을 잠그지 않는다(T-1771 loading 규칙과 동일한 행 단위 in-flight).
    busy: ownsGate(),
    setBusy: (next: boolean) => {
      if (next) {
        deps.gate.write(rowId);
        return;
      }
      // (c) 끄기는 현재 gate 값이 이 행일 때만 — 늦게 끝난 요청이 남의 진행 표시를 꺼버리는 창 차단.
      if (ownsGate()) {
        deps.gate.write(undefined);
      }
    },
    setError: (next: string | undefined) => {
      // (d) 문구가 실제로 있을 때만 이 행에 귀속시킨다. 빈 · 공백뿐 · undefined 는 모두 "없음" 이다.
      const text = typeof next === 'string' ? next.trim() : '';
      if (!text) {
        // 소유 여부와 무관하게 비운다 — 귀속 slot 이 목록 전체에 하나뿐이라, 지우지 않으면 재시도
        // 성공 후에도 stale 문구가 남는다(러너는 재발화 시작 시 setError(undefined) 를 먼저 부른다).
        deps.setErrorIdentityId(undefined);
        deps.setErrorText(undefined);
        return;
      }
      // 귀속 행과 문구는 항상 짝으로 — 한쪽만 쓰면 무성 실패 또는 문구 복제가 된다.
      deps.setErrorIdentityId(rowId);
      deps.setErrorText(next);
    },
  };
}

// ServiceIdentityRowActions 행별 props 조립에 주입하는 계약(T-1773) — "행 자신이 아닌 것"(대상 인원 ·
// 발사 primitive 2 종 · 문구 파생 · 재조회 · 목록 전체에 하나씩뿐인 slot 4 종)만 모은다. 행 정보는
// factory 첫 인자(identity)로 들어오므로 여기에 중복해 담지 않는다. 어댑터(T-1772)가 요구하는 3 종
// (gate · 실패 귀속 setter 짝)은 재선언 대신 그 계약을 그대로 확장해 받는다(같은 모양 중복 금지).
interface ServiceIdentityRowActionsWiringDeps extends ServiceIdentityRowActionBridgeDeps {
  // 두 러너의 첫 인자 — 미선택(빈 · 공백뿐)이면 러너 가드가 no-op 로 접는다.
  personId: string;
  // 편집 동선 진입 — 어느 행인지 상위가 알아야 하므로 행 객체를 그대로 넘긴다.
  onEdit: (identity: ServiceIdentityRow) => void;
  // 발사 primitive 2 종(아래 (a)(1) 축 교차 사고의 당사자 — spec 의 호출 인자 검증으로만 고정된다).
  remove: (personId: string, identityId: string) => Promise<unknown>;
  setPrimary: (personId: string, identityId: string) => Promise<unknown>;
  describeError: (e: unknown) => string;
  bumpRefresh: () => void;
  confirmingDeleteId?: string;
  setConfirmingDeleteId: (next: string | undefined) => void;
  busyIdentityId?: string;
  errorIdentityId?: string;
  errorText?: string;
}

// (a) 결함: 이 조립을 마운트 JSX 의 행 map 안 인라인으로 두면 세 사고가 어떤 test 도 깨지 않고
// 지나간다 — (1) remove 와 setPrimary 는 시그니처가 같아 서로 바꿔 꽂아도(둘 다 string 인 인자 순서를
// 뒤바꿔도) 컴파일이 통과해 "identity 삭제" 버튼이 primary POST 를 쏘고, (2) 어댑터를 render 시점에
// 한 번만 build 해 콜백이 그 busy 스냅샷을 캡처하면 가드가 늘 직전 render 값을 봐 이중 발사가 새고,
// (3) 삭제 취소가 소유 검사 없이 slot 을 비우면 다른 행이 열어둔 확인 단계까지 닫힌다.
// (b) 그래서 조립만 인자 → 반환 순수 factory 로 절단한다 — ADR-0040 §5 로 RTL 상태 구동 렌더 test 가
// 불가한 현 harness 에서는 factory 직접 호출만이 이 배선 표를 고정할 수 있다. 반환 타입은 컴포넌트가
// export 한 ServiceIdentityRowActionsProps 를 그대로 쓰고(재선언 금지 — drift 차단), 플래그 3 종은
// deriveServiceIdentityRowActionsFlags(T-1771) 결과를 그대로 싣는다(판정 재구현 금지). 호출 자체는
// 부수효과 0 — 반환까지 어떤 setter · 러너 · fetch 도 부르지 않고 인자 객체도 변형하지 않는다.
function buildServiceIdentityRowActionsProps(
  identity: ServiceIdentityRow,
  deps: ServiceIdentityRowActionsWiringDeps,
): ServiceIdentityRowActionsProps {
  // 행 id 정규화는 플래그 helper · 어댑터와 같은 normalizeRowId 하나만 쓴다(규칙 중복 구현 금지).
  const rowId = normalizeRowId(identity.id);
  const flags = deriveServiceIdentityRowActionsFlags({
    identityId: identity.id,
    confirmingDeleteId: deps.confirmingDeleteId,
    busyIdentityId: deps.busyIdentityId,
    errorIdentityId: deps.errorIdentityId,
    errorText: deps.errorText,
  });
  // 귀속 불가한 행 — 다섯 콜백 전원이 어떤 주입 함수도 부르지 않는 no-op 이다(플래그 3 종은 같은
  // 조건에서 derive 가 이미 전부 꺼짐으로 돌려준 값이다).
  if (!rowId) {
    const noop = () => {};
    const off = { onEdit: noop, onDeleteRequest: noop, onDeleteConfirm: noop, onDeleteCancel: noop, onSetPrimary: noop };
    return { identity, ...off, ...flags };
  }
  // 어댑터는 render 시점이 아니라 **콜백 호출 시점** 에 만든다 — busy 가 build 시점 gate.read()
  // 스냅샷이라(T-1772) 한 번 만들어 캡처하면 가드가 직전 render 값에 굳어 이중 발사가 샌다.
  const bridge = (): ServiceIdentityRowActionBridge =>
    buildServiceIdentityRowActionBridge(identity.id, deps);
  // 확인 단계 slot 은 이 행이 대상일 때만 비운다(남의 확인 단계를 닫는 창 차단).
  const clearConfirmIfOwned = () => {
    if (normalizeRowId(deps.confirmingDeleteId) === rowId) {
      deps.setConfirmingDeleteId(undefined);
    }
  };
  return {
    identity,
    onEdit: () => deps.onEdit(identity),
    // 즉시 삭제가 아니라 확인 단계로의 전이만 알린다(정규화된 id 를 박아 sentinel 유입 차단).
    onDeleteRequest: () => deps.setConfirmingDeleteId(rowId),
    onDeleteCancel: clearConfirmIfOwned,
    // 두 러너 인자는 항상 (personId, identity.id) 순서다. 러너가 돌려준 promise 는 그대로 반환한다
    // — props 타입이 void 로 지우지만 spec 이 완료를 기다릴 수 있게 남겨둔다.
    onDeleteConfirm: () => {
      const row = bridge();
      return runDeleteServiceIdentity(deps.personId, identity.id, {
        remove: deps.remove,
        describeError: deps.describeError,
        deleting: row.busy,
        setDeleting: row.setBusy,
        setDeleteError: row.setError,
        bumpRefresh: deps.bumpRefresh,
        endConfirm: clearConfirmIfOwned,
      });
    },
    onSetPrimary: () => {
      const row = bridge();
      return runSetPrimaryServiceIdentity(deps.personId, identity.id, {
        setPrimary: deps.setPrimary,
        describeError: deps.describeError,
        settingPrimary: row.busy,
        setSettingPrimary: row.setBusy,
        setPrimaryError: row.setError,
        bumpRefresh: deps.bumpRefresh,
      });
    },
    ...flags,
  };
}

// (a) 결함: 이 "행 → 액션 노드" 변환을 마운트 JSX 안 인라인 화살표로 두면 세 사고가 어떤 test 도
// 깨지 않고 지나간다 — (1) buildServiceIdentityRowActionsProps(T-1773)를 우회해 props 를 손으로 다시
// 조립하는 drift 가 열려 필드 하나가 빠지거나 다른 값이 실리고, (2) 행마다가 아니라 slot 생성 시점에
// 한 번만 props 를 만들면 한 행의 플래그(진행 중 · 삭제 확인 · 실패 문구)가 모든 행에 복제되며,
// (3) 반환 element 를 캐싱하면 그 사이 바뀐 deps 상태가 화면에 영영 반영되지 않는다.
// (b) 그래서 변환 한 겹만 모듈 레벨 순수 factory 로 절단한다 — ADR-0040 §5 로 RTL 상태 구동 렌더
// test 가 불가한 현 harness 에서는 factory 직접 호출 + 반환 element 검사만이 이 배선을 고정할 수
// 있다. 반환 함수는 호출될 때마다 props 를 새로 조립해(캐싱 0) 그대로 spread 하며, deps 타입은
// T-1773 계약을 재선언 없이 그대로 받는다. 소비처(<ServiceIdentityList renderRowActions={...} />
// 실제 전달)는 다음 slice 책임이라 본 slice 의 소비처는 spec 뿐이다.
function buildServiceIdentityRowActionsSlot(
  deps: ServiceIdentityRowActionsWiringDeps,
): (identity: ServiceIdentityRow) => ReactElement {
  return (identity: ServiceIdentityRow) => (
    // props 를 손으로 고르지 않고 factory 결과를 통째로 spread 한다(필드 추가 · 누락 원천 차단).
    <ServiceIdentityRowActions {...buildServiceIdentityRowActionsProps(identity, deps)} />
  );
}

// 행 편집 진입 helper 가 받는 deps(T-1776) — 진입 한 번이 건드려야 하는 setter 6 개만 받는다. 컨테이너
// state 이름(setIdentityEditExternalIdInput 등)을 그대로 쓰지 않고 짧은 역할 이름으로 받는 이유는, 이
// helper 가 컨테이너 변수에 결합하지 않고 spec 이 mock setter 만으로 전 계약을 고정할 수 있게 하려는
// 것이다. 실패 귀속 slot 2 종(setErrorIdentityId · setErrorText)은 어댑터(T-1772)와 같은 slot 이다.
interface BeginServiceIdentityEditDeps {
  // 편집 대상 id — 목록 find 가 원문 비교라 정규화 값이 아니라 원문이 실린다(아래 (b) 참조).
  setEditingIdentityId: (next: string) => void;
  setEditExternalIdInput: (next: string) => void;
  setUpdateError: (next: string | undefined) => void;
  setConfirmingDeleteId: (next: string | undefined) => void;
  setErrorIdentityId: (next: string | undefined) => void;
  setErrorText: (next: string | undefined) => void;
}

// (a) 결함: 행 액션의 onEdit 을 마운트 JSX 안 인라인 화살표로 두면 세 사고가 어떤 test 도 깨지 않은
// 채 지나간다 — (1) externalId prefill 을 빠뜨리면 편집 폼이 빈 값으로 열려 러너의 "변경 0" 판정이
// 뒤집히고, (2) 진입 시 직전 실패 문구(수정 실패 · 행 액션 실패 귀속/문구)를 비우지 않으면 새 편집
// 화면에 남의 실패 문구가 그대로 남으며, (3) 다른 행이 열어둔 삭제 확인 slot 을 닫지 않으면 편집 폼과
// "정말 삭제" 확인 단계가 동시에 열린 모순 상태가 된다.
// (b) 그래서 진입 한 겹만 모듈 레벨 순수 helper 로 절단한다 — ADR-0040 §5 로 RTL 상태 구동 렌더 test
// 가 불가한 현 harness 에서는 helper 직접 호출 + setter mock 검증만이 이 진입 표를 고정할 수 있다.
// 대상 id 는 **원문 그대로** 싣는다: 컨테이너의 editingIdentity 파생이 `row.id === editingIdentityId`
// 원문 비교라, trim 된 값을 실으면 padding 있는 행을 목록에서 못 찾아 폼이 즉시 접힌다(정규화는 귀속
// 가능 여부 판정에만 쓴다). 호출은 fetch · 러너 · async 를 일절 부르지 않고 인자 객체도 변형하지 않는다.
// 소비처(renderRowActions 마운트의 onEdit)는 다음 slice 책임이라 본 slice 의 소비처는 spec 뿐이다.
function beginServiceIdentityEdit(
  identity: ServiceIdentityRow,
  deps: BeginServiceIdentityEditDeps,
): void {
  // 행 id 정규화는 플래그 helper · 어댑터와 같은 normalizeRowId 하나만 쓴다(규칙 중복 구현 금지).
  // 귀속 불가한 행(빈 · 공백뿐 · 문자열 아님)은 6 setter 중 어느 것도 부르지 않는 전체 no-op 이다
  // — 미선택 sentinel '' 이 대상 id 에 박히면 id 없는 전 행이 편집 대상으로 물들기 때문이다.
  if (!normalizeRowId(identity.id)) {
    return;
  }
  deps.setEditingIdentityId(identity.id);
  // 비정상 payload 방어 — 문자열이 아닌 externalId 는 빈 문자열 prefill 로 접는다(폼 input 은
  // controlled 라 undefined 가 실리면 uncontrolled 로 전환되며 경고 + 값 유실이 난다).
  deps.setEditExternalIdInput(
    typeof identity.externalId === 'string' ? identity.externalId : '',
  );
  // 직전 실패 문구 3 종을 모두 비운다 — 수정 실패 문구 1 개 + 행 액션 실패 귀속/문구 짝 2 개.
  deps.setUpdateError(undefined);
  deps.setErrorIdentityId(undefined);
  deps.setErrorText(undefined);
  // 다른 행이 열어둔 삭제 확인 slot 을 닫는다(편집 폼과 확인 단계 동시 노출 차단).
  deps.setConfirmingDeleteId(undefined);
}

// 12 심볼 공개 — 선언부에 export 를 덧붙이지 않고 목록으로 모은 이유는, 이동한 290 줄이 원본과
// 문자 그대로 1:1 로 대응함을 diff 에서 그대로 확인할 수 있게 하기 위함이다(순수 추출 검증 가능성).
// AdminView 는 이 심볼들을 import 해 기존 export 목록으로 그대로 re-export 하므로 기존 spec 6 개의
// `from './AdminView'` 는 한 줄도 바뀌지 않는다.
export {
  deriveServiceIdentityRowActionsFlags,
  normalizeRowId,
  buildServiceIdentityRowActionBridge,
  buildServiceIdentityRowActionsProps,
  buildServiceIdentityRowActionsSlot,
  beginServiceIdentityEdit,
};
export type {
  ServiceIdentityRowFlagsInput,
  ServiceIdentityRowActionsFlags,
  ServiceIdentityRowActionBridgeDeps,
  ServiceIdentityRowActionBridge,
  ServiceIdentityRowActionsWiringDeps,
  BeginServiceIdentityEditDeps,
};
