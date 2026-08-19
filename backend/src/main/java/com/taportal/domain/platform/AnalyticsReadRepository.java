package com.taportal.domain.platform;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;

/**
 * Native, read-only counts over aggregates owned by other agents (application/job/candidate/
 * interview/offer). We never import those entities. Bound to {@link MetricDaily} only to
 * satisfy the {@code Repository} type parameter. All queries are robust to empty tables.
 */
public interface AnalyticsReadRepository extends Repository<MetricDaily, UUID> {

    @Query(value = "select count(*) from job where status = 'OPEN'", nativeQuery = true)
    long countOpenJobs();

    @Query(value = "select count(*) from candidate where lifecycle = 'ACTIVE'", nativeQuery = true)
    long countActiveCandidates();

    @Query(
            value = "select count(*) from application where applied_at >= now() - interval '30 days'",
            nativeQuery = true)
    long countApplications30d();

    @Query(
            value =
                    "select count(*) from interview where scheduled_at >= now() - interval '30 days'",
            nativeQuery = true)
    long countInterviews30d();

    @Query(
            value = "select count(*) from offer where created_at >= now() - interval '30 days'",
            nativeQuery = true)
    long countOffers30d();

    @Query(
            value =
                    "select count(*) from application "
                            + "where stage = 'HIRED' and updated_at >= now() - interval '30 days'",
            nativeQuery = true)
    long countHires30d();

    /** Average of the time_to_hire_days daily metric; null when no rows. */
    @Query(
            value = "select avg(value) from metric_daily where metric_key = 'time_to_hire_days'",
            nativeQuery = true)
    Double avgTimeToHireDays();

    /** Average fit score across applications; null when no scored rows. */
    @Query(value = "select avg(fit_score) from application where fit_score is not null", nativeQuery = true)
    Double avgFitScore();

    @Query(value = "select count(*) from offer where status = 'ACCEPTED'", nativeQuery = true)
    long countAcceptedOffers();

    @Query(
            value = "select count(*) from offer where status in ('SENT','ACCEPTED','DECLINED','EXPIRED')",
            nativeQuery = true)
    long countDecidedOffers();

    /** stage -> count over all applications. Returns rows of [stage(text), count(bigint)]. */
    @Query(value = "select stage, count(*) from application group by stage", nativeQuery = true)
    List<Object[]> countByStage();
}
