package com.taportal.domain.engagement;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

/** A single response to a survey. */
@Entity
@Table(name = "survey_response")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class SurveyResponse {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(name = "survey_id", nullable = false)
    private UUID surveyId;

    @Setter
    @Column(name = "candidate_id")
    private UUID candidateId;

    @Setter
    @Column
    private Integer rating;

    @Setter
    @Column(precision = 4, scale = 2)
    private BigDecimal sentiment;

    @Setter
    @Column
    private String verbatim;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private OffsetDateTime createdAt;
}
