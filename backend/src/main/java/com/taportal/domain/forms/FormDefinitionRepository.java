package com.taportal.domain.forms;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for FormDefinition rows (Spring Data JPA; derived queries only). */
public interface FormDefinitionRepository extends JpaRepository<FormDefinition, UUID> {

    /** The default (non-template) form of a kind — what legacy callers render. */
    Optional<FormDefinition> findFirstByPurposeAndDefaultForKindTrueAndTemplateFalse(String purpose);

    java.util.List<FormDefinition> findByOrderByPurposeAscNameAsc();

    java.util.List<FormDefinition> findByPurposeAndDefaultForKindTrue(String purpose);
}
