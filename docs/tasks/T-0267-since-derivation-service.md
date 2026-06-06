---
id: T-0267
title: ADR-0030 §4 slice vi — 직전 Assessment → since 도출 service 신설
phase: P4
status: DONE
completedAt: 2026-06-06T23:45:00+09:00
prNumber: 229
mergeCommit: 1a5a890
result: "SinceDerivationService.deriveSince(personId) 신설 — 직전 Assessment 최신 periodStart→ISO since, 빈 배열 undefined. PR-229 squash 1a5a890, reviewer 2 round APPROVE(round1 MINOR 미래 timestamp 경계 test nit-closure), CI green, since-derivation.service.ts 100% cov."
commitMode: pr
coversReq: [REQ-031, REQ-005, REQ-006, REQ-007, REQ-008, REQ-015]
estimatedDiff: 135
estimatedFiles: 2
created: 2026-06-06
plannerNote: "P4 ADR-0029 §5/ADR-0030 §4 slice vi — 직전 Assessment.periodStart → ISO since 도출 service(read-only, AssessmentService.findByPerson mock 주입). collectForPerson 의 since 소비처. R-112 backbone ×1.5(read-only, no @unique update)."
---

# T-0267 — ADR-0030 §4 slice vi — 직전 Assessment → since 도출 service 신설

## Why

ADR-0030 §5 collection enumerate 체인의 진입점 `CollectionEntryService.collectForPerson(person, since, assessmentId)` 가 T-0264~T-0266 으로 코드+DI 배선+doc-sync 까지 완성됐다. 그러나 그 `since` 인자는 **도출되지 않고 주입만** 받는 상태다 — ADR-0030 §4 가 "since 도출(직전 Assessment → since)은 enumerate 밖, ADR-0029 §5 의 slice vi 책임" 으로 분리했기 때문이다. main 대조 결과 since 도출 로직은 아직 0(`deriveSince`/`SinceDerivation` grep hit 0, 각 collection service 의 주석/언급만 존재 — issue-still-relevant pre-check 통과).

ADR-0029 §5 의 since 도출 계약: 한 Person 의 **직전 Assessment** 의 `periodStart`(마지막 수집 경계 timestamp)로부터 `since` 를 도출한다. 직전 Assessment 가 없으면(신규 인원) since 미지정(`undefined`) = full collection. 본 task 는 이 도출을 **read-only 순수 derivation service** 로 박제한다 — 기존 `AssessmentService.findByPerson(personId)`(이미 존재, T-0114) 가 Assessment 배열을 반환하므로 그 중 `periodStart` 가 가장 큰 row 의 `periodStart` → ISO-8601 문자열로 변환하면 된다. collectForPerson 의 `since` 인자 소비처(호출처가 이 service 로 since 를 산출해 주입)다.

새 DB schema 0 / 새 dependency 0 / 새 credential 0 (기존 `AssessmentService` read 메서드 재사용, in-process derivation). CLAUDE.md §5 게이트 미발화. README REQ-031(재수집 중복 방지 + incremental)의 application-layer backbone + REQ-005~008/REQ-015(수집 since query)를 cover 한다.

## Required Reading

- `docs/decisions/ADR-0029-assessment-collection-orchestrator.md` — Decision §5(Incremental "since" 전략 — 직전 Assessment 의 `periodStart` 로부터 since 도출, 직전 Assessment 없으면 since 미지정 = full collection, 경계값[직전 Assessment 와 동일 timestamp · 미래 timestamp · 빈 결과]을 negative case 로 cover, timezone · 1 주 재수집 window 추가 설계 가능성).
- `docs/decisions/ADR-0030-assessment-collection-enumerate.md` — §4(since 통합 지점 — enumerate 는 since 를 **주입받는다**, 도출은 slice vi 책임, 중복 결정 회피).
- `docs/tasks/T-0264-collect-for-person-entry-service.md` — Follow-ups 의 "slice vi: since 도출(직전 Assessment → since) service — collectForPerson 의 since 인자 소비처" 분리 경계 + `CollectionEntryService.collectForPerson(person, since: string | undefined, assessmentId)` 시그니처(since 가 `string | undefined` 라 본 service 산출물이 그대로 주입 가능).
- `src/user/assessment.service.ts` — **본 service 가 주입받아 호출**할 `AssessmentService.findByPerson(personId, options?): Promise<Assessment[]>`(매칭 0 시 빈 배열 반환, throw 0). 본 task 는 이 메서드만 호출(변경 0). `Assessment` 는 immutable(update 미존재) — read-only.
- `src/user/assessment.service.spec.ts` — `AssessmentService` mock 주입 패턴 참고용(본 task 의 spec 이 `findByPerson` 을 jest mock 으로 주입). 직접 인스턴스화 + mock 패턴 mirror.
- `prisma/schema.prisma` (Assessment model 만, L274-294) — `Assessment { periodStart: DateTime, createdAt, ... }` + `@@unique([personId, period, scope, periodStart])` 필드 확인용(변경 0). `periodStart` 가 since 도출 기준 timestamp.

## Acceptance Criteria

본 task 의 산출물은 신규 derivation service 파일 1개 + 그 colocated spec 1개 = 2 파일이다. module provider 배선(`AssessmentCollectionModule` 등록)은 본 task 밖(별도 후속 micro-slice) — 본 task 의 spec 은 직접 인스턴스화 + `AssessmentService` mock 주입으로 검증한다.

