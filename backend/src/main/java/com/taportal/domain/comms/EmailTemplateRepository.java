package com.taportal.domain.comms;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for EmailTemplate rows (Spring Data JPA; derived queries only). */
public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, UUID> {

    List<EmailTemplate> findByOrderByUpdatedAtDesc();
}
