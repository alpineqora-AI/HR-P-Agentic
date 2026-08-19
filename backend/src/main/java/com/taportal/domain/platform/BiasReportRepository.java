package com.taportal.domain.platform;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for BiasReport rows (Spring Data JPA; derived queries only). */
public interface BiasReportRepository extends JpaRepository<BiasReport, UUID> {}
