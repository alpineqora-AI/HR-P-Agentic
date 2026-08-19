package com.taportal.domain.interview;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for Interview rows (Spring Data JPA; derived queries only). */
public interface InterviewRepository extends JpaRepository<Interview, UUID> {

    List<Interview> findByApplicationId(UUID applicationId);

    List<Interview> findByStatus(String status);

    List<Interview> findByStatusAndScheduledAtBetween(String status, java.time.OffsetDateTime from, java.time.OffsetDateTime to);

    List<Interview> findByStatusAndScheduledAtBefore(String status, java.time.OffsetDateTime before);
}
