package com.taportal.domain.engagement;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for Survey rows (Spring Data JPA; derived queries only). */
public interface SurveyRepository extends JpaRepository<Survey, UUID> {

    List<Survey> findByOrderByNameAsc();
}
