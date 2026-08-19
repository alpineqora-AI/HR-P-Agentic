package com.taportal.domain.job;

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

/** A skill required/weighted on a job (skills graph edge). */
@Entity
@Table(name = "job_skill")
@IdClass(JobSkillId.class)
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class JobSkill {

    @Id
    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Id
    @Column(name = "skill_id", nullable = false)
    private UUID skillId;

    @Setter
    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal weight;

    @Setter
    @Column(nullable = false)
    private boolean required;
}
