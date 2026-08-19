package com.taportal.domain.talent;

import com.taportal.domain.platform.MetricDaily;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * Lightweight native read of candidate rows owned by another agent's aggregate.
 * We never import the candidate entity; we read columns directly and map Object[] -> DTO.
 * Bound to {@link MetricDaily} only to satisfy the {@code Repository} type parameter.
 */
public interface MatchReadRepository extends Repository<MetricDaily, UUID> {

    /** Active candidates, newest first — used for match ranking against a job. */
    @Query(
            value =
                    "select c.id, c.name, c.headline, c.lifecycle, c.source, c.location "
                            + "from candidate c "
                            + "order by c.last_active_at desc nulls last, c.created_at desc "
                            + "limit 50",
            nativeQuery = true)
    List<Object[]> findCandidatesForMatch();

    /** Passive talent for sourcing. */
    @Query(
            value =
                    "select c.id, c.name, c.headline, c.lifecycle, c.source, c.location "
                            + "from candidate c "
                            + "where c.lifecycle = 'PASSIVE' "
                            + "order by c.last_active_at desc nulls last "
                            + "limit 50",
            nativeQuery = true)
    List<Object[]> findPassiveCandidates();

    /** Dormant candidates for database reactivation. */
    @Query(
            value =
                    "select c.id, c.name, c.headline, c.lifecycle, c.source, c.location "
                            + "from candidate c "
                            + "where c.lifecycle = 'DORMANT' "
                            + "order by c.last_active_at asc nulls first "
                            + "limit 50",
            nativeQuery = true)
    List<Object[]> findDormantCandidates();

    /** Skill names attached to a candidate, for match explanation. */
    @Query(
            value =
                    "select s.name from candidate_skill cs "
                            + "join skill s on s.id = cs.skill_id "
                            + "where cs.candidate_id = :candidateId",
            nativeQuery = true)
    List<String> findSkillNamesForCandidate(@Param("candidateId") UUID candidateId);

    /** Skill names required/weighted on a job, for gap analysis. */
    @Query(
            value =
                    "select s.name from job_skill js "
                            + "join skill s on s.id = js.skill_id "
                            + "where js.job_id = :jobId",
            nativeQuery = true)
    List<String> findSkillNamesForJob(@Param("jobId") UUID jobId);

    /** Title of a job, for mobility rows; null when the job is missing. */
    @Query(value = "select j.title from job j where j.id = :jobId", nativeQuery = true)
    String findJobTitle(@Param("jobId") UUID jobId);
}
