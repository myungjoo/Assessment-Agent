---
id: T-0447
title: LAN 기기 일일 Docker 배포·자동 테스트 — daily-test.sh + ADR-0043 + 로컬 루틴 플레이북
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-035]
estimatedDiff: 230
estimatedFiles: 4
created: 2026-06-17
plannerNote: 사용자 요청 — LAN arm64 Pi5(192.168.0.7)에서 매일 02:00 main 기준 재배포+자동 테스트. 운영 이미지 슬림(jest 불가)→black-box HTTP 스모크, 단일 issue 상태토글, 로컬 루틴 트리거(LAN 도달성). 설계 plan 사용자 승인 완료.
---

# T-0447 — LAN 기기 일일 Docker 배포·자동 테스트

## Why

LAN 의 arm64 기기(Raspberry Pi 5, `192.168.0.7`)에서 매일 02:00 에 최신 `main` 기준 Docker
스택을 재배포하고 기동된 앱을 자동 테스트해 **항상 살아있는 사용자 테스트 인스턴스**를 유지한다.
이미 [`deploy/redeploy.sh`](../../deploy/redeploy.sh)(재배포)와 CI `deploy-artifacts`(매 PR boot+serve
스모크)가 있으나, **재배포 후 검증 러너 + 결과 보고 + 트리거**가 없다. 세 제약(운영 이미지 슬림 →
컨테이너 내 jest 불가 / LAN 사설 IP → cloud cron 미도달 / 무인 자동화 → 이슈 누적 금지)이 설계를
규정한다. 근거는 [ADR-0043](../decisions/ADR-0043-daily-deploy-test.md)(black-box 스모크 / 단일 이슈
상태토글 / 보고-only / 로컬 루틴 트리거). 설계 plan 은 사용자 승인 완료.

## Required Reading

- `Dockerfile` — `pnpm prune --prod`로 devDep 제거(슬림) → 컨테이너 내 jest 불가 근거
- `deploy/redeploy.sh` — 재배포 본체(daily-test.sh step 1 이 그대로 호출)
- `src/app.service.ts` — `APP_STATUS_MESSAGE`("Assessment-Agent") health anchor
- `src/auth/auth.controller.ts` — login(200+cookie)/me(JwtAuthGuard), `COOKIE_OPTIONS` secure:true
- `src/user/user.controller.ts` + `src/user/dto/add-user.dto.ts` — `POST /api/users` 공개 signup(201/409), password @MinLength(8)
- `.github/workflows/ci.yml` deploy-artifacts(L220~) — CI 스모크와의 차별점(amd64·ephemeral vs arm64·영속 DB)

## Acceptance Criteria

commitMode: pr. PR 파일 = `deploy/daily-test.sh`(신규) + `docs/decisions/ADR-0043-daily-deploy-test.md`(신규)
+ `docs/ops/daily-deploy-test.md`(신규 플레이북) + `.gitignore`(deploy/logs/ 추가). `deploy/README.md`
보강 + 본 task 파일·STATE bookkeeping 은 별도 direct commit(§3.1 README=direct).

- [ ] `deploy/daily-test.sh` — redeploy→health 폴링→liveness(GET /api·GET / SPA)→auth 라운드트립
      (signup 201|409 멱등 → login 200 → me 200) 4 step. 결과 `deploy/logs/daily-<ts>.log` +
      `latest-result.json`(stdout 도), 전부 PASS exit 0 / 아니면 non-zero. env override
      (REPO_DIR/BASE_URL/SKIP_REDEPLOY/HEALTH_TIMEOUT/DAILY_SMOKE_*).
- [ ] health 실패 시 후속 smoke step 은 SKIP 표기 + 전체 FAIL + failedStep 정확.
- [ ] ADR-0043 — black-box 근거(슬림 이미지)/단일 이슈 상태토글/보고-only/로컬 루틴 트리거/기기 타이머 미사용 박제.
- [ ] 플레이북 — SSH 원격 실행 + 단일 issue create-or-edit(PASS=close·FAIL=open, 항상 ≤1개) + 보고-only + 루틴 등록 가이드. `--body-file` 사용(`--body @-` 금지).
- [ ] `.gitignore` 에 `deploy/logs/` 추가.
- [ ] 실기기(192.168.0.7) end-to-end 검증: happy(redeploy 포함 PASS)/스모크(SKIP_REDEPLOY)/실패(잘못된 포트→FAIL+failedStep) 3 경로.
- [ ] `pnpm lint && pnpm build && pnpm test` 무회귀(TS 코드 변경 0 — bash·docs 만).

## Out of Scope

- 기기 측 systemd 타이머 설치(로컬 루틴이 트리거) — README 에 미설치 명시.
- 실패 시 자동 수정 PR(보고-only — ADR-0043 §3).
- 타 LAN 기기 브라우저 인증 사용자 테스트용 TLS/리버스 프록시(secure 쿠키 — ADR-0043 Consequences, 보안 게이트 별도).
- 인증 라운드트립 외 도메인 endpoint 스모크 확대(후속 — 플레이북/스크립트 step 추가로 확장 가능).
- 새 외부 dependency 0(curl·bash·gh 만, 전부 기존 환경).

## Suggested Sub-agents

`implementer → tester` (단, bash·docs 라 jest 단위테스트 대신 shellcheck + 실기기 end-to-end + 무회귀)

## Follow-ups

- 도메인 endpoint(assessment 생성·조회 등) 스모크 step 확대.
- 타 기기 브라우저 사용자 테스트를 위한 TLS 종단(리버스 프록시) 결정 — 별도 ADR.

## Result (DONE)

- 완료: 2026-06-17 (PR #358 squash-merge `2b5cee6`, reviewer round 2 APPROVE, 4-게이트 PASS, CI green).
- 신규 `deploy/daily-test.sh`(207 LOC bash): redeploy→health 폴링(180s)→liveness(`GET /api`·`GET /` SPA)→auth 라운드트립(signup 201|409→login 200→me 200) 4 step. 결과 `deploy/logs/daily-<ts>.log` + `latest-result.json`(stdout), 전부 PASS exit 0. SKIP_REDEPLOY/BASE_URL/HEALTH_TIMEOUT 등 env override. health 실패 시 후속 SKIP+전체 FAIL+failedStep. 새 dep 0.
- 신규 `docs/decisions/ADR-0043`: black-box 스모크(슬림 이미지 jest 불가)/단일 이슈 상태토글/보고-only/로컬 루틴 트리거(LAN 도달성)/기기 타이머 미사용 박제.
- 신규 `docs/ops/daily-deploy-test.md`: 로컬 루틴 플레이북(SSH 원격 실행 + 단일 `daily-test` issue create-or-edit + 보고-only + 루틴 등록 가이드).
- `.gitignore` deploy/logs/, `ci.yml` 문법검사에 daily-test.sh(reviewer MAJOR-1).
- reviewer round 1 MAJOR 2(ci 문법검사 누락·SKIP false PASS) → round 2 commit 000a3cc 해소. MINOR(로그 prune)은 통제 입력 nit 수용.
- 실기기 192.168.0.7 end-to-end 3경로 실증: happy(redeploy 포함 PASS·exit 0)·스모크(SKIP_REDEPLOY PASS)·실패(잘못된 포트 FAIL+failedStep=health·exit 1). TS 변경 0 무회귀.
- deploy/README.md 보강 + 본 status + STATE bookkeeping 은 머지 후 direct commit(§3.1).
