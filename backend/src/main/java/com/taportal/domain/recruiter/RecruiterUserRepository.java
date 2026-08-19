package com.taportal.domain.recruiter;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for RecruiterUser rows (Spring Data JPA; derived queries only). */
public interface RecruiterUserRepository extends JpaRepository<RecruiterUser, UUID> {

    RecruiterUser findFirstByRole(String role);

    List<RecruiterUser> findAll();
}
