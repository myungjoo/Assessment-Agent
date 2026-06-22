// realdata-e2e-seed-fixture.ts — 실 평가 e2e 시드 픽스처 빌더 (T-0573 박제).
//
// 책임:
//   - github.com 의 두 공개 사용자 `myungjoo` / `leemgs` 를 테스트 Person 으로 seed 하기
//     위한 **순수 함수 픽스처 빌더**. `buildRealDataE2eSeed()` 가 두 Person + 각 1 개
//     ServiceIdentity(github.com) descriptor 배열을 결정론적으로 반환한다.
//   - 실 평가 e2e bullet(PLAN.md 109행)의 step ① (seed 입력 계약) 만 cover. 후속
//     step ②(실 수집)·③(로컬 Ollama 실 LLM 평가)·④(daily-test step_eval)의 입력
//     계약을 미리 고정한다.
//   - prisma `model Person` / `model ServiceIdentity` (schema.prisma) 의 필드 모양과
//     1:1 정합. github.com username = ServiceIdentity.externalId (R-47 primary key
//     역할) — github.com identity 를 isPrimary=true 로 박제.
//
// 🔥 build-time 완결 — dependency-free (cloud cron 자율 실행 가능):
//   - 실 네트워크 호출 0, env 읽기 0, DB 접근 0, live-LLM 0, credential 0.
//   - 결정론적 상수 빌더 — 분기 없음 (입력 인자 없음). 같은 입력(=무인자)에 항상
//     같은 shape 의 새 객체를 반환.
//
// 🔥 raw 활동 데이터 없음 (R-59):
//   - 본 픽스처는 username / Person 메타데이터(fullName/email/active)만 보유한다.
//     commit message 본문 / PR / issue 본문 등 raw 외부 활동 데이터는 **포함하지
//     않는다**. raw 수집은 step ②(LAN/credential gate) 책임이며 본 빌더 scope 외.
//
// Out of Scope (task T-0573):
//   - 실 github.com API 호출 / 수집 (step ②).
//   - 로컬 Ollama 실 LLM 평가 (step ③, ADR-0045).
//   - DB 에 실제 upsert 하는 runner/script (본 빌더는 데이터 descriptor 만 — DB write
//     배선은 후속).
//   - Person/ServiceIdentity service/repository / schema.prisma 변경 0.

// RealDataServiceIdentitySeed — descriptor 내 ServiceIdentity 1 개의 seed shape.
// prisma `model ServiceIdentity` 의 사용자 지정 필드(service/externalId/isPrimary)와
// 1:1. id/personId/createdAt/updatedAt 는 DB write 시점에 생성되므로 본 빌더가
// 다루지 않는다(step ① = 입력 descriptor 만).
export interface RealDataServiceIdentitySeed {
  // service 토큰 — 본 빌더는 github.com 만 산출. ADR-0006 정합("github.com" 표기).
  service: "github.com";
  // externalId — github.com username. R-47 primary key 역할(서비스 측 user 1:1 매핑).
  externalId: string;
  // isPrimary — REQ-024 invariant(1 Person 당 정확히 1 primary)의 표식. github.com
  // identity 가 각 Person 의 유일 primary 이므로 true.
  isPrimary: boolean;
}

// RealDataPersonSeed — descriptor 내 Person 1 개의 seed shape. prisma `model Person`
// 의 사용자 지정 필드(fullName/email/active)와 1:1.
export interface RealDataPersonSeed {
  fullName: string;
  email: string;
  active: boolean;
}

// RealDataSeedDescriptor — 1 Person + 그 Person 의 ServiceIdentity 배열을 묶은 seed
// 단위. DB write 배선(후속)이 이 descriptor 를 받아 prisma.person.create +
// prisma.serviceIdentity.create N 으로 upsert 한다.
export interface RealDataSeedDescriptor {
  person: RealDataPersonSeed;
  serviceIdentities: RealDataServiceIdentitySeed[];
}

// REAL_DATA_GITHUB_USERNAMES — 본 빌더가 seed 하는 두 github.com 공개 사용자.
// PLAN.md 109행 사용자 지정(2026-06-22). 순서/값은 결정론적 상수.
const REAL_DATA_GITHUB_USERNAMES = ["myungjoo", "leemgs"] as const;

// buildRealDataE2eSeed — 두 사용자(myungjoo/leemgs)의 seed descriptor 배열을 반환하는
// 순수 함수. 무인자 결정론적 상수 빌더 — 분기 없음.
//
// 매 호출마다 **새 객체 트리**를 생성한다(공유 mutable 상수 노출 0) — 호출 측이
// 반환값을 mutate 해도 다음 호출 결과에 영향 없음(테스트 격리 안전).
//
// 각 descriptor 불변식:
//   - person.email 은 distinct(`@@unique([email])` 위반 0) + non-empty.
//   - serviceIdentities 는 정확히 github.com 1 개(동일 Person 내 service 중복 0 →
//     `@@unique([personId, service])` 정합) + externalId = username(non-empty) +
//     isPrimary=true.
export function buildRealDataE2eSeed(): RealDataSeedDescriptor[] {
  return REAL_DATA_GITHUB_USERNAMES.map((username) => ({
    person: {
      // fullName — 실명 미보유(공개 username 만). 결정론적 표시명으로 username 사용.
      // R-59 정합 — raw 활동 아님, Person 메타데이터일 뿐.
      fullName: username,
      // email — `@@unique([email])` 충족용 distinct 결정론 값. test 도메인(.test)
      // 으로 실 메일 주소 충돌 회피.
      email: `${username}@e2e.realdata.test`,
      active: true,
    },
    serviceIdentities: [
      {
        service: "github.com",
        externalId: username,
        isPrimary: true,
      },
    ],
  }));
}
