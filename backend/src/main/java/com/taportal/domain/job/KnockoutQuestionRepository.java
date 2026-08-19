package com.taportal.domain.job;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for KnockoutQuestion rows (Spring Data JPA; derived queries only). */
public interface KnockoutQuestionRepository extends JpaRepository<KnockoutQuestion, UUID> {

    List<KnockoutQuestion> findByJobIdOrderByOrdinal(UUID jobId);
}
