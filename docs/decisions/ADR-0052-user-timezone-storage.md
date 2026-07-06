---
id: ADR-0052
title: "per-user timezone 저장 = User.timezone 컬럼 (String @default \"Asia/Seoul\", additive migration) — R-9 기간 입력 해석·화면 표시 지배, 요약/평가 기간 경계는 KST 기본 유지 (Person.timezone 미도입)"
status: ACCEPTED
date: 2026-07-06
acceptedAt: 2026-07-06
relatedTask: null
supersedes: null
augments: [ADR-0051, ADR-0039]
relatedReq: [REQ-043, REQ-034, REQ-031]
relatedQuestion: Q-0050
---

# ADR-0052 — per-user timezone 저장 위치 = User.timezone 컬럼 (기본 Asia/Seoul)

> 본 ADR 은 **ACCEPTED** (2026-07-06, repo owner myungjoo 가 aa-local interactive session 에서 직접 결정 — 저장 범위 옵션 (B) User.timezone 채택). [ADR-0051](ADR-0051-user-configurable-timezone.md) 이 확정한 "사용자 설정형 timezone(기본 KST) + Intl 메커니즘" 위에서, **설정값의 저장 위치를 로그인 계정 [User](../architecture/data-model.md) 엔티티의 `timezone` 컬럼**으로 못 박는다. DB schema 변경(User 에 컬럼 1개 additive)은 [CLAUDE.md §5](../../CLAUDE.md) 게이트에 해당하나 **repo owner 가 본 결정으로 명시 승인**했다. 구현(migration·helper 일반화·배선)은 §Follow-ups 의 후속 pr slice.

## Context

### 트리거 — ADR-0051 이 남긴 "저장 위치·범위" 결정

[ADR-0051](ADR-0051-user-configurable-timezone.md) §Out of scope 는 "timezone 설정의 저장 위치·범위(per-user vs global vs env)" 를 후속 결정으로 분리했다. 2026-07-06 repo owner 가 **per-user** 저장을 택했다. 그런데 [data-model.md](../architecture/data-model.md) 에는 "사용자" 성격 엔티티가 둘이다:

- **[Person](../architecture/data-model.md)** (평가 대상자, AssessmentModule) — 요약/평가의 대상. 일/주/월 요약 경계(R-61 자정·주·월)·재수집 window(R-58)가 **Person 활동 기간**을 다룬다.
- **[User](../architecture/data-model.md)** (로그인 계정, AuthModule, [REQ-043]) — 시스템에 로그인하는 계정. R-9 사용자 지정 기간 입력·화면 표시(display)의 **조회 주체**.

owner 가 옵션 (B) **User.timezone** 을 택했다 — 즉 timezone 은 **로그인 계정의 표시·입력 선호**이며, 요약/평가 기간 경계는 본 결정 범위 밖(KST 기본 유지)이다.

### 왜 (B) 인가 — 경계 생성 vs 조회·표시의 분리

기간 경계 helper 호출부(`summary-due-coordinates`·`period-evaluable`·`backfill-plan` 등)는 대부분 **요약 생성 시점**에 "이 Person 의 이 기간이 평가 대상인가" 를 판정하며, 그 경계는 **생성 시점에 확정·저장**된다. 이는 Person 활동 자정 기준이지 조회 User 와 무관하다. owner 는 이 경계를 **KST 기본으로 유지**하고(대상자별 timezone 차등 미도입), timezone 설정은 **조회 주체(User)의 R-9 입력 해석 + 표시** 라는 얇은 관심사에만 적용하기로 결정했다. 이로써 migration·배선 범위가 최소화되고(경계 로직 무변경), 다국가 대상자 지원이 필요해지면 그때 별도 `Person.timezone` ADR 로 확장한다.

### 외력

- **[ADR-0002](ADR-0002-db.md)** — PostgreSQL + Prisma. 저장 위치의 실 form 은 `prisma/schema.prisma` 의 `model User` + additive migration.
- **[ADR-0051](ADR-0051-user-configurable-timezone.md) §Decision (b)** — 변환 메커니즘 = `Intl.DateTimeFormat(timeZone)`. 본 ADR 의 `User.timezone` 값이 그 `timeZone` 인자로 흐른다.
- **[CLAUDE.md §5](../../CLAUDE.md)** — DB schema 변경은 BLOCKED 게이트. 본 결정은 **owner 승인 완료**로 게이트 통과. 컬럼 추가는 **additive**(default 값 보유 → 기존 row 자동 backfill, NOT NULL 안전) 이라 data-loss·downtime risk 최소.

