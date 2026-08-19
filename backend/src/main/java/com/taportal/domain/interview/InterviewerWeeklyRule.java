package com.taportal.domain.interview;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * A recurring weekly interviewing rule. NO_INTERVIEWS carves a blackout out of
 * the working window ("no Monday mornings"); INTERVIEW_BLOCK reserves dedicated
 * interview time — when any blocks exist for a person, their interviews are
 * scheduled only inside them.
 */
@Entity
@Table(name = "interviewer_weekly_rule")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class InterviewerWeeklyRule {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** ISO day-of-week: 1 = Monday … 7 = Sunday. */
    @Column(name = "day_of_week", nullable = false)
    private int dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    /** NO_INTERVIEWS | INTERVIEW_BLOCK */
    @Column(nullable = false, length = 20)
    private String kind;
}
