package com.taportal.domain.platform;

import com.taportal.api.PlatformDtos.AnalyticsSummary;
import com.taportal.api.PlatformDtos.AuditRow;
import com.taportal.api.PlatformDtos.BiasRow;
import com.taportal.api.PlatformDtos.FunnelStage;
import com.taportal.api.PlatformDtos.MetricPoint;
import com.taportal.domain.talent.MatchReadRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Platform read APIs: integrations, bias/compliance, audit, analytics. */
@Service
@Transactional(readOnly = true)
public class PlatformService {

    /** Canonical funnel order for the analytics summary. */
    private static final List<String> FUNNEL_ORDER =
            List.of(
                    "APPLIED",
                    "SCREENED",
                    "MATCHED",
                    "INTERVIEW",
                    "ASSESSMENT",
                    "OFFER",
                    "HIRED",
                    "REJECTED",
                    "WITHDRAWN");

    private final IntegrationRepository integrationRepository;
    private final BiasReportRepository biasRepository;
    private final AuditEventRepository auditRepository;
    private final MetricDailyRepository metricRepository;
    private final AnalyticsReadRepository analyticsRead;
    private final MatchReadRepository matchRead;

    public PlatformService(
            IntegrationRepository integrationRepository,
            BiasReportRepository biasRepository,
            AuditEventRepository auditRepository,
            MetricDailyRepository metricRepository,
            AnalyticsReadRepository analyticsRead,
            MatchReadRepository matchRead) {
        this.integrationRepository = integrationRepository;
        this.biasRepository = biasRepository;
        this.auditRepository = auditRepository;
        this.metricRepository = metricRepository;
        this.analyticsRead = analyticsRead;
        this.matchRead = matchRead;
    }

    public List<com.taportal.api.PlatformDtos.Integration> integrations() {
        return integrationRepository.findAll().stream()
                .map(
                        i ->
                                new com.taportal.api.PlatformDtos.Integration(
                                        i.getId(), i.getName(), i.getCategory(), i.getStatus(), i.getLastSyncAt()))
                .toList();
    }

    public List<BiasRow> bias() {
        return biasRepository.findAll().stream()
                .map(
                        b -> {
                            String jobTitle = b.getJobId() == null ? null : matchRead.findJobTitle(b.getJobId());
                            return new BiasRow(
                                    b.getId(),
                                    jobTitle,
                                    b.getStage(),
                                    b.getDimension(),
                                    b.getGroupLabel(),
                                    b.getPassRate(),
                                    b.getImpactRatio(),
                                    b.isFlagged());
                        })
                .toList();
    }

    public List<AuditRow> audit() {
        return auditRepository.findTop100ByOrderByCreatedAtDesc().stream()
                .map(
                        a ->
                                new AuditRow(
                                        a.getId(),
                                        a.getActor(),
                                        a.getAction(),
                                        a.getEntityType(),
                                        a.getDetail(),
                                        a.getCreatedAt()))
                .toList();
    }

    public AnalyticsSummary analyticsSummary() {
        // stage -> count, defaulting every known stage to 0 so the map/funnel are complete.
        Map<String, Long> byStage = new LinkedHashMap<>();
        for (String stage : FUNNEL_ORDER) {
            byStage.put(stage, 0L);
        }
        for (Object[] row : analyticsRead.countByStage()) {
            String stage = row[0] == null ? "UNKNOWN" : row[0].toString();
            long count = row[1] == null ? 0L : ((Number) row[1]).longValue();
            byStage.merge(stage, count, Long::sum);
        }

        List<FunnelStage> funnel =
                FUNNEL_ORDER.stream()
                        .map(stage -> new FunnelStage(stage, byStage.getOrDefault(stage, 0L)))
                        .toList();

        long accepted = analyticsRead.countAcceptedOffers();
        long decided = analyticsRead.countDecidedOffers();
        double acceptRate = decided <= 0 ? 0.0 : Math.round((accepted * 1000.0) / decided) / 10.0;

        return new AnalyticsSummary(
                analyticsRead.countOpenJobs(),
                analyticsRead.countActiveCandidates(),
                analyticsRead.countApplications30d(),
                analyticsRead.countInterviews30d(),
                analyticsRead.countOffers30d(),
                analyticsRead.countHires30d(),
                round1(analyticsRead.avgTimeToHireDays()),
                round1(analyticsRead.avgFitScore()),
                acceptRate,
                byStage,
                funnel);
    }

    public List<MetricPoint> metrics(String key) {
        if (key == null || key.isBlank()) {
            return List.of();
        }
        return metricRepository.findByMetricKeyOrderByMetricDate(key).stream()
                .map(m -> new MetricPoint(m.getMetricDate().toString(), m.getValue()))
                .toList();
    }

    private static double round1(Double v) {
        if (v == null) return 0.0;
        return Math.round(v * 10.0) / 10.0;
    }
}
