package com.taportal.domain.job;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for JobSkill rows (Spring Data JPA; derived queries only). */
public interface JobSkillRepository extends JpaRepository<JobSkill, JobSkillId> {

    List<JobSkill> findByJobId(java.util.UUID jobId);
}
