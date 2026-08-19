package com.taportal.domain.job;

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

/** A configurable knockout screening question for a job. */
@Entity
@Table(name = "knockout_question")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class KnockoutQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "job_id", nullable = false)
    private UUID jobId;

    @Setter
    @Column(nullable = false)
    private int ordinal;

    @Setter
    @Column(nullable = false)
    private String prompt;

    /** BOOLEAN | NUMERIC | CHOICE | TEXT */
    @Setter
    @Column(name = "answer_type", nullable = false)
    private String answerType;

    /** comma list when CHOICE */
    @Setter
    @Column
    private String choices;

    /** EQ | NEQ | LT | LTE | GT | GTE | NOT_IN */
    @Setter
    @Column(name = "disqualify_op")
    private String disqualifyOp;

    @Setter
    @Column(name = "disqualify_value")
    private String disqualifyValue;

    @Setter
    @Column(nullable = false)
    private boolean required;
}
