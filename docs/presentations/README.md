# docs/presentations/ — 발표 자료 (derived documents)

본 디렉토리의 문서는 **발표·설명용 파생 자료(derived doc)** 다. 프로젝트의 어떤 결정·규칙·상태에 대해서도 **root of trust / source of truth 가 아니다.**

## 사용 규칙

- **정본(source of truth)은 항상 원본 문서다**: 요구사항은 [README.md](../../README.md), 행동 규칙은 [CLAUDE.md](../../CLAUDE.md), 아키텍처 결정은 [docs/decisions/](../decisions/), 상태는 [docs/STATE.json](../STATE.json), 작업 이력은 [docs/progress/](../progress/) 와 git log.
- 본 디렉토리의 수치·인용·타임라인은 **작성 시점의 스냅샷**이며, 이후 갱신되지 않는다. 원본과 어긋나면 **항상 원본이 우선**한다.
- agent(planner / architect / implementer / reviewer 등)는 본 디렉토리 문서를 **Required Reading·결정 근거·요구사항 출처로 인용하지 않는다**. 사람의 발표 준비 용도로만 읽는다.
- 본 디렉토리 변경은 CLAUDE.md §3.1 기준 `direct` commit 대상(진행상황·설명 문서)이며, 코드·결정에 영향을 주지 않는다.

## 파일

| 파일 | 내용 |
| --- | --- |
| [vibe-coding-junior-outline.md](vibe-coding-junior-outline.md) | 사내 junior 개발자 대상 vibe coding 발표(10분) 내용 개요 |
| [vibe-coding-junior.pptx](vibe-coding-junior.pptx) | 위 개요 기반 발표 덱 (13장, 발표자 노트 포함) |
