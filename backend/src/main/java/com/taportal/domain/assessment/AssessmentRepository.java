package com.taportal.domain.assessment;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for Assessment rows (Spring Data JPA; derived queries only). */
public interface AssessmentRepository extends JpaRepository<Assessment, UUID> {

    List<Assessment> findByApplicationId(UUID applicationId);
}
