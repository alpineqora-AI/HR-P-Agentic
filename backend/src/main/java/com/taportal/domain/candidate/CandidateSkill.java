package com.taportal.domain.candidate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A skill held by a candidate (stated or skills-graph inferred). */
@Entity
@Table(name = "candidate_skill")
@IdClass(CandidateSkillId.class)
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class CandidateSkill {

    @Id
    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Id
    @Column(name = "skill_id", nullable = false)
    private UUID skillId;

    @Setter
    @Column(nullable = false)
    private int proficiency;

    @Setter
    @Column(nullable = false, precision = 4, scale = 1)
    private BigDecimal years;

    @Setter
    @Column(nullable = false)
    private boolean inferred;
}
