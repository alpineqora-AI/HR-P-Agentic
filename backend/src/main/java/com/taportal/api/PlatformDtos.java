package com.taportal.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Platform (integrations / compliance / audit / analytics) response DTOs. */
public final class PlatformDtos {

    private PlatformDtos() {}

    public record Integration(
            UUID id, String name, String category, String status, OffsetDateTime lastSyncAt) {}

    public record BiasRow(
            UUID id,
            String jobTitle,
            String stage,
            String dimension,
            String groupLabel,
            BigDecimal passRate,
            BigDecimal impactRatio,
            boolean flagged) {}

    public record AuditRow(
            UUID id,
            String actor,
            String action,
            String entityType,
            String detail,
            OffsetDateTime createdAt) {}

    public record FunnelStage(String stage, long count) {}

    public record AnalyticsSummary(
            long openJobs,
            long activeCandidates,
            long applications30d,
            long interviews30d,
            long offers30d,
            long hires30d,
            double avgTimeToHireDays,
            double avgFitScore,
            double offerAcceptRate,
            Map<String, Long> byStage,
            List<FunnelStage> funnel) {}

    public record MetricPoint(String date, BigDecimal value) {}
}
