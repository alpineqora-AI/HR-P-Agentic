package com.taportal.domain.engagement;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for NurtureCampaign rows (Spring Data JPA; derived queries only). */
public interface NurtureCampaignRepository extends JpaRepository<NurtureCampaign, UUID> {

    List<NurtureCampaign> findByOrderByCreatedAtDesc();
}
