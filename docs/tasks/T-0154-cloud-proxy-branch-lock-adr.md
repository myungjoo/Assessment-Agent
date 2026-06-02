---
id: T-0154
title: ADR-0015 신설 — cron@web 자율성 확보를 위한 claude/* 브랜치 기반 driver lock (cloud proxy 호환)
phase: P4
status: PENDING
commitMode: pr
coversReq: []
estimatedDiff: 190
estimatedFiles: 2
created: 2026-06-02
plannerNote: P4 운영 infra (ADR-0009 후속, REQ 매핑 없음 — dependency-free, §5 HITL 미발화). cron@web cloud proxy 가 refs/locks/* push 를 403 으로 거부 → 현재 로컬 /loop 대체 픽업에만 의존(cron 자율 long-horizon 불가). lock 을 claude/* 브랜치로 이전(ADR-0015)해 PAT 없이 cron@web 자율 lock 획득 가능하게. blocker 아닌 enhancement. (T-0153 은 PLAN doc-sync 로 별개 머지 — 본 task 와 무관, 번호만 인접.) doc-only enumerated-section ×1.6.
---

# T-0154 — ADR-0015 신설: cron@web 자율성 확보를 위한 claude/\* 브랜치 기반 driver lock

## Why

사용자가 "cron/schedule 이 스스로 필요한 권한을 획득하게 하자"는 운영 목표를 제시했고, 그 근본 원인을 공식 문서로 규명했다.

**근본 원인**: Claude Code on the web / routines(cron) 의 클라우드 sandbox 는 git push 를 **credential proxy** 가 가로채 `claude/*` prefix 브랜치(및 현재 작업 브랜치)로만 제한한다 (공식: <https://code.claude.com/docs/en/claude-code-on-the-web> — "By default, Claude can only push to branches prefixed with `claude/`"). 그래서 [ADR-0009](../decisions/ADR-0009-strong-ref-cas-lock.md) 의 ref-CAS lock 인 `git push <sha>:refs/locks/driver --force-with-lease` 가 **HTTP 403** 으로 거부된다 (`refs/locks/*` 는 브랜치가 아니므로 proxy 허용 대상 밖). 이것이 2026-06-02 새벽 cron@web 의 STAND DOWN ×7 (`B-credential-2026-06-02T02:03Z`) 의 직접 원인이었다.

**현재 상태 (중요)**: 그 B-credential blocker 는 **이미 RESOLVED** 다 — 단, 로컬 `/loop` driver(`loop@WIN-JQIPLSBL9QV`, `gh` + `refs/locks/*` push 권한 보유)가 cron@web 의 STAND DOWN 을 **대체 픽업**해 ref-CAS lock 을 정상 획득하고 후속 task 를 merge 한 방식이었다. 즉 **cloud proxy 의 근본 제약은 잔존**하며, cron@web 은 여전히 로컬 기기의 구제에 의존한다 → **진정한 cron@web 자율 long-horizon 이 불가**하다.

본 task 는 이 잔존 제약을 근본 해소한다: lock 저장소를 `refs/locks/driver`(blob ref) → `claude/*` namespace 의 **브랜치**(예: `refs/heads/claude/lock-driver`, commit ref)로 이전하는 설계를 **ADR-0015** 로 박제한다. `claude/*` 는 클라우드 proxy 가 기본 허용하므로, **PAT 주입도 "Allow unrestricted branch pushes" 토글도 없이** cron@web 이 자율적으로 lock CAS push 를 수행할 수 있게 된다.

성격: 이것은 더 이상 active blocker 수습이 아니라 **cron@web 자율성 확보 enhancement** 다. 이 lock 메커니즘은 src/ 런타임 코드가 아니라 driver 가 따르는 prompt([docs/LOOP.md](../LOOP.md) + [CLAUDE.md](../../CLAUDE.md) §10)에 박제돼 있으므로 "구현" = 본 ADR + 후속 doc 동기 task 다. 본 task 는 그 첫 단계인 ADR 신설(아키텍처 결정, reviewer 점검 대상)이다.

## Required Reading

- <https://code.claude.com/docs/en/claude-code-on-the-web> — "By default, Claude can only push to branches prefixed with `claude/`" + credential proxy / "Allow unrestricted branch pushes" 절 (클라우드 proxy 브랜치 제한의 공식 근거).
- <https://code.claude.com/docs/en/web-scheduled-tasks> — routines(cron) 가 동일 cloud sandbox/proxy 위에서 동작함 확인 (동일 push 제약 상속). setup script / 환경변수(대안 A PAT 주입의 근거) 절.
- `docs/decisions/ADR-0009-strong-ref-cas-lock.md` — 현 ref-CAS lock 결정(blob ref `refs/locks/driver`). ADR-0015 가 **저장소 메커니즘만** supersede/revise 하는 대상. Status·Decision (2)(3)·Consequences·Alternatives (c)(d) 정독 — 특히 "git remote 가 세 진입점의 유일한 공통분모" 가정이 cloud proxy 에서 깨진 점.
- `docs/LOOP.md` §1 [1] · §4 — 현 lock 획득/해제/fetch 명령(ref-CAS push 절차). ADR-0015 의 Decision 이 이 명령을 어떻게 바꿔야 하는지 파악(실제 편집은 본 task Out of Scope — 후속 direct task).
- `CLAUDE.md` §10 "동시 실행 정책" — strong-mutex 모델 설명. ADR-0015 가 갱신을 요구할 단락 파악(실제 편집은 후속 direct task).
- `docs/STATE.json` 의 `blockersResolvedNote` (`B-credential-2026-06-02T02:03Z` 해소 경위) + `docs/progress/journal-2026-06-02.md` 의 02:03~08:02 STAND DOWN #1~#7 라인 및 08:44~09:22 session #38 라인 — 근본 원인 및 로컬 대체 픽업 해소 경위의 1차 증거.

## Acceptance Criteria

- [ ] `docs/decisions/ADR-0015-cloud-proxy-branch-lock.md` 신설. Status 는 `PROPOSED` 로 시작(후속 LOOP/CLAUDE 동기 task 머지 후 ACCEPTED 전이 — ADR-0009 가 따른 gate 패턴 mirror).
- [ ] **Context** 단락: 클라우드 proxy 가 `claude/*` 외 ref push 를 403 으로 거부한다는 근본 원인을 공식 URL 2개 인용과 함께 박제. cron@web STAND DOWN ×7(B-credential) 을 증거로, 그리고 그것이 로컬 `/loop` 대체 픽업으로만 해소됐고 cloud proxy 제약은 잔존함(cron 자율성 미달)을 명시. ADR-0009 의 "git remote 가 유일한 공통분모" 가정이 cloud proxy 에서 깨진 점을 설명.
- [ ] **Decision** 단락: (1) lock 저장소를 `refs/locks/driver`(blob) → `claude/*` namespace 브랜치(예: `refs/heads/claude/lock-driver`, commit ref)로 이전 — `claude/*` 는 proxy 기본 허용이라 **PAT/unrestricted 토글 없이** cron@web 도 CAS push 가능. (2) `--force-with-lease` compare-and-swap 원자성은 ref 종류 무관(서버측 CAS)하게 유지 — multi-machine 강한 mutex 보장 불변. (3) blob→commit 의 기계적 차이 명시: lock JSON(holder/session/since)을 commit 의 단일 파일 tree(예: `lock.json`) 또는 commit message 에 담는 방식, fetch(`+refs/heads/claude/lock-driver:refs/remotes/...`)·획득·해제(tombstone empty commit 또는 브랜치 삭제) 규약. (4) 해제/tombstone 규약과 60분 stale 탈취 CAS 가 새 저장소에서도 동일 동작함을 명시.
- [ ] **Consequences** 단락: 긍정(cron@web 이 PAT 주입/UI 토글 없이 자율적으로 lock 획득 → 로컬 기기 의존 제거, 진정한 cron 자율 long-horizon 실현) + 부정/트레이드오프(`claude/*` 브랜치 목록에 lock 브랜치가 섞여 noise / 기존 feature-branch 정리 스크립트가 lock 브랜치를 오삭제하지 않도록 주의 / ADR-0009 의 LOOP·CLAUDE 명령 동기 필요 / lock 브랜치가 commit object 라 미세하게 무겁다).
- [ ] **Alternatives** 단락: 최소 3개 비교 — (A) ADR-0009 blob-ref 유지 + **PAT 주입**(web env 환경변수로 GitHub token 주입 → proxy 우회. §5 HITL 외부 credential + 사용자 secret 관리 부담으로 기각/보류), (B) **"Allow unrestricted branch pushes" 토글만 ON**(direct→main push 는 풀리나 `refs/locks/*` 는 브랜치가 아니라 여전히 거부 → lock 미해결, 단독 불충분. 보완 수단으로만 유효), (C) **본 ADR 채택**(claude/* 브랜치 lock — credential 0, proxy 정합). 각 채택/기각 이유 명시. ADR-0009 Alternatives (c)(d) 와의 정합도 언급.
- [ ] `docs/decisions/ADR-0009-strong-ref-cas-lock.md` 의 Status 단락에 ADR-0015 로의 supersede(**저장소 메커니즘 한정** — CAS/강한 mutex 결정 자체는 유지) pointer 한 줄 추가. ADR-0009 본문 대규모 개정 금지 — pointer 한 줄만(immutable ADR 원칙).
- [ ] ADR 본문 끝 또는 Consequences 에 **Follow-up 명시**: 후속 LOOP.md §1[1]·§4 + CLAUDE.md §10 의 브랜치-lock 프로토콜 반영(direct-mode task)이 ACCEPTED 전이 gate 임을 박제.
- [ ] commitMode pr 이므로 R-110 상 tester 가 `pnpm lint && pnpm build && pnpm test` 를 실행해 doc-only 변경이 빌드/lint/test 를 깨지 않음을 확인(코드 변경 0 — test 추가 없음, 기존 suite green 유지 확인).
- [ ] 분기 없음(doc-only ADR) — R-112 happy/error/branch/negative 4종은 코드 symbol 부재로 생략. 본 항목 명시로 §3.2 면제 근거 박제.
- [ ] 언어 정책(§12): ADR 본문 한국어, ref/명령/경로/URL/Status enum 은 영어 유지.

## Out of Scope

- `docs/LOOP.md` §1[1]·§4 및 `CLAUDE.md` §10 본문의 실제 편집 — 후속 direct-mode task. 본 task 는 ADR 신설 + ADR-0009 pointer 한 줄만.
- 대안 (A) PAT 주입 방안의 실제 구현 — ADR 에서 비교만 하고 채택 안 함(§5 HITL 외부 credential).
- 대안 (B) "Allow unrestricted branch pushes" UI 토글 — 사용자 책임(이 task 범위 밖). ADR 에서 direct→main push 보완 수단으로 언급만.
- src/ 코드 변경 0 — 본 lock 메커니즘은 prompt/doc 박제이지 런타임 코드 아님.
- 실제 lock 브랜치 운영 전환(첫 cron@web 자율 lock 획득 검증) — 후속 doc 동기 task 머지 후 운영 단계.
- 남은 P4 milestone-1/3 승인(Q-0014 에서 미승인 유지로 RESOLVED) — 본 infra task 와 독립. 본 task 는 dependency-free(§5 미발화)라 milestone 승인과 무관하게 진행 가능.

## Suggested Sub-agents

`architect → tester`

- architect: ADR-0015 본문 작성(cross-module impact 없음 — doc-only) + ADR-0009 pointer 한 줄.
- tester: doc-only ADR 이므로 신규 test 없음. `pnpm lint && pnpm build && pnpm test` 가 green 유지함만 확인(R-110 충족).

## Follow-ups

- (direct-mode task) `docs/LOOP.md` §1[1]·§4 의 ref-CAS 획득/해제/fetch 명령을 ADR-0015 의 claude/* 브랜치 lock 프로토콜로 반영. ADR-0015 ACCEPTED 전이 gate.
- (direct-mode task) `CLAUDE.md` §10 "동시 실행 정책"의 strong-mutex 모델 설명을 브랜치 lock 기반으로 동기. ADR-0015 ACCEPTED 전이 gate.
- (운영) ADR-0015 + LOOP/CLAUDE 동기 머지 후, 다음 cron@web fire 가 claude/* 브랜치 lock 을 자율 획득하는지 검증(STAND DOWN 재발 여부 관찰).
- (사용자 보완) "Allow unrestricted branch pushes" UI 토글 ON 은 direct→main push 안정화용 보완 — lock 해결과 별개로 권장.
