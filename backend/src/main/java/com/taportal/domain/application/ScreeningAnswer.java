package com.taportal.domain.application;

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

/** A candidate's answer to a knockout question during screening. */
@Entity
@Table(name = "screening_answer")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class ScreeningAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "application_id", nullable = false)
    private UUID applicationId;

    @Setter
    @Column(name = "question_id", nullable = false)
    private UUID questionId;

    @Setter
    @Column
    private String answer;

    @Setter
    @Column
    private Boolean passed;
}
