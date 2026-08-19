package com.taportal.domain.offer;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for Offer rows (Spring Data JPA; derived queries only). */
public interface OfferRepository extends JpaRepository<Offer, UUID> {

    List<Offer> findByApplicationId(UUID applicationId);
}
