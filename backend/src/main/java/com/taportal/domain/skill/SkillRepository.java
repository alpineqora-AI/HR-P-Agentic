package com.taportal.domain.skill;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for Skill rows (Spring Data JPA; derived queries only). */
public interface SkillRepository extends JpaRepository<Skill, UUID> {
}
