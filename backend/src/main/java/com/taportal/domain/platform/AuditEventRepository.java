package com.taportal.domain.platform;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for AuditEvent rows (Spring Data JPA; derived queries only). */
public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {

    List<AuditEvent> findTop100ByOrderByCreatedAtDesc();
}
