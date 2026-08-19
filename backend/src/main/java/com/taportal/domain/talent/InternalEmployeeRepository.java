package com.taportal.domain.talent;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for InternalEmployee rows (Spring Data JPA; derived queries only). */
public interface InternalEmployeeRepository extends JpaRepository<InternalEmployee, UUID> {}
