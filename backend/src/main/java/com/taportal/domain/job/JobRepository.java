package com.taportal.domain.job;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for Job rows (Spring Data JPA; derived queries only). */
public interface JobRepository extends JpaRepository<Job, UUID> {

    List<Job> findAllByOrderByPostedAtDesc();
}
