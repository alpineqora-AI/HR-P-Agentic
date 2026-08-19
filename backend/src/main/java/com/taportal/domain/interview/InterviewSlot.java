package com.taportal.domain.interview;

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

/** A self-scheduling interview slot offered for a job (Paradox scheduling). */
@Entity
@Table(name = "interview_slot")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class InterviewSlot {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "job_id")
    private UUID jobId;

    @Setter
    @Column(name = "interviewer_id")
    private UUID interviewerId;

    @Setter
    @Column(name = "starts_at", nullable = false)
    private OffsetDateTime startsAt;

    @Setter
    @Column(name = "ends_at", nullable = false)
    private OffsetDateTime endsAt;

    @Setter
    @Column(nullable = false)
    private boolean booked;

    /** Set when this slot was proposed for a specific interview (calendar-driven flow). */
    @Setter
    @Column(name = "interview_id")
    private UUID interviewId;

    /** OPEN (legacy per-job pool) | PROPOSED | SELECTED | EXPIRED */
    @Setter
    @Column(nullable = false)
    private String status = "OPEN";
}
