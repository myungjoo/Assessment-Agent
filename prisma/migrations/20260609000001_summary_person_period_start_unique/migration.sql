-- Summary `@@unique([personId, period, periodStart])` 추가 (ADR-0035 §Decision 4) —
-- 한 person 의 한 granularity·구간 요약은 1 row, aggregate 재집계 idempotency key 를 schema-level 강제.

-- CreateIndex
CREATE UNIQUE INDEX "Summary_personId_period_periodStart_key" ON "Summary"("personId", "period", "periodStart");
