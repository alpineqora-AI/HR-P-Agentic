package com.taportal.domain.interview;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SchedulingPolicyRepository extends JpaRepository<SchedulingPolicy, Integer> {

    /** The one policy row; falls back to code defaults if somehow absent. */
    default SchedulingPolicy current() {
        return findById(1).orElseGet(() -> {
            SchedulingPolicy p = new SchedulingPolicy();
            p.setId(1);
            p.setMinNoticeHours(20);
            p.setHorizonDays(14);
            p.setBufferMinutes(15);
            p.setRescheduleLimit(2);
            p.setRescheduleCutoffHours(12);
            return p;
        });
    }
}
