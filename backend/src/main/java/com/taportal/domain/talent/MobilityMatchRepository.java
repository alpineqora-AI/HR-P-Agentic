package com.taportal.domain.talent;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for MobilityMatch rows (Spring Data JPA; derived queries only). */
public interface MobilityMatchRepository extends JpaRepository<MobilityMatch, UUID> {

    List<MobilityMatch> findByOrderByFitScoreDesc();
}
