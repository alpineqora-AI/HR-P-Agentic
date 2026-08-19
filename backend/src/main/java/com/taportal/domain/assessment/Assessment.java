package com.taportal.domain.assessment;

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

/** A candidate assessment attached to an application (HireVue). */
@Entity
@Table(name = "assessment")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Assessment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "application_id", nullable = false)
    private UUID applicationId;

    /** COGNITIVE | CODING | GAME | JOB_TRYOUT */
    @Setter
    @Column(nullable = false)
    private String type;

    @Setter
    @Column(nullable = false)
    private String name;

    /** ASSIGNED | IN_PROGRESS | COMPLETED | EXPIRED */
    @Setter
    @Column(nullable = false)
    private String status;

    @Setter
    @Column
    private Integer score;

    @Setter
    @Column
    private Integer percentile;

    @CreationTimestamp
    @Column(name = "assigned_at", updatable = false)
    private OffsetDateTime assignedAt;

    @Setter
    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}
