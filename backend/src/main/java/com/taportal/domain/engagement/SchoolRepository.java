package com.taportal.domain.engagement;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for School rows (Spring Data JPA; derived queries only). */
public interface SchoolRepository extends JpaRepository<School, UUID> {

    List<School> findByOrderByName();
}
