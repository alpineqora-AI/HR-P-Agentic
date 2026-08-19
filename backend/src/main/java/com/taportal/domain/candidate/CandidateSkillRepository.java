package com.taportal.domain.candidate;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for CandidateSkill rows (Spring Data JPA; derived queries only). */
public interface CandidateSkillRepository extends JpaRepository<CandidateSkill, CandidateSkillId> {

    List<CandidateSkill> findByCandidateId(UUID candidateId);
}
