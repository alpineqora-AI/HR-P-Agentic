package com.taportal.domain.talent;

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

/** An internal-mobility match between an employee and a job (Eightfold marketplace). */
@Entity
@Table(name = "mobility_match")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class MobilityMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "employee_id", nullable = false)
    private UUID employeeId;

    @Setter
    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Setter
    @Column(name = "fit_score", nullable = false)
    private int fitScore;

    @Setter
    @Column
    private String rationale;
}
