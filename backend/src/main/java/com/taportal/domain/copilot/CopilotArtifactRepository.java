package com.taportal.domain.copilot;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for CopilotArtifact rows (Spring Data JPA; derived queries only). */
public interface CopilotArtifactRepository extends JpaRepository<CopilotArtifact, UUID> {

    List<CopilotArtifact> findByOrderByCreatedAtDesc();
}
