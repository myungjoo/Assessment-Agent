-- Contribution `@@unique([assessmentId, sourceRef])` 추가 (ADR-0033 §4) —
-- 한 Assessment 안에서 동일 unitId(sourceRef) Contribution 중복을 schema-level 차단.

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_assessmentId_sourceRef_key" ON "Contribution"("assessmentId", "sourceRef");
