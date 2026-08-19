package com.taportal.domain.platform;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for Integration rows (Spring Data JPA; derived queries only). */
public interface IntegrationRepository extends JpaRepository<Integration, UUID> {}
