package com.taportal.domain.talent;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A skill held by an internal employee. */
@Entity
@Table(name = "internal_employee_skill")
@IdClass(InternalEmployeeSkillId.class)
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class InternalEmployeeSkill {

    @Id
    @Column(name = "employee_id", nullable = false)
    private UUID employeeId;

    @Id
    @Column(name = "skill_id", nullable = false)
    private UUID skillId;

    @Setter
    @Column(nullable = false)
    private int proficiency;
}
