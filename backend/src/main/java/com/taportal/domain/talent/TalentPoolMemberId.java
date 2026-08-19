package com.taportal.domain.talent;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Composite key for {@link TalentPoolMember}. */
public class TalentPoolMemberId implements Serializable {

    private UUID poolId;
    private UUID candidateId;

    public TalentPoolMemberId() {}

    public TalentPoolMemberId(UUID poolId, UUID candidateId) {
        this.poolId = poolId;
        this.candidateId = candidateId;
    }

    public UUID getPoolId() {
        return poolId;
    }

    public UUID getCandidateId() {
        return candidateId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TalentPoolMemberId that)) return false;
        return Objects.equals(poolId, that.poolId) && Objects.equals(candidateId, that.candidateId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(poolId, candidateId);
    }
}
