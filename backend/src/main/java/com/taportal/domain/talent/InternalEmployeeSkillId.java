package com.taportal.domain.talent;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Composite key for {@link InternalEmployeeSkill}. */
public class InternalEmployeeSkillId implements Serializable {

    private UUID employeeId;
    private UUID skillId;

    public InternalEmployeeSkillId() {}

    public InternalEmployeeSkillId(UUID employeeId, UUID skillId) {
        this.employeeId = employeeId;
        this.skillId = skillId;
    }

    public UUID getEmployeeId() {
        return employeeId;
    }

    public UUID getSkillId() {
        return skillId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof InternalEmployeeSkillId that)) return false;
        return Objects.equals(employeeId, that.employeeId) && Objects.equals(skillId, that.skillId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(employeeId, skillId);
    }
}
