package com.taportal.domain.interview;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One round of a requisition's interview plan (defined at intake). */
@Entity
@Table(name = "interview_round")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class InterviewRound {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Column(name = "round_no", nullable = false)
    private int roundNo;

    @Setter
    @Column(nullable = false, length = 80)
    private String name;

    @Setter
    @Column(name = "duration_min", nullable = false)
    private int durationMin;
}
