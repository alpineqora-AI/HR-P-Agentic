package com.taportal.domain.onboarding;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** An onboarding task attached to an application (Paradox onboarding). */
@Entity
@Table(name = "onboarding_task")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class OnboardingTask {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "application_id", nullable = false)
    private UUID applicationId;

    @Setter
    @Column(nullable = false)
    private String name;

    /** DOCS | IT | COMMS | DAY_ONE | COMPLIANCE */
    @Setter
    @Column(nullable = false)
    private String category;

    /** PENDING | SENT | COMPLETED */
    @Setter
    @Column(nullable = false)
    private String status;

    @Setter
    @Column(name = "due_date")
    private LocalDate dueDate;

    @Setter
    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}
