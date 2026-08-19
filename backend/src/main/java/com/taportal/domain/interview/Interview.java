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
import org.hibernate.annotations.CreationTimestamp;

/** An interview attached to an application (Humanly AI interviewer, HireVue video, …). */
@Entity
@Table(name = "interview")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class Interview {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "application_id", nullable = false)
    private UUID applicationId;

    @Setter
    @Column(name = "slot_id")
    private UUID slotId;

    /** AI_PHONE_SCREEN | AI_INTERVIEW | ONE_WAY_VIDEO | LIVE_VIDEO | PANEL | ONSITE */
    @Setter
    @Column(nullable = false)
    private String type;

    @Setter
    @Column(name = "scheduled_at")
    private OffsetDateTime scheduledAt;

    @Setter
    @Column(name = "duration_min", nullable = false)
    private int durationMin;

    /** REQUESTED | SLOTS_PROPOSED (awaiting candidate) | SCHEDULED | COMPLETED | NO_SHOW | CANCELED */
    @Setter
    @Column(nullable = false)
    private String status;

    /** Teams/video link, set when the interview is booked. */
    @Setter
    @Column(name = "meeting_link")
    private String meetingLink;

    /** Comma list of interviewer names. */
    @Setter
    @Column
    private String interviewers;

    @Setter
    @Column
    private Integer score;

    /** ADVANCE | HOLD | REJECT */
    @Setter
    @Column
    private String recommendation;

    @Setter
    @Column
    private String summary;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;

    /** Candidate-driven reschedules, counted against the policy limit. */
    @Setter
    @Column(name = "reschedule_count", nullable = false)
    private int rescheduleCount;
}
