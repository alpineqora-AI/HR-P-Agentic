package com.taportal.domain.engagement;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for SurveyResponse rows (Spring Data JPA; derived queries only). */
public interface SurveyResponseRepository extends JpaRepository<SurveyResponse, UUID> {

    long countBySurveyId(UUID surveyId);
}
