package com.taportal.domain.engagement;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for Referral rows (Spring Data JPA; derived queries only). */
public interface ReferralRepository extends JpaRepository<Referral, UUID> {

    List<Referral> findByOrderByCreatedAtDesc();
}
