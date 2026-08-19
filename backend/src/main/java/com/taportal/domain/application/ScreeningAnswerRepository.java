package com.taportal.domain.application;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for ScreeningAnswer rows (Spring Data JPA; derived queries only). */
public interface ScreeningAnswerRepository extends JpaRepository<ScreeningAnswer, UUID> {

    List<ScreeningAnswer> findByApplicationId(UUID applicationId);
}
