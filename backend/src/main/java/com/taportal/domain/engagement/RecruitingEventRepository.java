package com.taportal.domain.engagement;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for RecruitingEvent rows (Spring Data JPA; derived queries only). */
public interface RecruitingEventRepository extends JpaRepository<RecruitingEvent, UUID> {

    List<RecruitingEvent> findByOrderByStartsAtDesc();
}
