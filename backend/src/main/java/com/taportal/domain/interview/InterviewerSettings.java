package com.taportal.domain.interview;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalTime;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Per-interviewer scheduling settings: working window (in their own timezone)
 * and interview load caps. No row = the engine's defaults.
 */
@Entity
@Table(name = "interviewer_settings")
@Getter
@Setter
@NoArgsConstructor
public class InterviewerSettings {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "work_start", nullable = false)
    private LocalTime workStart;

    @Column(name = "work_end", nullable = false)
    private LocalTime workEnd;

    @Column(nullable = false)
    private String timezone;

    @Column(name = "max_per_day", nullable = false)
    private int maxPerDay;

    @Column(name = "max_per_week", nullable = false)
    private int maxPerWeek;
}
