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

/**
 * A busy block on a recruiter/interviewer's calendar. Internal stand-in for
 * Microsoft Graph free/busy — swap for real calendar sync at delivery. Interview
 * bookings write one INTERVIEW event per participant, so invites double as
 * availability blockers for every other candidate being scheduled.
 */
@Entity
@Table(name = "calendar_event")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class CalendarEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Setter
    @Column(name = "interview_id")
    private UUID interviewId;

    @Setter
    @Column
    private String title;

    @Setter
    @Column(name = "starts_at", nullable = false)
    private OffsetDateTime startsAt;

    @Setter
    @Column(name = "ends_at", nullable = false)
    private OffsetDateTime endsAt;

    /** BUSY | INTERVIEW */
    @Setter
    @Column(nullable = false)
    private String kind = "BUSY";
}
