package com.taportal.domain.job;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Composite key for {@link JobSkill}. */
public class JobSkillId implements Serializable {

    private UUID jobId;
    private UUID skillId;

    public JobSkillId() {}

    public JobSkillId(UUID jobId, UUID skillId) {
        this.jobId = jobId;
        this.skillId = skillId;
    }

    public UUID getJobId() {
        return jobId;
    }

    public UUID getSkillId() {
        return skillId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof JobSkillId that)) return false;
        return Objects.equals(jobId, that.jobId) && Objects.equals(skillId, that.skillId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(jobId, skillId);
    }
}