## Decision

### (a) 저장 위치 = `User.timezone` 컬럼, `String @default("Asia/Seoul")`, NOT NULL

**채택: 로그인 계정 엔티티 `User` 에 `timezone String @default("Asia/Seoul")` 컬럼을 추가한다.** IANA tz 식별자 문자열을 저장한다(예: `"Asia/Seoul"`, `"America/New_York"`). default 가 있어 기존 User row 는 migration 시 `"Asia/Seoul"` 로 자동 backfill 되고, 신규 User 도 미지정 시 KST 다. 별도 `UserPreference` 테이블을 신설하지 않고 User 본체 컬럼으로 둔다(단일 스칼라 선호값 — join 불요, [UserInstanceAccess](../architecture/data-model.md) 같은 다중 row 관계가 아님).

### (b) 지배 범위 = R-9 기간 입력 해석 + 화면 표시(display)

**채택: `User.timezone` 은 다음 두 지점에만 적용된다 — (i) R-9 사용자 지정 기간 입력의 해석 timezone, (ii) 조회 응답·Web UI 의 시각 표시(display) timezone.** 두 경우 모두 **요청/조회 주체 User 의 timezone** 을 적용하고, 미설정(이론상 default 로 항상 존재)·비로그인 경로는 KST fallback.

### (c) 요약/평가 기간 경계는 본 결정 밖 — KST 기본 유지

**채택: R-61 일별 자정·주간·월간 요약 경계, R-58 재수집 window 등 Person 활동 기간 경계는 `User.timezone` 의 영향을 받지 않으며 KST(Asia/Seoul) 기본을 유지한다.** 이 경계들은 요약 생성 시점에 Person 단위로 확정되며, 조회 User 와 무관하다. **`Person.timezone` 은 본 ADR 에서 도입하지 않는다** — 대상자별 timezone 차등(다국가 평가 대상)이 필요해지면 별도 ADR(§Follow-ups).

### (d) 메커니즘 = ADR-0051 (b) 계승

**채택: `User.timezone` 값은 [ADR-0051](ADR-0051-user-configurable-timezone.md) §Decision (b) 의 `Intl.DateTimeFormat(timeZone)` 인자로 흐른다.** helper 가 `timeZone` 파라미터(기본값 `"Asia/Seoul"`)를 받도록 일반화되고(§Follow-ups), R-9 해석·display 경로가 요청 User 의 timezone 을 그 인자로 전달한다. 새 dependency 0(`Intl` built-in).

## Consequences

### 긍정

- **R-9 입력·표시가 사용자 선호 반영** — 조회 주체가 자기 timezone 으로 기간을 입력·조회한다. per-user 유연성 달성.
- **additive migration — 무손상·무downtime** — `@default("Asia/Seoul")` 로 기존 User row 자동 backfill, 기존 컬럼·관계 무변경([User](../architecture/data-model.md) 의 instanceAccess/exportJobs/importJobs relation 무접촉).
- **요약 경계 로직 무변경** — 경계가 KST 기본 유지라 기존 summary/평가/backfill 동작이 그대로다. 배선 surface 가 R-9 controller + display mapper 로 국지화.
- **새 dependency 0 / 새 credential 0** — `Intl` built-in + User 컬럼 1개. §5 는 DB schema 축만 발화(owner 승인 완료), dependency·credential 축 미발화.

### 부정 / trade-off

- **대상자별(Person) 요약 경계 timezone 차등 미지원** — 모든 Person 의 요약이 KST 경계로 생성된다. 다국가 평가 대상이 생기면 요약 자정이 그들의 로컬과 어긋난다. mitigation: 필요 시 `Person.timezone` 별도 ADR 로 확장(§Follow-ups) — 본 결정은 경계를 KST 로 고정해 범위를 좁힌 의도적 선택.
- **무효 tz 식별자 입력 방어 필요** — User 가 유효하지 않은 IANA 식별자를 설정하면 `Intl.DateTimeFormat` 이 throw. mitigation: timezone 설정 저장 경로(후속 slice)에서 입력 검증(허용 zone 화이트리스트 또는 try/catch → 명시 error)을 R-112 negative case 로 다룬다.

