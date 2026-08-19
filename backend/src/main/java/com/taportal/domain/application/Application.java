package com.taportal.domain.application;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

/** An application — the pipeline spine linking a candidate to a job. */
@Entity
@Table(name = "application")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Application {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "candidate_id", nullable = false)
    private UUID candidateId;

    @Setter
    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    /** APPLIED|SCREENED|MATCHED|INTERVIEW|ASSESSMENT|OFFER|HIRED|REJECTED|WITHDRAWN */
    @Setter
    @Column(nullable = false)
    private String stage;

    @Setter
    @Column(nullable = false)
    private String source;

    /** 0..100 (nullable) */
    @Setter
    @Column(name = "fit_score")
    private Integer fitScore;

    @Setter
    @Column(name = "fit_explanation")
    private String fitExplanation;

    @Setter
    @Column(name = "knockout_passed")
    private Boolean knockoutPassed;

    @Setter
    @Column(name = "rejection_reason")
    private String rejectionReason;

    @CreationTimestamp
    @Column(name = "applied_at", updatable = false)
    private OffsetDateTime appliedAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;
}
