package com.taportal.domain.candidate;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for Candidate rows (Spring Data JPA; derived queries only). */
public interface CandidateRepository extends JpaRepository<Candidate, UUID> {

    Optional<Candidate> findByEmailIgnoreCase(String email);
}
