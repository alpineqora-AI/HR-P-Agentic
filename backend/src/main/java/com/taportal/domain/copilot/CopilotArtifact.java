package com.taportal.domain.copilot;

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

/** A generated AI copilot artifact (JD/outreach/etc. — Sense). */
@Entity
@Table(name = "copilot_artifact")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class CopilotArtifact {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** JD | OUTREACH | INTERVIEW_QUESTIONS | SUMMARY | REWRITE */
    @Setter
    @Column(nullable = false)
    private String kind;

    @Setter
    @Column(name = "job_id")
    private UUID jobId;

    @Setter
    @Column
    private String prompt;

    @Setter
    @Column(nullable = false)
    private String content;

    @Setter
    @Column(name = "created_by")
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
