package com.taportal.domain.platform;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** A bias / adverse-impact report for a funnel stage (HireVue compliance). */
@Entity
@Table(name = "bias_report")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class BiasReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "job_id")
    private UUID jobId;

    @Setter
    @Column(nullable = false)
    private String stage;

    /** GENDER | ETHNICITY | AGE | OVERALL */
    @Setter
    @Column(nullable = false)
    private String dimension;

    @Setter
    @Column(name = "group_label", nullable = false)
    private String groupLabel;

    @Setter
    @Column(name = "pass_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal passRate;

    @Setter
    @Column(name = "impact_ratio", precision = 5, scale = 2)
    private BigDecimal impactRatio;

    @Setter
    @Column(nullable = false)
    private boolean flagged;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
