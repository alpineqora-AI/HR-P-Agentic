package com.taportal.domain.candidate;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Composite key for {@link CandidateSkill}. */
public class CandidateSkillId implements Serializable {

    private UUID candidateId;
    private UUID skillId;

    public CandidateSkillId() {}

    public CandidateSkillId(UUID candidateId, UUID skillId) {
        this.candidateId = candidateId;
        this.skillId = skillId;
    }

    public UUID getCandidateId() {
        return candidateId;
    }

    public UUID getSkillId() {
        return skillId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof CandidateSkillId that)) return false;
        return Objects.equals(candidateId, that.candidateId) && Objects.equals(skillId, that.skillId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(candidateId, skillId);
    }
}
