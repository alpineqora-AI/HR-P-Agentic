package com.taportal.domain.talent;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** Membership of a candidate in a talent pool. */
@Entity
@Table(name = "talent_pool_member")
@IdClass(TalentPoolMemberId.class)
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class TalentPoolMember {

    @Id
    @Column(name = "pool_id", nullable = false)
    private UUID poolId;

    @Id
    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Setter
    @CreationTimestamp
    @Column(name = "added_at", updatable = false)
    private OffsetDateTime addedAt;
}
