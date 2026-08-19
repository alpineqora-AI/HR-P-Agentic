package com.taportal.domain.interview;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Single-row scheduling policy (id = 1) — the guardrails the engine enforces. */
@Entity
@Table(name = "scheduling_policy")
@Getter
@Setter
@NoArgsConstructor
public class SchedulingPolicy {

    @Id
    private Integer id;

    @Column(name = "min_notice_hours", nullable = false)
    private int minNoticeHours;

    @Column(name = "horizon_days", nullable = false)
    private int horizonDays;

    @Column(name = "buffer_minutes", nullable = false)
    private int bufferMinutes;

    @Column(name = "reschedule_limit", nullable = false)
    private int rescheduleLimit;

    @Column(name = "reschedule_cutoff_hours", nullable = false)
    private int rescheduleCutoffHours;
}