- [ ] **신규 derivation service**: `src/assessment-collection/since-derivation.service.ts` 에 `@Injectable()` `SinceDerivationService`(또는 동등한 명확한 이름)를 신설하고, `deriveSince(personId: string): Promise<string | undefined>` public 메서드를 노출한다. 생성자는 `AssessmentService` 1개를 주입받는다(read-only `findByPerson` 호출용).
- [ ] **직전 Assessment → since 도출(ADR-0029 §5)**: `deriveSince` 는 (1) `this.assessmentService.findByPerson(personId)` 로 Assessment 배열 조회, (2) 그 중 **`periodStart` 가 가장 큰(최신)** row 를 선택, (3) 그 `periodStart`(DateTime → ISO-8601 문자열, 예: `.toISOString()`)를 반환한다. 반환 타입은 `string | undefined` 로 `CollectionEntryService.collectForPerson` 의 `since` 인자에 그대로 주입 가능해야 한다.
- [ ] **직전 Assessment 부재 → undefined(신규 인원, ADR-0029 §5)**: `findByPerson` 이 빈 배열을 반환하면 `deriveSince` 는 `undefined` 를 반환한다(= full collection, since 미지정). throw 0.
- [ ] **timestamp 선택이 createdAt 아닌 periodStart**: 도출 기준은 `periodStart`(수집 경계)이지 `createdAt`(row 영속 시각)이 아님이 코드와 test 로 드러난다(ADR-0029 §5 — "직전 Assessment 의 `periodStart`").
- [ ] happy-path test 1+: 여러 Assessment(서로 다른 `periodStart`)를 가진 person → 가장 최신 `periodStart` 의 ISO 문자열이 반환됨을 검증. `findByPerson` mock 호출 인자(personId)도 확인.
- [ ] error path test 1+ **각 분기**(ADR-0029 §5 negative 충분): (a) `findByPerson` 이 reject(의존성 실패) → `deriveSince` 가 그 reject 를 전파(잡지 않음), (b) Assessment 배열이 비어있음(신규 인원) → `undefined` 반환(throw 0).
- [ ] negative/flow test 1+ **각 경계값**(ADR-0029 §5 경계 명시): (c) **단일 Assessment** → 그 row 의 `periodStart` 반환, (d) **여러 Assessment 의 정렬 무관성** — `findByPerson` 이 임의 순서로 반환해도 가장 큰 `periodStart` 선택(입력 순서에 의존하지 않음을 검증 — 정렬 안 된 mock 입력으로), (e) **동일 `periodStart` 가 복수** row → 그 timestamp 반환(중복 timestamp 경계, throw 0), (f) ISO 변환 형식 검증(`periodStart` Date → `.toISOString()` 결과가 `since` 로 유효한 ISO-8601 문자열).
- [ ] flow/branch cover: 빈 배열 vs 1개 vs 다수 / 정렬됨 vs 안 됨 / reject vs 정상 각 1+ test.
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — `coverageThreshold.global` 강제. 신규 service 파일 자체도 충분 cover.
- [ ] `pnpm lint && pnpm build && pnpm test` 통과(tester 가 결과 확인 — R-110).
- [ ] colocated spec 위치: `src/assessment-collection/since-derivation.service.spec.ts`(신규 colocated spec). `AssessmentService` mock 은 직접 인스턴스화 + jest mock(`findByPerson`) 또는 `Test.createTestingModule` provider override 로 구성(기존 collection slice spec 의 mock 패턴 mirror — 예: `collection-persistence.service.spec.ts` / `assessment.service.spec.ts`).

## Out of Scope

- **module provider 배선** — `SinceDerivationService` 를 `AssessmentCollectionModule` provider/export 로 등록 + `AssessmentService`/`UserModule` import 경로 확인은 **별도 후속 micro-slice**. 본 task 는 `since-derivation.service.ts` + 그 spec 2 파일만 신설하고, spec 은 직접 인스턴스화 + mock 주입으로 검증한다. `assessment-collection.module.ts` / `assessment-collection.module.spec.ts` 를 건드리지 않는다.
- **호출처 결선** — scheduler/manual trigger(P5 평가 진입 / P7)가 `deriveSince(personId)` 로 since 를 산출해 `collectForPerson(person, since, assessmentId)` 에 주입하는 진입점 wiring 은 본 task 밖(별도 phase 경계 결정 — `Assessment` row 생성 주체 결정 필요, ADR-worthy). 본 task 는 since **도출 로직만** 박제.
- **`AssessmentService` / `CollectionEntryService` 의 변경** — 전부 기존 시그니처 재사용(호출만). 본 task 는 그 파일들을 수정하지 않는다.
- **1 주 재수집 window / timezone 정책** — ADR-0029 §5 가 "추가 설계 결정이 필요할 수 있다" 로 남긴 incremental window(REQ-058 최근 1주 재수집 OK)는 본 task 밖(평가 재수집 정책은 P5/P7). 본 task 는 직전 `periodStart` 단순 도출만 — window 보정은 후속.
- **DB schema / migration** — 0(기존 `Assessment` read 메서드 재사용). `Assessment` 는 immutable read-only 조회만(write 0).
- **실 네트워크 / 실 credential** — Q-0025 대로 deferred. mock 주입 `AssessmentService` 위에서만 unit-test(실 DB 0 / 실 token 0).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시 비어 있음 — sub-agent 가 관련 작업 발견 시 추가)

- module 배선(별도 micro-slice): `SinceDerivationService` 를 `AssessmentCollectionModule` provider/export 로 등록 + `AssessmentService` 주입 경로(`UserModule` export) 확인 + module spec 회귀(provider resolve 검증).
- 호출처 결선(P5/P7 경계, ADR-worthy): scheduler/manual trigger 가 `deriveSince` → `collectForPerson` 으로 since 를 잇는 진입점 + `assessmentId`(Assessment row) 생성 주체 결정.
- 1 주 재수집 window / timezone 보정(P5/P7, REQ-058): incremental window 정책 — 직전 `periodStart` 에서 1 주를 빼는 등 재수집 보호 보정.