### NON-goal (명시)

- **Person.timezone 도입 아님** — 요약 경계 KST 고정. 대상자별 timezone 은 별도 ADR.
- **멀티테넌트/locale 확장 아님** — 단일 스칼라 User 선호값만.
- **timezone 설정 변경 API·UI 구현 아님** — 저장 위치만 확정. 설정 mutation 경로·frontend UI 는 후속(§Out of scope).

### Cross-Module Impact

`User` 모델에 **컬럼 1개 additive 추가** — 기존 필드/관계 시그니처 변경 0(default 보유로 기존 caller·row 무손상). 따라서 hard rule 의 "public API / shared symbol contract 파괴적 변경" 에 해당하지 않는다. R-9 controller·display mapper 에 timezone 전달 접점이 생기는 것은 후속 배선 slice 가 각각 impact 를 평가한다(additive 파라미터, 기본값으로 기존 호출부 무변경).

## Alternatives considered

- **(A) Person.timezone** — 요약 경계를 대상자별 자정으로. **미채택**(owner 결정 (B)) — 경계 timezone 차등은 현 단일-KST 운영에 불요하고 migration·경계 로직 배선 범위가 커진다. 다국가 대상 필요 시 재론.
- **(C) User.timezone + Person.timezone 둘 다** — 경계=Person, 표시=User. **미채택** — migration·배선 2배. 현 요구엔 과잉.
- **global config / env 저장** — per-user 아님(owner 가 per-user 명시). env 는 인스턴스 전역 1값이라 사용자별 선호 불가.

## Out of scope

- **helper 일반화 구현** — [src/common/period-boundary.ts](../../src/common/period-boundary.ts) 에 `timeZone` 파라미터(기본 KST) 추가 — pr slice.
- **R-9 / display 배선** — controller·mapper 가 요청 User.timezone 전달 — helper 일반화 이후 slice.
- **timezone 설정 mutation 경로 + 입력 검증** — 저장 위치만 본 ADR. 설정 변경 endpoint·검증은 후속.
- **frontend 설정 UI** — P6 이후.

## Follow-ups (구현 slice — planner 큐잉 순서)

1. **Prisma migration + schema** — `model User` 에 `timezone String @default("Asia/Seoul")` 추가 + `prisma/migrations/<ts>_user_timezone/migration.sql`. pr, DB schema(owner 승인 완료). R-112: migration 적용 후 기존 row backfill 검증 + 신규 User default 검증.
2. **helper 일반화** — `period-boundary.ts` 의 `startOfKstDay`/`startOfKstWeek`/`startOfKstMonth`/`getKstPeriodRange`/formatter 를 `timeZone` 파라미터(기본값 `"Asia/Seoul"`)를 받도록 일반화. 기존 호출부는 기본값으로 무변경 동작. R-112 4종(happy·error·flow·negative: 무효 tz 식별자·DST 있는 zone 경계·기본값 fallback). pr, 새 dependency 0.
3. **R-9 / display 배선** — R-9 사용자 지정 기간 해석부 + 조회 응답/표시 mapper 가 요청 User.timezone 을 helper 에 전달. pr.

## References

- [docs/decisions/ADR-0051-user-configurable-timezone.md](ADR-0051-user-configurable-timezone.md) — 사용자 설정형 timezone + Intl 메커니즘(본 ADR 이 저장 위치를 확정)
- [docs/decisions/ADR-0002-db.md](ADR-0002-db.md) — PostgreSQL + Prisma(저장 form)
- [docs/decisions/ADR-0039-timezone-kst-boundary-policy.md](ADR-0039-timezone-kst-boundary-policy.md) — Intl 메커니즘 구현 [src/common/period-boundary.ts](../../src/common/period-boundary.ts)
- [docs/architecture/data-model.md](../architecture/data-model.md) — User(로그인 계정) / Person(평가 대상자) 엔티티 구분
- [docs/STATE.json](../STATE.json) — Q-0050 decision(본 ADR 이 저장 위치 확정)
- [CLAUDE.md §5](../../CLAUDE.md) — DB schema 게이트(owner 승인 완료)

Refs: ADR-0052, ADR-0051, ADR-0039, ADR-0002, Q-0050, REQ-043
