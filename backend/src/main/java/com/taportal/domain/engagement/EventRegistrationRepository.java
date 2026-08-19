package com.taportal.domain.engagement;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for EventRegistration rows (Spring Data JPA; derived queries only). */
public interface EventRegistrationRepository extends JpaRepository<EventRegistration, UUID> {

    List<EventRegistration> findByEventIdOrderByCreatedAt(UUID eventId);

    long countByEventId(UUID eventId);

    long countByEventIdAndStatus(UUID eventId, String status);

    boolean existsByEventIdAndEmailIgnoreCase(UUID eventId, String email);
}
