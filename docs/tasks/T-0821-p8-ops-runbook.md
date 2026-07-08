---
id: T-0821
title: P8 운영 문서 — 배포·복구·trouble-shoot 런북 신설 (docs/ops/runbook.md)
phase: P8
status: PENDING
commitMode: direct
coversReq: [REQ-047, REQ-057, REQ-058]
estimatedDiff: 130
estimatedFiles: 2
created: 2026-07-08
independentStream: p8-ops-docs
dependsOn: []
touchesFiles: [docs/ops/runbook.md, docs/architecture/deployment.md]
plannerNote: "P8 line147 운영 문서(배포·복구·trouble-shoot) — P3~P5 drift 교정 완결 후 첫 unstarted-phase 실질 전진, direct doc-only 런북 신설"
---

# T-0821 — P8 운영 문서: 배포·복구·trouble-shoot 런북 신설

## Why

PLAN.md Phase P8 line 147 "운영 문서 (배포·복구·trouble-shoot)" 는 아직 착수되지 않은 bullet 이다. 최근 12 fire (T-0809~T-0820) 는 P3~P5 PLAN↔shipped drift 교정으로 그 drift 는 실효 소진됐고, 이제 실제 미착수 phase 를 전진시킬 차례다. deploy 스크립트(`deploy/redeploy.sh`·`daily-test.sh`·`docker-entrypoint.sh`·systemd unit)와 아키텍처 문서(`deployment.md`)는 이미 shipped 이나, **운영자가 장애 시 따라갈 step-by-step 복구·trouble-shoot 플레이북**(runbook)은 부재하다. 본 task 는 그 gap 을 `docs/ops/runbook.md` 신설로 채운다 — deployment.md 의 architecture-level 서술(토폴로지/migration/secret 정책)과 중복하지 않고, **실행 절차(배포 명령·롤백·복구·증상별 진단)** 만 담는다.

## Required Reading

- `docs/PLAN.md` (line 143~148 Phase P8 — 특히 line 147 대상 bullet, line 166 phase 순서)
- `docs/architecture/deployment.md` (기존 architecture-level 서술 — 런북이 중복하지 않도록 범위 확인. §Backup/restore 전략, §Migration 정책, §Secret 주입 방식, §Scheduler)
- `docs/ops/daily-deploy-test.md` (기존 ops 문서 톤·형식 참고, 링크 대상)
- `deploy/README.md` (deploy/ 스크립트 개요)
- `deploy/redeploy.sh` (재배포 흐름 — 런북의 배포 절차 근거)
- `deploy/daily-test.sh` (health/liveness/auth/eval step 구조 — 진단 근거)

## Acceptance Criteria

- [ ] `docs/ops/runbook.md` 신설. 다음 4 섹션을 포함:
  1. **배포 (Deploy / Redeploy)**: `deploy/redeploy.sh` / systemd `assessment-agent-redeploy.{service,timer}` 실행 절차, migration 적용 순서(`deployment.md` §Migration 정책 링크), 배포 성공 확인(daily-test health/liveness step 참조).
  2. **복구 (Recovery)**: 롤백 절차(직전 정상 배포로 되돌리기 — `git push --force` 금지 원칙 준수, §9), DB restore 절차(`deployment.md` §Backup/restore 전략 링크), migration 실패 시 대응.
  3. **Trouble-shoot (증상별 진단)**: health/liveness/auth/eval step 각각의 FAIL 증상 → 원인 후보 → 조치 표. LLM endpoint 미도달, github PAT 만료/scope 부족, Ollama LAN 미노출 등 알려진 장애 유형 포함.
  4. **운영 전제 체크리스트**: secret 주입(§9 실값 파일 금지 재확인), github read-scope PAT(`GITHUB_<KEY>_TOKEN_ENC`), Ollama LAN 노출 — PLAN line 108/109 owner 승인 전제와 정합.
- [ ] 각 섹션은 기존 문서(`deployment.md`·`daily-deploy-test.md`·`deploy/README.md`)로 cross-link 하고, architecture-level 서술을 **복제하지 않는다**(런북은 실행 절차만; 정책은 링크로 위임).
- [ ] `docs/architecture/deployment.md` 의 §후속 진행 또는 §개요 말미에 신설 런북으로의 링크 1줄 추가(문서 간 discoverability — deployment.md ↔ runbook.md 상호 참조).
- [ ] `docs/ops/runbook.md` 안에 secret/token 실값을 절대 적지 않는다 — 주입 방식·env 키 이름만 서술(§9 검증: 파일 grep 으로 `sk-`·`ghp_`·`AZURE_OPENAI_KEY=` 등 실값 패턴 0).
- [ ] 문서 본문은 한국어(§12). 명령어·경로·env 키·systemd unit 이름은 영어 그대로.
- [ ] `git diff --stat` 으로 변경이 `docs/ops/runbook.md`(신설) + `docs/architecture/deployment.md`(링크 1줄) 2 파일 이내, ≤ 300 LOC 확인.

## Out of Scope

- 코드·CI·package.json 변경 금지(순수 doc-only — commitMode direct 유지).
- `deploy/` 스크립트 자체의 수정·신설 금지(본 task 는 기존 스크립트를 *문서화*만 한다).
- PLAN.md line 147 checkbox flip 금지 — P8 런북은 시작일 뿐이며, P8 완결(E2E 커버리지·보안 점검·부하 테스트)까지 열어둔다. checkbox 정합은 별도 follow-up.
- 실 credential/PAT 주입·live 배포 실행 금지(운영 행위 — HITL 영역).
- deployment.md 의 기존 architecture 서술 재작성·이동 금지(링크 1줄만 추가).

## Suggested Sub-agents

`implementer` (doc 작성 — direct doc-only 이므로 architect/tester 불요; driver 가 executor 경유 dispatch)

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 여기 append)
