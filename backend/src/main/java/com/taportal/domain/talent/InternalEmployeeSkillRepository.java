package com.taportal.domain.talent;

import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for InternalEmployeeSkill rows (Spring Data JPA; derived queries only). */
public interface InternalEmployeeSkillRepository
        extends JpaRepository<InternalEmployeeSkill, InternalEmployeeSkillId> {}
