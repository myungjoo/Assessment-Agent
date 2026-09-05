// REQ-080 (PLAN 134 행 ① 뒤 축 — 관리 화면 다수 섹션의 탭/구획 내비게이션) slice 1.
// 오너 지시가 "마크업 anchor(className) 와 그 anchor 를 잡는 전역 CSS 규칙을 한 slice 에 함께" 로
// 못박아, 본 파일의 className 상수 3 종과 web/src/styles/global.css 의 대응 규칙을 같은 PR 에 담는다.
// ADR-0041 Decision 1 경계를 지켜 순수 presentational component 로만 만든다 — 상태는 props 로만 받고
// fetch·apiClient·useApiResource·AdminView import 0, 새 외부 dependency 0. AdminView 마운트(섹션 id
// 부여·활성 상태·nav 배선) 는 후속 slice 의 책임이다. props 계약·순수 함수 분리·named + default
// export 관례는 DashboardPeriodSelector 를 차용한다.

// 마크업 anchor className — global.css 의 selector 와 1:1 로 대응하는 정본이다. 값을 바꾸면
// AdminSectionNav.test.tsx 의 CSS drift guard 가 red 로 잡는다(상수 → CSS 단방향 대조).
const ADMIN_SECTION_NAV_CLASS = 'admin-section-nav';
const ADMIN_SECTION_NAV_ITEM_CLASS = 'admin-section-nav__item';
const ADMIN_SECTION_NAV_ACTIVE_CLASS = 'admin-section-nav__item--active';

// 접근성 라벨 — app-shell 에도 <nav> 가 있어 구분 가능한 이름을 붙인다.
const ADMIN_SECTION_NAV_LABEL = '관리 화면 섹션 내비게이션';

// 내비 항목 1 개의 최소 계약 — id 는 섹션 anchor, label 은 화면 표시 문구.
interface AdminSectionDescriptor {
  id: string;
  label: string;
}

interface AdminSectionNavProps {
  // 표시할 섹션 목록. 빈 배열이면 component 는 null 을 반환한다(빈 껍데기 nav 미렌더).
  sections: AdminSectionDescriptor[];
  // 현재 활성 섹션 id(선택). 미지정이거나 목록에 없으면 활성 표시가 하나도 없다.
  activeId?: string;
  // 선택 콜백(선택). 미전달이어도 클릭이 throw 로 이어지지 않는다.
  onSelect?: (sectionId: string) => void;
}

// 섹션 선택 발사(순수) — 발화 여부를 boolean 으로 돌려줘 정적 렌더 환경에서도 콜백 계약을
// 검증할 수 있게 렌더에서 분리한다(DashboardPeriodSelector 선례). 다음 3 경우는 미발화다:
//   (a) nextId 가 sections 목록에 없음 — 존재하지 않는 섹션으로의 전환 차단,
//   (b) nextId 가 이미 활성 — 같은 값 재통지로 상위 렌더를 흔들지 않는다,
//   (c) onSelect 미전달 — 콜백 없이 쓰는 읽기 전용 배치에서 throw 0.
function selectSection(
  sections: unknown,
  activeId: unknown,
  nextId: unknown,
  onSelect?: (sectionId: string) => void,
): boolean {
  if (typeof nextId !== 'string' || nextId === activeId) {
    return false;
  }
  if (!Array.isArray(sections)) {
    return false;
  }
  const exists = sections.some(
    (item) => item !== null && typeof item === 'object' && (item as AdminSectionDescriptor).id === nextId,
  );
  if (!exists || typeof onSelect !== 'function') {
    return false;
  }
  onSelect(nextId);
  return true;
}

// 항목 className 조립(순수) — 활성일 때만 active anchor 를 덧붙인다.
function sectionItemClassName(active: boolean): string {
  return active
    ? `${ADMIN_SECTION_NAV_ITEM_CLASS} ${ADMIN_SECTION_NAV_ACTIVE_CLASS}`
    : ADMIN_SECTION_NAV_ITEM_CLASS;
}

// 관리 화면 섹션 탭/구획 내비게이션. 목록 표시와 콜백 호출만 하는 presentational 책임만 진다.
function AdminSectionNav({ sections, activeId, onSelect }: AdminSectionNavProps) {
  // 표시할 섹션이 없으면 마크업을 0 으로 둔다 — 빈 nav 는 스크린 리더에 잡음만 된다.
  if (!Array.isArray(sections) || sections.length === 0) {
    return null;
  }

  return (
    <nav aria-label={ADMIN_SECTION_NAV_LABEL} className={ADMIN_SECTION_NAV_CLASS}>
      {sections.map((section) => {
        // activeId 미지정(undefined) 이거나 목록 밖 값이면 어느 항목도 활성이 아니다.
        const active = section.id === activeId;
        return (
          <button
            key={section.id}
            type="button"
            className={sectionItemClassName(active)}
            aria-current={active ? 'true' : undefined}
            onClick={() => selectSection(sections, activeId, section.id, onSelect)}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}

export {
  ADMIN_SECTION_NAV_CLASS,
  ADMIN_SECTION_NAV_ITEM_CLASS,
  ADMIN_SECTION_NAV_ACTIVE_CLASS,
  ADMIN_SECTION_NAV_LABEL,
  AdminSectionNav,
  selectSection,
  sectionItemClassName,
};
export type { AdminSectionDescriptor, AdminSectionNavProps };
export default AdminSectionNav;
