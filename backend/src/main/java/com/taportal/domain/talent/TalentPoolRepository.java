package com.taportal.domain.talent;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for TalentPool rows (Spring Data JPA; derived queries only). */
public interface TalentPoolRepository extends JpaRepository<TalentPool, UUID> {

    List<TalentPool> findByOrderByNameAsc();
}
